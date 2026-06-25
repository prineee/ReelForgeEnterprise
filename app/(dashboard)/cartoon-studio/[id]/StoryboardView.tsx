'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

interface DialogueLine {
  speaker: string
  text: string
}

interface StoryScene {
  id: string
  scene_number: number
  title: string | null
  narration: string
  visual_keywords: string[]
  image_url: string | null
  image_status: 'pending' | 'generating' | 'completed' | 'failed'
  duration_seconds: number
  dialogue_json: DialogueLine[] | null
}

interface StoryCharacter {
  id: string
  name: string
  role: string
  description: string
}

interface Story {
  id: string
  title: string
  storyline: string | null
  genre: string
  visual_style: string
  status: string
  scene_count: number
  video_url: string | null
  voice_map: Record<string, string> | null
  movie_mode: string | null
}

interface Props {
  story: Story
  characters: StoryCharacter[]
  scenes: StoryScene[]
}

type MovieMode = 'standard' | 'dialogue' | 'talking_character'

const STATUS_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  completed:         { bg: '#14532d', border: '#22c55e', color: '#86efac' },
  images_ready:      { bg: '#1e3a5f', border: '#3b82f6', color: '#93c5fd' },
  generating_images: { bg: '#312e81', border: '#6366f1', color: '#a5b4fc' },
  failed:            { bg: '#450a0a', border: '#ef4444', color: '#fca5a5' },
  draft:             { bg: '#1e293b', border: '#334155', color: '#94a3b8' },
}

