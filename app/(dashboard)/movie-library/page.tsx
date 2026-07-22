'use client'

import { useEffect, useMemo, useState } from 'react'
import { Library } from 'lucide-react'
import { MOCK_MOVIES, computeLibraryMetrics } from './mockData'
import { fetchWorkflowList, adaptWorkflowToLibraryMovie } from './adapter'
import type { FilterOption, LibraryMovie, SortOption } from './types'

const REAL_SYNC_INTERVAL_MS = 5000
import { MovieStats } from './components/MovieStats'
import { MovieSearch } from './components/MovieSearch'
import { MovieFilters } from './components/MovieFilters'
import { MovieGrid } from './components/MovieGrid'
import { MovieEmptyState } from './components/MovieEmptyState'
import { MovieLibrarySkeleton } from './components/MovieLibrarySkeleton'
import { MovieDetailsDrawer } from './components/MovieDetailsDrawer'

const FILTER_TO_STATUS: Record<Exclude<FilterOption, 'all'>, LibraryMovie['status']> = {
  completed: 'COMPLETED',
  rendering: 'RENDERING',
  queued: 'QUEUED',
  failed: 'FAILED',
  archived: 'ARCHIVED',
}

function matchesSearch(movie: LibraryMovie, query: string): boolean {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  return (
    movie.title.toLowerCase().includes(q) ||
    movie.productionId.toLowerCase().includes(q) ||
    movie.characters.some((c) => c.toLowerCase().includes(q)) ||
    movie.keywords.some((k) => k.toLowerCase().includes(q))
  )
}

function sortMovies(movies: LibraryMovie[], sort: SortOption): LibraryMovie[] {
  const sorted = [...movies]
  switch (sort) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    case 'longest':
      return sorted.sort((a, b) => b.durationSeconds - a.durationSeconds)
    case 'shortest':
      return sorted.sort((a, b) => a.durationSeconds - b.durationSeconds)
    case 'credits':
      return sorted.sort((a, b) => b.creditsUsed - a.creditsUsed)
    case 'alphabetical':
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    default:
      return sorted
  }
}

export default function MovieLibraryPage() {
  const [loading, setLoading] = useState(true)
  const [movies, setMovies] = useState<LibraryMovie[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterOption>('all')
  const [sort, setSort] = useState<SortOption>('newest')
  const [selectedMovie, setSelectedMovie] = useState<LibraryMovie | null>(null)

  // Placeholder demo data — see mockData.ts. Brief simulated load so the
  // skeleton state is real, not skipped.
  useEffect(() => {
    const timer = setTimeout(() => {
      setMovies(MOCK_MOVIES)
      setLoading(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  // Task 7: "Workflow completion automatically creates a Movie entry" and
  // "Status updates automatically" — every real workflow WorkflowEngine
  // knows about (see /api/workflow/list) is merged ahead of the
  // placeholder catalog, re-synced on an interval so a workflow that's
  // still running shows its status change without a page reload. Local
  // actions (archive/duplicate/delete) on a *real* entry only last until
  // the next sync overwrites it from the live workflow — there's no
  // backend to persist that override to (no database, per this sprint's
  // rules), which is an accepted limitation, not a bug.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function sync() {
      try {
        const workflows = await fetchWorkflowList()
        if (cancelled) return

        const real = workflows.map(adaptWorkflowToLibraryMovie)
        const realIds = new Set(real.map((m) => m.productionId))
        setMovies((prev) => [...real, ...prev.filter((m) => !realIds.has(m.productionId))])
      } catch {
        // Best-effort live sync — the placeholder catalog still renders if this fails (e.g. logged out, factory not configured).
      }
    }

    sync()
    timer = setInterval(sync, REAL_SYNC_INTERVAL_MS)
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [])

  const metrics = useMemo(() => computeLibraryMetrics(movies), [movies])

  const visibleMovies = useMemo(() => {
    const filtered = movies.filter((m) => {
      const matchesFilter = filter === 'all' || m.status === FILTER_TO_STATUS[filter]
      return matchesFilter && matchesSearch(m, search)
    })
    return sortMovies(filtered, sort)
  }, [movies, filter, search, sort])

  function handleDuplicate(movie: LibraryMovie) {
    // Placeholder — no backend endpoint exists to actually duplicate a
    // production yet. Wire this to a real POST /api/movie/duplicate once
    // that exists; for now it clones the row locally.
    const copy: LibraryMovie = {
      ...movie,
      productionId: `${movie.productionId}-copy-${Date.now()}`,
      title: `${movie.title} (Copy)`,
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      downloadUrl: null,
    }
    setMovies((prev) => [copy, ...prev])
  }

  function handleToggleArchive(movie: LibraryMovie) {
    setMovies((prev) =>
      prev.map((m) =>
        m.productionId === movie.productionId ? { ...m, status: m.status === 'ARCHIVED' ? 'COMPLETED' : 'ARCHIVED' } : m
      )
    )
    setSelectedMovie((prev) =>
      prev && prev.productionId === movie.productionId
        ? { ...prev, status: prev.status === 'ARCHIVED' ? 'COMPLETED' : 'ARCHIVED' }
        : prev
    )
  }

  function handleDelete(movie: LibraryMovie) {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${movie.title}"? This cannot be undone.`)) return
    setMovies((prev) => prev.filter((m) => m.productionId !== movie.productionId))
    setSelectedMovie((prev) => (prev && prev.productionId === movie.productionId ? null : prev))
  }

  return (
    <div className="max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-brand-950 via-surface-card to-purple-950/60 px-6 py-8 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shrink-0">
            <Library className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Movie Library</h1>
            <p className="text-sm text-gray-400 mt-0.5">Search every production. Manage your generated movies.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <MovieLibrarySkeleton />
      ) : (
        <>
          <MovieStats metrics={metrics} />

          <div className="flex flex-col sm:flex-row gap-3">
            <MovieSearch value={search} onChange={setSearch} />
          </div>
          <MovieFilters filter={filter} onFilterChange={setFilter} sort={sort} onSortChange={setSort} />

          {visibleMovies.length === 0 ? (
            <MovieEmptyState hasAnyMovies={movies.length > 0} />
          ) : (
            <MovieGrid
              movies={visibleMovies}
              onOpen={setSelectedMovie}
              onDuplicate={handleDuplicate}
              onToggleArchive={handleToggleArchive}
              onDelete={handleDelete}
            />
          )}
        </>
      )}

      <MovieDetailsDrawer movie={selectedMovie} onClose={() => setSelectedMovie(null)} />
    </div>
  )
}
