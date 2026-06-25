import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { v2 as cloudinary } from 'cloudinary'
import type { UploadApiOptions, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary'

function cloudinaryUploadStream(buf: Buffer, opts: UploadApiOptions): Promise<UploadApiResponse> {
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
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary env vars missing' }, { status: 500 })
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })

  let formData: FormData
  try { formData = await request.formData() } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file field is required' }, { status: 400 })
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are supported for avatars' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be under 10 MB' }, { status: 413 })
  }

  const name = (formData.get('name') as string | null)?.trim() || 'Custom Avatar'

  // ── Step 1: Upload to Cloudinary ───────────────────────────────────────────
  let cloudinaryUrl: string
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    console.log('[upload-avatar] Uploading to Cloudinary, bytes:', buffer.length)
    const result = await cloudinaryUploadStream(buffer, {
      folder:        `reelforge/avatars/${user.id}`,
      resource_type: 'image',
    })
    cloudinaryUrl = result.secure_url
    console.log('[upload-avatar] Cloudinary OK:', cloudinaryUrl.slice(0, 80))
  } catch (err) {
    console.error('[upload-avatar] Cloudinary failed:', err)
    return NextResponse.json(
      { error: `Cloudinary upload failed: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 502 }
    )
  }

  // ── Step 2: Insert into custom_avatars table ───────────────────────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error } = await (supabase.from('custom_avatars') as any)
      .insert({ user_id: user.id, name, preview_url: cloudinaryUrl, engine: 'wav2lip' })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string } | null }

    if (error || !row) {
      console.error('[upload-avatar] Supabase insert failed:', error?.message)
      return NextResponse.json(
        { error: `Database insert failed: ${error?.message ?? 'unknown'}` },
        { status: 500 }
      )
    }

    console.log('[upload-avatar] custom_avatar row id:', row.id)
    return NextResponse.json({
      avatar_id:        row.id,
      talking_photo_id: row.id,
      preview_url:      cloudinaryUrl,
      type:             'talking_photo',
    })
  } catch (err) {
    console.error('[upload-avatar] insert threw:', err)
    return NextResponse.json(
      { error: `Insert failed: ${err instanceof Error ? err.message : 'unknown'}` },
      { status: 500 }
    )
  }
}
