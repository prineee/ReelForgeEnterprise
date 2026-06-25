'use client'

import { useState } from 'react'
import {
  Video, Trash2, FolderOpen, Plus, X, Download,
  Volume2, BookMarked, Loader2, ImageIcon,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { formatDate, cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string
  title: string
  type: string
  status: string
  created_at: string
}

interface VideoData {
  id: string
  project_id: string
  script: string | null
  voice_url: string | null
  video_url: string | null
  thumbnail_url: string | null
  duration: number | null
  created_at: string
}

interface SceneData {
  number: number
  title: string
  duration: string
  voiceover: string
  visualNote: string
  visualKeywords?: string[]
}

// ── Style maps ────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'default' | 'info'> = {
  completed: 'success',
  processing: 'info',
  draft: 'default',
  failed: 'danger',
}

const TYPE_COLORS: Record<string, string> = {
  reel:  'text-purple-400',
  short: 'text-blue-400',
  story: 'text-pink-400',
  ad:    'text-orange-400',
}

const SCENE_GRADIENTS = [
  'from-red-500 to-orange-500',
  'from-orange-500 to-yellow-500',
  'from-brand-500 to-blue-500',
  'from-green-500 to-emerald-500',
  'from-purple-500 to-pink-500',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseScript(raw: string | null): SceneData[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SceneData[]) : null
  } catch {
    return null
  }
}

// ── Project Detail Modal ──────────────────────────────────────────────────────

function ProjectModal({
  project,
  videoData,
  loading,
  onClose,
}: {
  project: Project
  videoData: VideoData | null
  loading: boolean
  onClose: () => void
}) {
  const scenes = parseScript(videoData?.script ?? null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-2xl bg-surface-card border border-surface-border rounded-2xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-surface-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-surface border border-surface-border flex items-center justify-center shrink-0">
              <Video className={`w-5 h-5 ${TYPE_COLORS[project.type] ?? 'text-gray-400'}`} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-base text-white leading-tight truncate">
                {project.title}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">{formatDate(project.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="default" className="capitalize">{project.type}</Badge>
            <Badge variant={STATUS_VARIANT[project.status] ?? 'default'}>{project.status}</Badge>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-surface-hover transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
            </div>
          )}

          {/* No content */}
          {!loading && !videoData && (
            <div className="text-center py-14">
              <FolderOpen className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No content available for this project yet.</p>
              <p className="text-xs text-gray-600 mt-1">
                Content is saved here once generation is complete.
              </p>
            </div>
          )}

          {/* Content */}
          {!loading && videoData && (
            <>
              {/* ── Voiceover ── */}
              {videoData.voice_url && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                    <Volume2 className="w-4 h-4 text-brand-400" />
                    Voiceover
                  </div>
                  <audio
                    src={videoData.voice_url}
                    controls
                    className="w-full rounded-lg"
                    style={{ colorScheme: 'dark' }}
                  />
                  <a
                    href={videoData.voice_url}
                    download="voiceover.wav"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Audio
                  </a>
                </div>
              )}

              {/* ── Thumbnail image ── */}
              {videoData.thumbnail_url && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                    <ImageIcon className="w-4 h-4 text-brand-400" />
                    Thumbnail
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={videoData.thumbnail_url}
                    alt="Project thumbnail"
                    className="w-full rounded-xl border border-surface-border object-cover"
                  />
                  <a
                    href={videoData.thumbnail_url}
                    download="thumbnail.jpg"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Image
                  </a>
                </div>
              )}

              {/* ── Script ── */}
              {scenes && scenes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-300">
                    <BookMarked className="w-4 h-4 text-brand-400" />
                    Script
                    <span className="text-gray-600 font-normal">— {scenes.length} scenes</span>
                  </div>
                  {scenes.map((scene, i) => (
                    <div
                      key={scene.number}
                      className="bg-surface rounded-xl border border-surface-border p-4 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-6 h-6 rounded bg-gradient-to-br flex items-center justify-center text-white text-xs font-extrabold shrink-0',
                          SCENE_GRADIENTS[i] ?? 'from-gray-500 to-gray-600'
                        )}>
                          {scene.number}
                        </div>
                        <span className="text-xs font-semibold text-gray-300">{scene.title}</span>
                        {scene.duration && (
                          <span className="text-xs text-gray-600">{scene.duration}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-200 leading-relaxed pl-8">
                        {scene.voiceover}
                      </p>
                      {scene.visualNote && (
                        <p className="text-xs text-gray-500 italic pl-8">{scene.visualNote}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* If nothing to show for completed project */}
              {!videoData.voice_url && !videoData.thumbnail_url && !scenes && (
                <p className="text-sm text-gray-500 text-center py-6">
                  This project has no viewable content stored yet.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProjectsClient({ initialProjects }: { initialProjects: Project[] }) {
  const supabase = createClient()
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Modal state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  async function openProject(project: Project) {
    setSelectedProject(project)
    setVideoData(null)
    setLoadingDetail(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('videos') as any)
      .select('id, voice_url, video_url, thumbnail_url, script, duration, created_at')
      .eq('project_id', project.id)
      .maybeSingle() as { data: VideoData | null }

    setVideoData(data)
    setLoadingDetail(false)
  }

  function closeModal() {
    setSelectedProject(null)
    setVideoData(null)
  }

  async function handleDelete(e: React.MouseEvent, id: string, title: string) {
    e.stopPropagation()  // don't open the modal when clicking delete
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeleting(id)
    setProjects((prev) => prev.filter((p) => p.id !== id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('projects') as any).delete().eq('id', id)
    if (error) {
      setProjects((prev) => {
        const restored = initialProjects.find((p) => p.id === id)
        return restored
          ? [...prev, restored].sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
          : prev
      })
      alert('Failed to delete project. Please try again.')
    }
    setDeleting(null)
  }

  // ── Empty state ──
  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-surface border border-surface-border flex items-center justify-center mb-4">
            <FolderOpen className="w-7 h-7 text-gray-500" />
          </div>
          <h2 className="font-semibold text-lg mb-2">No projects yet</h2>
          <p className="text-gray-400 text-sm mb-6 max-w-sm">
            Start creating AI-powered reels, thumbnails, and more. Each creation becomes a project.
          </p>
          <Link
            href="/create-reel"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Your First Reel
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* ── Project grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => (
          <Card
            key={p.id}
            hover
            onClick={() => openProject(p)}
          >
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-surface border border-surface-border flex items-center justify-center">
                  <Video className={`w-5 h-5 ${TYPE_COLORS[p.type] ?? 'text-gray-400'}`} />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_VARIANT[p.status] ?? 'default'}>{p.status}</Badge>
                  <button
                    onClick={(e) => handleDelete(e, p.id, p.title)}
                    disabled={deleting === p.id}
                    title="Delete project"
                    className="w-7 h-7 flex items-center justify-center rounded text-gray-600 hover:text-red-400 hover:bg-red-950/40 transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-0.5 line-clamp-1">{p.title}</h3>
                <p className="text-xs text-gray-500">{formatDate(p.created_at)}</p>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-surface-border">
                <Badge variant="default" className="text-xs capitalize">{p.type}</Badge>
                <span className="text-xs text-gray-600 italic">Click to view</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Detail modal ── */}
      {selectedProject && (
        <ProjectModal
          project={selectedProject}
          videoData={videoData}
          loading={loadingDetail}
          onClose={closeModal}
        />
      )}
    </>
  )
}
