import { Archive, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MovieLibraryStatus } from '../types'

const STATUS_META: Record<MovieLibraryStatus, { label: string; className: string; icon: typeof Clock; spin?: boolean }> = {
  COMPLETED: { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
  RENDERING: { label: 'Rendering', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: Loader2, spin: true },
  QUEUED: { label: 'Queued', className: 'bg-white/10 text-zinc-300 border-white/15', icon: Clock },
  FAILED: { label: 'Failed', className: 'bg-red-500/15 text-red-300 border-red-500/30', icon: XCircle },
  ARCHIVED: { label: 'Archived', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Archive },
}

export function MovieStatusBadge({ status, className }: { status: MovieLibraryStatus; className?: string }) {
  const meta = STATUS_META[status]
  const Icon = meta.icon

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        meta.className,
        className
      )}
    >
      <Icon className={cn('w-3 h-3', meta.spin && 'animate-spin')} />
      {meta.label}
    </span>
  )
}
