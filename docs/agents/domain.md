# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **single-context**.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

If this repo ever splits into multiple bounded contexts, the switch is a `CONTEXT-MAP.md` at the root pointing at one `CONTEXT.md` per context, with context-scoped decisions under `src/<context>/docs/adr/`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

## ADR status lifecycle

Line 3 of every ADR is its status line, and the status lives nowhere else — no separate `Date:` line, no status in the H1:

    **Status:** <Proposed | Accepted | Superseded | Withdrawn> — <YYYY-MM-DD> (issue #N[, shipped in #PR])

The date is the `America/Sao_Paulo` day on which the ADR reached that status; it moves only when the status moves.

- **Proposed** — drafted with the plan (steps 2–4); the implementing code is not on `main`. Dated with the drafting day, `(issue #N)`. It may sit on `main` only while its code genuinely has not merged — the first PR of a two-PR ticket, or a decision recorded ahead of its ticket.
- **Accepted** — the implementing code is on `main`; a decision-only ADR (no code of its own — the shape of ADR-0001–0015) is `Accepted` when the PR carrying it merges. **Owner and trigger: the agent driving that PR writes the flip into the PR's own diff before its final review round** — `Accepted — <merge day> (issue #N, shipped in #PR)`, dated with the expected merge day and corrected in the same PR if the merge slips; the merge discharges it. Every `Accepted` line written under this rule carries `shipped in #PR`, born-`Accepted` ADRs included. A ticket shipping as several PRs flips on the one that completes the code and cites them all (`shipped in #94 and #95`, ADR-0053). Later corrections are amendments and do not move the date (ADR-0057: `shipped in #117`; #118/#120 annotated it).
- **Superseded** — a later ADR replaces the decision **as a whole**: `Superseded — <date> (issue #N; by [ADR-NNNN](…), shipped in #PR)`, flipped in the PR that ships the superseding ADR, which carries `**Supersedes:** [ADR-MMMM](…)`. **Partial supersession keeps `Accepted`**: the older ADR gains `**Superseded in part by:** [ADR-NNNN](…) (<which part>)`, the newer the reciprocal `**Supersedes in part:** [ADR-MMMM](…) — <which part>` (ADR-0001 ↔ ADR-0003). Prefer `**Amended by:**` when a sentence is narrowed or corrected, `**Superseded in part by:**` when a whole clause is replaced.
- **Withdrawn** — a `Proposed` ADR whose code will not merge: `Withdrawn — <date> (issue #N; <one-line reason>)`, flipped by the PR that abandons it, or by a docs-only PR when the ticket closes with no PR. The file is kept — a recorded rejection is a decision too. `Proposed` only; a reversed `Accepted` decision is `Superseded` by the reversing ADR.

**Amendment changes neither status nor date.** `**Amends:**` on the amending ADR, the reciprocal `**Amended by:**` plus an in-place annotation on the amended one (ADR-0055 ↔ ADR-0057), in the same commit.

**Pre-rule ADRs.** ADR-0001–0045, 0048, 0049 and 0051 were born `Accepted` in the PR that carried them (docs-only for 0001–0015, the code PR for the rest) and keep their drafting day, within one day of that merge, with no `shipped in`. ADR-0046, 0047, 0050 and 0052–0057 were flipped by #116 with the merge day and PR. ADR-0001's `Superseded in part by:` pointer to ADR-0004 is a pre-rule label, kept as written.

**Who checks.** The step-6 "adherence to the ADRs and `CONTEXT.md`" reviewer, against the PR: every ADR whose code is in the PR carries the flip in the PR; every ADR the PR amends carries the reciprocal header; anything left `Proposed` genuinely has no code on `main`. No mechanical checker — "shipped" is not derivable from the file, and the field went stale once, for one systemic reason (no owner), which naming the owner removes; a second sweep finding a shipped ADR still `Proposed` is the trigger to add one, and `shipped in #PR` is what would make it cheap.
