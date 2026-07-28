# ReelForge Enterprise — Public Beta Checklist

Status snapshot from the public-beta readiness pass (QA/UX/performance/accessibility/
docs audit — no new features, no provider/pipeline changes, per that sprint's rules).

## Done this pass

**Navigation**
- Sidebar's "Movie Studio" link repointed from the legacy idea→poll page to the real
  advanced workspace suite (`/movie-studio/render-center`), which previously had zero
  navigation entry point.
- Fixed the workspace's own dead back-link (`/movie-studio/dashboard`, which never
  existed) and added a consistent "Back to Dashboard" affordance to the three
  movie-studio hub pages, none of which had any way back to the main app.
- Removed a dead `/admin/users` link (no page exists for it) from both admin nav
  surfaces.
- Added missing sidebar entries for Settings and Asset Manager (pages existed, no nav
  link).
- Deleted a second, unused, non-responsive Sidebar component (zero importers).

**Error handling**
- Added `app/error.tsx`, `app/loading.tsx`, `app/global-error.tsx` — previously **zero**
  error or loading boundaries existed anywhere in the app, so any unhandled error fell
  through to Next's default unstyled page.
- Hardened 20 API routes with try/catch around previously-unguarded handler bodies, so
  unexpected failures return a JSON error instead of an HTML 500 the client can't parse.
- Standardized empty-state copy across Render Center, Storyboard, Scene Studio,
  Character Studio.
- Removed `app/api/debug-env` — an **unauthenticated route leaking partial API-key
  prefixes** (Groq, Cloudinary, Pixabay, Pexels) to anyone who requested it. This was
  found incidentally while auditing error handling; treat it as the most important
  single fix in this pass.
- Removed `app/api/movie/director`, a 0-byte dead route file.

**Accessibility**
- All hand-rolled modals (no dialog primitive exists in this codebase) now have
  `role="dialog"`, `aria-modal`, an accessible label, and Escape-to-close (new shared
  `hooks/useEscapeKey.ts`).
- Icon-only buttons across modals/nav gained `aria-label`s.
- `components/ui/card.tsx`'s clickable variant is now keyboard-operable
  (`role="button"`, `tabIndex`, Enter/Space).
- Low-contrast text (`text-gray-600` / `text-white/40` on dark surfaces, under WCAG's
  4.5:1) bumped to readable levels across ~16 files.
- Weak `focus:border-color`-only indicators replaced with `focus-visible:ring-2` on
  dashboard filter/search inputs.
- Auth and settings forms: every `<label>` is now paired to its `<input>` via
  `htmlFor`/`id`; error banners get `role="alert"`.

**Performance**
- `buildDirectorPlan()` was being rebuilt from scratch redundantly — up to 3-4x per
  character-detail page render, once per character in a list loop, and twice per call
  in `resolveSceneContext()`. Now cached per `ProductionContext` (auto-invalidates
  when the repository saves a new context object).
- Per-movie cast plan in `listCharacterSummaries()` is now computed once per movie
  instead of once per character.
- `StoryboardGrid`'s five lookup Maps and `TimelineViewer`'s Music-track lookup are
  now `useMemo`'d instead of rebuilt every render.
- `TimelineBlock` wrapped in `React.memo`.
- Fixed an N+1 Supabase query in the affiliate leaderboard (one query per affiliate →
  one batched query).
- `EarningsChart` (pulls in `recharts`) is now `next/dynamic` instead of a static
  import.

**UX / responsive**
- Render Center's status grid no longer jumps from 2 to 5 columns across tablet widths
  (added an `lg:grid-cols-3` step).
- Movie Workspace's bottom Render Queue panel is no longer a fixed height regardless
  of viewport (`h-48 lg:h-72`).
- Movie Production and Movie Library no longer show a hardcoded demo catalog as their
  default view — both now show real data (or a proper empty state) only. Removed the
  now-orphaned `DashboardSkeleton` component and the fake-catalog builder code in both
  pages' `mockData.ts` files (the real, reusable metrics-aggregation functions in
  those files were kept).
- Cartoon Studio's back-link standardized from a raw unicode arrow to the icon+Link
  pattern used everywhere else.

**Dead code removed** (all confirmed zero-importer before deletion, one restored after
a false positive caught by rebuilding — see git history for `services/movie/MovieAssembler.ts`)
- `services/ai/rendering/{FinalMovieRenderer,RenderQueue,FinalMovieContracts}.ts`
- `services/providers/google/SimpleGemini.ts`
- Two stray zero-byte artifact files (`services/services`, `providers/providers`)

