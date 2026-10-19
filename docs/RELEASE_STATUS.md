# Release Status

**Date:** 2026-10-19 · **Evidence:** commands executed in this workspace on
this date; `git log`; live endpoint probes timestamped in
[VISUAL_REVIEW_WORKFLOW.md](VISUAL_REVIEW_WORKFLOW.md).

## Evidence categories (never conflated)

| Category | Status | Evidence |
| --- | --- | --- |
| Implemented | ✅ | Full public site, admin CMS, auth, audio player, visual-review workflow (see README feature list) |
| Tested locally | ✅ | `pnpm run check` 0 errors/0 warnings · `pnpm test` **81/81 passed** · `pnpm test:e2e` **38/38 passed** against a fresh production build · `pnpm audit` clean · `pnpm visual:review:dry` executed the full capture pipeline (28 screenshots) |
| Independently reviewed | ⚠️ partial | GLM subagent audits ran 2026-10-19 (repository historian/architect, adversarial code reviewer — 4 confirmed workflow bugs, all fixed and regression-tested — and documentation auditor — stale claims, all corrected). NVIDIA VLM image review: **not executed** (no credentials). Human review of archived screenshots: pending. |
| Configured for production | ✅ (scripts/docs, not deployed) | Build/run/migrate/provision/backup procedures, `/healthz`, proxy checklist — all documented and smoke-verified locally against the real build |
| Deployed | ❌ | No git remote, no host, no domain exists; nothing was pushed or published |
| Verified in production | ❌ | Nothing to verify against — no deployment |

## Open release gates

1. **Live NVIDIA visual review** — *missing:* a valid `NVIDIA_API_KEY` with
   access to `nvidia/nemotron-3.5-super-vl-120b-a12b`. *Minimum action:*
   export the key, run `pnpm visual:review`, then triage per
   [VISUAL_REVIEW_WORKFLOW.md](VISUAL_REVIEW_WORKFLOW.md) (≤ 3 fix/review
   rounds).
2. **Owner content and authorization** — *missing:* verified biography,
   official links, real episode/audio sources with rights, explicit
   permission to present the site as anything other than an independent
   proposal, and an `og:image` asset. *Minimum action:* owner supplies or
   approves each item; content is entered through the CMS.
3. **Deployment destination** — *missing:* a designated git remote/host/
   domain. *Minimum action:* owner names the target; deployment is then
   scripted (build → `prisma migrate deploy` → `admin:create` → smoke via
   `/healthz`).
4. **Field performance data** — *missing:* real-user Core Web Vitals.
   Lab numbers (LCP 148–2124ms, CLS ≤ 0.004, interactions ≤ 136ms) exist
   only.

## Known accuracy notes

- Test counts in this file are from the 2026-10-19 runs; re-run the
  commands for current numbers.
- The earlier statement "screenshots archived for human review" refers to
  `tests/visual-review/captures/` (28, latest run) and `tests/screenshots/`
  (20, E2E-generated).
- Historical commit messages contain two stale test-count claims
  (31/33 vs. later counts); the table in
  [PROJECT_BRIEF_AND_HISTORY.md](PROJECT_BRIEF_AND_HISTORY.md) records what
  each commit actually changed.
