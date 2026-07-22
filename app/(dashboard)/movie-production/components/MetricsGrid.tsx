import type { ComponentType } from 'react'
import { CheckCircle2, Film, Loader2, Timer, XCircle, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { DashboardMetrics } from '../types'
import { FadeIn } from './FadeIn'

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

interface MetricItem {
  label: string
  value: string | number
  icon: ComponentType<{ className?: string }>
  color: string
  bg: string
  spin?: boolean
}

export function MetricsGrid({ metrics }: { metrics: DashboardMetrics }) {
  const items: MetricItem[] = [
    { label: 'Total Productions', value: metrics.totalProductions, icon: Film, color: 'text-brand-400', bg: 'bg-brand-950 border-brand-800' },
    { label: 'Running', value: metrics.running, icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-950 border-blue-800', spin: true },
    { label: 'Completed', value: metrics.completed, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950 border-emerald-800' },
    { label: 'Failed', value: metrics.failed, icon: XCircle, color: 'text-red-400', bg: 'bg-red-950 border-red-800' },
    { label: 'Avg Render Time', value: formatDuration(metrics.averageRenderTimeSeconds), icon: Timer, color: 'text-purple-400', bg: 'bg-purple-950 border-purple-800' },
    { label: 'Credits Used Today', value: metrics.creditsUsedToday, icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-950 border-yellow-800' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item, i) => (
        <FadeIn key={item.label} delayMs={i * 60}>
          <Card>
            <CardContent className="flex flex-col gap-3">
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${item.bg}`}>
                <item.icon className={`w-5 h-5 ${item.color} ${item.spin ? 'animate-spin' : ''}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-white">{item.value}</p>
                <p className="text-xs text-gray-500">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      ))}
    </div>
  )
}
