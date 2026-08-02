import { Eye } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import type { DashboardProduction } from '../types'
import { STAGE_META } from '../stageMeta'
import { StatusChip } from './StatusChip'
import { ProgressBar } from './ProgressBar'

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  if (seconds <= 0) return '0s'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function ProductionQueueTable({
  productions,
  selectedProductionId,
  onSelect,
}: {
  productions: DashboardProduction[]
  selectedProductionId: string | null
  onSelect: (production: DashboardProduction) => void
}) {
  if (productions.length === 0) {
    return (
      <Card>
        <EmptyState title="No productions yet" description="Movies generated from Movie Studio will show up here." />
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3 font-medium">Production ID</th>
              <th className="px-4 py-3 font-medium">Movie Title</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Current Stage</th>
              <th className="px-4 py-3 font-medium w-40">Progress</th>
              <th className="px-4 py-3 font-medium">Elapsed</th>
              <th className="px-4 py-3 font-medium">ETA</th>
              <th className="px-4 py-3 font-medium">Credits</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {productions.map((p) => (
              <tr
                key={p.productionId}
                className={cn(
                  'border-b border-white/5 last:border-0 transition-colors hover:bg-white/[0.03]',
                  selectedProductionId === p.productionId && 'bg-brand-600/10'
                )}
              >
                <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.productionId.slice(0, 8)}…</td>
                <td className="px-4 py-3 font-medium text-white">
                  {p.movieTitle}
                  {p.isLive && <span className="ml-2 text-[10px] font-semibold text-emerald-400 align-middle">LIVE</span>}
                </td>
                <td className="px-4 py-3 text-gray-400">{p.userEmail}</td>
                <td className="px-4 py-3 text-gray-300">{p.currentStage ? STAGE_META[p.currentStage].label : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar
                      percent={p.progressPercent}
                      tone={p.status === 'FAILED' ? 'danger' : p.status === 'COMPLETED' ? 'success' : 'brand'}
                      className="w-24"
                    />
                    <span className="text-xs text-gray-400 tabular-nums">{p.progressPercent}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 tabular-nums">{formatDuration(p.elapsedSeconds)}</td>
                <td className="px-4 py-3 text-gray-400 tabular-nums">{formatDuration(p.etaSeconds)}</td>
                <td className="px-4 py-3 text-gray-300 tabular-nums">{p.creditsUsed}</td>
                <td className="px-4 py-3">
                  <StatusChip status={p.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onSelect(p)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:border-brand-600 hover:text-white"
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
