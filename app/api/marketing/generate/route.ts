import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCredits } from '@/lib/credits'
import Groq from 'groq-sdk'
import { v2 as cloudinary } from 'cloudinary'

export const maxDuration = 120

const AD_STYLE_GUIDES: Record<string, string> = {
  ugc:       'authentic creator-style video, casual handheld camera, person talking to camera, natural lighting, relatable and honest tone',
  cgi:       'premium CGI commercial, product close-ups, clean white or gradient backgrounds, professional studio lighting, luxury brand aesthetic',
  cinematic: 'cinematic narrative ad, dramatic lighting, story-driven visuals, Hollywood color grading, emotional music implied',
  wild:      'creative director AI choice — most impactful visual approach for this specific product',
}

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','have','has','had',
  'do','does','did','will','would','could','should','may','might','can',
  'this','that','these','those','with','from','into','through','during',
  'before','after','above','below','and','but','or','for','nor','so','yet',
  'of','at','by','about','as','until','while','in','on','to','up','its',
])

interface AdContent {
  visual_prompt?: string
  hook?: string
  voiceover?: string
  search_query?: string
}

async function findStockVideoUrl(keywords: string, portrait: boolean): Promise<string | null> {
  const orientation = portrait ? 'vertical' : 'horizontal'

  const pixabayKey = process.env.PIXABAY_API_KEY
  if (pixabayKey) {
    try {
      const url = `https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(keywords)}&per_page=10&video_type=film&orientation=${orientation}`
      const res  = await fetch(url)
      const data = await res.json() as { hits?: Array<{ videos?: { small?: { url?: string }; medium?: { url?: string } } }> }
      for (const hit of data.hits ?? []) {
        const videoUrl = hit.videos?.small?.url || hit.videos?.medium?.url
        if (videoUrl) return videoUrl
      }
    } catch { /* fall through */ }
  }

  const pexelsKey = process.env.PEXELS_API_KEY
  if (pexelsKey) {
    try {
      const pOrientation = portrait ? 'portrait' : 'landscape'
      const url  = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keywords)}&per_page=5&orientation=${pOrientation}&size=medium`
      const res  = await fetch(url, { headers: { Authorization: pexelsKey } })
      const data = await res.json() as {
        videos?: Array<{ video_files?: Array<{ file_type?: string; width?: number; link?: string }> }>
      }
      for (const video of data.videos ?? []) {
        const file = (video.video_files ?? [])
          .filter(f => f.file_type === 'video/mp4' && (f.width ?? 0) >= 480 && (f.width ?? 0) <= 1280)
          .sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]
        if (file?.link) return file.link
      }
    } catch { /* no result */ }
  }

  return null
}

export async function POST(req: Request) {
  const creditCheck = await requireCredits('marketing')
  if (!creditCheck.ok) return creditCheck.response

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { product_name, product_description, ad_style, platform, duration } = await req.json() as {
    product_name?: string; product_description?: string; ad_style?: string
    platform?: string; duration?: number
  }

  if (!product_name?.trim())
    return NextResponse.json({ error: 'product_name required' }, { status: 400 })

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) return NextResponse.json({ error: 'Groq not configured' }, { status: 500 })

  const groq = new Groq({ apiKey: groqApiKey })

  // ── Step 1: Generate ad content + search query via Groq ──────────────────
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a senior advertising creative director. Generate AI video prompts for product ads. Return valid JSON only.',
      },
      {
        role: 'user',
        content: `Create an ad video prompt for:
Product: ${product_name}
Description: ${product_description ?? ''}
Ad Style: ${ad_style ?? 'ugc'} — ${AD_STYLE_GUIDES[ad_style ?? 'ugc'] ?? ''}
Platform: ${platform ?? 'Instagram'}
Duration: ${duration ?? 30} seconds

Return JSON:
{
  "visual_prompt": "detailed AI video generation prompt 100+ words",
  "hook": "first 3 words that stop scrolling",
  "voiceover": "full ad script spoken aloud",
  "search_query": "3-5 stock video search words that match the visual"
}`,
      },
    ],
    temperature: 0.8,
    max_tokens: 900,
    response_format: { type: 'json_object' },
  })

  const adContent = JSON.parse(completion.choices[0]?.message?.content ?? '{}') as AdContent

  // ── Step 2: Find stock video ──────────────────────────────────────────────
  const portrait    = platform !== 'YouTube'
  const rawKeywords = adContent.search_query
    || (adContent.visual_prompt ?? product_name)
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w: string) => w.length > 2 && !STOP_WORDS.has(w))
      .slice(0, 5)
      .join(' ')

  const videoUrl = await findStockVideoUrl(rawKeywords, portrait)
  if (!videoUrl)
    return NextResponse.json({ error: 'No stock video found. Try a different product description.' }, { status: 404 })

  // ── Step 3: Upload to Cloudinary ──────────────────────────────────────────
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key:    process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  })
  const uploaded = await cloudinary.uploader.upload(videoUrl, {
    resource_type: 'video',
    folder:        'reelforge/marketing',
    public_id:     `ad_${user.id}_${Date.now()}`,
  })

  return NextResponse.json({
    video_url:     uploaded.secure_url,
    hook:          adContent.hook,
    voiceover:     adContent.voiceover,
    visual_prompt: adContent.visual_prompt,
    search_query:  rawKeywords,
    source:        'pixabay_stock',
  })
}
