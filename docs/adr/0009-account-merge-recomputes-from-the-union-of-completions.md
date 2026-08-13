# ADR-0009 — Account merge recomputes from the union of completions

**Status:** Accepted — 2026-07-30
**Depends on:** [ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md)
**Amended by:** [ADR-0050](./0050-email-attach-magic-link-tokens-consents-and-the-lgpd-minimum.md) — the tombstoning consequence's cookie claim — *"the old anonymous cookie may still exist in a browser somewhere and must map to the merged identity, not to a revived empty account"* — is narrowed at the FLOW level: after a cross-account attach-confirm merge, ADR-0050 decision 13 revokes every pre-existing session on the winner, so the loser's original cookie resolves to NOTHING and the merged identity is handed to the clicking browser's fresh cookie; an old device that still holds the dead cookie then re-mints a NEW empty identity — a new account, never the tombstone resurrected, with the merged history safe on the winner and recoverable via the magic link. Scope: the confirm flow only — the operation-level remap inside `mergeAccounts` (and its T-API-S54 pin) is untouched, and outside a confirm no session is ever deleted. #58's queued amendment to this ADR is additive — multiple `Amended by:` lines stack.

## Context

[ADR-0003](./0003-anonymous-first-identity-with-email-recovery.md) made the collision inevitable: a user plays anonymously on their phone and on their laptop, building two accounts with two streaks, then attaches the same email to both. The magic link now points at two histories that must become one, and the merge rule is schema-shaped — expensive to change after live data exists.

## Decision

**Completions are the source of truth; everything else is derived.**

On merge, the two accounts' completion rows are unioned. Where both accounts completed the same puzzle, the earliest completion wins and the other row is dropped. Streak, statistics, and rule-derived medals are then **recomputed from the merged history** — never copied from either side. Curated medal grants that are not rule-derived are unioned and deduplicated. The losing account is emptied and tombstoned, so its anonymous token can never resurrect a second identity.

This forces a healthy invariant the schema must respect from M0: **a streak is always derivable from completion rows.** A stored streak value is a cache, never an authority — which is also what the founding handoff's "streak calculado server-side" already implied.

## Rejected

- **Take the max streak counter:** cheap, but produces streaks the data doesn't support, silently discards the other account's history, and breaks the derivability invariant.
- **Richer account wins wholesale:** a real user watches real completions vanish.

## Consequences

- Merge is deterministic and auditable: run it twice, get the same account.
- The streak recomputation routine must exist as a pure function over completion rows (it lives in `packages/core` with the other streak rules) — merge is just one caller; nightly consistency checks or support tooling are free to reuse it.
- Deduplication needs a stable key: (canonical user, puzzle id). The merged account may end up with a *longer* streak than either source had — two devices covering different days union into a fuller calendar. That is correct, not a bug.
- Tombstoning the losing account is a hard requirement, not hygiene: the old anonymous cookie may still exist in a browser somewhere and must map to the merged identity, not to a revived empty account.
