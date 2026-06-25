'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Check, Twitter, Linkedin, MessageCircle, Mail, DollarSign, AlertCircle } from 'lucide-react'

interface Props {
  referralLink: string | null
  hasAffiliate: boolean
  earnings:     number
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function AffiliateClient({ referralLink, hasAffiliate, earnings }: Props) {
  const router                        = useRouter()
  const [isPending, startTransition]  = useTransition()
  const [joinError, setJoinError]     = useState<string | null>(null)
  const [payoutState, setPayoutState] = useState<'idle' | 'success' | 'error'>('idle')
  const [payoutLoading, setPayoutLoading] = useState(false)

  async function handleJoin() {
    setJoinError(null)
    const res = await fetch('/api/affiliate/join', { method: 'POST' })
    if (res.ok) {
      startTransition(() => router.refresh())
    } else {
      const data = await res.json().catch(() => ({}))
      setJoinError((data as { error?: string }).error ?? 'Failed to join affiliate program')
    }
  }

  async function handleRequestPayout() {
    if (earnings < 50) return
    setPayoutLoading(true)
    // Simulate payout request (replace with real API when payout backend exists)
    await new Promise((r) => setTimeout(r, 800))
    setPayoutLoading(false)
    setPayoutState('success')
  }

  if (!hasAffiliate) {
    return (
      <div className="text-center py-6">
        <p className="text-gray-400 text-sm mb-4">
          You haven&apos;t joined the affiliate program yet.
        </p>
        {joinError && <p className="text-red-400 text-sm mb-3">{joinError}</p>}
        <button
          onClick={handleJoin}
          disabled={isPending}
          className="bg-brand-600 hover:bg-brand-500 disabled:opacity-60 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
        >
          {isPending ? 'Joining…' : 'Join Affiliate Program'}
        </button>
      </div>
    )
  }

  const encodedLink = encodeURIComponent(referralLink ?? '')
  const shareText   = encodeURIComponent('Create viral reels with AI — use my referral link:')
  const shareItems = [
    {
      label: 'Twitter/X',
      href:  `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedLink}`,
      icon:  Twitter,
    },
    {
      label: 'LinkedIn',
      href:  `https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`,
      icon:  Linkedin,
    },
    {
      label: 'WhatsApp',
      href:  `https://wa.me/?text=${shareText}%20${encodedLink}`,
      icon:  MessageCircle,
    },
    {
      label: 'Email',
      href:  `mailto:?subject=Check+out+AI+ReelForge&body=${shareText}%20${encodedLink}`,
      icon:  Mail,
    },
  ]

  const canRequestPayout = earnings >= 50
  const earningsFormatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(earnings)

  return (
    <>
      {/* Referral link */}
      <div className="flex gap-2">
        <input
          readOnly
          value={referralLink ?? ''}
          className="input flex-1 font-mono text-sm"
        />
        <CopyButton text={referralLink ?? ''} />
      </div>

      {/* Share buttons */}
      <div className="flex flex-wrap gap-2 mt-3">
        {shareItems.map(({ label, href, icon: Icon }) => (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-surface-border hover:border-brand-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </a>
        ))}
      </div>

      {/* Payout request */}
      <div className="mt-5 pt-5 border-t border-surface-border">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium">
              Available balance:{' '}
              <span className={earnings > 0 ? 'text-green-400' : 'text-gray-400'}>{earningsFormatted}</span>
            </p>
            {!canRequestPayout && (
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Minimum $50.00 required to request a payout
              </p>
            )}
          </div>

          {payoutState === 'success' ? (
            <div className="flex items-center gap-2 bg-green-950/50 border border-green-800 text-green-400 text-sm font-medium px-4 py-2 rounded-lg">
              <Check className="w-4 h-4" />
              Payout requested! We&apos;ll process within 48 hours.
            </div>
          ) : (
            <button
              onClick={handleRequestPayout}
              disabled={!canRequestPayout || payoutLoading}
              className="flex items-center gap-2 bg-green-700 hover:bg-green-600 disabled:bg-surface disabled:border disabled:border-surface-border disabled:text-gray-600 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {payoutLoading ? (
                <span className="animate-pulse">Processing…</span>
              ) : (
                <><DollarSign className="w-4 h-4" /> Request Payout</>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
