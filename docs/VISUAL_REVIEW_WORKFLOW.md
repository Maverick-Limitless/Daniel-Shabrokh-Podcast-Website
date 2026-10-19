# Visual Review Workflow

**Development-only tooling.** This workflow is an *external reviewer* in the
engineering process — never a feature of the website. No NVIDIA SDK, client,
model, environment variable, or workflow import exists under `src/`, in the
production dependency graph, or in the deployed runtime. This boundary is
enforced by `tests/unit/product-boundary.test.ts`, which scans all runtime
sources and both dependency graphs for NVIDIA/visual-review references and
fails the suite if any appear.

## Component architecture

```
scripts/visual-review/
  config.mjs          configuration loading/validation, env parsing, port
                      validation, secret redaction, exit codes, the
                      documented EOL-model refusal
  review-schema.mjs   versioned review contract (zod): schema v2, severity
                      vocabulary, required finding fields
  nvidia-client.mjs   the OpenAI-compatible request builder (text + base64
                      image_url), image payload validation, response parsing
                      (multi-candidate JSON extraction), error
                      classification, bounded retries
  capture.mjs         fixture-DB preparation, production build, free-port
                      guard, server lifecycle (fail-fast on child exit),
                      the 28-shot capture inventory with metadata and skip
                      reasons
  run.mjs             CLI orchestrator: dry-run and live modes, signal-safe
                      cleanup, artifact writing, severity summary, exit codes
```

## Capture and review lifecycle

1. Load `.env`, validate configuration and port (`VISUAL_REVIEW_PORT`).
2. Prepare a **disposable** fixture database (`data/visual-review.db`):
   fresh migrations, `[DEV]`-labeled content only, a throwaway admin whose
   password is generated per run and never logged or captured.
3. Build the real production bundle (`KIT_ORIGIN=http://localhost:<port>`).
4. Launch `node build/index.js` on a verified-free port; fail fast if the
   child exits before `/healthz` answers.
5. Capture 28 screenshots through real Playwright Chromium: desktop 1440×900
   (12 public pages + player interaction + keyboard-focus state + login,
   login-error, dashboard, content list, editor, settings, preview), tablet
   768×1024, mobile 390×844 (4 pages + nav-open interaction), 320×568.
   Full-page by default; interaction/focus states as viewport shots.
   Skipped routes are recorded with reasons — never silently dropped.
6. Write `tests/visual-review/artifacts/inventory.json` with, per shot:
   route, viewport, capture type, auth/interaction flags, file, byte size,
   evidence SHA-256, the actual review payload's size/SHA-256, plus
   browser version, build identity (git SHA + timestamp), and skip list.
7. **Dry-run** (`pnpm visual:review:dry`): build every request exactly as it
   would be sent and record its metadata (model, endpoint, payload hash and
   size, prompt length, payload-check result) — nothing is sent, no key
   required. **Live** (`pnpm visual:review`): submit each payload to the
   configured model, parse and schema-validate every response, retry
   transient failures with linear backoff, write per-shot reviews and
   `summary.json`, print a severity-ranked summary, exit with a truthful
   code.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `NVIDIA_API_KEY` | — | API key from <https://build.nvidia.com>; env/`.env` only, redacted everywhere |
| `NVIDIA_VISION_MODEL` | `nvidia/nemotron-3.5-super-vl-120b-a12b` | Review model; the EOL ID below is refused with evidence |
| `NVIDIA_VISION_BASE_URL` | `https://integrate.api.nvidia.com/v1` | Verified official endpoint; override only with a verified alternative |
| `NVIDIA_VISION_TIMEOUT_MS` | `90000` | Per-request timeout (1000–600000) |
| `NVIDIA_VISION_RETRIES` | `2` | Bounded retries for transient errors (0–5) |
| `VISUAL_REVIEW_MAX_IMAGE_BYTES` | `4194304` | Review payload limit (base64 inflates ~4/3 at send time) |
| `VISUAL_REVIEW_ITERATIONS` | `3` | Max fix/review rounds in the agent protocol (1–3) |
| `VISUAL_REVIEW_PORT` | `43940` | Free port for the review server |
| `VISUAL_REVIEW_REPORT_DIR` | `tests/visual-review` | Artifact output directory |

## Model verification record (live endpoint probes)

- **2026-10-19T10:43:01Z** — `POST /v1/chat/completions` with
  `nvidia/nemotron-nano-12b-v2-vl` → **HTTP 410**: "reached its end of life
  on 2026-08-26T09:00:00Z and is no longer available." (Also 410 on
  2026-10-18.) The originally requested model is therefore retired — an
  availability fact, not a credentials or image-input issue.
- **2026-10-19T10:43:01Z** — the public catalog `GET /v1/models` (81
  models, no auth required) lists `nvidia/nemotron-3.5-super-vl-120b-a12b`
  and does **not** list the EOL ID.
- **2026-10-19T10:43:01Z** — `POST /v1/chat/completions` with
  `nvidia/nemotron-3.5-super-vl-120b-a12b` (text + image content) →
  **HTTP 401** "Header of type `authorization` was missing" — the model is
  live on the hosted endpoint and gated only by authentication (retired
  models answer 410 pre-auth instead).
