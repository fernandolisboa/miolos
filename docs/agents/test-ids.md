# Test Ids

Named tests carry an id in their `it(...)` title (or, for a whole-suite regression gate, in a file-header comment), so a plan, an ADR, a PR body and a review finding can all point at the same assertion.

## Format

```
T-<AREA>-[S]<n>[<letter>]
```

- **`<AREA>`** — `CORE`, `DB`, `API`, `WEB`, `LINT`: `packages/core`, `packages/db`, `apps/api`, `apps/web`, and `apps/web/test/eslint-db-wall.test.ts`. **`packages/games` carries no ids** — verified by grep, and new suites there keep it that way.
- **`[S]`** — the series letter. Bare is the first series; `S` is the current one.
- **`<n>`** — allocated by the plan that introduces the test. A plan reserves a contiguous per-area range up front and states it.
- **`[<letter>]`** — a sibling of an id that already landed (`T-API-9b`, `T-DB-9a…9e`). Use it rather than a fresh number when the new assertion belongs to the same claim.

## Opening a new series

**A new letter is opened only when the previous space has become ambiguous — one documented id, two meanings.** Not once per plan.

Plan 017 continued plan 014's bare space. Plan 018 opened `S` because that space had collided: plan 014 allocated `T-API-7…11` to daily-Binairo consumer tests that never landed, and plan 017 then gave `T-API-7` a different meaning in `apps/api/test/completions.test.ts`. Plan 020 continued `S`, which has no such defect. `S` was opened across every area at once, so one plan's ids share one prefix.

## Frontier

Frontier as of plan 020 (#25) **after its step-7 round 4**, re-derived by grep over the test tree on that ticket's branch. It is a snapshot, not a guarantee: re-run the grep before allocating, and re-derive it at step 8 of any ticket that adds ids. The live series is `S` everywhere; the bare series are closed and nothing is ever added to them.

The grep that produces it, per area — titles only, so a cross-reference in a comment is not mistaken for an allocation:

```
grep -rhoE "T-<AREA>-S[0-9]+[a-z]?" apps packages | sort -u
```

| Area | Next free | Bare series closed at |
|---|---|---|
| `T-CORE` | `S17` | never used |
| `T-DB` | `S10` | `T-DB-21` |
| `T-API` | `S29` | `T-API-16` |
| `T-WEB` | `S72` | `T-WEB-23` |
| `T-LINT` | `S8` | `T-LINT-10` |

#25 (plan 020) reserved `T-CORE-S8…S14`, `T-DB-S6…S9`, `T-API-S17…S26`, `T-WEB-S35…S60`, `T-LINT-S3`, and spent, on top of its range:

- at step 7 rounds 1–3 — `T-API-S27` (+ siblings `S27a`, `S27b`) and `T-WEB-S61…S66`;
- at step 7 round 4 — `T-CORE-S15`, `T-CORE-S16`, `T-API-S28`, `T-WEB-S67…S71`, `T-LINT-S4…S7`, plus the sibling letters that split four ids which had acquired two meanings each (`T-WEB-S65a`/`S65b`, `T-WEB-S53a`/`S53b`, `T-API-S23a`/`S23b`, `T-API-S25a`/`S25b`).

**The `T-WEB` row read `S66` and the spent list stopped at `S65` when this document first landed, and both were already false on the branch that shipped them** — `T-WEB-S66` was in use at `apps/web/test/nonogram-screen.test.tsx` and cited from `apps/web/src/nonogram/board.tsx`. Two lint tests were also minted as `T-LINT-3d`/`T-LINT-3e`, i.e. as new members of a series this document declares closed, which produced a `T-LINT-3d` collision with the pre-existing `users`/`sessions` assertion. Both are corrected here (step-6 round-4 findings NONO-C4-2, NONO-C4-3, Q2, Q3, `TEST-IDS-COLLISIONS`, `TEST-IDS-FRONTIER-STALE`). The lesson is the one the "re-derive it at step 8" instruction above already carries: a frontier written from memory at the end of a long ticket is wrong, and a document that ships with the code contradicting it is worse than no document.

Four same-file, same-claim duplicates predate this branch and are deliberately left alone rather than renumbered — `T-API-S4` (×4, `cron-publish.test.ts`), `T-API-S5`, `T-API-S6` and `T-API-S13`. They ship on `main`, they are cited from plans and PR bodies, and renumbering a landed id is the thing that closed the bare space. New duplicates take the sibling letter instead.

## Burned slots

**Unused tail numbers are burned, never reused** — the reserving plan is a permanent record that already gave the id a meaning, so re-issuing it recreates exactly the ambiguity that closed the bare space.

| Burned | Why |
|---|---|
| `T-CORE-1`, `-1b`, `-2`, `-3` | plan 017 reserved them for `completion-contract.test.ts`; the tests landed unlabelled and plan 018 labelled that file `T-CORE-S5`/`S6` |
| `T-API-11` | tail of plan 014's `T-API-7…11` daily-Binairo consumer range |
| `T-DB-10`, `T-WEB-21` | plan 017 |
| `T-WEB-S13`, `T-WEB-S32` | plan 018 whole-suite regression gates — satisfied by a green suite, so no marked `it` exists to point at |
| `T-LINT-S1`, `T-LINT-S2` | plan 018 reserved them for the sudoku/play-path wall assertions, which never landed |
| `T-WEB-S41` | plan 020 reserved it for "`T-WEB-S12` gains the third record"; the assertion landed inside `T-WEB-S12` itself, where it belongs |
| `T-WEB-S46` | plan 020 reserved it for the pointer-stroke extraction's `git diff --exit-code` gate — a COMMAND, not an `it`, so there is no marker to point at (same shape as `T-WEB-S13`/`S32`) |
| `T-WEB-S60` | tail of plan 020's `T-WEB-S35…S60` range |

Not burned, and not reusable either: `T-WEB-S2`, `S4`…`S7` are covered by the `T-WEB-S1..S7` range comment at `apps/web/test/sudoku-state.test.ts:23` rather than by per-`it` markers.
