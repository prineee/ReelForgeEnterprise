import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase: any =
      createClient();

    const admin: any =
      createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json([]);
    }

    const {
      data: affiliate,
    } = await admin
      .from("affiliates")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!affiliate) {
      return NextResponse.json([]);
    }

    const {
      data,
    } = await admin
      .from(
        "affiliate_commissions"
      )
      .select("*")
      .eq(
        "affiliate_id",
        affiliate.id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      )
      .limit(10);

    return NextResponse.json(
      data || []
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json([]);
  }
}