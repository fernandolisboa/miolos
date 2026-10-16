import { lineCells } from "../nonogram/lines";
import { PICTURE_TONES } from "../nonogram/tones";
import type { ColoredNonogramClues, ColoredRun } from "./types";

export function toneGrid(palette: readonly string[], tones: string): number[] {
  return [...tones].map((tone) => palette.indexOf(tone) + 1);
}

export function coloredRuns(line: readonly number[]): ColoredRun[] {
  const runs: ColoredRun[] = [];
  let length = 0;
  line.forEach((tone, k) => {
    length += 1;
    if (tone !== line[k + 1]) {
      if (tone !== 0) {
        runs.push({ tone, length });
      }
      length = 0;
    }
  });
  return runs;
}

export function deriveColoredClues(
  size: number,
  tones: string,
): ColoredNonogramClues {
  const palette = PICTURE_TONES.filter((tone) => tones.includes(tone));
  const grid = toneGrid(palette, tones);
  const runs = lineCells(size).map(({ cells }) =>
    coloredRuns(cells.map((cell) => grid[cell] ?? 0)),
  );
  return {
    size,
    palette,
    rows: runs.slice(0, size),
    cols: runs.slice(size),
  };
}
