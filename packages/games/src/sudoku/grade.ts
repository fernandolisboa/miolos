// index reads use `!`: every index is produced by loops over [0, 81) / [0, 9);
// public entry points reject grids of the wrong length (assertSudokuGrid).
//
// NOTE: the grade is defined RELATIVE TO THIS LADDER — our house difficulty
// scale, not a universal one. Both ordering levels are normative spec:
// within a tier the techniques run in the order listed
// below and the first one that progresses wins the pass; within a technique,
// units/cells/digits scan in fixed ascending order and the first finding is
// applied. Any change to the ladder, the technique set, or either ordering
// re-grades every stored/expected tier.
import {
  PEERS,
  POPCOUNT,
  UNITS,
  assertSudokuGrid,
  boxOf,
  colOf,
  rowOf,
} from "./board";
import type { SudokuGrade, SudokuGrid, SudokuTier } from "./types";

/** Names of the ladder's detection rules, for test fixtures only. */
export type SudokuTechnique =
  | "nakedSingle"
  | "hiddenSingle"
  | "pointing"
  | "claiming"
  | "nakedPair"
  | "hiddenPair"
  | "nakedTriple"
  | "hiddenTriple"
  | "xWingRows"
  | "xWingCols";

export interface GradeResult {
  readonly grade: SudokuGrade;
  /** The ladder's own solved grid, or null when the grade is "beyond". */
  readonly solved: readonly number[] | null;
  /** Every detection rule that made progress at least once. */
  readonly techniques: ReadonlySet<SudokuTechnique>;
}

/**
 * Ladder grader, internal (no shape validation). Tier techniques:
 * T1 naked single, T2 hidden single, T3 locked candidates (pointing,
 * claiming), T4 naked/hidden pair, T5 naked/hidden triple + X-wing.
 * On progress at tier k: grade = max(grade, k), restart from tier 1.
 * All five tiers stuck ⇒ "beyond".
 */
