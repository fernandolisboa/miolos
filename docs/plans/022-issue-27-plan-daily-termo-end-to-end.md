# Implementation plan — Issue #27: Daily Termo end-to-end

Step 2 (Plan) of the eight-step flow in [`CLAUDE.md`](../../CLAUDE.md). **Point-in-time snapshot, not a living spec** — where this document and an ADR disagree, the ADR wins, and its body is never rewritten to stay current ([`docs/README.md:19-30`](../README.md)). Planned against `main` @ `0c51f66` ("docs: record Fernando's #58 and #68 decisions in handoff 021 (#72)"), working tree clean, branch `feat/27-daily-termo-end-to-end` already checked out.

Direct prior art: [`docs/plans/020-issue-25-plan-daily-nonogram-end-to-end.md`](./020-issue-25-plan-daily-nonogram-end-to-end.md), whose section layout this plan mirrors, and [`docs/handoffs/021-handoff-m2-termo-and-free-play.md`](../handoffs/021-handoff-m2-termo-and-free-play.md), which is the input brief. Everything plan 020 decided that is not restated or superseded here still binds.

**Provenance.** This plan merges five exploration reports and four parallel decision papers — **A** (server judging and the offline tension), **B** (publication), **C** (the screen), **D** (the web state layer). The papers are scratch and will not survive; every artefact they produced that the implementation needs is **copied into this document**. Where two papers conflicted, §6 names the conflict, the winner and the argument. Every measured number carries the harness that produced it; none is recalled.

**Numbering conventions.** `P1…P44` are this plan's fixed decisions (§4) — 017 used `D`, 018 used `S`, 020 used `P`, and this one continues `P`. `L1…L13` and `La…Ld` are handoff 021 §6's landmines (numbered and lettered); `N36…N45` are new ones this plan adds (§24.3). `T-<AREA>-S<n>` are test ids (§19).

---

## 0. Acceptance criteria → plan mapping

Issue #27's five acceptance criteria, **verbatim** from `gh issue view 27`:

| # | AC (verbatim) | Artefact that satisfies it | Named evidence |
|---|---|---|---|
| 1 | "The day's answer comes from the curated list only after the harness gate; the answer never reaches the client before completion beyond normal gameplay feedback" | §8 (`termoDailyContentSchema`, the `{game,date}` projection, `FORBIDDEN_DAILY_KEYS`), §10.1 (`listUsedTermoAnswers`), §10.2 (`topUpTermoBuffer` drawing only from `TERMO_ANSWERS`, which the ADR-0015 harness gates on every `pnpm test`), §11.1 (`POST /termo/guess` returns `answer` **iff** the board is closed), §13.4 (no `TERMO_ANSWERS` in the client bundle) | T-CORE-S17, S19, S20, S21 · T-DB-S10, S12 · T-API-S29, S31, S32, S35, S36 · T-WEB-S95 · E2b, E6, E7, **E10** (the bundle greps with their positive control) |
| 2 | "Accent-free input matches accent-insensitively; canonical accented form revealed at the end" | §12.4 (`normalizeWord(event.key)` on the keystroke, not only on the compare), §11.1 (the judge normalizes both sides via `evaluateGuess`), §14.3 (the answer reveal chain, six hops, §6.1) | T-CORE-S21 · T-API-S36 · T-WEB-S89, S99 · E8 |
| 3 | "Rejected guesses show 'não está na lista'; accepted guesses come from the validation dictionary" | §12.6 (the visible `role="status"` notice carrying the string verbatim), §13.4 (`isValidGuess` ships to the client so the rejection is instant and offline), §11.1 (the server re-checks `isValidGuess` and answers 422) | T-WEB-S83, S87 · T-API-S38 · E8 |
| 4 | "A six-guess loss is recorded as played (fail row), completes nothing, and never counts toward streak or Dia Perfeito — covered at the `apps/api` seam" | **Two halves, and #27 discharges one.** *"recorded as played (fail row), completes nothing"*: §11.2 (the judge computes `outcome`, `"lost"` becomes reachable at `completions/route.ts:247`), §9 (the `completions.guesses` column and its CHECK — the fail row #29 reads), §15 (`DayStatus`'s third verb, `completedCount`, `nextPendingDaily`). *"never counts toward streak or Dia Perfeito"*: **neither exists yet** — `apps/web/app/page.tsx:82` is `const streakCount = 0` and `apps/api` has no aggregating route — so #27 ships the mechanism (`completions.outcome`, ADR-0008's named instrument) and **transfers the proof to #19 AC 1 and #29 AC 1**. §25 states it in full | T-API-S39 · T-DB-S11 · T-WEB-S79, S80, S96 · E4, E9 · **E13 item 4** (the obligation comments on #19 and #29, URLs pasted) |
| 5 | "Screen designed against the design system, passes `npx impeccable detect`; hub tile live; all four dailies now playable" | §12 (board, keyboard, geometry, motion), §16 (the accent conversion, #68), §14 (the conclusion's fourth state), §17 (`playRoutes.termo`), §21.5 (the `impeccable.yml` arming commit, **after** seeding) | T-WEB-S73, S86…S94, S96…S98, S101 · **E11** (preflight + detect, both viewports, against a **seeded** preview) · E12 (the manual contrast arithmetic — `low-contrast` is wildcard-ignored and is **not** evidence) |

Every AC maps to at least one numbered build step in §22 and at least one named test in §19. §25 restates the mapping as machine-checkable evidence with the exact command per line.

---

## 1. Scope boundary, stated once

**In:** the `/termo` play screen and `/termo/concluido` conclusion; the Termo top-up in the cron and its buffer-depth alerting; the daily / completion / cron contract widenings and the wall's fourth projection; `GET /daily/termo`; **`POST /termo/guess`**, the repo's first mid-game judging route; one DB migration adding `completions.guesses`; the tile board and the on-screen pt-BR keyboard; the conclusion's fourth state (a loss) and the day's word revealed on both outcomes; `DayEntry`'s three verbs; the `/*#__PURE__*/` bundle fix in `packages/games/src/termo/word-list.ts`; the hub tile and the chaining CTA; **the #68 accent conversion across eleven shared declarations, which closes #68**; eight ADRs (§23); `CONTEXT.md`'s Termo vocabulary rows.

**Out, explicitly, each with the issue or reason that owns it:**

| Out of scope | Owner / reason |
|---|---|
| **A Termo hint of any kind** | Decided out and recorded as **ADR-0045**. There is nothing to hint: a Termo board is *output*, and the only thing a hint could reveal is a letter at a position — one of five tiles, **20 %** of the puzzle. Choosing that economy is a product decision for a ticket whose ACs contain one. #27's do not |
| **The elapsed clock on the Termo screen** | **ADR-0045** decision 4. It runs and is recorded (`PlayCore` requires it, the conclusion swap gates on `timer.runningSince === null`, and `completionRequestSchema` requires a real `elapsedMs`); it is not rendered |
| **`em 4/6` on the hub tile** | **#29**, filed at E0 (§27 item 2). `DayEntry` gains no `guesses` field — see §6.2, which states the resulting deviation from the F1 reference frame as a deviation |
| **The reveal on the tiles.** The issue body says, verbatim: *"tiles reveal the canonical accented spelling when the game ends"* (`gh issue view 27`, "What to build"). #27 reveals it **in the conclusion** instead, and this row is the disclosure that it is a deviation from the originating issue rather than an oversight | Argued and rejected in **two** ADR Rejected lists, in the same words: `docs/adr/0042-the-termo-board-is-read-only-output.md:238-242` (*"Putting the canonical accented spelling on the winning board row… overwrites the player's own accent-free input; the reveal belongs to the conclusion"*) and `docs/adr/0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md:169-174` (the same, plus ADR-0034 decision 1's ban on a reveal placed on the play board and ADR-0034 consequence (a)'s measured **11.7 ms median** before the in-place swap unmounts that board). Two further facts make the tiles structurally unable to carry it: on a **loss** the six rows hold six *wrong* guesses and there is no correct row to overwrite (§6.0 gap (ii)), and the tiles are `aria-hidden` by ADR-0042 decision 1, so a reveal drawn there is invisible to a screen reader. **AC 2 is satisfied — the canonical accented form is revealed at the end; only its placement moves.** Restated in §21.6's design-deviation list |
| **Server-side guess state (a table, a migration for it, cross-device resume)** | Rejected in **ADR-0038**. The route is stateless; a replay is free. Cross-device sync is already accepted as absent (ADR-0031 consequence (d)) |
| **Rate limiting on either new route** | **ADR-0038** decision 9 states the posture rather than inheriting one. Revisit trigger: the first abuse signal, or the rewarded-ad ticket |
| **Recycling the answer pool when it empties** | Rejected in **ADR-0040**. It ships a branch dead for 13+ months that then runs unattended against production for the first time. Exhaustion fails closed; a real alert is filed (§27 item 1) |
| **A partial unique index on `(content ->> 'normalized')`** | Rejected in **ADR-0040**. It needs a second hand-applied migration, would be `daily_puzzles`' first index beyond the PK, and converts a rare duplicate into a cron 500 |
| **Totalising `playRoutes` from `Partial<Record<Game, Route>>`** | Filed, not done (§27 item 3). It touches the exact two consumers §15 is simultaneously rewriting; two independent reshapes of the same eight lines in one PR is how a step-6 loop starts |
| **Issue #63's timer digit-swing fix** | **#63**. `/termo` renders no `<TimerReadout/>`, so it is not a fourth surface — a real, stateable benefit of ADR-0045 decision 4, not a workaround |
| **Issue #67's hint-button tab order** | **#67**, narrowed by ADR-0045 consequence (c) to its fix (i). #27 owes a comment on the issue, not code |
| **Issue #61's Binairo roving-focus retrofit** | **#61**, unchanged. Termo has no drag surface and does not touch `use-pointer-stroke.ts` |
| **Darkening any accent token** | Rejected by Fernando on 2026-08-02 and recorded in **ADR-0041** decision 6. No ticket may reopen it without a new ADR |
| Statistics, the guess distribution's presentation, personal best | **#29**. #27 only owes a row #29 can read |
| Archive, widening `ACCEPTED_DAYS_BACK` | **#31**. `ACCEPTED_DAYS_BACK` stays `1` and is **hoisted, not changed** (§11.3) |
| The late-by-sync window | **#58**, inherited unchanged. Do not implement a grace. ADR-0039 consequence (c) records why #58 barely touches Termo |
| The least-privilege `miolos_web` Neon role | **#59**. The only duty is negative: nothing in this ticket may say or imply the grant exists |
| Free play | **#28** — and Termo is excluded from it by project invariant (ADR-0005) |
| Dark mode, telemetry (#33), any ads SDK or new `AdSlot` placement | — |

**Never:** an answer word in any client-reachable payload; a client-asserted outcome on the wire; **an `on_time` stored *by #27*** (scoped, not absolute — see below); a `v` bump on the play record; a future-dated puzzle in any response; a deep import from `@miolos/games/termo`; a second `sync.ts`; a confidentiality argument for anything here (ADR-0027:125-131).

**The `on_time` clause is scoped to this ticket on purpose, because the absolute form is already false.** Fernando decided **#58** on 2026-08-02 and the decision is recorded at `docs/handoffs/021-handoff-m2-termo-and-free-play.md:183`: *"Amends ADR-0026 (on-time becomes decided-at-write and **stored**, so ADR-0009's 'streak is derivable from completion rows' survives)."* #58 is `ready-for-agent` and unbuilt. #27 therefore adds no `on_time` column, no derivation and no write — and equally must not *pre-empt* #58 by hard-coding "derived, never stored" into a TSDoc, an ADR or a test name that #58 would then have to unwrite. The same handoff row says #58 **"barely touches #27"** — Termo cannot be played offline at all, so the late-by-sync window has almost no Termo instance.

### 1.1 Known-deferred — shown to step-6 reviewers up front

Handoff 021 landmine **(d)**: *"A review loop will not converge if a scheduled-but-absent item is reviewable. #25's ran four rounds (41 → 31 → 24 → 29) without an empty pass, largely because the `impeccable.yml` commit is deliberately sequenced after seeding and reviewers kept raising its absence as blocking."*

This numbered list is pasted into the **step-6 reviewer brief** and into the PR body. **Raising any of these as blocking is a dismissal-with-reason, not a finding.**

1. **The `.github/workflows/impeccable.yml` commit is absent until the very end of the branch.** It is commit **B11**, an *arming* commit, created and pushed only after the step-7 fixes and after §21.4(b)'s seeding output is pasted. Its precondition is a database state no commit can carry. See §21.4, and PR #60's Impeccable run 30710479040 for what happens when this is done in the wrong order.
2. **The hub tile for a *won* Termo shows an elapsed time (`em 07:12`), where the F1 reference frame draws `em 4/6`.** A deliberate, visible deviation from a design reference. §6.2 carries the argument; the follow-up is filed against #29 at E0 (§27 item 2).
3. **`playRoutes` stays `Partial<Record<Game, Route>>`** even though all four games now have keys, leaving ~15 lines of dead branch. Filed (§27 item 3).
4. **Issue #63 (the timer digit swing) is not fixed and is not worked around.** `/termo` renders no timer.
5. **Issue #61 (the Binairo roving-focus retrofit) is not started.**
6. **Issue #67 is not fixed**; #27 only narrows it to fix (i) with a comment.
7. **No hint appears anywhere on `/termo`** — no button, no `.placeholder` standing in for one, no `hint` grid-area occupant. ADR-0045 decision 1.
8. **No exhaustion alert exists** beyond a `console.error` at 30 remaining answers; the real alert is filed (§27 item 1).
9. **`completionResponseSchema`, `CompletionRecord` and `getCompletion` are untouched** — the `guesses` column is write-only in #27. #29 adds the projection. ADR-0038 decision 6 states why widening `CompletionRecord` would throw on **every** completion in the app.
10. **The `packages/db` migration is generated and committed but not applied by any pipeline.** Applying it is an operational step — and it is scheduled **against commit B5, before the branch's API is ever deployed**, not at step 8 (§21.4(a), §21.7 E2). Handoff 021 landmine 7.
11. **`packages/games/test/termo/exports.test.ts` is unrequested by any AC and ships anyway, at 20 lines.** It is a byte-for-byte-shaped copy of `packages/games/test/binairo/exports.test.ts` (`wc -l` → **20**), and #27 is the first consumer of the `./termo` subpath, so a broken exports map would otherwise surface as a `apps/api` import error rather than as a `packages/games` failure. Accepted at that size. *(`bundle-markers.test.ts` is **not** in this category — it gates the two `/*#__PURE__*/` annotations AC 1 depends on, §13.4.)*
12. **The work ships as TWO pull requests** (§21.0). PR A closes **#68** and is merged first; PR B closes **#27** and is rebased on it. A reviewer of PR B will not find the eleven accent conversions in its diff — they are in PR A, already merged, and §16 is the record of the dependency rather than a commit of #27's own.

---

## 2. Read first (in this order)

1. [`CLAUDE.md`](../../CLAUDE.md) — the eight steps and the mechanical gate. Eight is the floor.
2. [`CONTEXT.md`](../../CONTEXT.md) — and §18.1's vocabulary ruling, which fills the gap it has for **guess**, **answer**, **tile**, **tile state**, **keyboard state**, **validation dictionary** vs **answer list**, **guess distribution** and **fail row**.
3. [`docs/handoffs/021-handoff-m2-termo-and-free-play.md`](../handoffs/021-handoff-m2-termo-and-free-play.md) in full — §2 (where handoff 019 is now wrong), §5 (the extension-point table), §6 (the landmines), §9 (the exit criteria).
4. [`docs/plans/020-issue-25-plan-daily-nonogram-end-to-end.md`](./020-issue-25-plan-daily-nonogram-end-to-end.md) §6, §26 and **§27 in full** (64 review dispositions, including three places a reviewer was wrong with the refuting evidence).
5. `docs/adr/0004`, `0008`, `0010`, `0015`, `0017`, `0019`, `0023`, `0024` (with its 2026-07-31 amendment), `0025`, `0026`, **`0027`** (and precisely why its argument does not transfer — and what its `:125-131` forecloses), `0028`, `0029`, `0030`, `0031`, `0032`, `0033`, `0034`, `0035`, `0036`, `0037`.
6. `packages/games/src/termo/index.ts` — 30 lines, the whole public surface. **Never a deep import** (ADR-0019). §7 tabulates it.
7. `apps/web/src/nonogram/` end to end — the freshest worked example, and the one that had to widen the shared layer honestly rather than contort it.
8. `apps/web/src/play/` — `types.ts`, `play-record.ts`, `sync.ts`, `day-state.ts`, `use-play-lifecycle.ts`, `use-record-snapshot.ts`, `conclusion-view.tsx`, `accent.ts`, `screen.module.css`.
9. `DESIGN.md`, `PRODUCT.md`, `packages/ui/tokens.css`. **There is no reference frame for the Termo play screen** — `/termo` is a just-in-time design, exactly the situation `/nonogram` was in, and `nonogram-board.module.css:1-60`'s header (six numbered deviations with their arithmetic) is the template. F1 *does* draw the Termo **hub card** (`docs/design/006-handoff-design-winner-atelie/f1-hoje-desktop.dc.html:63`).
10. `content/termo/README.md` — provenance, licences, and the constraints the list was built under.

---

## 3. Fixed orchestrator conventions (recorded, not re-litigable here)

- Shell preamble on every node/pnpm/npx command: `source ~/.nvm/nvm.sh && nvm use default >/dev/null && …`. Node v24.18.1, pnpm 11.18.0.
- **This ticket adds nothing to `packages/games/src` except two `/*#__PURE__*/` annotations and the TSDoc that explains them** (§13.4). The Termo engine shipped complete in #26 and ADR-0023's proof floors have nothing new to bind: there is no generator. **Two test files are added** under `packages/games/test/termo/` (§19 G1, G2) — a test is not a source addition and neither touches the barrel.
- **No new fast-check anywhere outside `packages/games`.** ADR-0017 scopes it there; `topUpTermoBuffer` lives in `apps/api` and adding fast-check there to satisfy a gate that names a different package would breach a recorded decision to look compliant. ADR-0040 consequence (h) says so; §19's `apps/api` block is table-driven over the enumerated 400.
- **CLAUDE.md's "property-based tests for `packages/games`" gate does not bind this ticket**, and §19 says why in one sentence rather than leaving the silence to be read as an omission: #27 adds no generator, and ADR-0015's own bar is already discharged by `packages/games/test/termo/word-list.test.ts` (nine `it`s, the harness gate, `:15-17` naming #27 as its beneficiary). #27's duty is to **cite** it, not rebuild it.
- `packages/ui` stays JSX-free (ADR-0002) and **no token VALUE is added or edited.** `--accent-termo` stays `#C08A1E` (ADR-0041 decision 6).
- **One migration**, and it is `completions`-only (§9). `daily_puzzles` needs none: `schema.ts:111` already lists `'termo'` in its CHECK. Handoff 021 §5's *"No migration"* sentence is about the **game enums**, which is true and stays true — §6.3 states the scoping so a reviewer does not read it as a contradiction.
- **No new dependency.** `min-release-age=3` and `save-exact=true` therefore have nothing to bind.
- Turbo evidence is always `--force`; captured exit codes, never prose.
- Plan number **022**; ADR numbers **0038–0045** reserved (§23), split across two PRs (§21.0: ADR-0041 in **A1**, the other seven in **B2**). The `docs/README.md` row ships in **commit B1** (§21.1) — **this plan does not edit `docs/README.md` itself**; the exact row text is in §21.1.
- **`rm -rf apps/web/.next` is the first line of every gate pass and every step-7 re-run** (plan 020 N24/TR-13). `apps/web/next-env.d.ts:3` hard-imports the gitignored `.next/types/routes.d.ts`; only `next build` regenerates it, so a stale `.next` makes the commit that adds `/termo` fail pre-commit for a reason unrelated to its diff, **and CI cannot reproduce it**.

---

## 4. Fixed decisions

Forty-four, each naming the decision paper it comes from. Anything marked **ADR** is expanded in §23. Nothing here is re-decided; this is the consolidated register.

### Publication (paper B → ADR-0040)

- **P1 — `daily_puzzles.content` for termo is `{canonical, normalized}`, a field-for-field mirror of `TermoAnswer` (`packages/games/src/termo/word-list.ts:4-7`) and nothing else.** `z.strictObject`, in `packages/core/src/contracts/daily-content.ts` — **never `daily.ts`**, or it lands in the client bundle and the ESLint wall fails you (handoff 021 §5).
- **P2 — The word is stored; its index into `TERMO_ANSWERS` never is.** The order is contractual (`word-list.ts:9-15`) and the harness pins it — but what the harness pins is that the array matches *today's* `answers.csv`, not that `answers.csv` never changes, which ADR-0015 explicitly expects it to. With an index in an immutable row, one regeneration commit silently rewrites up to **30** days of unpublished answers (`remoteConfigSchema`'s clamp ceiling, ADR-0025) and retroactively changes what every archived row meant, **with every gate green**: the harness passes (it pins the new CSV), the content schema passes (an integer is an integer), the strip passes.
- **P3 — No `seed` field in `content`; the `daily_puzzles.seed` column receives the accepted `randomUint32()` draw and its TSDoc says it reproduces nothing.** The pick is a rejection draw over a **run-scoped** eligible pool, so replaying the same uint32 against a different pool yields a different word. The column stays populated because it is `bigint … notNull()` (`schema.ts:102`).
- **P4 — No `game: z.literal("termo")` field.** Nonogram's exists only because its engine emits one (`daily-content.ts:85-89`, `generate.ts:48`); `TermoAnswer` has no such key, and the mirror rule is stated three times in that file (`:29-31`, `:58-63`, `:84-90`).
- **P5 — No `.refine` cross-checking `normalizeWord(canonical) === normalized`.** `@miolos/games` is a **devDependency** of `packages/core` (`packages/core/package.json:19`) and stays one, so `src/` cannot import it. The invariant holds by construction at the single write site and is pinned by a `packages/core` **test** over all 400 (T-CORE-S17), through the door `packages/core/test/daily-contract.test.ts:1-11` already uses.
- **P6 — `dailyTermoResponseSchema = z.strictObject({ game: z.literal("termo"), date: isoDateString })`, added to `dailyPuzzleResponseSchema` alphabetically last.** It earns its union slot: it is the *only* mechanism that widens `ProjectedGame` (`daily.ts:208`), and it makes "the answer word, in any field" a **parse failure at the wall**, not a review duty.
- **P7 — `stripDailyContent`'s termo arm parses `content` strictly and discards the result**, then returns `{game, date}`. With an empty projection the HTTP 200 **is** the whole message, so it has to mean *playable*, not merely *a row exists*. There is **no `default:`** in that switch and there must not be one (handoff 021 §2).
- **P8 — `FORBIDDEN_DAILY_KEYS` gains `"canonical"` and `"normalized"`.** `"answer"` alone would be the vacuous ban ADR-0033 decision 3 refused for `"reveal"`. This overrides paper D's D8.5 — see §6.6.
- **P9 — `topUpTermoBuffer` has no inner attempt loop and no seed-retry budget, and that absence is load-bearing.** There is no generator that can fail, no validator that can reject and no weekday ramp; the only non-throwing failure is deterministic schema drift, which retrying cannot fix. The three sibling `MAX_*_SEED_RETRIES_PER_DATE` constants get **no termo analogue**, and one added later "for symmetry" would guard nothing.
- **P10 — The no-repeat rule: an answer used by any `daily_puzzles` row with `game='termo'` — killed, unpublished, past or future — is never drawn again.** No date filter, no `killed_at` filter. Forced by arithmetic: uniform independent picks over N=400 collide with probability `1 − ∏(400−i)/400`, which first exceeds ½ at **k = 24** (`k=10: 0.1072 · k=15: 0.2334 · k=20: 0.3830 · k=23: 0.4752 · k=24: 0.5054 · k=30: 0.6722 · k=50: 0.9591`).
- **P11 — `listUsedTermoAnswers(db): Promise<string[]>` on `@miolos/db/publishing`, keying on `normalized`, not `canonical`.** The **first** top-up read-back of stored `content` in the repo (`listBufferedDates` selects dates, `bufferDepth` counts). `normalized` is `^[a-z]{5}$` by the harness (`word-list.test.ts:75`), so the comparison is pure ASCII and cannot be defeated by a `jsonb` round-trip that composes a diacritic differently.
- **P12 — The eligible pool is built once per run and spliced on every successful insert.** The used-set is read before the first insert, so a per-date recheck would not see this run's own writes; two dates in one run therefore cannot draw the same answer. An answer is spent only on a real insert — a lost `ON CONFLICT` race means another writer covered the date with **its** answer.
- **P13 — Exhaustion fails closed. There is no recycling branch.** Every uncovered date lands in `failures` with `ANSWER_LIST_EXHAUSTED`; the buffer drains; `shallow` fires; `buffer-alert.yml` opens the issue. Honest runway: `effectiveThreshold = min(4, 7) = 4` (`service.ts:82-84`), so `shallow` fires when depth < 4 — **3 dailies remain** — and `buffer-alert.yml` polls at `30 7 * * *`, giving **~2–3 days**. That is not enough to regenerate a word list, which is why P14 exists and why §27 item 1 is filed.
- **P14 — A `console.error` fires once per run when the pool drops below 30 remaining (~30 days' notice). It is a log line, not an alert, and is labelled as one nowhere else.**
- **P15 — The draw is rejection sampling on `randomUint32()`, not `% n`.** The modulo bias is measurably nothing — `2³² mod 400 = 96`, so 96 residues get 10 737 419 preimages and 304 get 10 737 418; max relative deviation **7.078 × 10⁻⁸**, total variation distance **1.118 × 10⁻⁸**. The reason to reject it anyway is ADR-0023's register: with rejection, uniformity is a **construction** fact (every accepted value maps to exactly `floor(2³²/n)` uint32s) needing no measurement, no property test and no flake budget. Cost: accept region `4 294 967 200` of `2³²`, so `P(reject) = 2.235 × 10⁻⁸` and expected draws `1.0000000224`; `P(64 consecutive rejects) ≈ 10⁻⁴⁹¹`.
- **P16 — `failures[].reason` for termo has exactly two strings**: `ANSWER_LIST_EXHAUSTED` and `content schema rejected: <zod message>`. Everything else throws and is caught by `runTopUp`.
- **P17 — Termo runs FIRST in the cron**, honouring `cron.ts:38-44`'s written argument. Measured (Node v24.18.1, n = 2000 after 200 warm-up, pool rebuilt every iteration): a cold week (depth 7, empty buffer) is **0.0193 ms** of CPU; depth 7 / 350 used is 0.0338 ms; depth 30 / 0 used is 0.0424 ms; the absolute worst run (depth 30 at the clamp ceiling, 370 used) is **0.0573 ms**. Against `cron/publish/route.ts:105-112`'s figures — binairo ~7 ms, nonogram ~34–80 ms, sudoku ~150 ms per cold week — termo is **~360× cheaper than the current cheapest**. **The honest asymmetry, stated in BOTH the figures it has, because "+1" alone reads as the total in a PR body.** Counted against `topUpBinairoBuffer` (`apps/api/src/publishing/service.ts:121-198`), a sibling's run-level round trips are **three** — `todaySaoPaulo`, `listBufferedDates`, and the trailing `bufferDepth` — plus one per insert. `topUpTermoBuffer` has the same three **plus `listUsedTermoAnswers`**, so:

  - **Per sibling, the shape delta is +1** — the used-set read no other top-up has.
  - **At run level, termo contributes 4 round trips plus its inserts**, taking the cron's fixed cost from 3 × 3 = 9 to **13**. On a cold week that is 4 + 7 inserts = **11 trips for termo alone**.

  Both numbers go in the PR. Cost-ascending orders by *generation* cost so a CPU overrun cannot starve a cheaper game; on that rule termo is first, and the round-trip asymmetry is the price, named rather than discovered.
- **P18 — Both `cronPublishResponseSchema.games` and `bufferDepthResponseSchema.depths` widen with `termo` keyed FIRST** — `{termo, binairo, nonogram, sudoku}` — matching the route's `await` order, which **is** the execution order. `effectiveThreshold`, `healthy` and `shallow` need **zero** logic change; all three iterate the parsed body.
- **P19 — The two "rejects a third/fourth game key" negative tests become "rejects an unknown game key", aimed at `crossword`** (CLAUDE.md names pt-BR crosswords as future work; it is not in `GAMES`, which is exactly four at `packages/core/src/game.ts:8`). After #27 there is no fifth real game to aim at.
- **P20 — `GET /daily/termo` ships as the fourth literal route** — never a `[game]` dynamic segment — serving `{game:"termo", date:"YYYY-MM-DD"}` or `404 {}`. **`apps/web` does not consume it.** Its presence-or-absence **is** its payload: it is the operator's machine-readable check that a `killed_at` took effect, and it is the instrument landmine 3 demands for the pre-merge safety proof.

### Judging and the wire (paper A → ADR-0038, ADR-0039)

- **P21 — A Termo guess is judged by a dedicated, authenticated, STATELESS route: `POST /termo/guess`.** The client posts the whole guess list every time; the server re-judges all of it from the stored row and holds nothing between requests. No guess table, no migration for guess state, no session-scoped memory.
- **P22 — The response carries `answer` — the canonical accented spelling — if and only if `status !== "playing"`**, enforced by a `.refine` on the response schema rather than by a comment.
- **P23 — The stateless route cannot enforce `MAX_GUESSES` against a tampering client, and that is accepted, in writing.** A client may re-post a shorter prefix and buy extra turns. It buys nothing that `solveBinairo(givens)` does not already give away for free at 0.04–0.16 ms (ADR-0027 decision 1).
- **P24 — Commitment schemes, hash-of-answer and HMAC guess chains are rejected as theatre**, on the argument ADR-0004 already records verbatim for the client-derived key. An HMAC chain enforces prefix consistency but **not** monotonic progress — the client holds every earlier token and can rewind and branch; stopping rewind requires server state.
- **P25 — NONE OF THIS IS A CONFIDENTIALITY ARGUMENT, and the oracle costs ONE request.** ADR-0027:125-131 forecloses the confidentiality framing in terms that name Termo explicitly. The guess endpoint **is** an answer oracle, and the honest price is **one authenticated request**, not two and not four hundred. **Read `packages/games/src/termo/status.ts:22-40`**: `deriveBoardStatus` returns `"lost"` whenever `rows.length === MAX_GUESSES` and no row is all-correct (`:39`), so a body carrying **six arbitrary validation-dictionary words** is a *terminal* board — and `termoGuessResponseSchema`'s refine then makes `answer` **mandatory** on that response (§11.1). Six words the attacker chooses freely, one POST, the canonical accented answer back. *(A prior draft claimed an "information-theoretic floor of two requests" from `⌈log2(400) / log2(243)⌉`. That arithmetic is right and irrelevant: it bounds an adaptive **guessing** strategy, and the six-row board does not guess — it forfeits. The claim is withdrawn here and in ADR-0038.)*

  **The decision stands, on the two arguments that survive the correction.** (i) **Scope.** ADR-0004's threat is *spoiler broadcast of an unpublished day* — `ADR-0004:13`: *"The threat that matters here is **spoiler broadcast**, not individual cheating. There is nothing to cheat for — v1 has no global ranking (a product veto), so a cheated streak only cheats its owner."* The oracle cannot reach an unpublished day: every read goes through `wallPredicate` (`packages/db/src/published.ts:35-44`), which ANDs `published_at <= now()` and `killed_at is null`. Tomorrow's answer is unreachable at any price. (ii) **Comparison, on a pair that actually compares.** ADR-0027 decision 1 already ships `solveBinairo(givens)` to the browser, *"memoized once per page, measured at 0.04–0.16 ms"* (`docs/adr/0027…:34-35`) — a **local** solve, no network, no session, no origin, no server. Termo's oracle needs a minted session cookie and a round trip. It is **strictly more expensive than an exposure this project has already accepted in writing**, on the same day's puzzle, for three of four games. No mitigation is added; only the record is corrected.
- **P26 — Termo structurally cannot be played offline, and #27 ships that as a stated degradation, not a bug.** Typing works, the loaded board renders, and "não está na lista" is instant offline because `isValidGuess` runs on the client over the same byte-pinned list the server uses. Judging does not, and therefore finishing does not.
- **P27 — ADR-0028 decision 2's MECHANISM survives intact; only its RATIONALE is unreachable.** The in-place conclusion swap still ships and still works, because the response that closes the board has already arrived by the time the board is closed. **Nothing in ADR-0028's Decision is amended.**
- **P28 — A failed guess POST HOLDS the guess in memory: it is never queued and never loses the turn.** §11.4 carries the full failure table. **429 is never terminal** — this repo emits none today (verified: `grep -rn "429"` over `apps/api/src`, `apps/api/app`, `apps/web/src`, the test trees and `docs/adr` returns nothing), and the case exists because Vercel's platform firewall can, and settling a live turn as "rejected" on a load spike would cost the player a guess.
- **P29 — `sync.ts`'s queue is the wrong mechanism for a guess and is not used for one.** Five grounded reasons in §11.4. `sync.ts` still gains its `case "termo"` in `buildBody` for the **completion** (ADR-0029 consequence (f), unchanged).
- **P30 — The completion request's termo member carries `guesses: string[]` (normalized, `^[a-z]{5}$`, 1..6) and nothing else new.** Five keys, `guesses` exactly where the three grid members carry `grid`. No `tiles` (the server recomputes them), no outcome (the server decides it), no answer.
- **P31 — The server decides `won` vs `lost` by re-running the engine**: `isValidGuess` on every guess, then `evaluateGuess` against the stored normalized answer, then `deriveBoardStatus`. **`deriveBoardStatus` throws** a `RangeError` on a row following a winning row (`status.ts:31-36`) — reachable from a malicious body, and an uncaught `RangeError` in a route handler is a 500 — so that case is checked **explicitly before** the call, the same way ADR-0032 decision 4 puts the length check before the compare loop.
- **P32 — `storedSolution` is NARROWED, never widened**: its parameter type becomes `Exclude<CompletionRequest["game"], "termo">`, so TypeScript proves at the call site that the route narrowed `body.game` first. A `case "termo": throw` arm would be a weaker, runtime-only guarantee. `outcome: "won"` at `completions/route.ts:247` stops being a literal and `"lost"` becomes reachable for the first time.
- **P33 — A malformed / not-yet-closed / dictionary-invalid guess list is `422 guess-mismatch` with NO row. Six guesses exhausted without a win is `200` with `outcome: "lost"`.** Both halves stated so the inversion is not over-read: reading it more broadly would 200 a malformed body, which is worse than the bug it fixes.
- **P34 — `completions` gains a write-only `guesses integer` column, in #27, with a CHECK tying it to the game.** ADR-0026 decision 1 makes the row write-once and `recordCompletion` never `DO UPDATE` (`completions.ts:103-106`), so a row written before the column exists **can never be backfilled** — every Termo day played between #27's deploy and #29's would be permanently absent from the guess distribution ADR-0008 rule 3 and `CONTEXT.md`'s **Played** row both require.
- **P35 — `CompletionRecord`, `getCompletion` and `completionResponseSchema` are untouched.** Widening `CompletionRecord` would make `completionResponseSchema.parse({ ...record, recorded })` — a `z.strictObject` — throw on **every** completion in the app (`completions/route.ts:63-71`). This is the reason for the write-only shape, not an afterthought.
- **P36 — `ACCEPTED_DAYS_BACK` is hoisted out of `completions/route.ts:45` into `apps/api/src/publishing/dates.ts`** (which already holds `addDays` and is already imported by that route at `:23`) and shared by both routes. A player mid-game at the São Paulo rollover must be able to submit guess 5 for yesterday's date. It stays in the **route layer** and out of SQL, which is what ADR-0026 decision 6 actually requires — say so in the PR so it is not filed as a finding.
- **P37 — No constant-work comparison is added for Termo**, and `completions/route.ts:224-230`'s forward reference to #27 is corrected in the same commit: the judge returns the judgement in the body, so there is no timing channel to close.

### The web state layer (paper D → ADR-0044, ADR-0045)

- **P38 — The play record's termo member holds JUDGED GUESS ROWS and nothing in flight**: `guesses: { guess, tiles }[]`, `.max(6)`, `guess` normalized `^[a-z]{5}$`, `tiles` a 5-tuple. Paired rows, not parallel arrays — the shape is structurally the engine's `EvaluatedGuess` (`keyboard.ts:4`), so `deriveKeyboardState(record.guesses)` reads the record with **no adapter**. §6.5 records that this overrides paper A's parallel-array sketch.
- **P39 — Tiles are stored, never re-derived.** `evaluateGuess(guess, answer)` needs the answer; termo's projection is `{game,date}`; the record is written on **every** judged guess. Mid-play there is no answer in scope, so a record without tiles cannot re-render the board after a reload. This is not an optimisation.
- **P40 — `answer` (canonical, `.length(5)`) and `outcome` (`completionOutcomeSchema`) are written ONLY on the closing write, and the `superRefine` makes "present iff `concluded`" a parse-time invariant.** `outcome` is **stored, not derived**, on blast radius rather than bytes: `day-state.ts` is on every route's client graph (`hub-day-state.tsx:26`, `conclusion-view.tsx:18`) and must never import a game engine — that would put the Termo engine on `/` and, one lost `/*#__PURE__*/` away, the word list with it.
- **P41 — `DayEntry.concluded: boolean` becomes `DayEntry.status: "pending" | "completed" | "played"`, and `elapsedMs` is set IFF `status === "completed"`.** An enum, not a third boolean: a `closed` flag beside `concluded` fails **safe** (a consumer that forgets it reads pending); the enum fails **closed** (`DayEntry.concluded` ceases to exist, so all eight consumers are a red typecheck). `doneCount` → `completedCount`. The verbs are `CONTEXT.md`'s own, minus the late completion a local reader cannot see.
- **P42 — Termo ships no hint** — not a client hint, not a server hint, not a placeholder. Termo's state has **no `hint` field at all**: `HintState` is a standalone interface (`types.ts:44-50`) composed by each game, not part of `PlayCore`, so Termo simply omits it and `HintState.lastIndex: number | null` never has to be reinterpreted. `hintsUsed` keeps `.min(0).max(1)` on the wire and `buildRecord` writes the literal `0`.
- **P43 — The timer runs and is recorded; it is NOT rendered.** §6.4 records that this overrides paper C's DOM.
- **P44 — `TERMO_ANSWERS` must not reach the client, and the fix is two `/*#__PURE__*/` annotations** — one on `Object.freeze(`, one on `ANSWER_CANONICALS.split(`. Both are required; annotating only the outer call was **measured** not to work. §13.4 carries the measurement.

---

## 5. What is already true — every extension point, fail-closed today

Verified by direct read at `0c51f66`. Each throws, rejects, or does not typecheck for termo **today**.

| # | Location | Mechanism | Fails at | #27 replaces it with |
|---|---|---|---|---|
| 1 | `packages/core/src/contracts/daily-content.ts:197-198` | `case "termo": throw new DailyProjectionUnsupportedError(game)` | **runtime** — pinned red by `packages/core/test/daily-contract.test.ts:99-103` | §8.3's arm |
| 2 | `packages/core/src/contracts/daily.ts:191-195` + `:208` | termo absent from `dailyPuzzleResponseSchema` ⇒ absent from `ProjectedGame` | **compile**, at `getTodayDaily(db,"termo")` (`packages/db/src/published.ts:64-67`, `:93-97`) | §8.2's member |
| 3 | `packages/core/src/contracts/daily-content.ts:141-146` | the strip table's termo row reads `#27 (throws until)` | prose | §8.1's rewritten row |
| 4 | `packages/core/src/contracts/completion.ts:187-193` | termo absent from `completionRequestSchema` | **runtime** 400; asserted at `completion-contract.test.ts:190-193` | §11.2's member |
| 5 | `apps/api/app/completions/route.ts:84-106` | `storedSolution` exhaustive over `CompletionRequest["game"]`; its TSDoc at `:73-83` says *"#27 gets a compile error here instead of a silent fallthrough"* | **compile**, the moment #4 is widened | P32's narrowing |
| 6 | `apps/api/app/completions/route.ts:220`, `:233` | `body.grid` named unconditionally | **compile**, the moment #4 is widened | §11.2's branch |
| 7 | `apps/api/app/completions/route.ts:247` | `outcome: "won"` hardcoded | **silent** — the one spot with no tripwire | §11.2's computed outcome |
| 8 | `packages/core/src/contracts/cron.ts:46-52` | `games` strict, three keys | **runtime** at `cron/publish/route.ts:142`; asserted `cron-contract.test.ts:36-43` | §10.3 |
| 9 | `packages/core/src/contracts/cron.ts:67-72` | `depths` strict, three keys | **runtime** at `buffer-depth/route.ts:34`; asserted `:129-134` | §10.3 |
| 10 | `apps/api/app/daily/` | no `termo/` directory | **404 for free** | §10.4 |
| 11 | `eslint.config.mjs:299-305` | five-name `importNames` ban | **red at `T-LINT-S7`** (`apps/web/test/eslint-db-wall.test.ts:280-331` derives the list from `daily-content.ts`'s own exports) | §8.4 |
| 12 | `packages/core/src/testing.ts:29-42` | `FORBIDDEN_DAILY_KEYS`; `"answer"` at `:32`; its TSDoc at `:9-11` names #27 by number | leak scan across ten consumers **plus a substring ban on rendered HTML** in three page suites | P8 |
| 13 | `apps/web/src/play/play-record.ts:207-217` | *"EXTENSION POINT: #27 adds its member here"* | prose | §14.1 |
| 14 | `apps/web/src/play/sync.ts:249-276` | `const unhandled: never = record` at `:270` | **compile**, the moment #13 lands. *The single sharpest tripwire in the ticket* | §14.2 |
| 15 | `apps/web/src/play/use-record-snapshot.ts:116-127` | `sameToTheReader` compares exactly five chrome fields; its header at `:104-114` requires any independently-moving payload field to be added | **silent** — a stale cached snapshot | §14.4 |
| 16 | `apps/web/src/i18n/routes.ts:26-29`, `:47-51` | *"EXTENSION POINT: #27 adds …"* twice; `playRoutes` is `Partial<Record<Game, Route>>` | prose | §17.1 |
| 17 | `apps/web/app/hub-day-state.tsx:71-81` | *"termo alone reaches this branch today, and #27 clears it"* | prose | §17.2 |
| 18 | `apps/web/src/play/conclusion-view.tsx:332-342` | `nextPendingDaily` chains on `!entryOf(candidate).concluded`; `DAY_GAMES[0] === "termo"` (`:24`) | **silent** — a lost Termo offered as the default next daily, forever | §15.3 |
| 19 | `apps/web/src/play/accent.ts:50-62` | `INKS_ON_ACCENT.termo = "var(--paper-desk)"` with a TSDoc that says termo *"is deliberately NOT rescued here"* | **silent** — a live 2.7311:1 label the moment `playRoutes.termo` lands | §16 |
| 20 | `.github/workflows/impeccable.yml:76`, `:146-151`, `:170` | seven paths in three places | **CI** — but only once armed | §21.5 |
| 21 | `packages/games/src/termo/index.ts` | the barrel re-exports `word-list`, which statically imports `words.generated.ts` (40 591 bytes on disk, 15 131 gzipped) with **no** `/*#__PURE__*/` on its three top-level calls | **silent** — 2.8 KB of answer pool in the bundle | §13.4 |

**Not fail-closed (open today), and deliberately so:** `insertDailyPuzzle`, `listBufferedDates`, `bufferDepth` and `getPublishedDailyWithSolution` are all keyed on the full `Game`, so a termo row can already be written and read with zero code change — `packages/db/src/published.ts:118-124` records the reason: *"the judge must be able to read a row for any game the buffer can hold."* This is what makes §21.4's local seeding possible.

---

## 6. Where the four decision papers conflicted, and which won

Four papers were produced in parallel, each reading the code itself. **Nine conflicts and one closed chain.** None is papered over. This is the page a step-6 reviewer should read first.

### 6.0 The answer-reveal chain, hop by hop — CLOSED

Paper C sources the conclusion's canonical reveal from the **local play record**; paper D puts `answer` in that record; paper A puts it on the **guess route's** closing response. The chain is closed and every hop is named:

| Hop | Where | What moves | The thing that would break it |
|---|---|---|---|
| 1 | `topUpTermoBuffer` → `insertDailyPuzzle` (§10.2) | `content = {canonical, normalized}` into `daily_puzzles` | P1 dropping `canonical`. There is **no runtime path from a normalized form back to its canonical spelling** — `content/termo/canonical-map.csv` (5 310 rows, 64 363 bytes) deliberately does not ship |
| 2 | `POST /termo/guess` (§11.1) | `getPublishedDailyWithSolution(db,"termo",date)` → `termoDailyContentSchema.parse(row.content)` → `answer: parsed.canonical` on the response, **iff** `deriveBoardStatus(tiles) !== "playing"` | the `.refine` on `termoGuessResponseSchema` inverting; a route change quietly leaking it mid-game — which is why it is a refine, not a comment |
| 3 | the Termo reducer's `judged` action (§14.4) | `{tiles, status, answer}` absorbed into state **before** `status` leaves `"playing"` | **the load-bearing ordering constraint.** `use-play-lifecycle.ts:231-246` builds the completion synchronously on `closedAndFrozen`; if `status` flipped first, `buildRecord` would write a record with no `answer` and the `superRefine` would refuse it — the completion would be **lost**. Pinned by **T-WEB-S82** |
| 4 | `buildRecord(state, now, closed=true)` (§14.1) | `answer` copied into the record in the same write that flips `concluded` | the lockstep. Pinned by **T-WEB-S77**, Termo's copy of `T-WEB-S64` — on `answer`, **not** on `guesses`, because `guesses` moves on every turn and asserting it would assert something false |
| 5 | `writePlayRecord` → `localStorage` under `miolos:play:termo:<date>` | the only carrier across a reload | a `v` bump (forbidden — ADR-0029 consequence (d)) |
| 6a | `/termo` in place | `TermoScreen` passes `answer` from live state to `ConclusionView` | — |
| 6b | `/termo/concluido` | `TermoConclusion` reads `record.answer` through `useRecordSnapshot("termo", date)` — the **same** `{game,date}` key `ConclusionView` uses, because the module cache is one slot (`use-record-snapshot.ts:43-49`) and two subscribers on different keys would thrash it | opening a second key |

**Two channels are structurally closed and must stay closed.** The **completion response** cannot carry it: `acceptResponse` copies only `elapsedMs`/`hintsUsed`, and only on the `recorded: false` branch (`sync.ts:349-358`), and `settle` writes `{...record, pendingSync, syncOutcome}` (`:362-368`) — a word on the response is discarded before any reload could show it, and the replay path returns **before** the wall read by ADR-0026 decision 4's design. That is ADR-0033's rejected-list argument, transferred verbatim. The **server segment** cannot carry it either: `/termo/concluido` renders for players who have **not** finished, so a server-computed answer would turn a bookmarkable page into a spoiler channel (ADR-0034 decision 3, ADR-0004).

**Two honest gaps, named rather than hidden.** (i) A player who finished on another device sees the `empty` conclusion — no record, no answer. That is ADR-0031's monotone rule working as designed, not a defect. (ii) On a **loss** there is no client-side path to the answer at all; deriving the canonical from `TERMO_ANSWERS` would work only on a win, which is why one rule (always from the response) beats two.

### 6.1 The win stamp: time-and-hints vs the guess count — **paper D wins**

| Paper | Position |
|---|---|
| C (§2.5, §3.5) | Redesigns only the **loss** stamp. The win keeps the shipped `result` branch: `.stampLabel` "Concluído", `.stampTime` `formatElapsed(elapsedMs)`, `.stampHints` `messages.conclusion.hints(0)` → "sem dicas" |
| D (D4.4, D7.5) | **No time and no hint claim on a Termo stamp, either outcome.** The stamp shows the guess count in the time's place |

**Paper D wins, on two arguments paper C did not have in view.** "sem dicas" would present as a *virtue* something that was never possible on this game (ADR-0045 decision 1 removes the hint entirely), and an elapsed time on a game with a server round trip per guess is dominated by latency and by the player walking away between guesses — a number no statistic will ever reflect (#29's Termo statistic is the guess distribution, `CONTEXT.md`'s **Played** row). Paper C's own message tree already carries the guess count (`answer.won: (used, max) => "Você acertou em ${used} de ${max} tentativas."`), so the two papers agree on the *content*; they disagree only on which element carries it.

**Consequence for the mechanism.** Paper C's `loss?: ConclusionLoss` is generalised to **one** optional prop `outcome?: ConclusionOutcome` that serves both Termo outcomes; **§14.6** carries the merged type. The shipped three games pass nothing and are byte-identical. `ConclusionResult` is **still** passed on a win (the `result` branch gates on `stamp !== undefined`, `conclusion-view.tsx:106`), carrying an `elapsedMs` and a `hintsUsed: 0` that nothing renders. ADR-0043 is written against the merged shape, **not** against paper C's `ConclusionLoss`.

### 6.2 The hub tile: `em 4/6` vs an elapsed time — **paper D wins, and the deviation is stated as one**

Paper D D3.7 defers `DayEntry.guesses` to #29. `HubCardAction` (`apps/web/app/hub-day-state.tsx:91-114`) renders `formatElapsed(elapsedMs)` for every game, so a **won** Termo will show `em 07:12` on the hub where `docs/design/006-handoff-design-winner-atelie/f1-hoje-desktop.dc.html:63` draws `result:'em 4/6'` and `README.md:83` writes *"Termo feito 4/6"*.

**This is a deliberate, visible deviation from a design reference, and #27 ships it.** Say it in those words in the PR. Three reasons:

1. A third `DayEntry` field with a second cross-invariant, in the module every route carries, **in the same PR that already reshapes `DayEntry` and `HubCardAction`**, is scope no AC asks for.
2. The guess count is **#29's** fact. The guess distribution ticket owns it server-side, and threading it through `DayEntry` for one tile creates the second derivation ADR-0031 decision 1 forbids (*"Nothing else derives completion"*).
3. It is a *win*-only deviation. A **lost** Termo shows no time at all (P41: `elapsedMs` is set iff `status === "completed"`), so the worse-looking case — a duration beside a loss — cannot occur.

The follow-up is filed **before the PR body is written** (§27 item 2, E0), so the PR's link is real at review time.

### 6.3 Two migrations claimed, one shipped — **different tables, correctly scoped**

| Paper | Migration |
|---|---|
| A (decision 17) | `completions` gains `guesses integer` **plus a CHECK**, applied to Neon **by hand** via `DATABASE_URL_UNPOOLED` |
| B (B3-9) | **None.** Explicitly rejects a partial unique index on `(content ->> 'normalized') where game='termo'` |

**No conflict: they are different tables.** `daily_puzzles` (paper B's) needs no migration — `packages/db/src/schema.ts:111` already lists `'termo'` in `daily_puzzles_game_check`. `completions` (paper A's) needs one for a **new column**, which is orthogonal to the game enum at `schema.ts:168`.

**Two things a reviewer will get wrong, so state both.** (i) Handoff 021 §5's *"No migration: `daily_puzzles` and `completions` already carry all four games in their enums and CHECK constraints, and `completions.outcome` already accepts `'lost'`"* is **narrowly about the game and outcome enums** and remains true. #27's migration adds a column those sentences say nothing about. (ii) `packages/db/src/schema.ts:148-149`'s *"EXTENSION POINT: #23/#25/#27 write through the same table and route; **no schema change is expected**"* becomes **false** and is corrected in the same commit — register item, §20.

**Migration scope, exactly:** `packages/db/migrations/0003_<drizzle-name>.sql`, `ALTER TABLE "completions" ADD COLUMN "guesses" integer;` plus `ADD CONSTRAINT "completions_guesses_check"`. Nothing else. §9 carries the shape and §21.4 the apply.

### 6.4 The timer on the play screen — **paper D wins**

Paper C's DOM (§3.5) renders `<TimerReadout className={screen.timerBar}/>` in the top bar **and** `<TimerReadout className={screen.timerCard}/>` in a two-row stats card ("Tempo" + "Progresso"). Paper D D7.3 renders **neither**.

**Paper D wins** for the reasons in §6.1 plus one that is a concrete benefit rather than a preference: `/termo` is **not** a fourth surface for issue #63's digit-swing defect (ADR-0036 decision 5), because it renders no `<TimerReadout/>` at all. #27 neither fixes #63 nor has to work around it.

**Three consequences carried into the design:**

- The stats card has **one** row — "Progresso" → "tentativa N de 6". Paper C's consequence *"(c) The stats card has two rows, not three"* becomes **one, not three**. `.timerCard` and `.timerBar` have no occupant on `/termo`, exactly as the `hint` grid area does under ADR-0045.
- `flat-type-hierarchy` (`checks.mjs:4132-4146`, fires when `max/min < 2.0` over ≥3 sizes) is **unaffected**, because the removed sizes are interior: at 1440 the population becomes 54 / 28 / 17 / 15 / 14 / 13 / 11 → **54/11 = 4.909:1** over 7 sizes; at 390 it becomes 34 / 24 / 15 / 13 / 11 → **34/11 = 3.091:1** over 5. `.timerBar` was `display: none` above 1140 anyway (`screen.module.css:88-92`).
- Whether the two empty named grid areas (`hint`, and the stats card's timer row) collapse cleanly at both bands is a **browser** fact, not a jsdom one. §26 item 3 carries it with a pre-agreed response: a Termo-only `grid-template-areas` override **inside Termo's own module**, never an edit to the shared `screen.module.css` bands.

### 6.5 The record's guess shape: parallel arrays vs paired rows — **paper D wins**

Paper A's ADR-0039 decision 5 sketches `guesses: string[]` **plus** `tiles: TermoTiles[]` as parallel arrays and no `outcome`. Paper D's D1.2/D1.6 specifies `guesses: { guess, tiles }[]` plus `outcome`.

**Paper D wins, and paper A defers to it in its own text** (*"the paper that owns `play-record.ts` owns the rest and the tests"*). Paired rows are structurally the engine's `EvaluatedGuess` (`packages/games/src/termo/keyboard.ts:4`), so `deriveKeyboardState(record.guesses)` reads the record with no adapter; parallel arrays need a length cross-refine and let a hand-edited store desynchronise them. `outcome` is added on paper D's blast-radius argument (P40) — `day-state.ts` must never import a game engine.

**What survives from paper A unchanged:** the un-judged in-flight guess is not persisted; `answer` is written only on the closing write; `sameToTheReader` gains the guess count; and Termo's `T-WEB-S64` analogue asserts **`answer`**, not `guesses`.

### 6.6 `FORBIDDEN_DAILY_KEYS`: two new members vs none — **paper B wins**

Paper B B1-6 adds `"canonical"` and `"normalized"`. Paper D D8.5 adds **nothing**, arguing `"answer"` at `testing.ts:32` already covers it.

**Paper B wins.** Termo's stored content keys are `canonical` and `normalized`; a projection that flattened the stored shape to top-level keys would pass every scan with `"answer"` alone — precisely the vacuity ADR-0033 decision 3 refused for `"reveal"`, and precisely the argument `testing.ts:13-16` already records for `clueCount` (*"it appears in no shipped payload, so every landed scan kept passing unchanged — adding it is what makes the scan meaningful for the game whose content actually carries it"*).

**The cost is real and is accepted on the `"name"` precedent.** `FORBIDDEN_DAILY_KEYS` is **two bans in one array** (`testing.ts:19-28`): a key scan in ten consumers **and** a rendered-HTML **substring** ban in three page suites. `"canonical"` is a Next.js metadata idiom — `alternates: { canonical }` renders `<link rel="canonical">` — and ADR-0013 makes `miolos.app` a canonical domain, so a future SEO ticket would red those suites for a reason unrelated to any leak. ADR-0040 consequence (d) names that failure and instructs the author who meets it: rename the markup or amend the list with a written reason, **never** weaken the scan. Verified clean today: `apps/web/app/layout.tsx:28-34` sets only `metadataBase`, `title`, `description`; no `alternates`, no `rel="canonical"`, and no CSS-module local matching either substring.

**`testing.ts:9-11`'s TSDoc is half true either way** — #27 *does* extend the list, but with `canonical`/`normalized`, not with `"answer"` (already at `:32`). Register item, §20.

### 6.7 The conclusion's reveal element collides with the substring ban — **a new finding; paper C renames**

Paper C names the reveal `.answerRow` / `.answerResult` / `.answerLead` / `.answerWord` (§3.3, §3.5). Paper D **measured** (D8.4) that under this repo's vitest config CSS-module locals resolve to `_<localName>_<hash>` and therefore appear **verbatim in the rendered markup**:

```
screen.hint         = "_hint_eec582"
board.anythingAtAll = "_anythingAtAll_5d3801"
```

`"answer"` is already a `FORBIDDEN_DAILY_KEYS` member (`testing.ts:32`), and the substring half asserts `expect(renderToStaticMarkup(element)).not.toContain(forbidden)`.

**Neither paper flagged the collision.** It is not live *today* — the substring half runs only in the three **play**-page suites, `.answerRow` lives in `conclusion-view.module.css`, and paper D's new `termo-page.test.tsx` renders `/termo`'s not-hydrated skeleton. But it is a trap one ticket away, and the fix is free at plan time.

**Resolution: every reveal-element local is renamed off the banned substrings.** `.dayWordRow` / `.dayWordResult` / `.dayWordLead` / `.dayWord`. Checked against the post-#27 ban list — `solution, seed, reveal, answer, clueCount, motifId, name, mirrored, canonical, normalized` — none of the four contains a member, and neither does any other name on the Termo tree (§12.7 audits all 24). The **TypeScript** interface may stay `ConclusionAnswer`: a type name never renders. §24.3 N40 carries it as a standing landmine.

### 6.8 The #68 conversion must precede `playRoutes.termo` — **both papers agree; the plan makes it a commit ordering**

Paper C C1.5 lands the conversion "in commit 1, alone, before any Termo code"; paper D D6.2 states it as a hard blocking dependency (*"#27 may not land the route key without the #68 treatment in the same PR"*). They agree on the substance.

**Paper D's "in the same PR" is the half that did not survive step 3, and the ordering is now expressed as a PR boundary rather than as a commit position** (§21.0, decision D-SPLIT): **the conversion is PR A's commit A2 and is MERGED before PR B exists; `playRoutes.termo` is PR B's commit B9.** The dependency is stronger this way, not weaker — a commit ordering can be broken by a rebase, a merged PR cannot — and it obeys `CLAUDE.md`'s "one branch per issue", which paper D's version does not: the conversion closes **#68**.

Two other rules outrank commit-position preference and still hold inside PR B: **commit B1 is the docs commit** (landmine 13: a missing `docs/README.md` row has been a blocking finding six times), and **an ADR's amendment lands in the ADR's own commit** — so ADR-0041's `DESIGN.md`/`PRODUCT.md` edits are in **A1**, not B2 (plan 020 §3's ADH-1/ISS-6 rule: *"'X is amended' means X was **edited**"*). Paper C's real requirement — that the eleven declarations are *independently reviewable and independently revertible*, and that `npx impeccable detect` is re-run on all seven existing routes before any Termo code exists — is satisfied more completely by a separate PR than it was by a separate commit.

### 6.9 The compile-error tripwires, and the order they must fire in

Paper A narrows `storedSolution`; paper D touches `sync.ts`'s `buildBody`. Both are fail-closed by design, and both make a *contract* commit un-landable on its own. Pre-commit is `pnpm exec lint-staged && pnpm typecheck && pnpm test` and is **never** bypassed, so "a commit lands green" is a hard constraint, not a preference. Verified against the tree:

| Tripwire | Fires when | Must land in the same commit as |
|---|---|---|
| `stripDailyContent`'s termo arm | `daily-contract.test.ts:99-103` asserts the throw | the arm itself (**B3**) |
| `T-LINT-S7` (`eslint-db-wall.test.ts:280-331`) derives the ban list from `daily-content.ts`'s exports | `termoDailyContentSchema` is exported | `eslint.config.mjs:299-305` (**B3**) |
| `T-DB-9c` (`published.test.ts:527`, the publishing entry's exact export list) and `T-DB-S5` (`:552`, `toHaveLength(24)` → `25`) | `listUsedTermoAnswers` is exported | both test updates (**B4**) |
| `cron-contract.test.ts:36-43`, `:129-134` | the two `strictObject`s widen | the two routes' object literals (**B4**) |
| **`storedSolution`'s non-exhaustive switch (TS2366)** and **`body.grid` at `:220`/`:233`** | `termoCompletionRequestSchema` joins `completionRequestSchema` | the route restructure (**B5**). **This is why `packages/core`'s completion contract cannot ride B3 with the daily contracts** — exactly the split plan 020 §21.2 made for the same reason |
| `completion-contract.test.ts:190-193` (asserts `game:"termo"` **fails**) | same | the retarget, in **B5**. That is the **third** retarget of the same `it` (`:185-188` records the first two) and the PR must say so |
| **The `termo-guess.ts` ⇄ `completion.ts` ESM cycle** (§8.0) — **not a compile error and not a test failure; a `ReferenceError` at import in every `@miolos/core` consumer** | `termoGuessRequestSchema` names `calendarDateString` while `termoCompletionRequestSchema` names `termoGuessWordSchema` | **`calendarDateString`'s move into `contracts/daily.ts`, in B5, written BEFORE either schema.** The sharpest tripwire in the ticket *and the only one with no automatic detector* — reproduced at step 4, including the fact that **vitest does not surface it** (its SSR transform hands the circular binding over as `undefined`, so the module bodies complete and the failure moves to first-parse). **A green `pnpm test` is not evidence the cycle is absent.** P-b in §26 is the check that is |
| **`sync.ts:270`'s `const unhandled: never = record`** | `termoPlayRecordSchema` joins `playRecordSchema` | `buildBody`'s `case "termo"` (**B6**) |
| `DayEntry.concluded` ceasing to exist | `day-state.ts` reshapes | all eight consumers **and** `day-state.test.ts:173` / `:99-108` (**B6**) |

**The rule the build-up follows:** every tripwire is satisfied inside the commit that arms it. §22's table assigns each to a build step; §21.2's commit table repeats the assignment so neither can drift from the other (plan 020 TR-7 caught exactly that contradiction).

### 6.10 ADR numbering — three papers, overlapping claims

Paper A claimed 0038/0039. Paper B claimed 0040 and **released 0041**. Paper C claimed **0042, 0043 and 0046** (skipping 0044/0045 for paper D). Paper D claimed 0044/0045. The gap at 0041 and the jump to 0046 leave the sequence non-contiguous, and `docs/adr/` is contiguous `0001`…`0037` today.

**Resolution: eight ADRs, contiguous, 0038–0045, allocated in decision order.** Paper C's three renumber: `0042 → 0041`, `0043 → 0042`, `0046 → 0043`. **Every internal cross-reference inside those three documents renumbers with them** — ADR-0042's `Depends on` line, ADR-0043's `Depends on` line, and the four in-body links between them. §23 carries the roster and the exact filenames.

---

## 7. The engine surface #27 consumes

`packages/games/src/termo/index.ts`, 30 lines, re-exporting exactly this. **Never a deep import** (ADR-0019). Specifier: `@miolos/games/termo`, mapped at `packages/games/package.json:12`.

| Symbol | Kind | Defined at | Notes for #27 |
|---|---|---|---|
| `normalizeWord(word: string): string` | fn | `normalize.ts:14-19` | `toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "")`. `ç → c` falls out of NFD. `\p{Mn}` deliberately, not `\p{M}` — parity with `content/termo/pipeline.py` |
| `evaluateGuess(guess, answer): TileStates` | fn | `evaluate.ts:31-83` | **Throws `RangeError`** if either input fails `^[a-z]{5}$` *after* normalization (`:34-43`). Two-pass count accounting for duplicate letters |
| `WORD_LENGTH = 5` | const | `evaluate.ts:13` | `SHAPE` is built from it at `:17`, so message and check cannot disagree |
| `TileState = "correct" \| "present" \| "absent"` | type | `evaluate.ts:3` | The three words the pt-BR copy maps to *certa* / *na palavra* / *fora* |
| `TileStates` | type | `evaluate.ts:5` | `readonly [TileState × 5]` |
| `deriveKeyboardState(guesses: readonly EvaluatedGuess[]): KeyboardState` | fn | `keyboard.ts:23` | Best-of per letter, precedence `correct(2) > present(1) > absent(0)`; pure; keys normalized at `:28`. **Letters never guessed are absent from the map**, not `"absent"` |
| `EvaluatedGuess { guess, tiles }` | type | `keyboard.ts:4` | **The play record's row shape is this** (P38) |
| `KeyboardState = Readonly<Partial<Record<string, TileState>>>` | type | `keyboard.ts:10` | |
| `deriveBoardStatus(rows: readonly TileStates[]): TermoBoardStatus` | fn | `status.ts:22-40` | **Throws `RangeError`** for `rows.length > MAX_GUESSES` (`:25`) **and** for any row following an all-correct row (`:31-36`). Both are guarded before the call server-side (P31) and made unparseable client-side (§14.1's `superRefine`) |
| `MAX_GUESSES = 6` | const | `status.ts:3` | |
| `TermoBoardStatus = "playing" \| "won" \| "lost"` | type | `status.ts:11` | **Board** status, not day status |
| `isValidGuess(word: string): boolean` | fn | `word-list.ts:33-35` | Module-level `Set`, O(1). Normalizes its input. Non-5-letter input returns `false`, no throw |
| `TERMO_ANSWERS: readonly TermoAnswer[]` | const | `word-list.ts:16-20` | 400, in `answers.csv` row order, **order contractual**. Frequency-descending, not alphabetical |
| `TERMO_VALIDATION_WORDS: readonly string[]` | const | `word-list.ts:23-25` | 5 310, sorted, unique, US-ASCII |
| `TermoAnswer { canonical, normalized }` | type | `word-list.ts:4-7` | `termoDailyContentSchema` mirrors it field for field (P1) |

**The harness gate** (AC 1's *"only after the harness gate"*) is `packages/games/test/termo/word-list.test.ts`, 172 lines, whose header at `:15-17` says it verbatim: *"This gate is what allows #27 to trust `@miolos/games/termo` as the sole ingestion path for the list."* Nine `it`s over the real `content/termo` artifacts, including the byte-identity staleness gate at `:130-144` and the renderer-independent anchor at `:166`. It runs on every `pnpm test` and every pre-commit. **#27 cites it; #27 does not rebuild it.**

**Data on disk**, all LF (`.gitattributes:6`): `answers.csv` 401 lines / 4 874 bytes / UTF-8 / **49 canonicals carry a diacritic**; `validation.txt` 5 310 lines / 31 860 bytes / **US-ASCII**; `canonical-map.csv` 5 311 lines / 64 363 bytes — **harness input only, does not ship.** That last fact is why §6.0 hop 1 is load-bearing and why the record stores **normalized** guesses (there is no runtime path to the accented spelling of an arbitrary guess).

---

## 8. `packages/core` changes

### 8.0 The module graph — `calendarDateString` moves, and it is not optional

**Without this move, `@miolos/core` throws a `ReferenceError` at import in every consumer.** The plan as drafted creates a two-module ESM cycle: `contracts/termo-guess.ts` takes `calendarDateString` from `contracts/completion.ts` (§11.1's `termoGuessRequestSchema`), while `contracts/completion.ts` takes `termoGuessWordSchema` and `TERMO_MAX_GUESSES` from `contracts/termo-guess.ts` (§11.2's `termoCompletionRequestSchema`). Import declarations hoist and `const` bindings are in TDZ until their module body runs, so whichever module the loader enters first evaluates a module-scope `z.strictObject(...)` naming a binding the other has not initialised yet.

**Reproduced, not reasoned** — three files with the real installed zod, `zod 4.4.3` from `packages/core/node_modules`, Node v24.18.1:

```
$ node -e "import('./completion.mjs')"    ⇒ ReferenceError: Cannot access 'calendarDateString' before initialization
$ node -e "import('./termo-guess.mjs')"   ⇒ ReferenceError: Cannot access 'termoGuessWordSchema' before initialization
$ node -e "import('./index.mjs')"         ⇒ ReferenceError: Cannot access 'calendarDateString' before initialization
```

The barrel case is the one that matters: `packages/core/src/index.ts` re-exports both modules, so **every** `@miolos/core` consumer — `apps/api`'s routes, `apps/web`'s client graph — dies on import.

**And the worst part: `pnpm test` would NOT have caught it.** Measured under this repo's own runner (vitest 4.1.10, vite's SSR transform): with static top-level imports of both modules, **both module bodies complete and the test passes**. The circular binding simply arrives as `undefined`, and `z.strictObject({ date: undefined })` is accepted at *construction* time; the failure moves to the first `.parse()`, as `Error: Invalid element at key "date": expected a Zod schema` from `zod/v4/core/schemas.js`. So the defect would have shipped as a green suite plus a runtime 500 on the first real request — which is why the probe below is a **`tsx` process**, never a test.

**The fix is one edge, one direction.** `calendarDateString` is defined at `packages/core/src/contracts/completion.ts:37-45` and its **only** dependency is `isoDateString`, which lives in `contracts/daily.ts:41`. Move the whole block — the 32-line TSDoc at `:7-36` and the `refine` at `:37-45` — to `contracts/daily.ts`, immediately after `isoDateString`. Verified against the tree:

- **`contracts/daily.ts` imports nothing but `zod`** (`:38` is its only `import`), so the move adds **no** edge to it and cannot create a second cycle.
- **`contracts/completion.ts` already imports from `./daily`** (`:5`, `isoDateString, nonogramSizeSchema, sudokuDigitSchema`), so it gains a name on an existing import, not a new edge.
- The resulting graph is a DAG: `completion.ts → termo-guess.ts → daily.ts`, and `completion.ts → daily.ts`. `termo-guess.ts` imports `isoDateString` **and** `calendarDateString` from `./daily` and nothing from `./completion`.
- **The public surface does not change.** `packages/core/src/index.ts:70` exports `calendarDateString` today from its `./contracts/completion` block; it moves to the `./contracts/daily` block beside `isoDateString` (`:35`), alphabetically before `dailyBinairoResponseSchema`. `packages/core/test/completion-contract.test.ts:6` imports it from `../src/index` (the barrel), so **that file needs no edit** — verified by reading its import list at `:1-15`.
- `grep -rn "calendarDateString"` over `apps` and `packages` returns **no other consumer**: five in `completion.ts` itself, seven in `completion-contract.test.ts` (all through the barrel), one comment in `apps/api/test/completions.test.ts:544`, and the barrel line. Nothing deep-imports it.

**Commit:** the move rides **commit B5** with `termo-guess.ts`, because that is the commit that would otherwise arm the cycle — and it is written **first inside that commit**, before either schema exists (§22 step 4). It is a pure move — no behaviour change, no test change — and the PR says so in one line so a reviewer does not read a 40-line diff in `daily.ts` as a redesign.

**Probe it first anyway** — §26's step-5 preflight list carries the two-line reproduction, because the cheapest way to be sure the fix worked is to run the failing case before and after.

### 8.1 `src/contracts/daily-content.ts` — the content schema

Placed **here, not in `daily.ts`**: `daily.ts:1-37` records the measurement that a module-scope `z.strictObject(...)` is a call the bundler cannot prove pure, so content schemas were retained in the browser chunk of all eight routes until commit `d5bb543` split them.

```ts
/**
 * Server-side shape of `daily_puzzles.content` for termo — mirrors
 * `TermoAnswer` (packages/games/src/termo/word-list.ts:4-7) exactly and
 * carries nothing else. Strict for the same fail-closed reason
 * `binairoDailyContentSchema` is, with the same operational corollaries.
 *
 * THREE ABSENCES, each deliberate, because each is the obvious thing to add
 * and each would be wrong (ADR-0040):
 *
 * - NO `index`. The word is stored, never its position in `TERMO_ANSWERS`.
 *   The order is contractual (word-list.ts:9-15) but ADR-0015's own remedy
 *   for a bad word is to REGENERATE the list, and a regeneration can
 *   reorder. Rows are immutable and the buffer is up to 30 days deep
 *   (remoteConfigSchema's clamp, ADR-0025), so an index would let one
 *   content commit silently rewrite a month of unpublished answers and
 *   retroactively change what every archived row meant — with every gate
 *   green. Storing the word makes a regeneration a no-op for every existing
 *   row, which is ADR-0024 decision 1's "an engine redeploy must never
 *   change a published puzzle mid-day".
 *
 * - NO `seed`. The other three carry one because their ENGINES emit one and
 *   it regenerates the puzzle. Termo's pick is a rejection draw over a
 *   RUN-SCOPED eligible pool, so replaying the same uint32 against a
 *   different pool yields a different word: a stored seed here would
 *   reproduce nothing and would invite a future reader to try. The
 *   `daily_puzzles.seed` COLUMN still receives the accepted draw — the
 *   entropy this row was written from, and nothing more.
 *
 * - NO `game` literal. Nonogram's exists only because its engine writes one
 *   (generate.ts:48); binairo's and sudoku's do not. Every read is already
 *   keyed by `game` in SQL (published.ts's wallPredicate).
 *
 * `normalized` is stored though it is derivable, and the reason is the
 * no-repeat rule: it is `^[a-z]{5}$` by the word-list harness
 * (packages/games/test/termo/word-list.test.ts:75), so `listUsedTermoAnswers`
 * compares pure ASCII and cannot be defeated by a jsonb round-trip that
 * composes a diacritic differently. `canonical` is the reveal (#27 AC 2);
 * nothing else in the runtime can recover an accented spelling, because
 * `content/termo/canonical-map.csv` is harness input and does not ship.
 *
 * `.length(5)` and not a pt-BR charset regex: the DIMENSION check, matching
 * `WORD_LENGTH` (evaluate.ts:13) and pinned to it by T-CORE-S18. A charset
 * regex would fail every insert if a regeneration ever introduced `à`, `ô`,
 * `õ` or `â` — all in the domain `test/termo/arbitraries.ts:9` declares,
 * none present in today's 400. Membership in `TERMO_ANSWERS` is the
 * rule-validity half; it holds by construction at the single write site
 * (`topUpTermoBuffer`) and is pinned by T-CORE-S17 over all 400, because
 * `@miolos/games` is a DEV dependency of this package (package.json:19) and
 * `src/` may not import it.
 */
export const termoDailyContentSchema = z.strictObject({
  canonical: z.string().length(5),
  normalized: z.string().regex(/^[a-z]{5}$/),
});

export type TermoDailyContent = z.infer<typeof termoDailyContentSchema>;
```

**The strip table row** (`daily-content.ts:146`), rewritten in the same commit:

```
 * | termo    | `game, date` only             | the answer word, in any field; guesses are judged server-side                  | #27 (this file)      |
```

### 8.2 `src/contracts/daily.ts` — the response schema and the union

```ts
/**
 * The public daily-termo projection: TWO keys, and that is the whole
 * contract. The three grid games ship the inputs a player needs; a Termo
 * player needs nothing but the date, because the board starts empty and
 * every guess is judged server-side (ADR-0038). So this schema's job is
 * entirely negative — `z.strictObject` with exactly `game` and `date` makes
 * "the answer word, in any field" (the strip table, ./daily-content.ts) a
 * PARSE FAILURE at the wall and again at the HTTP boundary, rather than a
 * rule kept by review.
 *
 * It carries no content and is still a full union member: that is the only
 * thing that widens `ProjectedGame` below, and without it
 * `getTodayDaily(db, "termo")` cannot compile and `/daily/termo` cannot
 * exist without reaching around the wall.
 */
export const dailyTermoResponseSchema = z.strictObject({
  game: z.literal("termo"),
  date: isoDateString,
});

export type DailyTermoResponse = z.infer<typeof dailyTermoResponseSchema>;

export const dailyPuzzleResponseSchema = z.discriminatedUnion("game", [
  dailyBinairoResponseSchema,
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
]);
```

**What widening `ProjectedGame` unlocks — verified, nothing else.** `grep -rn "ProjectedGame"` returns exactly four source hits: the definition (`daily.ts:208`), the re-export (`core/src/index.ts:43`) and the two bounds (`published.ts:64`, `:93`). `grep -rn "DailyPuzzleResponse"` finds **no exhaustive `switch` anywhere** — the three screens each took a *narrowed* prop deliberately (`sudoku-screen.tsx:22`, `nonogram-screen.tsx:24`, `binairo-screen.tsx:23` all record rejecting the union-taking shape). So the widening unlocks exactly `getTodayDaily(db,"termo")` and `getPublishedDaily(db,"termo",date)`. **This is a grep, not a typecheck** — §26 item 7.

`ProjectedGame`'s TSDoc (`daily.ts:199-207`) is now false in every sentence and is rewritten in the same commit — register item, §20.

### 8.3 The `stripDailyContent` arm

Replacing `daily-content.ts:197-198`. **There is no `default:` in this switch and there must not be one** (handoff 021 §2: *"keep the exhaustiveness or a forgotten game stops being a compile error"*).

```ts
    case "termo": {
      // The projection carries NOTHING from the row — the strip table's
      // termo row, made mechanical. An answer is not a board and a guess is
      // judged server-side (ADR-0040, ADR-0038).
      //
      // The content is parsed anyway, and strictly: with an empty projection
      // the 200 IS the whole message, so it has to mean "playable", not
      // merely "a row exists". A drifted row 500s here (getTodayDaily does
      // not catch — published.ts:64-86) rather than serving a date the game
      // cannot be played on. That is also the mechanism that makes a
      // post-seeding schema change loud rather than silent (plan 022 §21.4).
      //
      // This is not a confidentiality boundary and must never be argued as
      // one (ADR-0027:125-131). The answer is absent because the client has
      // no use for it, not because we are defending it.
      termoDailyContentSchema.parse(content);
      return dailyTermoResponseSchema.parse({ game: "termo", date });
    }
```

**`DailyProjectionUnsupportedError` becomes unreachable and STAYS EXPORTED.** It is in the `apps/web` ESLint `importNames` ban (`eslint.config.mjs:301`) and in `T-LINT-S7`'s derived name set, both of which fail on its removal. Its own TSDoc (`daily-content.ts:120-131`, *"for games whose projection is not implemented yet"* — there are none) becomes false and is corrected in the same commit — register item.

**Retargeted test.** `packages/core/test/daily-contract.test.ts:99-103` currently asserts the throw and is replaced by a `describe("stripDailyContent (termo)")` block, following the comment convention the file already uses twice at `:90-97`.

### 8.4 `src/testing.ts`, `src/index.ts` and the ESLint wall

`FORBIDDEN_DAILY_KEYS` (`testing.ts:29-42`) gains two members, with the cost written down where the author who meets it will find it:

```ts
  // #27 (ADR-0040): termo's stored content is `{canonical, normalized}` and
  // those are the two keys that carry the answer. `"answer"` above is not
  // enough on its own — a projection that flattened the stored shape to
  // top-level keys would pass every scan, the exact vacuity ADR-0033
  // decision 3 refused for `"reveal"`.
  //
  // `"canonical"` is a GENERIC key and Next names one: `alternates.canonical`
  // renders `<link rel="canonical">`, and ADR-0013 makes miolos.app a
  // canonical domain, so an SEO ticket would red the page suites' SUBSTRING
  // half for a reason unrelated to any leak. That is the cost of the ban and
  // it is accepted on the `"name"` precedent above; the response is to
  // rename the markup or amend this list with a written reason, never to
  // weaken the scan.
  "canonical",
  "normalized",
```

`packages/core/src/index.ts` re-exports `termoDailyContentSchema`, `TermoDailyContent`, `dailyTermoResponseSchema`, `DailyTermoResponse`, and (in commit **B5**) the `termo-guess.ts` surface. **`calendarDateString`'s existing export line moves within this file too** — out of the `./contracts/completion` block at `:70` and into the `./contracts/daily` block beside `isoDateString` at `:35` (§8.0). The exported name set does not change.

**`eslint.config.mjs:299-305`'s `importNames` gains `termoDailyContentSchema`, alphabetically after `sudokuDailyContentSchema`.** It must stay in **that same config object**: `:293-298` warns that flat config **replaces** a rule's whole configuration, so a second `no-restricted-imports` object globbed at `apps/web` would silently delete the `@miolos/db` wall above it. **`termo-guess.ts`'s exports must NOT be added** — they are client-safe by design and `apps/web` imports them.

---

## 9. `packages/db` changes

### 9.1 The one migration — `completions.guesses`

```ts
// packages/db/src/schema.ts — inside the `completions` column block
/**
 * The number of guesses a Termo completion took. NULL for every other game,
 * and NULL is the only legal value for them (see the CHECK below).
 *
 * WRITE-ONLY IN #27, deliberately. `getCompletion`'s projection
 * (completions.ts:48-56) does not select it, so `CompletionRecord` does not
 * grow and `completionResponseSchema.parse({ ...record, recorded })` — a
 * z.strictObject at completions/route.ts:63-71 — cannot break on an
 * unexpected key. Widening the record would have thrown on EVERY completion
 * in the app. #29 adds the projection when it needs it.
 *
 * It cannot be deferred to #29: ADR-0026 decision 1 makes the row write-once
 * (`ON CONFLICT DO NOTHING`, never `DO UPDATE`), so a row written before the
 * column exists can never be backfilled, and every Termo day played between
 * #27's deploy and #29's would be permanently absent from the guess
 * distribution ADR-0008 rule 3 requires.
 */
guesses: integer("guesses"),
```

and, in the `(t) => [...]` block alongside the existing four checks:

```ts
    check(
      "completions_guesses_check",
      sql`(${t.game} = 'termo') = (${t.guesses} is not null)
          and (${t.guesses} is null or ${t.guesses} between 1 and 6)`,
    ),
```

**The equality form is deliberate and stronger than a permissive `IS NULL OR …`**: it makes a termo row **without** a count and a grid row **with** one both impossible. Existing rows satisfy it (`false = false`). The literal `6` matches house style — the shipped CHECKs spell their values out in the `sql` template (`schema.ts:166-172`) — and importing `MAX_GUESSES` into `packages/db` would drag the 40 KB word list into a package that has **no** games dependency at all (`packages/db/package.json`; `packages/db/test/fixtures.ts:5` records keeping it that way deliberately).

**`recordCompletion`'s input gains `guesses?: number`** (`packages/db/src/completions.ts:78-88`); `.values()` passes it through and drizzle writes NULL when absent (**§26 item 4** — not exercised here). `getCompletion` and `CompletionRecord` are untouched (P35).

**Generation:** `pnpm --filter @miolos/db db:generate` produces `packages/db/migrations/0003_<drizzle-name>.sql`. It is committed in **commit B5** and **applied by hand the moment B5 is pushed** — §21.4(a), which also carries the rollback and the standing `drizzle-kit migrate` warning. **Not a step-8 item:** a `main` deployed before the apply 500s `POST /completions` for **all four games**, with the generated SQL pasted there as evidence.

**Two syntax facts are UNVERIFIED and are probed before the code that depends on them is written** — §26 items 2 and 3.

### 9.2 `listUsedTermoAnswers` on `@miolos/db/publishing`

```ts
/**
 * Every termo answer any row has ever claimed, as normalized forms — the
 * no-repeat rule's used-set (ADR-0040). THE FIRST top-up read-back of
 * stored `content` in this package; every sibling reads dates
 * (listBufferedDates, buffer.ts:35-45) or counts (bufferDepth, :79-91).
 * Do not "harmonise" it away.
 *
 * NO date filter and NO killed_at filter, deliberately, and for a stronger
 * reason than `listBufferedDates`' (ADR-0024 D14): a killed date's answer
 * may already have reached players, and a past date's certainly did. An
 * answer is spent forever, not for a window.
 *
 * `normalized` and not `canonical`: it is `^[a-z]{5}$` by the word-list
 * harness (packages/games/test/termo/word-list.test.ts:75), so the
 * comparison is pure ASCII and cannot be defeated by a jsonb round-trip
 * that composes or decomposes a diacritic differently.
 *
 * Bounded by the word list, forever: the exhaustion rule stops writing at
 * 400 answers, so this scans at most ~400 rows of ~50-byte content and
 * returns ~2.4 KB, because `->>` projects server-side. No index is owed on
 * `daily_puzzles`, which has none beyond its composite PK (schema.ts:110).
 * Revisit only if a second game needs a content read-back.
 */
export async function listUsedTermoAnswers(db: Db): Promise<string[]> {
  const rows = await db
    .select({
      answer: sql<string | null>`${dailyPuzzles.content} ->> 'normalized'`,
    })
    .from(dailyPuzzles)
    .where(eq(dailyPuzzles.game, "termo"));
  return rows
    .map((row) => row.answer)
    .filter((answer): answer is string => answer !== null);
}
```

Exported from `packages/db/src/publishing.ts`, alphabetically inside the `./buffer` group. **Two tripwires fire and both must be updated in the same commit** (§6.9): `T-DB-9c` at `published.test.ts:527` (the publishing entry's exact export list, 9 → 10 names) and `T-DB-S5` at `:552` (the union across all four subpaths, `toHaveLength(24)` → `25`).

**Rejected: a generic `listBufferedContents(db, game): Promise<unknown[]>`.** It widens `@miolos/db/publishing` with a reader that hands back **solution-bearing jsonb for any game** and pulls whole rows across the wire (a nonogram `reveal.solution` is a 15×15 boolean matrix); the narrow helper projects one six-byte value server-side. ADR-0024 decision 5 makes every name on that entry a pinned surface, so smaller is strictly better.

**UNVERIFIED, probe first:** that `content ->> 'normalized'` behaves identically on PGlite 0.5.4 and Neon (§26 item 1), and that drizzle 0.45.2 accepts `sql<string | null>` as a `.select({...})` projection over a jsonb column (§26 item 5; the fallback is `db.execute(sql\`…\`)`, matching `todaySaoPaulo`'s shape at `buffer.ts:20-27`).

### 9.3 Not touched in `packages/db`

`insertDailyPuzzle`, `listBufferedDates`, `bufferDepth`, `getPublishedDailyWithSolution`, `wallPredicate`, `getTodayDaily`, `getPublishedDaily`, `hint_grants`, `remote_config`, the `daily_puzzles` table and its CHECK. `packages/db/test/fixtures.ts` gains a termo fixture; `published.test.ts`'s surface tripwires come out with the **two** documented edits above and nothing else — landmine L5's shape: *"if one needs editing, something was added to the wrong surface."*

---

## 10. `apps/api` — publication

### 10.1 Constants and the uniform draw

```ts
/**
 * Remaining-answer count below which the run logs a warning. NOT an alert:
 * the alert channel is buffer depth (ADR-0010) and buffer-alert.yml, and
 * this line lands in Vercel logs that nothing polls. It exists because the
 * depth alert gives only ~3 days of runway for THIS failure mode (see
 * `topUpTermoBuffer`), and 30 remaining is ~30 days. The real fix is the
 * follow-up issue filed with this PR.
 */
const LOW_ANSWER_POOL_WARNING = 30;

/** The one reason a termo date can go uncovered that is not schema drift. */
const ANSWER_LIST_EXHAUSTED =
  "answer list exhausted: every curated Termo answer is already used";

/**
 * Termination bound on the uniform draw below — NOT a seed-retry budget.
 * `topUpTermoBuffer` has none of those and must never grow one (see its
 * TSDoc). P(one reject) is at most 96/2^32 = 2.24e-8 for n = 400, so
 * P(64 consecutive) is about 1e-491: this throw is unreachable, and it
 * ships because "unreachable" is an argument, not a type.
 */
const MAX_UNIFORM_DRAW_ATTEMPTS = 64;

/**
 * The largest multiple of `maxExclusive` that fits in a uint32 — the accept
 * region's exclusive upper bound. A draw < limit is accepted; anything at or
 * above it is rejected and redrawn.
 *
 * EXPORTED SOLELY SO T-API-S33 CAN BIND TO THE REAL BOUNDARY. Left as a
 * function-local, the only thing a test could do is recompute this
 * expression and assert it equals itself — a tautology that stays green
 * under a change to `randomUint32() % maxExclusive`, which is precisely the
 * implementation P15 rejects. Exporting it lets the test stub draws of
 * `limit - 1` (accepted), `limit`, `limit + 1` and `2**32 - 1` (all
 * rejected) and assert the DECISION rather than the arithmetic.
 */
export function uniformDrawLimit(maxExclusive: number): number {
  return Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
}

/**
 * A uniformly distributed index in [0, maxExclusive), plus the uint32 draw
 * that produced it (the value written to `daily_puzzles.seed`).
 *
 * Rejection sampling, not `randomUint32() % maxExclusive`. The bias of the
 * modulo is measurably nothing — 2^32 mod 400 = 96, so the worst residue is
 * 7.08e-8 too likely and the total variation distance from uniform is
 * 1.12e-8 — but rejection makes uniformity a CONSTRUCTION property (every
 * accepted value maps to exactly floor(2^32 / n) uint32s) instead of a claim
 * that has to be defended with those numbers every time someone reads it.
 * ADR-0023 reserves "prove" for exactly that difference. Expected draws:
 * 1.0000000224 at n = 400.
 *
 * NOT `createSeededRandom(...).nextInt(n)` (packages/games/src/random.ts:29-36):
 * that is `Math.floor(next() * n)`, the same granularity bias wrapped in a
 * splitmix32 round that adds nothing to CSPRNG output — and it would drag a
 * DETERMINISTIC generator into the one place ADR-0024 decision 1 requires
 * non-determinism.
 *
 * Exported so the tests bind to the real function (T-API-S33).
 */
export function drawUniformIndex(maxExclusive: number): {
  index: number;
  draw: number;
} {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
    throw new RangeError(
      `maxExclusive must be a positive integer, got ${String(maxExclusive)}`,
    );
  }
  const limit = uniformDrawLimit(maxExclusive);
  for (let attempt = 0; attempt < MAX_UNIFORM_DRAW_ATTEMPTS; attempt += 1) {
    const draw = randomUint32();
    if (draw < limit) {
      return { index: draw % maxExclusive, draw };
    }
  }
  throw new Error(
    `uniform draw did not converge in ${String(MAX_UNIFORM_DRAW_ATTEMPTS)} attempts`,
  );
}
```

### 10.2 `topUpTermoBuffer`

TSDoc, in full, because four of its structural deltas are the thing a reviewer will try to "harmonise" away:

```ts
/**
 * The termo sibling of `topUpBinairoBuffer` — the one this file's own TSDoc
 * said would not fit the family's shape (:112-119, :237-250), and it does
 * not: "Termo draws from a curated word list (ADR-0015), which is not a
 * seed -> generate -> weekday-validate loop."
 *
 * Everything binairo's top-up guarantees still holds: idempotent
 * reconciliation against the DB clock's SP-today, covered dates checked
 * FIRST, rows never touched once written (ADR-0024 D14), a fail-closed
 * strict content parse before insert, ON CONFLICT DO NOTHING, and a run that
 * records failures instead of aborting.
 *
 * FOUR STRUCTURAL DELTAS, and no others:
 *
 * 1. NO INNER ATTEMPT LOOP AND NO RETRY BUDGET, and that absence is
 *    load-bearing rather than an omission. There is no generator that can
 *    fail, no validator that can reject and no weekday ramp; the only
 *    non-throwing failure left is deterministic schema drift, which every
 *    sibling `break`s on. A `MAX_TERMO_SEED_RETRIES_PER_DATE` added later
 *    "for symmetry" would guard nothing. `drawUniformIndex`'s 64-attempt cap
 *    is a draw-termination bound, not a retry budget.
 *
 * 2. IT READS STORED `content` BACK — the first top-up in this package that
 *    does. `listUsedTermoAnswers` is the no-repeat rule: 400 answers under
 *    uniform independent picks collide with probability 0.505 inside 24 days
 *    (birthday problem, N = 400), so without it a repeat is the norm rather
 *    than the exception. Do not "harmonise" the read away.
 *
 * 3. THE POOL IS RUN-SCOPED. Built once and spliced on every successful
 *    insert, so two dates in the SAME run cannot draw the same answer — a
 *    collision the used-set read alone would not prevent, because it is
 *    taken before the first write.
 *
 * 4. EXHAUSTION FAILS CLOSED. There is no recycling branch and adding one is
 *    a product decision with its own ADR (ADR-0040 Rejected). When the pool
 *    empties, every remaining uncovered date lands in `failures`, the buffer
 *    drains one day per day, `depths.termo` falls below `effectiveThreshold`
 *    and buffer-alert.yml opens the issue — the same chain nonogram's
 *    schema-drift comment describes. Runway is only ~3 days, which is why
 *    `LOW_ANSWER_POOL_WARNING` exists.
 *
 * Measured cost (Node v24.18.1, n = 2000 after 200 warm-up, pool rebuilt
 * every iteration, TERMO_ANSWERS constructed once outside the timed loop
 * exactly as module init does it): a cold week (depth 7, empty buffer) is
 * 0.0193 ms of CPU; depth 7 with 350 used is 0.0338 ms; depth 30 empty is
 * 0.0424 ms; the absolute worst run — depth 30 at remoteConfigSchema's clamp
 * ceiling with 370 answers already used — is 0.0573 ms. Against binairo's
 * ~7 ms this is ~360x cheaper, which is what puts termo FIRST in the cron's
 * cost-ascending order (contracts/cron.ts:38-44).
 *
 * The honest asymmetry, in BOTH its figures because the smaller one reads as
 * the total: a sibling top-up costs THREE run-level Neon round trips
 * (todaySaoPaulo, listBufferedDates, the trailing bufferDepth) plus one per
 * insert; this one costs FOUR, because listUsedTermoAnswers is a read no
 * other top-up makes. So it is +1 round trip AGAINST A SIBLING, and +4 at
 * RUN LEVEL — the cron's fixed cost goes from 9 to 13 — against -7 ms of CPU.
 * Cost-ascending orders by GENERATION cost — a CPU overrun must never starve
 * a cheaper game — so termo is first on the rule as written.
 */
export async function topUpTermoBuffer(
  db: Db,
  depth: number,
): Promise<TopUpResult> {
  // Hoisted OUT of the try so a throw can still report them (TopUpAbortedError).
  let generated = 0;
  const failures: { date: string; reason: string }[] = [];
  try {
    const today = await todaySaoPaulo(db);
    const existing = new Set(await listBufferedDates(db, "termo", today));
    const used = new Set(await listUsedTermoAnswers(db));
    const pool = TERMO_ANSWERS.filter((answer) => !used.has(answer.normalized));

    if (pool.length < LOW_ANSWER_POOL_WARNING) {
      console.error(
        JSON.stringify({
          event: "termo-answer-pool-low",
          remaining: pool.length,
          total: TERMO_ANSWERS.length,
        }),
      );
    }

    // `depth` is already 1..30-clamped by remoteConfigSchema (ADR-0025) —
    // loop bounds never come from unclamped input.
    for (let offset = 0; offset < depth; offset += 1) {
      const target = addDays(today, offset);
      if (existing.has(target)) {
        continue;
      }
      if (pool.length === 0) {
        failures.push({ date: target, reason: ANSWER_LIST_EXHAUSTED });
        continue;
      }
      const { index, draw } = drawUniformIndex(pool.length);
      const answer = pool[index];
      if (answer === undefined) {
        // Unreachable: `index` is in [0, pool.length). The guard exists
        // because noUncheckedIndexedAccess is on (tsconfig.base.json:10) and
        // a non-null assertion would be a worse way to say the same thing.
        throw new RangeError(`answer pool index ${String(index)} is empty`);
      }
      // The frozen TERMO_ANSWERS element is parsed DIRECTLY, never a rebuilt
      // object: that is what makes a future `TermoAnswer` field addition fail
      // closed here instead of being silently dropped (ADR-0024).
      const content = termoDailyContentSchema.safeParse(answer);
      if (!content.success) {
        // Deterministic shape drift — no other answer can fix it, and there
        // is no retry loop to break out of. Fail closed for this date; every
        // other date fails identically, the buffer drains and the alert
        // fires. No answer is spent: nothing was written.
        failures.push({
          date: target,
          reason: `content schema rejected: ${content.error.message}`,
        });
        continue;
      }
      const inserted = await insertDailyPuzzle(db, {
        game: "termo",
        date: target,
        // Provenance only. This value REPRODUCES NOTHING: the pick is a draw
        // over a run-scoped pool, so replaying it against a different pool
        // yields a different word (ADR-0040 decision 3).
        seed: draw,
        content: content.data,
      });
      if (inserted) {
        generated += 1;
        // Spent only on a real write. A lost ON CONFLICT race means another
        // writer covered the date with ITS answer, so ours was never used and
        // stays eligible.
        pool.splice(index, 1);
      }
    }

    return { generated, depth: await bufferDepth(db, "termo"), failures };
  } catch (thrown) {
    // The trailing `bufferDepth` read is inside the try on purpose: it can
    // throw AFTER a full week was written.
    throw new TopUpAbortedError({ generated, failures }, thrown);
  }
}
```

Import additions at the top of `service.ts`: `termoDailyContentSchema` from `@miolos/core`, `listUsedTermoAnswers` from `@miolos/db/publishing`, `TERMO_ANSWERS` from `@miolos/games/termo`.

**Determinism is not a property here, and the plan says so.** "Same seed → same puzzle" is meaningless for termo: the pick is `crypto.getRandomValues`-driven **because** ADR-0024 decision 1 requires it not be reproducible. The invariant that replaces it is **"the answer stored is the answer served, forever"**, and its mechanism is row immutability plus P2, not a seed.

### 10.3 `packages/core/src/contracts/cron.ts` and the two routes

```ts
export const cronPublishResponseSchema = z.strictObject({
  games: z.strictObject({
    termo: cronPublishGameResultSchema,
    binairo: cronPublishGameResultSchema,
    nonogram: cronPublishGameResultSchema,
    sudoku: cronPublishGameResultSchema,
  }),
});

export const bufferDepthResponseSchema = z.strictObject({
  depths: z.strictObject({
    termo: z.number().int().min(0),
    binairo: z.number().int().min(0),
    nonogram: z.number().int().min(0),
    sudoku: z.number().int().min(0),
  }),
  threshold: z.number().int().positive(),
  shallow: z.boolean(),
});
```

`cron.ts:38-44`'s TSDoc is rewritten — register item — to: *"Keyed termo → binairo → nonogram → sudoku: the cron's COST-ASCENDING run order. It no longer reads alphabetically, and that is the point — a curated-word-list pick (ADR-0015, ADR-0040) is not a generate-and-validate loop at all, measured at 0.019 ms per cold week against binairo's ~7 ms. `GAMES` is now fully covered, so the strictness this schema exists for is pinned against an unknown key rather than a fifth game."*

`apps/api/app/cron/publish/route.ts:120-134` gains `termo: await runTopUp(db, "termo", topUpTermoBuffer, config.bufferDepth),` as the **first** property — there the `await` order **is** the execution order. `apps/api/app/buffer-depth/route.ts:28-32` gains `termo: await bufferDepth(db, "termo"),` first.

**Zero logic change to `effectiveThreshold` / `healthy` / `shallow`, verified line by line:** `effectiveThreshold(configuredDepth) = Math.min(BUFFER_ALERT_THRESHOLD, configuredDepth)` (`service.ts:82-84`) is game-independent; `healthy = Object.values(body.games).every(...)` (`cron/publish/route.ts:144-146`) iterates the **parsed** body; `shallow = Object.values(depths).some(...)` (`buffer-depth/route.ts:37`) likewise.

**One consequence for the PR and for ADR-0040 (f):** `shallow` now goes true for a **content** reason. Every other game's drain is an infrastructure fact; termo's canonical drain mode is a list running out, and the alert issue will read like a cron failure. `ANSWER_LIST_EXHAUSTED`'s wording is written for an operator reading a phone at 07:30 UTC.

#### 10.3.1 `runTopUp` must strip drizzle's bound parameters — two lines, and they close the only escape

**Drizzle embeds the bound parameters in the thrown `Error`'s own message.** `runTopUp` writes `error: String(aborted ? aborted.cause : thrown)` at `apps/api/app/cron/publish/route.ts:92`; that value is JSON-logged at `:139` and parsed into the `/cron/publish` response body at `:142`. **§1's "Never" list forbids a future-dated puzzle in any response, and `/cron/publish`'s body is a response.** For the three grid games the leaked value is a grid nobody wants; for Termo it is **the one thing this ticket exists to withhold** — a future-dated, unpublished answer word.

**Reproduced against the installed drizzle-orm 0.45.2 and PGlite 0.5.4**, with a real `daily_puzzles` table built from `packages/db/migrations/0001_parallel_frightful_four.sql:1-11` and an insert shaped exactly like `insertDailyPuzzle` (`packages/db/src/buffer.ts:54-72`). A CHECK violation yields, verbatim:

```
Error: Failed query: insert into "daily_puzzles" ("game", "date", "seed", "content", "published_at", "killed_at", "created_at") values ($1, $2, $3, $4, ('2026-08-10'::date)::timestamp at time zone $5, default, default) on conflict ("game","date") do nothing returning "game", "date", "seed", "content", "published_at", "killed_at", "created_at"
params: crossword,2026-08-10,3141592653,{"canonical":"então","normalized":"entao"},America/Sao_Paulo
```

The mechanism is in drizzle's own source — `node_modules/.pnpm/drizzle-orm@0.45.2_*/node_modules/drizzle-orm/errors.js:10-19`:

```js
class DrizzleQueryError extends Error {
  constructor(query, params, cause) {
    super(`Failed query: ${query}\nparams: ${params}`);
```

**The separator is exactly `"\nparams: "`** — newline, `params`, colon, one space — confirmed empirically (`message.includes("\nparams: ") === true`). **The wrapper is driver-agnostic**: `DrizzleQueryError` is constructed in `drizzle-orm/pg-core/session.js`, and both `neon-http/session.js` and `pglite/session.js` route through it, so production against Neon produces the same string as this PGlite repro.

**The fix, in `runTopUp`, replacing `route.ts:92`:**

```ts
// Drizzle's DrizzleQueryError embeds the BOUND PARAMETERS in its own
// message (drizzle-orm/errors.js:10-19, separator "\nparams: "). For termo
// those parameters are `{"canonical":…,"normalized":…}` for a date that may
// be up to 30 days in the future and is by definition unpublished — and
// this string goes into the /cron/publish RESPONSE BODY (:142) and the
// Vercel log line (:139). Keep the query text, which is what an operator
// actually needs; drop the tail. Fixes the three grid games at the same
// time — a nonogram `reveal.solution` was leaking the same way.
const cause = aborted ? aborted.cause : thrown;
const error =
  cause instanceof Error ? cause.message.split("\nparams:")[0] : String(cause);
```

Verified on the reproduction: the head is `"Failed query: insert into \"daily_puzzles\" (…) returning …"` and `head.includes("entao") === false`.

**Three honest limits, stated rather than discovered:**

1. **`String(thrown)` prefixes `Error: ` where `.message` does not.** `DrizzleQueryError` never sets `this.name`, so it stringifies as `Error`. The replacement drops that prefix; the shipped `cron-contract.test.ts` asserts `error` is a string or `null`, never its prefix — verified, no test moves.
2. **This sanitizes the *message* only.** `query`, `params` and `cause` are **own enumerable properties** of the thrown error, so anything that `JSON.stringify`s the error object still leaks. Nothing does today (`:92` and `:139` both go through `String`/the sanitized field) — recorded as landmine **N46** so a future "log the whole error for debuggability" change is a known trap rather than a fresh one.
3. **Comma-splitting is not a safe alternative.** Drizzle joins params with `Array.prototype.toString()`, so commas inside the JSON payload are indistinguishable from param separators. `split("\nparams:")` is the only reliable cut.

**In scope, deliberately.** It is two lines in a file #27 already edits (`:120-134` gains the termo property), it is the only channel through which an unpublished answer can escape, and deferring it would ship a route whose failure mode contradicts the ticket's own AC 1. **Commit B4**, with the rest of the cron work. Pinned by **T-API-S41** (§19.5): a `runTopUp` whose `topUp` rejects with a real `DrizzleQueryError` — constructed by driving a genuine constraint violation through the PGlite fixture, never by hand-rolling the message — returns an `error` containing the query head and **not** containing the bound answer word, with the positive control that the head is non-empty so the negative cannot pass vacuously (landmine 4).

**`cron-contract.test.ts` edits**, following the file's own recipe at `:12-20` and its precedent at `:158-166`: `:38-43` and `:128-134` become **"rejects an unknown game key — the extension point survives the last v1 game"**, aimed at `crossword` (P19); the `body`/`depths` fixtures gain `termo`; `"rejects a body missing a wired game"` gains a termo-missing variant in both describes; and a `"carries the S16 failure mode for the key #27 just added: termo drained alone"` case lands.

### 10.4 `apps/api/app/daily/termo/route.ts` (new)

A three-token copy of `apps/api/app/daily/nonogram/route.ts`, `export const dynamic = "force-dynamic"`, parsed against the **member**, never the union (`daily-binairo.test.ts:66` records why).

```ts
export async function GET(): Promise<Response> {
  const db = getDb();
  const daily = await getTodayDaily(db, "termo");
  if (!daily) {
    return Response.json({}, { status: 404, headers: corsHeaders() });
  }
  return Response.json(dailyTermoResponseSchema.parse(daily), {
    headers: corsHeaders(),
  });
}
```

**A literal segment, never `[game]`.** `daily/sudoku/route.ts:12-26` and `daily/nonogram/route.ts:12-18` both argue it: a dynamic segment puts an untrusted `params.game` in front of the wall. After #27 the second half of that argument — *"and it would let `/daily/termo` reach `stripDailyContent` and throw"* — dies, so the TSDoc is corrected (register item). So is `nonogram/route.ts:20-24`'s *"the web app fetches `/session` and `/completions` only"*, which §11 makes false.

---

## 11. `apps/api` — judging

### 11.1 `POST /termo/guess` and its contract

New file `packages/core/src/contracts/termo-guess.ts` — **client-safe**, exported from `packages/core/src/index.ts`, and **not** added to the `apps/web` ESLint ban list. Named `termo-guess.ts` rather than `guess.ts` on the `grid-hint.ts` precedent (ADR-0029 decision 6: *"named `grid-hint`, not `hint`, so the shared layer's naming stays honest"*).

```ts
/**
 * Termo's board bounds, restated in `packages/core` because `@miolos/games`
 * is a devDependency here (packages/core/package.json:19) and must stay one:
 * a runtime dependency would put `words.generated.ts` (40 591 bytes) on the
 * import path of every `@miolos/core` consumer, `apps/web` included.
 *
 * `TERMO_` prefixed because `apps/api`'s judge imports BOTH these and
 * `MAX_GUESSES`/`WORD_LENGTH` from `@miolos/games/termo` in one file, and a
 * bare name would collide. Pinned equal to the engine's own constants by a
 * test in `packages/core/test` (T-CORE-S18), which is where core is allowed
 * to meet games — the same door `packages/core/test/daily-contract.test.ts:1-11`
 * already uses.
 */
export const TERMO_MAX_GUESSES = 6;
export const TERMO_WORD_LENGTH = 5;

/**
 * A guess as it crosses the wire: NORMALIZED — lowercase, accent-free,
 * exactly five a-z letters. The client normalizes with `normalizeWord`
 * before posting, so two honest players who typed "AÇÃO" and "acao" post
 * BYTE-IDENTICAL bodies. That is ADR-0032's canonical-wire property, kept
 * where Termo can keep it.
 *
 * The shape matches `evaluate.ts:17`'s own `SHAPE` regexp, so a body that
 * parses can never make `evaluateGuess` throw its RangeError (:34-43).
 */
export const termoGuessWordSchema = z.string().regex(/^[a-z]{5}$/);

/**
 * One judged row. A TUPLE, not `.length(5)`: `z.tuple` infers a 5-tuple
 * assignable to the engine's `readonly TileStates`, so the client feeds a
 * parsed response straight into `deriveKeyboardState` with no `as`.
 * The five members are literal because `z.tuple` needs a literal-length
 * array; T-CORE-S18 pins `termoTilesSchema` against `WORD_LENGTH`.
 *
 * UNVERIFIED under the installed zod 4.4.3 + TypeScript 6.0.3 — probe it
 * before writing the code that depends on it (plan 022 §26 item 2).
 */
export const termoTileStateSchema = z.enum(["correct", "present", "absent"]);
export const termoTilesSchema = z.tuple([
  termoTileStateSchema,
  termoTileStateSchema,
  termoTileStateSchema,
  termoTileStateSchema,
  termoTileStateSchema,
]);

/**
 * POST /termo/guess. Stateless: the WHOLE list every time (ADR-0038), so the
 * route holds nothing and a replay is free. Carries no tiles and no status —
 * both are the server's to compute. `date` is `calendarDateString`, never
 * `isoDateString`: it is client-supplied.
 */
export const termoGuessRequestSchema = z.strictObject({
  game: z.literal("termo"),
  date: calendarDateString,
  guesses: z.array(termoGuessWordSchema).min(1).max(TERMO_MAX_GUESSES),
});

/**
 * The judged board. `tiles` is parallel to the submitted `guesses`, in the
 * submitted order — the request is not echoed, because an echo is a second
 * place for the two to disagree.
 *
 * `answer` is present IF AND ONLY IF the board is closed. That is the whole
 * of ADR-0038 decision 2 in one refine, and it is CHECKED rather than
 * documented so a route change cannot quietly leak it mid-game.
 */
export const termoGuessResponseSchema = z
  .strictObject({
    game: z.literal("termo"),
    date: isoDateString,
    tiles: z.array(termoTilesSchema).min(1).max(TERMO_MAX_GUESSES),
    status: z.enum(["playing", "won", "lost"]),
    /** The canonical ACCENTED spelling (ADR-0015), e.g. "praga", "então". */
    answer: z.string().optional(),
  })
  .refine((r) => (r.status === "playing") === (r.answer === undefined), {
    message: "answer is present exactly when the board is closed",
  });
```

**The route**, `apps/api/app/termo/guess/route.ts`, `export const dynamic = "force-dynamic"`. Its gate order copies `completions/route.ts` exactly, because every one of those gates has a recorded reason:

| # | Step | Failure |
|---|---|---|
| 1 | `warnIfGuardDegraded()` | — (`origin-guard.ts:39-43`: *"Called first by EVERY route that depends on the guard"*) |
| 2 | cross-site guard, **before `getDb()`** | 403 `cross-site` |
| 3 | `Content-Type: application/json`, **before the body is read** | 415 |
| 4 | `getDb()`, `requireUserId(db, cookie)` — **never mints** | 401 `no-session` |
| 5 | `request.json()`; `termoGuessRequestSchema.safeParse` | 400 `invalid-body` |
| 6 | the shared `ACCEPTED_DAYS_BACK` bound vs `todaySaoPaulo(db)` | 404 `no-puzzle` |
| 7 | `getPublishedDailyWithSolution(db, "termo", body.date)` | 404 `no-puzzle` |
| 8 | `termoDailyContentSchema.parse(row.content)` | 500 (a drifted row; deliberate — §8.3) |
| 9 | `isValidGuess` on every guess | 422 `invalid-guess` |
| 10 | the **explicit** "no row follows a winning row" pre-check | 422 `invalid-guess` |
| 11 | `evaluateGuess` × n, then `deriveBoardStatus` | — |
| 12 | `termoGuessResponseSchema.parse({...})` | 200 |

**Step 10 is not optional and is not a nicety.** `deriveBoardStatus` throws a `RangeError` when a winning row is followed by another (`status.ts:31-36`), that case is **reachable from a malicious body**, and an uncaught `RangeError` in a route handler is a 500. The pre-check runs *before* the call, exactly as ADR-0032 decision 4 puts the length check before the compare loop for the same class of reason. `rows.length > MAX_GUESSES` is impossible because the schema caps at `TERMO_MAX_GUESSES`.

**The mechanism, stated — because step 10 sits at position 10 and the tiles do not exist until 11.** It does not need them. The check is a string comparison over the *submitted words*:

```ts
// Step 10, before any engine call. `body.guesses` are already normalized
// `^[a-z]{5}$` (termoGuessWordSchema) and `content.normalized` is
// `^[a-z]{5}$` by the word-list harness, so this is plain ASCII equality.
const winAt = body.guesses.findIndex((g) => g === content.normalized);
if (winAt !== -1 && winAt !== body.guesses.length - 1) {
  return errorResponse(422, "invalid-guess");
}
```

**The one-line proof that "all five tiles correct" ⟺ "the guess equals the answer".** `evaluateGuess` writes `"correct"` in exactly one place — `evaluate.ts:61-62`, `if (letter === a.charAt(i)) tiles[i] = "correct"` — and pass 2 never writes it (`:71-72` skips every position already `"correct"`, and its only write is `"present"` at `:77`). Both operands are `SHAPE`-checked `^[a-z]{5}$` before the loop (`:34`, `:39`). So all five positions are `"correct"` **iff** `g.charAt(i) === a.charAt(i)` for every `i < 5`, **iff** `g === a`. `isWinningRow` (`status.ts:13-15`) is `row.every(t => t === "correct")`, so the row-level predicate and the word-level equality are the same predicate — the pre-check is exact, not a conservative approximation, and it can therefore never 422 a legitimate board.

**Ordering note:** step 9 (`isValidGuess` on every guess) runs first, so by step 10 every element is a dictionary word; and both 9 and 10 answer the same **422 `invalid-guess`**, so their relative order is not observable to a client. The same two lines are what `judgeTermo` runs in `POST /completions` (§11.2), where the equivalent failure is `422 guess-mismatch` with no row.

**Every response, 4xx included, carries the credentialed CORS grant** (`apps/api/src/cors.ts:12-25`, exact origin from `WEB_ORIGIN`, `*` unrepresentable). Two honest caveats belong in the PR: **the cross-site guard is not load-bearing on this route** — `isCrossSiteWrite` denies on positive evidence only and allows requests lacking both headers (`origin-guard.ts:13-17`, `:19-31`), so `curl` walks past it; what actually stops a hostile *browser page* from reading a guess response is CORS. And minting is unthrottled (ADR-0022 as amended by ADR-0026), so "one session cookie" is not a real cost to an attacker.

**Abuse posture, derived fresh rather than inherited** (ADR-0038 decision 9). ADR-0024's posture covers *"the public reads"* (unauthenticated, unthrottled) and ADR-0026's covers *the write*; `POST /termo/guess` is **neither** — it is authenticated and it writes nothing.

**The cost, counted in the unit that actually bills: neon-http round trips.** This repo records the counting rule at `apps/api/src/session/service.ts:20` — *"each statement is its own neon-http round trip"* — so the ladder's three DB steps are three trips, not one query:

| Step | Call | Statements | Round trips |
|---|---|---|---|
| 4 | `requireUserId` → `resolveSession` (`session/service.ts:25-46`) | one `select`, **plus** a conditional `update` when `last_seen_at` is ≥1 h stale (`:37-45`) | **1**, or 2 at most once an hour per session |
| 6 | `todaySaoPaulo` (`packages/db/src/buffer.ts:19-28`) | one `db.execute` | **1** |
| 7 | `getPublishedDailyWithSolution` (`packages/db/src/published.ts:123-131`) | one `select … limit 1` on the composite PK | **1** |
| | **Total** | | **3** (4 on the hourly bump) |

Plus, in-process and free: ≤6 `evaluateGuess` (O(5) each) + ≤6 `isValidGuess` (O(1) `Set`), **zero writes**, allocation bounded by the schema at ≤6 elements of `^[a-z]{5}$`.

**Against `GET /daily/<game>`, which is `getTodayDaily` — one `select … limit 1` (`published.ts:64-77`), i.e. exactly one round trip.** So the guess route is **3× the round trips per request**, and the per-day multiplier runs the same way: `apps/web` calls `/daily/termo` **zero** times (P20 — its presence is an operator signal, not a client dependency; the same is true of the three shipped `/daily/<game>` routes, `daily/nonogram/route.ts:20-24`), while a player who finishes a Termo calls the guess route **once per guess, ~6× per user per day**. ≈18 Neon round trips per player-day against a route the product never calls.

**The "strictly less than `GET /daily/<game>`" claim in an earlier draft is false and is withdrawn** — here and in ADR-0038 consequence (f). **The posture — no rate limiting in #27 — is re-affirmed on the corrected figure, on four grounds that do not depend on the comparison:**

1. **Authentication is the throttle that exists.** The route needs a session cookie; `GET /daily/<game>` needs nothing. Minting is unthrottled (ADR-0022 as amended by ADR-0026), so this is a speed bump rather than a wall — stated, not overclaimed.
2. **Zero writes.** No row, no storage, no `ON CONFLICT` pressure, nothing to corrupt. ADR-0026's write posture has nothing to extend to.
3. **The work per request is constant and tiny**, bounded by the schema before any engine call: ≤6 words of exactly 5 bytes.
4. **A shape change is not an abuse signal.** ADR-0026's revisit trigger is *"the first abuse signal"* — observed traffic, not a new route with a different cost profile. #27 adds no limiter and files none; the trigger stands as written (§1's Out table).

**One thing the `.max(6)` does NOT bound, stated so nobody claims it does.** Zod parses **every** array element before the `.max()` check rejects the array, so a body carrying 10 000 five-letter strings is fully parsed first — measured at ≈4.4 ms. **That is not a new exposure**: it is byte-for-byte the shape the shipped `POST /completions` already has (`z.array(submittedCellSchema)` under a `.length()`), accepted since #18, so #27 introduces no new class. **The real bound is Vercel's platform request-body limit of ~4.5 MB, not the schema's `.max(6)`** — say it in those words in the PR, because "the schema caps it at six" is the sentence a reviewer will read into the abuse-posture table above and it is false about *allocation*. At 4.5 MB of `"aaaaa",` the parse is bounded in the tens of milliseconds, on an authenticated route that writes nothing. Accepted, unchanged, and **no `Content-Length` pre-check ships** — it would be the first in the repo and would guard a limit the platform already enforces.

**No ADR amendment is required** — nothing ADR-0024 or ADR-0026 *asserts* becomes false; their scopes simply do not extend here. ADR-0038 consequence (f) is a different matter: it repeats the withdrawn comparison and is rewritten with this table (§23 register).

### 11.2 The completion member and the judge

Added at `packages/core/src/contracts/completion.ts`'s own extension point (`:79-81`):

```ts
/**
 * Termo's completion (#27, ADR-0038). FIVE keys, like every other member —
 * `guesses` sits exactly where the three grid members carry `grid`.
 *
 * It carries the guess LIST and nothing else, because the list is the only
 * EVIDENCE of the outcome that exists. A `won`/`lost` field would be a
 * client-asserted outcome, the same class of input as the client-supplied
 * completion instant ADR-0026 rejects outright; a `tiles` field would be a
 * second place to lie about a fact the stored row owns, which is the
 * argument that kept `size` off the nonogram member (:136-141). The server
 * recomputes both from `guesses` and the stored answer.
 *
 * It does NOT achieve ADR-0032's byte-identity between two honest winners —
 * two players who won on guess 4 guessed different words, and there is no
 * smaller canonical form that PROVES a win. What it keeps is ADR-0032's
 * substance: no leniency rule, no client-asserted outcome, no second place
 * to lie. Byte-identity survives where it can — the wire is normalized, so
 * "AÇÃO" and "acao" are the same bytes. The warrant for the extra state is
 * that the guess SEQUENCE is itself outcome-bearing: ADR-0008 requires the
 * fail row and #29's distribution is a function of the guess count.
 *
 * `elapsedMs`/`hintsUsed` carry binairo's bounds unchanged and must stay
 * identical (:100-103). `hintsUsed` keeps `.max(1)` even though Termo ships
 * no hint (ADR-0045): the bound is a PRODUCT rule, not a per-game one, and
 * narrowing it to `z.literal(0)` would make a later hint a contract change.
 */
export const termoCompletionRequestSchema = z.strictObject({
  game: z.literal("termo"),
  date: calendarDateString,
  guesses: z.array(termoGuessWordSchema).min(1).max(TERMO_MAX_GUESSES),
  elapsedMs: z.number().int().min(0).max(86_400_000),
  hintsUsed: z.number().int().min(0).max(1),
});

export type TermoCompletionRequest = z.infer<
  typeof termoCompletionRequestSchema
>;

export const completionRequestSchema = z.discriminatedUnion("game", [
  binairoCompletionRequestSchema,
  nonogramCompletionRequestSchema,
  sudokuCompletionRequestSchema,
  termoCompletionRequestSchema,
]);
```

**Three test-surface facts, checked in tree:**

- `completion-contract.test.ts:190-193` asserts `{...valid, game: "termo"}` **fails**. #27 retargets it — and there is no fifth game to retarget it *to*, so it becomes a **positive** assertion. That is the **third** retarget of the same `it` (`:185-188` records the first two) and the PR says so.
- `completion-contract.test.ts:495-523` audits each member's key set as *"exactly the five audited fields"*. Termo's is `["date","elapsedMs","game","guesses","hintsUsed"]` — five, and it owes its own copy.
- `completion-contract.test.ts:525-533` iterates every union option's keys against `INSTANT_SHAPED = /at$|time|clock|instant|epoch|now|date/i`. **`guesses` does not match** — verified by reading the regexp.

**`storedSolution` is narrowed, not widened** (P32):

```ts
type GridCompletionGame = Exclude<CompletionRequest["game"], "termo">;

function storedSolution(
  game: GridCompletionGame,
  content: unknown,
): readonly number[] { /* the three existing arms, unchanged */ }
```

**The route restructures**, replacing `completions/route.ts:207-251`, so the branch sits after the wall read (which both paths need):

```ts
const outcome =
  body.game === "termo"
    ? judgeTermo(body, row.content)   // "won" | "lost" | null
    : judgeGrid(body, row.content);   // "won" | null   (the existing lines)
if (outcome === null) {
  return errorResponse(
    422,
    body.game === "termo" ? "guess-mismatch" : "grid-mismatch",
  );
}
const { record, recorded } = await recordCompletion(db, {
  userId,
  game: body.game,
  date: body.date,
  outcome,
  elapsedMs: body.elapsedMs,
  hintsUsed: body.hintsUsed,
  guesses: body.game === "termo" ? body.guesses.length : undefined,
});
```

`judgeTermo` runs the same ladder as §11.1 steps 8–11 and returns `null` for a list that is still `"playing"`, contains a non-word, or continues past a winning row. **`body.grid.length !== solution.length` at `:220-222` stays in the grid branch, unweakened** — ADR-0032 consequence (c): *"The length check is game-generic and must not be simplified away."* Both `body.grid` sites now typecheck because they sit inside the narrowed branch.

**Two integrity properties that need no new code, and one honest limit:**

- **A lost day cannot be reopened.** The idempotent short-circuit at `:185-188` runs `getCompletion` **before** the wall read and before any judging, so a replay carrying a winning list returns the stored `lost` row with `recorded: false`. ADR-0008's *"a loss followed by an archive replay does not reopen the daily"* is enforced by code that already exists.
- **The server-side re-check is what makes a client bug non-fatal.** ADR-0026 decision 1 makes the row write-once, so a client that posted a premature loss would cost the player the day permanently. The `"playing" → 422, no row` rule is the guard and must not be relaxed.
- **The limit:** `outcome: "lost"` is only as authoritative as the client's willingness to report it. A client can suppress a loss or fabricate a win — the same class as `hints_used` (ADR-0027:106-116). Both failure directions are safe: suppression grants nothing (no row = no streak day), and a fabricated win grants a streak day the player could already mint from Binairo in 0.1 ms. **A Termo `lost` row may feed the player's own guess distribution and may never back a medal or an entitlement** (ADR-0031 decision 6).

### 11.3 The shared date bound

`ACCEPTED_DAYS_BACK = 1` moves from `completions/route.ts:45` into `apps/api/src/publishing/dates.ts`, **with its TSDoc and its `#31` extension-point note**, and both routes import it. `completions/route.ts` already imports `addDays` from that module at `:23`, so no new import edge is created.

The reason is not tidiness: a player mid-game at the São Paulo rollover must be able to submit guess 5 for yesterday's date, or **Termo becomes unfinishable at midnight** — while the completion route already accepts that same day. Two copies of the bound is exactly the drift ADR-0026's consequence warns about (*"Widening it accidentally — by removing the bound while 'fixing' a date test — reopens the whole past calendar to forged completions"*). **This does not touch ADR-0026 decision 6**, which says the bound lives *"in the route and not in SQL"* — a module inside `apps/api` is still the route layer. **Say that in the PR so it is not filed as a finding.**

### 11.4 What the screen does when a guess POST fails

Using the status vocabulary `sync.ts:42` already fixes (`TERMINAL_STATUSES = new Set([400, 403, 404, 415, 422])`), but applied to a **turn** rather than a **result**:

| Failure | Screen | The turn |
|---|---|---|
| `fetch` rejects (offline) | the guess sits in the pending row in a distinct "aguardando" paint; an inline pt-BR line names the connection; a retry button, plus an automatic retry on the `window` `online` event | **held**, not consumed |
| any 5xx | same | held |
| 401 | one forced `ensureSession({ force: true })` and one silent re-post — the exact ladder at `sync.ts:209-215`; a second 401 falls through to "held" | held |
| **429** | held, with a longer backoff; **never terminal** | held |
| **422 `invalid-guess`** | **`copy.notInList` — "não está na lista", the SAME string the local `isValidGuess` rejection renders** (§13.1b). Guess cleared from the pending row, no retry button. This is the *not-in-the-list* case arriving from the server and it is reachable in normal operation: `apps/web` and `apps/api` deploy independently and ADR-0015 expects the list to be regenerated, so a word the client's copy accepts and the server's does not is a **player** outcome, not a system fault | **not consumed** — the server judged the word, not the board |
| 400 / 403 / 415 / **any other 422 code** | inline generic error (`copy.failed`), guess cleared from the pending row, copy distinct from "não está na lista" | **not consumed** — the server never judged it |
| 404 `no-puzzle` | the same `DailyUnavailable` view the route renders when the wall returns nothing (ADR-0028 decision 4) | the day is over |

**The 422 split is routing, not just copy**, and it is why `GuessOutcome.rejected` carries `reason: "not-in-list" | "refused"` rather than being a bare kind (§14.5). The **server** is the only place that still distinguishes the two — in the 422 body's error code — so a bare `{kind:"rejected"}` throws the distinction away at the last boundary that holds it. `invalid-guess` maps to `"not-in-list"`; every other code on that row maps to `"refused"`. §13.1b's five-source table is the same mapping written from the copy's side, and **T-WEB-S83** drives both rows.

**Held, not queued, and not lost.** A queued guess is incoherent: by the time a queue drains, the board may have moved on, and there is no "later" for a turn the player is watching.

**Why `sync.ts` is the wrong vehicle — five grounded reasons**, all of which belong in the PR because a reviewer will cite ADR-0029 at this:

1. It is a **completions** queue by construction: `syncRecord` posts to `` `${apiUrl}/completions` `` (`sync.ts:315`) and `pendingQueue()` is `listPendingRecords()` (`:78-87`), selecting on `pendingSync === true` — "a finished result the server has not acknowledged".
2. Its settlement is wrong for a turn: `settle(record, "rejected")` writes `pendingSync: false` **permanently** (`:362-368`). A failed guess must stay re-postable.
3. Its ladder is deliberately un-urgent — `[2_000, 5_000, 15_000, 60_000]` (`:50`) — and its handler bails outright in a hidden tab (`:385-390`). Correct for a background completion; wrong for a turn the player is staring at.
4. Its module-level singletons `flushing`, `reminted`, `retryStep`, `retryTimer` (`:53-56`) exist to keep **one game-blind queue** coherent (`:13-19`). Pushing a foreground guess through them lets a background completion flush reset a live turn's retry step, and vice versa.
5. ADR-0029 decision 3 scopes `sync.ts`'s genericity to *"the queue, retry ladder, re-mint and settle machinery"* **for completions**, with `buildBody` as the one per-game dispatch. That obligation is untouched: #27 still adds `case "termo"` to `buildBody` for the **completion**.

The guess client therefore lives in `apps/web/src/termo/guess-client.ts` and shares exactly two things with `sync.ts`: `ensureSession()` from `apps/web/src/session/bootstrap.ts` (already a module-level shared promise, `bootstrap.ts:17`, `:29-36`, safe for a second caller) and the "re-mint once per page load on 401" rule, which needs **its own boolean**. **Duplicating a boolean is not the hazard ADR-0029 names** — say so in the PR.

### 11.5 Not touched in `apps/api`

`session/*`, `cors.ts`, `origin-guard.ts`, the cron's auth, `vercel.json` (`maxDuration: 60` needs no change — termo's absolute worst run is 0.0573 ms, and at landmine 6's 4× CI factor still 0.23 ms), `buffer-alert.yml`, and the three shipped `daily/<game>` routes beyond one corrected TSDoc sentence.

---

## 12. The screen — geometry, states, keyboard, motion

There is **no reference frame for `/termo`**. This is a just-in-time design in exactly the situation `/nonogram` was in, and `apps/web/src/nonogram/nonogram-board.module.css:1-60`'s header — six numbered deviations, each with its arithmetic — is the template Termo's module follows.

### 12.1 The geometry table

| | desktop (>768px) | ≤768px | at 320px |
|---|---|---|---|
| page padding (`screen.module.css:37-51`, `:389-422`) | `var(--space-11) 80px` | `var(--space-5)` = 20px | same |
| **tile** | 52 × 52 | 44 × 44 | 44 × 44 |
| tile gap | 4px | 3px | 3px |
| board inner | `5×52 + 4×4` = **276** w · `6×52 + 5×4` = **332** h | `5×44 + 4×3` = **232** w · `6×44 + 5×3` = **279** h | 232 × 279 |
| card padding + border | `2×16 + 2×1` = 34 | `2×10 + 2×1` = 22 | 22 |
| **`.gridCard`** | **310 × 366** | **254 × 301** | 254 × 301 |
| `--board-mobile-max` | — (declared **unconditionally**) | **254px** | 254px — **the cap binds**: the page leaves `320 − 2×20` = 280px of content and `min(254, 280) = 254`, so the card is 254px and the remaining `280 − 254` = 26px is desk paper, 13px each side |
| tile glyph | Fraunces 600 **28px** | Fraunces 600 **24px** | 24px |
| **keyboard** | **552 × 172** | `width:100%` cap **350** × 152 | **280 × 152** |
| keyboard grid | `repeat(20, minmax(0,1fr))`, gap 8 | same, gap 4 | same |
| column `C` | `(552 − 19×8)/20` = **20.0px** | `(350 − 19×4)/20` = **13.7px** | `(280 − 76)/20` = **10.2px** |
| letter key (span 2) | `2×20 + 8` = **48 × 52** | `2×13.7 + 4` = **31.4 × 48** | **24.4 × 48** |
| command key (span 3) | `3×20 + 2×8` = **76 × 52** | `3×13.7 + 2×4` = **49.1 × 48** | **38.6 × 48** |
| letter glyph | Fraunces 600 17px | Fraunces 600 15px | 15px |
| command label | `var(--text-button)` 14px | **11px** (the `undersized-ui-text` floor, exactly) | 11px |
| key shadow | `var(--shadow-sm)` ink 10% | `2px 2px 0` ink 10% | same |
| board column available | `1440 − 160 − 330 − 72` = **878** @1440 · `1141 − 160 − 330 − 72` = **579** @1141 | — | — |
| **keyboard fold margin** | `579 − 552` = **27px**, at the narrowest width that actually renders two columns | — | — |

**`--board-mobile-max: 254px` is declared unconditionally on `.pageTermo`.** `screen.module.css:490` is `max-width: var(--board-mobile-max);` — a **bare `var()` with no fallback**, verified by direct read; the file's own header at `:16-21` claims otherwise (*"the rotations and the mobile board cap are custom properties with Binairo's shipped values as their fallbacks"*) and is wrong for the cap (handoff 021 §2 already records the correction). *(The `:409` two shipped comments cite for this read — `screen.module.css:290` and `accent.ts:85` — is stale too; neither is #27's to move.)* Omitting the declaration makes `max-width` invalid at computed-value time, falls back to `none`, and **deletes the ≤768px cap in silence**. `nonogram-board.module.css:71-73` spells this out. Pinned by **T-WEB-S91** assertion A2.

**Rotations — a fourth distinct signature** (Binairo `0.4 / −0.5 / −3`, Sudoku `−0.4 / 0.5 / 3`, Nonogram `−0.7 / 0.9 / −4`):

```css
.pageTermo {
  --grid-card-rot: 0.7deg;
  --stats-card-rot: -0.9deg;
  --tape-rot: 4deg;
  --board-mobile-max: 254px;
}
```

All three rotations sit inside `--rotate-card-max` (2.4deg); the tape inside `DESIGN.md:37`'s ±3–5deg.

**The fold margin is computed at 1141px, not at 1140px, and the +1 is not pedantry.** `screen.module.css:330` is `@media (max-width: 1140px)`, which *includes* 1140 — at exactly 1140px the page is single-column and there is no board column to fit a keyboard into. The narrowest viewport that renders the two-column grid is therefore **1141px**, where the board column is `1141 − 160 − 330 − 72` = 579px and the keyboard's slack is `579 − 552` = **27px**. `nonogram-board.module.css:33-36` and ADR-0035 decision 6 both quote **578 @1140**; that figure is inherited and left alone (it is the *fold constant*, and it under-states by 1px in the safe direction), but Termo's own margin is stated at the width that exists.

**The mobile top bar keeps three items, and that is a Termo-specific problem the shared sheet creates.** At ≤1140px `screen.module.css:350-361` hides `.wordmark`, `.topDate` and `.titleKicker` and shows `.barKicker`, `.timerBar` and `.progressBar`; `.topBar` is `justify-content: space-between` (`:61-67`). The three shipped play screens render five bar children and show **three** below the fold — back · kicker · timer — so the kicker sits centred. Termo renders **no timer** (ADR-0045 decision 4), so a naive copy shows **two** and `space-between` throws `PALAVRAS` hard right against the 20px page padding, where three shipped screens centre it. **A Termo-only `justify-content` override is not available** — CSS Modules hash per file (landmine 10), so a `.topBar` declared in Termo's module is a different hashed class and the shared one would win or lose by Next's injection order.

So **Termo's progress readout moves into the bar's third slot**: `<span className={screen.progressBar}>{copy.progressShort(used, MAX_GUESSES)}</span>` is rendered **inside `<header className={screen.topBar}>`**, where the three shipped screens put `<TimerReadout className={screen.timerBar}/>`, and `.titleRow` holds the `<h1>` alone. This costs nothing at desktop — `.progressBar` is `display: none` above 1140px (`:88-92`), so the desktop bar is back · wordmark · date exactly as shipped, and the stats card keeps `.progressCard` as the desktop home of the same number. It is the shared sheet's own *"both readouts exist twice and one of each pair is hidden per viewport"* rule (`:35-36`), applied to the one readout Termo has. A spacer `<span/>` was rejected: it is an empty box in the accessibility tree solving a layout problem with markup, where a real number was available.

**Seven recorded deviations, with their arithmetic.** `nonogram-board.module.css:1-60` records **six** in its file header, each with its numbers, and that header is the template this one copies — not the count. All seven below go into `termo-board.module.css`'s header verbatim and numbered, the way that file's own header is written; the enumeration has its own allocated id in the stylesheet-text family — **T-WEB-S102** (§19.6) — which asserts the block exists and declares **exactly seven** numbered items, so a later deletion reds rather than passing quietly.

1. **The mobile tile is 44px, not `DESIGN.md:50`'s 38px.** 38px was written against the F4 8×8 Binairo frame, where `8 × 38 + 7 × 3 = 325` is the largest board that fits a 350px cap. A **5**-column board at 38px is `5 × 38 + 4 × 3 = 202`px inside a 350px field — 74px of dead paper each side, on a screen whose whole argument is paper that hugs its board (the argument `nonogram-board.module.css:81-92` makes for `.mobileCap5`). At 44px the card is 254px against the 280px available at 320px, so the larger tile costs nothing and buys **16 %** more glyph.
2. **Touch targets fall below 44px on the horizontal axis, consciously.** `10 × 44 = 440px` exceeds the 350px available at the reference phone **before any gap**, so `PRODUCT.md:39` / `DESIGN.md:40`'s ≥44px is arithmetically unreachable for a 26-letter keyboard. **WCAG 2.5.8's 24×24 floor is cleared at every width the repo designs for** — 31.4 × 48 at 390px, **24.4 × 48 at 320px** — and the vertical axis is held above 44px because it is free (rows are 48px). WCAG 2.5.5/2.5.8's **essential-presentation exception** applies: an alphabet is 26 keys, and a keyboard whose keys are 44px wide is not a keyboard on a phone. This is ADR-0035 decision 7's argument, inherited rather than re-derived, and it is the second time the repo has met the same wall. The 44px rule is honoured where it governs — the command keys are 49.1 × 48 at 390px.

3. **`text-decoration` is a state carrier, and `DESIGN.md:22`'s list does not contain one.** The line reads *"every state they mark is also carried by a chip, border, or label"* — three carrier kinds. Termo adds a **fourth**: a typographic mark (`underline` for `present`, `line-through` for `absent`, on the board and on the keyboard). It is a deviation in *kind*, not in effect: the marks clear 1.4.11's 3:1 floor against the paper they are drawn on by wide margins (**15.0124:1** and **13.9929:1**, computed in §12.2), and they are the reason `--accent` never has to become a boundary. It is recorded rather than assumed because the rejected list in §12.2 shows how narrow the escape was — three of the four *shaped* alternatives are live impeccable findings.
4. **The key shadow is `--ink` at 10 %, not `DESIGN.md:36`'s `rgba(accent, 0.2–0.3)`.** Inherited, not invented: `sudoku-board.module.css:345-349` already ships this exact colour with the reason in the file — *"the one shadow in the whole frame set that is neutral… because `apagar` is a neutral control rather than a game-accent one."* A letter key is likewise neutral until it is judged, and 28 mustard shadows under a 552px keyboard would make the accent the loudest thing on a screen whose accent has exactly one job (§12.2). The blur is 0 and N ∈ {3, 2, 1}, so the rest of the token's shape is honoured.
5. **Tile glyphs are `--ink` at weight 600, where `DESIGN.md:50` says *"player cells on desk paper with accent numerals wt 500"*.** The colour half is **forced, and after PR A it is no longer a deviation at all**: ADR-0041's amendment rewrote `DESIGN.md:50` to say the board cell's accent numeral is the *measured exception* and that **"Termo's board, when it arrives, may not use it — mustard measures 2.7311:1"**. Read against `main` today this item records agreement, not divergence; it is kept numbered because `termo-board.module.css`'s header enumerates seven and T-WEB-S102 counts them. The arithmetic is unchanged — mustard on desk paper is 2.7311:1 against a 4.5 floor, and `color: var(--accent-termo)` is inside decision 1's exception shape and outside its condition on every paper. The weight half is a judgement: `DESIGN.md:50`'s 500/600 split exists to separate a **given** from a **player** entry, and a Termo board has no givens — every glyph on it is the player's — so the split has no second term and the legible weight is the one that ships. `--ink` 600 on `--paper-desk` is **15.0124:1**.
6. **The focus ring is `--ink`, and after PR A that is the repo's rule for a SHARED sheet rather than a Termo divergence.** This item drafted it as *"where the three shipped games use `var(--accent)`"*; that was already only half true — `nonogram-board.module.css:400` and `:445` ship `2px solid var(--ink)` and were the precedent — and ADR-0041 **decision 8** then converted the one ring the shared layer declares, `screen.module.css:347`'s `.hint:focus-visible`, from `var(--accent)` to `var(--ink)` for exactly this reason: `outline-offset: 2px` puts `--paper-desk` on both sides of the ring, so for mustard it measured **2.7311:1** against 1.4.11's 3:1 floor, and it passed only by accident of which three games had shipped. What is left accent-coloured is **per-game and measured**: `sudoku-board.module.css:197`, `:314`, `:361` (`var(--accent)` inside a module whose root binds it to ink-blue alone, 7.5113:1 / 7.8385:1) and `binairo-screen.module.css:71`, `:146` (`var(--accent-binairo)`, 5.3066:1 / 5.5377:1) — decision 1's exception, and ADR-0041 decision 8 leaves them alone with their figures. Termo's mark is `--ink` at **15.0124:1** on desk and **15.6663:1** on card because mustard clears no paper; it is recorded here as an inherited rule, not as a change to any shipped screen.
7. **Two off-4pt lengths, against `DESIGN.md:40`'s *"Spacing on a 4pt scale"*:** the keyboard's `margin-top: 30px` and the keyboard's `text-underline-offset: 3px`. The 30px is **inherited** — `screen.module.css:161` ships `margin-top: 30px` on `.statsCard` and `:146` ships `margin: 18px 0 0` on `.rules`, so the shared sheet already carries off-scale vertical rhythm and matching it is what makes the keyboard sit where the sidebar card sits. The 3px is a decoration offset on a 17px glyph, not spacing between boxes; the board's own offsets are **4px** at both viewports (deviation-free) precisely so the scale holds where it governs.

**Desktop is `DESIGN.md:50` verbatim — 52px cells, 4px gap — so there is no *geometry* deviation to record there.** Termo is the first board narrow enough to honour the spec exactly; deviations 5–7 are colour, weight and rhythm, not cell size.

**`/termo` is the first screen whose widest element is not its board** (552px keyboard against a 310px card). A later contributor who "unifies" the two caps shrinks the keyboard to 254px and puts 24 letter keys in 254px — ADR-0042 consequence (b) says so.

### 12.2 The six tile states and the caret

Mustard cannot be the text colour (ADR-0041) **and cannot be a state-bearing boundary**: at 2.7311:1 on `--paper-desk` and 2.8501:1 on `--paper-card` it misses WCAG 1.4.11's 3:1 non-text floor too. So the board is built so that **every distinction a player has to make is carried by a mark that clears 3:1 in neutral ink**, and mustard does exactly one job: it fills the tile whose letter is in the right place.

| state | fill | border 1.5px | glyph | typographic mark |
|---|---|---|---|---|
| **empty** | `--paper-desk` | `var(--line)` | — | — |
| **typed** (filled, not submitted) | `--paper-desk` | `var(--ink-2)` **solid** | `--ink` 600 | — |
| **held** (submitted, awaiting the verdict) | `--paper-desk` | `var(--ink-2)` **dashed** | `--ink` 600 | — |
| **caret** (next empty slot of the active row) | `--paper-desk` | `var(--line)` | — | `outline: 2px solid var(--ink); outline-offset: -2px` |
| **absent** | `--paper-tint` | `var(--line-soft)` | `--ink-2` 600 | `line-through`, **`--ink`**, 2px |
| **present** | `--paper-desk` | `var(--ink)` | `--ink` 600 | `underline`, `--ink`, 3px / 2px mobile, `text-underline-offset: 4px` |
| **correct** | `var(--accent)` | `var(--ink)` | `var(--ink-on-accent, var(--ink))` 600 | — |

**`held` is the state ADR-0039 consequence (g) requires and §11.4 calls *"a distinct 'aguardando' paint"*.** It is a **CSS state plus one aria word, never a visible label**: the `.notice` line already carries the connection sentence in the same tick, and a second visible "aguardando" would say the same thing twice under the same board. The accessible signal is the row's own composed name — `copy.rowHeldAria(row, max, guess)` → *"tentativa 2 de 6: c, a, f, e, s, aguardando resposta"* (§18.2). Its paint is **`typed`'s border made dashed**, which is this repo's shipped carrier for *not settled*: `conclusion-view.module.css:339-343` ships `.chipMissing { border: 1.5px dashed var(--line) }` with the reason in the file — *"The dashed border is the second carrier of 'not done', so the state never rests on colour alone."* The discrimination from `typed` is therefore a **shape** difference (solid → dashed) and owes no ratio; the mark itself is `--ink-2` on `--paper-desk` at **5.0791:1**, clearing 1.4.11's 3:1 with 69 % of headroom. Nothing else about the tile moves — the glyph stays `--ink` 600 at 15.0124:1, because the letters are still the player's and dimming them would read as a rejection.

**`held` needs no reduced-motion line of its own, and that is a fact rather than an omission.** `border-style` is **not an animatable property** (CSS Backgrounds and Borders 3 — it is discrete and not in the transitionable set), so solid → dashed snaps at every motion setting; the only animated property the state touches is `border-color`, which does not change. §12.5 item 5's blanket `.tile { transition: none }` covers it and no `.tileHeld` selector appears in the reduced-motion block.

**Every text-on-fill pair, computed** (WCAG 2.x: `s = c/255`; `lin = s/12.92` if `s ≤ 0.03928` else `((s+0.055)/1.055)^2.4`; `L = 0.2126R + 0.7152G + 0.0722B`; ratio `= (L_hi + 0.05)/(L_lo + 0.05)`):

| pair | ratio | verdict |
|---|---|---|
| `--ink` #211D19 (L 0.01272250) on `--paper-desk` #F7F2E9 (L 0.89161610) | **15.0124:1** | ✓✓ |
| `--ink-2` #6E6659 (L 0.13539008) on `--paper-tint` #F1EADD (L 0.82766867) | **4.7342:1** | ✓ AA; and 28px/24px Fraunces is WCAG large text (3:1) |
| **`--ink` on `--accent-termo` #C08A1E (L 0.29477163)** | **5.4968:1** | **✓** |

`--accent-termo`'s luminance longhand, so a reviewer can check it without running anything:

```
R: 192/255 = 0.75294118 → ((0.75294118+0.055)/1.055)^2.4 = (0.76582102)^2.4 = 0.52711513
G: 138/255 = 0.54117647 → (0.56509618)^2.4                                = 0.25415209
B:  30/255 = 0.11764706 → (0.16364650)^2.4                                = 0.01298303
L  = 0.2126(0.52711513) + 0.7152(0.25415209) + 0.0722(0.01298303)
   = 0.11206467 + 0.18177039 + 0.00093738 = 0.29477163
```

**Every mark against the surface it is drawn on:**

| mark | against | ratio | 1.4.11 floor 3:1 |
|---|---|---|---|
| present's underline (`--ink`, 3px) | `--paper-desk` | 15.0124:1 | ✓ |
| absent's strike (**`--ink`**, 2px) | `--paper-tint` | 13.9929:1 | ✓ |
| absent's strike (`--ink`) | its own glyph (`--ink-2`) | 2.9557:1 | n/a — see below |
| caret outline (`--ink`, 2px inset) | `--paper-desk` | 15.0124:1 | ✓ |
| typed's border (`--ink-2`, 1.5px) | `--paper-desk` | 5.0791:1 | ✓ |
| held's border (`--ink-2`, 1.5px **dashed**) | `--paper-desk` | 5.0791:1 | ✓ |
| present/correct border (`--ink`) vs absent's (`--line-soft` #E4DCCB, L 0.71992176) | — | 12.2750:1 apart | ✓ |
| correct's **fill** | `--paper-desk` | 2.7311:1 | **✗ — and it is never the sole carrier** |

**The strike is drawn in `--ink`, not in the glyph's own `--ink-2`, and that is a correction rather than a taste.** `text-decoration-color: var(--ink-2)` on a tile whose `color` is also `var(--ink-2)` is **1.0000:1** — the mark and the letter are the *same colour*, so on every glyph with a horizontal midstroke (A, E, F, H, and the crossbar of a Fraunces G) the strike merges into the letterform and `A` reads as `Ⱥ` rather than as a struck `A`. Moving the mark to `--ink` gives **13.9929:1** against the tint it is drawn on (the 1.4.11 figure that governs) and **2.9557:1** against the glyph it crosses, which is a plainly visible darker rule laid over a lighter letter — the same 30-vs-103 greyscale step the board uses everywhere else. **ADR-0041 is not reopened by this**: that ADR governs the *accent*, and `--ink` / `--ink-2` are neutrals whose relationship the design system already fixes. The identical change applies to the keyboard's `.keyAbsent`.

**The second carrier for each state, named** (`DESIGN.md:22` as amended by ADR-0041): **correct** — the border steps from `--line` (1.3725:1) to `--ink` (15.0124:1), a 12.275:1 step against absent's border, and it is the only judged tile with **no** typographic mark; **present** — the underline plus the `--ink` border; **absent** — the strike, the `--line-soft` border and the pale glyph; **typed** — the glyph's presence plus the border step; **held** — `typed`'s border made **dashed**, a shape difference at 5.0791:1 against the paper; **empty** — the glyph's absence; **caret** — the inset outline, the repo's shipped idiom (`sudoku-board.module.css:195-199`, `nonogram-board.module.css:398-402`) reused as a **pure state class**, because nothing on this board is focusable and `:focus-visible` can never match.

**What a monochrome screenshot reads** — sRGB greyscale equivalents from the same luminances: `--accent-termo` **148**, `--paper-desk` 242, `--paper-card` 247, `--paper-tint` 235, `--ink` 30, `--ink-2` 103, `--line` 209, `--line-soft` 221. *Correct* is a mid-grey tile with a near-black letter — the only dark tile on the board. *Present* is a white tile with a near-black letter and a heavy black rule beneath it, inside a black frame. *Absent* is a faintly darker tile with a mid-grey letter struck through, inside a frame so pale it barely registers. Three unmistakable readings at a glance across thirty tiles with **no hue involved**, which is also the colour-blindness answer.

**The underline's geometry, per viewport, with the arithmetic — because at the first draft's numbers it read as a second bottom border.** `text-underline-offset: <length>` is measured **from the alphabetic baseline** (CSS Text Decoration 4; Chrome and WebKit both use the baseline as the zero position for a length), so the mark occupies `baseline + offset` to `baseline + offset + thickness`. The tile is `box-sizing: border-box`, `padding: 0`, `align-items: center`, `line-height: 1`, and the glyph is uppercase, so the baseline **is** the letter's foot:

```
content box   = tile − 2 × 1.5px border
line-box top  = (content box − font-size) / 2
baseline      = line-box top + 0.85 × font-size          ← Fraunces' ascent ratio, back-derived
                                                            from the two browser measurements below
gap to border = content box − (baseline + offset + thickness)
```

| | desktop | ≤768px |
|---|---|---|
| tile · border · content box | 52 · 1.5 · **49** | 44 · 1.5 · **41** |
| font-size · line-box top | 28 · `(49−28)/2` = **10.5** | 24 · `(41−24)/2` = **8.5** |
| baseline | `10.5 + 0.85×28` = **34.3** | `8.5 + 0.85×24` = **28.9** |
| **first draft** (offset 6, thickness 3) | `49 − (34.3+6+3)` = **5.7px** | `41 − (28.9+6+3)` = **3.1px** |
| **shipped** (offset 4; thickness 3 / 2) | `49 − (34.3+4+3)` = **7.7px** | `41 − (28.9+4+2)` = **6.1px** |

At 3.1px a 3px ink rule sits three pixels above a 1.5px ink border of the *same colour* and the pair reads as one doubled edge — which is what a browser render showed. The shipped numbers put **5.1×** the border's own thickness of paper between them at desktop and **4.1×** at mobile, and hold 4px between the letter's foot and the mark at both sizes (0.143em and 0.167em — the mark hugs the smaller glyph slightly more, which is the right direction). **4px is on the 4pt scale at both viewports**, which is why deviation 7 in §12.1 lists only the keyboard's 3px offset.

**The keyboard's underline needs no step and the arithmetic says why.** `.keyPresent` is offset 3 / thickness 2 on a key whose content box is `52 − 2×1.5 − 2×4` = 41px desktop and `48 − 2×1.5 − 2×4` = 37px mobile, with a 17px / 15px glyph: baseline at `(41−17)/2 + 0.85×17` = 26.45 and `(37−15)/2 + 0.85×15` = 23.75, so the gap to the content edge is `41 − 31.45` = **9.55px** and `37 − 28.75` = **8.25px**, plus 4px of padding and 1.5px of border below that. Nothing merges.

**Rejected, each with the reason:**

- **Wordle's green/yellow/grey.** Two new hues in a system whose rule is one accent per game (`DESIGN.md:20`). ADR-0041 decision 6 does not forbid it by name — that decision freezes the four accent *values* — but it is the same palette-change move Fernando declined on 2026-08-02, and reopening it needs its own ADR.
- **Mustard ring for `present`.** A state-bearing boundary at 2.7311:1 — below WCAG 1.4.11's 3:1.
- **Mustard foot-band for `present`** (`box-shadow: inset 0 -6px 0 var(--accent)`). The obvious first draft, and a **live impeccable finding**: `scanCssTextForInsetStripe` (`node_modules/impeccable/cli/engine/rules/checks.mjs:963-1018`) fires `side-tab` on an inset layer with blur 0, spread 0, `ay ∈ [3,12]`, `ax === 0` and **chroma ≥ 30**. Mustard's chroma is `192 − 30 = 162`. None of the selector guards (`:hover`, `active|current|selected`, structural tags, `width ≤ 40`) saves `.tilePresent`. **`--ink`'s chroma is `0x21 − 0x19 = 8 < 30`, which is why the neutral answer is also the compliant one.** *(This is a trap found by reading the rule source, not by reasoning — it is the single most useful thing paper C contributed to the visual design.)*
- **`border-bottom: 6px solid var(--accent)`** for the same band. Fires `border-accent-on-rounded` (`checks.mjs:57`): dominant edge (`6 >= 1.5 × 2`), chromatic, `radius > 0`, `w >= 2`.
- **A pseudo-element band.** `scanCssTextForPseudoStripe` (`checks.mjs:1430`) is the same rule from the other direction.
- **`--paper-tint` as `absent`'s only carrier.** Against `--paper-desk` it is **1.0729:1** — 235 vs 242 in greyscale. Invisible. Named so a later "simplification" cannot drop the strike and keep the tint.
- **The `--ink` / `--ink-2` glyph step as a sufficient carrier.** **2.9557:1** — *below* 3:1. A reinforcement, never the mechanism.

### 12.3 The keyboard

**pt-BR QWERTY, three rows, 10 / 9 / 7 + 2 commands. There is no Ç key.** `evaluate.ts:16` builds `SHAPE = /^[a-z]{5}$/` from `WORD_LENGTH`, and `normalizeWord` maps `ç → c` before anything is compared, so a Ç key would write **the same letter** as the C key and `deriveKeyboardState` (`keyboard.ts:23`), which keys on the normalized letter, could never colour it differently. A key that duplicates another and can never carry its own state is a trap, not an affordance. Removing it leaves a 9-key home row, which is also the row length the 20-column grid wants.

**One flat CSS grid of 20 equal columns**; letter keys span 2, command keys span 3:

```
row 1  Q W E R T Y U I O P     starts 1,3,5,7,9,11,13,15,17,19   span 2   → 20 columns exactly
row 2  A S D F G H J K L       starts 2,4,6,8,10,12,14,16,18     span 2   → inset one column each side
row 3  enviar(1, span 3) · Z X C V B N M (4,6,8,10,12,14,16 span 2) · apagar(18, span 3)  → 3+14+3 = 20
```

Row 2's one-column inset is `20 + 8 = 28px` at desktop — the QWERTY half-key stagger, drawn by the grid rather than by spacers.

**Inline `grid-column` placement is legal here, and the distinction from Sudoku is recorded rather than assumed.** `sudoku-board.module.css:265-269` refuses it because *"an inline style would also apply at ≤768px, where the keypad is four fluid columns and these track numbers do not exist — a media query cannot override a style attribute."* Termo's template is **identical at both viewports** (only the gap and the row height change), so its track numbers **do** exist at both, and the placement is a component-side table rather than 28 `nth-child` rules.

**Key state colouring** — the same vocabulary as the board on a smaller surface, with a carrier the board does not have (the shadow):

| key state | fill | border 1.5px | glyph | mark | shadow |
|---|---|---|---|---|---|
| **untouched** | `--paper-card` | `var(--line)` | `--ink` (15.6663:1) | — | yes |
| **correct** | `var(--accent)` | `var(--ink)` | `var(--ink-on-accent, var(--ink))` (5.4968:1) | — | yes |
| **present** | `--paper-card` | `var(--ink)` | `--ink` (15.6663:1) | `underline`, `--ink`, 2px, offset 3px | yes |
| **absent** | `--paper-tint` | **`var(--ink-2)`** | `--ink-2` (4.7342:1) | `line-through`, **`--ink`**, 2px | **none** |

**The keyboard's `absent` is discriminated against `untouched`, not against `present`/`correct`, and that changes which carriers count.** On the board, `absent` is read beside `present` and `correct`, whose borders are `--ink` — **12.2750:1** apart from `--line-soft` — so the border alone carries it. On the keyboard, a spent key is read beside the 20-odd keys nobody has tried yet, and the first draft's four carriers measure, untouched → absent:

| carrier | untouched | absent | ratio between them | 1.4.11 floor 3:1 |
|---|---|---|---|---|
| fill | `--paper-card` #FBF7EF (L 0.93262753) | `--paper-tint` #F1EADD (L 0.82766867) | **1.1196:1** | ✗ |
| border (first draft) | `--line` #D8D0C2 (L 0.63605722) | `--line-soft` #E4DCCB (L 0.71992176) | **1.1222:1** | ✗ |
| glyph | `--ink` #211D19 (L 0.01272250) | `--ink-2` #6E6659 (L 0.13539008) | **2.9557:1** | ✗ — and §12.2's rejected list already refuses this one by name |
| shadow | `ink@10%` present | none | **1.2129:1** at the shadow's own edge, and **deleted outright at ≤768px** before the F15 fix below | ✗ |
| **mark** | none | `line-through` | the mark's **presence**; the mark is 13.9929:1 on the tint it crosses | ✓ |

So the first draft had **one** carrier that cleared any threshold, on the primary viewport, for the state a player reads most often — and the sentence claiming four was wrong. **The fix is a neutral border step, entirely inside ADR-0041:** `absent`'s border becomes **`var(--ink-2)`**, which is `(0.13539008 + 0.05)` against `(0.63605722 + 0.05)` = **3.7006:1** away from `untouched`'s `--line`, clearing the 3:1 floor, and **5.0791:1** against the desk paper the keyboard sits on / **4.7342:1** against the tint it encloses, so the mark is legible in its own right. A *fill* step was rejected: 3:1 against `--paper-card` needs a luminance of `(0.93262753 + 0.05)/3 − 0.05` = **0.27754**, greyscale ~145 — a mid-grey key in a paper system, and a new colour token of exactly the kind ADR-0041's rejected list refuses (*"a third mechanism where the second already generalises"*).

**Two carriers now clear 3:1** — the strike's presence at 13.9929:1, and the border step at 3.7006:1 — with the fill, the glyph and the shadow as reinforcement that is honestly labelled as reinforcement. A spent key sits flat on the desk with a darker, struck outline, and it survives greyscale: `--paper-card` 247 / `--paper-tint` 235 fill, `--line` 209 / `--ink-2` 103 border, `--ink` 30 / `--ink-2` 103 glyph, plus a 30-value rule through the letter.

**`absent`'s border is `--ink-2` on the keyboard and `--line-soft` on the board, deliberately.** The two surfaces discriminate against different neighbours: on the board, `--ink-2` would be **2.9557:1** from `present`/`correct`'s `--ink` and would read as a *third* dark border in a column of six tiles; on the keyboard there is no `--ink` neighbour to collide with, because `present` and `correct` also carry a mark or a fill. Stated so a later "unify the two absent rules" reads as the regression it would be.

**Type**: letter keys **Fraunces 600, 17px desktop / 15px mobile**; command keys `var(--text-button)` desktop and **11px** mobile — Sudoku's shipped split (Fraunces digits at `sudoku-board.module.css:250-252`, Instrument Sans `apagar` at `:342-343`), not an invention. **11px is the floor exactly**: `undersized-ui-text` (`checks.mjs:3439`) requires `fontSize < 11 && dtLen >= 2`, and `enviar`/`apagar` are 6 characters inside `<button>`s so `isInteractive` is true and the floor binds. A **letter** key's direct text is one character, so `dtLen === 1` puts it out of the rule's reach at any size.

**Shadow**: `--shadow-sm` (3px) desktop, **2px** mobile, both `color-mix(in srgb, var(--ink) 10%, transparent)` — the one sanctioned neutral shadow in the frame set (`sudoku-board.module.css:345-349`: *"because `apagar` is a neutral control rather than a game-accent one"*). A letter key is likewise neutral until it is judged. The per-viewport step down is the frame set's own move (`screen.module.css:419-421` ships `5px 5px 0` on mobile against `--shadow-lg`'s 6px). Press is `DESIGN.md` verbatim — translate 1px toward the shadow, shadow shrinks 1px.

### 12.4 The physical keyboard listener

**`window`-scoped, registered in the Termo screen's own `useEffect`, torn down on unmount** — a deliberate divergence from ADR-0030 decision 3's *"one listener on the board container"*, argued in ADR-0042 decision 4.

The reason is structural, not stylistic: a grid game's caret lives inside its board, so the container **is** the focused element by construction. A Termo player expects to type the instant the page paints, without clicking anything, and a container listener would be dead until something took focus. Window listeners are established practice here — `use-play-lifecycle.ts:176-177` registers `pagehide`/`pageshow` on `window` (`:175`'s `visibilitychange` is `document`-scoped, as that event requires), and `use-pointer-stroke.ts` carries `armWindowEnd`/`detachWindowEnd`.

**The listener serves the UNFOCUSED page, and that is the whole of its job.** The instant anything on the page holds focus, that element's own semantics own the keystroke: a focused `<button>` turns `Enter` and `Space` into a synthesised `click`, and a focused `<a href>` turns `Enter` into a navigation. A window listener that also fires is a **second** handler for one keypress.

**Guards, in order:**

1. bail if `status !== "playing"`;
2. bail on `event.metaKey || event.ctrlKey || event.altKey`;
3. **bail if the event has an interactive target** — `event.target instanceof Element && event.target.closest('button, a[href], [role="button"], [tabindex], input, textarea, select, [contenteditable]')`;
4. then `Enter` → submit, `Backspace` → delete one letter **with `preventDefault`** (it is a history-back gesture in some browsers — `board.tsx:246-255`'s own note), otherwise accept the key when **`normalizeWord(event.key)` matches `/^[a-z]$/`**.

**Guard 3 is blocking, not tidying, and the first draft's `input, textarea, [contenteditable]` was not close to enough.** Three concrete double-fires it lets through, all of them on this screen's own chrome:

- **Focus a letter key, press `Enter`.** The window listener submits the draft **and** the browser synthesises a `click` on the key, which types that letter into the row the submit just consumed.
- **Focus `enviar`, press `Enter`.** Two submits of the same guess — two POSTs, and the second races the first's response.
- **Focus the "← Hoje" link, press `Enter`.** A guess is submitted, spending one of six turns, while the page navigates away from the board that would have shown the verdict.

**And the fourth case is the one that decides it: a screen-reader user cannot play at all.** NVDA and JAWS stay in browse mode on a `<button>` and activate it with `Enter`, so every single letter a screen-reader user enters would be followed by a submit — six turns spent in five keystrokes. The listener is unusable for the exact audience §13 is written for, and no amount of copy fixes it.

`closest()` rather than a tag test, because the event target inside a `<button>` can be a text node's parent span; `[tabindex]` rather than `[tabindex="0"]`, because the roving-tabindex keyboard gives 27 of its 28 keys `tabindex="-1"` and a programmatically focused one is just as much a live target. With nothing focused, `event.target` is `<body>`, `closest()` returns `null`, and the listener runs — which is the case it exists for.

**The cost, and the mitigation.** With guard 3 in place, a mouse user who clicks one on-screen key leaves that key focused and loses physical typing until they click elsewhere. So a **pointer** activation blurs its key: `onClick={(event) => { if (event.detail !== 0) { event.currentTarget.blur(); } onLetter(letter); }}`. `event.detail === 0` is this repo's own shipped test for keyboard activation (`nonogram/board.tsx:240-241`), so a keyboard user's focus is never taken away, a pointer user is returned to the unfocused page the listener serves, and `:focus-visible` never matched a pointer click anyway so nothing visible changes. The blur does **not** disturb the roving tabindex: `focused` is written only by `onFocus`, and blurring fires no `onFocus`.

**T-WEB-S89 drives it, on `document`-level dispatch rather than on a helper:** dispatch a `keydown` for `Enter` with `target` set to the `enviar` button and assert `submit` ran **exactly once** (the button's own click), not twice; dispatch the same with `target` set to a letter key and assert exactly one `type` and **zero** submits; dispatch it with `target` set to the back `<Link>` and assert **zero** submits; dispatch it with `target` set to `document.body` and assert exactly one submit.

That last clause is a design decision, not plumbing, and it is **AC 2's mechanism**: an ABNT2 player who types `á` or `ç` out of habit gets `a` and `c` rather than a dead key. *"Accent-free input matches accent-insensitively"* is applied to the **keystroke**, not only to the comparison, and it reuses the repo's one normalization function rather than adding a second.

### 12.5 Motion

**Nothing on `/termo` is a `@keyframes` animation.** Everything is a `transition`, which puts `bounce-easing`'s name regex (`checks.mjs:484`, `/bounce|elastic|wobble|jiggle|spring/i`) **structurally out of reach** rather than merely unmatched. `--ease-settle`'s y2 = 1.05 is inside the separate bezier check's allowed `[-0.1, 1.1]` band (`checks.mjs:497`), so the token is not a finding — `conclusion-view.module.css:180-183` already records this. The standing gate `nonogram-screen.test.tsx:1652` gets a Termo copy anyway (**T-WEB-S92**).

1. **The row reveal.** On submission each tile transitions `background-color`, `border-color`, `color`, `text-decoration-color` and `box-shadow` over `var(--duration-fast)` (150ms) `var(--ease-settle)`, **staggered 60ms per column** via `transition-delay` on the judged classes. Total row settle = `150 + 4 × 60 = ` **390ms**. `transition-delay` is read from the destination state's computed style, so a tile becoming *typed* (0ms) is unaffected and only a tile becoming *judged* picks up the stagger. This is `DESIGN.md:44`'s *"tinta que assenta"* applied to five tiles in sequence — ink drying across a row. It is ADR-0034 decision 2's permitted **per-entry paint feedback** and **must not be described as the celebration** in any PR, comment or ticket.
2. **No tile flip.** Rejected on four independent grounds: a 3D `rotateX` reveal is not "ink that settles"; a staggered flip runs ~600ms against `DESIGN.md:44`'s 150–250ms window; it needs `@keyframes`, which re-arms the name gate for nothing; and it would be a second motion language on a screen whose only other motion is the press.
3. **No shake, no colour change, nothing on a rejected guess.** Carried by the visible `.notice` line and the announcer. `PRODUCT.md` principle 4 — *"The ritual is calm… nothing nags."* This is also why **no new use of `--accent-app` appears anywhere on this screen**; ADR-0037 consequence (e) retired the same collision by having no error state at all. (`shake` does not match the banned name regex, and that is **not permission** — `wobble` and `jiggle` being banned says what the system thinks of the gesture.)
4. **Board tiles have no press affordance and no shadow to slide toward** — ADR-0035 consequence (a) deviation 4's argument, inherited.
5. **Termo's own `prefers-reduced-motion` block, in Termo's own module** (CSS Modules hash per file — the shared block at `screen.module.css:322-326` covers `.hint` and can never reach `.tile` or `.key`), standing down **the stagger as well as the transition**:

```css
@media (prefers-reduced-motion: reduce) {
  .tile,
  .key {
    transition: none;
  }
  /* The stagger goes down with the transition. A delay on a paint that no
     longer animates is 390ms of a reduced-motion user staring at a stale
     row — the same class of subtlety conclusion-view.module.css:553-556
     records for the keyframe's END state. */
  .tileJudged:nth-child(1),
  .tileJudged:nth-child(2),
  .tileJudged:nth-child(3),
  .tileJudged:nth-child(4),
  .tileJudged:nth-child(5) {
    transition-delay: 0s;
  }
}
```

### 12.6 The stylesheet, in outline

**File order is load-bearing** (`apps/web/test/css-source.ts`'s `bodyOf` is first-match and **throws** on a miss): all top-level rules, then the geometry `@media (max-width: 768px)`, then the chrome one, then reduced motion last. `nonogram-board.module.css:15-21` states the same rule.

```css
/* ── page root ───────────────────────────────────────────────────────── */
.pageTermo { --grid-card-rot: 0.7deg; --stats-card-rot: -0.9deg;
             --tape-rot: 4deg; --board-mobile-max: 254px; }

/* ── board ───────────────────────────────────────────────────────────── */
/* Six REAL flex row boxes, never `display: contents`: a role-bearing element
   with `display: contents` has a long, documented history of being dropped
   from the accessibility tree (ADR-0030's Rejected list), and here there is
   no reason to risk it — every tile is a fixed square, so rows cost nothing
   geometrically. ADR-0035's "never a wrapper element" rule protects a single
   flat grid whose TRACKS compute the geometry, and does not transfer. */
/* NO `touch-action` here, and the absence is deliberate. The board is
   read-only output — there is nothing to tap, so there is no tap delay to
   remove — and `manipulation` would cost DOUBLE-TAP-TO-ZOOM on a surface
   whose glyphs are 24px on a phone. That is a real magnification affordance
   on the one element of this screen a low-vision player wants to enlarge.
   The three shipped boards go the other way for reasons Termo does not
   share: sudoku-board.module.css:64 is `manipulation` on a board whose cells
   are TAP TARGETS, and nonogram/binairo are `none` because they drag-paint.
   `touch-action: manipulation` lives on `.keyboard` below, where the tap
   delay is actually paid. */
.grid { display: flex; flex-direction: column; gap: 4px; }
.row  { display: flex; gap: 4px; }

.tile {
  box-sizing: border-box; display: flex; align-items: center;
  justify-content: center; margin: 0; padding: 0;
  width: 52px; height: 52px;
  background: var(--paper-desk);
  border: 1.5px solid var(--line);
  border-radius: var(--radius-cell);
  color: var(--ink);
  font-family: var(--font-display); font-size: 28px; font-weight: 600;
  line-height: 1; text-transform: uppercase;
  transition:
    background-color var(--duration-fast) var(--ease-settle),
    border-color     var(--duration-fast) var(--ease-settle),
    color            var(--duration-fast) var(--ease-settle),
    text-decoration-color var(--duration-fast) var(--ease-settle),
    box-shadow       var(--duration-fast) var(--ease-settle);
}
.tileTyped   { border-color: var(--ink-2); }
/* The held turn (ADR-0039 consequence (g)). `border-style` is NOT animatable,
   so this snaps at every motion setting and owes no reduced-motion rule. */
.tileHeld    { border-color: var(--ink-2); border-style: dashed; }
.tileCaret   { outline: 2px solid var(--ink); outline-offset: -2px; }
/* The strike is --ink, NOT the glyph's own --ink-2: same-colour would be
   1.0000:1 and `A` would read as `Ⱥ` on every glyph with a midstroke (§12.2).
   13.9929:1 on the tint it crosses; ADR-0041 governs the ACCENT, not the
   neutrals. */
.tileAbsent  { background: var(--paper-tint); border-color: var(--line-soft);
               color: var(--ink-2);
               text-decoration: line-through; text-decoration-color: var(--ink);
               text-decoration-thickness: 2px; }
/* offset 4px, not 6: at 6px the mark landed 3.1px above a 1.5px ink border at
   ≤768px and the two read as one doubled edge (§12.2's arithmetic). */
.tilePresent { border-color: var(--ink);
               text-decoration: underline;    text-decoration-color: var(--ink);
               text-decoration-thickness: 3px; text-underline-offset: 4px; }
.tileCorrect { background: var(--accent); border-color: var(--ink);
               color: var(--ink-on-accent, var(--ink)); }

.tileJudged:nth-child(1) { transition-delay: 0ms; }
.tileJudged:nth-child(2) { transition-delay: 60ms; }
.tileJudged:nth-child(3) { transition-delay: 120ms; }
.tileJudged:nth-child(4) { transition-delay: 180ms; }
.tileJudged:nth-child(5) { transition-delay: 240ms; }

.tileSkeleton { background: var(--paper-tint); }

/* ── the notice row — AC 3's surface, plus ADR-0039's retry ──────────── */
/* ALWAYS rendered and reserved at its TALLEST state, so neither the notice
   appearing nor the retry button appearing moves the keyboard. Tallest
   content is the retry button: 14px × 1.5 line-height = 21px + 2 × 4px
   padding = 29px, and `min-height: 36px` clears it with 7px to spare while
   also clearing the 13px notice line (13 × 1.5 = 19.5px). */
.noticeRow { display: flex; align-items: center; justify-content: center;
             gap: var(--space-2); min-height: 36px;
             margin-top: var(--space-4); }

/* Non-zero padding on BOTH axes: `cramped-padding`'s flush branch
   (checks.mjs:3198-3341) reads a visible boundary and `padding <= 2`.
   screen.module.css:224-229 records the same reason for `.hint`. */
.notice { margin: 0; padding: var(--space-1) var(--space-2);
          font-size: 13px; line-height: 1.5; color: var(--ink-2);
          text-align: center; }

/* The nonce span (§13.1b item 6b). NOT `aria-hidden` — an aria-hidden
   mutation is invisible to the live region, which is the whole point of the
   element — and deliberately carries NO `font-size`, so it inherits .notice's
   13px and `undersized-ui-text` (which needs `fontSize < 11`) cannot reach it
   however its content is measured. `font-size: 0` would have been the obvious
   draft and is exactly the wrong instinct here. `user-select: none` so the
   marker never lands in a copied selection. */
.nonce { user-select: none; }

/* ADR-0039's retry. A text-weight button rather than a filled CTA: it sits
   under the board in the calm state PRODUCT.md principle 4 asks for, and a
   solid accent button here would be the loudest thing on a screen whose
   accent has one job. 21 + 8 = 29px tall, clearing WCAG 2.5.8's 24 × 24
   floor; 2.5.5's 44px is the same essential-presentation trade §12.1
   deviation 2 already records for this screen's controls. */
.noticeRetry { box-sizing: border-box; padding: var(--space-1) var(--space-2);
               background: none; border: 0; border-radius: var(--radius);
               color: var(--ink); font: var(--text-button); line-height: 1.5;
               text-decoration: underline; text-underline-offset: 3px;
               text-decoration-thickness: 2px;
               /* --ink, not the accent: this underline IS the button's only
                  affordance (no border, no fill), so unlike §16's hover rule
                  it is load-bearing and owes the 3:1 floor. 15.0124:1. */
               text-decoration-color: var(--ink);
               cursor: pointer; }
.noticeRetry:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

/* ── keyboard ────────────────────────────────────────────────────────── */
/* `touch-action: manipulation` lives HERE, not on the board: 28 tap targets
   is where the ~300ms double-tap wait is actually paid, and there is nothing
   on a 48px key worth double-tapping to zoom. `none` is wrong — it would kill
   pinch-zoom on the page. */
.keyboard { display: grid; grid-template-columns: repeat(20, minmax(0, 1fr));
            grid-template-rows: repeat(3, 52px); gap: 8px;
            width: 552px; margin-top: 30px;
            touch-action: manipulation; }
            /* NO background, NO border, NO radius, NO shadow — `cramped-padding`'s
               flush branch reads a visible boundary, and `nested-cards` reads
               isCardLikeFromProps (checks.mjs:227-230). Both return on their
               first guard. */

.key { box-sizing: border-box; display: flex; align-items: center;
       justify-content: center; padding: var(--space-1) var(--space-2);
       background: var(--paper-card); border: 1.5px solid var(--line);
       border-radius: var(--radius); color: var(--ink);
       font-family: var(--font-display); font-size: 17px; font-weight: 600;
       text-transform: uppercase; cursor: pointer;
       box-shadow: var(--shadow-sm) color-mix(in srgb, var(--ink) 10%, transparent);
       transition: transform var(--duration-fast) var(--ease-settle),
                   box-shadow var(--duration-fast) var(--ease-settle),
                   background-color var(--duration-fast) var(--ease-settle),
                   border-color var(--duration-fast) var(--ease-settle),
                   color var(--duration-fast) var(--ease-settle); }
/* The press splits in two, and the split is not cosmetic. `.key:active` is
   (0,2,0) and `.keyAbsent` is (0,1,0), so a single `.key:active { box-shadow }`
   OUTRANKS `.keyAbsent { box-shadow: none }` at BOTH viewports and a spent key
   would grow a shadow the instant it is pressed. `:not(.keyAbsent)` on the
   shadow half fixes it by not matching at all; the translate stays on every
   key, because a spent key is still pressable and still writes its letter. */
.key:active { transform: translate(1px, 1px); }
.key:not(.keyAbsent):active {
              box-shadow: 2px 2px 0 color-mix(in srgb, var(--ink) 10%, transparent); }
/* --ink, not var(--accent): mustard is 2.7311:1 on desk paper, below WCAG
   1.4.11's 3:1 floor for a focus indicator. §12.1 deviation 6. */
.key:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }

/* NO `font-family` line: the `font:` shorthand below resets it, and
   --text-button already carries var(--font-ui). A preceding font-family
   declaration is dead bytes that read to the next contributor as a rule. */
.keyCommand { font: var(--text-button); text-transform: none; }

.keyCorrect { background: var(--accent); border-color: var(--ink);
              color: var(--ink-on-accent, var(--ink)); }
.keyPresent { border-color: var(--ink);
              text-decoration: underline; text-decoration-color: var(--ink);
              text-decoration-thickness: 2px; text-underline-offset: 3px; }
/* border --ink-2, not --line-soft: 3.7006:1 from untouched's --line, which is
   the only 3:1 step this key had besides the strike (§12.3). Strike --ink for
   the same reason `.tileAbsent` carries it. */
.keyAbsent  { background: var(--paper-tint); border-color: var(--ink-2);
              color: var(--ink-2); box-shadow: none;
              text-decoration: line-through; text-decoration-color: var(--ink);
              text-decoration-thickness: 2px; }

/* A SIBLING of .keyboard, never a child. `.keyboard` is a 20-column grid with
   all 28 keys explicitly placed across rows 1–3, so an unplaced span
   auto-places into an IMPLICIT fourth row one column wide — ~20px holding a
   63-character sentence — and `margin-top` on a grid item is inert against
   `gap` besides. sudoku-board.module.css:318-323 places its identical
   affordance and says so in the file. Moving it out is the cleaner of the two
   fixes and buys a second thing: it keeps a decorative sentence out of the
   `role="group"` labelled `teclado`. */
.affordance { margin-top: var(--space-3); font-size: 13px; color: var(--ink-2); }

/* THIS module's copy of .placeholder — must sit AFTER .key and .tile:
   same specificity, later wins (landmine 10 / plan 020 N24). A class hashed
   in screen.module.css cannot reach one hashed here. */
.placeholder { cursor: default; pointer-events: none; }

/* clip-path, not opacity/visibility: `content-hidden-at-rest`
   (checks.mjs:4939-5010) counts a clip-path element as VISIBLE. And no
   font-size at all, so it inherits 16px and `undersized-ui-text` cannot
   reach it whatever isVisuallyHidden does (§26 item 12). */
.announcer { position: absolute; width: 1px; height: 1px; margin: -1px;
             padding: 0; overflow: hidden; clip-path: inset(50%);
             white-space: nowrap; border: 0; }

@media (max-width: 768px) { /* geometry */
  .tile { width: 44px; height: 44px; font-size: 24px; }
  /* Stepped WITH the glyph: at 28px→24px and 52px→44px the first draft's
     3px mark ended 3.1px above the border (§12.2). */
  .tilePresent { text-decoration-thickness: 2px; }
  .grid { gap: 3px; }
  .row  { gap: 3px; }
}

@media (max-width: 768px) { /* chrome */
  .keyboard { box-sizing: border-box; width: 100%; max-width: 350px;
              grid-template-rows: repeat(3, 48px); gap: var(--space-1);
              margin-top: var(--space-5); }
  .key { font-size: 15px; }
  /* :not(.keyAbsent) on BOTH shadow rules. A bare `.key { box-shadow }` here
     is (0,1,0) and sits LATER in the file than `.keyAbsent { box-shadow:
     none }`, so at equal specificity it wins and silently restores the shadow
     on every spent key at the primary viewport — browser-verified before the
     fix: `none` at 1440, `rgba(33,29,25,0.1) 2px 2px 0px` at 390. Pinned by
     a stylesheet-TEXT assertion, because jsdom computes no cascade. */
  .key:not(.keyAbsent) {
         box-shadow: 2px 2px 0 color-mix(in srgb, var(--ink) 10%, transparent); }
  .key:not(.keyAbsent):active {
         box-shadow: 1px 1px 0 color-mix(in srgb, var(--ink) 10%, transparent); }
  /* 11px is `undersized-ui-text`'s floor EXACTLY and cannot go lower, so the
     fit at 320px is bought with padding instead: 2px, not --space-2's 8px,
     takes the command key's content box from 38.6 − 16 − 3 = 19.6px to
     38.6 − 4 − 3 = 31.6px. Shipped unconditionally rather than left as a
     conditional item, because `text-overflow` needs `delta >= 16`
     (checks.mjs:4782) and 320 is not a scanned viewport — CI is
     structurally blind to a 3px clip and always will be. */
  .keyCommand { font-size: 11px; padding-inline: 2px; }
  .affordance { display: none; }   /* a phone has no keyboard to advertise */
}

@media (prefers-reduced-motion: reduce) { /* §12.5 item 5 */ }
```

**The 320px command-key fit is a browser number, not a green check, and it ships with a stated ladder.** At 320px the command key is 38.6px wide (§12.1), `apagar` is six characters of Instrument Sans 600 at 11px, and the 2px padding above leaves a **31.6px** content box. The measurement is owed at step 6, at 320px, in a real browser, and its result goes in the PR body. If `apagar` still overflows: drop `padding-inline` to **0**, which gives `38.6 − 0 − 3` = **35.6px**. `cramped-padding` cannot fire either way and this is checked rather than hoped — its main branch (`checks.mjs:3144-3180`) needs `rect.width > 100` and 38.6 fails it; its flush branch (`:3198-3341`) needs `!hasDirectText` and a command key's direct text is six characters. Below that there is nothing left to give: 11px is `undersized-ui-text`'s exact floor, a `span 4` command would need a 22-column grid whose letter keys fall to 21.8px — under WCAG 2.5.8's 24px floor that §12.1 deviation 2 explicitly holds — and a shorter label for `apagar` has no honest pt-BR form.

### 12.7 impeccable, rule by rule

Read from `node_modules/impeccable/cli/engine/rules/checks.mjs` (3.4.0, exact-pinned). **`low-contrast` and `cream-palette` are wildcard-ignored on every host CI scans** (`.impeccable/config.json:19-39`, issue #51) **and are not evidence** — which is why every figure in §12.2 and §16 is computed.

| rule | source | why it cannot fire |
|---|---|---|
| **`hero-eyebrow-chip`** | `:407-457`; `:423` `if (!siblingTag) return []` | The `<h1>` is the **first element child** of `.titleRow`; the kicker is a sibling of the *wrapper*. `h1.previousElementSibling === null` and the rule returns on its guard. Not escapable by CSS — only the structure works |
| **`kicker-above-heading`** | `:2490-2541`; `:2500` `const kicker = heading.previousElementSibling; if (!kicker …) continue` | Same structure. **Both rules are needed**: at 1440 the h1 is 54px ≥ 48 and an 11px kicker at 0.16em tracks 1.76px ≥ 1.6, so the hero rule owns it; at 390 the h1 is 34px < 48 and the kicker rule owns it instead |
| ↳ which views owe it | | **Four, and they pass by TWO different mechanisms.** Two new and owing the wrapper, so `h1.previousElementSibling === null`: Termo's `PlayView` and its `PlaySkeleton`. `ConclusionView` (`:147-151`, `:195-197`) is the same shape and inherited. **`DailyUnavailable` is NOT** — verified by reading `daily-unavailable.tsx:37-47`: an `aria-hidden` decorative `<div className={styles.tape}/>` sits *immediately before* its `<h1>`, so `previousElementSibling` is a real element and **neither rule returns on that guard**. They both return one guard later, on the *text*: `checkHeroEyebrow` at `:428` needs `text.length >= 2` and `isKickerCandidate` at `:2462` needs `kickerText.length >= 2`, and an empty tape has none. The component's own comment says exactly this. **T-WEB-S93 must therefore assert the two mechanisms separately** — a uniform `previousElementSibling === null` assertion over all four views reds on a shipped component that is green in the real scan. Pinned on `T-WEB-S26`/`S47`'s precedent |
| ↳ the trap this creates for `.dayWordLead` | `:2492` `doc.querySelectorAll('h1, h2, h3, h4, [role="heading"]')` | `.dayWordLead` ("A palavra de hoje era") is an 11px tracked-uppercase line sitting immediately above `.dayWord` — **textbook `kicker-above-heading` shape**. It is safe **only because `.dayWord` is not a heading**: both rules anchor exclusively on `h1`–`h4` and `[role="heading"]`, and `.dayWord` is a `<p>`. **`.dayWord` may never become a heading and may never take `role="heading"`**, and §14.6 says so in the component's own comment |
| **`bounce-easing`** | `:484` name regex; `:497` bezier band | Termo ships **no `@keyframes` at all** (§12.5) |
| **`pulsing-dot`** | `:1276-1329`; `:1280-1285` requires an **infinite** animation named `/pulse\|blink\|ping/i` on a 2–16px round element | A blinking caret is exactly this shape. **The caret is a static `outline`, never animated.** Nothing on `/termo` carries `animation-iteration-count: infinite` |
| **`blinking-cursor`** | `:4863-4920`; `:4869` requires `iterations.includes('infinite')` | Same answer |
| **`side-tab`** | `:963-1018` | **The trap.** §12.2's rejected list. The design uses `text-decoration`, so the scanner has nothing to match |
| **`border-accent-on-rounded`** | `:29-57`; `:47` needs a dominant edge `w >= 2 && (maxOther <= 1 \|\| w >= maxOther*2)`, `:57` needs `radius > 0 && w >= 2` | Every border on this screen is **uniform 1.5px** (tiles, keys, the loss stamp ring), so `maxOther <= 1` is false and `w >= maxOther*2` is false → every side `continue`s. This is also why the shipped 3px stamp ring passes today (`3 >= 6` is false) and why nothing here regresses it |
| **`nested-cards`** | `:4151-4216`; `:4187` `if (textContent.trim().length < 10) continue`; `isCardLikeFromProps` `:227-230` | `.key` is card-like (shadow + radius) but holds 1–6 characters → skipped; and its ancestors (`.keyboard`, `.board`, `.page`) carry no shadow, border, radius or background, so it would not be nested anyway. `.dayWordRow` carries neither shadow nor border → the first guard returns false |
| **`cramped-padding`** | `:3144-3180` main branch needs `hasDirectText && rect.width > 100 && rect.height > 30`; `:3198-3341` flush branch needs `!hasDirectText` + a visible boundary + `padding ≤ 2` | No key reaches 100px wide (48 / 31.4 / 76). Every key and tile **has** direct text, so the flush branch skips them. `.keyboard`, `.grid`, `.row` and `.noticeRow` have no direct text but carry **no** background, border, outline or shadow → `anyVisible` false → the branch returns. `.notice` gets non-zero padding on both axes. **`.noticeRetry` is out of reach twice:** the main branch needs `borderCount >= 2 \|\| hasBg` (`:3160-3161`) and the button has `border: 0` and `background: none`, and the flush branch's `FLUSH_SKIP_TAGS` (`:3199`) contains `BUTTON` outright |
| **`undersized-ui-text`** | `:3423-3460`; `:3439` `fontSize < 11 && dtLen >= 2` | A tile and a letter key have `dtLen === 1` → out of reach at any size. `enviar`/`apagar` are interactive with `dtLen = 6` → **11px exactly** on mobile, 14px desktop. Every kicker is 11px. Nothing on either route is below 11px |
| **`tiny-text`** | `:3397-3404`; needs `textLen > 20 && fontSize < 12` and not a UI context | The smallest text is 11px, and every instance matches `[class*="label" i]`/`[class*="kicker" i]` or is under 20 characters |
| **`icon-tile-stack`** | `:246-286`; needs a 32–128px squarish bordered sibling **containing an `<svg>`** immediately before a heading | `/termo` ships **no SVG at all**, and `siblingTag` is null for both `<h1>`s |
| **`layout-transition`** | `:471-476`, `:504-511` | Every transition is `background-color`, `border-color`, `color`, `text-decoration-color`, `box-shadow` or `transform` — **never** `width`/`height`/`padding`/`margin`. The `.notice` box is reserved by `min-height`, never animated |
| **`monotonous-spacing`** | `:1437-1472`; needs ≥10 spacing values, one dominant >60%, and **≤3 unique** | The screen uses `--space-1/2/3/4/5/8/11` plus 3/4/8/10/16/30/52/76 — far more than 3 unique, and three shipped play routes pass with the same population |
| **`repeated-container-text`** | `:4262-4329`; `:4304` `if (direct.length < 4 \|\| direct.length > 48) continue`; `:4320-4321` needs the same string 3× in 3 distinct structural signatures | **Checked explicitly, because 30 tiles and 28 keys look exactly like this rule's shape and are not.** A tile's direct text is 1 character and a letter key's is 1 — both under the 4-char floor. `enviar`/`apagar` are distinct strings appearing once each. And the keyboard's container is not card-like, so it is never a container this rule walks |
| **`flat-type-hierarchy`** | `:4132-4146`; fires when `max/min < 2.0` over ≥3 sizes | `/termo` at 1440: 54 / 28 / 17 / 15 / 14 / 13 / 11 → `54/11` = **4.909:1** over 7 sizes. At 390: 34 / 24 / 15 / 13 / 11 → `34/11` = **3.091:1** over 5. `/termo/concluido` **won**: 52 / 40 / 34 / 19 / 17 / 15 / 14 / 13 / 12 / 11 → `52/11` = **4.727:1** over 10 — 34 is `.dayWord`, 15 is `.dayWordResult` and 11 is `.dayWordLead` (§14.6), and 19 is the shipped `.secondaryLink` (`conclusion-view.module.css:453`). **Lost**: 52 / 34 / 19 / 17 / 15 / 14 / 13 / 12 / 11 → `52/11` = **4.727:1** over 9 — the loss stamp drops `.stampTime`'s 40px and `.stampHints`' 13px, and the ratio is unchanged because neither was an extreme |
| **`line-length`** | `:3136-3142`; needs `textLen > 80` **and** `charsPerLine > 85` | `.rules` at 15px in a 330px sidebar → ~44 chars/line. The day-word row's two lines are 34 and 21 characters — **under the 80-char gate, so the rule is never entered.** Deliberate: every new sentence on the conclusion is kept short |
| **`content-hidden-at-rest`** | `:4939-5010`; `:4955` excludes `aria-hidden` subtrees from the **denominator**, `:5002` needs `hiddenChars ≥ 150` and >30% | `aria-hidden` tiles are excluded, not counted as hidden. `.announcer` uses `clip-path`, so it counts as visible. Media-query-hidden bar members are `display: none` → excluded. Three shipped routes pass the same way |
| **`all-caps-body`** | `:3463-3467`; needs `textLen > 30` | Uppercase runs are 1 character (tiles, keys), 5 (`CAFÉ`) or 11 (`CONCLUÍDO`) |
| **`em-dash-overuse`** | `:2695-2703`, `EM_DASH_FLOOR = 8` | Termo's copy adds one em-dash, in the `unavailable.body` string shared verbatim with three shipped games |
| **`single-font` / `overused-font`** | `:4124-4130`, `:4120` | Two faces; both are `ignoreValues` in `.impeccable/config.json` |
| **`text-overflow`** | `:4783`, `:4805`; both branches need the spill to reach **16px** | The only tight case is `apagar` in a 38.6px key at 320px, and **the rule is structurally blind to it twice over**: 320 is not a scanned viewport, *and* a 3px clip is 13px under the rule's own floor even at a width that were scanned. So the 2px padding **ships unconditionally** (§12.6's mobile block) rather than sitting in §26 as a conditional, and the fit is a browser measurement at step 6 with a stated fallback ladder — never a green check |

---

## 13. Accessibility, and the bundle

### 13.1 The accessibility shape

ADR-0030 is titled *grid games are composite widgets*, and every one of its decisions is scoped to a board with a **selectable cell** and a caret; its consequence (a) enumerates the inheritors as *"#25's Nonogram board and #28's free play"*. A Termo board has neither — six rows of five tiles, fixed, read-only until submitted. So this is a **fresh decision** (ADR-0042), and handoff 021 §4.4's *"the natural answer"* is the right one.

1. **The tile board is a labelled `role="group"` OUTPUT. Nothing on it is focusable.** Not `role="grid"` — the argument is *stronger* here than for Sudoku: a grid promises keyboard navigation over cells, and these cells are not navigable at all. *"A silently wrong `role="grid"` is worse than an honest `role="group"`"* (ADR-0030 context).
2. **Each of the six rows is its own labelled `role="group"`, and the row's WHOLE judged sentence is composed in `messages.ts`** (ADR-0018, ADR-0037 decision 3). `group` permits author naming, and subtree text would concatenate five one-letter spans into `"CAFES"` with no states — the same defect as `2 2 2 2 3` reading `"22223"`. **There is no `<div>` carrying only `aria-label` anywhere on this board.**
3. **The tiles inside a row are `aria-hidden`.** The row's name already carries every letter **and** its verdict; unhidden tiles make a screen reader read the word twice, the second time ungraded. This also puts `undersized-ui-text` and `tiny-text` structurally out of reach on the board (`checks.mjs:3440`'s `EXEMPT_CONTEXT` includes `[aria-hidden="true"]`), though nothing there is near the floor anyway.
4. **The keyboard is the interactive surface and it is a composite widget** — `role="group"` labelled `teclado`, every key a `<button type="button">`, exactly one carrying `tabindex="0"`, so the whole keyboard is **one tab stop** rather than 28. This is ADR-0030's model **narrowed**: there is no selection, so no layout effect closes any loop. **It is also the repo's first roving tabindex** — `sudoku/keypad.tsx` is nine plain buttons and nine plain tab stops, with no `tabIndex` prop anywhere in the file — so nothing here is inherited and every part is specified below (§13.1a). A `tabIndex` prop and an `onFocus` handler are **not** a roving tabindex: they move an attribute, not the caret.
5. **Keys are COMMANDS, not modes: no `aria-pressed`.** `sudoku/keypad.tsx:15-25` verbatim. A Termo key writes a letter; it has no mode to be in. Its judged state is a fact about the game and rides in the composed accessible name (ADR-0030 decision 7): `letra A` before judging, `letra A: fora` after. `aria-pressed` on a command is the exact misuse ADR-0037 decision 1 distinguishes when it justifies using it for the Nonogram brush.
6. **Two live regions, both `role="status"` (implicit polite), with DISJOINT WRITERS — and the disjointness is a property of the reducer, not an observation about the happy path.** `.notice` is **visible**, in a permanently reserved box under the board; `.announcer` is **visually hidden**. The rule that makes two regions safe is stated as a reducer invariant and pinned as one (§13.1b): **no single transition writes both.** The first draft's justification — *"a guess is either rejected or judged, never both"* — is **false** once the announcer also carries the draft (item 6a) and once a held turn can succeed on retry: that transition writes the row sentence into `.announcer` **and** clears the connection line out of `.notice` in one commit, and two polite regions mutating in one commit is exactly the race two regions are supposed to avoid. **The terminal sentence is deliberately not announced here**: the play view unmounts one frame after the board closes (ADR-0034 consequence (a), measured at ~11.7ms median), so a terminal announcement from this component would be cut off. The conclusion owns it.
   6a. **`.announcer` carries the DRAFT, not only the verdict, and without that a screen-reader user gets no feedback at all between the first keypress and `enviar`.** The tiles are `aria-hidden` (item 3); the active row's accessible name is a `<div>`'s `aria-label`, and a changed `aria-label` on a non-live element is **not** announced by any AT; and a draft is not a judged row, so the first draft's announcer never spoke. Six letters into a word, a blind player had heard nothing — no confirmation, no letter count, no read-back, and nothing at all from `apagar`. ADR-0042 decision 1's *"the row's name already carries every letter"* is true only **after** judging. So `type` and `erase` each write the announcer (`copy.letterTypedAria` / `copy.letterErasedAria`, §18.2), and `copy.rowActiveAria` carries the draft letters as well as the row number.
   6b. **Two identical consecutive rejections are announced twice, and that takes a deliberate mutation.** `role="status"` is implicitly `aria-atomic="true"`, and React writing the same string leaves the text node untouched — so a player who submits `zzzzz`, reads "não está na lista", fixes nothing and submits `zzzzz` again hears **silence** the second time, on the one channel telling them why the board is not moving. The region therefore carries a `<span className={styles.nonce}>` holding `"​"` on odd notice writes and `""` on even ones, driven by a `noticeNonce` counter incremented on every notice write. U+200B has zero advance and is not verbalised by NVDA, JAWS or VoiceOver, so the change is invisible and silent — but it **is** a DOM mutation inside an atomic region, which is what triggers the re-read. It sits in a **sibling span, never appended to the notice's own text node**, so `getByText("não está na lista")` still matches exactly. The announcer needs no nonce and the reason is checked rather than assumed: every string it writes carries a changing number — the letter count on a type or erase, the row index on a judged row — so two consecutive identical writes are unreachable.
7. **Focus moves programmatically in exactly ONE place, and it is named here so the exception cannot spread.** Not on submit, not on a rejection, not on close: the one precedent that would tempt otherwise — `onStrokeEnd`'s focus door (ADR-0037 decision 2) — exists because a board drags, and this one does not. The exception is the **retry button** (item 7a): activating it hands focus to the keyboard's currently tabbable key *synchronously, in the click handler*, because the button unmounts when the turn resolves and a focused element that unmounts drops the caret to `<body>` mid-game — a 2.4.3 failure the ADR would otherwise be shipping.
   7a. **ADR-0039 and §11.4 promise a retry button; it is placed here rather than left to the implementer.** It lives in `.noticeRow`, **beside** the `role="status"` paragraph and **outside** it, so the region's atomic re-read is the sentence alone and a focusable element never sits inside a mutating live region. It is rendered **only** on the held branch. The row is reserved at its tallest state (§12.6's arithmetic), so it appearing is a paint and not a reflow. **Focus order on `/termo`, complete: "← Hoje" → [retry, when held] → the keyboard's one tab stop → end.** Three stops at most, and the retry sits before the keyboard because it is the only control that unblocks the game. **Both halves — the sibling placement and the order — are pinned by T-WEB-S103.**
8. **`aria-invalid` is not used anywhere.** ARIA does not support it on `role=button` and `jsx-a11y/role-supports-aria-props` reds the lint gate (ADR-0030 decision 7).

**How a screen-reader user perceives tile state: entirely through the composed name, never through colour.** `rowAria` renders `tentativa 2 de 6: C certa, A fora, F na palavra, E fora, S fora`. `DESIGN.md:22`'s "label" carrier is therefore satisfied for AT **independently** of everything in §12.2, which is satisfied for sighted users.

**Not provable in jsdom, and the plan does not claim it** (§26 item 9): that a `role="status"` region is spoken, and that a `role="group"` row label is announced **instead of** its `aria-hidden` children. One real VoiceOver/NVDA pass is owed and its result recorded — ADR-0042 consequence (e) makes the same admission ADR-0037 consequence (d) makes for `aria-describedby`.

### 13.1a The roving tabindex, in full

Nothing here is inherited. It is specified over **28 identifiers**, not 26 letters — the first draft typed `focused` as a letter, which made `enviar` and `apagar` incapable of ever holding `tabindex="0"` and left `Home`/`End` on row 3 with no representable target.

```ts
export type KeyId =
  | "a" | "b" | … | "z"        // 26
  | "enter" | "erase";         // 28

/** DOM order, reading order and tab order are ONE array, row-major, commands
 *  included — see §13.2. Row lengths are 10 / 9 / 9. */
const KEY_ROWS: readonly (readonly KeyId[])[] = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l"],
  ["enter","z","x","c","v","b","n","m","erase"],
];
```

**The five parts the first draft was missing:**

1. **The ref registry.** `const keys = useRef(new Map<KeyId, HTMLButtonElement>());` and every button takes `ref={(node) => { if (node === null) { keys.current.delete(id); } else { keys.current.set(id, node); } }}`. Without it there is no way to *reach* a DOM node from a key id, and `tabIndex` alone moves an attribute while the caret stays where it was.
2. **The move calls `.focus()`, synchronously, in the handler** — never from an effect. `onKeyDown` computes `next: KeyId | null`; if non-null it calls `event.preventDefault()` and `keys.current.get(next)?.focus()`, and **stops**. Focusing an element that currently has `tabindex="-1"` is legal and is what the ARIA APG's roving pattern does. **An effect was rejected**: it would be a second writer of the caret, it puts a render between the keypress and the move, and a `useLayoutEffect` over 28 buttons would re-run on every judged re-render for nothing.
3. **`onFocus` is the SINGLE writer of `focused`.** `onFocus={() => { setFocused(id); }}` on every key. The move in (2) calls `.focus()`, the browser fires `focus`, React runs `onFocus`, `focused` updates and the `tabindex` attributes swap on the next commit — one source of truth, and it is correct for a `Tab` into the group and for a pointer click too, neither of which goes through `onKeyDown`.
4. **The seed is `"q"`** — `KEY_ROWS[0][0]`, the first key in DOM order — set as the `useState` initial value, so the very first `Tab` into the group lands on `Q` and there is never a render in which zero keys have `tabindex="0"`.
5. **A judged re-render does not touch `focused`, and that is by construction.** `focused` is `Keyboard`'s own `useState`; it is **not** derived from `TermoPlayState`, so a `judged` transition — which re-renders all 28 keys with new classes and new accessible names — leaves it alone. The buttons are keyed by `KeyId` off a module-level constant array, so React reconciles them in place and no DOM node is remounted; `document.activeElement` is therefore unchanged across a submit. **T-WEB-S88** — the keyboard suite — owes this assertion alongside its arrow table: focus a key, drive a full judged transition, then assert `document.activeElement` is still that button and that `container.querySelectorAll('[tabindex="0"]').length === 1`.

**The key table, over the 28 ids:**

| key | target | edge behaviour |
|---|---|---|
| `←` | previous id in the same row | **clamps** at index 0 (ADR-0030 decision 3 verbatim, not re-argued) |
| `→` | next id in the same row | clamps at the row's last index |
| `↑` | `KEY_ROWS[r−1][min(col, KEY_ROWS[r−1].length − 1)]` | clamps at row 1 (index 0) |
| `↓` | `KEY_ROWS[r+1][min(col, KEY_ROWS[r+1].length − 1)]` | clamps at row 3 (index 2) |
| `Home` | the row's first id — row 3 gives **`enter`** | — |
| `End` | the row's last id — row 3 gives **`erase`** | — |
| `Enter` · `Space` | **not handled here** — native `<button>` activation | — |

Every arrow has a target, checked against the real lengths: row 1's column 9 (`p`) goes `↓` to `min(9, 8) = 8` → `l`; row 2's column 8 (`l`) goes `↓` to `min(8, 8) = 8` → `erase`. Arrows and `Home`/`End` `preventDefault` so the page does not scroll under the caret.

**Every assertion is pinned on `document.activeElement`, never on `tabIndex`.** A test that asserts the attribute moved would pass on the exact broken implementation this section replaces.

### 13.1b The live-region invariant, and what `.notice` actually says

**The invariant, stated as a property of the reducer:**

> `.announcer` is written **only** by `type`, `erase` and `judged`. `.notice` is written **only** by `submit` and `retry` (which clear it) and by the failure branches (which set it). **No single transition writes both**, so the two regions can never mutate in the same commit.

The clear is therefore **gated on `submit`/`retry`, not on `judged` and not on the next keystroke** — the two placements that look natural and both of which break it. Clearing on `judged` collides with the row sentence; clearing on the next `type` collides with the letter announcement. Clearing at `submit` also reads better: a rejection stays under the board for exactly as long as the player is fixing the word. **T-WEB-S87** — which §25 already maps to *"the announcer and the notice never speaking in the same tick"* — proves it the only way it can be proved: walk **every** action of the reducer and assert that at most one of `{notice, announcement}` differs from the previous state. A test that exercises the happy path and observes no collision proves nothing, because the collision is on the retry path.

**What `.notice` carries — four strings, not one.** §11.4's table maps a failure to a screen state; this is the string, and it is the reconciliation the first draft's *"carrying 'não está na lista' verbatim and nothing else"* owes to §14.4's `notice: string | null`:

| source | `.notice` | retry button | turn |
|---|---|---|---|
| local `isValidGuess` returns false | `copy.notInList` — **"não está na lista"**, AC 3 verbatim, lowercase because the AC quotes it that way | no | not spent |
| **422 `invalid-guess`** | `copy.notInList` — **the same string**. This is the *not-in-the-list* case arriving from the server, and it is reachable: `apps/web` and `apps/api` deploy independently and ADR-0015 expects the list to be regenerated, so a word the client's copy accepts and the server's copy does not is a normal, non-exceptional outcome that must not read as a system fault | no | not spent |
| 400 / 403 / 415 / any other 422 code | `copy.failed` | no | not spent |
| offline · 5xx · 429 · 401-after-remint | `copy.offline` | **yes** | **held** |
| 404 `no-puzzle` | — (`DailyUnavailable` replaces the screen) | — | the day is over |

This is why `GuessOutcome`'s `rejected` member carries a reason (§14.5) rather than being a bare kind. The screen has to tell *"that word is not in the list"* from *"we could not process that"*; the **server** distinguishes them, in the 422 body's error code, and a bare `{kind:"rejected"}` throws that distinction away at the one boundary that still has it. **§11.4's table carries the matching split** — **422 `invalid-guess` on its own row**, with 400/403/415 and any other 422 code staying generic — and it is the routing, not just the copy, that changes: `invalid-guess` is a *player* outcome and the rest are *system* outcomes. The two tables are the same mapping read from opposite ends (the wire's status/code, and the string the player sees), and **T-WEB-S83** drives both.

### 13.2 The DOM

```tsx
// PlayView — apps/web/src/termo/play-view.tsx
<main className={`${screen.page} ${styles.pageTermo}`} style={ACCENT}
      data-play-state="playing">
  <header className={screen.topBar}>
    <Link className={screen.back} href={routes.home} aria-label={messages.play.backAria}>
      {messages.play.back}
    </Link>
    <span className={screen.wordmark}>{messages.brand.wordmark}</span>
    <span className={screen.barKicker}>{messages.games.termo.kicker}</span>
    <span className={screen.topDate}>{formatLongDate(state.date)}</span>
    {/* NO <TimerReadout/> — ADR-0045 decision 4. The clock runs and is
        recorded; it is not rendered, so /termo is not a fourth surface for
        the #63 digit-swing defect. */}
    {/* Termo's third bar slot, where the three shipped screens put the timer.
        Without it `justify-content: space-between` has two items below 1140px
        and throws PALAVRAS hard right, where three shipped screens centre it
        — and a Termo-only override is impossible (§12.1). `display: none`
        above 1140px, so the desktop bar is unchanged. */}
    <span className={screen.progressBar}>{copy.progressShort(used, MAX_GUESSES)}</span>
  </header>

  <div className={screen.titleBlock}>
    <p className={screen.titleKicker}>{messages.games.termo.kicker}</p>
    {/* The <h1> is the FIRST element child of .titleRow and the kicker is a
        sibling of the WRAPPER, never of the heading. impeccable's
        hero-eyebrow-chip (checks.mjs:423) and kicker-above-heading (:2500)
        both return on `h1.previousElementSibling === null`. Not styling.
        Do not "simplify" the wrapper away. */}
    {/* The <h1> ALONE. `.progressBar` is Termo's third top-bar slot (§12.1),
        not the title row's — .titleRow is still required, and still only for
        the impeccable guard. */}
    <div className={screen.titleRow}>
      <h1 className={screen.title}>{copy.title}</h1>
    </div>
    <p className={screen.rules}>{copy.rules}</p>
  </div>

  {/* ONE row, not three. Sudoku has `Nível` and Nonogram `Tamanho` because
      both have a per-day parameter on the wire; termo's public projection is
      `game, date` only, so there is nothing honest to put there — and the
      timer row is gone under ADR-0045. The card is shorter, and that is
      correct rather than unfinished. */}
  <div className={screen.statsCard}>
    <div aria-hidden className={screen.tape} />
    <div className={screen.statRow}>
      <span className={screen.statLabel}>{messages.play.progressLabel}</span>
      <span className={screen.progressCard}>{copy.progressLong(used, MAX_GUESSES)}</span>
    </div>
  </div>

  <section className={screen.board}>
    <div className={screen.gridCard}>
      <Board rows={play.rows} active={play.activeRow} draft={play.draft} />
    </div>

    {/* Reserved at its TALLEST state and ALWAYS rendered — a row that appears
        would be a layout shift (§12.6's arithmetic). The two role="status"
        regions are safe because NO REDUCER TRANSITION WRITES BOTH (§13.1b),
        not because their paths happen not to overlap. */}
    <div className={styles.noticeRow}>
      <p role="status" className={styles.notice}>
        {play.notice ?? BLANK_READOUT}
        {/* NOT aria-hidden: an aria-hidden mutation is invisible to the live
            region, and forcing a re-read of an identical string is the entire
            job (§13.1b item 6b). A SIBLING span, so the notice's own text node
            is untouched and getByText() still matches exactly. */}
        <span className={styles.nonce}>{ZWSP.repeat(play.noticeNonce % 2)}</span>
      </p>
      {/* ADR-0039's retry — held branch only, OUTSIDE the live region, and it
          hands the caret to the keyboard synchronously because it is about to
          unmount (§13.1 item 7a). */}
      {play.held ? (
        <button
          type="button"
          className={styles.noticeRetry}
          onClick={() => { play.retry(); activeKeyRef.current?.focus(); }}
        >
          {copy.retry}
        </button>
      ) : null}
    </div>

    <Keyboard state={play.keyboardState} onLetter={play.type}
              onEnter={play.submit} onErase={play.erase}
              activeKeyRef={activeKeyRef} />

    {/* Desktop-only, and a SIBLING of the keyboard — never a child. See §12.6:
        an unplaced span inside a fully placed 20-column grid auto-places into
        an implicit 4th row one column wide, `margin-top` on a grid item is
        inert, and moving it out also keeps a decorative sentence out of the
        role="group" labelled `teclado`. */}
    <span className={styles.affordance}>{copy.keyboard.affordance}</span>

    <p role="status" className={styles.announcer}>{play.announcement}</p>
  </section>
</main>
```

Three module-scope constants in `play-view.tsx`, and one ref:

```ts
/** nonogram/play-view.tsx:52 and sudoku/play-view.tsx:37 verbatim — a NON-
 *  BREAKING space, and the NAMED constant rather than an inline literal, so
 *  the reserved line box cannot be lost to a "simplification" that types a
 *  plain space (which collapses and yields no line box at all). */
const BLANK_READOUT = " ";
/** Zero advance, never verbalised — §13.1b item 6b. */
const ZWSP = "​";
```

`const activeKeyRef = useRef<HTMLButtonElement | null>(null);` lives in `PlayView`, is **written** by `Keyboard` (the key whose id is `focused` assigns itself to it) and is **read** only by the retry button. It is a ref rather than a callback prop because the value is a DOM node and nothing renders from it.

```tsx
// Board — role="group" OUTPUT. Nothing here is focusable.
<div className={styles.grid} role="group" aria-label={copy.boardAria}>
  {ROWS.map((row, r) => (
    <div key={r} className={styles.row} role="group"
      // Four cases, not three: a HELD row is neither empty nor judged, and it
      // is the only row a player can be looking at while nothing moves. The
      // active row's name carries the DRAFT LETTERS — without them a screen
      // reader gets nothing between the first keypress and `enviar`, because
      // the tiles are aria-hidden (§13.1 item 6a).
      aria-label={
        row.tiles !== null
          ? copy.rowAria(r + 1, MAX_GUESSES, row.guess, row.tiles)
          : r === heldRow
            ? copy.rowHeldAria(r + 1, MAX_GUESSES, pending)
            : r === activeRow
              ? copy.rowActiveAria(r + 1, MAX_GUESSES, draft)
              : copy.rowEmptyAria(r + 1, MAX_GUESSES)
      }
    >
      {LETTER_SLOTS.map((_unused, c) => (
        // aria-hidden: the row's name already carries every letter AND its
        // state; unhidden tiles read the word twice, the second time ungraded.
        <div key={c} aria-hidden
             className={tileClassName(row, c, r === activeRow, draft)}>
          {letterAt(row, c, draft)}
        </div>
      ))}
    </div>
  ))}
</div>
```

```tsx
// Keyboard — a composite widget: one tab stop, roving tabindex (§13.1a).
//
// ONE table drives DOM order, reading order, tab order, the arrow model and
// the grid placement. Rows include the COMMANDS, so the DOM is row-major and
// `enviar` is emitted where it is drawn — first in row 3. The first draft
// emitted "26 letters, then the two commands", which put `enviar` visually
// first and second-to-last in reading and tab order: a WCAG 1.3.2 / 2.4.3
// mismatch, and a flat array the per-row arrow table cannot be written over.
const KEY_ROWS = [
  [["q",1],["w",3],["e",5],["r",7],["t",9],
   ["y",11],["u",13],["i",15],["o",17],["p",19]],
  [["a",2],["s",4],["d",6],["f",8],["g",10],
   ["h",12],["j",14],["k",16],["l",18]],
  [["enter",1],["z",4],["x",6],["c",8],["v",10],
   ["b",12],["n",14],["m",16],["erase",18]],
] as const satisfies readonly (readonly (readonly [KeyId, number])[])[];

const SPAN = (id: KeyId) => (id === "enter" || id === "erase" ? 3 : 2);

<div className={styles.keyboard} role="group" aria-label={copy.keyboard.label}
     onKeyDown={onKeyDown}>
  {/* KEY_ROWS.flat() — 28 buttons in reading order, commands included. */}
  <button
    type="button"
    className={keyClassName(id, state)}
    style={{ gridColumn: `${col} / span ${SPAN(id)}` }}
    // Exactly one 0 across all 28, and NOTHING derives it from game state.
    tabIndex={id === focused ? 0 : -1}
    ref={(node) => {
      if (node === null) { keys.current.delete(id); return; }
      keys.current.set(id, node);
      if (id === focused) { activeKeyRef.current = node; }
    }}
    aria-label={ariaFor(id, state)}
    // The SINGLE writer of `focused` — the arrow handler moves the caret with
    // `.focus()` and lets this close the loop (§13.1a item 3).
    onFocus={() => { setFocused(id); }}
    // `detail !== 0` is a POINTER activation (nonogram/board.tsx:240-241's
    // shipped test). Blurring returns a mouse player to the unfocused page the
    // window listener serves (§12.4); a keyboard activation is `detail === 0`
    // and keeps its caret. `focused` survives either way — only `onFocus`
    // writes it, and a blur fires no `onFocus`.
    onClick={(event) => {
      if (event.detail !== 0) { event.currentTarget.blur(); }
      activate(id);   // onLetter | onEnter | onErase
    }}
  >
    {label(id)}       {/* the letter, or copy.keyboard.enter / .erase */}
  </button>
</div>
```

`ariaFor` is one composer over 28 ids: `copy.keyboard.enterAria` / `.eraseAria` for the two commands, and `copy.keyboard.letterAria(letter)` / `.letterStateAria(letter, state[letter])` for the 26. `label` is the letter itself for a letter key and `copy.keyboard.enter` / `.erase` for a command — **no key label is a literal in this component** (§18.2).

### 13.3 The skeleton

`Board` + `BoardSkeleton` and `Keyboard` + `KeyboardSkeleton` ship **as pairs**, on `keypad.tsx:62-71`'s rule: *divs rather than buttons, so nothing here is focusable or announced before it works — but every box the hydrated component occupies is reserved.* `.board` is a centred flex column and a missing row hands its height to the board as an offset.

Termo's skeleton reserves: **30 tiles at final size**, the `.notice` line at final height with `BLANK_READOUT` (` `), **all three keyboard rows and all 28 key boxes with their real labels, in the same row-major order** (a key cap is a constant — it owes the record nothing and can paint complete, `keypad.tsx:69-71`), the **`.affordance` line** as a sibling of the keyboard so its 13px line box is reserved too, the **one-row** stats card with a blank readout, the **`.progressBar` slot in the top bar** with `BLANK_READOUT`, so the mobile bar keeps three items before hydration and the kicker does not jump from right to centre on hydrate, and the title block with its `<h1>`-first-child wrapper. `data-play-state="skeleton"`. The reserved notice box is the **whole `.noticeRow` at its full 36px**, which is the height it holds in every play state including the held one — so the retry button appearing is a paint, never a reflow. **The skeleton keyboard carries no `tabIndex` and no refs** — `keypad.tsx:62-71`'s rule is divs rather than buttons, so there is no roving anything to seed before it works.

Termo's module carries **its own copy of `.placeholder`**, declared **after** `.key` and `.tile`: a class hashed in `screen.module.css` cannot reach one hashed here (landmine 10), and same-specificity-later-wins is what retires `cursor: pointer`.

### 13.4 The bundle — measured

**Environment:** `source ~/.nvm/nvm.sh && nvm use default`, `npx turbo run build --filter=@miolos/web --force`, then `pnpm bundle-check` from `apps/web`, which reads Next's own `.next/diagnostics/route-bundle-stats.json` (`firstLoadChunkPaths`) and prints deltas over `/`.

**Baseline, `0c51f66`, clean tree:**

```
route                    raw KB   Δ raw KB   gzip KB  Δ gzip KB
/                        800.5         —   213.9         —
/binairo                 831.5      +31.1   222.5       +8.6
/nonogram                835.2      +34.7   224.2      +10.3
/sudoku                  828.9      +28.4   221.9       +8.0
```

**Method.** `/termo` does not exist, so it cannot be measured. A probe import of `@miolos/games/termo` was added to `apps/web/src/nonogram/nonogram-screen.tsx` (a `"use client"` root reached only by `/nonogram`), the symbols consumed in a `daily.date`-dependent expression so the bundler could not fold them, and `/nonogram`'s delta read. Reverted; tree proved clean.

**Markers.** `content/termo/validation.txt` is **US-ASCII** (5 310 lines, verified) and `answers.csv` carries **49 accented canonicals**. So an accented canonical — `então`, `mamãe`, `época` — can only come from `ANSWER_CANONICALS`, and an ASCII validation word — `zurro`, `abaco` — proves `VALIDATION_WORDS`. A clean discriminator between the two lists inside one generated module.

| Experiment | `/nonogram` | Markers |
|---|---|---|
| **E1** — engine only (`evaluateGuess`, `deriveKeyboardState`, `deriveBoardStatus`, `MAX_GUESSES`, `normalizeWord`, `WORD_LENGTH`; **no** word-list symbol) | 836.6 (+36.2 raw) · 224.8 (+10.9 gzip) | `zurro 0 · abaco 0 · então 0 · mamãe 0 · época 0` |
| **E2** — engine + `isValidGuess`, tree exactly as shipped | 875.9 (+75.4 raw) · 240.4 (+26.5 gzip) — **FAILS the 40 KB budget** | `zurro 1 · abaco 1 · então 1 · mamãe 1 · época 1 · praga 1`; chunk carrying them 61 888 bytes |
| **E4** — the *minimal* fix: `/*#__PURE__*/` on the `Object.freeze` calls and the `new Set` only | 875.9 (+75.4) · 240.4 (+26.5) — **does not work** | `então 1` |
| **E5** — the fix that works: **two** annotations on `TERMO_ANSWERS`, one on `Object.freeze(` and one on `ANSWER_CANONICALS.split(` | 873.0 (+72.6 raw) · 238.6 (+24.7 gzip) | `zurro 1 · abaco 1` (correct — `isValidGuess` needs them) · `então 0 · mamãe 0 · época 0`; `prettier --check` clean |

**Derived figures:**

| Component | raw | gzip |
|---|---|---|
| Termo engine, no word list | +1.5 KB | +0.6 KB |
| Validation dictionary + `isValidGuess` | +36.4 KB | +13.8 KB |
| Answer list, unshaken | **+2.8 KB** | **+1.8 KB** |
| **`/termo` floor, before one line of screen code** | **+37.9 KB** | **+14.4 KB** |

**Three conclusions the implementation must carry.**

- **E1 proves Turbopack already tree-shakes the termo barrel at MODULE granularity**, so handoff 021 §4.3's *"re-measure for termo"* is discharged: the barrel is not the problem, the *live binding* is. **E4 proves the obvious fix is wrong** — annotating only the outer `Object.freeze` leaves the unannotated `ANSWER_CANONICALS.split("\n")` inside keeping the binding alive, at the full +2.8 KB. This is exactly the class of thing that must be measured rather than reasoned about.
- **The reason the answer list must go is cost and strip-table integrity, and it is EXPLICITLY not confidentiality.** (a) 2.8 KB raw / 1.8 KB gzip that no client code reads, plus 400 `Object.freeze` allocations and 400 `normalizeWord` calls at module init on every load of the ritual's route. (b) `daily-content.ts`'s termo row withholds *"the answer word, in any field"*; shipping the **pool** through a second channel — the JS bundle rather than the payload — leaves that row literally true and substantively hollow, the "second place for the same fact" defect ADR-0032 decision 4 rejects by name (ADR-0032:89-91 — decision 3 is the row-major bitmap encoding). (c) ADR-0027:125-131 forecloses the security register and nothing in #27 rests on the client not holding the pool. *(A correction to the exploration brief, recorded and then deliberately not built on: its parenthetical "those 400 are already public via the repo" is **false** — `gh repo view` returns `{"nameWithOwner":"fernandolisboa/miolos","visibility":"PRIVATE"}`. The decision stands on (a) and (b) alone and is unchanged if the repo is opened tomorrow.)*
- **The annotations ship with two gates, because a comment is not a mechanism.** `/*#__PURE__*/` is invisible to typecheck, to lint, to the test suite and to CI, and E4 proves it is fragile to its own placement. So: `apps/web/scripts/route-client-js.mjs`'s `FORBIDDEN` gains `"então"`, `"mamãe"`, `"época"` and its `EXPECTED` gains `"zurro"` (a validation word that **must** ship, so the three negatives cannot go vacuous if the scan ever stops reaching that chunk — landmine 4's positive-control rule); and a new `packages/games/test/termo/bundle-markers.test.ts` mirrors `packages/games/test/nonogram/bundle-markers.test.ts`, proving the three canonicals resolve in `TERMO_ANSWERS`, that none is in `TERMO_VALIDATION_WORDS`, and that `zurro` is. **Two-way citation in both files: *"When it reds, replace the marker in BOTH files."***

**The shipped source** (E5, prettier-stable in exactly this formatting):

```ts
export const TERMO_ANSWERS: readonly TermoAnswer[] =
  /*#__PURE__*/ Object.freeze(
    /*#__PURE__*/ ANSWER_CANONICALS.split("\n").map((canonical) =>
      Object.freeze({ canonical, normalized: normalizeWord(canonical) }),
    ),
  );

export const TERMO_VALIDATION_WORDS: readonly string[] =
  /*#__PURE__*/ Object.freeze(VALIDATION_WORDS.split("\n"));

const VALIDATION_SET: ReadonlySet<string> = /*#__PURE__*/ new Set(
  TERMO_VALIDATION_WORDS,
);
```

The annotations on `TERMO_VALIDATION_WORDS` and `VALIDATION_SET` do not change today's measurement — `isValidGuess` keeps them alive — and ship for symmetry so a future consumer importing only `TERMO_ANSWERS` gets the mirror benefit. **A `/*#__PURE__*/` changes nothing server-side**: `apps/api`'s answer selection imports `TERMO_ANSWERS`, so the binding stays live there; the annotation only permits elimination where nothing reads it.

**Rejected: splitting `words.generated.ts` into two generated modules.** Structurally *more* robust — E1 proves module granularity shakes with no annotation at all, and no comment can be lost — and rejected on proportionality: it touches `packages/games/scripts/render-termo-words.ts:50`, the byte-identity staleness gate (`word-list.test.ts:130-144`), the renderer-independent anchor (`:166`), `.prettierignore:15` and `.gitattributes:3` — surgery on ADR-0015's harness, inside the largest ticket in the repo's history, for **1.8 KB gzip**. A sub-barrel and a deep import are both vetoed outright by ADR-0019.

**Rejected: not shipping `isValidGuess` and validating server-side only.** It would make "não está na lista" a round trip on every mistyped guess, which AC 3 calls out as instant, and it is the one thing on the Termo client that is **public content by design** (ADR-0039 decision 1).

**The budget: `/termo` is NOT added to `BUDGETED` and `MAX_DELTA_BYTES` is NOT raised.** `route-client-js.mjs:83-84` is `MAX_DELTA_BYTES = 40 * 1024` with `BUDGETED = ["/binairo","/nonogram","/sudoku"]`, and plan 020 §20.2 scopes that number as *"a per-PR tripwire for this route, not a standing rule #27 or #28 inherit."* Raising the shared constant would **un-arm the tripwire for the three grid routes** — the script's own header records that a motif-table leak is ~35 KB and lands around 69 KB, and the noisiest clean route has 5.7 KB of slack, so a ceiling raised to accommodate Termo's 37.9 KB floor would wave a motif leak straight through. So: **per-route budgets**, with `/termo`'s constant set at **step 8 from the real route** with stated headroom, never guessed at step 2. What #27 owes now is the measured floor — **+37.9 KB raw** — so nobody proposes a constant beneath it. ~36.4 KB of that floor is **content the ticket exists to ship**.

---

## 14. Persistence, the client slice and the conclusion

### 14.1 The play record's termo member

Added at `apps/web/src/play/play-record.ts`'s own extension point (`:207-217`). **`v` stays `1`** — ADR-0029 consequence (d) and `play-record.ts:56-63`: bumping it discards every stored record on deploy, and *"a discarded record with `pendingSync: true` is the only copy of a completion the server has not acknowledged — a lost streak day."*

```ts
// THIS MODULE IMPORTS NOTHING FROM `@miolos/games/termo` — not a value, and
// not even a type. The VALUE half is load-bearing: this module is on EVERY
// route's client graph (`day-state.ts` reads it for the hub's meta line and
// every card's action), so a value import would put the Termo engine on `/` —
// and, the day one of `word-list.ts`'s two `/*#__PURE__*/` annotations is lost
// to a refactor, the 37 KB word list with it (ADR-0045). The TYPE half is
// mechanical: with the three `_…Pin` assignments moved out (§24.1 N45), an
// `import type { … }` here has no consumer, and an unused type-only import is
// the SAME `@typescript-eslint/no-unused-vars` ERROR as an unused const —
// `eslint.config.mjs:105` extends `recommendedTypeChecked`, there is no
// `varsIgnorePattern` anywhere in the file, and the root script is
// `eslint --max-warnings 0 .`. Reproduced with a real `npx eslint` run; the
// output is pasted in §24.1's N45 block.
//
// The three literals below are therefore RESTATED, and they are pinned to the
// engine from `apps/web/test/termo-record.test.ts`, where a value import of
// `@miolos/games/termo` is free (the bundle rule binds `src/`, not `test/`).

/**
 * The engine's `TileState`, restated rather than imported — see the note
 * above. **The restatement is pinned in BOTH directions by `T-WEB-S74`**,
 * which reaches the tile type back out through this schema's own inferred
 * type and asserts mutual assignability against the engine's union. A member
 * added to, removed from or renamed in that union reds `pnpm typecheck` at
 * that test rather than silently producing a record the Termo reducer cannot
 * read.
 */
const tileStateSchema = z.enum(["correct", "present", "absent"]);

/**
 * `MAX_GUESSES` and `WORD_LENGTH`, restated for the same reason. **Pinned by
 * `T-WEB-S75`, behaviourally rather than by a `typeof` assignment**: with the
 * engine's constants value-imported in the test, a `MAX_GUESSES`-long list
 * parses and a `MAX_GUESSES + 1`-long one fails, and a `WORD_LENGTH`-letter
 * guess parses while `WORD_LENGTH ± 1` fails. That is a stronger pin than the
 * assignment was — it proves the schema ENFORCES the bound, not merely that it
 * declares a matching type.
 */
const TERMO_MAX_GUESSES = 6;
const TERMO_WORD_LENGTH = 5;

/** A guess as the engine sees it: normalized, five letters, no accents. */
const NORMALIZED_GUESS = /^[a-z]{5}$/;

/**
 * The termo member (#27, ADR-0044). The first member that is NOT a board, and
 * the first whose `closed` and `solved` do not coincide.
 *
 * WHAT IT HOLDS: the JUDGED GUESS ROWS, and nothing in flight. A guess the
 * server has not answered lives in reducer state and never reaches storage —
 * a persisted unjudged row could never be filled in (the client has no answer
 * to judge against), so a reload would find a row with no tiles that had
 * already spent one of six attempts. Losing five typed letters to a crash is
 * strictly better.
 *
 * WHY THE TILES ARE STORED. `evaluateGuess(guess, answer)` needs the answer,
 * and termo's public projection is `game, date` only. Mid-play there is no
 * answer in scope, so a record without tiles cannot re-render the board after
 * a reload. This is not an optimisation.
 *
 * WHY `{guess, tiles}` ROWS AND NOT TWO PARALLEL ARRAYS. The paired shape is
 * structurally the engine's `EvaluatedGuess` (keyboard.ts:4), so
 * `deriveKeyboardState(record.guesses)` reads the record with no adapter.
 * Parallel arrays need a length cross-refine and let a hand-edited store
 * desynchronise them.
 *
 * WHY THE GUESSES ARE NORMALIZED. It is the form every engine call already
 * sees (`evaluateGuess`, `isValidGuess` and `deriveKeyboardState` all
 * normalize internally), it is the form the wire carries so there is no
 * conversion boundary, and it is the ONLY form available: `canonical-map.csv`
 * is harness input and does not ship, so there is no runtime way to obtain
 * the accented spelling of an arbitrary guess.
 *
 * `answer` is the ANSWER's canonical accented spelling (ADR-0015), written
 * only on the closing write. It is here rather than read off the completion
 * response because that response is a broken channel for it: `acceptResponse`
 * copies only `elapsedMs`/`hintsUsed`, and only on the `recorded: false`
 * branch (sync.ts:349-358), and the replay path returns before the wall read
 * by ADR-0026 decision 4's design — the same argument ADR-0033's rejected
 * list makes for the motif name. Without it, /termo/concluido cannot show the
 * word. `.length(5)` is what this schema can honestly prove: measured, all
 * 400 canonicals are exactly five codepoints and NFC-stable. A character
 * class here would be a second copy of the pt-BR alphabet, free to drift.
 *
 * `outcome` is STORED, not derived from the tiles, and the reason is blast
 * radius rather than bytes: `day-state.ts` reads this record to build the
 * hub's tiles and the conclusion's day card, and it must never import a game
 * engine (see the import note above). The derivation still has exactly one
 * definition — the Termo reducer's `restore` discards a record whose
 * `outcome` disagrees with `deriveBoardStatus(tiles)`, the same way
 * nonogram/state.ts:481-487 discards a size mismatch. STORED ON THE RECORD is
 * not duplicated INTO THE STATE: `TermoPlayState` carries no `outcome` field —
 * it would be a second terminal predicate beside `PlayCore.status`, which
 * ADR-0029 consequence (e) forbids by name — so `buildRecord` writes this
 * field from `state.status` (`solved → "won"`, `lost → "lost"`), the same
 * one-way mapping §14.4's `judged` case applies, read backwards. A hand-edited
 * `outcome`
 * therefore buys a wrong local tile and nothing else: it never reaches the
 * wire (`buildBody` posts the guess WORDS and lets the server judge), and
 * ADR-0031 decision 6 forbids this state from backing any streak or medal.
 *
 * `hintsUsed` keeps binairo's bound unchanged even though Termo ships no hint
 * (ADR-0045): one free hint per puzzle is a PRODUCT rule, not a per-game one
 * (contracts/completion.ts:100-103), and `.max(0)` would encode one ticket's
 * decision into a product-level bound. `buildRecord` writes the literal 0.
 *
 * THE SUPERREFINE IS NOT DECORATION. Two of its four checks guard documented
 * THROWS: `deriveBoardStatus` raises RangeError for more than MAX_GUESSES
 * rows (status.ts:25) and for any row following an all-correct row (:31-36).
 * A record violating either would crash the reducer on restore, so it has to
 * be UNPARSEABLE rather than merely unexpected. The other two make the
 * payload/`concluded` lockstep a PARSE-TIME invariant rather than only a
 * tested one — `use-record-snapshot.ts` depends on it.
 *
 * A checked object is a legal `z.discriminatedUnion` option in Zod 4 and is
 * NOT one in Zod 3 — the same constraint the nonogram member carries
 * (:153-159), verified against the installed zod 4.4.3.
 */
export const termoPlayRecordSchema = z
  .strictObject({
    v: z.literal(1),
    game: z.literal("termo"),
    date: isoDateString,
    /** Judged rows only, oldest first. Structurally `EvaluatedGuess`. */
    guesses: z
      .array(
        z.strictObject({
          guess: z.string().regex(NORMALIZED_GUESS),
          tiles: z.tuple([
            tileStateSchema, tileStateSchema, tileStateSchema,
            tileStateSchema, tileStateSchema,
          ]),
        }),
      )
      .max(TERMO_MAX_GUESSES),
    /** The canonical accented answer. Present IFF `concluded`. */
    answer: z.string().length(TERMO_WORD_LENGTH).optional(),
    /** Present IFF `concluded`. Never posted — the server judges. */
    outcome: completionOutcomeSchema.optional(),
    elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
    hintsUsed: z.number().int().min(0).max(1),
    concluded: z.boolean(),
    pendingSync: z.boolean(),
    syncOutcome: z.enum(["pending", "recorded", "rejected"]),
  })
  .superRefine((record, ctx) => {
    const wonAt = record.guesses.findIndex((row) =>
      row.tiles.every((tile) => tile === "correct"),
    );
    if (wonAt !== -1 && wonAt !== record.guesses.length - 1) {
      ctx.addIssue({ code: "custom", message: "no guess may follow a winning row", path: ["guesses"] });
    }
    if (record.concluded !== (record.answer !== undefined)) {
      ctx.addIssue({ code: "custom", message: "answer is written exactly when the board closes", path: ["answer"] });
    }
    if (record.concluded !== (record.outcome !== undefined)) {
      ctx.addIssue({ code: "custom", message: "outcome is written exactly when the board closes", path: ["outcome"] });
    }
    if (record.concluded && record.guesses.length === 0) {
      ctx.addIssue({ code: "custom", message: "a closed board has at least one judged guess", path: ["guesses"] });
    }
  });

export type TermoPlayRecord = z.infer<typeof termoPlayRecordSchema>;

export const playRecordSchema = z.discriminatedUnion("game", [
  binairoPlayRecordSchema,
  nonogramPlayRecordSchema,
  sudokuPlayRecordSchema,
  termoPlayRecordSchema,
]);
```

**The two pin questions §26 items 6 and 7 carried are CLOSED, not open** — the pins do not live here any more (§24.1 N45), and item 7's answer was measured: three lint errors, four with the import. **One thing above is still unverified and IS a step-5 preflight probe**: that the zod tuple's inferred type is assignable to the engine's `readonly TileStates` under the installed zod 4.4.3 — **P-a** in §26, with a pre-agreed weaker fallback and an explicit ban on an `as`.

**Rejected, with reasons:** re-deriving tiles from `guesses` + `answer` on restore (mid-play there is no answer — unimplementable, not a trade); persisting the in-flight guess (a row that can never be judged, having consumed an attempt); two parallel arrays; deriving `outcome` inside `day-state.ts` (a game engine on `/`); an `outcome` field on all four members (a field three games can never populate — the shallow uniformity ADR-0029 decision 2 rejects); bumping `v`; renaming `answer` to dodge `FORBIDDEN_DAILY_KEYS` (that list bans keys on *daily payloads* and substrings in *page markup*; a post-completion local record is neither, and renaming to satisfy a grep is the cosmetic dodge this repo punishes).

### 14.2 `sync.ts` — one `case`, one builder

```ts
function buildBody(record: PlayRecord): string | undefined {
  switch (record.game) {
    case "binairo":
    case "nonogram":
    case "sudoku":
      return gridBody(record);
    case "termo":
      return termoBody(record);
    default: {
      const unhandled: never = record;
      throw new Error(`no completion body builder for ${JSON.stringify(unhandled)}`);
    }
  }
}

/**
 * Termo's completion body: the GUESS WORDS, oldest first, and no verdict
 * (#27, ADR-0044). The server re-judges them against its stored answer with
 * `evaluateGuess`/`deriveBoardStatus` and decides won or lost itself — the
 * client never asserts an outcome, which keeps `outcome` off the one surface
 * ADR-0026's rejected list calls forgeable.
 *
 * The TILES stay on the device. They are the client's rendering state, and
 * posting them would be a second copy of a fact the server derives — the
 * "second place for the client to lie" ADR-0032 decision 4 refuses when it
 * keeps `size` off the nonogram wire (ADR-0032:89-91).
 *
 * TWO PLAYERS WHO BOTH WON ON GUESS 4 POST DIFFERENT BYTES, and that is a
 * real departure from ADR-0032's canonical-body pattern rather than an
 * oversight. It is warranted because the guess SEQUENCE is itself
 * outcome-bearing state: ADR-0008 requires the fail row and #29's
 * distribution is a function of the guess count. Nothing beyond the sequence
 * is carried.
 *
 * IT CANNOT RETURN `undefined` FOR A LEGITIMATELY CLOSED RECORD, and that is
 * load-bearing: `gridBody` returns `undefined` when `record.grid` is absent
 * (:288-290) and `syncRecord` reads `undefined` as "no result to post" and
 * PERMANENTLY settles the record as rejected (:199-206). The record schema
 * requires at least one judged guess when `concluded`, so the empty-list path
 * is unreachable and the only way here is a failed contract parse — exactly
 * as it is for `gridBody`.
 */
function termoBody(record: TermoPlayRecord): string | undefined {
  const parsed = completionRequestSchema.safeParse({
    game: "termo",
    date: record.date,
    guesses: record.guesses.map((row) => row.guess),
    // Clamped at BOTH ends for the memory-queue path, exactly as `gridBody`
    // does and for the same reason (finding
    // `memory-queue-record-bypasses-the-two-sided-clamp`).
    elapsedMs: Math.min(Math.max(record.elapsedMs, 0), ELAPSED_CAP_MS),
    hintsUsed: record.hintsUsed,
  });
  return parsed.success ? JSON.stringify(parsed.data) : undefined;
}
```

Plus `type TermoPlayRecord` in the import block at `sync.ts:30-34`. **Nothing else in `sync.ts` changes** — not `TERMINAL_STATUSES`, not `RETRY_DELAYS_MS`, not the module-level singletons, not `acceptResponse`, not `settle`.

**The inversion, stated in both halves so it is not over-read.** A six-guess loss is a **200 with `outcome: "lost"`**, never a 422. `TERMINAL_STATUSES.has(422)` → `settle(record, "rejected")` → the conclusion would render `messages.conclusion.sync.rejected` (*"Não foi possível registrar este resultado no dia de hoje"*) on a legitimately played Termo, and #29's distribution would never get its fail row. **422 keeps ADR-0032 decision 4's meaning** — well-formed, but not this puzzle — and stays in `TERMINAL_STATUSES`.

**A Termo-specific consequence of a failed settle:** for a grid game a rejected completion leaves a *solvable* board; for Termo it leaves a **spent** one — six guesses are gone and there is no honest way to re-offer them. So `concluded: true` must survive any sync outcome, and `nextPendingDaily`/`HubCardAction` read `status`, **never** `syncOutcome`.

### 14.3 `use-record-snapshot.ts` — `sameToTheReader` gains the guess count

`sameToTheReader` (`:116-127`) compares exactly five chrome fields — `concluded`, `pendingSync`, `syncOutcome`, `elapsedMs`, `hintsUsed` — and its own header (`:104-114`) states the rule: *"A per-game payload field that can move INDEPENDENTLY of `concluded` breaks that and must be added below, or its reader will be handed a stale cached snapshot."*

**Termo's `guesses` moves on every turn while all five stand still.** Nonogram escaped this only through the `grid`/`concluded` lockstep proved by `T-WEB-S64`. So the comparator gains a sixth term:

```ts
    (previous?.game === "termo" ? previous.guesses.length : -1) ===
      (next?.game === "termo" ? next.guesses.length : -1)
```

**`answer` and `outcome` do NOT need adding** — the `superRefine` now makes their lockstep with `concluded` a parse-time invariant, so they cannot move independently. Termo's copy of `T-WEB-S64` (**T-WEB-S77**) asserts **`answer`**, not `guesses`: the lockstep field is the one written exclusively in the concluding write, and copying the test onto `guesses` would assert something false.

### 14.4 The Termo state, the reducer and the ordering contract

`apps/web/src/termo/` — `types.ts`, `state.ts`, `guess-client.ts`, `use-termo-play.ts`, `termo-screen.tsx`, `play-view.tsx`, `board.tsx`, `keyboard.tsx`, `termo-conclusion.tsx`, `termo-board.module.css`. Only `termo-screen.tsx` and `termo-conclusion.tsx` carry `"use client"`; the rest are pulled into the client graph by those roots, exactly as `apps/web/src/nonogram/` does.

```ts
export interface TermoPlayState extends PlayCore {
  /**
   * Judged rows only, in the record's shape — but `buildRecord` is a
   * SPREADING copy, not a straight one. **Measured at step 5 (probe P-a,
   * §26):** `termoTilesSchema` is a `z.tuple`, and zod 4.4.3 infers a
   * MUTABLE 5-tuple, while the engine's `TileStates` (`evaluate.ts:5`) is
   * `readonly`. Assigning a `readonly` tuple into the record's mutable one
   * is `TS4104`/`TS2322` — even per row. So the write is
   * `state.guesses.map((row) => ({ guess: row.guess, tiles: [...row.tiles] }))`,
   * which is the idiom `use-nonogram-play.ts:247` already ships
   * (`entries: [...state.entries]`). Never an `as`.
   */
  readonly guesses: readonly { guess: string; tiles: TileStates }[];
  /** The letters typed but not yet submitted. NEVER persisted. */
  readonly draft: string;
  /** The guess awaiting a verdict, or null. NEVER persisted. */
  readonly pending: string | null;
  /**
   * The visible line under the board. FOUR possible strings, mapped in
   * §13.1b: `copy.notInList` (local rejection AND 422 `invalid-guess` — the
   * same sentence, because both mean the same thing to the player),
   * `copy.failed` (400/403/415/other 422), `copy.offline` (held), or null.
   * Written ONLY by `submit`/`retry` (clearing) and the failure branches
   * (setting) — never by `type`, `erase` or `judged`, which is what keeps the
   * two live regions off each other (§13.1b).
   */
  readonly notice: string | null;
  /**
   * Incremented on every write to `notice`, including a write of the string
   * already there. `role="status"` is aria-atomic and React does not mutate a
   * text node it is re-writing identically, so without this a second
   * identical rejection is silent (§13.1b item 6b).
   */
  readonly noticeNonce: number;
  /** True while a turn is held and the retry button is offered (§13.1 7a). */
  readonly held: boolean;
  /** The visually-hidden announcer's current sentence. Written ONLY by
   *  `type`, `erase` and `judged`. Carries the DRAFT, not just verdicts. */
  readonly announcement: string;
  /**
   * The canonical accented answer, written only when the board closes, and
   * copied straight across by `buildRecord`.
   *
   * NO `outcome` FIELD SITS BESIDE IT, and the absence is the decision.
   * `outcome !== undefined` would be exactly `status !== "playing"` — a
   * SECOND terminal predicate beside `PlayCore.status`, which ADR-0029
   * consequence (e) forbids by name: *"`PlayCore.status` and `buildRecord`'s
   * `closed` flag are where 'the game is over' lives; a game that adds a
   * terminal state adds a literal there rather than a second predicate in its
   * own hook."* The RECORD's `outcome` is a field (§14.1, ADR-0044 decision
   * 3), and `buildRecord` DERIVES it from the state it already has:
   * `state.status === "solved" ? "won" : "lost"` — the reducer's own
   * `won → solved` mapping read backwards, needing no engine call.
   */
  readonly answer: string | undefined;
  // NO `hint` field at all. `HintState` is a standalone interface
  // (play/types.ts:44-50) composed by each game, not part of `PlayCore`, so
  // Termo simply omits it and `HintState.lastIndex: number | null` — "the
  // cell the hint filled", a flat-board index with no Termo meaning — never
  // has to be reinterpreted (ADR-0045 decision 2).
}
```

**The ordering contract, and it is the sharpest correctness constraint in the client half.** `use-play-lifecycle.ts:231-246` fires the completion effect on `closedAndFrozen = status !== "playing" && timer.runningSince === null` and calls `buildRecord(state, Date.now(), true)` **synchronously and purely**. For Termo the state that closes the board — the closing row's tiles **and** the canonical answer — arrives from the judge response. That is compatible **only if**:

> **`status` does not leave `"playing"` until the closing judge response has been fully absorbed by the reducer.**

One reducer action does all of it. `judged` carries `{ guess, tiles, status, answer }` and writes `guesses`, `answer` and `status` **in a single transition**; there is no intermediate state in which `status` is terminal and `answer` is undefined. If that ordering broke, `buildRecord` would write a record with no `answer`, the `superRefine` would refuse it, `writePlayRecord` would drop it and **the completion would be lost**. Pinned by **T-WEB-S82**, and the reducer's TSDoc says so in these words.

**The `judged` case is also the ONE place the `won → solved` mapping is written**, and it is written nowhere else in the repo. The engine and the wire speak `TermoBoardStatus` = `"playing" | "won" | "lost"` (`packages/games/src/termo/status.ts:11`); `PlayCore.status` is `"playing" | "solved" | "lost"` and has **no `"won"` member** (`apps/web/src/play/types.ts:31`). `judged` maps `won → solved` and passes `lost` and `playing` through. ADR-0044 decision 3 states the mapping and says it belongs in exactly one place; `buildRecord`'s `state.status === "solved" ? "won" : "lost"` is that same mapping read backwards, not a second copy of it.

**`restore` discards a record whose stored `outcome` disagrees with `deriveBoardStatus(record.guesses.map(r => r.tiles))`** — the single definition of the derivation, in the one module that is allowed to import the engine, exactly as `nonogram/state.ts:481-487` discards a size mismatch. **T-WEB-S81.**

**`persistDeps` is `[state.guesses]`**, and nothing else. The array identity changes on a judged guess and on nothing else. It must **not** contain `state.draft` — every keystroke would cost a `readPlayRecord` + Zod parse + `JSON.stringify` + `setItem` cycle — and it must **never** contain `state.now`, which `T-WEB-S33` already pins on the real hook (`use-play-lifecycle.ts:66-69`). **T-WEB-S84.**

**`use-play-lifecycle.ts` is reused UNCHANGED.** Read in full, it names no cell, no index and no size; its only structural constraints are `S extends PlayCore` and a caller-supplied `persistDeps`. Termo reuses all five effects and all three listeners. **The timer keeps running through a network stall** — pausing it would add a second pause authority beside the `visibilitychange`/`pagehide` path (`:138-155`) in a module ADR-0029 decision 2 makes shared. Termo's `elapsedMs` therefore includes network waits and is **not comparable to a grid time**; that is stated, not fixed, and it is one of the two reasons the number is never rendered.

**`progress.ts` is not reused.** `countFilled(givens, entries)` (`progress.ts:26-37`) takes two parallel index-aligned arrays and tests `!== null`; Termo has no `givens` and no null-empty cell array. `progress.ts:15-24` already records that Nonogram deliberately did not reuse it either, calling that *"the shallow reuse ADR-0029 rejects."* Same verdict, second time. Termo composes "tentativa N de 6" in its own copy bundle.

**Branch order in `TermoScreen`** — load-bearing, mirroring `nonogram-screen.tsx:44-109`:

1. `daily === undefined` → `<DailyUnavailable/>`. It sits **below** the hook by the rules of hooks, which is also what keeps the record restore, the prune and the queue flush running on this route. **`DailyUnavailable` emits neither marker attribute**, so the impeccable preflight fails loudly rather than scanning a board that never rendered.
2. `!play.state.hydrated` → `<PlaySkeleton/>` (`data-play-state="skeleton"`).
3. `status !== "playing" && timer.runningSince === null` → `<TermoConclusion date status={state.status} answer={state.answer} guessCount={state.guesses.length} result/>` **in place**, no navigation and no RSC fetch. Both conditions. **The wrapper is handed `status`, never an `outcome` field** — there is none on the state (above) — and it composes `ConclusionOutcome` / `ConclusionAnswer` from `messages.ts` on the `solved` / `lost` split, exactly as §14.6 requires of both its mount points.
4. else → `<PlayView play={play}/>` (`data-play-state="playing"`).

### 14.5 The guess client

`apps/web/src/termo/guess-client.ts`. A **foreground awaited `fetch`**, not a queue (§11.4). It shares `ensureSession()` from `apps/web/src/session/bootstrap.ts` and owns **its own** re-mint-once boolean.

```ts
/**
 * POST a Termo guess list and return the judgement, or a typed failure.
 *
 * NOT `sync.ts`. That module is a COMPLETIONS queue keyed on `pendingSync`;
 * `settle(record, "rejected")` clears that flag permanently, which is the
 * opposite of what a live turn needs; its ladder is deliberately un-urgent
 * ([2s, 5s, 15s, 60s]) and bails in a hidden tab; and its module-level guards
 * exist to keep ONE game-blind queue coherent, so pushing a foreground turn
 * through them would let a background flush reset a live retry (ADR-0039
 * decision 4). Duplicating a re-mint boolean is not the hazard ADR-0029
 * names — that argument is about two copies over one localStorage queue, and
 * a guess touches no queue at all.
 *
 * `credentials: "include"` and `Content-Type: application/json`, exactly as
 * sync.ts:315-322 posts, because the JSON content-type gate forces a CORS
 * preflight and the cookie is the identity.
 */
export type GuessOutcome =
  | { kind: "judged"; tiles: readonly TileStates[]; status: TermoBoardStatus; answer?: string }
  | { kind: "held" }        // offline, 5xx, 429, or 401-after-remint — the turn survives
  // 400 / 403 / 415 / 422 — cleared, turn NOT consumed. The REASON is part of
  // the type because the screen has to tell "that word is not in the list"
  // from "we could not process that", and only a 422 whose body says
  // `invalid-guess` is the first (§13.1b). It is reachable in normal
  // operation: apps/web and apps/api deploy independently and ADR-0015
  // expects the validation list to be regenerated, so a word the client's
  // copy accepts and the server's does not is ordinary, not a fault.
  | { kind: "rejected"; reason: "not-in-list" | "refused" }
  | { kind: "gone" };       // 404 — the day is unavailable

export async function postGuesses(
  date: string,
  guesses: readonly string[],
): Promise<GuessOutcome>;
```

The failure table is §11.4's, verbatim, and **T-WEB-S83** drives every row. An automatic retry is armed on the `window` `online` event and torn down with the screen.

### 14.6 The conclusion's fourth state and the day's word

`ConclusionView` today has three branches (`conclusion-view.tsx:118`, `:136`, `:184`) and **all three assume the stamp is an achievement**: `stampLabel: "Concluído"` (`messages.ts:112`), `stampAria(game, elapsed, hints)` = *"X concluído em MM:SS, sem dicas"* (`:124-125`), a 150px circle whose three slots are a label, a time and a hints line.

**The widening — two optional plain-data props, following `picture` exactly** (`types.ts:99-113`, ADR-0034 decision 3):

```ts
/**
 * The stamp Termo renders in place of the shared label/time/hints triple.
 * Plain data only; supplied ONLY by a client component that owns the local
 * play record. A game that passes nothing renders exactly what it rendered
 * before this prop existed.
 *
 * `state` drives `data-conclusion-state`, so ONE prop serves both Termo
 * outcomes: a win is still "result" (the impeccable preflight greps for the
 * attribute NAME, and route-ssr.test.tsx's marker table gains the row), a
 * loss is "lost". Termo passes it on BOTH outcomes because neither of the
 * shipped stamp's three slots is honest here: there is no hint to have gone
 * without (ADR-0045 decision 1), and the elapsed time is dominated by the
 * per-guess round trip (decision 4).
 *
 * `settle` is false on a loss. There is no consolation flourish, no second
 * stamp design, no mascot and no emoji: THE LOSS EQUIVALENT OF THE
 * CELEBRATION IS THE CELEBRATION'S ABSENCE, and stating that here is what
 * stops the next contributor from inventing one.
 */
export interface ConclusionOutcome {
  readonly state: "result" | "lost";
  readonly label: string;   // "Concluído" | "Jogado"
  readonly detail: string;  // "4/6" | "X/6"
  readonly aria: string;    // the whole composed name
  readonly settle: boolean; // the shared stamp-settle animation
}

/**
 * The day's answer in its canonical accented spelling (#27 AC 2). Rendered on
 * BOTH outcomes. Three plain strings; nothing here is a function.
 *
 * On a win it is not redundant: the player typed the word accent-free and the
 * accents are the thing they have not seen.
 */
export interface ConclusionAnswer {
  readonly result: string;    // "Você acertou em 4 de 6 tentativas." | "As seis tentativas acabaram."
  readonly lead: string;      // "A palavra de hoje era"
  readonly canonical: string; // "café"
}
```

Props: `readonly outcome?: ConclusionOutcome; readonly answer?: ConclusionAnswer;`

**Branch order — and the order is load-bearing:**

```
!hydrated                          → data-conclusion-state="skeleton"
outcome?.state === "lost"          → data-conclusion-state="lost"      ← NEW, checked BEFORE stamp
stamp === undefined                → data-conclusion-state="empty"
otherwise                          → data-conclusion-state="result"    (outcome overrides the three slots)
```

Putting the loss **before** the stamp check is what decouples it from `ConclusionResult`, from `record.concluded` and from `elapsedMs` entirely. Placed after, a lost Termo — which **is** a locally-concluded record — would fall into `result` and render a "Concluído" stamp over a loss. This also sidesteps ADR-0034's recorded rejection of *"widening `ConclusionResult` to carry the picture"*: `stamp = stored ?? result` (`:106`) relies on a play record being structurally assignable to `ConclusionResult`, and a sibling prop does not touch that relation. **An optional `outcome` field ON `ConclusionResult` would silently read `undefined` — i.e. "won" — on every path that does not set it.**

**The chrome.** The `lost` branch reuses `.pageResult`'s two-column layout and `.resultCard`, so the day card, the chaining CTA and the top bar are **byte-identical to a win**. Inside the card the stamp is stepped down three ways at once:

| | win stamp (shipped) | loss stamp |
|---|---|---|
| ring | `3px solid var(--accent)` (`conclusion-view.module.css:174`) | **`1.5px solid var(--ink-2)`** |
| colour | `var(--accent)` → `var(--ink)` under §16 | `var(--ink-2)` — **5.3003:1** on `--paper-card` |
| slots | label / time / hints — three | **label / `X/6` — two** |
| motion | `stamp-settle var(--duration-slow)` | **none** |

Three carriers, each perceivable in greyscale, and the absence of motion is the loudest of them. `X/6` is the genre's own notation and its accessible name spells it out: *"Termo jogado: as seis tentativas acabaram sem acerto."* **No `.stampTime`, no hints line, no `elapsedMs` anywhere in the branch** — a time on a game nobody won is the same lie `day-state.ts:26-30` already refuses for a part-played board.

**`ConclusionOutcome.aria` is rendered, and where it is rendered is ADR-0043 decision 10 — an obligation this plan owes rather than a nicety.** The field is not merely the stamp's `aria-label`: the ADR puts it in a **visually hidden `role="status"` inside `ConclusionView`**, on the `result` **and** `lost` branches, and that is what makes ADR-0042 decision 10's *"the conclusion owns the terminal sentence"* true instead of aspirational. It is not true today: `conclusion-view.tsx` has **no live region and no focus management at all** — its single `useEffect` (`:89-95`) starts the completion sync and nothing else — so on the in-place swap the play view unmounts, focus falls to `<body>`, and a blind player gets nothing at the product's payoff moment. The gap is inherited from three shipped games; #27 closes it because ADR-0042 decision 10 already promises it, and leaving the promise unbuilt would be the false-claim class §20 exists to catch. Three constraints: the region carries the **already-composed** string (types.ts:73-83's plain-data rule — nothing is composed in the component), **games that pass no `outcome` render no region** and are byte-identical, and **focus still never moves programmatically** — a `role="status"` announces without stealing the caret, which is the calmer mechanism and the one `PRODUCT.md`'s *"nothing nags"* points at. It reuses `.announcer`'s `clip-path` recipe, in `conclusion-view.module.css`. That a live region **mounting** with content is spoken is an AT behaviour jsdom cannot prove; it rides the one real VoiceOver/NVDA pass §26 item 9 already owes.

**The day-word row** renders in `.pictureRow`'s slot on **both** outcomes, unanimated, deliberately: a third settle would make the card busy on a win and would be the **only** motion on the screen on a loss, which reads as celebrating one.

```css
/* No background, no border, no radius, no box-shadow — see below. */
.dayWordRow    { display: flex; flex-direction: column; align-items: center;
                 gap: var(--space-2); margin-top: var(--space-6);
                 text-align: center; }

/* The sentence that states the result. 15px/1.6 --ink-2 is
   `.emptyBodyText`'s shipped pairing in this same file (:493-499) — the one
   body register the conclusion already has. 5.3003:1 on --paper-card. */
.dayWordResult { margin: 0; font-size: 15px; line-height: 1.6;
                 color: var(--ink-2); text-wrap: pretty; }

/* The label above the word. `.dayCardTitle`'s shipped kicker idiom verbatim
   (:164-170): 11px / 0.14em / uppercase / --ink-2, 5.3003:1 on --paper-card,
   and 11px is `undersized-ui-text`'s floor exactly rather than under it. */
.dayWordLead   { margin: 0; font-size: 11px; letter-spacing: 0.14em;
                 text-transform: uppercase; color: var(--ink-2); }

/* The word. NOT a heading and never `role="heading"` — see below. */
.dayWord       { margin: 0; font-family: var(--font-display); font-size: 34px;
                 font-weight: 600; letter-spacing: 0.08em;
                 text-transform: uppercase; color: var(--ink); }
```

**`.dayWord` may never become a heading, and the reason is mechanical.** `.dayWordLead` is an 11px tracked-uppercase line sitting immediately above it — the exact shape `kicker-above-heading` exists to catch. Both that rule and `hero-eyebrow-chip` anchor **only** on `h1`–`h4` and `[role="heading"]` (`checks.mjs:2492`), so a `<p>` is out of reach and the two lines are legal. Promoting `.dayWord` to an `<h2>` — the obvious "semantic improvement" — would light the rule up at both viewports on the one card no URL-mode scan reaches. The component carries this sentence.

verbatim the argument `conclusion-view.module.css:225-230` records for `.picture`: `isCardLikeFromProps` (`checks.mjs:227-230`) returns false on its **first** guard when an element has neither shadow nor border, so `nested-cards` cannot fire and *card dentro de card* is not approached. Type: Fraunces 34px/600, `text-transform: uppercase`, `letter-spacing: 0.08em`, `--ink` on `--paper-card` (**15.6663:1**). 34px sits deliberately **below** `.stampTime`'s 40px so the stamp stays the card's largest element on a win.

**The class names are `.dayWordRow` / `.dayWordResult` / `.dayWordLead` / `.dayWord` — never `.answer*`** (§6.7, N40).

**`ConclusionCopy` is NOT widened.** It stays `{title, kicker, notYet:{title, cta}}` — `types.ts:73-83`'s rule holds: **plain data only, never a function, however tempting.** A function crossing the RSC boundary throws *"Functions cannot be passed directly to Client Components"* — an HTTP 500 **only `test/route-ssr.test.tsx` can see**, and #23 shipped exactly that bug in exactly this file. Every string in `ConclusionOutcome` and `ConclusionAnswer` is composed by the Termo wrapper from `messages.ts` and handed across as a finished string.

**Two mount points, one wrapper, and two sources for the same one bit.** In place on `/termo` the wrapper reads **`state.status`** (`solved` → `{state:"result"}`, `lost` → `{state:"lost"}`) — `TermoPlayState` has no `outcome` field to read, by ADR-0029 consequence (e) (§14.4). On `/termo/concluido` there is no live state, so it reads the **record's** `outcome` field, whose value `buildRecord` wrote from that same `state.status`. One mapping, two readings of it, no third definition. `TermoConclusion` serves both, subscribing with **the same `(game, date)` key** `ConclusionView` uses — the module cache is one slot keyed `{game,date}` (`use-record-snapshot.ts:43-49`), so two subscribers on different keys would thrash it and `useSyncExternalStore` would loop. `NonogramConclusion` (`nonogram-conclusion.tsx:39-45`) is the shipped precedent.

**The loss state is unreachable by `impeccable detect`** and the plan says so rather than over-claiming AC 5: a clean browser profile has no record, so the URL scan always renders `empty`. Compliance is proved the way ADR-0034 decision 4 names — a **file-mode** detect run, jsdom smoke tests, and stylesheet-text assertions including that `.stampLost` declares **no** `animation` (**T-WEB-S97**).

---

## 15. `day-state.ts` — three verbs

### 15.1 The defect, precisely

`conclusion-view.tsx:337` is `if (route !== undefined && !entryOf(candidate).concluded) {` and `DAY_GAMES = ["termo", "sudoku", "nonogram", "binairo"]` (`:24`) — **termo is first**. Under today's boolean a lost Termo is either `concluded: true` (a lie: ADR-0008 decision 3 says it completes nothing, and it would enter "X de 4 concluídos" on a day ADR-0008 decision 4 says is **not** perfect) or `PENDING` (offered as the next pending daily on every other game's conclusion, forever, as the **default** target).

### 15.2 The shape

```ts
/**
 * CONTEXT.md's verbs, minus the one a local reader cannot see: a LATE
 * completion is an archive fact the server owns (#31), so this reader has
 * three states, not four.
 *
 * `played` exists because ADR-0008 decision 3 makes a lost Termo *played* and
 * never *completed*: it counts for neither streak nor Dia Perfeito, and it is
 * still visibly finished for the day.
 *
 * MONOTONE SAFETY IS PRESERVED, and the check is worth writing down because
 * ADR-0031 decision 2 is what makes this reader shippable at all. Absence
 * still reads `pending`, so the cold profile, the second device and
 * `impeccable detect` are unchanged. `played` is a WEAKER claim than
 * `completed`, not a stronger one: it publishes no time and enters no count.
 * It drives a chip, a tile shape and a CTA target — the affordances ADR-0031
 * decision 6 permits — and never an entitlement.
 *
 * AN ENUM RATHER THAN A SECOND FLAG, deliberately. A `closed` boolean beside
 * `concluded` would fail SAFE: a consumer that forgot it would read pending.
 * This fails CLOSED: `DayEntry.concluded` ceases to exist, so all eight
 * consumers are a red typecheck and each one has to decide. That is the same
 * choice `sync.ts`'s `const unhandled: never` and this file's spelled-out
 * `Record<Game, DayEntry>` literal already make.
 */
export type DayStatus = "pending" | "completed" | "played";

export interface DayEntry {
  readonly status: DayStatus;
  /**
   * Set IFF `status === "completed"`. A part-played board carries a real
   * `elapsedMs` too, and publishing that as the day's result would put a time
   * on a game nobody finished — which is exactly what a lost Termo is.
   */
  readonly elapsedMs: number | undefined;
}

const PENDING: DayEntry = { status: "pending", elapsedMs: undefined };

/** How many of the day's games this device has COMPLETED — never merely played. */
export function completedCount(state: Readonly<Record<Game, DayEntry>>): number {
  return Object.values(state).filter((entry) => entry.status === "completed").length;
}

/**
 * The file's first per-game branch, and it is the narrowest one that can
 * express ADR-0008 decision 3. It is NOT a widening of `readDayState`'s map,
 * which stays total over `Game` and gains no key.
 *
 * `outcome` is read rather than derived from the tiles because this module is
 * on every route's client graph and must never import a game engine — see the
 * import note in play-record.ts. The derivation is checked once, in the Termo
 * reducer's `restore`.
 */
function entryFor(game: Game, date: string): DayEntry {
  const record = readPlayRecord(game, date);
  if (record === undefined || !record.concluded) {
    return PENDING;
  }
  if (record.game === "termo" && record.outcome === "lost") {
    return { status: "played", elapsedMs: undefined };
  }
  return { status: "completed", elapsedMs: record.elapsedMs };
}

function sameDayState(
  previous: Readonly<Record<Game, DayEntry>>,
  next: Readonly<Record<Game, DayEntry>>,
): boolean {
  return GAMES.every(
    (game) =>
      previous[game].status === next[game].status &&
      previous[game].elapsedMs === next[game].elapsedMs,
  );
}
```

**Rejected: a discriminated-union `DayEntry`.** It would make "elapsedMs iff completed" a type — and it would **delete both consumers' deliberate value-narrowing**, whose comments say *"an entry that somehow lost its duration degrades to the pending button instead of rendering 'undefined'"* (`hub-day-state.tsx:65-69`, `conclusion-view.tsx:384-388`). The union buys type safety the existing narrowing already provides at runtime, at the cost of the defence the narrowing exists for. Flat wins.

### 15.3 The blast radius — the full site list, derived by grep

| Site | Change |
|---|---|
| `apps/web/src/play/day-state.ts:24-32` | `concluded: boolean` → `status: DayStatus` |
| `apps/web/src/play/day-state.ts:34` | the `PENDING` literal |
| `apps/web/src/play/day-state.ts:56-62` | TSDoc becomes false (§20) |
| `apps/web/src/play/day-state.ts:74-76` | `doneCount` → `completedCount` |
| `apps/web/src/play/day-state.ts:102-108` | `entryFor` — the first per-game branch |
| `apps/web/src/play/day-state.ts:138-147` | `sameDayState` compares `status` |
| `apps/web/src/play/conclusion-view.tsx:178-181` | `dayEntry` becomes **outcome-aware** — see below. An unconditional `{status:"completed", elapsedMs: stamp.elapsedMs}` is wrong on the loss branch, and dropping the override is wrong too |
| `apps/web/src/play/conclusion-view.tsx:337` | `nextPendingDaily` chains on `entryOf(candidate).status === "pending"` |
| `apps/web/src/play/conclusion-view.tsx:384-411` | `DayChip`'s third value |
| `apps/web/app/hub-day-state.tsx:37` | `completedCount` |
| `apps/web/app/hub-day-state.tsx:63-89` | `HubCardAction` branches on `status`, **never on `elapsedMs`** — a played Termo has no duration and must not fall through to "Jogar hoje" |

**`dayEntry` is outcome-aware, and neither of the two obvious shapes works.** The shipped override at `:178-181` exists because *"the game being celebrated is proved done by the stamp itself, which is exactly what the record may not say yet"* — on the in-place swap the record still in storage is the last **playing** one. Both simplifications break:

- **Unconditional `{status:"completed", elapsedMs: stamp.elapsedMs}`** puts a duration next to "Jogado" on the loss branch — a time on a game nobody won, which is the exact lie ADR-0043 and ADR-0044 exist to refuse and which `day-state.ts:26-30` already refuses for a part-played board.
- **Dropping the override on the loss branch** makes `dayState.termo` read `pending` — the record in storage is still the playing one — so `nextPendingDaily` offers **termo first** (`conclusion-view.tsx:24`'s `DAY_GAMES = ["termo", "sudoku", "nonogram", "binairo"]`, verified in tree, termo at index 0) as the default chaining CTA at the end of the very game the player just spent.

```ts
// conclusion-view.tsx:178-181
const dayEntry = (dayGame: Game): DayEntry =>
  dayGame === game
    ? outcome?.state === "lost"
      ? { status: "played", elapsedMs: undefined }
      : { status: "completed", elapsedMs: stamp.elapsedMs }
    : dayState[dayGame];
```

`outcome` is the `ConclusionOutcome` prop (§14.6), so the branch reads the same one prop that already drives `data-conclusion-state` — it never re-derives an outcome and never reads `record.outcome` a second time.

```ts
// conclusion-view.tsx:388-410 — the guard SPLITS, and three values, not two
const done = entry.status === "completed";
const value =
  done && entry.elapsedMs !== undefined
    ? formatElapsed(entry.elapsedMs)
    : done
      ? messages.conclusion.dayCard.done      // "feito" — completed, no duration
      : entry.status === "played"
        ? messages.conclusion.dayCard.played  // "jogado"
        : messages.conclusion.dayCard.missing; // "falta"
```

**The split is required by the won-Termo case and is easy to miss.** The shipped code is `const elapsedMs = entry.concluded ? entry.elapsedMs : undefined; const done = elapsedMs !== undefined;` — one guard doing two jobs, so a **completed** entry with no duration falls straight through to `falta`. A won Termo is exactly that entry (§6.2 / F10 below), so keeping the single guard would print `falta` next to a game the player just won. `done` is now `status === "completed"` and the **duration's presence** only chooses which done string to print. `HubCardAction` (`hub-day-state.tsx:63-89`) carries the identical defect at `:69` and `:83` and gets the identical split: `status === "completed"` selects the `.done` link, and `elapsedMs === undefined` selects `messages.hoje.played`-style copy rather than the pending button.

**A won Termo publishes no duration either, and that is the third option §6.2 missed.** The choice was framed as *add `DayEntry.guesses`, or ship `em 07:12`* — but Termo's elapsed time includes every per-guess round trip (§14.4) and both ADR-0043 and ADR-0045 call the number meaningless for this game. The third option is one line: `entryFor` leaves `elapsedMs` undefined for a **won** Termo too. It costs nothing, because §15.3 already requires both consumers to branch on `status` and never on `elapsedMs`; the hub and the day card show the done shape without a number until #29 lands `em 4/6`. That deferral is already carried to the PR body.

```ts
// day-state.ts — entryFor, final form
if (record.game === "termo") {
  return record.outcome === "lost"
    ? { status: "played", elapsedMs: undefined }
    : { status: "completed", elapsedMs: undefined };  // ← won: no duration either
}
return { status: "completed", elapsedMs: record.elapsedMs };
```

**`.chipPlayed` gets a SOLID border, not `.chipMissing`'s dashed one.** Reusing the dashed border would make `played` and `missing` pixel-identical — same 1.5px dashed `--line`, no tint, `.chipName` unchanged — so three day states would render as **two** shapes and the one new state this whole section exists for would be invisible:

```css
/* conclusion-view.module.css, after .chipMissing so the pairing is readable.
   `missing` = dashed (nothing here yet); `played` = SOLID (something happened,
   just not a completion); `done` = a tinted fill and no border at all. Three
   border treatments, no colour involved, all three legible in greyscale. */
.chipPlayed { border: 1.5px solid var(--line); }
```

`--line` on `--paper-card` is **1.4323:1**, so the border is a *shape* carrier and not a contrast one — which is exactly what the shipped `.chipMissing` already is (`conclusion-view.module.css:339-343` records the reason). The state's 3:1 carrier is the **value string itself** — `jogado` vs `falta` vs a duration, `--ink-2` on `--paper-card` at **5.3003:1** — and the border only tells the two non-done chips apart at a glance.

On the hub, a played Termo renders the **`.done` shape with no duration** and the chip string **"Jogado"** — capitalised, because `messages.hoje.done` is `"Feito"` and the hub's chip register is capitalised. The **day card's** value is **"jogado"**, lowercase, because `messages.conclusion.dayCard.missing` is `"falta"` and that is a tabular value, not a chip. **The two registers are deliberately different and §18.2 spells both**; the first draft's §15.3 quoted "Jogado" while §18.2 declared `"jogado"`, and that disagreement is what this sentence settles. Neither is "Jogar hoje" — a game that can no longer be played today never offers a play CTA.

**Zero behaviour change for the three shipped games:** `entryFor` returns `"completed"` **with the record's `elapsedMs`** wherever it returned `concluded: true`, and `"pending"` wherever it returned `PENDING`. The `elapsedMs: undefined` arm is reached only by `record.game === "termo"`, so no shipped chip or hub tile loses its duration.

**The two tests this section owes, named here because they are the ones a reviewer will look for:**

- **The loss branch does not chain back into Termo.** Render `ConclusionView` with `game: "termo"`, an `outcome` whose `state` is `"lost"`, and a `dayState` in which **every** game reads `pending`; assert (a) the termo chip carries **no** duration — no `formatElapsed` output anywhere in it — and (b) the chaining CTA's `href` is **not** `routes.termo`. Both assertions fail on each of the two rejected shapes above, in opposite directions. **T-WEB-S80.**
- **A won Termo reads done, not `falta`.** Render with `outcome.state === "result"` and a termo `DayEntry` of `{status: "completed", elapsedMs: undefined}`; assert the chip carries `.chipDone` and the value `feito`, never `falta`, and that `HubCardAction` renders the `.done` link rather than the pending button. This is the assertion the un-split guard fails. **T-WEB-S80.**

**How the existing tests pin it** (the set is named by path and line; the **count** is produced by running the suite at step 5 — plan 020's CLI-2/TR-2 finding class, §26 item 10): `apps/web/test/day-state.test.ts` — `T-WEB-S14` (`:61`, four `it`s) and `T-WEB-S15` (`:154`, the monotone table); **`:173` reads `.concluded` directly and is the one assertion that must be rewritten rather than renamed**; `:99-108` carries five `doneCount` assertions. `apps/web/test/conclusion-view.test.tsx` — `T-WEB-S18` (`:206`, `:371`) and **`T-WEB-S19` (`:271-350`, the chaining CTA)**, which is the suite that proves a played Termo is not re-offered. `apps/web/test/hoje.smoke.test.tsx` — `T-WEB-S16` (`:155-174`, follows `playRoutes` and stays green either way by design) and **`T-WEB-S55` (`:239-259`, the *activation* test naming `routes.nonogram` explicitly)**, whose file header at `:229-238` says in terms that **#27 owes its own copy of the second**.

---

## 16. The #68 accent conversion — PR A, a prerequisite, not a commit of #27

**This section is the RECORD OF A DEPENDENCY, not a work item in this PR.** The accent conversion ships as **PR A, closing #68**, on branch `fix/68-accents-colour-shapes`, merged **before** #27's own PR B, which is rebased on it. PR A carries: ADR-0041, the `DESIGN.md` / `PRODUCT.md` amendment, `accent.ts`'s `INKS_ON_ACCENT.termo`, the **eleven** `--accent`-as-text conversions in the three shared stylesheets, and `apps/web/test/ink-on-accent.test.ts`. Nothing below is a #27 commit and §21/§22 must not schedule one.

> **LANDED — PR #73, commit `79bad18`, merged to `main` 2026-08-02, and it landed BROADER than this section drafted.** Everything below describes the tree **before** that merge and is kept as the record it is; four things in the shipped ADR-0041 are not in the draft this section was written against, and a reader must take the ADR over this section wherever they differ:
>
> 1. **Decision 1 was recut on a fixed-value axis.** The absolute ban is on the shared property `color: var(--accent)`, which has no fixed value; a **literal** accent token (`--accent-sudoku`, `--accent-binairo`, `--accent-nonogram`, `--accent-app`) may colour a word where its measured ratio against the paper behind it clears 4.5:1. **Thirteen such declarations ship today**, enumerated with their figures in consequence (h). `var(--accent-termo)` is inside the exception's shape and outside its condition — 2.8501:1 is the paper family's ceiling — so Termo's module may not open one either way, and everything §12 decides is unchanged.
> 2. **Decision 8 was added:** `screen.module.css`'s `.hint:focus-visible` was `2px solid var(--accent)` and is now `var(--ink)` (15.0124:1 for all four games at once). See §12.1 deviation 6, which this rewrote.
> 3. **Decision 9 was added:** the hover language forks by what the sheet can render — `app/globals.css:24` and `components/daily-unavailable.module.css:17` keep their literal-token colour swaps at 6.0351:1 and 5.3066:1.
> 4. **The amendment reached `DESIGN.md:50-51` too** (the Puzzle-grid and Histogram specs, which prescribed accent numerals and an accent bar with a bold label), not only `DESIGN.md:20-22` and `PRODUCT.md:40`.
>
> Two further step-7 findings changed shipped bytes: `conclusion-view.module.css`'s `.secondaryLink:hover` grows its rule 2px → 3px (a real geometry delta, because a colour-only swap was 1.9899:1 against mustard), and both shared `.barKicker` rules take `font: var(--text-kicker)` at 0.16em so the kicker stays branded rather than reading as a generic section eyebrow.

**Why the split, in one line each:** `CLAUDE.md`'s *"one branch per issue"* argues for it directly — this work closes **#68**, a different issue; and it repaints **three already-shipped screens**, which is the one diff Fernando actually has to look at, so burying it inside the largest ticket in the repo's history is the opposite of reviewable. A further server↔screen cut of #27 was considered and **rejected**: both halves close #27, and the seeding procedure it would avoid is documented, rehearsed work (landmine 3), not novel risk.

**What #27 still owes here:** nothing but the dependency. PR B **must not merge before PR A**, because `/termo` renders `screen.titleKicker`, `screen.barKicker` and `screen.statLabel` — shared classes — and on mustard those are 2.7311:1 and 2.8501:1. §16.1 below is retained as the argument for **why the two are coupled at all**, which is what a reviewer of either PR needs.

### 16.1 Why the two are coupled

Three reasons, and ADR-0036 decision 5's *"fixing it here would put an unrelated visible change to two shipped screens inside a Nonogram diff"* had **none** of them:

1. **It is not unrelated.** Handoff 021 landmine (c) instructs #27 to *"carry the rule into `DESIGN.md` with an ADR."* An ADR stating a rule that eleven shipped surfaces contradict is the false-document class ADR-0036 consequence (b) names.
2. **It is mechanically forced.** `/termo` renders `screen.titleKicker`, `screen.barKicker` and `screen.statLabel`. Those are **shared** classes.
3. **A Termo-only fix is impossible.** CSS Modules hash per file (landmine 10), so a `.titleKicker` declared in `termo-board.module.css` is a *different hashed class*; overriding the shared one would mean forking three classes into a fourth per-game module or relying on Next's stylesheet injection order, which it does not guarantee. Forking would leave the shared sheet stating the opposite of `DESIGN.md` and hand the next game a fifth copy.

**Mitigations, so the change is reviewable rather than smuggled:** it is **its own pull request against its own issue**; `npx impeccable detect` is re-run on **all seven existing routes at both viewports, on PR A's branch, before any Termo code exists anywhere**; and PR A's body states, as the thing Fernando actually has to look at, that **three shipped screens change appearance**.

### 16.2 The eleven sites — verified by grep against the working tree

*(Against `main` at `0c51f66`, i.e. before PR A. **After `79bad18` the same grep returns 9**, none of them accent-as-text: four per-game `color:` declarations, `sudoku-board.module.css:164`'s `border-color`, `nonogram-board.module.css:426`'s per-game `color:`, the comment at `:452`, and three declarations PR A itself added as **shapes** — `screen.module.css:78` and `conclusion-view.module.css:44` `text-decoration-color`, `conclusion-view.module.css:576` `border-bottom-color`. The table below is the before-state and the arithmetic that justified each conversion.)*

`grep -rn "color: var(--accent)" --include="*.css" apps` returned **17** hits. **Five are per-game modules** (`sudoku-board.module.css:155,164,165,249`, `nonogram-board.module.css:426`) and are **excluded** — each renders only its own accent and each already clears AA for it (sudoku's `.cellEntered` 7.5113:1, `.keypadDigit` 7.8385:1; nonogram's `.control` 4.5063:1). **One is not a declaration at all**: `nonogram-board.module.css:452` is inside a comment — *"a `border-color: var(--accent)` here would be a no-op"* — matched because the pattern is a substring of `border-color:`. `17 − 5 − 1` = **eleven** live shared declarations, and the arithmetic is spelled out because the first draft's *"17 hits, five per-game, remaining eleven"* silently dropped the twelfth and a reader who re-ran the grep would find the sentence off by one:

| # | Site | What it is | termo ratio today | → | ratio after |
|---|---|---|---|---|---|
| 1 | `apps/web/src/play/screen.module.css:120` `.titleKicker` | 11px/600 on desk | **2.7311 ✗** | `var(--ink-2)` | **5.0791 ✓** |
| 2 | `screen.module.css:98` `.barKicker` | 11px/400 on desk | **2.7311 ✗** | `var(--ink-2)` | **5.0791 ✓** |
| 3 | `screen.module.css:196` `.statLabel` | 11px on card | **2.8501 ✗** | `var(--ink-2)` | **5.3003 ✓** |
| 4 | `screen.module.css:56` `.page a:hover` | 14px link on desk | **2.7311 ✗** | decision 4 below | **15.0124 ✓** |
| 5 | `conclusion-view.module.css:97` `.barKicker` | 11px on desk | **2.7311 ✗** | `var(--ink-2)` | **5.0791 ✓** |
| 6 | `conclusion-view.module.css:139` `.cardKicker` | 11px on card | **2.8501 ✗** | `var(--ink-2)` | **5.3003 ✓** |
| 7 | `conclusion-view.module.css:176` `.stamp` | 11px + 40px + 13px on card | **2.8501 ✗** | text → `var(--ink)`; **ring at `:174` stays accent** | **15.6663 ✓** |
| 8 | `conclusion-view.module.css:354` `.chipDone .chipName` | 17px/550 on the 10 % chip tint `#F5ECDA` | **2.5949 ✗** | `var(--ink)` | **14.2637 ✓** |
| 9 | `conclusion-view.module.css:25` `.page a:hover` | link text | **2.7311 ✗** | decision 4 below | **15.0124 ✓** |
| 10 | `apps/web/app/page.module.css:150` `.kicker` (hub card) | 11px on card — **a live AA failure on `main` today** | **2.8501 ✗** | `var(--ink-2)` | **5.3003 ✓** |
| 11 | `page.module.css:222` `.doneChip` | 11px text; ring at `:219` | **2.8501 ✗** | text → `var(--ink)`; **ring stays accent** | **15.6663 ✓** |

**#68's four rows, mapped to the site that closes each — because `Closes #68` without this is a claim, not evidence:**

| #68's row | closed by | where |
|---|---|---|
| **`.cta` on termo's hub card — the headline row, "Termo at 2.731:1 is the headline"** | **`accent.ts`'s `INKS_ON_ACCENT.termo`**, **not** by any of the eleven | §16.3. `page.module.css:182` is `color: var(--ink-on-accent, var(--paper-desk))` **on** a mustard fill — read in tree — so it is not an `--accent`-as-text site at all and the `color: var(--accent)` grep never sees it. Changing the *ink* takes it from 2.7311:1 to **5.4968:1**. This is the row #68 is actually about, and the first draft's eleven-site table did not contain it, which read as if the headline defect were being closed by eleven unrelated edits |
| `.barKicker` on /nonogram **and /nonogram/concluido** | sites **2** and **5** | #68 gives one row with two surfaces and one file (`screen.module.css`); the concluido surface is actually `conclusion-view.module.css:97`, a second declaration. Both convert to `var(--ink-2)` |
| `.titleKicker` on /nonogram | site **1** | → `var(--ink-2)` |
| `.chipDone .chipName` on /\<jogo\>/concluido | site **8** | → `var(--ink)` |

**The ratios in the two tables are different colours, deliberately.** #68 quotes **terracotta** (4.318:1, 3.969:1) because it was filed out of #25; the eleven-site table above quotes **mustard** (2.7311:1, 2.5949:1) because those are the figures `/termo` would ship. Both fail 4.5, and the fix — a neutral ink — clears both at once.

**Most of the eleven are unlisted in #68, and #10 is a live AA failure on `main` right now** — the Termo hub card ships today and its kicker is mustard on card paper at 2.8501:1. `11 − 3` = 8, counting sites 1, 2 and 8 as the ones #68 names by file **and** class; site 5 is named by *surface* (`/nonogram/concluido`) and filed against the wrong file, so a generous count is 7. **The shipped ADR-0041 decision 3 says six, and it is counting ROWS of its own ten-row table rather than sites** — its row 10 is sites 4 and 9 together, and it credits #68 with site 5. Six rows, seven sites, eight on the strict reading; the number to quote is the ADR's. The closing comment on #68 says both things: that the issue's headline row is closed by a token rather than by a stylesheet edit, and that the sweep found sites the issue did not name.

**The property sweep §26 item 19 admitted it had skipped comes back effectively empty, and the item retires.** `grep -rn "fill: var(--accent)\|stroke: var(--accent)\|-color: var(--accent)" --include="*.css" apps` returned **three** hits before PR A: `sudoku-board.module.css:164` `border-color` (per-game, and an accent **border**, which ADR-0041 decision 5 permits by name), `conclusion-view.module.css:246` `fill: var(--accent)` on `.picture` (a **shape** — the nonogram reveal — already classified correct, at 4.51:1 with its arithmetic in the file), and `nonogram-board.module.css:452` (the comment again). **Every hit was a shape; none was text.** *(PR A added three more, all shapes and all deliberate: two `text-decoration-color` hover rules and `.secondaryLink`'s `border-bottom-color`.)* **The shipped ADR-0041 consequence (g) deliberately does NOT promote this into an exhaustive claim** — its sweep covered `color:`, `border:` and `background:`, and it records that a `fill:`, `stroke:`, `text-decoration-color:` or `caret-color:` sweep has not happened. Cite the sweep as what it is: three greps with a known shape, not a proof. The `color:` half **is** exhaustive for the three shared sheets, because `ink-on-accent.test.ts`'s scan is a scan rather than a list.

**Sites 4 and 9 get a different answer**, because dropping the accent entirely would delete the per-game hover identity the design handoff specifies for every screen:

```css
.page a:hover {
  color: var(--ink);
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 4px;
}
```

The word stays ink (15.0124:1); the accent moves to a **rule under it** — a shape. That is ADR-0041's rule applied literally, in three declarations, and the hover state's carrier becomes the underline's **presence**, not its colour.

**This is an accepted EXCEPTION with its ratio on the record, not a compliant result, and the distinction matters.** The underline is a 2px mustard rule at **2.7311:1** on `--paper-desk` and **2.8501:1** on `--paper-card` — below WCAG 1.4.11's 3:1 non-text floor, one section after §12.2 declares mustard illegal as a state-bearing boundary. It is defensible on exactly one ground: **hover is not a WCAG-required indicator.** 1.4.11 governs *"states of user interface components"* that convey information; a pointer-only hover affordance is not one, has no keyboard or AT equivalent to be missing, and the state it decorates is already carried by the underline's **presence** — a shape change that needs no contrast at all. **`:focus-visible`, which 2.4.7 and 1.4.11 *do* govern, is `--ink` everywhere on this screen at 15.0124:1** (§12.1 deviation 6), so nothing keyboard-reachable rests on the mustard.

Recorded this way deliberately: **ADR-0041 decision 5 already treats the stamp ring exactly so** — an accent border that outlines an already-legible label is decoration, and *"the ring's 2.8501:1 is recorded rather than hidden."* Two exceptions, one framing, both with their numbers. Calling this one compliant would be the false-claim class the #25 loop punished six times.

**Sites 7 and 11 keep an accent border, and that is a decision, not an omission.** ADR-0041 decision 5 draws the line: *an accent border that outlines an already-legible label is decoration; an accent border that is the only thing saying which state a control is in is not.* The stamp's ring encloses "CONCLUÍDO / 06:47 / sem dicas" at 15.6663:1 and the hub's done-chip ring encloses "Feito" beside a tabular result. Neither ring carries information; WCAG 1.4.11's decorative exemption applies, and the ring's 2.8501:1 is recorded rather than hidden. **A uniform border never fires `border-accent-on-rounded`** — `checks.mjs:47` requires a dominant edge (`w >= 2 && (maxOther <= 1 || w >= maxOther*2)`), and a 3px ring on all four sides has `maxOther = 3`, so `3 >= 6` is false and every side `continue`s. That is why the shipped stamp passes today and why nothing here regresses it.

### 16.3 `accent.ts` and its test

```ts
const INKS_ON_ACCENT: Readonly<Record<Game, string>> = {
  termo: "var(--ink)",
  sudoku: "var(--paper-desk)",
  nonogram: "var(--paper-card)",
  binairo: "var(--paper-desk)",
};
```

**Sudoku, Nonogram and Binairo do not move** — 7.5113:1, 4.5063:1 and 5.3066:1 already clear AA, and changing them would be a byte-visible change to shipped screens with no defect behind it. **Termo is simply the first accent light enough to carry DARK ink**: `--accent-termo` has relative luminance 0.29477163 — a **mid** colour, greyscale 148/255 — so no paper rescues it (desk 2.7311, card 2.8501, tint 2.5457, and **2.8501 is the ceiling over the whole paper family against a 4.5 floor**), while `--ink` on it is **5.4968:1**, clearing AA for the 14px/600 labels at all four sites with 22 % of headroom.

`--ink-on-accent` keeps its name and its TSDoc meaning ("the ink that is legible ON that accent"); what changes is that its **range** is no longer *a paper token*.

**One site reads a different fallback.** Every existing consumer reads `var(--ink-on-accent, var(--paper-desk))`. Termo's board tile and key are the only surfaces in the repo that can **only ever** render mustard, so they read `var(--ink-on-accent, var(--ink))` — the safe fallback for the one accent where desk is 2.7311:1. `apps/web/test/ink-on-accent.test.ts` therefore carries **an expected fallback per site** rather than one literal for all of them — that half lives in the file's **first** describe, `T-WEB-S72`, whose `SHEETS` scan list (`ink-on-accent.test.ts:33-38`) **#27** extends with `src/termo/termo-board.module.css`, because the sheet does not exist until the board ships (ADR-0041 consequence (c)). **T-WEB-S73** is the file's **second** describe, "accents colour shapes, never words", which PR A added and which gates ADR-0041 decisions 1, 2, 3, 4 and 8.

### 16.4 The 2.736 correction

`2.736:1` appears at five sites and is **wrong**; the value is **2.8501:1**. Both fail AA and both fail the 3:1 non-text floor, so no conclusion changes — but it was quoted as *measured evidence* and the correction belongs on the record.

| # | Site | Action |
|---|---|---|
| 1 | `apps/web/src/play/accent.ts:51` | **edited** — the whole TSDoc block is rewritten by §16.3 anyway |
| 2 | `apps/web/test/ink-on-accent.test.ts:121` | **edited** — rewritten by §16.3 |
| 3 | `docs/handoffs/021-…md:173` | **do not edit** — `docs/README.md:19-30` forbids rewriting a handoff's body |
| 4 | `docs/plans/020-…md:2638` | **do not edit** — a plan is a snapshot |
| 5 | GitHub issue #68's body | corrected in the **closing comment**, never by editing history |

Note the shape: **two** live-code sites are edited; three are point-in-time documents the repo's own convention forbids rewriting. Saying "corrected everywhere" without that distinction would itself be the false-claim class the #25 loop punished six times.

### 16.5 What CI can and cannot see

**`impeccable detect` cannot see any of this and never will.** `low-contrast` and `cream-palette` are wildcard-ignored on every host CI scans (`.impeccable/config.json:19-39`, #51). The gate on §16.3 is `apps/web/test/ink-on-accent.test.ts` (T-WEB-S73), which asserts **stylesheet TEXT** because jsdom resolves no custom-property fallback chain and composites no colour.

**This section drafted "there is no automated gate on decisions 1, 3 or 4"; PR A shipped one, and the corrected statement is narrower.** The scan at `ink-on-accent.test.ts:219` reads `color:\s*var\(--accent[a-z-]*\)` — every accent form, not just the shared token — over the three shared sheets, anchored on a line start or a `;` so `border-color:` and `text-decoration-color:` (both shapes) are not swept up, with the two `--accent-app` streak declarations allow-listed **by name** and a second assertion keeping that allow-list non-vacuous. So a future `color: var(--accent)` on text in a shared sheet **goes red**, and decisions 1, 2, 3, 4 and 8 are each gated (ADR-0041 consequence (f) maps decision → assertion). What remains ungated, and is what the PR must say: **decisions 5, 6, 7 and 9, and every per-game module** — nothing stops `termo-board.module.css` from declaring `color: var(--accent-termo)`, which decision 1's exception forbids by arithmetic rather than by a test. That defence is the ADR and review.

---

## 17. Routes, the hub tile and the chaining CTA

### 17.1 `apps/web/src/i18n/routes.ts`

```diff
 export const routeSlugs = {
   archive: "arquivo",
   freePlay: "modo-livre",
   stats: "estatisticas",
   binairo: "binairo",
   sudoku: "sudoku",
   nonogram: "nonogram",
+  // Likewise an untranslated proper noun: "Termo" is the product's own name
+  // for its Termo-like game (CONTEXT.md — and never "Wordle"), so the slug is
+  // the noun and `concluido` is the only pt-BR segment on the pair.
+  termo: "termo",
   conclusion: "concluido",
 } as const;

 export const routes = {
   …
   nonogramConclusion: `/${routeSlugs.nonogram}/${routeSlugs.conclusion}`,
+  termo: `/${routeSlugs.termo}`,
+  termoConclusion: `/${routeSlugs.termo}/${routeSlugs.conclusion}`,
 } as const;

 export const playRoutes: Readonly<Partial<Record<Game, Route>>> = {
   binairo: routes.binairo,
   nonogram: routes.nonogram,
   sudoku: routes.sudoku,
+  termo: routes.termo,
 };
```

`routeSlugs` is **not** alphabetical (chrome first, then games in build order), so `termo` goes after `nonogram` and before the shared `conclusion` segment — how #23 and #25 appended. `playRoutes` **is** alphabetical, so `termo` goes last. Both TSDoc blocks naming #27 (`:26-29`, `:47-51`) are rewritten in the same commit.

**`playRoutes` stays `Partial`.** With all four games routed, `hub-day-state.tsx:71-81`'s `route === undefined` branch is dead for all four, as is `conclusion-view.tsx:158`'s `?? routes.home` and the loop-vs-`find` narrowing argument at `:322-327` — ~15 lines of genuinely dead code. **Filed, not deleted** (§27 item 3): totalising the map touches the exact two consumers §15 is simultaneously rewriting. `hub-day-state.tsx:71-75`'s comment is rewritten to say the branch is now dead for all four games and **why it is kept**.

### 17.2 The hub tile

`apps/web/app/page.tsx:17`'s `gameOrder = ["termo","sudoku","nonogram","binairo"]` already puts Termo first; `page.tsx:109` already calls `accentVars(game)` for every tile; `day-state.ts` already carries `termo: PENDING`; `messages.games.termo` already exists (`messages.ts:157-161`). **The activation is one line in `playRoutes` plus the tests it breaks.** `hub-day-state.tsx:71-81` stops being reachable and the termo card becomes a real `<Link className={styles.cta}>`.

**The instant that line lands, two shipped surfaces change** — which is exactly why §16's conversion is a **merged prerequisite** rather than something later in this branch:

- `conclusion-view.tsx:332-342` — `DAY_GAMES[0] === "termo"`, so `nextPendingDaily` returns termo first whenever termo is pending, and `.ctaNext` (`conclusion-view.module.css:431-436`) paints `accentVars("termo")` **on the already-shipped `/binairo/concluido`, `/sudoku/concluido` and `/nonogram/concluido`**.
- `hub-day-state.tsx:71-81` — the termo card's action becomes a real accent-filled CTA on `/`, the app's front door.

**This is #25's ISS-A2 regression class repeated with the worst accent in the palette, on four surfaces instead of two.** With **PR A merged**, both render `--ink` on mustard at **5.4968:1**. If PR B were ever merged first, four shipped surfaces would ship a 2.7311:1 CTA label on the day Termo went live — which is why the ordering is a gate and not a preference.

### 17.3 The two route segments

`apps/web/app/termo/page.tsx` and `apps/web/app/termo/concluido/page.tsx`, both `export const dynamic = "force-dynamic"`, copying `apps/web/app/nonogram/page.tsx:24-37` and `apps/web/app/nonogram/concluido/page.tsx:24-36` in structure:

```tsx
// app/termo/page.tsx
export default async function TermoPage() {
  const daily = await getTodayDaily(getDb(), "termo");
  if (daily === undefined) {
    return <DailyUnavailable copy={messages.games.termo.play.unavailable} />;
  }
  return <TermoScreen daily={daily} />;
}
```

**`daily` is `DailyTermoResponse`, never the union** — the three shipped screens each record rejecting the union-taking shape. **`/termo/concluido` passes `date` and nothing else**, pinned by `expect(Object.keys(element.props).toSorted()).toEqual(["date"])`.

**What crosses the RSC boundary, exactly.** `/termo` passes `{ game: "termo", date }` — two strings, one of which is the game's own name. **No answer can appear because no server code on either path ever holds one**: the strip runs inside `packages/db` at the wall (ADR-0024), so `getTodayDaily(db,"termo")` returns the projection and the page passes that object whole. There is no code path where a page could add it. This is **sharper** for Termo than for Nonogram and the PR says so: a nonogram picture is client-derivable from the clues so its strip is a *product* decision (ADR-0033), whereas Termo's answer is derivable from nothing on the client — a server-computed reveal on `/termo/concluido`, a route that renders for players who have **not** played, would be the **only** channel, and the leak would be total.

**The catching test** is `apps/web/test/termo-page.test.tsx` (**T-WEB-S95**), copying `nonogram-page.test.tsx:162-183` verbatim in structure: `collectKeys(elementSchema.parse(element).props)` over the RSC props **and** `renderToStaticMarkup(element)` over the markup, asserting for every member of `FORBIDDEN_DAILY_KEYS` both `keys.has(f) === false` and `markup.not.toContain(f)`, plus an anti-vacuity assertion that the walk found a real key. **Honest caveat, carried in the test's own comment:** `renderToStaticMarkup(<TermoScreen daily/>)` renders the **not-hydrated** branch, because `useSyncExternalStore`'s server snapshot is `{hydrated: false}` — so only the skeleton's classes are actually scanned, and the substring constraint must be applied to the whole Termo tree **by convention**, exactly as `nonogram-page.test.tsx:176-181` records for its own tree.

**Both routes also go into `test/route-ssr.test.tsx`'s `ROUTES` table** — the `renderToStaticMarkup` case **and** the `unserializableProps` walker (**T-WEB-S100**). That suite exists because `/binairo/concluido` shipped an HTTP 500 while every other suite was green.

---

## 18. i18n and the domain vocabulary

### 18.1 `CONTEXT.md`'s Termo rows — commit B1

`CONTEXT.md` has **no rows** for Termo's own vocabulary today. #25 hit the identical gap, plan 020 §16.1 carried a "vocabulary ruling", step-3 finding **ADH-6** ruled that *a plan is a snapshot and cannot be the source of truth for vocabulary*, and the seven rows landed in `CONTEXT.md` **in that branch's first commit**. #27's gap is **larger** and it owes the same, in **commit B1** beside the `docs/README.md` row (§21.1, landmine 13), **derived from the engine's shipped identifiers rather than invented**:

| Term (code) | pt-BR (UI) | Meaning |
|---|---|---|
| **Guess** | Tentativa | One five-letter word a player submits. Six per daily (`MAX_GUESSES`). Judged server-side (ADR-0038); never judged on the client. |
| **Answer** | Palavra do dia | The day's word, drawn from the curated answer list. Stored on the row in both forms; never in a client payload before the board closes. |
| **Tile** | — | One of the thirty cells of the Termo board. Read-only output: a player writes guesses, not tiles. |
| **Tile state** | certa · na palavra · fora | `correct` / `present` / `absent` (`evaluate.ts:3`). The pt-BR words are one spelling per concept and are the words a screen reader speaks. |
| **Keyboard state** | — | The best-known state per letter across every judged guess, precedence `correct > present > absent` (`keyboard.ts:12-16`). A letter never guessed is *absent from the map*, not `absent`. |
| **Draft** | — | The letters typed into the active row and **not yet submitted**. Never persisted, never posted, and — because the tiles are `aria-hidden` — the only thing a screen reader can be told about while a word is being written (§13.1 item 6a). *Rascunho* is deliberately **not** the UI word: no visible string names it, and the aria copy says *escrevendo*. |
| **Held turn** | aguardando | A guess that has been submitted and whose verdict has not arrived. **Not consumed** — the turn survives a failure — and never persisted. It is a tile state, a row aria word and the one condition under which the retry button appears (ADR-0039). |
| **Answer list** | — | The 400 curated answers a daily may draw from (`TERMO_ANSWERS`). Finite content: no answer is ever drawn twice (ADR-0040), and Termo is excluded from free play because of it. |
| **Validation dictionary** | Lista de palavras aceitas | The 5 310 words a guess may be (`TERMO_VALIDATION_WORDS`). Public by design — it ships to the client so "não está na lista" is instant and offline. A superset of the answer list. |
| **Guess distribution** | — | How many guesses each won Termo took, plus the fail row. #29's statistic; #27 only writes the count. |
| **Fail row** | — | The lost-Termo bucket of the guess distribution. A lost Termo feeds this and nothing else (ADR-0008 rule 3). |

`CONTEXT.md`'s existing **Played** row already says *"Only Termo can end here; a lost Termo feeds the guess distribution's fail row and nothing else"* — these rows define the two terms it uses without defining.

### 18.2 The message tree

Module-scope hoists, beside the existing `cellAria` / `hintsUsed` / `runsText` composers. **Every aria string is composed in `messages.ts`, never joined in a component** (`messages.ts:24-27`, ADR-0018).

```ts
/** Termo's three tile states in pt-BR, one spelling per concept. The engine's
 *  identifiers are correct/present/absent (evaluate.ts:3); these are the words
 *  a player hears. They go into CONTEXT.md in commit B1. */
const TERMO_TILE = { correct: "certa", present: "na palavra", absent: "fora" } as const;

/** EVERY aria string here spells letters in LOWERCASE, and that is a decision
 *  rather than an oversight. NVDA, JAWS and VoiceOver all announce the case of
 *  a single uppercase character — "maiúsculo A", six times a row, thirty times
 *  a game, plus once per keystroke and once per key label. The visual case is
 *  CSS's job and stays there: `.tile` and `.key` both carry
 *  `text-transform: uppercase` (§12.6), so nothing on screen changes. */

/** The whole judged row as ONE sentence, composed here and never joined in a
 *  component (ADR-0018). Five one-letter spans would otherwise concatenate to
 *  "CAFES" with no states at all — ADR-0037 decision 3's "22223" defect. */
const termoRowAria = (
  row: number,
  max: number,
  guess: string,
  tiles: readonly ("correct" | "present" | "absent")[],
) =>
  `tentativa ${row} de ${max}: ${tiles
    .map((tile, i) => `${guess.charAt(i)} ${TERMO_TILE[tile]}`)
    .join(", ")}`;

/** The letters as separate words, so a reader SPELLS "c, a, f" rather than
 *  pronouncing "caf". Used by the active and held rows. */
const termoLetters = (word: string) => word.split("").join(", ");
```

```ts
// messages.games.termo — `kicker`, `name` and `description` already exist at
// messages.ts:157-161 and are unchanged.
termo: {
  kicker: "Palavras",
  name: "Termo",
  description: "Seis tentativas para a palavra do dia.",
  play: {
    title: "Termo",
    // Every clause is a rule the engine actually enforces: WORD_LENGTH = 5,
    // MAX_GUESSES = 6, isValidGuess against TERMO_VALIDATION_WORDS, and
    // normalizeWord makes the input accent-free.
    rules:
      "Descubra a palavra de cinco letras em até seis tentativas. Digite sem acentos; cada tentativa precisa estar na lista de palavras aceitas.",
    progressLong: (used: number, max: number) => `${used} de ${max} tentativas`,
    progressShort: (used: number, max: number) => `${used} de ${max}`,

    boardAria: "tabuleiro do Termo, seis tentativas de cinco letras",
    rowAria: termoRowAria,
    rowEmptyAria: (row: number, max: number) => `tentativa ${row} de ${max}, vazia`,
    // The ACTIVE row's name carries the DRAFT. Without the letters a screen
    // reader gets nothing at all between the first keypress and `enviar`
    // (§13.1 item 6a). "sua vez" replaces the first draft's "em digitação",
    // which is written pt-BR and stiff read aloud six times a game.
    rowActiveAria: (row: number, max: number, draft: string) =>
      draft === ""
        ? `tentativa ${row} de ${max}, sua vez`
        : `tentativa ${row} de ${max}, escrevendo: ${termoLetters(draft)}`,
    // The HELD row (ADR-0039 consequence (g)). "aguardando" appears exactly
    // once in the whole product, here — it is never a visible label, because
    // the .notice line already says the same thing in the same tick.
    rowHeldAria: (row: number, max: number, guess: string) =>
      `tentativa ${row} de ${max}: ${termoLetters(guess)}, aguardando resposta`,

    // Fired on EVERY type and EVERY erase, into .announcer. Terse on purpose:
    // this is heard five times a word, thirty times a game.
    letterTypedAria: (letter: string, filled: number, length: number) =>
      `${letter}, ${filled} de ${length}`,
    letterErasedAria: (letter: string, filled: number, length: number) =>
      `${letter} apagada, ${filled} de ${length}`,

    // AC 3, VERBATIM and lowercase — the issue quotes it that way inside
    // quotes, so this one string does not take the sentence register the
    // three below do. The same string is the visible line and, on the
    // server-rejection path, the answer to a 422 `invalid-guess` (§13.1b).
    notInList: "não está na lista",
    // The held-turn and rejected-turn lines (§11.4). Distinct in copy from
    // notInList, deliberately: one is the player's mistake, the other is ours.
    // Full sentences with a capital and a full stop, matching every shipped
    // system line (`conclusion.sync.pending`, `conclusion.sync.rejected`) —
    // the first draft shipped lowercase fragments in the same box as a
    // capitalised CTA.
    offline: "Sem conexão — a tentativa vai assim que a conexão voltar.",
    failed: "Não foi possível enviar a tentativa.",
    // Capitalised, like every shipped CTA in this bundle ("Jogar hoje",
    // "Voltar para Hoje", "Ver estatísticas", "Usar dica — 1 disponível").
    retry: "Tentar de novo",

    keyboard: {
      label: "teclado",
      enter: "enviar",
      erase: "apagar",
      enterAria: "enviar a tentativa",
      eraseAria: "apagar a última letra",
      // 26 letter keys: ONE composer, never 26 literals. Lowercase — see the
      // note above `termoRowAria`.
      letterAria: (letter: string) => `letra ${letter}`,
      letterStateAria: (letter: string, state: "correct" | "present" | "absent") =>
        `letra ${letter}: ${TERMO_TILE[state]}`,
      // Desktop-only: a phone has no keyboard to advertise. The shape is
      // nonogram's shipped affordance verbatim — "ou use o teclado: <key>
      // <verb>, …" (messages.ts:270) — rather than the first draft's "ou use
      // o teclado DO COMPUTADOR: letras, Enter e Backspace", which invented a
      // qualifier no shipped string uses and dropped the verbs that make the
      // line an instruction. 63 characters, so `line-length` (which needs
      // textLen > 80) is not even entered.
      affordance: "ou use o teclado: letras escrevem, Enter envia, Backspace apaga",
    },

    unavailable: {
      title: "O Termo de hoje ainda não chegou.",
      body: "Alguma coisa saiu do lugar por aqui. Tente de novo daqui a pouco — o puzzle de hoje é o mesmo para todo mundo.",
      cta: "Voltar para Hoje",
    },
  },

  conclusion: {
    title: "Termo",
    kicker: "Palavras",
    notYet: {
      title: "Você ainda não concluiu o Termo de hoje.",
      cta: "Jogar o Termo de hoje",
    },
  },

  // SIBLINGS of `conclusion`, read only by the Termo conclusion wrapper — they
  // may NOT go inside it, which is ConclusionCopy's exact shape and is rendered
  // by three other games. Same placement rule as `nonogram.reveal`.
  outcome: {
    wonLabel: "Concluído",
    wonDetail: (used: number, max: number) => `${used}/${max}`,
    wonAria: (used: number, max: number) =>
      `Termo concluído em ${used} de ${max} tentativas.`,
    lostLabel: "Jogado",
    lostDetail: (max: number) => `X/${max}`,
    // ONE RULE for the whole bundle: a composer takes its numbers and renders
    // DIGITS; it never spells one in words and never branches on a value it
    // was handed. `max === 6 ? "seis" : String(max)` was a runtime branch on
    // a compile-time constant whose false arm is unreachable and untestable,
    // and it left `dayWord.lost` hard-coding "seis" while `wonDetail` two
    // lines up parameterised `max`. Screen readers read "6" as "seis" in
    // pt-BR, so nothing is lost; `progressLong` already sets the precedent.
    lostAria: (max: number) =>
      `Termo jogado: as ${max} tentativas acabaram sem acerto.`,
  },
  dayWord: {
    won: (used: number, max: number) => `Você acertou em ${used} de ${max} tentativas.`,
    lost: (max: number) => `As ${max} tentativas acabaram.`,
    lead: "A palavra de hoje era",
  },
},
```

```ts
// messages.conclusion.dayCard (shared chrome) gains TWO strings, not one.
// Both are lowercase, because this is a tabular VALUE slot beside a duration
// ("06:47" / "falta"), not a chip — the hub's equivalents below are
// capitalised and that difference is deliberate (§15.3).
dayCard: {
  title: "O dia até agora",
  missing: "falta",
  played: "jogado",   // ← NEW: a lost Termo is played, never completed (ADR-0008)
  done: "feito",      // ← NEW: COMPLETED with no duration — a won Termo, whose
                      //   elapsed time is meaningless (ADR-0045 decision 4) and
                      //   is therefore never published. Without this string the
                      //   split guard in §15.3 has nothing to print and a won
                      //   Termo falls through to `falta`.
  games: { /* unchanged */ },
},
```

```ts
// messages.hoje gains TWO strings. Its four existing done strings ALL take a
// duration — `done: "Feito"` is the chip, but `doneResultLong(elapsed)`,
// `doneResultShort(elapsed)` and `doneAria(game, elapsed)` (messages.ts:89-93)
// every one of them requires a number a played entry does not have — so the
// hub literally could not render a played or a duration-less completed Termo
// with what shipped. ADR-0018 forbids composing the fallback in the component.
hoje: {
  // … existing keys unchanged …
  /** The chip on a PLAYED game's tile. Capitalised, beside `done: "Feito"`. */
  played: "Jogado",
  /**
   * The whole accessible name of a played tile, composed here (ADR-0018).
   * Takes NO duration: `doneAria` is `"${game} concluído em ${elapsed}"` and
   * both halves of that sentence are false for a lost Termo.
   */
  playedAria: (game: string) => `${game} jogado`,
},
```

**`doneResultLong` and `doneResultShort` are NOT rendered for a played entry, and not for a duration-less completed one either.** `HubCardAction`'s `.doneResult` span — the two-strings-one-per-viewport pair at `hub-day-state.tsx:107-114` — is emitted **only** when `elapsedMs !== undefined`. A played Termo renders the `.done` link with `messages.hoje.played` in the chip and **no result span at all**; a won Termo renders `messages.hoje.done` ("Feito") with no result span, until #29 lands `em 4/6`. Neither of the two shipped result composers is called with a fabricated value, and neither gains a no-argument overload — the branch is in the component's JSX, where the shipped code already branches for `route === undefined`.

The **28 key labels** are 26 letters through `letterAria`/`letterStateAria` (one composer) plus `enterAria` and `eraseAria`. **No key label is a literal in a component.**

**Every string above is checked against the post-#27 `FORBIDDEN_DAILY_KEYS` substring ban** — `solution, seed, reveal, answer, clueCount, motifId, name, mirrored, canonical, normalized` — and none contains a member. (`nome` does not contain `name`.) So is every CSS-module local: the names in §12.6 — now including `.tileHeld`, `.noticeRow`, `.nonce` and `.noticeRetry` — plus `.dayWordRow` / `.dayWordResult` / `.dayWordLead` / `.dayWord` / `.stampLost` / `.stampGuesses` / `.chipPlayed`. **T-WEB-S95** is the mechanical half; the convention is the rest.

---

## 19. Test plan, with allocated ids

### 19.1 The frontier, re-derived by grep

`docs/agents/test-ids.md` carries a frontier table, and it is a **snapshot** — handoff 021 §2 says *"re-derive it by grep before allocating."* Run against the working tree at `0c51f66`:

```
$ grep -rhoE "T-(CORE|DB|API|WEB|LINT)-S[0-9]+[a-z]?" apps packages | sort -u | tail -20
T-WEB-S55
T-WEB-S56
T-WEB-S57
T-WEB-S58
T-WEB-S59
T-WEB-S61
T-WEB-S62
T-WEB-S63
T-WEB-S64
T-WEB-S65a
T-WEB-S65b
T-WEB-S66
T-WEB-S67
T-WEB-S68
T-WEB-S69
T-WEB-S70
T-WEB-S71
T-WEB-S72
T-WEB-S8
T-WEB-S9

$ for a in CORE DB API WEB LINT; do echo -n "T-$a: "; \
    grep -rhoE "T-$a-S[0-9]+[a-z]?" apps packages \
    | sed -E "s/T-$a-S([0-9]+).*/\1/" | sort -n | tail -1; done
T-CORE: 16
T-DB: 9
T-API: 28
T-WEB: 72
T-LINT: 7
```

**Next free, and it matches the doc exactly — no drift:** `T-CORE-S17`, `T-DB-S10`, `T-API-S29`, `T-WEB-S73`, `T-LINT-S8`.

**Series `S` continues; no new letter is opened.** `docs/agents/test-ids.md` records the rule (plan 020 P30): *a new letter is opened only when the previous space has become ambiguous — one documented id, two meanings.* The `S` space has no such defect. **`packages/games` carries no ids at all, by convention** (`docs/agents/test-ids.md:11`, verified by grep), and the two files #27 adds there keep it that way.

Placement follows the house conventions: in the `it(...)` title, or in a `describe(...)` title, or — for whole-suite gates — a file-header comment (`// T-WEB-S86..S94 (plan 022 §19)`).

### 19.2 `packages/games` — two files, no ids

| File | What it proves |
|---|---|
| **G1** `packages/games/test/termo/exports.test.ts` | The missing sibling of `test/binairo/exports.test.ts`: self-references `@miolos/games/termo` and `@miolos/games` to catch exports-map typos. **#27 is the first consumer of the `./termo` subpath**, so it should exist. **Unrequested by any AC, and accepted at its size on purpose:** the binairo sibling is **20 lines** (`wc -l packages/games/test/binairo/exports.test.ts` → 20), and this one is its copy. A reviewer raising it as scope creep is answered by the number, not by an argument — §1.1 item 11 |
| **G2** `packages/games/test/termo/bundle-markers.test.ts` | Mirrors `test/nonogram/bundle-markers.test.ts`: `então`/`mamãe`/`época` resolve in `TERMO_ANSWERS`, **none** is in `TERMO_VALIDATION_WORDS`, and `zurro` is. Two-way citation with `apps/web/scripts/route-client-js.mjs`: *"When it reds, replace the marker in BOTH files."* §13.4 |

**No new `packages/games` property tests are owed**, and §3 says why in one sentence so the silence is not read as an omission.

### 19.3 `packages/core` — `T-CORE-S17…S24`

| id | File | Invariant |
|---|---|---|
| **T-CORE-S17** | `test/daily-contract.test.ts` | **All 400** `TERMO_ANSWERS` parse through `termoDailyContentSchema` and round-trip unchanged; a 401st object with an extra field **fails** (ADR-0024's fail-closed drift). `@miolos/games` is already a devDep of `packages/core` and `daily-contract.test.ts:297` already imports `generateBinairo` — the precedent exists |
| **T-CORE-S18** | same | `WORD_LENGTH === 5` and `MAX_GUESSES === 6`, pinning the literal `5` in `termoDailyContentSchema`, `TERMO_WORD_LENGTH`, `TERMO_MAX_GUESSES` and **`termoTilesSchema.def.items.length`** against the engine. **`.items` does not exist on a zod-4 tuple** — verified against the installed zod 4.4.3: `z.tuple([...5]).items` is `undefined`, while `.def` has keys `type, items, rest` and `.def.items` is a 5-element array. An earlier draft of this row said `.items.length`, which would have read `undefined.length` and thrown `TypeError` at the assertion rather than failing it — a red test for the wrong reason. Belt and braces: also assert the **behaviour** (`termoTilesSchema.safeParse` rejects a 4-tuple and a 6-tuple), so the row survives a future zod internal rename |
| **T-CORE-S19** | same | `stripDailyContent("termo", …)` returns **exactly** `{game, date}`; `collectKeys` over it contains no `FORBIDDEN_DAILY_KEYS` member; a projection carrying `canonical` **fails** `dailyTermoResponseSchema`; a drifted `content` **throws** |
| **T-CORE-S20** | `test/testing.test.ts` | `FORBIDDEN_DAILY_KEYS` meaningfulness: `"canonical"` and `"normalized"` are present, and a synthetic flattened termo projection **trips** the scan (the anti-vacuity half ADR-0033 decision 3 requires) |
| **T-CORE-S21** | `test/termo-guess-contract.test.ts` (new) | `termoGuessResponseSchema`'s `.refine` **both directions**: `status: "playing"` with an `answer` fails, and `status: "won"` without one fails. `termoTilesSchema` is a 5-tuple (4 and 6 both fail). The guess regex rejects `"CAFÉ"`, `"cafe"` (4), `"cafés"` |
| **T-CORE-S22** | `test/completion-contract.test.ts` | Termo's member is **exactly five keys** `["date","elapsedMs","game","guesses","hintsUsed"]` (its own copy of the `:495-523` audit); `guesses` bounded 1..6; `^[a-z]{5}$`; and its keys pass the `INSTANT_SHAPED = /at$|time|clock|instant|epoch|now|date/i` audit at `:525-533` |
| **T-CORE-S23** | same | The **retarget** of `:190-193`: `completionRequestSchema` now **accepts** `game: "termo"`, and still rejects an unknown game key. *The third retarget of the same `it` — `:185-188` records the first two* |
| **T-CORE-S24** | `test/cron-contract.test.ts` | Both `strictObject`s carry four keys with **termo first**; the two negative tests rewritten at `crossword`; a body missing `termo` rejects in both describes; the S16 failure mode for **termo drained alone** |

### 19.4 `packages/db` — `T-DB-S10…S12`

| id | File | Invariant |
|---|---|---|
| **T-DB-S10** | `test/published.test.ts` | `listUsedTermoAnswers` returns **killed AND unpublished AND past** rows — three seeded rows, one killed, one future, one past, all three returned. **Anti-vacuity:** a binairo row is **not** returned |
| **T-DB-S11** | `test/user.test.ts` (the shape `T-DB-21` at `:383-392` already uses) | `completions_guesses_check`: a termo row **without** a count rejects; a grid row **with** one rejects; a termo row with `0` or `7` rejects; `1`…`6` accept; `recordCompletion` omitting `guesses` writes NULL for a grid game |
| **T-DB-S12** | `test/published.test.ts` | The wall proved for the fourth game: `getTodayDaily(db,"termo")` returns exactly `{game, date}`; future-dated invisible; killed invisible; game-scoped reads isolated |

**Updated, not new** (§6.9): `T-DB-9c` at `:527` (9 → 10 names) and `T-DB-S5` at `:552` (`toHaveLength(24)` → `25`). Landmine L5's shape — *if one needs editing, something was added to the wrong surface* — is satisfied: exactly these two, and nothing else in that block moves.

### 19.5 `apps/api` — `T-API-S29…S41`

Table-driven over the enumerated 400, never fast-check (§3).

| id | File | Invariant |
|---|---|---|
| **T-API-S29** | `test/publishing-service.test.ts` | A cold `depth = 30` run over PGlite writes 30 rows with **30 distinct** normalized answers, all ∈ `TERMO_ANSWERS`, and each row's `content` is exactly `{canonical, normalized}` |
| **T-API-S30** | same | **Idempotency:** an immediate second run returns `generated: 0, failures: []` and **no row's `content` changed** |
| **T-API-S31** | same | **Cross-run no-repeat:** after run 1, kill 5 rows (delete none), run again at a wider depth — **no killed row's answer reappears** |
| **T-API-S32** | same | **Exhaustion fails closed:** pre-seed 395 distinct used answers **in ONE multi-row insert** — `db.insert(dailyPuzzles).values([...395])`, measured at 6.89 ms against 94.46 ms row-by-row (§24.1 landmine 6), 1 975 bind parameters against Postgres's 65 535 ceiling — then run at `depth = 10` → 5 generated, 5 failures **all** carrying `ANSWER_LIST_EXHAUSTED`, and `depth` reflects reality. **No per-`it` timeout is added**, and the arithmetic saying why goes in a comment beside the seed |
| **T-API-S33** | same | **The accept-region behaviour** of `drawUniformIndex`, driven through a **stubbed `randomUint32`** rather than recomputed. See the note below — the "construction" form this row originally carried was a tautology. For `n ∈ {1, 2, 399, 400}`: a stub returning `limit - 1` is **accepted** and yields `index === (limit - 1) % n`; stubs returning `limit`, `limit + 1` and `2**32 - 1` are **rejected** and force a redraw (asserted by counting stub calls); 64 consecutive rejecting draws throw with the `MAX_UNIFORM_DRAW_ATTEMPTS` message; every returned index is in `[0, n)`; and `drawUniformIndex(0)` / `(-1)` / `(1.5)` each throw `RangeError`. **`uniformDrawLimit(maxExclusive)` is exported alongside `drawUniformIndex`** (§10.1) so the boundary values are computed once, in the module under test, and the test binds to the real function rather than to a copy of its arithmetic. *No chi-squared and no frequency test ships* — ADR-0023 reserves "prove" for construction-backed invariants, and a distribution test would sample what P15 proves, carry a flake budget and mostly test the platform's CSPRNG |
| **T-API-S34** | `test/cron-publish.test.ts`, `test/buffer-depth.test.ts` | Four games in the fixed order **termo → binairo → nonogram → sudoku**, one log line each, fault isolation per game, `depths.termo`, and a **drained termo buffer alone** flipping `shallow` |
| **T-API-S35** | `test/daily-termo.test.ts` (new) | `GET /daily/termo`: 200 with a **two-key** body; the leak scan over `FORBIDDEN_DAILY_KEYS`; the 404 cases (no row, future-dated, killed); `force-dynamic`. **Do not reuse an id twice in one file** — plan 020 N30 caught `T-API-S6` used at `daily-sudoku.test.ts:75` and `:139` |
| **T-API-S36** | `test/termo-guess.test.ts` (new) | The happy path: a mid-game list returns `status: "playing"`, tiles parallel to the submitted guesses in the submitted order, and **no `answer` key at all**; a winning list returns `status: "won"` **with** the canonical accented spelling; a six-guess losing list returns `"lost"` with it |
| **T-API-S37** | same | The gate ladder: 401 with no session; 403 cross-site; 415 on a wrong content type; 400 `invalid-body`; 404 outside the `ACCEPTED_DAYS_BACK` window; 404 for an unpublished or killed row. Every response, 4xx included, carries the CORS grant |
| **T-API-S38** | same | 422 `invalid-guess` for a word outside the validation dictionary **and** for a list continuing past a winning row — **and never a 500**, which is the whole point of the explicit pre-check in front of `deriveBoardStatus` |
| **T-API-S39** | `test/completions.test.ts` | `POST /completions` termo: a winning list records `outcome: "won"` with `guesses = n`; a **six-guess loss records `outcome: "lost"`** with `guesses = 6`; a still-`playing` list is **422 `guess-mismatch` with no row**; a non-dictionary word likewise; the replay of a winning list against a stored `lost` row returns that row with `recorded: false` (the short-circuit at `:185-188`, **before** the wall read) |
| **T-API-S40** | same | The grid path is unchanged: `storedSolution` narrowed still serves all three; `body.grid.length !== solution.length` still 422s; a binairo body against a termo row **404s and never 500s** |
| **T-API-S41** | `test/cron-publish.test.ts` | **`runTopUp` never leaks a bound parameter** (§10.3.1): a `topUp` that rejects with a **real** `DrizzleQueryError` — produced by driving a genuine constraint violation through the PGlite fixture, never by hand-rolling the message — yields an `error` field whose value contains the query head and **does not contain the answer word bound into it**. Positive control in the same assertion: the head is non-empty and does contain `insert into`, so the negative cannot pass vacuously (landmine 4). Runs for **termo and one grid game**, because the fix covers both |

**Why T-API-S33 changed shape — the original was a tautology, and naming it is cheaper than rediscovering it.** `limit` is a **function-local** inside `drawUniformIndex` (§10.1). A test can therefore only recompute `Math.floor(2**32 / n) * n` and assert it equals itself; `limit % n === 0` and `limit === Math.floor(2**32/n)*n` are true of any `n` for any implementation, and a change to a plain `randomUint32() % n` — exactly the bias P15 rejects — keeps every one of them green. The fix is the smallest one that makes the assertions bind: **export `uniformDrawLimit(maxExclusive)`** so the test reads the real boundary from the real module, and **drive the accept/reject decision through a stubbed draw** so the assertions are about behaviour at the boundary rather than about arithmetic the test itself performed. The stub is a plain injected function or a `vi.spyOn` on the `randomUint32` import — whichever the file already uses for `generateDailySudoku` (`publishing-service.test.ts:112-123`'s `vi.mock` shape).

### 19.6 `apps/web` — `T-WEB-S73…S103`

**T-WEB-S73 belongs to PR A** (§21.0), not to #27's branch. It is listed here because this plan allocated the id and because §19.9's frontier arithmetic has to count it; it lands in **commit A2**, against **#68**, and a PR-B reviewer will not find it in the diff.

| id | File | Invariant |
|---|---|---|
| **T-WEB-S73** | `test/ink-on-accent.test.ts` | `accentVars("termo")["--ink-on-accent"] === "var(--ink)"`; the other three unchanged; **a per-site expected fallback** table (`var(--ink)` for Termo's board and keys, `var(--paper-desk)` elsewhere); the **eleven** converted declarations read `var(--ink-2)`/`var(--ink)` in stylesheet text; the two accent **rings** (`conclusion-view.module.css:174`, `page.module.css:219`) survive; `.page a:hover` declares `color: var(--ink)` **and** `text-decoration-color: var(--accent)` |
| **T-WEB-S74** | `test/termo-record.test.ts` (new) | `termoPlayRecordSchema` round-trips a full six-guess record; the union routes on `game` |
| **T-WEB-S75** | same | Each of the four `superRefine` checks rejects independently: a row after a winning row; `answer` without `concluded` and vice versa; `outcome` likewise; `concluded` with zero guesses. Plus `.max(6)` and the guess regex |
| **T-WEB-S76** | `test/termo-sync.test.ts` (new) | `buildBody`'s termo case posts **only** the guess words, clamped at both ends; a queue of three records posts three times, once each; the `const unhandled: never` source tripwire is **untouched** |
| **T-WEB-S77** | `test/termo-play.test.ts` (new) | **Termo's copy of `T-WEB-S64`:** parse every byte a full play-through persists and assert `answer === undefined` **iff** `concluded` is false, on both sides. On `answer`, **never on `guesses`**. **Commit B7, not B6** — it drives Termo's `buildRecord`, and `buildRecord` is a **per-game local**, not a shared export: `apps/web/src/sudoku/use-sudoku-play.ts:185`, `apps/web/src/nonogram/use-nonogram-play.ts:234` and `apps/web/src/binairo/use-binairo-play.ts:165` each declare their own `function buildRecord(` and the shared layer takes it as a **prop** (`apps/web/src/play/use-play-lifecycle.ts:48`). So Termo's lives in `use-termo-play.ts`, which lands in B7 with the reducer and `guess-client.ts`. B6 has nothing for this test to call |
| **T-WEB-S78** | `test/use-record-snapshot.test.ts` | `sameToTheReader` returns **false** when only the guess count moved; **anti-vacuity:** an unchanged count with all five chrome fields equal returns true |
| **T-WEB-S79** | `test/day-state.test.ts` | The three verbs: a lost termo record → `{status:"played", elapsedMs: undefined}`; a won one → `completed` with its duration; absence → `pending`; `completedCount` **excludes** the played entry; `sameDayState` compares `status`. **`:173`'s direct `.concluded` read is rewritten, not renamed** |
| **T-WEB-S80** | `test/conclusion-view.test.tsx` | `nextPendingDaily` **skips** a played termo (and still returns it when pending); `DayChip`'s third value renders `jogado` with **`.chipPlayed`'s SOLID border** — `border: 1.5px solid var(--line)` as stylesheet text, asserted **distinct from `.chipMissing`'s dashed** so `played` and `missing` cannot collapse to one shape (§15.3); `HubCardAction` branches on `status`, never on `elapsedMs`. **Plus the won-Termo row the split guard exists for:** a termo `DayEntry` of `{status:"completed", elapsedMs: undefined}` renders `.chipDone` and the value **`feito`**, never `falta`, and `HubCardAction` renders the `.done` link rather than the pending button. **Plus the loss row:** with `outcome.state === "lost"` and every game pending, the termo chip carries **no `formatElapsed` output at all** and the chaining CTA's `href` is **not** `routes.termo` |
| **T-WEB-S81** | `test/termo-state.test.ts` (new) | `restore` **discards** a record whose stored `outcome` disagrees with `deriveBoardStatus(tiles)`; discards a wrong-`game` record; accepts a consistent one |
| **T-WEB-S82** | same | **The ordering contract:** the `judged` action writes `guesses`, `answer` and `status` in **one** transition — there is no reachable state with `status !== "playing"` and `answer === undefined`. Driven by dispatching a winning response and asserting the post-state, and by asserting `buildRecord` on that state parses. **Plus the mapping in both directions and the absent field:** `judged` with `status: "won"` leaves `state.status === "solved"` (never `"won"`, which `PlayCore.status` has no member for), `judged` with `"lost"` passes through, and `buildRecord` on each writes `outcome: "won"` / `"lost"` **derived from `state.status`** — asserted structurally, that `TermoPlayState` carries no `outcome` key at all (ADR-0029 consequence (e)) |
| **T-WEB-S83** | `test/termo-guess-client.test.ts` (new) | The full failure table (§11.4), row by row: fetch rejection, 500, 429 and 401-after-remint all return `held` and leave the draft intact; 400/403/415 and **any 422 whose code is not `invalid-guess`** return `{kind:"rejected", reason:"refused"}` and clear the draft **without consuming a turn**; **a 422 whose body carries `invalid-guess` returns `{kind:"rejected", reason:"not-in-list"}`** — the row §11.4 splits out and the one that routes to `copy.notInList` rather than `copy.failed` (§13.1b), asserted on the `reason` and **not** on the copy, because the copy is the screen's job; 404 returns `gone`; a first 401 triggers **exactly one** `ensureSession({force:true})` and one silent re-post |
| **T-WEB-S84** | `test/termo-play.test.ts` | `persistDeps` is `[state.guesses]`: ten real `tick` turns produce **zero** `setItem` (with the anti-vacuity assertion), five typed letters produce zero, and one judged guess produces exactly one |
| **T-WEB-S85** | same | An **unjudged** guess never reaches storage: submit, hold the response, assert the persisted record's `guesses.length` is unchanged |
| **T-WEB-S86** | `test/termo-screen.test.tsx` (new) | The board's DOM: a labelled `role="group"` containing six labelled `role="group"` rows; every tile `aria-hidden`; **nothing on the board focusable** (`queryAllByRole("button")` inside the board is empty); no `display: contents` in the module |
| **T-WEB-S87** | same | The composed row sentence comes from `messages.ts` — a judged row's `aria-label` is `tentativa 2 de 6: C certa, A fora, …`, **not** `"CAFES"`; empty and active rows get their own composers. **Plus the two live-region obligations §13.1b states as reducer properties, both driven at the reducer rather than through the happy path:** (a) **the reducer walk** — for **every** action of the Termo reducer, at most one of `{notice, announcement}` differs from the previous state, including the retry-succeeds transition that is the only one where the naive placement collides (a test that exercises the happy path and observes no collision proves nothing); (b) **the double-rejection nonce** — submitting the same invalid word twice increments `noticeNonce` on the second rejection even though `notice` is byte-identical, the `.nonce` sibling span's text changes between `"​"` and `""`, and `getByText("não está na lista")` still matches exactly (the marker is a sibling, never appended to the notice's own text node) |
| **T-WEB-S88** | same | The keyboard: `role="group"` labelled `teclado`; **exactly one** `tabIndex={0}` at any time; the `←`/`→`/`↑`/`↓`/`Home`/`End` table with clamping; **no `aria-pressed` anywhere**; **28 keys and no Ç**; the 20-column placement table. **The roving model is the 28-id one, not a 26-letter one** (§13.1a): `enviar` and `apagar` are targets like any other, `Home` on row 3 lands on `enviar` and `End` on `erase`, row 1's `p` goes `↓` to `l` and row 2's `l` goes `↓` to `erase` (the `min(col, len−1)` clamp), and the seed is `"q"` so the first `Tab` in never finds zero keys at `tabindex="0"`. **Every assertion is pinned on `document.activeElement`, never on the `tabIndex` attribute** — an attribute-only assertion passes on the exact broken implementation §13.1a replaces. Plus the judged-re-render invariant: focus a key, drive a full `judged` transition, then assert `document.activeElement` is **still that button** and `querySelectorAll('[tabindex="0"]').length === 1` |
| **T-WEB-S89** | same | The window listener (§12.4): guard 1 `status !== "playing"`; guard 2 the three modifier keys; **guard 3's interactive-target `closest()` selector, which is FOUR selectors and not the first draft's three** — `button, a[href], [role="button"], [tabindex], input, textarea, select, [contenteditable]`, with `[tabindex]` (not `[tabindex="0"]`) load-bearing because 27 of the 28 keys carry `tabindex="-1"`; `Backspace` calls `preventDefault`; **`á` types `a` and `ç` types `c`** through `normalizeWord(event.key)` (AC 2 on the keystroke); the listener is torn down on unmount. **Driven by `document`-level dispatch, four cases, one per double-fire §12.4 enumerates:** `Enter` targeted at the `enviar` button → **exactly one** submit (the button's own click), never two; at a letter key → exactly one `type` and **zero** submits; at the back `<Link>` → **zero** submits; at `document.body` → **exactly one** submit, which is the case the listener exists for. Plus the pointer-blur: `onClick` with `detail !== 0` blurs its key, `detail === 0` does not |
| **T-WEB-S90** | same | The **six** tile classes and the keyboard's four, as **stylesheet text**, each with its second carrier: `.tileTyped` declares `border-color: var(--ink-2)`, **`.tileHeld` declares `border-color: var(--ink-2)` AND `border-style: dashed`** — the sixth state ADR-0039 consequence (g) creates, and the one a "five states" reading drops — `.tileCaret` an inset `outline`, `.tileAbsent` `line-through` with **`text-decoration-color: var(--ink)`** (never the glyph's own `--ink-2`, which would be 1.0000:1 — §12.2), `.tilePresent` `underline`, `.tileCorrect` `background: var(--accent)` **and** `border-color: var(--ink)`, `.keyAbsent` `box-shadow: none`; `.tileCorrect`/`.keyCorrect` read `var(--ink-on-accent, var(--ink))`. **Two further stylesheet-text assertions, each pinning a cascade defect jsdom cannot compute:** (a) **both shadow rules inside the `≤768px` chrome block carry `:not(.keyAbsent)`** — a bare `.key { box-shadow }` there is (0,1,0), sits later in the file than `.keyAbsent { box-shadow: none }`, and silently restores the shadow on every spent key at the primary viewport (browser-verified before the fix); the top-level `.key:not(.keyAbsent):active` carries it for the same reason against `.key:active`'s (0,2,0); (b) **the underline geometry per viewport** — `.tilePresent` declares `text-underline-offset: 4px` and `text-decoration-thickness: 3px` at the top level, the `≤768px` geometry block steps the thickness to `2px` and **leaves the offset at 4px**, and `.keyPresent` is offset `3px` / thickness `2px` (the one off-4pt length §12.1 deviation 7 records). The first draft's offset 6 put the mark 3.1px above a same-colour border at ≤768px and the pair read as one doubled edge |
| **T-WEB-S91** | same | Geometry A1–A12 (§12.1): `--board-mobile-max: 254px` declared **unconditionally** on `.pageTermo`; tile 52/4 above 768 and 44/3 below; keyboard `repeat(20, minmax(0,1fr))`, `width: 552px` / gap 8 desktop and `max-width: 350px` / gap 4 mobile; command labels 11px mobile / 14px desktop; the rotation signature `(0.7, −0.9, 4)` asserted **distinct from all three shipped**, read out of their own stylesheets. **The two `@media (max-width: 768px)` blocks are disambiguated by slicing** — `bodyOf` is first-match and throws |
| **T-WEB-S92** | same | Motion: the module declares **no `@keyframes` at all**; no animation name matches `/bounce\|elastic\|wobble\|jiggle\|spring/i`; every transition names only paint properties (never `width`/`height`/`padding`/`margin`); the `prefers-reduced-motion` block is **in this module** and stands down **both** `transition` and the five `transition-delay`s |
| **T-WEB-S93** | same | The rule impeccable's `kicker-above-heading` and `hero-eyebrow-chip` enforce — **and it is TWO mechanisms, not one uniform predicate, which is why a single `previousElementSibling === null` assertion across all four views would be false.** In the play, skeleton and conclusion views the `<h1>` **is** the first element child of its wrapper (`previousElementSibling === null`). In **`DailyUnavailable` it is not**, and it passes for a different reason: `apps/web/src/components/daily-unavailable.tsx` renders `<div aria-hidden className={styles.tape}/>` immediately before the `<h1>`, so the previous sibling exists — both rules anchor on `h1.previousElementSibling` and classify it **by its text content** (`checks.mjs:2492`), and an empty decorative div has none. So: three views assert `previousElementSibling === null`; the fourth asserts the sibling is present, `aria-hidden`, and **carries no text** (`textContent.trim() === ""`). The component's own comment says exactly this and must not be "simplified" into the first form |
| **T-WEB-S94** | same | The skeleton reserves 30 tiles at final size, all three keyboard rows and all 28 key boxes with their real labels, and the one-row stats card; nothing in it is focusable; `.placeholder` is declared **after** `.key` and `.tile` in the module text. **Three reservations the first draft under-specified, each a real reflow if dropped:** (a) the whole **`.noticeRow` at its full `min-height: 36px`** — the height it holds in every play state including the held one, so the retry button appearing is a paint and never a reflow (§12.6's arithmetic: 21px label + 8px padding = 29px, cleared with 7px to spare); (b) the **`.affordance` line rendered as a SIBLING of `.keyboard`, never a child** — `.keyboard` is a 20-column grid with all 28 keys explicitly placed, so an auto-placed span lands in an implicit fourth row ~20px wide holding a 63-character sentence, and `margin-top` on a grid item is inert against `gap` besides; (c) the **`.progressBar` slot in the top bar** with `BLANK_READOUT`, so the ≤1140px bar keeps **three** children before hydration and `justify-content: space-between` does not throw the kicker from hard-right to centre on hydrate (§12.1) |
| **T-WEB-S95** | `test/termo-page.test.tsx` (new) | `/termo`'s RSC props are `{daily}` with exactly `{game, date}`; the markup contains **no** `FORBIDDEN_DAILY_KEYS` substring; `/termo/concluido`'s props are exactly `["date"]`; the anti-vacuity assertion that the walk found a real key |
| **T-WEB-S96** | `test/termo-conclusion.test.tsx` (new) | The fourth branch: `data-conclusion-state="lost"` when `outcome.state === "lost"`, **checked before the stamp branch** (a locally-concluded lost record does **not** render "Concluído"); **the gate is `outcome?.state === "lost"` and never `outcome !== undefined`** — a won Termo passes the prop too, and gating on presence would render every win as a loss (ADR-0043 decision 2); a win renders `"result"` with the overridden label/detail; the three shipped games pass neither prop and are unchanged. **Plus ADR-0043 decision 10's live region:** a visually hidden `role="status"` carrying `outcome.aria` **verbatim** renders on the `result` and `lost` branches, renders **nothing** when no `outcome` is passed, and **nothing in the component composes the string** |
| **T-WEB-S97** | same | `.stampLost` declares **no `animation`**; its ring is `1.5px solid var(--ink-2)`; **no `.stampTime` and no hints line render in the branch**; `messages.conclusion.hints` is never called on a Termo path |
| **T-WEB-S98** | same | `.dayWordRow` declares **no** background, border, radius or box-shadow (so `isCardLikeFromProps` returns false on its first guard); it renders on **both** outcomes; its type is 34px, below `.stampTime`'s 40px |
| **T-WEB-S99** | same | The answer reaches the conclusion **from the record** on `/termo/concluido` and **from live state** in place; a record with `concluded: true` and no `answer` is unparseable, so the branch cannot render an empty word; a device with no record renders `empty`, not `lost` |
| **T-WEB-S100** | `test/route-ssr.test.tsx` | Both termo paths render with their marker attribute and **no function crosses the RSC boundary**; both render the unavailable screen when nothing is published |
| **T-WEB-S101** | `test/hoje.smoke.test.tsx` | The **activation** test — #27's own copy of `T-WEB-S55`, naming `routes.termo` explicitly: the hub's Termo card becomes a `<Link>`, and the chaining CTA re-points. Plus **the shipped tests this breaks**, driven by running the suite, not asserted (§26 item 10) |
| **T-WEB-S102** | `test/termo-screen.test.tsx` | **The stylesheet header's seven recorded deviations are enumerated, and a deletion reds.** §12.1 requires all seven — the 44px mobile tile, the sub-44px horizontal touch target, `text-decoration` as a fourth carrier kind, the `--ink` 10 % key shadow, the `--ink` 600 tile glyph, the `--ink` focus ring, and the two off-4pt lengths — to be written into `termo-board.module.css`'s own header verbatim **and numbered**, the way `nonogram-board.module.css:1-60` writes its six. Asserted as **stylesheet text over the header comment block**: the block exists, it declares **exactly seven** numbered items, and each carries the arithmetic token that identifies it (`44px`, `24 × 24`, `text-decoration`, `10 %`, `600`, `15.0124`, `30px`). A later contributor deleting one for tidiness reds this test rather than passing quietly — which is the whole reason §12.1 asked for an id |
| **T-WEB-S103** | same | **`.noticeRetry`'s placement and its position in the focus order** (§13.1 item 7a) — the two things that make a retry button safe beside a live region. Placement: the button is a **sibling** of the `role="status"` paragraph inside `.noticeRow` and **never a descendant of it**, so the region's atomic re-read is the sentence alone and no focusable element sits inside a mutating live region; it renders **only** on the `held` branch and is absent in every other state. Focus order: on `/termo`, `document`-order tabbing gives **"← Hoje" → `.noticeRetry` (when held) → the keyboard's single tab stop → end** — three stops at most, with the retry **before** the keyboard because it is the only control that can unblock the game. Asserted with `queryAllByRole("button")` scoped outside the board plus an explicit DOM-order walk, not by counting `tabIndex` attributes |

### 19.7 `apps/web` lint — `T-LINT-S8`

| id | File | Invariant |
|---|---|---|
| **T-LINT-S8** | `test/eslint-db-wall.test.ts` | The wall fires from `apps/web/src/termo/**` for a bare specifier, a relative path and a dynamic import; a clean Termo file reports zero. **`T-LINT-S7` (`:280-331`) is updated, not duplicated**: its derived set equality now holds with **six** names including `termoDailyContentSchema` |

### 19.8 What jsdom cannot prove — stated so the plan never claims coverage it lacks

jsdom implements **no layout**, so every pixel in §12.1 is asserted as *stylesheet text* through `apps/web/test/css-source.ts` and nothing more. It also cannot prove: that a `role="status"` region is spoken; that a `role="group"` row label is announced instead of its `aria-hidden` children; that `:focus-visible` matches, and therefore that the key caret paints at all; that `line-through` and `underline` are legible on a single 24px Fraunces glyph at 44px; that the two empty grid areas collapse cleanly; or that `apagar` fits a 38.6px key at 320px. **All six are in §26 with pre-agreed responses**, and the browser observations are E12's.

### 19.9 `docs/agents/test-ids.md` — the frontier is re-derived, and that is a commit

**`docs/agents/test-ids.md` is a `CLAUDE.md`-registered agent skill and it carries its own obligation**, at `docs/agents/test-ids.md`'s Frontier section: *"It is a snapshot, not a guarantee: re-run the grep before allocating, and **re-derive it at step 8 of any ticket that adds ids**."* #27 allocates **fifty-six**, counted rather than estimated — `T-CORE-S17…S24` (8), `T-DB-S10…S12` (3), `T-API-S29…S41` (13), `T-WEB-S73…S103` (**31**, of which **S73 is PR A's**, leaving 30 on PR B), `T-LINT-S8` (1). `8 + 3 + 13 + 31 + 1 = 56`. *(An earlier draft said "roughly forty" against a `T-WEB-S73…S101` range it also mis-counted as 28; both numbers are corrected here, and the arithmetic is written out so the next reader does not have to redo it.)* §19.1 discharges the *first* half of that rule ("re-run the grep before allocating") and the plan as drafted discharged **none** of the second.

**Commit B12** does. Three edits, all in `docs/agents/test-ids.md`:

1. **The Frontier table's five `Next free` cells** become `T-CORE-S25`, `T-DB-S13`, `T-API-S42`, `T-WEB-S104`, `T-LINT-S9` — **re-derived by the file's own grep at step 8, not copied from this list**, because the step-6/7 rounds will add ids this plan does not know about.
2. **A `#27 (plan 022)` paragraph** beside the existing `#25 (plan 020)` one, recording the reserved ranges above and anything spent beyond them.
3. **The "Opening a new series" paragraph** gains one sentence: plan 022 continued `S`, which still has no documented-id-two-meanings defect (§19.1).

**The `Bare series closed at` column does not move** — #27 opens no bare id.

**Scheduled as an E-step too, because a commit is easy to skip at the end of a long branch.** §21.7 **E13** now includes: *re-run the frontier grep, diff it against `docs/agents/test-ids.md`, and paste both.* If they disagree, B12 is amended before the merge; the doc is not allowed to be stale on `main`.

---

## 20. The TSDoc register — every sentence this PR makes false

Plan 020 §7.8's pattern, and landmine L5's reason: *"A comment or ADR claiming a guarantee the code lacks was caught three times in #18 and again in #25. Reviewers check these first."* **Each correction lands in the commit carrying the code it describes.** Commit ids are §21.2's — `A1`/`A2` on PR A, `B1`…`B12` on PR B.

| File:line | The false sentence | Correction | Commit |
|---|---|---|---|
| `packages/core/src/contracts/daily-content.ts:146` | strip table: `termo … #27 (throws until)` | `#27 (this file)`; the withheld column stays | B3 |
| `packages/core/src/contracts/daily-content.ts:120-131` | `DailyProjectionUnsupportedError` is *"for games whose projection is not implemented yet"* | There are none. It stays **exported** (the ESLint ban list and `T-LINT-S7` both fail on its removal) and its TSDoc says it is now unreachable and why it is kept | B3 |
| `packages/core/src/contracts/daily.ts:199-207` | `ProjectedGame`'s whole block — *"termo still throws… #27 widens this"* | Rewritten: all four games project; the type is retained as the wall's bound | B3 |
| `packages/core/src/testing.ts:9-11` | *"#27 extends this list with termo's answer when its projection lands"* | Half true: `"answer"` was already at `:33`; #27 extends it with `canonical` and `normalized`, and the reason is the vacuity argument | B3 |
| `packages/core/src/contracts/cron.ts:38-44` | *"It happens to read alphabetically today, and that coincidence ENDS at termo… #27 must not read the current order as alphabetical"* | Discharged; the order **is** termo-first and the measurement is quoted | B4 |
| `apps/api/src/publishing/service.ts:112-119`, `:237-250` | *"Termo draws from a curated word list (ADR-0015), which is not a seed → generate → weekday-validate loop"* | Still **true**, and now the TSDoc of a function that exists. Rewritten to point at `topUpTermoBuffer`'s four structural deltas rather than at a hypothetical | B4 |
| `apps/api/app/daily/nonogram/route.ts:19-20` | *"Nothing in `apps/web` consumes this path — the web app fetches `/session` and `/completions` only"* | **False after #27**: the third call is `/termo/guess`. Corrected in the same commit that adds the route | B5 |
| `apps/api/app/daily/sudoku/route.ts:12-26`, `nonogram/route.ts:12-18` | *"…and it would let `/daily/termo` reach `stripDailyContent` and throw"* | That half dies; the untrusted-`params` half survives and is the whole reason now | B4 |
| `apps/api/app/completions/route.ts:73-83` | `storedSolution`'s *"#27 gets a compile error here instead of a silent fallthrough"* | Discharged: describe the narrowed `GridCompletionGame` parameter and why narrowing beats an arm | B5 |
| `apps/api/app/completions/route.ts:224-230` | the constant-work loop is *"for #27… where the answer word IS the product's one secret"* | **False**: the Termo judge returns the judgement in the body, so there is no timing channel to close. The loop stays for the grid games, unweakened; the forward reference is removed | B5 |
| `packages/db/src/schema.ts:148-149` | *"EXTENSION POINT: #23/#25/#27 write through the same table and route; no schema change is expected"* | **False**: #27 adds `guesses` and its CHECK. Corrected (§6.3) | B5 |
| `apps/web/src/play/play-record.ts:207-210` | *"EXTENSION POINT: #27 adds its member here"* | Discharged; describe the four members and the first non-board one | B6 |
| `apps/web/src/play/sync.ts:244-248` | *"Termo's completion request carries GUESSES, not a grid (#27) — so it adds a non-grid case HERE"* | Discharged; describe the shipped case | B6 |
| `apps/web/src/play/sync.ts:256-269` | *"#25's Nonogram is the one that landed under this guard"* | Termo is now the second, and the first non-grid one | B6 |
| `apps/web/src/play/use-record-snapshot.ts:111-114` | *"The next game owes its own copy of T-WEB-S64"* | Discharged; name **T-WEB-S77** and say it asserts `answer`, not `guesses`, **and that it lands in B7 rather than B6 because `buildRecord` is a per-game local** (§19.6) | B6 |
| `apps/web/src/play/day-state.ts:56-62` | *"It is NOT a tripwire for #27 … that ticket adds no key here and nothing in this file can go red for it"* | **Half true and half not**: no key is added to the map, but `DayEntry`, `entryFor`, `completedCount` and `sameDayState` all change | B6 |
| `apps/web/src/play/types.ts:21-30` | *"`lost` is carried here from the start because Termo (#27) has a second terminal state"* | Discharged; `lost` finally has a producer (in B7's reducer); the correction rides B8, which is where `src/play/types.ts` is actually edited | B8 |
| `apps/web/src/play/use-play-lifecycle.ts:17-19`, `:44-47` | *"Termo's loss (#27) is the case that makes the distinction real"* | Discharged | B7 |
| `apps/web/src/play/grid-hint.ts:16-22` | *"#27 inherits neither this module nor ADR-0027's reasoning and decides its hint separately"* | Discharged: **ADR-0045 decides it, and the decision is no hint.** The module keeps exactly three consumers, permanently, and its name stays honest | B7 |
| `apps/web/src/play/progress.ts:15-24` | Nonogram is the one game that deliberately does not reuse `countFilled` | Termo is the second, and for a different reason (no `givens`, no null-empty array at all) | B7 |
| `apps/web/src/i18n/routes.ts:26-29`, `:47-51` | *"#27 adds … here"*, twice | Discharged | B8 |
| `apps/web/app/hub-day-state.tsx:71-75` | *"termo alone reaches this branch today, and #27 clears it"* | The branch is now **dead for all four games**; keep it, say `Partial` is retained deliberately, and cite the filed follow-up | B9 |
| `apps/web/src/play/accent.ts:50-55` | *"Termo is deliberately NOT rescued here… filed with every measured figure as #68"* | Rewritten by §16.3; #68's decision now **binds** and the figure is corrected to 2.8501:1. **This row is PR A's** (§21.0), not #27's | A2 |
| `apps/web/src/play/screen.module.css:16-21` | the header's claim that all four per-game custom properties have Binairo fallbacks | Already known false for `--board-mobile-max` (handoff 021 §2). **Not #27's to fix** unless the same commit touches that block — noted here so a reviewer does not read its absence as an oversight |
| `packages/games/src/termo/word-list.ts:9-15` | *"#27's server-side seeded choice (ADR-0010) indexes into this array"* | **False as written**: ADR-0024 decision 1 forbids a derivable seed, so the pick is a `randomUint32()` draw and the **word** is stored, never its index (P2/P3). Corrected in the commit that adds the annotations | B10 |
| **`packages/games/src/termo/index.ts:1-5`** | **Two sentences in the barrel's own header.** (i) *"per the games module-boundary convention, **ADR pending with #16**"* — ADR-0019 landed and is the convention; nothing is pending. (ii) *"**#27's daily selection indexes TERMO_ANSWERS** and never reads `content/termo` directly"* — the second half is true and stays; the first half is **false** for the same reason `word-list.ts:9-15` is (P2/P3: the pick is a `randomUint32()` draw over a run-scoped pool and the **word** is stored, never its index) | (i) cite `docs/adr/0019-per-game-subpath-exports-in-packages-games.md` by name; (ii) *"#27's daily selection draws from TERMO_ANSWERS and stores the drawn word"*. Two sentences, one file, and it is the file every §7 reader opens first | B10 |

---

## 21. Branch, commits, PR, rollout

### 21.0 TWO pull requests, not one — the split, and the split that was rejected

**This work ships as two PRs.** An earlier draft of this plan put the #68 accent conversion inside #27's branch as commit 3. That is wrong on `CLAUDE.md`'s own rule — *"One branch per issue: `<type>/<issue-number>-<slug>`"* — and the conversion closes **#68**, a different issue.

| | Branch | Closes | Contents | Order |
|---|---|---|---|---|
| **PR A** | `fix/68-accents-colour-shapes` | **#68** | **ADR-0041** and its `DESIGN.md:20-22` / `PRODUCT.md:40` amendment; `apps/web/src/play/accent.ts`'s `INKS_ON_ACCENT.termo`; the **eleven** `--accent`-as-text declarations across the three shared stylesheets (§16.2); `apps/web/test/ink-on-accent.test.ts` (**T-WEB-S73**) | **merged first** |
| **PR B** | `feat/27-daily-termo-end-to-end` | **#27** | everything else in this plan, **rebased on the merged PR A** | second |

**Three reasons, in order of weight.**

1. **`CLAUDE.md` says so directly.** One branch per issue. `Closes #68` and `Closes #27` on the same PR is two issues on one branch.
2. **It is the one diff Fernando must actually look at.** PR A repaints **three already-shipped screens**. Nothing else in #27 changes a pixel a player has already seen. Isolating it makes the review that matters a small, self-contained, independently revertible diff instead of a paragraph inside a 40-file PR.
3. **It is independently revertible in production.** If the repaint reads wrong to Fernando, PR A reverts on its own without touching a line of Termo.

**The three-way split (A / server / screen) was considered and rejected.** A step-3 reviewer recommended cutting PR B again at the server↔screen seam. Two reasons against: **both halves close #27**, so the cut reintroduces exactly the problem PR A solves (an issue split across two PRs, neither of which can carry `Closes`); and the cost it would avoid — running §21.4(b)'s seeding procedure once per PR — is **documented, rehearsed work** (landmine 3, and plan 020 §21.4 executed the same procedure for #25), not novel risk. The reviewer's own fallback — *"if only one cut is affordable, take PR A"* — is the cut taken.

**Four consequences, each mechanical.**

- **§16 stays in PR B**, reworded as the **record of a dependency already satisfied** rather than as a commit of #27's own. A PR-B reviewer reading §16 must find it pointing at merged PR A, not at a commit in the diff in front of them. *(That rewording lives in §16 and is owed there.)*
- **ADR numbering stays 0038–0045 and contiguous at the end.** ADR-0041 lands in PR A, so between PR A's merge and PR B's, `docs/adr/` reads `…0037, 0041`. **That gap is transient and expected**; PR B fills 0038–0040 and 0042–0045 in one commit. A reviewer who greps for contiguity between the two merges is looking at a known intermediate state.
- **PR B's first gate run happens on a `main` that already contains PR A.** Rebase, do not merge: `git fetch origin && git rebase origin/main` on `feat/27-daily-termo-end-to-end` immediately after PR A lands, then re-run the full gate before anything else.
- **`npx impeccable detect` on the seven existing routes is PR A's gate**, not PR B's. PR B's detect run covers all **nine** URLs (E11).

**Branch:** PR A is `fix/68-accents-colour-shapes`, cut from `main`. PR B is `feat/27-daily-termo-end-to-end` (already checked out), rebased on freshly pulled `main` after PR A merges and again before the step-6 gate run.

### 21.1 The `docs/README.md` row — commit B1 (this plan does not edit the file)

**Sequenced artifacts**, appended after the `handoffs/021-…` row, byte-for-byte in the register of the rows above it (backticked path, single spaces inside the pipes, no trailing space, LF):

```
| `plans/022-issue-27-plan-daily-termo-end-to-end.md` | Implementation plan for #27 (daily Termo end to end: the answer draw and its no-repeat rule, the stateless guess route and the offline degradation, the tile board and the pt-BR keyboard, the conclusion's fourth state, and the accent rule that closes #68) |
```

`022` is next free — `001`…`021` are contiguous across `plans/`, `handoffs/`, `research/`, `design/`. **`adr/` is a directory row, so the eight ADRs owe no README row.** If the session produces a handoff it owes a second row at `023`.

**Landmine 13: a missing `docs/README.md` row has been a blocking review finding six times.** #27 owes **one** README row and **one** `CONTEXT.md` block (§18.1) — two index edits in two different files, both in commit **B1**. **PR A owes neither**: `adr/` is a directory row, and #68 produces no sequenced artifact.

### 21.2 Commits — Conventional, English, each independently green

Pre-commit is `pnpm exec lint-staged && pnpm typecheck && pnpm test` and is **never** bypassed with `--no-verify`, so "independently green" means the **full suite and a strict typecheck pass at every one of these**.

**Commit ids are prefixed by their PR** (§21.0) — `A1`, `A2` on `fix/68-accents-colour-shapes`; `B1`…`B12` on `feat/27-daily-termo-end-to-end`. **`A1`/`A2` are COMMITS and nothing else** — §19.2's two `packages/games` test files are labelled `G1`/`G2` so the two spaces cannot collide. **§22's build-order table uses the same ids**, so the two tables cannot drift the way plan 020 TR-7 caught.

#### PR A — `fix/68-accents-colour-shapes`, closes #68, merged first

| # | Commit | Files | What it makes green | Gate before the next |
|---|---|---|---|---|
| **A1** | `docs: ADR-0041 — accents colour shapes, never words (#68)` | `docs/adr/0041-accents-colour-shapes-never-words.md`, **plus its amendment to `DESIGN.md:20-22` and `PRODUCT.md:40` in this same commit** | the decision exists before the code hard-codes it (CLAUDE.md). *"X is amended" means X was **edited*** (plan 020 ADH-1/ISS-6). **No `docs/README.md` row is owed** — `adr/` is a directory row (§21.1) | full gate |
| **A2** | `fix(web): accents colour shapes, never words (#68)` | the **eleven** shared declarations (§16.2), `apps/web/src/play/accent.ts`, `apps/web/test/ink-on-accent.test.ts` | **T-WEB-S73**. Alone, so it is independently reviewable and independently revertible. **Closes #68** | full gate **+ `npx impeccable detect` on all seven existing routes at 1440×900 and 390×844** |

#### PR B — `feat/27-daily-termo-end-to-end`, closes #27, rebased on merged PR A

| # | Commit | Files | What it makes green | Gate before the next |
|---|---|---|---|---|
| **B1** | `docs: plan 022 and Termo's vocabulary for #27` | this plan, `docs/README.md`'s row, **`CONTEXT.md`'s eleven rows** (§18.1 — counted, not estimated) | nothing new; the index edits land first (landmine 13) | full gate |
| **B2** | `docs: ADR-0038…0040 and ADR-0042…0045 for the daily Termo (#27)` | `docs/adr/0038`, `0039`, `0040`, `0042`, `0043`, `0044`, `0045` — **seven, not eight; ADR-0041 is PR A's** (§21.0) — **plus ADR-0045's two amendment edits in this same commit**: a row in the founding handoff's `⚠️ Emendas` table (`docs/handoffs/001-…md:9-…`, whose existing rows are the format to match) and the Termo qualification on `CONTEXT.md`'s **Hint / Dica** row (`CONTEXT.md:19`, verified in tree). *"X is amended" means X was **edited*** (plan 020 ADH-1/ISS-6), and ADR-0045's own `Amends:` header says both land "in the commit that lands this ADR" | the decisions exist before anything hard-codes them (CLAUDE.md). Contiguity 0038–0045 is restored at this commit. **`CONTEXT.md` is touched in B1 and again here** — different rows, different reasons (B1 adds §18.1's eleven Termo rows; B2 qualifies the shipped Hint row), and the file is green after each | full gate |
| **B3** | `feat(core): the termo daily contracts and the wall's fourth projection` | `contracts/daily-content.ts`, `contracts/daily.ts`, `testing.ts`, `src/index.ts`, `eslint.config.mjs`, `packages/db/test/fixtures.ts` | T-CORE-S17…S20, T-LINT-S8, the `T-LINT-S7` update, the `daily-contract.test.ts:99-103` retarget. **Green alone** — nothing consumes `ProjectedGame` for termo yet | full gate |
| **B4** | `feat(db,api): draw and publish the daily Termo answer` | `packages/db/src/{buffer,publishing}.ts`, `apps/api/src/publishing/service.ts`, `contracts/cron.ts`, `cron/publish/route.ts` (**including §10.3.1's `runTopUp` parameter strip**), `buffer-depth/route.ts`, `app/daily/termo/route.ts` | T-DB-S10, T-DB-S12, T-CORE-S24, T-API-S29…S35, **T-API-S41**, and the `T-DB-9c`/`T-DB-S5` updates | full gate |
| **B5** | `feat(core,api,db): judge a Termo guess and record its outcome` | `contracts/termo-guess.ts`, `contracts/completion.ts` (**including §8.0's `calendarDateString` move into `contracts/daily.ts`**), `packages/db/src/{schema,completions}.ts`, **`packages/db/migrations/0003_*.sql`**, `apps/api/src/publishing/dates.ts`, `app/termo/guess/route.ts`, `app/completions/route.ts` | T-CORE-S21…S23, T-DB-S11, T-API-S36…S40. **`packages/core`'s completion contract rides HERE, not in B3**, because `storedSolution` and `body.grid` are compile errors in `apps/api` the moment it lands (§6.9) | full gate — **and this commit carries a non-code obligation: §21.4(a)'s migration is applied to Neon the moment B5 is pushed.** See below |
| **B6** | `feat(web): the termo play record, its sync body and three-verb day state` | `src/play/{play-record,sync,use-record-snapshot,day-state,conclusion-view}.ts(x)`, **`src/play/conclusion-view.module.css`** (`.chipPlayed`'s solid border — §15.3), **`src/i18n/messages.ts`** (`conclusion.dayCard.done`/`.played` and the hub's `Jogado` — the two registers §18.2 spells), `app/hub-day-state.tsx`, and **the shipped tests they break** | T-WEB-S74, S75, S76, **S78, S79, S80** — **not S77** (§19.6: `buildRecord` is a per-game local and Termo's lands in B7). **The record member and the sync arm are inseparable** — the `never` assignment is a compile error. So is the `DayEntry` reshape and its eight consumers. **The stylesheet and the strings ride here because T-WEB-S80 asserts both** — the `jogado` chip's solid border and the won-Termo `feito` value — and a test cannot be a B6 gate if what it asserts lands in B8 | full gate |
| **B7** | `feat(web): the termo reducer, the guess client and its offline behaviour` | `src/termo/{types,state,guess-client,use-termo-play}.ts` | **T-WEB-S77**, S81…S85 | full gate |
| **B8** | `feat(web): the termo screen, its keyboard, and the conclusion's fourth state` | `src/termo/{board,keyboard,play-view,termo-screen,termo-conclusion}.tsx`, `termo-board.module.css`, `src/play/types.ts`, `src/play/conclusion-view.tsx`, `conclusion-view.module.css`, `src/i18n/{messages,routes}.ts` (**`routeSlugs`/`routes`, NOT `playRoutes`**), `app/termo/page.tsx`, `app/termo/concluido/page.tsx`, `test/route-ssr.test.tsx`, `test/termo-page.test.tsx` | T-WEB-S86…S100, **S102, S103**. **This is the earlier draft's screen half and conclusion half, collapsed — mandatorily, not as a convenience.** See below. **Before committing: `rm -rf apps/web/.next`** (§3) | full gate |
| **B9** | `feat(web): activate the termo hub tile and the conclusion chain` | **`playRoutes.termo` — one line** — plus every shipped test it breaks | T-WEB-S101. **Not folded into B8**: it is the entire behavioural change to two shipped screens, and hiding it inside the largest diff is the one collapse that is actively bad | full gate |
| **B10** | `feat(games): keep the answer list out of the client bundle` | `packages/games/src/termo/word-list.ts` (two annotations + TSDoc), `packages/games/test/termo/{exports,bundle-markers}.test.ts`, `apps/web/scripts/route-client-js.mjs` | **G1, G2** (§19.2 — the two `packages/games` FILES, deliberately relabelled `G` so they cannot be read as PR A's commits `A1`/`A2`). Placed after B8 so `pnpm bundle-check` can measure the **real** `/termo` | full gate **+ `pnpm build` + `pnpm bundle-check` + §13.4's marker greps** |
| **B11 — the arming commit, pushed LAST** | `ci: scan the termo routes with impeccable` | `.github/workflows/impeccable.yml`, three places | **Not a step-5 commit.** Created and pushed **only after** the step-7 fixes and **after** §21.4(b)'s `{generated, depth, failures}` output is pasted. Its own push is the first preview scan of the two new routes | E11 |
| **B12 — housekeeping, pushed with B11** | `docs: re-derive the test-id frontier after #27` | `docs/agents/test-ids.md` — the frontier table and the reserved-range paragraph | `docs/agents/test-ids.md`'s **own** rule: *"re-derive it at step 8 of any ticket that adds ids."* #27 allocates ~40. §19.9 carries the exact rows | E13 |

Then the step-7 `fix:` commits (§24.4 R4 says to expect two or three), **then** the seeding, **then** B11 and B12, and `docs: handoff 023 …` if the session produces one.

**Why B8 is a mandatory collapse, not a convenience.** An earlier draft of this plan — numbering commits 1…12 before the PR-A/PR-B split existed — split B8 into a **screen half** ("the board, its keyboard and the play screen") and a **conclusion half** ("the conclusion's fourth state and the day's word"), with `app/termo/concluido/page.tsx`, `test/route-ssr.test.tsx` and `test/termo-page.test.tsx` in the **screen** half. Those three files import `TermoConclusion` (`src/termo/termo-conclusion.tsx`) and the `ConclusionOutcome` / `ConclusionAnswer` types (`src/play/types.ts`) — **all of which land in the conclusion half**. `.husky/pre-commit` runs `pnpm typecheck && pnpm test` on every commit and is never bypassed, so the screen half as drafted could not be committed at all: it is a `TS2307` on an unresolved module. T-WEB-S100 and the `/termo/concluido` half of T-WEB-S95 have the same dependency. **The collapse removes the defect; reordering does not**, because the conclusion half also needs the screen half's `TermoScreen` for the in-place swap. Both §21.2 and §22 carry the collapse so the two tables cannot disagree.

**`apps/web/src/play/conclusion-view.tsx` is edited TWICE, and that is intended rather than a table error.** **B6** rewrites its `DayEntry` consumers — `dayEntry`, `DayChip`'s third value (`:377`) and `nextPendingDaily`'s `"pending"`-only chain — because the `DayEntry.concluded` → `DayEntry.status` reshape is a compile error across all eight consumers and cannot be split. **B8** then adds the fourth `data-conclusion-state` branch and the day's word. Different concerns, different tests (T-WEB-S79/S80 against T-WEB-S96…S99), and the file is green after each.

**Collapsing B3+B4 would be legal. Collapsing B9 into anything is not, splitting B8 is not, and neither is moving B11.** B11 is the only commit whose effect is on CI rather than on the product, and its precondition is a database state no commit can carry.

**B5's migration obligation, stated as a commit rule rather than as a rollout step.** §21.4(a) is **not** an E-series item any more. The moment B5 is pushed, the migration is applied to Neon by hand — *before* the branch's API is ever deployed anywhere. The reason is in §21.4(a) and it is not "termo 500s": it is that **`POST /completions` 500s for all four games**. Applying early is provably a non-event, so there is no reason to schedule it late and every reason not to.

### 21.3 Verification — the mechanical gate, from the repo root

**Evidence rule (CLAUDE.md): never report a step as passing without pasting the real command output.** *"Should pass", "looks correct" and "I've verified" are not results.*

```sh
source "$HOME/.nvm/nvm.sh" && nvm use
# FIRST LINE, every gate pass and every step-7 re-run — not only before
# commit B8 (plan 020 N24/TR-13). `apps/web/next-env.d.ts:3` hard-imports the
# gitignored `.next/types/routes.d.ts`; neither turbo's `typecheck` nor its
# `test` task regenerates it, only `next build` does. So a typecheck run after
# a build that predates the /termo segments is red for a reason unrelated to
# the diff, and CI cannot reproduce it (a clean checkout has no `.next`).
rm -rf apps/web/.next
pnpm install
pnpm typecheck --force              # turbo, 6 projects, strict
pnpm lint                           # eslint --max-warnings 0 . — plus a
                                    # deliberate-violation run proving the
                                    # @miolos/db and daily-content walls are live
pnpm test --force                   # full suite, uncached. 963 passing at b308349
npx turbo run build --filter=@miolos/web --force
cd apps/web && node scripts/route-client-js.mjs     # §13.4, then the marker greps
```

**Which command proves which acceptance criterion, and what "pasted output" means for each:**

| AC | Command | What must be in the paste |
|---|---|---|
| 1 | `pnpm test --force` | the **test-file and test counts** and the exit code, not a summary sentence. Plus **E2b**'s `{"bufferDepth":7,"generated":G,"depth":7,"failures":[]}` — **`depth` and `failures` are the assertion; `G` is bookkeeping** (§21.4(b): the buffer decays one day per day) — and **E6**'s `curl` bodies |
| 1 | `node scripts/route-client-js.mjs` + the marker greps | the delta table **and** all four grep counts: `zurro` and `abaco` **non-zero** (the positive controls — without them the negatives are vacuous, landmine 4), `então`/`mamãe`/`época` **zero** |
| 2 | `pnpm test --force` | T-CORE-S21, T-API-S36, T-WEB-S89 and T-WEB-S99 named in the output |
| 3 | `pnpm test --force` + **E8** | the tests, plus a real-browser paste showing the visible line reading exactly `não está na lista` |
| 4 | `pnpm test --force` + **E4/E9** | T-API-S39's three cases, plus `select outcome, guesses from completions where game='termo'` showing a `lost` row with a count, and the hub tile reading `Jogado` with **no duration** |
| 5 | `npx impeccable detect` ×2 viewports + **E12** | the **full** detect output for all **nine** URLs at 1440×900 and 390×844 with exit codes, **against a seeded preview host**; plus §12.2's and §16.2's computed contrast figures **written out**, because `low-contrast` is wildcard-ignored |
| all | `pnpm typecheck --force`, `pnpm lint`, `pnpm build` | exit codes shown, `--force` used, never a cached run |

**The manual contrast arithmetic is not optional and is not replaceable by a green detect.** `.impeccable/config.json:19-39` wildcard-ignores `low-contrast` **and** `cream-palette` on `http://localhost:*`, `http://localhost:*/**` and `https://miolos-*.vercel.app/**` — every host CI scans (issue #51). **A green `impeccable detect` says nothing whatsoever about contrast**, and #25 nearly shipped a real WCAG AA regression on two *already-shipped* screens behind that silence. So the PR pastes, as arithmetic:

- the WCAG 2.x formula and `--accent-termo`'s luminance longhand (§12.2);
- the **six** tile/key text-on-fill pairs and the **six** mark-against-surface pairs (§12.2), each with its verdict;
- the **eleven** converted sites' before-and-after ratios (§16.2);
- the two **retained** accent rings at 2.8501:1, stated as decorative under WCAG 1.4.11 with the enclosed label's ratio beside them;
- the loss stamp's `--ink-2` on `--paper-card` at **5.3003:1** and the day word's `--ink` on `--paper-card` at **15.6663:1**.

**A new by-design finding gets a value-level `.impeccable/config.json` entry with a written reason. A third wildcard host pattern is forbidden** (landmine 14).

### 21.4 Seeding, the migration, and the order they happen in

Two operational steps, both against the **same Neon database preview and production share**, both by hand, both with pasted output.

**(a) The migration — `completions.guesses`.** `packages/db` migrations reach Neon **by hand** via `DATABASE_URL_UNPOOLED`; **nothing in CI or Vercel runs them** (landmine 7). `apps/api/.env.local` already holds both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (verified: variable **names** only, no values read).

**Run it in a SUBSHELL.** `set -a` marks every subsequent assignment for export, so sourcing `.env.local` at the top level leaves `DATABASE_URL_UNPOOLED` — a live production credential — in the environment of every command typed afterwards in that terminal, including the ones that get pasted into a PR. The parentheses scope it to the block and cost nothing.

```sh
(
  cd /home/ferna/projects/miolos/apps/api
  source "$HOME/.nvm/nvm.sh" && nvm use default >/dev/null
  set -a && . ./.env.local && set +a        # .env.* is gitignored (.gitignore:5-6)

  psql "$DATABASE_URL_UNPOOLED" -f ../../packages/db/migrations/0003_<name>.sql
  psql "$DATABASE_URL_UNPOOLED" -c '\d completions'    # paste: the column and the CHECK
)
```

**When: the moment commit B5 is pushed — an obligation attached to that commit, not a step-8 rollout item.** This is the single most important sequencing fact in the plan, and the earlier draft had both its window and its blast radius wrong.

**The blast radius is ALL FOUR GAMES, not termo only — reproduced, not reasoned.** Drizzle builds an INSERT's column list from the **table schema object**, never from the values object; an un-supplied key is emitted as the SQL keyword `default`, and a bare `.returning()` selects every column. Against the installed **drizzle-orm 0.45.2**, with `completions` copied verbatim from `packages/db/src/schema.ts:151-177` and `.values()` supplying only the six pre-#27 keys:

*Baseline, no `guesses` column:*

```
insert into "completions" ("user_id", "game", "date", "completed_at", "outcome", "elapsed_ms", "hints_used")
values ($1, $2, $3, default, $4, $5, $6)
returning "user_id", "game", "date", "completed_at", "outcome", "elapsed_ms", "hints_used"
```

*With `guesses` added to the schema object — #27's migration, and `.values()` unchanged:*

```
insert into "completions" ("user_id", "game", "date", "completed_at", "outcome", "elapsed_ms", "hints_used", "guesses")
values ($1, $2, $3, default, $4, $5, $6, default)
on conflict ("user_id","game","date") do nothing
returning "user_id", "game", "date", "completed_at", "outcome", "elapsed_ms", "hints_used", "guesses"
```

params, identical in both: `["…uuid…","termo","2026-08-02","won",42000,0]`.

**`"guesses"` is in the column list and in the `returning` list for a binairo body exactly as for a termo one.** Also measured: nullable, `.notNull().default(…)`, and nullable-with-default all emit **byte-identical SQL** — drizzle emits `default` for any un-supplied column regardless — and neon-http and PGlite produce the same statement, so the PGlite tests are faithful evidence for production.

**So a `main` deployed before the apply 500s `POST /completions` for binairo, sudoku, nonogram *and* termo** with `column "guesses" of relation "completions" does not exist`. And 500 is **not** in `TERMINAL_STATUSES` (`sync.ts:42` — `{400, 403, 404, 415, 422}`), so every record stays `pendingSync` and replays. If the window crosses a São Paulo midnight, `on_time` — derived from `completed_at` — reclassifies **every user's** on-time completion as late, for all four games. That is precisely what ADR-0026 exists to prevent, and nothing alerts on it.

**Applying early is provably a non-event.** The CHECK's equality form `(game = 'termo') = (guesses is not null)` evaluates `(false) = (false)` → true for every existing row (the table holds no termo row today — the game shipped no client), and **no code on `main` names the column**, so no deployed statement's SQL changes. There is no state in which applying first is worse than applying late.

**Therefore the rule is: apply at B5, not at step 8.** The order is **generate (B5) → review the `.sql` → apply → push B5 → everything else**. It is scheduled, not discovered, and §21.7's E2 is now a *confirmation that it already happened*, not the moment it happens.

**Rollback, which the plan previously did not carry:**

```sh
psql "$DATABASE_URL_UNPOOLED" -c 'ALTER TABLE "completions" DROP CONSTRAINT "completions_guesses_check";'
psql "$DATABASE_URL_UNPOOLED" -c 'ALTER TABLE "completions" DROP COLUMN "guesses";'
```

**Drop the CONSTRAINT first** — dropping the column takes the constraint with it, but a two-step rollback lets an operator relieve a bad CHECK without losing recorded counts, which is the failure this is most likely to be needed for. **Rolling back is only safe while no `main` deployment names the column**, i.e. before PR B merges; after the merge the rollback is a forward fix, not a revert.

**Standing fact — `drizzle-kit migrate` must NEVER be run against Neon.** `packages/db/package.json:16` defines `"db:migrate": "drizzle-kit migrate"`, and it is a trap. Every migration in this repo reaches Neon by hand via `psql -f` and `DATABASE_URL_UNPOOLED` (handoff 021 landmine 7, `docs/handoffs/021-handoff-m2-termo-and-free-play.md:161`: *"Nothing in CI or Vercel runs them"*). `drizzle-kit migrate` reconciles `packages/db/migrations/meta/_journal.json` — which today lists exactly three entries, `0000_dizzy_layla_miller`, `0001_parallel_frightful_four`, `0002_living_senator_kelly` — against a bookkeeping table it maintains **inside the target database**, and a hand-applied `psql -f` writes no bookkeeping row. **What that table contains in Neon is unknown to this plan and cannot be assumed**, so the only safe posture is that `drizzle-kit migrate` is never pointed at Neon by anyone, for any migration, ever. `db:generate` is the only half of the pair this repo uses. **Record it in the PR body and in `packages/db`'s migration TSDoc**, because the script name is inviting and the failure is silent-or-catastrophic depending on that table's state.

**(b) Seeding the preview buffer.** `apps/web/app/termo/page.tsx` reads `getTodayDaily(getDb(), "termo")` and `daily_puzzles` holds **zero** termo rows today, so:

1. **AC 5 has no obtainable evidence without seeding.** An unseeded `/termo` renders `DailyUnavailable` at HTTP **200**, emitting **neither** marker attribute, and **`impeccable detect` passes green on the wrong screen** (landmine 2). The hardened preflight's `grep -q "$marker"` is the only thing that catches it. **A 200 is not evidence; it *is* the failure mode.**
2. **Without seeding the merge itself ships two defects.** `/buffer-depth`'s `shallow` is an OR, so `depths.termo = 0 < 4` flips it true the moment the fourth key lands and `buffer-alert.yml` opens an alert issue on its next 07:30 UTC poll; and `/termo` shows the unavailable card in production from merge until the next 06:00 UTC cron.

**The cron cannot do it.** `CRON_SECRET` is **Production-only** (landmine 3), so a preview `/cron/publish` returns 401 — and production's `/cron/publish` runs `main`, which has no `topUpTermoBuffer` until merge. **There is no deployed path that can seed termo before the merge.** The only mechanism is running the branch's own top-up locally.

**A subshell here too**, for the reason in (a) — and this block is the one whose output gets pasted into a PR, so a leaked credential in a later command's echo is a live risk rather than a theoretical one.

```sh
(
cd /home/ferna/projects/miolos/apps/api
source "$HOME/.nvm/nvm.sh" && nvm use default >/dev/null
set -a && . ./.env.local && set +a

pnpm exec tsx -e "
void (async () => {
  const { createPublishingDb, getRemoteConfig } = await import('@miolos/db/publishing');
  const { topUpTermoBuffer } = await import('./src/publishing/service.ts');
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL_UNPOOLED is unset');
  const db = createPublishingDb(url);
  const config = await getRemoteConfig(db);
  const result = await topUpTermoBuffer(db, config.bufferDepth);
  console.log(JSON.stringify({ bufferDepth: config.bufferDepth, ...result }, null, 2));
})();
"
)
```

**Expected — and the assertion is NOT on `generated`.** The seed **decays one day per day**: `bufferDepth` counts rows with `date >= SP-today` (`packages/db/src/buffer.ts:79-91`, `sql\`${dailyPuzzles.date} >= (now() at time zone …)::date\``), so a buffer seeded to depth 7 on day *D* is depth 6 on *D+1* and the top-up re-covers the newly uncovered tail date on each subsequent run. So the honest expectation is:

```
{"bufferDepth":7,"generated":G,"depth":7,"failures":[]}   with  G ∈ [0, days elapsed since the last seed]
```

**`depth: 7` and `failures: []` are the real assertions**; `generated` is bookkeeping. On the very first run after a clean state `G = 7`; on a same-day re-run `G = 0`; two days later `G = 2`. **Do not read `G = 0` as a failure and do not read `G > 0` as a re-seed.**

**"Seed once" therefore means "once after the schema is frozen — and re-run it if a day has passed since."** It is idempotent (P12, T-API-S30), so a re-run is free; what is *not* free is discovering at E11 that `depths.termo` is 5 because the branch sat over a weekend. **Re-run the block immediately before E11 regardless**, and paste both outputs if they differ.

**Two things about that snippet are load-bearing and were proved by #25, not guessed.** `tsx -e` transforms to **CJS**, so a bare top-level `await` fails with *"Top-level await is currently not supported with the 'cjs' output format"*; the `void (async () => {…})()` wrapper is what makes **both** the bare workspace specifier and the relative `./src/...` path resolve. (`pnpm exec tsx --version` → `tsx v4.23.1 / node v24.18.1`.) **Two edits from plan 020 §21.4 were not executed** — `topUpTermoBuffer`, and `.env.local` instead of `vercel env pull` — §26 item 13.

**The ordering rule, as three statements that agree:**

1. **Seeding runs ONCE, after `termoDailyContentSchema` is frozen by the step-7 fixes**, and its output is pasted — with the qualification above: "once" means once *after the freeze*, plus a free idempotent top-up whenever a day has rolled since.
2. **Commit B11 is created and pushed only after that output exists.** Until it lands, the workflow scans the seven shipped paths and stays green; nothing that was ever scanned becomes unscanned.
3. **If any step-6/7 or step-8 finding changes `termoDailyContentSchema` after seeding, a hard `DELETE` plus a re-seed is MANDATORY before the next push**, and the PR pastes both.

```sh
psql "$DATABASE_URL_UNPOOLED" -c \
  "delete from daily_puzzles where game = 'termo' and published_at > now();"
```

**`killed_at` is NOT a recovery** (landmine (a) / ADR-0024 D14): rows are immutable **and `listBufferedDates` counts killed rows as covered** (`buffer.ts:30-45`), so killing the seeded rows leaves those dates **permanently uncovered** — the cron never refills them and `/termo` shows the unavailable card on each. The only correct recovery is a hard delete of the not-yet-published rows, then a re-run. And a stale row is not silently wrong: `stripDailyContent` uses `.parse` and `getTodayDaily` does not catch (`published.ts:64-86`), so `/termo` **500s** and the preflight's `"200 $DEPLOYMENT_URL"*` case rejects it **before** the grep runs.

**Pre-merge safety, argued rather than assumed** (landmine 3: *"Verify that last clause… rather than assuming it"*). Four independent pieces, three executable:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://api.miolos.app/daily/termo   # expect 404 (no route on main)
curl -s -o /dev/null -w '%{http_code}\n' https://miolos.app/termo             # expect 404 (no segment on main)
curl -s https://api.miolos.app/buffer-depth                                   # expect exactly THREE keys
curl -s https://api.miolos.app/cron/publish -H 'Authorization: Bearer x'      # expect 401
```

The fourth piece is a code fact and it is the strongest: on `main`, `stripDailyContent`'s termo arm throws (`daily-content.ts:197-198`) and `ProjectedGame` excludes termo (`daily.ts:208`), so **`getTodayDaily(db, "termo")` does not compile** — no deployed reader can exist, *by construction*. Additionally verified: `apps/web/app/page.tsx:9-14` records that **the hub reads no database at all**, so seeded termo rows are invisible to the hub too. **One asymmetry stated honestly:** a pre-merge `404` on `/daily/termo` proves the *route* does not exist yet, not that no *row* exists. It is evidence about **deployed readers**, which is exactly the claim landmine 3 asks to be verified.

**Do not seed during the 06:00–07:00 UTC window.** ADR-0040's residual race is two concurrent `topUpTermoBuffer` runs reading the same used-set and drawing the same answer for two different dates; the realistic instance is a manual seeding run racing the daily cron.

### 21.5 `.github/workflows/impeccable.yml` — three places, commit B11

`:76` (the preflight `for path in …` loop), after `:151` (the desktop 1440×900 URL list) and after `:169` (the mobile 390×844 list) each gain `/termo` and `/termo/concluido`, **in landing order** (binairo #18 → sudoku #23 → nonogram #25 → termo #27). `:65` says *"Keep this list and the two detect invocations below in step."*

The `marker` `case` at `:77-81` is **already generic** (`*/concluido → data-conclusion-state=`, `/ → ''`, `* → data-play-state=`), so the two new paths get correct markers with **no further edit** — which is also why a fourth `data-conclusion-state` value is free: the preflight greps for the attribute **name**, not a value.

**Two consequences, both named — and the timeout one is now MEASURED rather than expected.** Scans go from 14 to **18** page-loads, i.e. ~29 % more wall clock per iteration. The four most recent **successful** `Impeccable` runs on this repo, read from `gh run list --workflow=impeccable.yml --json createdAt,updatedAt`, took **62 s, 57 s, 68 s and 62 s** wall clock (run ids `30753654005`, `30752392882`, `30744312207`, `30735506375`, all 2026-08-02) — and that span *includes* queueing, so it is an upper bound on the job. Scaling the worst of them: **68 × 18/14 = 87 s against `timeout-minutes: 15` = 900 s**, a margin of **10.3×**. **The timeout is not at risk and §26 item 14 is closed.** The job's real wall-clock time is still pasted at step 8 beside E11 — not because the margin is in doubt, but because a sudden jump is the cheapest early signal that something in the scan changed shape. And **`.impeccable/config.json` gets no edit**.

**The Impeccable workflow fires on `deployment_status` and produces two runs per push** — one per Vercel project. The `miolos-api` one is filtered at job level by `:14-16`'s `Preview – miolos-web` guard (**the dash is an EN DASH, U+2013**) and reports as *skipping*; `gh pr checks` may surface that one. **Find the successful `miolos-web` run and read its log**, or you will think the gate skipped when it passed.

### 21.6 PR skeletons — two PRs, two bodies

#### PR A — `fix/68-accents-colour-shapes`

`Closes #68.` Short by design. **What changed** (ADR-0041 + the `DESIGN.md`/`PRODUCT.md` amendment; `accent.ts`; the eleven declarations, listed one per line with their before/after ratios from §16.2; `ink-on-accent.test.ts`). → **The eleven sites' computed contrast, before and after**, plus the two **retained** accent rings at 2.8501:1 stated as decorative under WCAG 1.4.11 with the enclosed label's ratio beside them, plus **the sentence that `low-contrast` is wildcard-ignored on every host CI scans, so a green detect proves nothing here** (landmine (b)). → **`npx impeccable detect` on all seven existing routes, both viewports, exit codes shown.** → **Decisions needed from Fernando: this PR repaints three already-shipped screens.** That is the whole of what he must look at, and it is why this is its own PR (§21.0).

#### PR B — `feat/27-daily-termo-end-to-end`

`Closes #27.` **One `Closes`, one issue** — #68 is closed by PR A, already merged, and PR B's body links to it rather than claiming it.

**What changed** — one bold-package bullet per workspace, plus an explicit **"not touched"** paragraph naming: `packages/games/src` beyond two `/*#__PURE__*/` annotations and TSDoc; `packages/ui` (**no token value moves**); `packages/db`'s exports beyond `listUsedTermoAnswers`; `completionResponseSchema`, `CompletionRecord` and `getCompletion`; `wallPredicate`; `ACCEPTED_DAYS_BACK`'s **value**; `hint_grants`; `adSlotPlacements`; `vercel.json`; `.impeccable/config.json`; `sync.ts`'s queue, ladder, re-mint and settle machinery; `grid-hint.ts`; **and the eleven accent declarations, which are PR A's and are already on `main`.**

→ **Verification** — every output from §21.3 inline, plus §13.4's bundle table and its five greps with the two positive controls, plus the E-series.

→ **Computed contrast figures** — §21.3's five groups, in full, **with the sentence that CI is blind here and why**.

→ **Design deviations, each with its arithmetic** — the 44px mobile tile against `DESIGN.md:50`'s 38px; the sub-44px key width under the essential-presentation exception; the **one-row** stats card; **the hub tile's `em 07:12` against F1's `em 4/6`** (§6.2), stated as a deviation from a design reference; the absent timer; the absent hint; **and the reveal's placement — the issue body says *"tiles reveal the canonical accented spelling when the game ends"* and #27 reveals it in the conclusion instead** (§1's Out table, and the two ADR Rejected entries at `0042:238-242` and `0043:169-174`). **AC 2 is met; only the placement moves.** Naming it is the point — the plan discloses fifteen smaller deferrals, and a sentence dropped from the originating issue is not the one to leave silent.

→ **The migration and the standing DB facts** — the `\d completions` paste from E2; the one-line statement that the migration was applied **before B5 was pushed** and why (§21.4(a): a pre-migration deploy 500s `POST /completions` for **all four** games, not termo); the rollback command; and **`drizzle-kit migrate` must never be run against Neon**.

→ **What jsdom could not prove** — §19.8's six, as browser observations at 320, 390, 1100 and 1440 px, plus one screen-reader pass.

→ **Known-deferred** — §1.1's twelve, verbatim, so a late reviewer does not re-raise them.

→ **Review dispositions** — **a table of every step-3 and step-6 finding with its disposition**, on plan 020 §27's model (64 rows, including three places a reviewer was wrong *with the refuting evidence*). `CLAUDE.md`: *"A finding is dismissed only with a written reason in the PR, never by silence."* The plan's own exit criterion is written against that precedent and the skeleton previously gave it no home. Columns: **id · severity · finding, one line · disposition (`fixed` / `fixed differently` / `dismissed`) · the evidence.** Two rows are already known and go in verbatim:
>  - **The three PGlite seeding tests do not need a raised timeout** — dismissed with the measurement, §24.1 landmine 6.
>  - **The `runTopUp` parameter leak is fixed for all four games, not just termo** — fixed, §10.3.1, with the reproduced `params:` tail.

→ **Decisions surfaced (FYI)**, each with a filed follow-up whose link is **already real** (E0): the exhaustion alert; `em 4/6` on the hub; totalising `playRoutes`; the `FORBIDDEN_DAILY_KEYS` TSDoc correction. Plus, as statements rather than questions: that Termo cannot be played offline and that one acceptance criterion of #18's lineage is therefore unmet for this game **on purpose** (ADR-0039 consequence (a)); that `outcome: "lost"` is self-reported in the same sense `hints_used` is; and that **`buffer-alert.yml` has exactly one spurious-alert path**, named so nobody hunts a phantom — its `jq` is key-count-agnostic (`jq -r .shallow`, `jq -c .depths`, `.github/workflows/buffer-alert.yml:40,46`), so a fourth depth key is invisible to it; the only false alarm is a **merge landing between the 06:00–07:00 UTC publish window and the 07:30 UTC poll (`:13`, `cron: "30 7 * * *"`) on a day the seed has decayed below `effectiveThreshold = min(4, 7) = 4`**. Re-running §21.4(b)'s idempotent top-up immediately before the merge closes it.

→ **Decisions Fernando may want to overturn** — stated as a short numbered list, at the top of the body, each one sentence plus the cost of reversing it. **These are not questions blocking the merge**; they are the places where an agent picked a side and Fernando may not want that side.

1. **Termo ships no hint (ADR-0045).** This **amends a founding-handoff *product* rule** — *"Dicas: 1 grátis por puzzle"*, in "Decisões travadas → Produto", repeated at `CONTEXT.md:19` — for one game. `CLAUDE.md` requires a contradiction between a plan and the founding handoff to be **surfaced to Fernando rather than silently resolved**, and this is the surfacing. The mechanics are already in place so the surfacing is not just prose: ADR-0045 carries an **`Amends:`** header, **the founding handoff's amendment-table row and `CONTEXT.md`'s Hint-row qualification land in the same commit as the ADR (B2)** — *"X is amended" means X was edited* (plan 020 ADH-1/ISS-6) — and the argument is *"there is nothing to hint"*, not *"a hint is too expensive"*. **Reverting is one ADR and one button:** Termo's state carries no `HintState` at all, `hintsUsed` keeps its `.max(1)` wire bound unchanged, and the shared `screen.hint` grid area is untouched and (after PR A) legible. The work is **not blocked** on his answer.
2. **The guess route is an answer oracle at a cost of ONE request** (§4 P25, D-ORACLE): six arbitrary dictionary words make a terminal board, and a terminal board's response carries the canonical answer by design. It reaches **published days only** (`wallPredicate`), and it is strictly more expensive than the `solveBinairo(givens)` local solve ADR-0027 already ships. The alternative is server-side guess state — a table, a migration, and cross-device coupling ADR-0038 rejects.
3. **Three shipped screens changed appearance** — PR A, already merged. Eleven `--accent`-as-text declarations became `--ink`/`--ink-2`.
4. **The hub shows no result string for a *won* Termo** until #29 lands the guess count (§6.2, F10's third option): `elapsedMs` is left undefined for a won Termo too, so the tile reads the plain done string rather than a meaningless duration.
5. **`em 4/6` is deferred to #29**, so the F1 reference frame's Termo card is not yet matched (§27 item 2, filed at E0).

→ **Decisions needed from Fernando before merge** — **none.** Say that in those words. Item 1 above is the one he is most likely to want to reverse, and reversing it is a follow-up ticket, not a blocker.

### 21.7 Step-8 production rollout, in order, evidence pasted

- **E0 — file the four follow-ups BEFORE the PR body is written, not after the merge.** §21.6 requires the PR to close with "each has a filed follow-up"; with the filing at the end those links do not exist and that sentence is **false at the moment Fernando reads it**. All four are pure `gh issue create` calls with no dependency on the merge (§27). **Paste the four URLs.**
- **E1.** No infrastructure work. **Do not rotate `DATABASE_URL`.** #59 remains unbuilt and nothing may imply otherwise.
- **E2 — a CONFIRMATION, not the moment it happens.** §21.4(a)'s migration was applied **at commit B5**, before the branch's API was ever deployed, because a pre-migration deploy 500s `POST /completions` for **all four games** (the generated SQL is pasted in §21.4(a)). E2 re-runs `psql "$DATABASE_URL_UNPOOLED" -c '\d completions'` and pastes it, showing the column and `completions_guesses_check` **already present**. **If this is the first time the migration is being applied, the sequencing rule was broken** — say so in the PR rather than quietly applying it now. *(§21.4(a) and this line named different windows in an earlier draft; the B5 window is the one that binds and this is its only statement.)*
- **E2b.** §21.4(b) — the seeding run, **after the step-7 fixes freeze `termoDailyContentSchema` and BEFORE commit B11 is pushed**. Paste `{bufferDepth, generated, depth, failures}`, plus `select date, published_at, published_at > now() as future from daily_puzzles where game='termo' order by date;` so the future-dated rows are visibly present. **Assert on `depth: 7` and `failures: []`**, never on `generated` (§21.4(b): the buffer decays one day per day, so `generated ∈ [0, days elapsed]`). **Re-run it immediately before E11** if a day has rolled since.
- **E3.** Merge → both projects auto-deploy. `vercel.json` unchanged. Paste the deploy links.
- **E4.** `curl -H "Authorization: Bearer $CRON_SECRET" https://api.miolos.app/cron/publish | jq` ⇒ `games.termo = {"generated": G, "depth": 7, "failures": [], "error": null}`, **and `games` keyed termo first**. **`generated` is NOT the assertion; `depth: 7` and `failures: []` are.** `G` is `0` if E2b ran today and `n` if `n` São Paulo days have rolled since — `bufferDepth` counts `date >= SP-today` (`packages/db/src/buffer.ts:79-91`), so the buffer loses its head each midnight and this run re-covers the tail. **Do not read `G = 0` as a failure and do not read `G > 0` as a re-seed.**
  **Where `$CRON_SECRET` comes from, because landmine 3 says it is Production-only and the shell needs it anyway:** `vercel env pull --cwd apps/api --environment=production` writes a `.env.production.local` beside the existing files (gitignored by `.gitignore:5-6`'s `.env*`), and the value is sourced from **there**, inside a subshell, exactly as §21.4 does — never pasted on a command line, never echoed, and the pulled file is deleted afterwards. *(Precedent: plan 014 E1 and plan 009 §11 both use `vercel env pull --cwd apps/api`.)* **Never `vercel env pull` into `apps/api/.env.local`** — that file already holds the working development values and the pull appends rather than replaces (plan 009's own warning).
- **E5.** `curl -sS https://api.miolos.app/buffer-depth | jq` ⇒ **four** depths at 7, `shallow: false`.
- **E6.** `curl -sS https://api.miolos.app/daily/termo | jq 'keys'` ⇒ exactly `["date","game"]`, **and** `jq -r '.date'` asserted equal to São Paulo today — i.e. E2b's `min(date)` and **never** its `max(date)`. Depth alone does not prove "behind the predicate helper": `bufferDepth` counts `date >= (now() at time zone 'America/Sao_Paulo')::date`, so 7 **includes today's already-published row**. This is the only line in the E-series that makes AC 1's wall clause true of **production**.
- **E7.** `curl -sS https://api.miolos.app/daily/termo | jq 'has("answer"), has("canonical"), has("normalized"), has("seed")'` ⇒ `false false false false`.
- **E8.** Real browser: load `https://miolos.app/termo`, type `AÇÃO`-style accented input and confirm it lands as ASCII, submit a non-word and **paste the rendered `não está na lista` line**, then win, and confirm the conclusion renders **in place** with the day's word in its canonical accented spelling, the hub tile turns done, and `select * from completions where game='termo'` shows exactly one row with `on_time` true and `guesses = n`.
- **E9.** The **loss** drill on a second profile: exhaust six guesses; confirm `data-conclusion-state="lost"`, `X/6`, **no time and no hint line**, the day's word rendered, the hub tile reading `Jogado` **with no duration**, the CTA **not** offering Termo, and one `completions` row with `outcome = 'lost'` and `guesses = 6`.
- **E10.** The offline drill: load `/termo`, kill the network, type a guess, submit — confirm the **held** state and the inline connection line, that the turn is **not** consumed, and that restoring the network judges it. Then reload mid-game and confirm the judged rows come back and the un-judged draft does not.
- **E11.** The preflight (200 **AND** the marker grep) for both new paths against the **preview**, then `impeccable detect` over all **nine** URLs at 1440×900 and 390×844. **Preview, not production**: `.impeccable/config.json` scopes its wildcards to `http://localhost:*` and `https://miolos-*.vercel.app/**`, and `https://miolos.app/**` matches neither. Then the `Impeccable` job link for the PR's **final preview deployment** — **not for the merge commit, which structurally cannot have one** (`impeccable.yml:14-16` filters Production out). **Paste the job's wall-clock time** beside §21.5's timeout assertion.
- **E12.** The browser observations §19.8 requires, at **320, 390, 1100 and 1440 px**, plus one VoiceOver or NVDA pass recording whether the row `role="group"` label is announced instead of its `aria-hidden` tiles.
- **E13 — the comment and housekeeping step. Six items, each with a URL pasted.**
  1. Confirm the four E0 issues are open and that the PR body's links resolve; file any additional follow-up the step-6/7 rounds produced.
  2. **Post the closing comment on #68** carrying the 2.736 → 2.8501 correction (§16.4). *(PR A closed the issue; this comment carries the figure correction the issue body still shows.)*
  3. **Post the comment #27 owes on [#67](https://github.com/fernandolisboa/miolos/issues/67).** §1's Out table and §1.1 item 6 both say *"#27 owes a comment on the issue, not code"* and the plan scheduled it nowhere. Content: ADR-0045 consequence (c) narrows #67 to its **fix (i)** — `/termo` renders **no hint button at all**, so the hint-button tab-order defect now has three surfaces rather than four, and the remaining fix is the one #67 already names. Two sentences and a link to ADR-0045.
  4. **Post the AC-4 obligation comment on [#19](https://github.com/fernandolisboa/miolos/issues/19) and on [#29](https://github.com/fernandolisboa/miolos/issues/29)** (§25 AC 4). Content, the same on both, adjusted for which AC owns which half: *"#27 shipped `completions.outcome = 'lost'` with `guesses = 6` for a six-guess Termo — the fail row ADR-0008 rule 3 requires. **Neither streak nor Dia Perfeito exists yet** (`apps/web/app/page.tsx:82` is `const streakCount = 0`; `apps/api` has no aggregating route), so #27 could not test the exclusion and did not claim to. **This issue's AC 1 owns the proof**: whatever derives the streak / Dia Perfeito must exclude `outcome = 'lost'`, and the test that proves it belongs here, not in #27."* **Paste both comment URLs** — this is the mechanism that stops the obligation evaporating.
  5. **Re-derive the test-id frontier** (§19.9): run `grep -rhoE "T-(CORE|DB|API|WEB|LINT)-S[0-9]+[a-z]?" apps packages | sort -u` per area, diff against `docs/agents/test-ids.md`, and **paste both**. If they disagree, amend commit **B12** before the merge; the doc is not allowed to be stale on `main`.
  6. Paste the **Review dispositions** table's final state (§21.6), including every step-6 finding dismissed with its written reason.
- **E14.** Close #27 quoting E0–E13 against the five ACs.

---

## 22. Build order

**These numbers are BUILD STEPS, and every row names the commit it lands in** — plan 020 TR-7 caught a preamble numbering commits while the table numbered steps, and the two contradicting each other. Dependencies are stated against the rows below and nothing else.

**Commit ids are §21.2's** (`A1`/`A2` on PR A, `B1`…`B12` on PR B) so the two tables cannot drift.

| # | Step | Files | Commit | Depends on | TDD |
|---|---|---|---|---|---|
| **A** | **PR A — ADR-0041 + its `DESIGN.md:20-22` / `PRODUCT.md:40` amendment; then the eleven `--accent`-as-text declarations, `accent.ts`, `ink-on-accent.test.ts`** | `docs/adr`, `DESIGN.md`, `PRODUCT.md`, web (`src/play`, `app/`) | **A1, A2** | — | **assertion-first** — T-WEB-S73 is the gate, and `npx impeccable detect` on all seven existing routes is the second |
| — | **PR A merges. Rebase `feat/27-daily-termo-end-to-end` on `origin/main` and re-run the full gate before step 0.** | — | — | A | — |
| 0 | The plan, the `docs/README.md` row, **`CONTEXT.md`'s eleven rows** (§18.1) | `docs/`, `CONTEXT.md` | **B1** | A | — |
| 1 | **ADRs 0038–0040 and 0042–0045** — seven, written first because everything below hard-codes them. **ADR-0041 is PR A's.** **Plus ADR-0045's two amendment edits, in the same commit**: the founding handoff's `Emendas` row and `CONTEXT.md:19`'s Hint-row qualification | `docs/adr`, `docs/handoffs/001-…`, `CONTEXT.md` | **B2** | 0 | — |
| 2 | `packages/core` daily contracts, `testing.ts`, the barrel, the ESLint wall; `packages/db` fixtures | core, db, eslint | **B3** | 1 | **yes** — T-CORE-S17…S20, T-LINT-S8 first |
| 3 | `uniformDrawLimit` + `drawUniformIndex` + `topUpTermoBuffer`; `listUsedTermoAnswers`; cron contracts + both routes; **§10.3.1's `runTopUp` parameter strip**; `GET /daily/termo` | db, core, api | **B4** | 2 | **yes** — T-DB-S10/S12, T-CORE-S24, T-API-S29…S35, T-API-S41 first |
| 4 | `termo-guess.ts`; **§8.0's `calendarDateString` move**; the completion member; the `guesses` column + migration; the `ACCEPTED_DAYS_BACK` hoist; `POST /termo/guess`; the judge restructure | core, db, api | **B5** | 3 | **yes** — T-CORE-S21…S23, T-DB-S11, T-API-S36…S40 first. **§8.0's move is written FIRST, before either schema exists**, so the cycle is never armed |
| 4o | **OPERATIONAL, not a commit: apply the migration to Neon the moment B5 is pushed** (§21.4(a)) | — | rides **B5** | 4 | — |
| 5 | The record member + `buildBody` + `sameToTheReader` + `DayEntry`'s three verbs and all eight consumers, **plus `.chipPlayed` in `src/play/conclusion-view.module.css` and the `feito`/`jogado`/`Jogado` strings in `src/i18n/messages.ts`** — both are what T-WEB-S80 asserts | web (`src/play`, `src/i18n/messages.ts`, `app/hub-day-state.tsx`) | **B6** | 4 | **yes, strictly** — pure functions; T-WEB-S74, S75, S76, S78, S79, S80 first. **Not S77** — it needs step 6's `buildRecord` |
| 6 | The Termo reducer, the guess client, `use-termo-play` (**and its `buildRecord`**) | web (`src/termo`) | **B7** | 5 | **yes, strictly** — T-WEB-S77, S81…S85 first |
| 7 | The board, the keyboard, the play view, the screen, the CSS module, i18n, both route shells — **and, in the same step, `ConclusionOutcome`/`ConclusionAnswer`, the conclusion's fourth branch and the Termo wrapper** | web (`src/termo`, `src/play`) | **B8** | 5, 6 | smoke tests after for the screen half (T-WEB-S86…S95, S100, **S102, S103**); **TDD-first for the conclusion half** (T-WEB-S96…S99). **`rm -rf apps/web/.next` before committing** |
| 8 | *(merged into step 7 — see below)* | — | — | — | — |
| 9 | Activation: `playRoutes.termo` + every shipped test it breaks | web (`src/i18n`, `test/`) | **B9** | 7 | yes — T-WEB-S101 |
| 10 | The two `/*#__PURE__*/` annotations, the two `packages/games` test files, the `route-client-js.mjs` markers | games, web scripts | **B10** | 7 (so `/termo` is measurable) | **yes** — **G2** first (§19.2's marker file, not PR A's commit `A2`) |
| 11 | The full gate, both detect modes, the bundle measurement, the deliberate-violation lint run; then the step-7 fixes; **then E2b**; **then** the impeccable workflow commit and the test-id frontier commit | `.github/workflows/impeccable.yml`, `docs/agents/test-ids.md` | **B11, B12**, last | 9, 10, and E2b | — |

**Step 8 no longer exists, and that is the F2 fix, stated in both tables.** Its former contents — `ConclusionOutcome`/`ConclusionAnswer`, the fourth `data-conclusion-state` branch, `DayChip`'s third value, the Termo conclusion wrapper — are **inside step 7**. The old split was unlandable: step 7's `app/termo/concluido/page.tsx`, `test/route-ssr.test.tsx` and `test/termo-page.test.tsx` import `TermoConclusion` and the two conclusion types, all of which step 8 created, and `.husky/pre-commit` runs `pnpm typecheck && pnpm test` on every commit. **`DayChip`'s third value is NOT here** — it is a **step 5 / commit B6** consumer (`apps/web/src/play/conclusion-view.tsx:377`, in the file B6 already rewrites), and T-WEB-S80 asserts it as a B6 gate. The old step-8 row claiming it was the second half of a contradiction §21.2 resolved the other way.

**The four orderings that are not negotiable:** **PR A merged before step 0** (§21.0, §6.8 — `playRoutes.termo` may not land without the accent treatment on `main`); **step 4's migration applied before B5 is pushed** (§21.4(a) — a pre-migration deploy 500s `POST /completions` for all four games); **step 11's workflow commit after E2b** (§21.4(b)); and **§8.0's `calendarDateString` move written before either of step 4's two schemas** (§8.0 — otherwise `@miolos/core` throws at import).

---

## 23. New ADRs

**Eight, numbered 0038–0045, contiguous.** `docs/adr/` holds `0001`…`0037` contiguously, so 0038 is next free. `docs/README.md` lists `adr/` as a directory, so **no README row is owed for these** — only this plan's own (§21.1). §6.10 records the renumbering three of them undergo.

**They land in TWO commits across TWO pull requests** (§21.0). **ADR-0041 is commit A1**, on `fix/68-accents-colour-shapes`, with its `DESIGN.md:20-22` / `PRODUCT.md:40` amendment in that same commit. **The other seven are commit B2**, on `feat/27-daily-termo-end-to-end`. Both land before any code hard-codes them (CLAUDE.md). Between the two merges `docs/adr/` reads `…0037, 0041` — **a transient, expected gap**, closed at PR B's merge.

**Two of the eight carry a correction this plan makes at step 4 and the ADR bodies must carry too** — recorded here so the ADR author does not restore the original wording:

- **ADR-0038's oracle cost.** The draft asserted *"an information-theoretic floor of **two** requests and a zero-cleverness ceiling of 400"*. Both numbers are withdrawn: **one** authenticated request carrying six arbitrary dictionary words returns the canonical answer, because a six-row board with no all-correct row is terminal (`packages/games/src/termo/status.ts:39`) and the response's `.refine` then makes `answer` mandatory. §4 P25 carries the corrected statement and the two arguments that survive. **The decision does not change; the arithmetic does.**
- **ADR-0038 consequence (f)'s cost comparison.** *"Strictly less than `GET /daily/<game>`"* is false — the guess route is **three** neon-http round trips against that route's one, ~6× a day where `/daily/<game>` is called zero times by `apps/web`. §11.1's table replaces it, and the no-limiting posture is re-affirmed on the corrected figure rather than on the false comparison.

| # | Filename | Paper | Decision statement |
|---|---|---|---|
| **0038** | `0038-termo-guesses-are-judged-by-a-stateless-server-route.md` | A | **Termo guesses are judged by a stateless server route; the answer never ships to an open board.** A guess is judged by `POST /termo/guess`, which holds nothing between requests — the client posts the whole list every time and the server re-judges all of it against the stored answer, so a replay is free and there is no guess table and no migration for guess state. The response carries the canonical accented `answer` **if and only if** `status !== "playing"`, enforced by a `.refine` rather than a comment. The completion request carries `guesses` and nothing else new; the server decides `won` vs `lost` by re-running `isValidGuess` → `evaluateGuess` → `deriveBoardStatus`, with the "no row follows a win" case checked **explicitly before** the call because `deriveBoardStatus` throws there and an uncaught `RangeError` is a 500. `storedSolution` is **narrowed** to `Exclude<CompletionRequest["game"], "termo">`, never widened, so `outcome: "won"` at `:247` becomes a computed value. `completions` gains a **write-only** `guesses integer` column in **this** ticket, because write-once rows make a later backfill impossible; `CompletionRecord`, `getCompletion` and `completionResponseSchema` are untouched, because widening the record would make `completionResponseSchema.parse` throw on every completion in the app. `GET /daily/termo` ships and `apps/web` does not consume it. `ACCEPTED_DAYS_BACK` is hoisted to one module so a player mid-game at the rollover can finish. **None of this is a confidentiality argument** — ADR-0027:125-131 forecloses it; the route is an answer oracle at a cost of **ONE** authenticated request (six arbitrary dictionary words make a terminal board, `status.ts:39`), it reaches **published days only** through `wallPredicate`, and it is strictly more expensive than the `solveBinairo(givens)` local solve ADR-0027 decision 1 already ships to every browser at 0.04–0.16 ms |
| **0039** | `0039-termo-cannot-be-played-offline.md` | A | **Termo cannot be played offline; the degraded behaviour, stated.** What still works offline is narrower and real — the loaded board renders, typing works, and "não está na lista" is instant because `isValidGuess` runs on the client over the same byte-pinned list the server uses. What does not is judging, and therefore finishing. **ADR-0028 decision 2's *mechanism* survives intact and only its *rationale* is unreachable**: the in-place swap still ships and still works, because the closing response has already arrived when the board closes — so **nothing in ADR-0028's Decision is amended.** A failed guess is **held**, never queued and never lost: offline/5xx/429/401-after-remint hold the turn; 400/403/415/422 clear it without consuming it; 404 renders the unavailable view. **429 is never terminal.** `sync.ts` is not the vehicle, and that is a decision with five grounded reasons rather than an omission. The record persists only judged turns; the un-judged in-flight guess is deliberately not persisted. A day left mid-play shows the **existing** "ainda não concluído" state and stays pending everywhere — there is no "abandoned" state, which is ADR-0031's monotone direction by construction. The timer keeps running through a stall |
| **0040** | `0040-the-termo-daily-stores-the-drawn-answer.md` | B | **The Termo daily stores the drawn answer, and no answer is ever drawn twice.** `content` is `{canonical, normalized}` — the drawn `TermoAnswer`, field for field. **The word is stored; its index never is**: the harness pins that the array matches *today's* CSV, not that the CSV never changes, and with an index in an immutable row one regeneration silently rewrites up to 30 days of unpublished answers and retroactively changes what every archived row meant, **with every gate green**. No `seed` in `content`; the column receives the accepted draw and reproduces nothing. **"Used" means every row that has ever existed** — no date filter, no `killed_at` filter — because collisions first exceed ½ at **24 days** under uniform picks over 400. The pool is run-scoped and shrinks on every write. The draw is **uniform by construction** (rejection sampling, not modulo). **Exhaustion fails closed; there is no recycling branch**, and the ~3-day depth-alert runway is stated as inadequate rather than papered over, which is why a 30-remaining log line ships and a real alert is filed. No seed-retry budget, and the absence is part of the decision |
| **0041** | `0041-accents-colour-shapes-never-words.md` | C *(drafted 0042)* | **Accents colour shapes, never words.** ***As MERGED in `79bad18`, which is broader than this row's draft — read the ADR, not this cell.*** **Amends `DESIGN.md:20-22`, `DESIGN.md:50-51` and `PRODUCT.md:40`, edited in that same commit.** An accent may colour a fill, a washi tape, a hard shadow, a rule, a stamp ring, a card border, a graph bar or a board cell. The **shared** property `color: var(--accent)` may never colour a word, at any size, on any paper — it has no fixed value, so there is no ratio to measure. **The exception is a LITERAL accent token whose measured ratio against the paper actually behind it clears 4.5:1**, and **thirteen such declarations ship today**, each enumerated with its figure in consequence (h); `var(--accent-termo)` is inside the exception's shape and outside its condition on every paper, so Termo may never open one. `--ink-on-accent`'s range becomes *"an ink that is legible on this accent"*, not *"a paper token"*: `accentVars("termo")` returns `var(--ink)` at **5.4968:1**, and the other three do not move because 7.5113 / 4.5063 / 5.3066 already clear AA. **Eleven `--accent`-as-text sites convert in one commit**, six rows of which #68's table does not list and one of which was a **live AA failure on `main`**. A hover keeps its per-game identity by moving the accent to a 2px underline — an accepted exception at 2.7311:1, with `.secondaryLink` growing its rule 2px → 3px so the carrier is real geometry. **An accent border that outlines an already-legible label is decoration; one that is the only thing saying which state a control is in is not** — the stamp ring and the done-chip ring keep the accent, with their 2.8501:1 recorded. **No token value moves.** The documented 2.736:1 is corrected to **2.8501:1 in living code only**; a handoff, a plan and an issue body are point-in-time documents. **Decision 8**: a focus indicator is `--ink` wherever one shared sheet serves four games — `.hint:focus-visible` was `var(--accent)` at 2.7311:1 for mustard and is now 15.0124:1 for all four; the per-game rings stay, measured. **Decision 9**: the hover language forks by what the sheet can render, and `app/globals.css`'s and `daily-unavailable.module.css`'s literal-token colour swaps stay |
| **0042** | `0042-the-termo-board-is-read-only-output.md` | C *(drafted 0043)* | **The Termo board is read-only output; the keyboard is the interactive surface.** The tile board is a labelled `role="group"`, not `role="grid"` — the argument is *stronger* than Sudoku's, because a grid promises navigation over cells and these cells are not navigable at all. Each row is its own labelled group whose **whole judged sentence is composed in `messages.ts`**, and the tiles inside are `aria-hidden`, because five one-letter spans concatenate to `"CAFES"` with no states. Rows are **real flex boxes, never `display: contents`**. The on-screen keyboard is ADR-0030's composite widget **narrowed**: one tab stop, roving tabindex, no selection and therefore no layout effect. **Keys are commands, not modes: no `aria-pressed`.** The physical listener is **`window`-scoped**, diverging from ADR-0030 decision 3 for a structural reason, and it accepts a key when `normalizeWord(event.key)` matches `/^[a-z]$/` so an ABNT2 player typing `á` or `ç` is not blocked. **The SIX tile states are encoded in TYPE and mustard does exactly one job: it fills the `correct` tile** — the sixth is `held`, ADR-0039 consequence (g)'s, and `absent`'s strike is drawn in `--ink` rather than in the glyph's own `--ink-2`, which would be 1.0000:1 — every distinction is carried by a mark clearing 3:1 in neutral ink, and the design survives greyscale. **There is no Ç key**: it would write the same letter as C and could never carry its own state. Geometry with arithmetic; sub-44px keys under the essential-presentation exception; **nothing is a `@keyframes` animation** |
| **0043** | `0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md` | C *(drafted 0046)* | **The conclusion has a fourth state, and it is a loss.** `data-conclusion-state="lost"` is a fourth branch gated by **one** optional plain-data prop that serves **both** Termo outcomes, **checked before the stamp branch** so it never depends on `ConclusionResult`, on `concluded`, or on an elapsed time. Termo passes it on a win too, because neither of the shipped stamp's remaining slots is honest here: there is no hint to have gone without, and the elapsed time is dominated by the per-guess round trip. The loss stamp is the win's stepped down three ways at once — 1.5px ring, `--ink-2`, two slots — and **no `stamp-settle` animation**: **the loss equivalent of the celebration is the celebration's absence**, and stating that is what stops the next contributor from inventing one. **No time-as-achievement framing on a loss.** The canonical accented spelling renders on **both** outcomes, unanimated, and **reaches the client on the guess response at the moment the board closes** — never on the completion response (the channel ADR-0033 already rejected) and never from the server segment (a bookmarkable page that renders for players who have not finished). `ConclusionCopy` is **not** widened. A played-but-not-completed game reads `jogado` and the chaining CTA skips it. **And the conclusion gains a visually hidden `role="status"` carrying the already-composed `ConclusionOutcome.aria`** — that is what makes ADR-0042 decision 10's *"the conclusion owns the terminal sentence"* true rather than aspirational: the shipped `conclusion-view.tsx` has **no live region and no focus management at all**, so on the in-place swap focus falls to `<body>` and a blind player hears nothing at the payoff moment. Games passing no `outcome` render no region; focus still never moves |
| **0044** | `0044-a-lost-termo-is-played-not-pending.md` | D | **A lost Termo is *played*, not pending: the record carries its outcome and day state carries three verbs.** The record's termo member holds **judged guess rows and nothing in flight**; tiles are **stored, not re-derived**, because mid-play there is no answer in scope; guesses are normalized because that is the only form available. `answer` lives in the record, written only on the closing write. `outcome` is **stored, not derived**, on **blast radius**: `day-state.ts` is on every route's client graph and must never import a game engine. `DayEntry.concluded: boolean` becomes `DayEntry.status: "pending" | "completed" | "played"` and `elapsedMs` is set **iff** completed — **an enum, not a second flag**, because a flag fails *safe* where this repo consistently chooses to fail *closed*. `doneCount` becomes `completedCount`; `nextPendingDaily` chains on `"pending"` only. **Monotone safety is preserved and the check is recorded rather than asserted.** The completion body carries the guess **words** and no verdict. **A six-guess loss is a 200 with `outcome: "lost"`, never a 422** — collapsing the two would settle a legitimately played Termo as rejected and deny #29 its fail row. The guess flow does not ride `sync.ts` |
| **0045** | `0045-the-termo-screen-ships-no-hint-and-no-clock.md` | D | **The Termo screen ships no hint and no clock; its bundle ships the validation dictionary and not the answers.** The hint argument is **neither** of the foreclosed ones: **there is nothing to hint.** A grid hint reveals one cell of a solution the player is already writing into — 1/64 of a Binairo, 1/225 of a large Nonogram. Termo's board is *output*, so the only things a hint could reveal are a letter at a position — **one of five tiles, 20 %** — or a candidate from the answer pool, which decision 5 removes. Termo's state carries **no `HintState` at all**; `hintsUsed` is the literal `0` and its `.max(1)` wire bound is unchanged because one free hint is a **product** rule. The conclusion makes **no hint claim**. **The timer runs and is recorded; it is not rendered** — it must run (`PlayCore` requires it, the swap gates on it, and a faked `0` would put a false number in a write-once row) and it must not be shown (dominated by latency, and #29's Termo statistic is the guess distribution). **`TERMO_ANSWERS` must not reach the client**, and the fix is **two** `/*#__PURE__*/` annotations — measured: the engine alone costs +1.5 KB and pulls no list, `isValidGuess` costs +40.7 KB **and ships the pool**, and both annotations bring it to +37.9 KB with the pool gone. **The reason is cost and strip-table integrity and explicitly not confidentiality.** The annotations ship with **two gates**, because a comment is not a mechanism. `/termo` is **not** added to the 40 KB budget and the shared constant is **not** raised |

### 23.1 Decisions explicitly ruled NOT ADR-sized, each with its reason

Silence would read as an oversight, so each is stated:

- **The routes and i18n wiring.** ADR-0028 already decided it: *"Every future game screen is a copy of this shape, not a new decision: #23/#25/#27 add a slug, a `routes` entry, two `force-dynamic` server segments and a conclusion view."* Recording it again would be a third copy.
- **What crosses the RSC boundary.** ADR-0004, ADR-0024 and ADR-0034 decision 3 already decide it; #27 owes **tests**, not a decision.
- **The `{game, date}` projection.** Already decided by ADR-0024's strip table and re-affirmed by ADR-0033 consequence (e). #27 implements it, inside ADR-0040.
- **Termo first in the cron.** Already recorded in `cron.ts:38-44`; #27 honours it and pastes the measurement.
- **No fast-check in `apps/api`.** ADR-0017 + ADR-0023 already decide it. §3 states it.
- **The seeding sequence and the migration apply.** Operational procedure — a plan section (§21.4), not an ADR. Plan 020 put the same thing in its §21.4.
- **`ACCEPTED_DAYS_BACK`'s hoist.** A refactor inside the route layer that ADR-0026 decision 6 already permits; recorded in ADR-0038 decision 8 rather than in its own document.

---

## 24. Risks and landmines

### 24.1 Handoff 021 §6's numbered landmines — which bind, which do not

| # | Landmine | Binds #27? |
|---|---|---|
| **1** | jsdom has no layout and no pointer capture; layout rules are asserted by reading stylesheet text through `apps/web/test/css-source.ts`, the only mechanism in the repo that can assert a layout rule at all | **YES — acutely.** Every number in §12.1 is stylesheet text and nothing more (§19.8) |
| **2** | `impeccable detect` exits 0 on an unreachable URL **and passes green on the wrong screen** when the URL is reachable but empty; an unseeded route renders `DailyUnavailable` at HTTP **200** | **YES.** §21.4(b). *A 200 is not evidence; it is the failure mode* |
| **3** | `CRON_SECRET` is Production-only; seed a preview by running the branch's own top-up locally, and **verify** the "nothing deployed reads it yet" clause rather than assuming it | **YES.** §21.4(b) carries the four-piece proof |
| **4** | Minification defeats identifier greps; grep for **string literals** and include a **positive control** in the same test | **YES.** §13.4's `zurro`/`abaco` are the positive controls |
| **5** | A comment or ADR claiming a guarantee the code lacks was caught three times in #18 and again in #25. Reviewers check these first | **YES.** §20 is the whole register |
| **6** | CI runners are ~3–4× slower than local; vitest's default per-test timeout is 5 000 ms. Put the arithmetic in a comment | **YES, and the argument below replaces this row's original one, which reasoned from the wrong quantity.** See the block under this table |
| **7** | `packages/db` migrations are applied to Neon **by hand** via `DATABASE_URL_UNPOOLED`; nothing in CI or Vercel runs them. *"If #27's guess state needs one, that is a plan-level decision, not a step-5 discovery"* | **YES, and it is the sharpest one in the ticket.** #27 owes one, and it is **not** for guess state — §6.3, §9.1, §21.4(a). Three additions this plan makes to the landmine as inherited: the apply is an obligation on **commit B5**, not a step-8 item, because a pre-migration deploy 500s `POST /completions` for **all four games**; a **rollback** exists and is written down; and **`drizzle-kit migrate` (`packages/db/package.json:16`'s `db:migrate`) must never be pointed at Neon** — hand-applied migrations write no bookkeeping row, so what drizzle believes is applied cannot be assumed. All three are in §21.4(a) |
| **8** | `apps/web/next-env.d.ts` and `apps/api/next-env.d.ts` are tracked; if Next regenerates them modified, restore them | **YES**, and see N36 |
| **9** | `.returning()` must be bare on the union `Db` type | **No.** #27 adds no `.returning()` |
| **10** | CSS Modules compile in `pure` mode and **hash per file**; a shared rule cannot be overridden by a same-named per-game rule | **YES — twice.** It is why §16 must convert the shared sheet, and why Termo's module needs its own `.placeholder` and its own reduced-motion block |
| **11** | Two structural traps: `<h1>` first element child in **every** view, and no keyframe name matching `/bounce\|elastic\|wobble\|jiggle\|spring/i` | **YES.** Four views (T-WEB-S93); and Termo ships no `@keyframes` at all, which is stronger than avoiding the names |
| **12** | `turbo` runs in `envMode: strict`; anything new goes in `tasks.build.env` | **No.** #27 adds no environment variable |
| **13** | A missing `docs/README.md` row has been a blocking review finding **six times** | **YES.** Commit 1, §21.1 |
| **(a)** | `daily_puzzles` rows are immutable and **killed rows count as covered**, so seeding before the content schema is frozen means a later change 500s the route and only a hard `DELETE` recovers. **Seed once, after the review loop closes** | **YES.** §21.4(b) |
| **(b)** | `low-contrast` and `cream-palette` are wildcard-ignored; **those rules pass green regardless of what you ship — they are not evidence.** Compute and paste real figures | **YES — the single most important one for AC 5.** §12.2, §16.2, §21.3 |
| **(c)** | Accents colour shapes, not words (#68, decided 2026-08-02). `--accent-termo` is the worst of the four and no paper rescues it. **Design Termo's screen under this rule from the start** | **YES.** §12.2 and §16, and it is why the board encodes states in type |
| **(d)** | A review loop will not converge if a scheduled-but-absent item is reviewable. **Tell step-6 reviewers what is known-deferred and why.** Judge convergence on blocking/high | **YES.** §1.1 is that list, and it goes in the reviewer brief and the PR |

**Landmine 6 in full — the quantity, and then the measurement that settles it.**

**The original row argued from `topUpTermoBuffer`'s CPU (0.0573 ms absolute worst) and concluded "no timeout constant is owed". The quantity is wrong.** T-API-S29, S31 and S32 do not spend their wall clock in the top-up; they spend it in **PGlite round trips**. T-API-S32 pre-seeds **395** used answers, and the plan specified that row by row. And the row's claim about the file's precedent was backwards: `apps/api/test/publishing-service.test.ts` carries `30_000` at **`:123, :184, :207, :236, :253`**, with the reason written at `:117-119` — *"PGlite boot measures ~1.2 s locally and CI runners are ~3-4x slower; 1.2 s × 4 + margin puts the ceiling well above vitest's default."*

**Measured, on the real PGlite 0.5.4 + drizzle-orm 0.45.2, against the repo's own three migrations, three reps per scenario across two independent runs** (Node v24.18.1):

| Scenario | run 1 median | run 2 median |
|---|---|---|
| PGlite boot, cold process (5 processes: 1153.81, 922.96, 1016.65, 933.02, 922.71 ms) | **933.02 ms** | — |
| 395 rows, one `.values({…})` per row — **what T-API-S32 as drafted does** | **73.93 ms** | **94.46 ms** |
| 395 rows, one `.values([…395])` multi-row insert | **6.89 ms** | **6.90 ms** |
| 30 rows, one at a time — T-API-S29's shape | **5.55 ms** | **5.86 ms** |
| 395 rows one at a time through the real `insertDailyPuzzle` shape (sql-derived `published_at`, `ON CONFLICT DO NOTHING`, `.returning()`) | **115.76 ms** | **112.14 ms** |

**Conclusion — the reviewer was right about the quantity and wrong about the consequence, and both halves go in the PR's dispositions table.** At landmine 6's 4× CI factor, the worst-measured row-by-row seed is **94.46 × 4 = 377.84 ms**, or **7.6 % of vitest's 5 000 ms default**; through the real helper it is **115.76 × 4 = 463.02 ms**, 9.3 %. **A raised per-`it` timeout is not owed and must not be copied in "for safety"** — the file's existing `30_000`s are on `beforeAll`, where they belong: **933.02 × 4 = 3 732 ms** of boot against a 5 000 ms default is the real flake risk, and `:123` already covers it.

**Two things #27 does anyway, neither of them a timeout fix:**

1. **T-API-S32 seeds with ONE multi-row insert** — `db.insert(dailyPuzzles).values([...395])`. Verified against drizzle 0.45.2: it emits a single statement with **395 value tuples** and **1 975 bind parameters** (395 rows × 5 supplied columns; `killed_at` and `created_at` are emitted as the literal `default` and cost nothing), against Postgres's 65 535 ceiling — **headroom 63 560**, and this table would need 13 107 rows to hit it. It is a **13× speed-up and a shorter test body**, taken on readability grounds. **The PR must not claim it prevents a timeout.**
2. **The arithmetic above goes in a comment beside the seed**, per landmine 6's actual instruction — including the sentence that the budget is not tight, so a later reader does not add a `30_000` on top.

### 24.2 What #25's review loop teaches, applied

Plan 020 §27's ten most-likely-to-recur findings, each with what it looks like here and the pre-emption:

| Class | For Termo | Pre-emption |
|---|---|---|
| An ADR claiming an amendment no commit performs | ADR-0041 amends `DESIGN.md` and `PRODUCT.md`; **ADR-0045 amends the founding handoff's "Dicas: 1 grátis por puzzle" and `CONTEXT.md:19`** | ADR-0041's two edits land **in commit A1**, with the ADR. **ADR-0045's amendment-table row in the founding handoff and its `CONTEXT.md` Hint-row qualification land in commit B2**, with the ADR (§21.2, §21.6 item 1) |
| An ADR asserting an unverified measurement as fact | ADR-0039's failure table, ADR-0045's bundle figures | The bundle figures **were measured** (§13.4); the failure table is **behaviour this ticket builds**, so it is driven by T-WEB-S83 rather than asserted |
| A vocabulary ruling that never reaches `CONTEXT.md` | Termo's gap is **larger** than #25's | Nine rows in **commit B1** (§18.1) |
| "N shipped tests break" asserted rather than driven | `playRecordSchema`, `DayEntry` and `playRoutes` all shift real counts | §15.3 names the **files and assertions by path and line**; the **count** is produced by running the suite (§26 item 10) |
| A real WCAG AA regression CI passes green on | mustard on four surfaces, on three shipped screens | §16, **landed and merged as its own PR (PR A, §21.0) before `feat/27-…` is rebased**, with detect re-run on all seven existing routes at both viewports |
| A stylesheet surface the tests assert but no section declares | Termo has **ten** new visual states (**six** tiles + caret, four keys) plus the loss chrome | §12.2, §12.3 and §12.6 declare every one, with contrast and a reduced-motion counterpart |
| Arithmetic in the wrong unit or with a dropped factor | the bundle delta; the top-up cost | §13.4 is **minified bundle** bytes from Next's own manifest, never source bytes; §10.2's cost carries its harness |
| A test that proves less than it claims | `bodyOf` is first-match and throws; every grep needs a positive control | §19.6's T-WEB-S91 slices the two `@media` blocks; §13.4's greps carry two positive controls |
| Commit sequencing that lands red or references what does not exist | **B3, B4, B5 and B6 each arm a tripwire** | §6.9 assigns every tripwire to the commit that arms it, in the §21.2 ids; E0 files the follow-ups **before** the PR body |
| TSDoc #27 makes false | **twenty-four** blocks | §20 is the register, each assigned to a commit |

### 24.3 New landmines this plan adds

| # | Landmine | Evidence |
|---|---|---|
| **N36** | **`apps/web/next-env.d.ts:3` hard-imports the gitignored `.next/types/routes.d.ts`.** With `.next` absent, typed routes give no signal; with `.next` **stale**, `AppRoutes` is a frozen union without `"/termo"`, so commit **B8** fails pre-commit for a reason unrelated to its diff — **and CI cannot reproduce it.** `rm -rf apps/web/.next` is the **first line** of every gate pass | plan 020 N24/TR-13, measured |
| **N37** | **`side-tab`'s inset-stripe scanner fires on `inset 0 -6px 0 <chromatic>`** (`checks.mjs:963-1018`, chroma ≥ 30; mustard's is 162). The obvious mustard foot-band for the `present` tile is a **live finding**, and `--ink`'s chroma of 8 is why the neutral answer is also the compliant one | read from the rule source, §12.2 |
| **N38** | **`deriveBoardStatus` throws a `RangeError` on a row following a winning row** and that case is **reachable from a malicious request body**. An uncaught `RangeError` in a route handler is a **500**. The explicit pre-check in front of the call is not a nicety | `status.ts:31-36`, §11.1 step 10 |
| **N39** | **`buildBody` returning `undefined` PERMANENTLY settles a record as rejected** (`sync.ts:199-206`). `termoBody` may only return `undefined` on a state a closed record cannot reach — the schema's "≥1 guess when concluded" is what makes the empty-list path unreachable | `sync.ts:288-290`, §14.2 |
| **N40** | **CSS-module locals render verbatim in the scanned markup** (`_<localName>_<hash>`, measured), so `FORBIDDEN_DAILY_KEYS` is a **substring ban on class names**. `answer` is already banned and `.answerRow` was the natural name for the reveal. **No name on the Termo tree may contain `solution`, `seed`, `reveal`, `answer`, `clueCount`, `motifId`, `name`, `mirrored`, `canonical` or `normalized`** | measured under this repo's vitest config; §6.7 |
| **N41** | **`sameToTheReader` compares five chrome fields and Termo's guess count moves independently of all five.** Nonogram escaped only through the `grid`/`concluded` lockstep. Without the sixth term the board is handed a **stale cached snapshot mid-game** | `use-record-snapshot.ts:104-127`, §14.3 |
| **N42** | **`status` must not leave `"playing"` before the closing judge response is absorbed**, or `buildRecord` writes a record the `superRefine` refuses and **the completion is lost** | `use-play-lifecycle.ts:231-246`, §14.4, T-WEB-S82 |
| **N43** | **A `killed_at` on a seeded row is NOT a recovery** — `listBufferedDates` counts killed rows as covered, so the cron never refills those dates. Only a hard `DELETE` of unpublished rows works | `buffer.ts:30-45`, §21.4(b) |
| **N44** | **Two concurrent `topUpTermoBuffer` runs can draw the same answer** (both read the used-set before either writes). The realistic instance is a manual seeding run racing the 06:00 UTC cron. **Do not seed in that window.** The sanctioned fix if it ever bites is the partial unique index ADR-0040 rejected, with its own ticket and migration | §21.4(b) |
| **N45 — CLOSED at step 4, not open** | **`_tileStatePin`, `_maxGuessesPin` and `_wordLengthPin` would be three `pnpm lint` ERRORS, and the `_` prefix rescues nothing.** No longer "unknown to the plan" — measured. The pins **move**; §14.1 keeps the restated literals and cites the tests instead. Full argument and the decision below this table | reproduced; §26 item 7 is closed |
| **N46** | **Sanitizing `String(thrown)` does NOT sanitize the error OBJECT.** §10.3.1 strips the `\nparams:` tail from the *message*, but `query`, `params` and `cause` are **own enumerable properties** of drizzle's `DrizzleQueryError` — verified — so any future `JSON.stringify(thrown)`, structured-log call, or error-reporting SDK re-opens the channel with the answer word in it. Nothing does today. **A "log the whole error for debuggability" change is the trap**, and it will look like an improvement | measured against drizzle-orm 0.45.2; §10.3.1 |

**N45 in full — the three type pins, decided at plan time rather than left as a risk.**

**The facts, each verified against the tree at `0c51f66`:**

- `eslint.config.mjs:105` is `extends: [...tseslint.configs.recommendedTypeChecked]` for `**/*.{ts,tsx,mts,cts}` — which turns on `@typescript-eslint/no-unused-vars` **as an error**.
- **There is no `varsIgnorePattern` anywhere in `eslint.config.mjs`** — `grep -n "varsIgnorePattern\|argsIgnorePattern\|no-unused-vars"` over the file returns nothing. The rule runs at its default, and its default `varsIgnorePattern` is **empty**: the `_` prefix is a typescript-eslint *convention that must be configured*, not a built-in exemption.
- The root script is `"lint": "eslint --max-warnings 0 ."` (`package.json:12`) — and these are errors anyway, so `--max-warnings` is not even what fails.
- **TypeScript is not the gate here.** `noUnusedLocals` is **not set** in `tsconfig.base.json` (its whole `compilerOptions` block is 12 keys: `strict`, `target`, `module`, `moduleResolution`, `verbatimModuleSyntax`, `isolatedModules`, `forceConsistentCasingInFileNames`, `noUncheckedIndexedAccess`, `esModuleInterop`, `skipLibCheck`, `noEmit`). And TypeScript's own `_`-prefix exemption applies to **parameters**, never to module-scope `const`s.

**Reproduced, not reasoned** — a two-line probe file under `apps/web/src/play/`, run through the repo's own `npx eslint`:

```
$ npx eslint apps/web/src/play/__lintprobe.ts
  1:7  error  '_unusedPin' is assigned a value but never used  @typescript-eslint/no-unused-vars
✖ 1 problem (1 error, 0 warnings)

$ npx eslint apps/web/src/play/__lintprobe2.ts        # `import type { TileState } …`, unused
  1:15  error  'TileState' is defined but never used  @typescript-eslint/no-unused-vars
```

**So it is worse than three errors: it is four.** Once the pins go, the `import type { MAX_GUESSES, TileState, WORD_LENGTH }` line they exist to consume is *also* unused, and reds the same rule. A third probe confirmed the shape is fine once *used*: a `const pin: [true, true] = [true, true]` that something reads lints clean.

**§26 item 7's stated fallback — "move them into a `packages/games`-adjacent type test" — cannot work**, and that is why this is decided here rather than deferred: the thing being pinned is a **schema in `apps/web`**, which `packages/games` cannot see.

**The decision.** The three pins and the type-only import **leave `apps/web/src/play/play-record.ts` entirely** and become assertions in **`apps/web/test/termo-record.test.ts`** — the file §19.6 already creates for T-WEB-S74/S75, in a tree where a **value** import of `@miolos/games/termo` is free (the bundle rule binds `src/`, not `test/`). Three parts:

1. **The bidirectional `TileState` pin becomes a *used* type-level assertion inside T-WEB-S74**, so `no-unused-vars` cannot fire:
   ```ts
   type RecordTile =
     z.infer<typeof termoPlayRecordSchema>["guesses"][number]["tiles"][number];
   const pin: [
     TileState extends RecordTile ? true : never,
     RecordTile extends TileState ? true : never,
   ] = [true, true];
   expect(pin).toEqual([true, true]);   // the RUNTIME use that satisfies ESLint
   ```
   The type is reached **through the exported record schema**, so `play-record.ts` exports nothing new. A member added to, removed from or renamed in the engine's union still reds — at `pnpm typecheck`, which is the gate that matters.
2. **`_maxGuessesPin` / `_wordLengthPin` become behavioural**, driven by the engine's real constants rather than by a `typeof` on a type-only import: with `MAX_GUESSES` and `WORD_LENGTH` value-imported, a `MAX_GUESSES`-long guess list parses and a `MAX_GUESSES + 1`-long one fails; a `WORD_LENGTH`-letter guess parses and a `WORD_LENGTH ± 1`-letter one fails. That is T-WEB-S75's `.max(6)`/regex half, driven by the engine instead of by a literal — **a stronger pin than the assignment was**, because it also proves the schema *enforces* the bound rather than merely declaring a matching type.
3. **`play-record.ts` keeps its restated literals and its comment**, minus the type-only import and the three pins, and the comment cites **T-WEB-S74/S75 by id** as the mechanism. §14.1's snippet is edited accordingly.

**This also closes §26 item 6** (*"the `import type { MAX_GUESSES }` + `typeof MAX_GUESSES` pin has not been typechecked"*) — there is no such pin any more.

### 24.4 What will force a step-3 rejection or a step-6 loop

#18 took **three** corrective rounds; #23 was **rejected at step 3 by all five lenses with 48 findings, 9 blocking**; #25's step-6 loop ran **four rounds (41 → 31 → 24 → 29)** without an empty pass. **Assume 40–50 step-3 findings and three step-6 rounds; plan the calendar around that, not around one clean pass.** Judge convergence on **blocking/high**: of #25's 125 findings across four rounds, **108 were medium or low**, and fresh adversarial reviewers will always produce more.

| # | Risk | Why it is likely | Pre-emption |
|---|---|---|---|
| R1 | **"AC 5 has no obtainable evidence."** | The identical finding fired on #25 and on #23 | §21.4(b) carries the seeding command, the 401 mechanism, and the pre-merge proof |
| R2 | **A reviewer raises the missing `impeccable.yml` commit as blocking.** | It happened repeatedly in #25 and is the named reason that loop did not converge | §1.1 item 1, in the reviewer brief **and** the PR |
| R3 | **A reviewer cites ADR-0029 at the separate guess client.** | "Exactly one sync module" is a memorable rule and this looks like a second one | §11.4's five reasons, and the sentence *"duplicating a boolean is not the hazard ADR-0029 names"*, in the PR |
| R4 | **A fix introduces a regression.** The candidates are `persistDeps`, the `sameToTheReader` widening and the two clobber guards | all are guards whose purpose is invisible when working | any step-7 fix touching `apps/web/src/play/**` re-runs the **full** suite `--force` and pastes it — never a single file |
| R5 | **The `em 4/6` deviation is filed as a bug.** | It is a visible mismatch with a committed design reference | §6.2 states it **as a deviation**, with three reasons and a filed follow-up whose link is real at review time |
| R6 | **A reviewer proposes shipping the answer to the client** to remove the round trip. | It is genuinely the cheaper design and ADR-0004 permits it | ADR-0038's Rejected section carries it as **the strongest rejected option**, rejected on the ticket and the strip table rather than on ADR-0004, with a **Parked** section naming the trigger (*measured latency complaints on Brazilian mobile networks*) and stating it is Fernando's call, not an agent's |
| R7 | **A reviewer proposes an HMAC guess chain or a commitment scheme.** | It looks like the cheap middle path | ADR-0038's Rejected list enumerates both with the reason each fails (rewind-and-branch; a 400-element public candidate set) |
| R8 | **Scope explosion via #68.** | Eleven declarations across three shared stylesheets on three shipped screens | **Its own PR (PR A, §21.0)**, merged first, with detect re-run on all seven existing routes and its own body calling it out as the one thing Fernando must look at. PR B's diff does not contain it at all, which is a stronger answer than "it is one commit" |
| R9 | **A "symmetry" retry budget is added to `topUpTermoBuffer`.** | Three siblings have one | Its TSDoc says the absence is load-bearing, **in those words**, and ADR-0040 decision 8 repeats it |
| R10 | **A reviewer asks where the property tests are.** | CLAUDE.md's gate names `packages/games` | §3 and ADR-0040 consequence (h): #27 adds no generator, ADR-0015's harness already discharges the bar, and adding fast-check to `apps/api` would breach ADR-0017 **to look compliant** |

---

## 25. Exit criteria — each AC mapped to machine-checkable evidence

Nothing here is satisfiable by an agent's assertion. Every line is a command whose output goes in the PR.

### AC 1 — "The day's answer comes from the curated list only after the harness gate; the answer never reaches the client before completion beyond normal gameplay feedback"

| Evidence | Gate |
|---|---|
| The **ADR-0015 harness** — `packages/games/test/termo/word-list.test.ts`, ten `it`s over the real `content/termo` artifacts including the byte-identity staleness gate — green in the same run that publishes. `#27 cites it; it is the gate AC 1 names` | `pnpm test --force` |
| T-CORE-S17…S20 — all 400 answers parse and round-trip, a drifted object fails, the projection is exactly `{game,date}`, the leak scan is non-vacuous | `pnpm test --force` |
| T-DB-S10, S12 — the used-set sees killed **and** unpublished **and** past rows; the wall proved for the fourth game | `pnpm test --force` |
| T-API-S29…S32 — 30 distinct answers from a cold run, idempotence, cross-run no-repeat, exhaustion failing closed | `pnpm test --force` |
| T-API-S35, T-WEB-S95 — the public route's two-key body and its leak scan; `/termo`'s RSC props and markup carrying no forbidden key or substring | `pnpm test --force` |
| **§13.4's bundle greps with their two positive controls** — `zurro`/`abaco` non-zero, `então`/`mamãe`/`época` **zero** | `pnpm build` + `node scripts/route-client-js.mjs` |
| **E2b** — the branch-local top-up ⇒ `{depth: 7, failures: []}`, **before any scan**. **`generated` is NOT asserted** — the buffer loses its head at each São Paulo midnight (`bufferDepth` counts `date >= SP-today`, `packages/db/src/buffer.ts:79-91`), so `generated ∈ [0, days elapsed since the last seed]` | pasted |
| **E4/E5/E6/E7** — production cron ⇒ `termo: {depth: 7, failures: [], error: null}` with `games` keyed termo first (**again, not `generated`**); four depths at 7 with `shallow: false`; `/daily/termo`'s keys **exactly** `["date","game"]` **and its `.date` equal to São Paulo today** — the only line that makes the wall clause true of production | pasted |
| A fresh measurement of a cold termo week with the statement that `vercel.json`'s `maxDuration: 60` needs no change — **0.0193 ms**, and **0.0573 ms** absolute worst | pasted |

### AC 2 — "Accent-free input matches accent-insensitively; canonical accented form revealed at the end"

| Evidence | Gate |
|---|---|
| T-WEB-S89 — **`á` types `a` and `ç` types `c`** through `normalizeWord(event.key)`; the three listener guards; `Backspace` `preventDefault` | `pnpm test --force` |
| T-CORE-S21, T-API-S36 — the response's `.refine` in **both** directions; the winning and losing lists both carrying the canonical accented spelling and the mid-game list carrying **no `answer` key at all** | `pnpm test --force` |
| T-WEB-S77, S82, S99 — the record's `answer`/`concluded` lockstep; the reducer's single-transition ordering; the word resolving **from the record** on `/termo/concluido` and **from live state** in place | `pnpm test --force` |
| **E8** — a real browser: accented input landing as ASCII, and the day's word rendered in its canonical accented spelling on the conclusion after a win | pasted |
| **E9** — the same after a **loss**, which is the case with no client-side fallback | pasted |

### AC 3 — "Rejected guesses show 'não está na lista'; accepted guesses come from the validation dictionary"

| Evidence | Gate |
|---|---|
| T-WEB-S83, S87 — the rejection path rendering `messages.games.termo.play.notInList` verbatim, without consuming a turn, **from BOTH of its two sources**: the local `isValidGuess` rejection **and the 422 `invalid-guess` row §11.4 splits out of the generic-error row**, which returns `{kind:"rejected", reason:"not-in-list"}` and routes to the same string — the case that exists because `apps/web` and `apps/api` deploy independently and ADR-0015 expects the validation list to be regenerated. Plus the announcer and the notice never speaking in the same tick, proved by the reducer walk, and the nonce that makes a second identical rejection audible | `pnpm test --force` |
| T-API-S38 — the **server's** re-check: 422 `invalid-guess` for a non-dictionary word, and **never a 500** | `pnpm test --force` |
| §13.4's markers — `zurro`/`abaco` **present** in the client chunk, proving `isValidGuess` and its dictionary actually ship so the rejection is instant and offline | pasted |
| **E8/E10** — the rendered line, in a real browser, online and offline | pasted |

### AC 4 — "A six-guess loss is recorded as played (fail row), completes nothing, and never counts toward streak or Dia Perfeito — covered at the `apps/api` seam"

**Read this before the table: the AC has two halves, and #27 can only discharge one of them.**

*"…is recorded as played (fail row), completes nothing"* — **#27's, and the table below proves it.**

*"…and never counts toward streak or Dia Perfeito"* — **NOT #27's, because neither exists.** Verified at `0c51f66`:

- **No streak derivation exists.** `apps/web/app/page.tsx:82` is the literal `const streakCount = 0;`. Nothing computes it, from any source.
- **No Dia Perfeito exists.** No component, no message key, no column.
- **No aggregating route exists in `apps/api`.** The complete route list is `buffer-depth`, `completions`, `cron/publish`, `daily/{binairo,nonogram,sudoku}`, `health`, `/`, `session` (`find apps/api/app -name route.ts`). Nothing reads more than one completion.

**So there is no code path #27 could write a test against, and an earlier draft's six test ids were mapped to this clause without any of them touching it.** That is exactly the class of finding CLAUDE.md's evidence rule exists to catch, and the honest statement is:

> **#27 ships the *mechanism* the exclusion will be built on and cannot ship the exclusion.** The mechanism is `completions.outcome`, which is **ADR-0008's named instrument** — a `lost` row is a *fail row of the guess distribution*, never a completion. The proof that streak and Dia Perfeito honour it belongs to **#19 AC 1** and **#29 AC 1**, and E13 posts a comment on **both** issues recording the obligation, with the URLs pasted so it cannot evaporate.

**This paragraph goes into the PR body verbatim.** Claiming AC 4 fully satisfied would be a false green on the one criterion whose failure mode is silent.

| Evidence | What it proves | Gate |
|---|---|---|
| **T-API-S39** — the `apps/api` seam AC 4 names: a six-guess losing list records `outcome: "lost"` with `guesses = 6`; a still-open list is **422 with no row**; the replay of a winning list against a stored `lost` row returns that row with `recorded: false` | **"recorded as played (fail row)"** | `pnpm test --force` |
| T-DB-S11 — the CHECK: a termo row without a count and a grid row with one are **both impossible** | the fail row is well-formed | `pnpm test --force` |
| T-WEB-S79, S80 — `played` carries **no duration**; `completedCount` excludes it; `nextPendingDaily` skips it; the chip reads `jogado` | **"completes nothing"**, at the only surface that exists today | `pnpm test --force` |
| T-WEB-S96, S97 — the fourth conclusion state, checked before the stamp branch; **no `.stampTime` and no hints line** | "completes nothing", rendered | `pnpm test --force` |
| **E9** — the real loss drill end to end, with the `completions` row pasted | both, in production | pasted |
| **E13 item 4** — the comment posted on **#19** and on **#29**, both URLs pasted | **the streak / Dia Perfeito clause — as a transferred obligation, not as a passing test.** #27 has no way to prove it and says so | pasted |

### AC 5 — "Screen designed against the design system, passes `npx impeccable detect`; hub tile live; all four dailies now playable"

| Evidence | Gate |
|---|---|
| T-WEB-S86…S94, **S102, S103** — the a11y shape, the geometry assertions, the **ten** visual states as stylesheet text, the motion gate including the stagger stand-down, the two `<h1>`-first mechanisms across four views, the skeleton at final dimensions, the stylesheet header's seven enumerated deviations, and `.noticeRetry`'s placement and focus order | `pnpm test --force` |
| T-WEB-S73 — the accent conversion, as stylesheet text, with the per-site fallback table | `pnpm test --force` |
| T-WEB-S101 — the hub tile becomes a `<Link>` and the chaining CTA re-points | `pnpm test --force` |
| T-WEB-S100 — both termo paths render with their marker and no function crosses the RSC boundary | `pnpm test --force` |
| **Computed contrast pasted** — §21.3's five groups, **because CI is blind here**: `low-contrast` and `cream-palette` are wildcard-ignored on every scanned host | pasted |
| **E11** — the preflight (200 **AND** the marker grep) for both new paths against a **seeded preview**, then detect over all **nine** URLs at 1440×900 **and** 390×844; plus the `Impeccable` job link for the PR's **final preview deployment** (no run exists for a merge commit) and its wall-clock time | pasted, both viewports |
| The **file-mode** run `pnpm exec impeccable detect apps/web/app apps/web/src` — the loss branch's evidence, since a clean profile always renders `empty` | pasted |
| **E12** — browser observations at 320, 390, 1100 and 1440 px, plus one screen-reader pass | pasted |
| **Standing gates** — `pnpm typecheck --force`, `pnpm lint` (plus a deliberate-violation run), `pnpm test --force`, `pnpm build`, exit codes shown | pasted |

---

## 26. What is UNVERIFIED, stated as such

An unverified claim stated as fact is the exact failure step-6 reviewers hunt. **Nothing in this list may be reported as a green check.** Consolidated and deduplicated from all four decision papers.

**Step-4 note: this list has been folded down.** Step 3 answered several items with real measurements against the installed toolchain, and an UNVERIFIED list that carries answered items trains its readers to skim it. **Items closed at step 4 are struck below with the evidence that closed them and the section that now carries the fact** — they are kept rather than deleted so a reviewer working from the step-3 findings can see each one was addressed rather than dropped.

#### Step-5 preflight probes — run these FIRST, before writing the code that depends on them

**Four, each a two-minute experiment, each with a pre-agreed fallback so a failure is a detour rather than a redesign.** Two of the four are *reproductions of a known failure*: run them to confirm the fix worked, not to discover whether the problem exists.

> **RUN AT STEP 5, BEFORE ANY CODE. All four CONFIRMED; no fallback is taken.** Installed: zod 4.4.3, TypeScript 6.0.3, drizzle-orm 0.45.2, PGlite 0.5.4, node v24.18.1.
>
> - **P-a — confirmed, with one correction absorbed into §14.4.** `tsc --noEmit` exits **0** on every direction the plan needs: the literal probe line, `Inferred extends TileStates`, `deriveKeyboardState(tiles.map(…))`, `deriveBoardStatus(tiles)`, and the parsed rows landing in `TermoPlayState.guesses`. **The reverse direction does not hold** — the tuple infers **mutable** and `TileStates` is `readonly`, so `readonly {guess, tiles: TileStates}[]` → the record's mutable shape is `TS4104`/`TS2322`, *even per row*. `buildRecord` therefore spreads: `state.guesses.map((row) => ({ guess: row.guess, tiles: [...row.tiles] }))` — the idiom `use-nonogram-play.ts:247` already ships. Still no `as`.
> - **P-b — confirmed on all three claims.** With the current layout all three entry points throw (`Cannot access 'calendarDateString' before initialization`, `… 'termoGuessWordSchema' …`, and the barrel). After the move, all four entries exit 0 and the **entire existing `@miolos/core` suite passes unmodified — 9 files, 116 tests**, so §8.0's "no test moves" holds. And vitest genuinely does **not** surface the cycle: the import-phase test *passed* on the broken graph and the failure only appeared at first `.parse()` as `Invalid element at key "date": expected a Zod schema`.
> - **P-c — confirmed byte-for-byte**, and a **binairo** body emits the identical statement, so §21.4(a)'s all-four-games blast radius is real. Passing `guesses: undefined` explicitly still emits `default`; all three candidate column shapes emit identical SQL.
> - **P-d — confirmed.** DDL accepted; the constraint **validated against a pre-existing binairo row written before the `ALTER`**; all ten accept/reject cases matched; the rollback works as written. Bonus: `drizzle-kit generate` emits `0003_termo_guesses.sql` **byte-identical** to the DDL that was validated, and `drizzle-orm/pglite/migrator` applies 0000–0003 cleanly — so §9.1's schema snippet, the generated migration and the validated behaviour are one artefact, not three.

| # | Probe | Command | Pre-agreed fallback |
|---|---|---|---|
| **P-a** | **The zod tuple's inferred type is assignable to the engine's `readonly TileStates`** under the installed zod 4.4.3 and TypeScript 6.0.3. Reasoned, not compiled — **and this repo has been burned twice by zod-version-dependent inference** (`play-record.ts:156-159`, `daily.ts:183-190`) | `const t: TileStates = termoTilesSchema.parse(["correct","absent","absent","absent","absent"]);` then `pnpm typecheck` | `z.array(termoTileStateSchema).length(TERMO_WORD_LENGTH)` plus one narrowing helper in the client adapter — **never an `as`**. The plan says the fallback is weaker |
| **P-b** | **The ESM cycle is gone** (§8.0). Known to throw before the fix — reproduced in all three entry directions (each module, and the barrel) | after the `calendarDateString` move, from `apps/api`: `pnpm exec tsx -e "void import('@miolos/core').then(()=>console.log('OK')).catch(e=>{console.error(e);process.exit(1)})"`. **`tsx`, not bare `node`** — these are TypeScript sources. **And not a vitest test**: vitest's SSR transform hands a circular binding over as `undefined` rather than throwing, so it reports a *pass* on a module graph that would die under real ESM (measured) | none needed; the fix is a pure move. **If it still throws, a second cycle exists and must be found before any more contract code is written** |
| **P-c** | **Drizzle's INSERT column list** (§21.4(a)). Known behaviour — this run confirms the migration is applied and the SQL matches | `console.log(db.insert(completions).values({…six pre-#27 keys…}).returning().toSQL())` against the PGlite fixture, **after** the migration | none — this probe cannot fail in a way a fallback would fix; it either matches §21.4(a)'s pasted SQL or the schema edit is wrong |
| **P-d** | **The CHECK `(game = 'termo') = (guesses is not null) and (…)` is accepted by both Postgres and PGlite.** Boolean-to-boolean equality is standard SQL, but it was not executed | run the `ALTER TABLE … ADD CONSTRAINT` against the PGlite fixture | two separate CHECKs (`guesses is null or game = 'termo'`, `guesses is null or guesses between 1 and 6`) — **weaker**, it permits a termo row with a null count, and would then need a route-level assertion |

**Open — the rest:**

1. **`content ->> 'normalized'` behaves identically on PGlite 0.5.4 and on Neon.** Both are Postgres and `->>` is core jsonb, but neither was executed. Not a preflight probe — it is exercised by T-DB-S10 the moment that test is written. **Fallback:** `db.execute(sql\`select content ->> 'normalized' as answer from daily_puzzles where game = 'termo'\`)`, matching `todaySaoPaulo`'s shape (`buffer.ts:20-27`).
2. *(was the tuple probe — now **P-a** above.)*
3. *(was the CHECK probe — now **P-d** above.)*
4. ~~**Drizzle's `.values()` accepts an omitted optional column and writes NULL.**~~ **CLOSED.** Measured against drizzle-orm 0.45.2: an omitted key is **not** omitted from the statement — it is emitted as the SQL keyword `default` in the VALUES list, `"guesses"` appears in the INSERT column list, and a bare `.returning()` selects it. Nullable, `.notNull().default(…)` and nullable-with-default all emit byte-identical SQL, and neon-http and PGlite agree. **The generated SQL is pasted in §21.4(a)**, and the consequence — a pre-migration deploy 500s `POST /completions` for **all four games** — is why the migration is an obligation on commit B5.
5. **Drizzle 0.45.2 accepts `sql<string | null>` as a `.select({...})` projection over a jsonb column.** The pattern is used elsewhere (`completions.ts:55` has `sql<boolean>` in a projection) but **not with a jsonb operator**. Same fallback as item 1.
6. ~~**The `import type { MAX_GUESSES }` + `typeof MAX_GUESSES` pin has not been typechecked.**~~ **CLOSED — the pin no longer exists.** §24.1's N45 block moves it into `apps/web/test/termo-record.test.ts` as a behavioural assertion driven by the engine's real constants, which is a stronger pin than the assignment was.
7. ~~**The bidirectional `_tileStatePin` assignment, and the repo's ESLint rules for unused `_`-prefixed bindings.**~~ **CLOSED, and the answer was "three lint errors, four with the import".** `eslint.config.mjs:105` extends `recommendedTypeChecked`; there is **no `varsIgnorePattern` anywhere in the file**; the root script is `eslint --max-warnings 0 .`; `noUnusedLocals` is not set, so TypeScript is not the gate and TypeScript's `_` exemption is for parameters anyway. **Reproduced** with `npx eslint` on a probe file: `error '_unusedPin' is assigned a value but never used @typescript-eslint/no-unused-vars`, and the same on an unused `import type`. **The stated fallback ("move them into a `packages/games`-adjacent type test") could not have worked** — the thing pinned is a schema in `apps/web`. Decision and mechanism: §24.1, N45.
8. ~~**The 11px command-label advance, and whether the 2px padding is owed conditionally.**~~ **CLOSED as a CONDITIONAL — the 2px padding is now shipped unconditionally, and one half of the item survives as a browser measurement rather than as an open decision.** The item asked for a `≤360px` band that would drop `.keyCommand`'s inline padding to 2px only if `apagar` overflowed. §12.6 commits it **unconditionally inside the existing `≤768px` chrome block** instead — `.keyCommand { font-size: 11px; padding-inline: 2px; }` — with the reason in the stylesheet: `text-overflow`'s detector needs `delta >= 16` (`checks.mjs:4782`) and **320px is not a scanned viewport**, so CI is structurally blind to a 3px clip and always will be. A conditional band would have made a rule nothing can ever verify. The arithmetic is on the record: 2px takes the command key's content box from `38.6 − 16 − 3` = 19.6px to `38.6 − 4 − 3` = **31.6px**. **What remains is a measurement, not a decision, and it lives in §12.6 with its ladder already written**: `apagar` at 11px Instrument Sans 600 is *estimated* at ≈33.6px (ADR-0036 measured only the **tabular digit**, 6.609375px at 11px; no letter advance has ever been measured in this repo), the real number is owed at step 6 in a real browser at 320px and goes in the PR body, and if it still overflows the single remaining move is `padding-inline: 0` for **35.6px**. **Never below the 11px floor**, which `undersized-ui-text` enforces unconditionally on interactive text, and `cramped-padding` cannot fire either way (its main branch needs `rect.width > 100`; its flush branch needs `!hasDirectText`).
9. **That a `role="group"` row label is announced instead of its `aria-hidden` tiles, and that two `role="status"` regions queue rather than race.** jsdom proves the markup, not the speech. ADR-0037 consequence (d) makes the identical admission for `aria-describedby`. **One VoiceOver or NVDA pass is owed and its result recorded** (E12); ADR-0042 consequence (e) does not claim it has happened.
10. **"N shipped tests break" is derived by reading and grep, not driven.** §15.3 lists the *files and assertions* by path and line; the **count** must be produced by running the suite at step 5. This is exactly the CLI-2/TR-2 finding class from #25.
11. **Every rendered geometry number.** All of §12.1 is computed from the shipped stylesheets and the shared grid, not measured in a browser. Includes: whether `line-through` and `underline` are legible on a single 24px Fraunces glyph at 44px (**pre-agreed response:** `text-decoration-thickness: 3px` on `.tileAbsent` — **never a colour change**, which would reopen ADR-0041); whether the mustard `correct` tile reads as a distinct fill at DPR 1 (**pre-agreed response: none needed** — the state does not rest on it); and whether the ≤768px vertical budget holds on a 390×844 phone with browser chrome (arithmetic gives ≈772px of content against 844px of viewport, but `min-height: 100dvh` and the real URL bar were not measured).
12. **Whether `.announcer`'s `clip-path: inset(50%)` recipe is recognised by impeccable's `isVisuallyHidden`.** The exemption's existence was read at `checks.mjs:3442`; its predicate was not. **Mitigated by construction:** `.announcer` declares **no `font-size` at all**, so it inherits 16px and `undersized-ui-text` cannot reach it whatever the predicate does.
13. **The seeding snippet is transcribed from plan 020 §21.4 with two edits** — `topUpTermoBuffer`, and `.env.local` instead of `vercel env pull`. The wrapper and the CJS constraint were proved by #25; **the two edits were not executed.** Verified only that `pnpm exec tsx --version` → `tsx v4.23.1 / node v24.18.1` and that `apps/api/.env.local` defines both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` (**names only — no values read**).
14. ~~**Whether the Impeccable job's `timeout-minutes: 15` still covers 18 page-loads.**~~ **CLOSED.** The four most recent successful `Impeccable` runs took **62, 57, 68 and 62 s** wall clock (`gh run list --workflow=impeccable.yml`, run ids `30753654005`, `30752392882`, `30744312207`, `30735506375`, 2026-08-02) — queueing included, so an upper bound. `68 × 18/14 = 87 s` against `900 s`: a **10.3× margin**. §21.5 carries the arithmetic. The job's wall-clock time is still pasted at step 8, as a shape-change signal rather than as a timeout check.
15. **That widening `ProjectedGame` breaks nothing** rests on two greps (`ProjectedGame`, `DailyPuzzleResponse`) over `apps/**` and `packages/**`. **It is a grep, not a typecheck.** `pnpm typecheck` after the widening is the real evidence.
16. **That the desktop keyboard at 552px sits comfortably under a 310px board card.** A 1.78:1 width ratio between a keyboard and the board it serves is unusual; it is arithmetically correct and **aesthetically unmeasured**. **Pre-agreed response if a visual review calls it wrong:** shrink the desktop keyboard's `width` to 480px (`C = 16.4`, letter key 40.8px) **inside Termo's own module** — never a change to the shared 1140px fold (ADR-0035 consequence (e)'s rule).
17. **Whether the two empty named grid areas (`hint`, and the stats card's absent timer row) collapse cleanly** at 1440×900 and 390×844. CSS Grid auto-sizes an implicit track to zero, but jsdom implements no layout. **Pre-agreed response:** if either band shows a visible gap, the fix is a Termo-only `grid-template-areas` override **in its own module**, never an edit to the shared `screen.module.css` bands (which would touch three shipped screens).
18. **That commit A2's conversion leaves all seven existing routes green under `npx impeccable detect`.** It should — nothing in it changes a size, a padding or a structure — but the run has not happened, and **`low-contrast` is silenced, so the run proves less than it looks like it proves either way.** *(This item is **PR A's**, §21.0.)*
19. ~~**The eleven-site accent inventory is complete for `color:`, `border:` and `background:` declarations only.**~~ **CLOSED — the sweep was run at step 4 and came back empty.** Over `apps/web/src`, `apps/web/app` and `packages/ui`:
    ```
    $ grep -rnE "(fill|stroke|text-decoration-color|caret-color|accent-color|outline-color|column-rule-color)\s*:[^;]*var\(--accent" …
    apps/web/src/play/conclusion-view.module.css:246:  fill: var(--accent);
    ```
    **One hit, and it was already classified.** `.picture`'s `fill` is a **shape** and is correct under ADR-0041 — an accent colouring a fill is exactly what the rule permits. **The eleven-site inventory is complete**, and the item is retired rather than carried into the PR as an open risk. **§16.2 carries the same finding at the point of use**, run with a wider pattern that also sweeps `-color:` and therefore returns three hits — the `fill` above, `sudoku-board.module.css:164`'s `border-color` (per-game, and an accent *border*, which ADR-0041 decision 5 permits by name) and `nonogram-board.module.css:452`'s comment — with the same conclusion: **every hit was a shape; none was text.** *(This belongs to **PR A**, §21.0. The merged ADR-0041 consequence (g) deliberately declines to turn either grep into an exhaustive claim — its own sweep covered `color:`, `border:` and `background:` — so quote the greps as evidence with a stated shape, never as a proof, and expect the `color:` half alone to be exhaustive for the three shared sheets because `ink-on-accent.test.ts`'s scan is a scan.)*
20. ~~**The adaptive oracle cost for this specific 400-word list.**~~ **CLOSED, and the question turned out not to arise.** The oracle needs **no** adaptive strategy: six arbitrary validation-dictionary words make a terminal board (`packages/games/src/termo/status.ts:39` — `rows.length === MAX_GUESSES` with no all-correct row returns `"lost"`), and the response's `.refine` then requires `answer`. **One request.** The `[2, 400]` bracket described a guessing game that is not the cheapest attack, and it is withdrawn from §4 P25 and from ADR-0038. §4 P25 carries the corrected statement and the two arguments that survive it.
21. **The ~3-day exhaustion runway** is derived from `effectiveThreshold = min(4, 7)` and the 07:30 UTC daily poll. It has never been observed and will not be for 13+ months.
22. **`.length(5)` on `canonical`** is proved for **today's** 400 (all exactly 5 JS chars, all NFC-stable — measured). It is a claim about the *current* list; a regeneration is the falsifier, and the pre-agreed response is that the pre-insert parse **fails closed and drains the buffer**, which is the wanted alarm.
23. **The 0.0193 ms / 0.0573 ms top-up figures are local CPU on Node v24.18.1.** They exclude the Neon round-trip entirely and were not measured on a Vercel runner. At landmine 6's 4× factor the worst run is still 0.23 ms.
24. ~~**That no shipped test asserts `completions`' column set.**~~ **CLOSED.** The whole tree was grepped: `grep -rn "information_schema" apps packages` returns **exactly one hit** — `packages/db/test/user.test.ts:369`, inside `T-DB-20`, and its query is `where table_schema = 'public' and table_name = 'hint_grants'` with an expected list of six `hint_grants` columns. **There is no second column-set tripwire, and the one that exists cannot see `completions`.** The `guesses` column reds nothing.
25. **`crossword` as the negative-test key** assumes no future ticket adds it to `GAMES`. If one does, the test moves to another non-game string; **it must never be deleted.**
26. **That `renderToStaticMarkup(<TermoScreen/>)` renders nothing beyond the skeleton.** Reasoned (`useSyncExternalStore`'s server snapshot is `{hydrated: false}`) but not run. If it renders more, N40's substring ban covers **more** surface — safer, not less safe — but the claim should be driven.

### 26.1 What would falsify the load-bearing decisions

| Decision | Falsifier, and the pre-agreed response |
|---|---|
| **ADR-0038** — the stateless guess route | Measured per-guess latency complaints or failures on Brazilian mobile networks. **The only design that removes the round trip is shipping today's answer with the daily and judging on the client, with the completion route re-judging exactly as it does now.** It is compatible with ADR-0004 as written and **incompatible with #27's AC and the strip table**, so it is **Fernando's call and not an agent's**. Parked in ADR-0038 with that trigger, in ADR-0004's own "Parked" style, so a future reader does not have to rediscover that it was weighed |
| **ADR-0039** — held, not queued | A step-6 finding that a held turn is indistinguishable from a hung UI. The response is **copy plus a retry button**, both already specified, never a queue |
| **ADR-0040** — no answer drawn twice | A duplicate reaching production. The sanctioned fix is the **partial unique index** on `(content ->> 'normalized') where game = 'termo'`, with its own ticket and its own hand-applied migration — never a recycling branch |
| **ADR-0041** — accents colour shapes | A visual review finding the kickers lifeless in `--ink-2`. The response is **more accent surface** (tape, shadow, rule, fill), never accent text, and never a token value change — which ADR-0041 decision 6 forbids without a new ADR |
| **ADR-0042** — the board is output | A real-device pass where the row-group labels are not announced (§26 item 9). The response is to move the composed sentence to a visually-hidden sibling of the row, **never** to un-hide the tiles, which reintroduces the `"CAFES"` defect |
| **ADR-0043** — the fourth conclusion state | A step-6 reviewer arguing a loss should reuse `empty`. **Refuted in advance:** *"Você ainda não concluiu o Termo de hoje"* is true of a player who never started and a **lie** to one who played six guesses, and `empty` is the branch ADR-0031's monotone rule reserves for *unknown* |
| **ADR-0044** — three verbs | Zod dropping support for a checked object as a discriminated-union option. The remedy is a `z.union` plus a manual `game` dispatch in `parseAt` — **never a `v` bump** (a discarded `pendingSync` record is a lost streak day) |
| **ADR-0045** — no hint | A product decision to add one. It is a ticket with its own ACs and its own accounting surface; the layout holds either way, because a hint would use the shared `screen.hint` unchanged, which §16 has already made legible |
| **ADR-0045** — the annotations | A future refactor deleting one "for tidiness". **Two suites red**: `route-client-js.mjs`'s three forbidden markers and `packages/games/test/termo/bundle-markers.test.ts`. Neither is optional, and each cites the other |
| **P17** — termo first in the cron | A measured cron invocation where termo's share exceeds ~1 s, or a `maxDuration` timeout attributed to it. Re-run §10.2's measurement; the order follows the number, not the other way round |
| **§6.2** — no `guesses` on `DayEntry` | Fernando reading `em 07:12` on the hub as a bug rather than a deviation. The response is **#29 or a small dedicated ticket**, never a second derivation of the guess count in `day-state.ts` |

---

## 27. Follow-up issues to file — at E0, before the PR body is written

Four, all pure `gh issue create` calls with no dependency on the merge or on any deployment. §21.6 requires the PR to say "each has a filed follow-up"; with the filing at the end, those links do not exist and **that sentence is false at the moment Fernando reads it** (plan 020's ISS-7). **Paste the four URLs.**

**1 — `bug`: a real alert when the Termo answer pool runs low**

> Termo's answer pool is finite: 400 curated answers, and ADR-0040 makes exhaustion fail closed with no recycling branch. When it empties, every uncovered date lands in `failures` with `ANSWER_LIST_EXHAUSTED`, the buffer drains one day per day, `depths.termo` falls below `effectiveThreshold` and `buffer-alert.yml` opens an issue.
>
> **The runway that gives is ~3 days**, and that is not enough. `effectiveThreshold` is `min(BUFFER_ALERT_THRESHOLD, bufferDepth) = min(4, 7) = 4` (`apps/api/src/publishing/service.ts:82-84`), so `shallow` fires when depth < 4 — three dailies remain — and `buffer-alert.yml` polls once daily at `30 7 * * *`. Regenerating and reviewing a curated pt-BR word list under ADR-0015's constraints does not fit in three days.
>
> #27 ships a stopgap and labels it as one: `topUpTermoBuffer` logs `{"event":"termo-answer-pool-low","remaining":N,"total":400}` once per run when fewer than 30 answers remain (~30 days' notice). **That line lands in Vercel logs that nothing polls. It is not an alert and ADR-0040 decision 7 says so.**
>
> **What to build:** a real alerting channel for pool depletion — either a `remaining` field on `/buffer-depth` that `buffer-alert.yml` thresholds independently, or a second workflow. Also worth deciding: what the product does when the list genuinely runs out, since ADR-0040 rejected recycling and ADR-0015's remedy is a **content** action (regenerate).
>
> Refs: ADR-0040 decision 7 and consequence (f), `docs/plans/022-issue-27-plan-daily-termo-end-to-end.md` §10.2.

**2 — `enhancement`, against #29: the hub tile should read `em 4/6` for a Termo, not an elapsed time**

> `docs/design/006-handoff-design-winner-atelie/f1-hoje-desktop.dc.html:63` establishes Termo's hub result as `result:'em 4/6'`, and `README.md:83` writes *"Termo feito 4/6"*. `HubCardAction` (`apps/web/app/hub-day-state.tsx:91-114`) renders `formatElapsed(elapsedMs)` for every game, so a **won** Termo currently shows `em 07:12`.
>
> **#27 shipped this deviation deliberately and said so** (plan 022 §6.2): a third `DayEntry` field with a second cross-invariant, in the module every route carries, in the same PR that already reshapes `DayEntry` and `HubCardAction`, is scope no AC asked for — and the guess count is #29's fact. Threading it through `DayEntry` for one tile would create the second derivation ADR-0031 decision 1 forbids (*"Nothing else derives completion"*).
>
> A **lost** Termo already renders correctly: no duration, chip `Jogado` (ADR-0044 decision 4).
>
> **What to build:** `#29` owns the guess distribution server-side. When it lands, the hub's done tile for Termo reads the guess count from wherever #29 puts it, and `messages.hoje.doneResultLong` composes `em ${n}/6`. Do **not** add `guesses` to `DayEntry` as a second local derivation.

**3 — `refactor`: totalise `playRoutes` now that all four games are routed**

> `apps/web/src/i18n/routes.ts:52-56` is `Readonly<Partial<Record<Game, Route>>>`, and `#27` added the fourth key. The `Partial` no longer buys anything, and three pieces of code exist only to handle its absence:
>
> - `apps/web/app/hub-day-state.tsx:71-81` — the `route === undefined` branch, an href-less `<a>` that is now unreachable for all four games.
> - `apps/web/src/play/conclusion-view.tsx:158` — the `?? routes.home` fallback.
> - `apps/web/src/play/conclusion-view.tsx:322-327` — `nextPendingDaily` is written as a **loop rather than a `find`** solely so the route comes out narrowed, because *"`playRoutes` is partial until #27 lands, and Next's typed `Link href` refuses a possibly-undefined value."*
>
> Roughly 15 lines of genuinely dead code.
>
> **#27 filed this rather than doing it** (plan 022 §17.1): it touches the exact two consumers `#27` was simultaneously rewriting for `DayEntry`'s three verbs, and two independent reshapes of the same eight lines in one PR is how a step-6 loop starts.
>
> **Acceptance:** `playRoutes: Readonly<Record<Game, Route>>`; the three sites above simplified; `T-WEB-S16`'s "follows `playRoutes`" property preserved or explicitly retired with a reason; full suite green.

**4 — `chore`: correct `FORBIDDEN_DAILY_KEYS`' TSDoc, which #27 makes half-false**

> `packages/core/src/testing.ts:9-11` reads: *"Keys that must never appear at ANY depth of a client-facing daily payload. **#27 extends this list with termo's answer when its projection lands.**"*
>
> `#27` extended the list — but with **`"canonical"` and `"normalized"`**, not with `"answer"`, which was already present at `:32`. Termo's stored content is `{canonical, normalized}`, and `"answer"` alone would have been the vacuous ban ADR-0033 decision 3 refused for `"reveal"`.
>
> `#27` corrects the sentence in the commit that adds the two members (plan 022 §20), so this issue exists **only** if the correction is dropped in review. **If the register entry landed, close this as done and say so.** Filed because the register is long and this is the entry most easily lost in a rebase.

---

**End of plan 022.**

