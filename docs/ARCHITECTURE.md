# ReelForge Enterprise — Architecture

High-level map of the system as of the public-beta readiness pass. For deep dives on
specific rendering/AI subsystems, see `docs/architecture/*.md` (AI Director Engine,
Asset Intelligence Layer, Render Orchestrator, Render Job Manager, Render Intelligence,
Local GPU Provider) — this document is the map that ties those together, not a
replacement for them.

## Tech stack

- **Frontend/backend**: Next.js 16 (App Router, Turbopack), React 18, TypeScript, Tailwind CSS
- **Auth/DB/Storage**: Supabase (Postgres + Auth + Storage), accessed via `@supabase/ssr`
- **Payments**: Stripe, Razorpay, PayPal
- **AI providers**: Gemini (`@google/genai`), Groq, plus an LTX video provider (`LTX_API_*` env vars)
- **Media**: Cloudinary (uploads/transforms), Pexels/Pixabay (stock media), a self-hosted Piper TTS service
- **Rendering worker**: a separate Node service under `worker/` (own `package.json`, `Dockerfile`, `railway.toml`), deployed independently of the Next.js app

## Deployment topology

Two independently deployed services:

1. **Next.js app** (this repo's root) → Vercel (`vercel.json`: `next build`, output `.next`)
2. **Render worker** (`worker/`) → Railway (`worker/railway.toml`, `worker/Dockerfile`)

The Next.js app talks to the worker over HTTP via `NEXT_PUBLIC_WORKER_URL` (falls back to
the Railway production URL if unset — see `app/api/movie/generate-scenes/route.ts`).

## Directory structure

```
app/
  (auth)/          login, register, password reset — no dashboard chrome
  (dashboard)/     everything wrapped in DashboardShell (sidebar + mobile nav)
  (marketing)/     public marketing pages
  movie-studio/    the advanced movie workspace suite — deliberately OUTSIDE
                   the (dashboard) group, full-bleed, no sidebar (see below)
  admin/           internal admin pages, own AdminSidebar, not linked from
                   the main dashboard nav (role-gating not yet implemented)
  affiliate/       affiliate portal, own layout/sub-nav
  api/             route handlers, one folder per feature area
components/        shared React components, feature-grouped subfolders
services/          business logic — AI pipelines, rendering, payments, etc.
  ai/              director engine, asset intelligence, production pipeline,
                   providers (Gemini, LTX, …)
  infrastructure/  composition roots ("Factory" files) that wire the above
                   into what pages/routes actually call
  rendering/       the real render queue/orchestrator (RenderJobManager)
lib/               cross-cutting utilities (Supabase clients, plans/pricing,
                   env access)
hooks/             shared React hooks
worker/            separate render-worker service (own deploy)
docs/architecture/ deep-dive docs per subsystem
```

## The two "Movie Studio" experiences

There are two separate front-ends over movie generation, and this is intentional
history rather than a bug going forward — worth understanding before touching either:

- **`app/(dashboard)/movie-studio`** — the original idea → poll flow. A single form
  posts to `/api/movie/create`, then polls `/api/movie/status/[id]`. Simple, still
  functional, no longer linked from the sidebar (see below).
- **`app/movie-studio/**`** (workspace, characters, scenes, render-center) — the
  actively developed workspace editor: storyboard, timeline, character/scene browsers,
  and a full render command center (Production Overview, Quality Panel, Failure
  Analysis, Performance Analytics — see recent "Module N" commits). This is what the
  sidebar's "Movie Studio" link now points to (`/movie-studio/render-center`), fixed
  during this beta-readiness pass — previously the sidebar pointed at the legacy page
  and this entire tree had no navigation entry at all.

This tree deliberately renders **outside** `app/(dashboard)`'s `DashboardShell` — the
workspace editor needs the full viewport (see the comment in
`components/movie-workspace/WorkspaceShell.tsx`), and the dashboard shell's centered
`max-w-5xl` column would break that layout. Each hub/list page in this tree
(`render-center`, `characters`, `scenes`) instead gets its own minimal
`BackToDashboardLink` (`components/movie-studio/BackToDashboardLink.tsx`).

**Resolved (Sprint 16, Task 3)**: `ProductionContextRepository.list()` plus
`MovieCatalogService` (`services/infrastructure/MovieCatalogService.ts`) now give
Character Studio, Scene Studio, Render Center, and Movie Workspace one canonical,
userId-scoped movie enumeration, replacing the old "every movie this server process
happened to see" session-scoping. Still in-memory / resets on process restart — that
constraint is unchanged, just no longer combined with incomplete enumeration.

## Request flow (typical AI generation)

1. User action in a dashboard page (client component) → `fetch()` to an `app/api/**`
   route handler.
2. Route handler authenticates via Supabase, then either calls a service directly
   (`services/ai/**`, `services/infrastructure/**`) or forwards to the render worker.
3. Long-running work (video generation) is tracked as a render job
   (`services/rendering/jobs/RenderJobManager.ts`) and surfaced in Render Center.
4. Every API route now wraps its handler body in try/catch (added this pass — see
   `docs/BETA_CHECKLIST.md`) so unexpected failures return JSON, not an unstyled
   default error page.

## Error/loading boundaries

Until this pass, **no** `error.tsx` or `loading.tsx` existed anywhere in the app.
`app/error.tsx`, `app/loading.tsx`, and `app/global-error.tsx` now provide a branded
fallback for any route that doesn't define a closer one of its own (currently all of
them) — see `docs/BETA_CHECKLIST.md` for the tradeoff (a root-level boundary loses the
dashboard sidebar chrome when it fires inside `(dashboard)`; per-section boundaries
that preserve chrome are noted as future work).

## Payments / pricing

**Resolved (Sprint 16, Task 2)**: `lib/plans.ts` is now the single pricing source read
by every payment path (Stripe, Razorpay, PayPal, `UpgradeModal`, homepage). The second,
drifted `lib/payment/plans.ts` table is gone.

**Known limitation (Sprint 16, Task 5)**: PayPal has no real server-side Orders API
integration — `create-order`/`capture-order` used to grant credits immediately with no
verification against PayPal that a payment had actually happened. That credit-granting
path is now disabled (both routes return 503) until a real PayPal Orders API
create+capture flow is built. See `## Security` below.

## Security

See the "Security" section in `docs/BETA_CHECKLIST.md` for the full Sprint 16 Task 5
audit summary (assumptions, fixes, remaining risks). In short: every `app/api/**`
route authenticates via `supabase.auth.getUser()`; resource access additionally checks
ownership (a `user_id`/`userId` field compared against the requesting user, in Postgres
tables or in-memory `ProductionContext`); admin routes check `users.is_admin` via
`lib/admin.ts`'s `requireAdmin()`. RLS policies on Supabase tables were **not** audited
as part of this pass — only application-level checks were.
