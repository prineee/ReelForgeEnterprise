import { ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FilterOption, SortOption } from '../types'

const FILTERS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'rendering', label: 'Rendering' },
  { value: 'queued', label: 'Queued' },
  { value: 'failed', label: 'Failed' },
  { value: 'archived', label: 'Archived' },
]

const SORTS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'longest', label: 'Longest' },
  { value: 'shortest', label: 'Shortest' },
  { value: 'credits', label: 'Credits' },
  { value: 'alphabetical', label: 'Alphabetical' },
]

export function MovieFilters({
  filter,
  onFilterChange,
  sort,
  onSortChange,
}: {
  filter: FilterOption
  onFilterChange: (filter: FilterOption) => void
  sort: SortOption
  onSortChange: (sort: SortOption) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
              filter === f.value
                ? 'border-brand-500 bg-brand-600/20 text-white'
                : 'border-surface-border text-gray-400 hover:border-brand-700/60 hover:text-white'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-xs text-gray-500 shrink-0">
        <ArrowUpDown className="w-3.5 h-3.5" />
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="bg-surface-card border border-surface-border rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
