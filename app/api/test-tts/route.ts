import { NextResponse } from 'next/server'

export async function GET() {
  const testText = 'Hello this is a test of the text to speech system.'
  const encoded  = encodeURIComponent(testText)
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=en&client=tw-ob`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://translate.google.com/',
      },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return NextResponse.json({
        model_tested: 'google-tts',
        status: res.status,
        result: `FAILED — ${body.slice(0, 300)}`,
      })
    }

    const buf = await res.arrayBuffer()
    return NextResponse.json({
      model_tested: 'google-tts',
      status: res.status,
      result: `SUCCESS — got audio bytes: ${buf.byteLength}`,
      content_type: res.headers.get('content-type'),
    })
  } catch (err) {
    return NextResponse.json({
      model_tested: 'google-tts',
      status: 0,
      result: `ERROR — ${err instanceof Error ? err.message : String(err)}`,
    })
  }
}
