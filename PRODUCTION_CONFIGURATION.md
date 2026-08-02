# Production Configuration — ReelForge Enterprise

Every required environment variable, separated by where it's actually set. Compiled by
grepping every `process.env.*` reference in `app/`, `lib/`, `services/`, `components/`,
and `worker/src/`. No secret values appear below — names, targets, and purpose only.

A number of logical values (Supabase URL/keys, Cloudinary credentials) must be set on
**more than one platform** for the same underlying account — each occurrence is listed
under its own platform section since that's where the actual configuration action
happens.

---

## Vercel (Next.js frontend + API routes)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL, client SDK |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key, client SDK |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Privileged Supabase ops (`lib/supabase/admin.ts`) — no startup guard, fails deep in-request if wrong |
| `NEXT_PUBLIC_SITE_URL` | Yes | Stripe checkout success/cancel URLs |
| `NEXT_PUBLIC_APP_URL` | Yes | Affiliate link generation |
| `NEXT_PUBLIC_WORKER_URL` | Yes | Points at the Railway worker's public URL |
| `AI_MODE` | **Must be absent** | If `development`, mocks all AI providers |
| `BILLING_DEV_SEED_CREDITS` | No | Dev-only, gated to non-production by `NODE_ENV` |
| `PIPER_TTS_URL` | No | Self-hosted TTS endpoint |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Yes | Frontend direct uploads |
| `GEMINI_API_KEY` | Yes | Script generation + Google Veo render provider |
| `GROQ_API_KEY` | Yes | Script/caption/thumbnail/marketing/series/cartoon-dialogue routes |
| `VIDEO_PROVIDER` | Yes | `ltx` / `google` / `local` — confirm not `local` in production |
| `LTX_API_KEY` / `LTX_API_BASE_URL` / `LTX_MODEL` | Yes if `VIDEO_PROVIDER=ltx` | LTX render provider |
| `PIXABAY_API_KEY` / `PEXELS_API_KEY` | Yes (at least one) | Stock media |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe checkout + webhook verification |
| `RAZORPAY_KEY_ID` / `RAZORPAY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` | Yes | Razorpay checkout + webhook verification |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | No | Renders the disabled-notice UI regardless; safe to omit |

## Railway (worker service, `worker/`)

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No | Dockerfile hardcodes `3001`; Railway may override |
| `ALLOWED_ORIGIN` | Recommended | CORS — defaults to `*` if unset, tighten to production frontend domain |
| `SUPABASE_URL` | Yes | **Same value as Vercel's `NEXT_PUBLIC_SUPABASE_URL`, different name — no `NEXT_PUBLIC_` prefix on the worker** |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Same key as Vercel's, set again on this service |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Yes | Worker's own direct uploads, same values as Vercel's |
| `PIXABAY_API_KEY` / `PEXELS_API_KEY` | Yes (at least one) | Worker's own stock media acquisition |
| `REDIS_URL` | Optional | Enables BullMQ scene-generation queue; unset = worker runs unqueued "direct mode" |
| `OPENAI_API_KEY` | Yes if using OpenAI TTS path | `worker/src/services/tts.js` |
| `LIPSYNC_ENGINE` | No | `wav2lip` (default) or `runpod` |
| `WAV2LIP_PATH` / `PYTHON_BIN` | Yes if default engine | Local Wav2Lip model path + interpreter |
| `RUNPOD_API_KEY` / `RUNPOD_ENDPOINT_ID` | Yes if `LIPSYNC_ENGINE=runpod` | Set both together |
| `SADTALKER_PATH` | No | Alternate lip-sync engine |
| `TOGETHER_API_KEY` / `REPLICATE_API_KEY` | No | Alternate cartoon image providers |
| `CARTOON_MUSIC_DIR` | No | Local background-music asset directory |

## Supabase (dashboard configuration, not env vars set *on* Supabase)

Supabase doesn't consume app-side environment variables — this section lists the
values it **produces** for the two sections above, plus dashboard settings that are not
variables at all:

