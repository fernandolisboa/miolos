# Plan 060 — Issue #142: a cross-device Feito opens a completed view, not a fresh playable board

**Tier 2** (new surface + wire contract change + ADR). Point-in-time snapshot, never a living spec.
**Reserved ids (on the issue, before step 5):** T-CORE S103–S104 · T-API S133–S136 · T-WEB S273–S282. Unspent tails burn.

## 1. The scope decision, from server-side evidence

**Chosen: evidence-bounded middle — full where the server holds the data, honest absence where it does not.** Not option (a) as written (a bare "Feito em outro aparelho" card), not option (b) (the real per-game conclusion for all four games), because the server's storage decides per game what "real" can honestly mean:

- **What the server stores** (`completions` in `packages/db/src/schema.ts`): one write-once row per (user, game, date) — `outcome`, `elapsedMs` (NOT NULL), `hintsUsed` (NOT NULL, write contract caps at 1), `guesses` (Termo only, 1–6). Nothing else.
- **What it does NOT store, verified:** Termo's guess words/tiles — `POST /termo/guess` is stateless by design (`apps/api/src/termo/judge.ts`; the client re-posts all guesses each turn; no held-turn table exists — grep for `pgTable` finds eight tables, none per-guess). The day's word reaches a device only through the guess route's close (`play.state.answer` in `apps/web/src/termo/termo-screen.tsx`); no read channel exists. Nonogram's picture is the solution — puzzle content, never on `/day` (ADR-0060 decision 2, ADR-0004).

So per game:

