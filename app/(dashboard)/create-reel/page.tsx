'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Video, Sparkles, Loader2, ChevronRight, ChevronLeft,
  Mic, Eye, Check, AlertCircle, Volume2, Download,
  RefreshCw, BookMarked, Play, Clock, Zap, User, Film, X, Layers, Share2, MessageSquare, Settings,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface Scene {
  number: number; title: string; duration: string; voiceover: string; visualNote: string
  visualKeywords?: string[]; narration?: string
}
interface ReelScript { title: string; scenes: Scene[] }
interface Voice {
  voice_id: string; name: string; description: string; gender: string
  language: string; category: string; preview_url: string; accent: string; age: string
}
interface VoiceoverResult { voiceUrl: string | null; dataUrl: string; projectId: string; videoId: string }
interface VideoResult { videoUrl: string; duration: number; thumbnailUrl?: string }
interface SSEEvent {
  type: 'progress' | 'done' | 'complete' | 'error' | 'submitted'
  step?: string; pct?: number; message?: string; status?: string
  video_url?: string; duration?: number; error?: string; video_id?: string; thumbnail_url?: string
}
interface SelectedAvatar {
  avatar_id: string; name: string; preview_image_url: string; type: 'builtin' | 'talking_photo'
}
interface SelectedBackground {
  url: string; thumbnail: string; type: 'video' | 'image'; source: 'pexels' | 'upload'
}

// ── Constants ────────────────────────────────────────────────────────────────

const NICHES = [
  'Tech & AI', 'Fitness & Health', 'Business', 'Finance',
  'Motivation', 'Lifestyle', 'Food & Cooking', 'Travel', 'Gaming', 'Entertainment',
] as const

const PLATFORMS = ['Reels', 'Shorts', 'TikTok'] as const
type Platform = typeof PLATFORMS[number]
const PLATFORM_ICONS: Record<Platform, string> = { Reels: '📱', Shorts: '▶️', TikTok: '🎵' }

const SCENE_GRADIENTS = [
  'from-red-500 to-orange-500', 'from-orange-500 to-yellow-500', 'from-brand-500 to-blue-500',
  'from-green-500 to-emerald-500', 'from-purple-500 to-pink-500',
]

const STEPS = ['Topic & Duration', 'Review Script', 'Choose Voice', 'Avatar & BG', 'Voiceover', 'Generate Video']

const DURATION_OPTIONS = [
  { mins: 1,  label: '1 min',  credits: 5,  scenes: 5,  totalWords: 200  },
  { mins: 3,  label: '3 min',  credits: 10, scenes: 10, totalWords: 550  },
  { mins: 5,  label: '5 min',  credits: 15, scenes: 15, totalWords: 975  },
  { mins: 8,  label: '8 min',  credits: 20, scenes: 20, totalWords: 1600 },
  { mins: 15, label: '15 min', credits: 35, scenes: 30, totalWords: 3000 },
  { mins: 30, label: '30 min', credits: 60, scenes: 40, totalWords: 4800 },
]

const VIDEO_STEPS = [
  { key: 'preparing',       label: 'Preparing audio',     threshold: 5  },
  { key: 'fetching_clips',  label: 'Fetching stock clips', threshold: 10 },
  { key: 'rendering',       label: 'Rendering video',      threshold: 45 },
  { key: 'uploading',       label: 'Uploading to cloud',   threshold: 87 },
]

