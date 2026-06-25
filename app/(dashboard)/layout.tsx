import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from './_components/dashboard-shell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from('users') as any)
    .select('name, plan, credits, is_admin, onboarding_completed, created_at')
    .eq('id', user.id)
    .single() as {
      data: {
        name: string | null; plan: string; credits: number; is_admin?: boolean
        onboarding_completed?: boolean; created_at?: string
      } | null
    }

  // Redirect new users to onboarding (account < 7 days, onboarding not completed)
  const isNewUser  = profile && !profile.onboarding_completed
  const accountAge = Date.now() - new Date(profile?.created_at ?? 0).getTime()
  const isRecent   = accountAge < 7 * 24 * 60 * 60 * 1000
  if (isNewUser && isRecent) redirect('/onboarding')

  return (
    <DashboardShell credits={profile?.credits ?? 0}>
      {children}
    </DashboardShell>
  )
}
