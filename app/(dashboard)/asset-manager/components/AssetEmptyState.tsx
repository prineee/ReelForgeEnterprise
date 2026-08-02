import Link from 'next/link'
import { Boxes, SearchX } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'

export function AssetEmptyState({ hasAnyAssets }: { hasAnyAssets: boolean }) {
  if (!hasAnyAssets) {
    return (
      <EmptyState
        icon={<Boxes className="w-7 h-7" />}
        title="No assets yet"
        description="Story files, reference images, scene videos, voice lines, and more will show up here as movies are generated."
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
      title="No assets match"
      description="Try a different search term, or clear the current filter."
    />
  )
}
