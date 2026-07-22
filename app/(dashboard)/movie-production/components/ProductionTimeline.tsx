import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProductionStatus } from '@/services/ai/orchestration/MovieProductionContracts'
import { cn } from '@/lib/utils'
import type { DashboardProduction } from '../types'

export function ProductionTimeline({ production }: { production: DashboardProduction | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Production Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {!production ? (
          <p className="text-sm text-gray-500">Select a production from the queue to see its timeline.</p>
        ) : (
          <ol className="relative space-y-0">
            {production.stages.map((entry, i) => {
              const isLast = i === production.stages.length - 1
              const isDone = entry.status === ProductionStatus.Completed
              const isRunning = entry.status === ProductionStatus.InProgress
              const isFailed = entry.status === ProductionStatus.Failed

              return (
                <li key={entry.stage} className="relative flex gap-3 pb-6 last:pb-0">
                  {!isLast && (
                    <span
                      className={cn(
                        'absolute left-[11px] top-6 h-full w-px',
                        isDone ? 'bg-emerald-500/40' : 'bg-white/10'
                      )}
                    />
                  )}
                  <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    {isFailed ? (
                      <XCircle className="w-5 h-5 text-red-400" />
                    ) : isDone ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : isRunning ? (
                      <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
                    ) : (
                      <Circle className="w-5 h-5 text-gray-600" />
                    )}
                  </span>
                  <div className="flex-1 pt-0.5">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        isDone ? 'text-white' : isRunning ? 'text-brand-300' : isFailed ? 'text-red-300' : 'text-gray-500'
                      )}
                    >
                      {entry.label}
                    </p>
                    {!isDone && !isRunning && !isFailed && (
                      <p className="text-xs text-gray-600">Waiting…</p>
                    )}
                    {isRunning && <p className="text-xs text-brand-400">In progress…</p>}
                    {isFailed && <p className="text-xs text-red-400">Failed</p>}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
