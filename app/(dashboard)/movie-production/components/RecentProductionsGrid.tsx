import { Clapperboard, Download, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProductionStatus } from '@/services/ai/orchestration/MovieProductionContracts'
import type { DashboardProduction } from '../types'
import { StatusChip } from './StatusChip'
import { FadeIn } from './FadeIn'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function RecentProductionsGrid({
  productions,
  onRetry,
}: {
  productions: DashboardProduction[]
  onRetry: (production: DashboardProduction) => void
}) {
  if (productions.length === 0) {
    return <EmptyState title="No recent productions" description="Completed and failed productions will appear here." />
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {productions.map((p, i) => (
        <FadeIn key={p.productionId} delayMs={i * 60}>
          <Card>
            <div className="aspect-video w-full rounded-t-3xl bg-gradient-to-br from-brand-950 to-purple-950 flex items-center justify-center border-b border-white/10">
              <Clapperboard className="w-8 h-8 text-white/20" />
            </div>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-white leading-snug">{p.movieTitle}</h3>
                <StatusChip status={p.status} />
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{formatDate(p.startedAt)}</span>
                <span>{formatDuration(p.elapsedSeconds)}</span>
                <span>{p.creditsUsed} credits</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  disabled={!p.downloadUrl}
                  onClick={() => p.downloadUrl && window.open(p.downloadUrl, '_blank', 'noopener,noreferrer')}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-brand-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-gray-300"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
                <button
                  disabled={p.status !== ProductionStatus.Failed}
                  onClick={() => onRetry(p)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-orange-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-gray-300"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      ))}
    </div>
  )
}
