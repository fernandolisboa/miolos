# Do I need to do anything?

**No.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) still holds one ⚡ decision, low urgency by ~13 months. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Nothing to verify. #206 clusters 5 and 14 merged; the handoff now ships inside the PR that does the work (#252, #253).

## Session state

**Cluster 5 (#250).** Twelve per-game route files stopped carrying their own copy of the publication wall read: 436 → 184 lines, envelope copies 12 → 2. New **ADR-0076** — the shared envelope takes a `render` callback, never a screen registry.

**Cluster 14.** The audit said 1,477 lines and "two full screens, split into five files". Re-derived: **835 lines**, and the two screens are not independent — `ConclusionView` renders `RemoteConclusionView` as its own branch. The 642 missing lines were **comments** (#205/#239 already removed them): both revisions reprinted with comments stripped are 483 → 481 lines, token streams byte-identical. What shipped is the one extraction the evidence supports — the 194-line statistics sub-tree into `src/play/conclusion-stats.tsx`, retiring one of the file's **six** change reasons. The remote-root extraction is declined and priced: it moves the lazy boundary.

**Retracted on the record: "14 unblocks 6" is false.** No `play-view.tsx` imports any conclusion module. Cluster 6 is unblocked today. Its "~1,460 lines" is really 890; cluster 7's "640" is really 321.

## The lesson, again — fifth instance

**A dead assertion shipped past four reviewers into the very ticket after the one that documented the pattern.** The new `"conclusion-stats"` entry in `archive-day.test.tsx`'s forbidden array could not fail: `conclusion-stats.tsx` imports `conclusion-view.module.css`, so any graph reaching it also matches index 0, and a plain `expect` in a loop throws before index 1 is read. #250 had already written down the fix — *collect every arm and assert once* — and it was not applied. The loop now does.

**Also: two reviewers disagreed and one was wrong.** Invariants called the same entry live coverage; correctness proved it dead by mutation, both directions. **The lens with pasted red output wins over the lens with an argument.**

## Next

**#206 cluster 6** — `play-view.tsx` screen chrome, 4 files, 890 lines (not 1,460). Unblocked now.

**Also queued:** #254 (the remote conclusion announces its body sentence twice — `.announcer` is `clip-path`-hidden, so a screen reader gets it on mount and again in browse mode), #201 (import walls walked by a mid-path `..`), #205's CSS half (~1,820 lines, NOT a sweep), #155 (`bundle-check` into CI), the `jsonResponse`/`stubFetch` Quick change, and the free-play wall's missing `**/termo/termo-screen` — the other three screen roots are walled and Termo's is not.
