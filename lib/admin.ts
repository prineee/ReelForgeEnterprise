import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export type AdminCheckResult =
  | { ok: true;  userId: string; response?: never }
  | { ok: false; response: NextResponse }

/**
 * Verifies the caller is authenticated AND has users.is_admin = true.
 * Every app/api/admin/** route was previously gated by session presence
 * alone (or nothing at all) despite `is_admin` existing on the users
 * table — this is the first thing in this codebase to actually read it
 * (Sprint 16, Task 5).
 *
 * Usage in an API route:
 *   const check = await requireAdmin()
 *   if (!check.ok) return check.response
 */
export async function requireAdmin(): Promise<AdminCheckResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from('users') as any)
    .select('is_admin')
    .eq('id', user.id)
    .single() as { data: { is_admin: boolean | null } | null }

  if (!profile?.is_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, userId: user.id }
}
