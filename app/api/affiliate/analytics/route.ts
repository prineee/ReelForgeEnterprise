import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

    const { data: affiliate } = await admin
      .from("affiliates")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!affiliate) {
      return NextResponse.json({
        clicks: 0,
        referrals: 0,
        sales: 0,
        conversion: 0,
      });
    }

    const { data: stats } = await admin
      .from("affiliate_stats")
      .select("*")
      .eq("affiliate_id", affiliate.id)
      .single();

    const clicks =
      stats?.total_clicks || 0;

    const referrals =
      stats?.total_referrals || 0;

    const sales =
      stats?.total_earnings || 0;

    const conversion =
      clicks > 0
        ? Math.round(
            (referrals / clicks) * 100
          )
        : 0;

    return NextResponse.json({
      clicks,
      referrals,
      sales,
      conversion,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}