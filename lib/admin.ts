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
 *
 * `client`, if supplied, is used instead of the real cookie-based
 * createClient() — the real client depends on next/headers' cookies(),
 * which requires an actual Next.js request context and can't run under a
 * plain node:test script. Every existing caller omits this param, so
 * behavior for all six current app/api/admin/** routes is unchanged;
 * this exists solely so requireAdmin()'s own authorization decision
 * (authenticated? admin? neither?) can be unit-tested with a fake client.
 */
export async function requireAdmin(client?: Awaited<ReturnType<typeof createClient>>): Promise<AdminCheckResult> {
  const supabase = client ?? await createClient()
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
