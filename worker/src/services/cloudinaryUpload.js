'use strict'

const cloudinary = require('cloudinary').v2
const fs         = require('fs')

function initCloudinary() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_URL } = process.env

  if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key:    CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    })
    return
  }

  if (!CLOUDINARY_URL) {
    throw new Error(
      'Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET, or CLOUDINARY_URL.'
    )
  }

  const m = CLOUDINARY_URL.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/)
  if (!m) throw new Error('Invalid CLOUDINARY_URL. Expected: cloudinary://api_key:api_secret@cloud_name')
  cloudinary.config({ api_key: m[1], api_secret: m[2], cloud_name: m[3] })
}

/**
 * Upload using upload_large for files over 100MB (chunked upload).
 * Upload using upload_stream for files under 100MB (standard upload).
 * Both handle large files correctly.
 */
async function uploadWithRetry(localPath, options, label) {
  const bytes = (() => { try { return fs.statSync(localPath).size } catch { return 0 } })()
  console.log(`[cloudinary] Uploading ${label} file size: ${bytes} bytes`)

  const isLarge = bytes > 50 * 1024 * 1024  // > 50MB use chunked upload

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      let result

      if (isLarge) {
        // Chunked upload for large files — avoids 413 errors
        console.log(`[cloudinary] Using chunked upload for ${label} (${Math.round(bytes/1024/1024)}MB)`)
        result = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_large(
            localPath,
            {
              resource_type: options.resource_type || 'video',
              folder:        options.folder,
              public_id:     options.public_id,
              overwrite:     options.overwrite,
              chunk_size:    6 * 1024 * 1024,  // 6MB chunks
              timeout:       300000,             // 5 min timeout for large files
            },
            (err, res) => {
              if (err) reject(new Error(`Cloudinary chunked upload failed: ${err.message}`))
              else     resolve(res)
            }
          )
        })
      } else {
        // Standard stream upload for smaller files
        result = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { timeout: 180000, ...options },
            (err, res) => {
              if (err) reject(new Error(`Cloudinary upload_stream failed: ${err.message}`))
              else     resolve(res)
            }
          )
          const readStream = fs.createReadStream(localPath)
          readStream.on('error', err => reject(new Error(`File read error: ${err.message}`)))
          readStream.pipe(stream)
        })
      }

      console.log(`[cloudinary] Upload success: ${result.secure_url}`)
      return result

    } catch (err) {
      console.warn(`[cloudinary] ${label} upload attempt ${attempt}/3 failed: ${err.message}`)
      if (attempt === 3) throw err
      // Wait before retry: 5s, 15s
      await new Promise(r => setTimeout(r, attempt * 5000))
    }
  }
}

/**
 * Uploads the final MP4 and voiceover audio to Cloudinary.
 * Returns { videoUrl, voiceUrl }.
 */
async function uploadToCloudinary(videoPath, voicePath, projectId) {
  initCloudinary()

  const videoResult = await uploadWithRetry(videoPath, {
    resource_type: 'video',
    folder:        'reelforge/reels',
    public_id:     `reel_${projectId}`,
    overwrite:     true,
  }, 'video')

  const voiceResult = await uploadWithRetry(voicePath, {
    resource_type: 'video',
    folder:        'reelforge/audio',
    public_id:     `voice_${projectId}`,
    overwrite:     true,
  }, 'voice')

  return {
    videoUrl: videoResult.secure_url,
    voiceUrl: voiceResult.secure_url,
  }
}

module.exports = { uploadToCloudinary }