export default function AdminPage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-6">
        Admin Dashboard
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <a
          href="/admin/affiliate-payouts"
          className="rounded-xl border p-6 hover:bg-slate-900"
        >
          <h2 className="text-xl font-semibold">
            Affiliate Payouts
          </h2>
        </a>

        <a
          href="/admin/affiliate-leaderboard"
          className="rounded-xl border p-6 hover:bg-slate-900"
        >
          <h2 className="text-xl font-semibold">
            Affiliate Leaderboard
          </h2>
        </a>

        <a
          href="/admin/affiliate-analytics"
          className="rounded-xl border p-6 hover:bg-slate-900"
        >
          <h2 className="text-xl font-semibold">
            Affiliate Analytics
          </h2>
        </a>
      </div>
    </div>
  );
}