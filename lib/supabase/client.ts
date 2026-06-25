'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/database'

/**
 * Strip any API path suffix that may be present on NEXT_PUBLIC_SUPABASE_URL.
 * e.g. https://xxx.supabase.co/auth/v1/.well-known/jwks.json → https://xxx.supabase.co
 * Matches the same pattern used in lib/supabase/admin.ts.
 */
function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .replace(/\/(auth|rest|realtime|storage)(\/.*)?$/, '')
}

export function createClient() {
  return createBrowserClient<Database>(
    getBaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
