import Link from 'next/link'
import { Clapperboard, SearchX } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export function MovieEmptyState({ hasAnyMovies }: { hasAnyMovies: boolean }) {
  if (!hasAnyMovies) {
    return (
      <EmptyState
        icon={<Clapperboard className="w-7 h-7" />}
        title="Your library is empty"
        description="Movies you generate in Movie Studio will show up here, ready to watch, download, and manage."
        action={
          <Link
            href="/movie-studio"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Create your first movie
          </Link>
        }
      />
    )
  }

  return (
    <EmptyState
      icon={<SearchX className="w-7 h-7" />}
      title="No movies match"
      description="Try a different search term, or clear the current filter."
    />
  )
}
