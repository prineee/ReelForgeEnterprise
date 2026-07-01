import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed`
    );
  }

  const supabase = createClient();

  const {
    data: { session },
    error,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session) {
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed`
    );
  }

  const redirectResponse = NextResponse.redirect(
    `${origin}${next}`
  );

  const refCode =
    request.cookies.get("ref_code")?.value;
    console.log(
  "ALL COOKIES:",
  request.cookies.getAll()
);

  if (refCode) {console.log("REF CODE:", refCode);
console.log("USER:", session.user.id);
    try {
      const admin = createAdminClient();

      const { data: affiliate } =
        await (admin
          .from("affiliates") as any)
          .select("id")
          .eq("referral_code", refCode)
          .single();

      if (affiliate) {
        const { data: existing } =
          await (admin
            .from("user_referrals") as any)
            .select("id")
            .eq(
              "user_id",
              session.user.id
            )
            .single();

        if (!existing) {
          await (admin
            .from("user_referrals") as any)
            .insert({
              user_id: session.user.id,
              affiliate_id: affiliate.id,
            });

          await (admin
            .from("users") as any)
            .update({
              referred_by: refCode,
            })
            .eq(
              "id",
              session.user.id
            );
        }
      }
    } catch (err) {
      console.error(
        "Referral Error:",
        err
      );
    }

    redirectResponse.cookies.delete(
      "ref_code"
    );
  }

  return redirectResponse;
}