# Test Ids

Named tests carry an id in their `it(...)` title (or, for a whole-suite regression gate, in a file-header comment), so a plan, an ADR, a PR body and a review finding can all point at the same assertion.

**`apps/web` puts its ids on `describe(...)` rather than on `it(...)`, and that is the shipped convention there**, not a defect — `git show main:apps/web/test/day-state.test.ts:61` predates every ticket that has been reviewed against this document. `packages/core`, `packages/db` and `apps/api` follow the `it(...)` rule above. Recorded at #27 because two step-6 reviewers independently raised the divergence as a finding; the two conventions are both fine, and what was missing was this sentence.

## Format

```
T-<AREA>-[S]<n>[<letter>]
```

- **`<AREA>`** — `CORE`, `DB`, `API`, `WEB`, `LINT`: `packages/core`, `packages/db`, `apps/api`, `apps/web`, and the `apps/web/test/eslint-*-wall.test.ts` suites (one numbering across them: `eslint-db-wall.test.ts` was the area's only file until #28 added `eslint-free-play-wall.test.ts`). **`packages/games` carries no ids** — verified by grep, and new suites there keep it that way.
- **`[S]`** — the series letter. Bare is the first series; `S` is the current one.
- **`<n>`** — allocated by the plan that introduces the test. A plan reserves a contiguous per-area range up front and states it.
- **`[<letter>]`** — a sibling of an id that already landed (`T-API-9b`, `T-DB-9a…9e`). Use it rather than a fresh number when the new assertion belongs to the same claim.

## Opening a new series

**A new letter is opened only when the previous space has become ambiguous — one documented id, two meanings.** Not once per plan.

Plan 017 continued plan 014's bare space. Plan 018 opened `S` because that space had collided: plan 014 allocated `T-API-7…11` to daily-Binairo consumer tests that never landed, and plan 017 then gave `T-API-7` a different meaning in `apps/api/test/completions.test.ts`. Plan 020 continued `S`, which has no such defect. `S` was opened across every area at once, so one plan's ids share one prefix.

## Frontier

Frontier as of plan 033 (#29) **at its step 7 (review-fix round)**, re-derived by grep over the branch. It is a snapshot, not a guarantee: re-run the grep before allocating, and re-derive it at step 8 of any ticket that adds ids. The live series is `S` everywhere; the bare series are closed and nothing is ever added to them.

The grep that produces it, per area — titles only, so a cross-reference in a comment is not mistaken for an allocation:

```
grep -rhoE "T-<AREA>-S[0-9]+[a-z]?" apps packages | sort -u
```

| Area | Next free | Highest in use | Bare series closed at |
|---|---|---|---|
| `T-CORE` | `S70` | `S69` | never used |
| `T-DB` | `S37` | `S36` | `T-DB-21` |
| `T-API` | `S92` | `S91` | `T-API-16` |
| `T-WEB` | `S160` | `S159` | `T-WEB-23` |
| `T-LINT` | `S33` | `S32` | `T-LINT-10` |

#25 (plan 020) reserved `T-CORE-S8…S14`, `T-DB-S6…S9`, `T-API-S17…S26`, `T-WEB-S35…S60`, `T-LINT-S3`, and spent, on top of its range:

- at step 7 rounds 1–3 — `T-API-S27` (+ siblings `S27a`, `S27b`) and `T-WEB-S61…S66`;
- at step 7 round 4 — `T-CORE-S15`, `T-CORE-S16`, `T-API-S28`, `T-WEB-S67…S71`, `T-LINT-S4…S7`, plus the sibling letters that split four ids which had acquired two meanings each (`T-WEB-S65a`/`S65b`, `T-WEB-S53a`/`S53b`, `T-API-S23a`/`S23b`, `T-API-S25a`/`S25b`).
- at step 7 round 5 — `T-WEB-S72`, the `--ink-on-accent` gate in `apps/web/test/ink-on-accent.test.ts` (step-6 finding ISS-A2).

**The `T-WEB` row read `S66` and the spent list stopped at `S65` when this document first landed, and both were already false on the branch that shipped them** — `T-WEB-S66` was in use at `apps/web/test/nonogram-screen.test.tsx` and cited from `apps/web/src/nonogram/board.tsx`. Two lint tests were also minted as `T-LINT-3d`/`T-LINT-3e`, i.e. as new members of a series this document declares closed, which produced a `T-LINT-3d` collision with the pre-existing `users`/`sessions` assertion. Both are corrected here (step-6 round-4 findings NONO-C4-2, NONO-C4-3, Q2, Q3, `TEST-IDS-COLLISIONS`, `TEST-IDS-FRONTIER-STALE`). The lesson is the one the "re-derive it at step 8" instruction above already carries: a frontier written from memory at the end of a long ticket is wrong, and a document that ships with the code contradicting it is worse than no document.

#27 (plan 022) spent `T-CORE-S17…S24`, `T-DB-S10…S12`, `T-API-S29…S45`, `T-WEB-S74…S108`, `T-LINT-S8`, and split two ids at review time:

- at step 6 → step 7 round 1 — `T-API-S42`…`S44`, `T-WEB-S104`…`S107`, and the two **cross-file** spans that had acquired two meanings each, split into sibling letters: `T-CORE-S18a` (the stored-content half, `daily-contract.test.ts`) / `T-CORE-S18b` (the wire half, `termo-guess-contract.test.ts`), and `T-API-S34a` (`cron-publish.test.ts`) / `T-API-S34b` (`buffer-depth.test.ts`). Both had been minted on this branch citing each other as precedent, circularly; the rule below is what applies, and a cross-file span is what it exists to prevent.
- at step 7 round 2 — `T-API-S45` (`test/termo-judge.test.ts`, the shared ladder's own preconditions) and `T-WEB-S108` (`test/session-remint.test.ts`, the re-mint allowance's two reset events).

#28 (plan 025) reserved `T-WEB-S109…S124` and `T-LINT-S9…S20`, and spent `T-WEB-S109…S122` and `T-LINT-S9…S18` at step 5; `T-WEB-S123`/`S124` and `T-LINT-S19`/`S20` were the reserved review-round headroom and are **burned if unspent** per the rule below. The four free-play rows added to `T-WEB-S56`'s ROUTES table carry no new id — the `T-WEB-S100` burn precedent.

#19 (plan 027) reserved `T-CORE-S25…S34`, `T-DB-S13…S15`, `T-API-S46…S52`, `T-WEB-S125…S134` and `T-LINT-S21…S23`, and spent `T-CORE-S25…S33`, `T-DB-S13`/`S14`, `T-API-S46…S51`, `T-WEB-S125…S131` and `T-LINT-S21`/`S22` at step 5; the tails (`T-CORE-S34`, `T-DB-S15`, `T-API-S52`, `T-WEB-S132…S134`, `T-LINT-S23`) are the reserved review-round headroom and are **burned if unspent** per the rule below. At step 7, #19 spent fresh post-tail ids — `T-CORE-S35` (the `epochDay` RangeError edge), `T-API-S53` (the streak route's 500 branch), `T-LINT-S24`/`S25` (the one-hop `app/page` / `app/hub-day-state` wall gap) — the burned tails stayed burned.

#20 (plan 029) reserved `T-CORE-S36…S48`, `T-DB-S16…S25` and `T-API-S54…S56`, and spent `T-CORE-S36…S46`, `T-DB-S16…S23` and `T-API-S54` at step 5; at step 7 it spent `T-DB-S24` from the reserved review-round headroom (the repoint column-list tripwire, `packages/db/test/merge.test.ts` — step-6 quality finding); the remaining tails (`T-CORE-S47`/`S48`, `T-DB-S25`, `T-API-S55`/`S56`) are the rest of that headroom and are **burned if unspent** per the rule below. No `T-WEB` and no `T-LINT` ids were reserved — the merge has no UI and no lint-wall change (plan 029 §9).

#21 (plan 031) reserved `T-CORE-S49…S58`, `T-DB-S26…S33`, `T-API-S57…S81`, `T-WEB-S135…S150` and `T-LINT-S26…S30`, and spent `T-CORE-S49…S54`, `T-DB-S26…S29`, `T-API-S57…S81` (the whole api range — the plan-review round had already extended it contiguously to S81), `T-WEB-S135…S144` and `T-LINT-S26…S28` at step 5. The tails (`T-CORE-S55…S58`, `T-DB-S30…S33`, `T-WEB-S145…S150`, `T-LINT-S29`/`S30`) are the reserved review-round headroom and are **burned if unspent** per the rule below. The `/privacidade` and `/vincular` `route-ssr` rows ride `T-WEB-S56`'s table — the `T-WEB-S100` burn precedent, no new id. At step 7 (the six-lens review round) #21 spent fresh post-tail ids — `T-API-S82` (the attacker-revocation scenario, `attach.test.ts`), `T-API-S83` (a non-guard `mergeAccounts` failure is rethrown, never swallowed into 410/409), `T-API-S84` (`/attach/state` mirrors the FULL dormancy switch, `attach-state.test.ts`), the sibling `T-API-S79a` (the stale-intent guard's verified-holder variant — same claim family as S79), `T-WEB-S151` (the `/vincular` switch-account gate, `attach-confirm.test.tsx`) and `T-WEB-S152` (the malformed-token explainer, same file) — the burned tails stayed burned (the #19 step-7 precedent).

#29 (plan 033) reserved `T-CORE-S59…S69`, `T-DB-S34…S36`, `T-API-S85…S90`, `T-WEB-S153…S159` and `T-LINT-S31…S32`, and spent **every id in every range** at step 5 — no tails, so nothing new burns. The `/estatisticas` `route-ssr` row rides `T-WEB-S56`'s ROUTES table (the `T-WEB-S100` burn precedent, no new id), and the two conclusion/free-play link tests edited to assert the now-live `routes.stats` href kept their shipped ids (`T-WEB-18`'s block, `T-WEB-S114`). `T-LINT-S31`/`S32` sit on `it(...)` in `eslint-free-play-wall.test.ts` — that file's own convention, per the note above. At step 7 (the six-lens review round) #29 spent one fresh post-range id — **`T-API-S91`** (the calendar route's cross-user isolation probe, `stats-calendar.test.ts`) — and five sibling letters, each a new assertion inside a landed id's claim: `T-CORE-S63a` (only a won row extends the calendar range — the step-6 won-only clamp correction), `T-CORE-S67a` (duplicate won-today termo rows answer the minimum), `T-CORE-S69a` (a calendar day must be a real day — `calendarDateString`), `T-API-S90a` (a lost row one day before birth never extends the range) and `T-WEB-S157a` (the conclusion's today-decorations drop on a `stats.date` mismatch).

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
| `T-WEB-S100` | plan 022 §19.6 reserved it for `test/route-ssr.test.tsx` — "both termo paths render with their marker and no function crosses the RSC boundary". The assertions landed, but **inside the existing `T-WEB-S56` describe** ("every route the impeccable preflight fetches"), which is where they belong: the two termo rows went into that suite's own `ROUTES` table. Same shape as `T-WEB-S41` |
| `T-CORE-S6` | **predates #27.** Plan 018 reserved it for `completion-contract.test.ts` (`docs/plans/018-…:1376`); the assertion landed unmarked. Recorded here so the next re-derivation does not spend a pass re-investigating the gap |

Not burned, and not reusable either: `T-WEB-S2`, `S4`…`S7` are covered by the `T-WEB-S1..S7` range comment at `apps/web/test/sudoku-state.test.ts:23` rather than by per-`it` markers.
