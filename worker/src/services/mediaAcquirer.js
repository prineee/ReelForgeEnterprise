'use strict'

/**
 * FILE: worker/src/services/mediaAcquirer.js
 *
 * Phase 2 — Media Acquisition
 *
 * Acquires unique media for every scene with 6-tier fallback:
 *   1. Pixabay VIDEO  for visualKeywords[0]
 *   2. Pixabay VIDEO  for visualKeywords[1]
 *   3. Pixabay VIDEO  for visualKeywords[2]
 *   4. Pexels  VIDEO  for visualKeywords[0]
 *   5. Pexels  VIDEO  for visualKeywords[1]
 *   6. Pixabay IMAGE  for visualKeywords[0]  → zoom/pan animation via FFmpeg
 *   7. Pexels  IMAGE  for visualKeywords[0]  → zoom/pan animation via FFmpeg
 *   8. Solid color background                → last resort
 *
 * URL deduplication: usedUrls Set passed across ALL scenes so no clip repeats.
 */

const axios  = require('axios')
const path   = require('path')
const fs     = require('fs')
const { pipeline } = require('stream/promises')

const PIXABAY_VIDEO_URL = 'https://pixabay.com/api/videos/'
const PIXABAY_IMAGE_URL = 'https://pixabay.com/api/'
const PEXELS_VIDEO_URL  = 'https://api.pexels.com/videos/search'
const PEXELS_IMAGE_URL  = 'https://api.pexels.com/v1/search'

// Delay between API calls to avoid rate limiting
const API_DELAY_MS = 250

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Pixabay video search ──────────────────────────────────────────────────────
async function searchPixabayVideo(keyword, usedUrls) {
  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) return null

  try {
    const res = await axios.get(PIXABAY_VIDEO_URL, {
      params: {
        key:          apiKey,
        q:            keyword.slice(0, 100),
        per_page:     15,
        video_type:   'film',
        orientation:  'vertical',
      },
      timeout: 15000,
    })

    const hits = (res.data && res.data.hits) || []

    for (const hit of hits) {
      const vid = (hit.videos && (hit.videos.small || hit.videos.medium || hit.videos.large))
      const url = vid && vid.url
      if (url && !usedUrls.has(url)) {
        console.log(`[acquire] Pixabay video: "${keyword}" → ${url.slice(0, 60)}`)
        return { type: 'video', url, source: 'pixabay', keyword }
      }
    }

    // No unused URL found — try without portrait constraint
    const res2 = await axios.get(PIXABAY_VIDEO_URL, {
      params: {
        key:        apiKey,
        q:          keyword.slice(0, 100),
        per_page:   15,
        video_type: 'film',
      },
      timeout: 15000,
    })

    const hits2 = (res2.data && res2.data.hits) || []
    for (const hit of hits2) {
      const vid = (hit.videos && (hit.videos.small || hit.videos.medium || hit.videos.large))
      const url = vid && vid.url
      if (url && !usedUrls.has(url)) {
        console.log(`[acquire] Pixabay video (any orient): "${keyword}" → ${url.slice(0, 60)}`)
        return { type: 'video', url, source: 'pixabay', keyword }
      }
    }

    return null
  } catch (err) {
    console.warn(`[acquire] Pixabay video search failed for "${keyword}": ${err.message}`)
    return null
  }
}

// ── Pexels video search ───────────────────────────────────────────────────────
async function searchPexelsVideo(keyword, usedUrls) {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  try {
    const res = await axios.get(PEXELS_VIDEO_URL, {
      headers: { Authorization: apiKey },
      params:  {
        query:       keyword,
        per_page:    15,
        size:        'medium',
        orientation: 'portrait',
      },
      timeout: 15000,
    })

    const videos = (res.data && res.data.videos) || []

    for (const video of videos) {
      const files = (video.video_files || [])
        .filter(f => f.file_type === 'video/mp4' && f.width >= 480 && f.width <= 1280)
        .sort((a, b) => a.width - b.width)
      const file = files[0]
      if (file && file.link && !usedUrls.has(file.link)) {
        console.log(`[acquire] Pexels video: "${keyword}" → ${file.link.slice(0, 60)}`)
        return { type: 'video', url: file.link, source: 'pexels', keyword }
      }
    }

    return null
  } catch (err) {
    console.warn(`[acquire] Pexels video search failed for "${keyword}": ${err.message}`)
    return null
  }
}

