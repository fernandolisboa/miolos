# Do I need to do anything?

**Read [`docs/pending-fernando.md`](./docs/pending-fernando.md)** — the living ledger of everything waiting on you, in blocking order, kept current by every session. To work through it: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

Everything else is agent-owned — plans, reviews, fixes and merges happen without you.

## Start here

**`scripts/comment-audit/` now exists** (#228). Ten tools, a README, an 84-assertion self-test. Every figure a comment-tranche PR states must be one of their commands' output, **pasted unedited** — that is Rule P, and several review rounds have gone on numbers that were typed instead.

```sh
node scripts/comment-audit/selftest.mjs            # after touching any tool
node scripts/comment-audit/shingle.mjs <targets>   # Rule A, BEFORE sweeping
node scripts/comment-audit/count.mjs <targets>     # the baseline
node scripts/comment-audit/hash.mjs <targets>      # zero code changed
node scripts/comment-audit/excision.mjs <targets>  # what the PR body declares
node scripts/comment-audit/markers.mjs <files>     # what to sweep next
```

Read `scripts/comment-audit/README.md` before trusting any green — it names what each tool **cannot** see. `css-count.mjs` is for 7c.

## Session state

Two campaigns are open, both agent-owned, nothing blocked.

**#205 — comment removal.** Tranches 1–7a done. **7b-1 done** (#227): the four games' `state.ts` reducers **plus `nonogram/controls.tsx`**, which review pulled in — 609 → 579. The four reducers alone are 566 → 538. Zero code changed in any tranche, proved by hashing.

**Before sweeping anything, read ALL SIX rule comments on #205**, oldest first — not just the newest. Rules A and B are unlabelled in the oldest (grep the repo for anything citing a block before deleting it; re-derive the population rather than trusting a count in a plan); **Rule I is in the second** (`npx impeccable detect` with no argument scans nothing and exits 0, which #212 and #220 both cited as gate evidence — the real UI gate is the CI `detect` check on the head commit); K–Q are in the fourth and fifth; **R–U are in the newest**. The five that will bite next:

- **Sweep by FILE ROLE across all four games, never one game at a time** (Rule N). The games' reducers, hooks and views carry near-identical comments; one game at a time decides the same comment twice and leaves the loser asymmetric.
- **Reconcile the count PER FILE, not only in total** (Rule O). #227 shipped two wrong rows whose errors cancelled; the total still reconciled to `numstat` and three review rounds missed it.
- **Generate every figure from `scripts/comment-audit/` and publish the regex** (Rule P).
- **Assert per file and per tool, never an aggregate** (Rule S). An aggregate green is the sum of the easy cases — #228's end-to-end fixture stayed green with two regex bugs reintroduced.
- **When a fix pulls in a file the tranche did not plan to sweep, sweep it or declare it out of scope** (Rule Q). Half a file is the defect.

**The game dirs are NOT records-dense, and #205's ~71% does not transfer.** Measured over all 30 files **at HEAD** with `markers.mjs`: 248 markers / 3,041 comment lines, one per ~12 — against `src/play`'s 59% cut in tranche 6. (Before #227 merged: 330 / 3,071.) The reducers came in at 5%, which is their floor. 7b's whole scope is 3,041 lines and 579 of that is already swept, so **~2,460 remains** — close to the issue's "~2,600", but the genre is not there.

**Next by value:** `nonogram/board.tsx` (24 markers), then `sudoku/play-view.tsx` (21), `nonogram/play-view.tsx` (18), `binairo/play-view.tsx` (17), `termo/keyboard.tsx` and `sudoku/use-sudoku-play.ts` (14 each). Re-run `markers.mjs` rather than trusting these — they move with every merge. Also bind `binairo/controls.tsx` + `sudoku/keypad.tsx` + `termo/keyboard.tsx` into one tranche — `nonogram/controls.tsx` is already swept and `termo/keyboard.tsx` holds three live line anchors. Then 7c (the four game `.module.css` — **911** by `css-count.mjs`. The issue's **1,097 does reproduce**, and encodes two differences worth keeping: a wider convention — every line from the one holding `/*` through the one holding `*/` — and a wider file set, all non-`play` CSS, which adds `archive/late-result` 63, `archive/play-note` 23, `components/daily-unavailable` 15 and `free-play/free-play` 29. **Do not let those four fall between 7c and 7d**), 7d (`src/archive`, `src/free-play`, `src/components`), then `app/`+`scripts/`, `test/`, `eslint.config.mjs`.

**7d owes one debt:** #225 restored `day-client.ts`'s claim to be a "line-by-line sibling" of `streak-client.ts`, so all seven authenticated-surface clients must be swept together.

**#206 — duplication, 3 of 15 clusters done.** The issue says take them in table order, so cluster 4 is next; an earlier handoff said cluster 14 (`conclusion-view.tsx`) and contradicted the issue. The issue's "1,477 lines" is stale — #220 cut it to **888**. `ConclusionView`/`RemoteConclusionView` and `ShippedStamp`/`RemoteShippedStamp`/`RemoteTermoStamp` are still real duplication.

**#209 — the `apps/web` CI flake** is diagnosed but unfixed; it has not reproduced across any full-suite run in three sessions. Worth fixing alongside the `apps/web/test` tranche.

**#219** — the read-only-but-not-writable store defect — is triaged `defect` + `ready-for-agent`.

## What this session cost, so the next one budgets for it

Three PRs merged: #227 (six review rounds), #226, #228 (**eight**). **In #227, rounds 4–6 found nothing wrong with the diff** — every finding was a wrong number in the PR body. In #228, all eight rounds were defects in the verification, never in a sweep.

The sweeping is cheap. Describing it accurately is what costs, which is why the tools are committed now.
