import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest
) {
  try {
    const { referralCode } =
      await req.json();

    if (!referralCode) {
      return NextResponse.json(
        {
          success: false,
        },
        {
          status: 400,
        }
      );
    }

    const admin =
      createAdminClient();

    const {
      data: affiliate,
    } = await (
      admin.from(
        "affiliates"
      ) as any
    )
      .select("id")
      .eq(
        "referral_code",
        referralCode
      )
      .single();

    if (!affiliate) {
      return NextResponse.json(
        {
          success: false,
        },
        {
          status: 404,
        }
      );
    }

   await (
  admin.from(
    "affiliate_clicks"
  ) as any
).insert({
  affiliate_id:
    affiliate.id,
  country: "Unknown",
  ip_address:
    req.headers.get(
      "x-forwarded-for"
    ) || "",
  referrer:
    req.headers.get(
      "referer"
    ) || "",
  session_id:
    crypto.randomUUID(),
  converted: false,
});
const {
  data: stats,
} = await (
  admin.from(
    "affiliate_stats"
  ) as any
)
  .select("*")
  .eq(
    "affiliate_id",
    affiliate.id
  )
  .maybeSingle();

if (stats) {
  await (
    admin.from(
      "affiliate_stats"
    ) as any
  )
    .update({
      total_clicks:
        (stats.total_clicks || 0) +
        1,
    })
    .eq(
      "affiliate_id",
      affiliate.id
    );
} else {
  await (
    admin.from(
      "affiliate_stats"
    ) as any
  ).insert({
    affiliate_id:
      affiliate.id,
    total_clicks: 1,
    total_referrals: 0,
    total_earnings: 0,
  });
}

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      }
    );
  }
}