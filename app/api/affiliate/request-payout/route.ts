import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MIN_PAYOUT = 500;

export async function POST() {
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

    const { data: sales } = await supabase
      .from("affiliate_sales")
      .select("commission_amount")
      .eq("affiliate_id", user.id);

    const { data: payouts } = await supabase
      .from("affiliate_payouts")
      .select("amount,status")
      .eq("affiliate_id", user.id);

  const earnings =
  ((sales as any[]) ?? []).reduce(
    (sum: number, s: any) =>
      sum + Number(s.commission_amount || 0),
    0
  );

const alreadyPaid =
  ((payouts as any[]) ?? []).reduce(
    (sum: number, p: any) =>
      sum + Number(p.amount || 0),
    0
  );

    const available =
      earnings - alreadyPaid;

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
  supabase.from("affiliate_payouts") as any
).insert({
  affiliate_id: user.id,
  amount: available,
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
      { error: "Request failed" },
      { status: 500 }
    );
  }
}