| Item | Type | Consumed as |
|---|---|---|
| Project URL | Value | `NEXT_PUBLIC_SUPABASE_URL` (Vercel) / `SUPABASE_URL` (Railway) |
| `anon public` key | Value | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Vercel only) |
| `service_role` key | Value | `SUPABASE_SERVICE_ROLE_KEY` (Vercel and Railway) |
| Auth → Email confirmation toggle | Dashboard setting | N/A — no env var |
| Auth → Redirect URLs | Dashboard setting | N/A — must include production domain |
| Auth → Google provider | Dashboard setting | N/A — needs a Google OAuth Client (see Google below) |
| `users.is_admin` | Database column | N/A — set directly in the table, no UI/migration sets it |
| RLS policies | Database config | N/A — not env vars, verify directly in the dashboard |

## MongoDB

**Not applicable.** Confirmed by direct audit: no MongoDB driver, connection string, or
usage anywhere in this codebase. `mongodb` appears once, as an unused optional
peer-dependency of an unrelated transitive package in `package-lock.json`. No variables
to configure.

## Cloudinary

| Variable | Set on | Required |
|---|---|---|
| `CLOUDINARY_CLOUD_NAME` | Vercel + Railway | Yes, both |
| `CLOUDINARY_API_KEY` | Vercel + Railway | Yes, both |
| `CLOUDINARY_API_SECRET` | Vercel + Railway | Yes, both |

Same three values on both platforms — confirm the cloud used is the intended
production cloud, not a leftover dev/test one, before reusing existing credentials.

## Stripe

| Variable | Set on | Required |
|---|---|---|
| `STRIPE_SECRET_KEY` | Vercel | Yes — live mode |
| `STRIPE_WEBHOOK_SECRET` | Vercel | Yes — from a webhook endpoint registered against the production domain |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Vercel | Yes — live mode |

## Razorpay

| Variable | Set on | Required |
|---|---|---|
| `RAZORPAY_KEY_ID` | Vercel | Yes — live mode |
| `RAZORPAY_SECRET` | Vercel | Yes — live mode |
| `RAZORPAY_WEBHOOK_SECRET` | Vercel | Yes — from a webhook endpoint registered against the production domain |

A **live** Razorpay key was found already present in `.env.local` in plaintext — decide
explicitly whether to reuse it or rotate it before treating it as the production value
(see Known Limitations).

## PayPal

| Variable | Set on | Required |
|---|---|---|
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_ENV` | — | **Do not configure expecting function.** `create-order`/`capture-order` intentionally return 503 (Sprint 16 security fix, no real Orders API verification built). Setting these does not re-enable checkout. |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Vercel | Optional, cosmetic only — UI shows a disabled notice regardless |

## Google

Two unrelated Google integrations exist — do not conflate them:

| Variable/Item | Purpose | Set on |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini AI (script generation + Google Veo render provider) | Vercel |
| Google OAuth Client ID/Secret | Google login (Sign in with Google) | Pasted into the Supabase dashboard's Google Auth provider config — **not** a Vercel/Railway env var |

Google OAuth setup (only if offering Google login): create an OAuth 2.0 Web Client in
Google Cloud Console, add the production domain and Supabase's OAuth callback URL as
authorized redirect URIs, paste the resulting Client ID/Secret into Supabase.

## Email

**No environment variables exist for email in this codebase.** All transactional email
(signup confirmation, password reset) is sent by Supabase Auth directly, configured
entirely in the Supabase dashboard (Auth → Email Templates / SMTP Settings — either
Supabase's default sender or a custom SMTP provider's credentials, entered there, not
in Vercel/Railway).

---

## Variables observed in `.env.local` but not confirmed in active use

`GEMINI_MODEL`, `RAILWAY_API_KEY`, `ELEVENLABS_API_KEY` (root-level copy),
`REPLICATE_API_KEY` (root-level copy), `OPENAI_API_KEY` (root-level copy) — present in
the repo-root `.env.local` but no corresponding `process.env.*` reference was found in
the Next.js app source at time of audit; their real consumers (where they exist) live
under `worker/`, which has its own separate `worker/.env`. Don't assume setting the
root-level copies on Vercel does anything without verifying the specific call site
first.
