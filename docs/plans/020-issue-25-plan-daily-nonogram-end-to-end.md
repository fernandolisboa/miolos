# Implementation plan — Issue #25: Daily Nonogram end-to-end

Step 2 (Plan) of the eight-step flow. Point-in-time snapshot, planned against `origin/main` = `d44d501` ("feat: the daily Sudoku end to end, on a shared play layer (#23) (#60)"). All paths are working-tree paths. Branch `feat/25-daily-nonogram-end-to-end` is already checked out and correct; the tree is clean and fully green (726 tests, 6/6 projects).

Direct prior art: [`docs/plans/018-issue-23-plan-daily-sudoku-end-to-end.md`](./018-issue-23-plan-daily-sudoku-end-to-end.md), whose section layout this plan mirrors. Everything it decided that is not restated or superseded here still binds. Where this plan supersedes one of its statements, it says so by name (§20 on the First Load JS obligation; §5.3 on the pointer-stroke extraction).

**Provenance.** This plan merges nine exploration reports (consolidated brief, 1 387 lines) and six parallel decision papers — *reveal*, *geometry*, *board-interaction*, *state-progress*, *server-plumbing*, *process*. Where two papers conflicted, §6 names the conflict, the winner and the argument. Every measured number carries the harness that produced it; none is recalled.

**Numbering conventions used throughout.** `D1…D12` are the twelve open decisions as numbered by the exploration brief §9. `N1…N23` are the landmines the brief registered; `N24…N34` are new ones this plan adds (§24). `P1…P30` are this plan's own fixed decisions (§4) — 017 used `D`, 018 used `S`, this one uses `P`. `T-<AREA>-S<n>` are test ids (§19, and the rule is P30).

---

## 0. Acceptance criteria → plan mapping

| # | AC (quoted from issue #25) | Build step (§22) | Where satisfied | Tests (§19) |
|---|---|---|---|---|
| 1 | "Production buffer holds validated future-dated Nonogram dailies behind the predicate helper" | 2, 3, 9 | §7 (content + response schemas, the real `case "nonogram"`, `ProjectedGame`, `FORBIDDEN_DAILY_KEYS`), §8 (the wall's third projection, fixtures), §9.1 (`topUpNonogramBuffer`, the weekday/size tripwire, D10's budget), §9.2 (cron order + buffer-depth), §9.4 (`GET /daily/nonogram`, D5) | T-CORE-S8…S12, T-CORE-S14, T-DB-S6…S9, T-API-S17…S22, T-API-S26, E2, E2b, E4–**E6 (including the `.date` assertion that is the only production proof of the wall clause)** |
| 2 | "The picture-reveal moment lands within the design system's contained-celebration rules; screen passes `npx impeccable detect`" | 6, 7, 9 | §12 (board geometry, four size classes, contrast arithmetic, the rotation signature), §12.6b (cell states, the hint's ring, the board's motion), §12.8 (the controls, both bands), §13 (the reveal: where it renders, its one keyframe, its reduced-motion branch, its contrast figure), §21.5 (**buffer seeded before any scan**, the hardened preflight, the workflow diff) | T-WEB-S42, S44, S47…S52, E2b (precondition), E10, **E11 (the final PREVIEW run — no run exists for a merge commit)**, E12, E12b |
| 3 | "Completion recorded once with on-time derivation; hub, conclusion, rules blurb, hint, timer, offline sync at parity" | 3, 4, 5, 6, 7, 8 | §9.3 (the judge, the flatten, the length check), §10 (encoding, reducer, engine adapter), §14 (record + sync), §15 (the hint), §16 (rules blurb + copy), §17 (hub tile, chaining CTA) | T-API-S23…S25, T-WEB-S35…S41, T-WEB-S53…S56, E7–E9 |
| — | Standing duty (ADR-0024 §5 ESLint wall, plan 017 §14, plan 018 §14) | 6 | §18 — the wall comes out of this ticket **unweakened** | T-LINT-S3 |

Every AC maps to at least one numbered build step in §22 and at least one named test in §19. §25 restates the mapping as machine-checkable evidence with the exact command per line.

---

## 1. Scope boundary, stated once

**In:** the `/nonogram` play screen and `/nonogram/concluido` conclusion; the Nonogram top-up in the cron and its buffer-depth alerting; the daily / completion / cron contract widenings and the wall's third projection; **`GET /daily/nonogram` — required by no AC, kept because E6 is AC 1's only production evidence for the strip clause short of scraping the web app, and because refusing the third of three identical `limit(1)` indexed reads of already-public content is a distinction with no security content (ISS-10, P8)**; the three-state brush board with drag strokes; the extraction of the pointer-stroke machinery into `apps/web/src/play/use-pointer-stroke.ts` (firing ADR-0029 consequence (c)'s written trigger); the picture reveal in the conclusion's result card; the one free hint; offline-tolerant sync at Binairo/Sudoku parity; the hub tile and the chaining CTA; six ADRs (§23); one new living doc (`docs/agents/test-ids.md`).

**Out, explicitly, each with the issue or reason that owns it:**

| Out of scope | Owner / reason |
|---|---|
| **The Binairo roving-focus retrofit** (D7) | **Filed, not built** — §5.4 carries the exact `gh issue create` body. Decided against on three grounds in §6.4; ADR-0030 (b) already says "the retrofit is owed; this ADR does not claim it is scheduled" |
| **A named reveal** (D1) | Decided out and recorded as **ADR-0033**. If a name is ever wanted it is an authenticated post-completion server read — the shape ADR-0027 already specifies for granted hints — filed as a follow-up at step 8 |
| **A per-cell violation / error state** | Decided out (§10.6). The only cheap per-cell check is against the solution, which is a per-cell oracle: paint a cell, watch it turn red, brute-force the picture. This also retires landmine N13 — there is no error colour on this board, so the `--accent-app` 1.40:1 collision never arises |
| **The running-clock tabular-figures defect** | ADR-0036 records the measurement and the rule; the **fix** to `.timerCard`/`.timerBar` is a separate issue filed at step 8. #25 does not touch shipped timers |
| Server-truth done/pending, "X de 4" from the server, the streak display, the PWA manifest | **#19**. ADR-0031 already draws this line; #25 consumes `readDayState` unchanged |
| Undo, pencil-mark-style annotations beyond the three cell states | No AC asks; the three states plus the erase brush reach every board configuration |
| Statistics, histogram, personal best | **#29** |
| Share card | **#34** |
| Archive (`/arquivo/…`), widening `ACCEPTED_DAYS_BACK` | **#31**. `ACCEPTED_DAYS_BACK` stays `1` |
| Free play | **#28** — which inherits ADR-0032, ADR-0035 and ADR-0037 |
| The late-by-sync window | **#58**, inherited unchanged. Do not implement a grace |
| The least-privilege `miolos_web` Neon role | **#59**. The only duty is negative: nothing in this ticket may say or imply the grant exists |
| Rewarded-ad hint grants (`hint_grants` stays dormant) | a future monetization ticket; ADR-0027 names the seam |
| Dark mode, telemetry (**#33**), any ads SDK or new `AdSlot` placement | — |

**Never:** on-demand puzzle generation, a client-supplied completion instant, a stored `on_time`, a hint balance, a client-computed streak, a future-dated puzzle in any payload, a motif name or id in any client-reachable payload.

---

## 2. Read first (in this order)

1. `docs/adr/0004`, `0019`, `0021`, `0024` (with its 2026-07-31 amendment), `0026`, `0027`, `0028`, `0029`, `0030`, `0031`.
2. `docs/plans/018-issue-23-plan-daily-sudoku-end-to-end.md` §5, §8–§12, §15 and **§20 in full** (48 review findings and their dispositions). §24 lists the ones easiest to regress here.
3. `packages/games/src/nonogram/index.ts` — the whole public surface, 21 lines. Never a deep import (ADR-0019). Note the three shape asymmetries in §4 P3.
4. `packages/core/src/contracts/daily.ts:160-204` — the strip table TSDoc and the `switch` with **no `default:`** (N1). This plan implements its nonogram row.
5. `apps/api/src/publishing/service.ts:96-335` — the two top-up loops this plan clones, plus the TSDoc at `:225-239` that is **false for Nonogram** and gets corrected here (N6/C3).
6. `apps/web/src/sudoku/*` in full — the worked example. `apps/web/src/binairo/grid.tsx:38-169, 261-271` — the machinery §5.3 extracts.
7. `apps/web/src/play/use-play-lifecycle.ts` and `conclusion-view.tsx` — the two shared modules this ticket edits.
8. `DESIGN.md`, `PRODUCT.md`, `packages/ui/tokens.css`. **There is no reference frame for the Nonogram screen** (G6). §12 and §13 are the just-in-time design; F3/F4 are the siblings they must be defensible against.
9. `CONTEXT.md` — and §16's vocabulary ruling, which fills the gap `CONTEXT.md` has for "picture"/"motif"/"cell state".

---

## 3. Fixed orchestrator conventions (recorded, not re-litigable here)

- Shell preamble on every command: `source ~/.nvm/nvm.sh && nvm use default >/dev/null && …`.
- **This ticket adds nothing to `packages/games/src`.** The Nonogram engine shipped complete; ADR-0023's proof floors have nothing to bind. `solveNonogram(clues)` recovers the full bitmap, so the hint never needs `solveLine` (which is not on the barrel). If implementation believes it needs an engine primitive, that is a separate ticket. The package's purity tests, `types: []` tsconfig and eslint block (ADR-0017) stay untouched. **One test file is added** under `packages/games/test/nonogram/` (§19 B1) — a test is not a source addition and does not touch the barrel.
- **No new fast-check anywhere outside `packages/games`.** ADR-0017 scopes it there; §19 B1 is a plain enumeration over `MOTIFS`, not a property.
- `packages/ui` stays JSX-free (ADR-0002) and **no token VALUE is added or edited**. One documentary exception, named rather than discovered (ADH-1/ISS-6): ADR-0036's amendment edits two **comment** lines — `tokens.css:58`'s standing rule and the trailing `/* + tabular-nums */` on `tokens.css:27`'s `--text-numeral-lg` (a Fraunces token paired with a feature ADR-0036 measures as a total no-op) — plus `DESIGN.md:28`. All three land in **commit 2**, beside the ADR that makes the claim. Verified against the working tree: `DESIGN.md:28` is "- `font-variant-numeric: tabular-nums` is mandatory on every grid, timer and statistic."; `tokens.css:58` is "/* Mandatory on grids, timers and statistics: font-variant-numeric: tabular-nums */"; `tokens.css:27` is `--text-numeral-lg: 600 44px/1 var(--font-display); /* + tabular-nums */`. Without the edit ADR-0036 ships asserting an amendment that never happened, and this repo's convention is that "X is amended" means X was **edited** — `docs/handoffs/001-handoff-project-foundation.md:10-27` carries the "⚠️ Emendas" table added by the ADR-landing commits `fc0864b`/`7f8a70f`. ADR-0002's invariant is about JSX and primitives; a comment carries neither, and no declaration's value moves.
- **No migration.** `game` is a `text` column with a TS-level enum (`schema.ts:101`, `:157`), `content` is untyped `jsonb`, and both CHECK constraints already list `'nonogram'` (`schema.ts:113`, `:168`; `migrations/0001_*.sql:10`, `0002_*.sql:10`). If implementation believes it needs one, something is being modelled wrong. E2 pastes the `\d daily_puzzles` proof.
- **No new dependency.** `min-release-age=3` and `save-exact=true` therefore have nothing to bind.
- Turbo evidence is always `--force`; captured exit codes, never prose. `turbo.json`'s `test` task has no `outputs` and is fully cacheable — an uncached run is the only real one.
- Plan number **020**; ADR numbers **0032–0037** reserved (§23). The `docs/README.md` rows ship in commit 1 (§21, §24 landmine 17) — **this plan does not edit `docs/README.md` itself**; the exact row text is in §21.1.

---

## 4. Fixed decisions (with rationale, one line each)

Twenty-six decisions. Each names the open decision (`D<n>`) or landmine (`N<n>`) it settles, and the decision paper it comes from. Anything marked **ADR** is expanded in §23.

### Server and contracts

- **P1 — The daily Nonogram's public projection is `{game, date, size, clues}`, and the entire `reveal` is withheld.** (D1 → **ADR-0033**.) This is a *product* withhold, not a confidentiality one: `solveNonogram(clues)` recovers the exact bitmap in ≤0.34 ms by construction (ADR-0021 decision 3 makes line-solvability to the exact bitmap a binary mechanical gate over 265 variants; measured 280/280 dailies, 0 mismatches, worst 0.338 ms), so withholding `reveal.solution` protects nothing about the picture's *shape*. What the strip preserves is the curated pt-BR **name**, which is genuinely not derivable from the clues, plus casual inspection of the rest — ADR-0027's own words (`:125-128`), never a security claim.
- **P2 — `FORBIDDEN_DAILY_KEYS` gains `"motifId"`, `"name"` and `"mirrored"`.** (D12, N18.) `testing.ts:8-12` names this as #25's duty verbatim. Adding only `reveal` would be vacuous — `reveal` is already listed, so a projection that flattened the identity to top-level keys would pass every scan, which is exactly the mistake `clueCount` was added to prevent at #23. `"name"` is a **generic** key and adding it is a standing constraint on every future daily payload; verified safe today against all **eight** consumers of the constant — and against **both halves** of what they run, the key scan every consumer performs and the `renderToStaticMarkup` substring scan two of them add on top of it (§7.7, ADH-8/SRV-5). A future payload that genuinely needs a `name` renames its field or amends the list with a written reason.
- **P3 — `nonogramDailyContentSchema` mirrors `NonogramPuzzle` field-for-field, `game: z.literal("nonogram")` included.** (N2.) Nonogram is the only engine whose puzzle object carries a `game` key (`nonogram/types.ts:33`, written at `generate.ts:48`); binairo's and sudoku's do not. Omitting it from a `strictObject` fails every pre-insert `safeParse`, drains the buffer one day per day, and fires the alert. Three cross-refines replace the fixed `.length()` the other two games get for free, because size is weekday-dependent (5/8/10/15) and no literal length exists.
- **P4 — `nonogramCompletionRequestSchema` carries five keys and its `grid` is length-constrained to `{25, 64, 100, 225}`; there is no `size` field on the wire.** (D-server.) A `size` key would be a second place for the client to lie, would break the audited five-field tripwire at `completion-contract.test.ts:285-303`, and would still not be authoritative — the **stored row's** solution decides the size, and §9.3's explicit length check is the real gate.
- **P5 — `topUpNonogramBuffer` uses a per-date budget of 8 and NO run-scoped budget.** (D10.) Measured on this machine (Node 24.18.1, n=200/weekday, warm pools): generate+validate is **0.0354 ms** (Mon 5×5) to **0.1902 ms** (Sun 15×15), plus ~34 ms once to build all seven memoized pools. Absolute worst run — every date uncovered at `remoteConfigSchema`'s clamp ceiling of 30, every date exhausting all 8 seeds on the worst weekday, **each exhausted seed itself running `NONOGRAM_MAX_GENERATION_ATTEMPTS = 8` internal rounds before throwing** (SRV-4: the inner factor an earlier draft dropped, `generate.ts:11,:34-38,:65-69`) — is `30 × 8 × 8 × 0.19 ≈ 186 ms` + 34 ms ≈ **220 ms**, i.e. 0.37 % of `maxDuration: 60`, and 1.5 % even on a 4× slower runner. The conclusion survives the correction by two orders of magnitude, which is why the correction is worth making rather than papering over: a run budget would bound something already bounded far below the limit. **`vercel.json` needs no change, and the PR says so with the corrected figures rather than silently.**
- **P6 — The top-up asserts `puzzle.weekday === weekday && puzzle.size === NONOGRAM_WEEKDAY_CRITERIA[weekday].size` itself — as a TRIPWIRE for a puzzle the loop did not generate, not as a restoration of ADR-0010's belt and suspenders.** (N4/C2, corrected by TR-11.) `validateNonogram(puzzle)` takes **one** argument and derives its criteria from `puzzle.weekday` (`validate.ts:63-68`), and `generateNonogram` already calls it before returning (`generate.ts:60-62`) — so for generator output the re-validation is a *tautology on an identical value*. **The honest half, which an earlier draft over-claimed:** the assertion is equally tautological on real generator output, because `generateNonogram` writes both fields from the same source the assertion compares against (`generate.ts:31` `const criteria = NONOGRAM_WEEKDAY_CRITERIA[weekday]`, `:44-52` `weekday,` and `size: criteria.size`). It can only fail for a puzzle this loop did not generate. So ADR-0010's "belt and suspenders" is **not restored** by it — it is a second tautology with a far better failure message, and calling it anything more repeats, in a new place, exactly the false-TSDoc pattern P9 exists to correct. It ships anyway, for two reasons worth one branch: it is the cheapest gate in the loop, and it is the only one that fails *closed for the date* (a `break`) on the class of drift the validator structurally cannot see. Binairo's and sudoku's validators take the caller's weekday and do cross-check, which is why only Nonogram owes this line. §19 T-API-S19 and §25's AC-1 row are worded to match what it proves.
- **P7 — Cron order is binairo → nonogram → sudoku, serial.** (D10.) The recorded principle is cost-ascending so a CPU overrun cannot starve the cheap game (`cron/publish/route.ts:103-106`); measured per cold week: binairo ~7 ms, nonogram ~34–80 ms, sudoku ~150 ms. Appending nonogram last would leave T-API-S8's log-line indices untouched — a smaller diff — and that is rejected: if the order is chosen for diff size the principle stops being a principle.
- **P8 — `GET /daily/nonogram` ships as a third literal route, and the "Revisit at #25" comment is answered in writing.** (D5 = option A.) `apps/api/app/daily/sudoku/route.ts:11-19` demands an answer either way. Shipping nothing leaves the kill-switch verification surface asymmetric: for two games an operator can `curl` a machine-readable 404 to confirm a `killed_at`; for the third the only check would be scraping the web app's unavailable card. The honest counter — nothing consumes these routes (verified: `apps/web` fetches only `/session` and `/completions`) — loses because the route is a `limit(1)` indexed read of already-public content, identical in cost and exposure to two shipped siblings, and refusing the third is a distinction with no security content. Option B (`[game]`) is rejected outright: it reintroduces the untrusted-`params` and uncaught-throw hazards the shipped comment already refused.
- **P9 — The correction of `service.ts:228-231`'s false TSDoc lands in this PR.** (N6/C3.) It claims Nonogram "is not a seed → generate → weekday-validate loop"; `generate.ts:23-70` is exactly that loop. Leaving it is not a style question — it tells the next reader the shape they are about to write is impossible.

### The completion, the encoding and the judge

- **P10 — A Nonogram is finished when the *picture* is painted. Crosses are the player's notation and never cross the wire.** (D4, N9 → **ADR-0032**.) A player may finish having crossed every empty cell, having crossed none, or any mixture; the three finishes produce **byte-identical** POST bodies, so the server never sees a three-state board and has no leniency rule to get wrong.
- **P11 — Client cell encoding is `1` = preenchida, `0` = marcada (crossed), `null` = vazia (undecided). This is forced, not chosen.** (N9.) `grid-hint.ts:64` is `if (entry !== null && entry !== target)`. If a cross were a third value distinct from the solution's empty, **every correctly-crossed cell would return a `correction`** and the day's one hint would systematically tell the player to un-cross a cell they crossed correctly. The encoding works if and only if cross ≡ the solution's empty value. Verified against a verbatim copy of `nextHint` over 280 real boards, all four cases.
- **P12 — Wire encoding is row-major `index = row * size + col`, `1` = filled, `0` = everything else.** The judge flattens `reveal.solution` (`boolean[][]`) row-major and maps `true → 1` (N8). **Plus an explicit `body.grid.length === solution.length` check before the compare loop** (N7): binairo pins `.length(64)` and sudoku `.length(81)` so the schema alone proves it for them, but a nonogram grid is one of four lengths and the loop iterates `solution.entries()` only — a **longer** grid whose prefix matched would score zero mismatches and be recorded. The check is game-generic, one branch, and a no-op for the two shipped games, which is what makes it safe to add now rather than as a nonogram special case someone later "simplifies" away. `422`, not `400`: the body is well-formed, it just is not this puzzle, and `TERMINAL_STATUSES` already treats 422 as terminal so the record settles rather than retrying forever.
- **P13 — The progress readout counts FILLED cells against a denominator summed from the clues.** (D4 = option A, **against handoff 019:164**.) Crossing is not required to finish — measured on 280/280 real boards — so under a `{decided} de {size²}` readout the majority behaviour (a fill-only solver) stands at **48 of 225 ≈ 21 % at the instant they win** on the worst 15×15 in the library, 85.5/225 ≈ 38 % on average at that size and ≈ 48 % over all 280 dailies (step-6 round-3 finding ADH-R3-2: this line read "47 of 225", a board that exists on no motif at any size; ADR-0032:43-56 carries the corrected derivation). A completion meter that *can* read 21 % at victory is broken. `messages.play.progressLabel` is the single shared `"Progresso"` slot on one shared stats card; option B would make the same slot mean "amount of work performed" on one of four screens. The handoff's insight is honoured elsewhere and said out loud: crossing is fully first-class — persisted, restored, corrected by the hint, and driving the board's visual state. It is simply not what the *meter* measures. **Accepted cost, named:** a heavy crosser at 150 crosses / 10 paints reads "10 de 47" and sees no credit; and the readout **can exceed its denominator** ("50 de 47") when a player overpaints. Both are honest and self-diagnosing. The fix a reviewer will propose — count only *correct* paints — is **forbidden as a per-cell oracle** and must be named as forbidden in the TSDoc.
- **P14 — `countFilled` is NOT reused; Nonogram gets its own six-line `countFilledCells`.** (N22, D4.) `progress.ts:16-27` tests `(given ?? entries[index] ?? null) !== null`; under P11 a cross is `0`, which is not nullish, so `countFilled` computes option B, not option A. Making it compute option A needs two synthetic arrays — an all-`null` `givens` of length n² (a parameter Nonogram has no concept of) and a projected `entries` with `0 → null`. That is the shallow reuse ADR-0029 and plan 018 S2 reject. `progress.ts` gains one **comment-only** line saying Nonogram deliberately does not use it and why, so a later "cleanup" cannot silently reinstate option B.
- **P15 — The record carries an explicit `size` member typed by `nonogramSizeSchema`, plus a `superRefine` cross-checking `entries.length === size²` and `grid.length === size²`. `v` stays `1`.** (D3 = option A.) `size` is a **datum, not `Math.sqrt(entries.length)`**: `sync.ts` builds the POST body from the record alone with no board in scope, and D2's conclusion wrapper reads `stored.size` to lay the picture out. `writePlayRecord` does not parse on write (`play-record.ts:180-203`), so the schema on **read** is the only wall there is, and without the refine a hand-edited store's million-cell array reaches `derive`. `.max(225)` rides in front of the refine as a plain **length ceiling** — and the TSDoc says so in those words, because the allocation-bound rationale an earlier draft carried is **measurably false** (CLI-4/SRV-6): zod 4.4.3 parses every element before running array-level checks, measured at `{success:false, ms:35, elementChecksRun:1000000}` on a 10⁶-element array, so nothing short-circuits. The two shipped members have the identical property, so this is a wording fix, not a regression. Verified: a checked object is a legal `z.discriminatedUnion` option in the installed zod 4.4.3 and is **not** one in zod 3 — a downgrade breaks this module at construction time, not at parse time (landmine N35).
- **P16 — The reducer's `restore` rejects a record whose `size` or `entries.length` disagrees with today's board.** (N11.) `readPlayRecord` checks only `record?.game === game` (`:168`); the schema proves the record is self-consistent for its *own* size, and only the reducer can compare it against *today's*. A 25-cell array reaching `derive` on a 225-cell board is not cosmetic: `isPictureComplete` would find no unpainted picture cell among the 25 it can see, flip `status` to `"solved"` on an empty board, and write a completion the queue then POSTs.
- **P17 — The hint is `nextHint` composed twice, so its fill branch always lands on a picture cell.** (N10, D4.) `grid-hint.ts:69-71` returns the row-major first `null`, which silently assumes `entries` records the player's *knowledge* — true for Sudoku and Binairo, where every cell must be written to finish, and **false** here, where crossing is optional. Measured: the unmodified fill branch returns a **cross 239 of 280 times (85 %)** on a fresh board. Pass 2 re-runs the **same shared function** with the empty-picture cells masked through the `givens` argument, which is exactly what that argument means ("never a candidate", `:38-40`); it can only ever return a fill on a picture cell, because pass 1 already proved no contradiction exists anywhere. Measured 280/280 fresh and 280/280 mid-game. Determinism and the contradiction-first policy are preserved verbatim, and `grid-hint.ts` is **not modified**.
- **P18 — Nonogram's `hint.explain` has three keys, selected by the hint's `kind` **and** its `value`.** The hook already computes the hint once before dispatching, for exactly this reason (`use-sudoku-play.ts:140-152`). `cross` is a **defined-unreachable** branch (§26) that ships rather than rendering `undefined`.

### The board

- **P19 — The Nonogram board drags, and the pointer-stroke machinery moves verbatim into `apps/web/src/play/use-pointer-stroke.ts`.** (D8 = option A, G3 answered.) The 15-class board is 225 cells at ≈18.9 px on a 390 px phone; tap-only means up to 225 discrete taps and no way to fill a 7-run in one gesture. This fires ADR-0029 consequence (c)'s **written** trigger ("stays in `binairo/grid.tsx` until #25 gives it a second consumer") and plan 018 §5.3's naming of #25 by number. The machinery is not the board: `grid.tsx:38-169` + `cellIndexAt` contains no JSX, no geometry, no game vocabulary and no `styles` import — it resolves cells by `document.elementFromPoint` + `closest("[data-cell-index]")`, a convention all three boards already share. Firing a written conditional is not a new decision: **no ADR**, recorded here, in the hook's TSDoc citing ADR-0029 (b) and (c), and in the PR.
- **P20 — The extraction is move + rename, in its own commit, with the Binairo suite green and every assertion unchanged in what it asserts.** (Plan 018 §5.1 alternative C's discipline, verbatim.) The only rewrite in the move is naming the inline expression `event.detail > 0 && (dragged.current || tapped.current)` (`grid.tsx:231`) as `consumedClick`, which is what lets the six refs stay private.
- **P21 — The controls are three sticky brush modes carrying `aria-pressed`, exactly one pressed, `preencher` first. There is NO cycle mode.** (D9 → **ADR-0037**.) Forced by P19, not by taste: Sudoku's keypad is commands *because* Sudoku does not drag — the command carries its own value. A Nonogram **stroke carries no value of its own**, `paint-over` must be a plain SET (a drag must be idempotent over the cells it crosses), and the value it sets can only come from sticky state. Binairo's `cycle` default is not copied: a drag in cycle mode does nothing at all (`binairo/state.ts:100-104`), and on this board the drag **is** the primary gesture, so a cycle default would ship the game with its main input dead on first paint.
- **P22 — The board is one flat CSS grid at `gap: 0`, hairline-ruled, with `max-content` clue-gutter tracks and four explicit size classes.** (D6 = option A → **ADR-0035**.) §12 carries the full arithmetic. The decisive number: at 320 px the 15-class board gives a **14.20 px** cell at `gap: 0` against a **13.203 px** two-digit column-clue floor, and **12.33 px at `gap: 2`** — a gapped board fails at 320 px, a zero-gap board clears it by 0.98 px of track. "Let it scroll" is a closed question: `binairo-screen.test.tsx:965-983` exists because a board that overflowed below 369 px shipped once.
- **P23 — Clue numerals are Instrument Sans (`var(--font-ui)`), 600, 11 px, `tabular-nums` — not Fraunces.** (D6, G2 closed → **ADR-0036**.) Measured in Chrome 151 against the exact woff2 `next/font` ships: **Fraunces has no tabular figures at all** — `font-feature-settings: "tnum"` is a no-op on every feature tag while the `wght` and `opsz` axes respond, so digits keep a 2.19–2.28 px spread at 11 px. Instrument Sans with `tabular-nums` collapses every digit to **6.609375 px (0.6009 em)**. A clue rail is a column of numerals that must align; the sans is the only family in the system that can do it. This contradicts `DESIGN.md:28` and `tokens.css:58`, which state the rule as law — hence the ADR and the amendment.
- **P24 — The rotation signature is `(--grid-card-rot -0.7deg, --stats-card-rot +0.9deg, --tape-rot -4deg)`, and `--board-mobile-max: 350px` is declared unconditionally on `.pageNonogram`.** (N12/C6.) `screen.module.css:409` is literally `max-width: var(--board-mobile-max);` with **no fallback** — verified by direct read; the file's own header at `:18-20` claims otherwise and is wrong. A `.pageNonogram` that omits it makes the declaration invalid at computed-value time, `max-width` falls back to `none`, and the ≤768 px cap silently disappears. The signature's sign triple `(−, +, −)` and all three magnitudes are new against Binairo's `(+0.4, −0.5, −3)` and Sudoku's `(−0.4, +0.5, +3)`, as `sudoku-board.module.css:21-24` requires.
- **P25 — The shared 1140 px fold HOLDS.** The widest Nonogram card is **559.05 px** (sizes 10 and 15) against **579 px** of board column at V=1141 — 19.95 px of margin. Nonogram needs the fold at or above 1121.05. Moving it to fit `DESIGN.md:50`'s 52 px cell on a 15×15 would need 1421 px and would change three games and the conclusion in a band **neither scanned viewport enters** (landmine 19). The 32 px cell at size 15 is the price of one fold, and it is the right trade.
- **P26 — The caret is `outline: 2px solid var(--ink); outline-offset: -2px`, in ONE declaration block shared by `.cellSelected` and `.cell:focus-visible`.** (ADR-0030 decision 5 / consequence (c).) `var(--accent)` is unavailable and that is arithmetic, not preference: a filled cell **is** solid `--accent-nonogram`, so an accent caret is 1:1 — invisible on exactly the cells the player is working. `--ink` is 3.48:1 on a filled cell and 15.01:1 on an empty one. Inset, never offset: at `gap: 0` any positive `outline-offset` paints over the neighbour, the defect `sudoku-board.module.css:189-191` names. **T-WEB-S49 pins the block as stylesheet text, closing G7/N17** — ADR-0030's own claim that this is "assertable as stylesheet text" is asserted nowhere in the repo today.

### The reveal, and the rest

- **P27 — The picture reveal renders in the conclusion's result card, additive to the stamp, from one new optional plain-data prop on `ConclusionView`. The in-place board reveal is rejected on timing evidence.** (D2 = option B; option C collapses into B → **ADR-0034**.) `usePlayLifecycle` freezes the clock in a **passive effect** because "an entry action carries no `now`" (`:206-212`), and the screen's swap is gated on **both** `status !== "playing"` and `timer.runningSince === null` (`sudoku-screen.tsx:47-50`). So the solved board is painted for approximately **one frame** before `ConclusionView` replaces it; a 250 ms transition started there is interrupted at ~16 ms. Holding the board open on a timer would fork the one screen shape ADR-0028:131 pins for every game and would fight the invariant that keeps the stamp from showing a time the pause is about to correct.
- **P28 — Neither placement is URL-scanned by `impeccable detect`, and the plan says so rather than over-claiming AC 2.** `impeccable detect` launches a clean browser profile (ADR-0031 consequence (e)), so `/nonogram/concluido` always renders the **empty** branch and `/nonogram` always renders a **playing** board. AC 2's detect clause is satisfied by those two unfinished states. The reveal's own compliance is proved by three other mechanisms, named: a **file-mode** `pnpm exec impeccable detect apps/web/app apps/web/src` run, the jsdom smoke tests, and `css-source.ts` assertions on the keyframe name, the easing and the reduced-motion branch.
- **P29 — The bundle obligation is discharged with a manifest-derived measurement, because Turbopack prints no First Load JS column.** (D11, G1 closed.) §20 carries the measurement, the baseline, the acceptance threshold and the string-literal grep with its positive controls. **This supersedes plan 017 `:1511`, plan 018 §19 item 7 and ADR-0027 `:132-138` as worded** — those mandate a figure Next 16.2.12 does not emit.
- **P30 — Test ids continue the `S` series; no new letter is opened. The rule is written down in a new living doc.** (D12, G5.) The one-letter-per-plan reading is unsupported: plan 017 *continued* plan 014's bare `T-API-<n>`/`T-DB-<n>` space and opened bare letters only where an area had no ids at all. Plan 018 opened `S` because the bare space had **collided** — plan 014 `:15` allocated `T-API-7…11` to the daily-binairo consumer tests, those never landed, and plan 017 then assigned `T-API-7` a different meaning in `completions.test.ts`. That is the rule: **a new letter is opened only when the previous space has become ambiguous — one documented id, two meanings.** The `S` space has no such defect. `docs/agents/test-ids.md` (~20 lines) records the format, the rule, the per-area frontier and the burned slots, so #27 inherits a decision instead of a coin flip. **It ships with a CLAUDE.md pointer or it does not ship at all** (ADH-7): CLAUDE.md's "## Agent skills" block carries exactly one subsection per `docs/agents/*` file (Issue tracker, Triage labels, Domain docs), and that block is the index every session actually reads — a fourth agent doc with no subsection is invisible, which is the precise failure this decision exists to prevent. Commit 1 therefore adds a fourth `### Test ids` subsection alongside the `docs/README.md` row. **The plan carries two pieces of non-#25 scope, not one** — this doc, and `GET /daily/nonogram` (§1, ISS-10) — and the PR's scope declaration names both. If step 3 or 4 cuts the doc, the rule stays here as P30 and **both** the README row and the CLAUDE.md subsection are dropped; shipping the doc without the pointer is the one outcome that is worse than either.

---

## 5. The reuse architecture — what moves, what does not

### 5.1 The seam, restated

ADR-0029 decision 2 is the rule: **CSS and the non-visual layer are shared, JSX composition is per game**, and consequence (b) warns that "hoisting **the board** into `play/` is undoing decision 2, not completing it." #25 makes exactly two additions to `apps/web/src/play/` and one edit to a shared component. Everything else is new code under `apps/web/src/nonogram/`.

| Change | File | Kind | Why it is on the shared side |
|---|---|---|---|
| **new** | `play/use-pointer-stroke.ts` | move + rename from `binairo/grid.tsx` | The machinery is a hook with no JSX, no geometry, no game vocabulary and no `styles` import. Decision 2's shared list already contains two hooks, one of which touches `window`, `document` and `localStorage`. P19/P20 |
| **new** | `play/types.ts` → `ConclusionPicture` | additive interface | Plain data across the RSC boundary; the same constraint `ConclusionCopy` carries. §13.2 |
| **edit** | `play/conclusion-view.tsx` | one optional prop + one conditional block + one module-scope pure helper | `ConclusionResult` is deliberately **not** widened — see §13.2 |
| **edit** | `play/conclusion-view.module.css` | `.pictureRow`, `.picture`, `@keyframes picture-settle`, the ≤768 overrides, and the **existing** reduced-motion block extended in place | CSS Modules hash per file (landmine 24): a block in another module cannot reach `.picture`. §13.4 |
| **edit** | `play/play-record.ts` | the third union member | THE extension point, marked at `:99-102`. P15 |
| **edit** | `play/sync.ts` | one `case` label + one widened parameter type | ADR-0029 consequence (f), satisfied literally. §14.2 |
| **edit** | `play/progress.ts` | **comment only** | P14 |

**Not touched, deliberately:** `play/timer.ts`, `play/grid-hint.ts`, `play/use-play-lifecycle.ts`, `play/use-record-snapshot.ts`, `play/day-state.ts` (in full — the brief's anti-task; `NOTHING_DONE` already carries `nonogram: PENDING` and `readDayState` already spells all four keys), `play/accent.ts` (already maps `nonogram`), `play/screen.module.css`, `play/timer-readout.tsx`, `components/daily-unavailable.tsx`.

### 5.2 The per-game slice — `apps/web/src/nonogram/`

| File | Mirrors | Contents |
|---|---|---|
| `engine.ts` | `sudoku/engine.ts` | The ONE conversion boundary. §10.2 |
| `state.ts` | `sudoku/state.ts` | Pure reducer + types; no React, no DOM, no clock. §10.3 |
| `use-nonogram-play.ts` | `use-sudoku-play.ts` | `useReducer` + `usePlayLifecycle` + the solution memo + the hint. §10.5 |
| `board.tsx` | `sudoku/board.tsx` + `binairo/grid.tsx` | The flat grid, the clue rails, the roving focus, the key table, the stroke handlers. §11 |
| `controls.tsx` | `binairo/controls.tsx` | Three `aria-pressed` brush buttons + `ControlsSkeleton`. §11.5 |
| `play-view.tsx` | `sudoku/play-view.tsx` | `PlayView` + `PlaySkeleton` on `play/screen.module.css`. The stats card's third row is **Tamanho / `{size} × {size}`** through `screen.statRow`/`screen.statLabel` + `styles.sizeCard`, mirroring `sudoku/play-view.tsx:110-113`'s level row (§12.4, ADH-12). `PlaySkeleton` composes the placeholder board and the controls; **the placeholder carries the real clue rails**, since the gutter is a `max-content` track and a railless placeholder would be 45.05 px narrower and ~41 px shorter above 768 px |
| `nonogram-screen.tsx` | `sudoku-screen.tsx:26-65` | Four branches (§10.6) |
| `nonogram-conclusion.tsx` | new | The client wrapper that owns the record and supplies `picture`. §13.3 |
| `nonogram-board.module.css` | `sudoku-board.module.css` | `.pageNonogram` + all four custom properties + `.mobileCap5` + geometry (§12.4–§12.6) + **the chromatic cell states and the hint's inset ring, declared in §12.6b rather than inherited from the precedent** (DES-1: a copied `.cellHinted` would replace the fill with a 10 % tint) + the desktop and mobile controls with their pressed state (§12.8) + `.sizeCard` + its own `prefers-reduced-motion` block, which covers `.cell` and `.control` and is written for transitions that **do** exist (§12.6b, DES-7) |

Plus two route segments: `apps/web/app/nonogram/page.tsx` and `apps/web/app/nonogram/concluido/page.tsx`, both `force-dynamic` async server shells (ADR-0028; "every future game screen is a copy of this shape, not a new decision").

### 5.3 `use-pointer-stroke.ts` — the exact API

```ts
// apps/web/src/play/use-pointer-stroke.ts
import { useRef, type PointerEvent as ReactPointerEvent } from "react";

/**
 * The five container handlers, as ONE object so a board cannot forget
 * `onLostPointerCapture` — the net that keeps a stroke from outliving its
 * own pointer (binairo/grid.tsx:123-131).
 */
export interface PointerStrokeHandlers {
  readonly onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

export interface PointerStroke {
  readonly handlers: PointerStrokeHandlers;
  /**
   * True when the trailing pointer `click` must be ignored because this
   * stroke already wrote. `detail === 0` is a KEYBOARD activation and is
   * never suppressed (finding `drag-flag-kills-keyboard-cell-entry`).
   */
  readonly consumedClick: (event: { readonly detail: number }) => boolean;
}

export function usePointerStroke(input: {
  /** False disables the drag path entirely (Binairo's cycle mode). */
  readonly painting: boolean;
  readonly onTap: (index: number) => void;
  readonly onPaintOver: (index: number) => void;
  /**
   * Called once at `pointerup` with the cell the stroke ended on. The
   * composite-widget boards use it to move DOM focus; Binairo omits it.
   * This is the focus door pointer capture leaves open: the browser
   * retargets the trailing `click` to the CONTAINER, so a cell's own
   * `onClick` focus fix never runs during a stroke (grid.tsx:139-151).
   */
  readonly onStrokeEnd?: (index: number) => void;
}): PointerStroke;
```

`cellIndexAt(x, y)` moves with it as a module-private function, **byte-identical** (`grid.tsx:261-271`).

**Sequencing, non-negotiable — this is what makes the move safe:**

| Commit | Content | Green gate |
|---|---|---|
| 5 | Move + rename only. `binairo/grid.tsx` loses six refs and five handlers, gains `const stroke = usePointerStroke({painting, onTap, onPaintOver})`, spreads `{...stroke.handlers}` on the container and calls `stroke.consumedClick(event)` in the cell's `onClick`. **`onStrokeEnd` does not exist yet.** The three jsdom stubs and `stubElementFromPoint` move to `apps/web/test/pointer.ts` in this same commit (§19, TR-8) | **A command, not a judgement** (TR-9): `git diff --exit-code HEAD~1 HEAD -- apps/web/test/binairo-state.test.ts` exits 0, and `binairo-screen.test.tsx`'s diff is the stub hoist and nothing else — pasted, with no line inside `:422-645` (T-WEB-8b, T-WEB-8c, the eight drag tests that are the oracle). Then the suite is green. T-WEB-S46 |
| 6 | Add the optional `onStrokeEnd`. Binairo does not pass it; its suite is untouched. | same suite green + T-WEB-S45g |

### 5.4 What is deliberately NOT done — the Binairo retrofit (D7)

**Decided: file it. The exact issue body is below and is created at step 8.**

The explorer's refutation of "cheap" was verified against `grid.tsx` and holds. `grid.tsx:87-92` takes `setPointerCapture` on the **container**, and `:139-151` records the consequence: "the browser then retargets the trailing `click` to the container too — so the cell button's own handler is never in that event's propagation path." Sudoku's WebKit fix is `onClick` on the **cell** (`board.tsx:186-188`); in Binairo paint mode that handler never runs, so a straight port leaves the caret frozen in the mode the game is most used in — and jsdom cannot detect it (`binairo-screen.test.tsx:69-79` stubs `setPointerCapture` and says so).

**The honest counter, stated:** #25 pays for that novel path anyway — its board is a composite widget *and* it drags — and `onStrokeEnd` is the solution. That argument cuts toward doing the retrofit now. It loses on three grounds:

1. **The retrofit destroys the extraction's oracle.** The only reason moving six refs and five handlers out of a shipped file is safe is that the Binairo suite passes unchanged. The retrofit's *first* required edit is flipping `binairo-screen.test.tsx:288` `expect(givenCell.tagName).toBe("DIV")` → `"BUTTON"`, and it changes what several of the eight drag tests mean. Put both in one diff and no test says "the move was behaviour-free". This is ADR-0030 (b)'s own argument applied precisely where it still bites — true of the *commit*, which is the only thing the argument was ever about, even though it is false of the PR.
2. **Filing does not accrue interest here; it discharges it.** After this PR the shared hook exists, `onStrokeEnd` exists, ADR-0030 has two shipped implementations instead of one, and the Nonogram board is a worked reference for a board that both drags and roves. The retrofit is **cheaper** in the next PR than in this one.
3. **Risk (b) is a decision, not a task.** ADR-0030 decision 5's argument for `onFocus`-selects is that a bare roving tabindex is "a caret that cannot write". In Binairo the caret **can** write with no selection state at all (`grid.tsx:223-235`, `detail === 0`). A minimal retrofit satisfies the ADR's purpose and violates its letter, and the two branches differ by ~120 lines of reducer plus tests. That deserves its own thinking. Option C (the minimal half) is rejected outright: without `selected` there is no `.cellSelected`, and decision 5's single declaration block cannot be written.

**Issue to file at E0 — before the PR body is written, not after the merge** (ISS-7), so the PR's link is real. `gh issue create --title "a11y: retrofit Binairo's board to ADR-0030's composite-widget model" --label ready-for-agent`, body covering: the ADR-0030 (b) quote; the six-file scope (`grid.tsx`, `state.ts`, `use-binairo-play.ts`, `binairo-screen.module.css`, copy, tests); **the pointer-capture hazard, and the instruction to use `play/use-pointer-stroke.ts`'s `onStrokeEnd` — specified by ADR-0037 decision (2) (ADH-11) — rather than re-derive a second mechanism**; the explicit note that jsdom cannot prove that half and a browser observation must be pasted; the interpretation decision at risk (b) with the instruction to decide it explicitly rather than default; and the sizing (~250 net source lines, ~200 net test lines, one extra detect surface).

**The seven acceptance criteria, written out here rather than described** (ISS-11). The plan writes the two `docs/README.md` rows byte-for-byte precisely because they outlive the session; the artefact that outlives it *most* is this issue, and it will otherwise be composed from a one-clause summary, after the merge, in a fresh context.

1. Binairo's cells are `<button type="button">` with a roving `tabIndex` (`selected ?? 0`), so **`binairo-screen.test.tsx:288`'s `expect(givenCell.tagName).toBe("DIV")` flips to `"BUTTON"`** — and every drag test at `:422-645` is re-read line by line, not merely re-run, because the retrofit changes what several of them *mean*.
2. The container carries `role="group"` with `aria-label`, and **no `role="grid"`/`role="row"` appears anywhere** — ADR-0030 decision 2's rejected list, for the reason `display: contents` gives.
3. One `onKeyDown` on the container implements Binairo's own key-to-action table (ADR-0030 decision 3 / consequence (a)); every navigation key reports `defaultPrevented === true` and `Tab` reports `false`.
4. `selected` exists in the reducer and `onFocus` is its **only** writer; `use-hint` does not move it (plan 018 finding D3), so `.cellHinted` renders on its own.
5. `binairo-screen.module.css` carries **one declaration block** shared by `.cellSelected` and `.cell:focus-visible`, and its `outline-offset` is **negative** — the current `+2px` paints 4 px outside the box, over the 3 px gap and the box rule (`sudoku-board.module.css:189-191`). Asserted as stylesheet text through `css-source.ts`, the shape T-WEB-S49 establishes for Nonogram.
6. The pointer path's focus comes from `play/use-pointer-stroke.ts`'s **`onStrokeEnd`** (ADR-0037 decision (2)), never from a second mechanism; the cell's own `onClick` focus fix stays for the capture-failed path. **jsdom cannot prove this half** (`binairo-screen.test.tsx:69-79` stubs `setPointerCapture` and says so) — a real-browser observation on iOS Safari or desktop WebKit is pasted in the PR.
7. Risk (b) is **decided in writing, not defaulted**: whether the retrofit ships the full `selected`-in-state model (ADR-0030 decision 5's letter, ~120 lines of reducer plus tests) or argues the minimal form (a bare roving tabindex, which in Binairo *can* already write via `detail === 0` at `grid.tsx:223-235`). Option C — the minimal half — is rejected in advance: without `selected` there is no `.cellSelected` and criterion 5's single block cannot be written.

### 5.5 What is deliberately NOT extracted

- **The board.** ADR-0029 (b), verbatim.
- **A generic reducer.** Plan 018 §5.1 alternative A, unchanged.
- **`<PlayShell>`.** Plan 018 S2, unchanged.
- **A shared clue-rail component.** One consumer. It lives in `nonogram/board.tsx` until #28 gives it a second.

---

## 6. Where the decision papers conflicted, and which won

Six papers were produced in parallel, each reading the code itself. Seven conflicts surfaced. None is papered over.

### 6.1 The brush's default mode — **the interaction paper wins**

| Paper | Position |
|---|---|
| board-interaction (D9) | Three sticky brushes, **no cycle mode**, `preencher` default |
| state-progress (§7) | `NonogramBrush = cycle \| paint \| cross \| erase` with **`cycle` as the default**, and an affordance line documenting the cycle order |

**Interaction paper wins, and the state paper's own code proves it.** Its `paint-over` case reads `const value = brushValue(state.brush); if (value === undefined …) return state;` — i.e. a drag in cycle mode is a no-op, which is Binairo's recorded behaviour (`binairo/state.ts:100-104`: "cycling on drag is chaos, so cycle mode ignores it entirely"). Under P19 the drag is this board's **primary** gesture, so a cycle default ships the main input dead on first paint. The state paper offered no argument for cycle beyond mirroring Binairo, and Binairo's cycle exists because Binairo's drag is secondary. → `NonogramBrush = "fill" | "cross" | "erase"`, a plain string union (simpler than the object union), default `"fill"`, and pressing the active brush is a no-op returning the same state.

### 6.2 The hint selector — **the state paper wins**

| Paper | Position |
|---|---|
| board-interaction (§5.3) | Keep `nextHint` unmodified; add three explain keys; **"do not add a prefer-a-filled-cell selector — it would make the hint non-maximal, diverge the shared module and break determinism"** |
| state-progress (§5) | Compose `nextHint` **twice**; measured that the plain fill branch returns a cross **239/280 times** on a fresh board |

**State paper wins on measurement.** 85 % of first hints would spend the day's one hint telling the player something they already knew. The interaction paper's three objections are each answered by the actual composition: (i) `grid-hint.ts` is **not modified** — pass 2 is the same function called with a different `givens` mask, which is exactly what that argument means; (ii) contradiction-first is preserved verbatim because pass 1 runs first and returns unchanged whenever it finds one; (iii) determinism holds — both passes are pure, so "same state in, same hint out" is untouched and a player cannot reroll a hint by re-rendering. Both papers ship three explain keys, so §16's copy is unaffected. The interaction paper's `explainKeyOf`/`hintKindOf` (select by kind **and** value) is adopted verbatim.

### 6.3 The content/response schema shape — **the server paper wins**

| Paper | Position |
|---|---|
| reveal (§2.5) | Cross-checks live in a `superRefine` on the **content** schema only, explicitly "not the response schema"; `motifId`/`name` are `.min(1)` |
| server-plumbing (§1, §3) | `nonogramCluesSchema` carries its **own** `.refine`; the content schema carries two more; the **response** schema carries one; `motifId`/`name` are plain `z.string()` |

**Server paper wins on two measured facts and one argument.** Measured against the installed zod 4.4.3: `.refine()` on a `strictObject` **preserves `.shape`**, and a refined member **is accepted by `z.discriminatedUnion`** — neither is true in zod 3, which is why this had to be measured rather than recalled. So the response-side refine is legal and strictly stronger: the projection is independently validated at the wall *and* at the HTTP boundary. Putting the refine on `nonogramCluesSchema` itself means clue self-consistency is enforced everywhere the schema is used, in one place. On `.min(1)`: the server paper's argument is better — the schema **mirrors the type**, `validateNonogram` already owns `reveal-name-empty` (`validate.ts:120-122`) and runs before the parse, and the field is stripped before it reaches any consumer, so a stricter gate here buys nothing and adds a rejection path only reachable by drift the validator has already refused. **Both papers agree on the load-bearing point**, which is what the task required them to: the public projection is `{game, date, size, clues}` and no `reveal` in any form. §7.2 is the merged spec.

### 6.4 The board's DOM — **compatible; merged into one spec in §11**

The geometry paper specified one flat grid with explicitly-placed children and per-cell modulo rule classes; the interaction paper specified `role="group"` on the container and on each rail, `aria-describedby` from every cell to its two rails, and `<button>` cells. These are the same DOM described from two sides and they agree on every load-bearing point: one flat grid (no row wrappers, no `display: contents`); rails as siblings of the cells inside the same grid; **each clue number its own `<span>` of 1–2 characters** (geometry's `cramped-padding` flush requirement — a single element rendering `"2 2 2 2 3"` is 9 characters and would be a flush candidate the moment anything gave the rail a boundary — which is also why the interaction paper composes the rail's accessible name in `messages.ts` instead of relying on subtree text, since per-number spans concatenate to `"22223"`); no background, border, outline or shadow on `.grid`, `.clueRow` or `.clueCol`; and the identical caret block. §11 writes the merged DOM once so no reviewer has to cross-reference.

One value the geometry paper left open (`touch-action: none` "or `manipulation` — owned by D8/D9") is decided here: **`none`**, which is what Binairo — the shipped dragging board — uses (`binairo-screen.module.css:44`). Sudoku's `manipulation` is for a board that does not drag.

### 6.5 The cell encoding — **all three papers agree; recorded because the task required the check**

| Paper | Client cells | Wire `grid` |
|---|---|---|
| state-progress | `1` painted / `0` crossed / `null` undecided; `submittedCells` maps `entry === 1 ? 1 : 0` | `(0\|1)[]`, length `size²` |
| board-interaction | `1` preenchida / `0` marcada / `null` vazia | — |
| server-plumbing | — | `1` filled, `0` crossed **or** untouched, row-major |

Consistent end to end. `null → 0` and `0 → 0` on submission is what makes the two finishing styles byte-identical (P10). The one thing to keep in view: the record's `grid` field means "the submitted bitmap", not "the player's board" — its TSDoc must say so, because on a closed board it equals the solution by construction of `isPictureComplete` while a mid-game board's `entries` do not.

### 6.6 ADR numbering — six papers, four of them claiming `0032`

Every paper flagged the hazard and deferred to the plan. §23 allocates in decision order and merges the two that were the same decision seen from two sides.

### 6.7 The string-literal grep's encoding — **both measurements are right about different bundlers**

The reveal paper found that esbuild emits `"Coração"` as `Cora\xE7\xE3o`, so a grep for the accented literal returns **0 even when the table is in the bundle** — the D11 tripwire as worded in the brief is vacuous. The process paper found that accented UTF-8 **is** preserved verbatim in Next's built chunks (`célula`, `números`, `Nível` all found). Both are correct: esbuild's default charset escapes non-ASCII; Next/Turbopack does not. Since the gate runs against Next's output, the process paper's positive control works — and the reveal paper's caution is still adopted as defence: **the negative controls are accent-free** (`Escada`, `Borboleta`, `Caranguejo`, `Flamingo`, `sitting-cat` — verified present in `packages/games/src` and absent from `apps/web`, `packages/core`, `packages/ui`, `packages/db`), so the grep cannot go vacuous if a bundler config ever changes, while an **accented positive control** proves the encoding path is live. §20.3.

---

## 7. `packages/core` changes

### 7.1 One size definition, three consumers

```ts
/**
 * The four size classes the weekday ramp can produce
 * (`NONOGRAM_WEEKDAY_CRITERIA`, packages/games/src/nonogram/difficulty.ts:31-41).
 * ONE definition, three consumers: the daily content and the daily response
 * here, and the web play record (§14.1) — the `sudokuDigitSchema` precedent
 * (daily.ts:53-59), so only one place can drift. A literal union, never
 * `z.number().int()`: a fifth size class is exactly the content-shape drift
 * ADR-0024 wants to fail closed on.
 */
export const nonogramSizeSchema = z.union([
  z.literal(5), z.literal(8), z.literal(10), z.literal(15),
]);
export type NonogramSize = z.infer<typeof nonogramSizeSchema>;
```

`play-record.ts` imports it and never re-declares a four-literal union.

### 7.2 `src/contracts/daily.ts` — content and response schemas

```ts
/**
 * One line's run lengths. `positive()` is load-bearing: an all-empty line is
 * `[]`, NEVER `[0]` (nonogram/types.ts:10, clues.ts:22 — "the UI renders
 * '0'"), so a stored `[0]` is drift, not data.
 */
const nonogramClueLineSchema = z.array(z.number().int().positive());

/**
 * Mirrors `NonogramClues` exactly, its nested `size` included — the wire
 * value is directly assignable to the engine's `NonogramClues`, so the client
 * hands `daily.clues` straight to `solveNonogram` with no reshaping at the
 * one boundary where reshaping goes wrong. The `.refine` is what a fixed
 * `.length(64)` is for binairo: the DIMENSION check. Rule validity (runs that
 * fit, clues that match a bitmap) belongs to `validateNonogram`, never here —
 * a second, divergent validator is how the two drift.
 */
const nonogramCluesSchema = z
  .strictObject({
    size: nonogramSizeSchema,
    rows: z.array(nonogramClueLineSchema),
    cols: z.array(nonogramClueLineSchema),
  })
  .refine((c) => c.rows.length === c.size && c.cols.length === c.size, {
    message: "clue line counts must equal size",
  });

/** Mirrors `NonogramReveal` exactly. The whole object is withheld from every default read (ADR-0033). */
const nonogramRevealSchema = z.strictObject({
  motifId: z.string(),
  name: z.string(),
  mirrored: z.boolean(),
  solution: z.array(z.array(z.boolean())),
});

/**
 * Server-side shape of `daily_puzzles.content` for nonogram — mirrors
 * `NonogramPuzzle` (nonogram/types.ts:32-41) exactly, `game` INCLUDED:
 * unlike `BinairoPuzzle` and `SudokuPuzzle`, the nonogram engine writes a
 * `game: "nonogram"` field (generate.ts:48). Omitting it from this
 * strictObject fails every pre-insert parse and drains the buffer (N2).
 * Strict for the same fail-closed reason `binairoDailyContentSchema` is,
 * with the same operational corollaries (:17-24).
 */
export const nonogramDailyContentSchema = z
  .strictObject({
    game: z.literal("nonogram"),
    seed: z.number().int().nonnegative(),
    weekday: z.number().int().min(1).max(7),
    size: nonogramSizeSchema,
    clues: nonogramCluesSchema,
    reveal: nonogramRevealSchema,
  })
  .refine((c) => c.size === c.clues.size, { message: "size disagrees with clues.size" })
  .refine(
    (c) =>
      c.reveal.solution.length === c.size &&
      c.reveal.solution.every((row) => row.length === c.size),
    { message: "reveal.solution must be size x size" },
  );
export type NonogramDailyContent = z.infer<typeof nonogramDailyContentSchema>;

/**
 * The public daily-nonogram projection. Four keys, and ADR-0033 is why there
 * is no fifth: no `reveal` in any form, no `seed` (engines are deterministic
 * — a seed IS the solution), no `weekday` (the client derives it from the
 * date). `size` ships redundantly with `clues.size` because the wire value
 * must be assignable to the engine's `NonogramClues`; the refine is what
 * stops the two from disagreeing.
 */
export const dailyNonogramResponseSchema = z
  .strictObject({
    game: z.literal("nonogram"),
    date: isoDateString,
    size: nonogramSizeSchema,
    clues: nonogramCluesSchema,
  })
  .refine((d) => d.size === d.clues.size, { message: "size disagrees with clues.size" });
export type DailyNonogramResponse = z.infer<typeof dailyNonogramResponseSchema>;

export const dailyPuzzleResponseSchema = z.discriminatedUnion("game", [
  dailyBinairoResponseSchema,
  dailyNonogramResponseSchema,   // ← added
  dailySudokuResponseSchema,
]);
```

**Two zod-4 facts this rests on, measured against the installed 4.4.3, not recalled** (§6.3): `.refine()` on a `strictObject` preserves `.shape`, and a refined object is a legal `z.discriminatedUnion` option. Both are false in zod 3. A zod major bump re-runs the two-line probe before anything else.

Adding the member widens `ProjectedGame` (`:138`) automatically, which is the single edit that makes `getTodayDaily(db, "nonogram")` compile and therefore what unblocks `apps/web/app/nonogram/page.tsx`.

### 7.3 The `stripDailyContent` branch

Remove `case "nonogram":` from the fall-through group at `:200-202` and add a real branch; **leave `case "termo":` throwing**. There is **no `default:`** (N1/C1) — the function typechecks only because the switch is exhaustive over `Game`, and both properties survive this edit.

```ts
    case "nonogram": {
      const parsed = nonogramDailyContentSchema.parse(content);
      return dailyNonogramResponseSchema.parse({
        game: "nonogram",
        date,
        size: parsed.size,
        clues: parsed.clues,
      });
    }
```

An allowlist pick at both levels, never a delete (ADR-0024 decision 3): two of six content keys are picked, `parsed.clues` is itself the output of a strict parse so it is a fresh object holding exactly `{size, rows, cols}`, and the response schema then re-parses it strictly. Two independent gates, matching `getTodayDaily`'s "two Zod gates, one per enforcement point" pattern.

### 7.4 The strip table and the stale prose

`daily.ts:170` — replace the nonogram row's Implemented cell and its mis-cited parenthetical (N18/C10: ADR-0021 contains neither "spoil" nor "reveal"; the authority is ADR-0024's table as written here):

```
 * | nonogram | `game, date, size, clues` | entire `reveal` (`motifId`, `name`, `mirrored`, `solution`), `seed`, `weekday` | #25 (this file) |
```

and add below the table:

```
 * The nonogram row is a PRODUCT withhold, not a confidentiality one
 * (ADR-0033). `solveNonogram(clues)` recovers the bitmap in under a
 * millisecond by construction (ADR-0021 decision 3), so the picture's shape
 * is client-derivable and the strip protects nothing about it. What it
 * withholds is the curated `name`, which is NOT derivable from the clues,
 * and casual inspection of the rest — ADR-0027's own words, never a
 * security claim.
```

Also correct `ProjectedGame`'s TSDoc (`:129-137`), which names nonogram as unprojectable.

### 7.5 `src/contracts/completion.ts` — the request union

```ts
/**
 * The four legal board areas — 5², 8², 10², 15² (difficulty.ts:31-41).
 * A nonogram is the first game whose board size changes daily, so the fixed
 * `.length(64)`/`.length(81)` that proves "this submission is a COMPLETE
 * board" for the other two is unavailable; the legal SET is the contract.
 *
 * DERIVED, never hand-written (TR-6): §7.1 calls `nonogramSizeSchema` "ONE
 * definition, three consumers", and a second literal list in the same
 * package would be a fourth definition of the same fact, free to drift the
 * day a fifth size class lands. Verified against the installed zod 4.4.3
 * that a `z.union` of literals exposes `.options` and each option its
 * `.value`: `[5, 8, 10, 15] -> [25, 64, 100, 225]`.
 *
 * Deliberately NOT a `size` key plus a cross-check (P4): `size` would be a
 * second place for the client to lie, would make this the only union member
 * with six keys (breaking the audited five-field tripwire below), and would
 * still not be authoritative — the STORED row's solution decides the size,
 * and the route checks the length against it (§9.3).
 */
const NONOGRAM_CELL_COUNTS: readonly number[] = nonogramSizeSchema.options.map(
  (option) => option.value ** 2,
);

/**
 * A submitted nonogram is the PICTURE BITMAP: 1 where the cell is filled,
 * 0 everywhere else. A player may finish having crossed every empty cell,
 * having crossed none, or any mixture — a cross is a client-side annotation
 * that never crosses the wire, so all three finishes produce the IDENTICAL
 * body (ADR-0032). `submittedCellSchema` is binairo's, reused: the "COMPLETE
 * grid" invariant is the same one.
 *
 * The three `grid` members do NOT generalize into `z.array(z.number())`
 * (:70-73) and the nonogram member does not generalize the other two: a
 * length-free array would let a binairo client post 225 cells and a nonogram
 * client post 63.
 *
 * THIS is the genuinely untrusted array, named here rather than left implicit
 * (SRV-6): the play record's `entries` come off the player's own
 * `localStorage`, but this `grid` is what an anonymous client POSTs. The
 * `.refine` below runs AFTER zod has parsed every element — measured against
 * the installed 4.4.3, `{success:false, ms:35, elementChecksRun:1000000}` on
 * a 10^6-element array — so a length constraint is a REJECTION rule, never an
 * allocation bound. That is the identical exposure the shipped
 * `.length(64)`/`.length(81)` members already carry, so nothing regresses
 * with this member; and P15's `.max(225)` on the play record is a plain
 * length ceiling for the same measured reason (§14.1), which means neither
 * rationale may be cited to argue the other is a bound. If the exposure is
 * ever worth closing it is closed once, for all three members, upstream of
 * the route — not by a per-game refine.
 */
export const nonogramCompletionRequestSchema = z.strictObject({
  game: z.literal("nonogram"),
  date: calendarDateString,
  grid: z
    .array(submittedCellSchema)
    .refine((g) => NONOGRAM_CELL_COUNTS.includes(g.length), {
      message: "grid length must be 25, 64, 100 or 225",
    }),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export const completionRequestSchema = z.discriminatedUnion("game", [
  binairoCompletionRequestSchema,
  nonogramCompletionRequestSchema,   // ← added
  sudokuCompletionRequestSchema,
]);
```

`date` is `calendarDateString`, never `isoDateString`. `elapsedMs`/`hintsUsed` bounds are copied identically — one free hint is a product rule, not a per-game one.

**`completionResponseSchema` is UNCHANGED, and the PR must say so in a sentence** — a reviewer will look for it. ADR-0033 means nothing is added to the response, and ADR-0026 budgets #25 for "a contract variant and nothing else". (Recorded so it is not re-proposed: option 2 of D1 — a name on the completion response — is additionally **broken on the idempotent replay path**, because the short-circuit returns at `route.ts:172-175` *before* the wall read, deliberately, so a replay has no `row.content` in hand and would return a completion with no name.)

**The 64-cell collision bites a shipped test, and the plan does not walk past it** (N31). `packages/core/test/completion-contract.test.ts:118-123` asserts that `{...validBinairoBody, game: "nonogram"}` **fails**. Once nonogram is in the union that body **parses** — 64 cells of 0/1 is a legal 8×8 nonogram submission. The test does not merely need retargeting for tidiness; it becomes **actively false**. Retarget it at `termo` and rewrite its rationale comment.

### 7.6 `src/contracts/cron.ts` — two one-line edits

`nonogram: cronPublishGameResultSchema,` in `games` (`:39-42`) and `nonogram: z.number().int().min(0),` in `depths` (`:60-63`), keyed binairo → nonogram → sudoku, which is simultaneously alphabetical and P7's cost order.

Forgetting the first: `cronPublishResponseSchema.parse` throws **after** the rows were written and the log lines emitted → uncaught → HTTP 500. **This is a runtime throw and a red test, not a compile error** — the brief's claim that `CronGame = keyof CronPublishResponse["games"]` makes it a compile error is backwards: `route.ts:130` is `cronPublishResponseSchema.parse({ games })`, and `parse` takes `unknown`. The type only prevents calling `runTopUp` with a game the schema does not know. Forgetting the second: `/buffer-depth` 500s, and `buffer-alert.yml:36` uses `curl -fsS`, so the job dies at the read step and **never reaches the alert-issue step** — the quietest failure in the whole register.

### 7.7 `src/testing.ts` and `src/index.ts`

```ts
export const FORBIDDEN_DAILY_KEYS = [
  "solution", "seed", "reveal", "answer", "clueCount",
  // #25 (ADR-0033): the nonogram reveal's identity. `name` is a GENERIC key
  // and that is deliberate — no daily payload has ever carried one, and this
  // decision is the reason none may. A future payload that genuinely needs a
  // `name` renames its field or amends this list with a written reason.
  "motifId", "name", "mirrored",
] as const;
```

**The consumer audit, corrected: there are EIGHT files, not seven, and the scan has TWO halves, not one** (ADH-8/SRV-5/TR-14).

| Consumer | What it runs |
|---|---|
| `packages/core/test/daily-contract.test.ts:128` | key scan |
| **`packages/core/test/completion-contract.test.ts:253`** | key scan — **missing from the earlier list**; verified safe: `completionResponseSchema` (`contracts/completion.ts:105-115`) has keys `game, date, outcome, onTime, recorded, elapsedMs, hintsUsed`, no `name` |
| `packages/db/test/published.test.ts:176`, `:252` | key scan |
| `apps/api/test/daily-binairo.test.ts:80`, `daily-sudoku.test.ts:100` | key scan |
| `apps/api/test/completions.test.ts:643` | key scan |
| `apps/web/test/binairo-page.test.tsx:140-143` | key scan **plus** `expect(markup).not.toContain(forbidden)` |
| `apps/web/test/sudoku-page.test.tsx:176-179` | key scan **plus** `expect(markup).not.toContain(forbidden)` |

The key half is verified safe today: no scanned payload carries a `name` key at any depth. **The markup half is a different assertion and creates a different, broader constraint** — adding `"name"` makes the four-character string `name` illegal anywhere in `/binairo`'s, `/sudoku`'s and (via T-WEB-S53) `/nonogram`'s rendered HTML, permanently. That is stronger than what ADR-0033 argues for, and it is stated rather than discovered: a future `<meta name>`, `<input name>`, a lowercase `name*` CSS-module local or an English `data-` attribute containing the substring would red two suites for a reason unrelated to a leak.

Static evidence says it passes today — the only CSS-module locals matching `/name/i` are `.chipName`, `.chipNameLong`, `.chipNameShort` (capital `N`, so not a lowercase `name` substring) and they live in `play/conclusion-view.module.css`, which the play-page scan never renders. **It is not assumed:** the markup half is **run, and its output pasted**, in the commit that widens the constant — one `pnpm test --filter=@miolos/web --force`, evidence-rule style, before the nonogram markup exists and again after (T-WEB-S53).

**Three consequences, all named rather than discovered.** (i) This is a **mechanical veto** on D1's options 3 and 4: landing either would require *deleting a forbidden key*, a visible arguable act in the diff rather than a silent widening. That is the point. (ii) The constant is also reused on the completion **response** at `completions.test.ts:629-646` (T-API-12), a stricter use than its own TSDoc ("a client-facing **daily** payload"); under ADR-0033 nothing is added to that response, so nothing here narrows. (iii) **ADR-0033's Consequences records the substring half in the terms the tests actually enforce** — "no client-facing daily payload may carry a `name` key at any depth, **and no scanned page's markup may contain the string `name`**" — so the future author who must rename a field knows the real constraint, and so an innocuous `name=` attribute reding two suites is a documented cost rather than a mystery.

### 7.8 The TSDoc this PR makes false — a register, not a discovery

P9 rules that leaving a TSDoc which misdescribes the shape a reader is about to write "is not a style question". The plan budgeted four corrections elsewhere (§7.4's strip table and `ProjectedGame` TSDoc, §8's `published.ts:56-62`, §9.1's P9 fix at `service.ts:225-239`, §9.4's `daily/sudoku/route.ts:11-19` comment); **seven more go stale in this PR and are budgeted here** (SRV-3) — **two in commit 3, five in commit 4**, each landing with the code it describes. Every line below was read, not recalled.

| File | What becomes false | Correction |
|---|---|---|
| `apps/api/app/cron/publish/route.ts:52-59` | "With **two** games composed serially and no isolation, ONE game's transient Neon blip…" | three games; the drain arithmetic against `BUFFER_ALERT_THRESHOLD = 4` is unchanged. Commit 4 |
| `apps/api/app/cron/publish/route.ts:100-106` | "The top-ups run SERIALLY in a fixed order, **binairo first**: … running the cheap game first means a **sudoku** CPU overrun can never starve it" | restate as the principle P7 actually applies — **cost-ascending across three**, binairo (~7 ms) → nonogram (~34–80 ms) → sudoku (~150 ms) — so the sentence stays a principle rather than a description of a two-item list. Commit 4 |
| `packages/core/src/contracts/cron.ts:33-36` and `:55-57` | "#25/#27 add their key here in the same PR" | narrowed to **#27**. Commit 4 |
| `packages/core/src/contracts/completion.ts:44-45` | "EXTENSION POINT: #25/#27 add their variants to the union" | narrowed to **#27**. Commit 4 |
| `packages/core/src/contracts/daily.ts:121` | "The extension point M2 games join (#25/#27)" | narrowed to **#27**. Commit 3 |
| `packages/core/src/testing.ts:9-12` | "#25/#27 extend this list … (the nonogram reveal's identity, the termo answer)" | the nonogram half is **discharged here**; narrow to termo, and add the substring-half constraint above. Commit 3 |
| `apps/api/test/cron-publish.test.ts:96-107` | "a run now generates a full week for **TWO** games … the heaviest test (a cold two-game top-up, T-API-S1) costs **1 557 ms** locally" | three games, with a freshly measured cold-run figure pasted in the PR. This is a **test-file comment, and the arithmetic behind every per-`it` `30_000` in the file**, so leaving it stale leaves the next author's timeout decision resting on a false premise. Commit 4 |

**And one thing that does NOT change, recorded so it is not "fixed":** `cron-publish.test.ts`'s per-`it` `30_000` values stay exactly as they are, and T-API-S21's new fault-isolation `it` in that file **keeps** the file's `30_000` because it drives a full **sudoku** week. §19's "no timeout constant is copied from the sudoku suites" is scoped to the new nonogram suites and says so.

`src/index.ts` gains, unconditionally: `nonogramSizeSchema`, `nonogramDailyContentSchema`, `dailyNonogramResponseSchema`, `nonogramCompletionRequestSchema`, and the types `NonogramSize`, `NonogramDailyContent`, `DailyNonogramResponse`, `NonogramCompletionRequest`.

---

## 8. `packages/db` changes — none to `src`, except prose

**No signature change. No new export. No migration.** Confirmed four ways in §3. The wall admits `"nonogram"` the moment `dailyPuzzleResponseSchema` widens, because `getTodayDaily<G extends ProjectedGame>` is already generic.

- `packages/db/src/published.ts:56-62` — **prose fix only.** It names nonogram as the reason the bound is `ProjectedGame` rather than `Game`; after this PR only termo is.
- `packages/db/test/fixtures.ts` — a `nonogramContentFixture()`: **structural only, no `@miolos/games` import** (`fixtures.ts:1-7`, "rule validity is the engine's concern"), a 5×5 literal bitmap with `rows`/`cols` derived by a local eight-line RLE so the fixture cannot drift into inconsistency, and it **must carry `game: "nonogram"`** (N2). The file is 48 lines and holds the content-fixture factories only.
- `packages/db/test/published.test.ts:38-55` — **this is where `insertRow` lives**, not in `fixtures.ts` (SRV-7; the earlier draft's `:50-51` line reference was right but attached to the wrong file, which is exactly the near-miss that sends an implementer to the wrong place first). Its `game?: "binairo" | "sudoku"` union widens to three and the ternary at `:50-51` (`content: game === "sudoku" ? sudokuContentFixture() : binairoContentFixture()`) becomes a `{binairo, sudoku, nonogram}` fixture lookup.
- `packages/db/test/published.test.ts` — T-DB-S6…S9 (§19), a nonogram wall suite mirroring the sudoku block at `:206-338`. **Required, not optional:** issue #17 AC 1 makes that suite unweakenable and #23 set the precedent of adding a per-game block; shipping a third projection with no wall test would leave the strip unproven at the one place it actually runs.

**T-DB-9a…9e and T-DB-S5 must come out byte-identical** (landmine 5). This design adds **zero** exports to `packages/db` — `topUpNonogramBuffer` lives in `apps/api`, the fixture is a test file — so the 24-name assertion holds unchanged. This is a hard check for the reviewer: if one of them needs editing, something was added to the wrong surface.

**Stated as a runnable command, because `git diff` takes no line range and inserting T-DB-S6…S9 shifts every line number in that block** (TR-12). Before touching the file, capture the block's digest against `origin/main`; after, capture it again from the working tree and paste both:

```sh
ANCHOR='/^describe("surface tripwires/,$p'
git show origin/main:packages/db/test/published.test.ts | sed -n "$ANCHOR" | sha256sum
sed -n "$ANCHOR" packages/db/test/published.test.ts | sha256sum
```

Anchored on the block's own opening line — `describe("surface tripwires (ADR-0024, plan 014 D16 — the mechanical wall)"`, currently `:342`, holding T-DB-9a…9d at `:343-392`, T-DB-S5 at `:392` and the 24-name assertion at `:435` — rather than on a line number, so the digest survives the insertion of T-DB-S6…S9 above it. **Two identical digests are the evidence; a mismatch is the signal.** Verified that both invocations produce output on the current tree.

---

## 9. `apps/api` changes

### 9.1 `src/publishing/service.ts` — `topUpNonogramBuffer`

A **named sibling** of `topUpBinairoBuffer`, not a generic extraction — the TSDoc at `:96-112` sanctions per-game-by-name, and the remaining consumer (Termo, a curated word list) genuinely would not fit.

```ts
/**
 * Per-DATE seed-retry budget for nonogram — binairo's 8, and NOT sudoku's
 * 2 + a run budget. Measured on this machine (Node 24.18.1, n=200/weekday,
 * warm pools): generate+validate is 0.0354 ms (Mon 5x5) to 0.1902 ms
 * (Sun 15x15).
 *
 * The worst-run model carries the INNER factor too, which an earlier draft
 * dropped (SRV-4): "exhausting all 8 seeds" means eight `generateNonogram`
 * calls that each FAILED, and a failing call runs
 * `NONOGRAM_MAX_GENERATION_ATTEMPTS = 8` internal generate+validate rounds
 * before throwing (generate.ts:11, :34-38, :65-69) — while 0.1902 ms is the
 * cost of a SUCCESSFUL call, i.e. one internal attempt. So the absolute
 * worst run — every date uncovered at `remoteConfigSchema`'s clamp ceiling
 * of 30, every date exhausting all 8 seeds on the most expensive weekday —
 * is 30 dates x 8 seeds x 8 internal attempts x ~0.19 ms = ~186 ms, plus a
 * one-time ~34 ms to build all seven memoized pools: ~220 ms. Against
 * `maxDuration: 60` s that is 0.37%, and 1.5% even at a 4x-slower runner.
 * The CONCLUSION is unchanged and that is the point of restating it: a
 * run-scoped budget would bound something already bounded two-plus orders
 * of magnitude below the limit (contrast sudoku's ~2 s per exhausted seed,
 * :204-220).
 *
 * What the retries are NOT: a recovery mechanism. `weekdayPool` is memoized
 * and seed-INDEPENDENT (difficulty.ts:54,69-72), so a `NonogramGenerationError`
 * (an empty pool) reproduces on every fresh seed. They are the cross-engine
 * convention and a tripwire against content drift.
 *
 * A separate constant rather than the module-level `MAX_SEED_RETRIES_PER_DATE`
 * (:79-82), because that one carries binairo's comment — "the engine already
 * retries 64 attempts per seed internally" — which is FALSE for nonogram
 * (the cap is 8, generate.ts:11). Reusing it would attach a false claim to a
 * correct value. Exported so tests bind to the constant, not to a literal.
 */
export const MAX_NONOGRAM_SEED_RETRIES_PER_DATE = 8;
```

The loop is binairo's, with **three deltas and no others**, each of which the TSDoc must name:

1. **`generateNonogram(seed, weekday)` takes POSITIONAL arguments** — no options object, no `maxAttempts`, no `generateDaily*` wrapper (N5). It is the odd one out among the three engines at this call site.
2. **`validateNonogram(puzzle)` takes ONE argument and returns `{ok, failures}`**, not `{approved, reasons}` (N3/C2 — handoff 019:169 is wrong).
3. **The weekday/size assertion (P6).** Placed *before* `validateNonogram` because it is cheapest and is the only one that fails closed for the date on the class of drift the validator structurally cannot see. **Its TSDoc states what it is:** a tripwire for the day this loop meets a puzzle it did not generate — unreachable for `generateNonogram` output, which writes `weekday` and `size` from the same criteria table the assertion reads (`generate.ts:31,:44-52`).

Gate order and the branch each takes:

| Gate | On failure | Why |
|---|---|---|
| `puzzle.weekday === weekday && puzzle.size === expected.size` | `break` | Not a seed miss — the engine derives both from its arguments, so a mismatch is code drift and every other seed reproduces it. Fail closed for this date |
| `validateNonogram(puzzle).ok` | `continue` | A genuine per-candidate rejection |
| `nonogramDailyContentSchema.safeParse(puzzle)` | `break` | Deterministic shape drift; retrying other seeds cannot fix it |

Everything else is identical and must stay so: `todaySaoPaulo(db)`, the `existing` set from `listBufferedDates(db, "nonogram", today)` checked **first** (so a covered date never spends a retry), `addDays`/`isoWeekdayOf` + the `isWeekday` guard with its propagating `RangeError`, **`randomUint32()` per attempt** (never derived from `(game, date)` — ADR-0024 decision 1: "a derivable seed would make future dailies precomputable"), `insertDailyPuzzle` with `ON CONFLICT DO NOTHING` and `content: content.data` (the **parsed** value, so what lands in jsonb is exactly what the read side parses back), "a lost race still means the date is covered", the `failures` accumulation that never aborts the run, the counters hoisted **out** of the `try` so `TopUpAbortedError` can still report them, and the trailing `bufferDepth(db, "nonogram")` **inside** the `try`.

**Signature** `(db: Db, depth: number) => Promise<TopUpResult>` — identical to both siblings, so `runTopUp`'s parameter type accepts it with no change.

**What happens when the engine adds a field, and why that is the WANTED alarm:** `safeParse` fails → `break` → the date lands in `failures` → the run continues and every other uncovered date fails identically → **nothing is inserted** → `bufferDepth` falls one per day → `/buffer-depth` reports `depths.nonogram` below `effectiveThreshold` → `shallow: true` → `buffer-alert.yml` opens the issue. Nothing bad is ever written; the alarm fires before any row exists. That is `daily.ts:17-24` verbatim, and it is what preserves ADR-0024's hard backward-compatibility duty.

**P9's TSDoc correction** at `:225-239` replaces the false sentence with: "the abstraction's later consumer would not fit it: Termo draws from a curated word list (ADR-0015), which is not a seed → generate → weekday-validate loop. **#25 corrected the other half of this claim: Nonogram IS that loop (`packages/games/src/nonogram/generate.ts:23-70`) — but its validator takes no external weekday, so `topUpNonogramBuffer` carries an assertion the other two get from their validators.**"

### 9.2 The cron and buffer-depth routes

```ts
  const games = {
    binairo: await runTopUp(db, "binairo", topUpBinairoBuffer, config.bufferDepth),
    nonogram: await runTopUp(db, "nonogram", topUpNonogramBuffer, config.bufferDepth),
    sudoku: await runTopUp(db, "sudoku", topUpSudokuBuffer, config.bufferDepth),
  };
```

Property evaluation order in an object literal is source order and `Object.entries` preserves insertion order for string keys, so the three `await`s are serial in P7's order and the three log lines come out in it. **No fault isolation work is needed** — `runTopUp` (`:65-93`) is already per-game and game-generic, so the third call inherits the `TopUpAbortedError` unwrapping, the separate `bufferDepth(db, game).catch(() => 0)` read and the `error: String(...)` field. `healthy` and `shallow` are `Object.values`-derived and pick the third game up with no edit.

`app/buffer-depth/route.ts:28-31` gains `nonogram: await bufferDepth(db, "nonogram"),`.

`vercel.json` is **unchanged** — cron `0 6 * * *`, `maxDuration: 60`. Adding a **~220 ms** absolute-worst-case of nonogram CPU (§9.1/P5's corrected model: `30 × 8 × 8 × ~0.19 ms ≈ 186 ms` of generation plus ~34 ms of one-time pool build; a real cold week is ~34–80 ms) to a budget sized for sudoku's ~8 s construction bound changes nothing, and the PR states it with the figures rather than silently (a reviewer who sees a third generator wired in and no note has to re-derive it).

### 9.3 `app/completions/route.ts` — the judge

```ts
    case "nonogram":
      // `NonogramReveal.solution` is [row][col] booleans — the picture itself
      // (nonogram/types.ts:5-6,29). The judge compares a FLAT numeric grid, so
      // flatten row-major and map true -> 1. That mapping is the wire contract
      // (ADR-0032): 1 = filled, 0 = not filled. A crossed cell and an
      // untouched cell are both 0 BY CONSTRUCTION, so a player who crossed
      // every empty cell and one who crossed none post the identical body —
      // there is no leniency here to get wrong, and no third state ever
      // reaches the server.
      return nonogramDailyContentSchema
        .parse(content)
        .reveal.solution.flatMap((row) => row.map((cell) => (cell ? 1 : 0)));
```

`storedSolution`'s declared return stays `readonly number[]`, so neither shipped game is touched. Without the `case` the function fails to compile (TS2366, no ending return) the moment the request union widens — the fail-closed property its TSDoc promises.

And immediately before the compare loop, the P12 length check:

```ts
  // Binairo pins .length(64) and sudoku .length(81), so for those two the
  // request schema already proves this and the check can never fire. A
  // nonogram grid is 25/64/100/225 cells and the STORED row decides which,
  // so the wire length is checked against THIS row's solution: the loop below
  // iterates `solution.entries()`, and without this a LONGER grid whose
  // prefix matched would score zero mismatches and be recorded (N7).
  // Comparing two lengths reveals nothing about the picture, so this sits
  // outside the constant-work comparison deliberately.
  if (body.grid.length !== solution.length) {
    return errorResponse(422, "grid-mismatch");
  }
```

The comparison loop, the `mismatches > 0 → 422 with no row written` outcome and `recordCompletion(outcome: "won")` are unchanged. Nonogram never writes `lost` — ADR-0008 keeps that Termo-only, and `core/src/completion.ts:8-13` says why. The whole order of operations in the route is unchanged, including the idempotent short-circuit staying **before** the date bound, the wall read and the judge.

The accept predicate, stated whole:

```
accept(submitted, storedContent) ⇔
    submitted.length === flat(storedContent).length
  ∧ ∀i. submitted[i] === flat(storedContent)[i]
where flat(c) = c.reveal.solution.flatMap(row => row.map(cell => cell ? 1 : 0))
```

and the client's matching obligation, which ADR-0032 records: `submitted[r * size + c] = 1` iff the player marked (r, c) filled; every other state maps to `0`.

### 9.4 `app/daily/nonogram/route.ts` (new, P8)

A literal copy of the sudoku route with `"nonogram"` throughout: `export const dynamic = "force-dynamic"`, `getTodayDaily(getDb(), "nonogram")`, `Response.json({}, {status: 404, headers: corsHeaders()})` on a miss with **no on-demand generation fallback ever**, and `dailyNonogramResponseSchema.parse(daily)` — parsed against the **member**, never the union, because a union parse would accept a mismatched row and lose the assertion.

And the shipped comment at `app/daily/sudoku/route.ts:11-19` is edited to record the answer: "**Revisited at #25 with three games and kept literal:** a `[game]` segment would still put an untrusted `params.game` in front of the wall, and `/daily/termo` would still resolve, reach `stripDailyContent` and throw `DailyProjectionUnsupportedError` uncaught. Three literal files cost ~75 lines total and 404 for free. Revisit again only if a game is ever added whose projection exists at build time."

### 9.5 Not touched in `apps/api`

`src/session/*`, `src/cors.ts`, `app/session/route.ts`, `app/health`, `app/root`, `vercel.json`. `ACCEPTED_DAYS_BACK` stays `1` (#31 is its lever, #58 is Fernando's open call). `wallPredicate` gains nothing.

---

## 10. Client state model, the engine adapter and the reducer

`apps/web/src/nonogram/` — pure modules first, React after.

### 10.1 Types

```ts
/** 1 = preenchida, 0 = marcada (crossed out). ADR-0032 explains why 0 is not free. */
export type NonogramMark = 0 | 1;
/** `null` = vazia (undecided). */
export type NonogramCellValue = NonogramMark | null;
/** Sticky brush. NO cycle mode (P21) — a cycle drag is a no-op, and here the drag is primary. */
export type NonogramBrush = "fill" | "cross" | "erase";

export interface NonogramPlayState extends PlayCore {
  readonly size: NonogramSize;
  /** The board constant the rails render — Nonogram's `givens`. */
  readonly clues: NonogramClues;
  /**
   * The recovered picture, or null when the clues did not solve. It lives in
   * state because — unlike Sudoku and Binairo — a Nonogram has no rule-local
   * completion test: comparing against the picture is the ONLY way to know
   * the board is finished, and the reducer may not reach for a solver on
   * every action. Derived from the PUBLISHED clues, which is ADR-0027's
   * argument verbatim.
   */
  readonly solution: readonly NonogramMark[] | null;
  /** size² entries. */
  readonly entries: readonly NonogramCellValue[];
  /** The selected cell AND the roving-focus caret — one concept (ADR-0030). */
  readonly selected: number | null;
  readonly brush: NonogramBrush;
  readonly hint: HintState;
  readonly status: "playing" | "solved";
}

export type NonogramPlayAction =
  | LifecycleAction
  | { readonly type: "select"; readonly index: number }
  | { readonly type: "move-selection"; readonly rows: number; readonly columns: number }
  | { readonly type: "set-brush"; readonly brush: NonogramBrush }
  /** A tap or Enter/Space: applies the brush, re-applying it clears. */
  | { readonly type: "mark-cell"; readonly index: number }
  /** A keyboard write of a SPECIFIC value; re-entering the same value clears. */
  | { readonly type: "enter-value"; readonly value: NonogramMark }
  | { readonly type: "clear-cell" }
  /** A drag: an idempotent SET, never a toggle. */
  | { readonly type: "paint-over"; readonly index: number }
  /** A bare verb — the state carries the solution, unlike Sudoku's. */
  | { readonly type: "use-hint" };
```

### 10.2 `engine.ts` — the one conversion boundary

Same charter as `sudoku/engine.ts:1-18`: the ONE place engine values meet client values, every conversion an explicit loop, never a cast.

| Export | Signature | Why it exists |
|---|---|---|
| `solutionMarks` | `(clues: NonogramClues) => readonly NonogramMark[] \| null` | Recovers the picture from the **published** projection via `solveNonogram` (`solve.ts:198-309`), flattens `NonogramCellState[][]` row-major, maps `"filled" → 1`, `"empty" → 0`. Returns `null` — **never throws** — on `status !== "solved"`, a row of the wrong length, any residual `"unknown"`, a flattened length ≠ `size²`, and the `RangeError` `solve.ts:199-203` raises for malformed clues. The `null` branch is **defined, not assumed away** (landmine 8): ADR-0021 decision 3 makes line-solvability a binary gate over all 265 variants and it was re-proved 280/280, so it is unreachable for a published daily — exactly the status of `solutionDigits`'s null branch. Measured 0.084 ms at 15×15 |
| `filledTarget` | `(clues: NonogramClues) => number` | The readout's denominator: the sum of every run in `clues.rows`. **From the clues, never the solution** — public, solve-free, O(runs), and verified equal to the picture's filled count on 280/280 boards. This also disposes of D4's "the denominator leaks the total filled count" worry: it does not, it is a number the player can add up themselves |
| `countFilledCells` | `(entries: readonly NonogramCellValue[]) => number` | P13/P14. Counts `entry === 1`. **Its TSDoc must state the prohibition:** this may never become "count only the cells that are painted AND correct" — that version reaches its denominator only on a correct board, turning the readout into a **per-cell solution oracle** |
| `isPictureComplete` | `(solution, entries) => boolean` | `solution.every((v, i) => (entries[i] === 1) === (v === 1))`. Iterates the **solution**, so a short `entries` array fails closed. Crosses and undecided are both "not painted": a fill-only player finishes normally. Local only; the server re-judges (ADR-0004) |
| `submittedCells` | `(entries, cells: number) => readonly NonogramMark[] \| null` | The completion body's grid. `null` unless `entries.length === cells`; otherwise `entry === 1 ? 1 : 0`. Mirrors `solvedDigits`/`allDigits` including the length proof, which is the only thing that can prove the array before the record is built |
| `nextNonogramHint` | `(solution, entries) => Hint<NonogramMark> \| null` | §15 |
| `hintKindOf` | `(hint) => "correction" \| "fill" \| "cross"` | §15 |

Imports: `{ solveNonogram, type NonogramClues } from "@miolos/games/nonogram"` (**barrel only** — ADR-0019, and §20 proves it tree-shakes to the same bytes as a deep import), `{ nextHint, type Hint } from "../play/grid-hint"`, and `import type { NonogramCellValue, NonogramMark } from "./state"` — type-only, so the `state ↔ engine` pair carries no runtime cycle under `verbatimModuleSyntax`.

**The prohibition this module's TSDoc must carry (N27):** the client takes `size` **from the wire**, never from `NONOGRAM_WEEKDAY_CRITERIA`. That constant is on the barrel but lives in `difficulty.ts`, which imports `MOTIFS, motifBitmap` at module scope — so a single client-side `import { NONOGRAM_WEEKDAY_CRITERIA }` retains all 59 233 bytes of motif tables. It is a *tempting* line, because `NonogramPuzzle` carries no difficulty field (N20) and a size label has to come from somewhere. It comes from `daily.size`.

### 10.3 The reducer

Pure. Four deliberate divergences from the two shipped reducers, each of which needs a written reason in the file or it reads as an omission:

1. **No `violating` set and no error colour.** Binairo's and Sudoku's violation displays check *rules* — local, player-derivable, disclosing nothing. A Nonogram has no local rule; the only cheap per-cell check is against the solution, and rendering it is a **per-cell oracle**. The one non-oracular analogue (a fully-decided line whose runs contradict its clue) requires the player to cross every cell in the line, has no reference frame, and could not use `--accent-app` anyway (N13). Explicitly out of scope; the escape hatch for a stuck player is the hint's correction branch, which is what it is for. **Say this in the PR** rather than letting a reviewer find the `--accent-app` collision and assume it was missed.
2. **No `mark-synced`.** It is declared and handled in both shipped reducers and dispatched **only from tests** (`sudoku-state.test.ts:335,342`; `binairo-state.test.ts:398-405`). Do not copy dead code into a third game.
3. **`use-hint` carries no `solution`.** The state has it (Sudoku's does not, which is why Sudoku's action does).
4. **`withEntry` returns the SAME state when the value is unchanged — and this guard is NEW in this game, not a copied precedent** (CLI-8). The *idiom* is shipped: `sudoku/state.ts:132-140` (`select`) and `:160-171` (`clear-cell`) both return the same state rather than a fresh object, and their comments give the reason ("a new object would re-render the board and fire the persist effect for a write that changed nothing"). What is **not** shipped is the guard **inside `withEntry`**: Sudoku's `withEntry` (`:297-314`) unconditionally calls `state.entries.map(...)`, and so does Binairo's (`:242-259`). An earlier draft cited `:160-171` as the precedent for the guard's *location*, which it is not. The location matters and is why the guard moves inward here: a drag dispatches `paint-over` per `pointermove`, and the caller cannot bail because it does not cheaply know the current value — so Binairo allocates a new `entries` array on every move event, and a persist-effect run per event with it (`binairo/state.ts:100-113`). At 225 cells that is materially worse than at 64. **Required, not an optimisation.** Binairo's absence is a latent inefficiency: **file it, do not fix it here** (E0's third issue).

The cases:

- `select` — returns the **same** state when the index is unchanged. Load-bearing, not a saving: `onFocus` dispatches `select` while the roving-focus layout effect focuses `selected`, and without the bail-out they trade a render per arrow key.
- `move-selection` — clamped per axis, **never wrapping**, reading `state.size` and never a module constant. From `selected === null` it selects index 0.
- `set-brush` — pressing the active brush is a no-op returning the same state (there is no cycle to fall back to).
- `mark-cell` — applies the brush at `index`; re-applying the brush's own value clears (one-tap undo, mirroring Binairo's "re-tapping clears" and `sudoku/state.ts:150-157`).
- `enter-value` — writes `value` at `selected`; re-entering the same value clears. This is the keyboard's own door: `1` and `2` write either value **without touching the brush**.
- `clear-cell` — same state if already empty.
- `paint-over` — a plain **SET** of the brush's value, never a toggle. A drag must be idempotent over the cells it crosses (`binairo/state.ts:100-104`).
- `use-hint` — no-op when `hint.used >= hint.free`, when `status !== "playing"`, when `solution === null`, or when `nextNonogramHint` returns `null` (never spend the free hint on a no-op). Reveals at `hint.index`, sets `hint.lastIndex`, and leaves **`selected` untouched** — the caret is the player's, the highlight is the app's, and `.cellHinted` must be able to render on its own (plan 018 finding D3).
- `restore` — P16's three-predicate guard:

```ts
  if (
    !isNonogramRecord(record) ||
    record.size !== state.size ||
    record.entries.length !== state.entries.length
  ) {
    return { ...state, now, hydrated: true };
  }
```

  The last two are **not** redundant with the schema: the schema proves `entries.length === size²` for the record's **own** size; only this compares it against **today's** board. `derive` additionally iterates the *solution*, so the length mismatch fails closed even if this guard were removed. Two walls, both cheap.
- `tick`/`pause`/`resume` — `applyTimerAction`, verbatim.

`initNonogramPlayState(daily: DailyNonogramResponse)` takes the **member type, never the union** (plan 018 S11): `entries` = `size²` nulls, `selected: null`, `brush: "fill"`, `timer: {accumulatedMs: 0, runningSince: null}`, `hint: {free: 1, used: 0, lastIndex: null}`, `now: 0`, `hydrated: false`, `solution: solutionMarks(daily.clues)`.

**The solve runs once, in the `useReducer` initializer — 0.084 ms at 15×15, on the server render too.** The state is never serialized into the RSC payload (only `daily` crosses) and SSR renders `PlaySkeleton` anyway, but it *is* a solver on the server render path and **the PR states it with the number** rather than letting a reviewer discover it.

### 10.4 When `solutionMarks` returns `null`

`NonogramScreen` renders `<DailyUnavailable copy={messages.games.nonogram.play.unavailable}/>` as its **first** branch, before the `!hydrated` gate. It is a pure function of `daily`, so server and client agree and there is no hydration mismatch; it reuses the shipped component and its structural copy prop; and usefully, `DailyUnavailable` emits neither `data-play-state` nor `data-conclusion-state`, so the hardened preflight would fail loudly if a published daily were ever unsolvable.

The honest objection — `unavailable.title` ("ainda não chegou") is not literally why the screen appeared — is accepted: the player-facing situation is identical, the `body` copy is accurate verbatim, and a second copy block for a branch the mechanical gate makes unreachable is weight for nothing.

**What this branch actually costs, corrected** (CLI-3/ADH-4). An earlier draft recorded "this branch does not mount `usePlayLifecycle`, so no prune and no sync flush happen". That is **false and unreachable under the rules of hooks**: §10.6's branch 1 predicate is `state.solution === null`, and `state` only exists after `useNonogramPlay(daily)` has run, which calls `usePlayLifecycle` unconditionally — exactly as `sudoku-screen.tsx:31` calls `useSudokuPlay(daily)` above every branch and `use-sudoku-play.ts:100-111` mounts the lifecycle with no gate. The mount effect is itself ungated (`use-play-lifecycle.ts:110-122`: `readPlayRecord` `:111`, `dispatch restore` `:113`, `prunePlayRecords(date)` `:116`, `startCompletionSync()` `:122`, whose `sync.ts:159` fires `void flushPendingCompletions()` on the spot; the only early return at `:124-127` is *below* all four). So on the unavailable branch the record **is** restored, records **are** pruned and the queue **is** flushed — and that is strictly the behaviour you want, because a player with a stranded `pendingSync` record still drains it from this route. The only thing skipped is the board.

The sentence came from the *shipped* route where it is true — `app/sudoku/page.tsx:34-36` returns `<DailyUnavailable/>` from the async **server** page before any client screen is constructed, which is the shape `/nonogram/concluido` reuses (§13.3) — and the cost does not survive the move into a client branch. **The solve must NOT be hoisted out of the hook to make this branch cheaper:** it would forfeit the prune and the flush on the one route a stale queue is most likely to land on, and it would run `solutionMarks` twice per mount, since `initNonogramPlayState` still needs the value in state.

### 10.5 `use-nonogram-play.ts`

```ts
export interface NonogramPlay {
  readonly state: NonogramPlayState;
  readonly elapsed: number;
  /** Cells the player has filled — the readout's numerator (P13). */
  readonly filled: number;
  /** The picture's cell count, summed from the CLUES. */
  readonly target: number;
  readonly hintReady: boolean;
  readonly hintKind: NonogramHintKind | null;
  readonly selectCell: (index: number) => void;
  readonly moveSelection: (rows: number, columns: number) => void;
  readonly setBrush: (brush: NonogramBrush) => void;
  readonly markCell: (index: number) => void;
  readonly enterValue: (value: NonogramMark) => void;
  readonly clearCell: () => void;
  readonly paintOver: (index: number) => void;
  readonly revealHint: () => void;
}
```

`target = useMemo(() => filledTarget(state.clues), [state.clues])`; `filled = countFilledCells(state.entries)`; `hintReady = state.solution !== null && state.hint.used < state.hint.free && state.status === "playing"`. `revealHint` reads `stateRef.current`, calls `nextNonogramHint`, `setHintKind(hintKindOf(hint))`, then dispatches `{type: "use-hint"}` — computed twice **deliberately**, for the reason at `use-sudoku-play.ts:140-143` ("once the cell is revealed, a correction and a fill are indistinguishable"); determinism makes the two calls agree. Every input wrapper is a `useCallback([])`. `buildRecord` is **module-level** so the lifecycle's ref is stable.

**The exact `persistDeps`:**

```ts
    // `state.now` is deliberately NOT here (use-play-lifecycle.ts:66-69,
    // landmine 21). `solution`, `clues` and `size` are absent for a different
    // reason: `buildRecord` never reads them, and a dependency that cannot
    // change the record's content does not belong in the array that means
    // "the record's CONTENT changed".
    persistDeps: [state.entries, state.hint.used],
```

`buildRecord(state, now, closed)` returns `{v: 1, game: "nonogram", date, size, entries: [...state.entries], grid: closed ? (submittedCells(state.entries, state.size ** 2) ?? undefined) : undefined, elapsedMs: elapsedMs(state.timer, now), hintsUsed: state.hint.used, concluded: closed, pendingSync: closed, syncOutcome: "pending"}` — **`closed`, never `solved`** (ADR-0029 consequence (e)).

### 10.6 `nonogram-screen.tsx` — four branches, in order

1. `state.solution === null` → `<DailyUnavailable/>` (§10.4).
2. `!hydrated` → `<PlaySkeleton/>`, `data-play-state="skeleton"`.
3. `status === "solved" && timer.runningSince === null` → `<NonogramConclusion date result picture/>` (§13.3). **Both conditions** — swapping on `solved` alone stamps a time the pause is about to correct.
4. else → `<PlayView/>`, `data-play-state="playing"`.

---

## 11. The board — DOM, input and accessibility

The merged spec of the geometry and interaction papers (§6.4). ADR-0030 is inherited unchanged; what this board owes is **its own key-to-action table**, not a new keyboard architecture (ADR-0030 consequence (a)). → **ADR-0037**.

### 11.1 Why `role="grid"` is unavailable — and the argument is *stronger* here

ADR-0030 decision 2 and its rejected list: a `grid` needs `row`/`rowgroup` children owning the cells; the board is one flat CSS grid; row wrappers would need `display: contents`, which has "a long, well-documented history of being dropped from the accessibility tree" (landmine 11). **Add, for Nonogram:** the flat grid also contains the **clue rails**, placed in track 1 of the first row and track 1 of each row. A per-row wrapper would either exclude that row's rail — breaking the visual row — or include it, producing a `gridcell` that is not a cell. There is no arrangement in which `role="grid"` is honest here.

### 11.2 The DOM, once

One element carrying `role="group"`, containing in DOM order: the N column-clue rails, then per row the row-clue rail followed by its N cells. **Every child is explicitly placed by an inline style** — placement only, never a background (`isCardLike` reads the inline `style` attribute for backgrounds, `checks.mjs:4165-4166`), exactly as `cellPlacement` does at `sudoku/board.tsx:151, 222, 229-232`. Auto-placement would drop cells into gutter tracks.

```
column rail c → { gridColumn: c + 2, gridRow: 1 }
row rail    r → { gridColumn: 1,     gridRow: r + 2 }
cell   (r, c) → { gridColumn: c + 2, gridRow: r + 2 }
```

| Element | Markup |
|---|---|
| board container | `<div role="group" aria-label={copy.boardAria(size)} onKeyDown {...stroke.handlers}>` |
| column rail *c* | `<div id={`nonogram-clue-col-${c}`} role="group" aria-label={copy.columnCluesAria(c + 1, runs)} className={styles.clueCol}>` → per-run `<span className={styles.clueNumber}>` |
| row rail *r* | `<div id={`nonogram-clue-row-${r}`} role="group" aria-label={copy.rowCluesAria(r + 1, runs)} className={styles.clueRow}>` → per-run spans |
| cell *i* | `<button type="button" data-cell-index={i} tabIndex={tabbable === i ? 0 : -1} aria-label={copy.cellAria(row + 1, col + 1, value)} aria-describedby={`${rowId} ${colId}`} onFocus onClick className={…}>` |

**`role="group"` on the rails is required, not cosmetic.** `aria-label` on a role-less `<div>` is not reliably exposed — which is N16's undocumented Binairo defect (`grid.tsx:185-195`). `group` permits author naming, so the label is exposed both as the rail's own name and, through `aria-describedby`, as each cell's description. Relying on subtree text instead would produce `"22223"` for runs `2 2 2 2 3`, because per-number spans concatenate without separators — which is why the label is composed in `messages.ts` (ADR-0018: copy is never composed in a component). **There is no `<div>` with only `aria-label` anywhere on this board**, and T-WEB-S43d asserts it.

**There are no givens.** A nonogram has no immutable cells, so ADR-0030 decision 4 is vacuous here: no `cellGivenAria`, no `aria-disabled` anywhere on the board. And there is no `cellInvalidAria` (§10.3 divergence 1). `cellClassName` has exactly four inputs: `filled | crossed | empty`, plus `hinted`, plus the additive caret.

**The crossed mark is drawn in CSS, not typed:** `.cellCrossed::before/::after`, two 1.5 px rules at ±45° in `var(--ink-2)`. **Computed: `#6E6659` on `--paper-desk #F7F2E9` = 5.08:1**, clearing WCAG 1.4.11's 3:1 for a non-text graphic with margin (re-derive and paste in the PR — `low-contrast` is wildcard-ignored on every scanned host and gives no signal here). Drawing it rather than typing `×` keeps every cell's `textContent` **empty**, which puts `undersized-ui-text`, `tiny-text` and `repeated-container-text` structurally out of reach at a 14 px cell. The state is carried by the accessible name, so colour is never the only carrier (`DESIGN.md:22`).

**Accepted cost of `aria-describedby`, stated:** the description is verbose ("linha 3, coluna 5: vazia" then "números da linha 3: 3, 1, 4" then "números da coluna 5: 2, 2"). Rejected alternatives: carrying the clues in each cell's `aria-label` (225 labels each restating two run lists, rebuilt on every entry change, unreadable while arrowing) and no clue association at all (the board would be navigable and unsolvable). Descriptions are the ARIA slot screen readers most commonly let users suppress, and a nonogram is unsolvable without both lines.

### 11.3 The key table

One `onKeyDown` on the container (ADR-0030 decision 3). `MOVES` cannot be a module constant because the full-width span is `size − 1`, so it is a `switch` reading `props.size`, matching `asDigit`'s idiom.

| Key | Action | `preventDefault` |
|---|---|---|
| `ArrowUp/Down/Left/Right` | move one row/column, clamped, never wrapping | yes |
| `Home` / `End` | first / last column of the row (∓`size − 1`) | yes |
| `PageUp` / `PageDown` | first / last row of the column | yes |
| `1` | `enter-value` 1 (preencher); re-entering clears | yes |
| `2` | `enter-value` 0 (marcar); re-entering clears | yes |
| `0`, `Backspace`, `Delete` | `clear-cell` | yes |
| `Enter`, `Space` | native button activation → `mark-cell` (applies the brush) | no (native) |
| anything else, incl. `Tab` | untouched | no |

**`PageUp`/`PageDown` are an addition, and the permission was verified rather than assumed.** The brief's §7 attributes "no PageUp/PageDown anywhere" to ADR-0030; **the ADR contains no such clause** — `grep -n "Page" docs/adr/0030-*.md` returns nothing, and the only `PageUp`/`PageDown` strings in the tree are inside `apps/web/.next/` build artefacts. Count that as an eleventh place a document was wrong about the ground truth (§6 is the tenth). ADR-0030 consequence (a) explicitly says a new game owes "their own key-to-action table". The pair is strictly additive (no key Sudoku handles behaves differently), costs two switch cases and zero reducer code, and answers a 15-row board whose vertical traversal is 14 presses against Sudoku's 8. **Cost of reversal if a reviewer rules the key list closed: two switch cases and one test row.**

### 11.4 Roving focus, and the two paid-for fixes

Identical mechanism to `sudoku/board.tsx:60-86` with `SIDE` replaced by `props.size`: `tabbable = selected ?? 0`; a `useLayoutEffect` on `[selected]` that returns early unless `board.contains(document.activeElement)` and then focuses `[data-cell-index="${selected}"]`. `selected` starts `null` (no caret before first interaction) and is **never restored** from the record — a caret is a session thing, never persisted.

Both fixes #23 paid for are cloned, and the cell's `onClick` composes them with the stroke:

```tsx
onClick={(event) => {
  event.currentTarget.focus();                 // WebKit: a pointer press must focus (ADR-0030 d5)
  if (stroke.consumedClick(event)) return;     // the stroke already wrote this cell
  onMarkCell(index);                           // keyboard activation (detail === 0) always lands here
}}
```

Under real pointer capture this handler never runs for pointer input — the click is retargeted to the container — so the focus call is reached only when capture *failed* (jsdom, a pen releasing early, `grid.tsx:89-92`'s `catch`). **The pointer path's focus comes from `onStrokeEnd`** (§5.3), which hands back the cell the stroke ended on at `pointerup`; the board focuses it and `onFocus` selects it. Both doors, one destination. `onFocus` remains the **only** selection writer.

### 11.5 The controls (P21)

Three toggle buttons carrying `aria-pressed`, exactly one pressed, `preencher` at first paint. Word labels, no glyphs, no emoji (anti-reference). `ControlsSkeleton` mirrors `KeypadSkeleton` (`sudoku/keypad.tsx:72-91`): `aria-hidden` divs, never buttons, reserving every box.

The argument belongs in the component's TSDoc near-verbatim: Sudoku's keypad is commands *because* Sudoku does not drag — the command carries its own value, so there is nothing sticky to expose. A Nonogram **stroke carries no value of its own**; `paint-over` must be a plain SET, and the value it sets can only come from sticky state. So modes are mechanical, and `aria-pressed` is not decoration: the brush is state a non-sighted player must be able to query before every stroke.

**Rejected: `role="radiogroup"` + three `role="radio"`.** Semantically closer to "exactly one of three", and rejected because radio semantics bring their own keyboard contract (arrows move between radios, the group is one tab stop) — a third keyboard model on a screen that already has the board's composite widget and the ordinary chrome. Binairo's shipped `aria-pressed` toggle row is the precedent, and consistency across two paint boards beats a marginally better role. **Rejected: Sudoku-style commands acting on the selected cell** — they leave the stroke unarmed, so the screen would need modes anyway.

### 11.6 The caret (P26)

```css
/* ONE declaration block for selection AND focus, so ADR-0030 consequence (c)
   holds mechanically rather than by discipline. INK, not the accent, and the
   reason is arithmetic: a filled cell IS solid --accent-nonogram (#B5563C),
   so an accent caret on it is 1:1 — invisible on exactly the cells the player
   is working. --ink (#211D19) is 3.48:1 against a filled cell and 15.01:1
   against an empty one, so it carries on all three cell states.
   Inset, never offset: this board runs at gap 0, and Binairo's
   `outline-offset: 2px` paints 4px OUTSIDE the box — the defect
   sudoku-board.module.css:189-191 names. */
.cellSelected,
.cell:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: -2px;
}
```

`-2px` rather than Sudoku's `-3px`, and **the paint model is stated correctly rather than as a formula that double-counts** (DES-8). With `outline-offset: -2px` and `outline-width: 2px` the outline **edge** sits 2 px inside the border box and the outline paints *outward* from it, so the caret occupies the cell's outermost 2 px ring — the same model `sudoku-board.module.css:188-193` describes for its own `-3px` ("Drawn INSIDE the 1.5px border"). At the 14.20 px worst case that leaves a **10.20 px untouched core**, not the 6.20 px an `cell − 2·|offset| − 2·width` formula produces, and the earlier "2.2 px to spare" against a 6 px floor was arithmetic on the wrong model (14.20 − 4 − 4 = 6.20 clears 6 by 0.20, not 2.2). **The consequence worth stating, and accepted:** for as long as the caret is on a cell it paints over that cell's own 1 px hairline and any 2 px heavy rule on the same edge. That is correct — the caret is the stronger signal and it is transient, whereas the rule is permanent and returns the instant focus moves. The constraint the caret actually imposes on the geometry is therefore `cell − 2·outline-width ≥ 6px`, which at 14.20 px holds with **4.20 px** to spare, and a 3 px inset would have left 8.20 px. Sudoku's `-3px` is unavailable here for a different reason anyway: its cells have a 1.5 px border and a radius to sit inside, and these have neither. The caret is **additive against the chromatic state** (ADR-0030 decision 6): that state rides in `background` and the caret in `outline`, so a filled or crossed cell keeps saying which it is for as long as it is the caret. **It is not additive against the hint ring, and this plan states that rather than implying otherwise.** §12.6b spends the last free channel on the hint — `box-shadow: inset 0 0 0 2px` — and an `outline` paints *above* an inset shadow, which is clipped to the **padding** box. So on the top and left edges, the ones carrying the 1 px hairline, the ring sits at [1 px, 3 px] of the border box against the caret's [0, 2 px] and a 1 px sliver of it survives; on an interior cell's right and bottom edges, which carry no border at all, the ring sits at [0, 2 px] and is covered outright. **This is the same trade the paragraph above already accepts for the hairline and the heavy rule, accepted for the same reason**: the caret is transient, singular and the stronger signal, while the ring is permanent and returns whole the instant focus moves — and it is covered only on the one cell the player is already looking at. The alternative, stacking `inset 0 0 0 2px <the cell's own background>, inset 0 0 0 4px <the ring>` to push the ring out to [2 px, 4 px], spends 4 px of a 14.20 px size-15 cell to defend a signal against a state that hides it only while the finger is on it, and is **rejected**. **T-WEB-S49 asserts the block as stylesheet text — this closes G7/N17**, which ADR-0030 claims is assertable and which nothing in the repo asserts for any board.

---

## 12. Board geometry — four size classes down to 320px

There is **no reference frame for this screen** (G6). This section is the just-in-time design, and every number below is computed or measured, never assumed. → **ADR-0035** and **ADR-0036**.

### 12.1 G2 CLOSED — the digit advance, measured

The brief flagged the tabular digit advance as UNVERIFIED and assumed `0.60 × 11 = 6.6px`. It was measured in the repo's own Chrome (puppeteer 25.4.0, `~/.cache/puppeteer/chrome/linux-151.0.7922.47`) against the exact woff2 files `next/font/google` emits for the latin subset, embedded as `data:` URIs. Advance = `width(61 repeats) − width(60 repeats)`, so side bearings cannot pollute it.

```
Instrument Sans 400/500/600/700 11px tabular-nums → EVERY digit 6.609375px, spread 0.000000
Instrument Sans 400 11px plain                    → min 4.171875  max 7.500000  spread 3.328125
Fraunces 400 11px plain                           → min 4.953125  max 7.140625  spread 2.187500
Fraunces 400 11px + font-feature-settings:"tnum"  → IDENTICAL. No change.
Fraunces 600 11px tabular                         → min 5.156250  max 7.437500  spread 2.281250
Fraunces @100px: digits plain 510.875 · "tnum" 510.875 · "onum" 510.875   (no feature responds)
             letters plain 457.406 · "smcp" 457.406 · "ss01" 457.406      (none at all)
             axis wght 400→900: 510.875 → 580.312   (variable machinery IS live)
             axis opsz 9→144:   566.703 → 508.062   (opsz IS live)
DOM box widths, Instrument Sans 500 11px tabular: "8" 6.609 · "15" 13.203 · "2 2 2 2 3" 41.672
```

**The finding G2 did not anticipate: Fraunces has no tabular figures at all.** The variable axes work; no OpenType feature tag does. So `font-variant-numeric: tabular-nums` on `var(--font-display)` is a **no-op**, and `DESIGN.md:28` + `tokens.css:58` state as law a rule that is unachievable with the chosen display face. → **ADR-0036**, and → **P23**: clue numerals are Instrument Sans.

**This is a live defect on two shipped screens, and #25 does not fix it.** `.timerCard` (`screen.module.css:199-204`, Fraunces 30 px + tabular) and `.timerBar` (`:101-106`, Fraunces 20 px) render `formatElapsed(...)` with a ≈6.1 px swing per digit at 30 px, so the running clock physically shifts on every tick. Board cells declare it too and are unaffected only because each holds one centred glyph. **`/nonogram` inherits the defect as a THIRD surface**, since `play-view.tsx` renders the same shared `.timerBar`/`.timerCard` — which is a reason to file the fix, not to widen this diff into shared CSS (N33). **Filed at E0, before the PR body is written**, so the PR's link is real.

For the brief's assumed 6.6 px: Instrument Sans tabular is **6.609375 px**, right to within 0.14 %. Fraunces would have been wrong.

### 12.2 The clue bound, measured across the whole shipped library

Enumerating **every motif and every mirrored variant** (`MOTIFS` + `mirrorH`, 50/77/67/71 variants), the way `motifs.test.ts:85-105` already does:

| size | variants | max row runs | max row digit chars | worst row line | max col runs | col lines with a 2-digit number | max clue |
|---|---|---|---|---|---|---|---|
| 5 | 50 | 3 | 3 | `1 1 1` | 3 | 0 / 250 | 5 |
| 8 | 77 | 4 | 4 | `1 1 1 1` | 4 | 0 / 616 | 8 |
| 10 | 67 | 5 | 5 | `1 1 2 1 1` | 3 | **35 / 670 (5.2 %)** | 10 |
| 15 | 71 | 5 | 5 | `2 2 2 2 3` | 3 | **157 / 1065 (14.7 %)** | 15 |

Confirms the brief's table exactly. The *theoretical* `⌈L/2⌉ = 8` runs at size 15 does not occur in the shipped library — and **B1** (§19) pins that so it cannot start occurring silently.

**The two-digit column-clue floor is real and it binds.** A `10`–`15` column clue must fit inside one cell-wide track: **13.203 px** measured. 11 px is a hard type floor — `undersized-ui-text` fires at `fontSize < 11 && dtLen >= 2 && (isInteractive || isFurniture || dtLen <= 20)`, and a 2-char clue satisfies the third disjunct unconditionally (`checks.mjs:3441, 3455`).

### 12.3 The width budget, re-derived off the shipped sheet

- **≥1141 px:** board column `V − (80 + 330 + 72 + 80) = V − 562`; card inner `= column − 2×16 − 2×1 = column − 34`. At **V=1141 → 579 → inner 545** — the binding case, and CI scans 1440 and 390 only.
- **769–1140 px:** single column, page padding still `44px 80px`, so at V=769 the card has 609 px — **wider** than at the fold. Not binding. This also disposes of the brief's "769–1140 collapse" warning: it bites only if the tracks go fluid above 768, and they do not (§12.4).
- **≤768 px:** page padding 20 px, `.gridCard` `width:100%; max-width: var(--board-mobile-max); padding:10px` + 1 px border. Card inner `= min(V − 40, cap) − 22`. **V=390 → 328; V=320 → 258.**

Row-clue gutter at `max-content`, with `column-gap: 2px` and `padding-inline-end: 4px`:

| size | arithmetic | `Gw` |
|---|---|---|
| 5 | 3×6.609375 + 2×2 + 4 | **27.83 px** |
| 8 | 4×6.609375 + 3×2 + 4 | **36.44 px** |
| 10 | 5×6.609375 + 4×2 + 4 | **45.05 px** |
| 15 | 5×6.609375 + 4×2 + 4 | **45.05 px** |

Cell = `(inner − Gw) / N`:

| size | 320 px (inner 258) `g=0` | `g=2` | `g=3` | 390 px (inner 328) `g=0` |
|---|---|---|---|---|
| 5 | 46.03 ✓ | 45.23 ✓ | 44.83 ✓ | 59.63 (capped, §12.4) |
| 8 | 27.70 ✓ | 25.95 ✓ | 25.07 ✓ | 36.45 ✓ |
| 10 | 21.30 ✓ | 19.50 ✓ | 18.60 ✓ | 28.30 ✓ |
| **15** | **14.20 ✓** | **12.33 ✗** | **11.40 ✗** | **18.86 ✓** |

Floor 13.203 px. **A gapped board fails at 320 px for the 15 class; a zero-gap board clears it.** The minimum viewport at which the 15 class still holds its two-digit column clues is `inner ≥ 45.05 + 15×13.203 = 243.10` → card 265.10 → **viewport ≥ 305.1 px**, so 320 clears by 14.9 px. (The brief's estimate was ≥312 px; the measured figure is 305.1.)

Slack at 320 px, size 15: **0.98 px of track** above the clue advance. Ink is narrower than advance — canvas `actualBoundingBox` for `"15"` at 11 px is **10.18 px** of ink inside a 13.203 px advance — so the optical air is ≈4.0 px total, ≈2.0 px each side. Tight, legible, and the only geometry that exists.

### 12.4 The templates

**File ordering inside the module is load-bearing and is stated as a rule** (TR-5). `bodyOf`'s opener is `^[ \t]*<prelude>[ \t]*\{` with the `m` flag (`css-source.ts:47-49`), so **leading whitespace is allowed** and an indented rule inside a media query is directly addressable — its own TSDoc's guarantee that "a top-level rule always wins over the same selector nested in a media query" holds only **for the media query further down**. Three rules follow, and every one of them is a mechanical precondition of §19.1, not a tidiness preference.

**(i) Every base rule first.** `.pageNonogram`, `.mobileCap5`, `.grid`, `.sizeCard`, `.size5…size15`, `.cell`, `.clueRow`, `.clueCol`, `.clueNumber`, the state classes of §12.6b, the caret block **and §12.8's `.controls`/`.control`/`.controlActive`/`.affordance`** are declared at top level **before** any `@media` block. Written in the wrong order, `bodyOf(GAME, ".cell")` returns `{ aspect-ratio: 1 }`: A4's four border assertions fail and A5's "declares no `border-radius`" passes **vacuously**. A6 depends on the same property in the other direction — it needs the desktop `.size*` templates, which are the top-level ones. As an anti-vacuity belt, A5 additionally asserts the `.cell` block it read declares `background: var(--paper-desk)`, which only the top-level block carries.

**(ii) There are TWO `@media (max-width: 768px)` blocks, and their order is part of the rule** — the **geometry** one below (`.size*` + `.cell`) first, §12.8's **chrome** one (`.controls`/`.control`/`.affordance`) second, with `@media (prefers-reduced-motion: reduce)` (§12.6b) last. This is the module's structure, not a general rule about modules: `bodyOf` is first-match **and throws on a miss** (`css-source.ts:47-63`), so a bare `bodyOf(bodyOf(GAME, "@media (max-width: 768px)"), ".controls")` would search the *geometry* block and raise ``no block for `.controls` `` — A10 would be unrunnable rather than wrong. §19.1 therefore binds the second block by **slicing past the first** and names the two constants; that is the only formulation this plan sanctions, and every mobile A-assertion says which of the two it reads.

**(iii) Exactly ONE top-level `.cell` rule.** §12.6 declares the ruled field's half and §12.6b the chromatic/motion half, but in the **file they are one block**, and §12.6b says so at its own snippet. Two top-level `.cell` blocks would make the second unreachable through `bodyOf` — A5 would still read §12.6's correctly, while A14's "`transition` names neither `transform` nor a layout property" would read a block that declares no `transition` at all, `decl()` would return `undefined`, and the assertion would pass **vacuously**. That is exactly the failure A5's `background` belt exists to catch, one property over, which is why A14 carries a `transition !== undefined` guard of its own.

**The §12 snippets are grouped by argument, not by file order** — geometry here, colour in §12.6/§12.6b, chrome in §12.8 — so the three rules above, not the order the blocks are printed in, describe the module the implementer writes: every top-level rule first, then the geometry `@media (max-width: 768px)`, then the chrome one, then `@media (prefers-reduced-motion: reduce)`.

```css
.pageNonogram {
  --grid-card-rot: -0.7deg;
  --stats-card-rot: 0.9deg;
  --tape-rot: -4deg;
  --board-mobile-max: 350px;     /* NO FALLBACK EXISTS at screen.module.css:409 (N12) */
}

/* The mobile cap is per SIZE, not per game — carried on the SAME element as
   `.pageNonogram` when `size === 5`, declared after it so it wins at equal
   specificity within this one file (DES-5). `.gridCard` is
   `width: 100%; max-width: var(--board-mobile-max)` in the SHARED sheet
   (screen.module.css:408-409), so a single 350px value would render a 350px
   card around a 288px board at 390px — ~31px of dead paper each side, on the
   one screen whose whole argument is paper that hugs its board, and the only
   size class that would not fill its card. 310 = 288 board + 2×10 padding +
   2×1 border; at 320px `min(310, 280)` still resolves to 280, so §12.3's
   46.03px cell is unchanged. */
.mobileCap5 { --board-mobile-max: 310px; }

/* ONE flat grid. `gap: 0` is load-bearing, not tidiness: with any gap at all
   a 15x15 board at 320px gives a 12.33px cell against a 13.203px two-digit
   column clue (measured). The rules are per-cell borders below. */
.grid { display: grid; gap: 0; touch-action: none; }

/* The stats card's third row — Sudoku's `.levelCard` verbatim
   (sudoku-board.module.css:372-376), rendered inside the shared
   `screen.statRow`/`screen.statLabel` pair the way sudoku/play-view.tsx:110-113
   renders the level. Declared here because §16.3 ships `sizeLabel`/`size` and
   §16.2's `boardSize` hoist is justified by "the mobile progress bar AND the
   stats card render the same string" — without the row those two copy keys are
   dead (ADH-12). It lives in the game's own module for the same reason
   `.levelCard` does: no other game has a board size on the wire. */
.sizeCard { font-size: 14px; color: var(--ink-2); font-variant-numeric: tabular-nums; }

.size5  { grid-template-columns: max-content repeat(5, 52px);
          grid-template-rows:    max-content repeat(5, 52px); }
.size8  { grid-template-columns: max-content repeat(8, 52px);
          grid-template-rows:    max-content repeat(8, 52px); }
.size10 { grid-template-columns: max-content repeat(10, 48px);
          grid-template-rows:    max-content repeat(10, 48px); }
.size15 { grid-template-columns: max-content repeat(15, 32px);
          grid-template-rows:    max-content repeat(15, 32px); }

@media (max-width: 768px) {
  /* The desktop px tracks MUST be overridden here or the board is 525px wide
     inside a 328px card. */
  /* No `max-width`/`margin-inline` here: the Monday cap is the CARD's, set
     by `.mobileCap5` above, so the board fills its card at every size the way
     both shipped games' boards do (DES-5). */
  .size5  { grid-template-columns: max-content repeat(5, minmax(0, 1fr));
            grid-template-rows:    max-content repeat(5, auto); }
  .size8  { grid-template-columns: max-content repeat(8, minmax(0, 1fr));
            grid-template-rows:    max-content repeat(8, auto); }
  .size10 { grid-template-columns: max-content repeat(10, minmax(0, 1fr));
            grid-template-rows:    max-content repeat(10, auto); }
  .size15 { grid-template-columns: max-content repeat(15, minmax(0, 1fr));
            grid-template-rows:    max-content repeat(15, auto); }
  .cell   { aspect-ratio: 1; }        /* Binairo's shipped mechanism, :243-246 */
}
```

**Fixed integral px above 768 px is forced, not stylistic.** `.board` is `display:flex; flex-direction:column; align-items:center` (`screen.module.css:272-279`), so `.gridCard` is shrink-to-fit in every band except ≤768. A percentage width inside a shrink-to-fit parent resolves against the parent's max-content, which for a grid of empty cells collapses — the recorded failure at `sudoku-board.module.css:440-445`. Fixed tracks make the grid's intrinsic width definite and the card wraps it.

**Four explicit classes, not `repeat(var(--n), var(--cell))`.** The custom-property form is legal by `var()` substitution but is unassertable through `css-source.ts` — `decl()` would hand a test the string `"max-content repeat(var(--n), var(--cell))"` and `pixels()` would throw. Literal templates give `decl()` a parseable string, which is the entire mechanism by which any of this geometry is enforceable (§19 A1–A14). Sudoku ships literal templates for the same reason.

Final numbers:

| size | desktop cell | `Gw` | board | card | fits the 579 px column |
|---|---|---|---|---|---|
| 5 | 52 px | 27.83 | 287.83 | 321.83 | ✓ |
| 8 | 52 px | 36.44 | 452.44 | 486.44 | ✓ |
| 10 | 48 px | 45.05 | 525.05 | **559.05** | ✓ (19.95 px spare) |
| 15 | 32 px | 45.05 | 525.05 | **559.05** | ✓ |

Sizes 5 and 8 take `DESIGN.md:50`'s 52 px unchanged. Sizes 10 and 15 share a **480 px cell field** (10×48 = 15×32), so the two hard weekdays are physically the same sheet of paper. All four are on the 4 pt scale. The `.mobileCap5 { --board-mobile-max: 310px }` cap exists so the Monday board is not *larger* on a phone (59.6 px uncapped) than on a desktop, and it caps the **card** rather than the grid so the board still fills its paper: card inner `310 − 22 = 288 = 27.83 + 5 × 52.03`.

### 12.5 The gutter mechanism — `max-content` tracks

**Chosen: `max-content` grid tracks inside the same grid.** Rejected: fixed px per size (embeds a font measurement in the stylesheet that silently breaks when the font, weight or size changes, and over-reserves for short clue sets); cell-wide `K` tracks (couples the gutter to the cell and clears 320 only by accident); a JS-emitted custom property (reimplements in JavaScript, with a magic digit advance, exactly what the layout engine computes exactly and for free).

```css
.clueRow {                      /* one per row, at grid-column 1 */
  display: flex; justify-content: flex-end; align-items: center;
  column-gap: 2px; padding-inline-end: 4px; min-width: 0;
}
.clueCol {                      /* one per column, at grid-row 1 */
  display: flex; flex-direction: column; align-items: center;
  justify-content: flex-end; row-gap: 2px; padding-block-end: 4px; min-width: 0;
}
.clueNumber {
  font-family: var(--font-ui); font-size: 11px; font-weight: 600;
  line-height: 1; font-variant-numeric: tabular-nums; color: var(--ink);
}
```

`column-gap: 2px` rather than 3 px buys 4 px of gutter at sizes 10 and 15, which at 320 px is the difference between **0.98 px** and **0.71 px** of slack over the two-digit floor. One number, one band, no media query.

**The decisive argument for `max-content`:** the failure mode is graceful. A future motif with more runs than today's library **shrinks the cells** rather than overflowing the phone. The library's bound is pinned mechanically (B1) so that day never arrives silently.

### 12.6 The rules — colours with COMPUTED contrast

Semi-transparent borders composite over the cell's **own** background (backgrounds paint under borders), so every ratio is computed against the fill the rule actually sits on.

```css
/* The module's ONE top-level `.cell` rule (§12.4 rule iii). §12.6b's
   `position`, `display`, the centring pair and the paint-only `transition`
   belong to THIS block — they are shown separately there only because their
   argument is chromatic; a second `.cell { … }` in the file would be
   unreachable through `bodyOf` and would make A14 pass vacuously. */
.cell {
  box-sizing: border-box;             /* without it the 2px rules widen tracks */
  border-top:  1px solid color-mix(in srgb, var(--ink) 50%, transparent);
  border-left: 1px solid color-mix(in srgb, var(--ink) 50%, transparent);
  background: var(--paper-desk);
  /* NO border-radius. A ruled continuous field cannot carry --radius-cell:
     with gap 0 a 5px radius notches all four corners of every interior
     junction. Recorded deviation from DESIGN.md:35. */
  /* + §12.6b's position/display/centring/transition */
}
/* Frame AND the every-5-cells group rule in one modulo: row % 5 === 0 and
   col % 5 === 0 cover index 0 (the frame) and 5/10 (the groups). Size 5
   therefore gets a frame and no interior rule, which is correct. */
.cellRuleTop    { border-top-width: 2px;  border-top-color: var(--ink); }
.cellRuleLeft   { border-left-width: 2px; border-left-color: var(--ink); }
.cellEdgeRight  { border-right:  2px solid var(--ink); }   /* col === N-1 */
.cellEdgeBottom { border-bottom: 2px solid var(--ink); }   /* row === N-1 */
```

| Pair | resolved | against | **ratio** | verdict |
|---|---|---|---|---|
| hairline `ink 50%` | `#8c8881` | `--paper-desk #F7F2E9` | **3.16 : 1** | clears WCAG 1.4.11's 3:1 |
| the same expression on card paper (Sudoku's shipped `.rule`) | `#8e8a84` | `--paper-card #FBF7EF` | **3.21 : 1** | matches the shipped comment |
| **rejected** `--line #D8D0C2` | — | `--paper-desk` | **1.37 : 1** | not a separator |
| heavy rule `var(--ink)` | `#211D19` | `--paper-desk` | **15.01 : 1** | |
| heavy rule `var(--ink)` | `#211D19` | `--accent-nonogram #B5563C` | **3.48 : 1** | clears 3:1 **on the picture too** |
| filled vs empty cell | `#B5563C` vs `#F7F2E9` | — | **4.32 : 1** | the picture reads without any rule |
| cross mark `var(--ink-2)` | `#6E6659` | `--paper-desk` | **5.08 : 1** | |
| clue numerals `var(--ink)` | `#211D19` | `--paper-card` | **15.67 : 1** | |
| the chromatic cell states and the hint's inset ring | — | — | — | **§12.6b**, which computes them there rather than here because two of them depend on which fill they sit on |

Two consequences stated rather than discovered: the hairline over a **filled** cell is 1.93:1 and therefore invisible between two adjacent filled cells — **which is correct, not a defect**: a run of filled cells is one visual block, which is what a nonogram picture *is*, and the boundary there carries no information. The heavy rule is the one that must survive the fill, and at 3.48:1 it does. `--ink-2` was rejected for the heavy rule (1.18:1 against a filled cell). **Escalation if a browser review measures the rendered hairline below 3:1:** `ink 55%` → `#817d77`, 3.67:1 over desk, still 4.09:1 apart from the heavy rule — one token change, no geometry change. 50 % was chosen because it is byte-identical to the shipped `.rule` expression the repo already argued for.

### 12.6b The chromatic cell states, the hint's channel, and the board's motion

§12.6 declares the ruled field and nothing else; the state classes it composes with are declared here rather than left to "mirror `sudoku-board.module.css`", which is the instruction that would import the precedent's defect (DES-1). **The precedents emit exactly ONE chromatic class** (`sudoku/board.tsx:240-257`'s `const chromatic = …`; `binairo/grid.tsx:245-259`'s early return), so a copied `.cellHinted { background: color-mix(in srgb, var(--accent) 10%, var(--paper-desk)) }` would **replace** the fill, and the one cell the day's single free hint just filled would render as a ~10 % tint — indistinguishable from an empty cell, on a board where the fill *is* the payload. That is the defect this section exists to close.

```css
/* THE SAME BLOCK AS §12.6 — one top-level `.cell` rule in the file, never
   two (§12.4 rule iii). Shown apart only because the argument here is
   chromatic; in the module these declarations sit inside §12.6's braces,
   because `bodyOf` is first-match and a second `.cell { … }` would be
   unreachable, leaving A14's `transition` assertion to read a block with no
   `transition` and pass vacuously.
   `position: relative` so `.cellCrossed`'s pseudo-elements have a containing
   block: `.cell` is a flex box with no positioning, exactly like
   sudoku-board.module.css:103-118, so a copied `::before` would resolve
   against the page. */
.cell {
  /* …§12.6's box-sizing, the two hairline borders and
     `background: var(--paper-desk)`, then: */
  position: relative; display: flex; align-items: center; justify-content: center;
  /* Paint-only, never width/height/padding/margin (which fire
     `layout-transition`). No `transform`: see the deviation below. */
  transition:
    background-color var(--duration-fast) var(--ease-settle),
    box-shadow       var(--duration-fast) var(--ease-settle);
}

.cellFilled  { background: var(--accent); }     /* NEVER var(--accent-nonogram) here — the
                                                   accent is set inline on the screen root from
                                                   play/accent.ts, sudoku-board.module.css:11-13.
                                                   Binairo writes --accent-binairo directly and is
                                                   the older convention; Sudoku's is the one #23
                                                   argued for and the one a third game copies. */
/* The hook §11.2's two ::before/::after rules attach to (1.5px at ±45deg in
   var(--ink-2), 5.08:1 on desk paper). The background is restated rather than
   inherited so a reader of this block can see all three chromatic states side
   by side and so `cellClassName` has a class to emit for every value. */
.cellCrossed { background: var(--paper-desk); }
.cellSkeleton { background: var(--paper-tint); cursor: default; }  /* colour only; every dimension
                                                   still comes from .cell and .grid, so the
                                                   placeholder board is the real board's size by
                                                   construction (binairo-screen.module.css:92-96) */

/* THE HINT. Every other channel is spent — `background` is the chromatic
   state, all four borders carry the ruled field, `outline` is the caret — so
   the hint takes the one channel left, an INSET RING, and it is ADDITIVE
   against the chromatic state: the cell keeps saying filled or crossed while
   it says "the app placed this" (ADR-0030 decision 6, plan 018 finding D3).
   It is NOT additive against the caret, which shares this ring's edges and
   paints above it — §11.6 works the overlap out edge by edge and accepts it.

   Two rules, not one, and the split is COMPLETE rather than partial:
   `use-hint` always writes a value — fill, cross, or a correction to the
   target — so `.cellHinted` can only ever compose with `.cellFilled` or
   `.cellCrossed`, never with an empty cell. The ring is the INVERSE of the
   cell's own ink, which is why one colour cannot serve both: `--ink-2` is
   1.18:1 on terracotta and `--accent` is 1:1 on it, both measured below. */
.cellFilled.cellHinted  { box-shadow: inset 0 0 0 2px var(--paper-desk); }  /* 4.32:1 on #B5563C */
.cellCrossed.cellHinted { box-shadow: inset 0 0 0 2px var(--accent);     }  /* 4.32:1 on #F7F2E9 */

/* This module's own block: the shared sheet's covers `.hint` and cannot
   reach these classes (landmine 24), and DESIGN.md:44 makes a reduced-motion
   alternative law. Mirrors sudoku-board.module.css:391-401. */
@media (prefers-reduced-motion: reduce) {
  .cell, .control { transition: none; }
}
```

| Pair | resolved | against | **ratio** |
|---|---|---|---|
| hint ring on a filled cell, `--paper-desk` | `#F7F2E9` | `--accent-nonogram #B5563C` | **4.32 : 1** |
| hint ring on a crossed cell, `--accent` | `#B5563C` | `--paper-desk #F7F2E9` | **4.32 : 1** |
| **rejected** one-colour ring `--ink-2` | `#6E6659` | `--accent-nonogram` | **1.18 : 1** — the same failure that rejects `--ink-2` for the heavy rule |
| **rejected** one-colour ring `--ink` | `#211D19` | — | clears both (15.01 / 3.48) but is the **caret's** colour and geometry, so a hinted cell would be indistinguishable from a cell the player merely has the caret on |
| `.cellSkeleton` `--paper-tint` | `#F1EADD` | `--paper-desk` | 1.07 : 1 — a placeholder, deliberately not a signal |

**The hint ring is the one place this plan gives a board element a `box-shadow`, so §12.7's card-like argument is re-run for it there rather than assumed here.** Short version: `isCardLike` reads `hasShadow` from the *computed* `boxShadow`, so the flag does flip — and `isCardLikeFromProps` still returns false, because `.cell` has no radius and no inline/Tailwind background. §12.7 carries the citations.

**Recorded deviation — the board has no press affordance** (§12.9 deviation 6, closing DES-7's fork). `DESIGN.md:44`'s rule is "Pressed = the element slides 1px toward its shadow and the shadow shrinks by the same amount". A ruled-field cell **has no shadow**, so the rule has nothing to bind; and at `gap: 0` a 1px `transform: translate(1px, 1px)` would paint over its neighbour — the identical arithmetic that rejects a positive `outline-offset` here (`sudoku-board.module.css:189-191`). The board's motion is therefore the paint-only transition above and nothing else, with its reduced-motion counterpart in the same module. **Where the rule does govern — the chrome controls — it is honoured in full**, §12.8. This is the decision §5.2 and §13.1 promise when they say the module owes a `prefers-reduced-motion` block: the block covers `.cell` and `.control`, and it is not written for animations that do not exist.

### 12.7 Why none of this trips the visual gate — verified against the detector source

`isCardLike` (`checks.mjs:4151-4169`, impeccable 3.4.0 — line numbers belong to that version and a bump moves them) reads `hasBorder` from the **class name only** (`/\bborder\b/`) and `hasBg` from **Tailwind class names or the inline `style` attribute only** (`:4165-4166`). A CSS-Modules background or border is invisible to it. `isCardLikeFromProps` (`:227-230`, a *different* function from `isCardLike`) is `if (!hasShadow && !hasBorder) return false; return hasRadius || hasBg;`. So `.grid`, `.clueRow` and `.clueCol` fail the first guard outright — none carries a shadow or a `border` class name. `.cell` *does* trip `hasShadow` in its hinted composition (§12.6b's inset ring is read from the computed `boxShadow`), and still returns **false** at the second line, because it declares no `border-radius` and its background is a CSS-Modules one. `nested-cards` cannot fire on any of the four.

`cramped-padding`'s flush branch (`:3196-3340`) *does* read computed borders and backgrounds, so it is the real constraint on the rails. It requires a visible boundary **and** `padding ≤ 2` **and** a direct child with `textContent.length > 4`. Therefore, as a hard rule for the implementer: `.clueRow`/`.clueCol` carry **no background, no border, no outline, no box-shadow**, and **each clue number is its own `<span>` of 1–2 characters** — a single element rendering `"2 2 2 2 3"` is 9 characters and would be a flush candidate the moment anything gave the rail a boundary.

`repeated-container-text` requires `/[a-zA-Z]/` (`:4280-4330`) — pure digits can never fire it. `text-overflow` cannot fire because `max-content` never overflows.

### 12.8 Touch targets — the arithmetic, and where 44 px IS honoured

`PRODUCT.md:39` / `DESIGN.md:40` require ≥44 px. On the board this is **arithmetically impossible** for sizes 10 and 15, and the plan states it rather than quietly missing it. At the reference phone the card inner is 328 px; `10 × 44 = 440` and `15 × 44 = 660` both exceed it **before any gap, border or gutter**. WCAG 2.5.8's softer 24 px floor: sizes 5 and 8 clear it at both viewports (46.03 / 27.70 at 320); size 10 clears at 390 (28.30) but not at 320 (21.30); size 15 fails at both (18.86 / 14.20). This is the position Sudoku recorded verbatim, one rung further because 15 > 9. The essential-presentation exception applies: **the grid is the content.**

Where the rule is honoured, which is where it governs — the chrome controls. **Both bands are specified, and so is what a pressed brush looks like** (DES-6): `aria-pressed` carries the non-sighted half of P21/ADR-0037, and without a sighted half the argument is only half made — and §26.1's own falsifier for P21 ("the brush proving invisible at 390 px") cannot be evaluated against a spec that does not exist.

```css
/* Desktop. Binairo's shipped control vocabulary (binairo-screen.module.css:
   120-165), not a new one: a card-shaped button that INVERTS when active —
   `.controlDigitActive` is literally "the button becomes the ink it paints".
   Non-zero padding on BOTH axes for the same `cramped-padding` reason
   .control and the shared .hint carry it (screen.module.css:224-229). */
.controls { display: flex; align-items: center; gap: var(--space-3); margin-top: 30px; }

.control {
  box-sizing: border-box; display: flex; align-items: center; justify-content: center;
  padding: var(--space-2) var(--space-3);
  height: 52px;
  background: var(--paper-card);
  border: 1.5px solid var(--accent);
  border-radius: var(--radius);
  color: var(--accent);
  font: var(--text-button);
  cursor: pointer;
  box-shadow: var(--shadow-sm) color-mix(in srgb, var(--accent) 22%, transparent);
  transition:
    transform  var(--duration-fast) var(--ease-settle),
    box-shadow var(--duration-fast) var(--ease-settle);
}
/* DESIGN.md:44's press, honoured here because a control HAS a shadow to
   slide toward — unlike a board cell (§12.6b). */
.control:active { transform: translate(1px, 1px);
                  box-shadow: 2px 2px 0 color-mix(in srgb, var(--accent) 22%, transparent); }
.control:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

/* THREE carriers, so the state survives greyscale (DESIGN.md:22 /
   PRODUCT.md:40): the fill inverts, the label inverts, and `aria-pressed`
   carries it to AT. The 1.5px border is NOT one of them and is deliberately
   not restated here — `.control` already resolves it to `var(--accent)`, so a
   `border-color: var(--accent)` on this rule would be a no-op that reads to a
   test (and to the next reader) as a third visual carrier it is not. */
.controlActive { background: var(--accent); color: var(--paper-card); }

/* The keyboard affordance, Sudoku's placement and its mobile rule verbatim
   (sudoku-board.module.css:321-330, :470-472): a desktop-only line, hidden
   on a phone that has no keyboard to afford. */
.affordance { margin-top: var(--space-3); color: var(--ink-2); font: var(--text-body); }

@media (max-width: 768px) {
  .controls { box-sizing: border-box; display: flex; gap: 8px;
              width: 100%; max-width: var(--board-mobile-max);
              margin-top: var(--space-5); }
  .control  { flex: 1; height: 60px; }
  .affordance { display: none; }
}
```

Three equal controls at 320 px: row `min(350, 280) = 280`, minus `2 × 8` gap = 264 free → **88 px each**, height **60 px**. The `width: 100%` + cap pair is not decoration — it is the fix for finding `mobile-controls-shrink-to-fit-and-sub-44px-targets`: without it `.board`'s column-flex cross axis resolves the ratios against a max-content row and the buttons come out sub-44 px.

**On a size-5 day the control row reads 310 px, not 350 px, and that is stated rather than wished away.** `.mobileCap5` sits on the **same element** as `.pageNonogram` (§12.4) and custom properties **inherit**, so on Mondays every descendant of the page root — `.gridCard` and `.controls` alike — resolves `--board-mobile-max: 310px`. There is no mechanism by which `.controls` could read the page value while `.gridCard` reads the variant, short of re-declaring `350px` on `.controls` itself, which it deliberately does not do. The consequence, at both scanned viewports: at **320 px** it is moot — `min(310, 280) = min(350, 280) = 280`, so A10's 88 px stands at every size; at **390 px** the Monday row is 310 px (3 × 98 px) against 350 px (3 × 111.3 px) on the other three days. Both clear the 44 px token with room, and the narrower row is the one that lines up with the narrower Monday card it sits under — which is the outcome §12.4's cap was chosen for. A10 therefore checks the arithmetic for **both** caps the page can resolve, not only 350. The hint button and the top bar inherit ≥44 px from the shared sheet.

Contrast for the pressed state, computed: unpressed label `#B5563C` on `--paper-card #FBF7EF` = **4.51:1**; pressed label `--paper-card #FBF7EF` on `--accent-nonogram #B5563C` = **4.51:1**; the 1.5 px border `#B5563C` on `#FBF7EF` = **4.51:1**. All three clear WCAG AA's 4.5:1 for the label and 3:1 for the border, and the pair differs in exactly **two** declarations — `background` and `color`, a clean inversion — because the **resolved border colour is identical in both states**: `.control` declares `border: 1.5px solid var(--accent)` and `.controlActive` adds nothing to it. A13 therefore asserts the four values (`--paper-card`/`--accent` and `--accent`/`--paper-card`) rather than counting declarations: asserting "`.controlActive` differs from `.control` in `border-color`" would pass only because `decl()` cannot see inside the `border` shorthand and returns `undefined` — an assertion that is green for the wrong reason, which is the class of defect §12.4's rules and A5's `background` belt exist to stop. **Why `--paper-card` and not Binairo's `--paper-desk` on the inverted state:** desk on terracotta is **4.32:1**, which is an AA failure for a 14 px word — the same 4.32:1 the plan already registers as a real failure at N14. Binairo's shipped `.controlDigitActive` gets away with `--paper-desk` because its label is a 24 px Fraunces 600 numeral, i.e. WCAG large text at a 3:1 floor; a brush label is a 14 px word and is not.

### 12.9 Recorded design-system deviations

Each lands in the module's TSDoc with its arithmetic, and each is listed in the PR body:

1. **Cell gap 0 instead of `DESIGN.md:50`'s 4 px/3 px** — §12.3's table; a gapped 15-class board fails at 320 px.
2. **No `--radius-cell` on cells** — at gap 0 a 5 px radius notches all four corners of every interior junction.
3. **48 px and 32 px cells instead of 52 px at sizes 10 and 15** — `15 × 52 = 780` against 545 px available at the fold (N22).
4. **Clue numerals in `var(--font-ui)`, not Fraunces** — measured: Fraunces has no tabular figures (ADR-0036).
5. **Board touch targets below 44 px at sizes 10 and 15, and below WCAG 2.5.8's 24 px floor at size 15** — §12.8's arithmetic; the essential-presentation exception. **Also recorded in ADR-0035**, because that is the document #28 and the native clients inherit (ADH-10); Sudoku recorded the same trade in a code comment only (`sudoku-board.module.css:408, :413`), and a snapshot is not an inheritable record.
6. **No press affordance on a board cell** (against `DESIGN.md:44`'s "Pressed = the element slides 1px toward its shadow and the shadow shrinks by the same amount") — §12.6b's arithmetic: a ruled-field cell has no shadow for the rule to bind, and at `gap: 0` a 1 px translate paints over its neighbour. The board's motion is a paint-only `background-color`/`box-shadow` transition with its own reduced-motion block; the chrome controls honour the rule in full (§12.8).
7. **`--paper-card`, not `--paper-desk`, as the label on every terracotta FILL** (added at step 6, finding **ISS-A2**) — measured in the repo's own Chrome against the built stylesheets and the real `next/font` woff2 files, at 1440×900 and 390×844: desk ink on `--accent-nonogram` #B5563C is **4.318:1**, below `PRODUCT.md`'s ≥4.5:1 for body text at 14 px/600, and card ink on the same fill is **4.506:1**. One custom property carries it — `--ink-on-accent`, handed out with `--accent` by `src/play/accent.ts` and read as `var(--ink-on-accent, var(--paper-desk))` by `screen.hint`, `conclusion-view.emptyCta`, `conclusion-view.ctaNext` and the hub's `page.cta`. This is the same one-token remedy `nonogram-board.module.css:461-463` already applies to `.controlActive`, and the fallback is what keeps Binairo and Sudoku byte-identical (90 probes measured, 76 unchanged, and every one of the 14 that moved is a terracotta fill). **The accent-on-PAPER half of the same pair is deliberately NOT deviated here** — see §27's ISS-A2 row.

**The strongest argument against all of this, and why it loses.** *The zero-gap board abandons three `DESIGN.md` specs at once for one weekday on one phone width; ship a gapped, rounded, 52 px-cell board like the other two and let a 320 px phone scroll on Saturdays.* It loses on three grounds. (i) **"Let it scroll" is already a closed question** — `binairo-screen.test.tsx:965-983` exists because a board that overflowed below 369 px shipped once, the whole document scrolled sideways, and the last columns were unreachable; CLAUDE.md states the page body must never scroll horizontally. A gapped 15×15 needs a 333 px viewport. (ii) **The deviation is smaller than it looks and it is the traditional form** — a nonogram is not a grid of separated cells but a ruled field with a heavy rule every five; `DESIGN.md:50`'s spec was written for the 8-column Binairo reference frame, and there is no reference frame for this screen at all. The gap and the radius separate *values*; here there are no values, only a picture, and separating its cells actively fights the reveal. (iii) **The system's own escape hatch is already drawn** — Sudoku answered the same problem at smaller scale by *drawing the structure rather than inferring it from spacing*, with the identical `color-mix` expression and the identical 3:1 argument. This is that decision taken one step further, not a new idea. The residual cost is named: **32 px cells at size 15 on a 1440 px desktop**, because one shared fold is worth more (P25). If a visual review calls it too small, the sanctioned fix is a **nonogram-only** `@media (min-width: 1240px)` cell step inside its own module — never a change to the shared fold.

---

## 13. The picture reveal

→ **ADR-0034**. AC 2's subject.

### 13.1 Why the play view cannot carry it (P27)

The sequence is: commit N sets `status: "solved"` with `timer.runningSince !== null` → the screen still renders `PlayView` → **the browser paints the solved board** → the passive effect dispatches `pause` → commit N+1 renders the conclusion. A `var(--duration-slow)` (250 ms) transition started at that paint is interrupted at ~16 ms of 250 ms. Making it visible would require holding the play view open on a timer — a new per-game divergence in the one file ADR-0028:131 pins as "every future game screen is a copy of this shape, not a new decision" — and it would fight the invariant `sudoku-screen.tsx:47-50` records ("swapping early would stamp a time the pause is about to correct"), which #23's review paid for.

A paint-only transition on the board's cells is still worth having, **and §12.6b now specifies it rather than promising it** — `background-color` and `box-shadow` over `--duration-fast var(--ease-settle)`, with the module's own `prefers-reduced-motion` counterpart covering `.cell` and `.control` (DES-7). It is not the press affordance, which §12.9 deviation 6 records as deliberately absent on a shadowless zero-gap cell. And **it must not be sold as the reveal** in the PR or the ADR.

**This is a React scheduling claim and jsdom cannot prove it** (§26). It is observed in a real browser at **build step 7**, the moment the screen exists — **E12b**, the cheapest measurement in the plan: load `/nonogram` locally, solve it, and read a `performance.now()` delta around the swap (or a `requestAnimationFrame` count between the commit that sets `solved` and the unmount). Its outcome is pasted, not asserted. If the solved board persists ≥200 ms, the in-place half becomes live and is **added** — additive to this design, not a rework — and **ADR-0034 is amended in the same PR** so the repo never carries a doc whose stated mechanism the branch disproved (ADH-9/CLI-6). The decision itself is safe either way: ADR-0028:131's one-shape-per-game argument carries P27 on its own, which is why the ADR now leads with it and marks the frame count PENDING.

### 13.2 `ConclusionView`'s exact widening

```ts
// apps/web/src/play/types.ts, beside ConclusionCopy — same PLAIN DATA ONLY rule.
/**
 * The solved picture, for the one game whose payoff is an image (ADR-0034).
 * Plain data across the RSC boundary: a row-major bitmap, its side, and a
 * pre-composed accessible name. Never a function, never a node — the same
 * constraint ConclusionCopy carries and route-ssr.test.tsx enforces.
 *
 * Supplied ONLY by a client component that owns the local play record. A
 * server segment must never compute it: /<jogo>/concluido renders for
 * players who have NOT solved, and its RSC payload would become a spoiler
 * channel (ADR-0004, ADR-0027's rejected list, ADR-0033).
 *
 * `size` is a plain `number`, not a game's size union: this type is
 * game-blind by construction and must not name one game's shape.
 */
export interface ConclusionPicture {
  readonly size: number;
  /** Row-major, length size²; 1 = filled. */
  readonly cells: readonly (0 | 1)[];
  /** Composed by the caller from its own i18n bundle. */
  readonly label: string;
}
```

Props become exactly `{game, date, copy, result?, picture?}`. **`ConclusionResult` is unchanged and cannot carry the picture:** `stamp = stored ?? result` (`conclusion-view.tsx:98`) relies on a `PlayRecord` being structurally assignable to `ConclusionResult`, and a record has `grid`/`size`, not `picture` — so a record-sourced stamp would silently carry `picture: undefined`, which is exactly the conclusion-route case that must work.

### 13.3 Who supplies it — one new per-game client wrapper, serving both mounts

New file `apps/web/src/nonogram/nonogram-conclusion.tsx` (`"use client"`), which subscribes with `useRecordSnapshot("nonogram", date)` and derives the picture from a concluded record, falling back to the prop:

```tsx
  const fromRecord: ConclusionPicture | undefined =
    stored?.game === "nonogram" && stored.concluded && stored.grid !== undefined
      ? { size: stored.size, cells: stored.grid, label: messages.games.nonogram.reveal.aria }
      : undefined;
  return <ConclusionView game="nonogram" date={date} copy={…}
           result={result} picture={fromRecord ?? picture} />;
```

**The same `(game, date)` key as `ConclusionView`'s own subscription, deliberately.** `use-record-snapshot`'s cache is a single module slot keyed `{game, date}` (`:40-49`), so two subscribers on the same key share one cached object and neither re-renders. Two subscribers on **different** keys would thrash that slot and `useSyncExternalStore` would loop — do not "optimise" this into a different key. A comment says so in the file.

**Why a wrapper rather than a `record.game === "nonogram"` branch inside `conclusion-view.tsx`:** ADR-0029 decision 2 puts JSX composition per game and keeps the shared conclusion game-blind. The record narrowing is per-game code and belongs in `src/nonogram/`. Cost is one small file and a second subscription that is free.

**Precedence `fromRecord ?? picture`** mirrors the stamp's `stored ?? result`. On the in-place first paint the stored record is still the last PLAYING one (`concluded: false`, `grid: undefined`) so the prop wins; one commit later the concluded record carries an identical bitmap, so there is no flicker.

- `app/nonogram/concluido/page.tsx` (server, `force-dynamic`) renders `<NonogramConclusion date={daily.date}/>` — **no `picture`, no `result`, and no `solveNonogram` call on the server**. It still calls `getTodayDaily(getDb(), "nonogram")` and falls back to `<DailyUnavailable/>` on a miss.
- `nonogram-screen.tsx` branch 3 renders it with `result={{elapsedMs, hintsUsed}}` and the picture **omitted, never emptied** (CLI-5/DES-9 — an earlier draft's `?? []` said one thing while the prose beside it said another):

```tsx
const cells = submittedCells(state.entries, state.size ** 2);
// Omission, never an empty bitmap: `?? []` would supply a labelled
// `<svg role="img">` with an empty `d` — a named graphic with no graphic in
// it, and worse than saying nothing (the `stored?.syncOutcome === undefined`
// precedent at conclusion-view.tsx:98-108). It would also make T-WEB-S50's
// "one subpath per filled cell" assertion vacuously true at zero cells.
picture={cells === null ? undefined : { size: state.size, cells: [...cells], label }}
```

  The `null` branch is **defined-unreachable, not assumed away** (landmine 8), and the argument is written down so nobody adds a test for a state the invariants forbid: `submittedCells` returns `null` only on `entries.length !== cells` (§10.2 — unlike Sudoku's `allDigits` there is no value-based null branch, since every `NonogramCellValue` maps); `initNonogramPlayState` allocates exactly `size²` entries and no reducer case resizes the array; `restore` rejects any record whose `size` or `entries.length` disagrees with today's board; and branch 3 is only reached after `isPictureComplete` iterated the full `size²` solution. The record-derived source is closed the same way — P15's `superRefine` pins `grid.length === size²`.

**`stored.size` is why D2 needed D3 = option A** (P15). The coupling is satisfied; if it ever were not, the line would become `Math.sqrt(stored.grid.length)` with an integer check — derivable, but a derivation where a stored field is honest.

### 13.4 The render and its CSS

One SVG node inside the result branch, immediately after `.stampRow` and before the `syncOutcome` lines:

```tsx
{picture !== undefined && (
  <div className={styles.pictureRow}>
    <svg className={styles.picture} role="img" aria-label={picture.label}
         viewBox={`0 0 ${String(picture.size)} ${String(picture.size)}`}
         shapeRendering="crispEdges">
      <path d={picturePath(picture)} />
    </svg>
  </div>
)}
```

with a module-scope pure helper `picturePath(picture)` emitting one `M{col} {row}h1v1h-1z` subpath per filled cell. **One `<path>` rather than one `<rect>` per cell:** a 15×15 daily carries **48–143 filled cells** (measured over `generateNonogram`, 60 seeds × 7 weekdays; sizes 5/8/10 run 9–21, 18–52 and 20–88), and one node keeps every DOM-walking impeccable rule at O(1) here. The measured range is used rather than ADR-0021's 30–65 % band, because that band is a **warning-level diagnostic with a 34-outlier ratchet, not a gate** (`0021-…:47-48`, `motifs.test.ts:63-81`) — and the earlier "68–146" derived from it excluded P13's own worked case, so the two sections contradicted each other (CLI-7). They now come from the same population, and P13's own figure has been corrected to that population's real floor of 48/225 (ADH-R3-2). SVG, not a CSS grid of divs: CLAUDE.md's "inside the app: SVG, Skia, or code"; and one text-free node makes `undersized-ui-text`, `tiny-text`, `repeated-container-text` and `text-overflow` structurally unable to fire, since all four require direct text.

CSS, in **`play/conclusion-view.module.css`** — the same module, because CSS Modules hash per file and a block elsewhere could not reach `.picture` (landmine 24):

```css
/* Additive to the stamp, never instead of it. The rule this answers is
   DESIGN.md:44 ("Celebration = the stamp settling; never confetti") and
   PRODUCT.md:33 ("Celebration is contained... Never confetti, never a modal
   takeover") — NOT DESIGN.md:39, which is the stamp's shape spec (3px
   circle, -6deg, typographic content only) and carries no exclusivity rule
   at all (ISS-2's surviving half; the -6deg is still cited below for the
   rotation, which is what :39 does govern). The positive sanction is
   docs/design/002-brief-design-direction.md:76, which names "o traco que se
   completa" alongside the stamp as a contained celebration.
   No background, no border, no radius, no box-shadow — impeccable's
   isCardLikeFromProps (checks.mjs:227-230 in 3.4.0; NOT :4155, which is
   inside isCardLike, a different function) returns false on its FIRST guard
   when an element has neither shadow nor border, so this cannot fire
   nested-cards, and "card dentro de card" is a DESIGN.md anti-reference
   verbatim. Line numbers belong to impeccable 3.4.0; a bump moves them. */
.pictureRow { display: flex; justify-content: center; margin-top: var(--space-6); }

.picture {
  width: 132px; height: 132px; fill: var(--accent);
  /* Exactly one mount keyframe, no repeat. The name deliberately avoids
     /bounce|elastic|wobble|jiggle|spring/i, which impeccable's bounce-easing
     rule matches on the animation NAME; --ease-settle's 1.05 y2 is inside the
     rule's allowed [-0.1, 1.1] band (checks.mjs:495-499). Transform and
     opacity only — never width/height/padding/margin, which fire
     layout-transition. The short delay lets the stamp land first: two settles
     at once read as a flourish, in sequence they read as ink drying. */
  animation: picture-settle var(--duration-slow) var(--ease-settle) both;
  animation-delay: var(--duration-fast);
}
@keyframes picture-settle {
  from { transform: scale(0.94) rotate(-3deg); opacity: 0; }
  to   { transform: scale(1) rotate(-2deg); opacity: 1; }
}

@media (max-width: 768px) {
  .pictureRow { margin-top: var(--space-4); }
  .picture { width: 104px; height: 104px; }
}
```

Reduced motion — **extend the existing block at `:441-451`, never add a new one**: `.picture { animation: none; transform: rotate(-2deg); opacity: 1; }`.

**Contrast, computed and pasted in the PR** (the impeccable gate gives no signal — `low-contrast` is wildcard-ignored on every scanned host): `--accent-nonogram #B5563C` on `--paper-card #FBF7EF` = **4.51:1**. WCAG 1.4.11 requires 3:1 for a meaningful non-text graphic; cleared with margin, and it also clears 4.5:1 for text on the same surface. **The `--accent-app` trap (N13):** nothing in the reveal may use `--accent-app #9E3B2F` — 1.40:1 against terracotta, invisible. **Rotation** `-2deg` is inside `--rotate-card-max 2.4deg` and deliberately unequal to the stamp's `-6deg`, so the two do not read as one sheet.

### 13.5 The celebration constraint checklist

| Constraint | How `.picture` satisfies it | Enforced by |
|---|---|---|
| Exactly one mount keyframe, no repeat | no `infinite`, no `alternate` | T-WEB-S52 |
| Forbidden keyframe-name regex | name is `picture-settle`, matching the shipped `stamp-settle` convention | T-WEB-S52 |
| Easing inside `[-0.1, 1.1]` | `--ease-settle` reused; no new bezier introduced | token reuse |
| `prefers-reduced-motion` in the **same** module | the existing block extended | T-WEB-S52 |
| Cannot fire `nested-cards` | no background/border/radius/shadow; and an `<svg>` has no `textContent`, so the `< 10` character skip also applies | T-WEB-S52 |
| Paint-only | `transform` + `opacity` only | file-mode detect + T-WEB-S52 |
| Contained, not a takeover — `PRODUCT.md:33` and `DESIGN.md:44` verbatim | additive to the stamp inside the existing result card; no modal, no full-screen, no confetti, no particles. `--duration-slow` (250 ms) sits at the top of `DESIGN.md:44`'s 150–250 ms band and reuses `--ease-settle` by name, which is the easing that line specifies | file-mode detect + review |
| No decorative emoji, mascot, glow or gradient | one `<path>`, `crispEdges`, blur always 0 | `DESIGN.md:54-58` |
| Rotations static, never animated per interaction | `-2deg` is the *end state* of a one-shot mount keyframe, not an interaction response | review |
| Accent is identity, never the only carrier | the picture's meaning is its **shape**; the accent is its ink | contrast figure in the PR |

### 13.6 The offline story, end to end

**Solving offline.** The player is on `/nonogram`, loaded while online — ADR-0004:27 scopes offline to *mid-puzzle*, and everything the reveal needs is already client-side. The grid closes, the next commit renders `<NonogramConclusion>`, and the picture arrives **on the prop**, computed from the play state: no network, no `localStorage`, no solver call. This is the same reason `ConclusionResult` exists at all — React runs a child's mount effect before its parent's, so the record has not been written yet, and where `localStorage` throws (Safari private mode) it never will be. The stamp shows. `syncOutcome` is `undefined` at that instant because the only stored record is the still-playing one, so **no "pending" line yet** — deliberately, per finding `pending-sync-line-on-the-happy-path`. Within one poll tick (≤1 s) effect G's concluded record lands, `syncOutcome === "pending"`, and the honest line appears. **The picture does not change**, because both sources are the same bitmap.

**A later reload, still offline.** `/nonogram` and `/nonogram/concluido` are `force-dynamic` with no service worker — **neither is reachable**, so nothing renders. This is ADR-0028's recorded, accepted cost (`:90-94`), unchanged by #25, and the plan states it rather than letting a reviewer discover it.

**A later reload, online.** `/nonogram`: `restore` reads the concluded record, branch 3 fires on the first paint, and the picture resolves from **both** sources identically. `/nonogram/concluido`: the server page passes only `date`; the wrapper derives from `record.grid` + `record.size`. **The reveal survives a reload with no name, no server round trip and no new read path.** If the day has rolled over, `prunePlayRecords` may have removed the record (only when `!pendingSync`) and the conclusion shows the "ainda não concluído" card — pre-existing behaviour.

---

## 14. Persistence and offline sync

### 14.1 The record (P15)

```ts
/**
 * The nonogram member (#25). Structurally binairo's — 0/1/null cells, one
 * optional solved `grid` — with one field neither shipped game needs: `size`.
 * A Nonogram board is 5, 8, 10 or 15 a side depending on the weekday
 * (difficulty.ts:31-41), so no fixed `.length()` is available and a stored
 * record would otherwise not say which board it belongs to.
 *
 * `size` is a DATUM, not `Math.sqrt(entries.length)`: `sync.ts` builds the
 * POST body from the record ALONE with no board in scope, and the
 * conclusion's picture wrapper lays the bitmap out from it (§13.3).
 *
 * The `superRefine` is what bounds the arrays. `writePlayRecord` does not
 * parse on write (:180-203), so the schema on READ is the only wall there is.
 * `.max(225)` is a plain length CEILING, and it is deliberately NOT sold as
 * an allocation bound: measured against the installed zod 4.4.3, array
 * element parsing runs BEFORE array-level checks, so
 * `z.array(union).max(225).safeParse(new Array(1_000_000).fill(0))` parses
 * all 1 000 000 elements first (`{success:false, ms:35, elementChecksRun:
 * 1000000}`) and then fails the length test. What `.max(225)` buys is a
 * schema-level statement of the record's maximum board area that holds
 * independently of `size`, so an absurd but internally size-consistent
 * record is refused by a bound and not only by the cross-refine. The two
 * shipped members have the identical property (`.length(64)`/`.length(81)`
 * also iterate first), so nothing regresses here.
 *
 * `nonogramSizeSchema` comes from @miolos/core and is never re-declared: one
 * definition, three consumers, exactly as `sudokuDigitSchema` is.
 *
 * A checked object is a legal `z.discriminatedUnion` option in Zod 4 and is
 * NOT one in Zod 3 (there it is a `ZodEffects`). Verified against the
 * installed zod 4.4.3; a downgrade breaks this file at CONSTRUCTION time,
 * not at parse time.
 */
export const nonogramPlayRecordSchema = z
  .strictObject({
    v: z.literal(1),
    game: z.literal("nonogram"),
    date: isoDateString,
    size: nonogramSizeSchema,
    /** 1 = preenchida, 0 = marcada, null = vazia. size² of them. */
    entries: z.array(z.union([z.literal(0), z.literal(1), z.null()])).max(225),
    /**
     * The SUBMITTED bitmap, written the moment `status` flips to `solved`.
     * NOT "the player's board": crossed and undecided cells are both `0`
     * here, because the completion predicate is "the picture is painted"
     * (ADR-0032), so on a closed board this array IS the solution.
     */
    grid: z.array(z.union([z.literal(0), z.literal(1)])).max(225).optional(),
    elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
    hintsUsed: z.number().int().min(0).max(1),
    concluded: z.boolean(),
    pendingSync: z.boolean(),
    syncOutcome: z.enum(["pending", "recorded", "rejected"]),
  })
  .superRefine((record, ctx) => { /* entries.length === size²; grid.length === size² */ });
```

`playRecordSchema` gains it as a third member. **`v` STAYS `1`** — ADR-0029 consequence (d): a bump discards every stored record on deploy, and a discarded record with `pendingSync: true` is the only copy of a completion the server has not acknowledged, i.e. a lost streak day.

**Rejected, recorded so it is not re-proposed.** *Option B, four fixed-size shapes discriminated on `size`:* `playRecordSchema` discriminates on `game`, so this nests a second discriminated union inside one member; it works in zod 4 but makes `NonogramPlayRecord` a four-member union every consumer must narrow — `buildRecord` picks a member, `gridBody` accepts four, `restore`'s guard becomes a four-way test. A 4× type surface to make one length a literal. *Option C, no `size` field:* `writePlayRecord` does not parse, so a garbage-length record would be written, read back clean, carried by `listPendingRecords` and handed to `buildBody`, which would POST it — and the record would no longer say what board it is for, which `sync.ts` needs and cannot derive.

### 14.2 Sync — one `case` label and one widened type

Because the nonogram record's `grid` is `(0|1)[]` exactly like binairo's, `gridBody` (`sync.ts:251-273`) **already builds the correct body**:

```ts
    case "binairo":
    case "sudoku":
    case "nonogram":
      return gridBody(record);
```

with `gridBody(record: BinairoPlayRecord | SudokuPlayRecord | NonogramPlayRecord)`. No new module, no new branch inside `gridBody`. That is ADR-0029 consequence (f) satisfied literally, and the `const unhandled: never` tripwire at `:243` is what fails if the label is forgotten — a **red typecheck**, and at runtime a throw that keeps the record queued rather than losing the day. The source-text tripwire at `play-sync.test.ts:643-661` **stays untouched**; the compile error is what fires.

Everything else in `sync.ts` and `play-record.ts` is unchanged: the `miolos:play:` prefix scan, the Safari-private-mode guard, `parseAt`, the two-sided `elapsedMs` clamp, `listPendingRecords()` (game-blind by design), `prunePlayRecords`, the module-level singletons, `TERMINAL_STATUSES`, the retry ladder, the single 401 re-mint and `settle`.

---

## 15. The one free hint

### 15.1 Where it is computed — ADR-0027's argument transfers, with numbers

Client-side, `solveNonogram(daily.clues)` from `@miolos/games/nonogram`, run once in the `useReducer` initializer. **No new ADR** — plan 018 S9 is the precedent for recording a transfer: quote the condition, paste measured numbers.

ADR-0027's two-part condition, both halves proved for Nonogram **more strongly** than for Sudoku:
- **(a) the published projection uniquely determines the solution by construction.** ADR-0021 decision 3 makes "line-solvable to the exact bitmap, for the motif **and** its mirrored variant" a **binary mechanical gate**, enforced over all 184 motifs + 81 mirrors at `packages/games/test/nonogram/motifs.test.ts:85-105`. Line-solvable-to-the-exact-bitmap is strictly stronger than uniquely-solvable — it means per-line forced deduction alone recovers the bitmap with no search. Re-proved end to end against the **wire projection only** (`{game, date, size, clues}`, no `reveal`): **280 dailies (40 seeds × 7 weekdays), 0 mismatches, worst 0.338 ms.**
- **(b) the client can recover it cheaply enough that a round trip buys nothing.** `solveNonogram` 15×15: n=840, mean **0.084 ms**, p50 0.076, max 0.301. 5×5: n=1850, mean 0.0099.

A server round-trip would buy **zero** confidentiality on a published board and would break the hint offline, which AC 3's "offline sync at parity" requires. Fresh numbers are re-measured and pasted in the PR (landmine 6).

### 15.2 The composition (P17)

```ts
export function nextNonogramHint(
  solution: readonly NonogramMark[],
  entries: readonly NonogramCellValue[],
): Hint<NonogramMark> | null {
  const noGivens = solution.map(() => null);
  const first = nextHint<NonogramMark>(solution, noGivens, entries);
  if (first === null || first.kind === "correction" || first.value === 1) {
    return first;
  }
  const pictureOnly = solution.map((v) => (v === 1 ? null : 0));
  return nextHint<NonogramMark>(solution, pictureOnly, entries) ?? first;
}
```

The TSDoc carries the whole argument: pass 1 is `nextHint` verbatim over a board with no givens, so its contradiction-first policy transfers unchanged — and it is the half that matters most, because a wrongly **filled** cell is what blocks completion and a wrongly **crossed** cell is what blocks the player. Pass 2 exists because `nextHint`'s fill branch assumes `entries` records what the player *knows* (`:69-71`), which holds for Sudoku and Binairo where every cell must be written to finish and **does not hold here**, where crossing is optional. **Measured: the unmodified fill branch returns a cross 239 times out of 280 on a fresh board.** Pass 2 re-runs the SAME function with the empty-picture cells masked through the `givens` argument, which is exactly what that argument means ("never a candidate", `:38-40`). It can only ever return a fill on a picture cell, because pass 1 returned a fill, so no contradiction exists anywhere, so pass 2 cannot find one either. Measured: it lands on a picture cell **280/280 fresh and 280/280 mid-game**.

**The harness, named so the numbers are reproducible rather than asserted** (CLI-9 — a re-derivation over a *different* seed set returned 237, which is what a number with no stated population invites). Seeds are `(s * 2654435761) >>> 0` for `s ∈ 1..40`, crossed with weekdays 1..7 = **280 dailies**; the fixture is a verbatim copy of `grid-hint.ts:48-75`'s `nextHint` plus `nextNonogramHint` exactly as written above, over `generateNonogram(seed, weekday)`; mid-game boards are built by a fill-only player having painted the first half of the picture's cells in row-major order. Re-run on this machine:

```
{"total":280,"plainFreshCross":239,"plainFreshFill":41,
 "composedFresh":280,"midLands":280,"midDecided":0,"midCorrection":0}
```

That seed set is the one T-WEB-S38's table-driven fixture pins, and **ADR-0032's sentence carries the same qualification** ("239 of 280, over 40 seeds × 7 weekdays"), so the figure in a permanent document is checkable rather than folkloric.

The `?? first` fallback is **defined, not assumed away** (landmine 8): it fires only when no undecided picture cell is left, which — with no contradiction present — is a board that is already solved, where `use-hint` has already refused. Verified unreachable on 280/280 boards; kept because "unreachable" is an argument, not a type.

`nextHint`'s `givens` argument gets a synthetic array in both passes: a nonogram has no givens, and `grid-hint.ts`'s `T` is unconstrained precisely so this works. **`grid-hint.ts` is not modified.**

`hintKindOf(hint)` returns `"correction"` when `hint.kind === "correction"`, else `"fill"` when `hint.value === 1`, else `"cross"` — pure, so it is unit-testable without React and both the hook and the reducer agree without sharing a closure.

### 15.3 Accounting

`hint.used` goes 0 → 1, persisted in the record, reported as `hintsUsed` on the POST, bounded `.max(1)` on the wire. **Not** a grant row; `hint_grants` stays dormant. `hints_used` remains self-reported and can never back a "sem dicas" medal (ADR-0027) — no comment in this ticket may claim otherwise.

---

## 16. i18n — the complete pt-BR bundle

### 16.1 The vocabulary ruling (fills `CONTEXT.md`'s gap)

`CONTEXT.md` has no entry for "picture", "motif" or any cell state (the brief's ⚠️). One spelling per concept, used everywhere — issue titles, test names, TSDoc and copy. **These seven rows LAND IN `CONTEXT.md` in commit 1; the argument stays here, the source of truth is there** (ADH-6). An earlier draft only "flagged them for the `CONTEXT.md` owner at step 8", and step 8 scheduled nothing for it — which would leave the canonical vocabulary of the third game living only inside a document `docs/README.md:20` defines as a snapshot whose body is "never rewritten to stay current", while `docs/agents/domain.md:9,:29,:31` makes `CONTEXT.md` the mandatory pre-work read and the place a missing term must land. #28 inherits every one of these terms, and CLAUDE.md's "don't drift to synonyms" rule has nothing to bind if the glossary is silent. The rows go in `CONTEXT.md`'s existing register, and the **"Terms to avoid"** block gains Picross, Griddler, Hanjie, paint-by-numbers, and `dica`/`pista` for the clue rails.

| Concept | Code (English) | User-facing (pt-BR) |
|---|---|---|
| a library entry in `packages/games` | **motif** | never user-facing |
| the withheld server-side object | **reveal** | never user-facing |
| the client-rendered payoff | **picture** | **figura** |
| a filled cell | `filled` / value `1` | **preenchida** |
| a crossed-out cell | `crossed` / value `0` | **marcada** |
| an undecided cell | `empty` / `null` | **vazia** |
| the clue rails' numbers | `clues` / `runs` | **números** |

**Why `preencher`, not `pintar`:** "Preenchemos uma célula para você." is already the shipped hint copy in **both** Binairo and Sudoku (`messages.ts:184`, `:244`), so a player meets one verb across three games. **Why `vazia` for undecided:** `cellAria` at `messages.ts:28-29` already renders a null Binairo cell as `vazia`. **Never `dicas` or `pistas` for the clue rails** — `dica` is the reserved term for the one free hint (`CONTEXT.md:19`) and reusing it would collide with the hint button in the same screen-reader pass. Forbidden per `CONTEXT.md:25-27`: Picross, Griddler, Hanjie, paint-by-numbers, "win".

### 16.2 Two module-scope hoists

Beside the existing ones, because ADR-0018 makes `Messages` the migration contract and every separator and composed name must be expressible from it:

```ts
// The board's dimensions in one place: the mobile progress bar and the stats
// card render the same string, and two copies are how they drift.
const boardSize = (size: number) => `${size} × ${size}`;

const cellAriaNonogram = (row: number, column: number, value: 0 | 1 | null) =>
  `linha ${row}, coluna ${column}: ${
    value === null ? "vazia" : value === 1 ? "preenchida" : "marcada"
  }`;

// An all-empty line's clue is `[]` and the UI renders "0" — the engine's own
// contract (nonogram/types.ts:10). The rail and its label must agree, so both
// go through here.
const runsText = (runs: readonly number[]) =>
  runs.length === 0 ? "0" : runs.join(", ");
```

### 16.3 The bundle, replacing `messages.ts:202-206`

```ts
    nonogram: {
      kicker: "Imagem",
      name: "Nonogram",
      description: "Revele a figura escondida pelos números.",
      play: {
        title: "Nonogram",
        // Every clause is a rule the engine actually enforces (the binairo
        // deviation-1 precedent): `deriveClues` is a run-length encoding in
        // order, with at least one empty cell between runs (clues.ts:24-36),
        // and the completion predicate is "the picture is painted" — crossing
        // is never required, so the blurb never asks for it.
        rules:
          "Os números de cada linha e de cada coluna são os blocos de células preenchidas, na ordem, com pelo menos um espaço entre eles. Preencha todos os blocos para revelar a figura.",
        // The denominator is the PICTURE's cell count, summed from the clues
        // — not the board's. A player finishes without crossing a single
        // cell, so a `de size²` readout would stand at 21% at the moment
        // they win (P13).
        progressLong: (filled: number, total: number) =>
          `${filled} de ${total} preenchidas`,
        // The mobile `.progressBar` slot carries the board's size too, the
        // way Sudoku's carries the level.
        progressShort: (size: number, filled: number, total: number) =>
          `${boardSize(size)} · ${filled} de ${total}`,
        // The stats card's third row, Sudoku's `levelLabel`/`level` pair
        // exactly (messages.ts:160-164 → sudoku/play-view.tsx:110-113 through
        // `styles.levelCard`). §12.4's `.sizeCard` declares its box; without
        // that row these two keys are dead copy and would red the "components
        // never carry string literals" review from the opposite direction
        // (ADH-12).
        sizeLabel: "Tamanho",
        size: boardSize,
        boardAria: (size: number) => `grade do Nonogram, ${size} por ${size}`,
        cellAria: cellAriaNonogram,
        // "números", never "pistas" and never "dicas" (§16.1).
        rowCluesAria: (row: number, runs: readonly number[]) =>
          `números da linha ${row}: ${runsText(runs)}`,
        columnCluesAria: (column: number, runs: readonly number[]) =>
          `números da coluna ${column}: ${runsText(runs)}`,
        controls: {
          fill: "preencher",
          cross: "marcar",
          erase: "apagar",
          fillAria: "preencher células",
          crossAria: "marcar células vazias",
          eraseAria: "apagar células",
          affordance: "ou use o teclado: 1 preenche, 2 marca, 0 apaga",
        },
        hint: {
          available: "Usar dica — 1 disponível",
          used: "Dica usada",
          explain: {
            // One truthful sentence for both directions: a correction may
            // fill OR cross.
            correction: "Corrigimos uma célula que não fecha com os números.",
            fill: "Preenchemos uma célula da figura para você.",
            // The defined-unreachable branch (§15.2, §26): the selector only
            // falls back to a cross when no undecided picture cell is left,
            // which is a board that is already solved. It ships rather than
            // rendering `undefined`.
            cross: "Marcamos uma célula que fica fora da figura.",
          },
        },
        unavailable: {
          title: "O Nonogram de hoje ainda não chegou.",
          body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
          cta: "Voltar para Hoje",
        },
      },
      conclusion: {
        title: "Nonogram",
        kicker: "Imagem",
        notYet: {
          title: "Você ainda não concluiu o Nonogram de hoje.",
          cta: "Jogar o Nonogram de hoje",
        },
      },
      // ADR-0033: the reveal has no curated name on the client, so the
      // accessible name DESCRIBES the figure rather than naming it. A sibling
      // of `.conclusion`, read only by `nonogram-conclusion.tsx` — it may not
      // go inside `conclusion`, which is ConclusionCopy's exact shape and is
      // rendered by two other games.
      reveal: {
        aria: "A figura do Nonogram de hoje, formada pelas células preenchidas da sua grade.",
      },
    },
```

`conclusion` stays **plain data only** — a function member there is an SSR 500 that only `route-ssr.test.tsx` can see (`play/types.ts:74-83`). **No name key exists anywhere in this bundle**, which is ADR-0033 made structural.

### 16.4 `routes.ts`

`routeSlugs.nonogram: "nonogram"` (an untranslated proper noun, which is what makes `/nonogram` a legal pt-BR route under ADR-0028:37), `routes.nonogram`, `routes.nonogramConclusion`, and — in a **separate commit** (§21) — `playRoutes.nonogram`. Never a literal at a call site.

---

## 17. Hub tile and conclusion chaining

Adding `playRoutes.nonogram` is a **four-line diff with a visible behavioural change to two already-shipped screens** (N21), which is why it lands alone in commit 10.

- The hub card at `app/hub-day-state.tsx:56-116` turns from an href-less `<a className={styles.cta}>` into a `<Link>` with `cursor: pointer`. `apps/web/app/page.tsx` renders every tile through one uniform `map` with **no per-game branch anywhere**, so nothing else changes; nonogram is `gameOrder` index 2 = `:nth-child(3)` and already receives its positional rotation and tape. **`HubProgress`'s "X de 4 concluídos" does NOT change** (TR-14): it is `doneCount(useDayState(date))` (`app/hub-day-state.tsx:29-42` → `play/day-state.ts:74`), which is route-blind, so a concluded nonogram record already counts today. The only hub change is the card's `<a>` → `<Link>`.
- `nextPendingDaily` (`conclusion-view.tsx:281-291`) starts offering Nonogram as the chaining CTA from **every** conclusion, because `DAY_GAMES = ["termo","sudoku","nonogram","binairo"]` (`:24`) puts it immediately after sudoku and termo has no route.

**THREE shipped tests break, not two — measured, not inferred** (CLI-2/TR-2). Two independent refuters applied the exact four-line `routes.ts` diff and ran the suite: `Tests 3 failed | 316 passed (319)`, all three in `conclusion-view.test.tsx`. The brief's claim that T-WEB-S19's first case (`:236-255`) changes target stays **false** — `nextPendingDaily` is a forward scan and with only a binairo record concluded, sudoku is still first, so `:236-255` and `:257-277` both stay green. The three that break, with the edit each takes:

| Test | Why it breaks | Edit |
|---|---|---|
| `:203-226` "points the CTA at Hoje and leaves the statistics link dead" | seeds binairo **and** sudoku concluded, asserts `ctaHome`; nonogram is now pending and playable | gains a `concludedNonogram()` record (a helper mirroring `concludedSudoku()` at `:208`) |
| `:279-299` "never chains back to the game whose stamp is on screen" | seeds only a **not**-concluded sudoku record and renders `game="sudoku"`; the celebrated-game override (`conclusion-view.tsx:169-173`) forces sudoku concluded, so the scan runs termo (no route) → sudoku (overridden) → **nonogram** → binairo. Today nonogram has no route so binairo wins; with `playRoutes.nonogram` the scan stops one game earlier. Rendered DOM in the failure: `href="/nonogram"`, `Fechar o dia — jogar Nonogram` | **retargeted**, not re-fixtured: the assertion becomes `ctaNext(messages.games.nonogram.name) → routes.nonogram`. The test's own name and comment make its subject the **exclusion of sudoku**, not the selection of binairo, so the retarget preserves its point exactly and needs no new fixture. Seeding a `concludedNonogram()` record here would keep the literal binairo assertion but test a proposition the test was never about |
| `:301-318` "falls back to Hoje when every playable daily is done" | same shape as `:203-226` | gains a `concludedNonogram()` record |

**Self-updating, needing no edit — re-audited, not assumed:** the refuter drove every `writePlayRecord` site in the file (`:97,123,140,159,175,237,261,283,302,323,341,370,392,435,479,494,513,541,571,614`) and the whole 21-file / 319-test `apps/web` suite; **only those three fail.** `hoje.smoke.test.tsx:136-146` (its own comment at `:134-135` says so) and `day-state.test.ts` (`:74-84`, already asserts all four keys) need no edit, and the plan's claim there is correct.

**No `getAllByText(dayCard.missing)` count shifts anywhere** — the plan's earlier "Counts shift at `:191, 337, 359, 384, 407`" was written from inference and is **wrong in both directions**, so it is deleted rather than corrected. Structurally: the chips come from `DayChip` (`conclusion-view.tsx:326-362`), which reads `DayEntry.concluded`/`elapsedMs` only, and `dayState` comes from `readDayState` (`play/day-state.ts:65-72` → `entryFor` at `:101-107`), which reads `readPlayRecord` alone — `playRoutes` appears nowhere in that path (it is read only at `conclusion-view.tsx:150`, `:285` and `hub-day-state.tsx:64`). All five stayed green in the measured run. Empirically: each of the five sits in a test seeding only binairo/sudoku records (`:174, :322, :340, :363, :388`), and neither test the plan edits contains a `missing`-count assertion at all. (The cited line numbers were also off by one — the `getAllByText` calls are at `:191, :336, :359, :384, :406`; `337/385/407` are the `toHaveLength` lines. A second symptom of a sentence written from inference.)

`streakCount` stays hardcoded `0` (ADR-0031). The positive half is stated in the PR: the nonogram completion row is written **game-generically** with `on_time` derived in SQL, so #19's streak derivation counts the day with **zero** additional work — what is deferred is the streak's *display*, not its arithmetic.

---

## 18. The ESLint duty — unchanged, and that is the point

No new config object. The existing two (`apps/web/**` import bans; `apps/web/{app,src}/**` table-name literals) already cover every new file by glob.

**The landmine, restated because it is one edit away:** ESLint flat config **replaces** a rule's whole configuration when a later object sets the same rule id — it does not merge. If anything here adds a third `apps/web`-scoped object setting `no-restricted-syntax`, it **must repeat all five selectors** or it silently reopens the doors for the files holding the credential.

Two live constraints on this ticket's code: any lazy-load of the Nonogram board uses a **plain string-literal specifier**; and `apps/web/src/db.ts` keeps `import "server-only";` as its **first** line. T-LINT-S3 asserts the wall still fires from an `apps/web/src/nonogram/**` path, and that a clean nonogram file (importing `getTodayDaily` from `@miolos/db` and `solveNonogram` from `@miolos/games/nonogram`) reports **zero** — the rules are not blanket bans.

---

## 19. Test plan (named)

House patterns honoured: one PGlite per **file** via `createTestDb()`, in `packages/db` and `apps/api` only (**no PGlite in `apps/web`**); route handlers invoked as plain functions; every web assertion goes through `messages.*`, never a literal; **no `as` in tests** — fixtures are parsed or narrowed by a `throw`; no vitest globals.

**Id allocation (P30).** Continue the `S` series. This ticket reserves `T-WEB-S35…S60`, `T-API-S17…S26`, `T-DB-S6…S9`, `T-CORE-S8…S14`, `T-LINT-S3`. Unused tail numbers are **burned**, never reused. `packages/games` tests carry no `T-` ids (verified by grep) and B1 below follows that.

**Timeouts.** Nonogram's worst weekday is **0.1902 ms mean** for generate+validate (n=200, warm pools) — the figure §9.1/P5 uses, and the two sections now agree, because an earlier draft carried an unreproducible "0.152 ms mean / 0.421 ms max" here while §9.1 said 0.19 and the whole timeout decision rests on this number (TR-10). A full cold seven-day week is ~34 ms of pool build plus well under 1 ms of generation, three orders of magnitude cheaper than `topUpSudokuBuffer`'s ~834 ms week — so vitest's 5 000 ms default is ample and **no timeout constant is copied into the new nonogram suites**. State the figure; do not raise a number reflexively (commit `271a935` is the paid lesson in the other direction). PGlite-backed files keep `beforeAll(…, 30_000)` for boot, unchanged. **Scope, so the rule is not misread:** this governs the files this ticket *creates*. New `it`s added to `cron-publish.test.ts` — T-API-S21's fault-isolation case among them — **keep that file's per-`it` `30_000`**, because they drive a full sudoku week; §7.8 refreshes that file's arithmetic comment for three games rather than deleting its timeouts.

**The jsdom scaffolding the stroke tests need is named, and it moves with the machinery it serves** (TR-8). jsdom implements no `document.elementFromPoint` at all — `vi.spyOn` has nothing to replace — and no `setPointerCapture`/`releasePointerCapture`; `apps/web/test/setup.ts` is ten lines and defines only jest-dom plus `cleanup`. All three stubs plus the `stubElementFromPoint(container)` helper are hand-built at module scope in `binairo-screen.test.tsx:59-65, :74-81, :102-110`. **Commit 5 hoists them into `apps/web/test/pointer.ts`, imported by both suites, in the same behaviour-free commit as the hook** — with the Binairo suite as the oracle, exactly as for the hook itself. Leaving them where they are asks the implementer to paste a third verbatim copy of the environment setup for a hook that from commit 5 onward is deliberately shared. This is the one named exception to T-WEB-S46's byte-identity gate below, and its own diff is pasted.

**Fixtures.** Every suite builds `DAILY` at module scope from the real generator and **parses, never casts**: `dailyNonogramResponseSchema.parse({game:"nonogram", date: DATE, size: PUZZLE.size, clues: PUZZLE.clues})` with `PUZZLE = generateNonogram(seed, weekday)`. Two weekdays at module scope: **weekday 1** (5×5, **0.0354 ms** generate+validate) for the cheap cases and **weekday 7** (15×15, **0.1902 ms**) for every size-dependent one — the same two figures §9.1/P5 carries, since the "0.021 / 0.152" pair an earlier draft printed here is part of the unreproducible set the Timeouts paragraph above retires (TR-10). Companion derivations (`FIRST_PICTURE_CELL`, `SOLUTION`) are narrowed by a **throw, never a cast**.

### `packages/core`

| ID | File | Proves |
|---|---|---|
| T-CORE-S8 | `daily-contract.test.ts` | `stripDailyContent("nonogram", …)` over real `generateNonogram` output for **all 7 weekdays** projects exactly `{game,date,size,clues}`, the **key set** is asserted (`["clues","date","game","size"]`), and `dailyPuzzleResponseSchema.parse` round-trips. **The `throws DailyProjectionUnsupportedError for nonogram` case at `:76-80` is deleted and replaced, not silently dropped**; the termo case at `:82-86` stays |
| T-CORE-S9 | `…` | the ADR-0004 leak scan: no `FORBIDDEN_DAILY_KEYS` member at any depth, all 7 weekdays. **D1's mechanical proof** |
| T-CORE-S10 | `…` | `nonogramDailyContentSchema` mirrors `NonogramPuzzle`: parses all 7 weekdays; **rejects a body with `game` removed** (the N2 pin — the one that drains the buffer if forgotten); rejects an extra key; rejects `size ≠ clues.size`; rejects `size: 20`; rejects truncated `rows`/`cols`; rejects a non-square `reveal.solution`; rejects a `[0]` run |
| T-CORE-S11 | `…` | `dailyNonogramResponseSchema` rejects a payload smuggling `reveal`, `seed` or `weekday` — on the member **and** on the union |
| T-CORE-S12 | `…` | `FORBIDDEN_DAILY_KEYS` contains `motifId`, `name`, `mirrored`, mirroring the `clueCount` meaningfulness test at `:138-142` |
| T-CORE-S13 | `completion-contract.test.ts` | `nonogramCompletionRequestSchema` round-trips at **all four lengths**; rejects an extra key, `hintsUsed: 2`, a non-0/1 cell, **length 63 and length 81** (81 is sudoku's and is the sharpest case). Plus the nonogram key set beside `:285-303`. **`:118-123` is retargeted at `termo` with its rationale rewritten** — with nonogram in the union that assertion is *actively false*, not merely stale (N31) |
| T-CORE-S14 | `cron-contract.test.ts` | both contracts accept three games; the two `rejects a third game key` tests are **retargeted at `termo` and renamed "a fourth"**; `rejects a body missing a wired game` gains the nonogram case. Rewritten, never deleted — the file's whole purpose is that a new game must widen the schema in the same PR |

### `packages/db`

| ID | File | Proves |
|---|---|---|
| T-DB-S6 | `published.test.ts` | a **future-dated** nonogram row is invisible to both readers; a **killed** one likewise (mirrors T-DB-S1) |
| T-DB-S7 | `…` | a published nonogram row projects to exactly `{game,date,size,clues}`, `size === 5`, `clues.rows.length === 5`, plus the leak scan |
| T-DB-S8 | `…` | a game-scoped read never returns another game's row for the same date, with **all three** games seeded on that date |
| T-DB-S9 | `…` | the generic narrowing is real at runtime for nonogram across the four companion shapes, keeping the "companion goes in FIRST" trick at `:319-326` |
| — | `…:342-436` | **T-DB-9a…9e and T-DB-S5 come out byte-identical.** The gate is §8's two `sha256sum` invocations over the `describe("surface tripwires` block, anchored on its opening line so the insertion of T-DB-S6…S9 above it does not move the anchor — `git diff` takes no line range and would be unrunnable as an exit criterion (TR-12). Verified to produce matching digests on the current tree |

### `apps/api`

| ID | File | Proves |
|---|---|---|
| T-API-S17 | `publishing-service.test.ts` | `topUpNonogramBuffer` tops an empty database to depth 7; every stored row re-passes `nonogramDailyContentSchema` **and** `validateNonogram(content).ok`, with `row.seed === content.seed`, `content.weekday === isoWeekdayOf(row.date)` and `content.size === NONOGRAM_WEEKDAY_CRITERIA[weekday].size` |
| T-API-S18 | `…` | a forced `NonogramGenerationError` puts the date in `failures` and the run continues; remaining dates are still covered. Mechanism: `vi.mock("@miolos/games/nonogram", async (importOriginal) => ({...await importOriginal(), generateNonogram: …}))` so the error class stays **real** for `instanceof` |
| T-API-S19 | `…` | **the weekday/size TRIPWIRE (P6)** — named for what it proves, not for a property the shipped path can exhibit (TR-11). Mock `generateNonogram` to return a weekday-1 puzzle regardless of target; assert the date lands in `failures` with the cross-check reason, **no row is inserted**, and — the anti-vacuity half — `validateNonogram(thatPuzzle).ok === true`, so the test proves the *assertion* rejected it and not the validator. Its comment states plainly that the branch is unreachable for real generator output and that the mock is the only way to reach it, so a later reader does not mistake it for coverage of a production path |
| T-API-S20 | `…` | a second run generates nothing; existing rows untouched |
| T-API-S21 | `cron-publish.test.ts` | three games: T-API-S1/S2/S3 widen (row counts 14 → 21); **T-API-S8 gains a third log line and asserts the fixed order binairo → nonogram → sudoku**; fault isolation for the third game — nonogram's inserts sabotaged, the other two still reach depth 7, the body still strict-parses, and `games.nonogram.error` is the **original** failure, not the wrapper's message |
| T-API-S22 | `buffer-depth.test.ts` | every expected `depths` object gains a key; and **a drained nonogram buffer alone flips `shallow: true`** — S16's failure mode instantiated for the key that was just added |
| T-API-S23 | `completions.test.ts` | a nonogram completion is recorded once, `outcome: "won"`, `onTime: true`; the replay returns 200 `recorded: false` with the stored values. `type SubmittableGame`, `seedDaily`, `completionBody` and `wrongGrid` widen rather than fork; the seeded solution is flattened **independently in the test file**, never imported from the route |
| T-API-S24 | `…` | **the encoding pin.** Row-major flattened → 200; one extra filled cell → 422; one missing → 422; **a column-major flattening of the same solution → 422**, guarded by a `throw` if the chosen picture happens to be transpose-symmetric so the case can never go vacuous |
| T-API-S25 | `…` | **the length hole (N7).** A 100-cell grid whose first 25 cells match a stored 5×5 solution → 422 `grid-mismatch`, **no row written**; and a 25-cell grid against a stored 10×10 → 422. The only test that proves §9.3's check |
| — | `…:940-979` | **T-API-S14 is extended, not replaced:** a nonogram body against a stored **binairo** row and a binairo body against a stored **8×8 nonogram** row are both 404, never 500, and no row is written. Both bodies are wire-valid 64-cell 0/1 arrays — that is what makes the pair non-vacuous, and it is the 64-cell collision made mechanical |
| T-API-S26 | `daily-nonogram.test.ts` (new) | 200 with today's puzzle strict-parsing the **member** schema and a key set of exactly `["clues","date","game","size"]`; the leak scan; 404 on future-only, killed, and offsets +1/+2/+30; 404 when a **binairo** row is published for today; `route.dynamic === "force-dynamic"`. **One id, not two** — `daily-sudoku.test.ts` uses `T-API-S6` twice (N30); do not copy that |

### `apps/web`

| ID | File | Proves |
|---|---|---|
| T-WEB-S35 | `nonogram-engine.test.ts` | `solutionMarks` returns `size²` marks for a real daily over all 7 weekdays and **`null`** for malformed clues (the defined branch); `filledTarget` equals the picture's filled count for all 7; `countFilledCells` counts only `1`; `isPictureComplete` is true for a fill-only board and false when one picture cell is unfilled; `submittedCells` maps `null → 0` and `0 → 0` and returns `null` on a length mismatch |
| T-WEB-S36 | `nonogram-state.test.ts` | the reducer: `mark-cell` applies the brush and re-applying clears; `enter-value` writes and re-entering clears; `clear-cell` is a same-state no-op on an empty cell; `paint-over` is a **SET** (crossing twice leaves it painted); `set-brush` on the active brush returns the **same object**; `select` on the current index returns the **same object**; `move-selection` clamps at all four edges on the **15×15** fixture and never wraps; `status` flips only on a complete picture and latches `pendingSync` once |
| T-WEB-S37 | `…` | `restore` against a wrong-`size` record, a wrong-`entries.length` record and a foreign-game record each leaves the board untouched with `hydrated: true` (P16/N11) |
| T-WEB-S38 | `nonogram-hint.test.ts` | over pinned seeds: a correctly **crossed** cell is never a contradiction (**the N9 encoding tripwire**); a wrongly filled cell is corrected to 0 and a wrongly crossed one to 1; **pass 2 lands on a picture cell on a fresh board and on a 50 %-filled fill-only board**; `hintKindOf` returns `fill`/`cross`/`correction` correctly; the hint is capped at one and is a no-op once solved. Table-driven over in-file pinned seeds, **no `fc.assert`** |
| T-WEB-S39 | `nonogram-play.test.ts` | **the `persistDeps` property, on the real hook** (Sudoku has no such test — a real gap the third game closes): ten real turns of the 1 s interval produce **zero** `setItem` calls, with the anti-vacuity assertion that `state.now` advanced and `elapsed >= 10_000`, and one `markCell` produces exactly one. Plus: **a drag re-painting a cell it already painted writes nothing** (`withEntry`'s identity guard, the one Binairo lacks); the record round-trip (`grid` undefined in progress, equal to the flattened solution on close, handed to `flushPendingCompletions`); `filled` is 0 fresh and `target` on a solved board; **a fill-only completion** — paint every picture cell, cross nothing, assert `status === "solved"` |
| T-WEB-S40 | `play-record.test.ts` | a nonogram record round-trips including `size` and `grid`; the union rejects `size: 7`, an `entries.length` that disagrees with `size`, and a 10⁶-element array; `listPendingRecords().map(game).toSorted()` becomes three; binairo's and sudoku's members still parse **byte-identically at `v: 1`** |
| T-WEB-S41 | `play-sync.test.ts` | T-WEB-S12 gains the third record: a queue holding one record of **each** game posts all three, once each (the one-module property). The `buildBody` source-text tripwire at `:643-661` is **untouched** |
| T-WEB-S42 | `nonogram-screen.test.tsx` | **the composite widget:** `role="group"` + `aria-label` on the board; `[role="grid"]` and `[role="row"]` both null; exactly one `[data-cell-index][tabindex="0"]`, at index 0; a Tab into the board selects and a subsequent `1` writes; `fireEvent.click(cell)` focuses it and moves the caret; arrows clamp at all four edges from `selected === null` too; `Home`/`End` reach column 0 / `size−1` and `PageUp`/`PageDown` reach row 0 / `size−1` **on the 15×15 fixture**; `1`/`2`/`0`/`Backspace`/`Delete` all behave; all eight navigation keys report `defaultPrevented === true` and `Tab` reports `false` |
| T-WEB-S43 | `…` | **the clue rails:** one labelled rail per row and per column; an empty run list renders `"0"` in both the rail text and its label; every cell's `aria-describedby` is exactly `${rowId} ${colId}` and both ids resolve via `getElementById`; cell names equal `messages.…cellAria(...)` for all three states; and **no rail is a role-less div** — every `[id^="nonogram-clue-"]` has `role="group"` and a non-empty `aria-label` (closes N16's defect class for the new board) |
| T-WEB-S44 | `…` | **the brush:** three `aria-pressed` buttons, exactly one `true`, `preencher` at first paint; switching changes what a tap writes; pressing the active brush is a no-op; the erase brush clears a filled cell in one tap; **and the pressed button carries `styles.controlActive` while the other two do not** — the sighted half of P21, whose visual is A13's job and whose wiring is this one (DES-6) |
| T-WEB-S45 | `…` | **the stroke:** a stroke paints every crossed cell with the brush's value; it is a **SET**, so crossing a cell twice leaves it painted; a stationary tap writes from `pointerup` and a trailing `click` with `detail: 1` does not double-apply; a non-primary button (`button: 2`) writes nothing; a second finger touching and lifting mid-stroke does not end the first; `lostpointercapture` reopens a stroke whose `pointerup` never arrived; **(g) `onStrokeEnd` moves the caret** — after `pointerup` at index *k*, `document.activeElement` is cell *k* and the caret index is *k* |
| T-WEB-S46 | `binairo-*.test.*` (all) | **the extraction changed no Binairo behaviour, and it is a COMMAND, not a judgement** (TR-9). `git diff --exit-code <sha-of-commit-4> <sha-of-commit-5> -- apps/web/test/binairo-state.test.ts` must exit **0**; `binairo-screen.test.tsx` may differ **only** by the TR-8 stub hoist, whose diff is pasted in full beside the exit code and must contain no line inside `:422-645` (the eight drag tests, T-WEB-8b/8c). Then the whole #18 suite passes. §25 carries the same command: "every assertion unchanged in what it asserts" is a human judgement, and a green suite proves nothing if the diff also edited the suite — which is precisely §5.4 ground 1's own argument for deferring the retrofit |
| T-WEB-S47 | `nonogram-screen.test.tsx` | the four branches in order, including `solution === null → DailyUnavailable` **before** the hydration gate; entering `solved` swaps in place with `next/navigation`'s `push`/`replace` asserted never called; mounting with a concluded record restores straight into the conclusion with no POST and no timer; `data-play-state` on both live branches; **`h1.previousElementSibling === null`** in `PlayView`, `PlaySkeleton` and the conclusion; `PlaySkeleton` occupies the same boxes as the hydrated screen (`occupantsIn` equality with the anti-vacuity `arrayContaining` guard) and emits **no `data-cell-index`**; the rules blurb renders through `messages.…rules`; **a fresh board's readout is `0 de {target}`, never `0 de {size²}`**; the stats card's third row renders `messages.…sizeLabel` and `.size(size)` (ADH-12); and the timer readout pair resolves through `getAllByLabelText(messages.play.timerAria("00:00"))` with `toHaveLength(2)` — **not because the timer is unevidenced** (it is covered by §5.1's not-touched list, §10.3/§10.5/§10.6, §14.1's bound and this row's own "restores into the conclusion with **no timer**"), but because both shipped screens assert exactly this (`binairo-screen.test.tsx:303-310`, `sudoku-screen.test.tsx:268`) and a third game's screen test should not be the one that drops it |
| T-WEB-S48 | `…` via `css-source.ts` | **the geometry, A1–A14** (§19.1) |
| T-WEB-S49 | `…` via `css-source.ts` | **the caret block, closing G7/N17:** `expect(GAME_CSS).toMatch(/^\.cellSelected,\n\.cell:focus-visible \{/m)`, then `decl(bodyOf(GAME_CSS, ".cell:focus-visible"), "outline") === "2px solid var(--ink)"` and `pixels(…outline-offset) < 0` |
| T-WEB-S50 | `conclusion-view.test.tsx` | the picture renders **only** when `picture` is supplied; `role="img"` carries `picture.label`; `d` has exactly one `M…h1v1h-1z` subpath per `1` cell, **plus the anti-vacuity assertion that the subpath count is `> 0` whenever `picture` is supplied** (CLI-5 — the per-cell equality is vacuously true at zero cells); **binairo's and sudoku's conclusions are byte-identical to today** |
| T-WEB-S51 | `nonogram-screen.test.tsx` | the in-place mount passes `picture` from play state **with no record written**; `/nonogram/concluido` derives the same picture from a concluded record **with no `picture` prop**; a concluded record with `grid: undefined` renders the stamp and no picture; a `localStorage`-throws run still shows the picture in place |
| T-WEB-S52 | `…` via `css-source.ts` | `bodyOf(CONCLUSION_CSS, ".picture")` declares an `animation` naming `picture-settle`; the keyframe name matches none of `/bounce\|elastic\|wobble\|jiggle\|spring/i`; `.picture` and `.pictureRow` declare none of `background`/`border`/`border-radius`/`box-shadow`; the animation names only `transform`/`opacity`; and `bodyOf(CONCLUSION_CSS, "@media (prefers-reduced-motion: reduce)")` contains `.picture` |
| T-WEB-S53 | `nonogram-page.test.tsx` | both segments export `dynamic === "force-dynamic"`; with `getTodayDaily` mocked to `undefined` each renders the unavailable screen with **Nonogram's** copy; `getTodayDaily` is called with `"nonogram"` and nothing else on the mocked `@miolos/db` is called; the props crossing into the client tree are **exactly** `{game,date,size,clues}` (key set asserted), with the shipped **two-part** leak scan — `collectKeys(elementSchema.parse(await NonogramPage()).props)` for the RSC payload **plus** `expect(renderToStaticMarkup(element)).not.toContain(forbidden)` for the markup |
| T-WEB-S54 | `…` | `/nonogram/concluido` derives its date from `getTodayDaily(...).date` and not from the client clock (wall returns one date with `Date` faked to another) |
| T-WEB-S55 | `conclusion-view.test.tsx` + `hoje.smoke.test.tsx` | **the activation, all THREE breaking tests** (§17's table): `conclusion-view.test.tsx:203-226` and `:301-318` each gain a `concludedNonogram()` record and still expect `ctaHome`; `:279-299` is **retargeted** to `ctaNext(messages.games.nonogram.name) → routes.nonogram`, keeping its subject (never chain back to the celebrated game) intact. **No `getAllByText(dayCard.missing)` count changes** — asserted by leaving all five untouched and the file green. And with a concluded nonogram record the hub card is a `<Link>` whose href is `routes.nonogram`. `hoje.smoke.test.tsx:136-146` and `day-state.test.ts` need **no edit** and the plan says so |
| T-WEB-S56 | `route-ssr.test.tsx` | two new `RouteCase` entries + a `NONOGRAM` fixture parsed through `dailyNonogramResponseSchema`. **The file that caught the HTTP 500 that reached CI** — `ConclusionPicture.label` being a *string* is exactly what it proves |
| T-LINT-S3 | `eslint-db-wall.test.ts` | the import bans and the table-literal selectors fire from an `apps/web/src/nonogram/**` path; a clean nonogram file reports **zero** |

### 19.1 T-WEB-S48 — the geometry assertions, A1–A14

jsdom has no layout, so **every number in §12 is unenforced unless it lands as a text assertion**. Using the `declares(css, local)` companion from `binairo-screen.test.tsx:157-207` (which decides from the CSS text which module's hashed class to use, because the runner's CSS-Module proxy answers every key with a hashed name):

```ts
const GAME = stylesheet("src/nonogram/nonogram-board.module.css");
const SHARED = stylesheet("src/play/screen.module.css");
const PAGE_PADDING = 2 * token("--space-5");                 // 40
const FOLD_COLUMN = 1141 - (80 + 330 + 72 + 80);             // 579
/**
 * MEASURED, not recalled — and this is the one number in the suite that no
 * stylesheet can re-derive, so it carries its provenance and its
 * invalidation trigger (TR-6). Chrome 151 (puppeteer 25.4.0,
 * ~/.cache/puppeteer/chrome/linux-151.0.7922.47), against the woff2 the
 * built `@font-face` in .next/static/chunks/*.css actually points at for the
 * latin subset of Instrument Sans: every digit is 6.609375px at 11px with
 * `font-variant-numeric: tabular-nums`, spread 0.000000. Fraunces has NO
 * tabular figures (ADR-0036).
 *
 * INVALIDATED BY: any change to `--font-ui`, to `.clueNumber`'s weight, or
 * to its font-size. A9 asserts all three at the exact values the
 * measurement was taken at (var(--font-ui), 600, 11px), so such a change
 * reds the assertion that OWNS this number rather than silently leaving A3
 * computing with a stale constant against 0.98px of slack.
 */
const DIGIT = 6.609375;
const TWO_DIGIT = 2 * DIGIT;                                 // 13.203125
/**
 * [digit chars, runs] for the worst row of each size across the whole
 * shipped motif library. Pinned in `packages/games/test/nonogram/`
 * (assertion B1) — a two-way citation, because the two packages cannot
 * import from each other and a bare "pinned by B1" would be a hope rather
 * than a link. B1's comment names THIS file and constant; this comment names
 * B1's file. If they ever disagree, B1 is the source of truth and A3 is the
 * consumer that must be updated.
 */
const WORST_ROW = { 5: [3, 3], 8: [4, 4], 10: [5, 5], 15: [5, 5] };
```

**Which block each assertion reads — and how the two mobile blocks are bound.** `.pageNonogram`, `.mobileCap5`, `.grid`, `.cell`, `.clueNumber`, the state classes, `.controls`/`.control`/`.controlActive`/`.affordance` and the desktop `.size*` templates are the **top-level** blocks, reached by a bare `bodyOf(GAME, …)` and correct by §12.4 rule (i)'s file ordering. The mobile rules are not: the module declares **two** `@media (max-width: 768px)` blocks (§12.4 rule ii), `bodyOf` is first-match and **throws** on a miss, so `bodyOf(bodyOf(GAME, "@media (max-width: 768px)"), ".controls")` searches the *geometry* block and raises ``no block for `.controls` ``. The suite binds both explicitly, once, at module scope:

```ts
/**
 * TWO `@media (max-width: 768px)` blocks, in the fixed order §12.4 rule (ii)
 * states: geometry (`.size*`, `.cell`) then chrome (`.controls`, `.control`,
 * `.affordance`). `bodyOf` is first-match and THROWS, so the second is
 * reachable only by slicing past the first. Both guards below are
 * anti-vacuity, not decoration: a merged or reordered module makes one of
 * them fail loudly instead of silently handing an assertion the wrong body.
 */
const MOBILE_GEOMETRY = bodyOf(GAME, "@media (max-width: 768px)");
const AFTER_GEOMETRY = GAME.slice(
  GAME.indexOf(MOBILE_GEOMETRY) + MOBILE_GEOMETRY.length,
);
const MOBILE_CHROME = bodyOf(AFTER_GEOMETRY, "@media (max-width: 768px)");
expect(MOBILE_GEOMETRY).toContain(".size15");
expect(MOBILE_CHROME).toContain(".controls");
```

A1's four mobile templates and A12's "no `max-width` on the mobile `.size5`" then read `bodyOf(MOBILE_GEOMETRY, ".size5")` … `bodyOf(MOBILE_GEOMETRY, ".size15")`; A10 reads `bodyOf(MOBILE_CHROME, ".controls")` and `bodyOf(MOBILE_CHROME, ".control")`; the `.affordance` `display: none` reads `bodyOf(MOBILE_CHROME, ".affordance")`. Every row below that names a mobile rule means one of those two constants, never a bare nested call.

| # | Assertion | What it stops |
|---|---|---|
| A1 | for each size, the mobile `grid-template-columns` is `max-content repeat(N, minmax(0, 1fr))` and matches no `\d+px` cell track | the desktop 525 px board reaching a 328 px card — the `board-overflows-horizontally-below-369px` class of defect |
| A2 | `pixels(decl(bodyOf(GAME, ".pageNonogram"), "--board-mobile-max")) === 350` and `350 <= 390 - PAGE_PADDING`; and the shared `.gridCard` mobile `max-width` is still `var(--board-mobile-max)` | N12/C6: the property has **no fallback**; omitting it deletes the mobile cap in silence |
| A3 | for each size and `V ∈ {320, 390}`, **against the cap that size actually resolves** — `cap = pixels(decl(bodyOf(GAME, size === 5 ? ".mobileCap5" : ".pageNonogram"), "--board-mobile-max"))`, i.e. `cap ∈ {310, 350}`, because `.mobileCap5` sits on the page root and the property inherits to every descendant (§12.4, §12.8, A10, A12): `inner = min(cap, V - PAGE_PADDING) - 2*gridCardPadding - 2`; `Gw = chars*DIGIT + (runs-1)*clueGap + cluePad` read from `.clueRow`; assert `(inner - Gw)/N >= TWO_DIGIT` and `cell(390) > cell(320)`. At 390 px a size-5 day's `inner` is **288, not 328** — it clears the clue floor by ~33 px either way, but a hard-coded 350 would be a **loosening**, and loosening is the direction that hides a regression | **the whole decision.** Any reintroduced `gap` fails this — **and a size-5 row computed against a cap the page root never resolves on a Monday** |
| A4 | `.grid` `gap` is `0`; `.cell` `border-top`/`border-left` are `1px solid color-mix(in srgb, var(--ink) 50%, transparent)`; `.cellRuleTop`/`.cellRuleLeft` are `2px` + `var(--ink)`; `.cellEdgeRight`/`.cellEdgeBottom` are `2px solid var(--ink)` | a later "restore DESIGN.md's gap for consistency" — which reds A3 too, so the two explain each other |
| A5 | the **single** top-level `.cell` block (§12.6 and §12.6b are one rule in the file — §12.4 rule iii) declares no `border-radius`, declares `box-sizing: border-box`, and — the anti-vacuity guard — declares `background: var(--paper-desk)`, which only the top-level block carries | notched corners at every junction; 2 px rules silently widening the tracks; **and a `bodyOf` that read the mobile `.cell { aspect-ratio: 1 }` instead, where "declares no `border-radius`" passes for the wrong reason** (TR-5) |
| A6 | for each size, parse the desktop template → `board = Gw + N*cell`; `card = board + 2*token("--space-4") + 2`; assert `card <= FOLD_COLUMN` | **the 1141–1440 band CI never scans.** The only mechanical statement that the shared fold still holds (P25) |
| A7 | for each size, desktop `grid-template-rows === grid-template-columns` | a non-square board when someone edits one axis |
| A8 | `.grid`, `.clueRow`, `.clueCol` each have `background`, `background-color`, `border`, `outline`, `box-shadow` all `undefined` | `cramped-padding` flush and any future card-inside-card reading |
| A9 | `.clueNumber` at the **exact triple `DIGIT` was measured at**: `font-family === "var(--font-ui)"`, `font-weight === "600"` and `pixels(font-size) === 11` — an `>=` here would let a 12 px edit through while A3 kept computing with a stale 6.609375 — plus `font-variant-numeric === "tabular-nums"`. 11 px is simultaneously the measurement's size and `undersized-ui-text`'s floor, so the equality is not stricter than the design allows | ADR-0036's measured fact; `undersized-ui-text`'s 11 px floor; **and `DIGIT`'s invalidation trigger** (TR-6) — a change to `--font-ui`, to the weight or to the size reds the assertion that OWNS the number instead of silently leaving A3 with 0.98 px of slack it no longer has |
| A10 | read through **`MOBILE_CHROME`**, never a bare nested `bodyOf` (§12.4 rule ii): `.controls` declares `width === "100%"` and `max-width === "var(--board-mobile-max)"`; `(min(cap, 320-40) - 2*gap)/3 >= token("--touch-target-min")` for **both** caps the page root can resolve — `cap ∈ {350, 310}`, since `.mobileCap5` sits on the same element and custom properties inherit (§12.8), and at 320 px both give 280 → 88 px; the mobile `.control` height ≥ the token | `mobile-controls-shrink-to-fit-and-sub-44px-targets`, verbatim in shape from `binairo-screen.test.tsx:1014-1036` — **and a Monday whose inherited 310 px cap was never checked** |
| A11 | `.pageNonogram` declares all three rotations; each card rotation's absolute value is in `[0.3, 2.4]` and the tape rotation's in `[3, 5]`; and the triple `!==` the triples read from `binairo-screen.module.css` and `sudoku-board.module.css` through `stylesheet()` | makes `sudoku-board.module.css:21-24`'s "distinct signature" rule mechanical instead of a comment |
| A12 | `pixels(decl(bodyOf(GAME, ".mobileCap5"), "--board-mobile-max")) === 310`, and the CARD arithmetic that follows from it: `abs(((310 - 22) - Gw(5))/5 - 52) < 1`; plus the mobile `.size5` block declares **no** `max-width` | a Monday board bigger on a phone than on a desktop — **and** a 350 px card wrapped around a 288 px board (DES-5). Measures what the player sees, the way `binairo-screen.test.tsx:990-1000` does |
| **A13** | `bodyOf(GAME, ".cellFilled")` declares `background: var(--accent)`; `bodyOf(GAME, ".cellFilled.cellHinted")` and `bodyOf(GAME, ".cellCrossed.cellHinted")` each declare a `box-shadow` and declare **no** `background`, `background-color` or `border-color`; and the brush pair is a clean **inversion asserted by value, not by counting declarations** — `.control` is `background: var(--paper-card)` + `color: var(--accent)`, `.controlActive` is `background: var(--accent)` + `color: var(--paper-card)`, and `.controlActive` declares **no** `border`/`border-color` (the 1.5 px edge is `var(--accent)` in both states, so a restated one would be a no-op reading as a third carrier) | **DES-1:** a later "make the hint match Sudoku" edit reds a test instead of hiding the day's one free hint under a 10 % tint; **DES-6:** a pressed brush that carries only `aria-pressed` — **and** a `border-color` clause that would have passed only because `decl()` cannot see inside `.control`'s `border` shorthand |
| **A14** | `bodyOf(GAME, "@media (prefers-reduced-motion: reduce)")` contains `.cell` and `.control`; and on the **single** top-level `.cell` block, `transition` is first asserted **defined** — the anti-vacuity guard, because a second top-level `.cell` rule would send this lookup to §12.6's half, which declares none, and `decl()` would hand back `undefined` (§12.4 rule iii) — and then that it names neither `transform` nor any of width/height/padding/margin | DESIGN.md:44's reduced-motion law in the module the shared sheet cannot reach (landmine 24); `layout-transition`; **and a split `.cell` that makes this row green on an empty read** |

Plus two assertions that are not `css-source` but belong with them:

- **B1 — the content bound the geometry rests on.** In `packages/games/test/nonogram/`, enumerating `MOTIFS` and every mirrored variant the way `motifs.test.ts:85-105` already does: for sizes {5, 8, 10, 15} no row clue exceeds {3, 4, 5, 5} runs or {3, 4, 5, 5} total digit characters. **Its comment names the consumer by file and constant** — `WORST_ROW` in `apps/web/test/nonogram-screen.test.tsx`, feeding A3's `(inner − Gw)/N ≥ TWO_DIGIT` check at 320 px, where the size-15 slack is 0.98 px — and A3's own comment names this file back. Two packages that cannot import from each other get a **two-way citation**, which is the cheapest available link across the boundary and is what turns "pinned by B1" from a hope into one (TR-6). **Without it a future motif shrinks the 15-class phone cell below the two-digit clue floor with no test firing anywhere.** No `T-` id — `packages/games` carries none.
- **C1 — the rules are classes, not comments.** A plain jsdom test that cell `r*N+c` carries `cellRuleTop` iff `r % 5 === 0`, `cellRuleLeft` iff `c % 5 === 0`, `cellEdgeRight` iff `c === N-1`, `cellEdgeBottom` iff `r === N-1` — for size 5 (frame only, no interior rule) and size 15 (rules at 5 and 10). Folded into T-WEB-S48.

### 19.2 What jsdom CANNOT prove — stated so the plan never claims coverage it lacks

Ten things. Each goes in the PR body as a **browser observation**, never as a green check.

| # | Claim | Why jsdom cannot reach it |
|---|---|---|
| 1 | Pointer capture and the trailing-`click` retargeting it causes | jsdom implements neither; `binairo-screen.test.tsx:69-79` stubs `setPointerCapture` and says so in the file. T-WEB-S45a/c drive the sequence a browser produces and prove the **handler logic only** |
| 2 | That focusing at `pointerup` is what keeps the caret alive under capture on WebKit | same; T-WEB-S45g proves the mechanism, not that it is what saves capture-retargeted input |
| 3 | That a pointer press focuses on Safari (T-WEB-S42) | jsdom's click does not move focus, exactly like WebKit — which is why the fix exists. The test proves the code path |
| 4 | `:focus-visible` matching, and therefore that the caret **paints** at all | jsdom implements no `:focus-visible` and no layout. T-WEB-S49 proves the declaration as stylesheet text |
| 5 | That `aria-describedby` → `role="group"` + `aria-label` is **announced** | no accname computation, no AT. T-WEB-S43 proves the attributes resolve. **One VoiceOver or NVDA pass on `/nonogram` is run and its result recorded** |
| 6 | Every geometry number — cell size, gutter width, whether a 2 px inset outline reads on a 14.2 px cell, whether the CSS × is legible there | jsdom has no layout. A1–A14 are text assertions plus a browser check at 320, 390, 1100 and 1440 |
| 6b | **Three of the four size classes, in the rendered app** | the board's size is a function of the weekday, so `impeccable detect` and every manual pass see exactly the one size the scan day produces (DES-4). E12 names that size and covers the other three with a static geometry harness — a **geometry** check, never a substitute for detect |
| 7 | That `preventDefault` actually stopped the page from scrolling (T-WEB-S42) | jsdom records the flag, not the scroll |
| 8 | That the solved board persists ~one frame (P27's whole basis) | a React scheduling claim; must be measured in a real browser |
| 9 | Whether UA `<button>` styling is fully normalised for 225 buttons | a browser claim |

Kinds: **unit** = pure functions, no DOM, no DB. **integration** = real PGlite running the committed migrations, or a route handler invoked as a function. **No property tests are added outside `packages/games`.**

---

## 20. The bundle obligation (D11), respecified (P29)

### 20.1 The obligation as written cannot be discharged

Plan 017 `:1511`, plan 018 §19 item 7 and ADR-0027 `:132-138` all mandate *"measure the route's First Load JS in `pnpm build` and paste it"*. Next **16.2.12 builds with Turbopack**, and its route table has **no `Size` and no `First Load JS` column** — measured:

```
@miolos/web:build: ▲ Next.js 16.2.12 (Turbopack)
@miolos/web:build: Route (app)
@miolos/web:build: ┌ ƒ /
@miolos/web:build: ├ ○ /_not-found
@miolos/web:build: ├ ƒ /binairo   … (route names and the ƒ/○ legend only)
```

Nor is the figure derivable from `build-manifest.json` (no per-app-route entry) and there is no `app-build-manifest.json`. **This is a documentation-vs-code contradiction and the plan records it** rather than pasting a number that does not exist.

### 20.2 The substitute measurement

Per-route client JS is recoverable from `.next/server/app/<route>/page_client-reference-manifest.js` — **`clientModules[*].chunks` only, `.js` entries only** — unioned with `build-manifest.json`'s `rootMainFiles` + `polyfillFiles`. The plan lands the ~60-line, zero-dependency script as `apps/web/scripts/route-client-js.mjs`.

**`entryJSFiles` is deliberately EXCLUDED, and the prose now says so** (SRV-2): it re-counts the server entry graph, and including it inflates `/page` from 909.6 KB to ~1 263 KB and the per-game deltas from +26.5/+28.6 KB to +52.9/+57.2 KB — which would put a *clean* `/nonogram` route over the acceptance threshold below before a single motif table leaked. Two independent re-derivations reproduced the table below **byte-for-byte on chunk counts and raw KB with `entryJSFiles` excluded**, and reproduced the inflated figures with it included; an earlier draft named the union one way and measured it the other.

**Baseline, measured on this tree before any nonogram code:**

```
/page                        chunks=10  raw=909.6KB  gzip=251.9KB
/binairo/page                chunks=12  raw=938.2KB  gzip=260.3KB
/binairo/concluido/page      chunks=10  raw=916.7KB  gzip=253.8KB
/sudoku/page                 chunks=11  raw=936.1KB  gzip=259.4KB
/sudoku/concluido/page       chunks=10  raw=916.7KB  gzip=253.8KB
```

The number that matters is the **delta over `/`**: binairo **+28.6 KB raw / +8.4 KB gzip**, sudoku **+26.5 / +7.5**.

**What a motif-table leak would actually cost, corrected** (TR-10). The earlier "~57 KB raw, roughly tripling the delta" was N27's **source** byte count (59 233 B of `motifs-*.ts`) misapplied to a **minified** delta; `.next/static/chunks` is minified. The plan's own §20.4 measurement is the right one: esbuild `--bundle --minify --format=esm` gives 3 017 B for `{solveNonogram, deriveClues}` and 38 227 B once `{MOTIFS, motifBitmap}` is added — **+35.2 KB minified**. So a leaked `/nonogram/page` would read ≈ 27 + 35 = **~62 KB** of raw delta against a clean ~27 KB: roughly **doubling**, not tripling, and still unmissable.

```sh
source ~/.nvm/nvm.sh && nvm use default >/dev/null
npx turbo run build --filter=@miolos/web --force          # --force: turbo caches .next/**
cd apps/web && node scripts/route-client-js.mjs
```

**Acceptance: `/nonogram/page`'s raw delta over `/page` ≤ 40 KB**, measured by the method above (`clientModules` ∪ `rootMainFiles` ∪ `polyfillFiles`, `entryJSFiles` excluded). Above that, the tables are in the bundle. 40 KB is calibrated against the measured population, not chosen round: the two shipped game routes sit at **26.5** and **28.6 KB** clean, and a motif-table leak lands at **~62 KB** — 40 discriminates with ~11 KB of headroom above the noisiest clean route and ~22 KB below the leak. **The same run prints binairo's and sudoku's deltas as regression controls**, so the threshold cannot drift silently: if either shipped delta has moved materially, the baseline is stale and the nonogram number means nothing. This is a per-PR tripwire for this route, not a standing rule #27 or #28 inherit — §1's out-of-scope table says #28 inherits ADR-0032, ADR-0035 and ADR-0037, and no bundle rule.

### 20.3 The string-literal grep, with its positive controls

Minification defeats identifier greps (landmine 4 / N23), so both halves are string literals. Negatives are **accent-free** so the grep cannot go vacuous if a bundler's charset setting ever changes (§6.7); the accented positive control proves the encoding path is live.

```sh
cd apps/web
# (a) POSITIVE CONTROLS — every one MUST print a non-zero count.
#     The third is the one that matters: it proves the NONOGRAM client chunks
#     are in the scanned set at all. Without it the negatives are vacuous —
#     five zeros are exactly what an unbuilt route also produces.
for s in "Preenchemos uma célula para você." "Nível" "Revele a figura escondida pelos números."; do
  printf '%-46s %s\n' "$s" "$(grep -rlF "$s" .next/static/chunks | wc -l)"
done
# (b) NEGATIVES — every one MUST print 0. Four motif names, one per size file,
#     plus one motif id. All five verified present in packages/games/src and
#     absent from apps/web, packages/core, packages/ui and packages/db, so a
#     hit can ONLY come from motifs-*.ts.
for s in "Escada" "Borboleta" "Caranguejo" "Flamingo" "sitting-cat"; do
  printf '%-46s %s\n' "$s" "$(grep -rlF "$s" .next/static/chunks | wc -l)"
done
```

### 20.4 G1 CLOSED — Turbopack does reproduce the elimination

Measured on this tree today. `apps/web/src/sudoku/state.ts` and `engine.ts` are **client** modules importing *values* from `@miolos/games/sudoku`, whose barrel re-exports `gradeSudoku`, `generateSudoku`, `generateDailySudoku`, `validateSudoku` and `SUDOKU_TIER_CRITERIA`. Grepping `.next/static/chunks` for their runtime **string literals**:

| Literal | Source | Chunks |
|---|---|---|
| `"pointing"`, `"claiming"` | `sudoku/grade.ts:146,188` | **0** |
| `No approved Sudoku found for seed`, `SudokuGenerationError` | `sudoku/generate.ts` | **0** |
| `clue-count-mismatch`, `tier-mismatch` | `sudoku/validate.ts` | **0** |
| `too-few-givens`, `too-many-givens` | `binairo/validate.ts` | **0** |

Turbopack eliminates unused barrel re-exports, including whole transitive modules. The mechanism is structurally identical to Nonogram's: `motifs-*.ts` ← `motifs.ts` ← `difficulty.ts` ← `generate.ts`/`validate.ts` ← barrel, exactly as `criteria.ts` ← `generate.ts` ← barrel. **This closes G1 and retires D1's strongest falsifier** — if Turbopack had *not* eliminated, D1's option 4′ (ship the motif tables, derive the name locally) would have cost zero incremental bytes and D1 would have had to be revisited before merge.

**But the measurement is on the current tree, before nonogram is wired.** The `/nonogram` figures and the greps above are re-run at step 8 and pasted; nothing here is a substitute for them.

**If it fails,** the sanctioned fix is a tree-shakeable barrel — **never a sub-barrel, never a deep import** (ADR-0019 fixes the exports map at one subpath per game). If it genuinely cannot be fixed, record the measured cost and file a follow-up; do not violate ADR-0019 in this ticket.

**For the record, option 4′ was costed and rejected on its own merits too** (esbuild 0.28.1, `--bundle --minify --format=esm`): `{solveNonogram, deriveClues}` = 3 017 B min / **1 280 B gzip**, no motif strings; adding `{MOTIFS, motifBitmap}` = 38 227 B / **6 316 B gzip**, all of them. **+5 036 B gzip, a 4.9× increase**, on the ritual's critical path, for one word shown once — plus a widened `@miolos/games/nonogram` barrel exporting the content library, a new reverse-lookup primitive owing its own property test, and, decisively, the **loss of the only bundle tripwire this route has**: if the tables ship deliberately, §20.3's grep can no longer prove `generateNonogram`/`validateNonogram`/`random.ts` stayed out.

---

## 21. Branch, commits, PR, rollout

**Branch:** `feat/25-daily-nonogram-end-to-end` (already correct), rebased on freshly pulled `main` before the step-6 gate run.

### 21.1 The `docs/README.md` rows (commit 1 — this plan does not edit the file)

**Sequenced artifacts**, appended after the `handoffs/019-…` row, byte-for-byte in the register of rows 51–53 (backticked path, single spaces inside the pipes, no trailing space, LF):

```
| `plans/020-issue-25-plan-daily-nonogram-end-to-end.md` | Implementation plan for #25 (daily Nonogram end to end: the Nonogram buffer and its contracts, the ruled variable-size board and its three-state brush, the picture reveal in the conclusion, and completion, hint, timer and offline sync at parity) |
```

**Living documents**, inserted after the `agents/domain.md` row so the `agents/*` block stays contiguous:

```
| `agents/test-ids.md` | The `T-<AREA>-[S]<n>[<letter>]` convention, the per-area frontier and the burned slots |
```

`020` is next free (`001`…`019` are contiguous across `plans/`, `handoffs/`, `research/`, `design/`). `adr/` is a directory row, so the six ADRs owe **no** README row. If the session produces a handoff it owes a third row at `021`.

### 21.2 Commits (Conventional, English, each pre-commit-green)

Pre-commit is `pnpm exec lint-staged && pnpm typecheck && pnpm test` and is **never** bypassed with `--no-verify`, so "independently green" means the full suite and a strict typecheck pass at every one of these.

| # | Commit | Notes |
|---|---|---|
| 1 | `docs: plan 020 and the Nonogram vocabulary for #25` | plan + **both** `docs/README.md` rows + `docs/agents/test-ids.md` + **a fourth `### Test ids` subsection in CLAUDE.md's "Agent skills" block** (ADH-7 — that block is the index every session actually reads, and it carries one subsection per `docs/agents/*` file; a fourth agent doc with no pointer is invisible, which is the exact failure P30 exists to prevent) + **`CONTEXT.md`'s seven new rows** (ADH-6, §16.1). Landmine 17: a missing index row has been a blocking finding six times, and this ticket now owes **four index edits across three different files** — `docs/README.md` twice, `CLAUDE.md` once, `CONTEXT.md` once. The `agents/test-ids.md` README row is the one that gets forgotten |
| 2 | `docs: ADR-0032…0037 for the daily Nonogram (#25)` | written **before** implementation, per CLAUDE.md. **Carries ADR-0036's amendment in the same commit that makes the claim** (§3, ADH-1/ISS-6): `DESIGN.md:28`, `packages/ui/tokens.css:58` and `tokens.css:27`'s trailing comment. No token value moves and no JSX enters `packages/ui` |
| 3 | `feat(core): nonogram daily contracts and the wall's third projection` | §7.1–§7.4, §7.7, §8. Green because nothing else consumes these yet — verified: no `apps/web` source file takes `DailyPuzzleResponse` as a parameter or prop, so widening the union breaks nothing there (#23's S11 narrowing already paid that cost) |
| 4 | `feat(api): buffer, judge and publish the daily Nonogram` | §7.5, §7.6, §9. Core's completion and cron contracts ride **here**, not in 3, because the completion member is a compile error in `apps/api` (`storedSolution`, TS2366) the moment it lands |
| 5 | `refactor(web): extract the pointer-stroke machinery to play/use-pointer-stroke.ts` | **behaviour-free.** Binairo suite green, assertions unchanged in what they assert (T-WEB-S46). Independent of 3 and 4 — may run in parallel |
| 6 | `feat(web): let a pointer stroke hand its last cell back` | the optional `onStrokeEnd`; Binairo does not pass it |
| 7 | `feat(web): nonogram play state, engine adapter, hint and offline record` | §10, §14, §15. The record member and the sync arm are **inseparable** — the `never` assignment is a compile error |
| 8 | `feat(web): the nonogram board, its controls and the play screen` | §11, §12, §16, both route segments, `routeSlugs`/`routes` (**not** `playRoutes`). **Before committing: `rm -rf apps/web/.next`** — N24 |
| 9 | `feat(web): the picture reveal in the conclusion` | §13, incl. the two shared-file edits and `route-ssr.test.tsx` |
| 10 | `feat(web): activate the nonogram hub tile and the conclusion chain` | **`playRoutes.nonogram` — one line** — plus **the three tests it breaks** (§17's table: `:203-226` and `:301-318` gain a `concludedNonogram()` record, `:279-299` is retargeted). Measured, not inferred: `Tests 3 failed \| 316 passed (319)`. Pre-commit runs the full suite and is never bypassed, so a commit scoped to "two tests" lands **red**. §17, N21 made reviewable |
| **11 — the arming commit, pushed LAST** | `ci: scan the nonogram routes with impeccable` | §21.5. **Not a step-5 commit** (SRV-1). Created and pushed only after the step-7 fixes and after E2b's `{generated: 7, depth: 7, failures: []}` is pasted, because the workflow scans the *deployed commit's* path list and an unseeded `/nonogram` fails the marker grep — which is what happened on PR #60's analogous `604975e` (Impeccable run 30710479040, failure). Its own push is the first preview scan of the two new routes |

Then the step-7 `fix:` commits (§24 R4 says to expect two or three), **then** E2b, **then** commit 11, and `docs: handoff 021 …` if the session produces one.

**Why 10 is not folded into 8 or 9:** it is the entire behavioural change to two shipped screens, and hiding it inside the largest diff is the one collapse that is actively bad. Collapsing 3+4 or 5+6 would be legal. **Why 11 is last and not folded anywhere:** it is the only commit whose effect is on CI rather than on the product, and its precondition is a database state no commit can carry.

### 21.3 Verification (evidence rule — paste real output), from the repo root

```sh
source "$HOME/.nvm/nvm.sh" && nvm use
# FIRST LINE, every gate pass and every step-7 re-run — not only before
# commit 8 (TR-13). `next-env.d.ts:3` hard-imports the gitignored
# `.next/types/routes.d.ts`; neither turbo's `typecheck` nor its `test` task
# regenerates it, only `next build` does. So a typecheck run after a build
# that predates the nonogram segments is red for a reason unrelated to the
# diff, and CI cannot reproduce it (a clean checkout has no `.next`). This is
# already armed: verifying §20's Turbopack claim required a build, and
# `apps/web/.next/types/routes.d.ts` now holds the five-route frozen union
# `"/" | "/binairo" | "/binairo/concluido" | "/sudoku" | "/sudoku/concluido"`.
rm -rf apps/web/.next
pnpm install
pnpm typecheck --force
pnpm lint                                # plus a deliberate-violation run proving the wall is live
pnpm test --force                        # full suite, uncached
npx turbo run build --filter=@miolos/web --force
cd apps/web && node scripts/route-client-js.mjs      # §20.2, then §20.3's two grep loops
pnpm exec impeccable detect apps/web/app apps/web/src # file mode — P28's reveal evidence
```

### 21.4 The seeding story (E2b) — a gate, twice over

`apps/web/app/nonogram/page.tsx` reads `getTodayDaily(getDb(), "nonogram")`, and `daily_puzzles` holds **zero** nonogram rows today. Preview and production read the **same** Neon database. So:

1. **AC 2 has no obtainable evidence without seeding.** `/nonogram` renders `DailyUnavailable` at HTTP **200**, which emits **neither** marker. The hardened preflight's grep is what catches it; **`impeccable detect` itself would pass green on the wrong screen.** A 200 is not evidence, it *is* the failure mode.
2. **Without seeding the merge itself ships two defects.** `/buffer-depth`'s `shallow` is an OR, so `depths.nonogram = 0 < 4` flips it true the moment the third key lands and `buffer-alert.yml` opens an alert issue on its next poll; and `/nonogram` shows the unavailable card in production from merge until the next 06:00 UTC cron.

**The cron cannot do it.** Re-verified with `npx vercel env ls` in `apps/api` (2026-08-01): `CRON_SECRET` is **Production-only**, so a preview `/cron/publish` returns 401 — and production's `/cron/publish` runs `main`, which has no `topUpNonogramBuffer` until merge. **There is no deployed path that can seed nonogram before the merge.** The only mechanism is plan 018's E0: run the branch's own top-up locally against the database.

```sh
cd /home/ferna/projects/miolos/apps/api
source "$HOME/.nvm/nvm.sh" && nvm use default >/dev/null
npx vercel env pull .env.production.local --environment=production   # .env.* is gitignored
set -a && . ./.env.production.local && set +a

pnpm exec tsx -e "
void (async () => {
  const { createPublishingDb, getRemoteConfig } = await import('@miolos/db/publishing');
  const { topUpNonogramBuffer } = await import('./src/publishing/service.ts');
  const url = process.env.DATABASE_URL_UNPOOLED;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED is unset');
  const db = createPublishingDb(url);
  const config = await getRemoteConfig(db);
  const result = await topUpNonogramBuffer(db, config.bufferDepth);
  console.log(JSON.stringify({ bufferDepth: config.bufferDepth, ...result }, null, 2));
})();
"
```

**The `void (async () => {…})()` wrapper is required and was proved, not guessed.** `tsx -e` transforms to CJS and a bare top-level `await` fails with *"Top-level await is currently not supported with the 'cjs' output format"*; with the IIFE, both a bare workspace specifier and a relative `./src/...` path resolve. **Plan 018's E0 line is written with an elided body and would not run as literally transcribed** — fixed here rather than discovered at 2 a.m. against a production database.

Expected: `{"bufferDepth":7,"generated":7,"depth":7,"failures":[]}`, pasted in the PR.

**The ordering rule, reconciled — and it is a sequencing gate, not a note** (SRV-1). The Impeccable workflow fires on `deployment_status` with **no branch filter** (`impeccable.yml:6-7`), checks out the **deployed commit** (`:20-22`), and takes its preflight path list from that commit (`:76`). So the first preview scan that includes `/nonogram` happens the instant **commit 11** is pushed — and with no seeded row `/nonogram` renders `DailyUnavailable` at HTTP 200, which sets no `data-play-state=`, so `:99-101`'s marker grep fails and `:106`'s `test "$status" -eq 0 || exit 1` fails the job. **This is not a theory: PR #60's analogous commit `604975e` ("ci: scan the sudoku routes, and assert the preview actually rendered") produced Impeccable run 30710479040 = failure, with the log reading `preflight /sudoku: no data-play-state= in the response … refusing to scan`.** #25 must not repeat it. Therefore, as three statements that agree:

1. **E2b runs ONCE, after `nonogramDailyContentSchema` is frozen** — i.e. after the step-7 fixes land — and its `{generated, depth, failures}` output is pasted.
2. **Commit 11 is created and pushed only after E2b's output is pasted.** It is the last commit on the branch, an **arming commit**, not a step-5 one. §21.2 and §22 say so in the same words. Until it lands, the workflow scans the five shipped paths and stays green; nothing is unscanned that was ever scanned before.
3. **If any step-6/7 or step-8 finding changes `nonogramDailyContentSchema` after E2b, the N32 hard delete plus a re-seed is MANDATORY before the next push**, and the PR pastes both. Rows are immutable (ADR-0024 D14) and killed rows count as covered (`buffer.ts:30-45`), so there is no other recovery; and a stale row is not silently wrong — `stripDailyContent` uses `.parse` (`contracts/daily.ts:183,192`) and `getTodayDaily` does not catch (`published.ts:64-86`), so `/nonogram` 500s and the preflight's `"200 $DEPLOYMENT_URL"*` case rejects it at `:92-94` before the grep runs.

**One correction to the finding that raised this, carried so the PR does not overstate it:** the `detect` job is **not** a GitHub-required status check. `gh api repos/fernandolisboa/miolos/rulesets/20162549` returns `required_status_checks: [{"context": "gate", "integration_id": 15368}]` and `branches/main/protection` is a 404. A red Impeccable run blocks by **project policy** (CLAUDE.md's `npx impeccable detect` gate, landmine 14), which is a real obligation and the reason for this rule — not by the merge button.

**The recovery landmine (N32), stated or paid for.** Rows are immutable (ADR-0024 D14) **and `listBufferedDates` counts killed rows as covered** (`buffer.ts:30-45`: "killed dates are already covered and are never regenerated"). So setting `killed_at` on the seeded rows would leave those dates **permanently uncovered** — the cron will never refill them and `/nonogram` shows the unavailable card on each. The only correct recovery is a hard delete of the not-yet-published rows, then a re-run:

```sh
psql "$DATABASE_URL_UNPOOLED" -c \
  "delete from daily_puzzles where game = 'nonogram' and published_at > now();"
```

**Safety pre-merge, argued rather than assumed:** nothing deployed reads `game='nonogram'`. The `/nonogram` segment does not exist on `main` (404); `/daily/nonogram` does not exist on the deployed api; production `/buffer-depth` reads two keys; production `/cron/publish` tops up two games; and `getTodayDaily(db, "nonogram")` **does not compile** on `main` because `ProjectedGame` excludes it. The rows are invisible to every shipped reader **by construction, not by convention**.

### 21.5 `.github/workflows/impeccable.yml` — three places

`:76` (the preflight loop), after `:149` (desktop 1440×900) and after `:165` (mobile 390×844) each gain `/nonogram` and `/nonogram/concluido`, in landing order (binairo #18 → sudoku #23 → nonogram #25). The `marker` `case` at `:77-81` is **already generic** (`*/concluido → data-conclusion-state=`, `/ → ''`, `* → data-play-state=`), so the two new paths get correct markers with no further edit — and `:65`'s "keep this list and the two detect invocations below in step" is honoured.

**Consequences, both named.** Scans go from 10 to **14** page-loads, so a red-detect fix loop costs ~40 % more wall-clock per iteration. `timeout-minutes: 15` is *expected* to still cover it — **and that is an expectation, not a measurement**: §26 item 11 carries it as open, and the job's real wall-clock time is pasted at step 8 beside E11's run rather than asserted here (TR-10). And **`.impeccable/config.json` gets no edit** — its two wildcard entries (`low-contrast`, `cream-palette`, both `value: "*"` over the scanned hosts) already suppress every contrast and palette finding on any new route, which is precisely why this plan owes **computed** figures (§12.6, §13.4). A new by-design finding gets a **value-level** entry with a written reason; **a third wildcard host pattern is forbidden** (landmine 14).

### 21.6 PR skeleton

`Closes #25.` → **What changed** (one bold-package bullet per workspace, plus an explicit "not touched" paragraph naming `packages/games/src`, **`packages/ui`'s tokens and JSX surface — with the one documentary exception spelled out: ADR-0036's amendment edits `tokens.css:27`'s and `:58`'s comments and `DESIGN.md:28`, and no token value moves** (ADH-1/ISS-6) — `packages/db`'s exports, `adSlotPlacements`, `wallPredicate`, `ACCEPTED_DAYS_BACK`, `hint_grants`, `vercel.json`, `.impeccable/config.json` and the migration directory, **and stating that `completionResponseSchema` is unchanged**) → **Verification** (every output from §21.3 inline, plus §20's bundle table and greps, plus the E-series) → **Design deviations** (§12.9's **six**, each with its arithmetic, including the absent board press affordance) → **Computed contrast figures** (§12.6's nine pairs, §12.6b's five for the cell states and the hint ring, §12.8's three for the pressed brush, and the reveal's 4.51:1 — because CI is blind here) → **What jsdom could not prove** (§19.2's ten, as browser observations, with the size class the scan day rendered named) → **Step-8 rollout** checkboxes → **Decisions surfaced (FYI)**: no reveal name and why (ADR-0033), the reveal in the conclusion rather than in place and the timing evidence for it, **with E12b's measurement pasted and ADR-0034's PENDING consequence resolved either way** (ADR-0034), the design-system deviations (ADR-0035), **the Fraunces tabular-figures defect and every timer surface it affects — `/nonogram` included, as the third** (ADR-0036), the pointer-stroke extraction firing ADR-0029 (c), the Binairo retrofit **filed not built** with the issue link, the progress readout deciding against handoff 019:164, and that `streakCount` stays `0` with the positive half stated.

**Decisions needed from Fernando: none that block the merge. ONE that he may want to reverse, stated as a call rather than as an FYI** (ISS-9). CLAUDE.md's rule is to surface a contradiction with a governing document rather than silently pick a side, and **ADR-0036 amends `DESIGN.md:28` and `packages/ui/tokens.css:27,58` — the living design context `/impeccable` reads, governing all four games.** That is materially different from the two filed defects it would otherwise be grouped with: the **six** §12.9 deviations are scoped to one screen with no reference frame, while this one rewrites a rule for every screen. The PR states it in one line, with the fallback already written in §23.1 (the measurement becomes a plan-level deviation plus the filed issue, ADR-0037 renumbers to 0036, and `DESIGN.md` is left contradicting the shipping font) so reversing it is a sentence, not a redesign.

Three further items are surfaced **FYI**, and each has a follow-up **already filed at E0, before the PR body is written**, so the links are real at review time and "each has a filed follow-up" is verifiable rather than aspirational (ISS-7): the reveal's missing name (a filed feature, not a gap), the Fraunces timer defect (a filed bug — and `/nonogram` inherits it as a **third** surface, since `play-view.tsx` renders the shared `.timerBar`/`.timerCard`), and the Binairo retrofit (a filed a11y issue).

### 21.7 Step-8 production rollout, in order, evidence pasted

- **E0 — file the four follow-ups BEFORE the PR body is written, not after the merge** (ISS-7). §21.6 requires the PR to carry "the Binairo retrofit **filed not built** with the issue link" and to close with "each has a filed follow-up"; with the filing at E13 those links do not exist and that sentence is false at the moment Fernando reads it. The four are pure `gh issue create` calls with no dependency on the merge or on any deployment, so they run first: the Binairo ADR-0030 retrofit (§5.4's body, verbatim, including its seven acceptance criteria), the Fraunces tabular-figures fix for `.timerCard`/`.timerBar`, Binairo's missing `withEntry` identity guard, and the named-reveal feature. Paste the four URLs.
- **E1.** No infrastructure work. **Do not rotate `DATABASE_URL`.** #59 remains unbuilt and nothing may imply otherwise.
- **E2.** **No migration.** `psql "$DATABASE_URL_UNPOOLED" -c "\d daily_puzzles"` showing the CHECK already lists `'nonogram'`, pasted.
- **E2b.** §21.4's seeding run, **after the step-7 fixes freeze `nonogramDailyContentSchema` and BEFORE commit 11 is pushed** — that ordering is the gate, not a note (SRV-1). `{generated, depth, failures}` pasted, plus `select date, published_at, published_at > now() as future from daily_puzzles where game='nonogram' order by date;` so the future-dated rows are visibly present.
- **E3.** Merge → both projects auto-deploy. `vercel.json` unchanged, so nothing to confirm there; paste the deploy links.
- **E4.** `curl -H "Authorization: Bearer $CRON_SECRET" https://api.miolos.app/cron/publish | jq` ⇒ `games.nonogram = {"generated": 0, "depth": 7, "failures": [], "error": null}`. **`generated: 0` is the SUCCESS case** — E2b already covered the dates. Do not read it as a failure.
- **E5.** `curl -sS https://api.miolos.app/buffer-depth | jq` ⇒ three depths 7, `shallow: false`.
- **E6.** `curl -sS https://api.miolos.app/daily/nonogram | jq 'has("reveal"), has("seed"), has("weekday")'` ⇒ `false false false`. **Plus the clause AC 1 actually names** (ISS-8): `curl -sS https://api.miolos.app/daily/nonogram | jq -r '.date'` asserted equal to São Paulo today — i.e. E2b's `min(date)` and **never** its `max(date)` — beside E2b's `select date, published_at, published_at > now() as future …` listing. Depth alone does not prove "behind the predicate helper": `bufferDepth` counts `date >= (now() at time zone 'America/Sao_Paulo')::date` (`buffer.ts:79-91`), so 7 **includes today's already-published row**, and the top-up covers `today .. today+depth−1` (`service.ts:127-131`), leaving only 6 future-dated. Without the date assertion a future-dated row being served would look identical in the pasted output. This is the only line in the whole E-series that makes AC 1's wall clause true of **production** rather than of T-DB-S6.
- **E7.** Real browser: load `https://miolos.app/nonogram`, solve it, confirm the conclusion renders **in place** with the picture, the hub tile turns `Feito`, the CTA points at the remaining pending daily, and `select * from completions where game='nonogram'` shows exactly one row with `on_time` deriving true.
- **E8.** Replay the POST with `curl` (same cookie) ⇒ 200 `recorded: false`, `completed_at` unchanged.
- **E9.** Offline drill: load `/nonogram`, kill the network, finish, confirm the conclusion renders in place **with the picture** and the pending line, restore, confirm the row appears without a reload.
- **E10.** The preflight (200 **AND** the marker grep) for both new paths against the **preview**, then `impeccable detect` over all seven URLs at 1440×900 and 390×844. **Preview, not production:** `.impeccable/config.json` scopes its wildcards to `http://localhost:*` and `https://miolos-*.vercel.app/**`, and `https://miolos.app/**` matches neither, so a production scan comes back red for reasons already dismissed in PR #40. Widening to a third host is explicitly **not** the fix.
- **E11.** The `Impeccable` job link for the PR's **final preview deployment** — **not for the merge commit, which structurally cannot have one** (DES-3). `impeccable.yml:14-16` gates on `github.event.deployment_status.state == 'success' && github.event.deployment.environment == 'Preview – miolos-web'`, and its own comment at `:11-13` says Production deployments are filtered out; a merge to `main` produces a *Production* deployment, so no run exists for it. (Plan 018 §21 carries the same wording, so this is an inherited defect corrected here, not a new one; #25 does not retro-edit 018's snapshot.) AC 2's post-merge evidence is therefore E10's manual preview scan plus this last green preview run, and §25's AC-2 row says so.
- **E12.** The browser observations §19.2 requires, at 320, 390, 1100 and 1440 px, plus one screen-reader pass — **with the size-class coverage stated honestly** (DES-4). The board's size is a function of the weekday, so `impeccable detect` and every pass against the real app see **exactly one** of the four size classes: whichever the scan day produces. **That size is named in the PR.** The other three, and every §26 item that is size-15-specific (a 2 px inset outline on a 14.20 px cell, the CSS × at that size, the hairline's rendered contrast, adjacent two-digit clues, 32 px cells at 1440), are covered by a **static geometry harness**: §11.2's DOM emitted into a `file://` page with §12.4/§12.5/§12.6/§12.6b's CSS inlined, loaded in the repo's own puppeteer (25.4.0 / Chrome 151) at all four widths for **all four size classes**, reporting the resolved gutter track, the resolved cell, `document.documentElement.scrollWidth` and the maximum clue-span overflow out of its own column track. The harness is known to work — it is what produced §26's re-measured figures — and needs no product code, no database and no future-dated row. It is a **geometry** check and is labelled as one; it never substitutes for detect, and A1–A14 remain the mechanical gate. There is no way to make the app render a second size class on one day, and the plan says so rather than implying the scan covered four.
- **E12b.** ADR-0034's frame count, measured at **build step 7** and pasted (ADH-9/CLI-6): load `/nonogram` locally, solve it, and report the `performance.now()` delta (or `requestAnimationFrame` count) between the commit that sets `status: "solved"` and the play view's unmount. **If it is ≥200 ms, the in-place half becomes live and ADR-0034 is amended in the same PR.** The ADR marks the number PENDING until this line exists, so the branch cannot ship a document its own measurement disproved.
- **E13.** Confirm the four **E0** issues are open and that the PR body's links resolve; file any additional follow-up the step-6/7 rounds produced.
- **E14.** Close #25 quoting E0–E12b against the three ACs.

---

## 22. Build order

**These numbers are BUILD STEPS, and every row names the commit it lands in** (TR-7 — an earlier preamble numbered commits while the table numbered steps, and the two contradicted each other on rows 3–6). Dependencies, stated against the rows below and nothing else:

- **Steps 2 and 3 are sequential** — 3 consumes 2's exports.
- **Step 1b is independent of steps 2–5** and can run at any point before **step 6**, which is the first and only row that depends on it (the table's row 6 reads "1b, 4, 5"); it is placed early only because a shared hook is cheapest to move while no third consumer exists. Its table entry reads `Depends on: 1` for the **ADRs-first convention row 1 states in its own cell** — every decision is written down before anything hard-codes it, and the extraction fires ADR-0029 (c) — not because any line of the move needs code from step 1.
- **Step 5 is a soft ordering, not a hard one** — the message bundle's keys are *named by* §10's vocabulary, so it can be written in parallel with step 4 and only has to land before step 6.
- **Build step 9's last item — the impeccable workflow commit (commit 11) — is gated on E2b**, which is in turn gated on the flow's step-7 fix round freezing `nonogramDailyContentSchema` (§21.4). Nothing about that ordering is negotiable; it is the one sequencing mistake PR #60 already made.

| # | Step | Files | Commit | Depends on | TDD |
|---|---|---|---|---|---|
| 0 | The plan, the two `docs/README.md` rows, `docs/agents/test-ids.md`, CLAUDE.md's `### Test ids` pointer, `CONTEXT.md`'s seven rows | `docs/`, `CLAUDE.md`, `CONTEXT.md` | **1** | — | — |
| 1 | **ADRs 0032–0037** — written first, because everything below hard-codes the decisions they carry — **plus ADR-0036's amendment** to `DESIGN.md:28` and `packages/ui/tokens.css:27,58` | `docs/adr`, `DESIGN.md`, `packages/ui/tokens.css` | **2** | 0 | — |
| 1b | **The pointer-stroke extraction** — move + rename only, then `onStrokeEnd` | web (`src/play`, `src/binairo`) | **5, 6** | 1 | **regression-first** — T-WEB-S46 is the gate |
| 2 | `packages/core` daily contracts + `testing.ts` + barrel; `packages/db` prose + fixtures + wall tests; **§7.8's two commit-3 rows** (`daily.ts:121`, `testing.ts:9-12`) | core, db | **3** | 1 | **yes** — T-CORE-S8…S12, T-DB-S6…S9 first |
| 3 | `packages/core` completion + cron contracts; `apps/api` top-up, cron, buffer-depth, judge, `daily/nonogram`, and **§7.8's five commit-4 rows** — `cron/publish/route.ts:52-59` and `:100-106`, `cron.ts:33-36`/`:55-57`, `completion.ts:44-45`, and `cron-publish.test.ts:96-107`'s two-game timeout arithmetic | core, api | **4** | 2 | **yes** — T-CORE-S13/S14, T-API-S17…S26 first |
| 4 | Nonogram logic: `engine.ts`, `state.ts`, `use-nonogram-play.ts`, the record member, the sync arm | web (`src/nonogram`, `src/play`) | **7** | 2 | **yes, strictly** — pure functions; T-WEB-S35…S41 first |
| 5 | i18n: the message bundle, `routeSlugs`/`routes` (**not** `playRoutes`) | web (`src/i18n`) | **8** | 4 (soft) | mechanical |
| 6 | Screens: `board.tsx`, `controls.tsx`, `play-view.tsx`, `nonogram-screen.tsx`, the CSS module, both route shells. **`rm -rf apps/web/.next` before committing** — N24 | web | **8** | 1b, 4, 5 | smoke tests after (T-WEB-S42…S49, S53, S54, S56) — UI composition is not TDD-shaped |
| 7 | The reveal: `ConclusionPicture`, the conclusion's prop + CSS, `nonogram-conclusion.tsx`. **E12b is measured here** — the screen exists, and ADR-0034's frame count is PENDING until it is (§13.1) | web (`src/play`, `src/nonogram`) | **9** | 6 | **yes** — T-WEB-S50…S52 first |
| 8 | Activation: `playRoutes.nonogram` + **the three** shipped tests it breaks | web (`src/i18n`, `test/`) | **10** | 6 **and** 7 | yes — T-WEB-S55 |
| 9 | The full gate, both detect modes, the bundle measurement, the deliberate-violation lint run; then the step-7 fixes; **then E2b's seeding**; **then** the impeccable workflow commit | — | **11**, last | 8, and E2b | — |

---

## 23. New ADRs (declared here, written at build step 1)

**Six, numbered 0032–0037, contiguous.** `docs/adr/` holds `0001`…`0031` contiguously, so 0032 is next free. `docs/README.md` lists `adr/` as a directory, so **no README row is owed for these** — only this plan's own, plus the living-doc row (§21.1).

Numbers are assigned in decision order. **If step 3 or 4 drops one, the survivors renumber downward to keep the sequence contiguous** — no reserved-but-unwritten numbers, matching the directory's current state.

Two of the six papers produced what was the *same decision seen from two sides* — the state paper's "a Nonogram is finished when the picture is painted" and the server paper's "a completion is judged on the filled set" — and they are **merged into ADR-0032** rather than shipped as two ADRs that would have to agree forever (§6.5).

| # | Title | Decision statement (one sentence each) |
|---|---|---|
| **0032** | **A Nonogram is finished when the picture is painted; crosses are notation and never cross the wire** | A Nonogram is complete when the set of filled cells equals the picture's filled set — crossing is optional, so a player who crossed every empty cell and one who crossed none are both finished and post **byte-identical** bodies; the client encodes cells `1` = filled, `0` = crossed, `null` = undecided, forced by `grid-hint.ts:64`'s contradiction test (any other encoding makes every correctly-crossed cell a contradiction); the wire carries a two-valued row-major bitmap of length `size²` where `0` means *crossed or untouched, indistinguishably*, so the server never sees a three-state board and has no leniency rule to get wrong; the route checks `body.grid.length === solution.length` explicitly because the schema cannot; the progress readout counts **filled** cells against a denominator summed from the clues, deciding against handoff 019:164 on the measurement that a fill-only solver would otherwise read 21 % at the instant they win; and the free hint is `nextHint` composed twice so its fill branch always lands on a picture cell, because the unmodified branch returns a cross **239 times in 280 on a fresh board — measured over seeds `(s * 2654435761) >>> 0` for `s ∈ 1..40` crossed with all seven weekdays**, the same population T-WEB-S38 pins, so the figure in this ADR is reproducible rather than recalled. **Explicitly, per ADR-0027:125-131, none of this is a confidentiality argument** — the picture is recoverable from the published clues by construction. Binds #28 and the native clients. |
| **0033** | **The Nonogram reveal ships no name; the picture is its own payoff** | The daily Nonogram's public projection is `{game, date, size, clues}` and nothing else — `reveal.motifId`, `reveal.name` and `reveal.mirrored` never reach the client in v1, not in the daily payload, not in the completion response, and not by shipping the motif library into the bundle; this is a **product** decision, not a security one, because the picture's *shape* is client-derivable in ≤0.34 ms (measured, 280 dailies, 0 mismatches) and ADR-0027 forecloses arguing otherwise, while what the strip preserves is the curated **name** — genuinely not derivable from the clues — and casual inspection of the rest, which ADR-0027:127 names as a legitimate function of the strip; `FORBIDDEN_DAILY_KEYS` gains `motifId`, `name` and `mirrored` as the mechanical proof, and no future daily payload may carry a field named `name` without amending that list with a written reason. **Consequence recorded in the terms the tests actually enforce, not the terms the argument uses** (§7.7): two of the eight consumers run `expect(markup).not.toContain(forbidden)` over `renderToStaticMarkup` output as well as the key scan, so `"name"` is simultaneously a key ban on every daily payload **and a substring ban on every scanned play page's rendered markup** — a future `<meta name>`, `<input name>` or lowercase `name*` CSS-module local reds those suites for a reason unrelated to a leak, and the author who meets it should find that written down here rather than deduce it. **Accepted cost, stated rather than hidden:** a screen-reader user gets a *described* figure, not a named one; a named reveal, if ever wanted, is an authenticated post-completion server read — the same shape ADR-0027 already specifies for granted hints — and is filed, not built. **Rejected with reasons:** the name in the daily payload (ADR-0027's own Rejected list already refused shipping a derivable-anyway value there, and the name is a *stronger* case because it is not derivable at all); the name on the completion response (it widens the object its TSDoc calls "the last place a solution could leak", breaks the offline finish, does not survive a reload, and is **structurally broken on the replay path**, which returns before the wall read by ADR-0026's design); and shipping the motif tables to derive it locally (+5 036 B gzip measured, a widened barrel exporting the content library, new reverse-lookup engine surface, and the loss of the only bundle tripwire this route has). |
| **0034** | **The completion celebration's authoritative placement is the conclusion, never the play board** | A game's **completion celebration** — the authoritative, scannable, reload-surviving payoff — renders inside `<ConclusionView/>`, never as an animation on the play board, and the decision leads with the argument that needs no measurement: holding the play view open on a timer would fork the one screen shape ADR-0028:131 pins for *every* game ("a copy of this shape, not a new decision") and would fight the invariant `sudoku-screen.tsx:45-50` records in its own shipped comment — "the clock is frozen one commit after the grid closes, and swapping early would stamp a time the pause is about to correct" — which #23's review paid for. Per-entry **paint feedback on the board's cells is permitted and is explicitly not the reveal** (§13.1, §12.8's board transition). **Consequence, marked PENDING until E12b:** the mechanism predicts the solved board is painted for approximately **one frame** — `usePlayLifecycle:206-212` freezes the clock in a *passive* effect ("an entry action carries no `now`"), which React flushes after paint, and the swap is gated on `status !== "playing" && timer.runningSince === null` — so a 250 ms board transition would be interrupted at ~16 ms. That is a React **scheduling** claim derived from shipped code, not a measured number; jsdom cannot produce it, it is measured in a real browser at build step 7 (E12b), and if the board turns out to persist ≥200 ms this ADR is **amended in the same PR** to add the in-place half, which is additive to this decision rather than a reversal of it. `ConclusionView` may carry per-game payloads as **optional plain-data props** (`ConclusionPicture {size, cells, label}` is the first) subject to two rules — plain data only, no functions and no nodes, because a function crossing the RSC boundary is an HTTP 500 nothing but `route-ssr.test.tsx` can see; and **the prop may only be supplied by a client component that owns the local play record**, never by a server segment, because `/<jogo>/concluido` renders for players who have *not* solved and putting a derived solution into that RSC payload would turn the bookmarkable conclusion into a spoiler channel. **Recorded so AC 2 is not over-claimed:** neither the solved play board nor the populated conclusion is URL-scannable by `impeccable detect`, which launches a clean profile and therefore always sees the *playing* board and the *unfinished* conclusion; a celebration's design compliance is proved by a file-mode detect run, jsdom smoke tests and `css-source.ts` assertions on the keyframe name, easing and reduced-motion branch — never by the URL scan. |
| **0035** | **The Nonogram board is a ruled continuous field, not a grid of separated cells** | A board whose size changes daily cannot honour `DESIGN.md:50`'s 4 px/3 px gap, 5 px cell radius and 52 px desktop cell, so the Nonogram board ships at `gap: 0` with ordinary rules as 1 px per-cell borders in `color-mix(in srgb, var(--ink) 50%, transparent)` (**3.16:1** over desk paper, clearing WCAG 1.4.11's 3:1, where `--line` would be 1.37:1) and the frame and every-5-cells group rules as 2 px `var(--ink)` on the same borders (**15.01:1** on paper, **3.48:1** on a filled cell, so it survives the picture) — **never a wrapper element**, which is *card dentro de card* verbatim; the clue gutters are `max-content` tracks inside the same flat grid, so a future motif with more runs shrinks the cells rather than overflowing the phone; four explicit size classes carry literal templates (52/52/48/32 px fixed above 768 px, `minmax(0,1fr)` + `aspect-ratio: 1` below); and the shared 1140 px fold **holds** at 559.05 px against 579 px. The decisive arithmetic, recorded so it is never re-litigated: at 320 px a 15×15 board gives a **14.20 px** cell at `gap: 0` against a **13.203 px** two-digit column-clue floor, and **12.33 px at `gap: 2`** — a gapped board reproduces a defect the repo has already paid to fix. **Touch targets are traded away consciously and the trade is recorded HERE, in the document #28 inherits, rather than only in a code comment** (ADH-10): the board's cells fall below `PRODUCT.md:39`/`DESIGN.md:40`'s 44 px at sizes 10 and 15 (`10 × 44 = 440` and `15 × 44 = 660` both exceed the 328 px reference-phone card inner *before* any gap, border or gutter) and below WCAG 2.5.8's softer 24 px floor at size 15 at **both** scanned viewports (18.86 px at 390, 14.20 px at 320); WCAG 2.5.7/2.5.8's essential-presentation exception applies because **the grid is the content**, and the 44 px rule is honoured where it governs — the chrome controls, 60 px tall and 88 px wide at 320 px. Sudoku recorded the same trade one rung up, but only in `sudoku-board.module.css:408,:413`, and no ADR in the repo mentions 44 px or 2.5.8 at all; a code comment in one game's stylesheet is not an inheritable record. Inherited by #28 and by the native clients. |
| **0036** | **Numerals that must align in a column use Instrument Sans; Fraunces has no tabular figures** | Measured in Chrome 151 against the exact woff2 `next/font` ships, with a positive control: **no OpenType feature tag responds on Fraunces at all** (`tnum`, `onum`, `smcp`, `ss01` are all no-ops) while its `wght` and `opsz` axes are live, so `font-variant-numeric: tabular-nums` on `var(--font-display)` is a **no-op** and its digits keep a 2.19–2.28 px spread at 11 px, whereas Instrument Sans with `tabular-nums` collapses every digit to 6.609375 px; therefore **numerals that must align in a column use `var(--font-ui)` with `tabular-nums`, and `var(--font-display)` numerals are for single-glyph or non-aligning use**, and **three comment lines are amended** to say so instead of stating a rule the chosen display face cannot satisfy — `DESIGN.md:28`, `packages/ui/tokens.css:58`'s standing rule and `tokens.css:27`'s trailing `/* + tabular-nums */` on `--text-numeral-lg`, a Fraunces token paired with a feature this ADR measures as a total no-op (§3, commit 2; no token **value** moves). **This has a live defect behind it and #25 does not fix it:** `.timerCard` (Fraunces 30 px) and `.timerBar` (20 px) render the running clock with a ≈6.1 px swing per digit at 30 px, so it physically shifts on every tick; filed as its own issue. Binds every future timer, statistic, histogram and grid. |
| **0037** | **The Nonogram board is a three-state brush board: sticky modes, drag strokes on a shared pointer hook, and clue rails inside the composite widget** | The board inherits ADR-0030's composite-widget model unchanged and adds what this board actually forces: (1) a **sticky three-way brush** — preencher / marcar / apagar as `aria-pressed` toggles, exactly one pressed, no cycle mode — because a stroke carries no value of its own (unlike Sudoku's keypad, where the command *is* the value) and a cycle default would ship the primary gesture dead; (2) the board **drags**, firing ADR-0029 consequence (c)'s written trigger and moving the pointer-stroke machinery verbatim into `play/use-pointer-stroke.ts`, with a new optional `onStrokeEnd` as the focus door pointer capture leaves open — the browser retargets the trailing `click` to the container, so a cell's own focus fix never runs during a stroke; (3) the **clue rails are labelled `role="group"` elements inside the flat grid**, each cell `aria-describedby` its two rails, because a role-less `<div>` carrying only `aria-label` is not reliably exposed and subtree text would concatenate `2 2 2 2 3` into `"22223"`; (4) the key table extends ADR-0030 decision 3 with `1`/`2`/`0` and **`PageUp`/`PageDown`** (permitted — the ADR contains no prohibition, and consequence (a) says a new game owes its own table); and (5) there is **no per-cell violation state and therefore no error colour**, because the only cheap per-cell check is against the solution and rendering it is a per-cell oracle — which also retires the `--accent-app` 1.40:1 collision by making it unreachable. Inherited by #28's free play. |

### 23.1 Decisions explicitly ruled NOT ADR-sized, each with its reason

Silence here would read as an oversight, so each is stated:

- **ADR-0027's transfer to Nonogram** — plan 018 S9 is the precedent for recording a transfer: quote the condition, paste measured numbers (§15.1). Condition (a) is proved *more strongly* than for Sudoku, as a binary mechanical gate over 265 variants.
- **The pointer-stroke extraction (D8) — no ADR *of its own*, which is not the same as "no ADR"** (ADH-11). ADR-0029 consequence (c) *already sanctions it by name*, so firing a written conditional is not a new decision. But the **`onStrokeEnd` seam is a genuinely new interface**, and it is recorded as **ADR-0037 decision (2)** — which is the document #28 and §5.4's filed retrofit issue are pointed at, and the reason §5.4's criterion 6 names it. Also in the hook's TSDoc citing ADR-0029 (b) and (c), and in the PR. An earlier draft said the extraction "is recorded here … and in the PR" with no mention of an ADR, which would leave a later reader of this list unaware that ADR-0037 owns the seam.
- **The Binairo retrofit (D7)** — the artefact is a GitHub issue (§5.4), not an ADR. ADR-0030 (b) already says the retrofit is owed.
- **D3 (the record's `size`), D5 (`/daily/nonogram`), D10 (the retry budget), D12 (test ids)** — each sits inside an extension point ADR-0024, ADR-0026 or ADR-0029 already owns, and each is argued in the TSDoc of the file that implements it. Plan 018 recorded S3, S6–S8, S10–S19 and S21–S25 that way.
- **`FORBIDDEN_DAILY_KEYS` gaining three keys** — plan-level; #23 added `clueCount` with no ADR. But `"name"` is a **generic** key, so the standing constraint it creates on every future daily payload belongs in **ADR-0033's Consequences**, not in a seventh ADR.
- **The bundle obligation (D11)** — an obligation discharged with numbers (§20), not a decision.

**The one most likely to be challenged at step 3 as scope creep is ADR-0036**, because it amends `DESIGN.md` over a defect on two shipped screens that #25 does not fix. The fallback if a reviewer cuts it: the measurement becomes a plan-level deviation (§12.9 item 4) plus the filed issue, ADR-0037 renumbers to 0036, and `DESIGN.md` is left contradicting the shipping font — which is the cost, stated.

---

## 24. Risks and landmines (carry into implementation)

### 24.1 Carried forward — the plan-018 entries that bind #25

Numbering preserved from the exploration brief §8 so cross-references keep working.

| # | Landmine |
|---|---|
| 2 | **`sync.ts` must remain exactly one module.** Module-level singletons guard a game-blind queue; two copies each POST and each settle the other's records |
| 3 | `readPlayRecord`'s game-mismatch discard must survive; the union member is added beside it |
| 4 | `cachedSnapshot` is keyed `{game, date}` — a third route rides the same key, and §13.3's wrapper deliberately reuses it rather than opening a second |
| 5 | **The tripwires bite deliberately:** `T-DB-9a…9d` and the `@miolos/db/user` tripwire come out **byte-identical**. If one needs editing, something was added to the wrong surface |
| 6 | Measured numbers are recorded, not re-derived from memory. **CI runners are ~3–4× slower** |
| 7 | Engine barrel in the client bundle — superseded in form by §20, unchanged in substance: the sanctioned fix is a tree-shakeable barrel, **never a sub-barrel and never a deep import** |
| 8 | An engine's `null`/failure return must have a **defined** branch. Two here: `solutionMarks` (§10.4) and `nextNonogramHint`'s `?? first` (§15.2) |
| 9 | **Async server components cannot be rendered by RTL.** The shell/presentational split is not optional |
| 10 | CSS Modules compile in css-loader **`pure` mode** — a bare type selector fails the build or leaks globally |
| 11 | **`display: contents` cannot move a node across subtrees** — also why `role="grid"` is unavailable (§11.1) |
| 12 | The two impeccable structural traps: `h1.previousElementSibling === null` in every view, and no keyframe name matching `/bounce\|elastic\|wobble\|jiggle\|spring/i`. **AC 2 makes this acute** — a picture-reveal animation is exactly where a `bounce`-named keyframe gets invented |
| 13 | **`impeccable detect` passes green on the WRONG screen when a route is reachable but empty.** Both new routes go in the preflight *and* both detect invocations, and the buffer is seeded first |
| 14 | impeccable is a policy gate but a red detect blocks the merge. New by-design findings get a **value-level** entry with a written reason, **never a new wildcard host** |
| 15 | `turbo` runs in `envMode: strict`; anything new goes in `tasks.build.env`. Nothing new is needed here |
| 17 | **A missing `docs/README.md` row has been a blocking review finding six times.** #25 owes **two, in two different tables** |
| 18 | Do not ship the `.dc.html` frames or `support.js` |
| 19 | The 1140 px fold changes rendering between 1041 and 1140 px — **outside both scanned viewports, so CI will not catch a mistake here.** Check by hand at 1100 px once |
| 20 | **#58** — do not implement a grace, do not widen `ACCEPTED_DAYS_BACK`. **#59** — the only duty is negative |
| 21 | **`state.now` must never enter `persistDeps`.** T-WEB-S39 pins it on the real hook, which Sudoku has no test for |
| 22 | **`countFilled` and the `0`/`null` split** — mutates for Nonogram into P14: the shared helper is **not reused at all**, and `progress.ts` gains a comment saying why |
| 23 | **`CRON_SECRET` is Production-only on `miolos-api`** — re-verified 2026-08-01. A preview `/cron/publish` returns 401 |
| 24 | **CSS Modules hash per file** — per-game values are custom properties on the same element; the reveal's CSS goes in the **shared conclusion module**, not the game's, and its reduced-motion counterpart extends the existing block in place |
| 25 | **Vitest's default per-test timeout is 5 000 ms.** Nonogram is cheap enough not to need one; do not copy a timeout constant that has no reason to exist here |

### 24.2 Carried forward — the brief's N-series that bind

N1 (no `default:` in `stripDailyContent`), N2 (`game` key in nonogram content), N3/N4 (`validateNonogram`'s arity and self-reference), N5 (positional generator args), N6 (the false TSDoc), N7 (the length hole), N8 (the boolean flatten), N9 (the encoding), N10 (the fill-branch cross), N11 (no size cross-check on read), N12 (`--board-mobile-max` has no fallback), N13 (`--accent-app` at 1.40:1 — **retired** by §10.3's no-violation-state decision, and the PR says so), N14 (the 11 px accent kicker at 4.32:1 — a real AA failure CI cannot see), N16 (Binairo's role-less labelled div — the defect class T-WEB-S43d closes for the new board), N17/G7 (ADR-0030's unasserted CSS claim — closed by T-WEB-S49), N18/C10 (ADR-0021 says nothing about spoilers), N19 (motif names are not unique — key on `motifId`, which is moot under ADR-0033 since neither ships), N20 (no difficulty field), N21 (activating `playRoutes` changes two shipped screens), N22 (52 px is unreachable at 15×15), N23 (largest client payload; minification defeats identifier greps).

### 24.3 New landmines this plan adds

| # | Landmine | Evidence |
|---|---|---|
| **N24** | **`apps/web/next-env.d.ts:3` hard-imports the gitignored `./.next/types/routes.d.ts`.** With `.next` **absent**, `pnpm typecheck` passes and typed routes give **no** signal; with `.next` **stale**, `AppRoutes` is a frozen literal union that does not contain `"/nonogram"`, so the commit that adds the route keys fails pre-commit for a reason unrelated to its diff — **and CI cannot reproduce it**, because a clean checkout has no `.next`. `rm -rf apps/web/.next` before commit 8 **and as the first line of every §21.3 gate pass and every step-7 re-run** (TR-13): §21.3 runs `typecheck` *before* `build`, and neither turbo's `typecheck` nor its `test` task regenerates the file — only `next build` does. **A plan-verification build re-arms it, and one already has:** `.next/types/routes.d.ts` currently holds the five-route union, on disk, before step 5 begins. Typed routes are a **local-only** gate | measured; `next-env.d.ts:3`, `.gitignore:19`, `apps/web/.next/types/routes.d.ts` read today |
| **N25** | **Turbopack builds print no `Size`/`First Load JS` column**, so plan 017/018's and ADR-0027's mandated measurement is not obtainable as worded. §20's manifest-derived script replaces it | measured against Next 16.2.12 |
| **N26** | **esbuild escapes non-ASCII by default; Next/Turbopack does not.** A grep for an accented motif name returns 0 against an esbuild bundle *even when the table is in it*. Negatives are accent-free; the positive control is accented | measured, both bundlers |
| **N27** | **`NONOGRAM_WEEKDAY_CRITERIA` is a bundle trap.** It is on the barrel but lives in `difficulty.ts`, which imports `MOTIFS, motifBitmap` at module scope — one client-side import retains all 59 233 B of tables. The client takes `size` from the wire, never from the criteria table. This is the single line that would fail §20 | `difficulty.ts:4`, `index.ts:5` |
| **N28** | **A cycle brush mode kills the drag.** `binairo/state.ts:100-104` ignores `paint-over` entirely in cycle mode, so a cycle default would ship this board's primary gesture dead | §6.1 |
| **N29** | **The plain `nextHint` fill branch returns a cross 239/280 times on a fresh Nonogram board.** The two-pass composition is required, not an optimisation. **The population is part of the claim**: seeds `(s * 2654435761) >>> 0` for `s ∈ 1..40` × 7 weekdays — a different seed set returns 237, so a bare "239" is not reproducible | measured, §15.2's harness |
| **N30** | **`apps/api/test/daily-sudoku.test.ts` uses the id `T-API-S6` twice** (`:75` and `:139`). Do not copy that into the nonogram route test | direct read |
| **N31** | **`completion-contract.test.ts:118-123`'s "rejects `game: nonogram`" becomes ACTIVELY FALSE**, not merely stale: a 64-cell 0/1 body is a legal 8×8 nonogram submission once the member lands. Retarget at `termo` and rewrite the rationale | §7.5 |
| **N32** | **Killed rows count as covered by `listBufferedDates`** (`buffer.ts:30-45`). Setting `killed_at` on E2b's seeded rows would leave those dates permanently uncovered. The only correct recovery is a hard delete of unpublished rows, then a re-run | §21.4 |
| **N33** | **Fraunces has no tabular figures**, and `.timerCard`/`.timerBar` shift ≈6.1 px per digit at 30 px today. **#25 does not fix it** — an unrelated visible change to two shipped screens inside this diff is scope creep. File it | §12.1 |
| **N34** | **`.pageNonogram` must declare all four custom properties on the same element as `.page`.** Three rotations have fallbacks; **`--board-mobile-max` does not**, and omitting it deletes the ≤768 px cap in silence. A2 pins it | `screen.module.css:409` |
| **N35** | **`play-record.ts` gains its FIRST refined member, legal only under zod 4.** A zod major downgrade breaks the module at construction time, not at parse time. Re-run the two-line probe before any zod bump | measured, zod 4.4.3 |

### 24.4 What will force a step-3 rejection or a step-6 loop — grounded in what #18 and #23 actually did

#18 took **three** corrective rounds and its second was literally titled *"fix: close the regressions the first fix round introduced"*. #23 took three too and was **rejected at step 3 by all five lenses with 48 findings, 9 blocking**. **Assume 40–50 step-3 findings and two to three step-6 rounds; plan the calendar around that, not around one clean pass.**

| # | Risk | Why it is likely | Pre-emption |
|---|---|---|---|
| R1 | **"AC 2 has no obtainable evidence."** #23's I1 verbatim — and #25 is *worse*, because the reviewer's instinctive fix (hit the preview's `/cron/publish`) **does not work** | the identical finding fired on the identical shape one ticket ago | §21.4 carries E2b, the workflow diff **and** the sentence that the 401 mechanism was re-checked with `vercel env ls` |
| R2 | **"The reveal is unspecified across the RSC boundary."** `ConclusionCopy` is plain-data-only, and #23 shipped exactly this bug in exactly this file (`fix: keep functions off the RSC boundary in the conclusion copy`) | it already happened once, here | ADR-0034 decides it before implementation; §13.2's type is plain data; T-WEB-S56 lands both route entries in commit 9 |
| R3 | **The encoding is decided implicitly and the hint is silently wrong** | forced by a shared module nobody will re-read, and the failure is a wrong hint, not a crash | P11 states it as a **derived constraint** citing `grid-hint.ts:64-71`; T-WEB-S38's first case is the tripwire |
| R4 | **A fix introduces a regression.** The candidates are `persistDeps` and the two clobber guards | both are guards whose whole purpose is invisible when working | any step-7 fix touching `apps/web/src/play/**` re-runs the **full** suite `--force` and pastes it — never a single file |
| R5 | **A missing `docs/README.md` row** | six blocking findings historically, and #25 owes two in two tables | commit 1 |
| R6 | **`.next` staleness burns an hour at commit 8** with an error unrelated to the diff, which CI cannot reproduce | undocumented anywhere; measured today | N24, and the `rm -rf` is written into the commit table |
| R7 | **The 1140 px fold and the 320 px floor are unreachable by CI.** Both scanned viewports miss the 1041–1140 band entirely, and detect never visits 320 px | an arithmetic mistake in a variable-size board is invisible to every automated gate | every geometry claim lands as an A1–A14 assertion or it is unenforced; plus manual checks at 320, 1100 and 1440 (E12) |
| R8 | **Scope explosion via D7/D8** | handoff 019 calls the retrofit "cheap"; the explorer refuted it with code | D7 is **filed** (§5.4); D8 lands as move + rename in its own commit with the Binairo suite green |
| R9 | **`packages/games/src` is touched** — reaching for `solveLine`, or widening the barrel for `MOTIFS` | `solveLine`'s own TSDoc advertises it as "for … future hint machinery" but it is **not on the barrel** | §3 states the ticket adds nothing to `src`; `solveNonogram(clues)` recovers the full bitmap and is on the barrel |
| R10 | **A reviewer proposes counting only *correct* filled cells** to stop the readout overshooting | it is the obvious "fix" for "50 de 47" | P13 and `countFilledCells`'s TSDoc both name it as **forbidden — a per-cell solution oracle** |

---

## 25. Exit criteria — each AC mapped to machine-checkable evidence

Nothing here is satisfiable by an agent's assertion. Every line is a command whose output goes in the PR (CLAUDE.md's evidence rule).

### AC 1 — "Production buffer holds validated future-dated Nonogram dailies behind the predicate helper"

| Evidence | Gate |
|---|---|
| T-CORE-S8…S12 — the projection, its key set, the leak scan, the content schema's eight negative controls **including the missing-`game` pin**, and the `FORBIDDEN_DAILY_KEYS` meaningfulness test | `pnpm test --force` |
| T-DB-S6…S9 — the wall proved for the third game: future-dated invisible, killed invisible, game-scoped reads isolated, the narrowing real at runtime. **Issue #17 AC 1: this suite may never be weakened** | `pnpm test --force` |
| §8's two `sha256sum` runs over `published.test.ts`'s `describe("surface tripwires` block — `origin/main` and the working tree — printing the **same** digest, so T-DB-9a…9e and T-DB-S5 are byte-identical | `sha256sum`, both lines pasted |
| `git diff --exit-code <commit-4> <commit-5> -- apps/web/test/binairo-state.test.ts` exits **0**, and `binairo-screen.test.tsx`'s diff for the same range is the TR-8 stub hoist and nothing else, pasted in full — the extraction's oracle, as a command (TR-9) | `git diff --exit-code` |
| T-API-S17…S20 — depth 7 from empty, every row re-validating, the **weekday/size tripwire rejecting a mocked wrong-weekday puzzle with `validateNonogram` proved green on that same puzzle** (a mock-only branch, and the row says so — TR-11), idempotence | `pnpm test --force` |
| T-API-S21, S22 — three games in the fixed order binairo → nonogram → sudoku, one log line each, fault isolation, `depths.nonogram`, and a drained nonogram buffer **alone** flipping `shallow` | `pnpm test --force` |
| T-API-S26 — `GET /daily/nonogram`: 200 with a four-key body, the leak scan, four 404 cases, `force-dynamic` | `pnpm test --force` |
| **E2** — `psql … "\d daily_puzzles"` showing the CHECK already lists `'nonogram'` ⇒ no migration | pasted |
| **E2b** — the branch-local top-up ⇒ `{generated: 7, depth: 7, failures: []}`, **before any scan** | pasted |
| **E4/E5/E6** — production cron ⇒ `nonogram: {generated: 0, depth: 7, failures: [], error: null}`; three depths 7 with `shallow: false`; the public route carrying no `reveal`/`seed`/`weekday` | pasted |
| A fresh measurement of a cold nonogram week with the statement that `vercel.json`'s `maxDuration: 60` needs no change — **~34 ms of pool build plus well under 1 ms of generation for a real cold week (§19), and ~220 ms for §9.1/P5's absolute-worst model, `30 × 8 × 8 × ~0.19 ms + ~34 ms`** (SRV-4) | pasted |

### AC 2 — "The picture-reveal moment lands within the design system's contained-celebration rules; screen passes `npx impeccable detect`"

| Evidence | Gate |
|---|---|
| **Contained celebration, mechanically** — T-WEB-S52: no keyframe name matching `/bounce\|elastic\|wobble\|jiggle\|spring/i`; the animation names only `transform`/`opacity` (so `layout-transition` cannot fire); a `prefers-reduced-motion` counterpart **in the same module**; `--ease-settle`'s 1.05 inside `[-0.1, 1.1]` | `pnpm test --force` |
| **No card inside a card** — T-WEB-S52 and A8: `.picture`, `.pictureRow`, `.grid`, `.clueRow`, `.clueCol` declare no background, border, radius or shadow, so `isCardLikeFromProps` returns false on its first guard | `pnpm test --force` |
| **`<h1>` first element child** in `PlayView`, `PlaySkeleton` and the conclusion — T-WEB-S47 | `pnpm test --force` |
| **The board never overflows 320 px** — A3, the assertion `binairo-screen.test.tsx:965-983` exists because of a shipped defect | `pnpm test --force` |
| **`--board-mobile-max` declared on `.pageNonogram`** — A2, because `screen.module.css:409` has **no fallback** | `pnpm test --force` |
| **A third rotation signature**, asserted distinct from both shipped ones read out of their own stylesheets — A11 | `pnpm test --force` |
| **The fold still holds** — A6, the only mechanical statement about a band CI never scans | `pnpm test --force` |
| **Computed contrast pasted** (CI is blind — `low-contrast` is wildcard-ignored): hairline 3.16:1, heavy rule 15.01:1 on paper and 3.48:1 on a filled cell, filled-vs-empty 4.32:1, cross mark 5.08:1, clue numerals 15.67:1, the reveal 4.51:1 on card paper, and `--accent-app` vs terracotta 1.40:1 stated as the reason no error colour exists here | pasted |
| **E2b, then the preflight, then detect** — preview `/nonogram` returns **200 AND** `grep -q 'data-play-state='`; `/nonogram/concluido` 200 AND `data-conclusion-state=`; then detect over all seven URLs at 1440×900 and 390×844, **against the preview host, not production** | pasted, both viewports |
| **The file-mode run** `pnpm exec impeccable detect apps/web/app apps/web/src` — P28's reveal evidence, since the populated conclusion is not URL-scannable | pasted |
| **E11** — the `Impeccable` job link for the PR's **final preview deployment**. No run exists for the merge commit: the workflow is `deployment_status`-gated on `Preview – miolos-web` and Production is filtered out (`impeccable.yml:14-16`), so the post-merge evidence is E10's manual preview scan plus this last green preview run (DES-3) | pasted |
| **E12** — the browser observations §19.2 requires, at 320/390/1100/1440 px, plus one screen-reader pass, plus **the name of the single size class the scan day rendered** and the static-harness output covering the other three at all four widths (DES-4) | pasted |
| **E12b** — ADR-0034's frame count, measured at build step 7; ≥200 ms amends the ADR in this PR (ADH-9) | pasted |

### AC 3 — "Completion recorded once with on-time derivation; hub, conclusion, rules blurb, hint, timer, offline sync at parity"

| Evidence | Gate |
|---|---|
| T-API-S23 — recorded once, `won`, `onTime` derived in SQL; the replay 200 `recorded: false` short-circuited **before** the date bound, the wall read and the judge | `pnpm test --force` |
| T-API-S24 — the row-major encoding pin, with a **column-major flattening rejected** and a `throw` guarding against a transpose-symmetric picture | `pnpm test --force` |
| T-API-S25 — the length hole: a 100-cell grid whose first 25 match a stored 5×5 ⇒ 422, **no row written** | `pnpm test --force` |
| T-API-S14 extended — a nonogram body against a binairo row and vice versa, both 64-cell 0/1, both 404 and never 500 | `pnpm test --force` |
| T-WEB-S35…S38 — the engine adapter's defined `null` branches, the reducer's same-state returns, `restore` rejecting a wrong-size record (N11), the encoding tripwire, and the hint landing on a picture cell | `pnpm test --force` |
| T-WEB-S39 — **`state.now` never in `persistDeps`** (ten real interval turns ⇒ zero `setItem`, with the anti-vacuity assertion), a re-painted drag cell writing nothing, the record round-trip, and a **fill-only completion** | `pnpm test --force` |
| T-WEB-S40, S41 — the third record round-trips and the union rejects a wrong size; a queue of three records posts three times, once each; the `buildBody` source tripwire **untouched** | `pnpm test --force` |
| T-WEB-S47, S51 — the conclusion swaps **in place** with `push`/`replace` asserted never called; the picture resolves from the prop offline and from the record on the route | `pnpm test --force` |
| T-WEB-S55 — the hub tile becomes a `<Link>`, and the chaining CTA re-points on **all three** shipped tests it breaks (§17's table; measured, not inferred) | `pnpm test --force` |
| T-WEB-S56 — both nonogram paths render without a function crossing the RSC boundary | `pnpm test --force` |
| T-LINT-S3 — the wall fires from `apps/web/src/nonogram/**`, and a clean file reports zero | `pnpm test --force` |
| **E7** — real browser: solve, conclusion in place with the picture, hub tile `Feito`, exactly one completions row with `on_time` true | pasted |
| **E8/E9** — the replay, and the offline drill with the picture and the pending line | pasted |
| **Standing gates** — `pnpm typecheck --force`, `pnpm lint` (plus a deliberate-violation run), `pnpm test --force`, exit codes shown | pasted |

---

## 26. What is UNVERIFIED, stated as such

An unverified claim stated as fact is the exact failure the reviewers hunt. Two of the brief's gaps were closed by measurement during step 2 and are recorded as closed; everything else below is open.

**Closed during planning:**

- **G1 — Turbopack's tree-shaking.** Closed by measurement (§20.4): unused barrel re-exports, including whole transitive modules, are eliminated from the client bundle. **Caveat:** measured on the current tree, *before* nonogram is wired. The `/nonogram` figures and greps are re-run at step 8 and are the real evidence.
- **G2 — the tabular digit advance.** Closed by browser measurement (§12.1): Instrument Sans tabular = 6.609375 px at 11 px, spread 0; **Fraunces has no tabular figures at all**. **The `data:`-URI caveat is now retired** (DES-11): the figures were re-measured against the exact file the **built** `@font-face` in `.next/static/chunks/*.css` points at (currently `apps/web/.next/static/media/f06bf9da926bae75-s.p.2874ccu1_u7jf.woff2` — a build-artifact hash, so re-derive the path from the built CSS rather than trusting the string), and every number reproduced: Instrument Sans 600 @11 px `tabular-nums` = 6.609375 px, spread 0.000000; Fraunces 400 @11 px plain min 4.953125 / max 7.140625 / spread 2.187500, and **byte-identical** with `font-variant-numeric: tabular-nums`; box width of `"15"` = 13.203125 px. Rendering §11.2's DOM with §12.4/§12.5/§12.6's CSS at 320×844 with the worst-case rails also reproduced the layout: gutter track **45.05 px**, cell **14.197 px**, `document.documentElement.scrollWidth === 320`, and **0.000 px** of clue-span overflow out of its own column track; 18.86 px at 390. So the per-size integral-gutter fallback (28 / 37 / 46 / 46 px) is retired as a **fit** contingency. **What remains open** is narrower and is item 6 below: whether the resulting optical air reads on a real device. The one thing still to check at step 8 is the *shipped* page rather than the harness — the built `.clueNumber` resolving to the same advance in the real route.

**Open — none of these may be reported as a green check:**

1. **Pointer capture and click retargeting on WebKit.** jsdom implements neither. §19.2 items 1–3.
2. **That the solved board really persists ~one frame** — a React scheduling claim, derived from shipped code but not measured. **ADR-0034 marks it PENDING and leads with the argument that does not need it** (ADR-0028:131's one shape per game, plus `sudoku-screen.tsx:45-50`'s invariant), so the decision does not rest on it. Measured at **E12b, build step 7** — the cheapest measurement in the plan, and the earliest point at which the screen exists. If a browser shows ≥200 ms the in-place half becomes live and is **added** (additive, not a rework), **and ADR-0034 is amended in the same PR**.
3. **That `aria-describedby` → `role="group"` + `aria-label` is announced** by a real screen reader. One VoiceOver or NVDA pass is run and recorded.
4. **`:focus-visible` matching**, and therefore that the caret paints at all.
5. **Every rendered geometry number**, including whether a 2 px inset outline reads on a 14.20 px cell, whether the CSS × is legible there, and whether the rendered 1 px hairline still computes above 3:1 at DPR 1 after anti-aliasing (escalation: `ink 55%` → 3.67:1, one token).
6. **Whether the ≈4.0 px of optical air between two adjacent two-digit column clues READS on a real 320 px device at DPR 2–3.** Narrowed from "whether they touch" (DES-11): **fit and document overflow are settled** — the harness renders 0.000 px of clue-span overflow out of its own column track and `scrollWidth === 320` at the worst case, and the ink-vs-advance figure (`"15"` measures 10.18 px of ink inside a 13.203 px advance) is measured, not estimated. What is left is a legibility judgement no harness makes. If they read as touching: drop the row-clue `column-gap` to 1 px (+3.3 px of cell) or `padding-inline-end` to 2 px.
7. **Whether UA `<button>` styling is fully normalised for 225 buttons.**
8. **Whether the 15-class board reads as too small at 1440 px** (32 px cells). Sanctioned fix if so: a nonogram-only `@media (min-width: 1240px)` cell step inside its own module — **never** the shared fold.
9. **The `cross` hint explain string is a defined-unreachable branch.** Proved unreachable on 280/280 boards; it ships anyway, because "unreachable" is an argument, not a type. If a future motif set makes pass 2's fallback reachable, the reachability argument was wrong and the composition becomes a dedicated selector.
10. **`solutionMarks`'s `null` branch** is likewise defined-unreachable for a published daily, by ADR-0021 decision 3's gate re-proved 280/280.
11. **Whether the Impeccable job's `timeout-minutes: 15` still covers 14 page-loads.** §21.5 asserts it does; the scan goes from 10 to 14 loads, ~40 % more wall clock per iteration, and no current job duration was measured (TR-10). **Paste the `Impeccable` job's wall-clock time at step 8** (E11's run) beside the assertion; if it is above ~9 minutes the margin is thinner than the sentence implies and the number, not the adjective, decides.
12. **Whether the four size classes render as designed at all four widths.** Only one size class exists on any given day, so the URL scan and every real-app pass see exactly one (DES-4). E12's static geometry harness covers the other three for **geometry**; nothing covers them for the rendered app, and the plan does not claim otherwise.

### 26.1 What would falsify the load-bearing decisions

| Decision | Falsifier, and the pre-agreed response |
|---|---|
| **P1/ADR-0033** — no reveal name | (a) A step-6 accessibility reviewer ruling `role="img"` with a non-naming label is a WCAG 1.1.1 failure. **Pre-agreed fix, so this is not re-litigated:** drop the `role="img"` claim — `aria-hidden` on the `<svg>` plus a visible pt-BR line stating the figure was revealed — rather than invent a name. (b) A future ticket adding an authenticated post-completion read for another reason (medals, share cards): the name then rides an existing path and D1's cost disappears. Revisit then, not before |
| **P27/ADR-0034** — the reveal in the conclusion | A browser measurement showing the solved board persists ≥200 ms → the in-place half is **added**. Or a step-6 finding that the wrapper's second `useRecordSnapshot` causes a double render → **pre-agreed fallback:** collapse the wrapper into a ~6-line `record.game === "nonogram"` branch inside `conclusion-view.tsx`, accepting the ADR-0029 cost and recording it as a deviation |
| **P22/ADR-0035** — the ruled board | `impeccable detect` at 390×844 reporting `undersized-ui-text` on a clue or `cramped-padding` on `.grid`/`.clueRow` → the rails acquired a boundary or the clue dropped below 11 px; revisit §12.7's rules, not the geometry. If a finding survives the documented escape shape, a **value-level** config entry with a written reason — never a wildcard |
| **P23/ADR-0036** — Instrument Sans numerals | A step-3 reviewer cutting the ADR as scope creep → §23.1's stated fallback |
| **P19/ADR-0037** — the board drags | A real-device pass at 390×844 where a 5-cell stroke resolves the wrong cell at either end more than occasionally → tap-only becomes defensible, ADR-0029 (c)'s trigger stays unfired, and the extraction is reverted **before merge**. Measure before the PR closes |
| **P21** — sticky brush modes | The brush proving invisible at 390 px (a player crossing while believing they are filling). The fallback is **not** commands — commands cannot arm a stroke — but a stronger active state plus a caret-adjacent brush echo |
| **P13** — the filled-only readout | Playtesting showing heavy crossers feel the meter is dead. The sanctioned alternative is then **option B** (`{decided} de {size²}`) — **never** a correctness-filtered count, which is an oracle under any framing |
| **P17** — the two-pass hint | Any board on which pass 2 returns an already-decided cell or a `correction`. Either would mean the reachability argument is wrong and the composition becomes a dedicated selector |
| **P15** — `size` + `superRefine` | Zod dropping support for a checked object as a discriminated-union option. The remedy is a `z.union` plus a manual `game` dispatch in `parseAt` — **never** a `v` bump (a discarded `pendingSync` record is a lost streak day) |
| **P5** — no run budget | A measured cron invocation where nonogram's share exceeds ~1 s, or a `maxDuration` timeout attributed to it. Re-run §9.1's measurement |
| **P30** — continue the `S` series | A step-3 reviewer producing a document that *does* state a per-plan-letter rule (none was found by grep over `docs/**`, `CLAUDE.md`, `.claude/**`), or a landed `S` id with two meanings — which would make the space defective and force `N` |

---

## 27. Review findings and dispositions (step 3 → step 4)

Six adversarial lenses raised **64** findings against the step-2 draft. An independent refutation pass then attacked each one: **52 survived** and **12 were refuted**. Every one of the 64 is dispositioned below — CLAUDE.md forbids dismissal by silence, and a refuted finding needs a *louder* record than a fixed one, because the next reader's instinct will be to re-raise it.

**Method, stated because it changed several outcomes.** Load-bearing claims were re-checked against the working tree before being written in, and a finding can be right about the defect and wrong about the fix. Four cases where that happened, each resolved by measurement rather than by preference:

- **CLI-9** claimed 239/280 was unreproducible because a re-derivation gave 237. Re-running the composition over the seed set the plan actually used — `(s * 2654435761) >>> 0` for `s ∈ 1..40` × 7 weekdays — returns **exactly 239**. The defect was real (no population was named) but the remedy is *naming the seeds*, not hedging the number to a range (§15.2).
- **CLI-4/SRV-6** both claimed the `.max(225)` allocation rationale is false. Measured here against the installed zod 4.4.3: `{success:false, ms:35, elementChecksRun:1000000}`. Confirmed, and the TSDoc now says what `.max(225)` actually buys (§4 P15, §14.1).
- **DES-1** proposed a one-colour `.cellHinted` ring. Computed: `--ink-2` is **1.18:1** on terracotta and `--ink` is the caret's own colour and geometry. The gap was real; the fix is a two-rule state-aware ring at 4.32:1 on both grounds (§12.6b).
- **TR-12** asked for a runnable byte-identity gate. The proposed `sed`-by-line-range form breaks the moment T-DB-S6…S9 shift the lines; the anchored `sha256sum` in §8 was written and **verified to produce matching digests** on the current tree.

### Surviving findings — fixed or dismissed

| Lens | # | Sev | Finding, in one line | Disposition |
|---|---|---|---|---|
| Client | **CLI-2** | **high** | §17's "two shipped tests break" is false — a third breaks, and the five "counts shift" citations are phantom | **Fixed**, with the real set determined by grepping and running the tree. §17 now carries a three-row table (`:203-226`, `:279-299`, `:301-318`), states that **no** `getAllByText(dayCard.missing)` count shifts and why (`DayChip` reads `DayEntry` only; `readDayState` reads records only; `playRoutes` appears nowhere in that path), and records that the whole 21-file/319-test suite was driven with only those three failing. T-WEB-S55, commit 10 and §22 step 8 all restated. The `:279-299` judgement call is **decided**: retarget to `ctaNext(Nonogram)`, because the test's own name and comment make its subject the exclusion of sudoku |
| ADR | **ADH-1** | med | ADR-0036 asserts a `DESIGN.md`/`tokens.css` amendment §3 forbids and no commit performs | **Fixed by landing the amendment**, not by cutting the claim. §3 narrows to "no token **value**", names `tokens.css:27`'s trailing comment (which the reviewer's own proposed carve-out missed) alongside `:58` and `DESIGN.md:28`, and commit 2 carries all three. Repo precedent decides it: `handoffs/001-…:10-27`'s Emendas table was added by the ADR-landing commits, so "X is amended" has always meant X was edited. §21.6 and §22 step 1 updated |
| ADR | **ADH-10** | med | ADR-0035 says nothing about the touch-target floors it trades away, and #28 inherits it | **Fixed.** ADR-0035's statement gains the clause with its arithmetic (44 px impossible at sizes 10/15; 24 px failed at size 15 at both viewports; the essential-presentation exception; 60×88 px controls where the rule governs), and §12.9 deviation 5 points at it. Sudoku recorded the same trade in a stylesheet comment only, which is not inheritable |
| ADR | **ADH-6** | med | §16.1's vocabulary ruling never lands in `CONTEXT.md`, and no step schedules it | **Fixed.** The seven rows plus the "Terms to avoid" additions land in `CONTEXT.md` in **commit 1**; §16.1 keeps the argument and cedes the source of truth. `docs/README.md:20` makes a plan a snapshot; `docs/agents/domain.md:9,:29,:31` makes `CONTEXT.md` the mandatory read |
| ADR | **ADH-7** | med | `docs/agents/test-ids.md` gets a README row but no CLAUDE.md pointer | **Fixed by deciding to ship it with the pointer.** Commit 1 adds a fourth `### Test ids` subsection to CLAUDE.md's Agent skills block — the index every session reads, carrying one subsection per `docs/agents/*` file. P30's fallback now drops **both** index entries if the doc is cut; shipping the doc without the pointer is explicitly the worst outcome |
| ADR | **ADH-8** | med | P2's `"name"` safety check covers the key scan but not the markup-substring scan it also arms | **Fixed.** §7.7 is now an eight-row table separating the two halves, adds the missing `completion-contract.test.ts:253` consumer, states the substring ban's real breadth, requires the markup half to be **run with output pasted** rather than reasoned about, and ADR-0033's Consequences records the constraint in the terms the tests enforce |
| ADR | **ADH-9** | med | ADR-0034 is committed at build step 1 asserting a frame count §26 calls its "entire basis" and lists as unverified | **Fixed by rewording the ADR and moving the measurement.** ADR-0034 now leads with ADR-0028:131's one-shape argument (which needs no measurement), marks the frame count a **PENDING** consequence, and commits to being **amended in the same PR** if the board persists ≥200 ms. New **E12b** measures it at build step 7, the first point the screen exists |
| Client | **CLI-3** | med | §10.4's recorded cost contradicts §10.6 and is unreachable under the rules of hooks | **Fixed.** The false cost is deleted and replaced with the true behaviour, traced through `use-play-lifecycle.ts:110-122` and `sync.ts:159`: the unavailable branch restores, prunes **and** flushes, which is what you want. Its origin is named (`app/sudoku/page.tsx:34-36`, where it *is* true), and hoisting the solve out of the hook is explicitly forbidden |
| Client | **CLI-4** | med | P15's `.max(225)` "bounds ALLOCATION" claim is false in the installed zod | **Fixed, after re-measuring** (`elementChecksRun: 1000000`). Struck from P15 and from §14.1's TSDoc; `.max(225)` is kept and described as the length ceiling it is, with the note that both shipped members have the identical property so nothing regresses |
| Client | **CLI-5** | med | §13.3's `?? []` contradicts the same sentence's "simply omits the prop" and ships an empty labelled `role="img"` | **Fixed as code, not as prose.** §13.3 now computes `cells` first and passes `undefined` when it is `null`, with the `conclusion-view.tsx:98-108` omission precedent cited; the unreachability argument is written out so no test is added for a forbidden state; T-WEB-S50 gains the `> 0` anti-vacuity assertion |
| Client | **CLI-6** | med | ADR-0034 asserts the one-frame claim as fact while §26 lists it unverified | **Fixed with ADH-9** — same edit, same E12b |
| Design | **DES-1** | med | The chromatic cell classes are never declared, and the only `.cellHinted` precedent destroys the fill | **Fixed with a new §12.6b**, and with a different mechanism than proposed: contrast was computed rather than assumed, so the hint ring is **two state-aware rules** (`--paper-desk` on a filled cell, `--accent` on a crossed one, both 4.32:1) instead of one colour — `--ink-2` is 1.18:1 on terracotta and `--ink` collides with the caret. `.cellFilled`, `.cellCrossed` (with the `position: relative` its pseudo-elements need), `.cellSkeleton`, the reduced-motion block and the `isCardLikeFromProps` check all land there; **A13** asserts the hint declares no background/border-color |
| Design | **DES-3** | med | E11 asks for a CI Impeccable job link a merge commit structurally cannot have | **Fixed.** E11 and §25's AC-2 row are reworded to the PR's **final preview** run, with `impeccable.yml:14-16`'s Preview-only gate quoted (line numbers re-read from the file, not carried from the review). Recorded as an inherited defect from plan 018 §21, which #25 does not retro-edit |
| Design | **DES-4** | med | Only one of four size classes renders on any day, and nothing observes the other three | **Fixed by naming a mechanism instead of a viewport list.** E12 requires the PR to name the size class the scan day rendered, and covers the other three with a static geometry harness (§11.2's DOM + the module's CSS in the repo's own puppeteer at all four widths) — labelled a geometry check, never a substitute for detect. §19.2 gains row 6b; §26 gains item 12. A local `next dev` against four hand-seeded rows was **rejected**: `daily_puzzles` is keyed `(game, date)` and the client reads today only, so there is no way to make the app render a second size class in one session |
| Design | **DES-5** | med | `--board-mobile-max` is size-blind, so the Monday card is ~62 px wider than its board | **Fixed at the card, not the grid.** `.mobileCap5 { --board-mobile-max: 310px }` is carried on the page root beside `.pageNonogram`; `.size5`'s grid `max-width`/`margin-inline` are dropped; A12 is restated against the card's resolved cap the way `binairo-screen.test.tsx:990-1000` does. 310 = 288 + 2×10 + 2×1, and at 320 px `min(310, 280)` keeps §12.3's 46.03 px cell unchanged |
| Design | **DES-6** | med | The brush controls have no desktop stylesheet and no pressed visual, so P21's own falsifier is untestable | **Fixed.** §12.8 gains the full desktop block on Binairo's shipped control vocabulary, `.controlActive` inverting fill and label with `aria-pressed` as the third carrier — the 1.5 px border is `var(--accent)` in **both** states and is deliberately not restated, so A13 asserts the inversion **by value** rather than counting a `border-color` `decl()` could only ever read as `undefined` — `.affordance`'s placement and its `display: none` ≤768 px, non-zero padding on both axes, and the press that DESIGN.md:44 asks for (a control **has** a shadow to slide toward). Contrast computed — and `--paper-card`, not Binairo's `--paper-desk`, for the inverted label: desk-on-terracotta is 4.32:1, an AA failure for a 14 px word, where Binairo's 24 px numeral is large text at a 3:1 floor. T-WEB-S44 and A13 assert it |
| Design | **DES-7** | med | The board module is said to owe a reduced-motion block while no board motion is specified | **Fixed by taking the first fork explicitly.** §12.6b declares a paint-only `background-color`/`box-shadow` transition and the module's own reduced-motion block covering `.cell` and `.control`; **A14** asserts both. The press affordance is recorded as **§12.9 deviation 6** with its argument (a shadowless cell has nothing to slide toward; a 1 px translate at `gap: 0` paints over its neighbour), and §5.2/§13.1 now describe a block written for transitions that exist |
| Issue | **ISS-6** | med | Same contradiction as ADH-1, from the scope side | **Fixed with ADH-1.** Both the "§3 vs ADR-0036" half and the "no commit carries it" half are closed; §21.6's not-touched paragraph now spells the exception rather than asserting `packages/ui` untouched |
| Issue | **ISS-7** | med | The PR body is specified to carry follow-up links E13 does not create until after the merge | **Fixed.** New **E0** files the four issues before the PR body is written — they are pure `gh` calls with no dependency on the merge — and E13 becomes a confirmation step. §5.4 and §21.6 updated so "each has a filed follow-up" is verifiable at review time |
| Issue | **ISS-8** | med | AC 1's production evidence never proves the "behind the predicate helper" clause | **Fixed.** E6 gains `jq -r '.date'` asserted equal to São Paulo today (E2b's `min(date)`, never its `max`), beside E2b's `published_at > now()` listing. The arithmetic is quoted: `bufferDepth` counts `date >= today` (`buffer.ts:79-91`) so depth 7 includes today's published row, and the top-up covers `today..today+depth−1` |
| Issue | **ISS-9** | med | "Decisions needed from Fernando: none" is asserted over five deviations plus an amendment to DESIGN.md itself | **Fixed by promoting exactly one item.** §21.6 now separates "none that block the merge" from one call Fernando may want to reverse — the ADR-0036 amendment, the only change that rewrites a rule governing all four games — with §23.1's fallback named so reversing it is a sentence. The six §12.9 deviations stay FYI: they are scoped to one screen with no reference frame |
| Risk | **TR-10** | med | §26 is incomplete and two numbers stated as fact contradict others in the plan | **Fixed, all three.** (a) §20.2's leak figure corrected from the misapplied **source** byte count to the plan's own measured **+35.2 KB minified**, with "tripling" → "doubling" and the 40 KB threshold re-justified against the measured population. (b) §19's worst-weekday timing replaced with §9.1's 0.1902 ms, re-derived here at 0.1902 — **in both places §19 states a cost**, the Timeouts paragraph and the Fixtures paragraph's two per-weekday figures (0.0354 / 0.1902, §9.1/P5's own), so the unreproducible "0.021 / 0.152 / 0.421" set is gone from the plan entirely and the timeout decision rests on one number. (c) `timeout-minutes: 15` demoted from an assertion to §26 item 11, with the job's wall clock pasted at step 8 |
| Risk | **TR-11** | med | P6's assertion is as tautological as the validator it replaces, and T-API-S19 proves a mock-only branch | **Fixed by renaming the thing rather than removing it.** P6 now calls it a **tripwire for a puzzle the loop did not generate**, states plainly that `generateNonogram` writes both fields from the criteria table the assertion reads (`generate.ts:31,:44-52`), and **drops the "ADR-0010's belt and suspenders is restored" claim** — which would have repeated, in a new place, exactly the false-TSDoc pattern P9 exists to correct. It ships anyway: cheapest gate in the loop, and the only one that fails closed for the date. T-API-S19 and §25's AC-1 row reworded to match |
| Risk | **TR-2** | med | Same as CLI-2, from the risk side: commit 10 as specified lands red at pre-commit | **Fixed with CLI-2.** This refuter's secondary request — re-audit every `writePlayRecord` site rather than asserting completeness — was **discharged** and resolves in the plan's favour: across 21 files and 319 tests only the three fail, and `hoje.smoke.test.tsx`/`day-state.test.ts` genuinely need no edit. §17 records that it was driven, not inferred |
| Risk | **TR-5** | med | `bodyOf` is first-match with leading whitespace allowed, so §12's own ordering can make A4/A5 read the mobile `.cell` | **Fixed.** §12.4 states the file-ordering rule as three parts — every base rule at top level before any media query; **two** `@media (max-width: 768px)` blocks in a fixed order (geometry, then §12.8's chrome), since `bodyOf` is first-match **and throws**, so a bare nested call would raise ``no block for `.controls` ``; and exactly **one** top-level `.cell` rule, §12.6 and §12.6b being one block in the file. §19.1 binds `MOBILE_GEOMETRY`/`MOBILE_CHROME` explicitly (slicing past the first block, with two anti-vacuity guards) and names which block every assertion reads; A5 gains the `background: var(--paper-desk)` belt and A14 a `transition !== undefined` one, so a wrong read fails loudly instead of passing for the wrong reason |
| Risk | **TR-6** | med | Three load-bearing constants are duplicated with no source of truth | **Fixed, all three.** (a) `DIGIT` carries its provenance **and its invalidation trigger**, with A9 asserting the exact family/weight/size the measurement was taken at, so a font change reds the assertion that owns the number. (b) `WORST_ROW` and B1 get an explicit **two-way citation** across the package boundary, with B1 named as the source of truth. (c) `NONOGRAM_CELL_COUNTS` is **derived** from `nonogramSizeSchema.options`, verified against zod 4.4.3 |
| Risk | **TR-7** | med | §22's preamble numbers commits while its table numbers build steps, and they contradict | **Fixed.** The preamble is rewritten against the rows it actually describes, every row gains a **Commit** column, a row 0 is added for commit 1 (which had no build step at all despite landmine 17), and the soft-vs-hard dependencies are distinguished. Steps renumbered so 1b (the extraction) is visibly independent |
| Risk | **TR-8** | med | The jsdom stroke scaffolding is unnamed and per-file, so the plan implicitly asks for a third copy | **Fixed.** §19 names all three stubs and `stubElementFromPoint`, records that `setup.ts` has none of them, and hoists them to `apps/web/test/pointer.ts` **in commit 5**, with the machinery they serve and with the Binairo suite as the oracle. It is the one named exception to T-WEB-S46's byte-identity gate, and its diff is pasted |
| Risk | **TR-9** | med | Commit 5's "every assertion unchanged in what it asserts" has no mechanical form | **Fixed.** §5.3, T-WEB-S46 and §25 all carry `git diff --exit-code <commit-4> <commit-5> -- apps/web/test/binairo-state.test.ts`, with `binairo-screen.test.tsx`'s diff permitted **only** for the TR-8 stub hoist, pasted in full, containing no line inside `:422-645` |
| Server | **SRV-1** | med | E2b's ordering contradicts the commit order, and commit 11 as sequenced reds the Impeccable job | **Fixed by moving commit 11, not by relaxing E2b.** §21.4's rule is rewritten as three statements that agree, §21.2 makes 11 the **arming commit pushed last**, and §22 step 9 matches. The refuter's empirical proof is carried in the plan (PR #60's `604975e` → Impeccable run 30710479040 = failure, with the `no data-play-state=` log line), as is its correction: `detect` is **not** a GitHub-required check (`gate` is the only one), so it blocks by project policy, not by the merge button. The missing recovery sentence — delete **and re-seed before the next push** — is added |
| Server | **SRV-2** | med | §20.2's baseline was produced by a different method than §20.2 describes | **Fixed.** The prose now names the method that produced the table (`clientModules` ∪ `rootMainFiles` ∪ `polyfillFiles`, `entryJSFiles` **excluded**) and says why, with the inflated figures the written method yields. **The proposed threshold change was not taken:** "within 2× sudoku's 26.5 KB" = 53 KB is *less* sensitive than 40 KB, which sits 11 KB above the noisiest clean route and 22 KB below a leak. 40 KB is kept, re-justified against the measured population, and the two shipped deltas ship as regression controls in the same run |
| Server | **SRV-3** | med | Six #25-naming TSDoc blocks go stale and are unbudgeted, against P9's own standard | **Fixed with a new §7.8** — a seven-row register naming the file, the false sentence and the correction, each assigned to the commit that carries the code it describes. The seventh row is `cron-publish.test.ts:96-107`'s two-game timeout arithmetic, which is a *test-file* comment and therefore the premise behind every per-`it` `30_000` in the file. §22 steps 2 and 3 name the register |
| Server | **SRV-5** | med | P2's "verified against all seven consumers" is key-level, but two assert `name` at substring level | **Fixed with ADH-8** — same eight-row table, same requirement that the markup half be run and pasted, same ADR-0033 Consequences line |
| ADR | **ADH-11** | low | §23.1 rules the extraction "not ADR-sized" while ADR-0037 records it as decision (2) | **Fixed.** The §23.1 bullet now says "no ADR **of its own**", names ADR-0037 decision (2) as the owner of the `onStrokeEnd` **seam** (a genuinely new interface, unlike the move itself), and §5.4's issue body and its criterion 6 cite the ADR by number |
| ADR | **ADH-12** | low | §16.3 ships `sizeLabel`/`size` for a stats row §11 and §12 never specify | **Fixed by keeping the row and declaring it.** §12.4 declares `.sizeCard` on Sudoku's `.levelCard` shape (`sudoku-board.module.css:372-376`), §5.2's `play-view.tsx` row places it through `screen.statRow`/`screen.statLabel`, §16.3's keys carry the citation, and T-WEB-S47 asserts it renders. Deleting the keys was the alternative and loses: §16.2's `boardSize` hoist is justified by two consumers |
| ADR | **ADH-4** | low | Same as CLI-3 | **Fixed with CLI-3.** This refuter's specific instruction is honoured: the alternative fix (hoist the predicate above the hook) is **explicitly rejected in the plan text**, not offered as a coin flip — it would forfeit the prune and the flush on that route and run `solutionMarks` twice per mount |
| Client | **CLI-7** | low | §13.4's "68–146 filled cells" is wrong and contradicts P13's own 47 | **Fixed with a re-derived measurement**: 48–143 at size 15 over 60 seeds × 7 weekdays (9–21 / 18–52 / 20–88 at sizes 5/8/10), with the note that ADR-0021's 30–65 % band is a warning-level diagnostic with a 34-outlier ratchet, not a bound. The two sections now draw on the same population |
| Client | **CLI-8** | low | Divergence 4 cites `sudoku/state.ts:160-171` for a guard neither shipped `withEntry` has | **Fixed, and made stronger.** The citation splits: `:132-140` and `:160-171` are the precedent for **same-state returns in the reducer**; putting the guard **inside `withEntry`** is new here, and the reason is stated (a drag dispatches `paint-over` per `pointermove` and the caller cannot cheaply know the current value). Verified: Sudoku's `withEntry` at `:297-314` and Binairo's at `:242-259` both allocate unconditionally |
| Client | **CLI-9** | low | The hint measurements have no reproducible harness; a re-derivation gives 237 | **Fixed by naming the population, not by hedging the number.** Re-running the plan's own composition over `(s * 2654435761) >>> 0`, `s ∈ 1..40`, × 7 weekdays returns **exactly 239** — the finding's 237 came from a different seed set. §15.2 now carries the seeds, the fixture and the pasted output; T-WEB-S38 pins the same set; ADR-0032's sentence carries the qualification |
| Design | **DES-10** | low | §13.4's `checks.mjs:4155` citation is wrong for the installed impeccable | **Fixed.** Verified against `node_modules/.pnpm/impeccable@3.4.0/…/checks.mjs`: `isCardLikeFromProps` is at `:227-230`, `isCardLike` at `:4151-4169`. The comment now cites `:227-230`, notes it is a different function from `isCardLike`, and records the version the line numbers belong to. §12.7's own `:4150-4168` is corrected to `:4151-4169` while there |
| Design | **DES-11** | low | §26 understates its own evidence; the G2 caveat and part of item 6 are closable | **Judged item by item, and both closed as argued.** The G2 `data:`-URI caveat is **retired** — the figures reproduce against the file the built `@font-face` points at, and the per-size integral-gutter fallback goes with it. Item 6 is **narrowed** from "whether they touch" (settled: 0.000 px of overflow, `scrollWidth === 320`) to whether ≈4.0 px of optical air reads at DPR 2–3. **Not closed:** the shipped page still has to be checked at step 8; the harness renders the plan's CSS, not the built route |
| Design | **DES-8** | low | P26's caret headroom is out by 2 px and the stated model does not match what `-2px` paints | **Fixed.** §11.6 now states the real paint model (the caret occupies the outer 2 px ring, leaving a **10.20 px** core at 14.20 px), drops the "2.2 px to spare" claim and its double-counting formula, and **accepts and states** the consequence the finding surfaced: while focused, the caret paints over that edge's own hairline or heavy rule. Correct — the caret is the stronger signal and it is transient |
| Design | **DES-9** | low | Same as CLI-5 | **Fixed with CLI-5** |
| Issue | **ISS-10** | low | `/daily/nonogram` is scope no AC asks for, and P30's "one piece of non-#25 scope" is now inaccurate | **Fixed by declaring it, keeping the route.** §1's In list says in one line that no AC requires it and why it is kept (E6 is AC 1's only production strip evidence short of scraping the web app), and P30 is corrected to "two pieces", so the PR's scope declaration is complete |
| Issue | **ISS-11** | low | The retrofit issue's seven acceptance criteria are described, not written | **Fixed.** §5.4 now writes all seven out verbatim, the way §21.1 writes the README rows — and for the same reason: the agent that files it does so in a fresh context. Combined with ISS-7's E0, the issue is filed from this session's context and its link is real in the PR |
| Issue | **ISS-2** | low | AC 2's "contained-celebration rules" are never quoted, and the one design citation is the wrong line | **Partially fixed — the surviving grain only.** The refuter established that this finding is **mostly wrong**: §13.5's rows 7/9/10 cannot be checks.mjs-derived (`grep -in "confetti\|takeover\|celebrat\|particle"` over `checks.mjs` returns **zero**), §13 carries a second design citation at `DESIGN.md:54-58`, and `DESIGN.md:44`'s clauses are argued substantively throughout. **Taken:** the `:39 → :44` citation swap at §13.4 (`:39` is the stamp's shape spec and carries no exclusivity rule), plus `PRODUCT.md:33` and brief `:76`'s "o traço que se completa" as the positive sanction. **Rejected:** re-titling §13.5 "the impeccable-detectable subset", which would be actively false given rows 7/9/10, and a separate clause-mapping table duplicating arguments already at `:1243`, `:1288-1291` and §25's AC-2 row |
| Risk | **TR-12** | low | §25's byte-identity exit criterion is not a runnable command | **Fixed with a different mechanism than proposed.** A `sed`-by-line-range digest breaks the moment T-DB-S6…S9 shift the lines — the finding's own premise. §8 anchors on the block's opening line (`describe("surface tripwires`) instead, and both invocations were **run here and produce matching digests**. §19 and §25 carry the same command |
| Risk | **TR-13** | low | §21.3 runs typecheck before build, re-arming N24 on every gate pass | **Fixed.** `rm -rf apps/web/.next` becomes the **first line** of §21.3's block, not only a note before commit 8, and N24 records that a plan-verification build re-arms it. Verified: `apps/web/.next/types/routes.d.ts` is on disk **right now** holding the five-route frozen union, armed for step 5 |
| Risk | **TR-14** | low | Two small slips in audits that present as exhaustive | **Fixed, both.** (a) The eighth `FORBIDDEN_DAILY_KEYS` consumer is added to §7.7's table with its safety verified. (b) §17's `HubProgress` sentence is corrected: `doneCount(useDayState(date))` is route-blind, so a concluded nonogram record already counts today and the only hub change is the card's `<a>` → `<Link>` |
| Server | **SRV-4** | low | P5's worst-run arithmetic omits `generateNonogram`'s own 8-attempt internal loop | **Fixed.** P5 and §9.1's TSDoc now carry `30 × 8 × 8 × ~0.19 ms ≈ 186 ms` + ~34 ms ≈ 220 ms, name `NONOGRAM_MAX_GENERATION_ATTEMPTS = 8` as the inner factor, and re-derive the per-weekday costs here (0.0354 → 0.1902 ms). The conclusion survives by two orders of magnitude — which is exactly why the correction was worth making rather than papering over |
| Server | **SRV-6** | low | Same as CLI-4 | **Fixed with CLI-4.** This finding's additional observation is also honoured: the genuinely untrusted surface is `nonogramCompletionRequestSchema.grid`, which has the same exposure as the shipped `.length(64)`/`.length(81)` members, so it is not a regression and the P15 rationale cannot be used to argue otherwise |
| Server | **SRV-7** | low | §8 attributes `insertRow` to `fixtures.ts`, where it does not exist | **Fixed.** Verified: `fixtures.ts` is 48 lines of content factories; `insertRow` is `published.test.ts:38-55` with the ternary at `:50-51`. §8's bullet splits in two, one per file |

**Nothing among the 52 was dismissed.** Four were fixed by a different mechanism than the reviewer proposed (DES-1's ring colour, DES-4's harness, SRV-2's threshold, TR-12's anchor), and one — ISS-2 — was fixed only in the narrow part its own refuter left standing, with the rest rejected on the evidence quoted above.

### Refuted findings — DO NOT ACT ON THESE

Recorded with the refuting evidence carried across, so a later reader does not re-raise them. **Acting on any of these would turn correct planning into incorrect planning**, which is a worse outcome than leaving a real finding unfixed.

| Lens | # | Filed as | Why it is dismissed |
|---|---|---|---|
| Client | **CLI-1** | high | *"P16's `restore` guard lets a wrong-size concluded record kill the timer, every persist and the completion write."* **The mechanism is real but PRE-EXISTING and cross-game, and #25 does not introduce it.** The refuter reproduced the identical failure on **shipped Binairo** with no P16, no size mismatch and no nonogram: `concluded: z.boolean()` (`play-record.ts:67`, `:92`) is unconstrained by `entries`, binairo's `restore` (`state.ts:272-285`) checks only `game`, and `usePlayLifecycle`'s `restoredConcluded` short-circuit (`:124-127`) then produces all three symptoms. A throwaway test against the real `useBinairoPlay` passed on the first run. The finding's reachability argument is also false: the client's `size` comes from the wire off the stored row (`contracts/daily.ts:184-190`), never from `NONOGRAM_WEEKDAY_CRITERIA`, and a date's row is immutable (`buffer.ts:60-69` `onConflictDoNothing`). Both proposed fixes damage shipped behaviour — `removeItem` would delete a record that may carry `pendingSync: true`, the one loss `prunePlayRecords:240` and the frozen `v` exist to prevent. **P16, `readPlayRecord` and T-WEB-S37 stay exactly as written.** If anyone wants the residual addressed it is its own issue against `src/play/`, covering all three games |
| Design | **DES-2** | high | *"No board skeleton is specified, so `PlaySkeleton` cannot occupy the boxes T-WEB-S47 asserts."* **The test claim is inverted and the measurement is wrong at the viewport it chose.** `occupantsIn` filters `GRID_AREA_CLASSES`, derived by regexing for `grid-area:` — and `grep -n "grid-area" apps/web/src/**/*.module.css` returns exactly five hits, all in `play/screen.module.css:62,111,157,218,273`, none in any game module. So `.grid`, `.cell` and the clue rails are **invisible** to the helper and an empty `<section className={screen.board}>` passes trivially; both shipped tests bolt on separate non-`occupantsIn` assertions precisely because of this. And "45.05 px of a 258 px card inner at 320 px, 17 %" cannot happen at 320 px: in the ≤768 band the card is viewport-driven (`screen.module.css:396-411`) and `.grid` is a block-level grid filling the 258 px box with or without rails — the real worst-case mobile delta is ~4 px of *height* and **zero** width. The repo also ships two equally valid placements for the placeholder (Sudoku exports `BoardSkeleton`; Binairo inlines it), so mandating one would pin a coin flip. **T-WEB-S47 is not rewritten.** The one desktop-only grain — a railless placeholder would be 45.05 px narrower above 769 px — is folded into §5.2's `play-view.tsx` row as a clause |
| ADR | **ADH-2** | high | *"P29 has a plan supersede an Accepted ADR without an amendment."* **The precedent is the opposite of what the finding assumes, and it was set by ADR-0027's own PR.** `git log -- docs/adr/0027-*.md` returns exactly one commit, `a166401` (PR #57) — the same PR whose body says verbatim "Next 16 with Turbopack no longer prints a First Load JS table, so the plan's literal instruction is unsatisfiable. Measured directly instead" and pastes a substitute table. No ADR amendment accompanied it. §20 does the same thing **better** (a committed reproducible script). The "standing threshold #27/#28 inherit" is not in the plan — `:1748` scopes it to one route in one PR, §1's ledger gives #28 three ADRs and no bundle rule, and `grep -n "#27"` returns one hit about test ids. And §20 supersedes an **instrument**, not a decision: ADR-0027:136-138's actual decision content (tree-shakeable barrel, never a sub-barrel, never a deep import) is preserved verbatim at landmine 7. CLAUDE.md's "surface the contradiction" duty is discharged three times (§20.1, N25, §21.6). **No ADR amendment is added.** |
| ADR | **ADH-3** | high | *"ADR-0033 rejects the completion-response option on a ground its own design refutes."* **All three sub-claims fail against the shipped client.** (a) "does not survive a reload" is **true** for the option being rejected: `acceptResponse` (`sync.ts:296-325`) copies only `elapsedMs`/`hintsUsed`, and only on the `recorded: false` branch, and `settle` (`:328-334`) writes `{...record, pendingSync, syncOutcome}` — a name on the response is discarded before any reload. The counter-claim that "the offline gap closes on the same poll tick" is also wrong: `syncOutcome === "pending"` *means* no response arrived. (b) The WCAG exposure is already decided in both branches — ADR-0033's stated cost, §26.1 falsifier (a) with a named trigger and pre-agreed remedy, the PR's FYI, and E0's filed named-reveal issue. (c) `validate.ts:120-122`'s `reveal-name-empty` is a **content-integrity** gate ADR-0021 owns over the stored library; ADR-0033 governs the wire projection only, and the name is still stored server-side as the basis of the filed read. **ADR-0033 ships as written** |
| ADR | **ADH-5** | high | *"§13.3's `?? []` supplies an empty picture where the prose says the prop is omitted."* **The JS semantics are true; the harm is unreachable by construction.** `submittedCells` nulls **only** on a length mismatch (no per-value null branch, unlike Sudoku's `allDigits`), `entries` is allocated at exactly `size²` and no reducer case resizes it, `restore` rejects any record disagreeing with today's board, and branch 3 is reached only after `isPictureComplete` iterated the full `size²` solution. The proposed T-WEB-S51 case **cannot be written against real state** and would be the vacuous-test class the plan guards against elsewhere. **No test is added for it.** Note the wording tidy the finding also wanted *was* made — but under **CLI-5/DES-9**, which reached it through the omission-vs-empty argument rather than through a claimed defect |
| Issue | **ISS-1** | high | *"ADR-0034 writes 'never' on an unverified claim and forecloses a form the founding brief sanctions."* **Four load-bearing claims fail.** brief `:76` sits under "Celebração de **conclusão**" and says nothing about a board; the brief is a superseded exploration input (`002:2-7`, `docs/README.md:36`) whose section 5 alone is binding verbatim (`PRODUCT.md:23`), and the "traço" example did not survive into `DESIGN.md:44`; the plan **does not foreclose** the in-place transition (§13.1 keeps it, §5.2 gives it a reduced-motion block, §26.1 pre-agrees adding the in-place half at ≥200 ms); and the frame claim is derived from shipped code (`use-play-lifecycle.ts:206-212`'s passive effect, `sudoku-screen.tsx:45-50`'s gate), not absent. **What the ADR's own PENDING marking and E12b address is ADH-9/CLI-6's narrower point — the wording and the ordering — not this finding's demand that the decision be weakened** |
| Issue | **ISS-3** | high | *"P28's substitute evidence is vacuous, and a static-HTML scan that would work is unused."* **Refuted on four measured grounds.** The zero-findings baseline was measured on a tree **without** the #25 diff — that is a clean regression baseline, not vacuity; impeccable's file mode implements precisely the rules AC 2 names (`bounce-easing` on the name regex and on out-of-band `cubic-bezier`, `layout-transition` on width/height/padding/margin), which fire on both CSS surfaces #25 adds. §13.5 already allocates the file-mode run one specific job ("Paint-only … file-mode detect + T-WEB-S52"). And the proposed fix **ships a silent false green**: the refuter's own probe fired `nested-cards` on matching class names and returned `[]` on a one-class hash drift — and this repo's `renderToStaticMarkup` emits **vite**-hashed CSS-module names while the stylesheet to inline is Turbopack-hashed, with `css` disabled in `vitest.config.ts` so no compiled CSS text exists to inline at all. Plan 017 §12.7 disclosed the identical residual and shipped. **P28 stands** |
| Issue | **ISS-4** | high | *"The reveal's timing argument is false and lands outside DESIGN.md's motion band."* **Conflates duration with delay.** `DESIGN.md:44` bounds the animation's **duration**; `.picture` declares `var(--duration-slow)` = 250 ms, the top of the band and the identical duration to the shipped stamp (`conclusion-view.module.css:177`). Neither `DESIGN.md:44`, brief `:74` nor `PRODUCT.md:33` says a word about delay or cumulative wall clock — under the finding's reading no staggered entrance could ever be legal and the `--duration-fast`/`--duration-slow` pair could never compose. impeccable has **no** animation-duration or animation-delay rule at all (grep returns zero). And "the single sentence arguing containment" is false: `:1243`, `:1288`, `:1286-1287` and §25's AC-2 row all argue it. The proposed remedy (`animation-delay: var(--duration-slow)`) would produce a 500 ms total — twice as far outside the band it claims to defend. **The CSS is unchanged** |
| Issue | **ISS-5** | high | *"AC 3 names six parity items and the exit criteria cover five — the timer has no line."* **Three claims false against the plan text and one against the shipped tests.** §10 **is** the timer for this screen (`:778` `applyTimerAction` verbatim, `:780`'s init, §10.5's `elapsed`, `buildRecord`'s `elapsedMs`, §10.6 branch 3's both-conditions gate, §14.1's bound). T-WEB-S47 already asserts "restores straight into the conclusion with no POST and **no timer**". Parity-by-construction is stated exactly where it should be — §5.1's not-touched list names `play/timer.ts`, `use-play-lifecycle.ts`, `screen.module.css` and `timer-readout.tsx`. And the supporting grep is a false negative: both shipped screens **do** assert the timer, through `messages.play.timerAria`, not `timerLabel`. **AC 3's timer is not unevidenced.** Two clauses from the refuter's own optional note were folded in — the `timerAria` pair in T-WEB-S47 (framed as matching the shipped precedent, explicitly *not* as closing a gap) and "a third surface" in §21.6's Fraunces FYI |
| Risk | **TR-1** | high | *"§19's Timeouts paragraph misstates the house pattern; every `it` driving a top-up needs 30 000."* **The shipped code refutes it inside one file.** `completions.test.ts`'s **16** binairo `it`s (`:229-648`) do exactly what the finding says forces 30 000 — seed via `insertDailyPuzzle`, POST the real route over PGlite, read rows back — and **not one** carries a timeout, while the sudoku block (`:711-979`) carries seven. Same file, same PGlite, same round-trips; the only variable is the generator. `daily-binairo.test.ts` carries no timeout anywhere, not even on `beforeAll`. `buffer-depth.test.ts:46-52` states the rule in prose and puts 30 000 on `beforeAll` only. The finding's own numbers refute it: T-API-S2 (no generation) is ~107–369 ms against T-API-S1/S3's 968/1 270 ms. **Proposed fix (a) would put 30 000 on new `it`s in files whose shipped siblings deliberately carry none.** §19's paragraph and landmine 25 stand. The refuter's separate, verified observation — `cron-publish.test.ts:96-107`'s two-game arithmetic comment goes stale — is real and is folded into **§7.8**, which is SRV-3's register, not this finding's remedy |
| Risk | **TR-3** | high | *"T-WEB-S56 and ADR-0034 claim an RSC guarantee `route-ssr.test.tsx` cannot give."* **Only the narrowest sub-claim survives, and the proposed fix is dangerous.** §13.2's sentence attaches its relative clause to `ConclusionCopy` — which route-ssr genuinely enforces, proved by the refuter's case A poisoning `copy` and getting `['<ConclusionView>.copy.notYet.stampAria']`. ADR-0034's rule is about the **class** of per-game payload prop on a component whose `copy` crosses from a server segment on two shipped routes. "The nonogram conclusion ships without the guard" inverts the failure model: a 500 requires a crossing, and there deliberately is none. The proposed remedy asks the plan to **add** an RSC crossing so a test has something to look at, fighting §13.3's ADR-0029 rationale. **§13.2, §5's table row, ADR-0034 and R2 are unchanged.** The one loose clause in T-WEB-S56's row is left as an optional cosmetic; it claims nothing false about behaviour |
| Risk | **TR-4** | high | *"§12.4 and §12.8 declare two `@media (max-width: 768px)` blocks, which makes A10 throw."* **The plan never specifies the formulation that fails.** `grep -n "bodyOf\|MOBILE"` returns four `bodyOf` call sites and **zero** occurrences of `MOBILE`; A10 is written as a declaration-level requirement, not as a nested call. The refuter transcribed §12.4 + §12.8 verbatim into one file and ran the shipped helper: `bodyOf(CSS, ".controls")` resolves correctly (`width "100%"`, `max-width "var(--board-mobile-max)"`, `gap "8px"`), `.control` does not collide with `.controls`, and the mobile `.size*` lookups land in the block that holds all four. **Nothing in §12's structure changes on this finding's account**, and its proposed "exactly one `@media` block per module" rule is rejected as unsupported by the helper. The residual — an implementer pattern-matching the shipped Binairo test would bind `MOBILE` once and hit a loud immediate failure — is covered by §19.1's new "which block each assertion reads" paragraph, added for **TR-5**, which happens to close this too. (A10 and A12 *were* reworded, but for TR-5's "name which block you read" rule and for **DES-5**'s card-vs-grid cap — not for anything this finding claimed) |

**Two notes on the refuted set.** **All twelve were filed at high severity**, and every one collapsed on contact with the working tree — five of them on executed evidence rather than on reading: CLI-1 and DES-2 on shipped-code reproductions, ADH-2 on `git log`, ISS-3 and TR-4 on executed probes. That is the ratio §24.4 predicts and the reason the refutation pass exists. And two of them (ADH-5 and ISS-5) asked for edits that **were** made under other findings by a different argument; the disposition above says which, so a later reader does not conclude the plan quietly acted on a refuted claim.

### Step-6 dispositions (added after the step-3 table above)

Step 6 runs its own adversarial rounds against the implementation rather than the draft, and its findings are dispositioned here on the same rule: nothing is dismissed by silence.

| Lens | # | Sev | Finding, in one line | Disposition |
|---|---|---|---|---|
| Issue | **ISS-A2** | high | `--accent-nonogram` #B5563C fails `PRODUCT.md`'s ">=4.5:1 body text" on six surfaces, measured in the repo's own Chrome against the built stylesheets and the real `next/font` woff2 files | **Split, deliberately: the FILL half is fixed here, the PAPER half goes to #68 with a written reason.** See below |

**The half fixed in this PR — `--paper-desk` sitting ON an `--accent` fill.** Four surfaces, all measured at **4.318:1** at 1440×900 and 390×844: `screen.hint` on `/nonogram`, `conclusion-view.emptyCta` on `/nonogram/concluido`, the hub's `page.cta` on the Nonogram card, and `conclusion-view.ctaNext`. The last is not a #25 screen at all and is the reason this half could not wait: `.ctaNext` wears the DESTINATION game's accent, so it renders terracotta on the **shipped** binairo and sudoku conclusions whenever the day still owes a nonogram — a genuine regression #25 causes, because before #25 `playRoutes` had no nonogram and that button never painted terracotta anywhere. One custom property carries the fix, `--ink-on-accent`, handed out with `--accent` by `src/play/accent.ts` (so it follows the accent being rendered, never the page) and read everywhere as `var(--ink-on-accent, var(--paper-desk))`. `--paper-card` on terracotta measures **4.506:1** — the identical one-token remedy `nonogram-board.module.css:461-463` already applies to `.controlActive`, whose TSDoc carries the argument. §12.9 deviation 7 records it; `apps/web/test/ink-on-accent.test.ts` (**T-WEB-S72**) is the gate, because jsdom has no layout and stylesheet text is the only mechanism that can assert a custom-property fallback chain.

**Why Binairo and Sudoku are provably untouched.** The fallback is the mechanism: three of the four games map `--ink-on-accent` to the same `var(--paper-desk)` literal their filled buttons already carried. Measured rather than argued — 90 probes across all four games and both viewports, **76 byte-identical** in composited colour, and every one of the 14 that moved is `#F7F2E9 → #FBF7EF` on a `#B5563C` fill. The two that move on a shipped screen are exactly the `.ctaNext → nonogram` regression above.

**The half left to #68 — `--accent` TEXT on `--paper-desk`.** `screen.titleKicker` (11 px/600) and `screen.barKicker` (11 px/400) at **4.318:1**, and `conclusion-view.chipDone .chipName` (17 px/550) at **3.969:1**. No paper token fixes these: the only remedy is darkening `--accent-nonogram`, which changes the palette of the chosen Ateliê design winner and simultaneously decides Termo, whose hub CTA is **2.731:1** and which `--paper-card` cannot rescue either (it would read 2.736:1). That is a design decision, not a bug fix, and it is already filed with every measured figure as [#68](https://github.com/fernandolisboa/miolos/issues/68) — whose body now states which half #25 closed, so the issue is not re-done. This is the same boundary ADR-0036 decision 5 drew when it pushed the timer face to #63. `plan 020 landmine N14` — "the 11 px accent kicker at 4.32:1, a real AA failure CI cannot see" — is hereby dispositioned rather than left open: **carried, in #68, with numbers**.
