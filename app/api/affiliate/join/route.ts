import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function POST() {
  const supabase = createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Return existing record if already joined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (admin.from('affiliates') as any)
    .select('referral_code')
    .eq('user_id', user.id)
    .single() as { data: { referral_code: string } | null }

  if (existing?.referral_code) {
    return NextResponse.json({ referral_code: existing.referral_code })
  }

  // Generate a unique 8-char code (retry on collision)
  let code = ''
  for (let attempt = 0; attempt < 50 && !code; attempt++) {
    const candidate = generateCode()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clash } = await (admin.from('affiliates') as any)
      .select('referral_code')
      .eq('referral_code', candidate)
      .maybeSingle() as { data: { referral_code: string } | null }
    if (!clash) code = candidate
  }

  if (!code) {
    return NextResponse.json({ error: 'Could not generate a unique referral code' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin.from('affiliates') as any).insert({
    user_id:       user.id,
    referral_code: code,
    commission:    30.00,
    earnings:      0.00,
  })

  if (error) {
    console.error('[affiliate/join] insert error:', error)
    return NextResponse.json({ error: 'Failed to create affiliate record' }, { status: 500 })
  }

  return NextResponse.json({ referral_code: code })
}
