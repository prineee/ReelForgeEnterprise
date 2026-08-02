# RC-1 Release Candidate Report — ReelForge Enterprise

**Branch:** feature/ltx-video-provider
**HEAD:** 5d74894 (RC-2 Task 4 — PayPal UI disabled)
**Date:** 2026-07-28
**Prepared by:** Release Manager pass (verification pass; three targeted fixes from an interrupted RC-2 pass are already committed on this branch — see changelog below)

---

## Changelog since the first RC-1 pass (HEAD was 8efea3a)

Three narrow, verified bug fixes landed and are reflected in the table below:

- `62595c9` — Email verification: register page now shows a "check your email" state (previously silently did nothing).
- `8a9b926` — Asset Intelligence: reference-image assets now carry a real `characterName` instead of a hardcoded `null`.
- `5d74894` — PayPal: checkout widget replaced with a disabled notice, matching the already-disabled backend, so users can no longer enter a checkout flow that can't succeed.

The affiliate payout bug, admin dashboard polish, and credits ledger gap from the first pass are **not yet fixed** — still open, see below. Additionally, this pass surfaced one **new, more serious finding** in Credits (see item 4 in Blocking Issues) that the first pass did not catch.

## 1. Build Status

**PASS.** `npm run build` (Next.js 16.2.10, Turbopack) compiled successfully, TypeScript passed inside the build, and all 120 pages were generated with zero errors, on current HEAD.

No code changes were required for the build itself.

