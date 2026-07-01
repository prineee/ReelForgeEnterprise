"use client";

import { useEffect } from "react";

export default function ReferralTracker() {
  useEffect(() => {
    const ref = localStorage.getItem("affiliate_ref");

    if (!ref) return;

    const saveReferral = async () => {
      try {
        const res = await fetch(
          "/api/affiliate/save-referral",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              referralCode: ref,
            }),
          }
        );

        if (res.ok) {
          console.log("Referral saved");
          localStorage.removeItem(
            "affiliate_ref"
          );
        } else {
          console.error(
            "Failed to save referral"
          );
        }
      } catch (err) {
        console.error(
          "Referral tracking error:",
          err
        );
      }
    };

    saveReferral();
  }, []);

  return null;
}