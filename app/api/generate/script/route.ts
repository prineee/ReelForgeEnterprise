import { NextResponse } from 'next/server'
import { requireCredits } from '@/lib/credits'
import Groq from 'groq-sdk'

export interface Scene {
  number: number
  title: string
  duration: string
  voiceover: string
  visualNote: string
  visualKeywords?: string[]
  narration?: string
}

export interface ScriptResult {
  title: string
  scenes: Scene[]
}

// Generic words that produce irrelevant stock footage — rejected from keywords.
const BANNED_KEYWORDS = new Set([
  'business','success','motivation','people','lifestyle','professional',
  'concept','abstract','background','growth','journey','digital','modern',
  'technology','future','innovation','strategy','solution','team',
  'meeting','office','working','generic','diverse',
])

function validateAndCleanKeywords(keywords: string[], topic: string): string[] {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    // Generate topic-based fallback keywords
    const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    return [
      topicWords.slice(0, 3).join(' '),
      topicWords.slice(0, 2).join(' ') + ' tutorial',
      topicWords[0] + ' demonstration',
    ].filter(Boolean).slice(0, 3)
  }

  const cleaned = keywords
    .map(k => k.toLowerCase().trim())
    .filter(k => {
      if (k.length < 5) return false
      const words = k.split(/\s+/)
      const allBanned = words.every(w => BANNED_KEYWORDS.has(w))
      if (allBanned) return false
      return true
    })

  // If all keywords were banned/invalid, use topic fallback
  if (cleaned.length === 0) {
    const topicWords = topic.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    return [topic.toLowerCase(), topicWords[0] + ' tutorial', topicWords[0] + ' demonstration']
  }

  return cleaned.slice(0, 3)
}

export async function POST(request: Request) {
  const check = await requireCredits('script')
  if (!check.ok) return check.response

  const body = await request.json()
  const { productName, targetAudience, platform } = body as {
    productName?: string
    targetAudience?: string
    platform?: string
  }

  if (!productName?.trim() || !targetAudience?.trim()) {
    return NextResponse.json({ error: 'productName and targetAudience are required' }, { status: 400 })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return NextResponse.json({ error: 'Groq API key not configured on the server' }, { status: 500 })
  }

  const platformName = platform ?? 'Reels'
  const topic        = productName as string
  const durMins      = 1
  const numScenes    = 5
  const wordsPerScene = 25
  const totalWords   = numScenes * wordsPerScene

  const systemPrompt = `You are a viral short-form video script writer AND visual director.
You write scripts for AI video tools that search stock footage libraries.
Your most important job is providing SPECIFIC VISUAL SEARCH TERMS that will find relevant footage.

RULES FOR visualKeywords (CRITICAL):
- Each scene needs exactly 3 visualKeywords
- Each keyword must be 2-5 words that describe REAL footage someone would film
- Keywords must be specific to the exact topic — never generic
- Think: "what would a camera operator actually film for this scene?"
- Each keyword should be independently searchable and return relevant results

BANNED WORDS (never use these in any keyword):
business, success, motivation, people, lifestyle, professional,
concept, abstract, background, growth, journey, digital, modern,
technology (alone), future, innovation, strategy, solution, team,
meeting, office (alone), working (alone), generic, diverse

GOOD KEYWORD EXAMPLES:
Topic: How to make scrambled eggs
  Scene 1 keywords: ["cracking eggs into bowl", "whisking eggs with fork", "butter melting in pan"]
  Scene 2 keywords: ["scrambled eggs cooking stovetop", "spatula folding eggs pan", "plating scrambled eggs toast"]

Topic: Affiliate marketing for beginners
  Scene 1 keywords: ["person typing laptop home", "affiliate dashboard analytics screen", "online income commission notification"]
  Scene 2 keywords: ["clicking affiliate link website", "product review youtube creator", "paypal earnings screenshot affiliate"]

Topic: Guitar lessons for beginners
  Scene 1 keywords: ["hands playing guitar chords", "guitar fretboard finger placement", "acoustic guitar close up strumming"]
  Scene 2 keywords: ["beginner reading guitar tabs", "tuning guitar strings pegs", "guitar pick strumming technique"]

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown, no explanation:
{
  "title": "video title",
  "scenes": [
    {
      "number": 1,
      "narration": "what the voiceover says for this scene — minimum ${wordsPerScene} words",
      "visualKeywords": ["specific footage term 1", "specific footage term 2", "specific footage term 3"]
    }
  ]
}`

  const prompt = `Create a ${durMins}-minute ${platformName} video script about: "${topic}"
Target audience: ${targetAudience}

Requirements:
- Exactly ${numScenes} scenes
- Each scene narration: MINIMUM ${wordsPerScene} words (write more if needed)
- Total narration: MINIMUM ${totalWords} words
- Each scene: exactly 3 visualKeywords (specific, searchable, no banned words)
- Keywords must describe footage a stock camera operator would film
- Make keywords hyper-specific to "${topic}" — not generic video topics

Return ONLY the JSON object. No markdown. No explanation.`

  const groq = new Groq({ apiKey: groqApiKey })

  let raw: string
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.75,
      max_tokens: 1400,
      response_format: { type: 'json_object' },
    })
    raw = completion.choices[0]?.message?.content ?? ''
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Groq API error'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  const jsonStr = raw.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

  try {
    const parsedJson = JSON.parse(jsonStr) as { title?: string; scenes?: Array<Record<string, unknown>> }
    if (!parsedJson.title || !Array.isArray(parsedJson.scenes) || parsedJson.scenes.length === 0) {
      throw new Error('Incomplete response')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scenes = parsedJson.scenes.map((scene: any, i: number) => {
      const keywords = validateAndCleanKeywords(scene.visualKeywords || [], topic)

      console.log(`[script] Scene ${i+1} keywords: ${JSON.stringify(keywords)}`)
      console.log(`[script] Scene ${i+1} narration words: ${(scene.narration || '').split(/\s+/).length}`)

      return {
        number:         scene.number || i + 1,
        title:          `Scene ${scene.number || i + 1}`,
        duration:       String(Math.round((durMins * 60) / numScenes)),
        voiceover:      scene.narration || '',           // narration → voiceover
        visualNote:     keywords[0] || topic,            // primary search term
        visualKeywords: keywords,                        // all 3 keywords
      }
    })

    const totalGeneratedWords = scenes.reduce((sum, s) =>
      sum + s.voiceover.split(/\s+/).length, 0)
    console.log(`[script] Total words generated: ${totalGeneratedWords} (target: ${totalWords})`)

    if (totalGeneratedWords < totalWords * 0.7) {
      console.warn(`[script] WARNING: Only ${totalGeneratedWords} words generated, target was ${totalWords}`)
    }

    return NextResponse.json({ title: parsedJson.title, scenes })
  } catch {
    return NextResponse.json(
      { error: 'AI returned malformed output. Please try again.' },
      { status: 500 }
    )
  }
}
