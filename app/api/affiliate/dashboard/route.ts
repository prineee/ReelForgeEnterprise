import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
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

    const { data: affiliate } = await (
      admin.from("affiliates") as any
    )
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!affiliate) {
      return NextResponse.json({
        totalClicks: 0,
        totalReferrals: 0,
        totalSales: 0,
        totalEarnings: 0,
        pendingPayout: 0,
        paidPayout: 0,
        conversionRate: 0,
      });
    }

    const affiliateId = affiliate.id;

    const [
      { count: clicks },
      { count: referrals },
      { count: sales },
    ] = await Promise.all([
      (admin.from("affiliate_clicks") as any)
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("affiliate_id", affiliateId),

      (admin.from("user_referrals") as any)
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("affiliate_id", affiliateId),

      (admin.from("affiliate_sales") as any)
        .select("*", {
          count: "exact",
          head: true,
        })
        .eq("affiliate_id", affiliateId),
    ]);

    const { data: earnings } = await (
      admin.from("affiliate_sales") as any
    )
      .select("commission_amount")
      .eq("affiliate_id", affiliateId);

    const { data: payouts } = await (
      admin.from("affiliate_payouts") as any
    )
      .select("amount,status")
      .eq("affiliate_id", affiliateId);

    const totalEarnings =
      ((earnings as any[]) ?? []).reduce(
        (sum: number, s: any) =>
          sum +
          Number(s.commission_amount || 0),
        0
      );

    const pendingPayout =
      ((payouts as any[]) ?? [])
        .filter(
          (p: any) => p.status === "pending"
        )
        .reduce(
          (sum: number, p: any) =>
            sum + Number(p.amount || 0),
          0
        );

    const paidPayout =
      ((payouts as any[]) ?? [])
        .filter(
          (p: any) => p.status === "paid"
        )
        .reduce(
          (sum: number, p: any) =>
            sum + Number(p.amount || 0),
          0
        );

    const conversionRate =
      clicks && clicks > 0
        ? (((sales || 0) / clicks) * 100)
        : 0;

    return NextResponse.json({
      totalClicks: clicks || 0,
      totalReferrals: referrals || 0,
      totalSales: sales || 0,
      totalEarnings,
      pendingPayout,
      paidPayout,
      conversionRate: Number(
        conversionRate.toFixed(2)
      ),
    });
  } catch (error) {
    console.error(
      "AFFILIATE DASHBOARD ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Dashboard failed",
      },
      {
        status: 500,
      }
    );
  }
}