export function gradeInternal(givens: readonly number[]): GradeResult {
  const val = [...givens];
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i += 1) {
    const v = val[i]!;
    if (v !== 0) {
      const bit = 1 << (v - 1);
      rows[rowOf(i)] = rows[rowOf(i)]! | bit;
      cols[colOf(i)] = cols[colOf(i)]! | bit;
      boxes[boxOf(i)] = boxes[boxOf(i)]! | bit;
    }
  }
  const cand = new Array<number>(81).fill(0);
  let empties = 0;
  for (let i = 0; i < 81; i += 1) {
    if (val[i]! === 0) {
      cand[i] = ~(rows[rowOf(i)]! | cols[colOf(i)]! | boxes[boxOf(i)]!) & 0x1ff;
      empties += 1;
    }
  }
  const techniques = new Set<SudokuTechnique>();

  const place = (i: number, d: number): void => {
    const bit = 1 << (d - 1);
    val[i] = d;
    cand[i] = 0;
    empties -= 1;
    for (const p of PEERS[i]!) {
      cand[p] = cand[p]! & ~bit;
    }
  };

  // T1 — naked single: first empty cell with exactly one candidate.
  const nakedSingle = (): boolean => {
    for (let i = 0; i < 81; i += 1) {
      if (val[i]! === 0 && POPCOUNT[cand[i]!]! === 1) {
        // 32 - clz32(mask) = index of the highest set bit = the digit;
        // valid only because popcount === 1 (that bit is the only one).
        place(i, 32 - Math.clz32(cand[i]!));
        techniques.add("nakedSingle");
        return true;
      }
    }
    return false;
  };

  // T2 — hidden single: in some unit, a digit with exactly one candidate cell.
  const hiddenSingle = (): boolean => {
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d += 1) {
        const bit = 1 << (d - 1);
        let count = 0;
        let cell = -1;
        for (const i of unit) {
          if (val[i]! === 0 && (cand[i]! & bit) !== 0) {
            count += 1;
            cell = i;
          }
        }
        if (count === 1) {
          place(cell, d);
          techniques.add("hiddenSingle");
          return true;
        }
      }
    }
    return false;
  };

  // T3 — locked candidates: pointing (all boxes), then claiming (rows, cols).
  const lockedCandidates = (): boolean => {
    for (let b = 0; b < 9; b += 1) {
      const box = UNITS[18 + b]!;
      for (let d = 1; d <= 9; d += 1) {
        const bit = 1 << (d - 1);
        const cells = box.filter(
          (i) => val[i]! === 0 && (cand[i]! & bit) !== 0,
        );
        if (cells.length < 2) {
          continue;
        }
        const cellRows = new Set(cells.map(rowOf));
        const cellCols = new Set(cells.map(colOf));
        if (cellRows.size === 1) {
          const r = rowOf(cells[0]!);
          let removed = false;
          for (let c = 0; c < 9; c += 1) {
            const i = r * 9 + c;
            if (boxOf(i) !== b && val[i]! === 0 && (cand[i]! & bit) !== 0) {
              cand[i] = cand[i]! & ~bit;
              removed = true;
            }
          }
          if (removed) {
            techniques.add("pointing");
            return true;
          }
        }
        if (cellCols.size === 1) {
          const c = colOf(cells[0]!);
          let removed = false;
          for (let r = 0; r < 9; r += 1) {
            const i = r * 9 + c;
            if (boxOf(i) !== b && val[i]! === 0 && (cand[i]! & bit) !== 0) {
              cand[i] = cand[i]! & ~bit;
              removed = true;
            }
          }
          if (removed) {
            techniques.add("pointing");
            return true;
          }
        }
      }
    }
    for (let li = 0; li < 18; li += 1) {
      const line = UNITS[li]!;
      for (let d = 1; d <= 9; d += 1) {
        const bit = 1 << (d - 1);
        const cells = line.filter(
          (i) => val[i]! === 0 && (cand[i]! & bit) !== 0,
        );
        if (cells.length < 2) {
          continue;
        }
        const cellBoxes = new Set(cells.map(boxOf));
        if (cellBoxes.size === 1) {
          const b = boxOf(cells[0]!);
          let removed = false;
          for (const i of UNITS[18 + b]!) {
            if (!line.includes(i) && val[i]! === 0 && (cand[i]! & bit) !== 0) {
              cand[i] = cand[i]! & ~bit;
              removed = true;
            }
          }
          if (removed) {
            techniques.add("claiming");
            return true;
          }
        }
      }
    }
    return false;
  };

  // T4 — naked pair, then hidden pair, per unit in ascending order.
  const pairs = (): boolean => {
    for (const unit of UNITS) {
      const twos = unit.filter(
        (i) => val[i]! === 0 && POPCOUNT[cand[i]!]! === 2,
      );
      for (let a = 0; a < twos.length; a += 1) {
        for (let b = a + 1; b < twos.length; b += 1) {
          const cellA = twos[a]!;
          const cellB = twos[b]!;
          if (cand[cellA]! !== cand[cellB]!) {
            continue;
          }
          const mask = cand[cellA];
          let removed = false;
          for (const i of unit) {
            if (
              val[i]! === 0 &&
              i !== cellA &&
              i !== cellB &&
              (cand[i]! & mask) !== 0
            ) {
              cand[i] = cand[i]! & ~mask;
              removed = true;
            }
          }
          if (removed) {
            techniques.add("nakedPair");
            return true;
          }
        }
      }
      for (let d1 = 1; d1 <= 8; d1 += 1) {
        for (let d2 = d1 + 1; d2 <= 9; d2 += 1) {
          const bit1 = 1 << (d1 - 1);
          const bit2 = 1 << (d2 - 1);
          const cells1 = unit.filter(
            (i) => val[i]! === 0 && (cand[i]! & bit1) !== 0,
          );
          const cells2 = unit.filter(
            (i) => val[i]! === 0 && (cand[i]! & bit2) !== 0,
          );
          if (cells1.length !== 2 || cells2.length !== 2) {
            continue;
          }
          if (cells1[0]! !== cells2[0]! || cells1[1]! !== cells2[1]!) {
            continue;
          }
          const mask = bit1 | bit2;
          let changed = false;
          for (const i of cells1) {
            if (cand[i]! !== mask) {
              cand[i] = mask;
              changed = true;
            }
          }
          if (changed) {
            techniques.add("hiddenPair");
            return true;
          }
        }
      }
    }
    return false;
  };

  // T5 — naked triple, hidden triple (per unit), then X-wing rows, X-wing cols.
  const triplesAndXWing = (): boolean => {
    for (const unit of UNITS) {
      const cells = unit.filter(
        (i) =>
          val[i]! === 0 && POPCOUNT[cand[i]!]! >= 2 && POPCOUNT[cand[i]!]! <= 3,
      );
      for (let a = 0; a < cells.length; a += 1) {
        for (let b = a + 1; b < cells.length; b += 1) {
          for (let c = b + 1; c < cells.length; c += 1) {
            const cellA = cells[a]!;
            const cellB = cells[b]!;
            const cellC = cells[c]!;
            const union = cand[cellA]! | cand[cellB]! | cand[cellC]!;
            if (POPCOUNT[union]! !== 3) {
              continue;
            }
            let removed = false;
            for (const i of unit) {
              if (
                val[i]! === 0 &&
                i !== cellA &&
                i !== cellB &&
                i !== cellC &&
                (cand[i]! & union) !== 0
              ) {
                cand[i] = cand[i]! & ~union;
                removed = true;
              }
            }
            if (removed) {
              techniques.add("nakedTriple");
              return true;
            }
          }
        }
      }
      for (let d1 = 1; d1 <= 7; d1 += 1) {
        for (let d2 = d1 + 1; d2 <= 8; d2 += 1) {
          for (let d3 = d2 + 1; d3 <= 9; d3 += 1) {
            const mask1 = 1 << (d1 - 1);
            const mask2 = 1 << (d2 - 1);
            const mask3 = 1 << (d3 - 1);
            const cells1 = unit.filter(
              (i) => val[i]! === 0 && (cand[i]! & mask1) !== 0,
            );
            const cells2 = unit.filter(
              (i) => val[i]! === 0 && (cand[i]! & mask2) !== 0,
            );
            const cells3 = unit.filter(
              (i) => val[i]! === 0 && (cand[i]! & mask3) !== 0,
            );
            if (
              cells1.length === 0 ||
              cells2.length === 0 ||
              cells3.length === 0
            ) {
              continue;
            }
            const cellUnion = [...new Set([...cells1, ...cells2, ...cells3])];
            if (cellUnion.length !== 3) {
              continue;
            }
            const mask = mask1 | mask2 | mask3;
            let changed = false;
            for (const i of cellUnion) {
              if ((cand[i]! & ~mask) !== 0) {
                cand[i] = cand[i]! & mask;
                changed = true;
              }
            }
            if (changed) {
              techniques.add("hiddenTriple");
              return true;
            }
          }
        }
      }
    }
    for (const transpose of [false, true]) {
      for (let d = 1; d <= 9; d += 1) {
        const bit = 1 << (d - 1);
        const linesWithTwo: (readonly [number, number, number])[] = [];
        for (let a = 0; a < 9; a += 1) {
          const positions: number[] = [];
          for (let b = 0; b < 9; b += 1) {
            const i = transpose ? b * 9 + a : a * 9 + b;
            if (val[i]! === 0 && (cand[i]! & bit) !== 0) {
              positions.push(b);
            }
          }
          if (positions.length === 2) {
            linesWithTwo.push([a, positions[0]!, positions[1]!]);
          }
        }
        for (let x = 0; x < linesWithTwo.length; x += 1) {
          for (let y = x + 1; y < linesWithTwo.length; y += 1) {
            const [line1, pos1, pos2] = linesWithTwo[x]!;
            const [line2, other1, other2] = linesWithTwo[y]!;
            if (pos1 !== other1 || pos2 !== other2) {
              continue;
            }
            let removed = false;
            for (let a = 0; a < 9; a += 1) {
              if (a === line1 || a === line2) {
                continue;
              }
              for (const p of [pos1, pos2]) {
                const i = transpose ? p * 9 + a : a * 9 + p;
                if (val[i]! === 0 && (cand[i]! & bit) !== 0) {
                  cand[i] = cand[i]! & ~bit;
                  removed = true;
                }
              }
            }
            if (removed) {
              techniques.add(transpose ? "xWingCols" : "xWingRows");
              return true;
            }
          }
        }
      }
    }
    return false;
  };

  let grade: SudokuTier = 1;
  while (empties > 0) {
    if (nakedSingle()) {
      continue;
    }
    if (hiddenSingle()) {
      grade = grade < 2 ? 2 : grade;
      continue;
    }
    if (lockedCandidates()) {
      grade = grade < 3 ? 3 : grade;
      continue;
    }
    if (pairs()) {
      grade = grade < 4 ? 4 : grade;
      continue;
    }
    if (triplesAndXWing()) {
      grade = 5;
      continue;
    }
    return { grade: "beyond", solved: null, techniques };
  }
  return { grade, solved: val, techniques };
}

/**
 * Highest ladder tier ever needed to solve `givens` by logic alone, or
 * "beyond" if the ladder stalls. Precondition: givens has ≥ 1 solution;
 * an unsolvable grid grades "beyond" (the ladder stalls) — documented,
 * not detected specially. Pure: no rng, no state.
 */
export function gradeSudoku(givens: SudokuGrid): SudokuGrade {
  assertSudokuGrid(givens);
  return gradeInternal(givens).grade;
}
