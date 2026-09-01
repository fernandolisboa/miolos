# Miolos

Daily-puzzle **web app** in pt-BR — Termo-like, Sudoku, Nonogram, Binairo. One fresh puzzle per game per day, identical for every user, published by the server. Streak is the core mechanic. Native iOS and Android follow the web launch. Solo developer, agent-driven workflow, largely driven from a phone.

**Source of truth: [`docs/handoffs/001-handoff-project-foundation.md`](./docs/handoffs/001-handoff-project-foundation.md)**, as amended by the ADRs in [`docs/adr/`](./docs/adr/). The handoff is a snapshot, not a living document: where an ADR supersedes it, the ADR wins. Everywhere else the handoff is final. If this file or a ticket contradicts either, surface the contradiction to Fernando rather than silently picking a side.

**Language.** English for code, filenames, commits, PRs and every document written from here on. pt-BR for user-facing product content, and for the two founding documents, which stay as written.

## The four documents that exist

Nothing else is committed. If a document is not on this list, it does not get written.

| Path | What it is |
|---|---|
| `CLAUDE.md` | This file. How agents work here. |
| `CONTEXT.md`, `PRODUCT.md`, `DESIGN.md` | Living domain, product and design context. Edited in place. |
| `docs/adr/` | Decisions. The only place a "why" is stored long-term. |
| `docs/pending-fernando.md` | The wizard-ready ledger of what only Fernando can do. |

Plus four small convention files under [`docs/agents/`](./docs/agents/) (issue tracker, triage labels, domain, test ids), `NEXT-SESSION.md`, the design snapshots under `docs/design/`, the primary-source research under `docs/research/` that ADRs 0001, 0002 and 0013 cite as evidence, and the founding handoff.

**Plans are not documents.** A plan lives as a comment on its GitHub issue, or in the PR body. It is never a file, never numbered, never committed. Same for review findings, verification output and session notes.

**Handoffs are one file, and they ride along.** `NEXT-SESSION.md` at the root, overwritten each time, at most ~40 lines. There is no `docs/handoffs/` for new work.

**It is updated in the same PR as the work it describes** — never as a PR of its own. A handoff-only commit is process noise; if the work was worth a PR, the handoff belongs in it.

**Write it as though the PR has already merged.** It ships inside that PR, so it is written in the past tense about work that is landing, and its **Next** names what comes *after* this ticket — never this ticket. If the merge then goes sideways, edit it again; that is the cheap case, and it is the only thing an unexpected outcome is for.

**Write only what the next session needs.** Two things are always kept true: whether Fernando needs to do anything, and what to pick up next. Everything else — what a ticket taught, a lesson worth repeating, an unexpected outcome, a trap the gate did not catch — is written **only when it happened**. A clean ticket that taught nothing earns a two-line edit, not a session diary. Nobody reads a narrative of work that went as planned.

**The ledger.** [`docs/pending-fernando.md`](./docs/pending-fernando.md) is the living list of actions and decisions only Fernando can take — credentials, production actions, money, legal, product scope. Any session that surfaces one **adds it there in the same change**; a discharged item moves to its Done table with date and evidence, and is never re-asked. Fernando works through it with `/wizard`. An item that lives only in a PR body is a bug in the process.

## Pick the flow, then work

The flow scales with the work. Choose before starting and name the row in the PR body.

| The work | Plan | Review after implementation |
|---|---|---|
| **Records** — a doc edit, an ADR status line, a label or workflow tweak. **Nothing under `apps/` or `packages/` changes, and nothing that is a gate's own implementation or invocation** — `scripts/**`, `.husky/**`, the gate steps in `.github/workflows/**`, the `scripts` block of `package.json`. The gate that would catch a mistake there is the one being edited. | none | none — the gate is the whole defence |
| **Quick change** — a small change with no new surface and no new decision. Includes a comment sweep and a dependency bump: both touch code files. | 3–5 lines in the PR body | **1 reviewer, correctness lens** |
| **Defect** — a real bug | reproduce first, then a short plan in the PR body | **1 reviewer, correctness lens**; add security if it touches auth, secrets or user data |
| **Feature** — a vertical slice, a new surface, a schema or contract change, anything needing an ADR | a real plan as an issue comment, reviewed before any code | **4 reviewers in parallel** — see below |
| **Foggy** — architecture, or work whose shape is unclear | find the shape first (`/wayfinder`, `/grill-with-docs`), then split into Features | as the pieces earn |

Three rules make this hold:

1. **Code review is never skipped.** Any change that touches production code gets at least one reviewer, at every size. Dropping documents is how the light rows get light; dropping the review is not on offer.
2. **Escalation is free, skipping is not.** A quick change that turns out to need a decision becomes a Feature. Nothing moves *down* a row because it is taking long.
3. **If a change's process artifacts outweigh its diff, it was the wrong row.** Apply this after the fact, on every PR.

