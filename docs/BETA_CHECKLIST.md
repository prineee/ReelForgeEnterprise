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

- **`lib/payment/plans.ts` vs `lib/plans.ts` pricing drift** — PayPal reads a
  different, stale pricing table than Stripe/Razorpay/the UI. Needs a product
  decision on correct numbers before merging a fix, not a mechanical one.
- **No enumeration of movies/productions** anywhere in the data model — Character
  Studio, Scene Studio, and the Movie Production/Library pages can only show what
  this server process has seen since it started. A real "list all productions"
  backend capability is a data-model change, not a UI fix.
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
- **Admin section has no visible role-gating in the UI** — reachable by anyone who
  knows the URL and is authenticated; not audited for actual server-side authorization
  in this pass.

## Verification run at the end of this pass

```
npx tsc --noEmit   → clean
npm run build      → clean (all routes compile)
```

No `flutter`-style test suite exists in this repo to run; there is no `npm test`
script defined in `package.json` at the time of this pass.
