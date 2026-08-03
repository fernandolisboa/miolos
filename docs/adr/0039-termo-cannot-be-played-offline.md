# ADR-0039 — Termo cannot be played offline; the degraded behaviour, stated

**Status:** Accepted — 2026-08-02
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md), [ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md)

## Context

[ADR-0028](./0028-daily-play-routes-and-the-conclusion.md) makes finishing
offline a requirement and builds a mechanism for it: the play screen swaps
its body from the play view to the conclusion view when the local state
closes — no navigation, no RSC fetch — *"which is what makes finishing
offline work with no service worker."* Its Context is blunter still:
*"ADR-0004's one supported offline scenario is mid-puzzle, and #18 requires
that finishing there works."*

[ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md)
puts the judgement of a Termo guess on the server. Every guess therefore
needs the network, and a Termo game cannot be finished offline. The
conflict is real, it cannot be engineered away, and the alternative that
would remove it — shipping the answer — is rejected and parked there.

What has to be decided is not *whether* Termo degrades, but exactly how:
what the screen does when a guess POST fails, what the local record holds,
what the conclusion shows, and which existing machinery is and is not the
right vehicle. Leaving those to be discovered at implementation is how the
project's shared layer would get bent around Termo one guess at a time.

## Decision

1. **Termo cannot be played to a finish offline, and this ADR says so
   rather than implying parity.** What still works offline is narrower and
   real: an already-loaded board renders, typing works, and the "não está
   na lista" rejection is instant, because `isValidGuess` runs on the
   client over the same byte-pinned list the server uses. What does not
   work is judging a submitted guess, and therefore finishing.

2. **ADR-0028 decision 2's MECHANISM survives intact; only its RATIONALE is
   unreachable for this game.** The in-place conclusion swap still ships for
   Termo and still works, because the response that closes the board has
   already arrived by the time the board is closed. Nothing in ADR-0028's
   Decision is amended. Copying the route shape — a slug, a `routes` entry,
   two `force-dynamic` segments, a conclusion view — is still required; what
   cannot be copied is the sentence explaining why the in-place half exists.

