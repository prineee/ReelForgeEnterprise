# RC4 — MovieAssembler V2 LIVE Production Qualification Report

**Suite:** `worker/scripts/rc4-live-qualification.js`
**Run date:** 2026-08-02
**Scope:** Live calls to Pixabay, Pexels, Cloudinary, Supabase (per explicit approval). OpenAI/Gemini credentials are present but were not called (no API cost incurred, by choice). Railway, Vercel, Razorpay, PayPal, LTX, Resend have **no credentials configured in this environment** and were not testable regardless of scope.
**Result: 2/6 passed, 4 failed.**

---

## ⚠️ Headline finding: production Cloudinary uploads are currently blocked

Every real upload attempt in this run failed with the same Cloudinary API error:

```
cloud_name is disabled
```

This happened on **every one of 6 upload attempts across 2 independent calls** (3 retries each, per the existing backoff logic — 1s/2s/4s), with the identical error every time. This is not a code defect — `CLOUDINARY_CLOUD_NAME`/`CLOUDINARY_API_KEY`/`CLOUDINARY_API_SECRET` are all present and well-formed, `uploadMovie()`'s retry logic worked exactly as designed (3 attempts, clean failure, detailed error), and the earlier RC3 qualification already proved the upload *code path* is correct. `cloud_name is disabled` is Cloudinary's own account-status error — it means the Cloudinary account/cloud itself has been suspended, deactivated, or is blocked pending billing, independent of anything in this codebase. **No amount of code change fixes this** — it requires checking the Cloudinary dashboard/billing status directly. This is the top item in Recommendations.

Because uploads are blocked, **no video currently reaches Cloudinary, Supabase (via the real end-to-end movie flow), or the frontend in production right now** — this is a full pipeline outage, not a degradation.

**No test data was left behind**: since every real upload attempt failed, zero Cloudinary assets were created by this run — cleanup had nothing to destroy (confirmed empty).

---

## Pass/Fail detail

| # | Test | Result | Time | Notes |
|---|---|---|---|---|
| 1 | Pixabay: live search API | ❌ FAIL | 20.0s | `timeout of 20000ms exceeded` — see below |
| 2 | Pexels: live search API | ✅ PASS | 0.49s | Clean, fast, correct results |
| 3 | Supabase: live connectivity (0-row update) | ✅ PASS | 2.1s | Real auth + write round-trip; 0 rows affected by construction (random UUID matches no real project) |
| 4 | Full live pipeline (download→normalize→timeline→render→voice→validate→upload) | ❌ FAIL | 641.7s | **Download→Validation all succeeded on real data**; failed at the Cloudinary upload step — see headline finding |
| 5 | Uploaded video publicly reachable | ❌ FAIL | — | Blocked by #4 (nothing to fetch) |
| 6 | Live captions round-trip (`/api/burn-captions`) | ❌ FAIL | 4.5s | Blocked immediately — its own pre-caption upload hit the same `cloud_name is disabled` error |

---

## What actually worked, in detail

This is the important part the headline finding could obscure: **everything MovieAssemblerV2 is responsible for, up to the point Cloudinary rejected the account, worked correctly against real data**:

- Real scene keyword extraction and multi-keyword fallback ran exactly as designed.
- Real download eventually succeeded via **Pexels** (`ocean waves`, a 3.24MB, 16.0s clip) after Pixabay/earlier-keyword attempts were exhausted.
- Real normalization (`fps=25 [ffmpeg]`), real duration-timeline allocation, real loop-to-fit (16.0s clip looped 2x to reach the 30s target), real concat, real voice sync (correctly trimmed 30s video down to the 10s voice track length), real voice merge, and real `ffprobe` validation **all passed**: 720x1280, 25.00fps, h264, yuv420p, 10.000s duration exactly matching the (locally-synthesized, since no TTS credential is configured) voice track. Validation only stopped the pipeline going further because the upload it validates *for* then failed — validation itself did its job correctly.

This corroborates RC3's offline findings with real files and real timing, not just synthetic fixtures.

---

## Provider-by-provider results

**Pixabay** — **100% failure rate in this run**: every single real call (the isolated search test, and every retry inside the real download flow) timed out at 20000ms, including a stray `502` on one attempt. This is consistent enough across ~14 total attempts that it looks like a real Pixabay-side or network-path issue at the time of this run, not a fluke — but a single run can't distinguish "Pixabay is having an outage right now" from "this environment's network path to Pixabay is slow/blocked." Recommend re-running this specific check from the actual production deployment network before concluding Pixabay itself is unreliable.

**Pexels** — **Inconsistent under burst load**. The isolated, single, cold-start request passed instantly (489ms, clean 200). But the real download flow's rapid-fire retries (dozens of calls in quick succession, driven by Pixabay's timeouts forcing fallback) got repeated `401 Unauthorized` responses before one finally succeeded. A 401 from a *working* key under burst-request conditions strongly suggests **rate limiting** (some APIs return 401 rather than 429 when a short-window quota is hit), not a broken credential — the same key worked both before and after the burst. Recommend confirming Pexels' actual rate-limit tier for this API key.

