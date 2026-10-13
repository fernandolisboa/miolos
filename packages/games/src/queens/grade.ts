import { openMarks, placeSingles, QUEEN } from "./candidates";
import { geometryOf } from "./internal";
import { ELIMINATION_TIER, eliminate } from "./ladder";
import type { QueensBoard, QueensGrade, QueensTier } from "./types";

// see ADR-0090
export function gradeQueens(board: QueensBoard): QueensGrade {
  const geometry = geometryOf(board);
  const marks = openMarks(geometry);
  let maxTier: QueensTier = 1;
  let advancedSteps = 0;
  while (placeSingles(geometry, marks)) {
    if (marks.filter((mark) => mark === QUEEN).length === geometry.size) {
      return { solved: true, maxTier, advancedSteps };
    }
    const rule = eliminate(geometry, marks);
    if (rule === null) {
      break;
    }
    advancedSteps += 1;
    const tier = ELIMINATION_TIER[rule];
    maxTier = tier > maxTier ? tier : maxTier;
  }
  return { solved: false, maxTier, advancedSteps };
}
