import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const affiliateId = user.id;

    const [{ count: clicks }, { count: referrals }, { count: sales }] =
      await Promise.all([
        supabase
          .from("affiliate_clicks")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("affiliate_id", affiliateId),

        supabase
          .from("user_referrals")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("affiliate_id", affiliateId),

        supabase
          .from("affiliate_sales")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("affiliate_id", affiliateId),
      ]);

    const { data: earnings } = await supabase
      .from("affiliate_sales")
      .select("commission_amount")
      .eq("affiliate_id", affiliateId);

    const { data: payouts } = await supabase
      .from("affiliate_payouts")
      .select("amount,status")
      .eq("affiliate_id", affiliateId);

   const totalEarnings =
  ((earnings as any[]) ?? []).reduce(
    (sum: number, s: any) =>
      sum + Number(s.commission_amount || 0),
    0
  );

const pendingPayout =
  ((payouts as any[]) ?? [])
    .filter((p: any) => p.status === "pending")
    .reduce(
      (sum: number, p: any) =>
        sum + Number(p.amount || 0),
      0
    );

const paidPayout =
  ((payouts as any[]) ?? [])
    .filter((p: any) => p.status === "paid")
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
      conversionRate: Number(
        conversionRate.toFixed(2)
      ),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Dashboard failed" },
      { status: 500 }
    );
  }
}