**Documentation** — this pass added `docs/ARCHITECTURE.md`, `docs/USER_FLOW.md`,
`docs/DEPLOYMENT.md`, this file.

## Known limitations / not fixed this pass

These were found but are out of scope for a QA/polish pass (product decisions,
backend/data-model changes, or large refactors) — flagging for a deliberate follow-up:

- ~~`lib/payment/plans.ts` vs `lib/plans.ts` pricing drift~~ — **fixed, Sprint 16 Task 2.**
  `lib/plans.ts` is now the single pricing source every payment path reads.
- ~~No enumeration of movies/productions anywhere in the data model~~ — **fixed,
  Sprint 16 Task 3.** `MovieCatalogService` now gives Character Studio, Scene Studio,
  Render Center, and Movie Workspace one canonical, userId-scoped enumeration.
- **Two competing "Movie Studio" experiences remain** — the legacy page is still live
  (unlinked, reachable by URL). Consolidating or removing it is a product call, not
  made here.
- **`movie-production` vs `movie-studio` and `cinema-studio` vs `cartoon-studio`**
  appear to be overlapping/forked features (see `docs/ARCHITECTURE.md` and the
  architecture-review findings) — flagged, not consolidated.
- **No shared API client** — `fetch('/api/...')` calls are scattered across page
  components with locally-redefined response types rather than a shared client/provider
  layer. Works, but a source of future drift.
