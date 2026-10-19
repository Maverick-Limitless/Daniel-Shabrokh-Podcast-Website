# DSMP — Daniel Shabrokh Media Platform

A premium, independent editorial, video, and audio publishing platform: a public
site (Watch / Listen / Insights / About / Search) and a secure single-administrator
CMS with a full draft → preview → publish workflow.

**Status:** fully implemented and tested locally. No production deployment has
been performed. All seeded content is `[DEV]`-labeled placeholder material that
must be replaced with verified content (see "Content policy" below).

## Stack

- [SvelteKit 3](https://svelte.dev/docs/kit) + Svelte 5 (runes) + TypeScript
- [Prisma 7](https://www.prisma.io) with SQLite (single-instance deployments)
- argon2id password hashing ([@node-rs/argon2](https://github.com/napi-rs/node-rs/tree/main/crates/argon2))
- Server-side sessions stored **hashed** in the database (opaque random tokens)
- Vitest (unit) + Playwright (browser E2E) + axe-core (accessibility)
- Self-hosted variable fonts (Fraunces, Newsreader, Inter) — no third-party font CDN

Dependency hygiene: `pnpm.overrides` pins `lodash ≥ 4.18` — the only audit
findings (1 high, 2 moderate) were lodash 4.17.21 reached exclusively through
Prisma Studio's bundled UI tooling (`@prisma/studio-core → @visx/*`);
`pnpm audit` now reports zero known vulnerabilities.

## Requirements

- Node.js ≥ 20 (developed on 26), pnpm ≥ 9, SQLite 3

## Quick start (development)

```sh
pnpm install
cp .env.example .env          # then edit DATABASE_URL (see below)
pnpm exec prisma migrate dev  # create/apply the schema
pnpm admin:create -- --username <your-name>   # prints a one-time temporary password
pnpm dev                      # http://localhost:5173
```

Sign in at `/admin/login`. On first sign-in you are forced to set a permanent
password before anything else. To exercise the UI with clearly labeled
placeholder content:

```sh
pnpm db:seed-dev   # [DEV]-labeled fixtures; refuses to run with NODE_ENV=production
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | SQLite URL, e.g. `file:/srv/dsh/app.db`. **Use an absolute path** — the Prisma CLI resolves relative paths against `prisma/`, the runtime against the process working directory, so relative paths can silently point at two different files. |
| `SITE_BASE_URL` | no | Canonical public origin (no trailing slash) used for canonical URLs, Open Graph tags, robots.txt and the sitemap. Empty falls back to the request origin. |
| `KIT_ORIGIN` | build-time, optional | Baked into a production build (`kit.paths.origin`) for direct-to-Node deployments and local production-style testing: `KIT_ORIGIN=https://your.domain pnpm build`. Leave unset when running behind a reverse proxy. |
| `PROTOCOL_HEADER` / `HOST_HEADER` | proxy only | Set on the reverse proxy (e.g. `x-forwarded-proto` / `x-forwarded-host`); the Node adapter then derives each request's origin from those headers. Without them the adapter assumes `https`. |

There is **no session secret**: sessions are opaque 32-byte random tokens; the
database stores only their SHA-256 hash. Missing required configuration fails
at startup with a clear error (Kit validates `DATABASE_URL` via `src/env.ts`).

## Administrator initialization & password recovery (PRD §6.2/§6.5)

```sh
pnpm admin:create -- --username <name>          # initial creation (idempotent)
pnpm admin:create -- --username <name> --reset  # recovery — SERVER SHELL ONLY
```

- Refuses to overwrite an existing administrator without `--reset`.
- Prints a cryptographically secure temporary password **once**, never stores or
  logs it, and sets `mustChangePassword` — the UI forces a permanent password
  before any other admin action.
- Recovery is deliberately a server-side procedure: there is **no public
  "forgot password" endpoint** and no fake email flow. `--reset` rotates the
  credential and invalidates all sessions; run it only with deployment access.
- Changing the password in Settings invalidates every other session and
  rotates the current one.

## Testing

```sh
pnpm check      # svelte-check (types)
pnpm test       # 34 unit tests (validation, Markdown sanitization, WCAG contrast of the design tokens)
pnpm test:e2e   # 33 browser tests: builds for production, boots the real server,
                # covers auth, CMS lifecycle, audio player, responsive matrix,
                # axe accessibility, and captures review screenshots to
                # tests/screenshots/
```

E2E credentials are generated per run (or supplied via `TEST_ADMIN_TEMP_PASSWORD` /
`TEST_ADMIN_FINAL_PASSWORD`); nothing is committed. The suite runs against an
isolated database (`data/e2e.db`) with `[DEV]` fixtures — never your real data.

## Health check

`GET /healthz` returns `200 {"ok":true}` after answering a real database query,
or `503 {"ok":false}` when the database is unreachable — suitable for uptime
monitors, load balancers, and post-deploy smoke checks.

## Performance (laboratory measurements)

`node scripts/measure-web-vitals.mjs` (after building with
`KIT_ORIGIN=http://localhost:43933 pnpm build`) loads the five key pages in a
real Chromium window, three runs per page, and reports Core Web Vitals. Lab
record from the release verification run (localhost production build — this is
**not** field data from real users):

| Metric | Target | Measured (lab) |
| --- | --- | --- |
| LCP | ≤ 2.5s | 148–2124ms across pages; one 3008ms outlier on the article page; every delivered median within target |
| CLS | ≤ 0.1 | 0.000–0.004 on every run of every page |
| Interaction latency (INP-style lab proxy) | ≤ 200ms | 16–136ms |
| INP (field) | ≤ 200ms | **Not measured** — requires real-user data |

Caveat: headless Chromium on this host inconsistently suppresses
`largest-contentful-paint` entry delivery (the script therefore runs headed and
reports the delivered-run count). Fonts are self-hosted; the only
latency-relevant third party is the YouTube thumbnail on the home/watch facades.

## Production build & run

```sh
KIT_ORIGIN=https://your.domain pnpm build   # or omit when behind a proxy
DATABASE_URL=file:/srv/dsh/app.db NODE_ENV=production PORT=3000 node build/index.js
```

Reverse-proxy checklist (nginx/Caddy/…):

- Terminate TLS; add HSTS at the proxy (the app intentionally does not send it).
- Forward `x-forwarded-proto` and `x-forwarded-host`, and run the app with
  `PROTOCOL_HEADER=x-forwarded-proto HOST_HEADER=x-forwarded-host`.
- Apply migrations first: `pnpm exec prisma migrate deploy` (with `DATABASE_URL`
  pointing at the production file).

CSRF: cross-origin form POSTs are rejected by SvelteKit's origin check;
session cookies are `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS.
CSP: `default-src 'self'` with hashed SvelteKit bootstrap scripts; YouTube is
only permitted as a frame source (`youtube-nocookie.com`), and embeds use a
click-to-load facade so no third-party JS loads until the visitor plays.

## Backup & restore (SQLite)

The database is a single file. While the app can be briefly stopped:

```sh
sqlite3 /srv/dsh/app.db ".backup '/srv/backups/dsh-$(date +%F).db'"
# restore: stop the app, replace app.db with the backup, start the app
```

## Updating

```sh
git pull && pnpm install
pnpm exec prisma migrate deploy
pnpm build && (restart the node process)
```

## Content policy

The About page intentionally shows restrained "pending verification" states:
no biography, credentials, portrait, or official links are published until the
owner supplies verified material. `pnpm db:seed-dev` inserts only clearly
`[DEV]`-labeled placeholders (including a generated 30-second tone as the audio
fixture) so layouts and tests can be exercised; it refuses to run in production.
Video entries embed public YouTube content through the official
privacy-enhanced player; nothing is scraped or re-hosted.

## Known limitations

- **No independent visual review was performed.** The PRD's NVIDIA
  vision-language reviewer is unavailable in this environment (no configured
  endpoint or credentials), and image inspection was not possible for the
  implementing agent either. Real screenshots were captured
  (`tests/screenshots/`, regenerated by `pnpm test:e2e`) and are archived for
  human review; automated substitutes ran instead: WCAG contrast tests on the
  design tokens, an overflow matrix at 320–1440px, axe-core scans (zero
  serious/critical violations), and geometric layout-integrity checks
  (no overlapping/clipped controls).
- Search is case-insensitive for ASCII only (SQLite `LIKE` limitation).
- Video availability (deleted/private YouTube videos) is not pre-checked; the
  YouTube API is intentionally not integrated — a facade + fallback text covers
  missing thumbnails, and the iframe surfaces YouTube's own unavailable notice.
- No email delivery, no public user accounts, single administrator by design.
- No social-sharing image (`og:image`) until an approved brand asset exists.
- Sitemap/robots use `SITE_BASE_URL` when set, otherwise the request origin.

## Repository map

```
prisma/schema.prisma       data model (Administrator, Session, Article, Video, AudioEpisode, AdminEvent)
src/routes/                public pages, /admin (CMS), /preview (draft preview)
src/lib/server/            auth, db, validation, markdown sanitizer, content queries, CMS services
src/lib/components/        header, footer, cards, YouTube facade, shared audio player
src/lib/styles/            design tokens (WCAG-verified) + global styles
scripts/                   admin init, E2E preparation, audio-fixture generator
tests/                     unit (vitest) + E2E (Playwright) + captured screenshots
```
