# Do I need to do anything?

**No.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) NOW holds one ⚡ decision, low urgency by ~13 months. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Nothing to verify. The standing-authorization hook works — this session recited the four points unprompted and ran plan → review → implement → review → merge unattended across three tickets.

## Session state — #219, #209 and #206 cluster 4 all merged

**#219 (#245).** A store that reads but cannot *hold a record* renders no share control. Two correctness rounds.

**#209 (#247).** Opened as a test-isolation fix; four review rounds found **four production defects** in `sync.ts`'s retry ownership, all on the completion post the streak depends on. `sync.ts` now carries one invariant — *a retry is armed iff some live owner still wants one* — with a test per guard. **#209 stays open** on two residuals: the `day-truth` fixed-tick population, and the starvation axis (`T-WEB-S203`/`T-WEB-S289`), which is ADR-0057's and cannot be closed from `apps/web`.

**#206 cluster 4 (#248).** One API client behind the twelve credentialed call sites, 633 lines to 233. Plan rejected once, then all four lenses rejected in turn.

## The lesson this session actually earned

**Three separate dead assertions shipped past me, in three different tickets, and every one was caught by mutation rather than by reading.** A `not.toContain` that could not fail (#236, last session), a negative claim after a fixed sleep that passed with a 10 ms wait (#209), and a uniqueness check comparing a `const` array against itself (#206). Fixing that last one exposed a *fourth*: a non-ok fixture whose body the schema rejected, so deleting the branch it guarded left it green.

**So: before an assertion counts as coverage, name the production change that reds it and run that change.** Not "verified" — the red output, pasted. That is now the bar the reviewers hold, and it is worth more than any of the three diffs.

Second: **a claim carried from an audit or a plan is not evidence.** Cluster 4's audit said six copies of the guard (twelve), five uniform POSTs (four), and one wall entry owed (none). Clusters 1 and 3 hit the same thing. Re-derive.

## Next

**#206 cluster 5** — 16 per-game Next route files, ~930 lines; `diff` of the sudoku and nonogram archive pages changes five tokens across 91 lines. Follow `og/handlers.ts`. Note the issue's ordering: **14 unblocks 6**, so 5 → 14 → 6 is the cheaper path than table order.

**Also queued:** #201 (import walls walked by a mid-path `..`), #205's CSS half (~1,820 lines, and it is NOT a sweep — `T-WEB-S102` asserts the *contents* of `termo-board.module.css`'s header). And a Quick change filed on #206 this session: `jsonResponse`/`stubFetch` are hand-copied across ~19 `apps/web/test` files; `test/ts-source.ts` is now the precedent for where a shared test helper lives.
