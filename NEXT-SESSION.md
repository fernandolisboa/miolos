# Do I need to do anything?

**Read [`docs/pending-fernando.md`](./docs/pending-fernando.md)** — the living ledger of everything waiting on you, in blocking order, kept current by every session. To work through it: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

Everything else is agent-owned — plans, reviews, fixes and merges happen without you.

## Session state

Two campaigns are open, both agent-owned, nothing blocked.

**#205 — comment removal, 5 of 8 tranches done.** `packages/db`, `core`, `games`, `ui` and `apps/api` are swept: 11,678 → 8,613 comment lines, zero code changed in any tranche. Left: `apps/web` (19,396 lines, four PRs — `src/play`, `src/` remainder, `app/`+`scripts/`, `test/`) and `eslint.config.mjs` (558).

**#206 — duplication, 3 of 15 clusters done.** Clusters 1, 2 and 3 merged: −973 / +260 of real code. Next by value is cluster 14 (`conclusion-view.tsx`, 1,477 lines holding two screens).

**#209 — the `apps/web` CI flake** is diagnosed but unfixed: three distinct tests, contention-only, reproduces under full-monorepo `pnpm test --force`. Worth fixing alongside the `apps/web/test` tranche, since that tranche reads all 107 of those files anyway.

Both issues carry the campaign's accumulated rules in their comments — read them before sweeping or extracting. Every one cost a review round to learn.
