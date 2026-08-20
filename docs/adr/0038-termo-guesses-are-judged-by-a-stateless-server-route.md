# ADR-0038 — Termo guesses are judged by a stateless server route; the answer never ships to an open board

**Status:** Accepted — 2026-08-02
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0032](./0032-a-nonogram-is-finished-when-the-picture-is-painted.md), [ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md)
**Amended by:** [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) — consequence (f)'s sufficiency claim loses its bound. *"the guess route runs ~6× per player per day"* and *"three indexed reads and no write, **at a volume bounded by the ritual**, is not ADR-0026's 'first abuse signal'"* both rest on the ritual being one day's four puzzles. After #31 every published past Termo is playable at its own URL, so the route's **legitimate** volume is six times however many archived Termos a player opens, and the ritual bounds nothing. *(**Tense:** the write window that admits an archived date ships in #31's FIRST pull request, so the route already accepts those dates the moment this line lands; the URLs that make a player open them are its SECOND. The claim is true in kind from PR 1 and true in volume from PR 2.)* The rest of (f) survives intact — the corrected three-round-trip figure, the "neither ADR's justification transfers" claim, the unthrottled-minting caveat and the third revisit trigger — and the guess route still gets **no** rate limit (ADR-0053 decision 13 caps the completion write only, because the guess route writes nothing). Decision 8's substance is untouched but its **identifier** is gone: `ACCEPTED_DAYS_BACK` is deleted repo-wide and the hoisted bound is now `isWritableDate` in the same module, shared by both routes exactly as this decision requires. Decision 9's oracle disclosure is **widened in date range, not in kind** — its own bound, *"it returns only days the caller could already have played"*, stays true, and is true *because* #31 makes those days playable.

## Context

The three shipped games are judged in one place: `POST /completions` reads
the stored row and compares a submitted grid against it
(`apps/api/app/completions/route.ts:207-241`). Termo is the first game
with a *mid-game* judgement at all — five tiles per guess, six times — and
the first whose engine is stateless functions rather than a board
(`packages/games/src/termo/index.ts`).

Three questions came with it, and they cannot be answered independently.

**Whether the answer ships to the client.** Read carefully,
[ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md) does not
forbid it: its Decision is *"Nothing **unpublished** is ever sent to the
client"* and its Consequences say *"Today's Termo answer necessarily
reaches the client at midnight. That is unavoidable and acceptable; only
pre-release is the problem."* It was written assuming client-side letter
feedback — *"offline letter feedback requires the answer word on the
client"* — and the leak it names is tomorrow's answer, not today's.