Non-blocking notice: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` — cosmetic, does not affect this build, worth a Sprint 17 ticket.

## 2. TypeScript Status

**PASS.** `npx tsc --noEmit` completed with zero errors, zero output, on current HEAD.

No code changes were required.

## 3. RC-1 Readiness Table

| Area | Module | Verdict | Evidence |
|---|---|---|---|
| Auth | Register | READY | `app/(auth)/register/page.tsx` → Supabase `signUp()`, wired to affiliate tracking |
| Auth | Login | READY | `app/(auth)/login/page.tsx` → Supabase `signInWithPassword()` |
| Auth | Email verification | READY *(fixed)* | `62595c9` added the missing "check your email" UI branch — the `success` state was being set but never rendered, so users got zero feedback after a confirmation-required signup. The actual verification-link handler (`api/auth/callback`) was already correct. Whether Supabase's email-confirmation setting itself is toggled on is still a project-dashboard setting, not code — confirm before sign-off. |
| Auth | Password reset | READY | `forgot-password` → `reset-password` full loop via Supabase recovery flow |
| Auth | Google login | PARTIAL | UI + OAuth callback route exist; actual enablement depends on Supabase project config, not visible in repo |
| Movie Studio | Workspace | READY | `app/movie-studio/workspace/[movieId]/page.tsx`, ownership-checked, reachable from nav |
| Movie Studio | Storyboard | READY | Tab within Workspace (`WorkspaceCenterPanel.tsx`), submits real renders |
| Movie Studio | Character Studio | READY | `app/movie-studio/characters/**`, cross-linked from Workspace/Render Center |
| Movie Studio | Scene Studio | READY | `app/movie-studio/scenes/**`, cross-linked from Workspace/Job Details |
| Movie Studio | Render Center | READY | `app/movie-studio/render-center/page.tsx`; old `/movie-production` now redirects here (consolidation confirmed) |
| AI | Movie Producer | READY | `services/ai/movie-producer/MovieProducer.ts`, wired via factories into scene pages |
| AI | Director | READY | `DirectorEngine.ts` + `AIDirectorEngine.ts`, wired into Workspace/scene UI |
| AI | Prompt Pipeline | READY | `DirectorPromptPipeline.ts`/`PromptComposer.ts` feed render + LLM providers, surfaced in `PromptViewerPanel.tsx` |
| AI | Asset Intelligence | PARTIAL *(narrowed)* | `8a9b926` fixed the one real bug (character name was discarded despite being available — now threaded through `MovieProductionService` → artifact metadata → `adapter.ts`). What remains PARTIAL is by design, not a bug: `services/ai/asset-intelligence/AssetManager.ts` is a movie-planning catalog (character bios/shot presets/music&voice plans, keyed by ephemeral per-production ids), a different concept from Asset Manager's generated-media browser (keyed by persistent records/workflow artifacts) — forcing them together would be new feature scope, not a fix. |
| Rendering | Queue | READY | `services/rendering/jobs/RenderJobManager.ts` is the live queue backing Render Center |
| Rendering | Render Jobs | READY | `/api/movie-studio/[movieId]/render-jobs` + `/render`, no mock data, surfaced in Workspace and Render Center |
| Rendering | Provider Selection | PARTIAL *(verified, no bug found)* | Traced the full chain (`ProviderSelector` → `RenderDecisionEngine` → `RenderOrchestrator` → `ProviderRegistry`), the separate `services/orchestrator/` health-aware estimator, and `services/rendering/health/ProviderHealthMonitor`. All internally consistent with their own documentation; no contradictory or broken wiring. Manual `VIDEO_PROVIDER` env-var switch only — no automatic health/cost-based routing or fallback-on-failure, both explicitly deferred to "Sprint 5+" in the code's own comments, not bugs. |
| Rendering | Local GPU | PARTIAL | Fully wired pipeline, but backend (`SyntheticTestPatternBackend.ts`) is explicitly a placeholder ffmpeg test pattern, not real video generation |
| Rendering | LTX (feature branch) | READY | `LTXCloudProvider`/`LTXVideoClient` registered unconditionally in provider registry, no stubs; depends on `LTX_API_KEY` at runtime (untested live) |
| Rendering | Google provider | READY | `GoogleVeoProvider`, default fallback provider, keyed by `GEMINI_API_KEY` |
| Payments | Razorpay | READY | Create-order → checkout → HMAC-verified server-side credit grant |
| Payments | Stripe | READY | Checkout session → signature-verified webhook → credit grant |
| Payments | PayPal | **BLOCKED (intentionally disabled)** *(UI fixed)* | Backend unchanged — Sprint 16 Task 5.6 stripped all order logic, routes still return `503` with zero DB writes. `5d74894` replaced the live checkout widget with a static "temporarily unavailable" notice, so the previously-broken UX (click through to a checkout that always fails) is resolved. Still BLOCKED because PayPal payments don't work — a real Orders API integration doesn't exist. |
| Credits | Purchase | READY | Stripe/Razorpay verified paths atomically credit `users.credits` |
| Credits | Deduction | **PARTIAL — reclassified, see Blocking Issue #4** | `lib/credits.ts requireCredits()` correctly deducts real `users.credits` for 9 direct generation routes. But Movie Studio's actual entry point (`POST /api/movie/create`, the flagship feature) deducts through a completely different, **in-memory-only** ledger that never touches `users.credits` at all — see below. First-pass RC-1 marked this READY without tracing that path; this pass did. |
| Credits | Balance | READY | Displayed in dashboard shell and billing page from live `users.credits` — but see #4, this balance is not what Movie Studio actually checks/spends against |
| Credits | Ledger | PARTIAL | Only purchase history exists in Supabase (`payments` table); no usage-side deduction log for the `lib/credits.ts` routes. A separate, purpose-built ledger (`services/billing/CreditTransaction.ts`/`CreditManager.ts`, full reserve/consume/release semantics) exists and *is* wired into Movie Studio's Workflow path — but it's in-memory only, not Supabase-backed (see #4) |
| Affiliate | Links | READY | `/affiliate/links` from `/api/affiliate/stats`, referral code generated at join |
| Affiliate | Tracking | READY | Full loop: register capture → `ReferralTracker` → `save-referral` persistence |
| Affiliate | Dashboard | READY | `/affiliate/dashboard` from auth-scoped `/api/affiliate/dashboard` |
| Affiliate | Commission | READY | Sale-based (Razorpay verify) and signup-referral (save-referral) accrual both wired; displayed post security-fix scoping |
| Affiliate | Payout | **PARTIAL — functional bug, not yet fixed** | Requesting + admin approval work end-to-end, but `GET /api/affiliate/payout/route.ts` filters on the wrong column (`affiliate_id = user.id` instead of `affiliates.id`), so an affiliate's own "my payout requests" view always renders empty. Dashboard aggregate totals are unaffected (different, correct query). Also leftover debug `console.log`s. |
| Admin | Dashboard | PARTIAL — not yet fixed | Page exists but is a 3-link grid with no metrics rendered, despite a working stats API (`/api/admin/stats`) nothing consumes; not linked from main app nav. Stale unauthenticated duplicate `app/admin/stats/route.ts` exists outside `app/api/` but is uncalled (dead code, not a live security hole). |
| Admin | Analytics | READY | `/admin/affiliate-analytics` ← admin-gated API, real data |
| Admin | Payout Management | READY | `/admin/affiliate-payouts` list + pay actions, both `requireAdmin()`-gated |

## 4. Known Risks

- **Provider Selection is env-var only**: no automatic failover/health-aware routing between LTX, Google, and Local GPU; an outage on the selected provider requires a manual env change and redeploy. Verified as an intentional, documented Sprint 5+ deferral, not broken wiring.
- **Local GPU produces placeholder output** (synthetic test pattern), not real generated video — safe for infra testing, not for production use if exposed to end users.
- **`lib/credits.ts` deduction path has no per-action audit trail** — only purchases are logged (`payments` table), not the 9 direct-route deductions. Support/dispute resolution for "where did my credits go" has no data source for that path.
- **Google login and email-confirmation-enabled depend on Supabase project dashboard config**, not the codebase — cannot be verified as "on" from a code read; confirm directly in the Supabase project before RC sign-off.

## 5. Blocking Issues

1. **Movie Studio does not deduct real credits — NEW, most severe finding this pass.** `POST /api/movie/create` (Movie Studio's actual entry point) runs through `WorkflowExecutor` → `BillingEngine.reserveForProduction()` → `CreditManager` → `InMemoryCreditLedger` (`services/billing/CreditTransaction.ts`). This ledger is a plain in-process `Map`, instantiated as a single shared singleton in `services/infrastructure/MovieProductionFactory.ts:685` (`createDefaultBillingEngine()`, no ledger argument passed) — it is **completely disconnected from `users.credits`** (the real, purchased balance shown on the Billing page and deducted by `lib/credits.ts` for other routes). Concretely: (a) it grants any user it has never seen a **500-credit dev seed** on first read, not their real balance; (b) it resets to empty on every server restart/redeploy; (c) generating movies through the flagship feature never reduces a user's actual purchased credits. This was not caught in the first RC-1 pass because that pass verified `lib/credits.ts`'s 9 routes and stopped there without tracing Movie Studio's own request path. **Not fixed in this pass** — a proper fix means either a Supabase-backed `CreditLedger` implementation (new transactions table) or rewiring `BillingEngine`'s balance source to `users.credits`, both bigger than a verification-only pass should do unilaterally; flagging for an explicit decision before RC ships.
2. **Affiliate self-service payout history is broken** (`app/api/affiliate/payout/route.ts` wrong column) — affiliates cannot see their own past payout requests. Low effort fix, still not applied.
3. **Admin Dashboard shows no real metrics** — not release-blocking for end users, but blocks admin operators from getting an at-a-glance view; stats API already exists and just needs to be wired to the page.

Resolved since the first pass: PayPal's broken checkout UX (#2 previously) and the email-verification silent no-op are both fixed (see changelog). Provider Selection, Local GPU, and Asset Intelligence's remaining PARTIAL status are confirmed **known limitations**, not broken/blocking paths — each has a working happy path with a documented, intentional gap.

## 6. Recommended Next Actions

1. **Decide how to handle the Movie Studio credit-deduction bug (#1 above) before shipping** — this is a real revenue/billing-integrity issue on the core paid feature, not a cosmetic gap.
2. Fix the affiliate payout query bug (1-line column fix) — smallest, highest-value fix still outstanding.
3. Confirm Google OAuth and Supabase email-confirmation are actually enabled in the target Supabase project (not verifiable from code).
4. Wire the existing `/api/admin/stats` data into `app/admin/page.tsx`, or explicitly scope that out of RC-1.
5. File Sprint 17 tickets for the remaining known risks (provider health routing, Local GPU real backend, `lib/credits.ts` per-action ledger) — none block RC-1 on their own, all are roadmap items.

Three targeted fixes were committed on this branch prior to this report (see changelog); no further code was modified to produce this report itself.
