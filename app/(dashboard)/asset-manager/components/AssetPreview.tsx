import { FileText, PlayCircle } from 'lucide-react'
import type { LibraryAsset } from '../types'
import { ASSET_TYPE_META } from '../assetMeta'

const IMAGE_TYPES = new Set(['REFERENCE_IMAGE', 'SCENE_IMAGE', 'POSTER', 'THUMBNAIL'])
const AUDIO_TYPES = new Set(['VOICE', 'MUSIC'])
const TEXT_TYPES = new Set(['STORY', 'CHARACTER', 'SUBTITLE'])

/** Larger, type-aware preview surface used in the details drawer. */
export function AssetPreview({ asset }: { asset: LibraryAsset }) {
  const meta = ASSET_TYPE_META[asset.type]
  const Icon = meta.icon

  if (asset.type === 'VIDEO') {
    return (
      <div className="relative flex aspect-video w-full items-center justify-center bg-gradient-to-br from-purple-950 via-surface-card to-surface-card">
        <PlayCircle className="w-14 h-14 text-white/80" />
        <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-mono text-gray-300">
          {asset.resolution}
        </span>
      </div>
    )
  }

  if (AUDIO_TYPES.has(asset.type)) {
    const bars = Array.from({ length: 40 })
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-emerald-950 via-surface-card to-surface-card px-8">
        <Icon className="w-8 h-8 text-white/50" />
        <div className="flex h-12 w-full items-center justify-center gap-[3px]">
          {bars.map((_, i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-white/25"
              style={{ height: `${18 + Math.abs(Math.sin(i * 0.7)) * 82}%` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (TEXT_TYPES.has(asset.type)) {
    return (
      <div className="flex aspect-video w-full flex-col justify-center gap-2 bg-gradient-to-br from-amber-950/60 via-surface-card to-surface-card px-8">
        <div className="flex items-center gap-2 text-white/40">
          <FileText className="w-5 h-5" />
          <span className="text-xs font-mono">{asset.name}</span>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-full rounded bg-white/10" />
          <div className="h-2 w-5/6 rounded bg-white/10" />
          <div className="h-2 w-3/4 rounded bg-white/10" />
        </div>
      </div>
    )
  }

  if (IMAGE_TYPES.has(asset.type)) {
    return (
      <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-blue-950 via-surface-card to-surface-card">
        <Icon className="w-14 h-14 text-white/25" />
      </div>
    )
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center bg-gradient-to-br from-surface-card to-surface-card">
      <Icon className="w-14 h-14 text-white/25" />
    </div>
  )
}
