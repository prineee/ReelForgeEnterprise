import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();

    const [
      clicks,
      referrals,
      commissions,
      payouts,
      stats,
    ] = await Promise.all([
      admin.from("affiliate_clicks").select("*"),
      admin.from("user_referrals").select("*"),
      admin.from("affiliate_commissions").select("*"),
      admin.from("affiliate_payouts").select("*"),
      admin.from("affiliate_stats").select("*"),
    ]);

    return NextResponse.json({
      totalClicks:
        clicks.data?.length || 0,

      totalReferrals:
        referrals.data?.length || 0,

      totalCommissions:
        commissions.data?.reduce(
          (sum: number, c: any) =>
            sum + Number(c.amount || 0),
          0
        ) || 0,

      totalPayouts:
        payouts.data?.reduce(
          (sum: number, p: any) =>
            sum + Number(p.amount || 0),
          0
        ) || 0,

      stats: stats.data || [],
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
