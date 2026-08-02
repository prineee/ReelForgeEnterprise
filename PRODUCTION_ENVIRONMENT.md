# Production Environment Variables — ReelForge Enterprise

Compiled by grepping every `process.env.*` reference across the Next.js app
(`app/`, `lib/`, `services/`, `components/`) and the worker (`worker/src/`). No
`.env.example` exists in the repo — this file is intended to close that gap. **No
secret values appear in this file** — names and purposes only.

Two deploy targets need variables set **independently**: the Next.js app (Vercel) and
the worker (Railway). A few logical values (Supabase URL/key, Cloudinary credentials)
are needed on both but under **different variable names** on the worker — flagged below.

Fail-fast behavior varies by variable (noted per entry): some throw clearly at startup
if missing, some silently default to `""` and fail confusingly deep in a request.

---

## Frontend (Vercel — `NEXT_PUBLIC_*`, safe to ship to the browser)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL, client-side SDK init |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key, client-side SDK init |
| `NEXT_PUBLIC_SITE_URL` | Yes | Used in Stripe checkout session success/cancel URLs |
| `NEXT_PUBLIC_APP_URL` | Yes | Used in affiliate link generation, referral URLs |
| `NEXT_PUBLIC_WORKER_URL` | Yes | Base URL the frontend calls for worker-backed features (reel/cartoon generation, captions, heygen). Falls back to a hardcoded Railway URL in `generate-scenes/route.ts` if unset — don't rely on that; set explicitly. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes (if Stripe enabled) | Stripe.js client init |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | No | PayPal SDK client init — UI renders a disabled notice regardless (backend intentionally returns 503); safe to leave unset |

## Backend (Vercel — server-only, Next.js API routes / services)

| Variable | Required | Purpose | Fail-fast? |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Privileged Supabase ops — `lib/supabase/admin.ts`, account deletion, admin routes | No — non-null assertion, no guard; missing key fails confusingly deep in a request |
| `AI_MODE` | **Must be unset in production** | `services/ai/devmode/isDeveloperMode.ts` — set to `development` swaps AI providers for mocks. Only activates on that exact value, not a default, but `.env.local` currently has it set for local dev; verify it did **not** get copied into the Vercel production env. | N/A |
| `BILLING_DEV_SEED_CREDITS` | No | Dev-convenience credit seed for `InMemoryCreditLedger`. Gated to non-production only as of RC-2 Task 5 — verify `NODE_ENV=production` is actually set by the platform (Vercel sets this automatically) so the gate is active. | N/A |
| `PIPER_TTS_URL` | No | Self-hosted TTS endpoint, used by `app/api/reel/generate` | N/A |

## Worker (Railway — separate service, `worker/`)

| Variable | Required | Purpose | Notes |
|---|---|---|---|
| `PORT` | No | Express listen port | Dockerfile hardcodes `3001`; Railway may inject its own |
| `ALLOWED_ORIGIN` | Recommended | CORS allow-origin for the frontend | Defaults to `*` if unset — tighten to the production frontend domain before launch |
| `SUPABASE_URL` | Yes | **Different name than the frontend's `NEXT_PUBLIC_SUPABASE_URL`** — same value, worker-specific var | Easy to miss when copying env vars between services |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Same key as the frontend's, set again on this service | |
| `REDIS_URL` | Optional | Enables BullMQ-backed scene generation queue (`services/queue.js`, `services/sceneWorker.js`) | If unset, worker logs a warning and runs in direct (unqueued) mode — decide deliberately, don't leave it unset by accident |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Yes | Worker uploads generated media directly to Cloudinary | Same values as frontend's, set again on this service |
| `PIXABAY_API_KEY`, `PEXELS_API_KEY` | Yes (at least one) | Stock media acquisition for reel/cartoon generation | Worker's `/health` reports which one is active |
| `OPENAI_API_KEY` | Yes (if using OpenAI TTS path) | `worker/src/services/tts.js` | |
| `LIPSYNC_ENGINE` | No | Selects lip-sync backend — `wav2lip` (default) or `runpod` | |
| `WAV2LIP_PATH`, `PYTHON_BIN` | Yes (if `LIPSYNC_ENGINE=wav2lip` / default) | Local Wav2Lip model path + Python interpreter | Health check reports `wav2lip_ready` based on the checkpoint file existing at this path |
| `SADTALKER_PATH` | No | Alternate lip-sync engine path, if used | |
| `RUNPOD_API_KEY`, `RUNPOD_ENDPOINT_ID` | Yes (if `LIPSYNC_ENGINE=runpod`) | RunPod-hosted lip-sync alternative | Set both together, not partially |
| `TOGETHER_API_KEY`, `REPLICATE_API_KEY` | No | Alternate cartoon image-generation providers | |
| `CARTOON_MUSIC_DIR` | No | Local background-music asset directory for cartoon assembly | |