export function StoryboardView({ story, characters, scenes: initialScenes }: Props) {
  const [scenes, setScenes]         = useState<StoryScene[]>(initialScenes)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress]     = useState({ pct: 0, message: '' })
  const [error, setError]           = useState('')

  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false)
  const [videoProgress, setVideoProgress]         = useState({ pct: 0, message: '' })
  const [videoError, setVideoError]               = useState('')
  const [videoUrl, setVideoUrl]                   = useState<string | null>(story.video_url)

  const [movieMode, setMovieMode]         = useState<MovieMode>(
    (story.movie_mode as MovieMode) || 'standard'
  )
  const [isWritingDialogue, setIsWritingDialogue] = useState(false)
  const [dialogueError, setDialogueError]         = useState('')

  const pendingCount   = scenes.filter(s => s.image_status !== 'completed').length
  const allDone        = pendingCount === 0
  const dialogueWritten = scenes.some(s => Array.isArray(s.dialogue_json) && s.dialogue_json.length > 0)
  const st             = STATUS_STYLE[story.status] ?? STATUS_STYLE.draft

  // ── Shared SSE video reader ────────────────────────────────────────────────
  const streamVideoSSE = useCallback(async (endpoint: string, body: object) => {
    setIsGeneratingVideo(true)
    setVideoError('')
    setVideoProgress({ pct: 0, message: 'Starting...' })

    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}))
        setVideoError((json as { error?: string }).error ?? `HTTP ${res.status}`)
        setIsGeneratingVideo(false)
        return
      }

      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let buf      = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6)) as Record<string, unknown>
            if (evt.type === 'start') {
              setVideoProgress({ pct: 0, message: `Processing ${evt.total_scenes as number} scenes...` })
            } else if (evt.type === 'progress') {
              setVideoProgress({ pct: (evt.pct as number) ?? 0, message: (evt.message as string) ?? '' })
            } else if (evt.type === 'done') {
              setVideoUrl(evt.video_url as string)
              setVideoProgress({ pct: 100, message: 'Movie ready!' })
              setIsGeneratingVideo(false)
            } else if (evt.type === 'error') {
              setVideoError((evt.error as string) ?? 'Video generation failed')
              setIsGeneratingVideo(false)
            }
          } catch {}
        }
      }
      setIsGeneratingVideo(false)
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'Video generation failed')
      setIsGeneratingVideo(false)
    }
  }, [])

  // ── Generate scene images ──────────────────────────────────────────────────
  const handleGenerateImages = useCallback(async () => {
    setGenerating(true)
    setError('')
    setProgress({ pct: 0, message: 'Connecting...' })

    try {
      const res = await fetch('/api/cartoon/generate-images', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ story_id: story.id }),
      })

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}))
        setError((json as { error?: string }).error ?? `HTTP ${res.status}`)
        setGenerating(false)
        return
      }

      const reader = res.body.getReader()
      const dec    = new TextDecoder()
      let buf      = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6)) as Record<string, unknown>
            if (evt.type === 'start') {
              setProgress({ pct: 0, message: `Generating ${evt.total as number} scene images...` })
            } else if (evt.type === 'progress') {
              setProgress({ pct: (evt.pct as number) ?? 0, message: (evt.message as string) ?? '' })
            } else if (evt.type === 'scene_done') {
              setScenes(prev => prev.map(s =>
                s.scene_number === evt.scene_number
                  ? { ...s, image_url: evt.image_url as string, image_status: 'completed' }
                  : s
              ))
              setProgress(p => ({ ...p, pct: (evt.pct as number) ?? p.pct }))
            } else if (evt.type === 'scene_failed') {
              setScenes(prev => prev.map(s =>
                s.scene_number === evt.scene_number ? { ...s, image_status: 'failed' } : s
              ))
            } else if (evt.type === 'done') {
              setGenerating(false)
              setProgress({ pct: 100, message: `Complete — ${evt.completed as number}/${evt.total as number} images generated` })
            } else if (evt.type === 'error') {
              setError((evt.error as string) ?? 'Generation failed')
              setGenerating(false)
            }
          } catch {}
        }
      }
      setGenerating(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setGenerating(false)
    }
  }, [story.id])

  // ── Standard video generation ──────────────────────────────────────────────
  const handleGenerateVideo = useCallback(() =>
    streamVideoSSE('/api/cartoon/generate-video', { story_id: story.id }),
  [story.id, streamVideoSSE])

  // ── AI Dialogue — write dialogue ───────────────────────────────────────────
  const handleWriteDialogue = useCallback(async () => {
    setIsWritingDialogue(true)
    setDialogueError('')

    try {
      const res = await fetch('/api/cartoon/write-dialogue', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ story_id: story.id }),
      })

      const json = await res.json()

      if (!res.ok) {
        setDialogueError((json as { error?: string }).error ?? `HTTP ${res.status}`)
        setIsWritingDialogue(false)
        return
      }

      // Merge dialogue_json back into scenes state
      const genMap = new Map(
        ((json as { scenes: { scene_number: number; dialogue: DialogueLine[] }[] }).scenes ?? [])
          .map(s => [s.scene_number, s.dialogue])
      )
      setScenes(prev => prev.map(s => ({
        ...s,
        dialogue_json: genMap.get(s.scene_number) ?? s.dialogue_json,
      })))

    } catch (err) {
      setDialogueError(err instanceof Error ? err.message : 'Write dialogue failed')
    } finally {
      setIsWritingDialogue(false)
    }
  }, [story.id])

  // ── AI Dialogue — generate dialogue video ─────────────────────────────────
  const handleGenerateDialogueVideo = useCallback(() =>
    streamVideoSSE('/api/cartoon/generate-dialogue-video', { story_id: story.id }),
  [story.id, streamVideoSSE])

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px', color: '#fff' }}>

      {/* Back + Header */}
      <div style={{ marginBottom: 24 }}>
        <Link href="/cartoon-studio" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>
          ← Back to Cartoon Studio
        </Link>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '10px 0 8px' }}>{story.title}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ padding: '3px 10px', background: '#7c3aed', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
            {story.genre}
          </span>
          <span style={{ padding: '3px 10px', background: '#1e1b4b', border: '1px solid #4f46e5', borderRadius: 20, fontSize: 12 }}>
            {story.visual_style}
          </span>
          <span style={{ padding: '3px 10px', background: '#0f172a', border: '1px solid #334155', borderRadius: 20, fontSize: 12, color: '#94a3b8' }}>
            {story.scene_count} scenes
          </span>
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: st.bg, border: `1px solid ${st.border}`, color: st.color,
          }}>
            {story.status.replace(/_/g, ' ')}
          </span>
        </div>
        {story.storyline && (
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{story.storyline}</p>
        )}
      </div>

      {/* Characters */}
      {characters.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: '#cbd5e1' }}>Characters</h3>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {characters.map(c => (
              <div key={c.id} style={{
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 10,
              }}>
                <span style={{ fontSize: 16 }}>
                  {c.role === 'main' ? '⭐' : c.role === 'villain' ? '😈' : '👤'}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'capitalize' }}>{c.role}</div>
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 2, maxWidth: 180 }}>
                    {c.description?.slice(0, 80)}{(c.description?.length ?? 0) > 80 ? '...' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate Images CTA */}
      {!allDone && !story.video_url && (
        <div style={{ marginBottom: 24 }}>
          {!generating ? (
            <button
              onClick={handleGenerateImages}
              style={{
                padding: '12px 28px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                color: '#fff', border: 'none', cursor: 'pointer',
              }}
            >
              🎨 Generate Scene Images ({pendingCount} remaining)
            </button>
          ) : (
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 16 }}>⏳</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Generating images...</span>
                <span style={{ marginLeft: 'auto', fontSize: 13, color: '#7c3aed', fontWeight: 700 }}>
                  {progress.pct}%
                </span>
              </div>
              <div style={{ height: 5, background: '#0f172a', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${progress.pct}%`,
                  background: 'linear-gradient(90deg,#7c3aed,#4f46e5)',
                  transition: 'width 0.4s ease', borderRadius: 3,
                }} />
              </div>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 0' }}>{progress.message}</p>
            </div>
          )}
          {error && (
            <div style={{
              marginTop: 10, padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* Completion banner + mode selector + video actions */}
      {allDone && (
        <>
          <div style={{
            marginBottom: 16, padding: '12px 16px', borderRadius: 8,
            background: '#14532d', border: '1px solid #22c55e', color: '#86efac', fontSize: 14,
          }}>
            ✓ All {scenes.length} scene images generated.
            {progress.message && <span style={{ color: '#4ade80', marginLeft: 8 }}>{progress.message}</span>}
          </div>

          {!videoUrl && (
            <div style={{ marginBottom: 28 }}>
              {/* Mode selector */}
              {!isGeneratingVideo && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>Choose your movie type:</p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <ModeCard
                      selected={movieMode === 'standard'}
                      onSelect={() => setMovieMode('standard')}
                      title="Standard Movie"
                      description="Cinematic narration with AI voiceover"
                      credits={10}
                      color="#0891b2"
                    />
                    <ModeCard
                      selected={movieMode === 'dialogue'}
                      onSelect={() => setMovieMode('dialogue')}
                      title="AI Dialogue Movie"
                      description="Characters speak in their own voices"
                      credits={dialogueWritten ? 10 : 25}
                      badge={dialogueWritten ? 'Dialogue ready' : '15 write + 10 render'}
                      color="#7c3aed"
                    />
                  </div>
                </div>
              )}

              {/* Standard Movie action */}
              {movieMode === 'standard' && !isGeneratingVideo && (
                <button
                  onClick={handleGenerateVideo}
                  style={{
                    padding: '12px 28px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                    background: 'linear-gradient(135deg,#0f766e,#0891b2)',
                    color: '#fff', border: 'none', cursor: 'pointer',
                  }}
                >
                  🎬 Generate Standard Movie (10 credits)
                </button>
              )}

              {/* Talking Character — placeholder, not implemented yet */}
              {movieMode === 'talking_character' && !isGeneratingVideo && (
                <div style={{
                  padding: '12px 16px', borderRadius: 8,
                  background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)',
                  color: '#c4b5fd', fontSize: 13,
                }}>
                  🚧 Talking Character mode is coming soon — rendering isn&apos;t available yet for this movie.
                </div>
              )}

              {/* AI Dialogue Movie actions */}
              {movieMode === 'dialogue' && !isGeneratingVideo && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {!dialogueWritten ? (
                    <button
                      onClick={handleWriteDialogue}
                      disabled={isWritingDialogue}
                      style={{
                        padding: '12px 28px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                        background: isWritingDialogue
                          ? '#374151'
                          : 'linear-gradient(135deg,#6d28d9,#7c3aed)',
                        color: '#fff', border: 'none',
                        cursor: isWritingDialogue ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isWritingDialogue ? '✍️ Writing dialogue...' : '✍️ Write Dialogue (15 credits)'}
                    </button>
                  ) : (
                    <button
                      onClick={handleGenerateDialogueVideo}
                      style={{
                        padding: '12px 28px', borderRadius: 8, fontSize: 15, fontWeight: 700,
                        background: 'linear-gradient(135deg,#6d28d9,#7c3aed)',
                        color: '#fff', border: 'none', cursor: 'pointer',
                      }}
                    >
                      🎬 Generate Dialogue Movie (10 credits)
                    </button>
                  )}
                  {dialogueWritten && (
                    <button
                      onClick={handleWriteDialogue}
                      disabled={isWritingDialogue}
                      style={{
                        padding: '10px 18px', borderRadius: 8, fontSize: 13,
                        background: 'transparent', border: '1px solid #6d28d9',
                        color: '#a78bfa', cursor: isWritingDialogue ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isWritingDialogue ? 'Rewriting...' : '↺ Rewrite Dialogue (15 credits)'}
                    </button>
                  )}
                </div>
              )}

              {/* Dialogue error */}
              {dialogueError && (
                <div style={{
                  marginTop: 10, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5', fontSize: 13,
                }}>
                  {dialogueError}
                </div>
              )}

              {/* Video generation progress */}
              {isGeneratingVideo && (
                <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>🎬</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Assembling movie...</span>
                    <span style={{
                      marginLeft: 'auto', fontSize: 13, fontWeight: 700,
                      color: movieMode === 'dialogue' ? '#a78bfa' : '#0891b2',
                    }}>
                      {videoProgress.pct}%
                    </span>
                  </div>
                  <div style={{ height: 5, background: '#0f172a', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${videoProgress.pct}%`,
                      background: movieMode === 'dialogue'
                        ? 'linear-gradient(90deg,#6d28d9,#7c3aed)'
                        : 'linear-gradient(90deg,#0f766e,#0891b2)',
                      transition: 'width 0.4s ease', borderRadius: 3,
                    }} />
                  </div>
                  <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0 0' }}>{videoProgress.message}</p>
                </div>
              )}

              {videoError && (
                <div style={{
                  marginTop: 10, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  color: '#fca5a5', fontSize: 13,
                }}>
                  {videoError}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Video player */}
      {videoUrl && (
        <div style={{ marginBottom: 28, background: '#1e293b', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>🎬 Generated Movie</h3>
            <a
              href={videoUrl}
              download
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                background: '#0f766e', color: '#fff', textDecoration: 'none',
              }}
            >
              ⬇ Download
            </a>
          </div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls src={videoUrl} style={{ width: '100%', borderRadius: 8, maxHeight: 420 }} />
        </div>
      )}

      {/* Storyboard grid */}
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#cbd5e1' }}>
          🎬 Storyboard — {scenes.length} scenes
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {scenes.map(scene => (
            <SceneCard key={scene.id} scene={scene} showDialogue={movieMode === 'dialogue' || movieMode === 'talking_character'} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Mode selector card ─────────────────────────────────────────────────────────
function ModeCard({
  selected, onSelect, title, description, credits, badge, color,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  description: string
  credits: number
  badge?: string
  color: string
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '14px 18px', borderRadius: 10, cursor: 'pointer', minWidth: 200,
        background: selected ? `${color}22` : '#1e293b',
        border: `2px solid ${selected ? color : '#334155'}`,
        transition: 'border-color 0.15s ease',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{description}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: selected ? color : '#334155', color: '#fff',
        }}>
          {credits} credits
        </span>
        {badge && (
          <span style={{ fontSize: 10, color: '#4ade80' }}>{badge}</span>
        )}
      </div>
    </div>
  )
}

// ── Scene card ─────────────────────────────────────────────────────────────────
function SceneCard({ scene, showDialogue }: { scene: StoryScene; showDialogue: boolean }) {
  const hasImage = scene.image_status === 'completed' && scene.image_url

  return (
    <div style={{
      background: '#1e293b',
      border: `1px solid ${scene.image_status === 'failed' ? 'rgba(239,68,68,0.4)' : '#334155'}`,
      borderRadius: 10, overflow: 'hidden',
    }}>
      {/* Image area 16:9 */}
      <div style={{
        width: '100%', aspectRatio: '16/9', background: '#0f172a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={scene.image_url!}
            alt={scene.title ?? `Scene ${scene.scene_number}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : scene.image_status === 'generating' ? (
          <div style={{ textAlign: 'center', color: '#7c3aed' }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>⏳</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>Generating...</div>
          </div>
        ) : scene.image_status === 'failed' ? (
          <div style={{ textAlign: 'center', color: '#ef4444' }}>
            <div style={{ fontSize: 20 }}>✕</div>
            <div style={{ fontSize: 10, marginTop: 3 }}>Failed</div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 10 }}>
            <div style={{ fontSize: 22, opacity: 0.3, marginBottom: 4 }}>🖼</div>
            <div style={{ fontSize: 10, color: '#475569' }}>
              {scene.visual_keywords?.slice(0, 2).join(' · ')}
            </div>
          </div>
        )}
        <div style={{
          position: 'absolute', top: 5, left: 5,
          background: 'rgba(0,0,0,0.65)', borderRadius: 5,
          padding: '1px 6px', fontSize: 10, fontWeight: 700, color: '#fff',
        }}>
          {scene.scene_number}
        </div>
      </div>

      {/* Scene info */}
      <div style={{ padding: '8px 12px' }}>
        {scene.title && (
          <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 3, color: '#e2e8f0' }}>{scene.title}</div>
        )}
        <p style={{ fontSize: 11, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
          {scene.narration?.slice(0, 80)}{(scene.narration?.length ?? 0) > 80 ? '...' : ''}
        </p>
        <div style={{ marginTop: 5, fontSize: 10, color: '#475569' }}>
          {scene.duration_seconds}s · {scene.image_status}
        </div>

        {/* Dialogue preview */}
        {showDialogue && scene.dialogue_json && scene.dialogue_json.length > 0 && (
          <div style={{ marginTop: 8, borderTop: '1px solid #1e3a5f', paddingTop: 8 }}>
            {scene.dialogue_json.slice(0, 3).map((line, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#818cf8' }}>{line.speaker}: </span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>
                  {line.text.slice(0, 60)}{line.text.length > 60 ? '...' : ''}
                </span>
              </div>
            ))}
            {scene.dialogue_json.length > 3 && (
              <div style={{ fontSize: 10, color: '#475569' }}>+{scene.dialogue_json.length - 3} more lines</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
