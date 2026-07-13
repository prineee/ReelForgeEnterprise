import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

function getBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
    /\/(auth|rest|realtime|storage)(\/.*)?$/,
    ""
  );
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    getBaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Cookies can only be set in Route Handlers or Server Actions
          }
        },
      },
    }
  );
}