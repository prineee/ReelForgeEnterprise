# ReelForge Enterprise — Deployment

Two services deploy independently.

## 1. Next.js app → Vercel

`vercel.json` is already configured (`next build`, output `.next`, `npm install`).
Connect the repo in Vercel and set the environment variables below on the project
(Production + Preview as appropriate).

### Required environment variables

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only — used by `lib/supabase/admin.ts` for
  privileged operations like account deletion and admin routes)

**AI providers**
- `GEMINI_API_KEY`
- `GROQ_API_KEY`
- `LTX_API_BASE_URL`, `LTX_API_KEY`, `LTX_MODEL` (LTX video provider)
- `VIDEO_PROVIDER` (selects which render provider `RenderDecisionEngine` uses)
- `AI_MODE` (see `services/infrastructure/*Factory.ts` for Developer Mode behavior)

**Media**
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `PEXELS_API_KEY`, `PIXABAY_API_KEY`
- `PIPER_TTS_URL` (self-hosted TTS endpoint)

**Payments**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- PayPal: `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is present, but PayPal checkout is currently
  **disabled server-side** (Sprint 16, Task 5 — see `## Security` below) since it had
  no real Orders API verification. Do not re-enable `app/api/payment/paypal/{create,capture}-order`
  without first implementing that verification.

**App/worker wiring**
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_WORKER_URL` (defaults to the Railway production worker URL if unset —
  see `app/api/movie/generate-scenes/route.ts`; set explicitly per environment)

**Misc**
- `BILLING_DEV_SEED_CREDITS` (dev/test convenience — verify it's unset or appropriate
  in production)

There is no `.env.example` checked in; the list above was compiled by grepping every
`process.env.*` reference in the app. Consider adding a real `.env.example` as a
follow-up so this list can't silently drift from the code again.

### Build/verify before deploying

```bash
npm install
npx tsc --noEmit
npm run build
```

Both must be clean. `npm run build` also runs Next's production lint pass.

## 2. Render worker → Railway

`worker/railway.toml` and `worker/Dockerfile` are already set up. Deploy `worker/` as
its own Railway service. Set `NEXT_PUBLIC_WORKER_URL` on the Vercel app to that
service's public URL once deployed.

The worker has its own `package.json`/dependencies — install and configure separately
from the Next.js app (see `worker/README` if present, or `worker/src` for entry
points).

## 3. Supabase

- Auth: email/password is wired (`app/(auth)/**`); confirm redirect URLs
  (`app/api/auth/callback`) are configured for the production domain in the Supabase
  dashboard.
- Row Level Security: verify RLS policies exist for every table the app reads/writes
  as an authenticated (non-admin) user — this pass did not audit RLS policies
  themselves, only the application code calling Supabase.
- **Admin access**: `users.is_admin` (boolean) gates every `app/api/admin/**` route as
  of Sprint 16, Task 5 (`lib/admin.ts`'s `requireAdmin()`). Before launch, confirm no
  production user has `is_admin = true` who shouldn't, and that there's an actual
  process for setting it (this pass found no UI or migration that sets this column —
  it must currently be set directly in the database).
- No SQL migration files were found checked into this repo at audit time; confirm the
  production schema is otherwise tracked/reproducible before launch.

## Security

See `docs/BETA_CHECKLIST.md`'s "Security" section for the full Sprint 16 Task 5 audit
(assumptions, fixes, remaining risks) before going to production. Highlights relevant
to deployment specifically:
- `.env.local` / `worker/.env` were found holding real live secrets in plaintext on
  disk during this audit (not committed to git). Rotate any of those keys before
  launch if this repo/machine has ever been shared, zipped, or backed up anywhere.
- PayPal checkout is disabled (see above) — don't advertise it as a working payment
  option until re-enabled with real verification.

## Post-deploy smoke test

1. Register → onboarding → dashboard loads with sidebar.
2. Create Reel: submit a generation, confirm credits decrement.
3. Movie Studio (sidebar) → Render Center loads (may show "No render jobs yet" on a
   fresh environment — that's correct, not a bug).
4. Billing → Upgrade modal opens, both Razorpay and Stripe checkout buttons render.
5. Trigger an intentional error (e.g. a malformed request to an API route) and confirm
   you get a friendly JSON error / branded error page, not a blank screen.
