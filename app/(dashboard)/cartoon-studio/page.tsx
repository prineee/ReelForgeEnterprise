// FILE: app/(dashboard)/cartoon-studio/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MODE_MULTIPLIER,
  type Genre,
  type VisualStyle,
  type MovieMode,
  type GenerateStoryResponse,
  type GeneratedScene,
  type GeneratedCharacter,
} from '@/lib/cartoon/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const GENRES: { value: Genre; label: string; emoji: string }[] = [
  { value: 'adventure',  label: 'Adventure',  emoji: '⚔️' },
  { value: 'comedy',     label: 'Comedy',     emoji: '😄' },
  { value: 'drama',      label: 'Drama',      emoji: '🎭' },
  { value: 'horror',     label: 'Horror',     emoji: '👻' },
  { value: 'romance',    label: 'Romance',    emoji: '❤️' },
  { value: 'sci_fi',     label: 'Sci-Fi',     emoji: '🚀' },
  { value: 'fantasy',    label: 'Fantasy',    emoji: '🧙' },
  { value: 'thriller',   label: 'Thriller',   emoji: '🔪' },
]

const STYLES: { value: VisualStyle; label: string; description: string }[] = [
  { value: 'anime',      label: 'Anime',      description: 'Studio Ghibli inspired' },
  { value: 'cartoon',    label: 'Cartoon',    description: 'Bold colors and outlines' },
  { value: 'comic_book', label: 'Comic Book', description: 'Marvel/DC style' },
  { value: 'watercolor', label: 'Watercolor', description: 'Artistic and soft' },
  { value: 'pixel_art',  label: 'Pixel Art',  description: '8-bit retro' },
  { value: 'clay',       label: 'Claymation', description: '3D clay figures' },
  { value: 'cinematic',  label: 'Cinematic',  description: 'Photorealistic' },
  { value: 'sketch',     label: 'Sketch',     description: 'Pencil illustration' },
]

const DURATIONS: { mins: number; scenes: number; credits: number; label: string }[] = [
  { mins: 1,  scenes: 10,  credits: 32,  label: '1 min'  },
  { mins: 3,  scenes: 30,  credits: 65,  label: '3 min'  },
  { mins: 5,  scenes: 50,  credits: 90,  label: '5 min'  },
  { mins: 10, scenes: 100, credits: 150, label: '10 min' },
]

const MOVIE_MODES: { value: MovieMode; label: string; description: string; badge?: string }[] = [
  { value: 'standard',          label: 'Standard',          description: 'Cinematic narration with AI voiceover' },
  { value: 'dialogue',          label: 'AI Dialogue',       description: 'Characters speak in their own voices', badge: '2x credits' },
  { value: 'talking_character', label: 'Talking Character', description: 'Lip-synced character host', badge: 'Coming soon' },
]

