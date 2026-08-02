import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    const { data: affiliate } = await (admin.from("affiliates") as any)
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!affiliate) {
      return NextResponse.json({ commissions: [] });
    }

    const {
      data: commissions,
      error,
    } = await admin
      .from("affiliate_commissions")
      .select("*")
      .eq("affiliate_id", affiliate.id)
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