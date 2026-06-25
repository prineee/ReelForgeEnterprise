'use client'

import { useState } from 'react'
import {
  Tv, Sparkles, Loader2, ChevronRight, ChevronLeft, Check,
  AlertCircle, User, Plus, ChevronDown, ChevronUp, Download, RefreshCw,
} from 'lucide-react'
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

interface SeriesScene {
  scene_number: number
  title: string
  location: string
  characters_present: string[]
  camera_angle: string
  voiceover: string
  visual_prompt: string
  duration_seconds: number
}

interface SeriesEpisode {
  episode_number: number
  title: string
  plot: string
  previously_on: string
  scenes: SeriesScene[]
}

interface SeriesPlan {
  title: string
  logline: string
  series_arc: string
  episodes: SeriesEpisode[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ['Setup', 'Characters', 'Series Plan', 'Save']

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

const STYLES = ['Cinematic Realistic', 'Hollywood Blockbuster', 'Dark & Gritty', 'Anime', 'Cartoon', 'Documentary'] as const
const EPISODE_COUNTS = [2, 3, 5, 8, 10] as const
const EP_DURATIONS = [
  { mins: 1,  label: '1 min' },
  { mins: 3,  label: '3 min' },
  { mins: 5,  label: '5 min' },
] as const

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

// ── Episode Card ───────────────────────────────────────────────────────────────

function EpisodeCard({ episode, index, onTitleChange, onPlotChange }: {
  episode: SeriesEpisode
  index: number
  onTitleChange: (v: string) => void
  onPlotChange: (v: string) => void
}) {
  const [expanded, setExpanded] = useState(index === 0)

  return (
    <Card>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-border">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-brand-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {episode.episode_number}
        </div>
        <div className="flex-1 min-w-0">
          <input
            className="bg-transparent text-sm font-semibold text-white w-full outline-none placeholder-gray-600 border-b border-transparent focus:border-brand-700"
            value={episode.title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="Episode title"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="default" className="text-xs">{episode.scenes?.length ?? 0} scenes</Badge>
          <button onClick={() => setExpanded(v => !v)} className="text-gray-500 hover:text-brand-400 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        <p className="text-xs font-medium text-gray-400 mb-1">Plot</p>
        <textarea
          className="input min-h-[60px] resize-y text-sm w-full"
          value={episode.plot}
          onChange={e => onPlotChange(e.target.value)}
          placeholder="Episode plot summary"
        />
      </div>

      {expanded && episode.scenes?.length > 0 && (
        <div className="border-t border-surface-border divide-y divide-surface-border">
          {episode.scenes.map(scene => (
            <div key={scene.scene_number} className="px-4 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-gray-600">{scene.scene_number}</span>
                <span className="text-xs font-medium text-white">{scene.title}</span>
                <Badge variant="info" className="text-xs ml-auto">{scene.camera_angle}</Badge>
              </div>
              <p className="text-xs text-gray-500 truncate">{scene.location}</p>
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{scene.visual_prompt}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function SeriesStudioPage() {
  const [step, setStep] = useState(1)

  // Step 1
  const [title, setTitle]         = useState('')
  const [genre, setGenre]         = useState('Thriller')
  const [style, setStyle]         = useState<string>(STYLES[0])
  const [epCount, setEpCount]     = useState(3)
  const [epDuration, setEpDuration] = useState(3)
  const [concept, setConcept]     = useState('')

  // Step 2
  const [characters, setCharacters] = useState<Character[]>([])
  const [charsLoading, setCharsLoading] = useState(false)
  const [selectedChars, setSelectedChars] = useState<string[]>([])

  // Step 3
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError]     = useState('')
  const [plan, setPlan]             = useState<SeriesPlan | null>(null)
  const [seriesId, setSeriesId]     = useState('')

  async function loadCharacters() {
    if (characters.length > 0) return
    setCharsLoading(true)
    try {
      const res  = await fetch('/api/characters')
      if (res.ok) { const json = await res.json(); setCharacters(json.characters ?? []) }
    } catch { /* ignore */ }
    finally { setCharsLoading(false) }
  }

  async function generatePlan() {
    setGenerating(true); setGenError(''); setPlan(null)
    const selectedCharsData = characters.filter(c => selectedChars.includes(c.id))
    try {
      const res  = await fetch('/api/series-ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, genre, concept, style,
          episode_count: epCount,
          duration_per_episode: epDuration,
          characters: selectedCharsData,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setGenError(json.error ?? 'Generation failed'); return }
      setPlan(json.plan as SeriesPlan)
      setSeriesId(json.series?.id ?? '')
    } catch { setGenError('Network error. Please try again.') }
    finally { setGenerating(false) }
  }

  function goToStep2() { setStep(2); loadCharacters() }
  function goToStep3() { setStep(3); generatePlan() }

  function updateEpisode(index: number, field: 'title' | 'plot', value: string) {
    setPlan(prev => {
      if (!prev) return prev
      const episodes = prev.episodes.map((ep, i) => i === index ? { ...ep, [field]: value } : ep)
      return { ...prev, episodes }
    })
  }

  function downloadPlan() {
    if (!plan) return
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = `${title}-series-plan.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">AI Series Studio</h1>
        <p className="text-gray-400 text-sm">Build multi-episode series with story continuity and character memory</p>
      </div>

      <StepIndicator current={step} />

      {/* ── Step 1: Setup ── */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Step 1 — Series Setup</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div>
              <label className="label">Series Title</label>
              <input className="input" placeholder="e.g. Dark Signal" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div>
              <label className="label">Genre</label>
              <div className="grid grid-cols-4 gap-2">
                {GENRES.map(g => (
                  <button key={g.label} onClick={() => setGenre(g.label)} className={cn(
                    'flex flex-col items-center gap-1 py-3 rounded-xl border-2 text-xs font-medium transition-all',
                    genre === g.label ? 'border-brand-500 bg-brand-600/15 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700/60 hover:text-white'
                  )}>
                    <span className="text-lg">{g.icon}</span>{g.label}
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
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="label">Number of Episodes</label>
                <div className="flex gap-2 flex-wrap">
                  {EPISODE_COUNTS.map(n => (
                    <button key={n} onClick={() => setEpCount(n)} className={cn(
                      'px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all',
                      epCount === n ? 'border-brand-500 bg-brand-600/15 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700/60 hover:text-white'
                    )}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Duration per Episode</label>
                <div className="flex gap-2">
                  {EP_DURATIONS.map(d => (
                    <button key={d.mins} onClick={() => setEpDuration(d.mins)} className={cn(
                      'px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-all',
                      epDuration === d.mins ? 'border-brand-500 bg-brand-600/15 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700/60 hover:text-white'
                    )}>{d.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="label">Series Concept</label>
              <textarea
                className="input min-h-[100px] resize-y"
                placeholder="A group of scientists at a remote Arctic station begin experiencing shared hallucinations that seem to be communications from a future version of themselves warning them about a catastrophic event…"
                value={concept}
                onChange={e => setConcept(e.target.value)}
              />
            </div>

            <Button onClick={goToStep2} disabled={!title.trim() || !concept.trim()} className="w-full">
              Choose Characters <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Characters ── */}
      {step === 2 && (
        <div className="space-y-5">
          <div>
            <h2 className="text-base font-semibold mb-0.5">Step 2 — Recurring Characters <span className="text-gray-500 font-normal">(optional)</span></h2>
            <p className="text-xs text-gray-500">Select characters that appear across episodes. Their traits will be maintained throughout the series.</p>
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
                <p className="text-sm text-gray-400">No characters yet. You can skip this step or create characters first.</p>
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

          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4" /> Back</Button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={goToStep3}>Skip <ChevronRight className="w-4 h-4" /></Button>
              <Button onClick={goToStep3}>
                <Sparkles className="w-4 h-4" /> Generate Series Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Series Plan ── */}
      {step === 3 && (
        <div className="space-y-5">
          {generating && (
            <Card>
              <CardContent className="flex flex-col items-center py-16 gap-5">
                <div className="relative w-16 h-16">
                  <Loader2 className="w-16 h-16 text-brand-500 animate-spin" />
                  <Tv className="absolute inset-0 m-auto w-7 h-7 text-brand-300" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold">Writing your series plan…</p>
                  <p className="text-xs text-gray-500 mt-1">{epCount} episodes · {epDuration} min each · {genre}</p>
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
                <Button onClick={generatePlan}><RefreshCw className="w-4 h-4" /> Retry</Button>
              </div>
            </CardContent></Card>
          )}

          {!generating && plan && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">{plan.title}</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{plan.logline}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="info">{genre}</Badge>
                    <Badge variant="default">{style}</Badge>
                    <Badge variant="default">{plan.episodes?.length ?? 0} episodes</Badge>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => { setStep(2); setPlan(null) }}>
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </Button>
              </div>

              {plan.series_arc && (
                <div className="bg-surface-card border border-surface-border rounded-xl px-4 py-3">
                  <p className="text-xs font-medium text-gray-400 mb-1">Series Arc</p>
                  <p className="text-sm text-gray-200 leading-relaxed">{plan.series_arc}</p>
                </div>
              )}

              <p className="text-xs text-gray-500 bg-surface-card border border-surface-border rounded-lg px-3 py-2">
                ✏️ Edit episode titles and plots inline. Expand each card to view scenes.
              </p>

              {plan.episodes?.map((ep, i) => (
                <EpisodeCard
                  key={ep.episode_number}
                  episode={ep}
                  index={i}
                  onTitleChange={v => updateEpisode(i, 'title', v)}
                  onPlotChange={v => updateEpisode(i, 'plot', v)}
                />
              ))}

              <div className="flex justify-between pt-1">
                <Button variant="secondary" onClick={() => { setStep(2); setPlan(null) }}><ChevronLeft className="w-4 h-4" /> Back</Button>
                <Button onClick={() => setStep(4)}>Save Series <ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step 4: Save ── */}
      {step === 4 && plan && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 bg-green-950/40 border border-green-800 rounded-xl px-5 py-4">
            <div className="w-10 h-10 rounded-full bg-green-950 border border-green-700 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="font-semibold text-green-300">Series saved!</p>
              <p className="text-xs text-green-500/70">{plan.episodes?.length} episodes · saved to database</p>
            </div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2">
              <Tv className="w-4 h-4 text-brand-400" /> {plan.title} — Episode List
            </CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {plan.episodes?.map(ep => (
                <div key={ep.episode_number} className="flex items-center gap-3 bg-surface rounded-lg border border-surface-border px-3 py-2.5">
                  <span className="w-7 h-7 rounded bg-gradient-to-br from-purple-500 to-brand-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                    {ep.episode_number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ep.title}</p>
                    <p className="text-xs text-gray-500 truncate">{ep.scenes?.length ?? 0} scenes</p>
                  </div>
                  <Badge variant="default" className="text-xs">draft</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-3">
            <Button onClick={downloadPlan}>
              <Download className="w-4 h-4" /> Download Series Plan JSON
            </Button>
            {seriesId && (
              <Button variant="secondary" onClick={() => window.location.href = '/my-series'}>
                View in My Series
              </Button>
            )}
            <Button variant="secondary" onClick={() => { setStep(1); setTitle(''); setConcept(''); setPlan(null); setSelectedChars([]) }}>
              <RefreshCw className="w-4 h-4" /> New Series
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
