import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/app/(dashboard)/_components/dashboard-shell";

export default async function MovieStudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let credits = 0;
  if (user) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = (await (supabase.from("users") as any)
      .select("credits")
      .eq("id", user.id)
      .single()) as { data: { credits: number } | null };
    credits = profile?.credits ?? 0;
  }

  return <DashboardShell credits={credits}>{children}</DashboardShell>;
}
