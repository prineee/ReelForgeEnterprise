import type { ComponentType } from 'react'
import { Book, Download, HardDrive, Image, Layers, Video, Voicemail } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { AssetMetrics } from '../types'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb.toFixed(1)} MB`
}

interface StatItem {
  label: string
  value: string | number
  icon: ComponentType<{ className?: string }>
  color: string
  bg: string
}

export function AssetStats({ metrics }: { metrics: AssetMetrics }) {
  const items: StatItem[] = [
    { label: 'Total Assets', value: metrics.totalAssets, icon: Layers, color: 'text-brand-400', bg: 'bg-brand-950 border-brand-800' },
    { label: 'Images', value: metrics.images, icon: Image, color: 'text-blue-400', bg: 'bg-blue-950 border-blue-800' },
    { label: 'Videos', value: metrics.videos, icon: Video, color: 'text-purple-400', bg: 'bg-purple-950 border-purple-800' },
    { label: 'Voice Files', value: metrics.voiceFiles, icon: Voicemail, color: 'text-emerald-400', bg: 'bg-emerald-950 border-emerald-800' },
    { label: 'Story Files', value: metrics.storyFiles, icon: Book, color: 'text-amber-400', bg: 'bg-amber-950 border-amber-800' },
    { label: 'Storage Used', value: formatBytes(metrics.storageUsedBytes), icon: HardDrive, color: 'text-cyan-400', bg: 'bg-cyan-950 border-cyan-800' },
    { label: 'Downloads', value: metrics.downloads, icon: Download, color: 'text-yellow-400', bg: 'bg-yellow-950 border-yellow-800' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
      {items.map((item) => (
        <Card key={item.label} className="transition-transform duration-300 hover:-translate-y-0.5">
          <CardContent className="flex flex-col gap-3">
            <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${item.bg}`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
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
