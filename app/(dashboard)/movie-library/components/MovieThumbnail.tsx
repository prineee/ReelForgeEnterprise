import { Clapperboard } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Poster art (or a gradient placeholder when none exists yet). */
export function MovieThumbnail({
  posterUrl,
  title,
  className,
  iconClassName,
}: {
  posterUrl: string | null
  title: string
  className?: string
  iconClassName?: string
}) {
  if (posterUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={posterUrl} alt={title} className={cn('object-cover', className)} />
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center bg-gradient-to-br from-brand-950 via-surface-card to-purple-950',
        className
      )}
    >
      <Clapperboard className={cn('text-white/20', iconClassName ?? 'w-8 h-8')} />
    </div>
  )
}
