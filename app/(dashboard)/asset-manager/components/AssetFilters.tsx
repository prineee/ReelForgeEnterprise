import { cn } from '@/lib/utils'
import type { AssetFilter } from '../types'
import { ASSET_FILTERS } from '../assetMeta'

export function AssetFilters({
  filter,
  onFilterChange,
}: {
  filter: AssetFilter
  onFilterChange: (filter: AssetFilter) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ASSET_FILTERS.map((f) => (
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
  )
}
