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

    const leaderboard = await Promise.all(
      (affiliates || []).map(async (a: any) => {
        const { data: sales } =
          await admin
            .from("affiliate_sales")
            .select("commission_amount")
            .eq("affiliate_id", a.id);

        const earnings =
          (sales || []).reduce(
            (sum: number, s: any) =>
              sum +
              Number(
                s.commission_amount || 0
              ),
            0
          );

        return {
          referral_code:
            a.referral_code,
          earnings,
        };
      })
    );

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