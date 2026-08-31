# Do I need to do anything?

**No.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) NOW holds one ⚡ decision, low urgency by ~13 months. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

The standing-authorization hook works. This session recited the four points unprompted, spawned reviewers, and ran commit→push→PR→merge without stopping. Nothing to verify — just work.

## Session state

**#219 merged (#245): a store that reads but cannot hold a record renders no share control.** Three commits, two correctness rounds. The lessons:

- **A probe must be the size of the thing it predicts.** The first commit's probe wrote an *empty* value, so a store with room for a bare key but not for a ~1.8 KB record — a full quota, the first cause #219 named — passed it and still lost the write. `WRITE_PROBE_BYTES` is now bound on **both** sides by `T-WEB-S358`: at least the largest record the four schemas admit, under twice it. A one-sided bound would have let the probe grow until it hid controls that worked.
- **Deviating from a ticket's suggested shape is fine; leaving the reason in the PR body is not.** #219 asked the button to *say* which failure it hit; this withholds it instead, per ADR-0045's rule. That call now lives in **ADR-0054 decision 1**. Two ADRs also named the renamed symbol and a trigger the change falsified — a reviewer found them, not a grep in the plan.
- **A test caught a regression inside a review fix.** Reclaiming the orphaned probe key in `prunePlayRecords` added an unguarded `removeItem` at its entry; the suite's hostile-store case redded it immediately. It is now guarded by a read.

**Every new assertion was redded by a named production mutation** — eight of them, listed in the PR. That is now the expected standard, not a flourish.

## Next

**#209** (apps/web flakes on CI at `--concurrency=10`) is the next queued defect — reproduced locally at `--concurrency=2`, output on the issue. **#206** — duplication, 3 of 15 clusters done, cluster 4 next. **#205** stays open for the CSS half: ~1,820 lines, and it is NOT a sweep — `T-WEB-S102` asserts the *contents* of `termo-board.module.css`'s header, seven numbered deviations by token, and the work is to move that table into the test as data. Four sheets hold 1,097: termo 367, nonogram 304, arquivo 262, sudoku 164.

**One ticket still worth filing:** the play-record fixture shape is duplicated across ~22 `apps/web/test` files with no shared builder — this PR's new suite makes it ~23. Flagged by the design lens at #236 as real duplication, out of scope for a Quick change.
