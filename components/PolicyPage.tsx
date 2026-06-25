import Link from 'next/link'
import { Video, ArrowLeft, Calendar } from 'lucide-react'

// ── Shell ─────────────────────────────────────────────────────────────────────

interface PolicyPageProps {
  title: string
  badge: string
  effectiveDate: string
  children: React.ReactNode
}

export default function PolicyPage({ title, badge, effectiveDate, children }: PolicyPageProps) {
  return (
    <div className="min-h-screen bg-surface text-white">
      {/* Nav */}
      <nav className="border-b border-surface-border backdrop-blur-md bg-surface/80 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">AI ReelForge</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative py-14 px-6 overflow-hidden border-b border-surface-border">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/40 via-transparent to-purple-950/20 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[250px] bg-brand-600/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-1.5 bg-brand-950 border border-brand-800 text-brand-300 text-xs font-medium px-3 py-1.5 rounded-full mb-5">
            {badge}
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4">
            <span className="gradient-text">{title}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Last updated: {effectiveDate}
            </span>
            <span className="hidden sm:inline text-gray-700">·</span>
            <span className="hidden sm:inline">reelforge.fabricaipro.com</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="px-6 py-12 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="card p-8 md:p-10">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-border py-8 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-brand-500 to-purple-500 flex items-center justify-center">
              <Video className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">AI ReelForge</span>
          </div>
          <p className="text-gray-500 text-xs order-last md:order-none">
            &copy; {new Date().getFullYear()} AI ReelForge. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
            <Link href="/terms"        className="hover:text-white transition-colors">Terms</Link>
            <Link href="/privacy"      className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/refund"       className="hover:text-white transition-colors">Refund</Link>
            <Link href="/cancellation" className="hover:text-white transition-colors">Cancellation</Link>
            <a href="mailto:support@fabricaipro.com" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

// ── Content helpers ───────────────────────────────────────────────────────────

export function MetaGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5 bg-surface rounded-xl border border-surface-border mb-8">
      {children}
    </div>
  )
}

export function MetaItem({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      {href ? (
        <a href={href} className="text-sm text-gray-300 hover:text-brand-400 transition-colors">
          {value}
        </a>
      ) : (
        <span className="text-sm text-gray-300">{value}</span>
      )}
    </div>
  )
}

export function Section({
  number,
  title,
  children,
}: {
  number: number
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-white mb-3 pl-3 border-l-2 border-brand-500 leading-snug">
        {number}. {title}
      </h2>
      {children}
    </section>
  )
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-gray-400 text-sm leading-7 mb-3">{children}</p>
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-200 mt-5 mb-2">{children}</h3>
  )
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-400 leading-relaxed">
          <span className="w-1 h-1 rounded-full bg-brand-400 mt-[7px] shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2 mb-4">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm text-gray-400 leading-relaxed">
          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand-950 border border-brand-800 text-brand-400 text-xs flex items-center justify-center font-semibold mt-0.5">
            {i + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

export function Bold({ children }: { children: React.ReactNode }) {
  return <strong className="text-gray-200 font-semibold">{children}</strong>
}

export function EmailLink({ address }: { address: string }) {
  return (
    <a
      href={`mailto:${address}`}
      className="text-brand-400 hover:text-brand-300 transition-colors"
    >
      {address}
    </a>
  )
}
