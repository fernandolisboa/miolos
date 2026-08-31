# Do I need to do anything?

**Yes — one 5-minute setup step.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) NOW §2: a SessionStart hook that carries your standing request into every session. An agent cannot install it — the auto-mode classifier blocks writing to `~/.claude/hooks/`, correctly. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

**Claude Code injects an instruction that overrides `CLAUDE.md`.** A system-prompt section named `heron_brook` says *"Do not call the AgentTool unless the user requested it"*. It is gated on the Opus 5 capability `opus_5_prompt_bundle`, lives in no config file, and `/config` cannot reach it. Upstream: [#80988](https://github.com/anthropics/claude-code/issues/80988), [#82371](https://github.com/anthropics/claude-code/issues/82371), both open.

It cost a full session's flow before anyone noticed. `CLAUDE.md` § *Verification gates* now carries **"The agent runs the whole loop unattended"** — spawn the reviewers, commit, push, open the PR, merge when green, never ask. **That paragraph alone does not win**; #82371 is the report that it loses. The hook in NOW §2 is what actually clears the line, because the injected text's own escape is *"unless the user requested it"*.

## Session state

**#236 merged (#241): the four ungated hydration gates now have `T-WEB-S356` and `T-WEB-S357`.** Four review rounds on a test-only PR. The three lessons are worth more than the diff:

- **A static server render never reads the play-record store.** So no deletion of a hydration gate can make a record-derived value appear, and every `not.toContain(<a record value>)` written to prove otherwise was structurally incapable of failing. What carries the claim is `expect(getItem).not.toHaveBeenCalled()` — falsifiable, proven by injecting a render-time `readPlayRecord`.
- **A justification for keeping an assertion is itself reviewable.** Round 3 kept `data-play-state="concluded"` on a `priorCache` argument and wrote it into `docs/agents/test-ids.md`. Round 4 disproved it in five minutes — made `priorSnapshot` throw, all three cases still passed — because `renderToStaticMarkup` takes `useSyncExternalStore`'s `getServerSnapshot`. A convention file recording a false mechanism is worse than a dead test line.
- **`git checkout` in a reviewer breaks everyone beside it.** One left the tree on `main` mid-session. All four `.claude/agents/reviewer-*.md` now forbid it; so does `CLAUDE.md`.

**Before adding a `not.toContain`, render the thing it guards against and confirm the string really appears.** `reviewer-correctness` now treats an assertion that cannot fail as blocking.

**CSS is still the remaining ~1,820 lines of #205 and is NOT a sweep.** `T-WEB-S102` asserts the *contents* of `termo-board.module.css`'s header — seven numbered deviations, by token. The work is to move that table into the test as data. Four sheets hold 1,097: termo 367, nonogram 304, arquivo 262, sudoku 164.

## Next

**#219** (read-only-but-not-writable store leaves the share button dead) is `ready-for-agent` and was the next one queued. **#209** reproduced locally at `--concurrency=2` rather than CI's 10; output is on the issue. **#206** — duplication, 3 of 15 clusters done, cluster 4 next. **#205** stays open for the CSS half.

**One ticket worth filing:** the play-record fixture shape is duplicated across ~22 `apps/web/test` files with no shared builder. The design lens flagged it as real duplication but out of scope for a Quick change.
