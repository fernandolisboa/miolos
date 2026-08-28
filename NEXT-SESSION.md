# Do I need to do anything?

**Read [`docs/pending-fernando.md`](./docs/pending-fernando.md)** — the living ledger of everything waiting on you, in blocking order. To work through it: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*. **Nothing from this session needs you.**

## Start here

**#205's deletion half is merged (#239) and is a gate, not a campaign.** The thirty rules A–DD on that issue were about *reporting* a sweep; the tool replaced them. Read `scripts/comment-audit/README.md`, not the issue.

```sh
pnpm comments                                      # the gate: selftest, then the budget
```

**The budget is 3% of a file's lines or two lines, whichever is larger** — CLAUDE.md and [ADR-0075](./docs/adr/0075-the-comment-budget-is-a-tool-not-a-rule.md). Run `pnpm comments` for the number; do not trust a figure written down anywhere. Directives are exempt, listed in `DIRECTIVES` in `density.mjs`, and the harness reads CLAUDE.md and the README back so the three cannot drift. A **standalone** `//` counts; a trailing one does not. `{/* … */}` counts, spaces inside the braces or not. Generated files are SKIPPED and the set is pinned.

**Fernando's standing rule, 2026-08-27: a comment that explains genuinely complex code stays.** The budget is not a reason to delete one. If a file cannot fit and the comment is load-bearing, raise `FLOOR_LINES` or tighten the prose — never cut the argument. He does not want to discuss comments again.

## Session state

**#239 merged with four lenses plus a re-review round.** All four rejected the first pass (nine blockers), correctness rejected the fixes too. What that round found is worth carrying:

- **A pin that only fires on a big enough change is not a pin.** The corpus check passed because a narrowing left the file count above a magic `> 400`. Dropping all 108 files under `apps/web/src` was invisible. Compare against a freshly computed list, never a threshold.
- **Check what the fixture actually exercises.** The brace rule's fixture was `}; // trailing` — the semicolon set `hasCode`, so the rule under test never ran. Both brace clauses could be deleted with the harness green.
- **A check can pass for the wrong reason.** `--base main` exited 2 through the all-skipped path, not the flag guard. Mutate the rule, not the output.
- Two security rules had lost their only copy: `last_seen_at` must not become security-load-bearing without revisiting CSRF on GETs (now ADR-0022), and "log the message, never the error object" (now T-API-S164). **No mutation of current code reds a constraint on future code** — that class needs the ADR.

**#238 fixed and closed.** `allowImportingTsExtensions` plus the `.ts` specifier in all five vitest configs. T-WEB-S229 became the guard rather than a new test.

**CSS is the remaining ~1,820 lines and is NOT a sweep.** `T-WEB-S102` asserts the *contents* of `termo-board.module.css`'s header — seven numbered deviations, by token. The work is to move that table into the test as data. Four sheets hold 1,097: termo 367, nonogram 304, arquivo 262, sudoku 164.

## Next

**#236** (four ungated hydration gates) and **#219** are `ready-for-agent`. **#209** reproduced locally at `--concurrency=2` rather than CI's 10; output is on the issue. **#206** — duplication, 3 of 15 clusters done, cluster 4 next. **#205** stays open for the CSS half.
