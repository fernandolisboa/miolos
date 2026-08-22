# ADR-0070 — The daily Nonogram conclusion names its motif, over the wire

**Status:** Accepted — 2026-08-21 (issue #64, shipped in #188)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0034](./0034-the-conclusion-is-one-shared-view-with-a-per-game-payoff.md), [ADR-0060](./0060-the-day-truth-is-one-endpoint-one-store-one-merge.md), [ADR-0065](./0065-the-cross-device-completed-view-is-honest-about-absence.md)
**Supersedes in part:** [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md) — decision 1's **name clause only** (*"`reveal.motifId`, `reveal.name` and `reveal.mirrored` never reach the client in v1"*) is replaced for `reveal.name`, on the exact path decision 5 itself specified. `motifId` and `mirrored` never reach any client payload, on any status; the daily-payload and completion-response guarantees stand as written; decision 2's product-not-security register, decision 3's `FORBIDDEN_DAILY_KEYS` additions and decision 4's rename rule are untouched and are what this decision is built on.
**Amends:** [ADR-0046](./0046-free-play-generates-on-the-client.md) — consequence 1's *"names remain non-user-facing everywhere"* narrows to FREE PLAY, which stays permanently unnamed. It is a narrowing, not a reversal: `use-free-nonogram.ts` still drops `reveal` at the parse.
**Amends:** [ADR-0047](./0047-bundle-markers-are-route-scoped.md) — its *"to generate and never to name"* clause stays true **of the bundle**, which is the only thing it was ever about. The daily name is wire-delivered and no motif table is bundled.
**Amends:** [ADR-0060](./0060-the-day-truth-is-one-endpoint-one-store-one-merge.md) — annotation **(i)**, at two loci: decision 2's *"no puzzle content of any kind"*, and decision 3's not-merged list.
**Amends:** [ADR-0065](./0065-the-cross-device-completed-view-is-honest-about-absence.md) — decision 1's honest-absence table gains the motif NAME as a second recorded absence on the remote completed view; decision 2's *"one wire field"* template is the one `motifName` is built to.

## Context

[ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md) decided that the
revealed Nonogram picture ships **no curated name**, and stated the cost
honestly in its consequence (a): *"a screen-reader user gets a described
figure, not a named one."* Every player got *"a figura do Nonogram de hoje"*
where the library had written *"Âncora"*.

That decision also wrote down its own exit. Decision 5: *"A named reveal, if
it is ever wanted, is an authenticated post-completion server read … owed as
its own feature ticket, not built here, and it is not blocked by anything in
this decision."* Fernando decided on 2026-08-20 (#64) to ship the name.

So the question this ADR answers is not *whether*. It is **which seam**, and
what the seam costs — because ADR-0033 rejected the two obvious ones with
reasons that are still true in the code today, and because ADR-0004's
guarantee has to survive the change by construction rather than by care.

## Decision

1. **The name ships as an optional `motifName` on the `/day` per-game
   claim** — [ADR-0065](./0065-the-cross-device-completed-view-is-honest-about-absence.md)
   decision 2's `hintsUsed` template verbatim. It is **post-completion by
   construction**, which is the whole reason this seam was chosen over a new
   endpoint: a claim is a projection of the user's own completion rows, so
   the name cannot exist on a claim before the server judged that user's day.
   It also satisfies ADR-0033 decision 5's own shape — `GET /day` is
   credentialed and parameterless, and decision 5 asked for a *read*, not a
   route.

2. **The field is spelled `motifName`, and `FORBIDDEN_DAILY_KEYS` is not
   amended.** This is ADR-0033 decision 4's prescribed route taken rather
   than dodged: *"A payload that genuinely needs a name renames its field or
   amends the list on the record."* `"name"`, `"motifId"` and `"mirrored"`
   stay banned as both key and markup substring; every landed leak scan keeps
   passing **on merit**. `motifName` and the CSS local `.pictureName` both
   carry a capital `N`, so neither is a substring of the banned lowercase
   `"name"`.

3. **The publication rule is enforced twice, at both ends of the seam.**
   `dayGameStateSchema` refuses a `motifName` on any status but `completed`
   (a parse failure, not a value a client must decide about), and
   `dayGamesFromRows` attaches it only to the **nonogram** claim, only from
   the status its own fold computed. The producer, not the caller, decides
   whether a claim may carry a name.

4. **The read is `getPublishedNonogramMotifName`, on `@miolos/db/publishing`
   and never the root entry** (ADR-0024). It carries the same
   `published_at <= now() AND killed_at IS NULL` wall as every reader in that
   module, parses inside the wall, and returns one string — the
   strip-inside-the-wall rule at its limit, not an exception to it. The root
   entry is `apps/web`'s, and a root export would hand an RSC segment a
   one-line channel to today's motif name.

5. **The read never throws, and an empty stored name normalises to
   `undefined`.** `/day` touched only the clock and `completions` before
   this; it now touches `daily_puzzles`, and an escaping error would 500 the
   **whole** day payload — hub, four tiles, every completed view — for a user
   whose only sin was finishing the Nonogram. `nonogramRevealSchema` has no
   `.min(1)` (the `reveal-name-empty` rejection lives in `packages/games` at
   generation time), so a stored `name: ""` parses; returned as-is it would
   fail the wire's `.min(1)` inside the route's own parse and produce exactly
   that 500 — the failure ADR-0065 decision 2 records for the `hintsUsed`
   cap. Normalising at the read costs nothing; tightening the content schema
   would be a write-side change that can drain the buffer.

6. **Two render sites: the in-place conclusion on `/nonogram`, and
   `/nonogram/concluido`.** The name and its lead arrive as optional `name`
   and `lead` on `ConclusionPicture`, composed once in
   `nonogram-conclusion.tsx` and handed down as data. `ConclusionView` stays
   game-blind and reads no Nonogram string; Termo's `ConclusionAnswer` is the
   shipped precedent. This adds no member to the payoff budget
   ([ADR-0034](./0034-the-conclusion-is-one-shared-view-with-a-per-game-payoff.md)
   consequence (c)) and no per-game arm.

7. **The archive, free play and the cross-device REMOTE completed view are
   non-goals, recorded as choices.** The archive: `/day` takes no date by
   design and the late-result panel composes no reveal. Free play: motifs
   recur across infinitely many generated puzzles, there is no day to judge
   and no server read to make, so it stays unnamed permanently. The remote
   view: *"Você revelou: Âncora"* with **no picture**, on a device where the
   player did nothing, is a caption for a missing image — the name joins the
   picture in ADR-0065 decision 1's honest-absence table as a second recorded
   absence. An unread optional claim field is what that table is for.

8. **The a11y shape: the `<svg role="img">` keeps its role and composes the
   name into its `aria-label`; a visible caption carries the lead and the
   name; the live region is NOT touched.** The conclusion's `role="status"`
   announcer is a prop composed before mount, and writing it when a name
   lands late would break the DISJOINT-WRITERS rule ADR-0042 decision 10
   requires and ADR-0054 decision 4 records. A caption appearing is not a
   status. This discharges ADR-0033 consequence (a).

9. **A completion that settles `recorded` nudges the day-truth store once.**
   The server's day truth genuinely changed, so the refetch is honest
   independent of this feature; without it the just-solved player waits up to
   60 s for the poll on the one screen whose whole point is the payoff. The
   trigger lives in `conclusion-view.tsx` and is game-blind. It is one-shot
   and event-driven, so ADR-0060 decision 5's poll clause is untouched.

10. **The bundle tripwire is KEPT, with a rewritten warrant.** See
    consequence (c).

## Rejected

- **The completion response.** ADR-0033's Rejected entry is still true in the
  code: it breaks the ADR-0028 offline finish; it is discarded by
  `acceptResponse`/`settle` before any reload could show it; and it is
  structurally nameless on the replay path, which returns before the wall
  read by ADR-0026's design. Repairing it means widening the play-record
  schema, which decision 10 below refuses.
- **A new post-completion endpoint.** A whole route, its CORS, its contract
  and a credentialed GET, for one string —
  [ADR-0051](./0051-stats-are-computed-server-side-on-read.md) decision 3's
  endpoint-count trigger is sized against exactly that. Its one advantage
  over the claim rider is a `?date=`, which buys nothing while the archive is
  a non-goal.
- **Bundling the motif tables so the client can name the picture locally.**
  ADR-0033's measurement stands (+5 036 B gzip, a widened `packages/games`
  barrel, a reverse-lookup surface that exists for nothing else) and it is
  the ONLY change that would actually kill the bundle tripwire.
