# Miolos

Daily-puzzle **web app** in pt-BR — Termo-like, Sudoku, Nonogram, Binairo. One fresh puzzle per game per day, identical for every user, published by the server. Streak is the core mechanic. Native iOS and Android follow the web launch. Solo developer, agent-driven workflow, largely driven from a phone.

**Source of truth: [`docs/handoffs/001-handoff-project-foundation.md`](./docs/handoffs/001-handoff-project-foundation.md)**, as amended by the ADRs in [`docs/adr/`](./docs/adr/). The handoff is a snapshot, not a living document: where an ADR supersedes it, the ADR wins, and the handoff's amendment table lists every such point. Everywhere else the handoff is final. If this file, a ticket or a plan contradicts either, surface the contradiction to Fernando rather than silently picking a side.

**Language.** English for code, filenames, commits, PRs and every document written from here on. pt-BR for user-facing product content, and for the two founding documents, which stay as written.

## Agent skills

### Issue tracker

Issues live as GitHub issues on `fernandolisboa/miolos`, managed via the `gh` CLI. See [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md).

### Triage labels

The five canonical triage roles, each label string equal to its name. See [`docs/agents/triage-labels.md`](./docs/agents/triage-labels.md).

### Domain docs

Single-context: `CONTEXT.md` + `docs/adr/` at the repo root. See [`docs/agents/domain.md`](./docs/agents/domain.md).

### Test ids

`T-<AREA>-[S]<n>[<letter>]` on every named test; a new series letter is opened only when the previous space has become ambiguous. See [`docs/agents/test-ids.md`](./docs/agents/test-ids.md) for the per-area frontier and the burned slots.

## Pipeline

Development runs in phases. Each phase is a fresh session, started by pasting the previous phase's kickoff prompt.

1. **Spec** — `/to-spec`, using the founding handoff **plus every ADR in `docs/adr/`** as its input. The handoff alone is pre-amendment and would produce a spec for the wrong product.
2. **Tickets** — `/to-tickets`, slicing the spec into tracer-bullet vertical slices with explicit blocking edges, published to GitHub Issues.
3. **Development** — per issue, at the tier the work earns. The eight-step flow is Tier 2, not the universal default; the routing table is below.

Once `CONTEXT.md` and ADRs exist, `/grill-with-docs` runs on every new plan. `/wayfinder` is reserved for large foggy blocks (pt-BR crosswords, monetization activation, the native clients) — not for ordinary tickets.

Select the right skill automatically during development — `just-do-it`, `small-fix`, `/implement`, `/tdd`, `/diagnosing-bugs`, `/code-review`, `/request-refactor-plan`, `/run` — without Fernando naming it.

## Implementation flows are tiered

**One flow for every task is how a typo pays a feature's ceremony.** The eight steps below are Tier 2 — they work, and every shipped feature came through them. They are not the default for everything. See [ADR-0058](./docs/adr/0058-implementation-flows-are-tiered.md).

| The work | Tier | Flow |
|---|---|---|
| Typo, comment or doc correction, dependency bump, a one-line test fix, a records-only change (an ADR status flip, a `docs/README.md` row, a frontier update) | **0 — Just do it** | One agent: branch → change → gate → PR → merge |
| A real defect, roughly ≤ 50 lines, no new decision and no new surface | **1 — Small fix** | Reproduce → fix → one reviewer, correctness lens → gate → merge |
| A vertical slice, a new surface, a schema or contract change, or anything needing an ADR | **2 — Feature slice** | The eight steps, unchanged |
| Architecture, or work whose shape is unclear | **3 — Foggy** | Find the shape first, then Tier 2 on the pieces |

### Tier 0 — Just do it

No ticket, no plan, no ADR, no handoff, no review agents. One agent: branch, make the change, run the gate, open the PR, merge. The gate still binds — that is what makes this safe. Driven with the `just-do-it` skill.

### Tier 1 — Small fix

Reproduce first: a failing test, or a pasted repro. Never a described one. Then fix, then **one** reviewer with the correctness lens, then the gate, then merge. No plan document, no ADR, no handoff. Driven with the `small-fix` skill.

### Tier 2 — Feature slice (the eight steps)

**Eight steps is the floor, not the target.** Each step runs in a **freshly spawned specialised subagent with clean context** — never carry one step's context into the next.

