import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  try {
    const upstream = await fetch(url)
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
