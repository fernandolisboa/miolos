# ADR-0058 — Implementation flows are tiered

**Status:** Accepted — 2026-08-19 (no issue — Tier 0/1 change, shipped in #PRNUM)

## Context

`CLAUDE.md` mandated one implementation flow for every issue: eight steps, each
in a freshly spawned specialised subagent, with six review lenses in parallel at
step 6. The flow works. Every feature this project has shipped came through it —
#86 account merge, #88 email attach, #90 stats, #92 medals, #94/#95 archive, #105
sharing, #113 the archive done chip — and its adversarial step 6 has caught real
defects that inspection alone would not have.

What it does not do is scale *down*. Between 16 and 19 August, eleven pull
requests merged and exactly one of them (#113) contained product code. The other
ten — #112, #115, #117, #118, #119, #120, #121, #122, #124, #125 — were test-suite
tuning and records: five tickets and a records round, all circling the same
concurrency and timeout questions, while the product frontier stood still.

Two symptoms name the mechanism precisely:

- **#116** flipped nine markdown status lines and wrote one section of
  `docs/agents/domain.md`. It consumed roughly a dozen subagents across all eight
  steps, including six parallel review lenses over a diff whose entire code
  surface was the string `Proposed` becoming `Accepted`.
- **#123** was filed to record a *conditional future observation* about the gate's
  shape, because a review rule held that a landmine named in a snapshot must
  become a tracker entry. The issue named no action anyone could take.

Neither is a failure of the eight steps. Both are the eight steps applied to work
that was never their shape. A process whose only setting is "maximum" converts
every small task into a large one, and the cost is not the ceremony itself — it is
that the ceremony competes for the same finite session and subagent budget the
features need.

## Decision

**Implementation flows are tiered, and the tier is chosen before the work.**

1. **Four tiers**, routed by the table in `CLAUDE.md` § *Implementation flows are
   tiered*, which is the operative copy; this ADR records why they exist, not
   their wording.

   - **Tier 0 — Just do it.** Typos, comment and doc corrections, dependency
     bumps, a one-line test fix, records-only changes (an ADR status flip, a
     `docs/README.md` row, a frontier update). No ticket, no plan, no ADR, no
     handoff, no review agents. One agent: branch → change → gate → PR → merge.
   - **Tier 1 — Small fix.** A real defect, roughly ≤ 50 lines, no new decision
     and no new surface. Reproduce first — a failing test or a pasted repro —
     then fix, then **one** reviewer with the correctness lens, then gate, then
     merge. No plan document, no ADR, no handoff.
   - **Tier 2 — Feature slice.** A vertical slice, a new surface, a schema or
     contract change, or anything needing an ADR. The eight steps, **unchanged**,
     including the parallel step-6 lenses. Nothing in this ADR weakens them; what
     changes is only that they stop being universal.
   - **Tier 3 — Foggy.** Architecture, or work whose shape is unclear.
     `/wayfinder` or `/grill-with-docs` first to find the shape, then Tier 2 on
     the pieces it produces.

2. **The routing rule.** The tier is chosen before the work starts and named in
   the PR body, where it is a **claim** the reader can check against the diff.
   Work that outgrows its tier stops and re-tiers; it never continues at the
   wrong weight. **Escalation is always allowed; skipping is not** — Tier 0 work
   that turns out to need a decision becomes Tier 2, and nothing goes *down* a
   tier because it is taking long. Where two rows both look right, the heavier
   one wins.

3. **The artifacts-outweigh-diff test.** *If a ticket's process artifacts
   outweigh its code diff, it was the wrong tier.* It is stated in that form
   deliberately: it is mechanical, applies after the fact, needs no judgement
   about intent, and is the cheapest signal available. #116 fails it by an order
   of magnitude.

4. **No observation-only tickets.** No ticket may be filed whose entire content
   is an observation about the test suite or the tooling. **A tracker entry needs
   an action.** Observations go in `.claude/napkin.md`, or as an annotation on
   the ADR that owns the area — both of which are read by the agent who will next
   touch that area, which is more than an open issue achieves.

5. **Handoffs at session end or milestone close, not per ticket.** A handoff
   records a session's transferable state; a ticket that fits in one sitting has
   none.

6. **Records work is Tier 0 or 1 by default** — plans, handoffs, ADR annotations
   — and never Tier 2 on its own. Records that ship *with* a feature slice remain
   part of that slice's tier, as the `Proposed` → `Accepted` lifecycle in
   `docs/agents/domain.md` requires.

7. **The mechanical gate binds identically at every tier.** The lighter tiers drop
   agents and documents; they never drop checks. `pnpm typecheck`, `pnpm lint`,
   `pnpm test`, the property-based floors, Zod at the boundaries, `impeccable
   detect` on UI, and the pre-commit hook apply to a Tier 0 typo exactly as they
   apply to a Tier 2 slice, and `--no-verify` remains forbidden.

## Consequences

- The eight steps survive intact for the work that earns them, and the review
  budget they consume is spent on slices rather than on status-line flips.
- **A lighter tier can let a bad change through that six reviewers would have
  caught.** This is real, and it is the price. Two things bound it, and nothing
  else does: the **mechanical gate**, which is tier-invariant and catches every
  class a checker can express, and **escalation**, which is free and always
  available. What the gate cannot express — a design that is correct but wrong,
  an ADR contradicted in spirit, a security consequence two hops away — is
  genuinely unguarded at Tier 0 and guarded by a single lens at Tier 1. That is
  why Tier 0's row is a **closed list** of change kinds rather than a size
  threshold, and why "needs a decision" and "adds a surface" are hard
  disqualifiers rather than judgement calls.
- Tier choice becomes a new place to be wrong, and an agent under time pressure
  has an incentive to under-tier. The PR-body claim is what makes that visible
  rather than silent, and the artifacts-outweigh-diff test is the retrospective
  check. Neither is mechanical; there is no checker for tier discipline, and a
  later sweep finding under-tiered PRs is the trigger to add one.
- Rule 4 removes a filing habit without removing the underlying need to record.
  The risk it creates is that observations stop being written down at all, since
  the napkin's curation rules cap each category at ten items and a fold can bury
  a note. The ADR annotation route exists for observations too durable for that
  cap.
- Two skills, `.claude/skills/just-do-it/` and `.claude/skills/small-fix/`, make
  Tiers 0 and 1 executable rather than aspirational. They live in the repo, so
  they are versioned with the rules they implement, and both point at
  `CLAUDE.md`'s routing table rather than copying it — a duplicated table would
  drift within one ticket.
- This ADR ships **without a ticket**, under the rules it introduces, which makes
  it its own first exercise. Its status line therefore omits the `issue #N` the
  lifecycle in `docs/agents/domain.md` normally requires; that document gains the
  ticketless form in the same diff.
