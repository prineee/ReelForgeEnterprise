# RC5 — Commercial Launch Readiness Report

**Date:** 2026-08-02
**Scope:** The 10 infrastructure/provider items below. This is a *technical configuration* audit — it complements, and does not replace, `GO_LIVE_CHECKLIST.md` (manual functional/browser verification) and `PRODUCTION_ENVIRONMENT.md` (the canonical env-var reference this report builds on and cross-checks against actual values, not just names).
**Method:** Real local-file inspection (secrets never printed, only presence/prefix/mode), real read-only live calls where safe (Cloudinary, Supabase, DNS, TLS, Railway API), cross-referenced against existing project docs (`PRODUCTION_ENVIRONMENT.md`, `GO_LIVE_CHECKLIST.md`) so this report doesn't contradict documented, intentional decisions (e.g. PayPal being deliberately disabled).
**Important caveat that applies to every item below:** almost everything checked here is the *local* `.env.local` / `worker/.env` file content. These are gitignored dev files — they are **not automatically what's set on Vercel/Railway's actual production dashboards**. Where I could verify live production state directly (Cloudinary, Supabase, DNS, the frontend's live TLS cert), I did. Where I could not (actual Vercel/Railway env values), that's called out explicitly rather than assumed.

---

## Summary table

| # | Area | Status |
|---|---|---|
| 1 | Environment variables | ⚠ Needs Configuration |
| 2 | Cloudinary configuration | ✗ Blocking |
| 3 | Railway worker configuration | ✗ Blocking |
| 4 | Supabase production configuration | ✓ Ready (with 2 unverified sub-items) |
| 5 | Razorpay live mode | ⚠ Needs Configuration |
| 6 | PayPal live mode | ✓ Ready (correctly, intentionally disabled) |
| 7 | Resend production email | ✓ Ready (not applicable — not used by this app) |
| 8 | Vercel deployment | ✓ Ready |
| 9 | DNS and SSL | ✗ Blocking |
| 10 | Monitoring and logging | ⚠ Needs Configuration (documented, pre-existing gap) |

**No MovieAssemblerV2, FFmpeg, route, or API code was modified.** One configuration file was changed: `worker/.env`'s `ALLOWED_ORIGIN` (see item 3) — this is a local config value, not application code.

---

## 1. Environment variables — ⚠ Needs Configuration

`PRODUCTION_ENVIRONMENT.md` already documents every variable's purpose and requirement level — this section only adds *actual value* verification on top of that name-level reference.

Confirmed by direct inspection (values, not just presence):
- `RAZORPAY_KEY_ID` is a genuine **live** key (`rzp_live_...` prefix, correct length) — matches `PRODUCTION_ENVIRONMENT.md`'s security-section note.
- `STRIPE_SECRET_KEY` is a **test** key (`sk_test_...`), not live — see item 5's sibling finding below (Stripe wasn't in this report's original 10-item scope, but it's directly adjacent to Razorpay and worth flagging since it's the *other* live payment path).
- `RAZORPAY_WEBHOOK_SECRET` is **not set** in `.env.local` at all — `PRODUCTION_ENVIRONMENT.md` marks this "Yes — throws clearly if missing." If this is also absent from the real Vercel production env, Razorpay webhook signature verification will throw on every real payment, meaning **paying customers may not receive credits**.
- `PAYPAL_ENV=https://sandbox.paypal.com` — consistent with, not contradicting, `PRODUCTION_ENVIRONMENT.md`'s note that PayPal is intentionally hardcoded to return 503 regardless of env config (Sprint 16 security fix). This value being present and unused is expected, not a bug.
- `AI_MODE=development` and `VIDEO_PROVIDER=ltx` in the local file — correct for local dev, but `PRODUCTION_ENVIRONMENT.md` already flags both as needing direct confirmation in the actual Vercel dashboard. **I cannot verify Vercel's real env from this environment** (no `VERCEL_TOKEN` configured) — this remains unverified, not assumed-fine.
- `.env.local` has **duplicate keys with conflicting dev/prod values** (`NEXT_PUBLIC_APP_URL` appears 3x: twice `localhost:3000`, once `https://reelforge.fabricaipro.com`; `NEXT_PUBLIC_WORKER_URL` appears 2x similarly). The last occurrence wins in practice, which currently happens to resolve to the correct production values — but this is fragile: any future edit that reorders or appends a new line could silently flip production back to `localhost`. Recommend de-duplicating this file (not done here — editing secrets-adjacent files beyond the one CORS fix felt out of scope for an unattended pass; flagging for a deliberate cleanup instead).
- Worker's own `.env` has the same duplicate-key pattern for `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`PORT` (placeholder template lines left in alongside the real values further down the file) — functionally resolves correctly (confirmed via live Supabase check below) but is the same fragility risk.
- No `.env.example` exists in either the root or `worker/` — already flagged in `PRODUCTION_ENVIRONMENT.md`; still true.

**Action needed:** confirm `RAZORPAY_WEBHOOK_SECRET`, real `AI_MODE`/`VIDEO_PROVIDER` state, and whether Stripe's live key is actually set, directly in the Vercel dashboard — none of this is visible from here.

---

## 2. Cloudinary configuration — ✗ Blocking

**Confirmed broken via two independent, real, live API calls today:**
- Upload API (`cloudinary.uploader.upload`, the actual code path `movieAssemblerV2.js` uses): `cloud_name is disabled` (previously found in RC4, re-confirmed still true now).
- Admin API (`GET /v1_1/{cloud_name}/ping`, direct HTTP, same credentials): `HTTP 401 unknown api_key`.

Two different error messages from two different Cloudinary API surfaces, same credentials, same moment — worth relaying both to Cloudinary support/dashboard as-is, since the discrepancy itself may help them diagnose faster (disabled cloud vs. a key that no longer validates could be two different underlying issues, or two symptoms of the same account-level suspension).

**This is not a code problem.** Credentials are present and well-formed; nothing in `movieAssemblerV2.js`, `cloudinaryUpload.js`, or any route needs to change. **This blocks 100% of production media delivery** — no render, no cartoon, no direct upload, nothing that touches Cloudinary will work until this is resolved directly in the Cloudinary account/billing dashboard.

---

## 3. Railway worker configuration — ✗ Blocking

Two independent problems, not one:

**a) The worker's production DNS subdomain does not exist.** `NEXT_PUBLIC_WORKER_URL=https://worker.reelforge.fabricaipro.com` in `.env.local` — but `worker.reelforge.fabricaipro.com` returns **no DNS records at all**, confirmed via two independent resolvers (Node's `dns` module and Windows' native `Resolve-DnsName`, querying `fabricaipro.com`'s actual authoritative nameservers directly — Cloudflare). By contrast, `reelforge.fabricaipro.com` resolves correctly (CNAME → Vercel, valid TLS cert through Oct 2026, live HTTP 200). **If this is really what's set on the live Vercel deployment, every worker-backed feature (reel/cartoon generation, captions, movie rendering) is unreachable in production right now** — not degraded, completely broken, since the frontend would be calling a hostname that doesn't resolve.

