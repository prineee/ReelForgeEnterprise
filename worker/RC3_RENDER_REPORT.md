# RC3 — MovieAssembler V2 Production Qualification Report

**Suite:** `worker/scripts/rc3-qualification.js`
**Run date:** 2026-08-02
**Result:** 30/30 tests passed (0 failed) on the second run — see "Bug found during qualification" below for what the first run caught.
**Environment:** Windows dev machine, bundled `@ffmpeg-installer/ffmpeg` (build N-92722, 2018).

---

## 1. How this suite works

It drives `MovieAssemblerV2.assembleMovie()` and its internal building blocks directly, using **real FFmpeg** against **locally generated synthetic clips** (via `testsrc`/`sine` lavfi sources). The network boundary — Cloudinary uploads and the `/api/burn-captions` HTTP call — is mocked at the shared `cloudinary` / `axios` module singletons, which every caller (including `movieAssemblerV2.js` and `reelRoutes.js`) reads from live at call time, so the mock is transparent to the production code paths without editing them.

**Why the network boundary is mocked, not live:** the task list calls for renders across 1–30 scenes × four movie lengths × voice/caption/transition variants — around 30 renders, plus 17 more for the concurrency block. Running that against real Pexels/Pixabay/Cloudinary accounts would burn meaningful API quota (Pexels/Pixabay rate limits are typically in the low hundreds/hour) and write ~40 junk videos into the production `reelforge/movies` Cloudinary folder. That's a cost/pollution tradeoff worth a deliberate decision, not a default for an automated suite — see **Recommendations**.

What **is** exercised for real: clip normalization, duration allocation (loop/trim), concat, fade/crossfade transitions, voice sync (extend/trim), `ffprobe`-based validation, retry/backoff logic, the FFmpeg process timeout, cleanup, and concurrency — i.e. everything Steps 1–4 actually built.

---

## 2. Pass/Fail — full matrix

| Category | Test | Result | Time |
|---|---|---|---|
| scene-count | 1 scene | ✅ PASS | 4.2s |
| scene-count | 2 scenes | ✅ PASS | 4.4s |
| scene-count | 5 scenes | ✅ PASS | 5.0s |
| scene-count | 10 scenes | ✅ PASS | 5.8s |
| scene-count | 20 scenes | ✅ PASS | 7.6s |
| scene-count | 30 scenes | ✅ PASS | 9.3s |
| duration | 60-second movie | ✅ PASS | 5.2s |
| duration | 3-minute movie | ✅ PASS | 13.9s |
| duration | 5-minute movie | ✅ PASS | 22.5s |
| duration | 10-minute movie | ✅ PASS | 46.1s |
| voice | with voice | ✅ PASS | 7.2s |
| voice | without voice | ✅ PASS | 5.3s |
| captions | captions on | ✅ PASS | 5.4s |
| captions | captions off | ✅ PASS | 5.6s |
| transition | none | ✅ PASS | 3.5s |
| transition | fade | ✅ PASS | 5.8s |
| transition | crossfade *(auto-fallback, see below)* | ✅ PASS | 4.9s |
| deep-dive | independently-probed golden path (5 scenes, voice, fade) | ✅ PASS | 10.7s |
| memory | 5x sequential render heap trend | ✅ PASS | 16.8s |
| timeout | FFmpeg process timeout kills a hung/slow render | ✅ PASS | 1.0s |
| retry | withRetry succeeds after transient failures | ✅ PASS | 36ms |
| retry | withRetry exhausts and throws after 3 attempts | ✅ PASS | 31ms |
| retry | Cloudinary upload retries through transient failures | ✅ PASS | 3.0s |
| concurrency | 2 simultaneous renders | ✅ PASS | 4.6s |
| concurrency | 5 simultaneous renders | ✅ PASS | 8.8s |
| concurrency | 10 simultaneous renders | ✅ PASS | 16.7s |
| regression | route table unchanged (8 routes, same paths/methods) | ✅ PASS | 0.2s |
| regression | live HTTP: `/api/generate-pexels-scenes` validates `scenes[]` identically | ✅ PASS | 0.1s |
| regression | live HTTP: `GET /api/queue/status` responds 200 | ✅ PASS | 0.7s |
| perf | largest temp dir — 30 scenes, no cleanup | ✅ PASS | 10.1s |

