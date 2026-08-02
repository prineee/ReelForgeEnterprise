# Known Limitations — ReelForge Enterprise

Every item below is a genuine, verified finding from RC-1_REPORT.md, RC2_REPORT.md,
RELEASE_VALIDATION_REPORT.md, docs/BETA_CHECKLIST.md, or direct repository audit during
this deployment-configuration pass. Nothing here is speculative — each item traces to a
specific file/behavior that was actually inspected. None of these are fixed by this
pass; this document exists so they're launched with eyes open, not discovered later.

---

## Billing / Credits

**Movie Studio does not deduct real credits.** `POST /api/movie/create` (the flagship
feature's actual entry point) runs through `WorkflowExecutor` → `BillingEngine` →
`CreditManager` → `InMemoryCreditLedger`, a plain in-process `Map`, completely
disconnected from `users.credits` (the real, purchased balance shown on the Billing
page and correctly deducted by `lib/credits.ts`'s 9 direct-generation routes). The
production dev-seed exploit on this path (500 free credits to any never-seen user) was
closed in RC-2. The underlying disconnect was not: making it Supabase-backed requires
converting the `CreditLedger`/`CreditManager`/`BillingEngine`/`WorkflowExecutor` chain
from synchronous to async through all four layers — a structural interface change,
correctly deferred as architecture work rather than attempted under a frozen-
architecture mandate. **Needs an explicit launch decision, not a code fix under this
pass.**

**No per-action deduction audit trail** for `lib/credits.ts`'s 9 direct-generation
routes — only purchases are logged (`payments` table). Support/dispute resolution for
"where did my credits go" has no data source for that path.

## Movie Generation Pipeline

**Silent hang on mid-pipeline failure.** `MovieProductionService.ts` only records
`context.failure` in the Stage 1 (Story Analysis) catch block. The other 5 stage-level
catch blocks (Reference Images, Scene Prompts, Video Generation, Movie Assembly, Final
Rendering) throw a wrapped error but never set `context.failure`. Since the status the
UI polls derives `overallStatus` from completed-stage count when no failure is
recorded, a failure at any of those 5 stages leaves the user's screen reading "in
progress" indefinitely instead of surfacing an error. Verified by direct code
inspection in the Release Validation pass, not just cited from research. **The single
highest-severity open item across all validation passes.**

**No restart recovery for in-flight jobs.** The job queue (`QueueManager`), render job
manager (`RenderJobManager`), and production context store
(`ProductionContextRepository`) are all `globalThis` Map-backed, in-memory only. A
server restart/redeploy mid-generation silently abandons any in-flight job with no
automatic recovery, and compounds the silent-hang issue above since the user has no way
to know the job is gone.

## Rendering

**Provider selection is manual, env-var only.** `VIDEO_PROVIDER` is a single switch
between `ltx` / `google` / `local` — no automatic health-aware or cost-based routing,
no fallback-on-failure. An outage on the selected provider requires a manual env var
change and redeploy. Explicitly documented as an intentional Sprint 5+ deferral in the
code's own comments, not broken wiring — verified by tracing the full chain
(`ProviderSelector` → `RenderDecisionEngine` → `RenderOrchestrator` → `ProviderRegistry`,
plus the separate `services/orchestrator/` cost estimator and
`services/rendering/health/ProviderHealthMonitor`) across two separate passes with no
contradictory or broken wiring found.

**Local GPU backend is a placeholder.** `SyntheticTestPatternBackend.ts` produces an
ffmpeg test pattern, not real generated video. Safe for infra testing, not for
production use if `VIDEO_PROVIDER=local` is ever left set for real users.

**Google Veo does not fail fast.** Unlike LTX and Gemini's direct script-generation
usage, a misconfigured `GEMINI_API_KEY` for the Google Veo render provider surfaces as
an opaque SDK-level error mid-generation rather than a clean startup check.

## Payments

**PayPal is intentionally non-functional.** `create-order`/`capture-order` were
disabled (Sprint 16 security fix) because they granted credits immediately with zero
verification against PayPal's own API that a payment had actually happened. They now
return 503 unconditionally. The UI was fixed in RC-2 to show an honest "temporarily
unavailable" notice instead of a live checkout widget leading to a guaranteed failure.
This is a real capability gap (no working PayPal), not a bug — re-enabling it requires
building genuine server-side Orders API verification, out of scope for a
deployment-configuration pass.

## Database / Schema

**No SQL migration files exist anywhere in the repo.** Schema and RLS policies live
entirely in the Supabase dashboard, unversioned. Confirmed absent across every RC pass
and this deployment-configuration pass. Real reproducibility/rollback gap: there is no
automated way to diff a target environment's schema against "what the app expects," and
no migration-based rollback if a manual schema change goes wrong.

**No RLS policy audit has ever been performed.** Every prior pass (RC-1, RC-2, Release
Validation, Sprint 16 security audit) explicitly scoped itself to application-code
ownership checks only, not the database-side Row Level Security policies themselves.
This remains the single largest unverified security surface in the project as of this
document.

## Observability

**No `/api/health` endpoint on the Next.js app.** The Railway worker has one
(`GET /health`); the frontend does not. Confirmed by direct search — no matching route
exists.

**No error aggregation / APM.** No Sentry, Datadog, or equivalent SDK anywhere in
`package.json` or the codebase. Failures are visible only in platform stdout logs
(Vercel/Railway), not paged or aggregated across restarts.

**No product/usage analytics.** No PostHog/GA/Mixpanel/equivalent found in the
codebase. The only analytics that exists is the admin-facing affiliate analytics page,
which is a different, already-working feature.

**Leftover diagnostic logging in the critical path.** `WorkflowExecutor.ts` and
`WorkflowCoordinator.ts` contain lines explicitly labeled
`// TEMPORARY DIAGNOSTIC — trace only`, logging full blueprint contents on every run.
Not a correctness bug — noisy and unpolished, a cleanup candidate.

## Security

**`.env.local` / `worker/.env` hold real, live secrets in plaintext on disk**,
including a live Razorpay key. Confirmed not committed to git (`.gitignore` covers
`.env*`), but this was already flagged in `docs/BETA_CHECKLIST.md` as needing a
rotation decision before launch if the repo/machine was ever shared, zipped, or backed
up anywhere — that recommendation still stands and was not acted on between that audit
and this one.

**`account/delete` has no re-auth/confirmation step** before an irreversible action — a
hijacked session can delete the account in a single request.

**`affiliate/track` has no rate limiting** — an attacker could spam a competitor's
referral code to inflate click counts and dilute their conversion rate.

**`affiliate/payment-settings` has no input validation** on payout destination fields
(PayPal email, bank account, IFSC). Ownership is correctly scoped, so this is a hygiene
gap, not a redirect-payout-to-attacker vulnerability.

**`heygen/status` has no ownership check on `video_id`** — the external lipsync worker
owns that job entirely and there's no local table linking a video_id to a user. Closing
this properly needs new persistence, out of scope for a hardening-only or
deployment-only pass.

**Admin pages have no UI-level route guard.** `app/api/admin/**` routes correctly
enforce `is_admin` server-side, but the admin **pages** render their shell/chrome before
their data fetches fail, so a non-admin visiting the URL briefly sees layout before
every panel errors out. Not a data leak — the API layer holds — but a UX gap.

**Raw Supabase `error.message` is returned to the client in many routes.** Low
severity (internal DB error text, not secrets) but inconsistent — only partially
normalized to generic error messages across the codebase.

## Process / Repository

**`feature/ltx-video-provider` and `main` have diverged significantly** — 87 commits,
566 files. Every RC/validation pass ran against the feature branch, not `main`. If a
deploy pipeline is pointed at `main`, it is pointing at an untested branch.

**Two competing "Movie Studio" experiences remain live** — a legacy page is still
reachable by direct URL, unlinked from navigation. Flagged in `docs/BETA_CHECKLIST.md`
as a product decision (consolidate or remove), not made in any pass to date.

**No shared API client** — `fetch('/api/...')` calls are scattered across page
components with locally-redefined response types. Works today, a source of future
drift, not a launch blocker.

---

## Explicitly not a limitation (to avoid future confusion)

- **PayPal being disabled is a deliberate security decision, not an oversight** — do
  not "rediscover" this as a new bug.
- **Local GPU producing placeholder video is intentional and documented in the code's
  own comments** — only a problem if it's the *configured* production provider.
- **MongoDB is not part of this stack** — there is nothing to migrate, configure, or
  troubleshoot there; it should not appear in future audits as a gap.
