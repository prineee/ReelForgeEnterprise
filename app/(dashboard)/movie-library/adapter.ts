/**
 * adapter.ts
 *
 * Task 7: "Workflow completion automatically creates a Movie entry" —
 * maps GET /api/workflow/list's response (WorkflowEngine's own registry,
 * via services/infrastructure/MovieProductionFactory.ts's shared
 * WorkflowEngine) onto LibraryMovie. No database, no separate "movie"
 * store: a workflow *is* the movie entry here, live. page.tsx fetches
 * this list and merges it ahead of the placeholder MOCK_MOVIES — real
 * workflows are never hidden behind demo data.
 *
 * Title, story summary, and character list are now read from the real
 * Story Package artifact MovieProductionService's Story Planning stage
 * produces (type "SCRIPT", a base64 data: URI of Gemini's actual output —
 * see MovieProductionService.buildStoryPackageArtifact()), not derived
 * from the raw user idea. Fields still not exposed anywhere (resolution,
 * per-scene duration, storage size) stay honestly defaulted — see the
 * comments below for exactly which.
 */

import type { AssetKey, LibraryMovie, MovieAsset, MovieLibraryStatus, StageTimelineEntry } from './types'

/** Matches one entry of GET /api/workflow/list's `workflows` array. */
export interface WorkflowListItem {
  workflowId: string
  userIdea: string
  status: string
  creditsReserved: number
  creditsConsumed: number
  artifacts: { artifactId: string; type: string; url: string; metadata?: Record<string, string | number | boolean> }[]
  errors: string[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface WorkflowListApiResponse {
  success: boolean
  workflows: WorkflowListItem[]
}

export async function fetchWorkflowList(): Promise<WorkflowListItem[]> {
  const res = await fetch('/api/workflow/list')
  const json = await res.json()
  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to fetch workflow list.')
  }
  return (json as WorkflowListApiResponse).workflows
}

/** The shape MovieProductionService.buildStoryPackageArtifact() encodes into the SCRIPT artifact's data: URI. */
interface StoryPackage {
  title: string
  logline: string
  genres: string[]
  synopsis: string
  characters: { id: string; name: string; description: string; personality: string[] }[]
  environments: { id: string; name: string; description: string; location: string }[]
  sceneOutline: { sceneNumber: number; title?: string; description: string }[]
}

/**
 * Base64 -> UTF-8 string. Plain atob() alone would misdecode any non-ASCII
 * character in Gemini's prose (em dashes, smart quotes, …) into mojibake —
 * atob() only recovers a "binary string" of raw byte values, so those
 * bytes need one more decode pass through TextDecoder to be read back as
 * the UTF-8 text MovieProductionService encoded them from.
 */
function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

/** Decodes the real Story Package from a workflow's SCRIPT artifact, if it has one yet. */
function decodeStoryPackage(item: WorkflowListItem): StoryPackage | null {
  const scriptArtifact = item.artifacts.find((a) => a.type === 'SCRIPT')
  if (!scriptArtifact) return null

  const match = /^data:application\/json;base64,(.+)$/.exec(scriptArtifact.url)
  if (!match) return null

  try {
    return JSON.parse(decodeBase64Utf8(match[1])) as StoryPackage
  } catch {
    return null
  }
}

function toLibraryStatus(status: string): MovieLibraryStatus {
  switch (status) {
    case 'COMPLETED':
      return 'COMPLETED'
    case 'FAILED':
    case 'CANCELLED':
      return 'FAILED'
    case 'CREATED':
    case 'VALIDATING':
    case 'QUEUED':
      return 'QUEUED'
    default:
      // RUNNING, RETRYING, PAUSED — actively in the pipeline (or waiting to resume).
      return 'RENDERING'
  }
}

/** Derives a short display title from the free-form idea — used only when no Story Package exists yet. */
function deriveTitle(userIdea: string): string {
  const trimmed = userIdea.trim()
  return trimmed.length > 60 ? `${trimmed.slice(0, 57)}…` : trimmed
}

const ASSET_LABELS: Record<AssetKey, string> = {
  story: 'Story',
  characterBible: 'Character Bible',
  referenceImages: 'Reference Images',
  sceneImages: 'Scene Images',
  videos: 'Videos',
  voice: 'Voice',
  subtitles: 'Subtitles',
  poster: 'Poster',
  thumbnail: 'Thumbnail',
}

/** Builds the asset checklist from real artifacts where MovieProductionService produces them, honest placeholders elsewhere — see Task 8's adapter for the richer version. */
function buildAssets(item: WorkflowListItem, story: StoryPackage | null): MovieAsset[] {
  const images = item.artifacts.filter((a) => a.type === 'IMAGE').length
  const videos = item.artifacts.filter((a) => a.type === 'VIDEO').length

  const available: Partial<Record<AssetKey, number | true>> = {}
  if (story) available.story = true
  if (story && story.characters.length > 0) available.characterBible = story.characters.length
  if (images > 0) available.referenceImages = images
  if (videos > 0) available.videos = videos

  return (Object.keys(ASSET_LABELS) as AssetKey[]).map((key) => ({
    key,
    label: ASSET_LABELS[key],
    available: available[key] !== undefined,
    count: typeof available[key] === 'number' ? (available[key] as number) : undefined,
  }))
}

const TIMELINE_LABELS = [
  'Story Planning',
  'Character Planning',
  'Environment Planning',
  'Camera Planning',
  'Emotion Planning',
  'Scene Planning',
  'Character Images',
  'Prompt Composition',
  'Video Generation',
  'Movie Assembly',
  'Final Rendering',
]

/** Coarse timeline from the list summary alone (no per-stage detail without a second fetch) — all-done when Completed, all-pending otherwise. */
function buildTimeline(status: string): StageTimelineEntry[] {
  const done = status === 'COMPLETED'
  return TIMELINE_LABELS.map((label) => ({ label, done }))
}

export function adaptWorkflowToLibraryMovie(item: WorkflowListItem): LibraryMovie {
  const videoArtifacts = item.artifacts.filter((a) => a.type === 'VIDEO')
  const story = decodeStoryPackage(item)

  return {
    productionId: item.workflowId,
    title: story?.title || deriveTitle(item.userIdea),
    posterUrl: null,
    createdAt: item.createdAt,
    // Not tracked by the list summary — real per-scene duration lives inside
    // MovieProductionService's artifacts, not surfaced at this list level.
    durationSeconds: 0,
    resolution: '1080x1920',
    status: toLibraryStatus(item.status),
    creditsUsed: item.creditsConsumed || item.creditsReserved,
    characterCount: story?.characters.length ?? 0,
    sceneCount: videoArtifacts.length,
    generationTimeSeconds: 0,
    prompt: item.userIdea,
    storySummary: story?.synopsis || story?.logline || item.userIdea,
    characters: story?.characters.map((c) => c.name) ?? [],
    keywords: story?.genres ?? [],
    assets: buildAssets(item, story),
    timeline: buildTimeline(item.status),
    storageBytes: 0,
    downloadUrl: videoArtifacts[0]?.url ?? null,
  }
}
