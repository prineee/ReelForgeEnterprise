# Operations Runbook — ReelForge Enterprise

This runbook assumes the deployment topology in `DEPLOYMENT_CHECKLIST.md`: Next.js app
on Vercel, worker on Railway, Supabase for auth/DB, Cloudinary for media. There is no
Render.com component in this stack — "Render troubleshooting" below refers to the
**video rendering pipeline** (Render Center / render jobs), not the Render.com platform.

**Read this first:** there is no APM, no error aggregation (no Sentry/Datadog/equivalent
in `package.json`), and no `/api/health` endpoint on the Next.js app (the worker does
have one — `GET /health`). Failures are visible only in Vercel/Railway logs and user
reports until that's addressed. Everything below is written for that reality, not for a
mature observability stack you don't have yet.

---

## Daily monitoring

Since there's no dashboard/alerting, treat this as a manual checklist until monitoring
is added:

- [ ] Vercel deployment status — confirm the last deploy is "Ready," not failed.
- [ ] Railway worker status — confirm the service is running, check `GET /health`.
- [ ] Vercel function logs — scan for repeated 500s, especially on
      `/api/movie/*`, `/api/payment/*`, `/api/render-center/*`.
- [ ] Railway worker logs — scan for `[express]` error lines and repeated
      `[queue] Worker init failed` warnings.
- [ ] Supabase dashboard → Database → check connection count / any slow-query flags if
      available on your plan.
- [ ] Stripe/Razorpay dashboards — reconcile any payment that shows as captured on the
      provider side but didn't produce a matching credit grant (webhook may have failed
      silently — see Payment Troubleshooting below).