1. **Explore** — read the codebase and any external material needed to understand the work. Read `CONTEXT.md` and every ADR touching the area first.
2. **Plan** — produce the implementation plan.
3. **Review the plan** — validate correctness, name the adjustments needed.
4. **Fix the plan** — if the review found anything.
5. **Implement** — real code, driven with the `/implement` skill: TDD at the agreed seams, typecheck and single test files run regularly while working, the full suite once at the end. Spawn parallel subagents where the work genuinely splits. The skill is a tool inside this step, not a substitute for the flow — its own trailing code review and commit never replace steps 6–8.
6. **Code review** — spawn **multiple** specialised reviewers in parallel, one lens each: correctness and bugs; security; quality and maintainability; performance; adherence to the ADRs and `CONTEXT.md`; adherence to the originating issue.
7. **Fix** — apply the review findings.
8. **Validate and close** — only with everything green (tests, lint, types, reviews satisfied): merge the PR and close the issue.

Adding steps is always allowed. Removing one never is. If a review at step 3 or 6 rejects, go back to the earliest step that can actually fix the cause — never patch forward over a bad plan.

### Tier 3 — Foggy

`/wayfinder` or `/grill-with-docs` first, to find the shape. Then Tier 2 on the pieces it produces. Tier 3 is not a flow of its own — it is the step that turns fog into Tier 2 tickets.

### The rules that make the tiers hold

1. **Choose the tier before the work, and name it in the PR body.** A tier is a claim. If the work outgrows it, stop and re-tier rather than continuing at the wrong weight.
2. **If a ticket's process artifacts outweigh its code diff, it was the wrong tier.** It is the cheapest test we have — apply it in that form, after the fact, on every ticket.
3. **No ticket may be filed whose entire content is an observation about the test suite or the tooling.** A tracker entry needs an action. Observations go in `.claude/napkin.md`, or as an annotation on the ADR that owns the area.
4. **Handoffs at session end or milestone close, not per ticket.**
5. **Escalation is always allowed; skipping is not.** Tier 0 work that turns out to need a decision becomes Tier 2. Nothing goes *down* a tier because it is taking long.
6. **Records work — plans, handoffs, ADR annotations — is Tier 0 or 1 by default**, never Tier 2 on its own.

## Verification gates

Fernando reviews pull requests, not code. That only works if the machine — not the agent's judgement — decides what "done" means.

**Evidence rule.** Never report a step as passing without pasting the real command output. "Should pass", "looks correct" and "I've verified" are not results. An agent that cannot run the check reports that it could not run it.

**Mechanical gate.** A PR merges only when all of these are green, with output shown. **The gate binds identically at every tier** — a Tier 0 typo passes the same checks as a Tier 2 slice. That is what makes the lighter tiers safe: they drop agents and documents, never checks. Each gate binds from the ticket that introduces it — an M0 PR is not blocked by a checker that does not exist yet, but no PR may remove or weaken one that does:

- `pnpm typecheck` — `strict: true`, no `any` without a comment justifying it, no `@ts-ignore` without a written reason
- `pnpm lint`
- `pnpm test` — full suite
- **Property-based tests for `packages/games`** — a generator ships with its invariants proved, not sampled. Every generated Sudoku has a unique solution; every generated puzzle is solvable; seed → puzzle is deterministic.
- **Zod validation at every boundary** — API contracts and anything crossing the client/server line are parsed, never cast.
- `npx impeccable detect` — required on any change that touches UI. Visual quality is a gate, not an aspiration.
- Pre-commit (Husky + lint-staged + typecheck + tests) must stay green. Set up in M0; never bypassed with `--no-verify`.

**Adversarial review.** Reviewers default to rejecting — Tier 2's six step-6 lenses and Tier 1's single correctness lens alike. A finding is dismissed only with a written reason in the PR, never by silence. Tier 0 has no reviewer at all; the gate is its whole defence, which is why the routing table's Tier 0 row is a closed list rather than a judgement call.

**PR description.** State what changed, what was verified with the command output inline, and any decision Fernando actually needs to make. If nothing needs him, say so explicitly.

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

**Use current versions. Default to latest stable; never go below active LTS.** This is a security posture, not a preference — being behind is how known vulnerabilities get shipped, and the volume of disclosed supply-chain issues makes staleness an active liability rather than a neutral choice.

- When adding a dependency, check the actual current version rather than recalling one. Training data lags reality.
- Never pin to an older major "for stability" without an ADR saying why.
- Prefer fewer dependencies. The cheapest vulnerability to patch is the one you never installed.
- Keep the lockfile committed, and treat a dependency bump as ordinary work rather than a special event.

## Design