// Avatar lip-sync is deferred — not available at launch.
// Set to true once Wav2Lip / RunPod is wired up and deployed.
const LIPSYNC_AVAILABLE = false

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {STEPS.map((label, i) => {
        const idx = i + 1; const done = current > idx; const active = current === idx
        return (
          <div key={label} className="flex items-center shrink-0">
            <div className="flex items-center gap-1.5">
              <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all',
                done ? 'bg-brand-600 border-brand-600 text-white' :
                active ? 'bg-brand-600/20 border-brand-500 text-brand-300' : 'bg-transparent border-surface-border text-gray-600')}>
                {done ? <Check className="w-3 h-3" /> : idx}
              </div>
              <span className={cn('text-xs font-medium hidden sm:block max-w-[60px] truncate',
                active ? 'text-white' : done ? 'text-brand-400' : 'text-gray-600')}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('mx-1.5 sm:mx-2 h-px w-4 sm:w-6 transition-colors', current > idx ? 'bg-brand-600' : 'bg-surface-border')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Scene Card ────────────────────────────────────────────────────────────────

function SceneCard({ scene, index, onChange }: { scene: Scene; index: number; onChange: (v: string) => void }) {
  const gradient = SCENE_GRADIENTS[index % SCENE_GRADIENTS.length]
  return (
    <Card>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-surface-border">
        <div className={cn('w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-extrabold shrink-0', gradient)}>
          {scene.number}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate block">{scene.title}</span>
          <p className="text-xs text-gray-500">{scene.duration}</p>
        </div>
      </div>
      <div className="divide-y divide-surface-border">
        <div className="px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-2">
            <Mic className="w-3.5 h-3.5" /> Voiceover <span className="text-gray-600">(editable)</span>
          </div>
          <textarea className="input min-h-[80px] resize-y text-base sm:text-sm leading-relaxed" value={scene.voiceover} onChange={e => onChange(e.target.value)} />
        </div>
        <div className="px-5 py-2.5 bg-surface/40 rounded-b-xl">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1"><Eye className="w-3.5 h-3.5" /> Visual Direction</div>
          <p className="text-xs text-gray-500 leading-relaxed italic">{scene.visualNote}</p>
        </div>
      </div>
    </Card>
  )
}

// ── Voice Card ────────────────────────────────────────────────────────────────

function voiceColors(gender: string) {
  if (gender === 'female') return { avatar: 'bg-purple-950 text-purple-300', badge: 'bg-purple-950 border-purple-800 text-purple-300' }
  if (gender === 'male')   return { avatar: 'bg-blue-950 text-blue-300',     badge: 'bg-blue-950 border-blue-800 text-blue-300' }
  return                          { avatar: 'bg-brand-950 text-brand-300',   badge: 'bg-brand-950 border-brand-800 text-brand-300' }
}

function VoiceCard({ voice, selected, onSelect }: { voice: Voice; selected: boolean; onSelect: () => void }) {
  const colors   = voiceColors(voice.gender)
  const provider = voice.category === 'orpheus' ? 'Orpheus / Groq' : voice.category === 'openai' ? 'OpenAI TTS' : voice.category
  return (
    <button onClick={onSelect} className={cn('w-full text-left p-4 rounded-xl border-2 transition-all',
      selected ? 'border-brand-500 bg-brand-600/10' : 'border-surface-border hover:border-brand-700/60 bg-surface-card')}>
      <div className="flex items-start gap-3">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-base font-bold shrink-0', colors.avatar)}>
          {voice.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="font-semibold text-sm text-white">{voice.name}</span>
            {selected && <Check className="w-4 h-4 text-brand-400 shrink-0" />}
          </div>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {voice.gender && <Badge variant="default" className={cn('text-xs capitalize', colors.badge)}>{voice.gender}</Badge>}
            {voice.accent && <Badge variant="default" className="text-xs capitalize">{voice.accent}</Badge>}
            <Badge variant="default" className="text-xs text-gray-500 bg-surface border-surface-border">{provider}</Badge>
          </div>
          {voice.description && <p className="text-xs text-gray-500 leading-relaxed">{voice.description}</p>}
        </div>
      </div>
    </button>
  )
}

const CAPTION_STYLES = [
  { id: 'white-bold', label: 'White Bold', preview: 'Aa', color: 'white',   borderColor: 'black',   fontSize: 52, borderWidth: 4, style: 'font-bold text-white' },
  { id: 'yellow',     label: 'Yellow',     preview: 'Aa', color: 'yellow',  borderColor: 'black',   fontSize: 52, borderWidth: 4, style: 'font-bold text-yellow-400' },
  { id: 'karaoke',    label: 'Karaoke',    preview: 'Aa', color: 'white',   borderColor: 'black',   fontSize: 56, borderWidth: 5, style: 'font-extrabold text-white',   box: true, boxColor: '0x80000000' },
  { id: 'minimal',    label: 'Minimal',    preview: 'Aa', color: 'white',   borderColor: 'black',   fontSize: 40, borderWidth: 2, style: 'font-normal text-white' },
  { id: 'bold-red',   label: 'Bold Red',   preview: 'Aa', color: '#FF4444', borderColor: 'black',   fontSize: 52, borderWidth: 4, style: 'font-bold text-red-400' },
  { id: 'tiktok',     label: 'TikTok',     preview: 'Aa', color: 'white',   borderColor: '#FE2C55', fontSize: 52, borderWidth: 5, style: 'font-extrabold text-white' },
] as const

const CAPTION_POSITIONS = [
  { id: 'top',    label: 'Top',    icon: '⬆️' },
  { id: 'center', label: 'Center', icon: '↕️' },
  { id: 'bottom', label: 'Bottom', icon: '⬇️' },
] as const

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CreateReelPage() {
  const [step, setStep] = useState(1)

  // Step 1
  const [topic, setTopic]           = useState('')
  const [niche, setNiche]           = useState<string>(NICHES[0])
  const [platform, setPlatform]     = useState<Platform>('Reels')
  const [selectedDuration, setSelectedDuration] = useState(DURATION_OPTIONS[0])
  const [step1Loading, setStep1Loading] = useState(false)
  const [step1Error, setStep1Error]     = useState('')

  // Step 2
  const [scriptTitle, setScriptTitle] = useState('')
  const [scenes, setScenes]           = useState<Scene[]>([])

  // Step 3
  const [voices, setVoices]               = useState<Voice[]>([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [voicesError, setVoicesError]     = useState('')
  const [selectedVoice, setSelectedVoice] = useState('tara')
  const previewRef = useRef<HTMLAudioElement | null>(null)

  // Step 4 — Avatar & Background (read from localStorage set by avatar-studio / media-library)
  const [selectedAvatar,     setSelectedAvatar]     = useState<SelectedAvatar | null>(null)
  const [selectedBackground, setSelectedBackground] = useState<SelectedBackground | null>(null)

  // Step 5 — voiceover generation
  const [voiceGenerating, setVoiceGenerating] = useState(false)
  const [voiceProgress, setVoiceProgress]     = useState(0)
  const [voiceError, setVoiceError]           = useState('')
  const [voiceResult, setVoiceResult]         = useState<VoiceoverResult | null>(null)
  const [voiceBrowserTTS, setVoiceBrowserTTS] = useState(false)

  // Step 6 — video generation
  const [videoGenerating, setVideoGenerating]   = useState(false)
  const [videoProgress, setVideoProgress]       = useState(0)
  const [videoCurrentStep, setVideoCurrentStep] = useState('')
  const [videoStepLabel, setVideoStepLabel]     = useState('')
  const [videoResult, setVideoResult]           = useState<VideoResult | null>(null)
  const [videoError, setVideoError]             = useState('')
  const [usingHeyGen, setUsingHeyGen]           = useState(false)
  const [heyGenVideoId, setHeyGenVideoId]       = useState('')
  const heygenPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Captions
  const [addingCaptions, setAddingCaptions]       = useState(false)
  const [captionedVideoUrl, setCaptionedVideoUrl]  = useState('')
  const [captionError, setCaptionError]            = useState('')
  const [captionStyle, setCaptionStyle]            = useState('white-bold')
  const [captionPosition, setCaptionPosition]      = useState('bottom')
  const [showCaptionOptions, setShowCaptionOptions] = useState(false)

  // Step 6 — save to series
  const [seriesList, setSeriesList]         = useState<{ id: string; title: string }[]>([])
  const [seriesLoading, setSeriesLoading]   = useState(false)
  const [selectedSeriesId, setSelectedSeriesId] = useState('')
  const [savingToSeries, setSavingToSeries] = useState(false)
  const [savedToSeries, setSavedToSeries]   = useState(false)
  const [saveSeriesError, setSaveSeriesError] = useState('')

  useEffect(() => { return () => { previewRef.current?.pause() } }, [])
  useEffect(() => { return () => { if (heygenPollRef.current) clearInterval(heygenPollRef.current) } }, [])

  // Load avatar & background from localStorage (set by avatar-studio and media-library pages)
  useEffect(() => {
    try {
      const a = localStorage.getItem('reelforge_selected_avatar')
      if (a) setSelectedAvatar(JSON.parse(a) as SelectedAvatar)
      const b = localStorage.getItem('reelforge_selected_background')
      if (b) setSelectedBackground(JSON.parse(b) as SelectedBackground)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!voiceGenerating) return
    const tick = setInterval(() => setVoiceProgress(p => p >= 90 ? p : p + (90 - p) * 0.06), 400)
    return () => clearInterval(tick)
  }, [voiceGenerating])

  // ── Step 1 → 2: Generate script ──────────────────────────────────────────
  async function handleGenerateScript() {
    if (!topic.trim()) return
    setStep1Loading(true); setStep1Error('')
    try {
      const res  = await fetch('/api/reel/script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, niche, platform, duration_minutes: selectedDuration.mins }),
      })
      const json = await res.json()
      if (!res.ok) { setStep1Error(typeof json.error === 'string' ? json.error : 'Failed to generate script.'); return }
      setScriptTitle((json as ReelScript).title); setScenes((json as ReelScript).scenes); setStep(2)
    } catch { setStep1Error('Network error. Please try again.') }
    finally { setStep1Loading(false) }
  }

  // ── Step 2 → 3: Load voices ───────────────────────────────────────────────
  const loadVoices = useCallback(async () => {
    if (voices.length > 0) return
    setVoicesLoading(true); setVoicesError('')
    try {
      const res  = await fetch('/api/reel/voices')
      if (!res.ok) { const d = await res.json().catch(() => ({})) as { error?: unknown }; setVoicesError(typeof d.error === 'string' ? d.error : `HTTP ${res.status}`); return }
      const data = await res.json() as { voices: Voice[] }
      const list = data.voices ?? []
      if (!list.length) { setVoicesError('No voices returned.'); return }
      setVoices(list)
      if (!list.some(v => v.voice_id === 'tara')) setSelectedVoice(list[0].voice_id)
    } catch (err) { setVoicesError(err instanceof Error ? err.message : 'Network error') }
    finally { setVoicesLoading(false) }
  }, [voices.length])

  function goToVoices() { setStep(3); loadVoices() }

  // ── Step 4: Avatar & Background (optional, just navigation) ──────────────
  function goToAvatarStep() { setStep(4) }

  // ── Step 5 → voiceover generation ────────────────────────────────────────
  async function handleGenerateVoice() {
    if (!selectedVoice || !scenes.length) return
    setVoiceGenerating(true); setVoiceProgress(0); setVoiceError(''); setVoiceResult(null); setVoiceBrowserTTS(false); setStep(5)
    try {
      const res  = await fetch('/api/reel/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenes, voice: selectedVoice, title: scriptTitle }),
      })
      const json = await res.json() as { browserTTS?: boolean; voiceover?: string; error?: string } & Partial<VoiceoverResult>

      if (json.browserTTS === true) {
        setVoiceError('Voice generation failed. Please try again in a moment.')
        setVoiceProgress(0)
        return
      }

      if (!res.ok) { setVoiceError(typeof json.error === 'string' ? json.error : 'Voiceover generation failed.'); return }
      setVoiceProgress(100); setVoiceResult(json as VoiceoverResult)
    } catch (err) {
      setVoiceError(err instanceof Error ? `Network error: ${err.message}` : 'Network error.')
    } finally { setVoiceGenerating(false) }
  }

  // ── Step 6: Generate video ────────────────────────────────────────────────
  async function handleGenerateVideo() {
    if (!voiceResult) return

    // Always re-read from localStorage at click time so selections made in
    // avatar-studio / media-library are picked up even after page navigation.
    let liveAvatar:     SelectedAvatar | null     = selectedAvatar
    let liveBackground: SelectedBackground | null = selectedBackground
    try {
      const a = localStorage.getItem('reelforge_selected_avatar')
      if (a) liveAvatar = JSON.parse(a) as SelectedAvatar
      const b = localStorage.getItem('reelforge_selected_background')
      if (b) liveBackground = JSON.parse(b) as SelectedBackground
    } catch { /* ignore */ }

    if (liveAvatar     !== selectedAvatar)     setSelectedAvatar(liveAvatar)
    if (liveBackground !== selectedBackground) setSelectedBackground(liveBackground)

    setVideoGenerating(true); setVideoProgress(0); setVideoCurrentStep('preparing')
    setVideoStepLabel('Starting generation…'); setVideoError(''); setVideoResult(null); setStep(6)

    // Avatar lipsync requires LIPSYNC_AVAILABLE=true + a public HTTPS voiceUrl.
    // LIPSYNC_AVAILABLE is false until Wav2Lip/RunPod is deployed.
    const canUseHeyGen = !!(LIPSYNC_AVAILABLE && liveAvatar && voiceResult.voiceUrl?.startsWith('http'))
    setUsingHeyGen(canUseHeyGen)

    if (canUseHeyGen) {
      await generateWithHeyGen(liveAvatar!, liveBackground)
    } else {
      if (liveAvatar) {
        console.log('[create-reel] Avatar selected but lipsync unavailable — using stock clips.')
      }
      await generateWithWorker()
    }
  }

  async function generateWithHeyGen(avatar: SelectedAvatar, background: SelectedBackground | null) {
    const body: Record<string, string | undefined> = {
      avatar_id:        avatar.avatar_id,
      avatar_type:      avatar.type,
      voice_url:        voiceResult!.voiceUrl ?? undefined,
      title:            scriptTitle,
      script:           scenes.map(s => s.voiceover).join('\n\n'),
      duration_minutes: String(selectedDuration.mins),
    }
    if (background) {
      body.background_url  = background.url
      body.background_type = background.type
    }

    try {
      const res = await fetch('/api/heygen/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let msg = `HeyGen error ${res.status}`
        try { msg = (JSON.parse(text) as { error?: string }).error ?? msg } catch { /* ignore */ }
        throw new Error(msg)
      }
      if (!res.body) throw new Error('Response body not readable')

      const reader = res.body.getReader(); const decoder = new TextDecoder()
      let buffer = ''; let keepReading = true
      let submittedId = ''

      while (keepReading) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n'); buffer = parts.pop() ?? ''
        for (const part of parts) {
          if (!keepReading) break
          const line = part.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          let ev: SSEEvent; try { ev = JSON.parse(line.slice(6)) } catch { continue }
          if (ev.type === 'submitted') {
            submittedId = ev.video_id ?? ''
            setHeyGenVideoId(submittedId); setVideoProgress(5)
            setVideoStepLabel('Submitted to HeyGen — waiting for render…')
            keepReading = false; break
          } else if (ev.type === 'progress') {
            setVideoProgress(ev.pct ?? 0); setVideoStepLabel(ev.message || `HeyGen: ${ev.status ?? ''}`)
          } else if (ev.type === 'complete') {
            setVideoProgress(100); setVideoStepLabel('Complete!')
            setVideoResult({ videoUrl: ev.video_url!, duration: 0, thumbnailUrl: ev.thumbnail_url ?? undefined })
            setVideoGenerating(false); keepReading = false
          } else if (ev.type === 'error') {
            throw new Error(ev.error || 'HeyGen generation failed')
          }
        }
      }

      // Start client-side polling if we received a video_id from the server
      if (!submittedId) {
        setVideoError('No video ID received from HeyGen')
        setVideoGenerating(false)
      } else {
        if (heygenPollRef.current) clearInterval(heygenPollRef.current)
        let pollCount = 0
        const maxPolls = 60 // 10 minutes max

        const pollHeyGen = async () => {
          pollCount++
          if (pollCount > maxPolls) {
            setVideoError('HeyGen generation timed out after 10 minutes')
            setVideoGenerating(false)
            return
          }

          try {
            const statusRes = await fetch('/api/heygen/status?video_id=' + encodeURIComponent(submittedId))
            console.log('[heygen poll] #' + pollCount + ' http:', statusRes.status)

            if (!statusRes.ok) {
              heygenPollRef.current = setTimeout(pollHeyGen, 10000)
              return
            }

            const statusData = await statusRes.json() as {
              data?: {
                status?: string; video_url?: string | null; url?: string | null
                thumbnail_url?: string | null; progress?: number; percent?: number; error?: unknown
              }
            }
            console.log('[heygen poll] raw:', JSON.stringify(statusData)?.slice(0, 300))

            const videoData = (statusData?.data ?? {}) as {
              status?: string; video_url?: string | null; url?: string | null
              thumbnail_url?: string | null; progress?: number; percent?: number; error?: unknown
            }
            const status   = videoData.status ?? ''
            const progress = videoData.progress ?? videoData.percent ?? 0
            console.log('[heygen poll] status:', status, 'progress:', progress)

            setVideoProgress(Math.min(Math.max(typeof progress === 'number' ? progress : 5, 5), 95))
            setVideoStepLabel('HeyGen: ' + status + ' (' + (pollCount * 10) + 's elapsed)')

            if (status === 'completed' || status === 'success') {
              const videoUrl = videoData.video_url ?? videoData.url ?? ''
              const thumbUrl = videoData.thumbnail_url ?? ''
              if (!videoUrl) {
                setVideoError('HeyGen completed but no video URL returned')
                setVideoGenerating(false)
                return
              }
              heygenPollRef.current = null
              setVideoProgress(100); setVideoStepLabel('Complete!')
              setVideoResult({ videoUrl, duration: 0, thumbnailUrl: thumbUrl || undefined })
              setVideoGenerating(false)
            } else if (status === 'failed' || status === 'error') {
              const errData  = videoData.error
              const errCode  = (errData as { code?: string } | null)?.code ?? errData ?? 'Unknown error'
              const errMsg   = typeof errCode === 'string' ? errCode : JSON.stringify(errCode)
              if (errMsg.includes('INSUFFICIENT_CREDIT') || errMsg.includes('PAYMENT')) {
                setVideoError('HeyGen credits exhausted — add credits at heygen.com/billing')
              } else {
                setVideoError('HeyGen failed: ' + errMsg)
              }
              setVideoGenerating(false)
            } else {
              // still processing
              heygenPollRef.current = setTimeout(pollHeyGen, 10000)
            }
          } catch (e) {
            console.error('[heygen-poll] error:', e)
            heygenPollRef.current = setTimeout(pollHeyGen, 10000)
          }
        }

        // First poll after 15 seconds (HeyGen rarely finishes faster)
        heygenPollRef.current = setTimeout(pollHeyGen, 15000)
      }
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'HeyGen generation failed.')
      setVideoGenerating(false)
    }
  }

  async function generateWithWorker() {
    let workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || 'https://reel-forge-production.up.railway.app'
    if (!workerUrl.startsWith('http')) workerUrl = 'https://' + workerUrl
    workerUrl = workerUrl.replace(/\/$/, '')
    const endpoint = `${workerUrl}/api/generate-video`
    console.log('[worker-url]', endpoint)

    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes,
          voice_url:        voiceResult!.voiceUrl?.startsWith('http') ? voiceResult!.voiceUrl : undefined,
          project_id:       voiceResult!.projectId,
          duration_minutes: selectedDuration.mins,
          // Never send voice_data (base64) — too large, causes ECONNABORTED
        }),
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        let msg = `Worker HTTP ${res.status}`
        try {
          const parsed = JSON.parse(text) as { error?: string }
          msg = parsed.error ?? msg
        } catch {
          if (text.includes('timeout')) msg = 'Generation timed out. Please try again.'
          if (text.includes('memory'))  msg = 'Server busy. Please try again in a minute.'
        }
        console.error('[create-reel] Worker error:', res.status, text.slice(0, 300))
        throw new Error(msg)
      }
      if (!res.body) throw new Error('Response body is not readable')

      const reader = res.body.getReader(); const decoder = new TextDecoder()
      let buffer = ''; let keepReading = true

      while (keepReading) {
        const { done, value } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n'); buffer = parts.pop() ?? ''
        for (const part of parts) {
          if (!keepReading) break
          const line = part.split('\n').find(l => l.startsWith('data: ')); if (!line) continue
          let ev: SSEEvent; try { ev = JSON.parse(line.slice(6)) } catch { continue }
          if (ev.type === 'progress') {
            setVideoProgress(ev.pct ?? 0); setVideoCurrentStep(ev.step ?? ''); setVideoStepLabel(ev.message ?? '')
          } else if (ev.type === 'done') {
            setVideoProgress(100); setVideoStepLabel('Complete!')
            setVideoResult({ videoUrl: ev.video_url!, duration: ev.duration! })
            setVideoGenerating(false); keepReading = false
          } else if (ev.type === 'error') { throw new Error(ev.error || 'Video generation failed') }
        }
      }
    } catch (err) { setVideoError(err instanceof Error ? err.message : 'Video generation failed.'); setVideoGenerating(false) }
  }

  async function loadSeriesForSave() {
    if (seriesList.length > 0) return
    setSeriesLoading(true)
    try {
      const res  = await fetch('/api/series')
      if (res.ok) {
        const json = await res.json()
        setSeriesList((json.series ?? []).map((s: { id: string; title: string }) => ({ id: s.id, title: s.title })))
      }
    } catch { /* ignore */ } finally { setSeriesLoading(false) }
  }

  async function handleSaveToSeries() {
    if (!selectedSeriesId || !videoResult) return
    setSavingToSeries(true); setSaveSeriesError('')
    try {
      const res  = await fetch(`/api/series/${selectedSeriesId}/episodes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: scriptTitle, video_url: videoResult.videoUrl }),
      })
      if (!res.ok) {
        const d = await res.json()
        setSaveSeriesError(typeof d.error === 'string' ? d.error : 'Failed to save')
      } else {
        setSavedToSeries(true)
      }
    } catch { setSaveSeriesError('Network error') }
    finally { setSavingToSeries(false) }
  }

  function clearAvatar() {
    setSelectedAvatar(null)
    try { localStorage.removeItem('reelforge_selected_avatar') } catch { /* ignore */ }
  }
  function clearBackground() {
    setSelectedBackground(null)
    try { localStorage.removeItem('reelforge_selected_background') } catch { /* ignore */ }
  }

  function handleReset() {
    setStep(1); setTopic(''); setScriptTitle(''); setScenes([]); setSelectedVoice('tara')
    setSelectedDuration(DURATION_OPTIONS[0]); setVoiceResult(null); setVoiceError('')
    setVoiceProgress(0); setVoiceBrowserTTS(false); setVideoResult(null); setVideoError(''); setVideoProgress(0)
    setUsingHeyGen(false); setHeyGenVideoId('')
    if (heygenPollRef.current) { clearInterval(heygenPollRef.current); heygenPollRef.current = null }
    setCaptionedVideoUrl(''); setCaptionError(''); setCaptionStyle('white-bold'); setCaptionPosition('bottom'); setShowCaptionOptions(false)
    setSelectedSeriesId(''); setSavedToSeries(false); setSaveSeriesError('')
  }

  async function handleAddCaptions() {
    if (!videoResult?.videoUrl) return
    setAddingCaptions(true); setCaptionError('')
    const fullScript = scenes.map(s => s.voiceover).filter(Boolean).join(' ')
    const selectedStyle = CAPTION_STYLES.find(s => s.id === captionStyle) ?? CAPTION_STYLES[0]
    try {
      const res = await fetch('/api/captions/burn', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url:    videoResult.videoUrl,
          script:       fullScript,
          font_size:    selectedStyle.fontSize,
          color:        selectedStyle.color,
          border_color: selectedStyle.borderColor,
          border_width: selectedStyle.borderWidth,
          position:     captionPosition,
          box:          'box' in selectedStyle ? selectedStyle.box : false,
          box_color:    'boxColor' in selectedStyle ? selectedStyle.boxColor : '0x00000000',
        }),
      })
      const data = await res.json() as { video_url?: string; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Caption generation failed')
      setCaptionedVideoUrl(data.video_url ?? '')
    } catch (err) {
      setCaptionError(err instanceof Error ? err.message : 'Caption generation failed')
    } finally {
      setAddingCaptions(false)
    }
  }

  function updateSceneVoiceover(i: number, v: string) {
    setScenes(prev => prev.map((s, idx) => idx === i ? { ...s, voiceover: v } : s))
  }

  const activeVoiceObj = voices.find(v => v.voice_id === selectedVoice)

  // Lipsync is deferred — always false until LIPSYNC_AVAILABLE is enabled
  const heyGenWillRun = false
  const heyGenBlocked = false

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Create Reel</h1>
        <p className="text-gray-400 text-sm">AI script → Voiceover → Avatar lipsync or stock clips → 1080×1920 reel</p>
      </div>

      <StepIndicator current={step} />

      {/* ── Step 1: Topic, Niche, Platform & Duration ─────────────────────── */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Step 1 — Topic, Niche & Duration</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="label">What is your reel about?</label>
              <input className="input" placeholder="e.g. 3 habits that helped me lose 20 lbs without dieting"
                value={topic} onChange={e => setTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerateScript()} />
            </div>
            <div>
              <label className="label">Niche</label>
              <div className="flex flex-wrap gap-1.5">
                {NICHES.map(n => (
                  <button key={n} onClick={() => setNiche(n)} className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                    niche === n ? 'bg-brand-600 border-brand-500 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
                  )}>{n}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Platform</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <button key={p} onClick={() => setPlatform(p)} className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                    platform === p ? 'bg-brand-600 border-brand-500 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
                  )}><span>{PLATFORM_ICONS[p]}</span> {p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-brand-400" /> Video Duration</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mb-3">
                {DURATION_OPTIONS.map(opt => (
                  <button key={opt.mins} onClick={() => setSelectedDuration(opt)} className={cn(
                    'flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-sm font-semibold transition-all',
                    selectedDuration.mins === opt.mins ? 'border-brand-500 bg-brand-600/15 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700/60 hover:text-white'
                  )}>
                    <span>{opt.label}</span>
                    <span className={cn('text-xs font-normal', selectedDuration.mins === opt.mins ? 'text-brand-300' : 'text-gray-600')}>{opt.credits}cr</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 bg-surface-card border border-surface-border rounded-lg px-3 py-2">
                <Zap className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                <span>~<span className="text-white font-medium">{selectedDuration.scenes} scenes</span> · ~<span className="text-white font-medium">{selectedDuration.totalWords} words</span> · <span className="text-white font-medium">{selectedDuration.mins} min audio</span></span>
              </div>
            </div>
            {step1Error && (
              <div className="flex items-start gap-2 bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {String(step1Error)}
              </div>
            )}
            <Button onClick={handleGenerateScript} disabled={step1Loading || !topic.trim()} className="w-full" size="md">
              {step1Loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating script…</>
                : <><Sparkles className="w-4 h-4" /> Generate {selectedDuration.scenes}-Scene Script ({selectedDuration.mins} min)</>
              }
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Review Script ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{platform} · {selectedDuration.label} · {scenes.length} scenes</p>
              <h2 className="text-lg font-bold">{scriptTitle}</h2>
            </div>
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors shrink-0">
              <RefreshCw className="w-3.5 h-3.5" /> Regenerate
            </button>
          </div>
          <p className="text-xs text-gray-500 bg-surface-card border border-surface-border rounded-lg px-3 py-2">
            ✏️ Edit any voiceover text before generating audio. Visual direction notes drive Pexels clip search.
          </p>
          {scenes.map((scene, i) => (
            <SceneCard key={scene.number} scene={scene} index={i} onChange={v => updateSceneVoiceover(i, v)} />
          ))}
          <div className="flex justify-between pt-1">
            <Button variant="secondary" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4" /> Back</Button>
            <Button onClick={goToVoices}>Choose Voice <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Choose Voice ──────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold mb-0.5">Step 3 — Choose a Voice</h2>
            <p className="text-xs text-gray-500">Powered by Groq Orpheus · falls back to OpenAI TTS</p>
          </div>
          {voicesLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-surface-card border border-surface-border rounded-xl animate-pulse" />)}
            </div>
          )}
          {!voicesLoading && voicesError && (
            <Card><CardContent className="py-8 space-y-3">
              <div className="flex items-start gap-2 text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div><p className="text-sm font-semibold">Could not load voices</p><p className="text-xs text-red-400/80 mt-0.5">{String(voicesError)}</p></div>
              </div>
              <button onClick={() => { setVoices([]); loadVoices() }} className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </button>
            </CardContent></Card>
          )}
          {!voicesLoading && !voicesError && voices.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {voices.map(v => <VoiceCard key={v.voice_id} voice={v} selected={selectedVoice === v.voice_id} onSelect={() => setSelectedVoice(v.voice_id)} />)}
            </div>
          )}
          {activeVoiceObj && (
            <div className="flex items-center gap-2 text-sm text-gray-400 bg-surface-card border border-surface-border rounded-lg px-4 py-3">
              <Check className="w-4 h-4 text-brand-400 shrink-0" />
              Selected: <span className="text-white font-medium">{activeVoiceObj.name}</span>
              <span className="text-gray-600 capitalize">({[activeVoiceObj.accent, activeVoiceObj.gender].filter(Boolean).join(' ')})</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4" /> Back</Button>
            <Button onClick={goToAvatarStep} disabled={!selectedVoice || voicesLoading}>
              Avatar & Background <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Avatar & Background ───────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold mb-0.5">Step 4 — Avatar & Background <span className="text-gray-500 font-normal">(optional)</span></h2>
            <p className="text-xs text-gray-500">Add an AI avatar for lipsync, or skip to use stock clips matched to each scene&apos;s visual direction.</p>
          </div>

          {/* ── Coming soon banner ── */}
          <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 border border-purple-700/40 bg-purple-950/20 text-sm text-purple-300">
            <span className="shrink-0 mt-0.5">⚡</span>
            <p>Avatar lip-sync is coming soon. Videos will be generated with matching stock clips in the meantime.</p>
          </div>

          {/* ── Avatar picker ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><User className="w-4 h-4 text-brand-400" /> Avatar</span>
                <Link href="/avatar-studio" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  Browse All <ChevronRight className="w-3 h-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedAvatar ? (
                <div className="flex items-center gap-3 bg-brand-950/40 border border-brand-800 rounded-xl px-4 py-3">
                  {selectedAvatar.preview_image_url
                    ? <img src={selectedAvatar.preview_image_url} alt={selectedAvatar.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
                    : <div className="w-12 h-12 rounded-full bg-brand-950 border border-brand-800 flex items-center justify-center shrink-0"><User className="w-6 h-6 text-brand-400" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate">{selectedAvatar.name}</p>
                    <Badge variant="info" className="text-xs mt-0.5">{selectedAvatar.type === 'talking_photo' ? 'Custom Photo' : 'Built-in'}</Badge>
                  </div>
                  {/* Change button — navigates to avatar-studio to pick a different one */}
                  <Link href="/avatar-studio" className="text-xs text-brand-400 hover:text-brand-300 transition-colors px-2 py-1 rounded hover:bg-brand-950/60 whitespace-nowrap shrink-0">
                    Change
                  </Link>
                  <button onClick={clearAvatar} className="text-gray-500 hover:text-red-400 transition-colors shrink-0" title="Remove avatar">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-surface border-2 border-dashed border-surface-border flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-400">No avatar selected</p>
                    <p className="text-xs text-gray-600">Without an avatar, stock video clips will be used</p>
                  </div>
                  <Link href="/avatar-studio">
                    <Button variant="secondary" size="sm">Browse</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Background picker ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Film className="w-4 h-4 text-brand-400" /> Background</span>
                <Link href="/media-library" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  Browse All <ChevronRight className="w-3 h-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedBackground ? (
                <div className="flex items-center gap-3 bg-surface border border-surface-border rounded-xl px-4 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedBackground.thumbnail} alt="" className="w-16 h-10 rounded-lg object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white capitalize truncate">{selectedBackground.type}</p>
                    <p className="text-xs text-gray-500 capitalize">{selectedBackground.source}</p>
                  </div>
                  {/* Change button — navigates to media-library to pick a different one */}
                  <Link href="/media-library" className="text-xs text-brand-400 hover:text-brand-300 transition-colors px-2 py-1 rounded hover:bg-surface-hover whitespace-nowrap shrink-0">
                    Change
                  </Link>
                  <button onClick={clearBackground} className="text-gray-500 hover:text-red-400 transition-colors shrink-0" title="Remove background">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-10 rounded-lg bg-surface border-2 border-dashed border-surface-border flex items-center justify-center shrink-0">
                    <Film className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-400">No background selected</p>
                    <p className="text-xs text-gray-600">A dark background will be used by default</p>
                  </div>
                  <Link href="/media-library">
                    <Button variant="secondary" size="sm">Browse</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Mode indicator — always stock clips while lipsync is deferred */}
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 border bg-surface-card border-surface-border text-gray-400 text-sm">
            <Film className="w-4 h-4 shrink-0" />
            <span><span className="text-white font-medium">Stock clips mode</span> — Pexels videos matched to each scene&apos;s visual direction.</span>
          </div>

          <div className="flex items-center justify-between pt-1 flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setStep(3)}><ChevronLeft className="w-4 h-4" /> Back</Button>
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-500">Uses <span className="text-white font-semibold">5 credits</span></p>
              <Button onClick={handleGenerateVoice} disabled={!selectedVoice}>
                <Volume2 className="w-4 h-4" /> Generate Voiceover
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Voiceover ─────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-5">
          {voiceGenerating && (
            <Card>
              <CardContent className="flex flex-col items-center py-16 gap-5">
                <div className="relative w-16 h-16">
                  <Loader2 className="w-16 h-16 text-brand-500 animate-spin" />
                  <Volume2 className="absolute inset-0 m-auto w-7 h-7 text-brand-300" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-base font-semibold">Generating voiceover…</p>
                  <p className="text-xs text-gray-500">
                    Generating {selectedDuration.totalWords} words · {selectedDuration.mins} min audio · This takes 30–60 seconds
                  </p>
                </div>
                <div className="w-full max-w-sm">
                  <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Processing</span><span>{Math.round(voiceProgress)}%</span></div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-brand-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${voiceProgress}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!voiceGenerating && voiceError && (
            <Card><CardContent className="py-10 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <div>
                <p className="font-semibold text-red-400 mb-2">Voiceover failed</p>
                <p className="text-sm text-gray-400 max-w-md mx-auto bg-red-950/30 border border-red-900 rounded-lg px-4 py-3">{String(voiceError)}</p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button variant="secondary" onClick={() => { setStep(4); setVoiceError('') }}><ChevronLeft className="w-4 h-4" /> Back</Button>
                <Button onClick={handleGenerateVoice}><RefreshCw className="w-4 h-4" /> Retry</Button>
              </div>
            </CardContent></Card>
          )}

          {!voiceGenerating && voiceResult && (
            <div className="space-y-5">
              {/* Success / browserTTS banner */}
              {voiceBrowserTTS ? (
                <div className="flex items-start gap-3 bg-yellow-950/40 border border-yellow-800 rounded-xl px-5 py-4">
                  <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-200">Server TTS unavailable</p>
                    <p className="text-xs text-yellow-400/80 mt-0.5">
                      Browser speech synthesis is playing a preview. The video will be generated without an audio track.
                      Set <code className="bg-yellow-950 px-1 rounded">GROQ_API_KEY</code> on Vercel to enable server-side voiceover.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 bg-green-950/40 border border-green-800 rounded-xl px-5 py-4">
                  <div className="w-10 h-10 rounded-full bg-green-950 border border-green-700 flex items-center justify-center shrink-0">
                    <Check className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-green-300">Voiceover ready!</p>
                    <p className="text-xs text-green-500/70">5 credits used · {selectedDuration.label} · saved to project</p>
                  </div>
                  <Badge variant="success">Step 5 ✓</Badge>
                </div>
              )}

              {/* Warning: avatar selected but Cloudinary failed → HeyGen won't run */}
              {heyGenBlocked && (
                <div className="flex items-start gap-2.5 bg-yellow-950/40 border border-yellow-800 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-400" />
                  <div>
                    <p className="text-sm font-semibold text-yellow-200">Avatar lipsync unavailable</p>
                    <p className="text-xs text-yellow-300/80 mt-1 leading-relaxed">
                      Cloudinary upload failed — voiceover is stored as a local data URL.
                      HeyGen requires a public HTTPS URL. Stock clips will be used instead.
                      Verify your <code className="bg-yellow-950 px-1 rounded">CLOUDINARY_*</code> environment variables to enable avatar lipsync.
                    </p>
                  </div>
                </div>
              )}

              {/* Audio player */}
              {voiceResult.voiceUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-brand-400" /> Preview
                      {activeVoiceObj && <span className="text-gray-500 font-normal">— {activeVoiceObj.name}</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <audio src={voiceResult.voiceUrl} controls className="w-full rounded-lg" style={{ colorScheme: 'dark' }} />
                    <a href={voiceResult.dataUrl || voiceResult.voiceUrl} download="voiceover.wav"
                      className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download Audio
                    </a>
                  </CardContent>
                </Card>
              )}

              {/* Mode + cost summary + generate button */}
              <div className="flex items-center justify-between bg-surface rounded-lg border border-surface-border px-4 py-3 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-gray-300">
                    {heyGenWillRun
                      ? <><span className="text-white font-medium">HeyGen lipsync</span> · {selectedDuration.label}</>
                      : heyGenBlocked
                      ? <><span className="text-yellow-300 font-medium">Stock clips</span> <span className="text-yellow-500/70 text-xs">(avatar blocked — Cloudinary needed)</span></>
                      : <><span className="text-white font-medium">Stock clips</span> · {selectedDuration.label}</>
                    }
                    <span className="text-gray-500 ml-2 text-xs">({selectedDuration.credits} credits)</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={() => setStep(4)}><ChevronLeft className="w-4 h-4" /> Back</Button>
                  <Button onClick={handleGenerateVideo}>
                    <Play className="w-4 h-4" /> Generate Video ({selectedDuration.credits}cr)
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 6: Video generation ──────────────────────────────────────── */}
      {step === 6 && (
        <div className="space-y-5">
          {videoGenerating && (
            <Card>
              <CardContent className="flex flex-col items-center py-14 gap-6">
                <div className="relative w-16 h-16">
                  <Loader2 className="w-16 h-16 text-brand-500 animate-spin" />
                  {usingHeyGen
                    ? <User className="absolute inset-0 m-auto w-7 h-7 text-brand-300" />
                    : <Video className="absolute inset-0 m-auto w-7 h-7 text-brand-300" />
                  }
                </div>
                <div className="text-center space-y-1 w-full max-w-sm">
                  <p className="text-base font-semibold">
                    {usingHeyGen ? 'HeyGen avatar rendering…' : `Generating your ${selectedDuration.label} reel…`}
                  </p>
                  {heyGenVideoId && <p className="text-xs text-gray-600">Video ID: {heyGenVideoId}</p>}
                  <p className="text-xs text-gray-500 mb-4">{videoStepLabel || 'Starting pipeline…'}</p>
                  <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Progress</span><span>{Math.round(videoProgress)}%</span></div>
                  <div className="h-2.5 bg-surface rounded-full overflow-hidden mb-4">
                    <div className="h-full bg-gradient-to-r from-brand-500 via-purple-500 to-pink-500 rounded-full transition-all duration-700" style={{ width: `${videoProgress}%` }} />
                  </div>
                  {!usingHeyGen && (
                    <div className="space-y-2 text-left">
                      {VIDEO_STEPS.map(s => {
                        const done = videoProgress > s.threshold; const current = videoCurrentStep === s.key
                        return (
                          <div key={s.key} className={cn('flex items-center gap-2.5 text-sm', done ? 'text-brand-400' : current ? 'text-white' : 'text-gray-600')}>
                            {done ? <Check className="w-4 h-4 shrink-0" /> :
                             current ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> :
                             <div className="w-4 h-4 shrink-0 rounded-full border border-current" />}
                            {s.label}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {!videoGenerating && videoError && (
            <Card><CardContent className="py-10 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <div>
                <p className="font-semibold text-red-400 mb-2">Video generation failed</p>
                <p className="text-sm text-gray-400 max-w-md mx-auto bg-red-950/30 border border-red-900 rounded-lg px-4 py-3">{String(videoError)}</p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button variant="secondary" onClick={() => { setStep(5); setVideoError('') }}><ChevronLeft className="w-4 h-4" /> Back</Button>
                <Button onClick={() => { setVideoError(''); setVideoProgress(0); handleGenerateVideo() }}>
                  <RefreshCw className="w-4 h-4" /> Retry Generation
                </Button>
              </div>
            </CardContent></Card>
          )}

          {!videoGenerating && videoResult && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 bg-green-950/40 border border-green-800 rounded-xl px-5 py-4">
                <div className="w-10 h-10 rounded-full bg-green-950 border border-green-700 flex items-center justify-center shrink-0">
                  <Check className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-green-300">Reel generated!</p>
                  <p className="text-xs text-green-500/70">
                    {usingHeyGen ? 'HeyGen avatar lipsync' : 'Stock clips'} · {selectedDuration.label} · saved to projects
                  </p>
                </div>
                <Badge variant="success">Complete</Badge>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Video className="w-4 h-4 text-brand-400" />{scriptTitle}
                    <span className="text-gray-500 font-normal ml-1 text-xs">1080×1920 · MP4</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative mx-auto rounded-xl overflow-hidden border border-surface-border bg-black" style={{ maxWidth: 'min(360px, 100%)', aspectRatio: '9/16' }}>
                    <video src={videoResult.videoUrl} controls playsInline className="w-full h-full object-cover" style={{ colorScheme: 'dark' }} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={videoResult.videoUrl} download="reel.mp4" target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      <Download className="w-4 h-4" /> Download MP4
                    </a>
                    <Button variant="secondary" onClick={handleReset}><RefreshCw className="w-4 h-4" /> Create Another</Button>
                    <Button onClick={() => (window.location.href = '/projects')}><Video className="w-4 h-4" /> View Projects</Button>
                    <Link
                      href={`/publisher?video_url=${encodeURIComponent(videoResult.videoUrl)}&title=${encodeURIComponent(scriptTitle)}`}
                      className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Share2 className="w-4 h-4" /> Publish
                    </Link>
                  </div>

                  {/* Caption Options Panel */}
                  {!captionedVideoUrl && (
                    <div className="space-y-3 mt-4">
                      <button
                        onClick={() => setShowCaptionOptions(p => !p)}
                        className="flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300"
                      >
                        <Settings className="w-3 h-3" />
                        {showCaptionOptions ? 'Hide' : 'Customize'} caption style
                      </button>

                      {showCaptionOptions && (
                        <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-4">
                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-2">Caption Style</p>
                            <div className="grid grid-cols-3 gap-2">
                              {CAPTION_STYLES.map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => setCaptionStyle(s.id)}
                                  className={cn(
                                    'flex flex-col items-center gap-1 py-2 px-3 rounded-lg border-2 transition-all',
                                    captionStyle === s.id
                                      ? 'border-brand-500 bg-brand-600/10'
                                      : 'border-surface-border hover:border-brand-700/60'
                                  )}
                                >
                                  <span className={cn('text-sm font-bold', s.style)}>{s.preview}</span>
                                  <span className="text-xs text-gray-400">{s.label}</span>
                                  {captionStyle === s.id && <Check className="w-3 h-3 text-brand-400" />}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-medium text-gray-400 mb-2">Caption Position</p>
                            <div className="flex gap-2">
                              {CAPTION_POSITIONS.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => setCaptionPosition(p.id)}
                                  className={cn(
                                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-xs font-medium transition-all',
                                    captionPosition === p.id
                                      ? 'border-brand-500 bg-brand-600/10 text-white'
                                      : 'border-surface-border text-gray-400 hover:border-brand-700/60'
                                  )}
                                >
                                  <span>{p.icon}</span> {p.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Live preview */}
                          <div className="bg-black rounded-lg h-20 relative overflow-hidden border border-surface-border">
                            <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900 opacity-50" />
                            <span
                              className={cn(
                                'absolute left-1/2 -translate-x-1/2 px-2 text-sm text-center whitespace-nowrap',
                                captionPosition === 'top' ? 'top-3' : captionPosition === 'center' ? 'top-1/2 -translate-y-1/2' : 'bottom-3',
                                CAPTION_STYLES.find(s => s.id === captionStyle)?.style
                              )}
                              style={{ textShadow: '2px 2px 4px black, -2px -2px 4px black' }}
                            >
                              This is how captions look
                            </span>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleAddCaptions}
                        disabled={addingCaptions}
                        className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors w-full justify-center"
                      >
                        {addingCaptions
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding Captions ({captionStyle})…</>
                          : <><MessageSquare className="w-4 h-4" /> Add Captions (Free)</>
                        }
                      </button>

                      {captionError && (
                        <p className="text-red-400 text-xs bg-red-950/40 border border-red-800 rounded px-3 py-2">
                          {String(captionError)}
                        </p>
                      )}
                    </div>
                  )}

                  {captionedVideoUrl && (
                    <div className="space-y-3 mt-3">
                      <p className="text-xs text-green-400 font-medium flex items-center gap-1">
                        <Check className="w-3 h-3" /> Captions added successfully
                      </p>
                      <div className="relative mx-auto rounded-xl overflow-hidden border border-surface-border bg-black"
                           style={{ maxWidth: 280, aspectRatio: '9/16' }}>
                        <video src={captionedVideoUrl} controls playsInline className="w-full h-full object-cover" />
                      </div>
                      <a href={captionedVideoUrl} download="reel-with-captions.mp4"
                         className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                        <Download className="w-4 h-4" /> Download with Captions
                      </a>
                    </div>
                  )}

                  {/* Save to series */}
                  <div className="border-t border-surface-border pt-4">
                    <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-brand-400" /> Save to a Series
                    </p>
                    {savedToSeries ? (
                      <div className="flex items-center gap-2 text-green-400 text-sm">
                        <Check className="w-4 h-4" /> Saved to series!
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          className="input flex-1 min-w-[180px] text-sm py-1.5"
                          value={selectedSeriesId}
                          onChange={e => setSelectedSeriesId(e.target.value)}
                          onFocus={loadSeriesForSave}
                        >
                          <option value="">— Pick a series —</option>
                          {seriesLoading && <option disabled>Loading…</option>}
                          {seriesList.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                        </select>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={!selectedSeriesId || savingToSeries}
                          onClick={handleSaveToSeries}
                        >
                          {savingToSeries ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                          {savingToSeries ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    )}
                    {saveSeriesError && (
                      <p className="text-xs text-red-400 mt-1">{String(saveSeriesError)}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2"><BookMarked className="w-4 h-4 text-gray-400" /> Script — {scriptTitle}</CardTitle>
                    <Badge variant="info">{platform}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {scenes.map((scene, i) => (
                    <div key={scene.number} className="flex gap-3">
                      <div className={cn('w-6 h-6 rounded-md bg-gradient-to-br flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5', SCENE_GRADIENTS[i % SCENE_GRADIENTS.length])}>{scene.number}</div>
                      <div>
                        <p className="text-xs font-medium text-gray-400 mb-0.5">{scene.duration}</p>
                        <p className="text-sm text-gray-200 leading-relaxed">{scene.voiceover}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