| Game | Cross-device completed view renders | Honest absences, named |
|---|---|---|
| Sudoku / Binairo / Nonogram | The real conclusion composition: `Concluído` stamp with the server-held time (`elapsedMs`, on the wire since #141) and hints line (`hintsUsed`, added here — §2), stat block, streak card, day card, next-pending CTA | Nonogram's picture (solution content); share button (§3) |
| Termo, `completed` | The win stamp (`OutcomeStamp` shape) with `em X/6` from `/stats.todayTermoGuesses` (date-gated, the `TermoDoneLink` rule); guess distribution with today's row | The guess grid (not stored), the day's word (no reveal channel), share button |
| Termo, `played` | The loss stamp shape — no celebration, per ADR-0043's loss discipline | The day's word, the guess grid |

**Full Termo (guess grid + answer) requires new server storage or a new reveal endpoint — that is a different ticket** and is named as such, not smuggled in. Recording: the new ADR (§7) carries this table.

## 2. Wire change — one field, the #141 template exactly

`dayGameStateSchema` (`packages/core/src/day.ts`) gains optional `hintsUsed: z.number().int().min(0).max(1)` beside `elapsedMs`, same refine (present only on a `completed` claim — a value elsewhere is a parse failure), same Termo suppression in `dayGamesFromRows` (Termo ships no hint; ADR-0045's rule that "sem dicas" is not a virtue there). `.max(1)` mirrors the write contracts (`contracts/completion.ts`), the `elapsedMs` 24 h-cap precedent: the read side never accepts what the write side refused; a future hint-grant ticket raises both in one diff.

- `listCompletionsForDay` (`packages/db/src/completions.ts`) projects `hints_used`. Same predicate, same index, no migration.
- Route (`apps/api/app/day/route.ts`): unchanged — `dayGamesFromRows` output grows, `dayResponseSchema` parse before `Response.json` stands.
- `sameGame` in `apps/web/src/day/day-truth.ts` compares `hintsUsed` too (the #141 `samePayload` widening, `T-WEB-S235` in place).
- **No puzzle content, no new endpoint, strict Zod both ends (ADR-0004 obeyed).** **Deploy skew, the #148 precedent verbatim:** the strict schema changes shape, so a mismatched client fails `safeParse`, degrades silently to the local projection (ADR-0060 decision 6), and the 60 s poll recovers it after both sides deploy. No blank surface, no cast.
- `DayEntry` and `entryFromMerge` (`apps/web/src/play/day-state.ts`) do **not** gain `hintsUsed` — no tile renders it; only the new view consumes it, off the claim directly (§3's seam).

## 3. The screen

**Seat: a sibling branch in the four daily screen roots, plus the `/concluido` empty branch — never a new route, never the archive.**

- **New seam, keeping ADR-0060 consequence (d) true** (`src/day/**` imported only by `src/play/day-state.ts`): `day-state.ts` exports `useServerDayClaim(date, game): DayGameState | undefined` — the payload's claim for `game`, `undefined` unless `payload.date === date` (the same whole-payload gate `applyDayTruth` applies) and unless the claim's status is not `pending`. No new importer of `src/day`.
- **New component `RemoteConclusionView({ game, date, copy, claim })`, co-located in `conclusion-view.tsx`** — not a second file. It shares `ConclusionView`'s internals (`ConclusionTopBar`, `ShippedStamp`, `OutcomeStamp`, the stats body, `StreakCard`, `DayChip`, `nextPendingDaily`) and `conclusion-view.module.css`; a two-file split would import in both directions (the empty branch renders `RemoteConclusionView`, which uses `ConclusionView`'s internals — a cycle), so co-location is the decision, not an implementer's call. It renders the §1 table. The `syncOutcome === "recorded"` gate is **replaced by the claim itself** for stats and streak: a server claim is strictly stronger evidence than `recorded` — the row IS on the server.
- **One `GET /stats`, decided:** `ConclusionStats` owns a `useStats()` mount effect with no shared store, and the Termo remote view needs stats twice — the stamp's `em X/6` and the distribution. Two hook call sites would be two GETs. So the **fetch lifts to `RemoteConclusionView`**: it calls `useStats()` once, derives `em X/6` from that value, and passes it into a stats-as-prop presentational body split out of `ConclusionStats` (the local `ConclusionStats` keeps its own hook and renders the same body — zero change to the local path). Co-location (above) makes the split a same-file refactor.
- **Degraded-stamp granularity, decided (deploy skew: new client + old server):** such a claim parses with `elapsedMs` and **no** `hintsUsed`. The remote stamp renders **per line**: the time line it has, the hints line omitted — never a fabricated `0`, and never dropping the time it does have. `ConclusionResult` requires both fields, so the remote stamp path composes its lines from the claim directly rather than through a `ConclusionResult`. Pinned by T-WEB-S275/S281 (§8).
- **Screen roots** (`src/{sudoku,binairo,nonogram,termo}/*-screen.tsx`): the **hook call hoists to the top of each root**, beside the play hook and before any early return — every root returns early (`unavailable`, Nonogram's `solution === null`, `!hydrated`, the `isClosedAndFrozen` return), and a call placed after them is a conditional hook that `react-hooks/rules-of-hooks` reds; the repo documents this exact constraint in these files (`termo-screen.tsx`, `nonogram-screen.tsx`: "It sits BELOW the hook by the rules of hooks"). Only the **branch** — `if (claim) return <RemoteConclusionView …/>` — sits after the `isClosedAndFrozen` check and before `PlayView`. The **branch order** is load-bearing: **the local closed record wins first** (ADR-0060 decision 7's mirror — local win + server `played` renders this device's own conclusion, unchanged), and the remote branch never disturbs ADR-0043 decision 2's pinned branch order inside `ConclusionView`.
- **The credentialed-GET arithmetic, stated:** hoisting the hook subscribes the day-truth store on **every play-screen mount** — the four play routes, which today make **zero** `/day` calls, each gain one credentialed `GET /day` plus the 60 s visible-tab poll for the whole play session (shared store, so a hub-warmed payload is reused, but the subscription and poll are new to these routes either way). A mounted remote view adds **one `GET /streak` and one `GET /stats`** (the lifted single call above) — fetches the play route never made. The §7 ADR carries this count as a consequence, in ADR-0060 consequence (a)'s sizing language.
- **The mid-play rule, decided here:** the claim wins over an **in-progress** board too — the swap is the same render-time mechanism as the local closure swap, the day is already decided server-side (write-once row; finishing locally records nothing), and the in-progress record is neither written nor deleted (ADR-0060 decision 4 untouched). Cost named: a stale device mid-solve loses the board *view* (not the record) when the poll lands. On a hard load of `/​<jogo>` the board paints for ~1 RTT before the claim arrives; from the hub the store's retained payload makes the swap synchronous at first client render.
- **The tile's href is unchanged** (`playRoutes[game]`, `apps/web/app/hub-day-state.tsx` needs zero code) — the play route itself now answers with the completed state, so a bookmark or a typed URL gets it too.
- **Replay is not offered, not even read-only.** No link into a playable board renders anywhere on the remote view; the `notYet` "Jogar" CTA never appears. `ConclusionView`'s empty branch (`/​<jogo>/concluido`, no local record) checks the same claim first and renders `RemoteConclusionView` instead of the notYet card.
- **Nothing is written into local play records** (ADR-0060 decision 4 stands verbatim): the view is a projection of the claim, and it dies with the evidence for it (payload retired at rollover).
- **The archive is untouched:** ADR-0053 decision 10's refusal stands; the archive screens keep the honest gap, never import the seam (`T-WEB-S183`'s `src/day` ban keeps this mechanical).

**pt-BR strings, drafted** (in `src/i18n` messages, externalised as always; final composition per DESIGN.md — no emoji, no mascot, no consolation flourish):

```
conclusion.remote: {
  completedNote: "Feito em outro aparelho.",
  playedNote:    "Jogado em outro aparelho.",
  completedBody: "Você concluiu o jogo de hoje em outro aparelho.",
  playedBody:    "Você jogou o Termo de hoje em outro aparelho. As tentativas ficaram lá.",
}
```

The note renders as a single quiet line inside the result card, beside the stamp — never a banner. Mind `all-caps-body` (>30 chars of direct uppercase text) if styled as a kicker.

## 4. T-WEB-S245's disposition (the S96/S235 precedent)

`T-WEB-S245` (`apps/web/test/hub-day-truth.test.tsx`) has three arms. Arm 1 (tile keeps its href) and arm 3 (the payload never becomes a play record) **survive and stay under S245, re-aimed** — they are the claims S245 was always making and both remain true. Arm 2 ("the /sudoku screen behind it renders a fresh PLAYABLE board") is **deleted rather than re-aimed**: its claim IS what #142 amends (ADR-0060 decision 8), so its successor is `T-WEB-S273`, not a widening — exactly `T-WEB-S235`'s "installs NO interval" precedent at #143. Recorded in `docs/agents/test-ids.md` with the pointer at the record (the §7 ADR / ADR-0060's new annotation), per the `T-WEB-S96` rule: a landed assertion removed because its claim was amended false is a pointer at a record.

## 5. Merge and rollover interactions

- **Date-mismatch discard: unchanged and inherited.** `useServerDayClaim` applies the same `payload.date === date` gate; after SP midnight on a stale tab the claim retires, the remote view unmounts and the old day's playable board returns — the same understating direction the hub already ships, one surface more.
- **Demotion (completed→played, Termo-only):** the remote view keys on `claim.status` and renders the played shape, so a later payload that corrects a win to a loss re-renders correctly. Where the LOCAL record is a closed win, `isClosedAndFrozen` still wins the branch order and this device's own conclusion renders — decision 7's accepted mirror, untouched.
- The merge invariant, `mergeDayStatus`, `entryFromMerge` and every hub consumer: **zero changes.**

## 6. No migration — verified

Both carried fields are existing NOT NULL columns (`elapsed_ms`, `hints_used`, `packages/db/src/schema.ts`); `completions_user_date_idx` already serves the read. **No schema change, no migration, nothing applied to Neon.** If full-Termo scope is ever wanted, the guess-grid storage it needs is a new table and a new ticket — out of scope here by decision, not omission.

## 7. Records

- **A short new ADR — `docs/adr/0065-a-cross-device-done-day-opens-a-completed-view.md`.** The number is coordinated across the in-flight siblings, not "next free": the assigned map is **0062→#145, 0063→#58, 0064→#140, 0065→#142** — this ticket's ADR is 0065, everywhere (reserve the `docs/README.md` row early; collisions resolved at merge-from-main). It carries: the §1 scope table with its server-evidence warrant; the mid-play rule and its cost; the no-replay and no-local-write rules; the share/picture/answer absences; the stats/streak gate ("a server claim outranks `recorded`"); and a **consequence stating the new credentialed-GET count** (§3's arithmetic: play routes go from zero `/day` calls to one GET + the 60 s poll; a remote view adds one `/streak` and one `/stats`), sized in ADR-0060 consequence (a)'s language. `Proposed` → `Accepted` in the shipping PR's own diff.
- It **`Amends:` ADR-0060 decision 8** (the playable-board sentence is replaced for the daily path) and **decision 2** gains the `hintsUsed` annotation, next letters in the #143/#141 series — reciprocal `**Amended by:**` header + in-place annotations on ADR-0060, same commit, references qualified ("annotation (f)…" — the ADR's native consequences are lettered too). **`Amended by`, not `Superseded in part by`, warranted:** decision 8's href sentence stands untouched — only its playable-board sentence is corrected while the decision stands, which is `domain.md`'s `Amended by` case (ADR-0031 consequence (d) is the precedent); the ADR says so in one line so the records lens need not relitigate it.
- **ADR-0053 decision 10 is obeyed, not amended** — say so in those words: layer 3's honest gap survives on the archive, where it lives; only ADR-0060 decision 8's *citation* of it for the daily hub is withdrawn.
- `docs/README.md` rows for this plan and the ADR; test-id frontier re-derived at step 8.

## 8. Test plan on the reserved ids

- **T-CORE-S103** — the claim carries `hintsUsed` only when `completed` and never for Termo, both ends of the seam (schema refine + `dayGamesFromRows`), `packages/core/test/day.test.ts`.
- **T-CORE-S104** — the duplicate-row fold takes the never-overstate direction for `hintsUsed` (max, the humbler claim, matching `elapsedMs`); else burn.
- **T-API-S133** — the route's completed grid claim carries the stored `hintsUsed` (0 and 1 both round-trip); never on Termo or `played`, `apps/api/test/day.test.ts`. **S134–S136**: review-round headroom, burn if unspent.
- **T-WEB-S273** — the cross-device Feito tile's route renders the COMPLETED view, not a playable board (the S245-arm-2 successor; hub link + screen root).
- **T-WEB-S274** — Termo `played`: loss shape, no celebration, no answer word, no time.
- **T-WEB-S275** — the remote grid stamp is byte-identical to a local one where the claim carries time + hints (the `T-WEB-S257` discipline: same composers, `innerHTML` equality); a skew claim (`elapsedMs`, no `hintsUsed`) renders the time line and omits the hints line — §3's per-line rule, pinned.
- **T-WEB-S276** — the remote view writes nothing into `localStorage` play records.
- **T-WEB-S277** — the date gate: a payload for another day never mounts the remote view (rollover).
- **T-WEB-S278** — a closed local record outranks the claim (branch order; the decision-7 mirror renders the local conclusion).
- **T-WEB-S279** — an in-progress board swaps to the remote view when the claim lands, and the in-progress record survives byte-untouched.
- **T-WEB-S280** — `/​<jogo>/concluido` with no record and a claim renders the remote view; no "Jogar" CTA or playable link anywhere on it.
- **T-WEB-S281** — stats/streak blocks gate on the claim; Termo `em X/6` only when `stats.date === date` and `todayTermoGuesses` non-null, label-only fallback; exactly one `GET /stats` fires per Termo remote view (the lifted call, §3); the skew-claim stamp never fabricates a `0` hints line.
- **T-WEB-S282** — headroom, burn if unspent. Widened in place, no new id: `T-WEB-S235` (`samePayload` over `hintsUsed`), `T-CORE-S86/S94` (claim key-set tripwire), `T-API-S109/S112–S114` fixtures if the shape moves them.

## 9. Impeccable scope

UI change → the gate binds. The workflow scan is cold-profile (no session, `/day` 401), so **no URL-mode scan can reach the remote states**: run `impeccable detect file://` locally over the real component + real stylesheet for the three new compositions (grid completed, Termo completed, Termo played), both viewports, evidence in the PR body (a clean run prints nothing — paste "both steps ran, exit 0" plus the run's conclusion). The preview workflow still runs; its scanned pending composition is unchanged (ADR-0060 consequence (c)).

## 10. Build order

1. Contract + producer (`packages/core/src/day.ts`) — `hintsUsed`. `contracts/day.ts` does not change: `dayResponseSchema` composes `dayGameStateSchema` (§2).
2. DB projection (`listCompletionsForDay`); route untouched; API tests.
3. Web store (`sameGame`) + `useServerDayClaim` seam in `play/day-state.ts`.
4. `RemoteConclusionView` + strings + shared-internal exports.
5. The four screen roots' branch + `ConclusionView` empty-branch upgrade.
6. Tests, S245 disposition, `test-ids.md`.
7. Records: ADR-0065, ADR-0060 reciprocal, README rows, frontier.

## 11. Landmines

- **#145 (push opt-in) adds a prompt card to the conclusion surface** — if both are in flight, `conclusion-view.tsx` and the test-ids allocation paragraph collide: `git merge origin/main` before the gate, owner-first serialization, renumber only unlanded ids (napkin rule).
- `ConclusionView`'s branch order is pinned (ADR-0043 decision 2) — the remote branch lives in the roots and the empty arm, never between the pinned branches.
- `src/day` single-importer + free-play wall + `T-WEB-S183` archive scan: the seam stays in `play/day-state.ts`; no archive screen gains the branch.
- Never fabricate `hintsUsed: 0` on a skew claim — render the time line it carries, omit the hints line (§3's per-line rule); never a duration or hints line on Termo/`played`.
- ADR-number and plan-number collisions with siblings: reserve rows early, reconcile at merge-from-main.
- Node is nvm-managed; gates with `--force` (except `lint`); evidence rule binds.

## 12. Exit criteria

Gate green with pasted output (`typecheck --force`, `lint`, `test --force`, pre-commit, local `file://` detect for the new states); every reserved id spent or burned and the frontier re-derived; ADR-0065 `Accepted` in the shipping diff with ADR-0060's reciprocal amendment; S245's disposition recorded in `test-ids.md`; PR body names Tier 2, the §1 scope decision and the one deploy-skew note; issue #142 closed by the merge. Nothing needs Fernando unless review overturns the §1 or §3 decisions.

## 13. Deviations at step 5 (this plan is a snapshot; the record of where execution differed)

- **§7's ADR-number map shifted under the branch:** at the pre-gate `git merge origin/main`, #140 had landed as **ADR-0062** (`0062-termo-guess-dictionary-gaps-close-with-curated-additions.md`), not the map's 0064. **0065→#142 was unaffected** and is what shipped; ADR-0065's numbering paragraph records the shift.
- **§8's T-WEB-S276 arm about the screen roots is carried by S273 instead:** mounting a play route runs the shipped play lifecycle, which writes its own PLAYING record exactly as it did before #142 — so "writes nothing" is asserted as written on the `/concluido` mount (S276, no play hook in the graph) and as "no CONCLUDED record is synthesised" on the screen-root mount (S273).
- **Termo `played` renders the guess distribution and the streak card too**, mirroring the local loss conclusion (which renders both under its `recorded` gate) rather than the §1 table's terser cell; the fail-row highlight is ADR-0008 rule 3's unqualified claim and the row is on the server. The named absences (word, grid, time) hold exactly.
