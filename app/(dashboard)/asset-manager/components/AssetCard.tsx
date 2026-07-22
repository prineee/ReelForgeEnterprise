import { Copy, Download, Eye, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import type { LibraryAsset } from '../types'
import { AssetThumbnail } from './AssetThumbnail'
import { AssetTypeBadge } from './AssetTypeBadge'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function AssetCard({
  asset,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  asset: LibraryAsset
  onOpen: (asset: LibraryAsset) => void
  onDuplicate: (asset: LibraryAsset) => void
  onDelete: (asset: LibraryAsset) => void
}) {
  return (
    <Card className="group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-brand-600/50 hover:shadow-[0_16px_48px_-16px_rgba(124,58,237,0.35)]">
      <button onClick={() => onOpen(asset)} className="block w-full text-left">
        <div className="relative aspect-video w-full overflow-hidden border-b border-white/10">
          <AssetThumbnail asset={asset} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <div className="absolute top-2.5 right-2.5">
            <AssetTypeBadge type={asset.type} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <Eye className="w-7 h-7 text-white drop-shadow-lg" />
          </div>
        </div>

        <div className="p-4 pb-3">
          <h3 className="font-semibold text-white leading-snug truncate">{asset.name}</h3>
          <p className="mt-0.5 text-xs text-brand-400 truncate">{asset.movieTitle}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>{formatDate(asset.createdAt)}</span>
            {asset.resolution && <span>{asset.resolution}</span>}
            <span>{formatBytes(asset.fileSizeBytes)}</span>
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1 border-t border-white/5 px-2 py-2">
        <a
          href={asset.previewUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          title="Download"
          aria-disabled={!asset.previewUrl}
          onClick={(e) => {
            if (!asset.previewUrl) e.preventDefault()
          }}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-emerald-300 aria-disabled:cursor-not-allowed aria-disabled:opacity-30 aria-disabled:hover:bg-transparent aria-disabled:hover:text-gray-400"
        >
          <Download className="w-4 h-4" />
        </a>

        <button
          onClick={() => onDuplicate(asset)}
          title="Duplicate"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-blue-300"
        >
          <Copy className="w-4 h-4" />
        </button>

        <button
          onClick={() => onDelete(asset)}
          title="Delete"
          className="ml-auto inline-flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </Card>
  )
}
