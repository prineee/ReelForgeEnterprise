# Deployment Runbook — ReelForge Enterprise

**Branch:** `feature/ltx-video-provider` (HEAD `9c500c4`) — the only branch validated by
RC-1, RC-2, and the Release Validation pass. `main` is 87 commits behind and untested;
merge before deploying if `main` is your actual target.

---

## Part A — Deployment Inventory

Every service the production system depends on, what it's for, how to configure it,
what secrets it needs, how to verify it's working, and what a failure looks like.

### Frontend (Next.js on Vercel)

- **Purpose:** Serves the full user-facing app and every `app/api/**` route (auth
  pages, dashboard, Movie Studio, billing, affiliate, admin).
- **Required configuration:** `vercel.json` already correct (`next build`, `.next`
  output, `npm install`). Connect the repo, select the validated branch, set env vars,
  attach the production domain.
- **Required secrets:** see `PRODUCTION_CONFIGURATION.md` → Vercel section (Supabase
  keys, Cloudinary keys, AI provider keys, payment keys, worker URL).
- **Verification:** deployment shows "Ready" in Vercel; home page and `/login` load
  over HTTPS on the production domain; `git status`-clean build with `npm run build`
  and `npx tsc --noEmit` both passing on the deployed commit.
- **Failure symptoms:** deploy fails at build (check Vercel build logs for a missing
  env var — several fail fast, e.g. Stripe/Gemini/LTX); deploy succeeds but pages 500
  (usually a missing/wrong `SUPABASE_SERVICE_ROLE_KEY`, which has no startup guard and
  fails deep in a request instead); blank/broken checkout (Cloudinary or payment keys
  wrong — these also default silently to `""` rather than failing fast).

### Backend (Next.js API routes, same Vercel deployment)

- **Purpose:** All server-side logic — credits, movie generation orchestration,
  payment webhooks, affiliate, admin.
- **Required configuration:** no separate deployment step from Frontend above — same
  service. The only backend-specific configuration action is confirming `AI_MODE` is
  **absent** from the Vercel production env (if set to `development`, every AI call is
  mocked).
- **Required secrets:** same pool as Frontend; backend-only ones are
  `SUPABASE_SERVICE_ROLE_KEY`, `BILLING_DEV_SEED_CREDITS` (optional), `PIPER_TTS_URL`
  (optional).
- **Verification:** submit one real "Create Reel" generation and confirm credits
  decrement in `users.credits` — this exercises the backend's real credit-deduction
  path end-to-end.
- **Failure symptoms:** generation submits but credits don't move (check `AI_MODE`
  first — this is the classic symptom of it being accidentally set); admin routes
  return 500 instead of 403 for non-admins (check `SUPABASE_SERVICE_ROLE_KEY`).

### Railway Worker

- **Purpose:** Separate Node/Express service handling reel/cartoon video generation,
  TTS, lip-sync, and stock-media acquisition — offloaded from Vercel's request/time
  limits.
- **Required configuration:** deploy `worker/` (Dockerfile + `railway.toml` already
  present, `node src/index.js`, port 3001). Set worker env vars independently of
  Vercel — several share a *value* with the frontend but use a **different variable
  name** (see PRODUCTION_CONFIGURATION.md → Railway).
- **Required secrets:** worker-side Supabase keys, worker-side Cloudinary keys,
  stock-media keys, TTS/lip-sync engine keys (see PRODUCTION_CONFIGURATION.md →
  Railway).
- **Verification:** `GET https://<worker-domain>/health` → `status: ok`; check
  `wav2lip_ready: true` and `stock_video` is not `none` in the response body.
