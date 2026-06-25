'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Share2, Youtube, Plus, Loader2, AlertCircle, Check,
  Download, ExternalLink, Sparkles, X, Clock, CheckCircle2,
  XCircle, Link as LinkIcon,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDate } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PublishJob {
  id: string
  title: string
  video_url: string
  platforms: string[]
  status: 'pending' | 'processing' | 'published' | 'failed'
  created_at: string
  description: string | null
  hashtags: string[] | null
}

interface Project {
  id: string
  title: string
  status: string
  video_url?: string | null
}

interface PlatformContent {
  title: string
  description: string
  hashtags: string[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'youtube',   label: 'YouTube',   color: 'text-red-400',    bg: 'bg-red-950 border-red-800',    emoji: '▶️' },
  { id: 'tiktok',    label: 'TikTok',    color: 'text-pink-400',   bg: 'bg-pink-950 border-pink-800',  emoji: '🎵' },
  { id: 'instagram', label: 'Instagram', color: 'text-purple-400', bg: 'bg-purple-950 border-purple-800', emoji: '📸' },
  { id: 'facebook',  label: 'Facebook',  color: 'text-blue-400',   bg: 'bg-blue-950 border-blue-800',  emoji: '👍' },
] as const

type PlatformId = typeof PLATFORMS[number]['id']

const STATUS_BADGE: Record<string, 'default' | 'info' | 'success' | 'danger' | 'warning'> = {
  pending:    'default',
  processing: 'info',
  published:  'success',
  failed:     'danger',
}

const MANUAL_STEPS: Record<string, string[]> = {
  youtube:   ['Download the video MP4', 'Go to youtube.com/upload', 'Upload video, paste the title & description below', 'Add hashtags from the list below'],
  tiktok:    ['Download the video MP4', 'Open TikTok app on your phone', 'Tap + → Upload → select the video', 'Paste the caption and hashtags below'],
  instagram: ['Download the video MP4', 'Open Instagram → + → Reel', 'Select video → paste caption & hashtags', 'Share to Reels feed'],
  facebook:  ['Download the video MP4', 'Go to facebook.com → Create post', 'Add video → paste description', 'Post to your page or feed'],
}

// ── Project picker modal ───────────────────────────────────────────────────────

