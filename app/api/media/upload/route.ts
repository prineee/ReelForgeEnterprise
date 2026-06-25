import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiOptions, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary'

// Upload a Buffer to Cloudinary via upload_stream (avoids base64 overhead).
function cloudinaryUploadStream(
  buf: Buffer,
  opts: UploadApiOptions
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opts, (
      err: UploadApiErrorResponse | undefined,
      result: UploadApiResponse | undefined
    ) => {
      if (err) reject(new Error(err.message ?? 'Cloudinary upload failed'))
      else if (!result) reject(new Error('Cloudinary returned no result'))
      else resolve(result)
    })
    stream.end(buf)
  })
}

export async function POST(request: Request) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Cloudinary config ───────────────────────────────────────────────────────
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Cloudinary env vars missing: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET' },
      { status: 500 }
    )
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })

  // ── Parse form data ─────────────────────────────────────────────────────────
  let formData: FormData
  try { formData = await request.formData() } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file field is required' }, { status: 400 })

  const isVideo = file.type.startsWith('video/')
  const isImage = file.type.startsWith('image/')
  if (!isVideo && !isImage) {
    return NextResponse.json({ error: 'Only image and video files are supported' }, { status: 400 })
  }

  const MAX_BYTES = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${isVideo ? '100 MB for video' : '10 MB for images'})` },
      { status: 413 }
    )
  }

  // ── Upload via upload_stream ────────────────────────────────────────────────
  try {
    const buffer       = Buffer.from(await file.arrayBuffer())
    const resourceType = isVideo ? 'video' : 'image'

    console.log('[media/upload] Uploading to Cloudinary:', resourceType, buffer.length, 'bytes')

    const result = await cloudinaryUploadStream(buffer, {
      folder:        `reelforge/user-media/${user.id}`,
      resource_type: resourceType as 'video' | 'image',
    })

    // For video, derive a thumbnail URL by asking Cloudinary to grab frame 0
    // and resize to 400×600 (portrait, safe for reel backgrounds).
    const thumbnail = isVideo
      ? result.secure_url
          .replace('/upload/', '/upload/so_0,w_400,h_600,c_fill/')
          .replace(new RegExp(`\\.${result.format}$`), '.jpg')
      : result.secure_url

    console.log('[media/upload] Success:', result.secure_url.slice(0, 80))

    return NextResponse.json({
      url:       result.secure_url,   // full-quality Cloudinary URL
      thumbnail,                       // portrait thumbnail for grid preview
      type:      isVideo ? 'video' : 'image',
      size:      result.bytes,
      width:     result.width,
      height:    result.height,
      duration:  (result as UploadApiResponse & { duration?: number }).duration ?? 0,
      public_id: result.public_id,
    })
  } catch (err) {
    console.error('[media/upload] Cloudinary upload_stream failed:', err)
    return NextResponse.json(
      { error: `Upload failed: ${err instanceof Error ? err.message : 'unknown error'}` },
      { status: 502 }
    )
  }
}
