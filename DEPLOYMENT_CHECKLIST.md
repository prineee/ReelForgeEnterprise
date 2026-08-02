# Deployment Checklist — ReelForge Enterprise

**Branch under review:** `feature/ltx-video-provider` (HEAD `9c500c4`)
**Status inputs:** RC-1_REPORT.md, RC2_REPORT.md, RELEASE_VALIDATION_REPORT.md (all in repo root)

> ⚠️ **Branch note:** this branch is 87 commits ahead of `main` (566 files diverged) and is
> the one all three RC passes were run against. If `main` is what your deploy pipeline
> actually points at, either merge this branch to `main` first or explicitly repoint
> Vercel/Railway at `feature/ltx-video-provider`. Deploying the wrong branch is the
> single easiest way to ship something that wasn't validated.

---

## 0. Pre-flight (do this first, every time)

- [ ] `npm install` — clean install, no lockfile drift
- [ ] `npx tsc --noEmit` — must be zero errors
- [ ] `npm run build` — must complete with zero errors, all routes generated
- [ ] `git status` clean on the branch you're about to deploy (no uncommitted changes)
- [ ] Confirm which branch is being deployed matches the branch note above

---

## 1. Frontend deployment (Vercel)

1. Connect the repo to a Vercel project (or confirm the existing project points at the
   correct branch — see branch note above).
2. `vercel.json` is already correct: `next build`, output `.next`, `npm install`. No
   changes needed.
3. Set every variable listed in `PRODUCTION_ENVIRONMENT.md` under **Frontend** and
   **Backend** on the Vercel project (Production environment; also Preview if you want
   preview deploys to work against real services).
4. Confirm `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` are set to the real production
   domain, not `localhost`. (`.env.local` currently has both a localhost and production
   value for these — duplicate keys, last one wins locally; make sure only the
   production value is set in Vercel.)
5. Confirm `AI_MODE` is **unset** in the Vercel production environment. `.env.local` has
   `AI_MODE=development` set locally (which swaps AI providers for mocks) — if this
   leaks into production env vars, generation will silently produce fake/mock output.
6. Deploy.

## 2. Worker deployment (Railway)

1. Deploy `worker/` as its own Railway service — `worker/railway.toml` and
   `worker/Dockerfile` are already configured (`node src/index.js`, port 3001).
2. Set every variable listed in `PRODUCTION_ENVIRONMENT.md` under **Worker** on the
   Railway service. Note the worker uses **different variable names** than the Next.js
   app for the same Supabase project: `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (no
   `NEXT_PUBLIC_` prefix), not `NEXT_PUBLIC_SUPABASE_URL`. Easy to miss — the worker
   will fail silently or error on any Supabase-backed route without it.
3. `REDIS_URL` is optional: if unset, the worker logs `[queue] REDIS_URL not set —
   running in direct mode (no queue)` and serves requests directly instead of via
   BullMQ. Decide whether you want queued scene generation (needs Redis) or direct mode
   for launch, and provision a Redis instance (Railway plugin or external) accordingly.
4. Lip-sync engine: worker defaults to Wav2Lip (`WAV2LIP_PATH`, `PYTHON_BIN`). If you
   intend to use the RunPod-hosted engine instead, set `LIPSYNC_ENGINE=runpod` plus
   `RUNPOD_API_KEY` / `RUNPOD_ENDPOINT_ID`. Don't set both halves partially.
5. Set `ALLOWED_ORIGIN` to the production frontend origin (not `*`) once the frontend
   domain is known — tightens CORS.
6. Deploy, then confirm `GET /health` on the worker's public URL returns `status: ok`.
7. Set `NEXT_PUBLIC_WORKER_URL` on the **Vercel** project to this worker's public
   Railway URL. (`app/api/movie/generate-scenes/route.ts` falls back to the Railway
   production URL if unset — don't rely on that fallback; set it explicitly per
   environment.)

## 3. Database migration order (Supabase)

There are **no SQL migration files checked into this repo** — schema and RLS policies
live entirely in the Supabase dashboard, unversioned. This is a known, carried-over gap
(flagged in RC-1, RC-2, and the Release Validation report) — not something to fix under
a frozen-architecture pass, but it changes what "migration order" means here:

- [ ] Confirm the target Supabase project's schema matches what the app expects (no
      automated way to verify this from the repo — manual comparison against a known-good
      environment, e.g. staging, is the only option today).
- [ ] Confirm Row Level Security policies exist for every table the app reads/writes as
      an authenticated (non-admin) user. **Not audited by any RC pass** — application code
      was checked, not the database-side policies. Do this before go-live, not after.
- [ ] Confirm `users.is_admin` is `false`/unset for every account except intended admins.
      There is no UI or migration that sets this column — it must be set directly in the
      database. Verify the production project doesn't carry over a dev/test admin flag.
- [ ] Confirm Supabase Auth redirect URLs (`app/api/auth/callback`) include the
      production domain.
- [ ] Confirm whether Supabase email-confirmation-on-signup is toggled on — this is a
      project-dashboard setting, not visible in code, and directly affects whether the
      "check your email" UI (fixed in RC-2) is actually reachable.
- [ ] Confirm Google OAuth is enabled/configured in the Supabase project if you intend to
      offer Google login — also dashboard-only, not verifiable from code.

## 4. Cloudinary setup

- [ ] Cloudinary account/cloud configured, `CLOUDINARY_CLOUD_NAME` /
      `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` set on **both** Vercel and Railway
      (frontend and worker each upload independently).
- [ ] Confirm `res.cloudinary.com` remains in `next.config.js`'s `images.remotePatterns`
      (already present — no action needed unless the cloud name changes).
- [ ] No local-filesystem writes for production media were found outside the known
      Local GPU placeholder backend — Cloudinary is the sole real media store. No further
      setup needed beyond credentials.

## 5. Payment setup

- [ ] **Stripe**: set `STRIPE_SECRET_KEY` (live key), `STRIPE_WEBHOOK_SECRET` (from a
      webhook endpoint you create pointing at
      `https://<domain>/api/payment/stripe/webhook`), and
      `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. `.env.local` currently has placeholder
      `sk_test_REPLACE_ME` / `whsec_REPLACE_ME` values — these are **not real
      credentials**; production values must come from the live Stripe dashboard.
- [ ] **Razorpay**: set `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, and
      `RAZORPAY_WEBHOOK_SECRET` (webhook endpoint:
      `https://<domain>/api/payment/razorpay/webhook`). A **live** Razorpay key is
      already present in `.env.local` — see the security note in
      `PRODUCTION_ENVIRONMENT.md` about rotating it before launch given it's sat in
      plaintext on disk.
