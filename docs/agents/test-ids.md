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

Frontier as of plan 040 (#34), re-derived by grep over the branch at its step-5 exit. It is a snapshot, not a guarantee: re-run the grep before allocating, and re-derive it at step 8 of any ticket that adds ids. The live series is `S` everywhere; the bare series are closed and nothing is ever added to them.

**Plan 037's reservations are now fully resolved.** PR 2 spent `T-DB-S44…S55` and `S57`, `T-WEB-S166…S186` and `T-LINT-S35…S37`; the tails `T-WEB-S187`/`S188` and `T-LINT-S38` were its reserved review-round headroom and are **burned** below, unspent. Nothing in plan 037's ranges is a live reservation any more, and "next free" below is a plain frontier again.

The grep that produces it, per area — titles only, so a cross-reference in a comment is not mistaken for an allocation:

```
grep -rhoE "T-<AREA>-S[0-9]+[a-z]?" apps packages | sort -u
```

| Area | Next free | Highest in use | Bare series closed at |
|---|---|---|---|
| `T-CORE` | `S86` | `S84` | never used |
| `T-DB` | `S59` | `S58` | `T-DB-21` |
| `T-API` | `S109` | `S107` | `T-API-16` |
| `T-WEB` | `S212` | `S209` | `T-WEB-23` |
| `T-LINT` | `S46` | `S45` | `T-LINT-10` |

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

#30 (plan 035) reserved `T-CORE-S70…S79`, `T-DB-S37…S43`, `T-API-S92…S96`, `T-WEB-S160…S165` and `T-LINT-S33…S34`, and spent `T-CORE-S70…S77`, `T-DB-S37…S43` (the whole db range), `T-API-S92…S95`, `T-WEB-S160…S163` and `T-LINT-S33`/`S34` (the whole lint range) at step 5, plus one sibling letter — `T-API-S77a` (`account-delete.test.ts`, the medal-grants cascade assertion inside `T-API-S77`'s landed claim — the sibling rule, not a fresh number). The tails (`T-CORE-S78`/`S79`, `T-API-S96`, `T-WEB-S164`/`S165`) are the reserved review-round headroom and are **burned if unspent** per the rule below. `T-LINT-S33`/`S34` sit on `it(...)` in `eslint-free-play-wall.test.ts` (that file's own convention, per the note above); the other web ids sit on `describe(...)`.

#31 (plan 037) reserved `T-CORE-S80…S85`, `T-DB-S44…S57`, `T-API-S97…S108`, `T-WEB-S166…S188` and `T-LINT-S35…S38` across **two pull requests**, and its PR 1 (the write window) spent `T-CORE-S80…S84`, `T-DB-S56` and `T-API-S97…S107` at step 5. The rest of the DB, WEB and LINT ranges belong to PR 2 and are live reservations, not free space. The tails `T-CORE-S85` and `T-API-S108` were PR 1's reserved review-round headroom and are **burned** below, unspent.

PR 1 also spent two sibling letters at step 7, each a new assertion inside a landed id's claim rather than a fresh number: **`T-DB-S56a`** (the ceiling holds under a concurrent `Promise.all`, `packages/db/test/user.test.ts` — the guarded-insert half of step-6 finding F1) and **`T-API-S107a`** (the source scan pinning that 429 is absent from the web client's terminal-status set). `T-API-S107a` is a **rename**: step 5 shipped that assertion as a second `it(...)` also titled `T-API-S107`, which is the duplicate this document's own rule forbids (step-6 finding F17).

At the **step-7 verification round** PR 1 spent one fresh post-range id — **`T-DB-S58`** (the guarded INSERT renders byte-identically through the `neon-http` and PGlite dialects, as one statement; `packages/db/test/user.test.ts`). It is a new claim, not a widening, so it takes a number rather than a sibling letter, and it is taken from *above* PR 2's live reservations (`T-DB-S44…S55`, `S57`) rather than out of them — the #19/#21 precedent for fresh post-tail ids at step 7. The burned tails stay burned.

Four existing claims were widened in place and correctly took **no** new id — `T-API-9b`, `T-API-S12`, `T-API-S23b` and `T-API-S37`, for the write window's inverted lower bound. A route test whose expected status flips is the same claim about the same gate. `T-DB-9e` and `T-DB-S5` were widened at step 5 for a counter export and then **restored to their landed values** at step 7 (15 names and 34): folding the ceiling into `recordCompletion`'s own INSERT means #31's first pull request adds no runtime export to any package entry at all.