// ── Pixabay image search ──────────────────────────────────────────────────────
async function searchPixabayImage(keyword, usedUrls) {
  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) return null

  try {
    const res = await axios.get(PIXABAY_IMAGE_URL, {
      params: {
        key:         apiKey,
        q:           keyword.slice(0, 100),
        per_page:    10,
        image_type:  'photo',
        orientation: 'vertical',
        min_width:   720,
      },
      timeout: 15000,
    })

    const hits = (res.data && res.data.hits) || []

    for (const hit of hits) {
      const url = hit.largeImageURL || hit.webformatURL
      if (url && !usedUrls.has(url)) {
        console.log(`[acquire] Pixabay image: "${keyword}" → ${url.slice(0, 60)}`)
        return { type: 'image', url, source: 'pixabay', keyword }
      }
    }

    return null
  } catch (err) {
    console.warn(`[acquire] Pixabay image search failed for "${keyword}": ${err.message}`)
    return null
  }
}

// ── Pexels image search ───────────────────────────────────────────────────────
async function searchPexelsImage(keyword, usedUrls) {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  try {
    const res = await axios.get(PEXELS_IMAGE_URL, {
      headers: { Authorization: apiKey },
      params:  {
        query:       keyword,
        per_page:    10,
        orientation: 'portrait',
      },
      timeout: 15000,
    })

    const photos = (res.data && res.data.photos) || []

    for (const photo of photos) {
      const url = photo.src && (photo.src.large2x || photo.src.large)
      if (url && !usedUrls.has(url)) {
        console.log(`[acquire] Pexels image: "${keyword}" → ${url.slice(0, 60)}`)
        return { type: 'image', url, source: 'pexels', keyword }
      }
    }

    return null
  } catch (err) {
    console.warn(`[acquire] Pexels image search failed for "${keyword}": ${err.message}`)
    return null
  }
}

// ── Download a URL to disk ────────────────────────────────────────────────────
async function downloadToFile(url, destPath) {
  const res = await axios.get(url, {
    responseType: 'stream',
    timeout:      90000,
    maxRedirects: 5,
  })
  await pipeline(res.data, fs.createWriteStream(destPath))
  const size = fs.statSync(destPath).size
  if (size < 10000) throw new Error(`Downloaded file too small: ${size} bytes`)
  return destPath
}

// ── Get file extension from URL ───────────────────────────────────────────────
function getExtension(url, type) {
  const ext = path.extname(url.split('?')[0]).toLowerCase()
  if (ext === '.mp4' || ext === '.webm') return ext
  if (ext === '.jpg' || ext === '.jpeg') return '.jpg'
  if (ext === '.png') return '.png'
  if (ext === '.webp') return '.webp'
  return type === 'video' ? '.mp4' : '.jpg'
}

/**
 * Acquire media for a single scene.
 *
 * @param {object} scene       - Scene object with visualKeywords array
 * @param {Set}    usedUrls    - Set of already-used URLs (modified in place)
 * @param {string} jobDir      - Temp directory for downloads
 * @param {number} sceneIndex  - Scene index for filename
 * @returns {Promise<{
 *   type: 'video'|'image'|'color',
 *   localPath: string|null,
 *   url: string|null,
 *   source: string,
 *   keyword: string,
 * }>}
 */
