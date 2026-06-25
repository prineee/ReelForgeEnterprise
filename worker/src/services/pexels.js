'use strict'

const axios        = require('axios')
const fs           = require('fs')
const path         = require('path')
const { pipeline } = require('stream/promises')

const PEXELS_SEARCH  = 'https://api.pexels.com/videos/search'
const PIXABAY_VIDEOS = 'https://pixabay.com/api/videos/'

// ── Pexels file picker ────────────────────────────────────────────────────────
function pickPexelsFile(videoFiles) {
  if (!videoFiles || !videoFiles.length) return null
  var candidates = videoFiles
    .filter(function(f) {
      return f.file_type === 'video/mp4' &&
             f.width  >= 480  &&
             f.width  <= 1280 &&
             (f.height == null || f.height <= 1920)
    })
    .sort(function(a, b) { return a.width - b.width })
  return candidates[0] || null
}

// ── Keyword extraction ────────────────────────────────────────────────────────
var BANNED_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','have','has',
  'had','do','does','will','would','could','should','this','that',
  'with','from','into','and','but','or','for','of','at','in','on',
  'to','by','as','it','its','we','you','they','our','your','their',
  'scene','shows','depicting','featuring','close','shot','wide',
  'business','success','motivation','lifestyle','professional',
  'concept','abstract','background','generic','diverse','people',
])

function cleanKeyword(raw) {
  if (!raw) return ''
  return raw
    .replace(/\[.*?\]/g, '')
    .replace(/b-roll|close.?up|wide shot|medium shot|drone|tracking|cinematic|dramatic/gi, '')
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(function(w) { return w.length > 2 && !BANNED_WORDS.has(w.toLowerCase()) })
    .slice(0, 4)
    .join(' ')
}

/**
 * Primary keyword from a scene — uses visualNote, visualKeywords, title, voiceover in order
 */
function sceneToKeyword(scene) {
  // New contract: visualKeywords array
  if (Array.isArray(scene.visualKeywords) && scene.visualKeywords.length > 0) {
    var kw = scene.visualKeywords[0]
    if (kw && kw.length > 3) {
      console.log('[keyword] Scene ' + scene.number + ' visualKeywords[0]: "' + kw + '"')
      return kw
    }
  }

  // Old contract: visualNote string
  if (scene.visualNote && scene.visualNote.length > 5) {
    var cleaned = cleanKeyword(scene.visualNote)
    if (cleaned.split(/\s+/).length >= 2) {
      console.log('[keyword] Scene ' + scene.number + ' visualNote: "' + cleaned + '"')
      return cleaned
    }
  }

  // Title
  if (scene.title && scene.title.length > 3) {
    var titleCleaned = cleanKeyword(scene.title)
    if (titleCleaned) {
      console.log('[keyword] Scene ' + scene.number + ' title: "' + titleCleaned + '"')
      return titleCleaned
    }
  }

  // First meaningful words of voiceover
  if (scene.voiceover) {
    var words = scene.voiceover.split(/\s+/).filter(function(w) { return w.length > 4 }).slice(0, 3)
    if (words.length > 0) {
      console.log('[keyword] Scene ' + scene.number + ' voiceover: "' + words.join(' ') + '"')
      return words.join(' ')
    }
  }

  console.warn('[keyword] Scene ' + (scene.number || '?') + ' no keyword — using "tutorial"')
  return 'tutorial'
}

/**
 * All keywords for a scene in priority order (for multi-attempt fallback)
 */
function getSceneKeywords(scene) {
  var keywords = []

  // All visualKeywords
  if (Array.isArray(scene.visualKeywords)) {
    scene.visualKeywords.forEach(function(k) {
      if (k && k.length > 3) keywords.push(k)
    })
  }

  // visualNote
  if (scene.visualNote && scene.visualNote.length > 5) {
    var c = cleanKeyword(scene.visualNote)
    if (c && c.split(/\s+/).length >= 2) keywords.push(c)
  }

  // Title
  if (scene.title && scene.title.length > 3) {
    var tc = cleanKeyword(scene.title)
    if (tc) keywords.push(tc)
  }

  // Deduplicate
  var seen = {}
  var unique = []
  keywords.forEach(function(k) {
    if (!seen[k]) { seen[k] = true; unique.push(k) }
  })

  return unique
}

// ── Pixabay search ────────────────────────────────────────────────────────────
async function searchPixabay(keyword, portrait) {
  var apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) return null

  var params = 'key=' + encodeURIComponent(apiKey) +
               '&q=' + encodeURIComponent(keyword.slice(0, 100)) +
               '&per_page=10' +
               '&video_type=film' +
               (portrait ? '&orientation=vertical' : '')

  try {
    var res = await axios.get(PIXABAY_VIDEOS + '?' + params, { timeout: 20000 })
    var hits = (res.data && res.data.hits) || []
    var hit  = hits[0]
    if (!hit) return null
    var vid = (hit.videos && (hit.videos.small || hit.videos.medium)) || null
    return vid ? vid.url : null
  } catch (err) {
    console.warn('[Pixabay] search failed for "' + keyword + '": ' + err.message)
    return null
  }
}

// ── Pexels search ─────────────────────────────────────────────────────────────
async function searchPexels(keyword, portrait) {
  var apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  try {
    var res = await axios.get(PEXELS_SEARCH, {
      headers: { Authorization: apiKey },
      params: {
        query:       keyword,
        per_page:    10,
        size:        'medium',
        orientation: portrait ? 'portrait' : undefined,
      },
      timeout: 20000,
    })
    var videos = (res.data && res.data.videos) || []
    for (var i = 0; i < videos.length; i++) {
      var file = pickPexelsFile(videos[i].video_files)
      if (file && file.link) return file.link
    }
    return null
  } catch (err) {
    console.warn('[Pexels] search failed for "' + keyword + '": ' + err.message)
    return null
  }
}

