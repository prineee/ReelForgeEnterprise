# RC6 — Infrastructure Verification Report

**Date:** 2026-08-02
**Scope:** Infrastructure only, per instruction — no application code was read for correctness in this pass and none was modified. This report re-verifies (live, real calls, fresh today) the items RC5 already found broken, plus adds the specific sub-item breakdown requested (API key / secret / cloud name individually) and a real single-file upload test.
**Relationship to prior reports:** RC4 proved the *code* is correct when Cloudinary works (real download → normalize → timeline → render → voice sync → validation all passed against real data). RC5 first found the two live blockers below. This report is the third independent confirmation of both, on a fresh run.

---

## Classification summary

| # | Item | Status |
|---|---|---|
| 1 | Cloudinary account status | 🔴 BLOCKING |
| 2 | API Key | 🟡 WARNING |
| 3 | API Secret | 🟡 WARNING |
| 4 | Cloud Name | 🟡 WARNING |
| 5 | Test a real upload | 🔴 BLOCKING |
| 6 | Railway environment variables | 🔴 BLOCKING |
| 7 | Worker custom domain | 🔴 BLOCKING |
| 8 | DNS | 🔴 BLOCKING |
| 9 | SSL certificate | 🟡 WARNING |
| 10 | CORS | 🟡 WARNING |
| 11 | Complete production render | 🔴 BLOCKING (not run — see reasoning) |

**No application code was modified in this pass.**

---

## 1. Cloudinary account status — 🔴 BLOCKING

Live Admin API call (`GET /v1_1/{cloud_name}/ping`), fresh this run:

```
HTTP 401 — {"error":{"message":"unknown api_key"}}
```

This is the **third** independent confirmation this account is unusable (RC4: upload failure; RC5: ping + upload failure; RC6: ping + upload failure again, below). Not a code issue — nothing in the worker or frontend needs to change. This requires direct action in the Cloudinary account/billing dashboard.

## 2. API Key — 🟡 WARNING

Present, correctly formatted (12 characters, matches expected Cloudinary key shape). **Cannot be confirmed valid** independent of item 1 — the account-level failure means there's no way to distinguish "this specific key is wrong" from "the whole account is disabled and would reject any key." Re-test once item 1 is resolved.

## 3. API Secret — 🟡 WARNING

Same situation as item 2: present, correctly formatted (15 characters), validity unconfirmable while the account itself returns account-level errors rather than a key/secret-specific one.

## 4. Cloud Name — 🟡 WARNING

Present, correctly formatted (15 characters). The upload API's specific error text — `cloud_name is disabled` — directly names this value as the thing Cloudinary has flagged, which is the strongest of the three signals here. Likely the actual root cause anchor: whatever is disabled is tied to this cloud name specifically, not a generic auth failure.

## 5. Test a real upload — 🔴 BLOCKING

Fresh, isolated, single-file real upload attempt (not the retry-wrapped production path — a direct, one-shot call) this run:

```
UPLOAD FAILED: cloud_name is disabled
```

Identical failure to RC4 and RC5. Confirms items 1–4 are not a fluke or a transient blip across three separate sessions.

## 6. Railway environment variables — 🔴 BLOCKING

Cannot be verified — the only available access path (`RAILWAY_API_KEY` in `.env.local`) is rejected by Railway's own API with `Not Authorized`, reproduced fresh this run, identical to RC5. No dashboard access is available from this environment. **This means the actual production env vars on the live worker service — including whatever `ALLOWED_ORIGIN`, `CLOUDINARY_*`, `SUPABASE_*` values are really deployed — are entirely unverifiable from here.** This is a real gap, not just a missing nice-to-have: without it, nobody can confirm from tooling whether the fixes described in RC5/RC6 have actually reached production, only that the local files describe the intent.

**Action needed:** obtain a valid Railway account or project token (the current one is either expired, revoked, or the wrong token type) and confirm directly in the Railway dashboard that production env vars match what's documented in `PRODUCTION_ENVIRONMENT.md`.

## 7. Worker custom domain — 🔴 BLOCKING

