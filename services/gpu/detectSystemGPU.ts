/**
 * detectSystemGPU.ts
 *
 * Real, best-effort local GPU hardware detection — no fabricated data.
 * On Windows, queries WMI (Win32_VideoController) via PowerShell, the
 * same mechanism `Get-CimInstance Win32_VideoController` uses directly.
 * On any other platform, or if the query fails for any reason, honestly
 * reports `detected: false` rather than guessing — "if no GPU exists,
 * return honest values" also means "if detection isn't possible here,
 * don't pretend it is."
 *
 * Synchronous by design: both GPUWorker (constructs its GPUInfo once at
 * startup) and GPUManager (constructs its DetectedGPU once at startup)
 * call this exactly once, at construction — not on any per-request path
 * — so a short blocking subprocess call here does not affect render
 * latency. Shared here so neither duplicates the detection logic.
 */

import { execSync } from "node:child_process";

export interface DetectedGPU {
  detected: boolean;
  name?: string;
  vramMB?: number;
  driverVersion?: string;
}

const DETECTION_TIMEOUT_MS = 3000;

export function detectSystemGPU(): DetectedGPU {
  if (process.platform !== "win32") {
    // TODO: add a Linux (lspci / nvidia-smi) and macOS (system_profiler) path.
    return { detected: false };
  }

  try {
    const stdout = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object -First 1 Name,AdapterRAM,DriverVersion | ConvertTo-Json"',
      { timeout: DETECTION_TIMEOUT_MS, encoding: "utf-8" }
    );
    const parsed = JSON.parse(stdout) as { Name?: string; AdapterRAM?: number; DriverVersion?: string };

    if (!parsed.Name) return { detected: false };

    return {
      detected: true,
      name: parsed.Name,
      vramMB: typeof parsed.AdapterRAM === "number" ? Math.round(parsed.AdapterRAM / (1024 * 1024)) : undefined,
      driverVersion: parsed.DriverVersion,
    };
  } catch {
    return { detected: false };
  }
}
