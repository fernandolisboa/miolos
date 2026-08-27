# Do I need to do anything?

**Read [`docs/pending-fernando.md`](./docs/pending-fernando.md)** — the living ledger of everything waiting on you, in blocking order. To work through it: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*. Everything else is agent-owned. **Nothing from this session needs you.**

## Start here

**Read ALL rule comments on #205 before sweeping anything**, oldest first — Rules A–DD. The three newest cost ten review rounds, and nine of the ten found a wrong figure in a durable record rather than a defect in a diff:

- **Rule BB.** A figure in a record is invalidated by any change to the thing it measures — **including the change that is fixing it**. After every fix re-derive *every* figure the record carries, not the ones the review named. Prefer a **delta**; anchor an unavoidable absolute to a ref and publish the command.
- **Rule CC.** An attribution is a claim about a test. **Delete the code the comment defends and run the suite.** #235 attributed eight hydration gates to five ids and four were ungated — `T-WEB-S94` asserts *after* `act()` and never sees the first paint.
- **Rule DD.** A restore is byte-identical or it is declared.

```sh
node scripts/comment-audit/selftest.mjs            # after touching any tool — 131 assertions
node scripts/comment-audit/shingle.mjs <targets>   # Rule A, BEFORE sweeping
node scripts/comment-audit/count.mjs <targets>     # the baseline
node scripts/comment-audit/hash.mjs <targets>      # zero code changed
node scripts/comment-audit/excision.mjs <targets>  # what the PR body declares
node scripts/comment-audit/wrap.mjs <targets>      # what an excision left ragged — pass .md too
node scripts/comment-audit/markers.mjs <files>     # what to sweep next
```

`README.md` names what each tool **cannot** see. `css-count.mjs` is for 7c.

## Session state

**#205 — tranche 7b is CLOSED and the four game directories are fully swept, 3,071 → 2,320.** #234 committed the ragged-wrap tool and Rule AA's `step[- ]\d+`; #235 took the fourteen files 7b-1…3 left, **1,032 → 732**.

**7c is next and it is a CITATION tranche, not a deletion one.** The four game `.module.css` are **911** lines by `css-count.mjs`, but `T-WEB-S102` reads `termo-board.module.css`'s header **raw** and asserts its seven numbered deviations by token — ~90 of that sheet's 367 lines cannot be cut without changing the test. The value there is **18 line anchors** (Rule L), enumerated in the #205 comment; CSS has no symbols, so the target is the selector that owns the rule.

**7d lost the four archive screens** (#235 swept them, by Rule N): it is `src/archive`'s remainder, `src/components`, and the six `src/free-play` files. `app/`+`scripts/`, `test/` and `eslint.config.mjs` are tranche 8.

**#236 is new and `ready-for-agent`** — four of the eight play-screen roots have an ungated hydration gate, mutation table in the issue; `T-WEB-S172` is the shape the four missing tests want.

**#206 — duplication, 3 of 15 clusters done.** Cluster 4 next, in the issue's table order; its "1,477 lines" is stale, #220 cut it to **888**. **#209** (the `apps/web` CI flake) is diagnosed but unfixed and has not reproduced in five sessions. **#219** is `defect` + `ready-for-agent`.

## What this session cost, so the next one budgets for it

Two PRs, **ten review rounds**, one of which found a defect in a diff. Budget the sweep at a fraction of the write-up. Two habits would have saved four rounds: **generate the PR body's numbers after the last commit, never before** — every fix moved them — and **run the mutation before writing the attribution**, not after a reviewer asks.

One process trap: a review agent running `pnpm test` in the checkout blocks the next tranche's edits for the whole round. Prepare the next sweep in `/tmp` while a review runs, then apply it in one go. Do **not** reach for a git worktree — the napkin records what that cost.