async function acquireMediaForScene(scene, usedUrls, jobDir, sceneIndex) {
  const keywords = []

  // Collect all available keywords in priority order
  if (Array.isArray(scene.visualKeywords)) {
    scene.visualKeywords.forEach(k => { if (k && k.trim()) keywords.push(k.trim()) })
  }
  if (scene.visualNote && scene.visualNote.trim()) keywords.push(scene.visualNote.trim())
  if (scene.title && scene.title.trim()) keywords.push(scene.title.trim())

  // Always have at least one keyword
  if (keywords.length === 0) keywords.push('nature landscape')

  const sceneNum = scene.number || sceneIndex + 1
  console.log(`[acquire] Scene ${sceneNum}: keywords=${JSON.stringify(keywords)}`)

  // ── 6-tier search waterfall ───────────────────────────────────────────────
  let result = null

  // Tiers 1-3: Pixabay video for each keyword
  for (let ki = 0; ki < Math.min(keywords.length, 3) && !result; ki++) {
    await sleep(API_DELAY_MS)
    result = await searchPixabayVideo(keywords[ki], usedUrls)
  }

  // Tiers 4-5: Pexels video for first two keywords
  for (let ki = 0; ki < Math.min(keywords.length, 2) && !result; ki++) {
    await sleep(API_DELAY_MS)
    result = await searchPexelsVideo(keywords[ki], usedUrls)
  }

  // Tier 6: Pixabay image fallback
  if (!result) {
    await sleep(API_DELAY_MS)
    result = await searchPixabayImage(keywords[0], usedUrls)
  }

  // Tier 7: Pexels image fallback
  if (!result) {
    await sleep(API_DELAY_MS)
    result = await searchPexelsImage(keywords[0], usedUrls)
  }

  // Tier 8: solid color — last resort
  if (!result) {
    console.warn(`[acquire] Scene ${sceneNum}: all tiers exhausted — using color background`)
    return {
      type:      'color',
      localPath: null,
      url:       null,
      source:    'generated',
      keyword:   keywords[0],
    }
  }

  // ── Download the found media ──────────────────────────────────────────────
  const ext      = getExtension(result.url, result.type)
  const filename = `scene_${String(sceneNum).padStart(3, '0')}_${result.type}${ext}`
  const destPath = path.join(jobDir, filename)

  try {
    await downloadToFile(result.url, destPath)

    // Mark URL as used to prevent reuse in other scenes
    usedUrls.add(result.url)

    console.log(
      `[acquire] Scene ${sceneNum}: ${result.type} from ${result.source} ` +
      `(${fs.statSync(destPath).size} bytes) keyword="${result.keyword}"`
    )

    return {
      type:      result.type,
      localPath: destPath,
      url:       result.url,
      source:    result.source,
      keyword:   result.keyword,
    }
  } catch (err) {
    console.error(`[acquire] Scene ${sceneNum}: download failed: ${err.message}`)

    // Try next keyword before giving up
    for (let ki = 1; ki < keywords.length; ki++) {
      await sleep(API_DELAY_MS)
      const retry = await searchPixabayVideo(keywords[ki], usedUrls)
        || await searchPexelsVideo(keywords[ki], usedUrls)
      if (retry) {
        const ext2      = getExtension(retry.url, retry.type)
        const filename2 = `scene_${String(sceneNum).padStart(3, '0')}_retry${ext2}`
        const destPath2 = path.join(jobDir, filename2)
        try {
          await downloadToFile(retry.url, destPath2)
          usedUrls.add(retry.url)
          console.log(`[acquire] Scene ${sceneNum}: retry succeeded with keyword="${retry.keyword}"`)
          return {
            type:      retry.type,
            localPath: destPath2,
            url:       retry.url,
            source:    retry.source,
            keyword:   retry.keyword,
          }
        } catch (e) {
          console.warn(`[acquire] Scene ${sceneNum}: retry also failed: ${e.message}`)
        }
      }
    }

    // All retries failed — return color
    console.warn(`[acquire] Scene ${sceneNum}: all retries failed — using color background`)
    return {
      type:      'color',
      localPath: null,
      url:       null,
      source:    'generated',
      keyword:   keywords[0],
    }
  }
}

/**
 * Acquire media for ALL scenes in a storyboard.
 * Runs sequentially to share the usedUrls deduplication Set.
 *
 * @param {object[]} scenes    - Array of scene objects
 * @param {string}   jobDir    - Temp directory for downloads
 * @returns {Promise<Array>}   - Array of media results, one per scene
 */
async function acquireAllMedia(scenes, jobDir) {
  const usedUrls = new Set()
  const results  = []

  console.log(`[acquire] Starting media acquisition for ${scenes.length} scenes`)
  console.log(`[acquire] PIXABAY_API_KEY: ${process.env.PIXABAY_API_KEY ? 'SET' : 'MISSING'}`)
  console.log(`[acquire] PEXELS_API_KEY:  ${process.env.PEXELS_API_KEY  ? 'SET' : 'MISSING'}`)

  for (let i = 0; i < scenes.length; i++) {
    const scene  = scenes[i]
    const result = await acquireMediaForScene(scene, usedUrls, jobDir, i)
    results.push(result)

    // Progress log every 5 scenes
    if ((i + 1) % 5 === 0 || i === scenes.length - 1) {
      const videos = results.filter(r => r.type === 'video').length
      const images = results.filter(r => r.type === 'image').length
      const colors = results.filter(r => r.type === 'color').length
      console.log(
        `[acquire] Progress: ${i + 1}/${scenes.length} — ` +
        `${videos} videos, ${images} images, ${colors} color fallbacks`
      )
    }
  }

  const videos = results.filter(r => r.type === 'video').length
  const images = results.filter(r => r.type === 'image').length
  const colors = results.filter(r => r.type === 'color').length

  console.log(`[acquire] Complete: ${videos} videos, ${images} images, ${colors} color backgrounds`)
  console.log(`[acquire] Unique URLs used: ${usedUrls.size}`)

  return results
}

module.exports = { acquireMediaForScene, acquireAllMedia }