import { cn } from '@/lib/utils'
import type { AssetType } from '../types'
import { ASSET_TYPE_META } from '../assetMeta'

export function AssetTypeBadge({ type, className }: { type: AssetType; className?: string }) {
  const meta = ASSET_TYPE_META[type]
  const Icon = meta.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        meta.bg,
        meta.color,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}