- **`name` plus an amendment to `FORBIDDEN_DAILY_KEYS`.** It spends a generic
  standing ban across every game's projection to gain nothing over a rename.
- **A `superRefine` on `dayResponseSchema.games` scoping `motifName` to
  `games.nonogram`.** It costs a whole-object refine to buy a schema-level
  guarantee the producer already gives. The residual it would close is
  recorded in consequence (e) instead.
- **Persisting the name into the play record.** The record schema is closed
  and stays closed; the read repeats via `/day` on every mount.
- **Firing the refresh nudge from `sync.ts`.** `sync.ts` is in the ARCHIVE
  routes' module graph, so a trigger there would fire a credentialed
  `GET /day` from an archive late write on a public, crawler-facing route —
  falsifying ADR-0053 decision 9 and ADR-0060 consequence (d). An
  `onRecorded(listener)` registry inside `sync.ts` also keeps the graph clean
  and was rejected for cost: a module-level listener set, a registration
  lifecycle and a second way for the play layer to talk to the day layer, for
  a trigger one existing effect already expresses.
- **Retiring the bundle tripwire.** Fernando's instruction on #64 authorised
  *spending* it. It turns out nothing has to be spent (consequence (c)), and
  discarding a live guard because we were licensed to is not a reason.

## Consequences

