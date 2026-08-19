# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase, and how the ADR status field is maintained.

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

## Cite symbols, not lines

When an ADR, plan or agent doc cites code, cite the **symbol** — a function, export, test id (`normalizeWord`, `T-WEB-S43`) — plus its file path, never a line number. Lines move on every edit; a symbol moves only when the thing it names changes. This has been the working convention since handoff 048 §4; the ~90 stale line citations in ADRs 0016–0044 are the cost of the old form (#78). A deliberately historical citation is allowed only with an explicit as-of-writing annotation (ADR-0043's is the model).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

## ADR status lifecycle

Line 3 of every ADR is its status line; status and date live nowhere else (no `Date:` line, no status in the H1). The date is the `America/Sao_Paulo` day the ADR reached that status and moves only when the status moves. The four forms:

```
**Status:** Proposed — <drafting day> (issue #N)
**Status:** Accepted — <merge day> (issue #N, shipped in #PR)
**Status:** Superseded — <merge day> (issue #N; by [ADR-NNNN](…), shipped in #PR)
**Status:** Withdrawn — <merge day> (issue #N; <one-line reason>)
```

- **Proposed** — drafted with the plan (steps 2–4); its code is not on `main`. It stays `Proposed` on `main` only while that holds — the first PR of a two-PR ticket.
- **Accepted** — its code is on `main`; a decision-only ADR (no code of its own, e.g. ADR-0001–0015) when the PR carrying it merges, and a later ticket that implements it leaves its status alone. **Owner:** the agent driving that PR writes the flip into the PR's diff at step 5, with the code, dated with the day the PR is expected to merge and re-dated on the PR's last push if that day has changed. A ticket shipping as several PRs flips on the one that completes the code and cites them all (`shipped in #94 and #95`, ADR-0053).
- **Superseded** — a later ADR replaces the decision as a whole. Flipped in the PR that ships the superseding ADR (that PR is the `shipped in`; `issue #N` stays the superseded ADR's own); the superseding ADR carries `**Supersedes:** [ADR-MMMM](…)`. **Partial replacement keeps `Accepted`:** the older ADR gains `**Superseded in part by:** [ADR-NNNN](…) (<which part>)`, the newer `**Supersedes in part:** [ADR-MMMM](…) — <which part>` (ADR-0001 ↔ ADR-0003). Use `**Amended by:**` when a sentence of the older decision is narrowed or corrected and the decision stands; `**Superseded in part by:**` when one of its decisions is replaced outright.
- **Withdrawn** — a `Proposed` ADR whose code will not merge. Flipped by the PR that abandons it, or by a docs-only PR when the ticket closes with no PR; the file is kept. A reversed `Accepted` decision is `Superseded` by the reversing ADR, never `Withdrawn`.

**Ticketless changes.** Under [ADR-0058](../adr/0058-implementation-flows-are-tiered.md) a Tier 0 or Tier 1 change ships with no issue. Where there is none, the parenthetical drops `issue #N` and carries the provenance alone — `**Status:** Accepted — <merge day> (no issue — Tier 0/1 change, shipped in #PR)`. An issue number is never invented to satisfy the form, and an ADR that genuinely needs one was Tier 2 work.

**Amendment moves neither status nor date.** `**Amends:**` on the amending ADR, the reciprocal `**Amended by:**` plus an in-place annotation on the amended one, in the same commit (ADR-0055 ↔ ADR-0057). A ticket that amends an ADR without shipping an ADR of its own carries `**Amended at #N**` ([plan NNN](…)) on the amended ADR's header, listing the lettered in-place annotations and which are decision-level; the plan's records section is the reciprocal (ADR-0055 at #109). This is the exception: a new rule of any weight is an ADR (`CLAUDE.md`).

**Pre-rule lines** — `Accepted` with a drafting day and no parenthetical at all (0021's `(issue #24)` aside), and ADR-0001's pointer to ADR-0004, mirrored on ADR-0004 rather than re-adjudicated — are left as written.

**Who checks:** the step-6 "adherence to the ADRs and `CONTEXT.md`" reviewer, against the PR — every ADR whose code is in the PR carries the flip; every ADR the PR amends carries the reciprocal `**Amended by:**`, or `**Amended at #N**` where the amender is a ticket; anything left `Proposed` has no code on `main`. No mechanical checker; a later sweep finding a shipped ADR still `Proposed` is the trigger to add one (plan 052 D8).
