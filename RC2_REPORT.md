# RC-2 Release Candidate Report — ReelForge Enterprise

**Branch:** feature/ltx-video-provider
**HEAD:** 9c500c4 (RC-2 Task 7 — Admin Dashboard polish)
**Date:** 2026-07-29
**Prepared by:** Release Manager pass — resolving every PARTIAL/BLOCKED item from RC-1. Architecture frozen; no new features, no redesigns.

---

## 1. Build Status

**PASS.** `npm run build` (Next.js 16.2.10, Turbopack) compiled successfully, all 120+ routes generated, zero errors, on current HEAD (after all seven tasks).

## 2. TypeScript Status

**PASS.** `npx tsc --noEmit` completed with zero errors, zero output, on current HEAD.

## 3. RC-2 Readiness

| Area | Module | RC-1 Verdict | RC-2 Verdict | Notes |
|---|---|---|---|---|
| Auth | Email Verification | PARTIAL | **READY** | Fixed — see Bugs Fixed #1 |
| AI | Asset Intelligence | PARTIAL | **PARTIAL** | Real bug fixed; remaining gap is by design, not a defect — see below |
| Rendering | Provider Management | PARTIAL | **PARTIAL** | Verified end-to-end, no broken/inconsistent wiring found; gaps are intentional, documented future-sprint deferrals |
| Payments | PayPal | BLOCKED | **BLOCKED** | Backend correctly stays disabled (security fix, Sprint 16); broken checkout UX now fixed — see Bugs Fixed #3 |
| Credits | Ledger | PARTIAL | **PARTIAL / one BLOCKED sub-item fixed** | Closed the free-credits exposure; the deeper persistence gap remains and cannot be closed without an architecture change — see below |
| Affiliate | Payout | PARTIAL | **READY** | Fixed — see Bugs Fixed #4 |
| Admin | Dashboard | PARTIAL | **READY** | Fixed — see Bugs Fixed #5 |

### Why Asset Intelligence and Provider Management stay PARTIAL

Both were audited in full this pass, not just re-stated from RC-1:

- **Asset Intelligence**: the one real bug (reference-image assets had `characterName` hardcoded to `null` despite the name being available) is fixed. What remains PARTIAL is intentional: `services/ai/asset-intelligence/AssetManager.ts` is a movie-*planning* catalog (character bios, shot presets, music/voice plans, keyed by ephemeral per-production ids) — a different concept from the user-facing Asset Manager's generated-*media* browser (keyed by persistent records/workflow artifacts). Merging them would be new feature scope, not a bug fix, so left alone per "do not create a new AI system."
- **Provider Management**: traced the full chain — `ProviderSelector` → `RenderDecisionEngine` → `RenderOrchestrator` → `ProviderRegistry`, the separate `services/orchestrator/` health-aware cost estimator, and `services/rendering/health/ProviderHealthMonitor`. Everything is internally consistent with its own documentation; no contradictory or broken wiring exists to remove. The gaps — no automatic health/cost-based routing, no fallback-on-failure — are explicitly marked "Sprint 5+" in the code's own comments. Building either now would be new feature work, forbidden by this task.

### Why Credits Ledger is the one area with a real remaining gap

Two separate, independently-discovered issues:

1. **Fixed**: `InMemoryCreditLedger`'s dev-convenience seed (500 free credits for any user the in-memory ledger had never seen) was active in every environment, including production. Gated to non-production only — a never-before-seen user in production now starts at a real 0.
2. **Not fixed, cannot be fixed without architecture change**: Movie Studio's actual generation entry point (`POST /api/movie/create` → `WorkflowExecutor` → `BillingEngine` → `CreditManager` → `InMemoryCreditLedger`) still does not touch the real, persisted `users.credits` balance shown on the Billing page. The `CreditLedger` interface (`services/billing/CreditTransaction.ts`) and every layer built on it (`CreditManager`, `BillingEngine`, `WorkflowExecutor`) are declared **synchronous**; making them Supabase-backed requires converting that interface to async through all four layers — a structural interface change, i.e. architecture redesign, which this mission explicitly forbids ("Architecture: FROZEN"). A fire-and-forget write-through was considered and rejected: it would look fixed while still checking balances against the fake seed and risking a new class of race/double-deduction bugs in a live billing path — worse than an honest, documented gap. This is reported as a known, structural limitation requiring a dedicated, deliberately-scoped async migration, not attempted here.

