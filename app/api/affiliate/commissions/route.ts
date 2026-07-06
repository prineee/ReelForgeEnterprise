import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin =
      createAdminClient();

    const {
      data: commissions,
      error,
    } = await admin
      .from("affiliate_commissions")
      .select("*")
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    if (error) {
      throw error;
    }

    return NextResponse.json({
      commissions:
        commissions || [],
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        commissions: [],
      },
      {
        status: 500,
      }
    );
  }
}