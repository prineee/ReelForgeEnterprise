# Launch Checklist — ReelForge Enterprise

Source: RC-1_REPORT.md, RC2_REPORT.md, RELEASE_VALIDATION_REPORT.md (repo root). This
checklist translates their findings into go/no-go items. Items marked **[ACCEPT AS
KNOWN GAP]** are not bugs to fix pre-launch under the frozen-architecture mandate — they
need an explicit sign-off decision, not code.

---

## Authentication

- [x] Register / Login / Password reset — verified end-to-end, Supabase-backed. READY.
- [x] Email verification UI — fixed in RC-2 (register page now shows "check your email").
- [ ] **Confirm in Supabase dashboard**: email-confirmation-on-signup is actually toggled
      on for the production project — unverifiable from code.
- [ ] **Confirm in Supabase dashboard**: Google OAuth is enabled/configured if you intend
      to offer it — UI + callback route exist, but enablement is dashboard-only.
- [ ] Confirm Supabase Auth redirect URLs include the production domain.

## Credits

- [x] Purchase (Stripe/Razorpay) → `users.credits` — READY, atomic, verified.
- [x] Balance display — READY, reads real `users.credits`.
- [x] Deduction for the 9 direct-generation routes (`lib/credits.ts`) — READY.
- [ ] **[ACCEPT AS KNOWN GAP]** Movie Studio's actual entry point
      (`POST /api/movie/create`) does **not** deduct real `users.credits` — it runs
      through an in-memory-only ledger (`InMemoryCreditLedger`), disconnected from the
      purchased balance. The production dev-seed exploit on this path was closed in
      RC-2; the underlying disconnect (flagship feature not billing correctly) remains
      and requires an async architecture migration to close, out of scope for this pass.
      **Decision needed:** ship with this as a tracked known-issue (fine if the beta
      isn't processing real payments against Movie Studio usage specifically), or hold
      launch until it's fixed.
- [ ] No per-action deduction audit trail exists for the 9 direct routes (only purchases
      are logged). Acceptable for launch, but support/dispute resolution for "where did
      my credits go" has no data source today — flag to support team.

## Payments

- [x] Stripe — READY, signature-verified webhook, confirmed multiple passes.
- [x] Razorpay — READY, signature-verified webhook, confirmed multiple passes.
- [x] PayPal UI — fixed in RC-2, shows honest "temporarily unavailable" notice.
- [ ] **PayPal remains non-functional by design** — backend returns 503, no real Orders
      API verification built. Confirm no launch/marketing material advertises PayPal as
      a working payment method.
- [ ] Live Stripe/Razorpay keys configured in production (not the `REPLACE_ME`
      placeholders / dev keys currently in `.env.local`) — see `DEPLOYMENT_CHECKLIST.md` §5.
- [ ] Stripe and Razorpay webhook endpoints registered against the production domain.

## Movie generation

- [x] Movie Studio Workspace / Storyboard / Character Studio / Scene Studio / Render
      Center — all READY, real data, no mocks, reachable from nav.
- [ ] **[ACCEPT AS KNOWN GAP — highest-severity open item in this checklist]** A failure
      at 5 of 6 pipeline stages (Reference Images, Scene Prompts, Video Generation,
      Movie Assembly, Final Rendering) never records `context.failure`. The status the
      UI polls derives from completed-stage count when no failure is recorded, so an
      affected job shows "in progress" forever instead of surfacing an error. Per the
      Release Validation Report, this is a real beta blocker for any group of users
      expected to notice and report stuck jobs. **Decision needed** before opening to
      real users at any scale beyond a fully-monitored closed group.
- [ ] In-memory job/context state has no restart recovery — a deploy mid-generation
      silently abandons the job. Combined with the above, a user has no way to know
      their job is gone. Acceptable only if launch traffic is low enough that ops can
      manually watch for this.

## Rendering

- [x] Render queue / render jobs — READY, live, no mock data.
- [x] LTX provider — READY, registered, fails fast on missing credentials.
- [x] Google Veo provider — READY as default fallback; does **not** fail fast on bad
      credentials (surfaces as opaque error mid-generation) — confirm `GEMINI_API_KEY`
      is valid before launch, don't rely on a startup check to catch it.
- [ ] **Confirm `VIDEO_PROVIDER` in production is not `local`.** Local GPU backend is an
      explicit synthetic-test-pattern placeholder, not real video generation — safe for
      infra testing, not for real users.
- [ ] **[ACCEPT AS KNOWN GAP]** No automatic health/cost-based provider routing or
      fallback-on-failure — a provider outage requires a manual env var change and
      redeploy. Documented as intentional Sprint 5+ deferral, not a bug.

## Affiliate

- [x] Links / Tracking / Dashboard / Commission — all READY, verified end-to-end.
- [x] Payout self-service history — fixed in RC-2 (was showing empty due to a wrong-column
      query).
- [x] Admin payout management — READY, `requireAdmin()`-gated.
- [ ] No rate limiting on `affiliate/track` — a known, unfixed low-severity risk (an
      attacker could spam a competitor's referral code to inflate/dilute their
      conversion stats). Not launch-blocking, worth a post-launch ticket.
- [ ] No input validation on `affiliate/payment-settings` payout-destination fields
      (PayPal email, bank account, IFSC). Ownership is correctly scoped (not a
      redirect-to-attacker vulnerability), just missing hygiene — post-launch ticket.

## Admin

- [x] Dashboard now shows real metrics (fixed RC-2, was a static 3-link grid).
- [x] Analytics and Payout Management — READY, admin-gated.
- [x] All 6 `app/api/admin/**` routes confirmed calling `requireAdmin()`, re-verified
      with no regression in the Release Validation pass.
- [ ] Admin **pages** (not API routes) have no UI-level route guard — a non-admin
      visiting an admin URL briefly sees layout/chrome before every panel errors out on
      the data fetch. Not a data leak (API-level auth holds), but a UX/polish gap —
      acceptable for launch, worth a follow-up.
- [ ] Confirm production `users.is_admin` is set correctly for intended admin accounts
      only — see `DEPLOYMENT_CHECKLIST.md` §3.

## Email

- [ ] Transactional email is Supabase Auth's own (signup confirmation, password reset)
      — no separate app-level email service was found in this codebase. Confirm
      Supabase's email delivery (its own SMTP or a configured provider) is set up for
      the production project — dashboard-only, not visible in code.
- [ ] No other application email (receipts, notifications) exists in this codebase to
      check — out of scope, not a gap, simply not a built feature.

## Storage

- [x] Cloudinary confirmed as the sole production media store; no stray local-disk
      writes for real media (only the known Local GPU test-pattern placeholder writes
      locally, which is expected).
- [ ] Cloudinary credentials set on **both** Vercel and Railway independently — see
      `PRODUCTION_ENVIRONMENT.md` → Storage.

## Monitoring

- [ ] **No `/api/health` endpoint on the Next.js app.** The worker has one
      (`GET /health`); the frontend does not. A deploy platform/uptime monitor has
      nothing to probe on the frontend side — an outage is discoverable only via user
      reports today. Recommend adding a trivial health route before or immediately
      after launch.
- [ ] **No error aggregation/APM** (no Sentry/Datadog/equivalent anywhere in
      `package.json`). Failures are visible only in Vercel/Railway stdout logs.
      `OPERATIONS_RUNBOOK.md`'s "Daily monitoring" section is a manual stopgap, not a
      substitute — recommend adding real error aggregation soon after launch, sooner if
      launch traffic is meaningful.
- [ ] 6 lines of `// TEMPORARY DIAGNOSTIC — trace only` logging remain in
      `WorkflowExecutor.ts` / `WorkflowCoordinator.ts`, dumping full blueprint contents
      on every run. Not a correctness bug, but noisy — clean up before or shortly after
      launch.

## Analytics

- [x] Admin Analytics page (`/admin/affiliate-analytics`) — READY, real data,
      admin-gated.
- [ ] No product/usage analytics (e.g. PostHog, GA, Mixpanel) was found in this
      codebase during any RC pass — if launch requires usage analytics, that's net-new
      scope, not a gap in what exists today.

## Backup

- [ ] **No SQL migration files exist anywhere in the repo** — schema and RLS policies
      live entirely in the Supabase dashboard, unversioned. This is a real
      reproducibility/rollback gap, unchanged across all three RC/validation passes.
      See `OPERATIONS_RUNBOOK.md` → Database backup for the recommended stopgap (export
      schema-only backup, store outside the DB itself) before launch.
- [ ] Confirm Supabase's own backup tier/schedule for the production project matches
      your RPO/RTO expectations — plan-dependent, verify directly in the dashboard.

## Security

- [x] No hardcoded live/test API key patterns in source — all secrets read from
      `process.env`, re-verified in the Release Validation pass.
- [x] No debug/test endpoints remain (`app/api/debug-env`, `app/api/test-tts` both
      removed in Sprint 16).
- [x] Ownership-scoping (`user.id`/`userId` checks) confirmed across 18 files spanning
      movie-studio, render, and affiliate routes — no regression found.
- [x] Production dev-seed credit exploit closed (RC-2 Task 5) — non-production only now.
- [ ] **`.env.local` / `worker/.env` hold real live secrets in plaintext on disk**,
      including a live Razorpay key. Not committed to git, but recommend rotating these
      credentials before/at launch if this machine, repo, or any backup of it has ever
      been shared. See `PRODUCTION_ENVIRONMENT.md` → Security.
- [ ] **No RLS policy audit performed by any pass to date** — application-level
      ownership checks are verified, database-side Row Level Security policies are not.
      Verify directly in Supabase before launch — this is the single largest unverified
      security surface in the whole checklist.
- [ ] `heygen/status` has no ownership check on `video_id` (no local table links a
      video_id to a user) — known, unfixed, requires new persistence to close properly.
      Low-severity given the external worker owns the job entirely, but worth tracking.
- [ ] `account/delete` has no re-auth/confirmation step before an irreversible action —
      a hijacked session can delete the account in one request. Known, unfixed.
- [ ] Raw Supabase `error.message` is returned to the client in many routes — low
      severity (internal DB error text, not secrets) but inconsistent; only partially
      normalized. Post-launch cleanup candidate.

---

## Summary

- **Fully READY, no action needed:** Authentication core flows, direct-route Credits,
  Stripe/Razorpay payments, Affiliate, Admin, Storage, most of Rendering.
- **Needs a manual dashboard confirmation before launch (not a code fix):** Supabase
  email-confirmation toggle, Google OAuth enablement, RLS policy audit, `is_admin`
  correctness, live payment keys in place.
- **Needs an explicit go/no-go decision from whoever owns the launch (documented,
  known, structural — not fixable under frozen architecture):** Movie Studio credit
  ledger disconnect, Movie Creation silent-hang-on-failure bug.
- **Recommended but not blocking:** add a frontend `/api/health` endpoint, add error
  aggregation, export a schema-only DB backup, remove temporary diagnostic logging.
