# Release Status

**Date:** 2026-10-19 (live-review + GitHub-release mandate) · **Evidence:**
commands executed in this workspace on this date; `git log`; live endpoint
probes timestamped in [VISUAL_REVIEW_WORKFLOW.md](VISUAL_REVIEW_WORKFLOW.md);
GitHub API inspection of the published repository.

## Repository identity

This project (DSH — Daniel Shabrokh Podcast) lives in its own dedicated
repository: **https://github.com/Maverick-Limitless/DSH-Podcast-Website**
(public, created 2026-10-19, confirmed via the GitHub API).

**Recovery note.** An earlier defective instruction caused one branch of
DSH work (`dsmp-editorial-release` @ `2affe56`) to be published briefly
inside `Maverick-Limitless/2See-Podcast-Website` — the repository of the
unrelated **Tosi/2See** software project. That was a repository-targeting
mistake, not a project relationship: the two projects share no commits,
code, or lineage. The complete DSH history (12 commits, clean tree) was
always intact locally and has been published to the dedicated DSH
repository with full ancestry; the misplaced branch was then removed from
the Tosi repository after verification, and Tosi/2See `main` (`a959821`)
was never modified.

## Evidence categories (never conflated)

| Category | Status | Evidence |
| --- | --- | --- |
| Implemented | ✅ | Full public site, admin CMS, auth, audio player, visual-review workflow (see README feature list) |
| Tested locally | ✅ | `pnpm run check` 0/0 · `pnpm test` **81/81** · `pnpm test:e2e` **38/38** against a fresh production build · `pnpm audit` clean · `pnpm visual:review:dry` executed the full capture pipeline (28 screenshots) |
| Independently reviewed | ⚠️ partial | GLM subagent audits ran 2026-10-19 (historian/architect; adversarial code reviewer — 4 confirmed workflow bugs, all fixed and regression-tested; documentation auditor — 5 stale claims, all corrected). NVIDIA VLM image review: **not executed** — no reachable credential (search record in the workflow doc). Human review of archived screenshots: pending. |
| Configured for production | ✅ (procedures only, not deployed) | Build/run/migrate/provision/backup procedures, `/healthz`, proxy checklist — documented and smoke-verified locally against the real build |
| Deployed | ❌ | No host or domain exists; nothing was deployed (and the mandate forbids website hosting) |
| Verified in production | ❌ | Nothing to verify against |

## Open release gates

1. **Live NVIDIA visual review** — *missing:* a valid `NVIDIA_API_KEY`
   reachable from this environment (shell, `.env`, keychain, and sibling
   workspaces were all checked; none found). *Minimum action:* place the
   key in `.env` and run `pnpm visual:review`, then triage per
   [VISUAL_REVIEW_WORKFLOW.md](VISUAL_REVIEW_WORKFLOW.md) (≤ 3 fix/review
   rounds).
2. **Owner content and authorization** — *missing:* verified biography,
   official links, real episode/audio sources with rights, explicit
   permission to present the site as anything other than an independent
   proposal, and an `og:image` asset. *Minimum action:* owner supplies or
   approves each item; content is entered through the CMS.
3. **Deployment destination** — *missing:* a designated host/domain
   (GitHub publication is done; website hosting was out of mandate scope).
4. **Field performance data** — *missing:* real-user Core Web Vitals.
   Lab numbers (LCP 148–2124ms, CLS ≤ 0.004, interactions ≤ 136ms) exist
   only.

## Known accuracy notes

- Test counts in this file are from the 2026-10-19 runs; re-run the
  commands for current numbers.
- The earlier statement "screenshots archived for human review" refers to
  `tests/visual-review/captures/` (28, latest run), `docs/screenshots/`
  (14 curated presentation shots), and `tests/screenshots/` (20,
  E2E-generated).
- Historical commit messages contain two stale test-count claims (31/33
  vs. later counts); the table in
  [PROJECT_BRIEF_AND_HISTORY.md](PROJECT_BRIEF_AND_HISTORY.md) records what
  each commit actually changed.
