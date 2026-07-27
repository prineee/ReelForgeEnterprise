'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Clapperboard } from 'lucide-react'
import { fetchWorkflowStatus, adaptWorkflowStatusResponse } from './adapter'
import { computeMetrics } from './mockData'
import type { DashboardProduction } from './types'
import { EmptyState } from '@/components/ui/EmptyState'
import { FadeIn } from './components/FadeIn'
import { MetricsGrid } from './components/MetricsGrid'
import { ProductionQueueTable } from './components/ProductionQueueTable'
import { ProductionTimeline } from './components/ProductionTimeline'
import { CurrentStageCard } from './components/CurrentStageCard'
import { RecentProductionsGrid } from './components/RecentProductionsGrid'
import { ActivityFeed } from './components/ActivityFeed'

const LIVE_POLL_INTERVAL_MS = 2000
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED']

export default function MovieProductionDashboardPage() {
  const [productions, setProductions] = useState<DashboardProduction[]>([])
  const [selectedProductionId, setSelectedProductionId] = useState<string | null>(null)
  const [liveError, setLiveError] = useState('')

  // Real integration: if a ?productionId= is present (e.g. carried over from
  // Movie Studio), poll GET /api/workflow/status/[workflowId] every 2s via
  // adapter.ts and merge it into the queue as a live row. The id works for
  // both routes — WorkflowExecutor.runAiPipeline() reuses the workflow's id
  // as the underlying MovieProductionService productionId — but this one
  // carries Task 6's full picture (retry count, ETA, credits, PAUSED/
  // RETRYING status) that the AI-pipeline-only route can't.
  useEffect(() => {
    const workflowId = new URLSearchParams(window.location.search).get('productionId')
    if (!workflowId) return

    const startedAt = new Date().toISOString()
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null

    async function poll() {
      try {
        const response = await fetchWorkflowStatus(workflowId!)
        if (cancelled) return

        const live = adaptWorkflowStatusResponse(response, {
          movieTitle: 'Live Production',
          userEmail: 'you',
          startedAt,
        })

        setProductions((prev) => [live, ...prev.filter((p) => p.productionId !== live.productionId)])
        setSelectedProductionId(live.productionId)
        setLiveError('')

        if (TERMINAL_STATUSES.includes(response.status) && timer) {
          clearInterval(timer)
        }
      } catch (err) {
        if (!cancelled) setLiveError(err instanceof Error ? err.message : 'Failed to sync live production.')
      }
    }

    poll()
    timer = setInterval(poll, LIVE_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
    }
  }, [])

  const handleSelect = useCallback((production: DashboardProduction) => {
    setSelectedProductionId(production.productionId)
  }, [])

  const handleRetry = useCallback((production: DashboardProduction) => {
    // Placeholder — MovieProductionService.retryStage() exists but no route
    // exposes it yet, and this task does not add backend endpoints. Wire
    // this to a real POST /api/movie/retry/[productionId] once that exists.
    console.info(`Retry requested for production "${production.productionId}" — not wired to a backend endpoint yet.`)
  }, [])

  const selectedProduction = productions.find((p) => p.productionId === selectedProductionId) ?? null
  const recentProductions = productions.filter((p) => p.status === 'COMPLETED' || p.status === 'FAILED')
  const metrics = computeMetrics(productions)

  return (
    <div className="max-w-[1600px] space-y-6">
      {/* Header */}
      <FadeIn>
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-brand-950 via-surface-card to-purple-950/60 px-6 py-8 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center shrink-0">
              <Clapperboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Movie Production Center</h1>
              <p className="text-sm text-gray-400 mt-0.5">Monitor every AI movie being generated.</p>
            </div>
          </div>
        </div>
      </FadeIn>

      {liveError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {liveError}
        </div>
      )}

      {productions.length === 0 ? (
        <EmptyState
          icon={<Clapperboard className="w-7 h-7" />}
          title="Not enough render history yet"
          description="Start a movie from Movie Studio and it will appear here live while it's generating."
        />
      ) : (
        <>
          {/* Top Metrics */}
          <MetricsGrid metrics={metrics} />

          {/* Live Production Queue */}
          <FadeIn delayMs={80}>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Live Production Queue</h2>
              <ProductionQueueTable
                productions={productions}
                selectedProductionId={selectedProductionId}
                onSelect={handleSelect}
              />
            </section>
          </FadeIn>

          {/* Timeline + Current Stage */}
          <FadeIn delayMs={120}>
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
              <ProductionTimeline production={selectedProduction} />
              <CurrentStageCard production={selectedProduction} />
            </div>
          </FadeIn>

          {/* Recent Productions */}
          <FadeIn delayMs={160}>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-white">Recent Productions</h2>
              <RecentProductionsGrid productions={recentProductions} onRetry={handleRetry} />
            </section>
          </FadeIn>

          {/* Activity Feed */}
          <FadeIn delayMs={200}>
            <ActivityFeed production={selectedProduction} />
          </FadeIn>
        </>
      )}
    </div>
  )
}