## 4. Files Modified

- `app/(auth)/register/page.tsx` — Task 1
- `services/infrastructure/ProductionContextRepository.ts` — Task 2
- `services/ai/orchestration/MovieProductionService.ts` — Task 2
- `app/(dashboard)/asset-manager/adapter.ts` — Task 2
- `components/payment/PayPalButton.tsx` — Task 4
- `services/billing/CreditTransaction.ts` — Task 5
- `app/api/affiliate/payout/route.ts` — Task 6
- `app/affiliate/payouts/page.tsx` — Task 6
- `app/api/affiliate/request-payout/route.ts` — Task 6
- `app/admin/page.tsx` — Task 7
- `app/admin/affiliate-payouts/page.tsx` — Task 7

No changes to Rendering Provider Management (Task 3) or the deeper Credits ledger persistence — both verified and documented rather than modified, per scope above.

## 5. Bugs Fixed

1. **Email verification silent no-op** (`62595c9`) — register page set a `success` state after a confirmation-required signup but never rendered it; users got zero feedback. Added the missing "check your email" UI branch.
2. **Asset Manager discarded a real character name** (`8a9b926`) — `characterName` was hardcoded `null` even though the name was available in scope at generation time. Threaded it through `MovieProductionService` → artifact metadata → `adapter.ts`.
3. **PayPal checkout led users into a flow that always failed** (`5d74894`) — backend was already disabled (Sprint 16 security fix); the UI still rendered the live SDK widget. Replaced with a static "temporarily unavailable" notice.
4. **Production credit-seeding exploit** (`d2a7ec0`) — `InMemoryCreditLedger` granted any unseen user 500 free credits in every environment including production. Gated to non-production only.
5. **Affiliate payout-history wrong-column bug** (`ac96573`) — `GET /api/affiliate/payout` filtered on `affiliate_id = user.id` instead of resolving `affiliates.id` first, like every sibling route does. Affiliates' own payout history always rendered empty. Fixed; also removed leftover debug `console.log`s found in the same flow.
6. **Admin Dashboard showed no metrics** (`9c500c4`) — wired the existing, already admin-gated `/api/admin/stats` endpoint into the page as stat cards, matching the existing admin-page visual pattern. Also removed leftover debug logging on the admin affiliate-payouts page.

## 6. Remaining Known Issues

- **Movie Studio's credit reservation/consumption is not Supabase-backed** — see Credits Ledger section above. This is the one item in this report that is a real, unresolved production concern, not a cosmetic gap. Recommend scoping a dedicated task to convert `CreditLedger`/`CreditManager`/`BillingEngine`/`WorkflowExecutor` to an async, Supabase-backed implementation.
- Google OAuth login and Supabase's email-confirmation toggle are project-dashboard settings, not code — still unverifiable from this repo; confirm directly in the Supabase project before shipping.
- Local GPU render backend is a synthetic test-pattern placeholder, not real video generation (unchanged, pre-existing, documented).
- No automatic health/cost-aware provider routing or fallback-on-failure for rendering (unchanged, pre-existing, documented as future-sprint work in the code itself).
- `lib/credits.ts`'s 9 direct-generation routes still have no per-action deduction audit trail (only purchases are logged, in `payments`). Unchanged from RC-1; no persisted transactions table exists to log against without a schema change, which was out of scope here.

## 7. Production Recommendation

**Ship-blocking:** the Movie Studio credit-deduction gap (Remaining Known Issues, item 1) should be explicitly decided on before this goes to production — right now the flagship paid feature does not reduce a user's real credit balance. Everything else in this report is either fixed, verified-and-documented as an intentional limitation, or a pre-existing, non-blocking gap. If the credit-deduction gap is accepted as a known, tracked limitation for this release (rather than a blocker), RC-2 is otherwise ready to ship — build and typecheck are clean, and every other PARTIAL/BLOCKED item from RC-1 is now either resolved or confirmed as intentional, non-broken scope.
