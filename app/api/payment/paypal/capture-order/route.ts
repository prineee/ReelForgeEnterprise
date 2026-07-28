import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Disabled alongside create-order — see that file's header. This route
 * used to grant credits for any client-supplied orderID with zero
 * verification against PayPal. No payment/credit logic runs here until a
 * real PayPal Orders API capture-and-verify flow replaces this stub.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    { error: "PayPal payments are temporarily unavailable. Please use Stripe or Razorpay." },
    { status: 503 }
  );
}
