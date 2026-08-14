# Implementation plan — Issue #30: M3: Medals

**Issue:** [#30](https://github.com/fernandolisboa/miolos/issues/30) — 20–30 curated medals from real feats; no XP, levels, coins or ranking (ADR-0006). Zero comments — the issue body and the founding handoff's three sentences are the entire product surface; §3 of this plan writes the missing constraints document, which is itself AC 1's deliverable per the ADR-0015 method. Blocked-by #29 (CLOSED); blocks #37.
**Governing ADRs:** [ADR-0006](../adr/0006-monetization-convenience-not-access.md) (no wallet/ledger; the cheater medal is the curated-grant class's only written example), [ADR-0008](../adr/0008-completion-and-streak-semantics-across-play-modes.md) (the three verbs; rule 2's exclusion list; rule 5 free play records nothing), [ADR-0009](../adr/0009-account-merge-recomputes-from-the-union-of-completions.md) (rule-derived medals recomputed, never copied; curated grants unioned and deduplicated), [ADR-0015](../adr/0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md) (AI curation legitimized by written constraints + mechanical validation + rejected sample), [ADR-0018](../adr/0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0023](../adr/0023-proved-not-sampled-property-testing.md), [ADR-0026](../adr/0026-completions-are-write-once-rows-on-time-is-derived.md) (write-once completions; user-scoped surface on `@miolos/db/user`), [ADR-0027](../adr/0027-the-hint-is-computed-on-the-client.md)/[ADR-0031](../adr/0031-per-device-day-state-is-a-local-monotone-safe-affordance.md) D6 (`hints_used`/device state may never back a medal), [ADR-0034](../adr/0034-the-completion-celebration-renders-in-the-conclusion.md) D4 (celebration compliance shown by file-mode checks, not the anonymous URL scan), [ADR-0036](../adr/0036-aligning-numerals-use-instrument-sans-not-fraunces.md), [ADR-0041](../adr/0041-accents-colour-shapes-never-words.md) (accents colour shapes, never words), [ADR-0046](../adr/0046-free-play-routes-levels-and-the-ephemeral-session.md) (free-play wall), [ADR-0048](../adr/0048-the-streak-is-a-client-fetched-server-computed-value.md) D3 (growth of the SHAPE is a new endpoint — cited precisely in D6), [ADR-0049](../adr/0049-account-merge-one-pure-function-one-idempotent-operation.md) D6 (`mergeAccounts` is the single merge-duty home; #30's union statement lands at the reserved extension point), [ADR-0051](../adr/0051-statistics-are-read-time-derivations-on-closed-contracts.md) (one unfiltered reader, pure derivations, no stored aggregates; the perfect-streak rejection; medals on their own endpoint and contract).
**Handoff 034 §5 (binding):** `hintsUsed` and `elapsedMs` may never back a medal.
**Proposed ADR:** ADR-0052 (§11) — it **amends nothing** (argued in D14).
**Branch:** `feat/30-medals`. Conventional Commits, `TURBO_CONCURRENCY=1` on every commit, pre-commit never bypassed.
**Snapshot:** written against `main` at `aaa3864`. Point-in-time; where a later ADR disagrees, the ADR wins.

The hard parts of this ticket are not the arithmetic — they are (a) writing the constraints document that makes AI curation legitimate when the entire repo names exactly two example medals (§3 carries it), (b) shipping a grants table whose v1 write path is an operator ritual, not code — without repeating either the dormant-surface HIGH finding or an admin surface nobody asked for (D1/D2), and (c) a medal display on a screen with a mobile-overflow history, under anti-references that ban both default medal-UI idioms (§7).

---

## 1. Scope & non-goals

**In scope**

- `content/medals/README.md`: the written curation constraints, tone rules, category quotas, curated-grant candidates, and the rejected-candidates sample with reasons (§3) — AC 1's legitimizing artifact per ADR-0015.
- `packages/core`: `src/medals/definitions.ts` (the 20–30 AI-curated definitions, authored at implement time against §3), `src/medals/derive.ts` (`earnedMedals` — pure, over the same `StatsRow`, anchored on `today`), `src/contracts/medals.ts` (one strict contract), barrel exports, seam-2 unit + property tests including the definition-invariant harness. Plus **one bounded edit to `src/stats.ts`**: the `export` keyword on its three private predicates (B3; carved out of the untouched list below).
- `packages/db`: migration `0005` creating `medal_grants` (with **all three generated artifacts committed**: `migrations/0005_*.sql`, `migrations/meta/_journal.json` at 6 entries, `migrations/meta/0005_snapshot.json` — the PGlite migrator reads the journal, not the dir listing); `src/medals.ts` with one reader (`listMedalGrants`); `medalGrants` table + reader exported via `@miolos/db/user` with **both** export tripwires (the `user.test.ts` per-module pin and `published.test.ts` T-DB-S5, 32 → 34) widened in the same commit; the truncate lists; the AC 3 tripwires (table-set pin T-DB-S39 + column pin T-DB-S38 + vocabulary scan T-DB-S43); `mergeAccounts` gains its union-earliest-dedupe statement pair at the reserved extension point (merge.ts:94-100) with its own column-list tripwire, and the T-DB-S20 double-run snapshot (helper AND title) widened to five tables.
- `apps/api`: `GET /medals` — a fourth verbatim copy of the `GET /streak` authenticated-read template, `todaySaoPaulo` included; the two account-delete footprint comments (route.ts:43-44 and :92-93) updated; seam-4 tests over PGlite including grants inserted directly (the manufactured-late-rows precedent).
- `apps/web`: `src/medals/` (client + hook), the medal section inside `stats-view.tsx` at the reserved slot (stats-view.tsx:76-83), styles in the existing `app/estatisticas/page.module.css`, `messages.medals` chrome + the tree-shakeable `medalCopy` export, the `/privacidade` inventory line for operator-recorded grants (A14 — `messages.privacy.collected.medals`, one `<li>` on the page, T-WEB-S141 extended in place), free-play wall bans + probes, `stats-page.test.tsx`'s new `vi.mock` (B6), the two shipped-tense comment rewrites (`page.tsx:35-38`; and `packages/db/src/user.ts:29-31` on the db side — B5), measured bundle figures.
- Docs: this plan (035), ADR-0052, two `docs/README.md` rows same PR, CONTEXT.md rows, `docs/agents/test-ids.md` frontier re-derived at the end.

**Non-goals — explicitly out**

- **No new route.** Medals render inside `/estatisticas` (D7). No `/medalhas`, no "ver todas" detail page, no sitemap/route-ssr/impeccable.yml/route-classification change.
- **No production grant writer and no admin surface.** No `grantMedal` export, no POST endpoint, no UI. The v1 grant mechanism is the documented operator ritual (D2). Shipping a dormant exported writer repeats the napkin §Execution 6 HIGH finding; the tests exercise the table by direct insert.
- **No hint medals, no time medals, no time-of-day/day-of-week medals.** `hintsUsed` and `elapsedMs` never back a medal (ADR-0027, ADR-0031 D6, handoff 034 §5); time-of-day is not in `StatsRow` and no new data is collected. These appear in §3's rejected sample so the constraint is content, not just code.
- **No archive medals (#31).** No definition whose qualifying rows are late completions — they would ship provably-always-zero (nothing writes `onTime: false` today). #31 may add them by widening the catalog: new definitions are additive **content** — the wire validates ids by shape (D6), so catalog growth needs no contract change at all, and old clients drop the unknown id instead of losing their history. The rule *engine* still handles manufactured late rows correctly (volume rules count them, on-time-only rules exclude them — tested).
- **No consecutive-Dias-Perfeitos medal.** ADR-0051's rejection of run-length-over-perfect-days stands (D5).
- **No earning-moment detection, no notifications, no celebration animation.** The section is a record, not a moment; detecting "newly earned" would require stored client state. Any future earning-moment motion is the stamp-settle register, someone else's ticket.
- **No locked/greyed/upcoming medal display** — gamification chrome (D8). No progress bars toward medals — same class. (This is also the display half of the ladder defence, §3.1.)
- **No stored aggregates, no `earned_medals` cache table** (ADR-0009/0049 D6/0051 D1): rule-derived medals recompute from rows on every read; a merge needs zero medal-specific code beyond the curated-grants union.
- **No `earnedDate` on the wire and no per-medal date display** (D6, A1's decision): for a late-counted feat the honest earning day is structurally unavailable (`StatsRow` carries no `completedAt`), so no date field ships to lie. An earned-date display, if ever wanted, requires projecting the completion instant into the reader — a decision deliberately not taken now, handed forward in writing in ADR-0052.
- **No #58, no #34 share, no per-medal share.**
- **No change to `statsResponseSchema`, `statsCalendarResponseSchema`, or `streakResponseSchema`** — T-CORE-S69's probe (`{...validStats, medals: []}` must fail) stays green byte-untouched.

**Not touched at all:** `packages/core/src/{streak,date,merge}.ts`, every existing contract file, `packages/db/src/{completions,stats,published}.ts` (except zero lines — the stats reader is *consumed*, not edited), `packages/games`, `apps/api/app/{completions,session,daily,termo,cron,buffer-depth,health,attach,stats,streak}` routes, `apps/web/app/{page,hub-day-state}.tsx`, `conclusion-view.tsx`, `packages/ui/tokens.css`, `.github/workflows/impeccable.yml`, `route-ssr.test.tsx`, `route-client-js.mjs` route lists. A diff in any of these at review is a finding by itself. **One named, bounded exception (B3):** `packages/core/src/stats.ts` is touched by exactly one edit — the `export` keyword added to the three module-private predicates `countsOnTimeWon`, `countsLateWon`, `termoGuessOf` (stats.ts:77-91), **module level only, NOT the index barrel** (feasibility-verified: no core-test barrel pin reds on this). Anything beyond those three keywords in that file at review is a finding. `apps/api/app/account/delete/route.ts` is touched **comments-only** (two lines); `apps/web/app/estatisticas/page.tsx` and `packages/db/src/user.ts` **comments-only** at the lines B5 names (plus user.ts's export additions named here); `merge.ts` only at the extension point + header + its schema import; `stats-view.tsx` only at the reserved slot comment's location; `schema.ts` only by the additions named here.

---

## 2. Decisions register

Each decision answers the exploration's twelve open questions. All are settled here so implementation implements rather than re-litigates. Product-visible ones are flagged **[Fernando-adjustable]** — he can override in the PR without blocking.

### D1 — The grants table ships; no production writer ships (Q1)

**Decision: ship the table + the merge union statement + the delete cascade + seam tests that insert rows directly. No dormant exported writer; no admin surface.** The two live precedents are in tension — `hint_grants` shipped dormant writers (`grantHints`, caller-free), while napkin §Execution 6 calls unused surface with contract comments naming non-existent consumers a HIGH review finding. The napkin rule is the *later* discipline and wins: `hint_grants`' writers were shipped for a named future ticket (rewarded-ad) with a schema that ticket attaches to; a medal-grant writer has no named future caller at all — the v1 granting act is an operator judgment, not code. AC 2's sentence — "curated grants are explicit rows that survive merge by union-and-dedupe" — requires the *rows* and the *merge behaviour* to exist and be tested, which direct-insert seam tests discharge exactly the way #29's manufactured late rows discharged late-row honesty before any late writer existed. The one production **reader** (`listMedalGrants`) has a production caller in this same PR (the `GET /medals` route), so nothing ships unused.

### D2 — The v1 grant mechanism is the documented operator ritual (Q1, Q2)

**Decision:** a grant is inserted by the operator via the napkin's serverless-script pattern — `vercel env pull` to an absolute path outside the repo, a temp script over `@neondatabase/serverless` running `insert into medal_grants (user_id, medal_id) values ($1, $2) on conflict (user_id, medal_id) do nothing`, verification via the user's own `GET /medals`, then script + env deleted. This path is **recorded in ADR-0052** as the v1 mechanism, so it is documented surface, not folklore. `granted_at` defaults DB-side (`now()`) on the direct insert — the merge statement, by contrast, always copies it (D11).

**What a curated grant is FOR (Q2, settled):** a curated grant is **a medal whose earning is not computable from completion rows** — the ADR-0006 cheater-medal class, plus human-judgment classes like a launch-window founder medal or a bug-reporter medal. It is *not* "a medal a human awards for a computable feat": rule-derived medals are NEVER stored, and a `medal_grants` row bearing a rule-derived id is **ignored at read time** (D6) — storing one could otherwise fake an uncomputed feat or desync from a recompute. ADR-0008 rule 2's "archive-specific curated medals (e.g. 'solved 100 archive puzzles')" reads as rule-derived-over-late-rows — a *definition* #31 may add — not as hand-granted rows; ADR-0052 records this reading so the ambiguity dies. Curated medals are part of the 20–30 (the AC counts definitions, and a curated medal is a definition with `rule.kind === "curated"`).

**The founder medal, complete (A13's decision):** `founder` ships as a v1 definition with all three missing pieces supplied. **Window:** decided at launch by #37 — accounts with `created_at` before the launch instant. **Procedure:** a documented one-shot bulk insert via the same operator-script pattern — `INSERT INTO medal_grants (user_id, medal_id) SELECT id, 'founder' FROM users WHERE created_at < $launch ON CONFLICT DO NOTHING`. **Owner:** #37's launch checklist, recorded as a written obligation in ADR-0052 **and** flagged in the PR body for Fernando. Shipping the definition now is load-bearing, not speculative: under D6's drop-unknown client rule, a grant whose id is missing from the bundled catalog would render nothing — so the definition must precede the first grant.

### D3 — Table name and columns: `medal_grants`, three columns, composite PK (Q2)

**Decision:** `medal_grants` — `user_id` (uuid, NOT NULL, FK users ON DELETE CASCADE), `medal_id` (text, NOT NULL), `granted_at` (timestamptz, NOT NULL, DEFAULT now()); **PRIMARY KEY (user_id, medal_id)** — the composite-PK-no-id shape of `completions`, and exactly the unique key the union-earliest-dedupe `ON CONFLICT` needs. No `id`, no `source`, no `reason` column: a reason is operator context that belongs in the grant's paper trail (the ADR/issue that motivated it), not in a schema column with one writer and no reader — every column must have a named reader. `medal_id`'s reader is `listMedalGrants`; **`granted_at` never crosses the wire (D6/A1) — its named readers are the merge statement's `least()` (D11) and the operator's audit queries**, and it stays in the table because earliest-wins on merge needs it. **No CHECK ties `medal_id` to a known id set**: definitions live in code (D9), so a membership CHECK would need a migration per new curated medal and would make catalog/DB drift an insert-time failure in production rather than a read-time no-op — the wrong failure mode for content. Instead a **shape** CHECK (`medal_grants_medal_id_check`: lowercase slug, 1–64 chars) catches typo'd garbage at insert without coupling to the catalog, and gives T-DB-S40 the T-DB-21 treatment. No secondary index: every read is by `user_id`, which the PK's leading column covers.

### D4 — Rule inputs: exactly `StatsRow` facts and the sanctioned derivations; every exclusion named (Q3)

Rules may consume, exclusively:

1. **Won totals** — per-game and all-games, **late wins included**, exactly the `solved` posture plan 033 §4.4 argued and ADR-0051 D6 recorded: rule 2's exclusion list names distributions, time stats, streak medals and Dia Perfeito, not totals, and a late solve is honestly a solve. (Empty in practice until #31 writes late rows — the engine is tested with manufactured ones.)
2. **Streak milestones** — via `computeStreak`'s own semantics, **reused, never re-derived** (D10): on-time-only by rule 2's explicit "streak medals" clause, structurally, because `computeStreak` already excludes what must be excluded.
3. **Dia Perfeito milestones** — via `perfectDays(rows)`, on-time-only by that function's own construction. Counts only — **no consecutive-perfect-days medal exists or can be expressed** (D5).
4. **Termo guess feats** — win in 1, win in 2, win in 6 (last-guess survival), over **on-time won termo rows only**: guess facts are distribution-class statistics and rule 2 bars late completions from the guess distribution; a guess-fact medal that counted a late win would contradict the fail-row/distribution honesty the calendar already renders.
5. **Breadth** — each of the four games won at least once (volume-class: any won row).

**Forbidden, restated as one list:** `hintsUsed`, `elapsedMs` (handoff 034 §5), any device/client state (ADR-0031 D6), free play (rule 5 — free play records no rows, so this holds structurally over `listCompletionsForStats`), time-of-day/day-of-week (not in `StatsRow`; would need new data collection), account age (not a completion fact — the founder medal is therefore *curated*, D2), archive volume (D5), lost-row feats ("lost 10 Termos" — a medal must never reward losing; tone rule, §3). The `MedalRule` union (§5) makes the forbidden inputs **inexpressible**: no rule variant has a field that could carry them, and T-CORE-S70 pins the variant set.

### D5 — No consecutive-Dias-Perfeitos medal; no archive medals in v1; #31 widens additively (Q3)

**No run-length arithmetic over perfect days.** ADR-0051's rejection is explicit — `perfectDays` returns a set, "no run length, no consecutive-day arithmetic and no second streak exists in code or contract" — and a "3 Dias Perfeitos seguidos" medal is precisely that second streak wearing a ribbon. The one sanctioned run-length in the product is the streak itself, and medals reach it only through `computeStreak` (D10). **No archive-volume medals in v1's 20–30**: with no late-row writer they would be provably-always-zero content — fake UI in definition form. When #31 lands, it may add late-row definitions (e.g. the ADR-0008 "solved 100 archive puzzles") by appending to the catalog: new definitions are **genuinely additive content** — the wire validates ids by shape (D6), so no schema, engine, or contract change is needed, and already-deployed clients keep rendering everything they know while silently dropping the new id until their bundle updates. Recorded in ADR-0052 so #31 is uncornered, not pre-empted.

### D6 — The endpoint: `GET /medals` — the earned id set only; strict on shape, additive on content (Q7)

**Decision:** `GET /medals` returns **only the earned id set** — `{ medals: [id, …] }`. Two deliberate omissions, each recorded in ADR-0052:

- **No names or descriptions on the wire:** the client owns them (definitions module + `medalCopy`), so the payload is bounded, the contract never grows per-medal prose, and copy fixes are a client deploy.
- **No `earnedDate` — A1's decision.** The medal row renders name + description; no date renders, so no field exists to lie. The lie was structural, not cosmetic: D4.1 counts late wins, and for a late win the qualifying row's `date` is the *puzzle's* day, not the earning day — `StatsRow` carries no `completedAt`, so the honest date is unavailable. Once #31 writes late rows, a user solving a 2024 archive puzzle would have earned "100 vitórias" stamped "conquistada em 2024" — before the account existed, the exact failure ADR-0051's Rejected list names. Dropping the field also honors the repo's own speculative-surface rule (a field no display renders is surface) and shrinks the future-dated-row exposure (no future date can ride the wire; A6's guard is adopted anyway, §5.2/§6). ADR-0052 records the handover: an earned-date display, if ever wanted, requires projecting the completion instant into the reader — deliberately not decided now.

**Ids are validated by SHAPE, not by enum — A2's decision.** The wire id schema is the slug regex `^[a-z0-9]+(-[a-z0-9]+)*$` (the DB CHECK's grammar), never `z.enum(MEDAL_IDS)`. Unknown *keys* are still strictly rejected (`strictObject` on both ends). The client renders only ids present in its bundled catalog and **silently drops unknowns** — stated in ADR-0052 as the honesty mechanism. Why not the enum: ADR-0048 D3 was previously cited backwards — its clause ("future payload growth is a NEW endpoint/contract, never fields appended to a strict schema deployed clients parse") protects the **shape**; it does not license closing a **value set**. Growth of the shape is still a new contract here (keys stay strict); id-set growth is content, not shape. A closed enum would make catalog growth a breaking wire change: during deploy skew every already-loaded client's parse fails, the hook settles null, D8 renders nothing, and the user's entire medal history disappears — indistinguishable from "earned nothing" — until bundle update. With shape validation, growth is genuinely additive and D5's additivity claim holds. Grant rows whose `medal_id` is unknown to the catalog **or names a rule-derived definition** are ignored by the derivation (D2) — never an error, never surfaced. No `date` field, no request parameters. Exact schema in §4.4. Recorded as ADR-0052's contract decision; ADR-0051 D3 is thereby executed verbatim.

### D7 — Placement: inside `/estatisticas` at the reserved slot; a compact list, never a tile grid (Q4)

**Decision:** the medal section renders at the exact slot `stats-view.tsx:76-83` reserves — between `PerfectDaysCard` and the per-game blocks — inside the same island, painting with the same `page.module.css`. No new route (D8 makes the common case zero-height, and even the full catalog at ~30 compact rows is less vertical space than the calendar's month grids; a "ver todas" detail route is navigation without content until someone measures otherwise). **The idiom is rows in a list, not a grid of tiles** — the anti-references ban "tile arredondado com ícone acima de todo heading" and "emoji decorativo", which are the two default medal idioms; §7 specifies the row. Ordering is **catalog order** (with no date on the wire there is no chronology to sort by — D6; catalog order is deterministic and matches the constraints file's own table). Mobile: single-column, no fixed widths, values wrap — the screen's column-overflow history is the reason this is stated, not assumed. **[Fernando-adjustable:** row density/ordering.]

### D8 — Zero state: nothing is rendered (Q8) **[Fernando-adjustable]**

At unsettled, at settled-`null`, **and at zero earned medals**, the section renders **nothing** — no heading, no locked-badge grid, no count, no DOM. A locked-medal display is gamification chrome (PRODUCT.md:27) and a padlock grid is the loot-box visual language ADR-0006 exists to keep out; the shipped precedent is the slot comment's own sentence: "Nothing empty is rendered … a placeholder section would be fake UI." The section appears with the first earned medal — the reward is that the notebook gains a page. (A payload containing only ids unknown to the bundled catalog renders nothing too — the drop-unknown rule composed with this one.) This is what `impeccable detect`'s anonymous scan sees (nothing — vacuously green; the substitute evidence is in §8/§9). Flagged in the PR as adjustable: if Fernando wants discoverability, the adjustment is a one-line unhide, not a redesign.

### D9 — Definitions are hand-authored TS in `packages/core/src/medals/`, with ADR-0015's record artifacts scaled to fit; no codegen (Q5)

**Decision:** the catalog is `MEDAL_DEFINITIONS` in `packages/core/src/medals/definitions.ts` — authored at implement time by AI against §3's written constraints — plus `content/medals/README.md` carrying the constraints, tone rules, quotas, the full catalog table (id → name → rule → rationale) and the rejected-candidates sample with reasons. Mechanical validation is the harness (T-CORE-S70 + T-WEB-S163, invariants listed in §3.3). **No codegen, no staleness pipeline**: Termo's pipeline exists because 5,310 words cross a normalization/frequency pipeline from external sources and two languages of artifacts must stay byte-synchronized — none of which applies to ~25 hand-sized records whose single source of truth is the TS module itself. What ADR-0015 actually requires — explicit constraints, mechanical invariants, a rejected sample recording the judgment calls — ships in full; what it does not require — a deterministic producer for content that has no upstream source — is honestly omitted, and ADR-0052 records the scaling argument so the precedent isn't silently weakened. `content/**` is eslint-ignored, so only the README lives there; no `.ts` under `content/` (it would be unlinted).

### D10 — Streak-milestone semantics: one shared `computeStreak` sweep per call; monotone by construction (Q3)

A streak medal must be **monotone** — once the feat happened it stays earned — so "current streak ≥ N" is wrong (it un-earns on a break). **Decision:** "reached a streak of N" is earned iff ∃ a date `d` among the user's on-time-won dates (with `d ≤ today`, A6) such that `computeStreak(rows, d).streak ≥ N`. Implementation **reuses `computeStreak` verbatim** — the day-counting predicate is never re-spelled (the "reuse, never re-derive" rule; the exact sibling of `epochDay`'s one-spelling discipline) — and runs as **one shared sweep** (B4's correction): `earnedMedals` walks the distinct counted dates ONCE, calling `computeStreak(rows, d)` per date and keeping the running maximum; every `streakReached` rule is then a threshold comparison against that single shared maximum. **Cost arithmetic, restated:** the sweep is O(D·R) with D counted days and R rows, **once per request, shared by all 4–6 streak medals** — at three years ≈ 1,100 × 4,400 ≈ 5M cheap operations per request total, never 4–6 × that (the per-medal wording the draft carried would have been ≈ 20–30M and the published figure wrong by 5×). **Revisit trigger, calibrated against the shared-sweep figure so #37 inherits a number:** if `/medals` p95 exceeds 200 ms server-side or the account passes 1,100 counted days, replace the sweep with a single-pass run-length scan **pinned equal to the computeStreak-per-day oracle by a ≥100-run property test** (T-CORE-S76 already is that oracle test — sampled evidence in ADR-0023's vocabulary — so the optimization slots in without a semantics decision).

### D11 — The merge statements: union-EARLIEST-dedupe plus the loser's delete; earliest-wins via `least()` (Q12-adjacent)

Two raw-SQL statements at the extension point: `insert … select … on conflict (user_id, medal_id) do update set granted_at = least(medal_grants.granted_at, excluded.granted_at)` with `granted_at` **copied, never `defaultNow()`**, then `delete` of the loser's rows. **A7's correction, adopted:** plain `do nothing` would keep the *later* grant date whenever the loser was granted first — against ADR-0009's earliest-wins posture (the completions pair exists precisely to make the earlier row win) and against the plan's own monotonicity claim. `least()` restores earliest-wins in a **single** statement: completions needed two statements because a whole earlier *row* must win; a grant has exactly one merge-relevant column, so the conflict arm can compute the union's earliest directly, and no drop-later delete statement is needed. Still individually idempotent (no transaction, the merge.ts law): a re-run finds the loser's rows already deleted → zero-row insert; and `least(a, least(a, b)) = least(a, b)` — reapplication changes nothing. Exact SQL in §4.3; its hand-spelled column list gets its own T-DB-S24-sibling tripwire (**T-DB-S42** — Q12 answered yes, by precedent, because the list is hand-spelled and a future column would silently default on merged rows).

### D12 — AC 3's mechanical teeth: a table-set pin + the grants column pin + a forbidden-vocabulary column scan (Q10)

Three assertions, extending the T-DB-20 precedent — ids per A12/B2's allocation (no sibling letters at plan time; letters are for siblings of LANDED ids):

1. **T-DB-S39 (table set):** `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'` deep-equals the sorted 8-name list `[attach_tokens, completions, daily_puzzles, hint_grants, medal_grants, remote_config, sessions, users]` — any future wallet/ledger/XP/ranking *table* fails the suite rather than passing review. (Drizzle's own bookkeeping lives in the `drizzle` schema, so the public deep-equal is sound — verified.)
2. **T-DB-S38 (column pin):** `medal_grants`' column set is exactly `[granted_at, medal_id, user_id]`, with the T-DB-20 anti-ledger comment adapted: a future `points`, `tier`, `progress` or `revoked_at` column is the accumulable/rank state ADR-0006 forbids (revocation, if ever needed, is a DELETE — grants are append-only events like hint grants).
3. **T-DB-S43 (vocabulary scan):** `select table_name, column_name from information_schema.columns where table_schema = 'public' and column_name ~ '(balance|wallet|coin|point|credit|score|level|rank|xp)'` returns **zero rows** — verified clean against every current column name at plan time — because the table-set pin alone would miss a `balance` column added to `users`, and only `hint_grants`/`medal_grants` carry column pins. The known cost — a future legitimate column matching the pattern must edit this test — is the point: that edit is the review moment AC 3 wants.

**The recorded residual, named and accepted:** a wallet-as-*view*, or accumulable state hidden inside jsonb (`users.entitlements`, `remote_config.value`), passes all three assertions. The AC's own words cover *tables*; the residual is stated in the test-file comment and in ADR-0052 rather than pretended away.

### D13 — Module homes and the wall (Q9)

`packages/core/src/medals/{definitions,derive}.ts` (+ `contracts/medals.ts`); `packages/db/src/medals.ts`; `apps/web/src/medals/{medals-client,use-medals}.ts`; the section component inside `stats-view.tsx` (same island — CSS Modules hash per file, the shipped reason). The web medals modules are one hop from walled server values, so the free-play wall gains a **new static group** `["**/medals", "**/medals/**"]` (both specifier shapes, the shipped rule at eslint.config.mjs:284-293's own comment — the stats group at :290 is the template) and the dynamic regex at :302 gains `medals(\/|$)` — with T-LINT-S33/S34 probes. `**/app/estatisticas/**` is already banned, which covers the section component.

### D14 — One ADR, 0052; it amends nothing (Q6)

**Decision:** ADR-0052 — working title `0052-medals-are-derived-facts-plus-curated-grants.md` — carries: (1) the two medal kinds and the D2 definition of a curated grant, with the ADR-0008 "archive-specific curated medals" reading; (2) rule-derived medals recompute over `listCompletionsForStats`, never stored, a stored row for a rule-derived id ignored; (3) the sanctioned rule-input list and every exclusion (D4/D5), including the no-perfect-run and no-archive-in-v1 rulings with #31's additive widening named; (4) `medal_grants`' shape, the no-membership-CHECK argument, the operator grant ritual as the v1 write path, and the merge union-earliest-dedupe with the `least()` argument (D11); (5) the `GET /medals` contract: earned id set only, ids shape-validated with the drop-unknown client rule as the honesty mechanism, the precise ADR-0048 D3 reading (shape closed, content open), and the `earnedDate` omission with its written handover — a future earned-date display requires projecting the completion instant into the reader, a decision deliberately not taken now (D6/A1); (6) the AC 3 tripwire triad and its named jsonb/view residual (D12); (7) definitions-as-code with ADR-0015 scaled (D9); (8) display placement, the list idiom, nothing-at-zero, and the **ladder defence** — invisibility of the unearned (§3.1/A11); (9) the founder medal's written obligation on #37's launch checklist: window at launch, the documented bulk-insert procedure, owner named (D2/A13); (10) the read-amplification restatement of ADR-0051 D3's trigger with the third reader in it (§6/A10). **Three-pass amendment audit (run at write time, again at commit, again at exit): it amends nothing.** It *executes* ADR-0006 (the no-wallet consequence gains its tripwire; the cheater medal stays available as written), ADR-0008 (every exclusion obeyed as written), ADR-0009 (its union-and-dedupe sentence becomes code, in the earliest-wins posture its completions rule already set), ADR-0015 (its method reused, scaled with the argument recorded), ADR-0049 D6 (the extension point consumed exactly as reserved), ADR-0051 D3 (its "own endpoint" instruction followed; its read-side trigger restated, not moved), ADR-0027/0031 (forbidden inputs held), ADR-0048 D3 (its shape-protection clause applied precisely, not stretched). No `Amends:` header, no reciprocal lines anywhere.

### D15 — Copy homes: `messages.medals` chrome + a separate tree-shakeable `medalCopy` export (part of Q5/Q7)

All copy is composed in `apps/web/src/i18n/messages.ts` (ADR-0018), pt-BR, but in **two exports**: the tiny section chrome (`title`, aria composer) joins the `messages` object; the 20–30 name/description records ship as a **separate named export** `medalCopy` from the same module, typed `satisfies Record<MedalId, MedalCopy>` — so TypeScript enforces exhaustiveness both directions at typecheck (a missing id and a stray id are both compile errors), and the ~2 KB of medal prose is imported only by the medal section, tree-shaking out of every other route's chunk instead of riding the shared `messages` object onto routes with single-kilobyte slack. **`medalCopy` stays a distinct named export through the i18n barrel too** (`src/i18n/index.ts` re-exports by name): it is never folded into `messages`, and the tree-shake argument stands or falls on that distinctness — folding it in would put the prose on every route (B11). Same file, same ADR, bundle-honest. Copy proposals in §7.3; **[Fernando-adjustable:** every name and description.]

---

## 3. The curation constraints — the content of `content/medals/README.md`

This section IS the deliverable AC 1 needs (ADR-0015: the constraints legitimize the AI curation; the curation itself happens at implement time against this text). The file ships with these sections, this content (prose may be tightened, rules may not be weakened):

### 3.1 Written constraints (the file's "Constraints applied" section)

**Sources of truth.** A medal is earned from completion rows or from an explicit grant — nothing else exists. Every rule-derived medal's rule must be expressible in the `MedalRule` union (§5.1); if a candidate needs a field the union lacks, the candidate is rejected, never the union widened silently (widening is an ADR-0052-touching decision).

**Category quotas (mechanically enforced, T-CORE-S70):**

| Category (rule kind) | Quota | Threshold constraints |
|---|---|---|
| `totalWins`, all games (`game: null`) | 4–6 | counts strictly increasing, first = 1 (the first-win medal), last ≤ 1000 |
| `totalWins`, per-game | 4–6 | every one of the four games appears in ≥ 1 medal; counts strictly increasing per game |
| `streakReached` | 4–6 | days strictly increasing, 3 ≤ days ≤ 365 |
| `perfectDaysReached` | 3–5 | counts strictly increasing, first = 1 |
| `termoGuessWins` | 3–4 | `guesses ∈ {1, 2, 6}` only — win-in-1 and win-in-2 are skill feats, win-in-6 is survival; guess values 3, 4 and 5 are the middle of the distribution — ordinary outcomes the stats screen already reports, not feats — and are inexpressible in the type |
| `eachGameWon` | exactly 1 | — |
| `curated` | 1–2 | no rule; earned only via `medal_grants` rows (`founder` ships; the cheater medal stays unshipped — no cheat detection exists to trigger the judgment) |
| **Total** | **20–30** | |

**The quota arithmetic, shown (A5's correction):** sum of minima = 4 + 4 + 4 + 3 + 3 + 1 + 1 = **20**; sum of maxima = 6 + 6 + 6 + 5 + 4 + 1 + 2 = **30**. Both sums sit inside AC 1's [20, 30], so no quota-satisfying catalog can violate the total. The total is nonetheless **independently binding**: T-CORE-S70 asserts `count ∈ [20, 30]` on its own line, because quotas bound the catalog, they don't fix it, and the AC's number must not depend on arithmetic staying correct across future quota edits.

**Anti-ladder threshold spacing (mechanical, T-CORE-S70):** within any counted kind (per game where scoped, per guess value where scoped), each threshold is **at least double its predecessor**. Feats are round, rare marks — 1, 7, 30, 100 — never consecutive ladder filler (no 3-then-4-then-5 rungs). This is the mechanical half of the levels-veto defence; the display half follows.

**Why this catalog is not a levels system (the ladder defence — A11, recorded here and in ADR-0052):** what separates 20–30 milestone medals from XP-levels is **invisibility of the unearned**. No locked medals, no greyed placeholders, no progress meters, no "next tier" affordance, no remaining-count — the player only ever sees earned facts, never a position on a scale (D8 is this rule's display enforcement; the spacing rule above keeps the thresholds themselves from forming visible rungs). A threshold catalog becomes levels only when the interface shows the ladder.

**Naming & tone rules (pt-BR, mechanical where possible):**

- Names: sentence case, 2–28 characters, noun phrases; no exclamation or question marks; no emoji (`\p{Extended_Pictographic}` — mechanically checked); no digits-as-rank ("Nível 2"-shaped names forbidden); the stationery/notebook register is the house voice (carimbo, caderno, tinta, papel — encouraged, not required).
- Descriptions: one sentence, 20–120 characters, ends with a period, states the feat **precisely** — for any counted rule with threshold ≥ 2, the threshold appears as digits in the description (mechanically checked against the rule params).
- **Mood (A4's decision, stated as a rule):** every description is a **past-tense statement of the achieved fact** — the medal records what happened; it never instructs, cheers, or points at future behaviour. Imperatives ("Vença…", "Mantenha…", "Acerte…", "Complete…", "Jogue…") are forbidden: D8 renders only earned medals, so an imperative reads as a to-do list of already-done things — the casino quest-log register PRODUCT.md:34 excludes. Verbs come from CONTEXT.md's set (concluir/vencer, as shipped in messages.ts). Mechanically enforced (T-WEB-S163): each description's first word is drawn from the recorded past-tense allowlist in this README — initially `{Acertou, Chegou, Concluiu, Estava, Venceu}` — and extending the allowlist is a deliberate README + harness edit.
- Forbidden vocabulary anywhere in medal copy (mechanical regex, case-insensitive): `xp`, `nível`/`níveis`, `moeda(s)`, `ponto(s)`, `ranking`/`ranque`, `placar`, `troféu` — the vetoed-concepts list (CONTEXT.md:48, ADR-0006) plus the scoreboard words; **plus the recorded copy rejections (A3):** `dias seguidos` (messages.ts:247's own recorded rejection — CONTEXT.md's noun is *sequência*, never "dias seguidos") and CONTEXT.md's Terms-to-avoid — `premium`, `Wordle`, `Picross`, `Griddler`, `Hanjie`, `paint-by-numbers`, and `dica(s)`/`pista(s)` (hints can never back a medal, so the words have no legitimate place in medal copy); and the three bundle canaries `então`, `mamãe`, `época`.
- Tone: adult, dry, quiet — the medal records a fact, it does not cheer. No urgency, no mockery of the player, no diminutives (-inho/-inha), no losing-rewarded medals.
- Ids: lowercase slugs `^[a-z0-9]+(-[a-z0-9]+)*$`, ≤ 64 chars (the DB CHECK's shape and the wire schema's shape, D6), stable forever once shipped (an id is a wire value and a grant key — renaming copy is free, renaming an id is a migration of user data and is forbidden).

**Curated-grant candidates (the sanctioned classes):** the launch-window founder medal — **shipped as a v1 definition** with its window (#37 decides the launch instant; accounts with `created_at` before it), its procedure (the D2 one-shot bulk insert, documented), and its owner (#37's launch checklist, an ADR-0052 written obligation, flagged in the PR body) all named — the drop-unknown client rule (D6) makes the bundled definition load-bearing, since a grant without it would render nothing; the caught-cheater medal ADR-0006:51 keeps available (copy must stay dry, not cruel; **not shipped in v1** — no cheat detection exists to trigger the judgment; when it ships, its definition must precede its first grant, same reason); the bug-reporter medal. v1 ships 1–2 curated definitions from these classes.

### 3.2 The rejected-candidates sample (the file's section, ≥ 10 rows, reason each)

The judgment record the ADR-0015 method requires — these exact rejections ship (TSV-style, candidate → reason):

- *Sem dicas* ("solved without hints") → `hints_used` is self-reported; ADR-0027 forbids it backing a medal until a server-computed path exists.
- *Relâmpago* ("solved under 2 minutes") → `elapsed_ms` is self-reported, same class; handoff 034 §5 binds both.
- *Madrugador / Coruja* (time-of-day) → not in `StatsRow`; would require new data collection.
- *Fim de semana perfeito* (day-of-week set) → same; and calendar-partition feats reintroduce run-shaped arithmetic by the back door.
- *Dias Perfeitos seguidos* → ADR-0051 rejected run-length over perfect days; the streak is the product's one run.
- *Arquivista / 100 do arquivo* → provably always zero until #31 writes late rows; #31 may add it (additive).
- *Maratonista do modo livre* → free play records nothing server-side (ADR-0008 rule 5) and is walled from medals by user story 39.
- *Perdeu 10 Termos* → a medal never rewards losing (tone rule).
- *Veterano* ("account 1 year old") as rule-derived → account age is not a completion fact; the founder class exists as a *curated* grant instead.
- *Nível dourado / Colecionador de pontos* → vetoed vocabulary; medal-as-currency framing (ADR-0006).

### 3.3 The harness invariants (mechanical validation — the file lists them; the tests enforce them)

Enforced by **T-CORE-S70** (pure, over the definitions module): count ∈ [20, 30] (independently of quotas, §3.1); ids unique and slug-shaped ≤ 64; every `rule.kind` ∈ the sanctioned discriminant set (deep-equal on the set — adding a kind is a deliberate test edit); no two rule-derived definitions with structurally identical rules; per-kind quotas per the §3.1 table; threshold monotonicity **and the ≥2× anti-ladder spacing** per kind/scope; every game represented in per-game volume; curated count ∈ [1, 2]; rule params in bounds (counts ≥ 1, `days ∈ [3, 365]`, `guesses ∈ {1,2,6}`). Enforced by **T-WEB-S163** (reads `content/medals/README.md` via `node:fs` — homed in `apps/web/test` because `packages/core` deliberately has no `@types/node` and its tsconfig typechecks `test/`, while web tests run under Node with the types already present; the games harness is the file-reading precedent): every `MedalId` appears in the README's catalog table and vice versa; the rejected sample has ≥ 10 entries; every `medalCopy` name/description passes the §3.1 mechanical rules (lengths, no emoji, no exclamation in names, the forbidden-vocabulary regex including the A3 additions, canary words, the past-tense first-word allowlist, threshold-digits parity against the rule params imported from `@miolos/core`). Exhaustiveness of `medalCopy` over `MedalId` is the `satisfies` typecheck (D15), not a runtime test.

---

## 4. Data & contract design

### 4.1 Migration 0005 + `packages/db/src/schema.ts`

Schema addition (after `hintGrants`), with a header comment carrying: NOT a wallet/ledger (append-only grant events; no quantity column exists to accumulate); rule-derived medals are NEVER stored here (ADR-0052); the v1 writer is the documented operator ritual, no code writer exists; pinned by T-DB-S38/S39/S43; merged by union-earliest-dedupe (merge.ts).

```ts
export const medalGrants = pgTable(
  "medal_grants",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    medalId: text("medal_id").notNull(),
    grantedAt: timestamptz("granted_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.medalId] }),
    check(
      "medal_grants_medal_id_check",
      sql`${t.medalId} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(${t.medalId}) <= 64`,
    ),
  ],
);
```

`pnpm --filter @miolos/db db:generate` produces **three commit-2 artifacts, all committed (B1):** `migrations/0005_<name>.sql` (expected DDL: one `CREATE TABLE` with the composite PK + CHECK, one `ALTER TABLE … FOREIGN KEY … ON DELETE cascade`), `migrations/meta/_journal.json` (now **6 entries** — the PGlite migrator reads the journal, not the dir listing, so a missing journal entry means the table silently never exists in tests), and `migrations/meta/0005_snapshot.json`. `db:migrate` is never run (schema.ts:284-290's own law); the apply path is §10, with its exit criterion: **the applied Neon DDL is byte-identical to the committed SQL**.

### 4.2 `packages/db/src/medals.ts` — one reader, exported via `@miolos/db/user`

```ts
/** The caller's curated medal grant ids — the grants input to
 *  earnedMedals (ADR-0052). Deterministic order; ≤ one row per medal id
 *  (the PK). granted_at is deliberately NOT selected: no date crosses
 *  the wire (ADR-0052/D6) — its readers are the merge's least() and the
 *  operator's audit queries. Rule-derived medals are NEVER read from
 *  here — they recompute over listCompletionsForStats. */
export async function listMedalGrants(
  db: Db,
  userId: string,
): Promise<string[]>
// select medal_id from medal_grants
// where user_id = ${userId} order by medal_id asc
```

No timestamptz is selected, so the `::text` conversion register (`todaySaoPaulo`/`getUserSince`, plan 033 deviation 1) isn't needed here; no JS `Date` in any statement (the file-header law) holds trivially. `user.ts` gains `listMedalGrants` and `medalGrants` (the `hintGrants`/`attachTokens` posture: user-scoped table named off the root entry) — the `user.test.ts` per-module pin and **T-DB-S5 (32 → 34)** widen in the same commit, with the file's accounting style: "#30 moved it by exactly two: `listMedalGrants` and `medalGrants` on the user entry, never the root." `user.test.ts:43`'s truncate list gains `medal_grants` (mirrors `hint_grants`' explicit listing). `user.ts:29-31`'s forward-reference comment ("and later #30's medals, ADR-0049 decision 6") is rewritten to shipped tense in the same commit (B5).

### 4.3 `mergeAccounts` — union-earliest-dedupe at the reserved extension point

Inserted between the current statement 5 (`hintGrants` delete) and statement 6 (tombstone) — two statements, D11's shape; `merge.ts:6`'s schema import gains `medalGrants` (B7):

```ts
// 5b. #30's curated medal grants: union-EARLIEST-dedupe (ADR-0009's
//     union-and-dedupe sentence in its own earliest-wins posture;
//     ADR-0049 decision 6's reserved seat). granted_at is COPIED, never
//     defaultNow() — re-stamping would move the recorded grant event.
//     On a shared medal the EARLIEST granted_at wins regardless of side:
//     least() in the conflict arm — one statement where completions
//     needed two, because a grant has exactly one merge-relevant column
//     (ADR-0052). Column list hand-spelled, pinned by T-DB-S42.
//     Individually idempotent: a re-run selects zero loser rows, and
//     least() is stable under reapplication.
await db.execute(sql`
  insert into medal_grants (user_id, medal_id, granted_at)
  select ${winnerId}::uuid, medal_id, granted_at
    from medal_grants where user_id = ${loserId}
  on conflict (user_id, medal_id)
  do update set granted_at = least(medal_grants.granted_at, excluded.granted_at)
`);
// 5c. The loser's grant rows go — "emptied" means EMPTIED; no row may
//     keep referencing the tombstone. Trivially idempotent.
await db.delete(medalGrants).where(eq(medalGrants.userId, loserId));
```

The header's extension-point sentence (merge.ts:94-100) is rewritten from future to shipped tense. Rule-derived medals need **zero** statements here — they recompute from the merged completions (the AC's own sentence, now true by construction). **T-DB-S20 widens to five tables, in one wording used everywhere (B8):** both the `snapshotState()` helper AND the test title at merge.test.ts:395 change — the claim becomes "the full users+sessions+completions+hint_grants+**medal_grants** state after run one deep-equals run two" — a sanctioned widening of the landed claim, stated identically here, in §8 and in §9. The suite also gains the **direct winner's-grant-survives assertion** (the merge.test.ts:445-451 precedent: grants on BOTH sides, then assert exactly the winner's row survives with its own `granted_at` — a snapshot alone cannot see an unscoped DELETE, both runs would deep-equal an identical zero-grant state). `merge.test.ts` mechanics (B7, spelled out): the schema import gains `medalGrants`; a `insertMedalGrant(userId, medalId, grantedAt?)` fixture helper joins the file; `snapshotState()` gains the `medal_grants` select; and the file's own truncate list at :32 gains `medal_grants`, moving together with `user.test.ts:43`'s.

### 4.4 `packages/core` — types, rule engine signature, contract verbatim

`packages/core/src/medals/definitions.ts`:

```ts
export type MedalRule =
  | { readonly kind: "totalWins"; readonly game: Game | null; readonly count: number } // late wins count (D4.1)
  | { readonly kind: "streakReached"; readonly days: number }                          // computeStreak reuse (D10)
  | { readonly kind: "perfectDaysReached"; readonly count: number }
  | { readonly kind: "termoGuessWins"; readonly guesses: 1 | 2 | 6; readonly count: number } // on-time only (D4.4)
  | { readonly kind: "eachGameWon" }
  | { readonly kind: "curated" };                                                      // earned via medal_grants only

export interface MedalDefinition {
  readonly id: string;   // literal-typed via the const catalog
  readonly rule: MedalRule;
}

export const MEDAL_DEFINITIONS = [ /* the 20–30, authored per §3 */ ] as const satisfies readonly MedalDefinition[];
export type MedalId = (typeof MEDAL_DEFINITIONS)[number]["id"];
// /*#__PURE__*/ is load-bearing, not tidiness (B10; the word-list.ts:61-78
// precedent): a module-level call is otherwise a side effect that can pin
// the module into chunks that only wanted a type. The annotation is
// fragile and invisible to the gates (route-client-js.mjs:214-219 records
// exactly that), so the PR's measured bundle figures remain the real check.
export const MEDAL_IDS: readonly MedalId[] = /*#__PURE__*/ MEDAL_DEFINITIONS.map(
  (d) => d.id,
);
```

`packages/core/src/medals/derive.ts`:

```ts
/** Pure. rows = the SAME listCompletionsForStats projection #29 ships
 *  (ADR-0049 D6, ADR-0051); grants = listMedalGrants' id list; today =
 *  the DB clock's SP day (todaySaoPaulo — never the client clock, A6).
 *  Rows dated after `today` are excluded before any rule runs —
 *  defence-in-depth mirroring computeStreak's own `day <= todayDay`
 *  guard: a future-dated won row can never be the count-th row of a
 *  volume medal. hintsUsed and elapsedMs are present on StatsRow and
 *  consumed by NOTHING here — structurally inexpressible in MedalRule
 *  (handoff 034 §5). Output in catalog order (no date exists to sort by
 *  — ADR-0052/D6); deterministic; permutation-invariant in rows and
 *  grants. */
export function earnedMedals(
  rows: readonly StatsRow[],
  grants: readonly string[],
  today: string,
): readonly MedalId[];
```

Barrel exports: `MEDAL_DEFINITIONS`, `MEDAL_IDS`, `MedalDefinition`, `MedalRule`, `MedalId`, `earnedMedals`, plus the contract pair below. (The three stats predicates stay off the barrel — B3.)

`packages/core/src/contracts/medals.ts`, **verbatim**:

```ts
import { z } from "zod";

/** A wire medal id — validated by SHAPE (the DB CHECK's slug grammar),
 *  never by enum (ADR-0052): the id SET is content, and content growth
 *  must be additive. ADR-0048 decision 3 protects the SHAPE — new
 *  keys/fields are a new contract, and the object below stays strict on
 *  keys — but it does not close a value set. An old client hit with a
 *  newly-added id parses fine and silently drops the unknown id at
 *  render (the drop-unknown rule, ADR-0052's honesty mechanism): a
 *  user's medal history never disappears on deploy skew. */
export const medalIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(64);

/** Body of GET /medals — the earned id set ONLY (ADR-0051 decision 3's
 *  "own endpoint and contract"; ADR-0052). Strict on keys on both ends.
 *  No names/descriptions on the wire: the client owns them (medalCopy).
 *  No earnedDate: the row renders name + description only, and for a
 *  late-counted feat the honest earning day is structurally unavailable
 *  (StatsRow carries no completedAt) — so no date field exists to lie
 *  (ADR-0052 hands the projection decision forward in writing). The
 *  array cap is a sanity bound deliberately DECOUPLED from the catalog
 *  length — coupling it would recreate the deploy-skew break the shape
 *  validation exists to avoid. Empty array = zero earned — a real,
 *  honest answer (D8 renders nothing). */
export const medalsResponseSchema = z.strictObject({
  medals: z
    .array(medalIdSchema)
    .max(64)
    .refine((medals) => new Set(medals).size === medals.length, {
      message: "duplicate medal id",
    }),
});
export type MedalsResponse = z.infer<typeof medalsResponseSchema>;
```

(The contract file imports nothing from the definitions module — contract and catalog are decoupled on purpose, D6.)

---

## 5. Core derivations — the rule-evaluation model

**Data-driven rule params with one evaluator per kind** — not per-medal functions. The argument: the harness can only mechanically validate what it can introspect (thresholds, bounds, duplicates, quotas — §3.3); 25 opaque functions would each need bespoke verification and the forbidden-inputs guarantee would decay to review vigilance, whereas a closed discriminated union makes `hintsUsed`/`elapsedMs`/time-of-day **inexpressible** and T-CORE-S70's discriminant-set pin makes widening it a deliberate act.

### 5.1 Evaluation, per kind

Shared predicates are **imported from `../stats`** — `countsOnTimeWon`, `countsLateWon`, `termoGuessOf`, newly module-level-exported (§1's one bounded core edit, B3): the exclusions keep their single spelling and `derive.ts` restates **nothing** — no second spelling of any predicate exists anywhere.

Evaluation begins with one shared filter — `rows` is narrowed to `date ≤ today` (A6) — and **one shared streak sweep** (B4): the distinct counted (on-time-won) dates are walked once, `computeStreak(rows, d)` per date, keeping the running maximum; every `streakReached` rule reads that single shared value. Then, per kind:

- **`totalWins {game, count}`** — qualifying rows: `outcome === "won"` (late included; `game` null = all games). Earned iff qualifying count ≥ `count`.
- **`streakReached {days}`** — D10 verbatim: earned iff the shared sweep's maximum ≥ `days`.
- **`perfectDaysReached {count}`** — earned iff `perfectDays(rows).length ≥ count` (the function is reused, never re-derived).
- **`termoGuessWins {guesses, count}`** — qualifying rows: `game === "termo" && countsOnTimeWon(row) && termoGuessOf(row) === guesses`. Earned iff count reached.
- **`eachGameWon`** — earned iff every `g ∈ GAMES` has ≥ 1 won row (late included — volume class).
- **`curated`** — earned iff a grant row with this id exists. Grants with ids not in the catalog, or naming a non-curated definition, are **ignored** (D2); duplicate ids in the input (impossible via the PK, defended anyway) collapse — the input is treated as a set.

### 5.2 Exclusions (each individually seam-2 tested)

Lost rows count for nothing except being absent (no rule consumes them); `hintsUsed`/`elapsedMs` consumed by nothing (structural + T-CORE-S70's kind pin); free-play/device state cannot reach the function (its only inputs are the two reader projections and the DB clock's day); late wins move `totalWins`/`eachGameWon` only — never `streakReached` (computeStreak's own exclusion), never `perfectDaysReached` (perfectDays' own), never `termoGuessWins` (the on-time conjunct); **rows dated after `today` count for nothing at all** (A6's guard — the shared `date ≤ today` filter runs before any rule, mirroring computeStreak's `day <= todayDay` defence-in-depth; the draft's "future rows are inert" sentence was false for volume rules — a future-dated won row would have been countable as the count-th row — and is deleted, replaced by this guard).

### 5.3 Ordering, determinism, recompute honesty

Output is `MEDAL_DEFINITIONS` filtered to the earned set, **in catalog order** — with no date on the wire (D6) there is no chronology to sort by, and catalog order is deterministic by construction, trivially permutation-invariant in rows and grants (T-CORE-S75 pins both properties anyway). Recompute honesty, recorded in ADR-0052: a future late row (#31) may newly earn a medal — derivations answer from history, and history can grow backward; nothing is ever un-earned by adding rows (the monotonicity property, T-CORE-S75). The earned **set** is the whole answer: no per-medal instant is stored, served, or displayed (D6/A1).

---

## 6. API route — `apps/api/app/medals/route.ts`

A **verbatim clone of the `GET /streak` template**, every deliberate absence preserved and restated in the header: `export const dynamic = "force-dynamic"`; local `errorResponse`; no OPTIONS/preflight change (credentialed GET, no custom headers — CORS simple request); no origin guard (a read); no content-type check (no body); **no request parameters**; whole body in try/catch → `500 "internal"`; auth FIRST and sequential via `requireUserId` (401 = zero queries); `Cache-Control: no-store` + `corsHeaders({ credentials: true })` on every branch; response `parse`d through the strict schema.

After auth (A6's decision — the streak route's exact three-read posture):

```ts
const [today, rows, grants] = await Promise.all([
  todaySaoPaulo(db),          // the DB clock's SP day the derivation anchors on — never new Date()
  listCompletionsForStats(db, userId),
  listMedalGrants(db, userId),
]);
```

Answer: `medalsResponseSchema.parse({ medals: earnedMedals(rows, grants, today) })`. `today` is a consumed input, not surface: every rule ignores rows dated after it (§5.2). Error posture: `401 no-session`, `500 internal`, nothing else.

**Read amplification, recorded (A10):** a signed-in `/estatisticas` visit now issues **three full-history reads** — `GET /stats`, `GET /stats/calendar`, `GET /medals`, each running `listCompletionsForStats` over every completion row. ADR-0051 D3's read-side revisit trigger is restated with the third reader in it, in ADR-0052: the per-user row trigger stays **~4,000 rows**, now carrying a **×3 per-screen multiplier** (≈ 12,000 row-reads per stats-screen visit at the trigger point). The number, not a shrug, is what #37 inherits.

`apps/api/app/account/delete/route.ts`: the two footprint comments (lines 43-44, 92-93) each gain `medal_grants` in their enumeration — comments only; the cascade itself is declared in the schema (D3).

---

## 7. Web — the medal section

### 7.1 Client plumbing — `apps/web/src/medals/`

- `medals-client.ts`: `fetchMedals(): Promise<MedalsResponse | undefined>` — byte-for-byte the `streak-client.ts`/`stats-client.ts` register: `NEXT_PUBLIC_API_URL` guard with the loud `console.error`, `credentials: "include"`, no custom headers, `safeParse`, every failure → `undefined`, the "BEHIND THE FREE-PLAY WALL" header. (A shape-valid unknown id **passes** the parse — the skew posture; the drop happens at render, §7.2.)
- `use-medals.ts`: the `use-streak.ts` mount-effect hook verbatim — `undefined` / `null` / value, cancelled flag, no options, no localStorage.

### 7.2 The section — inside `stats-view.tsx`, at the reserved slot

`MedalsSection` (a component in `stats-view.tsx`, painting with `page.module.css` — the island's own file-hashing reason) replaces the slot comment at :76-83; the comment is rewritten to the shipped state. It calls `useMedals()`, filters the payload to ids present in the bundled catalog (a `Set` over `MEDAL_IDS` — the drop-unknown rule, D6), and renders **nothing** — no wrapper, no heading — when the value is `undefined`, `null`, or the **known** subset is empty (D8; an all-unknown payload is the zero state too). With ≥ 1 known earned medal:

- A `<section>` with heading `messages.medals.title` (Fraunces, the screen's section-heading register) and a `<ul>` of rows in **catalog order** (D7 — no date exists to sort by) **[Fernando-adjustable:** ordering/density].
- **One row per earned medal — the list idiom, never a tile grid.** Anatomy: a small stamp-ring mark (a ~20px circle, 3px border, rotated −6deg — the completion-stamp register at DESIGN.md:39, typographic content only or empty); the medal **name** in `--ink`; the **description** in `--ink-2`. **The ring is one uniform hue for every medal: `--accent-app` (A8's decision, recorded here with its reason):** per-game accents are deliberately dropped — the medal list is an account-level surface, not a per-game screen, and a uniform ring removes the is-the-hue-an-identity-carrier question entirely (no ADR-0041 D5 argument is needed: the ring is decoration on rows that are all the same state — earned — so no meaning rides on hue, and the words beside it carry the message in `--ink`). No date renders anywhere in the row (D6/A1). Single column at all widths; the description wraps under the name on narrow viewports rather than forcing a column (the screen's mobile-overflow history is why this is binding, not advisory). Hairline separators between rows (the F5 stat-row register).
- **Banned, restated from the anti-references:** rounded icon tiles, any icon above a heading, decorative emoji (also mechanically excluded from copy by T-WEB-S163), gradients, glassmorphism, locked/greyed placeholders, progress meters. **No entrance/celebration animation** (§1 non-goal); if any motion is added later it is the stamp-settle register with a `prefers-reduced-motion` alternative — out of scope here.
- Accents colour the ring — a shape — never a word (ADR-0041 D1); all words `--ink`/`--ink-2`. Aim for zero accent text; if any accent-coloured word survives design iteration, the implementer owes the measured ≥ 4.5:1 ratio, the ADR-0041 (h) row, the `ALLOWED_ACCENT_TEXT` entry and its size-pin bump (budgeted as a possibility, not planned). Ratios for whatever ships are recorded in the PR body (the plan-033 §6.2 habit).
- Aria: the list item's accessible name via `messages.medals.earnedAria(name, description)` — a complete composer, never joined in the component (ADR-0018).
- Styles land in the existing `app/estatisticas/page.module.css` — **no new stylesheet**, so `ink-on-accent.test.ts`'s `SHEETS`/`SHARED` lists are already covering and stay untouched; if the implementer creates a new sheet after all, it joins both lists in the same commit (the shipped law).

**CLS duty (#37, uncornered):** the section is a post-fetch insertion whose height is unknowable pre-fetch (0 to ~30 rows), so no reservation is possible or attempted; the anonymous/zero case inserts nothing (CLS-neutral for the CI-visible state). The PR body records **the measured per-row height and section-header height in px, and the measured CLS contribution on a locally seeded earned state** — the number-not-a-shrug #37 inherits, the ADR-0051-consequences precedent.

### 7.3 i18n — `messages.ts`

Chrome (joins `messages`):

```ts
medals: {
  title: "Medalhas",
  // Complete aria composer (ADR-0018): the earned fact, whole. No date —
  // none exists on the wire (ADR-0052).
  earnedAria: (name: string, description: string) => `${name} — ${description}`,
},
```

The records (separate export, D15): `export const medalCopy = { ... } satisfies Record<MedalId, { name: string; description: string }>`.

**The register (A4's decision, applied):** every description is a one-sentence **past-tense statement of the achieved fact** — first word from §3.1's allowlist `{Acertou, Chegou, Concluiu, Estava, Venceu}`, CONTEXT.md's verbs, no imperatives, no "dias seguidos" (the streak noun is *sequência*, messages.ts:247's own recorded rejection). Register-setting proposals, all written out (final catalog authored at implement time against §3; **[Fernando-adjustable]**; audited against §3.1's full forbidden regex — no `então`/`mamãe`/`época`, no vetoed vocabulary below):

- `first-win` → **"Primeiro carimbo"** — *"Venceu um jogo diário pela primeira vez."* (`totalWins`, null, 1)
- `wins-100` → **"Cem vitórias"** — *"Venceu 100 jogos diários."* (`totalWins`, null, 100 — the threshold-digits rule shown)
- `streak-7` → **"Sequência de sete"** — *"Chegou a uma sequência de 7 dias."* (`streakReached`, 7 — name renamed per A3: the draft's "Sete dias seguidos" was the exact phrase messages.ts:247 records as rejected)
- `streak-30` → **"Um mês inteiro"** — *"Chegou a uma sequência de 30 dias."* (`streakReached`, 30)
- `perfect-1` → **"Quatro de quatro"** — *"Concluiu um Dia Perfeito: os quatro jogos no mesmo dia."* (`perfectDaysReached`, 1)
- `termo-first-try` → **"De primeira"** — *"Acertou o Termo na primeira tentativa."* (`termoGuessWins`, 1, 1)
- `all-games` → **"Circuito completo"** — *"Venceu cada um dos quatro jogos ao menos uma vez."* (`eachGameWon`)
- `founder` (curated) → **"Da primeira leva"** — *"Estava aqui quando tudo começou."*

No date formatter is imported and no `formatLongDate` call exists in the section (D6/A1).

**The `/privacidade` inventory line (A14's decision — shipped NOW, not deferred):** messages.ts:475's own comment forbids drift ("the page states EXACTLY what this release ships"), and a `medal_grants` row is operator-written data about the user — the cost is one string. `messages.privacy.collected` gains:

```ts
medals: "As medalhas: a maioria é calculada do seu histórico de jogos; algumas são concedidas manualmente pela equipe e ficam registradas na sua conta. Todas são apagadas junto com a conta.",
```

**[Fernando-adjustable:** wording.] `apps/web/app/privacidade/page.tsx` renders it as one more `<li>` in the collected block (after `:40`), and **T-WEB-S141 is extended in place** — one more `toContain(messages.privacy.collected.medals)` inside its landed claim ("the page renders the policy copy" — unchanged).

---

## 8. Walls, budgets, CI surfaces — every list that grows, by file

| File | Change |
|---|---|
| root `eslint.config.mjs` | `freePlayBannedModuleGroups` gains a new group `["**/medals", "**/medals/**"]` with an ADR-0052 message (the :284-293 stats-group pattern — both specifier shapes, the bare-`../medals` reason restated); `freePlayDynamicBannedModule`'s regex literal (:302) gains `medals(\/|$)` |
| `apps/web/test/eslint-free-play-wall.test.ts` | T-LINT-S33/S34 probes, ids on `it(...)` (that file's convention) |
| `packages/core/src/stats.ts` | **The one bounded edit (B3):** `export` on `countsOnTimeWon`, `countsLateWon`, `termoGuessOf` (:77-91) — module level only, never the index barrel |
| `packages/db/src/user.ts` + `test/user.test.ts` | Barrel gains `listMedalGrants` + `medalGrants`; per-module pin widened same commit; truncate list (:43) gains `medal_grants`; the :29-31 comment's "and later #30's medals" rewritten to shipped tense (B5) |
| `packages/db/test/published.test.ts` | **T-DB-S5**: array + `toHaveLength` **32 → 34**, same commit, with the accounting sentence ("#30 moved it by exactly two … never the root") |
| `packages/db/src/schema.ts` + `migrations/0005_*.sql` + `migrations/meta/_journal.json` + `migrations/meta/0005_snapshot.json` | §4.1 — all three generated artifacts committed (B1) |
| `packages/db/src/merge.ts` | §4.3 — the extension-point pair + header rewrite + the :6 schema import gains `medalGrants` (B7); nothing else |
| `packages/db/test/merge.test.ts` | §4.3's mechanics (B7/B8): `medalGrants` import, `insertMedalGrant` helper, `snapshotState()` + truncate list (:32) gain `medal_grants`, T-DB-S20 title widens to five tables, the direct winner's-grant-survives assertion, new describe with T-DB-S41/S42 |
| `apps/api/app/account/delete/route.ts` | Two comment lines (§6) |
| `apps/web/src/i18n/messages.ts` | `messages.medals` chrome + `medalCopy` export (D15) + `privacy.collected.medals` (A14) |
| `apps/web/app/privacidade/page.tsx` + `test/privacidade.test.tsx` | One `<li>` for the new inventory line; T-WEB-S141 extended in place (A14) |
| `apps/web/app/estatisticas/stats-view.tsx` | The slot comment becomes `MedalsSection` (§7.2) |
| `apps/web/app/estatisticas/page.tsx` | Comment-only (B5): :35-38's "(#30's future medal section)" rewritten to shipped tense |
| `apps/web/app/estatisticas/page.module.css` | Medal-row styles — no new sheet, `ink-on-accent` lists untouched (§7.2's conditional if that changes) |
| `apps/web/test/stats-page.test.tsx` | Gains `vi.mock("../src/medals/medals-client")` (B6) — see the named hazard below |

**The unmocked-third-client hazard, named (B6):** `stats-page.test.tsx:20-24` mocks only `stats-client` and renders the real `StatsPage`; without the new mock, `useMedals()` would run the real `fetchMedals` in jsdom — a loud `console.error` from the env guard in every one of its four tests and an un-acted `setValue`. This is distinct from the shared-Response poisoning trap, which applies to suites that mock `fetch` itself (that note stays, §9).

**Untouched, stated loudly:** `route-ssr.test.tsx`, `route-client-js.mjs` route classification (`/estatisticas` already in `BUDGETED`), `.github/workflows/impeccable.yml` (no new route), `ink-on-accent.test.ts`, T-DB-9a–9d (the root client's relational schema is the hand-picked wall-safe subset `{sessions, users}` — a new table never enters it), T-CORE-S69/S69a, T-DB-S24, T-WEB-S80.

**Bundle duty:** new client JS rides `/estatisticas` (shared 40 KB budget): `medals-client` + `use-medals` + `MedalsSection` + `medalCopy` + the definitions module (~1–2 KB of ids and rule params, imported for the drop-unknown `Set` and `medalCopy`'s key type). The PR body publishes **measured before/after raw-KB figures for `/estatisticas` and for the shared baseline** (`pnpm build && pnpm bundle-check`; build before typecheck wipes `.next`); D15's separate-export design is what keeps `medalCopy` out of every other route — the figures must show the other routes moved 0 KB, which is the measured tree-shake evidence (the `/*#__PURE__*/` annotation in §4.4 helps but is fragile and invisible to the gates — the figures are the real check, B10). If `/estatisticas` reds its budget, plan 033 §7's ordered response applies verbatim (shrink → per-route measured budget +≤10 % citing #30 → last-resort new pattern with written justification). `MAX_DELTA_BYTES` is never raised.

**Impeccable / ADR-0034 D4 — the substitute evidence, named:** CI's anonymous scan of `/estatisticas` sees **no medal section at all** (D8) and is therefore vacuously green for medals; AC 4's real evidence is: (a) jsdom T-WEB-S161/S162 (earned rows render as list rows with the copy composers; the empty states render nothing); (b) the mechanical tone/emoji/vocabulary checks (T-WEB-S163) standing in for the "restrained celebration" copy dimension; (c) a **local seeded browser pass** with screenshots (desktop + mobile) in the PR body, plus the measured ratios of §7.2; (d) the PR body stating explicitly that CI's green covers the zero state only — the plan-033 §6.2 honesty sentence, repeated.

---

## 9. Test plan

**Reserved ranges, contiguous from the frontier (re-derive with `grep -rhoE "T-[A-Z]+-S[0-9]+[a-z]?" apps packages | sort -u` before allocating and again at the end; unspent tails burn):** **T-CORE-S70–S79 · T-DB-S37–S43 · T-API-S92–S96 · T-WEB-S160–S165 · T-LINT-S33–S34.** Ids on `it(...)` in core/db/api, on `describe(...)` in web except `eslint-free-play-wall.test.ts` (its own `it(...)` convention). ADR-0023 vocabulary, carried into every test name and PR sentence (A9): "prove" only for construction-backed invariants; fixtures and property runs "pin"/"show" (sampled evidence); measurements "measure". Property tests: `numRuns: 100` minimum, pinned seeds (`seed: 20_260_813` — the repo's date-shaped register), epoch-day windows so day structure arises.

| Id | Where | Claim (one line) |
|---|---|---|
| T-CORE-S70 | `core/test/medals.test.ts` | The §3.3 definition harness: count 20–30 (independent of quotas), unique slug ids, the rule-kind discriminant set deep-equals the sanctioned six, per-kind quotas, threshold monotonicity **and ≥2× anti-ladder spacing**, curated 1–2, no duplicate rules, params in bounds — **no forbidden-input rule is expressible and none exists** |
| T-CORE-S71 | 〃 | Pins `totalWins`/`eachGameWon`: a manufactured late win counts, a lost row never, **a row dated after `today` never (A6's guard — it cannot be the count-th row)**; per-game scoping; `count − 1` rows → unearned, the nth row earns; `eachGameWon` needs all four games |
| T-CORE-S72 | 〃 | Pins `streakReached` (D10): earned iff the one shared sweep's maximum reaches N; a later break never un-earns; a late win never extends (computeStreak's own semantics, reached through reuse) |
| T-CORE-S73 | 〃 | Pins `perfectDaysReached` + `termoGuessWins`: Nth perfect day earns; a late win-in-1 never counts a guess medal; a lost Termo counts nothing |
| T-CORE-S74 | 〃 | Pins grants: a curated-id grant surfaces; a rule-derived-id grant and an unknown-id grant are ignored — never an error; duplicate ids collapse; output in catalog order |
| T-CORE-S75 | `core/test/medals-properties.test.ts` | **Property (≥100 runs, pinned seed):** monotonicity — for random row sets, `earnedMedals(rows ∪ extra, g, today) ⊇ earnedMedals(rows, g, today)`; plus determinism and permutation invariance of rows and grants |
| T-CORE-S76 | 〃 | **Property:** `streakReached` agrees with an independent run-length oracle over counted days (the earned set) — the sampled evidence that licenses D10's future single-pass optimization |
| T-CORE-S77 | `core/test/medals-contract.test.ts` | Pins the contract: strict on keys (unknown key fails), a shape-invalid id fails, **a shape-valid unknown id PARSES (the skew posture, asserted positively)**, duplicate id fails, > 64 ids fails, empty `medals` parses |
| T-DB-S37 | `db/test/medals.test.ts` | `listMedalGrants`: the caller's grant ids, deterministic order, `granted_at` never selected, other users' rows absent |
| T-DB-S38 | 〃 | `medal_grants`' column set is exactly `[granted_at, medal_id, user_id]` (the T-DB-20 anti-ledger pin, D12.2's reasoning in the comment) |
| T-DB-S39 | 〃 | **AC 3's teeth (D12.1):** the public base-table set deep-equals the sorted 8-name list — with the D12 residual (wallet-as-view, jsonb balances) named in the comment |
| T-DB-S40 | 〃 | The CHECK and PK reached the database (T-DB-21 sibling): an uppercase/overlong `medal_id` insert fails naming `medal_grants_medal_id_check`; a duplicate `(user_id, medal_id)` plain insert fails; `on conflict do nothing` inserts zero |
| T-DB-S41 | `db/test/merge.test.ts` (new sixth describe) | The union pair: loser's grants surface on the winner; **a shared medal keeps the EARLIEST `granted_at` whichever side carried it (`least()`, both directions tested — A7)**; the winner's own grant survives, asserted directly (the :445-451 precedent — a snapshot cannot see an unscoped DELETE); loser's rows emptied; a second `mergeAccounts` run is a full no-op |
| T-DB-S42 | 〃 | The grants merge statement's hand-spelled column list equals the live drizzle column set of `medalGrants` (the T-DB-S24 sibling — a future column fails the suite instead of silently defaulting on merged rows) |
| T-DB-S43 | `db/test/medals.test.ts` | **AC 3's teeth (D12.3):** the forbidden-vocabulary column scan (`balance|wallet|coin|point|credit|score|level|rank|xp`) returns zero rows across all public tables |
| T-API-S92 | `api/test/medals.test.ts` | `GET /medals` happy path over PGlite: seeded completions earn the expected rule-derived ids through the strict contract, thresholds visible at the seam (n−1 wins → absent, nth → present) |
| T-API-S93 | 〃 | Grants at the seam (AC 2, the manufactured-rows precedent): a directly-inserted grant row surfaces its id; a directly-inserted rule-derived-id row is ignored, never surfaced, never an error |
| T-API-S94 | 〃 | Discipline: cookieless → 401 with zero queries; thrown db → 500; `no-store` + CORS grant on every branch (the T-API-S53 pattern) |
| T-API-S95 | 〃 | Isolation: another user's completions and grants never move the caller's answer |
| T-API-S77a | `api/test/account-delete.test.ts` | Sibling inside S77's landed claim: a seeded `medal_grants` row is gone after the cascade delete (the :143 comment enumeration updated) |
| T-WEB-S160 | `web/test/medals-client.test.ts` | `fetchMedals`: parse success (a shape-valid unknown id included — it passes), env-unset guard, non-200/bad-schema/network → `undefined` (the streak-client suite's shape) |
| T-WEB-S161 | `web/test/medals-section.test.tsx` | Earned state (client mocked): list rows — never tiles — with name, description, the uniform `--accent-app` stamp-ring hook class, `earnedAria` composers, catalog order; **an unknown id in the payload is silently dropped — the known rows still render (D6)** |
| T-WEB-S162 | 〃 | The nothings (D8): unsettled, settled-`null`, empty-array, **and an all-unknown-ids payload** each render **no medal DOM at all**; the rest of the stats screen is unaffected |
| T-WEB-S163 | `web/test/medals-content.test.ts` | The content harness (§3.3, node:fs over `content/medals/README.md`): id↔README parity both directions, ≥10 rejected candidates, and every `medalCopy` record passes the mechanical tone rules (lengths, no emoji, no exclamation in names, the full forbidden-vocabulary regex incl. `dias seguidos` and the Terms-to-avoid, canary words, the past-tense first-word allowlist, threshold-digit parity with the rule params) |
| T-LINT-S33 | `eslint-free-play-wall.test.ts` | Static probes: free-play scope importing `src/medals/*` fails by name |
| T-LINT-S34 | 〃 | Dynamic-import regex probe for `medals(\/|$)` |

**Existing tripwires touched, exhaustively:** `user.test.ts` per-module pin + truncate list; `published.test.ts` T-DB-S5 (32 → 34); `merge.test.ts` T-DB-S20 — **helper AND title widen to five tables (B8's one wording, same as §4.3/§8)** — plus its truncate list, imports and the `insertMedalGrant` helper (B7); `account-delete.test.ts` (S77a sibling + comment); `privacidade.test.tsx` T-WEB-S141 extended in place (A14); `stats-page.test.tsx` gains the medals-client mock (B6). **Untouched and expected green:** T-CORE-S69/S69a (the `medals: []` strictness probe — the load-bearing green), T-DB-S24, T-DB-9a–9d (root `db.query` stays `["sessions","users"]`), T-DB-20/21, the T-WEB stats suites **except** `stats-page.test.tsx` (B6's one mock line), streak suites, `bundle-markers`, `route-ssr`, `ink-on-accent`. **Known landmine, planned around:** the shared-Response fetch-mock poisoning applies to suites that mock `fetch` itself — those hand out a **fresh Response per call or `.clone()`** (the napkin's trap; plan 033 deviation 4 is the precedent); the medal tests mock the *client module*, not `fetch`, wherever possible — and the unmocked-third-client hazard in `stats-page.test.tsx` is the distinct, named case (§8).

---

## 10. Migration / deploy notes — the exact Neon sequence (Q11)

Preview deploys share the **production** Neon DB (handoff 019), so the napkin rule fires at **first branch push**, not merge. The sequence, exactly:

1. **Work fully local.** Commits 1–6 (§12) land locally; PGlite runs the committed migrations **via `migrations/meta/_journal.json`** (B1 — the journal, not the dir listing, is what the migrator reads), so `0005_*.sql` + journal entry + `0005_snapshot.json` exist from commit 2 onward and the whole suite is green locally with **zero pushes**.
2. **Generate** `0005` with `pnpm --filter @miolos/db db:generate` (in commit 2); verify the journal now has **6 entries** and commit all three artifacts. `db:migrate` is never pointed anywhere (schema.ts:284-290's law).
3. **Apply to Neon BEFORE the branch's first push:** `vercel env pull` to an **absolute path outside the repo**; a temp script in the session scratchpad over `@neondatabase/serverless` using `DATABASE_URL_UNPOOLED`, splitting `0005_*.sql` on `--> statement-breakpoint` and executing each statement; then **verify** (`select count(*) from medal_grants` succeeds; the PK, CHECK and FK are present via `information_schema`; **exit criterion: the applied DDL is byte-identical to the committed `0005_*.sql` — the statements executed are the committed file's own, unedited, and the verification confirms every object it declares**); then **delete the script and the pulled env file**.
4. **Only then `git push`** and open the PR.

**Safety argument, stated without weakening the rule:** `0005` creates a brand-new table and touches nothing else, so the drizzle column-list trap (schema.ts:292-297) has no existing INSERT writer to break — the audit of "every writer of the table" is trivially empty. The rule is followed anyway, in full, because the branch's preview would 500 every `GET /medals` (and, via the shared module graph, any statement drizzle builds against `medalGrants`) until the table exists in prod — apply-before-push is still the only ordering with zero bad states. No `.env` change, no new dependency, no cron change.

---

## 11. Docs

- **This plan** → `docs/plans/035-issue-30-plan-medals.md` + its `docs/README.md` "Current" row, same PR.
- **ADR-0052** (D14's ten decisions) → real file + `docs/README.md` row, same PR. Amendment audit at write, at commit, at exit: amends nothing; no reciprocal lines.
- **`content/medals/README.md`** (§3) — content, not docs/; no README row owed (the Termo content precedent).
- **CONTEXT.md:** the **Medal** row (:19) drops future tense and gains the ADR-0052 citation; one new row — **Curated grant / Medalha concedida**: "An explicit `medal_grants` row for a medal not computable from completion rows (founder/cheater class, ADR-0006). Unioned-and-deduped on merge, earliest grant date winning (ADR-0009, ADR-0052); rule-derived medals are never stored." Proposed via the domain-modeling posture, **[Fernando-adjustable]**.
- **`docs/agents/test-ids.md`** frontier re-derived at the end with the grep.
- **Shipped NOW, no longer deferred (A14):** the `/privacidade` inventory line for operator-recorded medal grants (§7.3) — messages.ts:475's comment forbids page/mechanism drift, so the line lands in the same PR as the table.
- **Left for #37, on purpose (uncornered):** the **founder grant execution** — window fixed at the launch instant, the documented one-shot bulk insert run from the launch checklist (the definition, the procedure and the written ADR-0052 obligation all ship in this PR; A13); the CLS number (this PR records the measurement, §7.2); the bundle figures (published in this PR's body for #37 to inherit); the deletion-exercised-end-to-end audit (this PR ships the cascade + the T-API-S77a evidence it needs).

---

## 12. Execution order

Pre-commit runs the full suite at every commit; the order below keeps every commit green (migration 0005 + journal + snapshot exist from the first db commit; T-DB-S5 widens in the same commit as the exports; `TURBO_CONCURRENCY=1` on every `git commit`; nvm preamble; turbo `--force` when gate evidence is wanted; build before typecheck when bundle-check follows).

1. **Branch** `feat/30-medals` off `main`. Re-run the test-id grep; confirm §9's ranges still start at the frontier (if moved, shift whole ranges and note in §14).
2. **Read first:** CLAUDE.md; issue #30; ADR-0006/0008/0009/0015/0027/0031/0041/0049 D6/0051; handoff 034 §5; `merge.ts` in full; `streak/route.ts` + its test; `stats-view.tsx`; `content/termo/README.md` + `word-list.test.ts` (the harness shape); the napkin (Deploy & Migration Ordering, Execution).
3. **Commit 1 — content + core** (`feat(core): medal definitions, derivations and contract (#30)`): `content/medals/README.md` per §3 **with the catalog authored now** (the AI-curation moment, against the constraints, rejected sample recorded); `src/medals/{definitions,derive}.ts`; the three-predicate `export` edit in `stats.ts` (B3); `contracts/medals.ts`; barrel; T-CORE-S70–S77. Gate: core typecheck + tests; T-CORE-S69 must be green untouched.
4. **Commit 2 — db schema + reader** (`feat(db): medal_grants table, migration 0005 and reader (#30)`): schema.ts; `db:generate` → **committed `0005_*.sql` + `_journal.json` (6 entries) + `0005_snapshot.json`** (B1); `src/medals.ts`; `user.ts` barrel + its :29-31 comment rewrite (B5); `user.test.ts` pin + truncate list; T-DB-S5 → 34; T-DB-S37–S40 + S43. Gate: db tests over PGlite (0005 now runs there via the journal).
5. **Commit 3 — merge** (`feat(db): curated-grant union-earliest-dedupe on merge (#30)`): the §4.3 pair + header rewrite + schema import; T-DB-S41/S42; T-DB-S20 title + snapshot widening, `insertMedalGrant`, truncate list (B7/B8).
6. **Commit 4 — api** (`feat(api): GET /medals (#30)`): the route (three-read `Promise.all` incl. `todaySaoPaulo` — A6); account-delete comments; T-API-S92–S95 + S77a.
7. **Commit 5 — web** (`feat(web): medal section on /estatisticas (#30)`): `src/medals/*`; wall group + regex + T-LINT-S33/S34; `messages.medals` + `medalCopy` + `privacy.collected.medals` (A14); the `/privacidade` `<li>` + T-WEB-S141 extension; `MedalsSection` + styles in `page.module.css`; `page.tsx:35-38` comment rewrite (B5); `stats-page.test.tsx`'s medals-client mock (B6); T-WEB-S160–S163.
8. **Commit 6 — docs** (`docs: plan 035, ADR-0052, context and readme rows (#30)`): all §11 items; frontier re-derived.
9. **Neon apply** (§10 step 3) — **before any push**; byte-identical DDL verified.
10. **First push**; bundle evidence (`pnpm build && pnpm bundle-check`, figures for `/estatisticas` + measured confirmation other routes moved 0 KB); local seeded browser pass + screenshots; **full mechanical gate with pasted output**: `source ~/.nvm/nvm.sh && nvm use default >/dev/null && pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm bundle-check`. PR body: figures, CLS/row-height measurements, ratios, the zero-state-only impeccable caveat, and the **three Fernando flags**: D8's nothing-at-zero; the catalog's names and descriptions; **the founder-grant launch obligation handed to #37's checklist (A13)**.

---

## 13. Exit criteria

- [ ] AC 1: 20–30 definitions in `definitions.ts`, authored against §3's shipped constraints file (quotas summing inside [20, 30] by the §3.1 arithmetic, total independently asserted), pt-BR copy in `medalCopy` in the past-tense register; T-CORE-S70 + T-WEB-S163 green (count, quotas, spacing, tone mechanics incl. the mood allowlist and the widened forbidden regex, README parity, rejected sample ≥ 10).
- [ ] AC 2: rule-derived medals recompute at seam 2 (T-CORE-S71–S76) and seam 4 (T-API-S92) over `listCompletionsForStats` with zero merge-specific code (`git diff main -- packages/core/src/merge.ts` empty); curated grants survive merge by union-earliest-dedupe (T-DB-S41 — earliest `granted_at` wins via `least()`, both directions), timestamps copied (grep: no `defaultNow` in merge.ts), each statement individually idempotent (T-DB-S20's five-table double-run snapshot green).
- [ ] AC 3: T-DB-S39 (table set) + T-DB-S43 (vocabulary scan) + T-DB-S38 (column pin) green; no wallet/ledger/XP/ranking table or column exists; the jsonb/view residual named in the test comment and ADR-0052.
- [ ] AC 4: list idiom shipped (no tile grid, no emoji — T-WEB-S161/S163), uniform `--accent-app` ring (A8), nothing-at-zero (T-WEB-S162), `npx impeccable detect` green in CI with the PR body stating that green covers the empty state only, plus the §8 substitute evidence (seeded screenshots, measured ratios).
- [ ] No medal rule consumes `hintsUsed`, `elapsedMs`, device state or free play — structurally (T-CORE-S70's kind pin) and by grep (`grep -n "hintsUsed\|elapsedMs" packages/core/src/medals/` returns nothing).
- [ ] The wire carries the earned id set only: no `earnedDate`, no names/descriptions (D6/A1); ids shape-validated, never enum'd (A2); the drop-unknown client rule tested (T-WEB-S161/S162); `statsResponseSchema`/`statsCalendarResponseSchema`/`streakResponseSchema` byte-untouched; T-CORE-S69/S69a green; `GET /medals` is strict on keys, parameterless, `no-store` on every branch, and anchors on `todaySaoPaulo` (A6).
- [ ] Migration 0005 applied to Neon **before** the branch's first push (PR body states the apply timestamp vs first-push timestamp); **applied DDL byte-identical to the committed SQL (B1)**; all three generated artifacts committed (`0005_*.sql`, `_journal.json` at 6 entries, `0005_snapshot.json`); script + pulled env deleted.
- [ ] T-DB-S5 at 34 with the accounting sentence, same commit as the exports; both truncate lists widened (`user.test.ts:43`, `merge.test.ts:32`); both account-delete comments name `medal_grants`; T-API-S77a green; the B5 comment rewrites landed (`page.tsx:35-38`, `user.ts:29-31`); `stats.ts` diff is exactly three `export` keywords (B3).
- [ ] The `/privacidade` inventory line shipped (A14): `messages.privacy.collected.medals`, the page `<li>`, T-WEB-S141 extended and green.
- [ ] The founder medal complete (A13): definition shipped, procedure documented in ADR-0052, #37 launch-checklist obligation recorded in ADR-0052 and flagged in the PR body.
- [ ] Wall probes red-then-green for `**/medals` (static + dynamic); no new route, no impeccable.yml/route-ssr/route-classification diff.
- [ ] Bundle figures published; non-stats routes measured at 0 KB moved (the `medalCopy` tree-shake evidence); `MAX_DELTA_BYTES` untouched.
- [ ] Plan 035 + ADR-0052 + two `docs/README.md` rows + CONTEXT.md rows in the PR; ADR-0052 amends nothing (audited three times); test-id frontier re-derived; unspent id tails burned.
- [ ] Full gate output pasted; pre-commit never bypassed.

---

## 14. Risks & deviations register

*Revised at step 4 (2026-08-14) against the step-3 reviews A (ADR adherence, REJECT) and B (feasibility, REJECT): every finding A1–A14 and B1–B11 is resolved in the body above per the recorded fix directions — the wire drops `earnedDate` and enum-validation (A1/A2), the copy register is past-tense with the widened forbidden regex (A3/A4), the quotas sum inside [20, 30] (A5), the derivation anchors on `today` (A6), the merge takes `least()` (A7), the ring is uniform (A8), the ADR-0023 vocabulary is swept (A9), the read amplification is numbered (A10), the ladder defence is written (A11), the tripwire ids are S39/S43 (A12/B2), the founder medal is completed (A13), the privacy line ships now (A14), and B's feasibility corrections (artifacts, predicates, shared sweep, comment edits, mocks, merge-test mechanics, S20 wording, filenames, PURE, barrel status) are folded in where each pointed.* Otherwise empty at plan time; the implement agent appends every deviation here with the reason and the section deviated from. Pre-identified watch items: (1) the shared-Response fetch-mock poisoning for suites that mock `fetch` — every such mock hands out fresh/cloned Responses (plan 033 deviation 4's exact class); the named distinct case is `stats-page.test.tsx`'s unmocked third client, closed by B6's mock; (2) `medalCopy` tree-shaking — if the bundle figures show medal prose in non-stats chunks, move `medalCopy` to `apps/web/src/medals/copy.ts` importing nothing from `messages` (still ADR-0018-compliant: typed, in-repo, composed) and record the deviation; (3) ~30 earned rows of vertical space on mobile — compactness is bounded but unmeasured until the seeded pass; Fernando may ask for a collapsed-beyond-N treatment (a *product* addition, not planned); (4) curation quality — the mechanical harness pins invariants, not taste; the PR flags the full catalog table for Fernando's read; (5) D10's O(D·R) shared sweep — fine at v1 scale, trigger recorded with the corrected once-per-request arithmetic; T-CORE-S76 is the pre-paid sampled evidence for the optimization; (6) the `/*#__PURE__*/` annotation on `MEDAL_IDS` is fragile and invisible to the gates (route-client-js.mjs:214-219) — the measured figures, not the annotation, are what the exit criterion trusts.

**Implement-step deviations (appended 2026-08-13, backend half — commits 1–4):**

1. **§13's two grep-shaped exit criteria are satisfied in code, not in comment bytes** (deviates from §13, caused by §4.4/§4.3 themselves). §13 asks that `grep -n "hintsUsed\|elapsedMs" packages/core/src/medals/` return nothing — but §4.4's own prescribed doc comment for `earnedMedals` contains the sentence "hintsUsed and elapsedMs are present on StatsRow and consumed by NOTHING here", so the grep matches exactly the comments the plan mandates (definitions.ts header + derive.ts doc; zero code matches — the union makes the inputs inexpressible and T-CORE-S70 pins the discriminant set). Same class for "grep: no `defaultNow` in merge.ts": the §4.3 comment prescribed verbatim says "never defaultNow()" (and main's statement (ii) comment already said the same); no `defaultNow()` call exists in `mergeAccounts`' medal statements. The plan's prescribed comments won over the literal grep; both criteria hold for code.
2. **§12 step 1 frontier check: confirmed, no shift.** `grep -rhoE "T-[A-Z]+-S[0-9]+[a-z]?" apps packages | sort -u` at branch time: CORE max S69a → S70 free; DB max S36 → S37; API max S91 → S92; WEB max S159 → S160; LINT max S32 → S33 — §9's ranges start exactly at the frontier. Backend ids spent: T-CORE-S70–S77 (S78–S79 unspent, burn), T-DB-S37–S43 (all spent), T-API-S92–S95 + S77a (S96 unspent, burns).

**Implement-step deviations (appended 2026-08-14, web half — commit 5):**

3. **§14 watch item 2's recorded fallback is APPLIED — `medalCopy` lives in `apps/web/src/medals/copy.ts`, not in `messages.ts`** (deviates from D15/§7.3's stated home, exactly along the pre-recorded fallback path; measured, not guessed). With `medalCopy` as a second export of `messages.ts`, Turbopack did NOT eliminate the unused export: the prose chunk rode the first-load set of 15 of 17 routes (all but `/modo-livre` and `/_not-found`), and `/`'s raw First Load JS grew 822.6 → 824.9 KB (+2.3 KB) with every non-stats route up ~+2.2 KB. After the move, `grep -rl "Primeiro carimbo" .next/static/chunks` matches exactly ONE chunk, present only in `/estatisticas`' `firstLoadChunkPaths` (route-bundle-stats.json cross-check). Consequence, deliberate: D15's sentence "`medalCopy` stays a distinct named export through the i18n barrel too" is **inverted, not honored** — a barrel re-export from `src/i18n/index.ts` would put `copy.ts` back in the module graph of every i18n-importing route, recreating the leak — so the barrel deliberately does NOT re-export it (its comment records why) and the section + tests import `../src/medals/copy` directly. D15's other halves stand: chrome (`medals.title`, `earnedAria`) in `messages`, same ADR-0018 contract (typed, in-repo, composed), `satisfies Record<MedalId, …>` exhaustiveness.
4. **"Other routes moved 0 KB" holds for the medal PROSE, not for the raw route figures** (deviates from §8's bundle-duty wording as literally written, caused by the plan's own D15/A14 additions to the shared `messages` object). Non-stats routes moved +0.2–0.3 KB raw (≤ +0.1 KB gzip): that growth is `messages.medals` chrome (which D15 itself homes in `messages`) plus `messages.privacy.collected.medals` (A14's line, shipped now on purpose) riding the shared chunk — planned shared-copy content, not medal prose. The tree-shake evidence the exit criterion actually wants is the deviation-3 grep: the prose chunk is absent from every non-`/estatisticas` first-load set, and `/estatisticas` itself is the only route whose delta moved by more than the shared-chrome epsilon (813.5 → 818.8 KB raw, −4.1 KB vs the 40 KB budget). `MAX_DELTA_BYTES` untouched.
5. **Web/lint id accounting:** T-WEB-S160–S163 spent (S164–S165 unspent, burn); T-LINT-S33–S34 both spent. Ids on `describe(...)` in the three web suites, on `it(...)` in `eslint-free-play-wall.test.ts` (that file's convention), per §9.

**Step-7 deviations (appended 2026-08-14, after the six step-6 lenses):**

6. **The measured-CLS attribution is corrected — the number is the medal section's, not the screen's** (deviates from §11's "whole screen's post-fetch settle" framing, carried into ADR-0052's consequences and the PR body; the step-6 performance lens caught it). #29's surfaces are dimension-reserved and contribute ≈ 0 (`BLANK_VALUE` swaps in place; the calendar is last-in-flow), so 0.251 desktop / 0.677 mobile is the medal section's unreserved post-paint insert at 13 earned rows — decision 8's deliberate cost. Common case decomposed alongside the worst case (1 row ≈ 97 px desktop / 92–111 px mobile → CLS ≈ 0.10–0.14 mobile). The zero-product-change mitigation (section after `CalendarSection`) exists but the current slot is plan 033 D10's product order — flagged as Fernando's call in the PR, not moved. ADR-0052's consequences and the PR body both carry the corrected decomposition.
7. **ADR-0052 amends ADR-0018 — the plan's and the ADR's "amends nothing" audit was wrong** (deviates from §5's amendment-audit conclusion; the step-6 ADR-adherence lens caught it, HIGH). Deviation 3's `medalCopy` move falsifies ADR-0018's "all UI copy and metadata strings live in `messages.ts`" as an absolute; the code is measured-correct, so the record changed, not the code: ADR-0052 now carries `**Amends:** ADR-0018` plus the decision-5 narrowing paragraph (bulk per-item copy whose measured bundle cost forces it out of the shared module may live in its own typed in-repo module; chrome stays in `messages.ts`; the barrel must not re-export it), and ADR-0018 carries the reciprocal `**Amended by:** ADR-0052` line — the 0033↔0047 idiom, same docs commit.
8. **The `earnedAria` composer is deleted and the ring's rotation dropped — the visible text is the accessible content** (deviates from §7.2's aria prescription, §7.3's `earnedAria` key and its `messages` snippet, §9's T-WEB-S161 row, and deviation 3's own "chrome (`medals.title`, `earnedAria`)" clause; the step-6 correctness lens caught the defect, MEDIUM, and the verification round caught this register gap). WebKit strips list semantics from a `list-style: none` list, making the `li` a name-prohibited `generic` that drops `aria-label` — with the row text `aria-hidden`, VoiceOver announced nothing. The fix un-hides the words span (name + description are the accessible content, correctly ordered), deletes the now-consumerless `earnedAria` composer from `messages.medals` (its chrome is `title` alone), and adds `role="list"` to the `<ul>` (the standard WebKit workaround, comment in place); T-WEB-S161 now asserts the text is reachable by role, strictly stronger than the attribute-string assertion the plan prescribed. Separately, §7.2's "subtle static rotation" on the medal ring was a guaranteed no-op — a 20px border-only circle is rotationally symmetric — so the `transform` is deleted and the comment states the ring is the completion stamp's outline only (DESIGN.md:39's rotation returns only with typographic content). Wherever this register or deviation 3 says `earnedAria` exists, this entry supersedes it.

