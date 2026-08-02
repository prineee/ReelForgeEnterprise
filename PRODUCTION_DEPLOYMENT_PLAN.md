# Production Deployment Plan — ReelForge Enterprise

**Branch:** `feature/ltx-video-provider` (HEAD `9c500c4`) — the branch all RC/validation
passes ran against. If your deploy pipeline targets `main` instead, merge this branch
first; `main` is 87 commits behind and was not validated.

This plan is deployment configuration only — no code changes, no features, no
refactors. Where an item can't be verified from the repo (dashboard-only settings), it's
marked as a manual action in Step 4.

---

## Step 1 — Environment Variable Audit

### Frontend (Vercel, `NEXT_PUBLIC_*`)
| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Yes | Stripe checkout success/cancel URLs |
| `NEXT_PUBLIC_APP_URL` | Yes | Affiliate link generation, referral URLs |
| `NEXT_PUBLIC_WORKER_URL` | Yes | Frontend → worker calls (reel/cartoon gen, captions, heygen). Do not rely on the hardcoded Railway fallback in `generate-scenes/route.ts`. |

### Backend (Vercel, server-only, app-specific)
| Variable | Required | Purpose |
|---|---|---|
| `AI_MODE` | **Must be unset** | If set to `development`, swaps AI providers for mocks. `.env.local` has it set for local dev — confirm it did not get copied to Vercel prod env. |
| `BILLING_DEV_SEED_CREDITS` | No | Dev-only credit seed; gated to non-production by `NODE_ENV`, which Vercel sets automatically |
| `PIPER_TTS_URL` | No | Self-hosted TTS endpoint used by `app/api/reel/generate` |

### Railway Worker (infra-level; pipeline-specific vars are under Rendering below)
| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No | Dockerfile hardcodes `3001`; Railway may inject its own |
| `ALLOWED_ORIGIN` | Recommended | CORS allow-origin — defaults to `*` if unset, tighten to the production frontend domain |
| `REDIS_URL` | Optional | Enables BullMQ scene-generation queue; unset = worker runs unqueued "direct mode" |
| `OPENAI_API_KEY` | Yes (if OpenAI TTS path used) | `worker/src/services/tts.js` |

### Supabase (same project, different variable names per deploy target)
| Variable | Target | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | Yes |
| `SUPABASE_URL` | Railway (worker) | Yes — **unprefixed, not `NEXT_PUBLIC_`; easy to miss** |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway (worker) | Yes — same key, set again on this service |

### MongoDB
**Not part of this stack.** Audited directly: `mongodb` appears exactly once in
`package-lock.json`, as an unused optional peer dependency of an unrelated transitive
package (a generic multi-backend adapter listing it alongside `mssql`/`mysql`). No
driver import, connection string, or `process.env.MONGO*` reference exists anywhere in
`app/`, `lib/`, `services/`, or `worker/src/`. Supabase/Postgres is the only database.
**No MongoDB configuration is required or should be added** — including it here only to
close out the requested audit category truthfully.

### Cloudinary (needed on **both** Vercel and Railway independently)
| Variable | Required | Notes |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Yes | Both frontend and worker upload directly to Cloudinary |
| `CLOUDINARY_API_KEY` | Yes | |
| `CLOUDINARY_API_SECRET` | Yes | |

### AI Providers
| Variable | Required | Fail-fast? |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Yes for `services/ai/gemini.ts`; **no** for `GoogleVeoProvider` (opaque error mid-generation if bad) |
| `GROQ_API_KEY` | Yes | Powers script/caption/thumbnail/marketing/series-ai/cartoon-dialogue routes |

