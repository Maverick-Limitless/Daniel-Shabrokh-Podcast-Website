# DSMP — Daniel Shabrokh Media Platform

A premium, independent editorial, video, and audio publishing platform built as
a **proposal**: a public site (Watch / Listen / Insights / About / Search) with
a secure single-administrator CMS and a full draft → preview → publish workflow.

> **Status and independence.** This is an independent proposal, not Daniel
> Shabrokh's official website. It has no affiliation with, endorsement from,
> or authorization by Daniel Shabrokh or the 2See podcast, and all seeded
> content is clearly labeled `[DEV]` placeholder material awaiting
> owner-verified replacement. Nothing has been deployed publicly. See
> [docs/RELEASE_STATUS.md](docs/RELEASE_STATUS.md) for the current release
> gates and [docs/PROJECT_BRIEF_AND_HISTORY.md](docs/PROJECT_BRIEF_AND_HISTORY.md)
> for the full project brief and Git-backed history.

## Features (implemented and verified by tests)

**Public site** — home with hero and three content sections; Watch archive +
video detail (YouTube privacy-enhanced embeds behind click-to-load facades so
no third-party JS loads until the visitor plays); Listen archive + episode
detail with a single shared audio player that persists across client-side
navigation; Insights archive + article pages with sanitized Markdown, table
of contents, and reading time; About (deliberate "pending verification"
states — no invented biography); Search across published content only
(drafts are never visible); Privacy; deliberate 404/error/empty states;
sitemap.xml and robots.txt generated from published content; canonical +
Open Graph metadata.

**Admin CMS** (`/admin`) — dashboard with real database counts; per-type
lists with search/filter; create/edit/save-draft/preview/publish/unpublish/
archive/restore/delete (deletion requires a no-JS confirmation step);
server-side validation with duplicate-slug rejection; draft preview route
that never exposes content publicly; audit log of administrative events.

**Security** — argon2id password hashing; opaque session tokens stored only
as SHA-256 hashes; HttpOnly/SameSite=Lax/Secure-on-HTTPS cookies with
sliding 12-hour expiry and a 7-day cap; login rate limiting; generic errors
with timing equalization; forced first-password change; password changes
invalidate other sessions; CSRF origin checking; strict CSP (`default-src
'self'`, hashed bootstrap scripts, no inline handlers); security headers;
noindex/no-store on admin and preview; parameterized queries only; Markdown
sanitized server-side (unit- and E2E-proven against XSS payloads).

**Deliberately not built** (out of scope by mandate): public user
registration, multi-role permissions, comments/social features, payments,
custom video hosting, analytics, email flows.

## Stack

