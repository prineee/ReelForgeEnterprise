import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data } = await (
      admin.from("affiliates") as any
    )
      .select(`
        payout_method,
        paypal_email,
        payoneer_email,
        wise_email,
        upi_id,
        bank_name,
        account_holder,
        account_number,
        ifsc_code
      `)
      .eq("user_id", user.id)
      .single();

    return NextResponse.json(data || {});
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        error: "Failed to load settings",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const supabase = createClient();
    const admin = createAdminClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request.json();

    const {
      payout_method,
      paypal_email,
      payoneer_email,
      wise_email,
      upi_id,
      bank_name,
      account_holder,
      account_number,
      ifsc_code,
    } = body;

    const { error } = await (
      admin.from("affiliates") as any
    )
      .update({
        payout_method,
        paypal_email,
        payoneer_email,
        wise_email,
        upi_id,
        bank_name,
        account_holder,
        account_number,
        ifsc_code,
      })
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        error: "Failed to save",
      },
      {
        status: 500,
      }
    );
  }
}