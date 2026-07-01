import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSession } from "next-auth";

const MIN_PAYOUT = 500;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
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

    const { data: sales } = await supabase
      .from("affiliate_sales")
      .select("commission_amount")
      .eq("affiliate_id", user.id);

    const { data: payouts } = await supabase
      .from("affiliate_payouts")
      .select("amount,status")
      .eq("affiliate_id", user.id);

    const earnings =
      sales?.reduce(
        (sum, s) => sum + Number(s.commission_amount || 0),
        0
      ) || 0;

    const alreadyPaid =
      payouts?.reduce(
        (sum, p) => sum + Number(p.amount || 0),
        0
      ) || 0;

    const available = earnings - alreadyPaid;

    if (available < MIN_PAYOUT) {
      return NextResponse.json(
        {
          error: "Minimum payout amount not reached.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("affiliate_payouts")
      .insert({
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