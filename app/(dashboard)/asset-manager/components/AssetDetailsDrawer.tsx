'use client'

import { useEffect, useState } from 'react'
import { Check, Clock4, Copy, Download, Server, Trash2, X, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LibraryAsset } from '../types'
import { AssetPreview } from './AssetPreview'
import { AssetTypeBadge } from './AssetTypeBadge'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export function AssetDetailsDrawer({
  asset,
  onClose,
  onDuplicate,
  onDelete,
}: {
  asset: LibraryAsset | null
  onClose: () => void
  onDuplicate: (asset: LibraryAsset) => void
  onDelete: (asset: LibraryAsset) => void
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCopied(false)
  }, [asset])

  useEffect(() => {
    if (!asset) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [asset, onClose])

  async function handleCopyPrompt() {
    if (!asset?.prompt) return
    try {
      await navigator.clipboard.writeText(asset.prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be denied by the browser — silently ignored,
      // nothing else to do about it here.
    }
  }

  return (
    <div
      aria-hidden={!asset}
      className={cn(
        'fixed inset-0 z-50 transition-opacity duration-300',
        asset ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      )}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className={cn(
          'absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-surface shadow-2xl transition-transform duration-300 ease-out',
          asset ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {asset && (
          <>
            <div className="relative border-b border-white/10">
              <AssetPreview asset={asset} />
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/70"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="absolute left-4 bottom-4">
                <AssetTypeBadge type={asset.type} />
              </div>
            </div>

            <div className="p-6 space-y-8">
              <div>
                <h2 className="text-xl font-bold text-white">{asset.name}</h2>
                <p className="mt-1 text-xs text-brand-400">{asset.movieTitle}</p>
              </div>

              {/* Metadata */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Metadata</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Field label="Created" value={formatDate(asset.createdAt)} />
                  <Field label="Resolution" value={asset.resolution ?? '—'} />
                  <Field label="File Size" value={formatBytes(asset.fileSizeBytes)} />
                  <Field label="Character" value={asset.characterName ?? '—'} />
                  <Field label="Scene" value={asset.sceneNumber !== null ? `Scene ${asset.sceneNumber}` : '—'} />
                  <Field label="Production ID" value={`${asset.productionId.slice(0, 8)}…`} mono />
                </div>
              </div>

              {/* Prompt */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prompt</h3>
                  {asset.prompt && (
                    <button
                      onClick={handleCopyPrompt}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 transition-colors hover:text-white"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy Prompt'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-300 leading-relaxed">{asset.prompt ?? 'No prompt recorded for this asset.'}</p>
              </div>

              {/* Provider / Generation Time / Credits Used */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <Stat icon={Server} label="Provider" value={asset.provider} />
                <Stat icon={Clock4} label="Gen. Time" value={formatDuration(asset.generationTimeSeconds)} />
                <Stat icon={Zap} label="Credits Used" value={asset.creditsUsed} />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <a
                  href={asset.previewUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={!asset.previewUrl}
                  onClick={(e) => {
                    if (!asset.previewUrl) e.preventDefault()
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-brand-600"
                >
                  <Download className="w-4 h-4" /> Download
                </a>
                <button
                  onClick={() => onDuplicate(asset)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-blue-600 hover:text-white"
                >
                  <Copy className="w-4 h-4" /> Duplicate
                </button>
                <button
                  onClick={() => onDelete(asset)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-red-600 hover:text-red-300"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className={cn('text-gray-200 font-medium', mono && 'font-mono text-xs')}>{value}</p>
    </div>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Server; label: string; value: string | number }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-gray-500">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-0.5 font-semibold text-white truncate">{value}</p>
    </div>
  )
}
