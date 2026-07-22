function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] border border-white/5 ${className ?? ''}`} />
}

export function MovieLibrarySkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Bone key={i} className="h-24" />
        ))}
      </div>
      <Bone className="h-11" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <Bone key={i} className="h-64" />
        ))}
      </div>
    </div>
  )
}
