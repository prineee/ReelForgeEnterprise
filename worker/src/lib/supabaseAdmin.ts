/**
 * supabaseAdmin.ts (worker-local)
 *
 * Worker-side equivalent of lib/supabase/admin.ts's createAdminClient(),
 * with the same service-role/bypasses-RLS contract and the same signature
 * shape, so services/infrastructure/ProductionContextRepository.ts and
 * services/billing/CreditTransaction.ts — compiled into this worker
 * unmodified via tsconfig.worker.json's `paths` remap of
 * "@/lib/supabase/admin" to this file — see the exact same client type
 * they already expect from the Next.js app.
 *
 * Deliberately untyped (no Database generic): the worker doesn't have
 * lib/types/database.ts in its portable build (that file isn't part of the
 * shared services/ subtree), and none of the shared code this feeds
 * (ProductionContextRepository, CreditTransaction) relies on generated
 * table types — both already cast query results themselves. Matches the
 * existing untyped client pattern in worker/src/services/supabase.js.
 *
 * Reads SUPABASE_URL (not NEXT_PUBLIC_SUPABASE_URL) — the worker's existing
 * env var convention, already used by worker/src/services/supabase.js.
 */

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const rawUrl = process.env.SUPABASE_URL ?? "";
  const baseUrl = rawUrl.replace(/\/(auth|rest|realtime|storage)(\/.*)?$/, "");

  return createClient(baseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
