# ADR-0060 — The day payload is server truth for today, and the device may only add to it

**Status:** Accepted — 2026-08-19 (issue #83, shipped in #135)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md), [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md), [ADR-0044](./0044-a-lost-termo-is-played-not-pending.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md), [ADR-0056](./0056-the-record-snapshot-cache-is-per-key-and-the-done-chip-wears-the-hub-word.md)
**Amends:** [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md) — **decisions 1 and 2 and consequence (d)**. Decision 1's *"`readDayState(date)` returns, per game, whether **this device** concluded that day's puzzle"* is narrowed: the one-seam property survives untouched — it is still the only function that derives completion and every consumer still reads it — but what it returns is the device's record **merged with the server's claim for today**. Decision 2's **safety property survives** (the day state still can never overstate the *user's* day, and the one demotion this ADR creates is a correction in the direction that decision itself permits) while its **mechanism does not**: *"**absence proves nothing** and renders as *pending*"* is false for the merged projection, where absence on the **device** renders as whatever the server says. Consequence (d)'s *"Tiles and day chips understate across devices … until #19"* becomes false and is **discharged here**, and its second sentence about the chaining CTA (*"lands them on a screen that immediately restores into its own conclusion"*) is corrected by decision 8 below. Decision 5, as narrowed by [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), is **discharged**.

**Amended at #143** (Tier 2 at reduced ceremony — no plan document; the plan and its records section live in the PR body, per the #103 precedent) — **(a), a decision-level amendment**: decision 5's no-interval clause is superseded by a bounded visible-tab poll. The clause's own revisit trigger — *"a complaint, not a schedule"* — fired: Fernando asked, answering PR #135 veto decision 4. Annotated in place; nothing deleted. The annotation letters are their own series, distinct from this ADR's natively lettered Consequences (a)–(f): a bare "(a)" is ambiguous here, so references must qualify — "annotation (a)" or "consequence (a)".

**Amended at #141** (Fernando's answer to PR #135 veto decision 1; the amending ticket ships no ADR of its own, and its PR body carries the plan section and the reciprocal records note) — **(b)–(e), continuing the annotation series #143 opened above; (b) and (c) are decision-level** (decision 2's no-duration clause is discharged for completed grid games — a consumer now exists — and decision 3's not-merged list narrows accordingly); **(d) corrects the one consequence made outright false; (e) sharpens a Rejected bullet's type claim.** Termo still publishes no duration anywhere and the guess count still does not ride this payload. Every edit annotated in place, nothing deleted.

**Amended by:** [ADR-0065](./0065-a-cross-device-done-day-opens-a-completed-view.md) (#142, Fernando's answer to PR #135 veto decision 3) — **(f) and (g), continuing the series; both decision-level.** Annotation (f): decision 2's per-game claim gains an optional `hintsUsed`, on annotation (b)'s template exactly — recorded at TWO loci under the one letter, decision 2 itself and, applying annotation (c)'s rule to it, decision 3's not-merged list (the #141 precedent gave that pair distinct letters; here the second locus is the same fact applied to the list it narrows, so it shares the letter and this header names both). Annotation (g): **decision 8's playable-board sentence is replaced for the daily path** — a cross-device done day now opens a completed view — while the decision's href sentence **stands untouched**, which is why this is `Amended by` and not `Superseded in part by`. Every edit annotated in place, nothing deleted; references qualify the letter ("annotation (f)"), because this ADR's native Consequences are lettered too.

**Amended by:** [ADR-0066](./0066-a-late-sync-is-credited-from-a-server-seen-day.md) (#58) — **(h), continuing the series.** Annotation (h): decision 2's on-time provenance paragraph cited "the one `onTimeSql()` derivation"; that symbol is deleted at #58 — the one producer is now `onTimeAtWrite`, applied at write time and STORED, and `/day` projects the stored column. The paragraph's claim — no second producer — stands. Annotated in place; nothing deleted; references qualify the letter ("annotation (h)").

**Amended by:** [ADR-0070](./0070-the-daily-nonogram-conclusion-names-its-motif.md) (#64) — **(i), continuing the series, at TWO loci under the one letter** (ADR-0065 annotation (f)'s explicit precedent). Locus 1, decision 2: the *"no puzzle content of any kind"* clause narrows — a **completed Nonogram** claim carries an optional `motifName`, which is curated daily content and is post-completion by construction, so the ADR-0004 register stays product rather than confidentiality. Locus 2, decision 3's not-merged list: applying annotation (c)'s rule, and recording that #64 carves **nothing** out of it — `motifName` is not a device fact, has no device counterpart, and `entryFromMerge` never blends it, so the list stands literally true. Decision 5's poll clause is untouched: #64's refresh nudge is one-shot and event-driven, not a second interval. Annotated in place; nothing deleted; references qualify the letter ("annotation (i)").

**Amended by:** [ADR-0072](./0072-the-day-truth-store-repairs-after-the-mint-rather-than-waiting-for-it.md) (#195) — **(j) and (k), continuing the series; (j) is decision-level.** Annotation (j), decision 5: its trigger list is closed (*"NOTHING ELSE."* in the module header) and gains a sixth entry — **one post-mint repair per page load**, fired when a fetch answers `undefined` while the store has never held a server truth. Nothing is deleted: *"all deduped by an in-flight guard"* and annotation (a)'s *"every tick goes through the same in-flight guard, so a slow answer is never stacked on"* are re-affirmed, because the guard is set synchronously and held for exactly one `GET /day` as before. Annotation (k), consequence (a): the hub's credentialed-GET count was **three** and is **four**, with a cold-load fifth — the consequence's own closing sentence is *"so the count has to be right"*. Annotated in place; nothing deleted; references qualify the letter ("annotation (j)").

[ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) decision 10 and [ADR-0056](./0056-the-record-snapshot-cache-is-per-key-and-the-done-chip-wears-the-hub-word.md) decision 1 are **obeyed, not amended**, and this ADR says so in those words because a reviewer will ask about both. Decision 10 layer 3 is additionally **cited** by decision 8, as the precedent that makes a playable board behind a done tile acceptable; citing is not amending.

## Context

[ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md)
decision 5 said #19 would replace `readDayState`'s body. It did not:
[ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md)
amended that decision and moved the server day-truth payload to
[#83](https://github.com/fernandolisboa/miolos/issues/83). So the hub's
per-game done/pending has been, until now, purely what **this device** holds:
a player who solved Sudoku on their phone sees *pending* on their laptop —
ADR-0031 consequence (d), stated out loud when it shipped and owned by this
ticket.

This is the first time in the repo that a **server claim** and a **device
claim** about the same fact meet. They are different kinds of object. The
device claims *"this device concluded this game today"* — self-reported, an
affordance and never an entitlement (ADR-0031 decision 6). The server claims
*"a completion row exists for (user, game, today)"* — the authority for the
streak, the statistics and the medals (ADR-0009, ADR-0026). Deciding how they
meet is the weight this ADR carries, and it creates the first hydration path
in the app that can **demote**.

## Decision

1. **`GET /day`, no parameters, anchored on the DB clock's today**, carrying a
   new strict contract — `dayResponseSchema` in
   `packages/core/src/contracts/day.ts` — and never a field appended to
   `streakResponseSchema` or `statsResponseSchema` (ADR-0048 decision 3,
   obeyed: both are strict on both ends, so an appended field would fail every
   deployed client's parse). The route is a verbatim clone of the `GET
   /streak` authenticated-read template: cookie → `requireUserId` which never
   mints, **401 `no-session`** for a cookieless caller, whole-body try/catch →
   500 `internal`, `Cache-Control: no-store` **and** the credentialed CORS
   grant on every branch including the catch, `dynamic = "force-dynamic"`, no
   OPTIONS handler, no origin guard and no content-type check — the last three
   being deliberate absences the template already documents with their
   reasoning. The user is the cookie; the day is the DB clock (ADR-0010).

   **Anonymous-tolerant is rejected.** A 200 with four `pending`s for a caller
   with no session is indistinguishable from a real answer and would cost a
   branch on every consumer to tell them apart.

2. **Three verbs per game and nothing else on the wire.** `completed` is
   CONTEXT.md's *Conclusão*, `played` its *Jogado* (ADR-0008 rule 3 — only
   Termo can land there), and `pending` is the **absence of a counted
   completion** — no row at all, or the late-win row of consequence (f), a row
   that exists and still yields no claim — which CONTEXT.md has no entry for
   and which this contract adopts from the local projection's shipped spelling
   rather than invents. The no-row case is the only one that can reach the wire
   on a today-anchored payload, and it is named as the typical case rather than
   as the definition, because the definition is what decision 3 rests on. No puzzle content
   of any kind, no puzzle id, no answer, no board, no day but the server's own
   today (ADR-0004: there is nothing here to leak, and with no parameter there
   is no way to ask about tomorrow). No streak. No duration and no guess count
   — solve times are a `/stats` concern (ADR-0051 decision 4), Termo publishes
   none anywhere (ADR-0045 decision 4), and `todayTermoGuesses` already exists
   on `statsResponseSchema`, so carrying it here would create a **second
   producer** of one value; ADR-0051 decision 3's hub-endpoint trigger
   therefore stands undischarged.

   *(**Annotation (b) — decision-level, amended at #141.** The no-duration clause was
   reasoned from "nothing consumes it", and a consumer now exists: Fernando's
   answer to PR #135 veto decision 1 is that a game completed on another
   device shows its time like a local one. Since #141 each per-game value is
   a claim object — `dayGameStateSchema` in `packages/core/src/day.ts`,
   `{status, elapsedMs?}` — and a **completed grid game's claim carries the
   stored row's `elapsedMs`**, parsed strictly (`elapsedMs` on a non-completed
   claim is a parse failure). This is NOT the second producer this clause
   feared: `/stats` aggregates a history and never carries today's per-game
   solve time, so the duration has exactly one producer on the wire. What
   survives unchanged: **Termo's claim never carries a duration** — ADR-0045
   decision 4 stands, `dayGamesFromRows` suppresses it, and the Termo tile's
   `em 4/6` still comes from `/stats`'s `todayTermoGuesses` alone; the guess
   count still does not ride this payload; and ADR-0051 decision 3's
   hub-endpoint trigger still stands undischarged.)*

   *(**Annotation (f) — decision-level, amended by ADR-0065 at #142.** The
   claim gains an optional `hintsUsed`, on annotation (b)'s template
   exactly: `.min(0).max(1)` mirroring the write contracts so the read side
   never accepts what the write side refused, a value on a non-`completed`
   claim a parse failure, and the same Termo suppression in
   `dayGamesFromRows` — Termo ships no hint at all (ADR-0045 decision 1),
   so "sem dicas" would present as a virtue something that was never
   possible. The consumer is ADR-0065's remote completed view's stamp; no
   second producer exists — `/stats` carries no per-game hint count
   anywhere. Everything else this decision refuses, it still refuses.)*

   *(**Annotation (i), locus 1 — decision-level, amended by ADR-0070 at #64.**
   The clause *"**No puzzle content of any kind**"* is narrowed: a
   **completed Nonogram** claim carries an optional `motifName`, the curated
   pt-BR name of the day's motif — which IS daily content, and the annotation
   says so plainly rather than reclassifying it. It does not breach ADR-0004,
   and the argument is the register one ADR-0027 already fixed and this ADR
   restates: a claim is a projection of the **user's own completion rows**, so
   the name cannot exist on a claim before the server judged **that user's**
   day. A post-completion motif name is metadata about a day already decided
   for that person, not playable content, and the register stays **product**
   (a payoff not spoiled early), never confidentiality. Everything else the
   clause refuses, it still refuses **and now refuses more explicitly**: no
   puzzle id, no `motifId`, no `mirrored`, no answer, no board, no solution,
   no day but the server's own today, and the route still takes no parameter.
   The wire field is `motifName`, not `name` — ADR-0033 decision 4's rename
   route — so `FORBIDDEN_DAILY_KEYS` is untouched and every leak scan on this
   payload keeps passing on merit.)*

   **And no `onTime` field, because nothing consumes it**: the on-time rule is
   applied server-side and only its verdict travels, as one of the three
   verbs. The tempting warrant *"on-time never rides a wire contract"* is
   **false and is not written here** — `completionResponseSchema` carries
   `onTime: z.boolean()` as the write path's receipt, and ADR-0051 decision 1's
   sentence is about the stats ADR's own payloads and the #58 boundary, which
   this ADR leaves untouched: `/day` adds no second producer of on-time, only
   a projection of the one `onTimeSql()` derivation (ADR-0026 decision 2).
   *(**Annotation (h) — amended by ADR-0066 at #58.** The one producer is
   `onTimeAtWrite`, applied at the write and STORED — `onTimeSql()` is
   deleted; `/day` projects the stored column. Still no second producer,
   which is this paragraph's claim.)*

3. **The merge invariant.**

   > For each game, the server **makes a claim** exactly when its status is not
   > `pending`; `pending` from the server is the *absence of a counted
   > completion* — no row, or the unreachable late-win row of consequence (f) —
   > and therefore the absence of a claim, **never a denial**. Where the server
   > claims, its claim is the day state; where it does not, the device's is.
   > Absence on either side proves nothing, presence on the server is
   > authority, presence on the device is an affordance. Nothing is blended
   > field by field and no third value is ever synthesised.

   ```
   merged[game] = server[game] === "pending" ? local[game] : server[game]
   ```

   with a precondition: **the payload is discarded in full unless
   `payload.date === date`**, where `date` is the day being rendered. A
   payload for another day is not weaker evidence, it is evidence about a
   different question, and merging it across the São Paulo rollover would
   paint yesterday's dones onto today's tiles — the false *done* ADR-0031
   decision 2 forbids by name. That gate is also the **rollover mechanism**.
   It is `TermoDoneLink`'s shipped `stats.date !== date` check applied to the
   whole payload, with a strictly larger blast radius said out loud: that gate
   discards a *caption* and the tile keeps its shape, this one discards a
   *tile shape*, so for the length of the skew a cross-device done reverts to
   pending. What is lost is only the cross-device **addition**, never a local
   truth.

   **Not "the stronger verb wins".** Local `completed` + server `played` is
   reachable and Termo-only, and the server wins: the row is write-once
   (ADR-0026 decision 1), the day genuinely does not count for the streak, so
   `completed` on the hub would be a lie the player can catch and
   `completedCount` would disagree with `/streak`'s `todayCounts`.

   **What is NOT merged, exhaustively:** in-progress board state (grid,
   guesses, draft, timer, `elapsedMs`, `hintsUsed`); `pendingSync` and
   `syncOutcome`, which are device facts about the queue; durations and guess
   counts; the streak; any day but today; any user but the caller; and the
   archive, whose own refusal of a per-day per-user read (ADR-0053 decision
   10) stands untouched — it is about arbitrary past dates on a public,
   crawler-facing route, and this endpoint answers about today only, on the
   authenticated surface ADR-0031 decision 4 routes server-sourced user facts
   to.

   *(**Annotation (c) — decision-level, amended at #141.** "Durations" leaves
   this list for the one case annotation (b) creates: a **completed** game's published duration now
   travels WITH its claim, and — the invariant's own sentence, now with a
   field to bind — it is never blended. Where the server claims, the entry is
   the server's whole: its status and its `elapsedMs`; where it does not, the
   device's whole, duration included (`entryFromMerge` in
   `apps/web/src/play/day-state.ts`). An IN-PROGRESS board's `elapsedMs`
   stays exactly where this list puts it — device-local, never on the wire —
   and guess counts stay off the payload entirely.)*

   *(Annotation (f) — decision 2 — applies to this list on annotation (c)'s
   exact rule: a **completed** grid game's published `hintsUsed` travels
   WITH its claim since #142 and is never blended, while an IN-PROGRESS
   board's `hintsUsed` stays where this list puts it, device-local and off
   the wire.)*

   *(**Annotation (i), locus 2 — amended by ADR-0070 at #64**, applying
   annotation (c)'s rule to this list — and honestly, because unlike (c) and
   (f) it carves **nothing** out. `motifName` is not a device fact at all: it
   is server-only, it has no device counterpart, no play record holds it, and
   `entryFromMerge` never blends it. **The list above stands literally true as
   written.** What the annotation records is that the claim gained a field
   which is outside this list's subject entirely — the list enumerates device
   facts the merge refuses to blend, and a curated name the device could never
   have produced is not one of them.)*

4. **In-progress board state is device-local, is never on the wire, and
   cross-device resume is not a v1 capability.** Nothing is persisted before a
   completion, so the server has no notion of an unfinished board. **The
   server payload is never written into a play record** either: the merge
   lives in the projection only. A synthesised record would imply board
   content the device does not have, would survive the connection that
   produced it, and would make a cross-device *done* outlive the evidence for
   it. `localStorage` stays a device-written store.

5. **The refresh discipline: one shared store, no second loop.** One
   module-level store, fetching on **listener count 0 → 1** — not "the first
   subscriber", because a client-side navigation `/sudoku/concluido → /` drops
   every subscriber and re-adds five — and on `visibilitychange` → visible,
   `focus` and `online`, all deduped by an in-flight guard. Cleanup drops the
   listeners and **retains** the payload; only the date precondition retires
   it. The hook takes **no argument**: a `date` parameter would make one
   module-level slot serve a keyed projection, which is ADR-0056's exact
   defect one level up. No `localStorage` cache of the payload (ADR-0048
   decision 4's argument: a stale server answer presented as current is wrong
   in both directions).

   **No interval, and this decision does not borrow ADR-0056's authority.**
   ADR-0056 decision 1 governs a 1 s `localStorage` poll and says nothing
   about a network refresh; that poll stays `localStorage`-only and never
   gains a network call. The choice stands on its own warrant: a polling
   network loop would multiply the credentialed GETs on the most-hit route in
   the app, for a payload that can change at most four times a day, and every
   trigger above is an event the player actually generated.

   **With its cost named:** an already-open, already-focused tab does not
   learn about a completion made elsewhere until it is refocused or navigated.
   A second monitor left on the hub — this ticket's own demo case — never
   updates on its own. That is accepted for v1; the successor is a poll or a
   push, and the trigger for revisiting is a complaint, not a schedule.

   *(**(a) Superseded at #143.** The trigger fired: Fernando asked, answering
   PR #135 veto decision 4. The store now polls `GET /day` every **60 s**,
   and ONLY while both of these hold — at least one listener is subscribed,
   and the document is visible. No timer while hidden (`visibilitychange` →
   visible already refetches on re-show, so a hidden tab owes the server
   nothing) and none at zero listeners, where cleanup clears it; every tick
   goes through the same in-flight guard, so a slow answer is never stacked
   on. The multiplied-GETs warrant is bounded rather than dismissed: the poll
   costs at most one credentialed GET per open visible tab per minute, and
   all four player-generated triggers above survive unchanged. This
   paragraph's two preceding sentences — the no-interval choice, its warrant
   and its named cost — are history as of #143; the ADR-0056 non-borrowing
   sentence above stands, and that `localStorage` poll still never gains a
   network call. Asserted as `T-WEB-S259`/`T-WEB-S260` in
   `apps/web/test/day-truth.test.tsx`, which replace the "installs NO
   interval" arm that lived under `T-WEB-S235`.)*

   *(**Annotation (j) — decision-level, amended by [ADR-0072](./0072-the-day-truth-store-repairs-after-the-mint-rather-than-waiting-for-it.md)
   at #195.** The trigger list above is **closed** — the module header spells
   it *"NOTHING ELSE."* — and gains a **sixth** entry: **one post-mint repair
   per page load**. When a fetch answers `undefined` **while the store has
   never held a server truth on this page load**, the store awaits
   `ensureSession()` once and refreshes once more. It exists because the store
   is the eighth reader of the authenticated surface and the only one #149 did
   not order against the session mint, so on a re-mint load its `GET /day`
   raced `POST /session` into the 401 branch and the cross-device half of the
   hub read as pending for that whole load.
   **Nothing above is deleted or weakened.** *"All deduped by an in-flight
   guard"* and annotation (a)'s *"every tick goes through the same in-flight
   guard, so a slow answer is never stacked on"* are **re-affirmed**: the
   guard is still set synchronously and still held for exactly one `GET /day`,
   because the mint is awaited **after** the guard is released and never
   under it — ADR-0072 decision 3's rule, *no promise that can hang is ever
   awaited under the guard*, which is what disqualified simply ordering the
   fetch (`ensureSession()` has no timeout). The repair is **event-driven and
   one-shot, not a second interval**, so this decision's no-second-loop claim
   and annotation (a)'s bounded-poll clause both stand exactly as written —
   the same reading annotation (i) gave #64's nudge. Asserted as
   `T-WEB-S344`–`T-WEB-S346` in
   `apps/web/test/day-truth-mint-repair.test.tsx`.)*

6. **Every failure degrades to the local reader, and play never blocks on this
   fetch.** `NEXT_PUBLIC_API_URL` unset (loudly, as the sibling clients do),
   any non-2xx including 401, a network rejection and a parse failure all
   answer `undefined`, and `undefined` leaves the shipped local projection as
   the whole answer — ADR-0031 decision 1's offline fallback, kept as a
   property of the code rather than a promise. The parse failure is
   **silent**, matching `streak-client.ts` and `stats-client.ts`; a third
   client that shouted would make `/day` the only one of three that does.

7. **Hydration may demote, in exactly one case — and the same rule promotes in
   the mirror.** The one demotion is the server contradicting the device on a
   **lost Termo**: won here, lost elsewhere, so the tile flips *Feito* →
   *Jogado* and `X de 4` drops by one. That is a **correction**, not an
   understatement, and it is the direction ADR-0031 decision 2 permits; it is
   Termo-only in v1, because no grid game can be lost. The mirror is **lost
   here, won elsewhere**: device A loses all six guesses, its POST
   short-circuits on the composite primary key and it discards the response's
   outcome (ADR-0053 decision 10's own correction), so its record stays
   `lost` — and merged, the day reads `completed`, so *Feito* sits one tap
   from this device's own loss screen. One rule, both directions, stated
   together so neither arrives later as a discovery.

8. **A cross-device done tile keeps its `href`, and the play route behind it
   renders a fresh PLAYABLE board** — all four games, not Termo alone. The
   screen roots swap to `ConclusionView` only via
   `isClosedAndFrozen(play.state)`, i.e. off the **local** record, and
   cross-device there is none. This is ADR-0053 decision 10 layer 3's *"the
   honest gap … the board is playable; on submit the server answers with the
   stored row and **writes nothing**"*, reached from the **daily hub** for the
   first time. Decided here rather than discovered at review: ship it, named.
   ADR-0031 consequence (d)'s *"lands them on a screen that immediately
   restores into its own conclusion"* is corrected by this decision — it is
   true only where this device holds the record.

   *(**Annotation (g) — decision-level, amended by ADR-0065 at #142.** The
   playable-board sentence is REPLACED for the daily path: the play route
   behind a cross-device done tile now renders the completed view ADR-0065
   defines, never a fresh playable board, and `T-WEB-S245`'s playable-board
   arm is deleted with `T-WEB-S273` as its successor. The **href half of
   this decision stands untouched** — the tile still links to
   `playRoutes[game]`, and it is precisely because the route itself now
   answers with the completed state that the link needs no rewrite; that
   surviving half is why this is an amendment and not a partial
   supersession. The citation of ADR-0053 decision 10 layer 3 is withdrawn
   for the daily hub path only; the layer itself is obeyed, unamended, on
   the archive where it lives.)*

## Rejected

- **Anonymous-tolerant 200s** — decision 1.
- **A `?date=` parameter.** It would be an archive feature and ADR-0053
  decision 10 refuses it; it is also the only way this endpoint could be asked
  about an unpublished day (ADR-0004).
- **Flat per-game keys, matching `statsResponseSchema`.** `/stats`'s four
  per-game values are heterogeneous and interleaved with two scalars, so
  `Record<Game, X>` does not exist in that payload at any shape and flat is
  the only honest spelling there. `/day`'s four are homogeneous, so
  `DayResponse["games"]` **is** `Record<Game, DayGameStatus>` by construction
  — literally the merge's input type, without a cast or a helper. The two
  shapes differ because the payloads differ. *(**Annotation (e) — sharpened at
  #141.** The rejection stands and the homogeneity argument with it; only the
  type moved: `DayResponse["games"]` is `Record<Game, DayGameState>` — the
  claim object `{status, elapsedMs?}` of annotation (b) — and the status half
  is still what `mergeDayState` consumes.)*
- **Reusing `listCompletionsForStats` instead of a narrow reader.** It needs
  no database change at all, which is its real merit, and it reads the user's
  entire completion history to produce four enum values on every hub view.
  ADR-0051 decision 3 already names *"the hub gets a narrow endpoint"* as the
  fix for exactly that pressure; building it with the wide read is building it
  and skipping the point. No schema change and no migration were owed either:
  `completions_user_date_idx` on `(user_id, date)` already exists and its own
  comment names *"the day so far"* as one of the two reads it was built for.
- **Carrying `todayTermoGuesses` so the hub could drop its `/stats` fetch** —
  decision 2. One value, one producer.
- **A per-hook mount effect, `useStreak`-style.** `useDayState` is called five
  times on one hub render, so that is five credentialed GETs per hub view. A
  React context was rejected too: the hub's client fragments are separate
  islands inside a server component, and a provider would restructure
  `app/page.tsx` to buy what a module-level store already gives.
- **Clearing the payload on cleanup.** It would demote every cross-device tile
  to pending for the length of a fetch, on every navigation.
- **`played` wins whenever either side says `played`.** It buys a consistent
  Termo tile at the price of the hub disagreeing with `/streak`'s
  `todayCounts` — the exact trade decision 3 rejects for the demotion.

## Consequences

- **(a) The hub now makes three credentialed GETs on a normal view** —
  `/streak`, `/day` and `/attach/state` — and **four** once Termo is done,
  since `TermoDoneLink` mounts only for a completed Termo and fetches
  `/stats`. `/attach/state` is easy to miss and is counted here on purpose:
  `<HubAttach />` (`apps/web/app/page.tsx`) runs `useAttachState` as an
  **unconditional mount effect** (`apps/web/src/attach/use-attach-state.ts`),
  so the fetch fires on every hub mount and the `eligible !== true` check
  that renders nothing happens *after* it, in the renderer. This ticket makes
  the four-GET case **more frequent**, because a Termo completed on another
  device now mounts `TermoDoneLink` where it previously did not. Each
  conclusion surface adds one `/day`. Since #143 a recurring term rides on top
  of these per-view counts: the poll's at most one `/day` per open visible tab
  per minute — decision 5's annotation (a). Whether these collapse into one hub
  read is ADR-0051 decision 3's trigger, which is sized against this count — so
  the count has to be right — and it is not pre-empted here.

  *(**Annotation (k) — amended by [ADR-0072](./0072-the-day-truth-store-repairs-after-the-mint-rather-than-waiting-for-it.md)
  at #195.** The count was wrong, and this consequence's own closing sentence
  is why that matters. **The hub makes FOUR unconditional credentialed GETs on
  a normal warm view** — `/streak`, `/day`, `/attach/state` and
  **`/onboarding/state`**, whose `<HubOnboarding />` island (#35, ADR-0061)
  postdates this ADR and was missing from the list — **five** once Termo is
  done and `TermoDoneLink` fetches `/stats`. Re-derived from
  `apps/web/app/page.tsx`'s islands rather than from this paragraph, which is
  the discipline #195 exists to record: `<HubProgress />` and
  `<HubCardAction />` share the one `/day` through the store; `<HubStreak />`,
  `<HubAttach />` and `<HubOnboarding />` are one unconditional mount effect
  each. `usePushState` (#145, ADR-0064) is **not** on this list — it mounts on
  a conclusion surface, not the hub. **And #195 adds a cold-load fifth**: on a
  load whose `/day` answers empty while the store holds no truth, the
  post-mint repair (annotation (j)) spends **one extra `GET /day`**, once per
  page load, ever. The recurring poll term from annotation (a) is unchanged,
  and ADR-0051 decision 3's collapse trigger is still not pre-empted.)*
- **(b) A cross-device done tile carries no time.** The payload publishes no
  duration, so the tile renders the chip-only shape the hub already ships for
  a won Termo. A time this device did not measure is not this device's to
  publish. *(**Annotation (d) — FALSE after #141**, which is the ticket Fernando opened
  against exactly this consequence at PR #135. A cross-device done tile now
  carries the SERVER-held time — a time the server did measure, from the
  user's own completion row — rendered through the identical local path
  (`formatElapsed`, the same composers; `T-WEB-S257` pins the byte-identity).
  The chip-only shape remains the honest rendering of a claim that carries no
  duration: a completed Termo, always, and any degraded payload.)*
- **(c) The visual gate is unchanged in shape.** `impeccable detect` launches
  a clean browser profile: no session, `/day` answers 401, and both viewports
  still scan the pending composition (ADR-0031 consequence (e), which
  survives).
- **(d) The seam stays one function body wide.** `readDayState` gains a second
  parameter rather than a caller: `src/day/**` is imported by
  `src/play/day-state.ts` and by nothing else, which is what keeps ADR-0053
  decision 9's archive claim true — and that claim is now **stronger**, since
  composing a daily screen root on an archived date would fire `/day` as well
  as `/streak`.

  **The same one importer is what rescues ADR-0053 decision 10's *warrant*,
  which this ADR would otherwise leave quoting an amended sentence.** Decision
  10's "Why no endpoint" paragraph closes with *"ADR-0031 decision 2's monotone
  rule makes its absence harmless: absence proves nothing and renders as
  playable"* — and that mechanism is exactly what decision 1 of this ADR
  amends. The warrant survives in its own scope rather than by luck: the
  archive screens read `card-status.ts` / `usePriorConclusion`, never
  `useDayState`, so nothing merges there and the monotone rule still holds
  everywhere the archive relies on it. Decision 10's refusal is unchanged.
- **(e) Free play gains a fourth walled directory.** `src/day` joins the
  streak, the statistics and the medals in the free-play wall's ban list, both
  specifier shapes and the dynamic-import regex, on the one-hop rule.
- **(f) A late win is defined and unreachable.** The projection maps a won
  **late** row to `pending`, which a today-anchored payload can never produce,
  and defining it anyway is what keeps the on-time rule to one spelling and
  makes the unreachable case fail safe.
