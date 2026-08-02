import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin";

export async function POST(
  req: NextRequest
) {
  const check = await requireAdmin();
  if (!check.ok) return check.response;

  try {
    const { payoutId } =
      await req.json();

    if (!payoutId) {
      return NextResponse.json(
        { error: "Payout ID required" },
        { status: 400 }
      );
    }

    const admin =
      createAdminClient();

    const { error } = await (
  admin.from(
    "affiliate_payouts"
  ) as any
)
  .update({
    status: "paid",
    paid_at: new Date().toISOString(),
  })
  .eq("id", payoutId);
    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { error: "Failed" },
      { status: 500 }
    );
  }
}