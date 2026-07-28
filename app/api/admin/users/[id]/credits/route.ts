import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const check = await requireAdmin()
  if (!check.ok) return check.response
  const supabase = await createClient()

  try {
    const { credits, plan, note } = await req.json() as {
      credits?: number
      plan?: string
      note?: string
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await ((supabase as any).rpc('admin_update_user', {
      target_user_id: id,
      new_credits: credits !== undefined ? credits : null,
      new_plan:    plan    !== undefined ? plan    : null,
      note:        note    !== undefined ? note    : null,
    })) as { data: unknown; error: { message: string } | null }

    if (error) return NextResponse.json({ error: 'Failed to update user credits.' }, { status: 500 })
    return NextResponse.json({ success: true, user: data })
  } catch (error) {
    console.error('[admin/users/credits] POST failed', error)
    return NextResponse.json({ error: 'Failed to update user credits.' }, { status: 500 })
  }
}