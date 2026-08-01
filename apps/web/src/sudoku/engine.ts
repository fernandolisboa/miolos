/**
 * The ONE boundary where the engine's grid and the client's cells meet
 * (plan 018 §8.2, S6). `@miolos/games/sudoku` speaks `SudokuGrid` — 81
 * numbers with `0` for an empty cell — while the client carries `null` for
 * empty, so that the hint's "first empty", the persisted `entries` and the
 * shared `countFilled` read identically across games and no
 * `entries[i] || fallback` can ever mistake a real value for absence.
 *
 * Every conversion in this module is an explicit loop, never a cast: the
 * types below make claims about the values ("81 digits", "never 0") that
 * only the loop actually proves (CLAUDE.md "parsed, never cast").
 *
 * It is also the guarantee that keeps the engine from throwing. Every
 * `@miolos/games/sudoku` entry point calls `assertSudokuGrid` and throws a
 * `TypeError` on anything that is not 81 integers 0–9 (landmine 8), and
 * `mergedGrid` is what makes a partial, `undefined`-bearing client array
 * impossible to hand it.
 */
import { solveSudoku, type SudokuGrid } from "@miolos/games/sudoku";

// Type-only, so this is erased at build time and the `state.ts` ↔
// `engine.ts` pair carries no runtime cycle (`verbatimModuleSyntax`).
import type { SudokuCellValue, SudokuDigit } from "./state";

/** The engine's empty-cell sentinel. Never leaves this module as a value. */
const EMPTY = 0;

const CELLS = 81;

/**
 * 0-based row/column → 1-based CSS grid track, skipping the two gutter
 * tracks (§12.3): 0..8 → 1,2,3,5,6,7,9,10,11.
 *
 * It lives here rather than in the board because the keypad places its
 * digit row on the SAME template, so digit *n* sits under column *n*
 * (§12.6) — two consumers, one arithmetic, one unit test (T-WEB-S8).
 * Auto-placement is not an option: it would drop cells into the gutters.
 */
export const track = (index: number): number =>
  index + 1 + (index >= 3 ? 1 : 0) + (index >= 6 ? 1 : 0);

/**
 * `givens[i] !== 0 ? givens[i] : (entries[i] ?? 0)` — the grid the engine
 * sees. A given always wins, so a hand-edited record that writes over one
 * changes nothing the solver reads.
 */
export function mergedGrid(
  givens: SudokuGrid,
  entries: readonly SudokuCellValue[],
): SudokuGrid {
  return givens.map((given, index) =>
    given !== EMPTY ? given : (entries[index] ?? EMPTY),
  );
}

/**
 * True where the player may write. `givens` is engine-native, so `0` means
 * playable — and an index outside the board is not playable, which is what
 * makes a stray pointer or a hand-edited selection a no-op rather than a
 * write.
 */
export function isPlayable(givens: SudokuGrid, index: number): boolean {
  return givens[index] === EMPTY;
}

/**
 * The engine's solution as digits, or `null` when the board is unsolvable.
 *
 * The `null` branch is DEFINED, not assumed away: for a published daily it
 * is unreachable (uniquely solvable by construction, ADR-0023), so the
 * caller renders the hint button's exhausted variant rather than treating
 * it as an error. Omitting exactly this branch was plan 017's finding
 * `issue-ac-10`.
 */
export function solutionDigits(
  givens: SudokuGrid,
): readonly SudokuDigit[] | null {
  const solved = solveSudoku(givens);
  return solved === null ? null : allDigits(solved);
}

/**
 * `givens` in the hint's null-is-playable convention, so `nextHint` and the
 * shared `countFilled` can read a Sudoku board with no game-specific
 * branch. Cheap (81 reads) but called on every render — the caller
 * memoizes it on `givens`.
 *
 * A cell outside 1–9 reads as `null`, i.e. as PLAYABLE. That is the safe
 * direction: the worst a malformed given can then do is invite a hint,
 * where treating it as a clue would silently freeze a cell the player
 * cannot fill.
 */
export function playableGivens(
  givens: SudokuGrid,
): readonly (SudokuDigit | null)[] {
  return givens.map(asDigit);
}

/**
 * The MERGED grid narrowed to 81 digits, or `null` when any cell is outside
 * 1–9 (an empty cell being the case that actually happens).
 *
 * `buildRecord` writes `record.grid` only when this is non-null, mirroring
 * Binairo's `closed && isSolvedGrid(merged)` guard. Sudoku has no
 * equivalent on the engine barrel — `isSudokuSolved` returns a plain
 * `boolean`, not a type predicate — and `mergedGrid` returns
 * `readonly number[]`, which is not assignable to the `readonly
 * SudokuDigit[]` the play record's schema infers. Without it the offline
 * queue would have no body to POST at all (§8.2, review finding I3).
 */
export function solvedDigits(
  merged: SudokuGrid,
): readonly SudokuDigit[] | null {
  return allDigits(merged);
}

/**
 * The grid as 81 digits, or `null` if it is the wrong length or holds
 * anything that is not 1–9. The length check is not decorative: the play
 * record and the completion request both require exactly 81 cells, and this
 * is the only place that can prove it before either is built.
 */
function allDigits(grid: SudokuGrid): readonly SudokuDigit[] | null {
  if (grid.length !== CELLS) {
    return null;
  }
  const digits: SudokuDigit[] = [];
  for (const cell of grid) {
    const digit = asDigit(cell);
    if (digit === null) {
      return null;
    }
    digits.push(digit);
  }
  return digits;
}

/**
 * One cell, narrowed to a digit or `null`. The switch is the proof: an
 * `as SudokuDigit` would assert exactly what this checks.
 */
function asDigit(cell: number | undefined): SudokuDigit | null {
  switch (cell) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
    case 9:
      return cell;
    default:
      return null;
  }
}