- **Failure symptoms:** `/health` unreachable (service crashed or didn't start —
  check Railway logs for a missing required var); `wav2lip_ready: false` (missing
  `WAV2LIP_PATH` or the model checkpoint isn't present in the container); `stock_video:
  none` (neither `PIXABAY_API_KEY` nor `PEXELS_API_KEY` set); `[queue] Worker init
  failed` in logs (Redis unreachable — non-fatal, only scene-queue features degrade).

### Supabase

- **Purpose:** Auth (registration, login, password reset, OAuth), and the sole
  production database (Postgres) — `users`, `payments`, affiliate tables, etc.
- **Required configuration:** production project created; schema present (no
  migrations exist in-repo — schema must be manually confirmed/reproduced); RLS
  policies present on every authenticated-user table; `users.is_admin` set correctly
  for intended admins only (no UI sets this — direct table edit); Auth redirect URLs
  and (if used) Google OAuth provider configured for the production domain; email
  templates/SMTP configured.
- **Required secrets:** `Project URL`, `anon public` key, `service_role` key — consumed
  under different variable names by Vercel vs. Railway (see
  PRODUCTION_CONFIGURATION.md → Supabase).
- **Verification:** register a real account end-to-end, confirm the row appears in
  `users`; confirm a non-admin account's request to an `/api/admin/**` route is
  rejected (RLS + `requireAdmin()` both need to be correct for this).
- **Failure symptoms:** signup succeeds but no confirmation email (SMTP/email template
  misconfigured); login works but every data page is empty (RLS policy missing/too
  strict); any user can read/write another user's data (RLS policy missing/too
  permissive — the most severe possible failure here, verify before launch, not after).

### MongoDB

- **Purpose:** **None — not part of this stack.** Verified by direct repository audit:
  `mongodb` appears exactly once, as an unused optional peer dependency of an unrelated
  transitive package in `package-lock.json`. No driver import, connection string, or
  `process.env.MONGO*` reference exists anywhere in `app/`, `lib/`, `services/`, or
  `worker/src/`.
- **Required configuration:** none.
- **Required secrets:** none.
- **Verification:** none applicable.
- **Failure symptoms:** none applicable — if anyone asks "is Mongo down," the answer is
  "Mongo isn't part of this system."

### Cloudinary

- **Purpose:** Sole production media store — all generated images/video/audio and user
  uploads land here. No production code path writes real media to local disk.
- **Required configuration:** account/cloud confirmed as the intended production
  cloud (not a dev/test one); credentials set on **both** Vercel and Railway
  independently — each service uploads directly, there's no proxying between them.
- **Required secrets:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET` (same three values, set twice — once per deploy target).
- **Verification:** complete one generation on each of the frontend's direct-upload
  paths (e.g. thumbnail generation) and the worker's paths (e.g. a reel generation),
  confirm the resulting asset is reachable at a `res.cloudinary.com` URL (already
  whitelisted in `next.config.js`'s image remote patterns).
- **Failure symptoms:** upload calls fail with an SDK-level error (these credentials
  default to `""` with no startup guard — a missing credential fails deep in the
  request, not at boot); images render broken/404 if the wrong cloud name is set.

### AI Providers

- **Purpose:** Gemini (script/story generation, and the Google Veo render provider),
  Groq (script/caption/thumbnail/marketing/series/cartoon-dialogue generation), and LTX
  (the primary cloud video-render provider).
- **Required configuration:** `VIDEO_PROVIDER` selects the active render backend
  (`ltx` / `google` / `local`) — **confirm it is not `local`** in production; that
  backend is an explicit synthetic-test-pattern placeholder, not real video.
- **Required secrets:** `GEMINI_API_KEY`, `GROQ_API_KEY`, and (if `VIDEO_PROVIDER=ltx`)
  `LTX_API_KEY` / `LTX_API_BASE_URL` / `LTX_MODEL`.
- **Verification:** submit one real generation through each of Groq-backed script
  generation and the configured video provider; confirm real output, not an error or a
  visibly synthetic test pattern.
- **Failure symptoms:** LTX fails fast and clearly if misconfigured — check Vercel
  logs for an explicit provider error. Google Veo does **not** fail fast — a bad
  `GEMINI_API_KEY` surfaces as an opaque SDK error mid-generation; if render jobs fail
  with unclear errors, verify the key directly before assuming a provider outage.

### Payments

- **Purpose:** Credit purchases. Stripe and Razorpay are both fully functional; PayPal
  is intentionally disabled.
- **Required configuration:** live-mode Stripe and Razorpay accounts; webhook
  endpoints registered against the final production domain (not a placeholder domain).
- **Required secrets:** see PRODUCTION_CONFIGURATION.md → Stripe / Razorpay / PayPal.
- **Verification:** one real (or provider test-mode) transaction through each of
  Stripe and Razorpay, confirm `users.credits` increments and the webhook shows a 200
  in the provider's own delivery log.
- **Failure symptoms:** checkout completes on the provider's side but credits don't
  grant (webhook signature/secret mismatch, or the webhook URL is still pointed at a
  staging domain); PayPal button shows "Payment failed" — this is **expected**, not an
  incident, the backend returns 503 by design.

### Authentication

- **Purpose:** Supabase Auth — email/password, password reset, and optionally Google
  OAuth. `supabase.auth.getUser()` is the single source of identity for every
  `app/api/**` route; there is no separate API-key auth surface.
- **Required configuration:** email/password wired already in code; Google OAuth
  needs a Google Cloud OAuth Client (see PRODUCTION_CONFIGURATION.md → Google) pasted
  into Supabase's provider config; redirect URLs must include the production domain.
- **Required secrets:** none in application code beyond the Supabase keys already
  listed — OAuth client secret lives in the Supabase dashboard, not an app env var.
- **Verification:** register, log in, log out, reset password, and (if enabled) Google
  login — all four/five flows completed once against the production domain.
- **Failure symptoms:** register succeeds but "check your email" state never resolves
  (email-confirmation toggle or SMTP misconfigured in Supabase); Google login redirects
  to an error (redirect URI mismatch between Google Cloud console and Supabase config).

### Email

- **Purpose:** Transactional email only — signup confirmation and password reset.
  There is **no application-level email service** in this codebase (no SMTP/email
  provider SDK, no `EMAIL_*` env vars). This is entirely Supabase Auth's own email
  sending.
- **Required configuration:** Supabase dashboard → Auth → Email Templates / SMTP
  Settings — either Supabase's default sender or a custom SMTP provider, plus the
  redirect URL pointing at the production domain.
- **Required secrets:** none in this repo — any SMTP credentials live entirely inside
  the Supabase dashboard configuration, not in Vercel/Railway env vars.
- **Verification:** register a real test account, confirm the email arrives and its
  link lands on the production domain.
- **Failure symptoms:** no email arrives (SMTP misconfigured or default sender's
  deliverability/rate limits hit); email arrives but link points at `localhost` or a
  Vercel preview URL (redirect URL not updated for production).

### Storage

- **Purpose:** Cloudinary is the entire production storage layer (see Cloudinary
  above) for media. Supabase Postgres is the storage layer for structured data (see
  Supabase above). There is no third storage system.
- **Required configuration:** covered under Cloudinary and Supabase above — this
  entry exists to state explicitly that no additional storage service (S3, GCS, etc.)
  is part of this stack.
- **Required secrets:** none beyond Cloudinary/Supabase.
- **Verification:** covered above.
- **Failure symptoms:** covered above.

---

## Part B — Exact Deployment Order

```
1. Supabase          — schema/RLS/auth ready; produces the keys every other step needs
2. MongoDB           — N/A, skip (not part of this stack)
3. Cloudinary         — account/credentials ready, no dependency on anything else
4. Railway Worker     — needs Supabase + Cloudinary; deploys before Vercel since Vercel
                        needs the worker's live URL
5. Vercel             — needs Supabase + Cloudinary + AI keys + the worker URL from #4
6. DNS                — attach custom domains only once both services verify healthy
                        on their default platform domains
7. Payments           — Stripe/Razorpay webhooks registered against the final domain
                        from #6 — do this after DNS, not before
8. Email              — Supabase Auth redirect URLs confirmed against the final domain
9. Final Validation    — full Go-Live smoke test against the live production domain
```

## Part C — Rollback Order

If something breaks post-launch, roll back in this order — fastest and lowest-risk
first, escalating only if the issue persists:

```
1. Vercel   — Instant Rollback to the last known-good deployment (near-instant, no
              rebuild). Resolves most user-facing symptoms.
2. Railway  — redeploy the previous successful worker build if worker-specific
              symptoms (TTS, lip-sync, cartoon generation) persist after #1.
3. Payments — if only webhook delivery is broken, fix the endpoint/secret directly
              in the Stripe/Razorpay dashboard and use their manual redelivery — no
              app rollback needed for this case specifically.
4. DNS      — only if the problem is specifically domain routing; slowest rollback
              (propagation delay), so exhaust #1–#3 first.
5. Supabase — only for a bad manual schema/RLS change; reverse it directly in the
              dashboard (no migration-based rollback exists). Highest-risk step — never
              roll back the database independently of confirming which app version is
              live, since there's no migration system keeping the two in sync.
```

Full per-component detail (including a rollback-vs-fix-forward decision rule) is in
`ROLLBACK_PLAN.md`.

## Part D — Verification Checklist (run after every deploy, not just launch day)

- [ ] `npm run build` and `npx tsc --noEmit` clean on the exact deployed commit.
- [ ] Vercel deployment shows "Ready."
- [ ] Railway worker `/health` returns `status: ok`.
- [ ] Register → login → logout completes on the production domain.
- [ ] One real generation (Create Reel) completes and credits decrement.
- [ ] One real payment (Stripe or Razorpay) completes and credits increment, webhook
      shows 200 in the provider dashboard.
- [ ] Non-admin account gets 403 from `/api/admin/**`.
- [ ] No `AI_MODE=development` in the Vercel production env.
- [ ] No `VIDEO_PROVIDER=local` in the Vercel production env.

The full, exhaustive version of this (every workflow, not just the fast smoke set
above) is `GO_LIVE_CHECKLIST.md` — run that in full only for the actual launch, use the
short list above for routine post-deploy checks.

## Part E — Health Checks

| Service | Check | Expected result |
|---|---|---|
| Vercel frontend | Load `https://<production-domain>/login` | 200, page renders |
| Railway worker | `GET https://<worker-domain>/health` | `{"status":"ok", "wav2lip_ready": true, "stock_video": "pixabay" or "pexels", ...}` |
| Railway worker queue (if `REDIS_URL` set) | `GET https://<worker-domain>/api/queue/status` | 200, queue stats returned |
| Supabase | Register a test account | Row appears in `users`, confirmation email sent |
| Stripe | Complete a checkout | Webhook delivery shows 200 in Stripe dashboard |
| Razorpay | Complete a checkout | Webhook delivery shows 200 in Razorpay dashboard |
| Cloudinary | Complete one generation | Resulting asset URL resolves under `res.cloudinary.com` |

**No `/api/health` route exists on the Next.js app itself** and no APM/uptime monitor
is configured anywhere in this codebase — "load `/login` and confirm 200" above is the
closest available proxy today. This is a genuine gap, tracked in
`KNOWN_LIMITATIONS.md`, not something this deployment-configuration pass builds (adding
a route is a code change, out of scope for this mission).
