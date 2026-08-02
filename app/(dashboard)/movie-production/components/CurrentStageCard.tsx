import { Clapperboard } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardProduction } from '../types'
import { STAGE_META } from '../stageMeta'
import { ProgressBar } from './ProgressBar'

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export function CurrentStageCard({ production }: { production: DashboardProduction | null }) {
  if (!production) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Stage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Select a production from the queue to see stage details.</p>
        </CardContent>
      </Card>
    )
  }

  const fallbackMeta = production.currentStage ? STAGE_META[production.currentStage as keyof typeof STAGE_META] : undefined
  const stageLabel = production.currentStageLabel ?? fallbackMeta?.label
  const stageDescription = fallbackMeta?.description
  const isTerminal = production.status === 'COMPLETED' || production.status === 'FAILED' || production.status === 'CANCELLED'
  const estimatedFinish =
    !isTerminal && production.etaSeconds !== null
      ? new Date(Date.now() + production.etaSeconds * 1000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : '—'

  return (
    <Card className="bg-gradient-to-br from-brand-950/60 via-surface-card to-surface-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clapperboard className="w-5 h-5 text-brand-400" /> Current Stage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-2xl font-bold text-white">{stageLabel ?? 'Complete'}</p>
          <p className="text-sm text-gray-400 mt-1">{stageDescription ?? 'All pipeline stages have finished.'}</p>
        </div>

        <ProgressBar
          percent={production.progressPercent}
          tone={production.status === 'FAILED' ? 'danger' : production.status === 'COMPLETED' ? 'success' : 'brand'}
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Started</p>
            <p className="text-gray-200 font-medium">{formatClock(production.startedAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Elapsed</p>
            <p className="text-gray-200 font-medium">{formatDuration(production.elapsedSeconds)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Est. Finish</p>
            <p className="text-gray-200 font-medium">{estimatedFinish}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Current Scene</p>
            <p className="text-gray-200 font-medium">{production.currentSceneNumber ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Total Scenes</p>
            <p className="text-gray-200 font-medium">{production.totalScenes ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Progress</p>
            <p className="text-gray-200 font-medium">{production.progressPercent}%</p>
          </div>
          {production.retryCount !== undefined && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Retries</p>
              <p className={production.retryCount > 0 ? 'text-amber-300 font-medium' : 'text-gray-200 font-medium'}>
                {production.retryCount}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
