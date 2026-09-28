# ADR-0086 — The Cruzadinha daily ships its letters

**Status:** Accepted — 2026-09-28 (issue #276)
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0085](./0085-cruzadinha-is-a-seeded-fill-from-a-curated-lexicon.md)
**Amends:** ADR-0027's rejected bullet *"Shipping `solution` in the daily payload"*, for the crossword only. [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md) decision 4's "three timed games" become four (decision 3 below). The fifth game also grows [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) decisions 1, 2 and 13's counts, [ADR-0047](./0047-bundle-markers-are-route-scoped.md)'s forbidden-everywhere list, [ADR-0041](./0041-accents-colour-shapes-never-words.md) consequence (h) and [ADR-0080](./0080-paper-dark-accents-lighten-under-a-paper-label.md) decisions 2 and 3.
**Superseded in part by:** [ADR-0088](./0088-cruzadinha-free-play-ships-the-lexicon-on-its-own-route.md) (#279) — decision 6: the lexicon reaches the chunks only `/modo-livre/cruzadinha` loads.

## Context

The Cruzadinha daily needs a public projection (ADR-0024 decision 3) and a completion body. Termo withholds its answer and judges every guess online. The grid games ship their givens and withhold the solution, but a solver recovers it in milliseconds, so their free hint runs on the client (ADR-0027). A crossword is different: no program can solve it from the grid shape and the clues. If the letters stayed on the server, the hint and completion detection would both become server calls.

## Decision

1. **The projection is `{game, date, grid, clues}`.** `grid` is the 5×5 solution, rows of `a–z`, with `null` for a block. Each clue is `{number, direction, row, col, length, clue}`, with `length = normalized.length`. `stripDailyContent` builds it by allowlist pick. `dailyCrosswordResponseSchema` rejects any clue with a cell out of bounds or on a block.
2. **`seed`, `canonical` and `normalized` are withheld.** `FORBIDDEN_DAILY_KEYS` names all three, and the strip tests scan real engine output for them.
3. **The crossword is a timed game.** `TIMED_GAMES` gains it, so `/stats` carries a crossword block, in the same shape as the other timed games.
4. **The completion body is `grid: (a–z | null)[25]`**, row-major, with `null` for a block, the stored content's own sentinel. The server judges it by exact equality, blocks included.
5. **The stored content is `CrosswordPuzzle` exactly** (`crosswordDailyContentSchema`, strict).
6. **The lexicon wall stands** as ADR-0085 decision 7 set it. The day's letters reach the client only in the fetched payload, never in a chunk.

Why ship the letters:

- **Offline play.** A board loaded online keeps working when the connection drops (ADR-0004). It can only do that if it can check itself.
- **Local completion detection and the free hint** need the letters. ADR-0027 rejects a server call for the free hint.
- **There is nothing to cheat for** (ADR-0004): v1 has no ranking. The payload is today's published content, and nothing unpublished ships.

## Consequences

- **This gives up the devtools protection Termo keeps.** Anyone can read today's answers in the network tab. ADR-0004 guards against spoiling a puzzle before it is published. Today's grid is already public.
- The server still judges every completion. Local validation is never the source of truth (ADR-0004).
- For the grid games, ADR-0027's rejection still applies: their strip keeps blocking casual devtools reads.
- The cron runs the crossword fourth, between nonogram and sudoku, under [ADR-0040](./0040-the-termo-daily-stores-the-drawn-answer.md) consequence (e)'s cost-ascending rule. Measured worst-case generation: termo trivial, binairo ~15 ms, nonogram ~20 ms, crossword ~88 ms, sudoku ~222 ms. `COST_ASCENDING_GAMES` in `apps/api/app/cron/publish/route.ts` holds the order.

## Rejected

- **Termo-style withholding.** The server would judge each entry, so the hint and completion would stop working offline.
- **Per-cell hashes.** A cell has 26 possible letters, so a hash of one cell is broken at once.
