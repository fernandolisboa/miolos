# ADR-0095 — Three free hints per puzzle

**Status:** Accepted — 2026-10-13 (issue #295)
**Superseded in part by:** [ADR-0098](./0098-the-free-hint-allowance-is-a-remote-config-key-under-a-wire-ceiling.md) (#304) — decision 1 and the "A configurable limit now" rejection: the allowance is the `freeHintsPerPuzzle` remote config key, and `HINTS_PER_PUZZLE_CEILING` is the wire bound.
**Depends on:** [ADR-0006](./0006-monetization-convenience-not-access.md), [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md), [ADR-0065](./0065-a-cross-device-done-day-opens-a-completed-view.md)
**Supersedes in part:** [ADR-0027](./0027-the-hint-is-computed-on-the-client.md) decision 2; [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decision 5
**Amends:** the `.max(1)` bound named in ADR-0045 decision 2 and ADR-0065 decision 2; both rules (one bound for every game, read and write caps together) stand

## Context

Fernando's product call on 2026-10-13: a puzzle gets three free hints, not one. The cap of one was repeated across the completion request members, the `/day` claim, the local play record and the web's hint state. Raising it in place would leave the next change to find every copy again.

## Decision

1. **`FREE_HINTS_PER_PUZZLE = 3` in `@miolos/core` is the only number.** `hintsUsedSchema` (`packages/core/src/completion.ts`) bounds all six completion request members, Termo included so ADR-0045 decision 2's uniform bound holds; the `/day` claim (`dayGameStateSchema`); and the local play record (`recordHeaderShape`). The read and write caps move together, as ADR-0065 decision 2 requires.
2. **The free hints are still not a grant.** They are per puzzle, held in the play record and written as `completions.hints_used`. ADR-0027 decisions 3 and 4 (`hint_grants`) are untouched. Free play gets the same three, computed on the client, and never touches the streak, the statistics or the medals.
3. **Termo stays at zero** (ADR-0045).
4. **ADR-0006's dormant rewarded-ad batch** (one ad grants three hints for the day) is untouched.

## Consequences

- No migration: `completions_hints_used_check` is `hints_used >= 0` and has no upper bound to raise.
- Rollback floor: a build older than this wire change throws on `GET /day` for a row with two or three hints (ADR-0065 decision 2), and an older web reads a local record with two or three hints as no record.
- The hint button label counts down the hints left.

## Rejected

- **Per-game limits.** One free-hint count per puzzle is a product rule, not a per-game one.
- **A configurable limit now.** It stays a constant until an admin surface exists (#304).
- **Modelling the free hints as a grant of three.** A grant is day-scoped and server-side (ADR-0006); the free hints are puzzle-scoped and cost no server call.