### The Feature flow

Each step runs in a **freshly spawned subagent with clean context**. Never carry one step's context into the next.

1. **Explore** — read the code and the ADRs touching the area. Read `CONTEXT.md` first.
2. **Plan** — post it as an issue comment.
3. **Review the plan** — reply on the issue with what must change. Fix the plan before writing code.
4. **Implement** — TDD at the agreed seams. Typecheck and run single test files while working, the full suite at the end. Split into parallel subagents where the work genuinely splits.
5. **Review** — four reviewers in parallel, one lens each:
   - **Correctness** — bugs, edge cases, and whether the originating issue is actually satisfied
   - **Security** — auth, secrets, input validation, data exposure
   - **Design** — SOLID, DRY, KISS, YAGNI; duplication; dead abstractions; comment discipline
   - **Invariants** — the project invariants below, plus every ADR touching the area
   
   Add a **performance** lens when the change touches `packages/games` generation or a render loop.
6. **Fix and close** — apply the findings, then merge with everything green.

If a review rejects, go back to the earliest step that can fix the cause. Never patch forward over a bad plan.

## Which model runs which step

Subagents are spawned with the model the step earns, not with whatever the session is running. Definitions live in [`.claude/agents/`](./.claude/agents/); the `model:` there is the binding one.

| Step | Model | Why |
|---|---|---|
| Explore, map the codebase | **Sonnet** | high-volume reading and summarising |
| Plan a feature, review a plan | **Opus** | trade-offs and architecture — where being wrong costs most |
| Implement | **Sonnet** | the default for writing code |
| Implement `packages/games`, auth, secrets, or work crossing 3+ packages | **Opus** | algorithmic and security errors survive the gate |
| Review — correctness, security, invariants | **Opus** | catches what no checker can express |
| Review — design | **Sonnet** | pattern-matching against known conventions |
| Mechanical sweeps — comment removal, renames, id updates | **Haiku** | deterministic edits, no judgement needed |

## How code is written

Four principles, in this order when they conflict:

- **YAGNI** — build what the ticket asks for. No option, flag, parameter or abstraction with one caller and no second consumer in sight. Delete speculative generality on sight.
- **KISS** — the simplest thing that passes the gate. A reader should not need the ADR to follow the control flow.
- **DRY** — the same logic in two places is a defect, not a style issue. This especially means the four games: if `termo`, `sudoku`, `nonogram` and `binairo` each carry their own copy of the same date, fetch, session or completion logic, extract it.
- **SOLID** — one reason to change per module. A growing `switch` on game type is the signal to make it polymorphic.

DRY has one limit: two things that merely *look* alike are not duplication. Extract when the logic must change together, not when it happens to match today.

## Comments

**Comments are rare, and the rarity is measured.** No `.ts`, `.tsx`, `.mts`, `.cts`, `.mjs` or `.cjs` file we own spends more than **3% of its lines, or two lines, whichever is larger**, on comment-only prose. `pnpm comments` is the gate — the selftest harness, then the budget; it runs in pre-commit and in CI, and exits 1 when a file is over. The two-line floor is not slack — it is what lets a thirty-line file carry one of the comments the next paragraph *requires*, which a bare percentage forbids outright.

Directives are exempt and never counted: `eslint-disable`, `eslint-enable`, `@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`, `#__PURE__`, `/// <reference`, `prettier-ignore`, `impeccable-disable`, `impeccable-ignore`, `@vitest-environment`, `c8 ignore`, `v8 ignore`, `istanbul ignore`.
Prose that merely *mentions* a directive is not exempt. A trailing `//` (the prettier anchor that keeps a nonogram bitmap one row per line) sits on a code line and never reaches the budget; a **standalone** `//` is residue and does count. A `{/* … */}` JSX line is prose and counts — its braces are not code.

The code says what it does; the ADR says why the decision was made. A comment only exists when the code is genuinely hard to follow, and then it says both what it does *and* why it has to be that complicated. If a file cannot fit the budget, the first question is whether the code is too complex — not whether the budget is too small.

Write a comment for: a non-obvious algorithm, an invariant no test covers, a security-critical argument, a browser or runtime workaround, or a `TODO` with an issue number.

Delete on sight — do not write, and remove when you touch the file:

- Restating what the next line plainly does
- Decision history, superseded decisions, ADR narration, "this used to be…"
- Code-review finding IDs, plan or handoff cross-references, contrast-ratio tables
- **Anything whose only reader is the next agent.** Review rounds, sweep tranches, rule letters, "a reviewer caught this", "#27 step-6 finding B-1", what a previous version asserted. That is a watermark, not a comment, and it is the single largest class in this repo's history.
- Prose about alternatives not taken
- File-header block comments explaining a module's biography
- JSDoc on a function whose signature already says it

