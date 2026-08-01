# ADR-0034 — The completion celebration's authoritative placement is the conclusion, never the play board

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md)

## Context

Three daily games have shipped and none of them has a payoff that is an
*image*. Binairo and Sudoku end on a stamp and a time; a Nonogram ends on
a picture, and the picture is the whole reason the game exists. So #25 is
the first ticket that has to say **where a completion celebration lives**
— and once said, it is said for every game after it, because the next one
that wants a payoff moment will copy whatever this one did.

The tempting placement is the play board itself: the last cell lands, the
grid the player has been staring at resolves into the figure, and the
moment happens where the player's attention already is. It is also the
placement that fights two things the repo has already paid for.

**The screen shape is fixed.**
[ADR-0028](./0028-daily-play-routes-and-the-conclusion.md):131 pins it for
*every* game — *"a copy of this shape, not a new decision"* — and the
shape is: while `status === "playing"`, render the play view; once the
game is closed and the clock is frozen, render `<ConclusionView/>` in
place. Holding the play view open on a timer to let an animation finish
is a per-game divergence inside the one file that ADR-0028 exists to keep
identical across four games.

**The swap condition is an invariant, not an implementation detail.**
`apps/web/src/sudoku/sudoku-screen.tsx:43-50` gates on **both**
`status !== "playing"` **and** `timer.runningSince === null`, and its own
shipped comment says why: *"the clock is frozen one commit after the grid
closes, and swapping early would stamp a time the pause is about to
correct."* That comment is a finding #23's review paid for. An animation
that needs the play view held open needs exactly the early-swap behaviour
that comment forbids, or a second timer racing the first.

There is a third fact about *when* the board is visible after the last
entry, and it points the same way — but it is a React **scheduling**
claim, it is derived from shipped code rather than measured, and jsdom
cannot produce it. It is recorded below as PENDING and the decision is
deliberately not built on it.

## Decision

1. **A game's completion celebration — the authoritative, scannable,
   reload-surviving payoff — renders inside `<ConclusionView/>`, never as
   an animation on the play board.** The argument that carries this needs
   no measurement: the alternative forks the one screen shape ADR-0028:131
   pins for every game, and fights the invariant
   `sudoku-screen.tsx:43-50` records in its own comment.

2. **Per-entry paint feedback on the board's cells is permitted, and it is
   explicitly not the reveal.** A cell may transition its own paint
   (`background-color`, `box-shadow`) as the player works, with the
   module's own `prefers-reduced-motion` counterpart. That is input
   feedback. It must not be described as the celebration in a PR, a
   comment or a ticket, because the two would then be one thing with two
   placements.

3. **`ConclusionView` may carry per-game payloads as optional plain-data
   props** — `ConclusionPicture {size, cells, label}` is the first —
   subject to two rules:
   - **Plain data only: no functions, no nodes.** A function crossing the
     RSC boundary is an HTTP 500 that nothing but the route's SSR test can
     see, and #23 shipped exactly that bug in exactly this file.
   - **The prop may only be supplied by a client component that owns the
     local play record, never by a server segment.** `/<jogo>/concluido`
     renders for players who have *not* solved, so a server-computed
     payload would put a derived solution into that route's RSC payload
     and turn the bookmarkable conclusion into a spoiler channel
     ([ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md),
     ADR-0027's rejected list,
     [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md)).

4. **A celebration's design compliance is proved by file-mode checks, not
   by the URL scan, and AC 2 is not over-claimed anywhere.**
   `impeccable detect` launches a clean browser profile, so the URL scan
   always sees the *playing* board and the *unfinished* conclusion —
   neither the solved board nor the populated conclusion is reachable by
   it. What proves the celebration instead, named so it is not
   substituted later: a **file-mode** detect run, jsdom smoke tests, and
   stylesheet-text assertions on the keyframe name, the easing and the
   reduced-motion branch.

## Rejected

- **The reveal as an in-place animation on the solved play board.**
  Decision 1's two grounds, plus a third: the celebration would not
  survive a reload, and the conclusion is the thing that is bookmarkable
  and re-openable. A payoff that exists only in the one render between the
  last entry and the swap is not the payoff, it is a flourish.
- **Holding the play view open on a timer so the animation can finish.**
  It forks `sudoku-screen.tsx`'s shape per game and requires either the
  early swap its comment forbids or a second clock racing the first.
- **Swapping to the conclusion on `status` alone, dropping the
  `runningSince === null` half.** It stamps a time the pause is about to
  correct — the exact regression #23's review found.
- **Passing the payload as a node or a render function.** It reads as more
  flexible and it is an RSC 500 the first time a server segment renders
  the conclusion.
- **Computing the payload in the server segment.** The one option that
  makes the conclusion route a spoiler channel for players who have not
  solved.
- **Widening `ConclusionResult` to carry the picture instead of adding a
  sibling prop.** The conclusion's stamp resolves as `stored ?? result`,
  which relies on a play record being structurally assignable to
  `ConclusionResult`; a record has `grid` and `size`, not `picture`, so a
  record-sourced stamp would silently carry `picture: undefined` — which
  is precisely the restored-conclusion case that has to work.

## Consequences

- **(a) PENDING until measured: the one-painted-frame claim.** The
  mechanism *predicts* that the solved board is painted for approximately
  **one frame** — `use-play-lifecycle.ts:206-212` freezes the clock in a
  **passive** effect (*"an entry action carries no `now`"*), which React
  flushes after paint, and the screen's swap is gated on
  `status !== "playing" && timer.runningSince === null` — so a 250 ms
  board transition started there would be interrupted at ~16 ms. **That is
  a React scheduling claim derived from shipped code, not a measured
  number, and it is not asserted as fact here.** jsdom cannot produce it;
  it is measured in a real browser at the build step where the screen
  first exists. **If the board turns out to persist ≥200 ms, this ADR is
  amended in the same PR** to add the in-place half — which is *additive*
  to this decision rather than a reversal of it, because decision 1 rests
  on ADR-0028:131 and `sudoku-screen.tsx:43-50` and would be unchanged
  either way.
- **(b) Every game after Nonogram inherits the placement, not a new
  argument.** A game that wants a payoff moment adds an optional
  plain-data prop and a conclusion-side render; it does not reopen where
  the celebration goes.
- **(c) The prop list grows one optional member per game with a payoff,
  and that is the intended shape.** Each is plain data, each is supplied
  by a client component that owns the record, and a game with no payoff
  passes nothing. The alternative — one union-typed `payload` prop — would
  make every game's conclusion depend on every other game's shape.
- **(d) The reveal works offline, because the record is its source.** The
  client component that supplies the prop reads the local play record, so
  a player who finishes with no network still sees the picture, which is
  what ADR-0028's in-place conclusion exists for.
- **(e) A keyframe name is a gate, not a label.** The visual detector bans
  a family of animation names outright, so the celebration's keyframe name
  is asserted in a test rather than chosen freely — the cheapest place for
  a merge to fail on a word.
