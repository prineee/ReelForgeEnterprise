/**
 * ProviderCapabilities.ts
 *
 * VGE-01 (Generative Video Engine V1, foundation phase): the declarative
 * capability/pricing/availability model referenced from ProviderRegistry.ts.
 * Pure data + pure functions only — no SDK imports, no network calls, no
 * provider-selection logic. Deciding *which* provider to use for a given
 * shot is the provider router's job (explicitly out of scope for VGE-01 —
 * see ShotRequirement.ts's file header); this file only describes what
 * each provider *can* do, so that future router can make an informed
 * choice instead of assuming a lowest-common-denominator interface.
 *
 * Capability values below were verified against each provider's actual
 * wiring in this codebase (services/infrastructure/MovieProductionFactory.ts,
 * services/ai/providers/ltx/LTXVideoClient.ts) as of VGE-01 — not against
 * what the underlying vendor API is theoretically capable of. Concretely:
 * Veo 3.1 itself supports image-to-video and first/last-frame
 * interpolation, but this codebase's GoogleGenAIVeoClient never actually
 * sends those fields to the API (see VGE-01's design doc) — so
 * `imageToVideo`/`firstLastFrame` are recorded false for GOOGLE here,
 * reflecting what this integration can actually do today, not the
 * vendor's ceiling. Update this table, not just the vendor's own docs,
 * whichever changes first.
 */

import type { ProviderId } from "./interfaces/RenderProvider";

/**
 * Whether a provider is safe to route real traffic to. Distinct from
 * RenderProvider registration (services/rendering/ProviderRegistry.ts) —
 * a provider can be *registered* (so the architecture is addressable)
 * without being *available* (credentialed and implemented for real).
 */
export enum ProviderAvailabilityStatus {
  /** Credentialed, implemented, safe to route real requests to. */
  Available = "AVAILABLE",
  /** Registered and typed, but no real backend exists yet (NotImplementedRenderProvider). */
  Placeholder = "PLACEHOLDER",
  /** A real integration exists but required credentials aren't configured in this environment. */
  NotConfigured = "NOT_CONFIGURED",
}

/**
 * Declarative capability flags. Every field is a plain boolean describing
 * whether *this codebase's integration* can do the thing today — see the
 * file header for why that's a different question from "can the vendor's
 * API do it."
 */
export interface ProviderCapabilityFlags {
  readonly textToVideo: boolean;
  readonly imageToVideo: boolean;
  /** Conditioning generation on one or more persistent reference images (e.g. for character/style consistency), distinct from a single image-to-video starting frame. */
  readonly referenceImage: boolean;
  /** First+last frame interpolation (a distinct capability from plain image-to-video — see VGE-01's design doc). */
  readonly firstLastFrame: boolean;
  /** Continuing an already-generated clip beyond its original length. */
  readonly extension: boolean;
  /** A structured camera-motion parameter the API accepts directly, as opposed to camera intent only reachable via prompt text. */
  readonly cameraControl: boolean;
  /** Synchronized audio (dialogue/SFX/ambience) generated as part of the video itself, not composited afterward. */
  readonly nativeAudio: boolean;
}

export interface ProviderPricingMetadata {
  readonly currency: "USD";
  /** Baseline price per second of output at this provider's default/lowest resolution tier. Placeholder planning data, not billing truth — see CreditCalculator.ts for the actual charge computation. */
  readonly perSecondUsd: number;
  /** Free-text note on tiering/resolution sensitivity not captured by the single perSecondUsd figure. */
  readonly notes?: string;
}

/**
 * Everything the (not-yet-built) provider router needs to know about one
 * provider before choosing it for a shot. Every field is readonly,
 * matching the runtime Object.freeze() PROVIDER_DESCRIPTORS applies to
 * every descriptor below — "no mutation of provider capability
 * definitions" is enforced at both the type level and the runtime level,
 * not just by convention.
 */
export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly name: string;
  readonly availability: ProviderAvailabilityStatus;
  readonly capabilities: ProviderCapabilityFlags;
  readonly maxResolution: string;
  readonly supportedDurations: readonly number[];
  readonly supportedAspectRatios: readonly string[];
  readonly pricing: ProviderPricingMetadata;
}

function noCapabilities(): ProviderCapabilityFlags {
  return {
    textToVideo: false,
    imageToVideo: false,
    referenceImage: false,
    firstLastFrame: false,
    extension: false,
    cameraControl: false,
    nativeAudio: false,
  };
}

