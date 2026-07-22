import Link from 'next/link'
import { Archive, ArchiveRestore, Copy, Download, PlayCircle, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { LibraryMovie } from '../types'
import { MovieThumbnail } from './MovieThumbnail'
import { MovieStatusBadge } from './MovieStatusBadge'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function MovieCard({
  movie,
  onOpen,
  onDuplicate,
  onToggleArchive,
  onDelete,
}: {
  movie: LibraryMovie
  onOpen: (movie: LibraryMovie) => void
  onDuplicate: (movie: LibraryMovie) => void
  onToggleArchive: (movie: LibraryMovie) => void
  onDelete: (movie: LibraryMovie) => void
}) {
  const canContinue = movie.status === 'RENDERING' || movie.status === 'QUEUED' || movie.status === 'FAILED'

  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-brand-600/50 hover:shadow-[0_16px_48px_-16px_rgba(124,58,237,0.35)]">
      <button onClick={() => onOpen(movie)} className="block w-full text-left">
        <div className="relative aspect-video w-full overflow-hidden border-b border-white/10">
          <MovieThumbnail
            posterUrl={movie.posterUrl}
            title={movie.title}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute top-2.5 right-2.5">
            <MovieStatusBadge status={movie.status} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <PlayCircle className="w-10 h-10 text-white drop-shadow-lg" />
          </div>
        </div>

        <div className="p-4 pb-3">
          <h3 className="font-semibold text-white leading-snug truncate">{movie.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>{formatDate(movie.createdAt)}</span>
            <span>{formatDuration(movie.durationSeconds)}</span>
            <span>{movie.resolution}</span>
            <span>{movie.creditsUsed} credits</span>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 border-t border-white/5 px-2 py-2">
        {canContinue && (
          <Link
            href={`/movie-production?productionId=${movie.productionId}`}
            title="Continue Production"
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-brand-300"
          >
            <PlayCircle className="w-4 h-4" />
          </Link>
        )}

        <a
          href={movie.downloadUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          title="Download"
          aria-disabled={!movie.downloadUrl}
          onClick={(e) => {
            if (!movie.downloadUrl) e.preventDefault()
          }}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-emerald-300 aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:bg-transparent aria-disabled:hover:text-gray-400"
        >
          <Download className="w-4 h-4" />
        </a>

        <button
          onClick={() => onDuplicate(movie)}
          title="Duplicate"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-blue-300"
        >
          <Copy className="w-4 h-4" />
        </button>

        <button
          onClick={() => onToggleArchive(movie)}
          title={movie.status === 'ARCHIVED' ? 'Unarchive' : 'Archive'}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-amber-300"
        >
          {movie.status === 'ARCHIVED' ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
        </button>

        <button
          onClick={() => onDelete(movie)}
          title="Delete"
          className="ml-auto inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </Card>
  )
}
