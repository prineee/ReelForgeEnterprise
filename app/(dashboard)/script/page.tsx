'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FileText, Sparkles, Loader2, Copy, Check,
  AlertCircle, BookMarked, Clock, Mic, Eye,
  ChevronDown, ChevronUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { formatDate, cn } from '@/lib/utils'

const PLATFORMS = ['Reels', 'Shorts', 'TikTok'] as const
type Platform = typeof PLATFORMS[number]

const PLATFORM_ICONS: Record<Platform, string> = {
  Reels:  '📱',
  Shorts: '▶️',
  TikTok: '🎵',
}

interface Scene {
  number: number
  title: string
  duration: string
  voiceover: string
  visualNote: string
  visualKeywords?: string[]
}

interface ScriptResult {
  title: string
  scenes: Scene[]
}

interface HistoryItem {
  id: string
  title: string
  created_at: string
}

const SCENE_GRADIENTS = [
  'from-red-500 to-orange-500',
  'from-orange-500 to-yellow-500',
  'from-brand-500 to-blue-500',
  'from-green-500 to-emerald-500',
  'from-purple-500 to-pink-500',
]

const SCENE_LABELS = ['HOOK', 'PROBLEM', 'SOLUTION', 'PROOF', 'CTA']

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-surface-hover transition-colors"
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

function SceneCard({ scene, index }: { scene: Scene; index: number }) {
  const [expanded, setExpanded] = useState(true)
  const label    = SCENE_LABELS[index] ?? `SCENE ${scene.number}`
  const gradient = SCENE_GRADIENTS[index] ?? SCENE_GRADIENTS[0]

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-hover transition-colors rounded-t-xl text-left"
      >
        <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white text-xs font-extrabold shrink-0', gradient)}>
          {scene.number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn('text-xs font-bold px-1.5 py-0.5 rounded bg-gradient-to-r bg-clip-text', gradient)}
              style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              {label}
            </span>
            <span className="text-sm font-semibold truncate">{scene.title}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{scene.duration}</p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-500 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-surface-border divide-y divide-surface-border">
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
                <Mic className="w-3.5 h-3.5" /> Voiceover
              </div>
              <CopyButton text={scene.voiceover} />
            </div>
            <p className="text-sm text-gray-200 leading-relaxed">{scene.voiceover}</p>
          </div>

          <div className="px-5 py-4 bg-surface/40 rounded-b-xl">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
              <Eye className="w-3.5 h-3.5" /> Visual Direction
            </div>
            <p className="text-xs text-gray-400 leading-relaxed italic">{scene.visualNote}</p>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function ScriptPage() {
  const supabase = createClient()

  const [productName, setProductName]       = useState('')
  const [targetAudience, setTargetAudience] = useState('')
  const [platform, setPlatform]             = useState<Platform>('Reels')

  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState<ScriptResult | null>(null)

  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState('')
  const [savedId, setSavedId]     = useState<string | null>(null)

  const [history, setHistory]               = useState<HistoryItem[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setHistoryLoading(false); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('projects') as any)
      .select('id, title, created_at')
      .eq('user_id', user.id)
      .eq('type', 'reel')
      .order('created_at', { ascending: false })
      .limit(5) as { data: HistoryItem[] | null }
    if (data) setHistory(data)
    setHistoryLoading(false)
  }, [supabase])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!productName.trim() || !targetAudience.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setSavedId(null)
    setSaveError('')

    const res = await fetch('/api/generate/script', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName, targetAudience, platform }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setResult(json as ScriptResult)
    setLoading(false)
  }

  async function handleSave() {
    if (!result) return
    setSaving(true)
    setSaveError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaveError('You must be logged in to save.')
      setSaving(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: project, error: projectErr } = await (supabase.from('projects') as any)
      .insert({ user_id: user.id, title: productName, type: 'reel', status: 'completed' })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string } | null }

    if (projectErr || !project) {
      setSaveError(projectErr?.message ?? 'Failed to create project.')
      setSaving(false)
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: videoErr } = await (supabase.from('videos') as any)
      .insert({ project_id: project.id, script: JSON.stringify(result) }) as
      { error: { message: string } | null }

    if (videoErr) {
      setSaveError(videoErr.message)
      setSaving(false)
      return
    }

    setSavedId(project.id)
    setSaving(false)
    loadHistory()
  }

  function buildFullScript() {
    if (!result) return ''
    const lines = [`# ${result.title}\n`]
    result.scenes.forEach((s) => {
      lines.push(`--- Scene ${s.number}: ${s.title} (${s.duration}) ---`)
      lines.push(`[Voiceover] ${s.voiceover}`)
      lines.push(`[Visual] ${s.visualNote}\n`)
    })
    return lines.join('\n')
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Reel Script Generator</h1>
        <p className="text-gray-400 text-sm">
          Generate a 60-second, 5-scene script with GPT-4o — ready to film.
        </p>
      </div>

      {/* ── Form ── */}
      <Card>
        <CardHeader><CardTitle>Script Details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Product / Service Name</label>
                <input
                  className="input"
                  placeholder="e.g. FitTrack Pro smartwatch"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Target Audience</label>
                <input
                  className="input"
                  placeholder="e.g. busy professionals aged 25–40"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Platform */}
            <div>
              <label className="label">Platform</label>
              <div className="flex gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      platform === p
                        ? 'bg-brand-600 border-brand-500 text-white'
                        : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
                    }`}
                  >
                    <span>{PLATFORM_ICONS[p]}</span>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                {String(error)}
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={loading || !productName.trim() || !targetAudience.trim()}
                size="md"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-4 h-4" /> Generate 5-Scene Script</>}
              </Button>
              <p className="text-xs text-gray-500">Uses 1 credit &bull; ~60 seconds of content</p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <Card key={n}>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="w-8 h-8 rounded-lg bg-surface-border animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-surface-border rounded animate-pulse w-1/3" />
                  <div className="h-2 bg-surface-border rounded animate-pulse w-2/3" />
                </div>
              </CardContent>
            </Card>
          ))}
          <p className="text-center text-sm text-gray-500 animate-pulse">
            GPT-4o is crafting your {platform} script…
          </p>
        </div>
      )}

      {/* ── Script output ── */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Title bar */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-xs text-gray-500">Generated Script</p>
                <Badge variant="info">{platform}</Badge>
              </div>
              <h2 className="text-lg font-bold">{result.title}</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleSave}
                disabled={saving || !!savedId}
                variant={savedId ? 'secondary' : 'primary'}
                size="sm"
              >
                {saving
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                  : savedId
                  ? <><Check className="w-3.5 h-3.5 text-green-400" /> Saved</>
                  : <><BookMarked className="w-3.5 h-3.5" /> Save</>}
              </Button>
              <CopyButton text={buildFullScript()} />
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
            </div>
          )}

          {result.scenes.map((scene, i) => (
            <SceneCard key={scene.number} scene={scene} index={i} />
          ))}

          <div className="flex justify-end">
            <button
              onClick={() => navigator.clipboard.writeText(buildFullScript())}
              className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              <FileText className="w-4 h-4" /> Copy full script
            </button>
          </div>
        </div>
      )}

      {/* ── History ── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 py-3">
          <Clock className="w-4 h-4 text-gray-400" />
          <CardTitle className="text-sm">Recent Reel Scripts</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {historyLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No saved scripts yet. Generate one above!</p>
          ) : (
            <div className="divide-y divide-surface-border">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(item.created_at)}</p>
                  </div>
                  <Badge variant="info">reel</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
