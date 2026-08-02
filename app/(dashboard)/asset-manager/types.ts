/**
 * Asset Manager's display model. `productionId` lines up 1:1 with the real
 * ProductionId (services/ai/orchestration/MovieProductionContracts.ts) so
 * an asset can later be resolved back to its production via the existing
 * GET /api/movie/status/[productionId] route. No endpoint currently lists
 * individual generated assets, so every field here mirrors what a future
 * asset-listing endpoint would plausibly return, kept in this exact shape
 * so wiring a real source later is a drop-in data swap — see mockData.ts.
 */

export type AssetType =
  | 'STORY'
  | 'CHARACTER'
  | 'REFERENCE_IMAGE'
  | 'SCENE_IMAGE'
  | 'VIDEO'
  | 'VOICE'
  | 'MUSIC'
  | 'SUBTITLE'
  | 'POSTER'
  | 'THUMBNAIL'

export interface LibraryAsset {
  id: string
  name: string
  type: AssetType
  movieTitle: string
  productionId: string
  characterName: string | null
  sceneNumber: number | null
  createdAt: string
  resolution: string | null
  fileSizeBytes: number
  previewUrl: string | null
  prompt: string | null
  provider: string
  generationTimeSeconds: number
  creditsUsed: number
  downloads: number
}

export interface AssetMetrics {
  totalAssets: number
  images: number
  videos: number
  voiceFiles: number
  storyFiles: number
  storageUsedBytes: number
  downloads: number
}

export type AssetFilter =
  | 'all'
  | 'story'
  | 'character'
  | 'reference_image'
  | 'scene_image'
  | 'video'
  | 'voice'
  | 'music'
  | 'subtitle'
  | 'poster'
  | 'thumbnail'