- **Root-level error/loading boundaries lose dashboard chrome** — `app/error.tsx`
  firing inside `(dashboard)` unmounts the sidebar (Next.js boundary semantics: the
  nearest error.tsx wins, and `(dashboard)` doesn't define its own). Acceptable
  tradeoff for now; per-section boundaries that preserve chrome are future work.
- **No RLS policy audit** — this pass reviewed application code calling Supabase, not
  the database-side Row Level Security policies themselves.
- **No `.env.example`** checked in — `docs/DEPLOYMENT.md`'s env var list was compiled
  by grepping `process.env.*` usage; keeping a real example file in sync would prevent
  future drift.
- **Admin section has no visible role-gating in the UI** — `app/api/admin/**` routes
  now enforce `is_admin` server-side (Sprint 16, Task 5), but the admin *pages*
  themselves (`app/admin/**`) render their shell before their data fetches fail, so a
  non-admin visiting the URL briefly sees layout/chrome before every panel errors out.
  A page-level redirect/guard (mirroring the `if (!user) redirect("/login")` pattern
  already used throughout `app/movie-studio/**`) is a follow-up, not done this pass.

## Security (Sprint 16, Task 5)

An enterprise security audit pass — no new features, no architecture redesign, focused
on identifying and fixing genuine security risks across API routes, env vars,
authorization, debug code, input validation, and error responses.

### Security assumptions

- **Identity**: `supabase.auth.getUser()` is the single source of truth for who's
  making a request, in every `app/api/**` route. There is no separate API-key/service-
  token auth surface for first-party routes.
- **Ownership**: resource access is scoped by an explicit ownership field compared
  against the requesting user — `user_id`/`userId` columns in Postgres tables, or
  `ProductionContext.userId` for the in-memory movie/render data (checked directly, or
  via `MovieCatalogService.listOwnedMovieIds()`).
- **Admin**: `users.is_admin` is the one admin gate, enforced by `lib/admin.ts`'s
  `requireAdmin()`, applied to every `app/api/admin/**` route as of this pass.
- **Payments**: Stripe and Razorpay compute/verify amounts server-side (webhook
  signature verification against a secret, or an order re-fetched from the provider's
  own API) — a client can never set its own price. PayPal has no working server-side
  verification and its credit-granting is disabled until it does.
- **Secrets**: all API keys/service-role keys are read from `process.env`, never
  hardcoded in source; `NEXT_PUBLIC_*` is reserved for values safe to ship to the
  client (verified during this audit — no server secret was found mis-prefixed).
- **RLS is assumed, not verified**: Supabase Row Level Security policies are assumed to
  exist as defense-in-depth behind the application-level ownership checks above, but
  this pass audited application code only, not the database-side policies themselves
  (same caveat `docs/DEPLOYMENT.md` already carried).

### Fixed this pass

- Removed `services/infrastructure/MovieProductionFactory.ts`'s leftover
  `__debugRepositoryState()` diagnostic instrumentation, which leaked every in-memory
  productionId to any caller of `movie/create`, `movie/status/[productionId]`, or
  `workflow/status/[workflowId]` via a `_trace` field in the response.
- Fixed `app/api/auth/callback/route.ts` logging the full request cookie jar
  (including Supabase's own session cookies) on every login; also fixed a
  `.maybesingle()` typo that silently broke OAuth referral attribution.
- Added missing authentication to `GET /api/movie/status`, `GET /api/movie/status/[productionId]`,
  and `GET /api/workflow/status/[workflowId]` — all three previously had **no auth
  check at all**.
- Added missing ownership checks to `movie-studio/[movieId]/render`, `render-jobs`,
  `render-center/jobs/[jobId]/{cancel,retry}`, `movie/generate-scenes`, and
  `series/[id]/episodes` — authenticated, but not verifying the specific resource
  belonged to the caller (any user could act on any other user's movie/job/series by id).
- Fixed a classic SSRF in `/api/proxy-image` (fetched any client-supplied URL
  server-side, no auth, no allowlist) — now requires auth and only allows the two real
  image hosts this app generates (`res.cloudinary.com`, `image.pollinations.ai`), with
  `redirect: 'error'` closing the redirect-to-disallowed-host bypass.
- Fixed two unauthenticated affiliate endpoints: `GET /api/affiliate/commissions`
  leaked every affiliate's commission data to anyone; `POST /api/affiliate/save-referral`
  trusted a client-supplied `userId`, letting anyone fabricate referral/commission
  records for an arbitrary user.
- Added real admin authorization (`lib/admin.ts`'s `requireAdmin()`) to all six
  `app/api/admin/**` routes. Two (`affiliate-payouts` GET, `affiliate-payouts/pay`
  POST) had **no auth at all** — publicly readable affiliate PII/financials, and
  anyone could mark any payout "paid." Two more (`admin/stats`,
  `admin/users/[id]/credits`) only checked session presence, not admin role — the
  latter meant any logged-in user could potentially grant themselves credits.
- Disabled PayPal's credit-granting exploit: `create-order`/`capture-order` credited
  accounts immediately with zero verification against PayPal's API that a payment had
  happened. Both routes now return 503 until real Orders API verification is built —
  see `docs/ARCHITECTURE.md`'s Payments section.
- Removed `app/api/test-tts`, an unauthenticated debug route with zero real callers,
  abusing an undocumented Google endpoint with spoofed headers.
- Deleted `exclude/engineering/AI-RULES.md` — dead code, but its content instructed
  any AI agent reading it to never inspect/analyze the repository, which is a risk to
  future audits regardless of original intent.

### Remaining security risks (not fixed this pass)

- **PayPal has no real payment integration** — checkout is disabled (see above) until
  a genuine server-side Orders API create+capture flow is built.
- **`heygen/status` has no ownership check on `video_id`** — the external lipsync
  worker owns that job entirely; there's no local table linking a video_id to a user.
  Closing this properly means adding persistence, out of scope for a hardening-only pass.
- **No RLS policy audit** — see "Security assumptions" above.
- **Raw Supabase `error.message` returned to the client in many routes** — low
  severity (internal DB error text, not secrets), but inconsistent; a blanket
  generic-error-message policy across all routes is a good follow-up, only partially
  applied to the files touched in this pass.
- **`.env.local` / `worker/.env` hold real live secrets in plaintext on disk** (not
  committed to git, but recommend rotation hygiene — see `docs/DEPLOYMENT.md`).
- **`account/delete` has no re-auth/confirmation step** before an irreversible action —
  a hijacked session can delete the account in one request.
- **`affiliate/track` has no rate limiting** — an attacker could spam a competitor's
  referral_code to inflate click counts and crater their conversion rate.
- **`affiliate/payment-settings` has no input validation** on payout destination
  fields (PayPal email, bank account, IFSC, etc.) — ownership is correctly scoped, so
  this isn't a redirect-payout-to-attacker vulnerability, just missing hygiene.
- **PayPal button UX**: with the backend disabled, `components/payment/PayPalButton.tsx`
  now surfaces a generic "Payment failed" alert — a UX follow-up, not a security issue.
- **Admin pages have no UI-level route guard** — see the "Known limitations" entry above.

## Verification run at the end of this pass

```
npx tsc --noEmit   → clean
npm run build      → clean (all routes compile)
```

No `flutter`-style test suite exists in this repo to run; there is no `npm test`
script defined in `package.json` at the time of this pass.
