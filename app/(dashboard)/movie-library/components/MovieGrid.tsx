import type { LibraryMovie } from '../types'
import { MovieCard } from './MovieCard'

export function MovieGrid({
  movies,
  onOpen,
  onDuplicate,
  onToggleArchive,
  onDelete,
}: {
  movies: LibraryMovie[]
  onOpen: (movie: LibraryMovie) => void
  onDuplicate: (movie: LibraryMovie) => void
  onToggleArchive: (movie: LibraryMovie) => void
  onDelete: (movie: LibraryMovie) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {movies.map((movie) => (
        <MovieCard
          key={movie.productionId}
          movie={movie}
          onOpen={onOpen}
          onDuplicate={onDuplicate}
          onToggleArchive={onToggleArchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