Direction is editorial/paper, detailed in [`docs/design/002-brief-design-direction.md`](./docs/design/002-brief-design-direction.md). The Claude Design exploration is done and the winner is chosen: **variation F "Ateliê"** — paper on paper, hard single-color offset shadows, washi tape per game, subtle static rotations.

The system is recorded (issue #11): `PRODUCT.md` + `DESIGN.md` at the repo root are the living design context (`/impeccable` reads them), tokens live in `packages/ui/tokens.css`, and the six high-fidelity reference frames are snapshotted in [`docs/design/006-handoff-design-winner-atelie/`](./docs/design/006-handoff-design-winner-atelie/) — open them in a browser with `support.js` beside them; they are visual specs, never production code. The anti-references in section 5 of the brief are in `DESIGN.md` verbatim as hard rules.

Later screens (Sudoku, Nonogram, Termo, archive, free play, stats, settings, onboarding) are designed just-in-time per milestone against that system.

## Commits and branches

- **Conventional Commits**, in English: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`, `ci:`.
- Descriptive messages; the "why" in the body when it isn't obvious from the diff.
- One branch per issue: `<type>/<issue-number>-<slug>`.
- Never commit secrets or API keys, test ones included.
- `main` is merged into only through a pull request that passed the mechanical gate.

## Handoffs between sessions

Long work spans several sessions. At the end of a session that produces one — or at a milestone close — run `/handoff`. **Never per ticket:** a handoff records a session's transferable state, and a ticket that fits in one sitting has none.

**Project override:** the `/handoff` skill saves to the OS temp directory by default. In this repo, handoffs are **committed** to `docs/handoffs/` under the naming convention in [`docs/README.md`](./docs/README.md) — `NNN[-issue-<n>]-handoff-<slug>.md`. A handoff that lives in `/tmp` is lost work.

A handoff is self-contained and grounded in the real code, not in other documents: scope, what to read first, order and dependencies, non-negotiable principles, landmines, exit criteria, environment gotchas. Reference specs, ADRs, issues and commits by path or URL rather than duplicating them.

**Size cap (Fernando, 2026-08-19): a handoff is at most ~120 lines, the kickoff prompt at most ~15.** Fernando reads these on a phone. A handoff that wants more length is restating records it should only point at — the detail belongs in the PR bodies, ADRs, plans and issue comments it links. Handoff 058 (345 lines) is the anti-example.

Immediately after writing it, emit a **copy-pasteable kickoff prompt** as the last block of the response — lean, pointing at the handoff rather than repeating it, so the next session starts without re-deriving context.

**The kickoff prompt is not snapshot content.** It is the one part of a handoff that is regenerated whenever the handoff gains an addendum, and it lives at the very end of the file, after any addenda, so it can never be orphaned above one. It opens with a **preflight assertion** — the expected `main` SHA and the state of every issue it names — and the instruction that if any of that does not match, the session stops and reads the newest addendum before doing anything else.

Pre-issue implementation plans go to `docs/plans/` under the same numbering. Both are point-in-time snapshots, never living specs.

## Writing for Fernando

English is not Fernando's first language. Plain words, short sentences, no flourishes. Anything that asks him for input — a PR decision point, a grilling question, a wizard step — must be answerable in one word or one line, multiple-choice where possible, and must say plainly what happens under each choice.

Do not bring him UI/UX choices. Layout, copy wording, spacing, ordering and the like are professional design decisions (Fernando, 2026-08-19): make them with the design system, measurement, `/impeccable` and screenshots, and record the call and its reason on the issue. Bring him product scope, money, legal, and anything only he can do (credentials, store listings, production actions).

## When in doubt

- Product or scope question → the founding handoff, as amended by the table at its top. Where an ADR supersedes it, the ADR is the final word; everywhere else the handoff is.
- Recorded technical decision → `docs/adr/`.
- Domain term → `CONTEXT.md`. Use its vocabulary in issue titles, test names and proposals; don't drift to synonyms.
- Which flow a piece of work takes → the routing table in § *Implementation flows are tiered*. When two rows both look right, take the heavier one; escalating later is free, and skipping is not.
- New technical decision of any weight → propose an ADR before implementing, even a short one. It stays `Proposed` until the PR that ships its code flips it to `Accepted` in that same diff — owner, forms and edge cases in [`docs/agents/domain.md`](./docs/agents/domain.md).
- A "small improvement" nobody asked for → sanity-check it first. If it doesn't hold up, say so and drop it. Don't execute on autopilot.
