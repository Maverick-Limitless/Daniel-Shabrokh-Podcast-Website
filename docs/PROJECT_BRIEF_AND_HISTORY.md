# Project Brief and History

**Project:** DSMP — Daniel Shabrokh Media Platform (independent proposal)
**Repository:** local git at the workspace root, branch `main`, no remote
**Last updated:** 2026-10-19 (verified against `git log` and the working tree)

## Objectives

Build a polished, editorial-style website that presents the Daniel Shabrokh /
2See podcast as a credible independent proposal: one coherent destination for
video, audio, and written insights, with a private single-administrator CMS so
real content can be managed without touching code. The product must be
presentable to the channel owner as a serious proposal that could be licensed
or developed further.

## Audience

- **Primary:** the podcast owner (evaluation of the proposal) and, eventually,
  site visitors browsing podcast content.
- **Secondary:** the site administrator (content management) and any developer
  inheriting the codebase.

## Non-goals (deliberately out of scope)

Public user registration, multi-role permissions, comments/social features,
payments, custom video hosting or transcoding, analytics, email delivery,
AI features inside the product, and presenting the site as official or
endorsed without documented owner authorization.

## Product principles

1. Never invent facts — no fabricated biography, credentials, quotes,
   episodes, dates, endorsements, or affiliations; unverifiable content is
   replaced by honest "pending verification" states.
2. Editorial craft — premium, restrained design (ink/navy, warm ivory,
   restrained gold), distinctive typography, deliberate composition — not a
   generic template.
3. Real behavior only — every visible control works; drafts never leak to
   the public site, search, feeds, or sitemaps; no fake metrics or success
   messages.
4. Security and privacy by default — hashed sessions, strict CSP, no
   third-party tracking, privacy-enhanced YouTube embeds behind
   click-to-load.
5. Development tooling stays out of the product — the NVIDIA visual-review
   workflow is an external reviewer, enforced by a guard test.

## Factual Git-backed timeline (all entries verified in `git log`)

| Commit | Date | What it actually did |
| --- | --- | --- |
| `549ca02` | 2026-10-18 | Initial public platform: design system, all public routes, Prisma schema + first migration, server modules (auth, CMS, content, Markdown sanitizer, validation), YouTube facade, shared audio player, robots/sitemap, README. |
| `bef6424` | 2026-10-18 | Admin CMS + auth: full `/admin` tree, sessions + rate limiting, admin-init and `[DEV]` seed scripts, KIT_ORIGIN support. |
| `7b814c6` | 2026-10-19 | Test suite: unit tests, 5 E2E specs, Playwright config, CSP hardening (no inline handlers). |
| `4cb9b14` | 2026-10-19 | Handover pass: README rewrite, layout-integrity E2E, refreshed screenshots. |
| `694d50b` | 2026-10-19 | Release work: lodash ≥ 4.18 override (audit clean), `/healthz`, release-readiness E2E (SEO, click-to-load, keyboard, XSS probe), web-vitals lab script. |
| `e5be9fa` | 2026-10-19 | Screenshot refresh only. |
| `a35e4d3` | 2026-10-19 | Visual-QA workflow v1: NVIDIA client, capture pipeline, schema-validated reviews, dry-run executed with 27 captures, 29 deterministic tests. |
| `c4d5144` | 2026-10-19 | README header fix. |
| `77fa574` | 2026-10-19 | Vision workflow v2: versioned schema, configurable knobs, adversarial-review fixes, product-boundary guard test, docs/ — plus the live-review/GitHub-release session that curated `docs/screenshots/` and rewrote the README. |
| `2affe56` | 2026-10-19 | Release presentation commit (enterprise README, docs). Briefly published under a mis-targeted branch in the unrelated Tosi/2See repository due to a defective instruction. |
| (recovery) | 2026-10-19 | Repository misrouting corrected: dedicated `DSH-Podcast-Website` repository established, full history published there, misplaced branch removed from the Tosi repository, Tosi main verified unchanged. |

## Repository identity and recovery

DSH lives in its own dedicated repository:
**https://github.com/Maverick-Limitless/DSH-Podcast-Website** (created
2026-10-19). An unrelated project also exists under the same GitHub
account — **Tosi/2See** (`Maverick-Limitless/2See-Podcast-Website`, a
SvelteKit 2 + node:sqlite + npm application with bilingual/PWA features
and its own history). The account's earlier repo list caused an
implementation of DSH work to be published for a few hours as the
`dsmp-editorial-release` branch inside the Tosi repository, due to a
defective instruction. Recovery (2026-10-19): the full local DSH history —
which contains every commit of the misplaced branch, verified by SHA —
was published to the dedicated DSH repository, the misplaced branch was
deleted from the Tosi repository after verification, and Tosi/2See `main`
(`a959821`) was confirmed unchanged. The projects share no commits, code,
or lineage; podcast-context mentions of "2See" in DSH content are content
references, not project-identity references.

## Current status (what is proven vs. what is not)

**Proven by repository/tests:** all features listed in the README work
end-to-end; 81 unit tests and 38 Playwright E2E tests pass against a fresh
production build (2026-10-19); `pnpm audit` clean; svelte-check clean;
Core Web Vitals lab-measured (see README caveats); the visual-review workflow
is implemented and its capture pipeline executes for real (28 screenshots),
with its request/response contract unit-tested.

**Goals (not yet facts):** owner-authorized publication; live NVIDIA visual
review; field performance data; real content.

**Unverified historical reports:** earlier session reports (no remote, no
deployment, no live NVIDIA review) were re-verified on 2026-10-19 and
hold: `git remote -v` is empty, no deployment exists, no `NVIDIA_API_KEY` is
configured. NVIDIA model-availability claims rest on live endpoint probes
performed 2026-10-19T10:43:01Z — see
[VISUAL_REVIEW_WORKFLOW.md](VISUAL_REVIEW_WORKFLOW.md).

**Open owner decisions:** publication authorization and the site's official
status; verified biography, portrait, official links, and contact channels;
real episode/audio sources and rights; the `og:image` brand asset; the
production domain/hosting target (no git remote exists).

## Release gates

1. **Content & authorization** — owner-approved content and explicit
   permission to present/publish the site.
2. **Independent visual review** — a live NVIDIA VLM review (needs a valid
   `NVIDIA_API_KEY`) or a human review of the archived screenshots.
3. **Deployment destination** — no git remote, host, or domain exists yet;
   publication is blocked until the owner designates one.
4. **Field performance data** — lab metrics exist; real-user data does not.
