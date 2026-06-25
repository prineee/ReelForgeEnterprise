import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, DollarSign, TrendingUp, Gift } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import AffiliateClient from './AffiliateClient'

export const metadata = { title: 'Affiliate' }

export default async function AffiliatePage() {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: affiliate } = await (supabase.from('affiliates') as any)
    .select('*')
    .eq('user_id', user.id)
    .single() as { data: { referral_code: string; commission: number; earnings: number } | null }

  // Count referred users via admin client (bypasses RLS on users table)
  let referredCount = 0
  if (affiliate?.referral_code) {
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (admin.from('users') as any)
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', affiliate.referral_code) as { count: number | null }
    referredCount = count ?? 0
  }

  const siteUrl     = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aireelforge.com'
  const referralLink = affiliate ? `${siteUrl}/register?ref=${affiliate.referral_code}` : null

  const stats = [
    {
      label: 'Total Earnings',
      value: formatCurrency(affiliate?.earnings ?? 0),
      icon:  DollarSign,
      color: 'text-green-400',
      bg:    'bg-green-950 border-green-800',
    },
    {
      label: 'Commission Rate',
      value: `${affiliate?.commission ?? 30}%`,
      icon:  TrendingUp,
      color: 'text-brand-400',
      bg:    'bg-brand-950 border-brand-800',
    },
    {
      label: 'Referral Code',
      value: affiliate?.referral_code ?? '—',
      icon:  Gift,
      color: 'text-purple-400',
      bg:    'bg-purple-950 border-purple-800',
    },
    {
      label: 'Total Referrals',
      value: String(referredCount),
      icon:  Users,
      color: 'text-yellow-400',
      bg:    'bg-yellow-950 border-yellow-800',
    },
  ]

  const steps = [
    { n: '1', title: 'Get your link',  desc: 'Copy your unique referral link from below.' },
    { n: '2', title: 'Share it',       desc: 'Share via social media, email, YouTube, or your blog.' },
    { n: '3', title: 'Earn instantly', desc: 'Earn 30% commission on every successful referral payment.' },
  ]

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">Affiliate Program</h1>
        <p className="text-gray-400 text-sm">Earn 30% commission for every creator you refer.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${s.bg}`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="font-bold text-sm">{s.value}</p>
                <p className="text-xs text-gray-400">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Referral link + share (client-interactive) */}
      <Card>
        <CardHeader><CardTitle>Your Referral Link</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <AffiliateClient
            referralLink={referralLink}
            hasAffiliate={!!affiliate}
            earnings={affiliate?.earnings ?? 0}
          />
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader><CardTitle>How It Works</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-brand-950 border border-brand-700 flex items-center justify-center text-sm font-bold text-brand-300 shrink-0">
                  {s.n}
                </div>
                <div>
                  <p className="font-semibold text-sm mb-1">{s.title}</p>
                  <p className="text-gray-400 text-xs leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payout info */}
      <Card>
        <CardHeader><CardTitle>Payout Information</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
          <div>
            <p className="text-gray-400 mb-1">Minimum Payout</p>
            <p className="font-semibold">$50.00</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Payout Schedule</p>
            <p className="font-semibold">1st of each month</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Payment Methods</p>
            <p className="font-semibold">PayPal, Bank Transfer</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
