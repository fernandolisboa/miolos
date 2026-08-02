# ADR-0032 — A Nonogram is finished when the picture is painted; crosses are notation and never cross the wire

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0021](./0021-nonogram-pictures-are-a-curated-motif-library.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)

## Context

Both shipped daily games have a **total** board: every cell must be written
before the board is finished, so "the player decided everything" and "the
player is done" are the same sentence. The completion contract encodes it
as a fixed length — `.length(64)` for binairo, `.length(81)` for sudoku —
and the judge compares the submitted array against the stored solution
element by element.

A Nonogram is the first game where those two sentences come apart. The
player's board carries **three** states (preenchida, marcada, vazia) and
the picture carries **two** (in the figure or not). Crossing is optional
notation: a player may finish having crossed every empty cell, having
crossed none, or any mixture, and all three have painted the same picture.
Nothing in the ruleset makes a cross a claim about the puzzle — it is a
claim about the player's own reasoning.

That leaves three questions that cannot be answered independently, which
is why they are answered here together rather than discovered one at a
time in three files:

**What the server is allowed to see.** If a three-state board reached the
server, the judge would need a leniency rule ("a cross and an untouched
cell are both acceptable where the picture is empty") and a leniency rule
is a thing to get wrong. It would also let two honest players who solved
the identical puzzle post different bytes.

**What a cell is encoded as on the client.** This one is not open at all,
and the constraint comes from a module this ticket does not touch.
`apps/web/src/play/grid-hint.ts:64` is `if (entry !== null && entry !==
target)` — the shared contradiction test. If a cross were a third value
distinct from the solution's empty value, **every correctly-crossed cell
would return a `correction`**, and the day's one free hint would
systematically tell the player to un-cross a cell they crossed correctly.
The encoding works if and only if a cross **is** the solution's empty
value.

**What the progress meter measures.** Handoff 019:164 proposed
`{decided} de {size²}`. Measured over the same 280 real dailies consequence
(f) pins — seeds `(s * 2654435761) >>> 0` for `s ∈ 1..40` crossed with all
seven weekdays — a fill-only solver, the majority behaviour since crossing is
not required to finish, reads **48 of 225 ≈ 21 %** at the instant they win on
the worst 15×15 the library can produce, **85.5 of 225 ≈ 38 %** on average at
that size, and **≈ 48 %** averaged over all 280. (An earlier revision of this
paragraph wrote "47 of 225", which is a board that exists nowhere: the
library's size-15 minimum is 48 filled cells and no motif at any size carries
exactly 47. It also presented the worst case as the typical one. Both are
corrected here, from a re-run of the pinned population.) A completion meter
that can read 21 % at victory is broken, and `messages.play.progressLabel` is
one shared `"Progresso"` slot on one shared stats card, so the slot cannot
mean "how much of the picture is done" on three screens and "how much work
was performed" on the fourth.

## Decision

1. **A Nonogram is complete when the set of filled cells equals the
   picture's filled set.** Crossing is optional, so a player who crossed
   every empty cell and one who crossed none are both finished and post
   **byte-identical** bodies.

2. **The client encodes a cell `1` = preenchida (filled), `0` = marcada
   (crossed), `null` = vazia (undecided).** This is *forced*, not chosen:
   it is the only encoding under which `grid-hint.ts:64`'s contradiction
   test is correct for a crossed cell. Verified against a verbatim copy of
   `nextHint` over 280 real boards, all four cases.

3. **The wire carries a two-valued row-major bitmap of length `size²`,
   `index = row * size + col`,** where `1` means *filled* and `0` means
   *crossed or untouched, indistinguishably*. The server therefore never
   sees a three-state board and has no leniency rule to get wrong. The
   client's matching obligation, stated so it is checkable:
   `submitted[r * size + c] === 1` iff the player marked (r, c) filled;
   every other state maps to `0`.

4. **The judge checks `body.grid.length === solution.length` explicitly,
   before the compare loop, because the schema cannot.** Binairo and
   sudoku pin one literal length each, so for them the request schema
   already proves completeness; a nonogram grid is one of `{25, 64, 100,
   225}` and the **stored row** decides which. The loop iterates
   `solution.entries()`, so without the check a *longer* grid whose prefix
   matched would score zero mismatches and be recorded. The response is
   `422`, not `400`: the body is well-formed, it simply is not this
   puzzle, and `TERMINAL_STATUSES` already treats 422 as terminal so the
   offline record settles rather than retrying forever. There is **no
   `size` field on the wire** — it would be a second place for the client
   to lie about a fact the stored row already owns.

5. **The progress readout counts FILLED cells against a denominator
   summed from the clues** — not decided cells against `size²`. This
   decides against handoff 019:164 on the measurement above. Crossing
   stays fully first-class everywhere else: persisted, restored, corrected
   by the hint, and driving the board's visual state. It is simply not
   what the *meter* measures. **Counting only *correct* paints is
   forbidden** — that is a per-cell solution oracle, and it is forbidden
   under any framing that arrives at it.

6. **The one free hint is `nextHint` composed twice**, so its fill branch
   always lands on a picture cell. The unmodified branch returns the
   row-major first `null` entry, which assumes `entries` records what the
   player *knows* — true where every cell must be written, false here.
   Measured, it returns a **cross 239 times in 280 on a fresh board**.
   **The population is part of the claim:** seeds
   `(s * 2654435761) >>> 0` for `s ∈ 1..40` crossed with all seven
   weekdays — a different seed set returns 237, so a bare "239" would not
   be reproducible. `grid-hint.ts` is not modified; the second pass is the
   same function called with the empty-picture cells masked through its
   `givens` argument, which is exactly what that argument means.

7. **None of this is a confidentiality argument.**
   [ADR-0027](./0027-the-hint-is-computed-on-the-client.md):125-131 already
   forecloses it — the published strip "is not a confidentiality boundary
   for a published puzzle, and must never be argued as one" — and the
   picture is recoverable from the published clues by construction
   ([ADR-0021](./0021-nonogram-pictures-are-a-curated-motif-library.md)
   decision 3). The two-valued wire exists so the judge is simple, not so
   the player is kept out of anything.

## Rejected

- **A three-state wire with a server-side leniency rule.** The shape that
  looks more faithful to the player's board and buys a rule to get wrong:
  the judge would have to accept `crossed` wherever the picture is empty,
  two honest solvers of the same puzzle would post different bytes, and
  every future consumer of a completion row would inherit a tri-state
  board it has no use for.
- **`{decided} de {size²}` for the meter** (handoff 019:164). Measured over
  the population in consequence (f), a fill-only solver reads **21 % at
  worst and 38 % on average at size 15** — ≈ 48 % over all 280 dailies — at
  the instant they win. It is the floor that condemns it: a meter that can
  print 21 % on a finished board is broken, whatever its mean.
- **Counting only correct paints.** The obvious "fix" for a readout that
  can print "50 de 47", and a per-cell solution oracle: it tells the
  player which of their paints are wrong, for free, forever.
- **A cross as a third client value distinct from the solution's empty
  value.** It would make every correctly-crossed cell a contradiction
  under `grid-hint.ts:64` and turn the day's single hint into an
  instruction to undo correct work.
- **A `size` key on the completion request.** A second place for the
  client to lie, it breaks the audited five-field tripwire in
  `completion-contract.test.ts`, and it still would not be authoritative:
  the stored row's solution decides the size, which is what decision 4's
  length check actually compares against.
- **Reusing `play/progress.ts`'s `countFilled`.** It tests
  `(given ?? entries[index] ?? null) !== null`, and under decision 2 a
  cross is `0`, which is not nullish — so it computes *decided*, not
  *filled*. Making it compute filled needs two synthetic arrays, including
  an all-`null` `givens` for a game that has no concept of a given. That
  is the shallow reuse [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
  already rejects.

## Consequences

- **(a) The readout can exceed its denominator, and a heavy crosser gets
  no credit.** A player who overpaints reads "50 de 47"; a player at 150
  crosses and 10 paints reads "10 de 47". Both are honest and
  self-diagnosing, and both are accepted here rather than left for a
  reviewer to find. If playtesting ever shows the meter feels dead for
  heavy crossers, the sanctioned alternative is option B
  (`{decided} de {size²}`) — **never** a correctness-filtered count.
- **(b) `countFilled` is deliberately not reused, and `progress.ts` says
  so in a comment.** Without that line a later cleanup would "unify" the
  two and silently reinstate the 21 % readout, which is invisible until
  someone wins.
- **(c) The length check is game-generic and must not be simplified
  away.** It is one branch and a no-op for both shipped games, which is
  exactly what makes it safe to add now instead of as a nonogram special
  case a later reader deletes as dead code.
- **(d) The record's `grid` field means "the submitted bitmap", not "the
  player's board".** On a closed board the two coincide by construction of
  the completion predicate; mid-game they do not, because `entries` still
  carries crosses. The record's TSDoc has to say so or the next reader
  will restore a board from it.
- **(e) #28 and the native clients inherit this whole.** Free play is the
  same board with no completion write, so it inherits the encoding, the
  predicate and the meter unchanged; a native client that re-implements
  the screen re-implements them against this document rather than against
  the web client's source.
- **(f) The 239/280 figure is checkable, not folkloric.** The seed set is
  named here and pinned by the same table-driven fixture the client tests
  use, so a future reader can re-derive it rather than trust it.