- **(a) `/day` reads `daily_puzzles` for the first time**, conditionally —
  only for a caller whose Nonogram already reads `completed`, so most
  requests pay nothing. The status condition is `dayStateFromRows`, the same
  derivation the claim fold uses, never a second hand-rolled spelling of the
  publication rule.
- **(b) The composed DESCRIPTION remains, and is now the degraded label.** An
  offline finish, any pre-sync paint, a deploy-skewed old payload and a
  killed daily row all render exactly what shipped before #64: the described
  figure, no caption. Nothing is fabricated. `messages.games.nonogram.
  reveal.aria` is therefore live copy, not dead copy.
- **(c) The bundle tripwire LIVES, and its warrant is rewritten.** ADR-0033
  consequence (d) promised *"that check dies the day a name ships — #64"*.
  It does not: `apps/web/scripts/route-client-js.mjs` greps
  `.next/static/chunks/**` only, and an API JSON response is never a chunk.
  The new warrant is **"no motif name may reach a daily-scope chunk; the
  daily name arrives over an authenticated wire, never from the bundle."**
  Markers, scopes, exit code and `bundle-markers.test.ts` are unchanged, and
  non-vacuity survives in both directions —
  `EXPECTED_DAILY_SCOPE`'s malformed-clues control still proves the walk
  reaches `packages/games` chunks, and `EXPECTED_FREE_PLAY_SCOPE` still
  proves ADR-0047's attribution separates the two sets.
- **(d) A post-mount accessible-name mutation, named as the AT pitfall it
  is.** When the claim lands late (offline finish, then sync) the accessible
  name of an **already-mounted** `<svg role="img">` changes. That is legal —
  it is not a live-region write — and a changing accessible name is a known
  screen-reader pitfall, so it is recorded here rather than discovered. It
  rides the real VoiceOver/NVDA pass ADR-0042 consequence (e) already owes.
  `T-WEB-S325` pins the before and after labels.
- **(e) `motifName` is wire-legal on all four games' claims.**
  `dayResponseSchema.shape.games` maps termo, sudoku, nonogram and binairo to
  the same `dayGameStateSchema`, so the contract permits a name on any
  completed claim; only the producer scopes it to nonogram — the same
  arrangement as Termo's duration suppression. Recorded rather than closed
  with a refine (Rejected, above), and asserted in `T-CORE-S114` so the cost
  is visible rather than described.
- **(f) The remote completed view carries a claim field it deliberately does
  not read.** ADR-0065's honest-absence table is the instrument; a later
  ticket can reverse decision 7's remote-view cut cheaply, and nothing in
  this design has to change for it to.
- **(g) `sameGame` compares `motifName`.** Without it, a first read that
  raced a killed or malformed daily row answers `completed` with no name, the
  corrected payload one trigger later differs in nothing else, `samePayload`
  swallows it, and the caption never appears for that user today. `T-WEB-S328`
  pins it.
- **(h) No loop is reachable through decision 9's nudge, and this is a proof
  rather than an assurance.** `refresh()` never writes a play record, so
  `settle` cannot be re-entered from it; `settle` drops the record from the
  fallback queue, so the trigger fires at most once per record; `inFlight`
  dedupes concurrent triggers; and `settle(_, "recorded")` has exactly ONE
  call site (`acceptResponse`, covering both the `recorded: true` and
  `recorded: false` arms), so this is one condition and not two branches. The
  nudge can fire with no listener subscribed — `refresh()` is guarded by
  `inFlight` and by nothing else — which is accepted explicitly and bounded
  at four completions per user per day.
- **(i) The copy register is the shipped card's, not the issue's phrasing.**
  The caption borrows Termo's `dayWordRow` slot, where the kicker is an 11px
  tracked-uppercase **impersonal** line and the second person lives in the
  sentence above it. So the lead is *"A figura de hoje era"* and the second
  person lives in the accessible label — *"Você revelou Âncora — …"*.
  Fernando's *"Você revelou: Âncora"* on #64 is illustrative phrasing of the
  FEATURE, and copy register is the agent's call under `CLAUDE.md`.