What forbids it is three recorded things plus the ticket: the strip table
at `packages/core/src/contracts/daily-content.ts:146` (*"termo | `game,
date` only | the answer word, in any field; guesses are judged
server-side"*),
[ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
consequence (g), `apps/web/src/play/grid-hint.ts:16-21`'s own header
(*"Termo's answer is never on the wire … and its guesses are judged
server-side, so #27 inherits neither this module nor ADR-0027's
reasoning"*), and issue #27's acceptance criterion — *"the answer never
reaches the client before completion beyond normal gameplay feedback."*

**Where in-flight guess state lives.** Six guesses judged one at a time is
a per-user per-day sequence. `completions` cannot hold it: the composite
primary key `(user_id, game, date)` and `ON CONFLICT DO NOTHING`
([ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)
decision 1) make it a write-once terminal row. `daily_puzzles` cannot hold
it: its rows are immutable and carry no user axis. So either a new table
exists, or nothing does.

**What the completion request carries.** `storedSolution`'s own TSDoc
(`apps/api/app/completions/route.ts:73-83`) already refuses a core-level
"get the solution" abstraction *because Termo has no grid*, and
`outcome: "won"` is a hardcoded literal at `:247` — the one termo
extension point in that route with no tripwire on it.

## Decision

1. **A guess is judged by `POST /termo/guess`, and the route is
   STATELESS.** The client posts the whole guess list every time; the
   server re-judges all of it against the stored answer and holds nothing
   between requests. No guess table, no migration for guess state, no
   session-scoped memory. A replay is therefore idempotent for free, which
   is the posture ADR-0026 decision 4 already builds on.

2. **The response carries `answer` — the canonical accented spelling — if
   and only if `status !== "playing"`,** enforced by a `.refine` on the
   response schema rather than by a comment. The client persists it in the
   play record ([ADR-0044](./0044-a-lost-termo-is-played-not-pending.md)
   decision 2) and the conclusion renders it from there
   ([ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md)
   decision 6). It is never delivered through the completion response,
   which parses every response through `completionResponseSchema` and
   therefore strips unknown fields (`apps/web/src/play/sync.ts:401`) before
   `settle` copies only `elapsedMs` and `hintsUsed` out of it
   (`sync.ts:411-423`) — the argument
   [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md) already makes).

3. **The completion request carries `guesses` and nothing else new.** Five
   keys, `guesses` exactly where the three grid members carry `grid`,
   normalized and `^[a-z]{5}$` on the wire. No `tiles` (the server
   recomputes them), no outcome (the server decides it), no answer.

4. **The server decides the outcome by re-running the engine.**
   `isValidGuess` on the guess, then `evaluateGuess` against the stored
   `normalized` answer ([ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md)
   decision 1), then `deriveBoardStatus`. `won` and `lost` are both real
   outcomes and both write a row; a list that is still `playing` or
   continues past a winning row is `422 guess-mismatch` with **no row**,
   exactly as a mismatched grid is. Six guesses exhausted is NOT that case
   — it is `outcome: "lost"`. `deriveBoardStatus` throws a `RangeError` on
   a row following a win (`packages/games/src/termo/status.ts:31-36`), so
   that case is checked explicitly BEFORE the call, the same way ADR-0032
   decision 4 puts the length check before the compare loop.

   **Amended at #27 (step-6 review) — three corrections, all in
   `apps/api/src/termo/judge.ts` and the two routes that call it.** The
   original wording above said *"`isValidGuess` on **every** guess"* and
   made a non-word one of the three `guess-mismatch` cases. That is what
   shipped first and it was wrong in a way the ADR's own decision 1 causes:

   (i) **The dictionary gate ran over the ACCUMULATED list, and the client
   is stateless, so it re-posts every earlier guess every turn.** `apps/web`
   and `apps/api` are separate Vercel projects that deploy independently and
   [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md)
   expects `validation.txt` to be regenerated, so a word the client's copy
   accepts and the server's no longer does is reachable in normal operation.
   One such word in guess 2 rejected guess 3, guess 4 and every turn after
   it — the player retypes forever — and the completion POST then answered
   `422 guess-mismatch`, which `apps/web/src/play/sync.ts` treats as
   terminal, settling the record `rejected` and losing the day for the
   streak on a row ADR-0026 decision 1 can never reopen. **`POST /termo/guess`
   now checks only the NEWEST guess** — the one the player just typed, the
   only one whose rejection is a player outcome — **and `judgeTermo` checks
   none.** Dropping it entirely there is safe and buys back nothing: a
   non-word earlier in the list cannot manufacture a win, because the win
   test is `guess === answer` and the answer is a dictionary member by
   construction.

   What it *does* mean, stated rather than implied: **an earlier non-word is
   judged, and the response carries its tiles** (`T-API-S42` pins
   `[NOT_A_WORD, <decoy>]` → 200 with `tiles.length === 2`), so a client can
   read feedback for any `^[a-z]{5}$` string and not only for dictionary
   words. That costs nothing this gate was protecting. The route is stateless
   with no server-side turn accounting, so unlimited *dictionary* probing was
   already free — consequence (a) accepts precisely that for the six-guess
   limit — and decision 9 already disclaims this route as a confidentiality
   boundary, so no later feature may rest on the narrower surface. **The gate
   is not coming back**: restoring it over the accumulated list is (i) above,
   whose failure mode is a permanently lost streak day.

   (ii) **The ladder is ONE module, not two copies.** It shipped written
   out in both route files under a TSDoc reading *"if either changes, change
   both"* — the exact trade decision 8 below rejects for `ACCEPTED_DAYS_BACK`
   (*renamed at #31: the hoisted bound is now `isWritableDate`, same module,
   same rule —
   [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
   decision 6*) one decision later, and with a worse failure: a gate added to the guess
   route alone would leave `POST /completions` recording a write-once `lost`
   row for a board the guess route would never have closed. It is now
   `judgeGuessList(guesses, answer): { tiles, status } | null` in
   `apps/api/src/termo/judge.ts`, beside `src/publishing/dates.ts` and for
   the same reason. The guess route returns `tiles` and `status`;
   `judgeTermo` discards `tiles` and maps `status === "playing"` to `null`.

   (iii) **`POST /termo/guess` gains a distinct `422 board-closed` code for
   the "a row follows a winning row" case.** It previously answered
   `invalid-guess` there — the same token the dictionary gate uses — so a
   desynced board was told a correct word was not in the dictionary, while
   `POST /completions` already named the identical fact separately
   (`guess-mismatch`). The two routes no longer disagree. `invalid-guess`
   now means exactly one thing: **the newest guess is not in the validation
   dictionary**, a legitimate player outcome the screen renders as "não está
   na lista". `board-closed` is a client bug or tampering and renders as a
   generic fault. See
   [ADR-0039](./0039-termo-cannot-be-played-offline.md) decision 3, amended
   in the same commit, for the client half.

5. **`storedSolution` is narrowed, never widened.** Its parameter type
   becomes `Exclude<CompletionRequest["game"], "termo">`, so TypeScript
   proves the route narrowed `body.game` before calling it, and
   `outcome: "won"` at `apps/api/app/completions/route.ts:247` becomes a
   computed value.

6. **`completions` gains a write-only `guesses integer` column, in this
   ticket.** ADR-0026 decision 1 makes the row write-once, so a row written
   without a count can never be backfilled: deferring the column to the
   statistics ticket would permanently lose the guess distribution ADR-0008
   rule 3 requires for every Termo day played in between. The CHECK ties it
   to the game — `(game = 'termo') = (guesses is not null)` — so a termo
   row with no count and a grid row with one are both impossible.
   `CompletionRecord`, `getCompletion` and `completionResponseSchema` are
   untouched: widening `CompletionRecord` would make
   `completionResponseSchema.parse({ ...record, recorded })` throw on every
   completion in the app, and the statistics ticket adds the projection
   when it needs it.

7. **`GET /daily/termo` ships, returning `game` and `date` only, and
   `apps/web` does not consume it.** Its presence-or-absence IS its
   payload — it is the operator's machine-readable check that a `killed_at`
   took effect, the same reason `apps/api/app/daily/nonogram/route.ts:20-24`
   gives. The web app reads the wall directly under ADR-0028 decision 5. A
   literal segment, never `[game]`.

8. **`ACCEPTED_DAYS_BACK` is hoisted to one module in `apps/api/src` and
   shared by both routes.** A player mid-game at the São Paulo rollover
   must be able to submit guess five for yesterday's date; two copies of
   the bound would drift. ADR-0026:186-191 warns that the **single** route
   constant must never be widened or removed by accident — *"Widening it
   accidentally — by removing the bound while 'fixing' a date test —
   reopens the whole past calendar to forged completions"* — which is an
   argument for keeping one copy, not a warning about two; the duplicate is
   #27's own risk and hoisting is how it is avoided rather than inherited.
   It stays in the route layer and out of SQL, which is what ADR-0026
   decision 6 actually requires.

   *(**Renamed at #31**, substance intact —
   [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
   decisions 5 and 6. `ACCEPTED_DAYS_BACK` no longer exists: it held two
   ideas under one name and split into `ROLLOVER_SLACK_DAYS` (the stats
   calendar's clamp, not a write bound and never to be used as one again) and
   `isWritableDate(date, today)` (the write window, upper bound only). This
   decision's whole argument survives word for word under the new name — one
   bound, one module in `apps/api/src`, shared by both write routes, in the
   route layer and out of SQL, so the two can never drift. What changes is
   that the bound is now a predicate rather than a number, and that its lower
   half is gone.)*

9. **NONE OF THIS IS A CONFIDENTIALITY ARGUMENT.**
   [ADR-0027](./0027-the-hint-is-computed-on-the-client.md):125-131
   forecloses it in terms that name Termo explicitly. Server judging exists
   because the client structurally has no answer to judge against, and
   because the answer is then not sitting in a JS variable for anyone who
   opens devtools — *casual inspection*, ADR-0027's own words. It is NOT a
   security boundary, and no later feature may rest on "the client cannot
   know today's answer".

   **The guess route IS an answer oracle, and its real cost is ONE
   authenticated request.** A body carrying six words from the validation
   dictionary that do not include the answer passes the dictionary gate,
   passes the "no row follows a winning row" gate (there is no winning row),
   and reaches `deriveBoardStatus`, which returns `"lost"` for six rows none
   of which is all-correct (`packages/games/src/termo/status.ts:22-40`).
   `status !== "playing"` then makes decision 2's refine **require**
   `answer`. No search, no adaptivity, no cleverness. An earlier draft of
   this decision claimed an *"information-theoretic floor of two requests"*;
   that was wrong, and it is withdrawn rather than quietly softened.

   **Two arguments survive, and the decision rests on exactly these.**
   (i) ADR-0004's threat is spoiler broadcast of an **unpublished** day, and
   this oracle reaches only published ones: every read goes through
   `getPublishedDailyWithSolution`'s `wallPredicate`
   (`packages/db/src/published.ts:35-44`), so it returns only days the caller
   could already have played — and ADR-0004 already recorded the rest,
   *"There is nothing to cheat for — v1 has no global ranking (a product
   veto), so a cheated streak only cheats its owner."* (ii) The project has
   already accepted a **strictly cheaper** exposure of the same kind:
   `solveBinairo(givens)` is a 0.04–0.16 ms **local** solve over data the
   published payload hands the client (ADR-0027 decision 1), needing no
   session, no network and no server. One authenticated round trip is more
   expensive than that, not less. Neither argument is a security claim, and
   this paragraph must never be cited as one.

## Rejected

- **Shipping today's answer to the client at first load.** The strongest
  rejected option, and it is rejected on the ticket and the strip table,
  NOT on ADR-0004 — which permits it in as many words. It would make Termo
  play offline, delete this route, delete the guess contract and remove a
  round trip from the ritual's critical path on Brazilian mobile networks,
  at a cost of one five-letter word on the daily payload. (An earlier draft
  put that cost at *"about two bytes, since the 400-word answer list already
  ships"* — false as of the same PR:
  [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)
  decision 5 keeps `TERMO_ANSWERS` out of the client bundle. The corrected
  figure is still negligible, which is why the rejection never rested on
  it.) What it costs is that today's
  answer becomes readable in devtools at 00:00:05 by anyone curious, with
  no play required — and spoiler broadcast, not cheating, is the threat
  ADR-0004 says matters. Raising that cost from "any curious person" to "a
  deliberate script" is a product withhold of exactly the kind ADR-0033
  records for the Nonogram name. See "Parked" below.
- **Server-side guess state in a new table.** The only design that can
  enforce the six-guess limit, and enforcing it buys nothing: a client that
  wants a fraudulent streak day already has `solveBinairo(givens)` at
  0.04–0.16 ms (ADR-0027 decision 1), so the expensive forgery would be
  closed while the cheap one stayed open. It also costs a hand-applied Neon
  migration, a mutable per-user table with no retention story, and an
  idempotency problem the stateless route does not have — a POST whose
  response is lost would append twice, where re-posting a list is free.
- **A commitment scheme (hash of answer + salt) verified on the client.**
  Rejected on the operation, first: **a commitment verifies a revealed
  value and cannot compute tile states**, which is the only thing the game
  actually needs from the answer. It is also theatre, by ADR-0004's rejected
  list verbatim — *"A hash is a public function: if the client can derive
  the key from data it already holds, it can derive it the moment the
  payload arrives."* The client does **not** hold the 400 answers
  ([ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)
  decision 5), and it does not need to: the search space is the **5,310-word
  validation dictionary**, which does ship — and every one of the 400
  normalized answers is a member of it (verified against
  `content/termo/answers.csv` and `content/termo/validation.txt`). 5,310
  hashes is still under a millisecond. *(**Annotation (a) — as-of-writing,
  #140.** 5,310 was the count when this was written; the dictionary grows
  through curated additions ([ADR-0062](./0062-termo-guess-dictionary-gaps-close-with-curated-additions.md)),
  5,408 as of #140. The argument is unchanged at any plausible size.)*
- **An HMAC guess chain** (each response returns a token over the guesses
  so far, required with the next guess). Enumerated because it looks like
  the cheap middle path and is not: the client holds every earlier token,
  so it enforces prefix consistency but not monotonic progress — rewind and
  branch still works. Stopping rewind requires server state, i.e. the table
  above. Cryptography that does not close the hole is what decision 9
  forbids.
- **Judging only the newest guess.** Saves nanoseconds and costs the server
  any authoritative view of board status. This is about the JUDGEMENT — the
  whole list is still evaluated and `deriveBoardStatus` still runs over all
  of it. It is not about the DICTIONARY CHECK, which decision 4's amendment
  deliberately narrows to the newest guess for an unrelated reason: an
  earlier non-word cannot change the board's status, so re-rejecting it
  every turn only soft-locks an honest player.
- **Batch judging at the end of the game.** The feedback loop is the game.
- **A `tiles` or an `outcome` field on the completion request.** A second
  place for the client to lie about a fact the stored row owns — the
  argument that kept `size` off the nonogram member
  (`packages/core/src/contracts/completion.ts:136-141`) — and, for
  `outcome`, the same class of client-asserted input as the completion
  instant ADR-0026 rejects.
- **A constant-work comparison in the Termo judge.**
  `apps/api/app/completions/route.ts:224-230` anticipated one *"where the
  answer word IS the product's one secret"*. There is no timing channel to
  close: both routes return the judgement in the body. The grid loop stays
  exactly as it is and the comment's forward reference is corrected in the
  same commit.
- **Widening `storedSolution` to return something Termo-shaped.** Its own
  TSDoc rejects it, and a `readonly number[]` return has no honest Termo
  meaning.
- **Deferring the `guesses` column to the statistics ticket.** Write-once
  rows make it unrecoverable, and the value is already in the request.
- **Rate limiting either new route in this ticket.** See consequence (f) —
  the posture is stated rather than inherited, and it is *no* limiting.

## Consequences

- **(a) The six-guess limit is not enforceable against a tampering
  client**, and that is accepted rather than hidden. A client may re-post a
  shorter prefix and buy extra turns. It cheats only its owner, and it is a
  strictly more expensive forgery than the one every grid game already
  permits.

  *(**Qualified at #34** —
  [ADR-0054](./0054-the-share-is-plain-text-and-the-card-is-a-nameplate.md)
  decision 3. **"It cheats only its owner" gains an audience.** The share text
  broadcasts the guess count as `n/6` **and the tile grid**, both composed on
  the device from the local play record (`apps/web/src/play/share-text.ts`),
  so a bought turn is now a number a player sends to other people. ADR-0054
  concedes exactly this bound for the three grid games' self-reported elapsed
  time and did not carry it to the one game whose count is server-shaped;
  it does here. **The prohibition half of this consequence is untouched** —
  nothing is enforceable that was not, no rate limit is added, and ADR-0006
  `:51`'s posture (*"not an anti-cheat system … for a rank that v1 does not
  have"*) is why the widened audience changes no design. Two adjacent clauses
  are one item short for the same reason and are not separately annotated:
  (b)'s sink list for a self-reported Termo row now includes the share text,
  and (f)'s revisit trigger should read the share as one more consumer of the
  guess count. No header: no decision moves and no route enumeration grows —
  the `0034:164` / ADR-0045 `:186-191` annotation-only shape.)*
- **(b) A Termo `lost` row is self-reported in the same sense `hints_used`
  is.** A client can suppress a loss or fabricate a win. Both failure
  directions are safe — suppression grants nothing, and a fabricated win
  grants a streak day available for free elsewhere — but under ADR-0027 and
  ADR-0031 decision 6 a Termo row may feed the player's own distribution
  and may never back a medal or an entitlement.
- **(c) The server-side re-check is what makes a client bug non-fatal.**
  Write-once rows mean a prematurely posted loss would cost the player the
  day permanently; the `"playing" → 422, no row` rule is the guard, and it
  must not be relaxed.
- **(d) A lost day cannot be reopened, with no new code.** The idempotent
  short-circuit at `apps/api/app/completions/route.ts:185-188` runs before
  the wall read and before any judging, so a replay carrying a winning list
  returns the stored `lost` row. ADR-0008's *"a loss followed by an archive
  replay does not reopen the daily"* is already enforced.
- **(e) ADR-0032's byte-identity property does not survive, and its
  substance does.** Two honest winners on guess four post different bytes,
  because they guessed different words and there is no smaller canonical
  form that proves a win. What survives is what ADR-0032 was protecting: no
  leniency rule, no client-asserted outcome, no second place to lie.
  Byte-identity is kept where it can be — the wire is normalized, so "AÇÕES"
  and "acoes" are the same bytes.
- **(f) The abuse posture is stated here rather than inherited, and it is
  no rate limiting.** ADR-0024's posture covers unauthenticated reads and
  ADR-0026's the write; the guess route is neither, so neither
  justification transfers and neither ADR is amended, because nothing they
  say becomes false. The route is authenticated, writes nothing, and
  allocates nothing unbounded (≤6 elements of `^[a-z]{5}$`).
  **It is not cheaper than `GET /daily/<game>`, and the earlier claim that
  it was is withdrawn.** It costs **three** Neon round trips — `resolveSession`
  through `requireUserId`, `todaySaoPaulo(db)` for the accepted-window bound,
  and `getPublishedDailyWithSolution` — because neon-http gives **each
  statement its own trip**, a fact this repo records at
  `apps/api/src/session/service.ts:19-20` (*"each statement is its own
  neon-http round trip"*). `GET /daily/<game>` is **one**
  (`apps/api/app/daily/nonogram/route.ts:32`, a single `getTodayDaily`),
  and `apps/web` calls it **zero** times, where the guess route runs ~6× per
  player per day. So the posture rests on the corrected figure and not on a
  comparison: three indexed reads and no write, at a volume bounded by the
  ritual, is not ADR-0026's *"first abuse signal"*, and a shape change is
  not one either.

  *(**Amended at #31** —
  [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)
  decisions 5 and 11. The two sentences that rest on the ritual — *"the guess
  route runs ~6× per player per day"* and *"at a volume bounded by the
  ritual"* — stop being true: every published past Termo becomes playable at
  its own URL, so the route's legitimate volume is six times however many
  archived Termos a player opens. That URL arrived in #31's second pull
  request; the widened window this annotation shipped beside arrived in the
  first, and was already enough to make the bound false in kind. The **posture is unchanged**: still no rate
  limit on this route, because it writes nothing, allocates nothing unbounded
  and was already unthrottled per request before #31 — the date axis was
  never what bounded its request count. The rest of (f) stands as written,
  including the corrected round-trip figure and the unthrottled-minting
  caveat. Where the write side's abuse posture DID need a replacement, #31
  ships one: a 50-per-user-per-São-Paulo-day ceiling on late completions,
  ADR-0053 decision 13.)*

  Two honest caveats: the cross-site guard is *not* load-bearing here, because
  `isCrossSiteWrite` denies on positive evidence only
  (`apps/api/src/session/origin-guard.ts:13-31`) and `curl` walks past it — what
  stops a hostile browser page reading a response is the exact-origin CORS
  grant (`apps/api/src/cors.ts:12-25`); and minting is unthrottled, so "one
  session cookie" is not a real cost to an attacker. Revisit trigger: the
  first abuse signal, the rewarded-ad ticket, or the first time a guess
  response would reveal something a *published* row does not already imply.
- **(g) `apps/web` now calls `apps/api` for a third thing.**
  `apps/api/app/daily/nonogram/route.ts:19-20`'s *"the web app fetches
  `/session` and `/completions` only"* becomes false and is corrected in
  the same commit. ADR-0014's rule that `apps/api` owns *"all writes and the cron, without
  exception"* is untouched; this is a user-specific *read*, which ADR-0014 already routes
  the same way.
- **(h) The migration is real operational work, and it is applied BEFORE
  the branch's API is ever deployed.** `packages/db` migrations reach Neon
  by hand via `DATABASE_URL_UNPOOLED`; nothing in CI or Vercel runs them.
  Applying early is a non-event, and that was checked rather than assumed:
  the CHECK's equality form `(game = 'termo') = (guesses is not null)`
  holds for every existing row (`false = false`), and no code on `main`
  names the column. **The unsafe order is a deploy that precedes the apply,
  and its blast radius is all four games — not termo.** Drizzle builds an
  INSERT's column list from the **table schema object**, never from the
  values object, so adding `guesses` to `packages/db/src/schema.ts` changes
  the SQL that `recordCompletion` (`packages/db/src/completions.ts:93-106`,
  whose values object omits the key and whose `.returning()` is bare)
  emits for **every** game. Built against the installed drizzle-orm 0.45.2:

  ```
  insert into "completions" ("user_id","game","date","outcome","elapsed_ms",
    "hints_used","guesses") values ($1,$2,$3,$4,$5,$6,default)
    on conflict do nothing returning …, "guesses"
  ```

  The omitted key is emitted as `default` and `.returning()` selects it, so
  against a pre-migration database every `POST /completions` 500s —
  Binairo, Sudoku and Nonogram included. **Nothing "rejects" anything at
  the CHECK**: the CHECK ships in the same migration and is never reached.
  The 500 is not in `apps/web/src/play/sync.ts:47`'s `TERMINAL_STATUSES`,
  so those records stay `pendingSync` and replay — and because `on_time` is
  derived at read from `completed_at` (`completions.ts:55`), a replay window
  that crosses São Paulo midnight silently reclassifies every one of them as
  late, for all four games, with nothing alerting. That is precisely what
  ADR-0026 exists to prevent. Rollback is one statement (`ALTER TABLE
  completions DROP CONSTRAINT completions_guesses_check;` then `DROP COLUMN`),
  and the journal is hand-kept: `drizzle-kit migrate` is never run against
  Neon.
- **(i) `packages/core` restates Termo's two bounds and pins them by
  test.** `@miolos/games` is a devDependency of `packages/core` and stays
  one: a runtime dependency would put `words.generated.ts` on the import
  path of every core consumer, `apps/web` included. `TERMO_MAX_GUESSES` and
  `TERMO_WORD_LENGTH` are prefixed because the API judge imports both these
  and the engine's `MAX_GUESSES`/`WORD_LENGTH` in one file.
- **(j) The client and the server run the SAME validation predicate over
  the SAME byte-pinned list.** `isValidGuess` and `words.generated.ts` are
  pinned byte-for-byte by the ADR-0015 harness
  (`packages/games/test/termo/word-list.test.ts`), so "não está na lista"
  is instant and offline on the client and re-checked on the server without
  a second source of truth. The server check exists because the server
  never trusts the client, not because the client's is unreliable.
  **Amended at #27 (step-6 review): the two lists are pinned byte-for-byte
  in the REPO and can still differ in PRODUCTION**, because `apps/web` and
  `apps/api` are separate Vercel projects that deploy independently. That is
  why decision 4's amendment scopes the server re-check to the newest guess
  — the disagreement is a real, survivable state rather than an impossible
  one, and it must cost the player one retype and not the day.

## Parked: shipping the answer to the client

If per-guess latency on Brazilian mobile networks turns out to hurt real
play — the same trigger shape ADR-0004 parks its encrypted prefetch under —
the only design that removes the round trip is shipping today's answer with
the daily and judging on the client, with the completion route re-judging
the posted guess list exactly as it does now. It is compatible with
ADR-0004 as written and incompatible with issue #27's acceptance criterion
and the strip table, so it is Fernando's call and not an agent's.
**Trigger condition: measured guess-round-trip latency complaints or
failures on Brazilian mobile networks. Not before.**
