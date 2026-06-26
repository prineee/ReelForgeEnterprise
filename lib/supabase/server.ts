import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .replace(/\/(auth|rest|realtime|storage)(\/.*)?$/, '')
}

export function createClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    getBaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — cookies set in middleware
          }
        },
      },
    }
  )
}
