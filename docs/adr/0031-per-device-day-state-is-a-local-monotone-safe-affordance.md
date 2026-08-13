# ADR-0031 — Per-device day state is a local, monotone-safe affordance; server truth arrives with #19

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md), [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
**Amended by:** [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md) — decision 5's *"#19 replaces `readDayState`'s body and nothing else"* is narrowed: #19 ships the streak that decision 3 deferred and does NOT replace `readDayState`'s body; the server day-truth payload and the body replacement move to [#83](https://github.com/fernandolisboa/miolos/issues/83). The local reader, its callers and the offline-fallback rule are untouched.
**Amends:** the user-specific-fragment consequence of [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md) — *"If a public page ever grows a user-specific fragment (e.g. 'you solved this one'), that fragment calls `apps/api` — the page does not get to widen the direct-read scope."* — by narrowing it to fragments whose **source** is server state; see Decision 4.

## Context

Issue #23 asks the hub tile to show done/pending for Sudoku and asks the
conclusion to chain to the next pending daily. Issue #19 owns the hub in
full — *"Hub shows date, per-game done/pending, 'X de 4', and the
server-computed streak"* — and is scheduled before #23 in the milestone
map, but was not run first. So #23 has to answer a question #19 would
otherwise have answered: where does "is today's Sudoku done?" come from,
on a page that must render for a cold, anonymous, offline visitor?

Two facts narrow the answer before any preference is applied.

**The conclusion cannot ask the server.**
[ADR-0028](./0028-daily-play-routes-and-the-conclusion.md) makes
finishing offline a requirement — the conclusion is an in-place state
precisely so *"the player who just solved the puzzle offline"* gets a
stamp rather than a navigation error. A conclusion reached offline
structurally cannot call `apps/api` to find out which daily to chain to.
The local reader therefore gets built no matter what the hub does; the
hub tile is a second consumer of a module that has to exist.

**Its source is device state, not user state.** The play records that
answer the question already live in `localStorage` under the
`miolos:play:` prefix ([ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)),
written by the game the player just finished. Reading them adds no
database access, no session lookup and no network call.

That is what makes
[ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md)'s
fragment rule apply only in its spirit and not in its letter: its
example — *"you solved this one"* — is literally this fragment, but its
subject is the **direct-read scope**, the boundary that stops `apps/web`
from reading user rows out of Neon around `apps/api`. A fragment that
reads nothing from the server sits outside that boundary rather than
crossing it, and saying so explicitly is cheaper than letting a later
reader discover the tension.

## Decision

1. **Day state is read from the local play records**, behind one seam:
   `readDayState(date)` in `apps/web/src/play/day-state.ts` returns, per
   game, whether **this device** concluded that day's puzzle and its
   elapsed time. Nothing else derives completion; the hub tile, the
   conclusion's day chips and the conclusion's chaining CTA all read
   this one function.

2. **It is monotone-safe, and that is the property that makes it
   shippable.** A local `concluded` record proves this device solved
   the puzzle; **absence proves nothing** and renders as *pending*. The
   state can therefore only ever understate. A false *pending* is
   invisible — it is also the cold-profile default, what
   `impeccable detect` always scans, and what a second device already
   shows today. A false *done* would be a lie the player can catch.

3. **The streak stays server-computed, and `streakCount` stays
   hardcoded `0` until #19.** The asymmetry is deliberate: a streak is a
   cross-day derivation over completion rows —
   [ADR-0009](./0009-account-merge-recomputes-from-the-union-of-completions.md):
   *"**a streak is always derivable from completion rows.** A stored
   streak value is a cache, never an authority"* — while "did this
   device finish today's Sudoku" is a fact the device owns outright.
   Nothing in this decision lets the client compute a streak.

4. **This does not widen ADR-0014's direct-read scope**, and its
   fragment consequence is narrowed to what it is actually about: a
   user-specific fragment whose **source is server state** calls
   `apps/api`. A fragment rendered from device state held in
   `localStorage` reads no user rows, crosses no wall and needs no
   endpoint. Every server-sourced user fact — the streak, "X de 4"
   across devices, statistics — stays exactly where ADR-0014 put it.

5. **#19 replaces `readDayState`'s body and nothing else.** Its callers,
   the CSS variant, the copy and the components survive untouched, and
   when the server payload arrives **the local reader stays** as the
   offline fallback the conclusion requires by decision 1's first fact.

6. **This state can never back a medal, a streak or any award.** It is
   self-reported device state, under the same rule
   [ADR-0027](./0027-the-hint-is-computed-on-the-client.md) records for
   `hints_used`: the record lives in a user-editable `localStorage`
   entry. It may drive an affordance — a chip, a CTA target — and never
   an entitlement.

## Rejected

- **Defer the hub clause entirely to #19.** The cleanest ownership and
  the worst outcome: #23 would close with an acceptance criterion
  visibly unmet, and the home screen would read "0 de 4" with two
  playable games for however long #19 waits. It also does not remove the
  work, because the conclusion's chaining needs the same reader.
- **Build the real authenticated endpoint here.** It meets the criterion
  literally and designs #19's payload inside #23: the response must
  eventually carry the streak, so #19 immediately widens and re-tests
  the same route, and #23 grows an api route, a `@miolos/db/user`
  reader with its export tripwire, a contract, a client fetch, a
  skeleton state and their tests. Highest double-build risk of the
  three options.
- **A separate `localStorage` "done today" key written at completion.**
  A second source of truth for a fact the play record already holds,
  and one that can disagree with it — the play record is the thing the
  sync queue and the conclusion already read.
- **Treating the absence of a record as "not done" authoritatively**
  (e.g. rendering a "you missed it" state, or clearing a server-side
  fact from it). That is the direction the monotone property forbids:
  absence is *unknown*, and only ever renders as the neutral default.
- **Optimistically marking a tile done from a queued-but-unsynced
  completion and hiding the pending state.** The completion is honestly
  done on this device — that is what decision 2 already asserts — but
  the conclusion's pending-sync line is the player's evidence that the
  day is not yet on the server, and hiding it would be the one place
  this affordance could mislead.

## Consequences

- **(a) The streak is deferred in display only, not in arithmetic — and
  the positive half is stated so the deferral is not over-read.** The
  Sudoku completion row is written game-generically:
  `recordCompletion({ game, … })` and `getCompletion(db, userId, game,
  date)` take `game` as data and `on_time` is derived in SQL
  ([ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md)
  decision 2). #19 defines the streak as consecutive days with at least
  one on-time completion over exactly those rows, so a `game='sudoku'`
  row counts with **zero** additional work. `streakCount` renders `0`
  until #19 ships the display, and that is flagged in the PR rather
  than left for a reviewer to find.
- **(b) Self-reporting rules apply, permanently.** Decision 6 is not a
  v1 caveat: any future medal or entitlement that depends on "did they
  finish it" must read the completion rows, exactly as ADR-0027 requires
  a hint-free medal to build a server-computed path first.
- **(c) The seam is one function body wide.** #19's diff on this
  surface is `readDayState`'s implementation plus the code that supplies
  it with a server payload; the local reader remains as the offline
  fallback, so the two coexist rather than one replacing the other.
- **(d) Tiles and day chips understate across devices, and that is
  said out loud rather than hidden.** A player who solved Sudoku on
  their phone sees *pending* on their laptop until #19. The conclusion's
  chaining CTA inherits the same understatement: at worst it points at a
  daily this player already finished on another device, which lands them
  on a screen that immediately restores into its own conclusion.
- **(e) The visual gate keeps scanning the pending state.**
  `impeccable detect` launches a clean browser profile, so the local
  store is always empty and both viewports always scan *pending* — which
  is why pending is the default rather than a fallback bolted on. The
  done state is covered by jsdom tests and by the file-mode run, the
  same split ADR-0028 records for the populated conclusion card.