**b) `RAILWAY_API_KEY` (present in `.env.local`) is rejected by Railway's API** — a live, read-only GraphQL query returned `Not Authorized`. Either the token is expired/revoked, or it's the wrong token type/scope (Railway distinguishes account vs. project tokens). This means I also **cannot independently confirm** the worker service is actually deployed and healthy on Railway right now — that needs a direct dashboard check or a corrected token.

**One fix applied** (configuration only, not code): `worker/.env`'s `ALLOWED_ORIGIN` was `*` (wildcard CORS, confirmed read by `worker/src/index.js:18`) — tightened to `https://reelforge.fabricaipro.com`, matching `PRODUCTION_ENVIRONMENT.md`'s own recommendation to do this before launch. **This only changes the local file** — the equivalent variable must also be set on the actual Railway service's Variables tab for it to take effect in production.

`worker/railway.toml` is minimal (`[deploy] startCommand` only, no explicit healthcheck/restart policy) — not necessarily wrong (Railway can auto-detect the rest via Nixpacks), but worth a deliberate look rather than assuming defaults are what's wanted for a commercial launch.

---

## 4. Supabase production configuration — ✓ Ready (with 2 unverified sub-items)

Live connectivity **confirmed twice, real network round-trips, zero real data touched both times** (each call updates a row keyed by a freshly-generated random UUID that matches no real project — the update affects 0 rows by construction, proving auth/schema/connectivity without any write risk).

Not verified, both already flagged as open in `PRODUCTION_ENVIRONMENT.md` and unchanged by this pass:
- **RLS policies** — "not verified by any RC/validation pass to date." Still true; requires direct Supabase dashboard/SQL review, not something checkable via the service-role key alone without deliberately probing access-control boundaries (out of scope for a safe, non-destructive audit).
- **Backup tier/schedule** — plan-dependent, dashboard-only, not inferable from an API key.

---

## 5. Razorpay live mode — ⚠ Needs Configuration

Key **is** genuinely live-mode (`rzp_live_...`, confirmed by prefix). But `RAZORPAY_WEBHOOK_SECRET` is absent from the local env entirely, and `PRODUCTION_ENVIRONMENT.md` marks it required and fail-fast. A live key without a working webhook path means orders can be *created* but payment confirmation (and therefore credit-granting) may silently fail. Did not attempt to create or verify a real order — that would mean a real payment-adjacent API interaction on a live-mode key, which needs your explicit sign-off, not an unattended check.

---

## 6. PayPal live mode — ✓ Ready (correctly, intentionally disabled)

Per `PRODUCTION_ENVIRONMENT.md`: PayPal's `create-order`/`capture-order` routes are **intentionally hardcoded to return 503** (a deliberate Sprint 16 security decision — no real Orders API verification exists yet), regardless of any env var. `PAYPAL_ENV=sandbox` in the local file is therefore irrelevant, not a misconfiguration. This matches `GO_LIVE_CHECKLIST.md`'s own explicit check: *"PayPal correctly shows 'temporarily unavailable'... confirms it was not accidentally re-enabled."* Nothing to fix — the current state **is** the intended state.

