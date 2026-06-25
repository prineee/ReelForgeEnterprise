'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  LayoutGrid, Plus, Trash2, X, Loader2, Play, Download,
  ChevronLeft, FolderOpen, Film,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Clip {
  id: string
  video_url: string
  title: string
  source: 'Cinema Studio' | 'Create Reel' | 'Movie Studio' | 'Marketing Studio' | 'Custom'
  duration?: number
  added_at: string
}

interface Board {
  id: string
  title: string
  clips: Clip[]
  created_at: string
}

interface Project {
  id: string
  title: string
  status: string
  video_url?: string | null
}

const STORAGE_KEY = 'reelforge_canvas_boards'

function loadBoards(): Board[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as Board[] : []
  } catch { return [] }
}

function saveBoards(boards: Board[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(boards)) } catch { /* ignore */ }
}

// ── Add Clip Modal ─────────────────────────────────────────────────────────────

function AddClipModal({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (clip: Clip) => void
}) {
  const [tab, setTab]           = useState<'projects' | 'url'>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)
  const [customUrl, setCustomUrl] = useState('')
  const [customTitle, setCustomTitle] = useState('')

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(j => {
      setProjects((j.projects ?? []).filter((p: Project) => p.video_url))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  function addProject(p: Project) {
    onAdd({
      id:       crypto.randomUUID(),
      video_url: p.video_url!,
      title:    p.title,
      source:   'Create Reel',
      added_at: new Date().toISOString(),
    })
    onClose()
  }

  function addCustom() {
    if (!customUrl.trim()) return
    onAdd({
      id:       crypto.randomUUID(),
      video_url: customUrl.trim(),
      title:    customTitle.trim() || 'Custom Clip',
      source:   'Custom',
      added_at: new Date().toISOString(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-surface-card border border-surface-border rounded-2xl shadow-2xl max-h-[75vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border shrink-0">
          <h3 className="font-bold text-sm">Add Clip</h3>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-1 p-3 border-b border-surface-border shrink-0">
          {(['projects', 'url'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={cn(
              'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all capitalize',
              tab === t ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
            )}>{t === 'url' ? 'Paste URL' : 'From Projects'}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'projects' && (
            <div className="space-y-2">
              {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>}
              {!loading && projects.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No projects with video URLs found.</p>
              )}
              {projects.map(p => (
                <button key={p.id} onClick={() => addProject(p)}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-surface-border hover:border-brand-700/50 bg-surface transition-all">
                  <Film className="w-5 h-5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.title}</p>
                    <p className="text-xs text-gray-500 truncate">{p.video_url}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {tab === 'url' && (
            <div className="space-y-3">
              <div>
                <label className="label">Video URL</label>
                <input className="input text-sm" placeholder="https://res.cloudinary.com/…/video.mp4" value={customUrl} onChange={e => setCustomUrl(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">Title</label>
                <input className="input text-sm" placeholder="My clip" value={customTitle} onChange={e => setCustomTitle(e.target.value)} />
              </div>
              <Button onClick={addCustom} disabled={!customUrl.trim()} className="w-full">Add Clip</Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Board View ────────────────────────────────────────────────────────────────

function BoardView({ board, onBack, onUpdate }: {
  board: Board
  onBack: () => void
  onUpdate: (b: Board) => void
}) {
  const [showAddModal, setShowAddModal] = useState(false)

  function removeClip(id: string) {
    onUpdate({ ...board, clips: board.clips.filter(c => c.id !== id) })
  }

  function addClip(clip: Clip) {
    onUpdate({ ...board, clips: [...board.clips, clip] })
  }

  function exportStoryboard() {
    const data = board.clips.map((c, i) => ({
      order: i + 1, title: c.title, source: c.source, video_url: c.video_url, added_at: c.added_at,
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url; a.download = `${board.title}-storyboard.json`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={onBack}><ChevronLeft className="w-3.5 h-3.5" /> Boards</Button>
          <div>
            <h2 className="font-bold text-lg">{board.title}</h2>
            <p className="text-xs text-gray-500">{board.clips.length} clip{board.clips.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={exportStoryboard}><Download className="w-3.5 h-3.5" /> Export JSON</Button>
          <Button size="sm" onClick={() => setShowAddModal(true)}><Plus className="w-3.5 h-3.5" /> Add Clip</Button>
        </div>
      </div>

      {board.clips.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-14 text-center gap-3">
          <Film className="w-8 h-8 text-gray-600" />
          <p className="font-medium text-gray-400">No clips yet</p>
          <Button size="sm" onClick={() => setShowAddModal(true)}><Plus className="w-3.5 h-3.5" /> Add First Clip</Button>
        </CardContent></Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {board.clips.map((clip, i) => (
            <div key={clip.id} className="w-52 shrink-0 bg-surface-card border border-surface-border rounded-xl overflow-hidden">
              <div className="relative aspect-[9/16] bg-black max-h-44 overflow-hidden">
                <video src={clip.video_url} className="w-full h-full object-cover" />
                <div className="absolute top-2 left-2 w-6 h-6 rounded-md bg-black/70 flex items-center justify-center text-xs font-bold text-white">{i + 1}</div>
                <a href={clip.video_url} target="_blank" rel="noreferrer"
                  className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
                  <Play className="w-8 h-8 text-white" />
                </a>
              </div>
              <div className="p-3 space-y-2">
                <p className="text-xs font-medium text-white truncate">{clip.title}</p>
                <Badge variant="default" className="text-xs">{clip.source}</Badge>
                <button onClick={() => removeClip(clip.id)} className="flex items-center gap-1 text-xs text-gray-600 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddClipModal onClose={() => setShowAddModal(false)} onAdd={addClip} />
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CanvasPage() {
  const [boards, setBoards]         = useState<Board[]>([])
  const [activeBoard, setActiveBoard] = useState<Board | null>(null)
  const [newTitle, setNewTitle]     = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { setBoards(loadBoards()) }, [])

  const persistBoards = useCallback((updated: Board[]) => {
    setBoards(updated); saveBoards(updated)
  }, [])

  function createBoard() {
    if (!newTitle.trim()) return
    const board: Board = { id: crypto.randomUUID(), title: newTitle.trim(), clips: [], created_at: new Date().toISOString() }
    persistBoards([board, ...boards])
    setNewTitle(''); setShowCreate(false); setActiveBoard(board)
  }

  function deleteBoard(id: string) {
    if (!window.confirm('Delete this board?')) return
    const updated = boards.filter(b => b.id !== id)
    persistBoards(updated)
    if (activeBoard?.id === id) setActiveBoard(null)
  }

  function updateBoard(updated: Board) {
    const next = boards.map(b => b.id === updated.id ? updated : b)
    persistBoards(next)
    setActiveBoard(updated)
  }

  if (activeBoard) {
    return (
      <div className="max-w-6xl">
        <BoardView
          board={boards.find(b => b.id === activeBoard.id) ?? activeBoard}
          onBack={() => setActiveBoard(null)}
          onUpdate={updateBoard}
        />
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Canvas</h1>
          <p className="text-gray-400 text-sm">Organise your clips into storyboards</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> New Board</Button>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="pt-4 flex gap-3">
            <input
              className="input flex-1"
              placeholder="Board title…"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createBoard()}
              autoFocus
            />
            <Button onClick={createBoard} disabled={!newTitle.trim()}>Create</Button>
            <Button variant="secondary" onClick={() => setShowCreate(false)}><X className="w-4 h-4" /></Button>
          </CardContent>
        </Card>
      )}

      {boards.length === 0 && !showCreate && (
        <Card><CardContent className="flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-surface border border-surface-border flex items-center justify-center mb-4">
            <LayoutGrid className="w-7 h-7 text-gray-500" />
          </div>
          <h2 className="font-semibold text-lg mb-2">No boards yet</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-sm">Create a board to organise your generated clips into a storyboard or project flow.</p>
          <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create Your First Board</Button>
        </CardContent></Card>
      )}

      {boards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boards.map(b => (
            <Card key={b.id} hover onClick={() => setActiveBoard(b)}>
              <CardContent className="space-y-3">
                {/* Thumbnail grid */}
                {b.clips.length > 0 ? (
                  <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden aspect-video bg-black">
                    {b.clips.slice(0, 4).map((c, i) => (
                      <div key={i} className="bg-black overflow-hidden">
                        <video src={c.video_url} className="w-full h-full object-cover" />
                      </div>
                    ))}
                    {b.clips.length < 4 && Array.from({ length: 4 - b.clips.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="bg-surface flex items-center justify-center">
                        <Film className="w-4 h-4 text-gray-700" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="aspect-video bg-surface rounded-xl flex items-center justify-center border border-surface-border">
                    <FolderOpen className="w-8 h-8 text-gray-600" />
                  </div>
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm text-white">{b.title}</h3>
                    <p className="text-xs text-gray-500">{b.clips.length} clip{b.clips.length !== 1 ? 's' : ''} · {formatDate(b.created_at)}</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); deleteBoard(b.id) }}
                    className="w-7 h-7 flex items-center justify-center rounded text-gray-600 hover:text-red-400 hover:bg-red-950/40 transition-colors shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
