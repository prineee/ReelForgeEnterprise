'use client'

import { useState } from 'react'
import {
  Film, Loader2, Download, RefreshCw, ChevronDown, ChevronUp,
  Camera, Lightbulb, Play, AlertCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── Constants ─────────────────────────────────────────────────────────────────

const GENRES = ['Action','Horror','Romance','Comedy','Drama','Documentary','Commercial','Sci-Fi','Noir','Music Video'] as const
const VISUAL_STYLES = ['Cinematic Realistic','Hollywood Blockbuster','Dark & Gritty','Neon Noir','Soft Dreamlike','Anime','Vintage Film','Documentary','Commercial Clean'] as const
const CAMERA_ANGLES = ['Wide Shot','Medium Shot','Close-Up','Extreme Close-Up','Over-the-Shoulder','Low Angle','High Angle','Dutch Angle','POV Shot','Drone Shot','Tracking Shot','Dolly Zoom'] as const
const CAMERA_MOVEMENTS = ['Static','Pan Left','Pan Right','Tilt Up','Tilt Down','Zoom In','Zoom Out','Dolly In','Dolly Out','Orbit','Handheld','Crane Up','Crane Down'] as const
const LENSES = ['Standard 50mm','Wide 24mm','Telephoto 85mm','Ultra Wide 16mm','Macro','Fisheye'] as const
const TIMES_OF_DAY = ['Dawn','Morning','Noon','Golden Hour','Dusk','Night','Midnight'] as const
const MOODS = ['Natural','Dramatic','Soft','Neon','Moody','High Contrast','Low Key','High Key'] as const
const DURATIONS = [3, 5, 8, 10] as const

interface SceneResult {
  video_url: string
  enhanced_prompt: string
  settings: {
    genre?: string; visual_style?: string; camera_angle?: string
    camera_movement?: string; lens?: string; time_of_day?: string
    mood?: string; duration?: number
  }
  prompt_used: string
}

// ── Collapsible Section ───────────────────────────────────────────────────────

function CollapsibleSection({ title, icon, children }: {
  title: string; icon: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-surface-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-card hover:bg-surface-hover transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-white">{icon}{title}</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && <div className="px-4 py-4 bg-surface space-y-3 border-t border-surface-border">{children}</div>}
    </div>
  )
}

// ── Pill selector ─────────────────────────────────────────────────────────────

function Pills<T extends string>({ options, value, onChange }: {
  options: readonly T[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)} className={cn(
          'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors',
          value === o
            ? 'bg-brand-600 border-brand-500 text-white'
            : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
        )}>{o}</button>
      ))}
    </div>
  )
}

