"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { PromptViewerData } from "@/services/infrastructure/SceneStudioFactory";

export interface PromptViewerPanelProps {
  prompt: PromptViewerData;
}

/**
 * Module 9 — read-only. Displays DirectorPromptPipeline's real, already-
 * composed SceneGenerationRequest (positivePrompt/negativePrompt/aspectRatio/
 * quality/expectedDuration) — never recomposes a prompt, never edits one.
 * Copy-to-clipboard is the only interactivity.
 */
export function PromptViewerPanel({ prompt }: PromptViewerPanelProps) {
  if (!prompt.positivePrompt) {
    return <p className="text-xs text-zinc-500">Not generated yet — available once this scene reaches Scene Prompt Building.</p>;
  }

  return (
    <div className="space-y-4 text-xs">
      <PromptBlock label="Positive Prompt" text={prompt.positivePrompt} />
      {prompt.negativePrompt && <PromptBlock label="Negative Prompt" text={prompt.negativePrompt} />}

      <div className="grid grid-cols-3 gap-3">
        <Meta label="Aspect Ratio" value={prompt.aspectRatio ?? "—"} />
        <Meta label="Quality" value={prompt.quality ?? "—"} />
        <Meta label="Expected Duration" value={prompt.expectedDuration !== undefined ? `${prompt.expectedDuration}s` : "—"} />
      </div>
    </div>
  );
}

function PromptBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] text-zinc-400 hover:bg-white/5"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.02] p-3 text-zinc-300">{text}</p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-0.5 text-zinc-300">{value}</p>
    </div>
  );
}

export default PromptViewerPanel;