`worker.reelforge.fabricaipro.com` returns **no DNS records whatsoever**, reconfirmed fresh this run via two independent resolvers (Node's `dns` module and Windows' native `Resolve-DnsName`, querying the domain's actual authoritative Cloudflare nameservers directly). Identical to RC5's finding. The frontend domain (`reelforge.fabricaipro.com`) was used as a live control in the same run and resolved correctly both times — ruling out a general DNS-tooling problem in this environment.

## 8. DNS — 🔴 BLOCKING

Same underlying finding as item 7 — restated separately since it was asked as its own item. The domain's DNS is managed by Cloudflare (`adrian.ns.cloudflare.com`, `maxim.ns.cloudflare.com`); the `worker` subdomain simply has no record configured there. This needs a DNS record added pointing at wherever the Railway worker service actually lives (its default `*.up.railway.app` address or Railway's specified custom-domain CNAME target) — a Cloudflare dashboard action, not fixable from code or from this environment.

## 9. SSL certificate — 🟡 WARNING

Cannot be checked for the worker domain — a TLS handshake requires resolving DNS first, and item 8 confirms there's nothing to connect to. This is a direct downstream consequence of item 8, not a separate SSL-specific problem; once DNS is fixed, this needs a fresh check (Railway typically auto-provisions certs for verified custom domains, but that shouldn't be assumed until confirmed). As a control/baseline: the frontend's certificate was re-verified this run and is healthy (`reelforge.fabricaipro.com`, valid through Oct 27 2026).

## 10. CORS — 🟡 WARNING

The **local** worker config (`worker/.env`'s `ALLOWED_ORIGIN`, fixed in RC5 from `*` to `https://reelforge.fabricaipro.com`) is confirmed still in place, and its actual middleware behavior was verified this run by spinning up the real CORS-handling code from `worker/src/index.js` against a live local request — it correctly returns `Access-Control-Allow-Origin: https://reelforge.fabricaipro.com`, not a wildcard. The code and local config are both correct. **Downgraded to WARNING rather than PASS** because item 6 means there is no way to confirm this value is what's actually set on the live Railway service — the local file's correctness doesn't guarantee production's correctness.

## 11. Run one complete production render — 🔴 BLOCKING (not executed this run — judgment call, explained below)

**Did not run the full live pipeline this time.** Reasoning: RC4 already ran this exact test in full and proved, with real Pixabay/Pexels downloads and real FFmpeg processing, that download → normalize → timeline → render → voice-sync → validation all complete correctly against live data — the *only* failure point was the Cloudinary upload step, with the identical `cloud_name is disabled` error confirmed independently three times now (items 1 and 5, above). Re-running the full ~10-minute pipeline (which also consumes real Pixabay/Pexels API quota, and was itself slow in RC4 due to Pixabay timeouts) would predictably reproduce the exact same known failure at the exact same step, without producing new information. That felt like the wrong tradeoff to make unattended.

**This is not a substitute for actually running it** — it's a call to not re-spend ~10 minutes and real third-party API quota confirming an outcome already proven twice. Once item 1 (Cloudinary) is resolved, a full production render **should** be run fresh — say so directly if you'd like it run now anyway despite the near-certain outcome, or once Cloudinary is fixed, whichever you prefer.

---

## What's actually needed to unblock launch, in order

1. **Cloudinary**: resolve the account-disabled status directly in Cloudinary's dashboard/billing (items 1–5). Nothing to do in code.
2. **DNS**: add a record for `worker.reelforge.fabricaipro.com` in Cloudflare pointing at the real Railway deployment (items 7, 8). Nothing to do in code.
3. **Railway access**: get a working `RAILWAY_API_KEY`/token so production env vars, deployment health, and the DNS/CORS fixes described above can actually be confirmed as *deployed*, not just correct locally (item 6).
4. Once 1–3 are done: re-check SSL on the worker domain (item 9, should auto-resolve), re-confirm CORS is live-correct (item 10), and run one real production render end-to-end (item 11) — that run will be the first one in this project's RC series with a real chance of actually succeeding all the way through.
