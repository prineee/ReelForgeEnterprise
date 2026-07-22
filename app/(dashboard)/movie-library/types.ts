/**
 * Movie Library's display model. `productionId` lines up 1:1 with the real
 * ProductionId (services/ai/orchestration/MovieProductionContracts.ts) so a
 * card can later be resolved back to a live production via the existing
 * GET /api/movie/status/[productionId] route. Every other field here isn't
 * exposed by any existing API yet (title, poster, story summary, per-asset
 * availability, storage size, …) — see mockData.ts for the placeholder
 * source, kept in this exact shape so wiring a real list endpoint later is
 * a drop-in data-source swap, no component changes required.
 */

export type MovieLibraryStatus = 'COMPLETED' | 'RENDERING' | 'QUEUED' | 'FAILED' | 'ARCHIVED'

export type AssetKey =
  | 'story'
  | 'characterBible'
  | 'referenceImages'
  | 'sceneImages'
  | 'videos'
  | 'voice'
  | 'subtitles'
  | 'poster'
  | 'thumbnail'

export interface MovieAsset {
  key: AssetKey
  label: string
  available: boolean
  count?: number
}

export interface StageTimelineEntry {
  label: string
  done: boolean
}

export interface LibraryMovie {
  productionId: string
  title: string
  posterUrl: string | null
  createdAt: string
  durationSeconds: number
  resolution: string
  status: MovieLibraryStatus
  creditsUsed: number
  characterCount: number
  sceneCount: number
  generationTimeSeconds: number
  prompt: string
  storySummary: string
  characters: string[]
  keywords: string[]
  assets: MovieAsset[]
  timeline: StageTimelineEntry[]
  storageBytes: number
  downloadUrl: string | null
}

export interface LibraryMetrics {
  totalMovies: number
  completed: number
  rendering: number
  failed: number
  creditsConsumed: number
  totalDurationSeconds: number
  storageUsedBytes: number
}

export type SortOption = 'newest' | 'oldest' | 'longest' | 'shortest' | 'credits' | 'alphabetical'
export type FilterOption = 'all' | 'completed' | 'rendering' | 'queued' | 'failed' | 'archived'
