import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { referralCode } = await request.json();

    if (!referralCode) {
      return NextResponse.json(
        { error: "No referral code" },
        { status: 400 }
      );
    }

    const affiliates =
      admin.from("affiliates") as any;

    const { data: affiliate } =
      await affiliates
        .select("id")
        .eq("referral_code", referralCode)
        .single();

    if (!affiliate) {
      return NextResponse.json(
        { error: "Invalid code" },
        { status: 404 }
      );
    }

    const referrals =
      admin.from("user_referrals") as any;

    await referrals.upsert(
      {
        user_id: user.id,
        affiliate_id: affiliate.id,
      },
      {
        onConflict: "user_id",
      }
    );

    const users =
      admin.from("users") as any;

    await users
      .update({
        referred_by: referralCode,
      })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(
      "SAVE REFERRAL ERROR:",
      err
    );

    return NextResponse.json(
      {
        error: "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}