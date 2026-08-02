import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();
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

    const { data: affiliate } = await (
      admin.from("affiliates") as any
    )
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!affiliate) {
      return NextResponse.json({
        isAffiliate: false,
        referralCode: "",
        referralLink: "",
        totalCommission: 0,
        referrals: 0,
        earnings: 0,
      });
    }

    const referralLink =
      `${
        process.env.NEXT_PUBLIC_APP_URL ||
        "http://localhost:3000"
      }/register?ref=${affiliate.referral_code}`;

    const { count: referrals } = await (
      admin.from("user_referrals") as any
    )
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("affiliate_id", affiliate.id);

    const { data: sales } = await (
      admin.from("affiliate_sales") as any
    )
      .select("commission_amount")
      .eq("affiliate_id", affiliate.id);

    const totalCommission =
      ((sales as any[]) ?? []).reduce(
        (sum: number, sale: any) =>
          sum +
          Number(
            sale.commission_amount || 0
          ),
        0
      );

    return NextResponse.json({
      isAffiliate: true,
      referralCode:
        affiliate.referral_code,
      referralLink,
      totalCommission,
      referrals: referrals || 0,
      earnings:
        Number(
          affiliate.earnings || 0
        ),
    });
  } catch (error) {
    console.error(
      "AFFILIATE STATS ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Failed to load affiliate stats",
      },
      {
        status: 500,
      }
    );
  }
}