- [ ] **PayPal**: leave disabled. `app/api/payment/paypal/{create,capture}-order`
      intentionally return 503 (Sprint 16 security fix — no real Orders API
      verification exists). The UI already shows a "temporarily unavailable" notice
      (RC-2 fix). Do **not** set PayPal env vars expecting it to work, and do not
      advertise PayPal as a working payment option in any launch messaging.
- [ ] Confirm the pricing shown in checkout (`lib/plans.ts`) matches what you intend to
      charge in production — this is the single source of truth as of Sprint 16.

## 6. DNS, Domain, SSL

- [ ] Point production domain (e.g. `reelforge.fabricaipro.com`, per the value already
      in `.env.local`) at Vercel; Vercel issues SSL automatically once DNS resolves.
- [ ] Point a worker subdomain (e.g. `worker.reelforge.fabricaipro.com`, also already
      referenced in `.env.local`) at the Railway worker service, or use Railway's
      generated `*.up.railway.app` domain directly if a custom subdomain isn't ready —
      just make sure `NEXT_PUBLIC_WORKER_URL` on Vercel matches whichever you use.
- [ ] Confirm `ALLOWED_ORIGIN` on the worker matches the final frontend domain exactly
      (scheme + host), not a placeholder.

## 7. Webhook configuration

- [ ] Stripe webhook endpoint registered in the Stripe dashboard →
      `/api/payment/stripe/webhook`, signing secret copied into
      `STRIPE_WEBHOOK_SECRET`.
- [ ] Razorpay webhook endpoint registered in the Razorpay dashboard →
      `/api/payment/razorpay/webhook`, secret copied into `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Supabase Auth callback URL registered for the production domain (see §3).
- [ ] No PayPal webhook — intentional, PayPal is disabled.

## 8. Post-deploy smoke test

Run this in order against the production URL immediately after deploy (carried forward
from `docs/DEPLOYMENT.md`, still accurate):

1. Register → onboarding → dashboard loads with sidebar.
2. Create Reel: submit a generation, confirm credits decrement (**note:** this is one
   of the 9 `lib/credits.ts` direct routes — it correctly touches real `users.credits`.
   Movie Studio does **not** — see `PRODUCTION_ENVIRONMENT.md` / known risks before
   testing that path expecting the same behavior).
3. Movie Studio (sidebar) → Render Center loads (may show "No render jobs yet" on a
   fresh environment — correct, not a bug).
4. Billing → Upgrade modal opens, both Razorpay and Stripe checkout buttons render;
   PayPal shows the disabled notice, not a live button.
5. Worker: `GET https://<worker-domain>/health` returns `status: ok`.
6. Trigger an intentional error (malformed request to an API route) and confirm a
   friendly JSON error, not a blank screen or raw stack trace.
7. Log in as an account **without** `is_admin` set and confirm `/admin/**` routes
   reject you server-side (the pages themselves render chrome before failing — expected,
   see `docs/BETA_CHECKLIST.md`'s known limitations — but the API calls must 403).
