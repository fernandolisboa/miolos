# Do I need to do anything?

**Read [`docs/pending-fernando.md`](./docs/pending-fernando.md)** — the living ledger of everything waiting on you, in blocking order, kept current by every session. To work through it: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

Everything else is agent-owned — plans, reviews, fixes and merges happen without you.

## Session state

Two campaigns are open, both agent-owned, nothing blocked.

**#205 — comment removal.** Tranches 1–7a done. **7b-1 done** (#227): the four games' `state.ts` reducers **plus `nonogram/controls.tsx`**, which review pulled in — 609 → 579. The four reducers alone are 566 → 538. Zero code changed in any tranche, proved by hashing.

**Before sweeping anything, read all the rule comments on #205** — four of the five carry rules, A through Q. Do not read only the newest two: **Rule I lives in the oldest of them**, and it is the one that says `npx impeccable detect` with no argument scans nothing and exits 0. #212 and #220 both cited that vacuous green as gate evidence. The real UI gate is the CI `detect` check on the head commit. The four that will bite next:

- **Sweep by FILE ROLE across all four games, never one game at a time** (Rule N). The games' reducers, hooks and views carry near-identical comments; one game at a time decides the same comment twice and leaves the loser asymmetric.
- **Reconcile the count PER FILE, not only in total** (Rule O). #227 shipped two wrong rows whose errors cancelled; the total still reconciled to `numstat` and three review rounds missed it.
- **Generate every figure in a PR body from `scripts/comment-audit/`, and publish the regex** (Rule P). `node scripts/comment-audit/selftest.mjs` first if you touch the tools. #227 took **six** review rounds; rounds 4, 5 and 6 found nothing wrong with the diff — every finding was a number in the body, each in a scope the previous round had not enumerated.
- **When a fix pulls in a file the tranche did not plan to sweep, sweep it or declare it out of scope** (Rule Q). Half a file is the defect.

**The game dirs are NOT records-dense, and #205's ~71% does not transfer.** Measured over all 30 files **at HEAD**: 221 markers / 3,041 comment lines, one per ~14 — against `src/play`'s 59% cut in tranche 6. (Before #227 merged: 282 / 3,071.) The reducers came in at 5%, which is their floor. What is left in 7b is **~3,040** lines, not the issue's "~2,600" — but the genre is not there.

**Next by value:** `nonogram/board.tsx` (22 markers), then `sudoku/play-view.tsx` (19), `binairo/play-view.tsx` (17), `nonogram/play-view.tsx` (16). Also bind `binairo/controls.tsx` + `sudoku/keypad.tsx` + `termo/keyboard.tsx` into one tranche — `nonogram/controls.tsx` is already swept and `termo/keyboard.tsx` holds three live line anchors. Then 7c (the game `.module.css` — **911**, re-derived with `css-count.mjs`; the issue's "1,097" reproduces at no file scope), 7d (`src/archive`, `src/free-play`, `src/components`), then `app/`+`scripts/`, `test/`, `eslint.config.mjs`.

**7d owes one debt:** #225 restored `day-client.ts`'s claim to be a "line-by-line sibling" of `streak-client.ts`, so all seven authenticated-surface clients must be swept together.

**#206 — duplication, 3 of 15 clusters done.** The issue says take them in table order, so cluster 4 is next; an earlier handoff said cluster 14 (`conclusion-view.tsx`) and contradicted the issue. The issue's "1,477 lines" is stale — #220 cut it to **888**. `ConclusionView`/`RemoteConclusionView` and `ShippedStamp`/`RemoteShippedStamp`/`RemoteTermoStamp` are still real duplication.

**#209 — the `apps/web` CI flake** is diagnosed but unfixed; it has not reproduced across any full-suite run in three sessions. Worth fixing alongside the `apps/web/test` tranche.

**#219** — the read-only-but-not-writable store defect — is triaged `defect` + `ready-for-agent`.
