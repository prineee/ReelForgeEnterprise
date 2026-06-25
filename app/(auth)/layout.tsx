import type { ReactNode } from "react";
import { AuthLayout } from "@/components/layouts/AuthLayout";

export default function AuthRouteLayout({ children }: { children: ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