// ── Component ─────────────────────────────────────────────────────────────────
export default function CartoonStudioPage() {
  const router = useRouter()

  // Form state
  const [prompt,   setPrompt]   = useState('')
  const [genre,    setGenre]    = useState<Genre>('adventure')
  const [style,    setStyle]    = useState<VisualStyle>('anime')
  const [duration, setDuration] = useState(DURATIONS[0])
  const [voiceId,  setVoiceId]  = useState('tara')
  const [movieMode, setMovieMode] = useState<MovieMode>('standard')

  // Generation state
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [story,    setStory]    = useState<GenerateStoryResponse | null>(null)

  async function handleGenerate() {
    if (!prompt.trim()) { setError('Please enter a story idea'); return }
    setLoading(true)
    setError('')
    setStory(null)

    try {
      const res = await fetch('/api/cartoon/generate-story', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          prompt:           prompt.trim(),
          genre,
          visual_style:     style,
          duration_minutes: duration.mins,
          voice_id:         voiceId,
          movie_mode:       movieMode,
        }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Generation failed'); return }

      setStory(data as GenerateStoryResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  function handleViewStory() {
    if (story?.story_id) router.push(`/cartoon-studio/${story.story_id}`)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>🎬 Cartoon Story Studio</h1>
        <p style={{ color: '#94a3b8', marginTop: 8, fontSize: 15 }}>
          Enter a story idea → AI generates characters, storyboard, and cartoon video
        </p>
      </div>

      {!story ? (
        // ── Input Form ──────────────────────────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Prompt */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#cbd5e1' }}>
              Story Idea *
            </label>
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder='e.g. "Alien Revenge", "A cat who becomes a detective", "Robot falls in love"'
              style={{
                width: '100%', padding: '12px 16px', fontSize: 16,
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: 8, color: '#fff', outline: 'none', boxSizing: 'border-box',
              }}
              onKeyDown={e => e.key === 'Enter' && !loading && handleGenerate()}
            />
          </div>

          {/* Genre */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#cbd5e1' }}>
              Genre
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {GENRES.map(g => (
                <button
                  key={g.value}
                  onClick={() => setGenre(g.value)}
                  style={{
                    padding: '8px 16px', borderRadius: 20, fontSize: 14, cursor: 'pointer',
                    background: genre === g.value ? '#7c3aed' : '#1e293b',
                    border: `1px solid ${genre === g.value ? '#7c3aed' : '#334155'}`,
                    color: '#fff', transition: 'all 0.15s',
                  }}
                >
                  {g.emoji} {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Style */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#cbd5e1' }}>
              Visual Style
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {STYLES.map(s => (
                <button
                  key={s.value}
                  onClick={() => setStyle(s.value)}
                  style={{
                    padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: style === s.value ? '#1e1b4b' : '#1e293b',
                    border: `1px solid ${style === s.value ? '#7c3aed' : '#334155'}`,
                    color: '#fff', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{s.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Movie Mode */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#cbd5e1' }}>
              Movie Mode
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {MOVIE_MODES.map(m => (
                <button
                  key={m.value}
                  onClick={() => setMovieMode(m.value)}
                  style={{
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    minWidth: 160,
                    background: movieMode === m.value ? '#1e1b4b' : '#1e293b',
                    border: `1px solid ${movieMode === m.value ? '#7c3aed' : '#334155'}`,
                    color: '#fff', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{m.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{m.description}</div>
                  {m.badge && (
                    <div style={{ fontSize: 10, color: '#4ade80', marginTop: 4 }}>{m.badge}</div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, marginBottom: 8, color: '#cbd5e1' }}>
              Duration
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DURATIONS.map(d => (
                <button
                  key={d.mins}
                  onClick={() => setDuration(d)}
                  style={{
                    padding: '10px 20px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                    background: duration.mins === d.mins ? '#1e1b4b' : '#1e293b',
                    border: `1px solid ${duration.mins === d.mins ? '#7c3aed' : '#334155'}`,
                    color: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{d.label}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>
                    {d.scenes} scenes · {d.credits * MODE_MULTIPLIER[movieMode]}cr
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
              color: '#fca5a5', fontSize: 14,
            }}>
              {error}
            </div>
          )}

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            style={{
              padding: '14px 32px', borderRadius: 8, fontSize: 16, fontWeight: 700,
              background: loading || !prompt.trim() ? '#374151' : 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              color: '#fff', border: 'none', cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>
                Generating {duration.scenes}-scene storyboard...
              </>
            ) : (
              `✨ Generate ${duration.scenes}-Scene Story`
            )}
          </button>
        </div>
      ) : (
        // ── Storyboard Result ────────────────────────────────────────────────
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Story Header */}
          <div style={{ background: '#1e293b', borderRadius: 12, padding: 24 }}>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>{story.title}</h2>
            <p style={{ color: '#94a3b8', margin: '0 0 16px', lineHeight: 1.6 }}>{story.storyline}</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ padding: '4px 12px', background: '#7c3aed', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                {story.genre}
              </span>
              <span style={{ padding: '4px 12px', background: '#1e1b4b', border: '1px solid #4f46e5', borderRadius: 20, fontSize: 12 }}>
                {story.visual_style}
              </span>
              <span style={{ padding: '4px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 20, fontSize: 12, color: '#94a3b8' }}>
                {story.scene_count} scenes
              </span>
            </div>
          </div>

          {/* Characters */}
          {story.characters.length > 0 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>👥 Characters</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {story.characters.map((char: GeneratedCharacter, i: number) => (
                  <div key={i} style={{
                    background: '#1e293b', border: '1px solid #334155',
                    borderRadius: 8, padding: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 20 }}>
                        {char.role === 'main' ? '⭐' : char.role === 'villain' ? '😈' : '👤'}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{char.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{char.role}</div>
                      </div>
                    </div>
                    <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                      {char.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scenes Preview */}
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              🎬 Storyboard ({story.scenes.length} scenes)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {story.scenes.slice(0, 5).map((scene: GeneratedScene) => (
                <div key={scene.number} style={{
                  background: '#1e293b', border: '1px solid #334155',
                  borderRadius: 8, padding: '12px 16px',
                  display: 'flex', gap: 16, alignItems: 'flex-start',
                }}>
                  <div style={{
                    minWidth: 32, height: 32, background: '#7c3aed',
                    borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 700, fontSize: 13,
                  }}>
                    {scene.number}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{scene.title}</div>
                    <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 8px', lineHeight: 1.5 }}>
                      {scene.narration.slice(0, 120)}{scene.narration.length > 120 ? '...' : ''}
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {scene.visualKeywords.map((kw, ki) => (
                        <span key={ki} style={{
                          padding: '2px 8px', background: '#0f172a',
                          border: '1px solid #334155', borderRadius: 12,
                          fontSize: 10, color: '#94a3b8',
                        }}>
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>
                    {scene.duration_seconds}s
                  </div>
                </div>
              ))}
              {story.scenes.length > 5 && (
                <div style={{ textAlign: 'center', color: '#64748b', fontSize: 13, padding: '8px 0' }}>
                  + {story.scenes.length - 5} more scenes
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleViewStory}
              style={{
                flex: 1, padding: '14px 24px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              🎨 View Full Storyboard & Generate Images →
            </button>
            <button
              onClick={() => { setStory(null); setPrompt('') }}
              style={{
                padding: '14px 24px', borderRadius: 8, fontSize: 15,
                background: '#1e293b', border: '1px solid #334155',
                color: '#fff', cursor: 'pointer',
              }}
            >
              Start Over
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
