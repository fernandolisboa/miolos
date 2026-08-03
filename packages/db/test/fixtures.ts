/**
 * Test fixtures for the db suites. Each content fixture satisfies its
 * game's daily-content schema STRUCTURALLY (that is all the wall parses —
 * rule validity is the engine's concern, proven in packages/games); no
 * @miolos/games dependency here, and #23, #25 and #27 keep it that way
 * (plan 018 §15, plan 020 §8, plan 022 §9.3, T-DB-S1/T-DB-S6/T-DB-S12).
 */

export function binairoContentFixture(): Record<string, unknown> {
  const solution = Array.from(
    { length: 64 },
    (_, i) => ((i + Math.floor(i / 8)) % 2) as 0 | 1,
  );
  const givens = solution.map((value, i) => (i % 3 === 0 ? value : null));
  return {
    size: 8,
    seed: 123456,
    weekday: 6,
    givens,
    solution,
    givensCount: givens.filter((value) => value !== null).length,
    requiredTier: 2,
  };
}

export function sudokuContentFixture(): Record<string, unknown> {
  // The shifted-band construction: row r takes the base row rotated by
  // 3*(r % 3) + floor(r / 3), so every row, column and 3x3 box holds 1-9
  // exactly once. Structural validity is all the wall needs, but a grid
  // that is also rule-valid keeps the fixture honest if a later reader
  // ever looks at it.
  const solution = Array.from({ length: 81 }, (_, i) => {
    const row = Math.floor(i / 9);
    const column = i % 9;
    return ((row * 3 + Math.floor(row / 3) + column) % 9) + 1;
  });
  // 0 is SudokuGrid's "empty" sentinel — sudoku's givens carry it where
  // binairo's carry null, which is exactly the `0`/`null` split plan 018
  // S6 converts at one client-side boundary. Nothing here converts it.
  const givens = solution.map((value, i) => (i % 3 === 0 ? value : 0));
  return {
    seed: 654_321,
    tier: 3,
    givens,
    solution,
    clueCount: givens.filter((value) => value !== 0).length,
  };
}

/**
 * A 5x5 bitmap — Monday's size class. The top row is deliberately empty so
 * the fixture exercises the `[]` run list an all-empty line produces
 * (nonogram/types.ts:10: NEVER `[0]`).
 */
const NONOGRAM_PICTURE = [".....", "..#..", ".###.", "#####", ".###."];

/** Run lengths of one line, left→right / top→bottom. `[]` when nothing is filled. */
function runLengths(line: readonly boolean[]): number[] {
  const runs: number[] = [];
  let current = 0;
  for (const filled of line) {
    if (filled) {
      current += 1;
    } else if (current > 0) {
      runs.push(current);
      current = 0;
    }
  }
  if (current > 0) {
    runs.push(current);
  }
  return runs;
}

export function nonogramContentFixture(): Record<string, unknown> {
  const size = NONOGRAM_PICTURE.length;
  const solution = NONOGRAM_PICTURE.map((row) =>
    [...row].map((cell) => cell === "#"),
  );
  const columns = Array.from({ length: size }, (_, column) =>
    solution.map((row) => row[column] === true),
  );
  // `game` is the asymmetry: nonogram is the ONLY engine whose puzzle object
  // carries one (nonogram/types.ts:33), and a fixture without it fails the
  // strict content parse inside the wall (plan 020 N2).
  return {
    game: "nonogram",
    seed: 987_654,
    weekday: 1,
    size,
    clues: {
      size,
      // Derived, never hand-written: a literal clue list is free to drift
      // out of agreement with the bitmap above.
      rows: solution.map((row) => runLengths(row)),
      cols: columns.map((column) => runLengths(column)),
    },
    reveal: {
      motifId: "fixture-diamond",
      name: "Losango",
      mirrored: false,
      solution,
    },
  };
}

/**
 * Termo's is the odd one out and stays deliberately hand-written: the
 * stored content is the ANSWER WORD, so a fixture derived from
 * `TERMO_ANSWERS` would put a real curated answer in a test file and give
 * this package the `@miolos/games` dependency the header above refuses.
 * `pombo`/`pombo` is a five-letter unaccented word that is NOT in the
 * curated 400, so nothing here can be mistaken for a published answer, and
 * `canonical === normalized` is a legal shape for any unaccented word.
 *
 * The accented case — where the two fields genuinely differ — is proved
 * against the real list in `packages/core`'s T-CORE-S17, which is where the
 * engine is importable.
 */
export function termoContentFixture(): Record<string, unknown> {
  return { canonical: "pombo", normalized: "pombo" };
}