### Payments
| Variable | Required | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Fails fast if missing |
| `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Yes | Fails fast if missing |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV`, `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | **Do not configure expecting function** | `create-order`/`capture-order` are hardcoded to return 503 (Sprint 16 security fix — no real Orders API verification exists). Setting these does not re-enable PayPal. |

### Email
No application-level email service exists in this codebase (no `EMAIL_*`/SMTP vars,
no SendGrid/Postmark/etc. dependency). All transactional email (signup confirmation,
password reset) is Supabase Auth's own, configured entirely in the Supabase dashboard —
see Step 4.

### Rendering (video generation pipeline)
| Variable | Required | Notes |
|---|---|---|
| `VIDEO_PROVIDER` | Yes | `ltx` / `google` / `local` — manual switch, no auto-failover |
| `LTX_API_KEY`, `LTX_API_BASE_URL`, `LTX_MODEL` | Yes (if `VIDEO_PROVIDER=ltx`) | Fails fast and clearly |
| `PIXABAY_API_KEY`, `PEXELS_API_KEY` | Yes (at least one, both Vercel + Railway) | Stock media acquisition |
| `LIPSYNC_ENGINE` | No | `wav2lip` (default) or `runpod`, Railway worker only |
| `WAV2LIP_PATH`, `PYTHON_BIN` | Yes if using default engine | Railway worker only |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | Yes if `LIPSYNC_ENGINE=runpod` | Railway worker only, set both together |
| `SADTALKER_PATH` | No | Alt lip-sync engine, Railway worker only |
| `TOGETHER_API_KEY`, `REPLICATE_API_KEY` | No | Alt cartoon image providers, Railway worker only |
| `CARTOON_MUSIC_DIR` | No | Railway worker only |

**Confirm `VIDEO_PROVIDER` is not `local` in production** — that backend is an explicit
synthetic-test-pattern placeholder, not real video generation.

### Monitoring
No APM/error-aggregation service is configured anywhere in this codebase (no
Sentry/Datadog/equivalent in `package.json`, no env vars for one). The Railway worker
exposes `GET /health` with no additional configuration needed. **The Next.js app has no
equivalent health endpoint** — this is a gap to track post-launch, not something to
build under this deployment-configuration-only pass (adding a route is a code change).

---

## Step 2 — Deployment Sequence

```
1. Supabase          — schema/RLS/auth confirmed, project ready
2. MongoDB           — N/A, not part of this stack (skipped)
3. Cloudinary        — account + credentials ready
4. Railway Worker    — deployed against Supabase + Cloudinary, verified healthy
5. Vercel            — deployed against Supabase + Cloudinary + Worker URL
6. DNS               — custom domains attached to Vercel + Railway
7. Payments          — live Stripe/Razorpay keys + webhooks registered against final domain
8. Email             — Supabase Auth email settings + redirect URLs confirmed against final domain
9. Final Validation  — full smoke test against the live production domain
```

Rationale for the order: Supabase and Cloudinary have no dependency on anything else and
must exist before either compute service starts. The worker deploys before Vercel
because Vercel needs the worker's live URL (`NEXT_PUBLIC_WORKER_URL`). DNS comes after
both services are confirmed working on their default platform domains — attaching a
custom domain to something broken just makes the break harder to diagnose. Payments and
Email both come after DNS because webhook URLs and auth redirect URLs must point at the
**final** domain, not a temporary Vercel/Railway subdomain — registering them earlier
means re-registering them later anyway.

---

## Step 3 — Deployment Checklist

### 1. Supabase
- **Purpose:** Foundational auth + database; every other service depends on it being
  correctly configured first.
- **Required variables:** none set *here* — this step is dashboard configuration that
  *produces* the values (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) consumed by later steps.
- **Verification:** confirm schema matches app expectations (manual comparison against
  a known-good environment — no migrations exist to diff against); confirm RLS policies
  exist on every authenticated-user-facing table (not audited by any prior pass); confirm
  `users.is_admin` is correct for production accounts; confirm Auth redirect URL and
  Google OAuth are configured for the final domain (can be revisited after Step 6/DNS if
  the domain isn't final yet, but must be done before Step 9).
- **Rollback plan:** Supabase changes made in this step are additive/config-only
  (no app data yet) — if misconfigured, correct directly in the dashboard. No app traffic
  depends on this yet, so there is no live-rollback risk at this stage.

### 2. MongoDB
- **Purpose:** N/A — not part of this stack. No action.
- **Required variables:** none.
- **Verification:** none needed.
- **Rollback plan:** none needed.

### 3. Cloudinary
- **Purpose:** Sole production media store for both the frontend and the worker.
- **Required variables:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET` (noted, not yet set on any service — that happens in Steps 4/5).
- **Verification:** confirm the Cloudinary account/cloud exists and credentials are
  valid (e.g. a manual test upload via the dashboard or API explorer) before wiring them
  into Vercel/Railway.
- **Rollback plan:** no live dependents yet at this step — if credentials are wrong,
  regenerate/correct in the Cloudinary dashboard before Step 4/5.

### 4. Railway Worker
- **Purpose:** Deploys the video/audio processing worker (reel/cartoon generation,
  lip-sync, TTS) as its own service, independent of the Next.js app.
