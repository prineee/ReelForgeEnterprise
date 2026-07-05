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
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const {
      data: affiliate,
    } = await (
      admin.from(
        "affiliates"
      ) as any
    )
      .select("id")
      .eq(
        "user_id",
        user.id
      )
      .single();

    if (!affiliate) {
      return NextResponse.json({
        sales: [],
      });
    }

    const {
      data: sales,
    } = await (
      admin.from(
        "affiliate_sales"
      ) as any
    )
      .select("*")
      .eq(
        "affiliate_id",
        affiliate.id
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

    return NextResponse.json({
      sales: sales || [],
    });
  } catch (err) {
    console.error(
      "AFFILIATE SALES ERROR:",
      err
    );

    return NextResponse.json(
      {
        error:
          "Failed to load sales",
      },
      {
        status: 500,
      }
    );
  }
}