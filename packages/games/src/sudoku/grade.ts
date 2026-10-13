import {
  BOX_UNITS,
  COLUMN_UNITS,
  PEERS,
  POPCOUNT,
  ROW_UNITS,
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

export interface SudokuUnit {
  readonly kind: "row" | "column" | "box";
  readonly index: number;
}

export interface SudokuStep {
  readonly index: number;
  readonly digit: number;
  readonly technique: SudokuSingle;
  readonly unit: SudokuUnit | null;
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

  const homes = new Array<number>(9).fill(0);
  const lineHomes = new Array<number>(9).fill(0);

  // homes[d] and `keep` are position masks (bit k = the unit's kth cell);
  // `mask` in clearUnit is a digit mask (bit d = digit d + 1).
  const fillHomes = (unit: readonly number[]): void => {
    homes.fill(0);
    for (let k = 0; k < 9; k += 1) {
      const cell = unit[k]!;
      for (let m = val[cell]! === 0 ? cand[cell]! : 0; m !== 0; m &= m - 1) {
        const d = 31 - Math.clz32(m & -m);
        homes[d] = homes[d]! | (1 << k);
      }
    }
  };

  const clearOutside = (
    cells: readonly number[],
    bit: number,
    keep: readonly number[],
  ): boolean => {
    let removed = false;
    for (const i of cells) {
      if (!keep.includes(i) && val[i]! === 0 && (cand[i]! & bit) !== 0) {
        cand[i] = cand[i]! & ~bit;
        removed = true;
      }
    }
    return removed;
  };

  const clearUnit = (
    unit: readonly number[],
    mask: number,
    keep: number,
  ): boolean => {
    let removed = false;
    for (let k = 0; k < 9; k += 1) {
      const i = unit[k]!;
      if ((keep & (1 << k)) === 0 && val[i]! === 0 && (cand[i]! & mask) !== 0) {
        cand[i] = cand[i]! & ~mask;
        removed = true;
      }
    }
    return removed;
  };

  const lockedCandidates = (): LadderStep | null => {
    for (let b = 0; b < 9; b += 1) {
      const box = UNITS[BOX_UNITS + b]!;
      for (let d = 1; d <= 9; d += 1) {
        const bit = 1 << (d - 1);
        let count = 0;
        let row = -1;
        let col = -1;
        for (const i of box) {
          if (val[i]! === 0 && (cand[i]! & bit) !== 0) {
            row = count === 0 || rowOf(i) === row ? rowOf(i) : -1;
            col = count === 0 || colOf(i) === col ? colOf(i) : -1;
            count += 1;
          }
        }
        if (count < 2) {
          continue;
        }
        if (row !== -1 && clearOutside(UNITS[ROW_UNITS + row]!, bit, box)) {
          return { technique: "pointing", placed: null };
        }
        if (col !== -1 && clearOutside(UNITS[COLUMN_UNITS + col]!, bit, box)) {
          return { technique: "pointing", placed: null };
        }
      }
    }
    for (let li = 0; li < BOX_UNITS; li += 1) {
      const line = UNITS[li]!;
      for (let d = 1; d <= 9; d += 1) {
        const bit = 1 << (d - 1);
        let count = 0;
        let box = -1;
        for (const i of line) {
          if (val[i]! === 0 && (cand[i]! & bit) !== 0) {
            box = count === 0 || boxOf(i) === box ? boxOf(i) : -1;
            count += 1;
          }
        }
        if (
          count >= 2 &&
          box !== -1 &&
          clearOutside(UNITS[BOX_UNITS + box]!, bit, line)
        ) {
          return { technique: "claiming", placed: null };
        }
      }
    }
    return null;
  };

  const isPairCell = (i: number): boolean =>
    val[i]! === 0 && POPCOUNT[cand[i]!]! === 2;

  const isTripleCell = (i: number): boolean =>
    val[i]! === 0 && POPCOUNT[cand[i]!]! >= 2 && POPCOUNT[cand[i]!]! <= 3;

  const pairs = (): LadderStep | null => {
    for (const unit of UNITS) {
      for (let a = 0; a < 9; a += 1) {
        const cellA = unit[a]!;
        if (!isPairCell(cellA)) {
          continue;
        }
        for (let b = a + 1; b < 9; b += 1) {
          const cellB = unit[b]!;
          if (
            isPairCell(cellB) &&
            cand[cellA]! === cand[cellB]! &&
            clearUnit(unit, cand[cellA], (1 << a) | (1 << b))
          ) {
            return { technique: "nakedPair", placed: null };
          }
        }
      }
      fillHomes(unit);
      for (let d1 = 0; d1 < 8; d1 += 1) {
        const at = homes[d1]!;
        if (POPCOUNT[at]! !== 2) {
          continue;
        }
        for (let d2 = d1 + 1; d2 < 9; d2 += 1) {
          if (homes[d2]! !== at) {
            continue;
          }
          const mask = (1 << d1) | (1 << d2);
          let changed = false;
          for (let k = 0; k < 9; k += 1) {
            const i = unit[k]!;
            if ((at & (1 << k)) !== 0 && cand[i]! !== mask) {
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

  const triples = (): LadderStep | null => {
    for (const unit of UNITS) {
      for (let a = 0; a < 9; a += 1) {
        if (!isTripleCell(unit[a]!)) {
          continue;
        }
        for (let b = a + 1; b < 9; b += 1) {
          if (!isTripleCell(unit[b]!)) {
            continue;
          }
          const pair = cand[unit[a]!]! | cand[unit[b]!]!;
          for (let c = b + 1; c < 9; c += 1) {
            if (!isTripleCell(unit[c]!)) {
              continue;
            }
            const union = pair | cand[unit[c]!]!;
            if (
              POPCOUNT[union]! === 3 &&
              clearUnit(unit, union, (1 << a) | (1 << b) | (1 << c))
            ) {
              return { technique: "nakedTriple", placed: null };
            }
          }
        }
      }
      fillHomes(unit);
      for (let d1 = 0; d1 < 7; d1 += 1) {
        for (let d2 = d1 + 1; d2 < 8; d2 += 1) {
          for (let d3 = d2 + 1; d3 < 9; d3 += 1) {
            const at1 = homes[d1]!;
            const at2 = homes[d2]!;
            const at3 = homes[d3]!;
            const at = at1 | at2 | at3;
            if (at1 === 0 || at2 === 0 || at3 === 0 || POPCOUNT[at]! !== 3) {
              continue;
            }
            const mask = (1 << d1) | (1 << d2) | (1 << d3);
            let changed = false;
            for (let k = 0; k < 9; k += 1) {
              const i = unit[k]!;
              if ((at & (1 << k)) !== 0 && (cand[i]! & ~mask) !== 0) {
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
    return null;
  };

  const xWing = (lines: number): LadderStep | null => {
    for (let d = 0; d < 9; d += 1) {
      const bit = 1 << d;
      for (let a = 0; a < 9; a += 1) {
        const line = UNITS[lines + a]!;
        let at = 0;
        for (let k = 0; k < 9; k += 1) {
          const i = line[k]!;
          if (val[i]! === 0 && (cand[i]! & bit) !== 0) {
            at |= 1 << k;
          }
        }
        lineHomes[a] = at;
      }
      for (let x = 0; x < 9; x += 1) {
        const at = lineHomes[x]!;
        if (POPCOUNT[at]! !== 2) {
          continue;
        }
        for (let y = x + 1; y < 9; y += 1) {
          if (lineHomes[y]! !== at) {
            continue;
          }
          let removed = false;
          for (let a = 0; a < 9; a += 1) {
            if (
              a !== x &&
              a !== y &&
              clearUnit(UNITS[lines + a]!, bit, ~at & 0x1ff)
            ) {
              removed = true;
            }
          }
          if (removed) {
            return {
              technique: lines === ROW_UNITS ? "xWingRows" : "xWingCols",
              placed: null,
            };
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
      triples() ??
      xWing(ROW_UNITS) ??
      xWing(COLUMN_UNITS),
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

function unitOf(unit: number): SudokuUnit {
  if (unit < COLUMN_UNITS) {
    return { kind: "row", index: unit - ROW_UNITS };
  }
  return unit < BOX_UNITS
    ? { kind: "column", index: unit - COLUMN_UNITS }
    : { kind: "box", index: unit - BOX_UNITS };
}

export function gradeSudoku(givens: SudokuGrid): SudokuGrade {
  assertSudokuGrid(givens);
  return gradeInternal(givens).grade;
}