// ── Download a URL to a file ──────────────────────────────────────────────────
async function downloadUrl(url, outputPath) {
  var res = await axios.get(url, { responseType: 'stream', timeout: 120000 })
  await pipeline(res.data, fs.createWriteStream(outputPath))
  console.log('[stock] Saved ' + path.basename(outputPath) + ' (' + fs.statSync(outputPath).size + ' bytes)')
  return outputPath
}

/**
 * Download one clip for a keyword.
 * Tries Pixabay first (free), then Pexels (free tier).
 * Both portrait and landscape orientations attempted.
 */
async function downloadOneClip(keyword, outputPath, portrait) {
  if (portrait === undefined) portrait = true
  var url = null

  // 1. Pixabay portrait
  url = await searchPixabay(keyword, portrait)
  if (url) {
    console.log('[stock] Pixabay found for "' + keyword + '": ' + url.slice(0, 70))
    return downloadUrl(url, outputPath)
  }

  // 2. Pixabay without orientation constraint
  if (portrait) {
    url = await searchPixabay(keyword, false)
    if (url) {
      console.log('[stock] Pixabay (any orient) found for "' + keyword + '"')
      return downloadUrl(url, outputPath)
    }
  }

  // 3. Pexels portrait
  url = await searchPexels(keyword, portrait)
  if (url) {
    console.log('[stock] Pexels found for "' + keyword + '": ' + url.slice(0, 70))
    return downloadUrl(url, outputPath)
  }

  // 4. Pexels without orientation constraint
  if (portrait) {
    url = await searchPexels(keyword, false)
    if (url) {
      console.log('[stock] Pexels (any orient) found for "' + keyword + '"')
      return downloadUrl(url, outputPath)
    }
  }

  throw new Error('No clip found on Pixabay or Pexels for "' + keyword + '"')
}

/**
 * Download one clip per keyword — legacy helper for processReel
 */
async function downloadClips(keywords, targetDir) {
  var clips = []
  for (var i = 0; i < keywords.length; i++) {
    var keyword = keywords[i]
    var dest    = path.join(targetDir, 'clip_' + keyword.replace(/\s+/g, '_') + '_' + Date.now() + '.mp4')
    try {
      await downloadOneClip(keyword, dest, false)
      clips.push(dest)
    } catch (err) {
      console.warn('[stock] Skipping "' + keyword + '": ' + err.message)
    }
  }
  if (clips.length === 0) throw new Error('Failed to download any clips')
  console.log('[stock] Downloaded ' + clips.length + '/' + keywords.length + ' clips')
  return clips
}

/**
 * Download clips matched to script scenes — uses visualKeywords for better relevance
 */
async function downloadClipsForScenes(scenes, targetDir, clipsPerScene) {
  if (!scenes || !scenes.length) throw new Error('scenes array is required')
  if (!clipsPerScene) clipsPerScene = 2

  var clips = []

  for (var i = 0; i < scenes.length; i++) {
    var scene   = scenes[i]
    var keyword = sceneToKeyword(scene)
    console.log('[stock] Scene ' + (i + 1) + '/' + scenes.length + ': searching "' + keyword + '"')

    var downloaded = false

    for (var attempt = 0; attempt < clipsPerScene && !downloaded; attempt++) {
      var dest = path.join(targetDir, 'scene_' + (i + 1) + '_' + (attempt + 1) + '_' + Date.now() + '.mp4')
      try {
        await downloadOneClip(keyword, dest, true)
        var stat = fs.statSync(dest)
        if (stat.size < 100000) {
          console.warn('[stock] Scene ' + (i + 1) + ' too small (' + stat.size + ' bytes)')
          try { fs.unlinkSync(dest) } catch(e) {}
          continue
        }
        clips.push(dest)
        downloaded = true
        console.log('[stock] Scene ' + (i + 1) + ': OK ' + path.basename(dest) + ' (' + stat.size + ' bytes)')
      } catch (err) {
        console.warn('[stock] Scene ' + (i + 1) + ' attempt ' + (attempt + 1) + ' failed: ' + err.message)
      }
    }

    if (!downloaded) {
      var fallbackKw = keyword.split(' ').slice(0, 2).join(' ') || 'nature'
      console.warn('[stock] Scene ' + (i + 1) + ': trying fallback "' + fallbackKw + '"')
      var fdest = path.join(targetDir, 'scene_' + (i + 1) + '_fallback_' + Date.now() + '.mp4')
      try {
        await downloadOneClip(fallbackKw, fdest, true)
        var fstat = fs.statSync(fdest)
        if (fstat.size >= 100000) {
          clips.push(fdest)
          console.log('[stock] Scene ' + (i + 1) + ': fallback OK (' + fstat.size + ' bytes)')
        } else {
          try { fs.unlinkSync(fdest) } catch(e) {}
        }
      } catch (err) {
        console.warn('[stock] Scene ' + (i + 1) + ': fallback failed: ' + err.message)
      }
    }
  }

  if (clips.length === 0) throw new Error('Failed to download any clips for ' + scenes.length + ' scenes')
  console.log('[stock] downloadClipsForScenes: ' + clips.length + ' clips for ' + scenes.length + ' scenes')
  return clips
}

module.exports = {
  downloadOneClip,
  downloadClips,
  downloadClipsForScenes,
  sceneToKeyword,
  getSceneKeywords,
}