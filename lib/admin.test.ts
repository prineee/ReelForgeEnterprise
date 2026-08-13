/**
 * admin.test.ts
 *
 * Run with: npx tsx --test lib/admin.test.ts
 * (no test framework is configured in this repo — see
 * services/ai/director/CameraDirector.test.ts's file header for the
 * established convention this follows.)
 *
 * requireAdmin() normally calls the real cookie-based createClient()
 * (next/headers-dependent, requires an actual Next.js request context) —
 * this suite exercises its authorization DECISION LOGIC via the optional
 * injected-client parameter added for testability (see admin.ts's doc
 * comment), which every real app/api/admin/** caller still omits, so
 * their behavior is unchanged.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { requireAdmin } from "./admin";

function fakeSupabaseClient(options: { user: { id: string } | null; isAdmin: boolean | null }) {
  return {
    auth: {
      async getUser() {
        return { data: { user: options.user } };
      },
    },
    from(_table: string) {
      return {
        select(_columns: string) {
          return {
            eq(_column: string, _value: string) {
              return {
                async single() {
                  return { data: options.user ? { is_admin: options.isAdmin } : null };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe("requireAdmin — authorization", () => {
  test("unauthenticated caller: ok:false, 401", async () => {
    const client = fakeSupabaseClient({ user: null, isAdmin: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await requireAdmin(client as any);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 401);
    }
  });

  test("authenticated but not admin: ok:false, 403", async () => {
    const client = fakeSupabaseClient({ user: { id: "u1" }, isAdmin: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await requireAdmin(client as any);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 403);
    }
  });

  test("authenticated with is_admin null (never set): ok:false, 403 — must not default to allowed", async () => {
    const client = fakeSupabaseClient({ user: { id: "u1" }, isAdmin: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await requireAdmin(client as any);

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.response.status, 403);
    }
  });

  test("authenticated admin: ok:true, userId set", async () => {
    const client = fakeSupabaseClient({ user: { id: "admin-user-1" }, isAdmin: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await requireAdmin(client as any);

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.userId, "admin-user-1");
    }
  });
});
