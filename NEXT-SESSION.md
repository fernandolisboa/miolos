# Do I need to do anything?

**Read [`docs/pending-fernando.md`](./docs/pending-fernando.md)** — the living ledger of everything waiting on you, in blocking order, kept current by every session. To work through it: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

Everything else is agent-owned — plans, reviews, fixes and merges happen without you. **Nothing from this session needs you.**

## Start here

**Read ALL rule comments on #205 before sweeping anything**, oldest first — Rules A–AA. The newest settles a question three PRs in one session answered three different ways:

- **Rule Z.** A **surviving** comment block keeps its issue number; a block **deleted in full** takes its number with it. `records.mjs` matches `(#27, plan 022 §14.4)` as ONE unit — `plan \d+` is an `INNER` token, `#\d+` is not — so the tool takes the issue number with the citation unless you stop it by hand. Tranche #227 stopped it; #230, #231 and #232 each failed to, and each needed a review round to catch it. Census on `main`: **17 keep, 0 strip.**
- **Rule AA.** `markers.mjs` reporting `0` is **not** a clean file. `records.mjs`'s `INNER` holds `step-\d+` with a hyphen, so the space form `(#142 step 7)` — live in all four daily hooks — is invisible to both `markers.mjs` and `citations.mjs`.

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

**#205 — comment removal. Tranche 7b is three-quarters done.** Merged this session:

| PR | scope | comment-only lines |
|---|---|---|
| #230 | the four boards + four control surfaces | 690 → 547 |
| #231 | the four `play-view.tsx` + three `*-free-screen.tsx` | 624 → 409 |
| #232 | the four `use-*-play.ts` + three `use-free-*.ts` | 491 → 467 |

**1,805 → 1,423, −21%**, zero code changed anywhere, proved by AST print hash. Against tranche 6's 59% on `src/play` — the game dirs are mass, not genre, exactly as 7b-1 measured.

**7b's remainder is 902 comment-only lines** across the four `*-screen.tsx`, the two `engine.ts`, `termo/guess-client.ts`, `termo/types.ts` and the two conclusions. Then **7c** (the four game `.module.css`, **911** by `css-count.mjs`), then **7d** (`src/archive`, `src/components`, and the six `src/free-play` files the screen and hook tranches left). `app/`+`scripts/`, `test/` and `eslint.config.mjs` are tranche 8.

**Sweep by FILE ROLE across all four games** (Rule N) — that is what made these three tranches work, and 7b-3's scope came from a shingle hit, not from the directory listing.

**#206 — duplication, 3 of 15 clusters done.** Cluster 4 next, in the issue's table order. The issue's "1,477 lines" is stale — #220 cut it to **888**.

**#209** — the `apps/web` CI flake — is diagnosed but unfixed; it has not reproduced in four sessions. **#219** — read-only-but-not-writable store — is `defect` + `ready-for-agent`.

## What this session cost, so the next one budgets for it

Three PRs, **twenty-four review rounds**. The sweeps were cleared on nineteen of them. **Every rejection but four was a sentence in a PR body**, and the four real ones are worth knowing:

1. A **live `C1` test pointer** excised as if it were a plan-assertion id. A bare `[A-Z]\d+` is not always records — grep the suite first.
2. An **automated comment reflow ate three `eslint-disable-next-line` directives**, and a `*/`. `hash.mjs`'s directive counter caught it; `pnpm lint` would have surfaced it as an unrelated failure in already-reviewed files. **Never reflow across a directive line, and never let a comment-line regex match `*/`.**
3. A **test comment cited eight deleted blocks by filename and count** ("asserted as fact from NINE doc blocks"). Neither `shingle.mjs` nor a `file.tsx:N` grep can see that shape — grep the *filename* too.
4. The three **Rule Z** strips above.

Two process traps that each cost a round: a **stale local `main` ref** made a pasted `numstat` show sixteen files from an already-merged PR; and a **body-patch script aborted mid-run**, silently discarding its edits, so three "regenerated" blocks were still stale. Verify with a grep after writing, not by trusting the write.

**A reviewer symlinked the repo's `node_modules` into a git worktree and ran `pnpm` there**, which rewrote the real install's `virtualStoreDir` to a `/tmp` path and broke pre-commit. Repaired with `CI=true pnpm install --frozen-lockfile`. Give a review worktree a 1-line shim `package.json` under `node_modules/typescript` instead.

**Still owed:** the ragged-wrap check three PRs published inline is not a committed tool. It caught four defects — every one introduced by a *fix* commit — and needs a markdown line-selector as well as the comment one, since two of the four were orphans inside Accepted ADRs. `selftest.mjs` assertions come with it.
