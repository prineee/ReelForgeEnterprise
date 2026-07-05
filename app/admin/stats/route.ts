import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: statsData, error: rpcError } = await (supabase.rpc('get_admin_stats') as any) as {
    data: { totalUsers: number; totalMovies: number; publishJobs: number; paidUsers: number; users: Record<string, unknown>[] } | null
    error: { message: string } | null
  }

  console.log('[admin] rpc result:', JSON.stringify(statsData)?.slice(0, 300))
  console.log('[admin] rpc error:', rpcError?.message)

  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })
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
}
