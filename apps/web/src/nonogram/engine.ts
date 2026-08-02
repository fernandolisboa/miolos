/**
 * The ONE boundary where the engine's values and the client's cells meet
 * (plan 020 §10.2), on the charter `sudoku/engine.ts:1-18` set.
 * `@miolos/games/nonogram` speaks `NonogramCellState[][]` and `boolean[][]`;
 * the client carries a FLAT `(0 | 1 | null)[]` in row-major order, where
 * `1` = preenchida, `0` = marcada and `null` = vazia (P11).
 *
 * Every conversion in this module is an explicit loop, never a cast: the
 * types below make claims about the values ("size² marks", "never unknown")
 * that only the loop actually proves (CLAUDE.md "parsed, never cast").
 *
 * THE PROHIBITION THIS MODULE CARRIES (N27): the client takes `size` from
 * THE WIRE — `daily.size` — and never from `NONOGRAM_WEEKDAY_CRITERIA`. That
 * constant is on the barrel but lives in `difficulty.ts`, which imports
 * `MOTIFS, motifBitmap` at module scope, so a single client-side import of
 * it retains all 59 233 bytes of motif tables in the browser bundle. It is a
 * tempting line, because `NonogramPuzzle` carries no difficulty field and a
 * size label has to come from somewhere. It comes from `daily.size`.
 */
import { solveNonogram, type NonogramClues } from "@miolos/games/nonogram";

import { nextHint, type Hint } from "../play/grid-hint";
// Type-only, so this is erased at build time and the `state.ts` ↔
// `engine.ts` pair carries no runtime cycle (`verbatimModuleSyntax`).
import type { NonogramCellValue, NonogramMark } from "./state";

/**
 * The picture recovered from the PUBLISHED clues, flattened row-major, or
 * `null` when the clues did not solve to an exact bitmap.
 *
 * It NEVER throws. `solveNonogram` raises a typed `RangeError` on
 * structurally malformed clues (`solve.ts:199-203`), and every other failure
 * mode — `status !== "solved"`, a row of the wrong length, a residual
 * `"unknown"`, a flattened length that is not `size²` — is a `null` return.
 *
 * The `null` branch is DEFINED, not assumed away (landmine 8): ADR-0021
 * decision 3 makes line-solvability to the exact bitmap a binary mechanical
 * gate over all 265 motif variants, re-proved 280/280 against the wire
 * projection alone, so it is unreachable for a published daily — exactly the
 * status `solutionDigits`'s null branch has. The screen renders the
 * unavailable card on it rather than crashing (§10.4).
 */
export function solutionMarks(
  clues: NonogramClues,
): readonly NonogramMark[] | null {
  let result;
  try {
    result = solveNonogram(clues);
  } catch {
    return null;
  }
  if (result.status !== "solved") {
    return null;
  }
  const size = clues.size;
  const marks: NonogramMark[] = [];
  for (const row of result.grid) {
    if (row.length !== size) {
      return null;
    }
    for (const cell of row) {
      // `unknown` is never guessed at: a solved board has none, and a board
      // that has one is not a board this client may play.
      if (cell === "unknown") {
        return null;
      }
      marks.push(cell === "filled" ? 1 : 0);
    }
  }
  return marks.length === size ** 2 ? marks : null;
}

/**
 * The readout's denominator: the number of cells the finished picture holds,
 * summed from the CLUES.
 *
 * From the clues and never from the solution — public, solve-free, O(runs),
 * and verified equal to the picture's filled count on 280/280 real boards.
 * It also disposes of the worry that the denominator leaks the total filled
 * count: it does not, it is a number the player can add up themselves off
 * the rails in front of them.
 */
export function filledTarget(clues: NonogramClues): number {
  let target = 0;
  for (const line of clues.rows) {
    for (const run of line) {
      target += run;
    }
  }
  return target;
}

/**
 * Cells the player has PAINTED — the readout's numerator (P13/P14).
 *
 * The shared `countFilled` is deliberately not reused: `progress.ts:16-27`
 * tests `(given ?? entries[index] ?? null) !== null`, and under P11 a cross
 * is `0`, which is not nullish — so it would count crosses too and compute a
 * different readout entirely.
 *
 * FORBIDDEN, and named here so a later "fix" for the readout overshooting
 * its denominator ("50 de 47") cannot land by accident: this may never
 * become "count only the cells that are painted AND correct". That version
 * reaches its denominator only on a correct board, which turns the readout
 * into a PER-CELL SOLUTION ORACLE — paint a cell, watch the counter move,
 * brute-force the picture. Overshooting is honest and self-diagnosing;
 * an oracle is a leak.
 */
