import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLAN_BY_KEY, type PlanKey } from "@/lib/plans";

/**
 * PayPal checkout is disabled server-side (Sprint 16, Task 5): this route
 * used to insert a `payments` row and credit the account immediately, with
 * no call to PayPal's Orders API to verify a payment had actually
 * happened — anyone could hit capture-order directly with a fabricated
 * orderID and get free credits. A real fix means implementing PayPal's
 * server-side Orders API create+capture flow (PAYPAL_CLIENT_SECRET,
 * verifying `status === "COMPLETED"` before crediting), which doesn't
 * exist anywhere in this codebase yet (see also lib/plans.ts's Sprint 16
 * Task 2 pricing-unification notes, which already flagged PayPal
 * integration as incomplete). Until that's built, this route no longer
 * grants anything — it just validates the plan and reports the feature as
 * unavailable, closing the exploit without pretending to process a real
 * payment.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan } = await request.json().catch(() => ({ plan: undefined }));
  const planData = PLAN_BY_KEY[plan as PlanKey];
  if (!planData) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  return NextResponse.json(
    { error: "PayPal payments are temporarily unavailable. Please use Stripe or Razorpay." },
    { status: 503 }
  );
}
