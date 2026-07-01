"use client";

import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";

interface Props {
  amount: string;
  plan: string;
}

export default function PayPalButton({
  amount,
  plan,
}: Props) {
  return (
    <PayPalScriptProvider
      options={{
        clientId:
          process.env
            .NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
        currency: "USD",
      }}
    >
      <PayPalButtons
        createOrder={async () => {
          const res = await fetch(
            "/api/payment/paypal/create-order",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                amount,
              }),
            }
          );

          const data =
            await res.json();

          return data.id;
        }}
        onApprove={async (data) => {
          const res = await fetch(
            "/api/payment/paypal/capture-order",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                orderID: data.orderID,
                amount,
                plan,
              }),
            }
          );

          const result =
            await res.json();

          if (result.success) {
            alert(
              "Payment Successful!"
            );

            window.location.href =
              "/dashboard";
          } else {
            alert(
              "Payment failed."
            );
          }
        }}
      />
    </PayPalScriptProvider>
  );
}