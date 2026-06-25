'use strict'

const axios    = require('axios')
const fs       = require('fs')
const path     = require('path')
const { pipeline } = require('stream/promises')

const PIXABAY_URL = 'https://pixabay.com/api/videos/'
const PEXELS_URL  = 'https://api.pexels.com/videos/search'

/**
 * Picks the best MP4 from a Pexels video file list.
 * Prefers portrait orientation, 480–1280px wide, avoids 4K.
 */
function pickPexelsFile(videoFiles) {
  if (!videoFiles?.length) return null
  return videoFiles
    .filter(f => f.file_type === 'video/mp4' && f.width >= 480 && f.width <= 1280 && (!f.height || f.height <= 1920))
    .sort((a, b) => a.width - b.width)[0] ?? null
}

/**
 * Extracts a clean 3–4 word stock-footage search query from a scene.
 * Priority: visualNote > title > voiceover excerpt.
 * Strips camera direction words so we search for subjects, not shot types.
 */
function sceneToKeyword(scene) {
  // Priority 1: use visualKeywords array if present (new contract)
  if (Array.isArray(scene.visualKeywords) && scene.visualKeywords.length > 0) {
    const keyword = scene.visualKeywords[0]
    console.log(`[keyword] Scene ${scene.number} using visualKeywords[0]: "${keyword}"`)
    return keyword
  }

  // Priority 2: visualNote (old contract, single string)
  if (scene.visualNote && scene.visualNote.length > 5) {
    const cleaned = scene.visualNote
      .replace(/\[.*?\]/g, '')
      .replace(/b-roll|close.?up|wide shot|medium shot|drone|tracking|cinematic|dramatic/gi, '')
      .replace(/[^\w\s]/g, ' ')
      .trim()

    const stopWords = new Set([
      'the','a','an','is','are','was','were','be','been','have','has',
      'had','do','does','will','would','could','should','this','that',
      'with','from','into','and','but','or','for','of','at','in','on',
      'to','by','as','it','its','scene','shows','depicting',
      'business','success','motivation','people','lifestyle','professional',
    ])

    const words = cleaned.split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()))
      .slice(0, 4)

    if (words.length >= 2) {
      console.log(`[keyword] Scene ${scene.number} using visualNote: "${words.join(' ')}"`)
      return words.join(' ')
    }
  }

  // Priority 3: title
  if (scene.title && scene.title.length > 3) {
    console.log(`[keyword] Scene ${scene.number} using title: "${scene.title}"`)
    return scene.title
  }

  // Priority 4: first meaningful words of voiceover
  if (scene.voiceover) {
    const words = scene.voiceover.split(/\s+/).filter(w => w.length > 4).slice(0, 3)
    if (words.length > 0) {
      console.log(`[keyword] Scene ${scene.number} using voiceover excerpt: "${words.join(' ')}"`)
      return words.join(' ')
    }
  }

  console.warn(`[keyword] Scene ${scene.number} no keyword found — using 'tutorial demonstration'`)
  return 'tutorial demonstration'
}

/**
 * Returns an ordered, de-duplicated list of keywords to try for one scene.
 * visualKeywords (new contract) first, then visualNote, then title.
 */
function getSceneKeywords(scene) {
  // Returns array of keywords to try in order
  const keywords = []

  // From new visualKeywords array
  if (Array.isArray(scene.visualKeywords)) {
    keywords.push(...scene.visualKeywords.filter(Boolean))
  }

  // From old visualNote
  if (scene.visualNote && scene.visualNote.length > 5) {
    keywords.push(scene.visualNote)
  }

  // From title
  if (scene.title) keywords.push(scene.title)

  // Deduplicate
  return [...new Set(keywords)].filter(k => k && k.length > 3)
}

/**
 * Downloads one clip to outputPath.
 * Tries Pixabay first, then Pexels as fallback.
 *
 * @param {string}  keyword     - Search query
 * @param {string}  outputPath  - Destination file path
 * @param {boolean} portrait    - Prefer portrait (9:16) orientation
 */