---

## 7. Resend production email — ✓ Ready (not applicable)

Grepped the entire app/lib/services/components tree: **Resend is not referenced anywhere in the codebase.** No SendGrid/Postmark/Nodemailer/SMTP integration found either. Auth-flow emails (signup confirmation, password reset — per `GO_LIVE_CHECKLIST.md`'s Email section) are almost certainly delivered via Supabase Auth's own built-in email system, which is configured in the Supabase dashboard, not in this app's code or env vars. **There is no Resend integration to verify** — the original task's framing assumed a provider this app doesn't actually use. The real open item is confirming Supabase Auth's email deliverability/SMTP settings directly in the Supabase dashboard, which is outside what an API key can check.

---

## 8. Vercel deployment — ✓ Ready

Live-verified: `https://reelforge.fabricaipro.com` responds `HTTP 200`, served by Vercel (confirmed via response headers), with a valid TLS certificate matching the domain (see item 9). `vercel.json` is minimal but correct (`framework: nextjs`, standard build/output/install commands — nothing unusual). No `VERCEL_TOKEN` is configured here, so I can't inspect the deployment's actual env vars or build logs via API — but the deployment itself is demonstrably live and correctly served.

---

## 9. DNS and SSL — ✗ Blocking

- **`reelforge.fabricaipro.com`**: ✓ resolves correctly (CNAME to Vercel's DNS infrastructure), ✓ valid TLS certificate (subject matches domain, valid through Oct 27 2026), ✓ live HTTP 200.
- **`worker.reelforge.fabricaipro.com`**: ✗ **does not resolve at all** — no DNS record exists, confirmed via two independent resolvers against the domain's actual authoritative nameservers (Cloudflare: `adrian.ns.cloudflare.com`, `maxim.ns.cloudflare.com`). This is the same underlying gap as item 3a — the worker subdomain simply hasn't been created in DNS, or the Railway custom-domain mapping was never completed. **Fix: add a DNS record for the `worker` subdomain in the Cloudflare dashboard pointing at the actual Railway deployment** (its `*.up.railway.app` address or whatever CNAME target Railway's custom-domain setup specifies) — this needs direct Cloudflare/Railway dashboard access I don't have here.

---

## 10. Monitoring and logging — ⚠ Needs Configuration (pre-existing, already documented)

Grepped for Sentry/Datadog/New Relic/LogRocket across the app and worker: **none found** — no APM or error-aggregation tool is integrated anywhere in the codebase. This matches `GO_LIVE_CHECKLIST.md`'s own explicit acknowledgment: *"no automated uptime/error-aggregation tool is configured — this is a tracked known limitation, not a launch blocker on its own."* I'm not overriding that prior, deliberate call — flagging it here for completeness since it was one of the 10 requested items, not treating it as a new discovery or escalating its severity beyond what's already been decided.

The one real automated signal that does exist: the worker's `/health` endpoint (`worker/src/index.js:31`) — returns `status`, active TTS/lipsync/stock-video provider, and `wav2lip_ready`. Code-reviewed as correct and informative. Could not be hit live in production because of item 3/9's DNS gap (there's no reachable `worker.reelforge.fabricaipro.com` to call).

---

## What did NOT need fixing

Per the task's instruction to explicitly state when application code is already correct: **`worker/src/index.js`'s CORS handling, the `/health` endpoint implementation, `vercel.json`, and every application code path touched by this audit were already correct** — every issue found this pass is a *configuration/infrastructure* gap (missing DNS record, disabled Cloudinary account, missing webhook secret, unauthorized API token, messy env files), not a code defect. No application code changes were made or are recommended from this report.

---

## Recommendations, in priority order

1. **Cloudinary account status** (item 2) and **worker DNS** (items 3a/9) are both full-stop launch blockers — first paying customer to generate anything hits either a broken upload or an unreachable worker. Fix both before any other item here matters.
2. Set `RAZORPAY_WEBHOOK_SECRET` in the real production environment (item 5) — a live payment key without working webhook verification risks customers paying and not receiving credits.
3. Get a working `RAILWAY_API_KEY`/token (item 3b) so worker deployment health can actually be monitored/verified going forward — currently flying blind on that service's real status.
4. Confirm directly in Vercel's dashboard: `AI_MODE` is unset, `VIDEO_PROVIDER` is not `local`, and whether the live Stripe key vs. the local file's test key is what's actually deployed (item 1).
5. Clean up the duplicate-key `.env.local` / `worker/.env` files (item 1) — not urgent functionally (last-value-wins currently resolves correctly) but one bad future edit away from a silent production regression.
6. Everything else here (items 6, 7, 8, 10) needs no action — already correct or already a known, accepted, documented tradeoff.
