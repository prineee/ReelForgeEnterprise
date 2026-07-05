import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin =
      createAdminClient();

    const {
      data: stats,
    } = await admin
      .from("affiliate_stats")
      .select(`
        *,
        affiliates (
          referral_code
        )
      `);

    return NextResponse.json({
      stats:
        stats || [],
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        error:
          "Failed to load analytics",
      },
      {
        status: 500,
      }
    );
  }
}