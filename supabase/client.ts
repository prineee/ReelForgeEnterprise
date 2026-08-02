import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
    /\/(auth|rest|realtime|storage)(\/.*)?$/,
    ""
  );
}

let client:
  | ReturnType<typeof createBrowserClient<Database>>
  | undefined;

export function createClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      getBaseUrl(),
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return client;
}