# Rollback Plan — ReelForge Enterprise

Component-by-component rollback procedures. General rule: **prefer platform rollback
over `git revert` over manual dashboard undo, in that order of speed**, and always
re-run the relevant part of `LAUNCH_DAY_CHECKLIST.md`'s smoke test after any rollback
before declaring the incident resolved.

---

## Decision tree: rollback vs. fix-forward

- **Rollback** if: the previous deployed version was confirmed working (passed its own
  smoke test) and the new version's failure is unclear, wide-reaching, or affects
  payments/auth. Speed matters more than root-causing in the moment.
- **Fix-forward** if: the issue is isolated, well-understood, and the fix is small
  (e.g. a single wrong env var value) — correcting the config and redeploying is often
  faster and lower-risk than a rollback when the underlying code hasn't regressed.
- **Never** roll back the database independently of the app unless you're certain no
  schema-affecting change shipped with the app version you're rolling back from — since
  there are no migrations, "the database" and "the deployed app version" aren't
  automatically kept in sync the way a migration-based system would.

---

## Frontend (Vercel)

**Symptom:** new deploy is broken (500s, blank pages, broken checkout, etc.)

1. Vercel dashboard → Deployments → find the last known-good deployment.
2. Click "Promote to Production" / use Instant Rollback — this is near-instant, no
   rebuild required, and doesn't touch git history.
3. Confirm the rollback deployment shows "Ready" and re-run the relevant smoke-test
   steps from `LAUNCH_DAY_CHECKLIST.md`.
4. Once stable, investigate the failed deploy separately (locally or in a preview
   deploy) — do not debug directly in production.

**If the bad commit needs to be reverted at the source level** (e.g. so the next normal
deploy doesn't reintroduce the issue): `git revert <bad-commit>` on the deploy branch,
push, let it deploy normally. Do not `git reset --hard` on a shared branch.

## Railway Worker

**Symptom:** worker unhealthy, `/health` failing, or a specific pipeline (TTS,
lip-sync, cartoon) broken after a deploy.

1. Railway dashboard → the worker service → Deployments → redeploy the previous
   successful build/commit.
2. Confirm `GET /health` returns `status: ok` post-rollback.
3. If the issue was an env var change rather than a code deploy, correct the variable
   in Railway's settings and trigger a redeploy of the **current** (not rolled-back)
   build — no need to roll back code for a config-only mistake.
4. Any job that was mid-flight on the worker at the time of the issue is lost (no
   restart recovery) — this is expected, not a sign the rollback itself failed.

## Database (Supabase)

**Symptom:** a manual schema/RLS change made directly in the dashboard breaks the app.

1. There is no migration-based rollback — reverse the specific change manually in the
   Supabase dashboard (re-add a dropped column, restore an RLS policy, etc.).
2. If you took a schema-only export before the change (recommended in
   `OPERATIONS_RUNBOOK.md`), use it as the reference for what "correct" looked like.
3. For data-level corruption/loss (not schema): restore from Supabase's own backup
   per your plan's backup/restore tooling — this is a Supabase-managed process, not
   something scripted in this repo.
4. **Always test schema/RLS changes against a non-production Supabase project first**
   going forward — there is currently no automated way to validate a change before it's
   live in production, which is exactly why this step is manual and higher-risk than
   the app-level rollbacks above.

## DNS

**Symptom:** a DNS change broke domain resolution or routed traffic to the wrong
service.

1. Revert the specific A/CNAME record at the registrar/DNS provider to its previous
   value.
2. Expect propagation delay (minutes to hours depending on TTL) — this rollback is not
   instant like Vercel's. If launch-day DNS issues are a concern, set a low TTL on
   records before the change so any needed rollback propagates faster.
3. Confirm resolution via an external propagation checker, not just your own browser
   (which may cache the old/new value regardless of actual DNS state).

## Payments (Stripe / Razorpay)

**Symptom:** webhook failing, wrong keys, or checkout broken after a config change.

1. If the webhook endpoint URL or secret was just changed and is now wrong: correct it
   directly in the Stripe/Razorpay dashboard — no app deploy needed.
2. If webhooks failed during an outage window, both providers retry automatically for
   a period, and both also support **manual redelivery** from their dashboard's webhook
   event log — use that to recover any events missed rather than trying to
   reconstruct credit grants by hand.
3. If the issue is in the webhook **handler code** itself (not configuration), this is
   a Vercel rollback (see above), not a payments-dashboard action.
4. PayPal requires no rollback action — it's intentionally disabled and has no live
   path to break.

## Full-stack rollback (multiple components implicated)

1. Roll back Vercel first (fastest, lowest-risk, most likely to resolve user-facing
   symptoms immediately).
2. Roll back Railway worker if worker-specific symptoms persist after the Vercel
   rollback.
3. Only touch DNS or Supabase if the above two don't resolve the issue and you've
   confirmed the problem is specifically domain routing or database state — these are
   the slowest and highest-risk rollback paths, so exhaust the faster options first.
4. Communicate status (even internally) at each stage — a partial rollback (e.g. Vercel
   rolled back but worker still on the new version) can itself cause confusing
   version-mismatch symptoms if the two were expected to ship together.

## Post-rollback

- [ ] Re-run the relevant section(s) of `LAUNCH_DAY_CHECKLIST.md`'s smoke test.
- [ ] Document what broke and why in a durable place (even a plain changelog) — there is
      no other record of manual dashboard changes (Supabase schema/RLS, DNS, provider
      webhook config) in this project today.
- [ ] Before re-attempting the change that caused the rollback, add whatever
      verification step would have caught it (e.g. test the schema change on a
      non-production Supabase project first).
