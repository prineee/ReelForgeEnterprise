import type { ReactNode } from "react";
import ReferralTracker from "@/components/affiliate/ReferralTracker";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <ReferralTracker />
      {children}
    </>
  );
}