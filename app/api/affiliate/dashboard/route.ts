import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", session.user.email)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const affiliateId = user.id;

    const [{ count: clicks }, { count: referrals }, { count: sales }] =
      await Promise.all([
        supabase
          .from("affiliate_clicks")
          .select("*", { count: "exact", head: true })
          .eq("affiliate_id", affiliateId),

        supabase
          .from("user_referrals")
          .select("*", { count: "exact", head: true })
          .eq("affiliate_id", affiliateId),

        supabase
          .from("affiliate_sales")
          .select("*", { count: "exact", head: true })
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
      earnings?.reduce(
        (sum, s) => sum + Number(s.commission_amount || 0),
        0
      ) || 0;

    const pendingPayout =
      payouts
        ?.filter((p) => p.status === "pending")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

    const paidPayout =
      payouts
        ?.filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;

    const conversionRate =
      clicks && clicks > 0
        ? ((sales || 0) / clicks) * 100
        : 0;

    return NextResponse.json({
      totalClicks: clicks || 0,
      totalReferrals: referrals || 0,
      totalSales: sales || 0,
      totalEarnings,
      pendingPayout,
      paidPayout,
      conversionRate: Number(conversionRate.toFixed(2)),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Dashboard failed" },
      { status: 500 }
    );
  }
}