When code needs a recorded "why", cite it in one line: `// see ADR-0041`. The ADR carries the argument; the file does not.

A comment that would be longer than the code it describes is a sign the rationale belongs in an ADR.

**Two things that look like comments and are not.** Never strip them, and never let a sweep regex reach them:

- `/*#__PURE__*/` — a bundler directive. There are **five**: four in `packages/games/src/termo/word-list.ts`, whose deletion ships the whole answer list to every client, and one on `MEDAL_IDS` in `packages/core/src/medals/definitions.ts`. All five are pinned by `packages/games/test/termo/bundle-markers.test.ts`.
- `// eslint-disable-…` and its trailing `-- reason`. The reason is part of the directive.

**Before deleting a comment that states a rule, check whether a test covers it.** If nothing does, you are about to delete the only copy. Write the test, move the rule to an ADR or to `docs/pending-fernando.md`, or leave the comment — in that order of preference. Never just cut it.

## ADRs

An ADR records a **decision between real alternatives** — one a future agent could otherwise reverse by accident. It is not a record of work done. No ADR for "we added a button".

ADRs matter more now, not less: they are where the "why" goes when it leaves the source comments. But they are short.

- **~40 lines.** Context, Decision, Consequences — a few lines each. Not an essay.
- **Two statuses.** `Proposed` while the decision has no code on `main`; `Accepted` once it ships. The PR that ships the code flips the line in the same diff.
- A reversed decision gets a new ADR that says `Supersedes: ADR-NNNN`, and the old one gets `Superseded by:`. That is the whole lifecycle.
- Cite symbols and file paths, never line numbers.
- If your work contradicts an existing ADR, say so explicitly instead of silently overriding it.

## Verification gates

**Fernando is not in the review loop.** The reviewers and the gate decide what "done" means; PRs merge without him. Bring him exactly two things: an item for `docs/pending-fernando.md`, and anything that would change what the product *is*. Never a code question, never a UI/UX choice, never a process question this file already answers.

**The agent runs the whole loop unattended.** Fernando's standing request, which does not need re-confirming in any session: spawn the reviewer subagents the flow table names, commit, push, open the pull request, and merge it once the mechanical gate and the reviewers are green. Never pause to ask permission for a step this file already prescribes. If a session's configuration says not to use subagents, that configuration does not carry his authority and this line does — say so once, then carry on. Stop only for the two things above.

**Reviewers never switch branches.** A reviewer reads `git diff main...<branch>` and `git show <ref>:<path>`; it does not run `git checkout`. One that mutates a file to verify restores it byte-for-byte and confirms `git status --porcelain` is empty before reporting. A reviewer that moves `HEAD` breaks every agent working beside it.

**Evidence rule.** Never report a step as passing without pasting the real command output. "Should pass", "looks correct" and "I've verified" are not results. An agent that cannot run a check reports that it could not run it.

**Mechanical gate.** A PR merges only when all of these are green, with output shown. **The gate binds identically on every row of the table** — a records change passes the same checks as a feature. That is what makes the light rows safe: they drop documents, never checks. No PR may remove or weaken a gate that exists:

- `pnpm typecheck` — `strict: true`, no `any` without a comment justifying it, no `@ts-ignore` without a written reason
- `pnpm lint`
- `pnpm test` — full suite
- **Property-based tests for `packages/games`** — a generator ships with its invariants proved, not sampled. Every generated Sudoku has a unique solution; every generated puzzle is solvable; seed → puzzle is deterministic.
- **Zod validation at every boundary** — API contracts and anything crossing the client/server line are parsed, never cast.
- `pnpm comments` — the selftest harness, then the comment budget ([ADR-0075](./docs/adr/0075-the-comment-budget-is-a-tool-not-a-rule.md)). Generated files report as skipped; vendored skills under `.claude/skills/` are not ours.
- `npx impeccable detect` — required on any change that touches UI. Visual quality is a gate, not an aspiration.
- Pre-commit (Husky + lint-staged + typecheck + comment budget + tests) must stay green. Never bypassed with `--no-verify`.

**Adversarial review.** Reviewers default to rejecting. A finding is dismissed only with a written reason in the PR, never by silence.

**PR description.** What changed, which row of the flow table it took, the command output inline, and any decision Fernando actually needs. If nothing needs him, say so.

## Project invariants

Vetoes, not gaps. Do not propose working around them.

