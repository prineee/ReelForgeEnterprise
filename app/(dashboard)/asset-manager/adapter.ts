/**
 * adapter.ts
 *
 * Task 8: "Workflow completion automatically publishes Generated Assets" —
 * maps GET /api/workflow/list's real ProductionArtifact entries (from
 * MovieProductionService, via WorkflowEngine's registry) onto LibraryAsset
 * rows. No database, no separate asset store: an artifact already
 * recorded on a WorkflowContext *is* the asset entry here.
 *
 * MovieProductionService produces artifacts of type SCRIPT (Stage 1 —
 * the real Gemini-generated Story Package, see
 * MovieProductionService.buildStoryPackageArtifact()), IMAGE (Stage 2 —
 * reference images), and VIDEO (Stage 4 — scene videos); Character
 * (as its own asset), Voice, Poster, and Thumbnail generation aren't
 * implemented stages yet (see MovieProductionService.ts's
 * IMPLEMENTED_STAGES). This adapter emits real rows only for what
 * genuinely exists and does not synthesize "not generated yet" cards for
 * the others (Character, Voice, Poster, Thumbnail) — those categories
 * simply don't appear in the grid until real generation for them lands,
 * rather than cluttering it with rows that don't correspond to anything
 * actually produced (Sprint 16, Task 4: no fabricated production data).
 */

import type { AssetType, LibraryAsset } from './types'

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

function assetTypeFor(artifactType: string): AssetType | null {
  switch (artifactType) {
    case 'SCRIPT':
      return 'STORY'
    case 'IMAGE':
      return 'REFERENCE_IMAGE'
    case 'VIDEO':
      return 'VIDEO'
    default:
      return null
  }
}

/** Fallback used only when the artifact's own metadata doesn't carry a real provider (Stage 4's video artifacts don't yet — see MovieProductionService.ts). */
function fallbackProviderFor(type: AssetType): string {
  switch (type) {
    case 'VIDEO':
      return 'Veo'
    case 'STORY':
      return 'Gemini'
    default:
      return 'Imagen'
  }
}

function deriveTitle(userIdea: string): string {
  const trimmed = userIdea.trim()
  return trimmed.length > 40 ? `${trimmed.slice(0, 37)}…` : trimmed
}

/** Approximate decoded byte size of a base64 data: URI payload — real enough for the Storage Used stat without decoding every artifact. */
function estimateDataUriBytes(url: string): number {
  const commaIndex = url.indexOf(',')
  if (!url.startsWith('data:') || commaIndex === -1) return 0
  const base64 = url.slice(commaIndex + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

/** Every real artifact across one workflow, mapped to LibraryAsset rows. */
export function adaptWorkflowToAssets(item: WorkflowListItem): LibraryAsset[] {
  const movieTitle = deriveTitle(item.userIdea)

  return item.artifacts
    .map((artifact, index): LibraryAsset | null => {
      const type = assetTypeFor(artifact.type)
      if (!type) return null

      const metadata = artifact.metadata ?? {}
      const sceneNumber = typeof metadata.sceneNumber === 'number' ? metadata.sceneNumber : null
      const title = typeof metadata.title === 'string' ? metadata.title : null

      // Real for REFERENCE_IMAGE — MovieProductionService.generateAndUploadReferenceAsset()
      // now captures these on every Imagen call (see buildArtifactMetadata()).
      // Other asset types don't carry this metadata yet, so they fall back
      // rather than being left blank.
      const prompt = typeof metadata.prompt === 'string' ? metadata.prompt : null
      const provider = typeof metadata.provider === 'string' ? metadata.provider : fallbackProviderFor(type)
      const generationTimeSeconds =
        typeof metadata.generationTimeMs === 'number' ? Math.round(metadata.generationTimeMs / 1000) : 0

      const name =
        type === 'STORY'
          ? `${title ?? movieTitle} — Story`
          : sceneNumber !== null
          ? `${movieTitle} — Scene ${sceneNumber}`
          : `${movieTitle} — ${type === 'VIDEO' ? 'Video' : 'Image'} ${index + 1}`

      return {
        id: artifact.artifactId,
        name,
        type,
        movieTitle,
        productionId: item.workflowId,
        characterName: null,
        sceneNumber,
        createdAt: item.updatedAt,
        resolution: typeof metadata.resolution === 'string' ? metadata.resolution : null,
        fileSizeBytes: type === 'STORY' ? estimateDataUriBytes(artifact.url) : 0,
        previewUrl: artifact.url,
        prompt,
        provider,
        generationTimeSeconds,
        creditsUsed: 0,
        downloads: 0,
      }
    })
    .filter((asset): asset is LibraryAsset => asset !== null)
}

/** Flattens every workflow's real assets into one list, newest first. */
export function adaptWorkflowsToAssets(items: WorkflowListItem[]): LibraryAsset[] {
  return items
    .flatMap(adaptWorkflowToAssets)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}
