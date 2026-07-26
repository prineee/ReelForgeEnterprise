import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  PLAN_BY_KEY,
  getCommissionRate,
  type PlanKey,
} from "@/lib/plans";

export async function POST(
  request: Request
) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const users = admin.from("users") as any;
    const payments = admin.from("payments") as any;
    const referrals = admin.from("user_referrals") as any;
    const affiliates = admin.from("affiliates") as any;
    const sales = admin.from("affiliate_sales") as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const {
      orderID,
      amount,
      plan,
    } = await request.json();

    const planData = PLAN_BY_KEY[plan as PlanKey];
    if (!planData) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    await payments.insert({
      user_id: user.id,
      amount,
      gateway: "paypal",
      payment_provider: "paypal",
      paypal_order_id: orderID,
      currency: "USD",
      status: "paid",
    });

    const credits = planData.credits;

    const {
      data: existingUser,
    } = await users
      .select("credits")
      .eq("id", user.id)
      .single();

    await users
      .update({
        credits:
          Number(
            existingUser?.credits || 0
          ) + credits,
        // Store the normalized dbPlan (e.g. "enterprise" for the Agency
        // plan), not the raw plan key — this is what Stripe/Razorpay's
        // webhooks already write, so a user's stored plan value means the
        // same thing regardless of which payment method they used.
        plan: planData.dbPlan,
      })
      .eq("id", user.id);

    const {
      data: referral,
    } = await referrals
      .select("affiliate_id")
      .eq("user_id", user.id)
      .single();

    if (referral?.affiliate_id) {
      const rate =
        getCommissionRate(plan);

      const commission =
        (Number(amount) * rate) / 100;

      await sales.insert({
        affiliate_id:
          referral.affiliate_id,
        customer_email:
          user.email,
        order_id: orderID,
        plan_name: plan,
        sale_amount: amount,
        commission_rate: rate,
        commission_amount:
          commission,
        currency: "USD",
        status: "approved",
      });

      const {
        data: affiliate,
      } = await affiliates
        .select("earnings")
        .eq(
          "id",
          referral.affiliate_id
        )
        .single();

      await affiliates
        .update({
          earnings:
            Number(
              affiliate?.earnings || 0
            ) + commission,
        })
        .eq(
          "id",
          referral.affiliate_id
        );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(
      "PAYPAL CAPTURE ERROR:",
      err
    );

    return NextResponse.json(
      {
        error: "Payment Failed",
      },
      {
        status: 500,
      }
    );
  }
}