function placeholderDescriptor(id: ProviderId, name: string): ProviderDescriptor {
  return Object.freeze({
    id,
    name,
    availability: ProviderAvailabilityStatus.Placeholder,
    capabilities: Object.freeze(noCapabilities()),
    maxResolution: "UNKNOWN",
    supportedDurations: Object.freeze([]),
    supportedAspectRatios: Object.freeze([]),
    pricing: Object.freeze({
      currency: "USD" as const,
      perSecondUsd: 0,
      notes: "Placeholder provider — not implemented (see NotImplementedRenderProvider).",
    }),
  });
}

/**
 * One descriptor per rendering-layer ProviderId (services/rendering/interfaces/RenderProvider.ts).
 * Frozen (including every nested object) so "no mutation of provider
 * capability definitions" holds structurally, not just by convention —
 * see ProviderRegistry.getDescriptor()'s doc comment for why callers get
 * this object directly rather than a defensive copy.
 */
export const PROVIDER_DESCRIPTORS: Readonly<Record<ProviderId, ProviderDescriptor>> = Object.freeze({
  LTX: Object.freeze({
    id: "LTX",
    name: "LTX (Lightricks)",
    availability: ProviderAvailabilityStatus.Available,
    capabilities: Object.freeze({
      ...noCapabilities(),
      textToVideo: true,
    }),
    maxResolution: "1080p",
    supportedDurations: Object.freeze([8]),
    supportedAspectRatios: Object.freeze(["16:9", "9:16", "1:1"]),
    pricing: Object.freeze({
      currency: "USD" as const,
      perSecondUsd: 0,
      notes: "Not published — Lightricks' own commercial terms were not confirmed as of VGE-01's design doc; verify before using this figure for real pricing decisions.",
    }),
  }),
  GOOGLE: Object.freeze({
    id: "GOOGLE",
    name: "Google Veo 3.1",
    availability: ProviderAvailabilityStatus.Available,
    capabilities: Object.freeze({
      ...noCapabilities(),
      textToVideo: true,
      // VGE-02: GoogleGenAIVeoClient now actually sends image/lastFrame/
      // referenceImages/video(extension)/generateAudio to the real SDK
      // call (see MovieProductionFactory.ts's validateVeoRequest()/
      // toSdkAsset()) — these five flip to true as of VGE-02, reflecting
      // real wiring, not the vendor's theoretical ceiling.
      imageToVideo: true,
      referenceImage: true,
      firstLastFrame: true,
      extension: true,
      nativeAudio: true,
      // cameraControl stays false: Veo has no structured camera parameter
      // in this SDK version — camera intent only ever reaches it as
      // prompt text (see ShotRequirementTranslator.ts), which is exactly
      // what this flag is defined to distinguish from a real API param.
    }),
    maxResolution: "1080p",
    supportedDurations: Object.freeze([4, 6, 8]),
    supportedAspectRatios: Object.freeze(["16:9", "9:16"]),
    pricing: Object.freeze({
      currency: "USD" as const,
      perSecondUsd: 0.4,
      notes: "Veo 3.1 Standard, 720p/1080p tier — see VGE-01 design doc for the full per-tier table (Fast/Lite are cheaper, 4k is more).",
    }),
  }),
  LOCAL_GPU: placeholderDescriptor("LOCAL_GPU", "Local GPU"),
  GPU_CLUSTER: placeholderDescriptor("GPU_CLUSTER", "GPU Cluster"),
  WAN: placeholderDescriptor("WAN", "Wan"),
  HUNYUAN: placeholderDescriptor("HUNYUAN", "Hunyuan"),
  COGVIDEO: placeholderDescriptor("COGVIDEO", "CogVideo"),
});

const KNOWN_PROVIDER_IDS = Object.keys(PROVIDER_DESCRIPTORS) as ProviderId[];

/**
 * Normalizes a possibly-loosely-cased/whitespace-padded string into a real
 * ProviderId, or undefined if it doesn't match any known provider —
 * callers decide whether that's an error (see ProviderRegistry.resolveId()).
 * Never throws.
 */
export function normalizeProviderId(raw: string): ProviderId | undefined {
  const candidate = raw.trim().toUpperCase();
  return KNOWN_PROVIDER_IDS.find((id) => id === candidate);
}

/**
 * The provider id that will actually execute a video generation right
 * now, per the VIDEO_PROVIDER env var — the same GOOGLE/LTX resolution
 * logic already duplicated in MovieProductionFactory.resolveVideoProvider()
 * and ProviderSelector.select(), given one shared, exported home so a
 * caller that isn't already inside one of those two files (billing, in
 * particular — see WorkflowExecutor.ts) has a correct, single source of
 * truth instead of a third independent copy of the same env-var check.
 */
export function resolveActiveVideoProviderId(): ProviderId {
  return process.env.VIDEO_PROVIDER?.toUpperCase() === "LTX" ? "LTX" : "GOOGLE";
}
