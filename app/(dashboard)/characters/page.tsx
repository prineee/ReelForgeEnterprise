'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  User, Plus, Trash2, Edit2, X, Loader2, AlertCircle, Mic,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Character {
  id: string
  name: string
  age: string | null
  gender: string | null
  appearance: string | null
  personality: string | null
  voice_id: string | null
  style: string | null
  created_at: string
}

interface Voice {
  voice_id: string
  name: string
  gender: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STYLES = ['Realistic', 'Cinematic', 'Anime', 'Cartoon', 'Pixar', 'Disney', 'Ghibli', '3D'] as const
const GENDERS = ['Male', 'Female', 'Non-binary', 'Other'] as const

const STYLE_COLORS: Record<string, string> = {
  Realistic: 'bg-blue-950 border-blue-800 text-blue-300',
  Cinematic: 'bg-purple-950 border-purple-800 text-purple-300',
  Anime:     'bg-pink-950 border-pink-800 text-pink-300',
  Cartoon:   'bg-yellow-950 border-yellow-800 text-yellow-300',
  Pixar:     'bg-orange-950 border-orange-800 text-orange-300',
  Disney:    'bg-brand-950 border-brand-800 text-brand-300',
  Ghibli:    'bg-green-950 border-green-800 text-green-300',
  '3D':      'bg-gray-900 border-gray-700 text-gray-300',
}

// ── Character Form (used for both create and edit) ────────────────────────────

interface CharacterFormData {
  name: string
  age: string
  gender: string
  appearance: string
  personality: string
  voice_id: string
  style: string
}

const EMPTY_FORM: CharacterFormData = {
  name: '', age: '', gender: 'Male', appearance: '', personality: '', voice_id: '', style: 'Realistic',
}

function CharacterPanel({
  initial,
  voices,
  voicesLoading,
  onClose,
  onSave,
}: {
  initial: CharacterFormData & { id?: string }
  voices: Voice[]
  voicesLoading: boolean
  onClose: () => void
  onSave: (data: CharacterFormData, id?: string) => Promise<void>
}) {
  const [form, setForm]     = useState<CharacterFormData>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(k: keyof CharacterFormData, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      await onSave(form, initial.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-surface-card border-l border-surface-border flex flex-col h-full shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-surface-border shrink-0">
          <h2 className="font-bold text-base">{initial.id ? 'Edit Character' : 'New Character'}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="label">Name <span className="text-red-500">*</span></label>
            <input className="input" placeholder="e.g. Detective Sarah Cole" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Age</label>
              <input className="input" placeholder="e.g. 34" value={form.age} onChange={e => set('age', e.target.value)} />
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Appearance</label>
            <textarea
              className="input min-h-[90px] resize-y text-sm"
              placeholder="Tall, athletic build, short dark hair, brown eyes, usually wears a black leather jacket..."
              value={form.appearance}
              onChange={e => set('appearance', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Personality</label>
            <textarea
              className="input min-h-[80px] resize-y text-sm"
              placeholder="Confident, sarcastic, loyal to friends, fears failure..."
              value={form.personality}
              onChange={e => set('personality', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Visual Style</label>
            <div className="grid grid-cols-4 gap-1.5">
              {STYLES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => set('style', s)}
                  className={cn(
                    'py-1.5 rounded-md text-xs font-medium border transition-colors',
                    form.style === s
                      ? 'bg-brand-600 border-brand-500 text-white'
                      : 'border-surface-border text-gray-400 hover:border-brand-700 hover:text-white'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><Mic className="w-3.5 h-3.5 text-brand-400" /> Voice</label>
            <select className="input" value={form.voice_id} onChange={e => set('voice_id', e.target.value)}>
              <option value="">— No voice assigned —</option>
              {voicesLoading && <option disabled>Loading voices…</option>}
              {voices.map(v => (
                <option key={v.voice_id} value={v.voice_id}>{v.name} ({v.gender})</option>
              ))}
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {String(error)}
            </div>
          )}
        </form>

        <div className="px-6 py-4 border-t border-surface-border shrink-0 flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSubmit as unknown as React.MouseEventHandler} disabled={saving || !form.name.trim()} className="flex-1">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : (initial.id ? 'Save Changes' : 'Create Character')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Character Card ─────────────────────────────────────────────────────────────

function CharacterCard({ character, voiceName, onEdit, onDelete }: {
  character: Character
  voiceName: string
  onEdit: () => void
  onDelete: () => void
}) {
  const style     = character.style ?? 'Realistic'
  const styleClass = STYLE_COLORS[style] ?? 'bg-surface border-surface-border text-gray-400'

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full bg-brand-950 border border-brand-800 flex items-center justify-center shrink-0 text-brand-300 font-bold text-sm">
              {character.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm text-white truncate">{character.name}</h3>
              <p className="text-xs text-gray-500">{formatDate(character.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-brand-400 hover:bg-brand-950/40 transition-colors" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:text-red-400 hover:bg-red-950/40 transition-colors" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {character.age && <Badge variant="default" className="text-xs">{character.age}y</Badge>}
          {character.gender && <Badge variant="default" className="text-xs capitalize">{character.gender}</Badge>}
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium', styleClass)}>{style}</span>
        </div>

        {character.appearance && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-0.5">Appearance</p>
            <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{character.appearance}</p>
          </div>
        )}

        {character.personality && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-0.5">Personality</p>
            <p className="text-xs text-gray-300 leading-relaxed line-clamp-2">{character.personality}</p>
          </div>
        )}

        {voiceName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-1 border-t border-surface-border">
            <Mic className="w-3 h-3 text-brand-400" />
            <span>{voiceName}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function CharactersPage() {
  const [characters, setCharacters]   = useState<Character[]>([])
  const [voices, setVoices]           = useState<Voice[]>([])
  const [loading, setLoading]         = useState(true)
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [error, setError]             = useState('')
  const [showPanel, setShowPanel]     = useState(false)
  const [editing, setEditing]         = useState<Character | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res  = await fetch('/api/characters')
      if (!res.ok) { const d = await res.json(); setError(typeof d.error === 'string' ? d.error : 'Failed to load'); return }
      const json = await res.json()
      setCharacters(json.characters ?? [])
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [])

  async function loadVoices() {
    if (voices.length > 0) return
    setVoicesLoading(true)
    try {
      const res  = await fetch('/api/reel/voices')
      if (res.ok) {
        const json = await res.json()
        setVoices((json.voices ?? []) as Voice[])
      }
    } catch { /* ignore */ }
    finally { setVoicesLoading(false) }
  }

  useEffect(() => { load() }, [load])

  function openCreate() { setEditing(null); loadVoices(); setShowPanel(true) }
  function openEdit(c: Character) { setEditing(c); loadVoices(); setShowPanel(true) }

  async function handleSave(data: CharacterFormData, id?: string) {
    if (id) {
      const res  = await fetch(`/api/characters/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Update failed')
      setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...json.character } : c))
    } else {
      const res  = await fetch('/api/characters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Create failed')
      setCharacters(prev => [json.character as Character, ...prev])
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete character "${name}"? This cannot be undone.`)) return
    setCharacters(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/characters/${id}`, { method: 'DELETE' })
  }

  const voiceMap = Object.fromEntries(voices.map(v => [v.voice_id, v.name]))

  const panelInitial: CharacterFormData & { id?: string } = editing
    ? { id: editing.id, name: editing.name, age: editing.age ?? '', gender: editing.gender ?? 'Male', appearance: editing.appearance ?? '', personality: editing.personality ?? '', voice_id: editing.voice_id ?? '', style: editing.style ?? 'Realistic' }
    : { ...EMPTY_FORM }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Character Studio</h1>
          <p className="text-gray-400 text-sm">Build reusable characters with consistent appearance across all productions</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> New Character</Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      )}

      {!loading && error && (
        <Card><CardContent className="py-10 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm text-red-400">{String(error)}</p>
          <Button variant="secondary" onClick={load}>Retry</Button>
        </CardContent></Card>
      )}

      {!loading && !error && characters.length === 0 && (
        <Card><CardContent className="flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-surface border border-surface-border flex items-center justify-center mb-4">
            <User className="w-7 h-7 text-gray-500" />
          </div>
          <h2 className="font-semibold text-lg mb-2">No characters yet</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-sm">
            Build reusable characters with consistent appearance, personality, and voice across all your movies and series.
          </p>
          <Button onClick={openCreate}><Plus className="w-4 h-4" /> Create Your First Character</Button>
        </CardContent></Card>
      )}

      {!loading && !error && characters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {characters.map(c => (
            <CharacterCard
              key={c.id}
              character={c}
              voiceName={c.voice_id ? (voiceMap[c.voice_id] ?? '') : ''}
              onEdit={() => openEdit(c)}
              onDelete={() => handleDelete(c.id, c.name)}
            />
          ))}
        </div>
      )}

      {showPanel && (
        <CharacterPanel
          initial={panelInitial}
          voices={voices}
          voicesLoading={voicesLoading}
          onClose={() => setShowPanel(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
