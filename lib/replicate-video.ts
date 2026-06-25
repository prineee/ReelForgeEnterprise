export type VideoModel = 'minimax' | 'luma'

interface GenerateVideoClipOptions {
  prompt: string
  model?: VideoModel
  duration?: number
  aspectRatio?: '9:16' | '16:9' | '1:1'
}

interface VideoClipResult {
  url: string
  model: string
}

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','have','has','had',
  'do','does','did','will','would','could','should','may','might','can',
  'this','that','these','those','with','from','into','through','during',
  'and','but','or','for','of','at','by','about','in','on','to','up',
])

function extractKeywords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 5)
    .join(' ')
}

/**
 * Finds a stock video clip matching the prompt using Pixabay → Pexels fallback.
 * Replaces the former Replicate AI video generation.
 */
export async function generateVideoClip(opts: GenerateVideoClipOptions): Promise<VideoClipResult> {
  const { prompt, aspectRatio = '9:16' } = opts
  const portrait = aspectRatio === '9:16'
  const orientation = portrait ? 'vertical' : 'horizontal'
  const keywords = extractKeywords(prompt)

  console.log(`[stockVideo] Searching for: "${keywords}"`)

  // ── Try Pixabay ─────────────────────────────────────────────────────────────
  const pixabayKey = process.env.PIXABAY_API_KEY
  if (pixabayKey) {
    const url  = `https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(keywords)}&per_page=10&video_type=film&orientation=${orientation}`
    const res  = await fetch(url)
    const data = await res.json() as { hits?: Array<{ videos?: { small?: { url?: string }; medium?: { url?: string } } }> }
    for (const hit of data.hits ?? []) {
      const videoUrl = hit.videos?.small?.url || hit.videos?.medium?.url
      if (videoUrl) {
        console.log(`[stockVideo] Pixabay hit: ${videoUrl.slice(0, 80)}`)
        return { url: videoUrl, model: 'pixabay_stock' }
      }
    }
  }

  // ── Pexels fallback ──────────────────────────────────────────────────────────
  const pexelsKey = process.env.PEXELS_API_KEY
  if (pexelsKey) {
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
      if (file?.link) {
        console.log(`[stockVideo] Pexels hit: ${file.link.slice(0, 80)}`)
        return { url: file.link, model: 'pexels_stock' }
      }
    }
  }

  throw new Error(`No stock video found for prompt: "${keywords}". Set PIXABAY_API_KEY or PEXELS_API_KEY.`)
}