- [ ] Spot-check a few in-flight/recent Movie Studio jobs via Render Center. **Known
      issue** (Release Validation Report, Blocking Issue #1): a failure at 5 of 6
      pipeline stages (Reference Images, Scene Prompts, Video Generation, Movie
      Assembly, Final Rendering) never sets `context.failure`, so the job shows "in
      progress" forever instead of "failed." A job stuck at the same progress % for an
      extended period is very likely this bug, not an actually-slow job — treat "stuck
      at X%" as equivalent to "failed" until the underlying fix lands.

## Error recovery

General principle: **in-memory state does not survive a restart.** `QueueManager`,
`RenderJobManager`, and `ProductionContextRepository` are all `globalThis` Map-backed,
not persisted. A Vercel redeploy or function cold-start-adjacent restart silently
abandons any in-flight job with no automatic recovery, and the user has no way to know
their job is gone — it just stops progressing.

- If a user reports a movie/render "stuck," first check whether a deploy happened
  around the time it got stuck. If so, the job's context was almost certainly lost —
  there is no recovery path other than asking the user to re-submit.
- If no deploy happened, check for the silent-hang bug above (stuck at a stage-boundary
  percentage, no error surfaced) before assuming it's still legitimately working.
- There is no automated retry/resubmit for abandoned jobs. `WorkflowExecutor.cancelQueueJob()`
  provides cancellation at the queue level, but not resumption.

## Worker restart

- Railway: restart the service from the Railway dashboard, or trigger a redeploy of the
  same image/commit.
- After restart, confirm `GET /health` returns `status: ok` and check the `wav2lip_ready`
  and `stock_video` fields — if either is unexpectedly `false`/`none`, an env var or
  mounted model path is missing (see `PRODUCTION_ENVIRONMENT.md` → Worker).
- Any job that was mid-flight on the worker at restart time is lost — same in-memory
  caveat as above, worker-side. No queue persistence beyond whatever BullMQ/Redis holds
  for jobs that were already enqueued (see Queue Recovery).

## Queue recovery

- The worker's scene-generation queue only exists if `REDIS_URL` is set; otherwise the
  worker runs in "direct mode" (no queue, synchronous handling) and this section doesn't
  apply.
- If Redis is in use and the worker restarts, BullMQ jobs already enqueued in Redis
  should still be there and resumable — Redis is external to the worker process. Confirm
  by checking `GET /api/queue/status` on the worker after restart.
- If Redis itself is unreachable, the worker logs `[queue] Worker init failed
  (non-fatal)` and continues serving other routes — scene generation specifically will
  fail/hang, everything else on the worker keeps working. Treat a `[queue]` error in
  worker logs as isolated to scene generation, not a full-worker outage.
- If Redis connectivity is restored, restart the worker to reinitialize the queue
  consumer — it does not appear to reconnect automatically mid-process based on the
  startup-only init in `src/index.js`.

## Database backup

- Supabase manages Postgres backups per your plan tier (check Supabase dashboard →
  Database → Backups for what's actually enabled/available on your project — this
  varies by plan and isn't something the app code controls).
- **There is no schema-as-code to restore from** — no migration files exist in this
  repo. A backup restores data, but reproducing the schema itself from scratch (e.g. for
  a new environment or disaster recovery to a fresh project) currently depends entirely
  on Supabase's own backup/restore or on someone manually re-creating tables/RLS
  policies from institutional knowledge. Strongly recommend exporting the current schema
  (Supabase dashboard → Database → or `pg_dump --schema-only`) and storing it outside
  the database itself as a first operational step post-launch.
- Before any risky manual DB change (e.g. hand-editing `users.is_admin`), take a manual
  snapshot/backup first if your Supabase plan supports on-demand backups.

## Rollback procedure

- **Frontend (Vercel):** use Vercel's "Instant Rollback" to the last known-good
  deployment from the Vercel dashboard — no redeploy/build needed, near-instant.
- **Worker (Railway):** redeploy the previous successful build/commit from the Railway
  dashboard's deployment history.
- **Code:** if a bad commit needs to be reverted at the source level (not just rolled
  back in the platform), use `git revert` on the specific commit rather than
  `git reset --hard`, so the branch history stays intact for the next deploy.
- **Database:** there is no migration-based rollback (no migrations exist). Any schema
  change made directly in the Supabase dashboard needs to be reversed the same way —
  manually, in the dashboard. Document any manual schema change somewhere durable
  (even a plain changelog file) since there's no other record of it.
- After any rollback, re-run the post-deploy smoke test in `DEPLOYMENT_CHECKLIST.md`
  §8 before considering the incident closed.

## Payment troubleshooting

- **Stripe/Razorpay "payment succeeded but no credits granted":** both providers
  perform signature-verified webhook processing before granting credits — check
  `/api/payment/stripe/webhook` or `/api/payment/razorpay/webhook` logs first for a
  signature-verification failure (usually a stale/wrong `*_WEBHOOK_SECRET`) or a 5xx
  that would have caused the provider to retry (Stripe/Razorpay both retry failed
  webhooks — check the provider dashboard's webhook delivery log for retry status
  before assuming it's permanently lost).
- **Amount mismatch concerns:** not possible via client tampering — both providers
  compute/verify the amount server-side (webhook signature or a re-fetch from the
  provider's own API), not from client input. If you see a wrong amount, the bug is in
  `lib/plans.ts` pricing config or the order-creation call, not a client exploit.
- **PayPal shows "Payment failed":** expected behavior — PayPal's backend is
  intentionally disabled (`create-order`/`capture-order` return 503, Sprint 16 security
  fix, no real Orders API verification exists yet). This is not an incident; do not
  attempt to "fix" it by re-enabling those routes without first building real
  server-side Orders API verification.
- **Movie Studio "purchased credits didn't decrease":** expected, not a bug to chase in
  isolation — Movie Studio's generation entry point (`POST /api/movie/create`) runs
  through an in-memory-only credit ledger disconnected from `users.credits` (RC-2/
  Release Validation finding, unresolved, requires an async architecture migration to
  fix). Do not spend incident-response time looking for a webhook/race-condition bug
  here; it's a known structural gap, tracked separately.

## Render (video pipeline) troubleshooting

- **Provider selection is env-var only** (`VIDEO_PROVIDER`): no automatic
  failover/health-based routing between LTX, Google Veo, and Local GPU. If the
  configured provider has an outage, jobs will fail/hang until you manually change
  `VIDEO_PROVIDER` and redeploy — there is no in-app failover to trigger.
- **Local GPU provider produces placeholder output** (a synthetic ffmpeg test pattern),
  not real video. If `VIDEO_PROVIDER=local` in production, that's very likely a
  misconfiguration, not a rendering bug — confirm this wasn't left over from testing.
- **LTX**: fails fast and clearly if `LTX_API_KEY`/`LTX_API_BASE_URL` are missing or
  invalid — check Vercel function logs for a clear provider-level error, not a silent
  hang, if LTX is misconfigured.
- **Google Veo**: does **not** fail fast — a misconfigured `GEMINI_API_KEY` surfaces as
  an opaque SDK-level error mid-generation rather than a clean startup check. If jobs
  using this provider are failing with unclear errors, verify the key directly (e.g.
  via `check-models.js` locally against the same key) before assuming a provider outage.
- **Jobs stuck "in progress" forever:** see the silent-hang bug under Daily Monitoring —
  check this before assuming the render provider itself is slow/down.

## Escalation notes

- No on-call/paging exists (no APM/alerting configured). Until that changes, "daily
  monitoring" above is the closest thing to detection — communicate that expectation to
  whoever owns support so they know to route stuck-job reports back to engineering
  quickly rather than assuming the user just needs to wait longer.
