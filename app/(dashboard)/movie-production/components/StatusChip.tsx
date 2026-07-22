import { Ban, CheckCircle2, Clock, Loader2, PauseCircle, RotateCcw, ShieldCheck, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const STATUS_META: Record<string, { label: string; className: string; icon: typeof Clock; spin?: boolean }> = {
  // AI-pipeline (ProductionStatus) values.
  QUEUED: { label: 'Queued', className: 'bg-white/10 text-zinc-300 border-white/15', icon: Clock },
  IN_PROGRESS: { label: 'Running', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: Loader2, spin: true },
  COMPLETED: { label: 'Completed', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
  FAILED: { label: 'Failed', className: 'bg-red-500/15 text-red-300 border-red-500/30', icon: XCircle },
  CANCELLED: { label: 'Cancelled', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Ban },
  // Workflow-only (WorkflowStatus) values not present in ProductionStatus.
  CREATED: { label: 'Created', className: 'bg-white/10 text-zinc-300 border-white/15', icon: Clock },
  VALIDATING: { label: 'Validating', className: 'bg-white/10 text-zinc-300 border-white/15', icon: ShieldCheck },
  RUNNING: { label: 'Running', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: Loader2, spin: true },
  PAUSED: { label: 'Paused', className: 'bg-orange-500/15 text-orange-300 border-orange-500/30', icon: PauseCircle },
  RETRYING: { label: 'Retrying', className: 'bg-purple-500/15 text-purple-300 border-purple-500/30', icon: RotateCcw, spin: true },
}

const FALLBACK_META = { label: 'Unknown', className: 'bg-white/10 text-zinc-300 border-white/15', icon: Clock, spin: false }

export function StatusChip({ status, className }: { status: string; className?: string }) {
  const meta = STATUS_META[status] ?? FALLBACK_META
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