- **Required variables:** all **Railway Worker**, worker-side **Supabase**, worker-side
  **Cloudinary**, and worker-side **Rendering** variables from Step 1.
- **Verification:** `GET https://<worker-domain>/health` returns `status: ok`; check the
  `wav2lip_ready` and `stock_video` fields aren't unexpectedly `false`/`none`; if
  `REDIS_URL` is set, confirm `GET /api/queue/status` responds.
- **Rollback plan:** redeploy the previous successful build/commit from Railway's
  deployment history; if this is the first deploy, there is no previous build — fix
  forward (correct env vars, redeploy) rather than rollback.

### 5. Vercel
- **Purpose:** Deploys the Next.js frontend and all `app/api/**` routes.
- **Required variables:** all **Frontend**, **Backend**, frontend-side **Supabase**,
  frontend-side **Cloudinary**, **AI Providers**, and frontend-side **Rendering**
  variables from Step 1. `NEXT_PUBLIC_WORKER_URL` must point at the Railway service
  deployed in Step 4.
- **Verification:** deployment shows "Ready"; register → onboarding → dashboard loads;
  confirm `AI_MODE` is unset in the Vercel production environment specifically (not just
  absent from your local checklist — check the actual Vercel project settings).
- **Rollback plan:** Vercel "Instant Rollback" to the last known-good deployment from
  the dashboard — near-instant, no rebuild required.

### 6. DNS
- **Purpose:** Attach the real production domain(s) to both services.
- **Required variables:** none directly — this is DNS record configuration
  (A/CNAME) at your domain registrar/DNS provider, plus confirming
  `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` on Vercel and `ALLOWED_ORIGIN` on
  Railway are updated to match the final domain if they were set to a placeholder.
- **Verification:** production domain resolves to Vercel and serves the app over HTTPS
  (Vercel auto-issues SSL once DNS resolves); worker subdomain resolves to Railway and
  `GET /health` succeeds over the final domain.
- **Rollback plan:** revert the DNS record change at the registrar — propagation delay
  is the main risk, so treat DNS changes as slow to roll back and test on a subdomain
  first if possible.

