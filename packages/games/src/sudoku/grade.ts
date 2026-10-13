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

type SudokuSingle = "nakedSingle" | "hiddenSingle";

type SudokuElimination = Exclude<SudokuTechnique, SudokuSingle>;

const TECHNIQUE_TIER: Readonly<Record<SudokuTechnique, SudokuTier>> = {
  nakedSingle: 1,
  hiddenSingle: 2,
  pointing: 3,
  claiming: 3,
  nakedPair: 4,
  hiddenPair: 4,
  nakedTriple: 5,
  hiddenTriple: 5,
  xWingRows: 5,
  xWingCols: 5,
};

export interface GradeResult {
  readonly grade: SudokuGrade;

  readonly solved: readonly number[] | null;

  readonly techniques: ReadonlySet<SudokuTechnique>;
}

export interface SudokuStep {
  readonly index: number;
  readonly digit: number;
  readonly technique: SudokuSingle;
  readonly unit: {
    readonly kind: "row" | "column" | "box";
    readonly index: number;
  } | null;
  readonly cells: readonly number[];
  readonly after: SudokuElimination | null;
}

type LadderStep =
  | {
      readonly technique: SudokuSingle;
      readonly placed: {
        readonly index: number;
        readonly digit: number;
        readonly unit: number | null;
      };
    }
  | { readonly technique: SudokuElimination; readonly placed: null };

interface Ladder {
  readonly grid: readonly number[];
  remaining(): number;
  step(): LadderStep | null;
}

function createLadder(givens: readonly number[]): Ladder {
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

  const place = (i: number, d: number): void => {
    const bit = 1 << (d - 1);
    val[i] = d;
    cand[i] = 0;
    empties -= 1;
    for (const p of PEERS[i]!) {
      cand[p] = cand[p]! & ~bit;
    }
  };

  const nakedSingle = (): LadderStep | null => {
    for (let i = 0; i < 81; i += 1) {
      if (val[i]! === 0 && POPCOUNT[cand[i]!]! === 1) {
        const digit = 32 - Math.clz32(cand[i]!);
        place(i, digit);
        return {
          technique: "nakedSingle",
          placed: { index: i, digit, unit: null },
        };
      }
    }
    return null;
  };

  const hiddenSingle = (): LadderStep | null => {
    for (let u = 0; u < UNITS.length; u += 1) {
      const unit = UNITS[u]!;
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
          return {
            technique: "hiddenSingle",
            placed: { index: cell, digit: d, unit: u },
          };
        }
      }
    }
    return null;
  };

  const lockedCandidates = (): LadderStep | null => {
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
            return { technique: "pointing", placed: null };
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
            return { technique: "pointing", placed: null };
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
            return { technique: "claiming", placed: null };
          }
        }
      }
    }
    return null;
  };

  const pairs = (): LadderStep | null => {
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
            return { technique: "nakedPair", placed: null };
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
            return { technique: "hiddenPair", placed: null };
          }
        }
      }
    }
    return null;
  };

  const triplesAndXWing = (): LadderStep | null => {
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
              return { technique: "nakedTriple", placed: null };
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
              return { technique: "hiddenTriple", placed: null };
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
              return {
                technique: transpose ? "xWingCols" : "xWingRows",
                placed: null,
              };
            }
          }
        }
      }
    }
    return null;
  };

  return {
    grid: val,
    remaining: () => empties,
    step: () =>
      nakedSingle() ??
      hiddenSingle() ??
      lockedCandidates() ??
      pairs() ??
      triplesAndXWing(),
  };
}

export function gradeInternal(givens: readonly number[]): GradeResult {
  const ladder = createLadder(givens);
  const techniques = new Set<SudokuTechnique>();
  let grade: SudokuTier = 1;
  while (ladder.remaining() > 0) {
    const step = ladder.step();
    if (step === null) {
      return { grade: "beyond", solved: null, techniques };
    }
    techniques.add(step.technique);
    const tier = TECHNIQUE_TIER[step.technique];
    grade = tier > grade ? tier : grade;
  }
  return { grade, solved: ladder.grid, techniques };
}

export function nextSudokuStep(grid: SudokuGrid): SudokuStep | null {
  assertSudokuGrid(grid);
  const ladder = createLadder(grid);
  let after: SudokuElimination | null = null;
  while (ladder.remaining() > 0) {
    const step = ladder.step();
    if (step === null) {
      return null;
    }
    if (step.placed !== null) {
      const { index, digit, unit } = step.placed;
      return {
        index,
        digit,
        technique: step.technique,
        unit: unit === null ? null : unitOf(unit),
        cells: unit === null ? PEERS[index]! : UNITS[unit]!,
        after,
      };
    }
    if (
      after === null ||
      TECHNIQUE_TIER[step.technique] > TECHNIQUE_TIER[after]
    ) {
      after = step.technique;
    }
  }
  return null;
}

function unitOf(unit: number): NonNullable<SudokuStep["unit"]> {
  if (unit < 9) {
    return { kind: "row", index: unit };
  }
  return unit < 18
    ? { kind: "column", index: unit - 9 }
    : { kind: "box", index: unit - 18 };
}

export function gradeSudoku(givens: SudokuGrid): SudokuGrade {
  assertSudokuGrid(givens);
  return gradeInternal(givens).grade;
}
