'use client'

import { useState, useEffect } from 'react'
import {
  Film, Video, Sparkles, Loader2, ChevronRight, ChevronLeft, Check,
  AlertCircle, User, Plus, Download, Camera, MapPin, RefreshCw,
  Play, Zap, CheckCircle2, XCircle, Clock, Share2, Volume2,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Character {
  id: string
  name: string
  age: string | null
  gender: string | null
  appearance: string | null
  personality: string | null
  style: string | null
}

interface MovieScene {
  scene_number: number
  title: string
  location: string
  characters_present: string[]
  camera_angle: string
  voiceover: string
  visual_prompt: string
  duration_seconds: number
}

interface Screenplay {
  title: string
  logline: string
  scenes: MovieScene[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ['Setup', 'Characters', 'Screenplay', 'Export']

const GENRES = [
  { label: 'Action',      icon: '💥' },
  { label: 'Horror',      icon: '👻' },
  { label: 'Romance',     icon: '💕' },
  { label: 'Comedy',      icon: '😂' },
  { label: 'Documentary', icon: '🎤' },
  { label: 'Thriller',    icon: '🔪' },
  { label: 'Fantasy',     icon: '🧙' },
  { label: 'Sci-Fi',      icon: '🚀' },
] as const

const STYLES = [
  'Cinematic Realistic', 'Hollywood Blockbuster', 'Dark & Gritty',
  'Anime', 'Cartoon', 'Documentary',
] as const

const DURATIONS = [
  { mins: 1,  label: '1 min',  credits: 10,  scenes: 4  },
  { mins: 3,  label: '3 min',  credits: 20,  scenes: 12 },
  { mins: 5,  label: '5 min',  credits: 35,  scenes: 20 },
  { mins: 10, label: '10 min', credits: 60,  scenes: 40 },
  { mins: 30, label: '30 min', credits: 150, scenes: 120 },
]

// ── Step Indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
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
              <span className={cn('text-xs font-medium hidden sm:block',
                active ? 'text-white' : done ? 'text-brand-400' : 'text-gray-600')}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('mx-2 h-px w-6 transition-colors', current > idx ? 'bg-brand-600' : 'bg-surface-border')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Scene Card ─────────────────────────────────────────────────────────────────

function SceneCard({ scene, index, onChange }: {
  scene: MovieScene
  index: number
  onChange: (field: keyof MovieScene, value: string) => void
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {scene.scene_number}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-white truncate block">{scene.title}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin className="w-3 h-3" />{scene.location}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="info" className="text-xs flex items-center gap-1">
            <Camera className="w-3 h-3" />{scene.camera_angle}
          </Badge>
          <Badge variant="default" className="text-xs">{scene.duration_seconds}s</Badge>
        </div>
      </div>
      <div className="divide-y divide-surface-border">
        {scene.characters_present?.length > 0 && (
          <div className="px-4 py-2 flex items-center gap-1.5 flex-wrap">
            {scene.characters_present.map(c => (
              <Badge key={c} variant="default" className="text-xs flex items-center gap-1">
                <User className="w-3 h-3" />{c}
              </Badge>
            ))}
          </div>
        )}
        <div className="px-4 py-3">
          <p className="text-xs font-medium text-gray-400 mb-1.5">Voiceover</p>
          <p className="text-sm text-gray-200 leading-relaxed">{scene.voiceover}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-xs font-medium text-gray-400 mb-1.5">Visual Prompt <span className="text-gray-600">(editable)</span></p>
          <textarea
            className="input min-h-[72px] resize-y text-xs leading-relaxed"
            value={scene.visual_prompt}
            onChange={e => onChange('visual_prompt', e.target.value)}
          />
        </div>
      </div>
    </Card>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MovieStudioPage() {
  const [step, setStep] = useState(1)

  // Step 1
  const [title, setTitle]             = useState('')
  const [genre, setGenre]             = useState('Action')
  const [style, setStyle]             = useState<string>(STYLES[0])
  const [duration, setDuration]       = useState(DURATIONS[1])
  const [plot, setPlot]               = useState('')

  // Step 2
  const [characters, setCharacters]   = useState<Character[]>([])
  const [charsLoading, setCharsLoading] = useState(false)
  const [selectedChars, setSelectedChars] = useState<string[]>([])

  // Step 3
  const [generating, setGenerating]   = useState(false)
  const [genError, setGenError]       = useState('')
  const [screenplay, setScreenplay]   = useState<Screenplay | null>(null)
  const [movieId, setMovieId]         = useState('')

  // Step 4 — video generation
  const [pipeline, setPipeline]               = useState<'pexels' | 'ai'>('pexels')
  const [generatingVideo, setGeneratingVideo] = useState(false)
  const [videoProgress, setVideoProgress]     = useState(0)
  const [videoMessage, setVideoMessage]       = useState('')
  const [sceneStatuses, setSceneStatuses]     = useState<Record<number, 'pending' | 'generating' | 'done' | 'failed'>>({})
  const [completedScenes, setCompletedScenes] = useState<{ scene_number: number; video_url: string }[]>([])
  const [generationError, setGenerationError] = useState('')
  const [generationDone, setGenerationDone]   = useState(false)
  const [finalVideoUrl, setFinalVideoUrl]     = useState('')
  const [movieVoiceUrl, setMovieVoiceUrl]     = useState('')
  const [generatingVoice, setGeneratingVoice] = useState(false)

  async function loadCharacters() {
    if (characters.length > 0) return
    setCharsLoading(true)
    try {
      const res  = await fetch('/api/characters')
      if (res.ok) {
        const json = await res.json()
        setCharacters(json.characters ?? [])
      }
    } catch { /* ignore */ }
    finally { setCharsLoading(false) }
  }

  async function generateScreenplay() {
    setGenerating(true); setGenError(''); setScreenplay(null)
    const selectedCharsData = characters.filter(c => selectedChars.includes(c.id))
    try {
      const res  = await fetch('/api/movie/generate-script', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, genre, plot,
          duration_minutes: duration.mins,
          style,
          characters: selectedCharsData,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setGenError(json.error ?? 'Generation failed'); return }
      setScreenplay(json.screenplay as Screenplay)
      setMovieId(json.movie?.id ?? '')
    } catch { setGenError('Network error. Please try again.') }
    finally { setGenerating(false) }
  }

  function goToStep2() { setStep(2); loadCharacters() }
  function goToStep3() { setStep(3); generateScreenplay() }

  function updateScene(index: number, field: keyof MovieScene, value: string) {
    if (!screenplay) return
    setScreenplay(prev => {
      if (!prev) return prev
      const scenes = prev.scenes.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      )
      return { ...prev, scenes }
    })
  }

  function downloadScreenplay() {
    if (!screenplay) return
    const blob = new Blob([JSON.stringify(screenplay, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = `${title}-screenplay.json`; a.click()
    URL.revokeObjectURL(url)
  }

  async function generateMovieVoice(): Promise<string> {
    if (!screenplay?.scenes?.length) return ''
    setGeneratingVoice(true)
    try {
      const res = await fetch('/api/reel/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          scenes: screenplay.scenes.map((s: any, i: number) => ({
            number: i + 1,
            title: s.title,
            voiceover: s.voiceover,
            visualNote: s.visual_prompt || s.title,
            duration: String(s.duration_seconds || 8),
          })),
          voice: 'tara',
          title: screenplay.title,
        }),
      })
      if (!res.ok) return ''
      const data = await res.json()
      const url: string = data.voiceUrl || data.dataUrl || ''
      setMovieVoiceUrl(url)
      return url
    } catch { return '' }
    finally { setGeneratingVoice(false) }
  }

  async function handleGenerateVideo() {
    if (!screenplay?.scenes?.length) return

    setGeneratingVideo(true)
    setVideoProgress(0)
    setVideoMessage('Generating voiceover…')
    setGenerationError('')
    setGenerationDone(false)
    setFinalVideoUrl('')
    setCompletedScenes([])
    setSceneStatuses({})

    // Auto-generate voiceover if not already done
    let voiceUrl = movieVoiceUrl
    if (!voiceUrl) {
      voiceUrl = await generateMovieVoice()
    }
    setVideoMessage('Starting scene generation…')

    try {
      // Step 1: Get worker URL + scenes from Vercel API
      const initRes = await fetch('/api/movie/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          movie_id: movieId ?? undefined,
          scenes: !movieId ? screenplay.scenes : undefined,
          model: 'minimax',
          duration_minutes: duration.mins,
          voice_url: voiceUrl?.startsWith('http') ? voiceUrl : undefined,
          voice_data: voiceUrl?.startsWith('data:') ? voiceUrl : undefined,
        }),
      })

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({ error: 'Failed to start' })) as { error?: string }
        setGenerationError(err.error ?? 'Failed to start')
        setGeneratingVideo(false)
        return
      }

      const { worker_url, scenes, movie_id, model, pipeline: p, duration_minutes: dur, voice_url: vUrl, voice_data: vData } = await initRes.json() as {
        worker_url: string; scenes: unknown[]; movie_id: string; model: string
        pipeline?: string; duration_minutes?: number; voice_url?: string; voice_data?: string
      }
      setPipeline((p ?? 'pexels') as 'pexels' | 'ai')

      // Step 2: Connect DIRECTLY to Railway worker SSE
      // This bypasses Vercel's 300s timeout completely
      const workerRes = await fetch(worker_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes, movie_id, model,
          duration_minutes: dur ?? duration.mins,
          voice_url: vUrl || (voiceUrl?.startsWith('http') ? voiceUrl : undefined),
          voice_data: vData || (voiceUrl?.startsWith('data:') ? voiceUrl : undefined),
        }),
      })

      if (!workerRes.ok || !workerRes.body) {
        const text = await workerRes.text().catch(() => '')
        setGenerationError(`Worker error: ${text.slice(0, 200)}`)
        setGeneratingVideo(false)
        return
      }

      const reader = workerRes.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.split('\n').find(l => l.startsWith('data: '))
          if (!line) continue
          try {
            const ev = JSON.parse(line.slice(6)) as {
              type: string; pct?: number; scene_number?: number
              message?: string; video_url?: string; error?: string
            }

            if (ev.type === 'start') {
              setVideoMessage(ev.message ?? '')
            } else if (ev.type === 'progress') {
              setVideoProgress(ev.pct ?? 0)
              setVideoMessage(ev.message ?? '')
              if (ev.scene_number) {
                setSceneStatuses(prev => ({ ...prev, [ev.scene_number!]: 'generating' }))
              }
            } else if (ev.type === 'scene_done') {
              setVideoProgress(ev.pct ?? 0)
              if (ev.scene_number) setSceneStatuses(prev => ({ ...prev, [ev.scene_number!]: 'done' }))
              if (ev.scene_number && ev.video_url)
                setCompletedScenes(prev => [...prev, { scene_number: ev.scene_number!, video_url: ev.video_url! }])
            } else if (ev.type === 'scene_error') {
              if (ev.scene_number) setSceneStatuses(prev => ({ ...prev, [ev.scene_number!]: 'failed' }))
            } else if (ev.type === 'done') {
              setVideoProgress(100)
              setVideoMessage(ev.message ?? 'Complete!')
              if (ev.video_url) setFinalVideoUrl(ev.video_url)
              setGenerationDone(true)
              setGeneratingVideo(false)
            } else if (ev.type === 'error') {
              setGenerationError(ev.error ?? 'Generation failed')
              setGeneratingVideo(false)
            }
          } catch { continue }
        }
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Network error')
      setGeneratingVideo(false)
    }
  }

  const totalDuration = screenplay?.scenes.reduce((acc, s) => acc + (s.duration_seconds ?? 8), 0) ?? 0

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">AI Movie Studio</h1>
        <p className="text-gray-400 text-sm">Generate cinematic scripts with scenes, camera angles, and visual prompts</p>
      </div>

      <StepIndicator current={step} />

      {/* ── Step 1: Setup ── */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Step 1 — Movie Setup</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="label">Movie Title</label>
              <input className="input" placeholder="e.g. The Last Signal" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div>
              <label className="label">Genre</label>
              <div className="grid grid-cols-4 gap-2">
                {GENRES.map(g => (
                  <button key={g.label} onClick={() => setGenre(g.label)} className={cn(
                    'flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-medium transition-all',
                    genre === g.label ? 'border-brand-500 bg-brand-600/15 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700/60 hover:text-white'
                  )}>
                    <span className="text-lg">{g.icon}</span>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Visual Style</label>
              <div className="flex flex-wrap gap-2">
                {STYLES.map(s => (
                  <button key={s} onClick={() => setStyle(s)} className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                    style === s ? 'bg-brand-600 border-brand-500 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
                  )}>{s}</button>
                ))}
              </div>
              {style && !['Cinematic Realistic', 'Hollywood Blockbuster', 'Documentary'].includes(style) && (
                <div className="flex items-start gap-2 bg-yellow-950/40 border border-yellow-800 rounded-lg px-3 py-2 mt-2">
                  <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-300">
                    <span className="font-semibold">Note:</span> &ldquo;{style}&rdquo; style uses Pexels stock footage (real video).
                    True {style} animation requires Agency plan with AI video generation.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="label">Duration</label>
              <div className="grid grid-cols-5 gap-2">
                {DURATIONS.map(d => (
                  <button key={d.mins} onClick={() => setDuration(d)} className={cn(
                    'flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
                    duration.mins === d.mins ? 'border-brand-500 bg-brand-600/15 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700/60 hover:text-white'
                  )}>
                    <span>{d.label}</span>
                    <span className={cn('text-xs font-normal', duration.mins === d.mins ? 'text-brand-300' : 'text-gray-600')}>{d.credits}cr</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Plot</label>
              <textarea
                className="input min-h-[100px] resize-y"
                placeholder="A brilliant detective discovers that the AI governing the city has been manipulating citizens' memories. When her own partner becomes a suspect, she must decide who to trust before the system erases her too…"
                value={plot}
                onChange={e => setPlot(e.target.value)}
              />
            </div>

            <Button onClick={goToStep2} disabled={!title.trim() || !plot.trim()} className="w-full">
              Choose Characters <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Characters ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold mb-0.5">Step 2 — Characters <span className="text-gray-500 font-normal">(optional)</span></h2>
            <p className="text-xs text-gray-500">Select characters to feature. Their appearance and personality will guide the screenplay.</p>
          </div>

          {charsLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
            </div>
          )}

          {!charsLoading && characters.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center space-y-3">
                <User className="w-8 h-8 text-gray-500 mx-auto" />
                <p className="text-sm text-gray-400">No characters yet. Create some in Character Studio first, or skip to generate without characters.</p>
                <a href="/characters" className="inline-flex items-center gap-2 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Go to Character Studio
                </a>
              </CardContent>
            </Card>
          )}

          {!charsLoading && characters.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {characters.map(c => {
                const sel = selectedChars.includes(c.id)
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedChars(prev => sel ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                    className={cn(
                      'text-left flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                      sel ? 'border-brand-500 bg-brand-600/10' : 'border-surface-border hover:border-brand-700/50 bg-surface-card'
                    )}
                  >
                    <div className="w-9 h-9 rounded-full bg-brand-950 border border-brand-800 flex items-center justify-center text-brand-300 font-bold text-sm shrink-0">
                      {c.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">{[c.age ? `${c.age}y` : null, c.gender, c.style].filter(Boolean).join(' · ')}</p>
                    </div>
                    {sel && <Check className="w-4 h-4 text-brand-400 shrink-0" />}
                  </button>
                )
              })}
            </div>
          )}

          {selectedChars.length > 0 && (
            <div className="text-xs text-gray-400 bg-surface-card border border-surface-border rounded-lg px-3 py-2">
              {selectedChars.length} character{selectedChars.length !== 1 ? 's' : ''} selected
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4" /> Back</Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={goToStep3}>Skip <ChevronRight className="w-4 h-4" /></Button>
              <Button onClick={goToStep3}>
                <Sparkles className="w-4 h-4" /> Generate Screenplay
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Screenplay ── */}
      {step === 3 && (
        <div className="space-y-5">
          {generating && (
            <Card>
              <CardContent className="flex flex-col items-center py-16 gap-5">
                <div className="relative w-16 h-16">
                  <Loader2 className="w-16 h-16 text-brand-500 animate-spin" />
                  <Film className="absolute inset-0 m-auto w-7 h-7 text-brand-300" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold">Writing your screenplay…</p>
                  <p className="text-xs text-gray-500 mt-1">{genre} · {duration.label} · {duration.scenes} scenes</p>
                </div>
              </CardContent>
            </Card>
          )}

          {!generating && genError && (
            <Card><CardContent className="py-10 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-sm text-red-400 max-w-md mx-auto">{genError}</p>
              <div className="flex gap-3 justify-center">
                <Button variant="secondary" onClick={() => { setStep(2); setGenError('') }}><ChevronLeft className="w-4 h-4" /> Back</Button>
                <Button onClick={generateScreenplay}><RefreshCw className="w-4 h-4" /> Retry</Button>
              </div>
            </CardContent></Card>
          )}

          {!generating && screenplay && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{screenplay.title}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{screenplay.logline}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="info">{genre}</Badge>
                    <Badge variant="default">{style}</Badge>
                    <Badge variant="default">{screenplay.scenes?.length ?? 0} scenes · ~{Math.round(totalDuration / 60)}m {totalDuration % 60}s</Badge>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => { setStep(2); setScreenplay(null) }}>
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </Button>
              </div>

              <p className="text-xs text-gray-500 bg-surface-card border border-surface-border rounded-lg px-3 py-2">
                ✏️ Edit any visual prompt before exporting. Camera angles and scene structure are set by the AI.
              </p>

              {screenplay.scenes?.map((scene, i) => (
                <SceneCard
                  key={scene.scene_number}
                  scene={scene}
                  index={i}
                  onChange={(field, value) => updateScene(i, field, value)}
                />
              ))}

              <div className="flex justify-between pt-1">
                <Button variant="secondary" onClick={() => { setStep(2); setScreenplay(null) }}><ChevronLeft className="w-4 h-4" /> Back</Button>
                <Button onClick={() => setStep(4)}>Export Options <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Generate Video */}
      {step === 4 && (
        <div className="space-y-5">
          <Card>
            <CardContent className="py-16 flex flex-col items-center gap-5 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-950 border border-purple-800 flex items-center justify-center">
                <Video className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">
                  AI Video Generation — Coming Soon
                </h2>
                <p className="text-gray-400 text-sm max-w-md leading-relaxed">
                  We are integrating premium AI video models to render your screenplay
                  into cinematic video. This feature will be available for Agency plan users.
                </p>
              </div>
              <div className="flex flex-col items-center gap-3">
                <Badge variant="info">Agency Plan Feature</Badge>
                <p className="text-xs text-gray-500">
                  In the meantime, download your screenplay to use with other video tools.
                </p>
              </div>
              <div className="flex gap-3 flex-wrap justify-center">
                <Button variant="secondary" onClick={() => setStep(3)}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </Button>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(screenplay, null, 2)], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = (screenplay?.title ?? 'screenplay') + '.json'
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  <Download className="w-4 h-4" /> Download Screenplay
                </button>
                <Button onClick={() => { window.location.href = '/billing' }}>
                  Upgrade to Agency
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
