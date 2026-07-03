import Link from "next/link";

export default function AffiliateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Sidebar */}
      <aside className="w-72 border-r border-zinc-800 bg-zinc-950 p-6">
        <h2 className="mb-8 text-2xl font-bold">
          Affiliate Panel
        </h2>

        <nav className="space-y-2">
          <Link
            href="/affiliate/dashboard"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Dashboard
          </Link>

          <Link
            href="/affiliate/links"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Referral Links
          </Link>

          <Link
            href="/affiliate/sales"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Sales
          </Link>

          <Link
            href="/affiliate/payouts"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Payouts
          </Link>

          <Link
            href="/affiliate/payment-settings"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Payment Settings
          </Link>

          <Link
            href="/affiliate/marketing"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Marketing Materials
          </Link>

          <Link
            href="/affiliate/settings"
            className="block rounded-lg px-4 py-3 hover:bg-zinc-800"
          >
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}