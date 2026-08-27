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
  const solution = Array.from({ length: 81 }, (_, i) => {
    const row = Math.floor(i / 9);
    const column = i % 9;
    return ((row * 3 + Math.floor(row / 3) + column) % 9) + 1;
  });

  const givens = solution.map((value, i) => (i % 3 === 0 ? value : 0));
  return {
    seed: 654_321,
    tier: 3,
    givens,
    solution,
    clueCount: givens.filter((value) => value !== 0).length,
  };
}

const NONOGRAM_PICTURE = [".....", "..#..", ".###.", "#####", ".###."];

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

  return {
    game: "nonogram",
    seed: 987_654,
    weekday: 1,
    size,
    clues: {
      size,

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

export function termoContentFixture(): Record<string, unknown> {
  return { canonical: "pombo", normalized: "pombo" };
}
