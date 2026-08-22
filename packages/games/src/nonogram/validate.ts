import { isWeekday } from "../weekday";
import { deriveClues } from "./clues";
import { NONOGRAM_WEEKDAY_CRITERIA, mirrorH } from "./difficulty";
import { MOTIFS, motifBitmap } from "./motifs";
import { effortScore, isWellFormedClues, solveNonogram } from "./solve";
import type {
  NonogramClues,
  NonogramPuzzle,
  NonogramRejectionReason,
  NonogramSolution,
  NonogramValidationResult,
} from "./types";

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

function sameBitmap(a: NonogramSolution, b: NonogramSolution): boolean {
  return (
    a.length === b.length &&
    a.every((row, r) => {
      const other = b[r];
      return (
        other !== undefined &&
        row.length === other.length &&
        row.every((cell, c) => cell === other[c])
      );
    })
  );
}

/**
 * The validator whose approval criteria enforce the weekday ramp (spec:
 * "rampa … via critério de aprovação do validador"). All failures are
 * collected as machine-greppable reason codes, never short-circuited.
 * Structurally hostile inputs (out-of-range weekday, malformed clue sets)
 * are rejected with reason codes instead of throwing — the validator is a
 * verdict function, not an assertion.
 */
export function validateNonogram(
  puzzle: NonogramPuzzle,
): NonogramValidationResult {
  const failures: NonogramRejectionReason[] = [];
  const criteria = isWeekday(puzzle.weekday)
    ? NONOGRAM_WEEKDAY_CRITERIA[puzzle.weekday]
    : undefined;
  if (criteria === undefined) {
    failures.push("weekday-out-of-range");
  }
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
  if (criteria !== undefined && puzzle.size !== criteria.size) {
    failures.push("size-out-of-criteria");
  }

  if (squareGrid && !sameClues(deriveClues(reveal.solution), clues)) {
    failures.push("clues-solution-mismatch");
  }

  if (!isWellFormedClues(clues)) {
    // Also bounds the solver work below: solveNonogram only ever runs on
    // structurally well-formed clue sets here (defense in depth for untyped
    // callers — the generator can never produce this state).
    failures.push("clues-malformed");
  } else {
    // Line-solvability = solvable + unique + human-completable in one run
    // (the central property).
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
      if (criteria !== undefined) {
        const score = effortScore(solveResult);
        if (score < criteria.minEffort || score >= criteria.maxEffort) {
          failures.push("effort-out-of-band");
        }
      }
    }
  }

  if (reveal.name.trim().length === 0) {
    failures.push("reveal-name-empty");
  }
  const motif = MOTIFS.find((candidate) => candidate.id === reveal.motifId);
  if (motif === undefined) {
    failures.push("reveal-motif-unknown");
  } else if (squareGrid) {
    // Bind the reveal to the named motif: the solution must be exactly the
    // motif's bitmap under the declared `mirrored` flag, so a reveal cannot
    // name a different-but-existing motif or carry a flipped flag (defense
    // in depth — the generator derives all three from one pool entry).
    const base = motifBitmap(motif);
    const expected = reveal.mirrored ? mirrorH(base) : base;
    if (!sameBitmap(reveal.solution, expected)) {
      failures.push("reveal-solution-motif-mismatch");
    }
  }

  return { ok: failures.length === 0, failures };
}
