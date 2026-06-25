import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createClient()
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && session) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      const redirectUrl = isLocalEnv
        ? `${origin}${next}`
        : forwardedHost
        ? `https://${forwardedHost}${next}`
        : `${origin}${next}`

      const redirectResponse = NextResponse.redirect(redirectUrl)

      // If the user arrived via a referral link, record it now that we know their user ID.
      // We use .is('referred_by', null) so we only set it once.
      const refCode = request.cookies.get('ref_code')?.value
      if (refCode) {
        try {
          const admin = createAdminClient()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (admin.from('users') as any)
            .update({ referred_by: refCode })
            .eq('id', session.user.id)
            .is('referred_by', null)
        } catch {
          // Non-fatal: referral tracking failure should not break login
        }
        redirectResponse.cookies.delete('ref_code')
      }

      return redirectResponse
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
