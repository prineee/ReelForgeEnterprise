"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ReferralTracker() {
  useEffect(() => {
    async function saveReferral() {
      const referralCode =
        localStorage.getItem("affiliate_ref");

      if (!referralCode) return;

      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const res = await fetch(
        "/api/affiliate/save-referral",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            referralCode,
            userId: user.id,
          }),
        }
      );

      if (res.ok) {
        console.log(
          "Referral saved successfully."
        );

        localStorage.removeItem(
          "affiliate_ref"
        );
      } else {
        console.error(
          await res.text()
        );
      }
    }

    saveReferral();
  }, []);

  return null;
}