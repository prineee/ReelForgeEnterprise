function Bone({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-white/[0.04] border border-white/5 ${className ?? ''}`} />
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Bone key={i} className="h-24" />
        ))}
      </div>
      <Bone className="h-64" />
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        <Bone className="h-96" />
        <Bone className="h-96" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Bone key={i} className="h-56" />
        ))}
      </div>
      <Bone className="h-64" />
    </div>
  )
}
