# Go-Live Checklist — ReelForge Enterprise

Every item below is manually verifiable against the live production domain — no code
reading required to check it off. Run this in full immediately before/during launch;
`DEPLOYMENT_RUNBOOK.md` Part D has a shorter routine-deploy version for day-to-day use.

## Authentication

- ☐ Registration works (new account, real email address)
- ☐ Login works
- ☐ Logout works
- ☐ Email verification works ("check your email" state shows, link received, link
     redirects to the production domain and confirms the account)
- ☐ Password reset works end-to-end (request → email → reset link → new password
     logs in)
- ☐ Google login works *(only if Google OAuth is enabled for this launch)*

## Credits

- ☐ Credits purchase works via Stripe (checkout completes, `users.credits` increments)
- ☐ Credits purchase works via Razorpay (checkout completes, `users.credits`
     increments)
- ☐ PayPal correctly shows "temporarily unavailable," not a live checkout button
     (confirms it was not accidentally re-enabled)
- ☐ Credits balance displayed on the Billing page matches the actual `users.credits`
     value
- ☐ Direct-generation credit deduction works (e.g. Create Reel — submit, confirm
     credits visibly decrease)

## Movie generation

- ☐ Movie Studio Workspace loads and is reachable from the sidebar
- ☐ Storyboard tab submits a real render (no mock/placeholder data)
- ☐ Character Studio creates/loads a character
- ☐ Scene Studio creates/loads a scene
- ☐ A full Movie Studio generation run (`POST /api/movie/create`) reaches completion
     **or** clearly surfaces a failure state — a job stuck at an unchanging progress
     percentage for an extended period is a fail on this line, not a "still working"

## Rendering

- ☐ Render Center loads and lists real render jobs (or a correct empty state on a
     fresh environment)
- ☐ A submitted render job completes using the **configured, non-placeholder**
     provider (confirm `VIDEO_PROVIDER` is `ltx` or `google`, not `local`, before
     checking this box)
- ☐ Render job cancel action works
- ☐ Render job retry action works

## Download

- ☐ A completed render/generation produces a downloadable/playable asset URL
- ☐ The asset URL resolves under `res.cloudinary.com` (confirms Cloudinary storage is
     correctly wired, not a broken/local path)
- ☐ The downloaded file actually plays/opens (not a 0-byte or corrupt file)

## Affiliate tracking

- ☐ Joining the affiliate program generates a referral link/code
- ☐ Registering through a referral link attributes the referral correctly
- ☐ Affiliate dashboard shows real stats (not zeros on an account with actual
     activity)
- ☐ Affiliate's own payout-history view shows their past requests (not empty when
     requests exist — this was a real bug, fixed in RC-2; re-confirm in production)
- ☐ Commission accrues correctly on a real sale-based and a signup-referral event

## Admin dashboard

- ☐ Admin dashboard shows real metric/stat cards (not placeholders or zeros)
- ☐ Admin Analytics page loads real data
- ☐ Admin Payout Management lists and can act on real payout requests
- ☐ A **non-admin** account's request to any `/api/admin/**` route is rejected (403)
- ☐ `users.is_admin` is confirmed correct for production — no unintended account has
     admin access

## Email

- ☐ Signup confirmation email delivers within a reasonable time
- ☐ Password reset email delivers within a reasonable time
- ☐ Both emails' links point at the production domain, not `localhost` or a preview URL

## Storage

- ☐ Cloudinary uploads succeed from the frontend (e.g. a direct media upload)
- ☐ Cloudinary uploads succeed from the worker (e.g. a reel/cartoon generation)
- ☐ No broken/404 images anywhere in the smoke-tested flows

## Monitoring

- ☐ Railway worker `/health` endpoint returns `status: ok`
- ☐ Vercel deployment logs are being actively watched (manual — no APM exists; this
     is a process checkbox, not a tooling one)
- ☐ Whoever owns support/on-call has been briefed on the known silent-hang symptom
     (a job stuck at an unchanging % is a known possible bug, not necessarily "still
     working")
- ☐ *(Acknowledge, don't block on)* no automated uptime/error-aggregation tool is
     configured — this is a tracked known limitation, not a launch blocker on its own

## Backups

- ☐ Supabase's backup tier/schedule for the production project has been checked and
     matches expectations (plan-dependent — verify directly in the dashboard, don't
     assume a default)
- ☐ A schema-only export has been taken and stored outside the database itself (no
     migrations exist in-repo, so this is the only reproducibility safety net today)
- ☐ Rollback procedure (`ROLLBACK_PLAN.md` / `DEPLOYMENT_RUNBOOK.md` Part C) has been
     read by whoever is on point for launch day, not just written down

## Security (final pre-launch confirmation)

- ☐ RLS policies confirmed present on every authenticated-user-facing Supabase table
- ☐ No live/test secrets from `.env.local` or `worker/.env` were reused without an
     explicit rotate-or-keep decision
- ☐ `AI_MODE` confirmed absent from the Vercel production environment
- ☐ `VIDEO_PROVIDER` confirmed not `local` in the Vercel production environment

---

## Sign-off

Launch should not proceed until every box above is checked **or** explicitly deferred
with a named owner and reason (e.g. "Google login: deferred, not offering at launch").
Any box left unchecked with no explicit deferral decision is a **NOT READY** signal for
that specific area, not something to silently skip.
