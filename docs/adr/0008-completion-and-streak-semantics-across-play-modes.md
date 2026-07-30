# ADR-0008 — Completion and streak semantics across the three play modes

**Status:** Accepted — 2026-07-30
**Depends on:** [ADR-0005](./0005-all-content-is-free.md)
**Amends:** the rewards line of [`docs/handoffs/001-handoff-project-foundation.md`](../handoffs/001-handoff-project-foundation.md) — *"streak global (completar 1 dos 4 mantém)"* — by defining what "completar" means per mode.

## Context

[ADR-0005](./0005-all-content-is-free.md) gave the product three play modes: the daily, the public archive, and free play. The founding handoff defined the streak only for the daily ("completar 1 dos 4 mantém") and made free play streak-neutral; the archive had no rule at all. Two ambiguities were schema-shaped and had to be settled before the spec:

- Can solving Tuesday's puzzle from the archive on Wednesday repair Tuesday's streak?
- Is a lost Termo (all six guesses used, word not found) a "completion"? The three grid games have no loss state, so only Termo makes "completar" ambiguous.

## Decision

Three verbs, used consistently from here on:

- **Completed (on time)** — the puzzle was solved during its own `America/Sao_Paulo` day. The only thing that feeds the streak.
- **Completed late** — a past daily solved from the archive.
- **Played** — engaged to a terminal state without winning. Only Termo can end here.

The rules:

1. **The streak comes only from on-time completions.** Completing at least one of the four dailies on its own day maintains it. Archive play never repairs or extends a streak, ever — the same rule free play already had. If archive play could repair it, the streak would be unbreakable and stop being a mechanic; scarcity is what makes it work.
2. **Archive completions are recorded, and marked late.** The stats calendar shows the date as solved with a visually distinct "solved later" state. Late completions never feed the Termo guess distribution, the time statistics, streak medals, or Dia Perfeito. Archive-specific curated medals (e.g. "solved 100 archive puzzles") remain possible.
3. **A lost Termo is played, not completed.** The loss records in the Termo guess distribution as the fail row — standard Termo behavior — but counts for neither streak nor Dia Perfeito. Termo keeps real stakes, and the streak stays reachable through the three grid games.
4. **Dia Perfeito = all four dailies completed on time.** A day containing a lost Termo is not perfect, whatever else happened.
5. **Free play records nothing server-side**, reaffirming ADR-0005.

## Rejected

- **Grace-window repair** (archive fixes yesterday only, N times a month): more forgiving, but adds rules and schema for a mechanic whose value is exactly that it can be lost.
- **Loss = completion:** turns the streak into a pure engagement counter and removes Termo's tension.
- **Loss maintains streak but not Dia Perfeito:** two definitions of "complete" to explain forever.

## Consequences

- The completions table must record, per (user, puzzle): when it was completed, the puzzle's own date, and the outcome (won / lost, the latter Termo-only). "On time" is derivable — `completed_at` falls within the puzzle's `America/Sao_Paulo` day — and must stay derivable, because [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md) recomputes streaks from these rows.
- A lost Termo still writes a completion-shaped row (it feeds the distribution); the outcome field is what excludes it from streak arithmetic. The row is written once — a loss followed by an archive replay does not reopen the daily.
- The calendar UI needs three visual states per date: completed on time, completed late, and (implicitly) missed.
- These verbs go into `CONTEXT.md`; issue titles and test names use them.
