import { deriveClues } from "./clues";
import { WEEKDAY_CRITERIA } from "./difficulty";
import { MOTIFS } from "./motifs";
import { effortScore, solveNonogram } from "./solve";
import type { NonogramClues, NonogramPuzzle, ValidationResult } from "./types";

function sameRuns(
  a: ReadonlyArray<ReadonlyArray<number>>,
  b: ReadonlyArray<ReadonlyArray<number>>,
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((runs, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      runs.length === other.length &&
      runs.every((run, runIndex) => run === other[runIndex])
    );
  });
}

function sameClues(a: NonogramClues, b: NonogramClues): boolean {
  return (
    a.size === b.size && sameRuns(a.rows, b.rows) && sameRuns(a.cols, b.cols)
  );
}

/**
 * The validator whose approval criteria enforce the weekday ramp (spec:
 * "rampa … via critério de aprovação do validador"). All failures are
 * collected as machine-greppable reason codes, never short-circuited.
 */
export function validateNonogram(puzzle: NonogramPuzzle): ValidationResult {
  const failures: string[] = [];
  const criteria = WEEKDAY_CRITERIA[puzzle.weekday];
  const { clues, reveal } = puzzle;

  const squareGrid =
    reveal.solution.length === clues.size &&
    reveal.solution.every((row) => row.length === clues.size);
  if (!squareGrid) {
    failures.push("solution-dimensions-mismatch");
  }
  if (puzzle.size !== clues.size) {
    failures.push("size-field-mismatch");
  }
  if (puzzle.size !== criteria.size) {
    failures.push("size-out-of-criteria");
  }

  if (squareGrid && !sameClues(deriveClues(reveal.solution), clues)) {
    failures.push("clues-solution-mismatch");
  }

  // Line-solvability = solvable + unique + human-completable in one run
  // (the central property, plan §5).
  const solveResult = solveNonogram(clues);
  if (solveResult.status !== "solved") {
    failures.push("not-line-solvable");
  } else {
    if (squareGrid) {
      const matches = solveResult.grid.every((row, r) =>
        row.every(
          (cell, c) =>
            (cell === "filled") === (reveal.solution[r]?.[c] ?? false),
        ),
      );
      if (!matches) {
        failures.push("solved-grid-differs-from-solution");
      }
    }
    const score = effortScore(solveResult);
    if (score < criteria.minEffort || score >= criteria.maxEffort) {
      failures.push("effort-out-of-band");
    }
  }

  if (reveal.name.trim().length === 0) {
    failures.push("reveal-name-empty");
  }
  if (!MOTIFS.some((motif) => motif.id === reveal.motifId)) {
    failures.push("reveal-motif-unknown");
  }

  return { ok: failures.length === 0, failures };
}
