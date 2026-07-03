import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request
) {
  try {
    const admin =
      createAdminClient();

    const {
      referralCode,
      userId,
    } = await request.json();
    console.log("BODY", referralCode, userId);

    if (
      !referralCode ||
      !userId
    ) {
      return NextResponse.json(
        {
          error:
            "Referral code and user id required",
        },
        {
          status: 400,
        }
      );
    }

    const affiliates =
      admin.from(
        "affiliates"
      ) as any;

    const {
      data: affiliate,
      error: affiliateError,
    } = await affiliates
      .select("id")
      .eq(
        "referral_code",
        referralCode
      )
      .single(); console.log("AFFILIATE", affiliate);

    if (
      affiliateError ||
      !affiliate
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid referral code",
        },
        {
          status: 404,
        }
      );
    }

    const referrals =
      admin.from(
        "user_referrals"
      ) as any;

    const {
      data: existing,
    } = await referrals
      .select("user_id")
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();

    if (!existing) {
     console.log("INSERTING", {
  user_id: userId,
  affiliate_id: affiliate.id,
});console.log("INSERTING REFERRAL", userId, affiliate.id);
      await referrals.insert({
        user_id: userId,
        affiliate_id:
          affiliate.id,
      });
    }

    const users =
      admin.from(
        "users"
      ) as any;

    await users
      .update({
        referred_by:
          referralCode,
      })
      .eq(
        "id",
        userId
      );

    return NextResponse.json({
      success: true,
    });
  } catch (err) {
    console.error(
      "SAVE REFERRAL ERROR:",
      err
    );

    return NextResponse.json(
      {
        error:
          "Internal Server Error",
      },
      {
        status: 500,
      }
    );
  }
}