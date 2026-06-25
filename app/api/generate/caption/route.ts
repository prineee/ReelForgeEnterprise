import { NextResponse } from 'next/server'
import { requireCredits } from '@/lib/credits'
import Groq from 'groq-sdk'

const TONE_PROMPTS: Record<string, string> = {
  Funny:        'humorous and witty — use jokes, wordplay, and relatable situations to make people laugh and share',
  Professional: 'polished and authoritative — position the creator as a trusted expert with data-backed insights',
  Inspiring:    'deeply motivational and emotional — move people to take action, tell a transformation story',
  Viral:        'edgy and FOMO-driven — create urgency, mild controversy, or a surprising hook that compels shares',
}

export async function POST(request: Request) {
  const check = await requireCredits('caption')
  if (!check.ok) return check.response

  const body = await request.json()
  const { topic, niche, tone } = body as { topic?: string; niche?: string; tone?: string }

  if (!topic?.trim() || !niche?.trim() || !tone?.trim()) {
    return NextResponse.json({ error: 'topic, niche, and tone are required' }, { status: 400 })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return NextResponse.json({ error: 'Groq API key not configured on the server' }, { status: 500 })
  }

  const toneGuide = TONE_PROMPTS[tone] ?? tone

  const prompt = `You are a viral social media caption writer specialising in ${niche} content.

Topic: ${topic}
Tone: ${tone} — ${toneGuide}

Write:
1. hookLine — 1-2 punchy sentences that stop scrolling in the first 2 words
2. caption — 150-200 words in the ${tone} tone; natural language with relevant emojis; end with a clear CTA
3. hashtags — exactly 5 highly relevant hashtags including the # symbol

Respond ONLY with valid JSON, no markdown fences, no extra keys:
{"hookLine":"...","caption":"...","hashtags":["#tag1","#tag2","#tag3","#tag4","#tag5"]}`

  const groq = new Groq({ apiKey: groqApiKey })

  let raw: string
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a viral social media caption writer. Always respond with valid JSON only — no markdown, no commentary.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    })
    raw = completion.choices[0]?.message?.content ?? ''
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Groq API error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // Strip markdown code fences just in case
  const jsonStr = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

  try {
    const result = JSON.parse(jsonStr) as { hookLine: string; caption: string; hashtags: string[] }
    if (!result.hookLine || !result.caption || !Array.isArray(result.hashtags)) {
      throw new Error('Incomplete response')
    }
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'AI returned malformed output. Please try again.' },
      { status: 500 }
    )
  }
}
