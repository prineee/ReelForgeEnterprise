import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCredits } from '@/lib/credits'
import Groq from 'groq-sdk'
import { v2 as cloudinary } from 'cloudinary'

export const maxDuration = 120

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','have','has','had',
  'do','does','did','will','would','could','should','may','might','can',
  'this','that','these','those','with','from','into','through','during',
  'before','after','above','below','and','but','or','for','nor','so','yet',
  'of','at','by','about','as','until','while','in','on','to','up','its',
])

function extractKeywords(text: string, maxWords = 5): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, maxWords)
    .join(' ')
}

async function findStockVideoUrl(keywords: string, portrait: boolean): Promise<string | null> {
  const orientation = portrait ? 'vertical' : 'horizontal'

  // ── Try Pixabay ──────────────────────────────────────────────────────────────
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
    } catch { /* fall through to Pexels */ }
  }

  // ── Pexels fallback ──────────────────────────────────────────────────────────
  const pexelsKey = process.env.PEXELS_API_KEY
  if (pexelsKey) {
    try {
      const url  = `https://api.pexels.com/videos/search?query=${encodeURIComponent(keywords)}&per_page=5&orientation=portrait&size=medium`
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
  const creditCheck = await requireCredits('cinema')
  if (!creditCheck.ok) return creditCheck.response

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    prompt, genre, visual_style, camera_angle, camera_movement,
    lens, time_of_day, mood, duration = 5,
  } = await req.json() as {
    prompt?: string; genre?: string; visual_style?: string
    camera_angle?: string; camera_movement?: string; lens?: string
    time_of_day?: string; mood?: string; duration?: number
  }

  if (!prompt?.trim())
    return NextResponse.json({ error: 'Scene prompt required' }, { status: 400 })

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) return NextResponse.json({ error: 'Groq not configured' }, { status: 500 })

  const groq = new Groq({ apiKey: groqApiKey })

  // ── Step 1: Enhance prompt with Groq (unchanged) ──────────────────────────
  const enhanceCompletion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are an AI cinematographer. Enhance scene descriptions into detailed AI video generation prompts. Include lighting, color grading, camera details, mood. Keep under 400 words. Return only the enhanced prompt, no explanations.',
      },
      {
        role: 'user',
        content: `Scene: ${prompt}
Genre: ${genre ?? 'Cinematic'}
Visual Style: ${visual_style ?? 'Cinematic Realistic'}
Camera: ${camera_angle ?? 'Medium Shot'}, ${camera_movement ?? 'Static'}, ${lens ?? 'Standard 50mm'}
Lighting: ${time_of_day ?? 'Golden Hour'}, ${mood ?? 'Dramatic'}
Duration: ${duration} seconds

Enhance this into a detailed AI video generation prompt.`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  })

  const enhancedPrompt = enhanceCompletion.choices[0]?.message?.content?.trim() ?? prompt
  console.log('[cinema] Enhanced prompt:', enhancedPrompt.slice(0, 100))

  // ── Step 2: Extract search keywords & find stock clip ─────────────────────
  const searchKeyword = extractKeywords(enhancedPrompt)
  console.log('[cinema] Search keyword:', searchKeyword)

  const videoUrl = await findStockVideoUrl(searchKeyword, true)
  if (!videoUrl)
    return NextResponse.json({ error: 'No stock video found. Try a more descriptive scene.' }, { status: 404 })

  // ── Step 3: Upload to Cloudinary ──────────────────────────────────────────
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key:    process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  })
  const result = await cloudinary.uploader.upload(videoUrl, {
    resource_type: 'video',
    folder:        'reelforge/cinema',
    public_id:     `cinema_${user.id}_${Date.now()}`,
  })

  return NextResponse.json({
    video_url:       result.secure_url,
    enhanced_prompt: enhancedPrompt,
    search_keyword:  searchKeyword,
    source:          'pixabay_stock',
    settings: { genre, visual_style, camera_angle, camera_movement, lens, time_of_day, mood, duration },
  })
}
