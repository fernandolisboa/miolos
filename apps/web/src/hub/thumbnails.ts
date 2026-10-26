import type { Game } from "@miolos/core";

export type CellKind =
  | "paper"
  | "correct"
  | "present"
  | "absent"
  | "block"
  | "across"
  | "given"
  | "selected"
  | "filled"
  | "one"
  | "zero"
  | "empty"
  | "region1"
  | "region2"
  | "region3"
  | "region4"
  | "region5"
  | "cover"
  | "open"
  | "count1"
  | "count2"
  | "count3";

export type Mark = "crown" | "flag";

export type ThumbnailCell = {
  readonly kind: CellKind;
  readonly glyph?: string;
  readonly mark?: Mark;
};

export type Thumbnail = {
  readonly columns: number;
  readonly tilt: number;
  readonly outlined?: boolean;
  readonly ruled?: boolean;
  readonly cells: readonly ThumbnailCell[];
};

function grid(
  rows: readonly string[],
  cellOf: (key: string, row: number, column: number) => ThumbnailCell,
): readonly ThumbnailCell[] {
  return rows.flatMap((row, r) => [...row].map((key, c) => cellOf(key, r, c)));
}

function pick<T>(legend: Readonly<Record<string, T>>, key: string): T {
  const value = legend[key];
  if (value === undefined) {
    throw new Error(`no thumbnail cell for "${key}"`);
  }
  return value;
}

const TERMO_WORDS = ["BOLAS", "CAMAS", "CANOA"];
const TERMO_MARKS: Readonly<Record<string, CellKind>> = {
  c: "correct",
  p: "present",
  a: "absent",
};

const SUDOKU: Readonly<Record<string, ThumbnailCell>> = {
  ".": { kind: "paper" },
  "2": { kind: "paper", glyph: "2" },
  "8": { kind: "selected", glyph: "8" },
};

const BINAIRO: Readonly<Record<string, ThumbnailCell>> = {
  "1": { kind: "one", glyph: "1" },
  "0": { kind: "zero", glyph: "0" },
  ".": { kind: "empty" },
};

const QUEENS_REGIONS = ["11222", "13322", "43332", "44355", "45555"];
const REGIONS: Readonly<Record<string, CellKind>> = {
  "1": "region1",
  "2": "region2",
  "3": "region3",
  "4": "region4",
  "5": "region5",
};

const MINES: Readonly<Record<string, ThumbnailCell>> = {
  "#": { kind: "cover" },
  F: { kind: "cover", mark: "flag" },
  "0": { kind: "open" },
  "1": { kind: "count1", glyph: "1" },
  "2": { kind: "count2", glyph: "2" },
  "3": { kind: "count3", glyph: "3" },
};

export const THUMBNAILS: Readonly<Record<Game, Thumbnail>> = {
  termo: {
    columns: 5,
    tilt: -2,
    cells: grid(["apapa", "ccapa", "ccccc"], (mark, r, c) => ({
      kind: pick(TERMO_MARKS, mark),
      glyph: TERMO_WORDS[r]?.[c] ?? "",
    })),
  },
  crossword: {
    columns: 5,
    tilt: 1.5,
    cells: grid(["CAFE#", "A#O#A", "SOLAR", "A#G#C", "#PATO"], (letter, r) =>
      letter === "#"
        ? { kind: "block" }
        : { kind: r === 2 ? "across" : "paper", glyph: letter },
    ),
  },
  sudoku: {
    columns: 3,
    tilt: -1.5,
    outlined: true,
    cells: grid(["5.3", ".72", "189"], (digit) =>
      digit in SUDOKU ? pick(SUDOKU, digit) : { kind: "given", glyph: digit },
    ),
  },
  nonogram: {
    columns: 5,
    tilt: 2,
    cells: grid(["X...X", "XXXXX", "X.X.X", "XXXXX", ".XXX."], (key) => ({
      kind: key === "X" ? "filled" : "paper",
    })),
  },
  binairo: {
    columns: 4,
    tilt: -1,
    cells: grid(["10.0", "0101", ".100", "0.11"], (key) => pick(BINAIRO, key)),
  },
  queens: {
    columns: 5,
    tilt: 1.5,
    outlined: true,
    cells: grid([".Q...", "...Q.", "Q....", "..Q..", "....Q"], (key, r, c) => {
      const kind = pick(REGIONS, QUEENS_REGIONS[r]?.[c] ?? "");
      return key === "Q" ? { kind, mark: "crown" } : { kind };
    }),
  },
  minesweeper: {
    columns: 5,
    tilt: -2,
    ruled: true,
    cells: grid(["##100", "11100", "00011", "0123F", "01###"], (key) =>
      pick(MINES, key),
    ),
  },
};
