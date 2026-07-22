'use client'

import { useEffect, useMemo, useState } from 'react'
import { Boxes } from 'lucide-react'
import { MOCK_ASSETS, computeAssetMetrics } from './mockData'
import { FILTER_TO_TYPE } from './assetMeta'
import { fetchWorkflowList, adaptWorkflowsToAssets } from './adapter'
import type { AssetFilter, LibraryAsset } from './types'

const REAL_SYNC_INTERVAL_MS = 5000
import { AssetStats } from './components/AssetStats'
import { AssetSearch } from './components/AssetSearch'
import { AssetFilters } from './components/AssetFilters'
import { AssetGrid } from './components/AssetGrid'
import { AssetEmptyState } from './components/AssetEmptyState'
import { AssetLibrarySkeleton } from './components/AssetLibrarySkeleton'
import { AssetDetailsDrawer } from './components/AssetDetailsDrawer'

function matchesSearch(asset: LibraryAsset, query: string): boolean {
  if (!query.trim()) return true
  const q = query.trim().toLowerCase()
  return (
    asset.name.toLowerCase().includes(q) ||
    asset.movieTitle.toLowerCase().includes(q) ||
    (asset.characterName?.toLowerCase().includes(q) ?? false) ||
    (asset.sceneNumber !== null && `scene ${asset.sceneNumber}`.includes(q)) ||
    (asset.prompt?.toLowerCase().includes(q) ?? false)
  )
}

export default function AssetManagerPage() {
  const [loading, setLoading] = useState(true)
  const [assets, setAssets] = useState<LibraryAsset[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<AssetFilter>('all')
  const [selectedAsset, setSelectedAsset] = useState<LibraryAsset | null>(null)

  // Placeholder demo data — see mockData.ts. Brief simulated load so the
  // skeleton state is real, not skipped.
  useEffect(() => {
    const timer = setTimeout(() => {
      setAssets(MOCK_ASSETS)
      setLoading(false)
    }, 600)
    return () => clearTimeout(timer)
  }, [])

  // Task 8: "Workflow completion automatically publishes Generated
  // Assets" — every real artifact recorded on a WorkflowEngine workflow
  // (see /api/workflow/list) is merged ahead of the placeholder catalog,
  // re-synced on an interval so new assets show up as generation
  // progresses. See adapter.ts for exactly which asset types are real
  // today vs. still placeholder-only.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function sync() {
      try {
        const workflows = await fetchWorkflowList()
        if (cancelled) return

        const real = adaptWorkflowsToAssets(workflows)
        const realIds = new Set(real.map((a) => a.id))
        setAssets((prev) => [...real, ...prev.filter((a) => !realIds.has(a.id))])
      } catch {
        // Best-effort live sync — the placeholder catalog still renders if this fails (e.g. logged out, factory not configured).
      }
    }

    sync()
    timer = setInterval(sync, REAL_SYNC_INTERVAL_MS)
    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [])

  const metrics = useMemo(() => computeAssetMetrics(assets), [assets])

  const visibleAssets = useMemo(() => {
    return assets
      .filter((a) => (filter === 'all' || a.type === FILTER_TO_TYPE[filter]) && matchesSearch(a, search))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [assets, filter, search])

  function handleDuplicate(asset: LibraryAsset) {
    // Placeholder — no backend endpoint exists to actually duplicate an
    // asset yet. Wire this to a real POST /api/assets/duplicate once that
    // exists; for now it clones the row locally.
    const copy: LibraryAsset = {
      ...asset,
      id: `${asset.id}-copy-${Date.now()}`,
      name: `${asset.name} (Copy)`,
      createdAt: new Date().toISOString(),
      downloads: 0,
    }
    setAssets((prev) => [copy, ...prev])
  }

  function handleDelete(asset: LibraryAsset) {
    if (typeof window !== 'undefined' && !window.confirm(`Delete "${asset.name}"? This cannot be undone.`)) return
    setAssets((prev) => prev.filter((a) => a.id !== asset.id))
    setSelectedAsset((prev) => (prev && prev.id === asset.id ? null : prev))
  }

  return (
    <div className="max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-brand-950 via-surface-card to-purple-950/60 px-6 py-8 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shrink-0">
            <Boxes className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">AI Asset Manager</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage every generated production asset.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <AssetLibrarySkeleton />
      ) : (
        <>
          <AssetStats metrics={metrics} />

          <div className="flex flex-col sm:flex-row gap-3">
            <AssetSearch value={search} onChange={setSearch} />
          </div>
          <AssetFilters filter={filter} onFilterChange={setFilter} />

          {visibleAssets.length === 0 ? (
            <AssetEmptyState hasAnyAssets={assets.length > 0} />
          ) : (
            <AssetGrid assets={visibleAssets} onOpen={setSelectedAsset} onDuplicate={handleDuplicate} onDelete={handleDelete} />
          )}
        </>
      )}

      <AssetDetailsDrawer
        asset={selectedAsset}
        onClose={() => setSelectedAsset(null)}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />
    </div>
  )
}