function ProjectPickerModal({ onClose, onPick }: {
  onClose: () => void
  onPick: (url: string, title: string) => void
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(j => {
      setProjects((j.projects ?? []).filter((p: Project) => p.video_url))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-surface-card border border-surface-border rounded-2xl shadow-2xl max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border shrink-0">
          <h3 className="font-bold text-sm">Pick from Projects</h3>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>}
          {!loading && projects.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No projects with video URLs found.</p>
          )}
          {projects.map(p => (
            <button key={p.id} onClick={() => { onPick(p.video_url!, p.title); onClose() }}
              className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-surface-border hover:border-brand-700/50 bg-surface transition-all">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{p.title}</p>
                <p className="text-xs text-gray-500 truncate">{p.video_url}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PublisherPage() {
  const [tab, setTab] = useState<'publish' | 'history' | 'connect'>('publish')

  // Publish tab state
  const [videoUrl, setVideoUrl]       = useState('')
  const [videoTitle, setVideoTitle]   = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([])
  const [platformContent, setPlatformContent]     = useState<Record<string, PlatformContent>>({})
  const [generatingFor, setGeneratingFor]         = useState<string | null>(null)
  const [publishing, setPublishing]               = useState(false)
  const [publishResult, setPublishResult]         = useState<{ notConnected: string[]; job: PublishJob } | null>(null)
  const [publishError, setPublishError]           = useState('')
  const [showProjectPicker, setShowProjectPicker] = useState(false)

  // History tab state
  const [jobs, setJobs]       = useState<PublishJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)

  // Read query params on mount (from create-reel/movie-studio links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const url    = params.get('video_url')
    const title  = params.get('title')
    if (url)   setVideoUrl(url)
    if (title) setVideoTitle(title)
  }, [])

  const loadJobs = useCallback(async () => {
    setJobsLoading(true)
    try {
      const res  = await fetch('/api/publish')
      if (res.ok) { const json = await res.json(); setJobs(json.jobs ?? []) }
    } catch { /* ignore */ }
    finally { setJobsLoading(false) }
  }, [])

  useEffect(() => { if (tab === 'history') loadJobs() }, [tab, loadJobs])

  function togglePlatform(pid: PlatformId) {
    setSelectedPlatforms(prev =>
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    )
    // Seed default content if not already present
    if (!platformContent[pid]) {
      setPlatformContent(prev => ({
        ...prev,
        [pid]: { title: videoTitle, description: '', hashtags: [] },
      }))
    }
  }

  async function generateContent(pid: string) {
    setGeneratingFor(pid)
    try {
      const res  = await fetch('/api/publish/generate-description', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: videoTitle, platform: pid }),
      })
      const json = await res.json() as PlatformContent
      setPlatformContent(prev => ({ ...prev, [pid]: json }))
    } catch { /* ignore */ }
    finally { setGeneratingFor(null) }
  }

  async function handlePublish() {
    if (!videoUrl || !videoTitle || !selectedPlatforms.length) return
    setPublishing(true); setPublishError(''); setPublishResult(null)
    try {
      const res  = await fetch('/api/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url:   videoUrl,
          title:       videoTitle,
          description: platformContent[selectedPlatforms[0]]?.description ?? '',
          hashtags:    platformContent[selectedPlatforms[0]]?.hashtags ?? [],
          platforms:   selectedPlatforms,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setPublishError(json.error ?? 'Publish failed'); return }
      setPublishResult({ notConnected: json.notConnected ?? [], job: json.job as PublishJob })
    } catch { setPublishError('Network error') }
    finally { setPublishing(false) }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Social Media Publisher</h1>
        <p className="text-gray-400 text-sm">Publish your reels and movies to YouTube, TikTok, Instagram, and Facebook</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-card border border-surface-border rounded-xl p-1 overflow-x-auto">
        {([
          { id: 'publish', label: 'Publish Video' },
          { id: 'history', label: 'History' },
          { id: 'connect', label: 'Connect Platforms' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
            tab === t.id ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-white'
          )}>{t.label}</button>
        ))}
      </div>

      {/* ── Tab 1: Publish ── */}
      {tab === 'publish' && (
        <div className="space-y-5">
          {/* Video source */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><LinkIcon className="w-4 h-4 text-brand-400" /> Video Source</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="label">Title</label>
                <input className="input" placeholder="My Viral Reel" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} />
              </div>
              <div>
                <label className="label">Video URL</label>
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="https://res.cloudinary.com/…/video.mp4" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
                  <Button variant="secondary" size="sm" onClick={() => setShowProjectPicker(true)}>
                    <Plus className="w-3.5 h-3.5" /> From Projects
                  </Button>
                </div>
              </div>
              {videoUrl && (
                <video src={videoUrl} controls className="w-full max-h-48 rounded-xl border border-surface-border object-contain bg-black" style={{ colorScheme: 'dark' }} />
              )}
            </CardContent>
          </Card>

          {/* Platform selector */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Share2 className="w-4 h-4 text-brand-400" /> Select Platforms</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PLATFORMS.map(p => {
                  const sel = selectedPlatforms.includes(p.id)
                  return (
                    <button key={p.id} onClick={() => togglePlatform(p.id)} className={cn(
                      'flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all',
                      sel ? 'border-brand-500 bg-brand-600/10' : 'border-surface-border hover:border-brand-700/50 bg-surface-card'
                    )}>
                      <span className="text-xl">{p.emoji}</span>
                      <span className="text-xs font-medium text-white">{p.label}</span>
                      {sel && <Check className="w-3.5 h-3.5 text-brand-400" />}
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Content per platform */}
          {selectedPlatforms.map(pid => {
            const pl   = PLATFORMS.find(p => p.id === pid)!
            const data = platformContent[pid] ?? { title: videoTitle, description: '', hashtags: [] }
            return (
              <Card key={pid}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span>{pl.emoji}</span> {pl.label} Content
                    </span>
                    <Button size="sm" variant="secondary" disabled={generatingFor === pid || !videoTitle}
                      onClick={() => generateContent(pid)}>
                      {generatingFor === pid
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Sparkles className="w-3.5 h-3.5" />
                      }
                      AI Generate
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="label">Title</label>
                    <input className="input text-sm" value={data.title} onChange={e =>
                      setPlatformContent(prev => ({ ...prev, [pid]: { ...data, title: e.target.value } }))
                    } />
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <textarea className="input min-h-[80px] resize-y text-sm" value={data.description} onChange={e =>
                      setPlatformContent(prev => ({ ...prev, [pid]: { ...data, description: e.target.value } }))
                    } placeholder="Video description…" />
                  </div>
                  <div>
                    <label className="label">Hashtags</label>
                    <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                      {data.hashtags.map(tag => (
                        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-950 border border-brand-800 text-brand-300 rounded-md text-xs">
                          #{tag}
                          <button onClick={() => setPlatformContent(prev => ({
                            ...prev, [pid]: { ...data, hashtags: data.hashtags.filter(t => t !== tag) }
                          }))}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                      {data.hashtags.length === 0 && <span className="text-xs text-gray-600 italic">Click AI Generate to add hashtags</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {/* Publish result */}
          {publishResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-green-950/40 border border-green-800 rounded-xl px-5 py-4">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <div>
                  <p className="font-semibold text-green-300">Publish job created!</p>
                  <p className="text-xs text-green-500/70">{selectedPlatforms.length} platform{selectedPlatforms.length !== 1 ? 's' : ''} queued</p>
                </div>
              </div>

              {publishResult.notConnected.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-gray-300">Manual upload needed for:</p>
                  {publishResult.notConnected.map(pid => {
                    const pl   = PLATFORMS.find(p => p.id === pid)!
                    const data = platformContent[pid]
                    const steps = MANUAL_STEPS[pid] ?? []
                    return (
                      <Card key={pid}>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            {pl.emoji} Upload to {pl.label} manually
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <ol className="space-y-1.5">
                            {steps.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                                <span className="w-5 h-5 rounded-full bg-brand-950 border border-brand-800 text-brand-400 text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                {s}
                              </li>
                            ))}
                          </ol>
                          <a href={videoUrl} download target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors">
                            <Download className="w-3.5 h-3.5" /> Download Video
                          </a>
                          {data?.description && (
                            <div className="bg-surface rounded-lg border border-surface-border p-3 space-y-2">
                              <p className="text-xs font-medium text-gray-400">Caption to paste:</p>
                              <p className="text-xs text-gray-200 whitespace-pre-wrap">{data.title}{'\n\n'}{data.description}{'\n\n'}{data.hashtags.map(t => `#${t}`).join(' ')}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {publishError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/40 border border-red-800 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {publishError}
            </div>
          )}

          <Button
            onClick={handlePublish}
            disabled={publishing || !videoUrl || !videoTitle || !selectedPlatforms.length}
            className="w-full"
            size="md"
          >
            {publishing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing…</>
              : <><Share2 className="w-4 h-4" /> Publish to {selectedPlatforms.length || '?'} platform{selectedPlatforms.length !== 1 ? 's' : ''}</>
            }
          </Button>
        </div>
      )}

      {/* ── Tab 2: History ── */}
      {tab === 'history' && (
        <div className="space-y-4">
          {jobsLoading && <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 animate-spin text-brand-500" /></div>}
          {!jobsLoading && jobs.length === 0 && (
            <Card><CardContent className="flex flex-col items-center py-16 text-center">
              <Clock className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <p className="font-semibold mb-1">No publish history yet</p>
              <p className="text-sm text-gray-500">Publish your first video to see it here.</p>
            </CardContent></Card>
          )}
          {!jobsLoading && jobs.length > 0 && (
            <Card>
              <div className="divide-y divide-surface-border">
                {jobs.map(job => (
                  <div key={job.id} className="flex items-center gap-3 px-5 py-4 hover:bg-surface-hover transition-colors flex-wrap">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{job.title}</p>
                      <p className="text-xs text-gray-500">{formatDate(job.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {job.platforms?.map(p => {
                        const pl = PLATFORMS.find(x => x.id === p)
                        return <Badge key={p} variant="default" className="text-xs">{pl?.emoji} {pl?.label ?? p}</Badge>
                      })}
                      <Badge variant={STATUS_BADGE[job.status] ?? 'default'} className="text-xs capitalize">
                        {job.status === 'pending'    && <Clock className="w-3 h-3" />}
                        {job.status === 'published'  && <CheckCircle2 className="w-3 h-3" />}
                        {job.status === 'failed'     && <XCircle className="w-3 h-3" />}
                        {job.status}
                      </Badge>
                      <a href={job.video_url} download target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 transition-colors">
                        <Download className="w-3.5 h-3.5" /> Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Tab 3: Connect Platforms ── */}
      {tab === 'connect' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Direct platform publishing requires OAuth approval from each platform (weeks-long process).
            The manual download workflow is available immediately.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PLATFORMS.map(p => (
              <Card key={p.id}>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0', p.bg)}>
                      {p.emoji}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-white">{p.label}</p>
                      <Badge variant="warning" className="text-xs mt-0.5">OAuth Coming Soon</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Direct {p.label} publishing via OAuth is in development.
                    Until then, use the <strong className="text-white">Publish Video</strong> tab to generate
                    optimized captions and download your video for manual upload.
                  </p>
                  <div className="space-y-1.5">
                    {MANUAL_STEPS[p.id].map((step, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-4 h-4 rounded-full bg-surface border border-surface-border text-gray-600 text-xs flex items-center justify-center shrink-0">{i + 1}</span>
                        {step}
                      </div>
                    ))}
                  </div>
                  <Button variant="secondary" size="sm" disabled className="w-full opacity-50">
                    <ExternalLink className="w-3.5 h-3.5" /> Connect {p.label} (Coming Soon)
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {showProjectPicker && (
        <ProjectPickerModal
          onClose={() => setShowProjectPicker(false)}
          onPick={(url, title) => { setVideoUrl(url); if (!videoTitle) setVideoTitle(title) }}
        />
      )}
    </div>
  )
}