### 7. Payments
- **Purpose:** Enable live Stripe and Razorpay checkout against the final domain.
- **Required variables:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET` — all live-mode values, set on Vercel (replacing any
  test/placeholder values from `.env.local`).
- **Verification:** Billing page renders both checkout buttons; a real low-value test
  transaction (or provider's test mode against the live webhook endpoint, if supported)
  completes and grants credits; webhook delivery logs in the Stripe/Razorpay dashboards
  show successful (200) delivery to the production URL.
- **Rollback plan:** payments are provider-hosted — if a webhook is misconfigured,
  correct the endpoint/secret in the provider dashboard and redeliver from their
  dashboard's webhook log (both Stripe and Razorpay support manual redelivery). No
  app-side rollback needed unless the *code* handling the webhook is at fault, in which
  case use the Step 5 Vercel rollback.

### 8. Email
- **Purpose:** Confirm Supabase Auth's transactional email (signup confirmation,
  password reset) works against the final domain.
- **Required variables:** none in application code — entirely a Supabase dashboard
  setting (custom SMTP or Supabase's default sender, plus redirect URL configuration).
- **Verification:** register a real test account and confirm the confirmation email
  arrives and its link redirects to the production domain, not `localhost` or a
  Vercel preview URL.
- **Rollback plan:** revert the Supabase Auth email/redirect-URL setting in the
  dashboard; no app deploy involved.

### 9. Final Validation
- **Purpose:** End-to-end confirmation the whole stack works together on the real
  production domain before calling it launched.
- **Required variables:** none new — validates everything configured in Steps 1–8.
- **Verification:** run the full smoke test in `LAUNCH_DAY_CHECKLIST.md`.
- **Rollback plan:** see `ROLLBACK_PLAN.md` — if final validation fails, do not
  announce launch; roll back whichever component failed and re-run validation.

---

## Step 4 — Manual Configuration Actions Required Per Platform

### Supabase (dashboard)
- [ ] Confirm/create the production project (separate from any dev/staging project).
- [ ] Verify schema matches app expectations (no migrations exist — manual comparison).
- [ ] Audit RLS policies on every authenticated-user-facing table — **never done by any
      prior pass**, this is net-new verification work, not a re-check.
- [ ] Set `users.is_admin = true` only for intended admin accounts (no UI/migration does
      this — direct SQL/table edit in the dashboard).
- [ ] Toggle email-confirmation-on-signup to the desired setting (Auth → Providers →
      Email).
- [ ] Enable and configure Google OAuth provider if offering Google login (Auth →
      Providers → Google — needs a Google Cloud OAuth client, see Google section below).
- [ ] Set Auth redirect URLs to include the final production domain (Auth → URL
      Configuration).
- [ ] Configure custom SMTP (or confirm Supabase's default email sending is acceptable
      for production volume/deliverability) under Auth → Email Templates / SMTP Settings.
- [ ] Copy `Project URL`, `anon public` key, and `service_role` key for Steps 4–5.

### Railway (dashboard)
- [ ] Create the worker service from the `worker/` directory (Dockerfile-based).
- [ ] Set all Railway Worker / worker-side Supabase / worker-side Cloudinary /
      worker-side Rendering env vars (Step 1).
- [ ] Provision a Redis add-on/plugin if you want the BullMQ queue path (`REDIS_URL`) —
      decide deliberately; unqueued "direct mode" is a valid choice for launch.
- [ ] Attach a custom domain/subdomain if not using the generated `*.up.railway.app`
      URL (Step 6).
- [ ] Confirm the deployment's health check (`GET /health`) after first deploy.

### Vercel (dashboard)
- [ ] Connect the repo, confirm it's pointed at `feature/ltx-video-provider` (or `main`
      after merging — see the branch note at the top of this document).
- [ ] Set all Frontend / Backend / frontend-side Supabase / frontend-side Cloudinary /
      AI Providers / frontend-side Rendering / Payments env vars (Step 1), Production
      environment (and Preview if desired).
- [ ] Explicitly confirm `AI_MODE` is **absent** from the Vercel Production env vars list
      — check the actual list, don't infer from `.env.local`.
- [ ] Attach the custom production domain (Step 6).
- [ ] Trigger the first production deploy and confirm "Ready" status.

### Cloudinary (dashboard)
- [ ] Confirm the account/cloud used for this project (`CLOUDINARY_CLOUD_NAME` from
      `.env.local` is `deik606wz` — confirm this is the intended production cloud, not
      a dev/test one, before reusing it; create a dedicated production cloud if not).
- [ ] Copy API key/secret for Steps 4–5.
- [ ] Confirm upload presets/folder structure (if any are expected by the app) exist —
      not verified by this pass; check `app/api/media/upload` and worker upload call
      sites if uploads fail after deploy.

### Stripe (dashboard)
- [ ] Switch to Live mode (not Test mode) for production keys.
- [ ] Copy the live `Secret key` and `Publishable key`.
- [ ] Create a webhook endpoint pointed at
      `https://<production-domain>/api/payment/stripe/webhook`, select the relevant
      event types (checkout session completed, at minimum — confirm against
      `app/api/payment/stripe/webhook/route.ts`'s handled event types).
- [ ] Copy the webhook's signing secret into `STRIPE_WEBHOOK_SECRET`.

### Razorpay (dashboard)
- [ ] Switch to Live mode.
- [ ] Copy the live `Key ID` and `Key Secret`. **Note:** a live Razorpay key was found
      already sitting in `.env.local` in plaintext — confirm whether it's already the
      intended production key or should be rotated (see Security note in
      `PRODUCTION_ENVIRONMENT.md`) before reusing it as-is.
- [ ] Create a webhook endpoint pointed at
      `https://<production-domain>/api/payment/razorpay/webhook`.
- [ ] Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`.

### PayPal (dashboard)
- [ ] **No action required.** Checkout is intentionally disabled server-side
      (`create-order`/`capture-order` return 503, Sprint 16 security fix — no real
      Orders API verification exists). Do not create live PayPal app credentials
      expecting them to activate checkout; they won't, by design, until that
      verification is built (out of scope for this deployment pass).

### Google (Google Cloud Console)
- [ ] Only needed if enabling Google OAuth login: create an OAuth 2.0 Client ID
      (Web application type), add the production domain and Supabase's OAuth callback
      URL as authorized redirect URIs, then paste the Client ID/Secret into Supabase's
      Google Auth provider config (see Supabase section above).
- [ ] Confirm the `GEMINI_API_KEY` used for AI features is a separate, already-existing
      Gemini API key (Google AI Studio / Vertex) — unrelated to the OAuth client above;
      don't conflate the two when provisioning.
