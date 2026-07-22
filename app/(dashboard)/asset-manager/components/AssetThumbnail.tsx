import { PlayCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LibraryAsset } from '../types'
import { ASSET_TYPE_META } from '../assetMeta'

const GRADIENTS: Record<string, string> = {
  STORY: 'from-amber-950 via-surface-card to-surface-card',
  CHARACTER: 'from-pink-950 via-surface-card to-surface-card',
  REFERENCE_IMAGE: 'from-blue-950 via-surface-card to-surface-card',
  SCENE_IMAGE: 'from-cyan-950 via-surface-card to-surface-card',
  VIDEO: 'from-purple-950 via-surface-card to-surface-card',
  VOICE: 'from-emerald-950 via-surface-card to-surface-card',
  MUSIC: 'from-fuchsia-950 via-surface-card to-surface-card',
  SUBTITLE: 'from-zinc-800 via-surface-card to-surface-card',
  POSTER: 'from-orange-950 via-surface-card to-surface-card',
  THUMBNAIL: 'from-yellow-950 via-surface-card to-surface-card',
}

export function AssetThumbnail({ asset, className }: { asset: LibraryAsset; className?: string }) {
  const meta = ASSET_TYPE_META[asset.type]
  const Icon = meta.icon

  return (
    <div className={cn('relative flex items-center justify-center bg-gradient-to-br', GRADIENTS[asset.type], className)}>
      <Icon className="w-8 h-8 text-white/25" />
      {asset.type === 'VIDEO' && asset.previewUrl && (
        <PlayCircle className="absolute w-8 h-8 text-white/70" />
      )}
    </div>
  )
}
