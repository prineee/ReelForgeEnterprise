import { cn } from '@/lib/utils'

export function ProgressBar({
  percent,
  tone = 'brand',
  className,
}: {
  percent: number
  tone?: 'brand' | 'success' | 'danger'
  className?: string
}) {
  const toneClass =
    tone === 'success'
      ? 'bg-emerald-500'
      : tone === 'danger'
      ? 'bg-red-500'
      : 'bg-gradient-to-r from-brand-500 to-purple-500'

  const clamped = Math.min(100, Math.max(0, percent))

  return (
    <div className={cn('w-full h-2 rounded-full bg-white/10 overflow-hidden', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-700 ease-out', toneClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
