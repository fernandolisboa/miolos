/**
 * Test fixtures for the db suites. Each content fixture satisfies its
 * game's daily-content schema STRUCTURALLY (that is all the wall parses —
 * rule validity is the engine's concern, proven in packages/games); no
 * @miolos/games dependency here, and #23 keeps it that way (plan 018 §15,
 * T-DB-S1).
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
