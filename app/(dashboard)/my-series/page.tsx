'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Layers, Plus, Trash2, ChevronDown, ChevronUp, Play,
  FolderOpen, X, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Episode {
  id: string
  episode_number: number
  title: string
  status: 'draft' | 'ready' | 'published'
  video_url: string | null
  thumbnail_url: string | null
  created_at: string
}

interface Series {
  id: string
  title: string
  description: string | null
  niche: string | null
  episode_count: number
  created_at: string
  episodes: Episode[]
}

interface Project {
  id: string
  title: string
  status: string
  created_at: string
  video_url?: string | null
  thumbnail_url?: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NICHES = [
  'Tech & AI', 'Fitness & Health', 'Business', 'Finance',
  'Motivation', 'Lifestyle', 'Food & Cooking', 'Travel', 'Gaming', 'Entertainment',
] as const

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
  draft:     'default',
  ready:     'info',
  published: 'success',
}

// ── New Series Modal ───────────────────────────────────────────────────────────

function NewSeriesModal({ onClose, onCreate }: {
  onClose: () => void
  onCreate: (s: Series) => void
}) {
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [niche, setNiche]             = useState<string>(NICHES[0])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/series', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, niche }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to create series'); return }
      onCreate({ ...json.series, episodes: [] })
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-surface-card border border-surface-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-border">
          <h2 className="font-bold text-base">New Series</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="label">Series Title <span className="text-red-500">*</span></label>
            <input
              className="input"
              placeholder="e.g. The AI Productivity Series"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Description <span className="text-gray-600">(optional)</span></label>
            <textarea
              className="input min-h-[72px] resize-y text-sm"
              placeholder="What is this series about?"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Niche</label>
            <select className="input" value={niche} onChange={e => setNiche(e.target.value)}>
              {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {String(error)}
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={loading || !title.trim()} className="flex-1">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                : <><Plus className="w-4 h-4" /> Create Series</>
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Add Episode Modal ──────────────────────────────────────────────────────────

function AddEpisodeModal({ seriesId, onClose, onAdd }: {
  seriesId: string
  onClose: () => void
  onAdd: (ep: Episode) => void
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Project | null>(null)
  const [adding, setAdding]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch('/api/projects')
        if (!res.ok) { setError('Could not load projects'); return }
        const json = await res.json()
        setProjects(json.projects ?? [])
      } catch {
        setError('Network error')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleAdd() {
    if (!selected) return
    setAdding(true); setError('')
    try {
      const res  = await fetch(`/api/series/${seriesId}/episodes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id:    selected.id,
          title:         selected.title,
          video_url:     selected.video_url ?? null,
          thumbnail_url: selected.thumbnail_url ?? null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(typeof json.error === 'string' ? json.error : 'Failed to add episode'); return }
      onAdd(json.episode as Episode)
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-surface-card border border-surface-border rounded-2xl shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-border shrink-0">
          <h2 className="font-bold text-base">Add Episode from Projects</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-7 h-7 animate-spin text-brand-500" />
            </div>
          )}
          {!loading && projects.length === 0 && !error && (
            <div className="text-center py-10 text-sm text-gray-500">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-600" />
              No projects found. Create a reel first.
            </div>
          )}
          {!loading && error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {String(error)}
            </div>
          )}
          {!loading && projects.map(p => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={cn(
                'w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                selected?.id === p.id
                  ? 'border-brand-500 bg-brand-600/10'
                  : 'border-surface-border hover:border-brand-700/50 bg-surface'
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-surface-card border border-surface-border flex items-center justify-center shrink-0">
                <FolderOpen className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{p.title}</p>
                <p className="text-xs text-gray-500">{formatDate(p.created_at)}</p>
              </div>
              {selected?.id === p.id && <CheckCircle2 className="w-4 h-4 text-brand-400 shrink-0" />}
            </button>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-surface-border shrink-0 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleAdd} disabled={!selected || adding} className="flex-1">
            {adding ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : 'Add Episode'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Series Card ────────────────────────────────────────────────────────────────

function SeriesCard({ series, onDelete, onEpisodeAdded }: {
  series: Series
  onDelete: (id: string) => void
  onEpisodeAdded: (seriesId: string, ep: Episode) => void
}) {
  const [expanded, setExpanded]         = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleting, setDeleting]         = useState(false)

  async function handleDelete() {
    if (!window.confirm(`Delete "${series.title}" and all its episodes? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await fetch(`/api/series/${series.id}`, { method: 'DELETE' })
      onDelete(series.id)
    } catch {
      alert('Failed to delete series.')
      setDeleting(false)
    }
  }

  const episodes = [...(series.episodes ?? [])].sort((a, b) => a.episode_number - b.episode_number)

  return (
    <>
      <Card>
        <CardContent className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-brand-950 border border-brand-800 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 text-brand-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-white truncate">{series.title}</h3>
                <p className="text-xs text-gray-500">{formatDate(series.created_at)}</p>
              </div>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-7 h-7 flex items-center justify-center rounded text-gray-600 hover:text-red-400 hover:bg-red-950/40 transition-colors disabled:opacity-40 shrink-0"
              title="Delete series"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
          </div>

          {series.description && (
            <p className="text-xs text-gray-400 leading-relaxed">{series.description}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {series.niche && <Badge variant="info" className="text-xs">{series.niche}</Badge>}
            <Badge variant="default" className="text-xs text-gray-400">
              {series.episode_count} episode{series.episode_count !== 1 ? 's' : ''}
            </Badge>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-between text-xs text-brand-400 hover:text-brand-300 transition-colors pt-1 border-t border-surface-border"
          >
            <span>{expanded ? 'Hide Episodes' : 'View Episodes'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Episode list */}
          {expanded && (
            <div className="space-y-2 pt-1">
              {episodes.length === 0 && (
                <p className="text-xs text-gray-600 text-center py-4">No episodes yet.</p>
              )}
              {episodes.map(ep => (
                <div
                  key={ep.id}
                  className="flex items-center gap-3 bg-surface rounded-lg border border-surface-border px-3 py-2.5"
                >
                  <span className="w-6 h-6 rounded bg-surface-card border border-surface-border flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                    {ep.episode_number}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{ep.title}</p>
                    <p className="text-xs text-gray-600">{formatDate(ep.created_at)}</p>
                  </div>
                  <Badge variant={STATUS_BADGE[ep.status] ?? 'default'} className="text-xs capitalize shrink-0">
                    {ep.status}
                  </Badge>
                  {ep.video_url && (
                    <a
                      href={ep.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-brand-400 transition-colors shrink-0"
                      title="Play video"
                      onClick={e => e.stopPropagation()}
                    >
                      <Play className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-1"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-3.5 h-3.5" /> Add from Projects
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showAddModal && (
        <AddEpisodeModal
          seriesId={series.id}
          onClose={() => setShowAddModal(false)}
          onAdd={ep => onEpisodeAdded(series.id, ep)}
        />
      )}
    </>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MySeriesPage() {
  const [series, setSeries]             = useState<Series[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [showNewModal, setShowNewModal] = useState(false)

  const loadSeries = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/series')
      if (!res.ok) { const d = await res.json(); setError(typeof d.error === 'string' ? d.error : 'Failed to load series'); return }
      const json = await res.json()
      setSeries(json.series ?? [])
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSeries() }, [loadSeries])

  function handleCreated(s: Series) { setSeries(prev => [s, ...prev]) }
  function handleDeleted(id: string) { setSeries(prev => prev.filter(s => s.id !== id)) }
  function handleEpisodeAdded(seriesId: string, ep: Episode) {
    setSeries(prev => prev.map(s =>
      s.id === seriesId
        ? { ...s, episode_count: s.episode_count + 1, episodes: [...(s.episodes ?? []), ep] }
        : s
    ))
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">My Series</h1>
          <p className="text-gray-400 text-sm">Organise your reels into episodic series</p>
        </div>
        <Button onClick={() => setShowNewModal(true)}>
          <Plus className="w-4 h-4" /> New Series
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
            <p className="text-sm text-red-400">{String(error)}</p>
            <Button variant="secondary" onClick={loadSeries}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && series.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-surface border border-surface-border flex items-center justify-center mb-4">
              <Layers className="w-7 h-7 text-gray-500" />
            </div>
            <h2 className="font-semibold text-lg mb-2">No series yet</h2>
            <p className="text-gray-400 text-sm mb-6 max-w-sm">
              Group your reels into episodic series to build a consistent content schedule.
            </p>
            <Button onClick={() => setShowNewModal(true)}>
              <Plus className="w-4 h-4" /> Create Your First Series
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !error && series.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {series.map(s => (
            <SeriesCard
              key={s.id}
              series={s}
              onDelete={handleDeleted}
              onEpisodeAdded={handleEpisodeAdded}
            />
          ))}
        </div>
      )}

      {showNewModal && (
        <NewSeriesModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreated}
        />
      )}
    </div>
  )
}
