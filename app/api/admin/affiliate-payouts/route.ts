export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminClient();

    const { data: payouts, error } =
      await admin
        .from("affiliate_payouts")
        .select("*")
        .order("created_at", {
          ascending: false,
        });

    if (error) {
      throw error;
    }

    const result = await Promise.all(
      ((payouts as any[]) || []).map(
        async (payout: any) => {
          const {
            data: affiliate,
          } = await admin
            .from("affiliates")
            .select(`
              referral_code,
              paypal_email,
              payoneer_email,
              wise_email,
              upi_id
            `)
            .eq(
              "id",
              payout.affiliate_id
            )
            .single();

          return {
            ...payout,
            affiliates:
              affiliate || null,
          };
        }
      )
    );

    return NextResponse.json(
      result
    );
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      [],
      {
        status: 500,
      }
    );
  }
}