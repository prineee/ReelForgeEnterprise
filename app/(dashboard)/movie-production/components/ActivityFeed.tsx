import { Activity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardProduction } from '../types'

export function ActivityFeed({ production }: { production: DashboardProduction | null }) {
  const entries = production?.activity ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-400" /> Activity Feed
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-gray-500">No activity logged for this production yet.</p>
        ) : (
          <ul className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {entries.map((entry, i) => {
              const isLatest = i === entries.length - 1
              return (
                <li key={entry.id} className="flex items-start gap-3 text-sm">
                  <span className="w-12 shrink-0 font-mono text-xs text-gray-500 pt-0.5">{entry.time}</span>
                  <span className="relative flex h-2 w-2 shrink-0 mt-1.5">
                    {isLatest && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500/60 opacity-75" />
                    )}
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${isLatest ? 'bg-brand-500' : 'bg-gray-600'}`} />
                  </span>
                  <span className={`flex-1 ${isLatest ? 'text-gray-200' : 'text-gray-400'}`}>{entry.message}</span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