Every render in the matrix independently satisfies (via `validateFinalMovie()`, which runs before any upload): 720×1280 resolution, 25fps, H264, yuv420p, duration within ±0.5s of the expected target, non-empty output file. The **deep-dive** test additionally re-probes an independently-copied file *after* `assembleMovie()`'s own cleanup ran, confirming the result isn't just "the code didn't throw" — a second, external `ffprobe` pass on the surviving artifact matches: 720x1280, 25fps, h264, yuv420p, 12.0s duration (matching the voice track), 761,538 bytes.

---

## 3. Bug found during qualification (and fixed)

**Concurrency test at n=10 failed on the first run**: `duplicate videoUrl returned across concurrent renders`. Root-caused to the **test harness's mock**, not the product: the mock built its fake URL from `path.basename(filePath)`, which is always `"movie.mp4"` — identical across every concurrent job — instead of the caller-supplied `public_id` (which the real `uploadMovie()` already builds as `movie_${movieId}_final_${Date.now()}`, unique per job). Fixed the mock to use `opts.public_id`; re-ran clean, 10/10 unique URLs, 10/10 unique job directories, none left on disk. **No product code changed for this fix** — it was a test artifact, and it's flagged here rather than silently dropped so the false-negative doesn't get lost.

**Separate, real hardening fix made during this phase** (not a test bug — a genuine gap `runFFmpeg` had no timeout at all): a hung/stuck FFmpeg process would previously block a render forever. Added a wall-clock timeout (default 5 min, `V2_FFMPEG_TIMEOUT_MS` env override) that kills the process and rejects with a clear error; verified for real by giving it a 50ms budget against an 8s encode and confirming it's killed and reports "timed out." Also added an explicit `timeout: 120000` (env-overridable via `V2_CLOUDINARY_TIMEOUT_MS`) to the Cloudinary upload call, which previously relied on the SDK's implicit default.

---

## 4. Memory leak detection

5 sequential renders, heap sampled before/after each (`--expose-gc` was not available in this run, so these are raw `heapUsed` samples, not post-GC readings — noisier, but still directionally meaningful):

| Iteration | Heap before | Heap after |
|---|---|---|
| 0 | 16.9 MB | 16.3 MB |
| 1 | 16.3 MB | 16.5 MB |
| 2 | 16.5 MB | 16.6 MB |
| 3 | 16.6 MB | 16.9 MB |
| 4 | 16.9 MB | 17.1 MB |

Growth across 5 runs: **+0.75 MB** — flat, no leak signature. Every job directory was confirmed removed (`fs.existsSync(jobDir) === false`) immediately after each render; the suite fails loudly if any survive.

---

## 5. Timeout & retry testing

