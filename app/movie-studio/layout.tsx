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

  // null (not 0) means "couldn't confirm the balance" — defaulting a failed
  // fetch to 0 previously made real errors indistinguishable from an
  // actually-empty balance, showing users a scary-but-false "0 credits".
  let credits: number | null = null;
  if (user) {
    const { data: profile, error } = (await (supabase.from("users") as any)
      .select("credits")
      .eq("id", user.id)
      .single()) as { data: { credits: number } | null; error: { message: string } | null };
    if (error) {
      console.error(`[MovieStudioLayout] Failed to fetch credits for user "${user.id}": ${error.message}`);
    } else {
      credits = profile?.credits ?? 0;
    }
  }

  return <DashboardShell credits={credits}>{children}</DashboardShell>;
}