function Select<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly T[]; value: T; onChange: (v: T) => void
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input" value={value} onChange={e => onChange(e.target.value as T)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CinemaStudioPage() {
  // Controls
  const [prompt, setPrompt]               = useState('')
  const [genre, setGenre]                 = useState<typeof GENRES[number]>('Drama')
  const [visualStyle, setVisualStyle]     = useState<typeof VISUAL_STYLES[number]>('Cinematic Realistic')
  const [cameraAngle, setCameraAngle]     = useState<typeof CAMERA_ANGLES[number]>('Medium Shot')
  const [cameraMove, setCameraMove]       = useState<typeof CAMERA_MOVEMENTS[number]>('Static')
  const [lens, setLens]                   = useState<typeof LENSES[number]>('Standard 50mm')
  const [timeOfDay, setTimeOfDay]         = useState<typeof TIMES_OF_DAY[number]>('Golden Hour')
  const [mood, setMood]                   = useState<typeof MOODS[number]>('Dramatic')
  const [duration, setDuration]           = useState<typeof DURATIONS[number]>(5)

  // Generation state
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [result, setResult]     = useState<SceneResult | null>(null)
  const [history, setHistory]   = useState<SceneResult[]>([])

  async function handleGenerate() {
    if (!prompt.trim()) return
    setLoading(true); setError(''); setResult(null)
    try {
      const res  = await fetch('/api/cinema/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt, genre, visual_style: visualStyle,
          camera_angle: cameraAngle, camera_movement: cameraMove,
          lens, time_of_day: timeOfDay, mood, duration,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(typeof json.error === 'string' ? json.error : 'Generation failed'); return }
      const scene: SceneResult = { ...json, prompt_used: prompt }
      setResult(scene)
      setHistory(prev => [scene, ...prev].slice(0, 12))
    } catch { setError('Network error. Please try again.') }
    finally { setLoading(false) }
  }

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Cinema Studio</h1>
        <p className="text-gray-400 text-sm">Shot-by-shot AI filmmaking with full directorial controls</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── LEFT: Director Controls ── */}
        <div className="space-y-4">
          {/* Scene prompt */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Film className="w-4 h-4 text-brand-400" /> Scene</CardTitle></CardHeader>
            <CardContent>
              <textarea
                className="input min-h-[120px] resize-y text-sm leading-relaxed"
                placeholder="A detective walks through rain-soaked neon streets at midnight, collar turned up, cigarette smoke curling into the cold air…"
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </CardContent>
          </Card>

          {/* Genre */}
          <Card>
            <CardContent className="pt-4">
              <label className="label">Genre</label>
              <Pills options={GENRES} value={genre} onChange={setGenre} />
            </CardContent>
          </Card>

          {/* Visual style */}
          <Card>
            <CardContent className="pt-4">
              <label className="label">Visual Style</label>
              <Pills options={VISUAL_STYLES} value={visualStyle} onChange={setVisualStyle} />
            </CardContent>
          </Card>

          {/* Camera controls */}
          <CollapsibleSection title="Camera Controls" icon={<Camera className="w-4 h-4 text-brand-400" />}>
            <Select label="Camera Angle"    options={CAMERA_ANGLES}    value={cameraAngle} onChange={setCameraAngle} />
            <Select label="Camera Movement" options={CAMERA_MOVEMENTS}  value={cameraMove}  onChange={setCameraMove} />
            <Select label="Lens"            options={LENSES}            value={lens}        onChange={setLens} />
          </CollapsibleSection>

          {/* Lighting */}
          <CollapsibleSection title="Lighting" icon={<Lightbulb className="w-4 h-4 text-yellow-400" />}>
            <div>
              <label className="label">Time of Day</label>
              <Pills options={TIMES_OF_DAY} value={timeOfDay} onChange={setTimeOfDay} />
            </div>
            <div>
              <label className="label">Mood</label>
              <Pills options={MOODS} value={mood} onChange={setMood} />
            </div>
          </CollapsibleSection>

          {/* Duration */}
          <Card>
            <CardContent className="pt-4">
              <label className="label">Duration</label>
              <div className="flex gap-2">
                {DURATIONS.map(d => (
                  <button key={d} onClick={() => setDuration(d)} className={cn(
                    'flex-1 py-2 rounded-lg border-2 text-sm font-semibold transition-all',
                    duration === d ? 'border-brand-500 bg-brand-600/15 text-white' : 'border-surface-border text-gray-400 hover:border-brand-700/60 hover:text-white'
                  )}>{d}s</button>
                ))}
              </div>
            </CardContent>
          </Card>

          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full py-3.5 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: loading ? '#4c1d95' : 'linear-gradient(135deg, #7c3aed, #db2777)' }}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> AI Director is composing your scene…</>
              : '🎬 Generate Scene'
            }
          </button>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {String(error)}
            </div>
          )}
        </div>

        {/* ── RIGHT: Output ── */}
        <div className="space-y-4">
          {!result && !loading && (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-surface-card border border-surface-border rounded-2xl gap-4">
              <div className="w-20 h-20 rounded-2xl bg-surface border border-surface-border flex items-center justify-center">
                <Film className="w-10 h-10 text-gray-600" />
              </div>
              <p className="text-gray-500 text-sm text-center">Your scene will appear here<br /><span className="text-gray-600 text-xs">Configure settings and click Generate</span></p>
            </div>
          )}

          {loading && (
            <div className="min-h-[400px] flex flex-col items-center justify-center bg-surface-card border border-surface-border rounded-2xl gap-6">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-purple-900" />
                <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 animate-spin" />
                <Film className="absolute inset-0 m-auto w-8 h-8 text-purple-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-white">AI Director is composing your scene…</p>
                <p className="text-xs text-gray-500 mt-1">Enhancing prompt · Generating video · Uploading</p>
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              <div className="relative mx-auto rounded-2xl overflow-hidden border border-surface-border bg-black" style={{ maxWidth: 360, aspectRatio: '9/16' }}>
                <video src={result.video_url} controls playsInline className="w-full h-full object-cover" style={{ colorScheme: 'dark' }} />
              </div>

              <Card>
                <CardContent className="space-y-3 pt-4">
                  <p className="text-xs text-gray-500 italic leading-relaxed">&ldquo;{result.prompt_used}&rdquo;</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="info" className="text-xs">{result.settings.camera_angle}</Badge>
                    <Badge variant="default" className="text-xs">{result.settings.camera_movement}</Badge>
                    <Badge variant="default" className="text-xs">{result.settings.lens}</Badge>
                    <Badge variant="default" className="text-xs">{result.settings.genre}</Badge>
                    <Badge variant="default" className="text-xs">{result.settings.visual_style}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={result.video_url} download target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
                      <Download className="w-3.5 h-3.5" /> Download
                    </a>
                    <Button variant="secondary" size="sm" onClick={handleGenerate}>
                      <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* ── Scene History ── */}
      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Session History</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {history.map((h, i) => (
              <div key={i} className="bg-surface-card border border-surface-border rounded-xl overflow-hidden group cursor-pointer" onClick={() => setResult(h)}>
                <div className="relative aspect-[9/16] bg-black max-h-48 overflow-hidden">
                  <video src={h.video_url} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <Play className="w-8 h-8 text-white" />
                  </div>
                </div>
                <div className="p-2">
                  <p className="text-xs text-gray-400 truncate">{h.prompt_used}</p>
                  <p className="text-xs text-gray-600">{h.settings.genre} · {h.settings.duration}s</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