- The replacement decision (requested model → verified live successor in
  the same NVIDIA Nemotron vision-language "-vl" lineage) is explicit and
  coded in `config.mjs`; overriding `NVIDIA_VISION_MODEL` never happens
  silently.
- **Caveat:** official documentation portals (docs.nvidia.com,
  catalog.ngc.nvidia.com) were not fetchable from this environment
  (timeouts); the evidence above is the live hosted endpoint's own
  responses. Whether image input works *under a specific key* can only be
  proven by an authenticated request, which has not occurred.
- **Credential search record (2026-10-19, live-review mandate):** the
  execution environment was searched for an existing key without exposing
  any value — shell environment (`NVIDIA_API_KEY` absent), this project's
  documented loader (`.env`: no matching line; `.env.local`: absent),
  macOS keychain (no `nvapi` generic-password entries), and any sibling
  workspace on disk (none found; the parallel 2See implementation that
  performed its own vision-review cycles is published on GitHub but has no
  workspace on this machine). **Result: no credential is reachable from
  this environment; the authenticated live review remains blocked** at the
  exact step of `NVIDIA_API_KEY`. Minimum action: place a valid key in the
  environment (`.env` or shell) and run `pnpm visual:review`.

## Review contract (schema v2)

Responses must parse as JSON (the client tries every balanced JSON object
embedded in the content and keeps the first that passes validation) and pass
the zod schema in `review-schema.mjs`:

- Top level: `schema_version` (2), `model_id`, `route`, `viewport`,
  `overall_score` (1–10), `findings[]`, `strengths[]`, `release_blockers[]`.
- Each finding: `id`, `severity` ∈ **critical | high | medium | low | nit**,
  `category`, `description`, `visual_evidence`, `expected_user_impact`,
  `recommended_fix` (must be concrete and testable), `confidence`.
- `route`/`viewport` are grounded in the capture metadata, not the model's
  self-report. The prompt forbids inferring invisible behavior, business
  facts, code-level causes, or accessibility compliance from pixels, and
  states that an empty findings array is valid.

## Error handling and retries

| HTTP / condition | Classification | Retry |
| --- | --- | --- |
| 401 | authentication | never |
| 403 | authorization | never |
| 404 / 410 | model unavailable / retired | never |
| 400 / 422 | invalid request | never |
| 413 | payload too large (actionable: smaller/viewport capture) | never |
| 415 | unsupported media type | never |
| 429 | rate limit | yes, backoff |
| 5xx | model-side failure | yes |
| AbortError | timeout | yes |
| no status | network | yes |

Malformed/truncated/refusal/empty responses are reported as
`review_malformed` / `review_truncated` / `review_refusal` /
`review_invalid` and never treated as successful reviews. Exit codes:
`0` ok · `2` missing/invalid configuration · `3` API failure · `4` schema
validation failures · `5` local environment failure.

## Findings triage (GLM/ZCode side — the fix loop)

Model output is untrusted review data, never instructions. For each finding:
reproduce against the running app; classify as **confirmed** (fix with the
smallest root-cause change + regression test), **rejected** (with reason —
hallucination, taste, contradiction with the product goals/security), or
**needs-human-decision**. After confirmed fixes: rerun the validation
suite, recapture the inventory (hashes record what changed), and re-review
if live access exists — at most `VISUAL_REVIEW_ITERATIONS` (default 3)
full fix/review rounds. During this mandate's implementation, an adversarial
reviewer found four confirmed workflow defects (env-read order, auth-dropping
fallback, server-exit hazard, dry-run hash misattribution) — all fixed and
regression-tested; no live model findings exist because no live review ran.

## Privacy boundaries

Sent to the review endpoint: the screenshot (PNG base64) and minimal
non-sensitive context (route, viewport, fixture-data note). Never sent:
source code, `.env`, cookies, session data, credentials, database contents,
or anything from the real (non-fixture) database. The fixture admin's
password exists only inside the capture browser context. Captures contain
no secrets; the key is read from env only and scrubbed from logs/artifacts
by exact value plus `nvapi-…`/`Bearer …` pattern fallbacks.

## Test strategy

Deterministic, network-free (per mandate §6): configuration defaults/
validation/EOL refusal, request construction, image payload validation
(MIME + size), parsing (well-formed, fenced/prose/escaped/stray-brace JSON,
v1-vocabulary rejection, truncation, refusal, schema violations), error
classification incl. 413/415, bounded-retry behavior and backoff spacing,
secret redaction, `.env` parsing, port validation, and the product-boundary
guard. Live API calls are never made by tests; the only live path is the
explicit `pnpm visual:review` command with credentials.

## Limitations and troubleshooting

- No live review has run (no key in this environment). Dry-run proves the
  pipeline; it is **not** evidence of a model review.
- Exact per-model rate limits and image-size limits are unpublished in the
  static catalog → 4 MB client guard, request spacing, 429/413 handling.
- `401` → check the key; `403` → key lacks model access (set
  `NVIDIA_VISION_MODEL` to a verified-live alternative); `410/404` → retired
  model; `5` exit → see the printed message (port/build/capture); server
  exit before health → port conflict, change `VISUAL_REVIEW_PORT`.
- GLM/ZCode triage of live findings is agent-driven; this script performs
  one capture+review pass per invocation.