## Payments

| Variable | Required | Purpose | Fail-fast? |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | Yes | Server-side Stripe SDK | Yes — throws clearly if missing |
| `STRIPE_WEBHOOK_SECRET` | Yes | Verifies Stripe webhook signatures before granting credits | Yes |
| `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET` | Yes | Order creation + payment verification | Yes |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Verifies Razorpay webhook signatures | Yes |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_ENV` | **Do not set in production expecting it to work** | Present in `.env.local` but `create-order`/`capture-order` routes are intentionally hardcoded to return 503 (Sprint 16 security fix — no real Orders API verification exists). Setting these does not re-enable PayPal. | N/A |

## AI Providers

| Variable | Required | Purpose | Fail-fast? |
|---|---|---|---|
| `GEMINI_API_KEY` | Yes | Google Gemini (script/story generation) + Google Veo render provider | Yes for `services/ai/gemini.ts`; **No** for `GoogleVeoProvider` — misconfiguration surfaces as an opaque SDK error mid-generation, not a clean startup check |
| `GROQ_API_KEY` | Yes | Groq-backed generation routes (script, caption, thumbnail, marketing, series-ai, cartoon dialogue/story) | Not explicitly verified fail-fast; treat as required for those routes |
| `VIDEO_PROVIDER` | Yes | Selects the active render provider (`ltx`, `google`, `local`) — manual switch only, no automatic failover | N/A |
| `LTX_API_KEY`, `LTX_API_BASE_URL`, `LTX_MODEL` | Yes (if `VIDEO_PROVIDER=ltx`) | LTX Cloud video provider | Yes — fails fast and clearly |

## Storage

| Variable | Required | Purpose | Fail-fast? |
|---|---|---|---|
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Yes | Sole production media store for the Next.js app (uploads, thumbnails, avatar images, asset manager) | **No** — `lib/env.ts` defaults everything to `""`; a missing credential fails deep in an upload call, not at boot |
| `PIXABAY_API_KEY`, `PEXELS_API_KEY` | Yes (at least one) | Stock media search/acquisition (cinema/marketing generation, replicate-video fallback) | No |

## Security

| Item | Type | Notes |
|---|---|---|
| `.env.local` / `worker/.env` hold real, live secrets in plaintext on disk | Operational risk, not a variable | Confirmed **not** committed to git (`.gitignore` covers `.env*`). A **live** Razorpay key (`rzp_live_...`) and other provider keys were observed in `.env.local` during this review. Recommend rotating any credential from these files before/at launch if this machine or repo has ever been shared, zipped, or backed up anywhere — carried forward from `docs/BETA_CHECKLIST.md`'s prior finding, still applicable. |
| `users.is_admin` | DB column, not an env var | Only gate for `app/api/admin/**` (`requireAdmin()`). No UI or migration sets this column — must be set directly in the database. Confirm no unintended production account has it set. |
| RLS policies | Supabase dashboard config, not env vars | Assumed to exist as defense-in-depth behind application-level ownership checks; **not verified** by any RC/validation pass to date (application code only). Verify directly in Supabase before launch. |
| `NODE_ENV` | Platform-managed | Vercel/Railway set this automatically; `services/billing/CreditTransaction.ts` relies on `NODE_ENV === "production"` to gate the dev-seed credit exploit fix (RC-2 Task 5) — don't override it manually. |

---

## Variables observed but not confirmed in active use

- `GEMINI_MODEL` — present in `.env.local`, no `process.env.GEMINI_MODEL` reference
  found in either app or worker source at time of review. Likely safe to omit; verify
  before assuming it does nothing.
- `RAILWAY_API_KEY`, `ELEVENLABS_API_KEY`, `REPLICATE_API_KEY` (root `.env.local`),
  `OPENAI_API_KEY` (root `.env.local`) — present at the repo-root env file but their
  actual consumers (where found) live under `worker/`, which has its own separate
  `worker/.env`. The root-level copies appear to be leftover/unused by the Next.js app
  itself; don't assume setting them on Vercel does anything without verifying the
  specific call site first.
