# Miolos

Daily-puzzle mobile app in pt-BR — Termo-like, Sudoku, Nonogram, Binairo. One fresh puzzle per game per day, identical for every user, published by the server. Streak is the core mechanic. Solo developer, agent-driven workflow, largely driven from a phone.

**Source of truth: [`docs/handoffs/001-handoff-project-foundation.md`](./docs/handoffs/001-handoff-project-foundation.md).** Every locked product, architecture and scope decision lives there. If this file, a ticket, an ADR or a plan contradicts it, the handoff wins — surface the contradiction to Fernando rather than silently picking a side.

**Language.** English for code, filenames, commits, PRs and every document written from here on. pt-BR for user-facing product content, and for the two founding documents, which stay as written.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `fernandolisboa/miolos`, managed via the `gh` CLI. See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

The five canonical triage roles, each label string equal to its name. See [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See [`docs/agents/domain.md`](./docs/agents/domain.md).

## Pipeline

Development runs in phases. Each phase is a fresh session, started by pasting the previous phase's kickoff prompt.

1. **Spec** — `/to-spec`, using the founding handoff as its input.
2. **Tickets** — `/to-tickets`, slicing the spec into tracer-bullet vertical slices with explicit blocking edges, published to GitHub Issues.
3. **Development** — per issue, the eight-step flow below.

Once `CONTEXT.md` and ADRs exist, `/grill-with-docs` runs on every new plan. `/wayfinder` is reserved for large foggy blocks (pt-BR crosswords, monetization activation, a web version) — not for ordinary tickets.

Select the right skill automatically during development — `/tdd`, `/diagnosing-bugs`, `/code-review`, `/request-refactor-plan`, `/run` — without Fernando naming it.

## Mandatory implementation flow (eight steps)

**This flow is not optional and eight steps is the floor, not the target.** Every issue goes through all of it. Each step runs in a **freshly spawned specialised subagent with clean context** — never carry one step's context into the next.

1. **Explore** — read the codebase and any external material needed to understand the work. Read `CONTEXT.md` and every ADR touching the area first.
2. **Plan** — produce the implementation plan.
3. **Review the plan** — validate correctness, name the adjustments needed.
4. **Fix the plan** — if the review found anything.
5. **Implement** — real code, TDD at the agreed seams. Spawn parallel subagents where the work genuinely splits.
6. **Code review** — spawn **multiple** specialised reviewers in parallel, one lens each: correctness and bugs; security; quality and maintainability; performance; adherence to the ADRs and `CONTEXT.md`; adherence to the originating issue.
7. **Fix** — apply the review findings.
8. **Validate and close** — only with everything green (tests, lint, types, reviews satisfied): merge the PR and close the issue.

Adding steps is always allowed. Removing one never is. If a review at step 3 or 6 rejects, go back to the earliest step that can actually fix the cause — never patch forward over a bad plan.

## Verification gates

Fernando reviews pull requests, not code. That only works if the machine — not the agent's judgement — decides what "done" means.

**Evidence rule.** Never report a step as passing without pasting the real command output. "Should pass", "looks correct" and "I've verified" are not results. An agent that cannot run the check reports that it could not run it.

**Mechanical gate.** A PR merges only when all of these are green, with output shown:

- `pnpm typecheck` — `strict: true`, no `any` without a comment justifying it, no `@ts-ignore` without a written reason
- `pnpm lint`
- `pnpm test` — full suite
- **Property-based tests for `packages/games`** — a generator ships with its invariants proved, not sampled. Every generated Sudoku has a unique solution; every generated puzzle is solvable; seed → puzzle is deterministic.
- **Zod validation at every boundary** — API contracts and anything crossing the client/server line are parsed, never cast.
- `npx impeccable detect` — required on any change that touches UI. Visual quality is a gate, not an aspiration.
- Pre-commit (Husky + lint-staged + typecheck + tests) must stay green. Set up in M0; never bypassed with `--no-verify`.

**Adversarial review.** Step 6 reviewers default to rejecting. A finding is dismissed only with a written reason in the PR, never by silence.

**PR description.** State what changed, what was verified with the command output inline, and any decision Fernando actually needs to make. If nothing needs him, say so explicitly.

## Project invariants

Vetoes, not gaps. Do not propose working around them.

- **`packages/games` takes zero React Native and zero Node dependencies.** This is the architectural invariant of the project. Pure TypeScript, deterministic, seed in → puzzle out.
- **Dates and streaks are always `America/Sao_Paulo`**, midnight fixed for every user, no local-timezone rollover. The device clock is never a source of truth for a streak — streaks are computed server-side.
- **No virtual currency, XP, levels, loot boxes or global ranking** in v1.
- **Banner ads: never.** No ads SDK in v1 at all. Ship the dormant seams instead — `<AdSlot placement="…"/>` rendering nothing, remote feature flags, `entitlements: string[]` (an array, never a boolean).
- **The daily puzzle is free forever.** The historical archive, themes and advanced stats are the future premium inventory.
- **pt-BR only in v1**, with strings externalised for i18n from the start. No content in other languages.
- **One push notification type only** — streak at risk, opt-in requested after a 3-day streak. No marketing push.
- **No session replay** in telemetry.
- Generated images (Nano Banana) are for outside the runtime only — icon, store listing, key art. Inside the app: SVG, Skia, or code.

## Design

Direction is editorial/paper, detailed in [`docs/design/002-brief-design-direction.md`](./docs/design/002-brief-design-direction.md).

The sequence is fixed: throwaway web exploration in Claude Design (three radical variations of the "Hoje" screen plus Binairo in play) → pick a winner → `/impeccable init` records it as `PRODUCT.md` + `DESIGN.md` → tokens land in `packages/ui` → later screens are designed just-in-time per milestone against that system.

**Do not run `/impeccable init` before a winner exists.** Initialising against a placeholder produces a `DESIGN.md` describing nothing, and every later `/impeccable` run inherits that vagueness. After the winner is chosen, the anti-references in section 5 of the brief go into `DESIGN.md` verbatim as hard rules.

## Commits and branches

- **Conventional Commits**, in English: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `ci:`.
- Descriptive messages; the "why" in the body when it isn't obvious from the diff.
- One branch per issue: `<type>/<issue-number>-<slug>`.
- Never commit secrets or API keys, test ones included.
- `main` is merged into only through a pull request that passed the mechanical gate.

## Handoffs between sessions

Long work spans several sessions. At the end of a session that produces one, run `/handoff`.

**Project override:** the `/handoff` skill saves to the OS temp directory by default. In this repo, handoffs are **committed** to `docs/handoffs/` under the naming convention in [`docs/README.md`](./docs/README.md) — `NNN[-issue-<n>]-handoff-<slug>.md`. A handoff that lives in `/tmp` is lost work.

A handoff is self-contained and grounded in the real code, not in other documents: scope, what to read first, order and dependencies, non-negotiable principles, landmines, exit criteria, environment gotchas. Reference specs, ADRs, issues and commits by path or URL rather than duplicating them.

Immediately after writing it, emit a **copy-pasteable kickoff prompt** as the last block of the response — lean, pointing at the handoff rather than repeating it, so the next session starts without re-deriving context.

Pre-issue implementation plans go to `docs/plans/` under the same numbering. Both are point-in-time snapshots, never living specs.

## When in doubt

- Product or scope question → the founding handoff. It is the final word.
- Recorded technical decision → `docs/adr/`.
- Domain term → `CONTEXT.md`. Use its vocabulary in issue titles, test names and proposals; don't drift to synonyms.
- New technical decision of any weight → propose an ADR before implementing, even a short one.
- A "small improvement" nobody asked for → sanity-check it first. If it doesn't hold up, say so and drop it. Don't execute on autopilot.
