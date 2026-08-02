import type { ComponentType } from 'react'
import { CheckCircle2, Clock4, Film, HardDrive, Loader2, XCircle, Zap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { LibraryMetrics } from '../types'

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.round((totalSeconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

interface StatItem {
  label: string
  value: string | number
  icon: ComponentType<{ className?: string }>
  color: string
  bg: string
  spin?: boolean
}

export function MovieStats({ metrics }: { metrics: LibraryMetrics }) {
  const items: StatItem[] = [
    { label: 'Total Movies', value: metrics.totalMovies, icon: Film, color: 'text-brand-400', bg: 'bg-brand-950 border-brand-800' },
    { label: 'Completed', value: metrics.completed, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-950 border-emerald-800' },
    { label: 'Rendering', value: metrics.rendering, icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-950 border-blue-800', spin: true },
    { label: 'Failed', value: metrics.failed, icon: XCircle, color: 'text-red-400', bg: 'bg-red-950 border-red-800' },
    { label: 'Credits Consumed', value: metrics.creditsConsumed, icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-950 border-yellow-800' },
    { label: 'Total Duration', value: formatDuration(metrics.totalDurationSeconds), icon: Clock4, color: 'text-purple-400', bg: 'bg-purple-950 border-purple-800' },
    { label: 'Storage Used', value: formatBytes(metrics.storageUsedBytes), icon: HardDrive, color: 'text-cyan-400', bg: 'bg-cyan-950 border-cyan-800' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
      {items.map((item) => (
        <Card key={item.label} className="transition-transform duration-300 hover:-translate-y-0.5">
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
      ))}
    </div>
  )
}
