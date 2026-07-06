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
      data: commissions,
    } = await admin
      .from(
        "affiliate_commissions"
      )
      .select(
        "amount, created_at"
      )
      .eq(
        "affiliate_id",
        affiliate.id
      )
      .order(
        "created_at",
        {
          ascending: true,
        }
      );

    const chart =
      commissions?.map(
        (c: any) => ({
          date: new Date(
            c.created_at
          ).toLocaleDateString(),
          earnings:
            Number(
              c.amount
            ),
        })
      ) || [];

    return NextResponse.json(
      chart
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json([]);
  }
}