# Do I need to do anything?

**Read [`docs/pending-fernando.md`](./docs/pending-fernando.md)** — the living ledger of everything waiting on you, in blocking order, kept current by every session. To work through it: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

Everything else is agent-owned — plans, reviews, fixes and merges happen without you.

## Session state

Two campaigns are open, both agent-owned, nothing blocked.

**#205 — comment removal.** Tranche 6 (`apps/web/src/play`) is complete: #220 took the `.ts`/`.tsx` half (2,967 → 1,203), #221 the CSS half (824 → 187). Tranche **7a is partly done**: #223 swept `src/i18n/messages.ts` (664 → 191). Zero code changed in any of them, proved by hashing.

**7a is not closed.** Still open in it: `src/day`, `src/session`, `src/og` (~1,200 lines). Then 7b (the four game dirs' `.ts`/`.tsx`, ~2,600), 7c (the game `.module.css`, 1,097), 7d (`src/archive`, `src/free-play`, `src/components`, ~2,000), then `app/`+`scripts/`, `test/`, and `eslint.config.mjs`.

**#221 cost seven review rounds and #223 four, and in both, most rejections were for defects introduced while fixing the previous round.** The rules are written up as two comments on #205 — read them before the next sweep. The four that generalise:

- **Condensing a comment is rewriting it.** Restore verbatim or delete; never reword. And check the text a *fix* adds, not just what the sweep kept — that is where they hide.
- **Check what cites a block before sweeping**, searching paraphrase and symbol names, not just verbatim runs — and including ADRs and READMEs. Citations can also be intra-file.
- **`bodyOf` is first-match at every level.** One gate was bypassed eight ways across six rounds. Every descent needs a uniqueness assertion.
- **One metric, both ends, reconciled to `git diff --numstat`.** Four counts were wrong across the two PRs.

Also: **`npx impeccable detect` with no argument scans nothing and exits 0.** #212 and #220 both cited that vacuous green as evidence. The real UI gate is the CI `detect` check on the head commit.

**#206 — duplication, 3 of 15 clusters done.** Next by value is cluster 14, `conclusion-view.tsx`. The issue's "1,477 lines" is stale — #220 cut it to **888**. The duplication is still real: `ConclusionView`/`RemoteConclusionView` and `ShippedStamp`/`RemoteShippedStamp`/`RemoteTermoStamp`.

**#209 — the `apps/web` CI flake** is diagnosed but unfixed; it did not reproduce across any full-suite run this session. Worth fixing alongside the `apps/web/test` tranche.

**#219** — the read-only-but-not-writable store defect — is triaged `defect` + `ready-for-agent`.
