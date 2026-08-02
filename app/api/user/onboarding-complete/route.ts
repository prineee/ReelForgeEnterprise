import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('users') as any)
      .update({ onboarding_completed: true })
      .eq('id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[user/onboarding-complete] POST failed', error)
    return NextResponse.json({ error: 'Failed to update onboarding status.' }, { status: 500 })
  }
}
