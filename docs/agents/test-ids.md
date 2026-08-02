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

Frontier as of plan 020 (#25), verified by grep over the test tree on that ticket's branch. It is a snapshot, not a guarantee: re-run the grep before allocating, and re-derive it at step 8 of any ticket that adds ids. The live series is `S` everywhere; the bare series are closed and nothing is ever added to them.

| Area | Next free | Bare series closed at |
|---|---|---|
| `T-CORE` | `S15` | never used |
| `T-DB` | `S10` | `T-DB-21` |
| `T-API` | `S28` | `T-API-16` |
| `T-WEB` | `S66` | `T-WEB-23` |
| `T-LINT` | `S4` | `T-LINT-10` |

#25 (plan 020) reserved `T-CORE-S8…S14`, `T-DB-S6…S9`, `T-API-S17…S26`, `T-WEB-S35…S60`, `T-LINT-S3`, and spent `T-API-S27` (+ siblings `S27a`, `S27b`) and `T-WEB-S61…S65` on top of its range at step 7.

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
