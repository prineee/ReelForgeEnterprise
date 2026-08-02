/**
 * AssetRecord.ts
 *
 * The shared vocabulary every module in this directory catalogs entries
 * as. Deliberately distinct from
 * services/ai/orchestration/MovieProductionContracts.ts's
 * ProductionArtifact — that type records what a production actually
 * generated (an IMAGE/VIDEO/AUDIO/etc. with a real url, surfaced through
 * /api/workflow/list to the existing Asset Manager UI at
 * app/(dashboard)/asset-manager/, untouched by this sprint). AssetRecord
 * catalogs planning-time entities (a character, a location, a shot
 * preset, a music cue plan, ...) which may or may not ever become a real
 * generated artifact. toProductionArtifact() below is a pure,
 * demonstrative mapping showing the two are compatible — not wired into
 * any route or UI this sprint.
 */

import type { ProductionArtifact, ProductionStage, StageId } from "../orchestration/MovieProductionContracts";

export type AssetKind =
  | "CHARACTER_REFERENCE"
  | "LOCATION_REFERENCE"
  | "SHOT_PRESET"
  | "TRANSITION_PRESET"
  | "MUSIC_CUE"
  | "VOICE_PROFILE"
  | "SCENE_PROMPT";

export interface AssetRecord {
  assetId: string;
  kind: AssetKind;
  /** The character/environment/scene id this asset belongs to, when applicable. */
  ownerEntityId?: string;
  label: string;
  url?: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}

const ASSET_KIND_TO_ARTIFACT_TYPE: Readonly<Record<AssetKind, ProductionArtifact["type"]>> = {
  CHARACTER_REFERENCE: "IMAGE",
  LOCATION_REFERENCE: "IMAGE",
  SHOT_PRESET: "SCRIPT",
  TRANSITION_PRESET: "SCRIPT",
  MUSIC_CUE: "AUDIO",
  VOICE_PROFILE: "AUDIO",
  SCENE_PROMPT: "SCRIPT",
};

/**
 * Demonstrates that AssetRecord is representable as the existing
 * ProductionArtifact contract — a straight field mapping, no new
 * behavior. Not called by any pipeline stage or route this sprint.
 */
export function toProductionArtifact(
  asset: AssetRecord,
  stageId: StageId,
  stage: ProductionStage
): ProductionArtifact {
  return {
    artifactId: asset.assetId,
    stageId,
    stage,
    type: ASSET_KIND_TO_ARTIFACT_TYPE[asset.kind],
    url: asset.url ?? "",
    createdAt: asset.createdAt,
    metadata: asset.metadata,
  };
}
