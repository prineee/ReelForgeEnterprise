import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase: any =
      createClient();

    const admin: any =
      createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({
        totalClicks: 0,
        totalReferrals: 0,
        totalSales: 0,
        conversionRate: 0,
      });
    }

    const {
      data: affiliate,
      error: affiliateError,
    } = await admin
      .from("affiliates")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      affiliateError ||
      !affiliate
    ) {
      return NextResponse.json({
        totalClicks: 0,
        totalReferrals: 0,
        totalSales: 0,
        conversionRate: 0,
      });
    }

    const {
      data: stats,
      error: statsError,
    } = await admin
      .from("affiliate_stats")
      .select("*")
      .eq(
        "affiliate_id",
        affiliate.id
      )
      .maybeSingle();

    if (
      statsError ||
      !stats
    ) {
      return NextResponse.json({
        totalClicks: 0,
        totalReferrals: 0,
        totalSales: 0,
        conversionRate: 0,
      });
    }

    const totalClicks =
      Number(
        stats.total_clicks || 0
      );

    const totalReferrals =
      Number(
        stats.total_referrals || 0
      );

    const totalSales =
      Number(
        stats.total_earnings || 0
      );

    const conversionRate =
      totalClicks > 0
        ? Math.round(
            (totalReferrals /
              totalClicks) *
              100
          )
        : 0;

    return NextResponse.json({
      totalClicks,
      totalReferrals,
      totalSales,
      conversionRate,
    });
  } catch (err) {
    console.error(
      "AFFILIATE ANALYTICS ERROR:",
      err
    );

    return NextResponse.json(
      {
        totalClicks: 0,
        totalReferrals: 0,
        totalSales: 0,
        conversionRate: 0,
      },
      {
        status: 500,
      }
    );
  }
}