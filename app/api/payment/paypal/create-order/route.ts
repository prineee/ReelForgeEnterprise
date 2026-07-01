import { NextResponse } from "next/server";
import { PLANS } from "@/lib/payment/plans";

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret =
    process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal credentials are missing"
    );
  }

  const auth = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description ||
        "Failed to get PayPal token"
    );
  }

  return data.access_token;
}

export async function POST(
  request: Request
) {
  try {
    const { plan } =
      await request.json();

    const planData =
      PLANS[
        plan as keyof typeof PLANS
      ];

    if (!planData) {
      return NextResponse.json(
        {
          error: "Invalid plan",
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      await getAccessToken();

    const response = await fetch(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value:
                  planData.usd.toFixed(2),
              },
            },
          ],
        }),
      }
    );

    const order =
      await response.json();

    if (!response.ok) {
      console.error(order);

      return NextResponse.json(
        {
          error:
            "Failed to create PayPal order",
        },
        {
          status: 500,
        }
      );
    }

    const approvalLink =
      order.links?.find(
        (link: any) =>
          link.rel === "approve"
      );

    return NextResponse.json({
      orderID: order.id,
      approvalUrl:
        approvalLink?.href,
    });
  } catch (err: any) {
    console.error(
      "PAYPAL CREATE ORDER ERROR:",
      err
    );

    return NextResponse.json(
      {
        error:
          err.message ||
          "Failed to create order",
      },
      {
        status: 500,
      }
    );
  }
}