# Do I need to do anything?

**Read [`docs/pending-fernando.md`](./docs/pending-fernando.md)** — the living ledger of everything waiting on you, in blocking order, kept current by every session. To work through it: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

Everything else is agent-owned — plans, reviews, fixes and merges happen without you.

## Session state

Two campaigns are open, both agent-owned, nothing blocked.

**#205 — comment removal.** Tranches 1–7a done. **7b-1 done** (#227): the four games' `state.ts` reducers, 609 → 579. Zero code changed in any tranche, proved by hashing.

**Before sweeping anything, read the two rule comments on #205** — they now carry Rules K through Q. The four that will bite next:

- **Sweep by FILE ROLE across all four games, never one game at a time** (Rule N). The games' reducers, hooks and views carry near-identical comments; one game at a time decides the same comment twice and leaves the loser asymmetric.
- **Reconcile the count PER FILE, not only in total** (Rule O). #227 shipped two wrong rows whose errors cancelled; the total still reconciled to `numstat` and three review rounds missed it.
- **Generate every figure in a PR body from `scripts/comment-audit/`, and publish the regex** (Rule P). #227 took **six** review rounds; rounds 4, 5 and 6 found nothing wrong with the diff — every finding was a number in the body, each in a scope the previous round had not enumerated.
- **When a fix pulls in a file the tranche did not plan to sweep, sweep it or declare it out of scope** (Rule Q). Half a file is the defect.

**The game dirs are NOT records-dense, and #205's ~71% does not transfer.** Measured over all 30 files: 282 markers / 3,071 comment lines, versus `src/play`'s 59% cut. The reducers came in at 5%, which is their floor. 7b is **~3,070** lines, not the issue's "~2,600".

**Next by value:** `nonogram/board.tsx` (22 markers), then `sudoku/play-view.tsx` (19), `binairo/play-view.tsx` (17), `nonogram/play-view.tsx` (16). Also bind `binairo/controls.tsx` + `sudoku/keypad.tsx` + `termo/keyboard.tsx` into one tranche — `nonogram/controls.tsx` is already swept and `termo/keyboard.tsx` holds three live line anchors. Then 7c (the game `.module.css`, 1,097), 7d (`src/archive`, `src/free-play`, `src/components`), then `app/`+`scripts/`, `test/`, `eslint.config.mjs`.

**7d owes one debt:** #225 restored `day-client.ts`'s claim to be a "line-by-line sibling" of `streak-client.ts`, so all seven authenticated-surface clients must be swept together.

**#206 — duplication, 3 of 15 clusters done.** Next by value is cluster 14, `conclusion-view.tsx`. The issue's "1,477 lines" is stale — #220 cut it to **888**. `ConclusionView`/`RemoteConclusionView` and `ShippedStamp`/`RemoteShippedStamp`/`RemoteTermoStamp` are still real duplication.

**#209 — the `apps/web` CI flake** is diagnosed but unfixed; it has not reproduced across any full-suite run in three sessions. Worth fixing alongside the `apps/web/test` tranche.

**#219** — the read-only-but-not-writable store defect — is triaged `defect` + `ready-for-agent`.
