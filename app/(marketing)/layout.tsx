import type { ReactNode } from "react";
import { MarketingLayout } from "@/components/layouts/MarketingLayout";

export default function MarketingRouteLayout({ children }: { children: ReactNode }) {
  return <MarketingLayout>{children}</MarketingLayout>;
}
