import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'

export async function GET() {
  const check = await requireAdmin()
  if (!check.ok) return check.response

  const supabase = await createClient()

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: statsData, error: rpcError } = await (supabase.rpc('get_admin_stats') as any) as {
      data: { totalUsers: number; totalMovies: number; publishJobs: number; paidUsers: number; users: Record<string, unknown>[] } | null
      error: { message: string } | null
    }

    if (rpcError) return NextResponse.json({ error: 'Failed to load admin stats.' }, { status: 500 })
    if (!statsData) return NextResponse.json({ error: 'No data' }, { status: 500 })

    const PLAN_REVENUE: Record<string, number> = { starter: 6, pro: 18, agency: 60 }
    const users = statsData.users ?? []
    const estimatedMRR = users
      .filter((u) => (u as { plan: string }).plan !== 'free')
      .reduce((sum: number, u) => sum + (PLAN_REVENUE[(u as { plan: string }).plan] ?? 0), 0)

    return NextResponse.json({
      stats: {
        totalUsers:  statsData.totalUsers  ?? 0,
        totalMovies: statsData.totalMovies ?? 0,
        publishJobs: statsData.publishJobs ?? 0,
        estimatedMRR,
        paidUsers:   statsData.paidUsers   ?? 0,
      },
      users,
    })
  } catch (error) {
    console.error('[admin/stats] GET failed', error)
    return NextResponse.json({ error: 'Failed to load admin stats.' }, { status: 500 })
  }
}
