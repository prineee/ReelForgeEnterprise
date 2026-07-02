import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

    const { data, error } = await supabase
      .from("affiliate_payouts")
      .select("*")
      .eq("affiliate_id", user.id)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to load payouts" },
      { status: 500 }
    );
  }
}