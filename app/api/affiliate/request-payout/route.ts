import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MIN_PAYOUT = 5;

export async function POST() {
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

   const { data: affiliate } =
  await (
    supabase
      .from("affiliates") as any
  )
    .select("id")
    .eq("user_id", user.id)
    .single();

if (!affiliate) {
  return NextResponse.json(
    { error: "Affiliate not found" },
    { status: 404 }
  );
}

const affiliateId =
  (affiliate as any).id;
    const { data: sales } =
      await admin
        .from("affiliate_sales")
        .select("commission_amount")
        .eq(
          "affiliate_id",
          affiliateId
        );

    const { data: payouts } =
      await admin
        .from("affiliate_payouts")
        .select("amount,status")
        .eq(
          "affiliate_id",
          affiliateId
        );

    const earnings =
      ((sales as any[]) ?? [])
        .reduce(
          (
            sum: number,
            s: any
          ) =>
            sum +
            Number(
              s.commission_amount ||
                0
            ),
          0
        );

    const alreadyPaid =
      ((payouts as any[]) ??
        []).reduce(
        (
          sum: number,
          p: any
        ) =>
          sum +
          Number(
            p.amount || 0
          ),
        0
      );

    const available =
      earnings - alreadyPaid;
      console.log("Affiliate ID:", affiliateId);
console.log("Sales:", sales);
console.log("Payouts:", payouts);
console.log("Earnings:", earnings);
console.log("Available:", available);

    if (available < MIN_PAYOUT) {
      return NextResponse.json(
        {
          error:
            "Minimum payout amount not reached.",
        },
        { status: 400 }
      );
    }

    const { error } = await (
      admin.from(
        "affiliate_payouts"
      ) as any
    ).insert({
      affiliate_id:
        affiliateId,
      amount: available,
      currency: "INR",
      status: "pending",
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Request failed",
      },
      {
        status: 500,
      }
    );
  }
}