import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();

    const { data: affiliates } =
      await admin
        .from("affiliates")
        .select(`
          id,
          referral_code,
          user_id
        `);

    const affiliateIds = (affiliates || []).map((a: any) => a.id);

    const { data: allSales } =
      affiliateIds.length > 0
        ? await admin
            .from("affiliate_sales")
            .select("affiliate_id, commission_amount")
            .in("affiliate_id", affiliateIds)
        : { data: [] };

    const earningsByAffiliateId = new Map<string, number>();
    for (const s of allSales || []) {
      const current = earningsByAffiliateId.get((s as any).affiliate_id) ?? 0;
      earningsByAffiliateId.set((s as any).affiliate_id, current + Number((s as any).commission_amount || 0));
    }

    const leaderboard = (affiliates || []).map((a: any) => ({
      referral_code: a.referral_code,
      earnings: earningsByAffiliateId.get(a.id) ?? 0,
    }));

    leaderboard.sort(
      (a, b) =>
        b.earnings - a.earnings
    );

    return NextResponse.json(
      leaderboard
    );
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      [],
      { status: 500 }
    );
  }
}