- **FFmpeg timeout**: real — verified above.
- **Download timeout**: `pexels.js`'s `downloadOneClip()` already had timeouts on all its `axios` calls (20s for search, 120s for the download stream) prior to this phase — confirmed present in source, not newly added.
- **Cloudinary timeout**: now explicitly configured (was previously implicit/SDK-default); verified the option is present and passed on every call. Actual behavior against a slow/unresponsive *real* Cloudinary endpoint was not exercised — that requires live network conditions this offline suite deliberately avoids.
- **Network retry**: `withRetry()` (3 attempts, 1s/2s/4s backoff) verified in isolation — succeeds on the 3rd attempt, exhausts and throws cleanly after 3 — and end-to-end through a real `uploadMovie()` call that fails twice before succeeding.
- FFmpeg rendering itself is, as specified, **never retried** — confirmed by code inspection (`runFFmpeg` has no retry wrapper anywhere it's called).

---

## 6. Concurrency

2 / 5 / 10 simultaneous `assembleMovie()` calls, each producing distinct `jobDir`s (UUID-suffixed under `os.tmpdir()`), distinct `videoUrl`s, and each cleaning up its own directory with no cross-job interference. No shared mutable state was found to race on (each call's temp paths are fully job-scoped). 10-way concurrency completed in 16.7s — sub-linear vs. 5-way's 8.8s, consistent with I/O-bound work overlapping under the OS scheduler rather than pure CPU contention on this test machine.

---

## 7. Regression

- Route table: still exactly the 8 original routes, same methods/paths, confirmed via actual `router.stack` inspection (not a diff of source).
- Live HTTP smoke test against a real (ephemeral-port) instance of `reelRoutes.js`: `POST /api/generate-pexels-scenes` with an empty body still returns the same `scenes[] required` SSE error frame; `GET /api/queue/status` still responds 200.
- No route, schema, Cloudinary-config, Supabase, queue, auth, credits, affiliate, or admin files were touched in this phase or the three prior V2 phases (Steps 1–2 touched `reelRoutes.js` once, by design, to wire in the assembler — nothing since).

---

## 8. Performance report

*(Renders 12–46s toward the top end are the 3/5/10-minute duration-sweep cases, which loop short synthetic fixture clips dozens of times to reach target length — that's expected work, not overhead. Upload numbers reflect the ~15–30ms mock latency, not real Cloudinary network time.)*

| Metric | Value |
|---|---|
| Average render (total) time, all 18 timed renders | 9.6s |
| — scene-count sweep only (1→30 scenes, fixed 60s) | 4.1s → 9.3s |
| — duration sweep only (fixed 4 scenes, 60s→10min) | 5.2s → 46.1s |
| Average normalize-stage time | 9.1s (dominated by the 10-min case; median is much lower — see per-test table) |
| Average upload time (mocked) | 25ms |
| Peak heap used | 17.7 MB |
| Peak RSS | 69.4 MB |
| Largest temp directory (30 scenes, mid-render, pre-cleanup) | 6.24 MB |
| Total files uploaded across the whole suite (mocked) | 41, 119.2 MB combined |

---

## 9. Known limits

1. **Crossfade requires FFmpeg ≥ 4.3.** The project's bundled `@ffmpeg-installer/ffmpeg` (2018 build) has no `xfade` filter. `concatWithCrossfade()` detects this at runtime and **automatically falls back to the fade-transition path**, verified working — but true overlapping crossfades will only render on a newer FFmpeg binary (e.g. a current system/apt-get FFmpeg in a Linux production container). Recommend confirming the production deployment's actual resolved `FFMPEG_BIN` version.
2. **This qualification run used mocked network I/O**, by design (see §1). It proves the rendering engine, transitions, voice sync, validation, retry/backoff logic, and cleanup are correct against real files and real FFmpeg. It does **not** prove real-world Pexels/Pixabay availability, real Cloudinary upload throughput/timeout behavior under production network conditions, or the caption-burn endpoint's actual FFmpeg/ASS logic (that endpoint was not modified and was out of scope for all four phases, so it's untouched — but also therefore unexercised by this suite).
3. **Heap samples were not post-GC** (`--expose-gc` unavailable here); the +0.75MB/5-runs figure is a reasonable signal but a `--expose-gc` run would be cleaner evidence for a true leak audit.
4. **Windows dev environment**, not the production container. Path handling, binary resolution, and timing will differ somewhat on the actual Linux deployment target.

---

## 10. Recommendations

- Run one **live-credentials qualification pass** (real Pexels/Pixabay + real Cloudinary, small matrix — e.g. 1 scene count, 1 duration, voice on, captions on, each transition) deliberately, when convenient, to validate the parts this offline suite couldn't: real download latency/availability, real upload timeout behavior, and the untouched caption-burn endpoint end-to-end. This should be a conscious, scoped action given the API-quota/storage-pollution tradeoff noted in §1 — not something to fold into routine CI.
- If crossfade quality matters for production, confirm (or upgrade) the FFmpeg binary actually resolved in the deployed environment; otherwise fade-fallback is the honest expectation to set.
- Consider wiring `scripts/rc3-qualification.js` into CI (offline mode, as run here) as a regression gate for future changes to `movieAssemblerV2.js` — it's fast (~4 minutes) and touches every code path except the live network edge.

---

## Verdict

**MovieAssembler V2 is production qualified**, with the scope and caveats above: the rendering pipeline itself — normalization, timeline/duration allocation, transitions (with a verified, correct crossfade→fade fallback), voice sync, validation, retry/backoff, timeouts, cleanup, and concurrency safety — passed 30/30 real tests against real FFmpeg, including one genuine bug fix made during this phase (FFmpeg timeout, previously absent) and one test-harness bug caught and corrected (not a product defect). The one gap is the live external-API path (real Pexels/Pixabay/Cloudinary under real network conditions), which was deliberately not exercised here and is recommended as a separate, deliberate follow-up rather than assumed passing.
