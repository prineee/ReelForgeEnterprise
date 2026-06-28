import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAffiliateCode } from "@/lib/affiliate";

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

    const { data: existing } = await supabase
      .from("affiliates")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        affiliate: existing,
        referralLink:
          `${process.env.NEXT_PUBLIC_APP_URL}?ref=${(existing as any).affiliate_code}`,
      });
    }

    const code = generateAffiliateCode(
      user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "RF"
    );

    const { data, error } = await supabase
      .from("affiliates")
      .insert({
        user_id: user.id,
        affiliate_code: code,
        status: "approved",
      } as any)
      .select()
      .single();

    if (error) {
      console.error(error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      affiliate: data,
      referralLink:
        `${process.env.NEXT_PUBLIC_APP_URL}?ref=${code}`,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}