export function countFilledCells(
  entries: readonly NonogramCellValue[],
): number {
  let filled = 0;
  for (const entry of entries) {
    if (entry === 1) {
      filled += 1;
    }
  }
  return filled;
}

/**
 * True when the PICTURE is painted — the completion predicate (ADR-0032).
 *
 * Iterates the SOLUTION, so a short `entries` array fails closed rather than
 * reading as a finished board. Crosses and undecided cells are both "not
 * painted", so a player who crosses every empty cell, one who crosses none,
 * and every mixture in between all finish identically.
 *
 * Local only. The server re-judges against the stored row (ADR-0004): this
 * verdict decides what the UI shows and nothing else.
 */
export function isPictureComplete(
  solution: readonly NonogramMark[],
  entries: readonly NonogramCellValue[],
): boolean {
  return solution.every(
    (mark, index) => (entries[index] === 1) === (mark === 1),
  );
}

/**
 * The completion body's grid, or `null` unless the board is exactly `cells`
 * long.
 *
 * `1` where the player painted, `0` for a cross AND for an undecided cell —
 * the three finishes produce byte-identical bodies, and a cross never
 * crosses the wire (ADR-0032). Mirrors `solvedDigits`/`allDigits` including
 * the length proof, which is the only thing that can prove the array before
 * the record is built: a nonogram grid is one of four legal lengths, so
 * nothing downstream carries a fixed `.length()` that would catch it.
 */
export function submittedCells(
  entries: readonly NonogramCellValue[],
  cells: number,
): readonly NonogramMark[] | null {
  if (entries.length !== cells) {
    return null;
  }
  return entries.map((entry) => (entry === 1 ? 1 : 0));
}

/**
 * Which of the three explanations the day's hint earns. Selected by the
 * hint's `kind` AND its `value` (P18), because a `fill` of `0` is a cross
 * and reads nothing like a fill to the player.
 */
export type NonogramHintKind = "correction" | "fill" | "cross";

/**
 * The one free hint: `nextHint` composed TWICE, so its fill branch always
 * lands on a picture cell (P17).
 *
 * PASS 1 is `nextHint` verbatim over a board with no givens, so its
 * contradiction-first policy transfers unchanged — and it is the half that
 * matters most, because a wrongly FILLED cell is what blocks completion and
 * a wrongly CROSSED one is what blocks the player.
 *
 * PASS 2 exists because `nextHint`'s fill branch returns the row-major first
 * `null` (`grid-hint.ts:69-71`), which silently assumes `entries` records
 * what the player KNOWS. That holds for Sudoku and Binairo, where every cell
 * must be written to finish, and it does NOT hold here, where crossing is
 * optional: measured, the unmodified fill branch returns a cross **239 times
 * out of 280** on a fresh board (seeds `(s * 2654435761) >>> 0` for
 * `s ∈ 1..40` × 7 weekdays — the population is part of the claim, since a
 * different seed set returns 237).
 *
 * Pass 2 re-runs the SAME shared function with the empty-picture cells
 * masked through the `givens` argument, which is exactly what that argument
 * means ("never a candidate", `:38-40`). It can only ever return a fill on a
 * picture cell, because pass 1 already returned a fill, so no contradiction
 * exists anywhere, so pass 2 cannot find one either. Measured: it lands on a
 * picture cell 280/280 fresh and 280/280 mid-game.
 *
 * `grid-hint.ts` is NOT modified. Its `T` is unconstrained precisely so a
 * synthetic `givens` array works here — a nonogram has no givens.
 *
 * The `?? first` fallback is DEFINED, not assumed away (landmine 8): it
 * fires only when no undecided picture cell is left, which — with no
 * contradiction present — is a board that is already painted, where
 * `use-hint` has already refused. Verified unreachable on 280/280 boards;
 * kept because "unreachable" is an argument, not a type.
 */
export function nextNonogramHint(
  solution: readonly NonogramMark[],
  entries: readonly NonogramCellValue[],
): Hint<NonogramMark> | null {
  const noGivens = solution.map(() => null);
  const first = nextHint<NonogramMark>(solution, noGivens, entries);
  if (first === null || first.kind === "correction" || first.value === 1) {
    return first;
  }
  const pictureOnly = solution.map((mark) => (mark === 1 ? null : 0));
  return nextHint<NonogramMark>(solution, pictureOnly, entries) ?? first;
}

/**
 * Pure, so the hook and the reducer agree on which explanation fired without
 * sharing a closure — and so it is unit-testable without React.
 */
export function hintKindOf(hint: Hint<NonogramMark>): NonogramHintKind {
  if (hint.kind === "correction") {
    return "correction";
  }
  return hint.value === 1 ? "fill" : "cross";
}
