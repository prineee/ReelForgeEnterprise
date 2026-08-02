import type { LibraryAsset } from '../types'
import { AssetCard } from './AssetCard'

export function AssetGrid({
  assets,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  assets: LibraryAsset[]
  onOpen: (asset: LibraryAsset) => void
  onDuplicate: (asset: LibraryAsset) => void
  onDelete: (asset: LibraryAsset) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} onOpen={onOpen} onDuplicate={onDuplicate} onDelete={onDelete} />
      ))}
    </div>
  )
}
