import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  const { data } = await supabase
    .from("affiliates")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return NextResponse.json(data);
}

export async function POST(request: Request) {
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

  const body = await request.json();

  const payload = {
    payout_method: body.payout_method,
    paypal_email: body.paypal_email,
    payoneer_email: body.payoneer_email,
    wise_email: body.wise_email,
    upi_id: body.upi_id,
    bank_name: body.bank_name,
    account_holder: body.account_holder,
    account_number: body.account_number,
    ifsc_code: body.ifsc_code,
  };

  const { data, error } = await (supabase
    .from("affiliates") as any)
    .update(payload)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    console.error(error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}