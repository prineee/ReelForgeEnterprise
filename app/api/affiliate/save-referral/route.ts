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

    const {
      data: affiliate,
      error: affiliateError,
    } = await (
      admin.from(
        "affiliates"
      ) as any
    )
      .select("*")
      .eq(
        "referral_code",
        referralCode
      )
      .single();

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

    const {
      data: existing,
    } = await (
      admin.from(
        "affiliate_referrals"
      ) as any
    )
      .select("id")
      .eq(
        "referred_user_id",
        userId
      )
      .maybeSingle();

    if (!existing) {
      await (
        admin.from(
          "affiliate_referrals"
        ) as any
      ).insert({
        affiliate_id:
          affiliate.id,
        referred_user_id:
          userId,
        commission:
          affiliate.commission ||
          30,
        status:
          "approved",
      });

      await (
        admin.from(
          "affiliate_commissions"
        ) as any
      ).insert({
        affiliate_id:
          affiliate.id,
        referred_user_id:
          userId,
        amount:
          affiliate.earnings ||
          6,
        status:
          "approved",
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
            total_referrals:
              (stats.total_referrals ||
                0) + 1,
            total_earnings:
              (stats.total_earnings ||
                0) +
              (affiliate.earnings ||
                6),
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
          total_clicks: 0,
          total_referrals: 1,
          total_earnings:
            affiliate.earnings ||
            6,
        });
      }
    }

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