**Cloudinary** — **Hard failure, account-level**: see headline finding above.

**Supabase** — **Pass**, clean real round-trip, no issues.

**OpenAI / Gemini** — not exercised (credentials present, skipped by choice — no cost incurred).

**Railway / Vercel / Razorpay / PayPal / LTX / Resend** — **no credentials configured in this environment**; genuinely untestable here regardless of scope chosen. Not attempted, not fabricated.

---

## API / render latency

| Metric | Value |
|---|---|
| Pexels search latency | 0.49s |
| Pixabay search latency | 20.0s (timeout — no successful call to time) |
| Supabase update round-trip | 2.1s |
| Cloudinary upload latency | N/A — every attempt failed before completing |
| Total wall-clock, full pipeline test | 641.7s (~10.7 min) |

The 10.7-minute pipeline duration is almost entirely Pixabay timeout overhead, not rendering work: each of the ~7 keyword/scene combinations attempted up to 3 retries, and each retry calls Pixabay twice (portrait, then any-orientation) before falling to Pexels — at 20s/call that alone accounts for the bulk of the runtime. The actual FFmpeg work (normalize + concat + voice sync/merge + validation) completed in well under a minute once a clip was finally in hand, consistent with RC3's offline timings for a similarly-sized job.

---

## Retry statistics

- **Cloudinary upload**: 3/3 attempts failed, both times it was attempted (6 total attempts) — 100% failure, non-transient (identical error every attempt), correctly *not* resolved by retrying, exactly as expected for an account-status error rather than a network blip.
- **Download (scene 1, "city skyline")**: exhausted all 4 fallback keywords × 3 retry attempts = 12 failed attempts, then correctly gave up on that scene without failing the whole job (matches existing, unmodified fallback design).
- **Download (scene 2, "ocean waves")**: succeeded on the final fallback keyword after earlier keywords/attempts failed — retry + keyword-fallback logic worked as designed.
- **Retry mechanism itself** (`withRetry`, backoff timing, exhaustion behavior): already exhaustively unit-verified in RC3; this run additionally confirms it behaves correctly under real, non-synthetic failure conditions.

---

## Known limitations

1. **This run cannot prove Cloudinary works** — it proves the opposite (currently blocked). A follow-up run after the account issue is resolved is required to actually validate live upload + public playback.
2. **Captions were not validated live** — blocked transitively by the same Cloudinary issue (the caption endpoint uploads twice internally). RC3 already confirmed the pipeline's *call* into `/api/burn-captions` behaves correctly when upload succeeds (mocked); this run could not add a live confirmation of that endpoint's own FFmpeg/ASS logic.
3. **No TTS credential configured** (`ELEVENLABS_API_KEY` not set) — the "Voice" stage was verified with a local synthetic tone, not live-generated narration.
4. **Frontend Playback was not exercised** — no live frontend URL or test record was designated for this run.
5. **OpenAI/Gemini/Railway/Vercel/Razorpay/PayPal/LTX/Resend** — not exercised, per the scope decisions above (cost avoidance and missing credentials respectively).
6. **Single run, single point in time** — the Pixabay timeout pattern and Pexels rate-limit pattern are each based on one run; treat as strong signal, not statistically certain, until repeated.

---

## Recommendations

1. **Urgent, before anything else**: check the Cloudinary account dashboard/billing status for the cloud name configured in this environment's `CLOUDINARY_CLOUD_NAME`. `cloud_name is disabled` blocks 100% of real movie delivery right now — this is the single highest-priority item from this report.
2. Once Cloudinary is restored, re-run `node scripts/rc4-live-qualification.js` to get a genuine live pass on upload, public reachability, and captions (it's safe to re-run — it cleans up everything it creates).
3. Investigate Pixabay reachability from the actual production network (not just this dev machine) — if it's consistently this slow/unreachable in production too, consider whether the existing per-call 20s timeout and Pixabay-first ordering are still the right tradeoff (a deliberate, separate decision — not made here, since this phase's instructions froze the architecture).
4. Check Pexels' rate-limit tier for the configured API key if burst-load 401s recur — the credential itself is confirmed valid.
5. Configure `ELEVENLABS_API_KEY` (or whichever TTS provider ReelForge uses in production) if live narration needs to be part of a future qualification pass.

---

## Verdict

**MovieAssemblerV2's own code is unaffected and remains frozen, as instructed** — no bugs were found in the rendering engine itself; every stage it owns (download-fallback, normalize, timeline, transitions/voice-merge machinery, validation, retry/backoff, cleanup) behaved correctly against real data in this run, consistent with RC3.

**The live production pipeline as a whole is currently NOT qualified** — it is blocked end-to-end by a Cloudinary account issue (`cloud_name is disabled`) that sits outside the codebase and requires direct account/billing attention before any real movie can be delivered to a real user. **Declaring MovieAssemblerV2 frozen for RC4** is appropriate on the code side; declaring the *live pipeline* production-ready is not possible until that account issue is resolved and this suite is re-run clean.