3. **A failed guess is HELD, never queued and never silently lost.**
   - `fetch` rejects (offline), any 5xx, a 401 that survives one forced
     re-mint, or a 429: the guess stays in the pending row in its own visual
     state, an inline pt-BR line names the connection, and the same guess is
     re-posted on retry and on the `online` event. **The turn is not
     consumed.**
   - 400, 403, 415 or 422: a client bug or tampering. The guess is cleared
     with a generic inline error, distinct in copy from "não está na lista",
     and the turn is not consumed — the server never judged it.

     **Qualified at #27 — the 422 row SPLITS ON ITS ERROR CODE, and one of
     the two halves IS "não está na lista".** The blanket sentence above was
     written before the wire had error codes, and taken literally it forbids
     the copy the shipped screen correctly renders. The rule is:

     | Response | Meaning | What the screen shows |
     |---|---|---|
     | `422 {"error":"invalid-guess"}` | The NEWEST guess is not in the server's validation dictionary. A **legitimate player outcome**, reachable whenever `apps/web` and `apps/api` — separate Vercel projects — disagree about `validation.txt` ([ADR-0038](./0038-termo-guesses-are-judged-by-a-stateless-server-route.md) decision 4 as amended, and its consequence (j)). | "não está na lista", the **same** sentence the instant client-side rejection renders. Same fact, same words. |
     | `422 {"error":"board-closed"}` | The posted list continues past a winning row. A client bug or tampering, **never** a player outcome. | the generic inline error. |
     | any other 422, and 400 / 403 / 415 | a client bug or tampering | the generic inline error. |

     So the original sentence holds for every 422 except `invalid-guess`,
     and that one exception is not a leak of a system fault into player
     copy — it is the opposite. Rendering "não está na lista" as a generic
     failure would tell a player their connection or the server was broken
     when in fact their word simply is not in the list, and would hide the
     one 422 they can act on. A future contributor "enforcing" this ADR by
     collapsing the split would reintroduce exactly that.
   - 404: the day is gone (a killed row, or out of the accepted window).
     The screen renders the same unavailable view ADR-0028 decision 4
     specifies.
   - **A 200 whose body fails `termoGuessResponseSchema`: HELD.** The
     response is *parsed, never cast* — `CLAUDE.md`'s boundary gate — and a
     parse failure is a server bug, not a verdict, so the turn is neither
     judged nor rejected. It is the one row in this list where the status
     code says nothing, and it is exactly the direction `sync.ts:399-410`
     already takes for the completion: *"A 200 the contract does not
     recognize is a server bug, not a player problem: keep the only copy of
     the completion queued rather than discarding it on a body we cannot
     read."* Applied to a turn, that means the guess stays in the pending
     row and is re-postable. **A live turn must survive a server bug.**
   - **429 is never terminal.** This repo emits none today — the vocabulary
     borrowed here is `sync.ts:47`'s `TERMINAL_STATUSES = new Set([400, 403,
     404, 415, 422])`, which contains no 429 — and the case exists because
     the platform firewall can emit one. Settling a live turn as "rejected"
     on a load spike would cost the player a guess.

4. **`sync.ts` is NOT the vehicle for a guess, and this is a decision rather
   than an omission.** Its queue is a *completions* queue keyed on
   `pendingSync` (`sync.ts:82-91`, posting to `/completions` at `:380`);
   `settle(record, "rejected")` clears that flag permanently
   (`sync.ts:427-433`), which is the opposite of what a live turn needs; its
   ladder is deliberately un-urgent (`[2_000, 5_000, 15_000, 60_000]`,
   `sync.ts:55`) and bails in a hidden tab (`:448-455`); and its
   module-level guards (`:57-60`) exist to keep ONE game-blind queue
   coherent, so pushing a foreground turn through them would let a
   background flush reset a live retry. The guess POST is a foreground
   awaited fetch in Termo's own module, sharing only `ensureSession()` and
   the re-mint-once-per-page-load rule — not a second sync module.
   [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
   consequence (f) is untouched: Termo still adds its `case` to `buildBody`
   for its COMPLETION.

   **Corrected at #27's step 6 — the shared rule is a SHARED MINT, and the
   "duplicated boolean" this decision prescribed is the one thing it must not
   be.** The draft above ended *"a duplicated boolean, not a second sync
   module"*. The second half stands; the first shipped once and was removed
   before merge (finding B-1), because a boolean per module is not a copy of
   a rule — it is a second, invisible authority over one shared resource.
   `ensureSession()` holds **one** module-level promise, a forced re-mint
   unconditionally replaces it, and `POST /session` mints a **brand-new
   user** for any cookieless request (`apps/api/app/session/route.ts`). Two
   booleans cannot see each other, so a stale cookie plus one unsynced
   completion plus a live Termo turn put two cookieless mints in flight at
   once: two identities, whichever `Set-Cookie` lands last survives, and the
   completion is written for the one that did not — a write-once row under
   ADR-0026 decision 1, so a permanently lost streak day through the
   identity-overwrite class ADR-0003 names as its worst failure.

   What ships is the allowance living beside the promise it guards, in
   `apps/web/src/session/bootstrap.ts:40-41` — `reminting` (the re-mint in
   flight, which a second caller **joins** instead of racing) and
   `remintSpent` (the once-per-page-load allowance, re-armed by
   `confirmSession()` when the fresh identity is seen to serve a request).
   Both callers keep their own independent decision to **ask** —
   `sync.ts:213-234` for the completion flush, `termo/guess-client.ts:152-166`
   for the turn — and the **mint** stays singular. The request count is
   unchanged; only the ambiguity is gone. A contributor "enforcing" the
   original sentence by restoring a local boolean reopens the race in full.

5. **The play record persists only judged turns.** The judged guesses and
   their server-issued tiles — which cannot be recomputed without the
   answer, so persisting them is forced — plus `answer`, written
   exclusively in the write that flips `concluded`
   ([ADR-0044](./0044-a-lost-termo-is-played-not-pending.md) decisions 1
   and 2). The un-judged in-flight guess is deliberately NOT persisted: a
   reload costs five retyped letters, where a persisted un-judged guess
   would be a third state the schema has to carry and reconcile. `v` stays
   `1`.

6. **A day left mid-play shows the conclusion's EXISTING "ainda não
   concluído" state, and stays pending everywhere.** There is no
   "abandoned" state and no "you ran out of connection" state. The record
   is not `concluded`, so the day reads pending, it does not enter the
   completed count, and nothing is queued because nothing closed. This is
   [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md)
   decision 2's direction by construction: *"A false pending is
   invisible… A false done would be a lie the player can catch."*

7. **A board that closed online but whose completion POST failed behaves
   exactly like the three grid games**: `concluded: true, pendingSync:
   true`, the conclusion renders with the existing discreet pending-sync
   line, and the existing queue flushes it. Nothing new is required, and
   the two scenarios must not be conflated in copy or in tests.

8. **The timer keeps running through a network stall.** Adding an offline
   pause would put a second pause authority beside
   `use-play-lifecycle.ts`'s `visibilitychange`/`pagehide` path
   (`use-play-lifecycle.ts:129-155`, both listeners registered at `:175-177`), in a module ADR-0029 decision 2 makes
   shared. Termo's `elapsedMs` therefore includes network waits and is not
   comparable to a grid time — which is one of the reasons
   [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)
   decision 4 does not render it.

## Rejected

- **A service worker so guesses can be queued and judged later.** Out of
  scope by ADR-0001 (which pairs the service worker with push in M3) and it
  does not solve the problem in any case: a queued guess has no "later" —
  by the time it drains the player has stopped playing, and a turn judged
  into an empty room is not gameplay.
- **Judging guesses locally when offline and reconciling on reconnect.** It
  requires the answer on the client, which is ADR-0038's parked option and
  Fernando's call, not a fallback mode. Shipping it *only* for the offline
  path would put the answer in the bundle unconditionally, so the "only
  when offline" framing would be false.
- **Routing the guess through `sync.ts`'s queue** — decision 4.
- **Persisting the un-judged in-flight guess** — decision 5.
- **A new "abandoned" or "interrupted" day state.** It is the direction
  ADR-0031's rejected list forbids: *"Treating the absence of a record as
  'not done' authoritatively… absence is unknown, and only ever renders as
  the neutral default."*
- **Pausing the timer while offline** — decision 8.
- **Blocking guess submission when `navigator.onLine` is false.** `onLine`
  is a hint, not a fact; a false negative would refuse a guess a working
  connection would have judged. Attempt, then handle the failure.

## Consequences

- **(a) One acceptance criterion of #18's lineage is unmet for this game,
  on purpose.** The PR says so in those words rather than letting a step-6
  reviewer discover it. ADR-0028 is not amended, because none of its
  decisions become false — only a sentence of its reasoning does not apply
  here, and this ADR is where that is recorded.
- **(b) A player who loses connectivity mid-game loses the day.** They keep
  whatever they had guessed, they see an honest pending conclusion, and no
  completion is written. Accepted, and it is the same shape as ADR-0004's
  already-accepted *"Users who are offline at rollover cannot start the
  day's puzzle."*
- **(c) Issue #58 barely touches Termo, and the reason is structural.** A
  Termo board closes online by construction, so the completion POST fires
  while the player is connected and the late-by-sync window is nearly
  closed for this game. Fernando's decision on #58 is inherited unchanged;
  nothing here widens `ACCEPTED_DAYS_BACK`.
- **(d) `use-record-snapshot.ts`'s `sameToTheReader` must gain the guess
  count.** It compares exactly five chrome fields —
  `concluded`/`pendingSync`/`syncOutcome`/`elapsedMs`/`hintsUsed`,
  `use-record-snapshot.ts:116-127` — and its own header requires that any
  per-game payload field which moves INDEPENDENTLY of `concluded` be added
  there. Termo's guess list moves on every turn while all five stand still;
  Nonogram escaped this only through the `grid`/`concluded` lockstep.
  Termo's copy of that lockstep test asserts `answer`, not the guess list —
  asserting the guess list would assert something false.
- **(e) `buildBody`'s `undefined` return is a trap for this game.** An
  unbuildable body permanently settles a record as rejected
  (`sync.ts:202-210`), so Termo's builder may only return `undefined` on a
  state a closed record cannot reach.
- **(f) The native clients inherit this whole.** A native Termo client
  re-implements the screen against this document, including the held-turn
  behaviour and the pending conclusion — not against the web client's
  source.
- **(g) The held turn is a visual state this ADR creates and does not
  specify.** It is a sixth tile appearance beside empty, typed, caret, and
  the three judged states. The obligation stands unchanged: a declared CSS
  rule, a computed contrast figure — `low-contrast` is wildcard-ignored and
  is not evidence — and a reduced-motion counterpart if it animates. #27
  discharges it in `docs/plans/022-issue-27-plan-daily-termo-end-to-end.md`
  §12.2 (the state table) and §12.6 (the stylesheet), and the ADR names the
  section rather than restating the rule, so the two cannot drift.
