'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, Clock4, Download, Film, PlayCircle, Users, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LibraryMovie } from '../types'
import { MovieThumbnail } from './MovieThumbnail'
import { MovieStatusBadge } from './MovieStatusBadge'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export function MovieDetailsDrawer({ movie, onClose }: { movie: LibraryMovie | null; onClose: () => void }) {
  useEffect(() => {
    if (!movie) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [movie, onClose])

  const canContinue = movie && (movie.status === 'RENDERING' || movie.status === 'QUEUED' || movie.status === 'FAILED')

  return (
    <div
      aria-hidden={!movie}
      className={cn(
        'fixed inset-0 z-50 transition-opacity duration-300',
        movie ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-surface shadow-2xl transition-transform duration-300 ease-out',
          movie ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {movie && (
          <>
            <div className="relative aspect-video w-full border-b border-white/10">
              <MovieThumbnail posterUrl={movie.posterUrl} title={movie.title} className="h-full w-full" iconClassName="w-12 h-12" />
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute left-4 bottom-4 flex items-center gap-2">
                <MovieStatusBadge status={movie.status} />
              </div>
            </div>

            <div className="p-6 space-y-8">
              {/* Movie Information */}
              <div>
                <h2 className="text-2xl font-bold text-white">{movie.title}</h2>
                <p className="mt-1 text-xs text-gray-500">{formatDate(movie.createdAt)}</p>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <Stat icon={Users} label="Characters" value={movie.characterCount} />
                  <Stat icon={Film} label="Scenes" value={movie.sceneCount} />
                  <Stat icon={Zap} label="Credits Used" value={movie.creditsUsed} />
                  <Stat icon={Clock4} label="Gen. Time" value={formatDuration(movie.generationTimeSeconds)} />
                </div>

                <div className="mt-4 flex gap-2">
                  <a
                    href={movie.downloadUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={!movie.downloadUrl}
                    onClick={(e) => {
                      if (!movie.downloadUrl) e.preventDefault()
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-brand-600"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                  {canContinue && (
                    <Link
                      href={`/movie-production?productionId=${movie.productionId}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-brand-600 hover:text-white"
                    >
                      <PlayCircle className="w-4 h-4" /> Continue Production
                    </Link>
                  )}
                </div>
              </div>

              {/* Prompt + Story Summary */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Prompt</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">{movie.prompt}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Story Summary</h3>
                  <p className="text-sm text-gray-300 leading-relaxed">{movie.storySummary}</p>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Timeline</h3>
                <ol className="space-y-2.5">
                  {movie.timeline.map((entry) => (
                    <li key={entry.label} className="flex items-center gap-2.5 text-sm">
                      {entry.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-gray-600 shrink-0" />
                      )}
                      <span className={entry.done ? 'text-gray-200' : 'text-gray-400'}>{entry.label}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Generated Assets */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Generated Assets</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {movie.assets.map((asset) => (
                    <div
                      key={asset.key}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs',
                        asset.available
                          ? 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300'
                          : 'border-white/5 bg-white/[0.02] text-gray-400'
                      )}
                    >
                      <span className="truncate">{asset.label}</span>
                      {asset.available ? (
                        <span className="font-mono">{asset.count ?? '✓'}</span>
                      ) : (
                        <Circle className="w-3 h-3 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: string | number
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-gray-500">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-0.5 font-semibold text-white">{value}</p>
    </div>
  )
}