- [SvelteKit 3](https://svelte.dev/docs/kit) + Svelte 5 (runes) + TypeScript
- [Prisma 7](https://www.prisma.io) + SQLite (better-sqlite3 adapter) for single-instance deployments
- [@node-rs/argon2](https://github.com/napi-rs/node-rs/tree/main/crates/argon2) for password hashing
- Vitest (unit) + Playwright (E2E) + axe-core (accessibility)
- Self-hosted variable fonts (Fraunces, Newsreader, Inter) — no third-party font CDN
- Dependency hygiene: `pnpm.overrides` pins `lodash ≥ 4.18` — the only audit
  findings (1 high, 2 moderate) were lodash 4.17.21 reached exclusively through
  Prisma Studio's bundled UI tooling; `pnpm audit` reports zero known
  vulnerabilities.

## Requirements

Node.js ≥ 20 (developed on 26), pnpm ≥ 9, SQLite 3.

## Quick start (development)

```sh
pnpm install
cp .env.example .env          # then edit DATABASE_URL (see below)
pnpm exec prisma migrate dev  # create/apply the schema
pnpm admin:create -- --username <your-name>   # prints a one-time temporary password
pnpm dev                      # http://localhost:5173
```

Sign in at `/admin/login`; you are forced to set a permanent password before
anything else. To exercise the UI with labeled placeholder content:

```sh
pnpm db:seed-dev   # [DEV]-labeled fixtures; refuses to run with NODE_ENV=production
```

## Environment variables

Safe placeholders live in `.env.example` — copy it to `.env`. Key variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | SQLite URL. **Use an absolute path** (`file:/srv/dsh/app.db`): the Prisma CLI and the runtime resolve relative paths differently. |
| `SITE_BASE_URL` | Canonical public origin for canonical/OG/robots/sitemap; empty falls back to the request origin. |
| `KIT_ORIGIN` | Build-time origin baked into a production build for direct-to-Node deployments; leave unset behind a proxy (which should send `PROTOCOL_HEADER`/`HOST_HEADER`). |
| `NVIDIA_API_KEY` / `NVIDIA_VISION_MODEL` / `NVIDIA_VISION_BASE_URL` | **Development-only** visual-review workflow (see below); never used by the website runtime. |

No session secret exists: sessions are opaque random tokens stored hashed.
Missing required configuration fails at startup with a clear error.

## Administrator provisioning and recovery

```sh
pnpm admin:create -- --username <name>          # initial creation (idempotent)
pnpm admin:create -- --username <name> --reset  # recovery — SERVER SHELL ONLY
```

The temporary password is printed once, never stored or logged, and forces a
password change at first sign-in. Recovery is deliberately a server-side
procedure: there is no public "forgot password" endpoint and no fake email
flow. Changing the password invalidates every other session.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build (`KIT_ORIGIN=… pnpm build` for direct-to-Node) |
| `pnpm start` | Run the built server (`node build/index.js`) |
| `pnpm check` | svelte-check type checking |
| `pnpm test` | Unit tests (81 passed as of 2026-10-19) |
| `pnpm test:e2e` | Playwright E2E against a fresh production build (38 passed as of 2026-10-19) |
| `pnpm admin:create` / `pnpm db:seed-dev` / `pnpm db:migrate` / `pnpm db:deploy` | Admin provisioning, `[DEV]` seeding, migrations |
| `pnpm visual:review` / `pnpm visual:review:dry` | **Development-only** NVIDIA visual-review workflow (below) |

`GET /healthz` answers `200 {"ok":true}` after a real database query — for
uptime monitors and post-deploy smoke checks.

## Production build & run

```sh
KIT_ORIGIN=https://your.domain pnpm build   # or omit when behind a proxy
pnpm exec prisma migrate deploy             # apply migrations first
DATABASE_URL=file:/srv/dsh/app.db NODE_ENV=production PORT=3000 node build/index.js
```

Reverse-proxy checklist: terminate TLS; add HSTS at the proxy (the app
intentionally does not send it); forward `x-forwarded-proto`/`x-forwarded-host`
and run with `PROTOCOL_HEADER`/`HOST_HEADER`. CSRF: cross-origin form POSTs
are rejected by SvelteKit's origin check; session cookies are `HttpOnly`,
`SameSite=Lax`, `Secure` on HTTPS. CSP: `default-src 'self'` with hashed
bootstrap scripts; YouTube is only a frame source, behind click-to-load.

Backup/restore (single SQLite file):

```sh
sqlite3 /srv/dsh/app.db ".backup '/srv/backups/dsh-$(date +%F).db'"
# restore: stop the app, replace the db file with the backup, start the app
```

Updating: `git pull && pnpm install && pnpm exec prisma migrate deploy && pnpm build`
and restart the process. **No production deployment has been performed.**

## Performance (laboratory measurements)

`node scripts/measure-web-vitals.mjs` (after building with
`KIT_ORIGIN=http://localhost:43933 pnpm build`) measures LCP/CLS/interaction
latency in a real Chromium window, three runs per page. Lab record:
LCP 148–2124ms (one 3008ms outlier), CLS 0.000–0.004 on every run,
interactions 16–136ms. These are localhost laboratory numbers, **not**
field data; field INP is not measured. Headless Chromium on this host
inconsistently suppresses LCP entry delivery, so the script runs headed.

## Architecture

```
prisma/schema.prisma        data model (Administrator, Session, Article, Video, AudioEpisode, AdminEvent)
src/routes/                 public pages, /admin (CMS), /preview (draft preview), /healthz
src/lib/server/             auth, guard, cms services, content queries, validation, Markdown sanitizer, audit
src/lib/components/         header, footer, cards, YouTube facade, shared audio player
src/lib/styles/             design tokens (WCAG-verified contrast) + global styles
scripts/                    create-admin, seed fixtures, E2E prep, audio-fixture generator,
                            measure-web-vitals, visual-review/ (development-only NVIDIA QA workflow)
tests/                      unit (vitest), e2e (Playwright), screenshots, visual-review artifacts
docs/                       project brief & history, visual-review workflow, release status
```

## Visual QA workflow — development-only, strictly separated from the product

The NVIDIA vision-language review is an **external development-time
reviewer**. It is not part of the website: no NVIDIA SDK, client, environment
variable, or workflow code exists anywhere under `src/`, the production
dependency graph, or the deployed runtime — enforced by a dedicated guard
test (`tests/unit/product-boundary.test.ts`). Full details:
[docs/VISUAL_REVIEW_WORKFLOW.md](docs/VISUAL_REVIEW_WORKFLOW.md).

- **Model status (verified 2026-10-19 against the live hosted API):** the
  originally requested `nvidia/nemotron-nano-12b-v2-vl` is end-of-life
  (HTTP 410, retired 2026-08-26) and is explicitly refused by the workflow.
  The default is **`nvidia/nemotron-3.5-super-vl-120b-a12b`**, verified live
  in the public catalog (available models return 401 without credentials;
  retired ones return 410). Override with `NVIDIA_VISION_MODEL`.
- **Commands:** `pnpm visual:review` (capture + live review; requires
  `NVIDIA_API_KEY`) · `pnpm visual:review:dry` (capture + build every
  request, send nothing — no key required).
- **What it does:** fresh `[DEV]` fixture database → production build →
  server on a verified-free port → 28 real browser captures (desktop 1440,
  tablet 768, mobile 390, 320; full-page + interaction/focus/error states)
  → schema-validated structured reviews → severity summary → artifacts.
- **Artifacts:** `tests/visual-review/captures/` (28 PNGs),
  `tests/visual-review/artifacts/inventory.json` (routes, viewports, sizes,
  SHA-256s, browser and build identity, skip reasons) and
  `dry-run-summary.json`. Per-shot review files and `summary.json` are
  written only by a live run. The fixture database
  (`data/visual-review.db`) is disposable and gitignored.
- **Credentials:** read only from the environment, redacted from all logs
  and artifacts (pattern-based scrubbing), never sent to the browser or
  committed.
- **Exit codes:** `0` review completed · `2` missing/invalid
  configuration · `3` API failure (auth/rate/model/network) · `4` responses
  failed schema validation · `5` local environment failure (port, build,
  capture).
- **Troubleshooting:** `401` invalid/missing key · `403` key lacks access ·
  `429` rate limited (backoff + bounded retries) · `410/404` model
  retired/unknown · `400/413` image size or encoding (captures over the
  limit fall back to viewport-only variants) · timeouts/5xx retried.
  Per-model rate limits are not published in the static catalog.
- **Live status:** the authenticated live review has **not been executed**
  — no `NVIDIA_API_KEY` is configured in this environment. The request/
  response contract is unit-tested with deterministic fixtures, and the dry
  run exercises the entire pipeline for real. Minimum step for a live
  review: export a valid key and run `pnpm visual:review`.

## Content policy and media provenance

The About page intentionally shows "pending verification" states: no
biography, credentials, portrait, or official links are published until the
owner supplies verified material. Seeded content is `[DEV]`-labeled — the
video fixture is Big Buck Bunny (CC BY, Blender Foundation), the audio
fixture is a generated 30-second tone, and the seeder refuses to run in
production. Video is embedded only via YouTube's official privacy-enhanced
player; nothing is scraped or re-hosted. Real biography, official links,
episode data, and publication authorization all require owner
confirmation — see
[docs/PROJECT_BRIEF_AND_HISTORY.md](docs/PROJECT_BRIEF_AND_HISTORY.md).

## Known limitations

- No independent visual review yet (NVIDIA credentials absent; screenshots
  are archived for human review at `tests/visual-review/captures/` and
  `tests/screenshots/`). Automated substitutes that do run: WCAG contrast
  tests on design tokens, overflow matrix (320–1440px), axe scans (zero
  serious/critical), geometric layout-integrity checks.
- Search is case-insensitive for ASCII only (SQLite `LIKE`).
- YouTube availability (deleted/private videos) is not pre-checked; the
  facade covers missing thumbnails and the iframe surfaces YouTube's notice.
- No email delivery, no public user accounts, single administrator by design.
- No `og:image` until an approved brand asset exists.
- Sitemap/robots use `SITE_BASE_URL` when set, else the request origin.
- Official NVIDIA doc portals (docs.nvidia.com, catalog.ngc.nvidia.com)
  were not fetchable from this environment; model verification rests on
  the live hosted endpoint's own responses (catalog list + pre-auth status
  codes), recorded with timestamps in
  [docs/VISUAL_REVIEW_WORKFLOW.md](docs/VISUAL_REVIEW_WORKFLOW.md).
