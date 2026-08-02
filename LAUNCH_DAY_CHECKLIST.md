# Launch Day Checklist — ReelForge Enterprise

Use this the day you flip the switch to real users. Assumes every item in
`PRODUCTION_DEPLOYMENT_PLAN.md` (Steps 1–8) is already complete. This is the Step 9
"Final Validation" expanded into an executable runbook.

---

## T-minus (before announcing/opening access)

- [ ] `PRODUCTION_DEPLOYMENT_PLAN.md` Steps 1–8 all checked off, including every item
      under Step 4's manual-action lists.
- [ ] `npm run build` and `npx tsc --noEmit` both clean on the exact commit being
      deployed (not just "recently" — re-run right before, see Step 6 below).
- [ ] Confirm the deployed branch matches what was validated (`feature/ltx-video-provider`
      or its merge into `main` — not an untested branch).
- [ ] Confirm `AI_MODE` is absent from the Vercel production environment (re-check the
      actual dashboard list, not memory).
- [ ] Confirm `VIDEO_PROVIDER` is not `local` in production.
- [ ] Decide and document sign-off on the two known structural gaps from
      `RELEASE_VALIDATION_REPORT.md`:
  - [ ] Movie Studio credit-ledger disconnect — accepted as tracked known-issue, or
        launch is blocked on it.
  - [ ] Movie Creation silent-hang-on-failure (5 of 6 pipeline stages) — accepted as
        tracked known-issue, or launch is blocked on it.
- [ ] Whoever owns support/on-call is briefed: no APM exists, "stuck in progress" is a
      known-possible symptom (not necessarily a slow job), and where to look
      (`OPERATIONS_RUNBOOK.md`).

## Go-live sequence

1. [ ] Final Vercel production deploy of the exact validated commit.
2. [ ] Final Railway worker deploy of the exact validated commit.
3. [ ] Confirm DNS is fully propagated for both the app domain and worker domain
       (`dig`/`nslookup` or an online propagation checker — don't rely on your own
       browser cache).
4. [ ] Confirm SSL is active (HTTPS, valid certificate) on both domains.

## Smoke test (run against the live production domain, in order)

1. [ ] Register a new account → confirmation email arrives → link redirects to
       production domain → onboarding → dashboard loads with sidebar.
2. [ ] Log in with an existing/second account.
3. [ ] Password reset flow completes end-to-end.
4. [ ] (If enabled) Google login completes end-to-end.
5. [ ] Create Reel: submit a generation, confirm it completes and **credits visibly
       decrement** (`users.credits`, a real direct-route deduction).
6. [ ] Movie Studio → Workspace → Render Center loads ("No render jobs yet" on a fresh
       environment is correct).
7. [ ] Submit one real Movie Studio generation end-to-end; watch it through to
       completion or a clearly-surfaced error (do not accept "stuck at the same %
       for a long time" as success — see known gap above).
8. [ ] Billing page: Stripe checkout button renders and a real (or provider test-mode)
       transaction completes, credits increment, webhook shows 200 in the Stripe
       dashboard.
9. [ ] Billing page: same for Razorpay.
10. [ ] Billing page: PayPal shows the "temporarily unavailable" notice, not a live
        button — confirms it wasn't accidentally re-enabled.
11. [ ] Affiliate: join as an affiliate, generate a link, confirm the dashboard and
        payout-history views load with real (possibly empty) data, not an error.
12. [ ] Admin: log in as a non-admin account, confirm `/admin/**` API calls reject
        (403), even though the page shell may render before failing.
13. [ ] Admin: log in as the intended admin account, confirm the dashboard shows real
        stat cards, not zeros/placeholders.
14. [ ] Trigger one intentional bad request to an API route (e.g. malformed JSON body)
        and confirm a friendly JSON error, not a raw stack trace or blank screen.
15. [ ] Worker: `GET https://<worker-domain>/health` returns `status: ok`; note the
        `wav2lip_ready` and `stock_video` field values for your records.
16. [ ] If `REDIS_URL` is configured: `GET https://<worker-domain>/api/queue/status`
        responds successfully.

## First-hour monitoring

- [ ] Watch Vercel function logs continuously for the first hour for repeated 500s.
- [ ] Watch Railway worker logs continuously for the first hour for `[express]` errors
      or `[queue]` warnings.
- [ ] Watch Stripe/Razorpay dashboards for any webhook delivery failures.
- [ ] Watch Render Center (as an operator) for any job stuck at an unchanging progress
      percentage for an extended period — the known silent-hang symptom.
- [ ] Spot-check Supabase dashboard for unexpected connection/error spikes.

## Go / no-go criteria

**Go** if: all T-minus items are checked, the full smoke test passes end-to-end with no
step producing an unexpected error, and both known structural gaps have an explicit
sign-off (accepted or blocking) rather than being silently ignored.

**No-go** if: any smoke-test step fails unexpectedly (not a pre-accepted known gap), a
webhook shows failed delivery, or build/typecheck were not re-verified clean on the
exact deployed commit.

If no-go: follow `ROLLBACK_PLAN.md` for whichever component failed before making any
further changes.

## Post-launch (first 24–48 hours)

- [ ] Continue elevated manual log-watching per `OPERATIONS_RUNBOOK.md`'s Daily
      Monitoring section until real monitoring/APM is in place.
- [ ] Collect and triage any user reports of "stuck" generations against the known
      silent-hang gap — don't assume each report is a new bug without checking first.
- [ ] Reconcile at least one full day of payment webhook deliveries against granted
      credits in Supabase, to confirm the live-mode webhook path is fully trustworthy
      before scaling traffic.
