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
`SudokuScreen` in `apps/web/src/sudoku/sudoku-screen.tsx` gates on **both**
`status !== "playing"` **and** `timer.runningSince === null`, and its own
shipped comment says why: *"the clock is frozen one commit after the grid
closes, and swapping early would stamp a time the pause is about to
correct."* That comment is a finding #23's review paid for. An animation
that needs the play view held open needs exactly the early-swap behaviour
that comment forbids, or a second timer racing the first.

There is a third fact about *when* the board is visible after the last
entry, and it points the same way — but it is a React **scheduling**
claim, and jsdom cannot produce it. It was recorded here as PENDING while
the screen did not exist; it has since been **measured in a real browser**
and consequence (a) below carries the number. The decision is still not
built on it.

## Decision

1. **A game's completion celebration — the authoritative, scannable,
   reload-surviving payoff — renders inside `<ConclusionView/>`, never as
   an animation on the play board.** The argument that carries this needs
   no measurement: the alternative forks the one screen shape ADR-0028
   decision 2 pins for every game, and fights the invariant `SudokuScreen`
   records in its own comment.

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

- **(a) MEASURED — the solved board persists exactly one frame.** The
  mechanism predicts it: `use-play-lifecycle.ts`'s clock-freeze effect
  freezes the clock
  in a **passive** effect (*"an entry action carries no `now`"*), which
  React flushes after paint, and the screen's swap is gated on
  `status !== "playing" && timer.runningSince === null`. The prediction
  was carried here as PENDING until the screen existed. It now has a
  number, from **E12b**, run at build step 7 of #25 against `next dev`
  driven by the repo's own puppeteer 25.4.0 / Chrome 151, bracketing the
  discrete `click` that closes the board (commit N, board still in the
  DOM — asserted, not assumed) and the `MutationObserver` that sees
  `[data-conclusion-state="result"]` appear:

  | Board | Runs | Animation frames | Delta |
  |---|---|---|---|
  | 5×5 (weekday 1) | 5 | **1** on every run | 11.7–12.1 ms, median 11.7 |
  | 15×15 (weekday 7) | 3 | **1** on every run | 11.1–11.7 ms, median 11.7 |

  So a `var(--duration-slow)` (250 ms) transition started on the solved board
  would be interrupted at ~12 ms of 250, i.e. **under 5 % of it**, and the
  ≥200 ms threshold that would have made the in-place half live is missed by
  more than an order of magnitude. The in-place reveal stays rejected and this
  ADR is unamended in substance — decision 1 rests on ADR-0028 decision 2 and
  `SudokuScreen` and would have been unchanged either way, which is exactly
  why it was written not to depend on this measurement.

  **How to re-derive it**, since — unlike ADR-0032 consequence (f) and
  ADR-0033's premise, both of which are pinned by committed table-driven
  fixtures — this one has no artifact in the tree and E12b was a throwaway
  harness. Run `next dev`, open `/nonogram` on a day whose weekday gives
  the board you want (1 for the 5×5, 7 for the 15×15), solve it by
  dispatching the cell clicks in solution order, and bracket the LAST
  click: assert the board is still in the DOM at that instant, then start
  a `MutationObserver` on the conclusion root and stop on
  `[data-conclusion-state="result"]`, counting
  `requestAnimationFrame` callbacks in between. Puppeteer 25.4.0 is
  already a dev dependency and its Chrome is in `~/.cache/puppeteer`. The
  number this ADR rests on is the FRAME COUNT, not the millisecond delta —
  a slower machine moves the ms and leaves the conclusion intact.
- **(b) Every game after Nonogram inherits the placement, not a new
  argument.** A game that wants a payoff moment adds an optional
  plain-data prop and a conclusion-side render; it does not reopen where
  the celebration goes.
- **(c) The prop list grows one optional member per game with a payoff,
  and that is the intended shape.** Each is plain data, each is supplied
  by a client component that owns the record, and a game with no payoff
  passes nothing. The alternative — one union-typed `payload` prop — would
  make every game's conclusion depend on every other game's shape.

  **Qualified at #27 — the budget is a default, not a bound, and Termo
  spends TWO.** The qualification is recorded here, in the file a future
  game's author reads *before* adding a prop, rather than only in the
  consequences of the ADR that spent the second member. `ConclusionView`
  gains `outcome?: ConclusionOutcome` **and** `answer?: ConclusionAnswer`
  for one game
  ([ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md)
  decisions 1 and 6, consequence (a)). The two are **orthogonal**, which is
  the whole warrant: `outcome` is what a game with *two terminal states*
  owes — it serves the win stamp and the loss stamp both — while `answer` is
  the day's word and renders on both outcomes. Collapsing them would put a
  nullable word inside an outcome object and make the win branch carry a
  field it does not gate on, which is a smaller version of the union-typed
  `payload` this consequence rejects.

  What is unchanged is the **test** a new member has to pass, and it is the
  test rather than the count that was ever load-bearing: plain data only,
  supplied only by a client component that owns the local play record
  (decision 3), orthogonal to every member already there, and passed by no
  game that does not need it. Of the three shipped members
  (`picture`, `outcome`, `answer` — `<ConclusionView/>`'s props in
  `apps/web/src/play/conclusion-view.tsx`),
  **two games pass none, and the third passes only `picture`**: binairo and
  sudoku render byte-identically to what they rendered before any of the
  three existed, and nonogram takes `picture` alone (`NonogramScreen`, which
  composes it, and `NonogramConclusion`, which resolves it). No game carries
  another game's member. A second member is a claim about the *game's* shape,
  and it has to be argued in the ADR that adds it, in those terms. "One per game" stays the number to beat.
- **(d) The reveal works offline, because the record is its source.** The
  client component that supplies the prop reads the local play record, so
  a player who finishes with no network still sees the picture, which is
  what ADR-0028's in-place conclusion exists for.
- **(e) A keyframe name is a gate, not a label.** The visual detector bans
  a family of animation names outright, so the celebration's keyframe name
  is asserted in a test rather than chosen freely — the cheapest place for
  a merge to fail on a word.