**PR 2 (the archive itself)** spent `T-DB-S44…S55` and `S57` (the archive wall suite, the malformed-row 404 and the DB-clock classifier), `T-WEB-S166…S186` and `T-LINT-S35…S37`, all at step 5, and **took no fresh post-range ids**. The tails `T-WEB-S187`/`S188` and `T-LINT-S38` are burned, unspent.

**It did take two sibling letters, at its step-7 round** — `T-DB-S53a` and `T-DB-S53b`, in `packages/db/test/published.test.ts`. They landed at step 5 as two `it(...)` blocks under the SAME `T-DB-S53`, split only by a `(a)`/`(b)` in the prose: a same-file, same-id duplicate, which is the exact defect that closed the bare space, and this paragraph said "no sibling letters" while it stood (step-6 F17). Two further consequences of the parenthesised form are why it could not simply be left: the grep below reduces `T-DB-S53(b)` to `T-DB-S53`, so nothing resolved the citation, and `published.ts` cited both halves by it. Renamed, with its three source citations.

**And two more at its step-7 VERIFICATION round, both of them duplicates the step-7 round itself had created** (plan 037 §14 I64/I65) — **`T-WEB-S177a`** (the archived Termo's word, `apps/web/test/archive-result.test.tsx:309`, which landed as a second `describe` under `T-WEB-S177` in the same round that split `T-DB-S53` for that defect) and **`T-LINT-S37a`** (the non-vacuity counter-assertion, `apps/web/test/eslint-db-wall.test.ts:866`). Both are new assertions inside a landed id's claim, so both take the letter rather than a number — the `T-API-S107a` precedent. `T-LINT-S37` stays on the assertion §13's AC 2 cites by name.

**The archive's nine test files put their ids on `describe(...)` only**, which is `apps/web`'s shipped convention as stated at the top of this document. They landed carrying the id on the enclosing `describe` **and** on all 53 `it(...)` titles, and this document was edited in the same pull request without recording the divergence (step-6 F18). The `it(...)` prefixes are gone; every one of them was identical to its `describe`'s, so no claim moved and no id changed hands. **`apps/web/test/play-record.test.ts:308-372` had the same shape and was missed** — `T-WEB-S186` on the `describe` and on all five of its `it(...)`s — and its five prefixes went at the verification round, on the same terms (§14 I65).

**The two `eslint-*-wall.test.ts` files keep their own `it(...)` convention**, which the #30 note above already records — and the whole of it: the id lives on `it(...)`, one id per `it(...)`, and the `describe`s carry a topic and no id. A `describe` in those files that repeats its own `it(...)`'s id is a same-file duplicate under either convention, not an exemption from the rule; `T-LINT-S37`'s block landed doing exactly that and was corrected at the verification round (§14 I65).

Five existing claims were widened in place and correctly took **no** new id in PR 2 — `T-DB-9a` (4 → 8 names), `T-DB-9b` (8 → 12), `T-DB-S5` (34 → 38), `T-WEB-S56` (seven archive rows in its `ROUTES` table, the `T-WEB-S100` burn precedent) and the two hub-link href assertions inside `T-WEB-S114`'s and `T-WEB-S159`'s blocks, which flipped from "Arquivo is href-less" to "Arquivo carries `routes.archive`". A tripwire that counts one more export, and a link assertion whose expected value flips, are the same claims about the same gates. The existing `prunePlayRecords` claims in `apps/web/test/play-record.test.ts` were likewise re-stated under retention without new ids, beside the genuinely new `T-WEB-S186`.

**PR 2's step-7 round widened FIVE claims in place and took no new id.** `T-WEB-S178` gains the `rejected` and no-record arms of the late-result panel and the `usePriorConclusion` remount case — all of them AC 4's UI half, which is what that id names; `T-WEB-S185`'s byte-identity `it` becomes an `it.each` over all four games, which is the same claim about the same gate for the three games it was already asserted of in prose; **`T-WEB-16b`** gains the mixed-date queue in `apps/web/test/play-sync.test.ts` — a `break` on the first 429 asserted over a queue with more than one date is the same claim about the same gate, and this one went unlisted until the verification round found it (§14 I70); and its own step-7 **verification** round added `T-WEB-S169`'s two sibling-label `it`s (the `all-caps-body` gate over all twelve months, plus the stylesheet scan) — a page whose label shape nothing asserted, the same hole `c0ae8f0` closed for its rows one commit earlier. The two assertions this paragraph used to count here as widenings of `T-WEB-S177` and `T-LINT-S37` were **same-file duplicates** and took sibling letters instead; see the sibling-letter paragraph above. A claim proved for more of its own stated scope is the same claim; a second `describe` under a landed id is not.

#34 (plan 040) reserved `T-WEB-S189…S211` and `T-LINT-S39…S45`, and spent `T-WEB-S189…S209` and **the whole `T-LINT` range, S39…S45**, at step 5. No `T-CORE`, `T-DB` or `T-API` id was reserved or spent: nothing in `packages` or `apps/api` moves. The tails `T-WEB-S210`/`S211` are the reserved review-round headroom and are **burned if unspent** per the rule below; `T-LINT-S45` was **spent** rather than burned, which has a consequence worth stating here rather than leaving to a reviewer — **the `T-LINT` range now has no headroom at all**, so a step-6 or step-7 round that needs a lint id takes `T-LINT-S46`. (S45 went on the OG wall's *legal-imports* control: the four probes above it are all bans, a wall that reds on everything proves nothing about what it bans, and `T-LINT-S18` — *"the free-play directory's LEGAL surface lints clean"* — is the precedent for giving that control its own id.)

**Three sibling letters, and two of them are CROSS-FILE — recorded in those words so the next derivation does not read them as a precedent for splitting one claim across two files.** `T-LINT-S8a` is the ordinary kind: the db wall asserted from inside `apps/web/src/og/**`, the new source directory #34 adds, in `eslint-db-wall.test.ts` where that claim already lives — exactly the `T-LINT-S8` shape #27 established when it added a source directory. `T-WEB-S192a` and `T-WEB-S206a` are the other kind: each is the second half of a claim whose halves must live in different files, and the letter exists to avoid a **same-id duplicate across two files**, not to license spreading one assertion around. `T-WEB-S192` pins that no route literal enters the pure composer (`share-text.test.ts`); `T-WEB-S192a` pins that the call site composes the permalink from the shipped builders (`conclusion-share.test.tsx`) — a different file because the subject is a React component. `T-WEB-S206` audits `messages.share` and `T-WEB-S206a` audits `messages.og`, which could not land in the same batch as `messages.share` because its subject did not exist yet. Where a claim genuinely fits in one file, it stays in one file: that is what `T-WEB-S209` did, going into `archive-metadata.test.ts` as a new `describe` rather than becoming a letter on `T-WEB-S207` in another suite.

**One landed claim was re-aimed in place and correctly took no new id** — `T-WEB-S96` in `termo-conclusion.test.tsx`. Its two assertions rode `role="status"`, which stopped being unique on the conclusion the moment the share button's always-rendered live region landed: one of them asserted *"no live region"* and became false, the other used a bare `getByRole("status")` and became ambiguous. Both are re-aimed at the outcome announcer's own class — which is the claim S96 was always making — with #34 named in the comment, and the first is re-aimed **with a counted floor** (exactly one `role="status"` element survives and its text is empty) so a future ticket cannot reintroduce a chatty region under it. A claim re-aimed at the element it was always about is the same claim. `T-WEB-S173` is untouched — it is a green suite about three routes #34 does not change.

Four same-file, same-claim duplicates predate this branch and are deliberately left alone rather than renumbered — `T-API-S4` (×4, `cron-publish.test.ts`), `T-API-S5`, `T-API-S6` and `T-API-S13`. They ship on `main`, they are cited from plans and PR bodies, and renumbering a landed id is the thing that closed the bare space. New duplicates take the sibling letter instead — **and "new" means anything not yet on `main`, this branch's own step-7 output included**: `T-DB-S53a`/`S53b`, `T-WEB-S177a` and `T-LINT-S37a` are all that rule applied to duplicates created in the same pull request that removed the others.

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
| `T-CORE-S85`, `T-API-S108` | tails of plan 037's PR-1 ranges — the reserved review-round headroom, unspent at PR 1's exit |
| `T-WEB-S187`, `T-WEB-S188`, `T-LINT-S38` | tails of plan 037's PR-2 ranges — the reserved review-round headroom, unspent at PR 2's exit |
| `T-WEB-S210`, `T-WEB-S211` | tails of plan 040's `T-WEB` range — #34's reserved review-round headroom, unspent at step 5's exit. **`T-LINT-S45` is NOT here**: plan 040 listed it as headroom, and it was spent on the OG wall's legal-imports control instead |
| `T-CORE-S6` | **predates #27.** Plan 018 reserved it for `completion-contract.test.ts` (`docs/plans/018-…:1376`); the assertion landed unmarked. Recorded here so the next re-derivation does not spend a pass re-investigating the gap |

Not burned, and not reusable either: `T-WEB-S2`, `S4`…`S7` are covered by the `T-WEB-S1..S7` range comment at `apps/web/test/sudoku-state.test.ts:23` rather than by per-`it` markers.
