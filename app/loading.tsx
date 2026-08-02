export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-orange-500" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
