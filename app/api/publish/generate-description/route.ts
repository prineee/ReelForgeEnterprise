import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

const PLATFORM_GUIDES: Record<string, string> = {
  youtube:   'YouTube — SEO-optimized title (60 chars max), description with timestamps concept and strong subscribe CTA, 5 SEO hashtags',
  tiktok:    'TikTok — hook in first 3 words, casual conversational tone, trending hashtags, 150 char description max',
  instagram: 'Instagram Reels — emoji-heavy, conversational, 5 niche hashtags + 5 broad hashtags, include line breaks',
  facebook:  'Facebook — conversational, slightly longer description, shareable hook, 3 hashtags max',
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 })

  const { title, plot, genre, platform } = await req.json() as {
    title?: string; plot?: string; genre?: string; platform?: string
  }

  const groq = new Groq({ apiKey: groqApiKey })

  const prompt = `Generate social media publishing content for this video.

Platform: ${platform}
Platform Guide: ${PLATFORM_GUIDES[platform ?? ''] ?? platform}
Video Title: ${title}
Genre: ${genre ?? 'General'}
Plot/Topic: ${plot ?? title}

Generate optimized content for ${platform}. Respond with valid JSON only:
{
  "title": "optimized title for platform",
  "description": "full description with emojis and CTA",
  "hashtags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a social media expert. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    })

    const raw    = completion.choices[0]?.message?.content ?? '{}'
    const result = JSON.parse(raw) as { title: string; description: string; hashtags: string[] }
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