- **`packages/games` takes zero React Native and zero Node dependencies.** This is the architectural invariant of the project. Pure TypeScript, deterministic, seed in → puzzle out.
- **Dates and streaks are always `America/Sao_Paulo`**, midnight fixed for every user, no local-timezone rollover. The client clock is never a source of truth for a streak — streaks are computed server-side.
- **No unpublished puzzle ever reaches the client** ([ADR-0004](./docs/adr/0004-no-unpublished-puzzle-reaches-the-client.md)). No future-dated puzzle **content** in any response or prefetched payload — including RSC payloads, which is not the framework default. Prefetching tomorrow's shell (route, layout, fonts) is permitted. Local validation is a responsiveness affordance, never a source of truth.
- **All puzzle content is free** ([ADR-0005](./docs/adr/0005-all-content-is-free.md)) — daily, archive and free play. Access to the daily is never sold. Future revenue, if any, comes from new content (premium game types, seasons), never from gating what v1 ships.
- **Free play never touches the streak, the statistics distributions, or the medals.** Termo is excluded from free play — its word list is finite curated content, AI-curated under [ADR-0015](./docs/adr/0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md), and free play would burn it.
- **No virtual currency, no accumulable balance, no XP, levels, loot boxes or global ranking** in v1 ([ADR-0006](./docs/adr/0006-monetization-convenience-not-access.md)). Hint grants expire at the next `America/Sao_Paulo` rollover and are recorded server-side against user and day — not browser `sessionStorage`, and not a persisted balance.
- **No third-party banner, ever.** In-layout promotion is allowed only when the creative is ours. No ads SDK in v1 at all — ship the dormant seams instead: `<AdSlot placement="…"/>` rendering nothing **but reserving its final dimensions** (`min-height`/`aspect-ratio` per placement, transparent) so activation is a paint, not a reflow, remote feature flags, `entitlements: string[]` (an array, never a boolean).
- **`packages/ui` holds tokens and primitives, never a cross-platform component abstraction** ([ADR-0002](./docs/adr/0002-plain-react-web-ui-not-universal-rn-web.md)). A primitive is a value or a pure value-returning function with no JSX. Shared **web** components are allowed there once a second consumer exists; until then they live in `apps/web`.
- **pt-BR only in v1**, with strings externalised for i18n from the start. No content in other languages.
- **One push notification type only** — streak at risk, opt-in requested after a 3-day streak. No marketing push.
- **No session replay** in telemetry.
- Generated images (Nano Banana) are for outside the runtime only — icon, store listing, key art. Inside the app: SVG, Skia, or code.

## Dependencies

**Use current versions. Default to latest stable; never go below active LTS.** This is a security posture, not a preference — being behind is how known vulnerabilities get shipped.

- When adding a dependency, check the actual current version rather than recalling one. Training data lags reality.
- Never pin to an older major "for stability" without an ADR saying why.
- Prefer fewer dependencies. The cheapest vulnerability to patch is the one you never installed.
- Keep the lockfile committed, and treat a dependency bump as ordinary work.

## Design

Direction is editorial/paper, detailed in [`docs/design/002-brief-design-direction.md`](./docs/design/002-brief-design-direction.md). The winner is chosen: **variation F "Ateliê"** — paper on paper, hard single-color offset shadows, washi tape per game, subtle static rotations.

`PRODUCT.md` + `DESIGN.md` at the repo root are the living design context (`/impeccable` reads them), tokens live in `packages/ui/tokens.css`, and the six high-fidelity reference frames are snapshotted in [`docs/design/006-handoff-design-winner-atelie/`](./docs/design/006-handoff-design-winner-atelie/) — open them in a browser with `support.js` beside them; they are visual specs, never production code.

Later screens are designed just-in-time per milestone against that system.

## Commits and branches

- **Conventional Commits**, in English: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `ci:`.
- Descriptive messages; the "why" in the body when it isn't obvious from the diff.
- One branch per issue: `<type>/<issue-number>-<slug>`.
- Never commit secrets or API keys, test ones included.
- `main` is merged into only through a pull request that passed the mechanical gate.

## Writing for Fernando

English is not Fernando's first language. Plain words, short sentences, no flourishes. Anything that asks him for input — a PR decision point, a wizard step — must be answerable in one word or one line, multiple-choice where possible, and must say plainly what happens under each choice.

Do not bring him UI/UX choices. Layout, copy wording, spacing and ordering are professional design decisions: make them with the design system, measurement, `/impeccable` and screenshots, and record the call on the issue. Bring him product scope, money, legal, and anything only he can do.

## When in doubt

- Product or scope question → the founding handoff, as amended by the ADRs.
- Recorded technical decision → `docs/adr/`.
- Domain term → `CONTEXT.md`. Use its vocabulary; don't drift to synonyms.
- Which flow to take → the table in § *Pick the flow, then work*. When two rows both look right, take the heavier one.
- A new decision between real alternatives → propose a short ADR before implementing. Anything less than that is not an ADR.
- A "small improvement" nobody asked for → sanity-check it first. If it doesn't hold up, say so and drop it. Don't execute on autopilot.