async function downloadOneClip(keyword, outputPath, portrait = true) {
  console.log('=== CLIP SEARCH TRACE ===')
  console.log('SEARCHING Pixabay for:', keyword)
  let downloadUrl = null

  // ── Attempt 1: Pixabay ──────────────────────────────────────────────────────
  const pixabayKey = process.env.PIXABAY_API_KEY
  if (pixabayKey) {
    try {
      const { data } = await axios.get(PIXABAY_URL, {
        params: {
          key:         pixabayKey,
          q:           keyword,
          per_page:    10,
          video_type:  'film',
          ...(portrait ? { orientation: 'vertical' } : {}),
        },
        timeout: 30_000,
      })
      const hits = data.hits ?? []
      for (const hit of hits) {
        const url = hit.videos?.small?.url || hit.videos?.medium?.url || hit.videos?.large?.url
        if (url) { downloadUrl = url; break }
      }
      if (downloadUrl) console.log(`[stockVideo] Pixabay hit for "${keyword}": ${downloadUrl.slice(0, 80)}`)
      console.log('PIXABAY result URL:', downloadUrl ? downloadUrl.slice(0, 80) : 'NO RESULT')
    } catch (err) {
      console.warn(`[stockVideo] Pixabay failed for "${keyword}":`, err.message)
      console.log('PIXABAY result URL: NO RESULT (error)')
    }
  }

  // ── Attempt 2: Pexels fallback ──────────────────────────────────────────────
  if (!downloadUrl) {
    const pexelsKey = process.env.PEXELS_API_KEY
    if (!pexelsKey) throw new Error(`No PIXABAY_API_KEY or PEXELS_API_KEY set — cannot download clip for "${keyword}"`)

    const orientations = portrait ? ['portrait', undefined] : [undefined]
    for (const orientation of orientations) {
      if (downloadUrl) break
      try {
        const { data } = await axios.get(PEXELS_URL, {
          headers: { Authorization: pexelsKey },
          params: { query: keyword, per_page: 15, size: 'medium', ...(orientation ? { orientation } : {}) },
          timeout: 30_000,
        })
        for (const video of (data.videos ?? []).slice(0, 5)) {
          const file = pickPexelsFile(video.video_files)
          if (file?.link) { downloadUrl = file.link; break }
        }
        if (downloadUrl) console.log(`[stockVideo] Pexels hit for "${keyword}": ${downloadUrl.slice(0, 80)}`)
      } catch (err) {
        console.warn(`[stockVideo] Pexels failed for "${keyword}":`, err.message)
      }
    }
    console.log('PEXELS result URL:', downloadUrl ? downloadUrl.slice(0, 80) : 'NO RESULT')
    console.log('=== END CLIP TRACE ===')
  }

  if (!downloadUrl) throw new Error(`No downloadable clip found for "${keyword}"`)

  const dlRes = await axios.get(downloadUrl, { responseType: 'stream', timeout: 120_000 })
  await pipeline(dlRes.data, fs.createWriteStream(outputPath))
  console.log(`[stockVideo] Saved ${path.basename(outputPath)}`)
  return outputPath
}

/**
 * Downloads one clip per keyword (legacy helper used by processReel).
 */
async function downloadClips(keywords, targetDir) {
  const clips = []
  for (const keyword of keywords) {
    const dest = path.join(targetDir, `clip_${keyword.replace(/\s+/g, '_')}_${Date.now()}.mp4`)
    try {
      await downloadOneClip(keyword, dest, false)
      clips.push(dest)
    } catch (err) {
      console.warn(`[stockVideo] Skipping "${keyword}": ${err.message}`)
    }
  }
  if (clips.length === 0) throw new Error(`Failed to download any clips (tried: ${keywords.join(', ')})`)
  console.log(`[stockVideo] Downloaded ${clips.length}/${keywords.length} clips`)
  return clips
}

/**
 * Downloads clips matched to script scenes.
 */
async function downloadClipsForScenes(scenes, targetDir, clipsPerScene = 2) {
  if (!scenes?.length) throw new Error('scenes array is required')

  const clips = []

  for (let i = 0; i < scenes.length; i++) {
    const scene   = scenes[i]
    const keyword = sceneToKeyword(scene)
    console.log(`[stockVideo] Scene ${i + 1}/${scenes.length}: searching "${keyword}"`)

    let downloaded = false

    for (let attempt = 0; attempt < clipsPerScene && !downloaded; attempt++) {
      const dest = path.join(targetDir, `scene_${i + 1}_${attempt + 1}_${Date.now()}.mp4`)
      try {
        await downloadOneClip(keyword, dest, true)
        const stat = fs.statSync(dest)
        if (stat.size < 100_000) {
          console.warn(`[stockVideo] Scene ${i + 1} attempt ${attempt + 1}: too small (${stat.size}b) — skipping`)
          try { fs.unlinkSync(dest) } catch { /* ignore */ }
          continue
        }
        clips.push(dest)
        downloaded = true
        console.log(`[stockVideo] Scene ${i + 1}: saved ${path.basename(dest)} (${stat.size}b)`)
      } catch (err) {
        console.warn(`[stockVideo] Scene ${i + 1} attempt ${attempt + 1} failed: ${err.message}`)
      }
    }

    if (!downloaded) {
      const fallbackKw = keyword.split(' ').slice(0, 2).join(' ') || 'lifestyle'
      console.warn(`[stockVideo] Scene ${i + 1}: trying fallback "${fallbackKw}"`)
      const dest = path.join(targetDir, `scene_${i + 1}_fallback_${Date.now()}.mp4`)
      try {
        await downloadOneClip(fallbackKw, dest, true)
        const stat = fs.statSync(dest)
        if (stat.size >= 100_000) {
          clips.push(dest)
          console.log(`[stockVideo] Scene ${i + 1}: fallback succeeded (${stat.size}b)`)
        } else {
          try { fs.unlinkSync(dest) } catch { /* ignore */ }
        }
      } catch (err) {
        console.warn(`[stockVideo] Scene ${i + 1}: fallback failed: ${err.message}`)
      }
    }
  }

  if (clips.length === 0) throw new Error(`Failed to download any clips for ${scenes.length} scenes`)
  console.log(`[stockVideo] downloadClipsForScenes: ${clips.length} clips for ${scenes.length} scenes`)
  return clips
}

module.exports = { downloadOneClip, downloadClips, downloadClipsForScenes, sceneToKeyword, getSceneKeywords }
