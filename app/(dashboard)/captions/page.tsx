'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare, Sparkles, Loader2, Copy, Check,
  AlertCircle, BookMarked, Clock, Hash, ChevronDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

const NICHES = [
  'Tech & AI', 'Fitness & Health', 'Beauty & Skincare', 'Food & Recipes',
  'Travel', 'Business & Entrepreneurship', 'Education', 'Finance & Investing',
  'Fashion & Style', 'Entertainment', 'Motivational', 'Gaming',
]

const TONES = ['Funny', 'Professional', 'Inspiring', 'Viral'] as const
type Tone = typeof TONES[number]

const TONE_DESCRIPTIONS: Record<Tone, string> = {
  Funny:        'Witty, humorous — uses jokes and relatable moments',
  Professional: 'Polished, authoritative — positions you as an expert',
  Inspiring:    'Emotional, motivational — moves people to take action',
  Viral:        'FOMO-driven, edgy — designed for maximum shares',
}

interface CaptionResult {
  hookLine: string
  caption: string
  hashtags: string[]
}

interface HistoryItem {
  id: string
  title: string
  created_at: string
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
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
      {copied ? 'Copied!' : label}
    </button>
  )
}

export default function CaptionsPage() {
  const supabase = createClient()

  const [topic, setTopic]   = useState('')
  const [niche, setNiche]   = useState(NICHES[0])
  const [tone, setTone]     = useState<Tone>('Viral')

  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [result, setResult]       = useState<CaptionResult | null>(null)

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
      .eq('type', 'short')
      .order('created_at', { ascending: false })
      .limit(5) as { data: HistoryItem[] | null }
    if (data) setHistory(data)
    setHistoryLoading(false)
  }, [supabase])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    setSavedId(null)
    setSaveError('')

    const res = await fetch('/api/generate/caption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, niche, tone }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    setResult(json as CaptionResult)
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
      .insert({ user_id: user.id, title: topic, type: 'short', status: 'completed' })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string } | null }

    if (projectErr || !project) {
      setSaveError(projectErr?.message ?? 'Failed to save project.')
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

  const fullText = result
    ? `${result.hookLine}\n\n${result.caption}\n\n${result.hashtags.join(' ')}`
    : ''

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Caption Generator</h1>
        <p className="text-gray-400 text-sm">
          Generate viral captions, hooks, and hashtags with GPT-4o.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Left: Form ── */}
        <Card>
          <CardHeader><CardTitle>What&apos;s your post about?</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleGenerate} className="space-y-5">
              {/* Topic */}
              <div>
                <label className="label">Topic</label>
                <input
                  className="input"
                  placeholder="e.g. 5 habits that changed my morning routine"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                />
              </div>

              {/* Niche – tag pills */}
              <div>
                <label className="label">Niche</label>
                <div className="flex flex-wrap gap-1.5">
                  {NICHES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNiche(n)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        niche === n
                          ? 'bg-brand-600 border-brand-500 text-white'
                          : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tone – dropdown */}
              <div>
                <label className="label">Tone</label>
                <div className="relative">
                  <select
                    className="input appearance-none pr-9 cursor-pointer"
                    value={tone}
                    onChange={(e) => setTone(e.target.value as Tone)}
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">{TONE_DESCRIPTIONS[tone]}</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-950/50 border border-red-800 text-red-400 text-sm rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {String(error)}
                </div>
              )}

              <Button type="submit" disabled={loading || !topic.trim()} className="w-full" size="md">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-4 h-4" /> Generate Caption</>}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ── Right: Result ── */}
        <div className="space-y-4">
          {loading && (
            <Card>
              <CardContent className="flex flex-col items-center py-14 gap-3">
                <Loader2 className="w-9 h-9 text-brand-400 animate-spin" />
                <p className="text-sm text-gray-400">GPT-4o is writing your caption…</p>
                <p className="text-xs text-gray-600">Usually takes 5–10 seconds</p>
              </CardContent>
            </Card>
          )}

          {!loading && !result && (
            <Card>
              <CardContent className="flex flex-col items-center py-14 gap-2">
                <MessageSquare className="w-10 h-10 text-gray-600" />
                <p className="text-sm text-gray-500">Your generated caption will appear here.</p>
              </CardContent>
            </Card>
          )}

          {result && !loading && (
            <>
              {/* Hook line */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-yellow-400" /> Hook Line
                  </CardTitle>
                  <CopyButton text={result.hookLine} />
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm leading-relaxed font-medium text-white">
                    {result.hookLine}
                  </p>
                </CardContent>
              </Card>

              {/* Caption */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-brand-400" /> Caption
                  </CardTitle>
                  <CopyButton text={result.caption} />
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
                    {result.caption}
                  </p>
                </CardContent>
              </Card>

              {/* Hashtags */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-sm flex items-center gap-1.5">
                    <Hash className="w-4 h-4 text-purple-400" /> Hashtags
                  </CardTitle>
                  <CopyButton text={result.hashtags.join(' ')} />
                </CardHeader>
                <CardContent className="pt-0 flex flex-wrap gap-2">
                  {result.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2.5 py-1 bg-purple-950 border border-purple-800 text-purple-300 text-xs rounded-full font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  onClick={handleSave}
                  disabled={saving || !!savedId}
                  variant={savedId ? 'secondary' : 'primary'}
                  size="md"
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    : savedId
                    ? <><Check className="w-4 h-4 text-green-400" /> Saved to Projects</>
                    : <><BookMarked className="w-4 h-4" /> Save to Projects</>}
                </Button>
                <CopyButton text={fullText} label="Copy All" />
                {saveError && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {saveError}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── History ── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 py-3">
          <Clock className="w-4 h-4 text-gray-400" />
          <CardTitle className="text-sm">Recent Caption Projects</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {historyLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading history…
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              No saved caption projects yet. Generate one above!
            </p>
          ) : (
            <div className="divide-y divide-surface-border">
              {history.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(item.created_at)}</p>
                  </div>
                  <Badge variant="info">caption</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
