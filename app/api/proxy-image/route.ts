import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * SSRF guard — this route only ever needs to proxy images this app itself
 * generated (Cloudinary uploads, Pollinations.ai fallback images — see
 * app/api/generate/thumbnail/route.ts's finalImageUrl), so the fix is a
 * strict hostname allowlist rather than an attempt at a general "block
 * private IPs" denylist (which is easy to bypass via redirects/DNS
 * rebinding). Add a host here only when a real caller needs it.
 */
const ALLOWED_HOSTS = new Set(['res.cloudinary.com', 'image.pollinations.ai'])

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid url' }, { status: 400 })
  }
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json({ error: 'URL host not allowed' }, { status: 400 })
  }

  try {
    const upstream = await fetch(parsed.toString(), { redirect: 'error' })
    if (!upstream.ok) return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 })
    const buffer = await upstream.arrayBuffer()
    const contentType = upstream.headers.get('content-type') ?? 'image/png'

    return new Response(buffer, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to proxy image' }, { status: 500 })
  }
}
