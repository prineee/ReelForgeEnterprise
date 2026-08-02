/**
 * GPUStatus.ts
 *
 * Shared types for gpu/GPUManager.ts. Since Sprint 4, GPUManager is real
 * (backed by services/gpu/GPUWorker.ts's genuine, non-fabricated status)
 * — these fields are honestly populated when a worker is configured, and
 * honestly empty/false when one isn't (see GPUManager.ts).
 */

export interface GPUHealth {
  available: boolean;
  healthy: boolean;
  message?: string;
}

export interface GPUMemoryUsage {
  totalMB?: number;
  usedMB?: number;
  freeMB?: number;
}

export interface GPUStatus {
  available: boolean;
  health: GPUHealth;
  memoryUsage: GPUMemoryUsage;
  queueDepth: number;
}
