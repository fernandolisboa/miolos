import { lineCells } from "../nonogram/lines";
import type {
  ColoredLineSpec,
  ColoredNonogramClues,
  ColoredRun,
} from "./types";

const EMPTY = 1;

let feasible = new Uint8Array(0);
let reached = new Uint8Array(0);

function landing(
  domains: readonly number[],
  runs: readonly ColoredRun[],
  start: number,
  j: number,
): number {
  const { tone, length } = runs[j]!;
  const end = start + length;
  if (end > domains.length) {
    return -1;
  }
  for (let c = start; c < end; c += 1) {
    if ((domains[c]! & (1 << tone)) === 0) {
      return -1;
    }
  }
  if (runs[j + 1]?.tone !== tone) {
    return end;
  }
  return end < domains.length && (domains[end]! & EMPTY) !== 0 ? end + 1 : -1;
}

// feasible[i * w + j]: cells i.. can hold runs j..; landing() takes a gap cell
// only before a run of the same tone. Buffers are reused across the pool build.
export function solveColoredLine(
  domains: readonly number[],
  runs: readonly ColoredRun[],
): number[] | null {
  const n = domains.length;
  const w = runs.length + 1;
  if (feasible.length < (n + 1) * w) {
    feasible = new Uint8Array((n + 1) * w);
    reached = new Uint8Array((n + 1) * w);
  }
  feasible.fill(0, n * w, (n + 1) * w);
  feasible[n * w + w - 1] = 1;
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = 0; j < w; j += 1) {
      const at = j < w - 1 ? landing(domains, runs, i, j) : -1;
      feasible[i * w + j] =
        ((domains[i]! & EMPTY) !== 0 && feasible[(i + 1) * w + j] === 1) ||
        (at >= 0 && feasible[at * w + j + 1] === 1)
          ? 1
          : 0;
    }
  }
  if (feasible[0] !== 1) {
    return null;
  }
  const possible = new Array<number>(n).fill(0);
  reached.fill(0, 0, (n + 1) * w);
  reached[0] = 1;
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < w; j += 1) {
      if (reached[i * w + j] !== 1) {
        continue;
      }
      if ((domains[i]! & EMPTY) !== 0 && feasible[(i + 1) * w + j] === 1) {
        possible[i]! |= EMPTY;
        reached[(i + 1) * w + j] = 1;
      }
      const at = j < w - 1 ? landing(domains, runs, i, j) : -1;
      if (at >= 0 && feasible[at * w + j + 1] === 1) {
        const { tone, length } = runs[j]!;
        for (let c = i; c < i + length; c += 1) {
          possible[c]! |= 1 << tone;
        }
        if (at > i + length) {
          possible[i + length]! |= EMPTY;
        }
        reached[at * w + j + 1] = 1;
      }
    }
  }
  return possible;
}

export function fixedTone(domain: number): number | null {
  return (domain & (domain - 1)) === 0 ? 31 - Math.clz32(domain) : null;
}

export function coloredLines(clues: ColoredNonogramClues): ColoredLineSpec[] {
  const runs = [...clues.rows, ...clues.cols];
  return lineCells(clues.size).map((spec, k) => ({
    ...spec,
    runs: runs[k] ?? [],
  }));
}

export function solveMarkedLine(
  clues: ColoredNonogramClues,
  { cells, runs }: ColoredLineSpec,
  marks: readonly (number | null)[],
): number[] | null {
  const open = (2 << clues.palette.length) - 1;
  return solveColoredLine(
    cells.map((cell) => {
      const mark = marks[cell] ?? null;
      return mark === null ? open : 1 << mark;
    }),
    runs,
  );
}

export function solveColoredNonogram(
  clues: ColoredNonogramClues,
): number[] | null {
  const { size } = clues;
  const lines = coloredLines(clues);
  const marks = new Array<number | null>(size * size).fill(null);
  const dirty = lines.map(() => true);
  for (let k = dirty.indexOf(true); k >= 0; k = dirty.indexOf(true)) {
    dirty[k] = false;
    const spec = lines[k]!;
    const solved = solveMarkedLine(clues, spec, marks);
    if (solved === null) {
      return null;
    }
    spec.cells.forEach((cell, at) => {
      const tone = fixedTone(solved[at]!);
      if (tone !== null && marks[cell] === null) {
        marks[cell] = tone;
        dirty[k < size ? size + (cell % size) : Math.floor(cell / size)] = true;
      }
    });
  }
  return marks.every((tone): tone is number => tone !== null) ? marks : null;
}
