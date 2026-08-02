# ReelForge Enterprise — User Flow

## Entry

1. Marketing pages (`app/(marketing)/**`, `app/about`, `app/pricing`, …) — unauthenticated.
2. `/register` or `/login` (`app/(auth)/**`) → Supabase Auth.
3. First login → `/onboarding`, then `/dashboard`.

All authenticated routes under `app/(dashboard)/**` render inside `DashboardShell`
(`app/(dashboard)/_components/dashboard-shell.tsx`): a persistent sidebar (desktop) /
slide-over + bottom nav (mobile), a credits indicator, and logout.

## Sidebar navigation (CREATE section)

| Nav item | Route | Purpose |
|---|---|---|
| Dashboard | `/dashboard` | Overview/landing |
| Create Reel | `/create-reel` | Short-form reel generation |
| Movie Studio | `/movie-studio/render-center` | Entry point into the full movie workspace suite (see below) |
| Cartoon Studio | `/cartoon-studio` | Multi-scene animated story generation |
| Series Studio | `/series-studio` | Create a new series |
| Characters | `/characters` | Supabase-backed character presets (separate from Character Studio inside Movie Studio — see Architecture doc) |
| Avatar Studio | `/avatar-studio` | HeyGen avatar video generation |
| Media Library | `/media-library` | Uploaded/generated media browser |
| My Series | `/my-series` | Manage existing series + episodes |
| Cinema Studio | `/cinema-studio` | Single-clip cinematic generation |
| Marketing Studio | `/marketing-studio` | Marketing copy/asset generation |
| Canvas | `/canvas` | Storyboard boards assembled from existing clips |
| Asset Manager | `/asset-manager` | Cross-project asset browser |

TOOLS: Publisher, Thumbnail, Captions, Script. ACCOUNT: Projects, Billing, Settings.

## Movie Studio suite (`app/movie-studio/**`)

Reached via the sidebar's "Movie Studio" link, landing on **Render Center**
(`/movie-studio/render-center`) — the operational hub: production overview, quality
panel, jobs grouped by status, provider health, performance analytics. From there:

- Click into a job → job detail panel → **Open in Storyboard / Timeline / Workspace**
  → `/movie-studio/workspace/[movieId]` (the full editor: storyboard grid, timeline,
  asset panels, render queue).
- **Character Studio** (`/movie-studio/characters`) and **Scene Studio**
  (`/movie-studio/scenes`) are cross-movie browsers scoped to movies this server
  session has touched (see Architecture doc's "known constraint"). Each list item
  links into a detail page, which links back into the relevant movie's Workspace.
- Every hub page here has a "Back to Dashboard" link (added this pass) since this
  whole tree renders without the sidebar.

The legacy **`/movie-studio`** (no further path — the `(dashboard)`-grouped page) is
a separate, simpler idea → poll flow. It still works but is no longer linked from
navigation; only reachable by direct URL.

## Billing / credits

- Every generation action consumes credits (shown live in the sidebar footer).
- `UpgradeModal` (triggered when credits run low, or manually from `/billing`) offers
  Razorpay (INR) or Stripe (USD) checkout, reading plan data from `lib/plans.ts`.
- PayPal is also wired (`app/api/payment/paypal/**`) but currently reads a
  **different, drifted** pricing table — see `docs/ARCHITECTURE.md`'s payments note.

## Affiliate portal (`app/affiliate/**`)

Separate layout/sub-nav from the main dashboard: dashboard, links, commissions, sales,
payouts, analytics, marketing materials, payment settings. Not linked from the main
sidebar (separate portal by design).

## Admin (`app/admin/**`)

Separate layout (`AdminSidebar`): affiliate payouts, leaderboard, analytics. Not
linked from the main dashboard nav and has no visible role-gating in the UI layer —
treat as an internal-only surface reached by direct URL, not a polished end-user path.

## Error/empty/loading states

- Standardized empty-state copy: "No render jobs yet" / "Not enough render history
  yet" / "No storyboard available" / "No scenes available" / "No characters
  available" (Render Center, Performance Analytics, Storyboard, Scene Studio,
  Character Studio respectively).
- Any unhandled error anywhere in the app now falls back to a branded "Something went
  wrong" screen with Try Again / Back to Dashboard, instead of Next's default error
  page (see `app/error.tsx`).
