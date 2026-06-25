import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * Service-role Supabase client — bypasses RLS.
 * Use only in server-side code (webhooks, payment handlers).
 * Strips any path suffix that may exist on NEXT_PUBLIC_SUPABASE_URL.
 */
export function createAdminClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const baseUrl = rawUrl.replace(/\/(auth|rest|realtime|storage)(\/.*)?$/, '')

  return createClient<Database>(baseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
