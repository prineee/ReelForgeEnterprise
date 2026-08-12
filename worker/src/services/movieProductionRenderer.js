'use strict'

/**
 * movieProductionRenderer.js
 *
 * Fills the one real gap in Movie Studio's pipeline: FinalMovieRenderer.ts
 * (services/ai/production/FinalMovieRenderer.ts) only ever produces a
 * RenderPlan manifest — "no FFmpeg, no video encoding, no file I/O" per
 * its own file header. This module is the real encoder that manifest was
 * always meant for ("A real encoder consumes the returned RenderPlan
 * elsewhere"): it downloads each segment's VEO-generated clip, normalizes
 * them to a uniform format, concatenates them in order, and uploads the
 * merged file to Cloudinary — reusing this worker's existing, already
 * production-proven pieces rather than reimplementing them:
 *   - ffmpegUtils.js: probeClip()/normalizeClip() (binary resolution,
 *     ffprobe, re-encode to uniform H.264/yuv420p)
 *   - movieAssembler.js: assembleMovie() (concat-demuxer merge)
 *   - cloudinaryUpload.js: uploadWithRetry() (chunked upload, 3 retries)
 *
 * Voice/audio is out of scope here (ElevenLabs has no real implementation
 * anywhere in this codebase yet — see MovieProductionFactory.ts's
 * NotConfiguredAudioClient) — the merged output is video-only for v1.
 *
 * Takes a RenderPlan (the exact shape FinalMovieRenderer.prepareRender()
 * already validates and produces — sceneId/sourceUrl/duration per
 * segment, resolved output settings) so this never recomputes segment
 * ordering or validation FinalMovieRenderer already did.
 */

const os = require('os')
const path = require('path')
const fs = require('fs-extra')
const fsSync = require('fs')
const { pipeline } = require('stream/promises')
const axios = require('axios')

const { probeClip, normalizeClip } = require('./ffmpegUtils')
const { assembleMovie } = require('./movieAssembler')
const { uploadWithRetry } = require('./cloudinaryUpload')

const DOWNLOAD_TIMEOUT_MS = 120_000

/**
 * Downloads a segment's sourceUrl to a local file. VEO's returned video
 * URIs (GoogleGenAIVeoClient.download() in MovieProductionFactory.ts) are
 * Google-hosted and, per Gemini API convention for generated-file
 * downloads, require the API key on the request — sent both as a header
 * and a query param since this hasn't been validated against a live VEO
 * URL yet (see this file's caller for the explicit flag to re-check this
 * during the one real production test). Falls back to an unauthenticated
 * request if no GEMINI_API_KEY is set, so this doesn't break for any
 * sourceUrl that turns out not to need auth.
 */
async function downloadSegment(sourceUrl, outputPath) {
  const apiKey = process.env.GEMINI_API_KEY
  const url = apiKey && !sourceUrl.includes('key=') ? `${sourceUrl}${sourceUrl.includes('?') ? '&' : '?'}key=${apiKey}` : sourceUrl

  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: DOWNLOAD_TIMEOUT_MS,
    headers: apiKey ? { 'x-goog-api-key': apiKey } : undefined,
  })
  await pipeline(response.data, fsSync.createWriteStream(outputPath))
  return outputPath
}

/**
 * Renders a RenderPlan into a real, Cloudinary-hosted video.
 *
 * @param {object} renderPlan - The RenderPlan produced by
 *   FinalMovieRenderer.prepareRender() (movieId, segments[], output, statistics).
 * @returns {Promise<{finalVideoUrl: string, finalVideoMetadata: {durationSeconds: number, resolution: string, format: string, bytes: number}}>}
 */
async function renderFinalMovie(renderPlan) {
  if (!renderPlan?.segments?.length) {
    throw new Error('renderFinalMovie: RenderPlan has no segments.')
  }

  const jobDir = path.join(os.tmpdir(), `movie_${renderPlan.movieId}_${Date.now()}`)
  await fs.ensureDir(jobDir)

  try {
    // 1. Download + normalize every segment, in RenderPlan's already-validated order.
    const normalizedPaths = []
    for (let i = 0; i < renderPlan.segments.length; i++) {
      const segment = renderPlan.segments[i]
      const rawPath = path.join(jobDir, `raw_${i}.mp4`)
      const normPath = path.join(jobDir, `norm_${i}.mp4`)

      console.log(`[movieProductionRenderer] Segment ${i + 1}/${renderPlan.segments.length} (scene ${segment.sceneNumber}): downloading`)
      await downloadSegment(segment.sourceUrl, rawPath)

      const info = await probeClip(rawPath)
      await normalizeClip(rawPath, normPath, info.duration)
      normalizedPaths.push(normPath)
    }

    // 2. Concatenate the normalized clips into one file.
    const mergedPath = path.join(jobDir, 'final.mp4')
    console.log(`[movieProductionRenderer] Merging ${normalizedPaths.length} segments`)
    await assembleMovie(normalizedPaths, mergedPath)

    // 3. Probe the merged output for real metadata (not the RenderPlan's estimate).
    const mergedInfo = await probeClip(mergedPath)
    const bytes = fsSync.statSync(mergedPath).size

    // 4. Upload to Cloudinary.
    console.log(`[movieProductionRenderer] Uploading merged movie (${Math.round(bytes / 1024 / 1024)}MB)`)
    const uploadResult = await uploadWithRetry(
      mergedPath,
      {
        resource_type: 'video',
        folder: 'reelforge/movies',
        public_id: `movie_${renderPlan.movieId}`,
        overwrite: true,
      },
      'final movie'
    )

    return {
      finalVideoUrl: uploadResult.secure_url,
      finalVideoMetadata: {
        durationSeconds: mergedInfo.duration,
        resolution: `${mergedInfo.width}x${mergedInfo.height}`,
        format: uploadResult.format || 'mp4',
        bytes,
      },
    }
  } finally {
    await fs.remove(jobDir).catch((err) => {
      console.warn(`[movieProductionRenderer] Failed to clean up ${jobDir}: ${err.message}`)
    })
  }
}

module.exports = { renderFinalMovie, downloadSegment }
