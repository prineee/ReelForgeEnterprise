/**
 * mockData.ts
 *
 * computeAssetMetrics() is real, reusable aggregation logic over whatever
 * LibraryAsset[] the page actually has (currently the live
 * /api/workflow/list sync in adapter.ts). The demo catalog this file used
 * to also export was removed once the page stopped seeding itself with it
 * (Sprint 16, Task 4).
 */

import type { AssetMetrics, AssetType, LibraryAsset } from './types'

function bucketForMetrics(type: AssetType): 'image' | 'video' | 'voice' | 'story' | 'other' {
  switch (type) {
    case 'REFERENCE_IMAGE':
    case 'SCENE_IMAGE':
    case 'POSTER':
    case 'THUMBNAIL':
      return 'image'
    case 'VIDEO':
      return 'video'
    case 'VOICE':
      return 'voice'
    case 'STORY':
      return 'story'
    default:
      return 'other'
  }
}

export function computeAssetMetrics(assetsList: LibraryAsset[]): AssetMetrics {
  return {
    totalAssets: assetsList.length,
    images: assetsList.filter((a) => bucketForMetrics(a.type) === 'image').length,
    videos: assetsList.filter((a) => bucketForMetrics(a.type) === 'video').length,
    voiceFiles: assetsList.filter((a) => bucketForMetrics(a.type) === 'voice').length,
    storyFiles: assetsList.filter((a) => bucketForMetrics(a.type) === 'story').length,
    storageUsedBytes: assetsList.reduce((sum, a) => sum + a.fileSizeBytes, 0),
    downloads: assetsList.reduce((sum, a) => sum + a.downloads, 0),
  }
}
