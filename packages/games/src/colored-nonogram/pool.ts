import type { PoolEntry } from "../nonogram/difficulty";
import { MOTIFS } from "../nonogram/motifs";
import { motifTones } from "../nonogram-colors";
import { deriveColoredClues, toneGrid } from "./clues";
import { solveColoredNonogram } from "./solve";

export const CONFUSABLE_TONE_PAIRS = [
  ["b", "p"],
  ["n", "r"],
  ["r", "d"],
  ["o", "g"],
  ["r", "g"],
  ["n", "d"],
  ["t", "y"],
  ["l", "m"],
] as const;

const MAX_LINE_RUNS = 7;
const MAX_COLUMN_RUN = 9;

function playable(size: number, tones: string): boolean {
  const clues = deriveColoredClues(size, tones);
  return (
    [...clues.rows, ...clues.cols].every(
      (runs) => runs.length <= MAX_LINE_RUNS,
    ) &&
    clues.cols.every((runs) =>
      runs.every((run) => run.length <= MAX_COLUMN_RUN),
    ) &&
    !CONFUSABLE_TONE_PAIRS.some((pair) =>
      pair.every((tone) => clues.palette.includes(tone)),
    ) &&
    solveColoredNonogram(clues)?.join() ===
      toneGrid(clues.palette, tones).join()
  );
}

const pools = new Map<number, readonly PoolEntry[]>();

export function coloredPool(size: number): readonly PoolEntry[] {
  const cached = pools.get(size);
  if (cached !== undefined) {
    return cached;
  }
  const pool = MOTIFS.filter((motif) => motif.size === size).flatMap((motif) =>
    (motif.mirrorable ? [false, true] : [false])
      .filter((mirrored) => {
        const tones = motifTones(motif.id, mirrored);
        return tones !== undefined && playable(size, tones);
      })
      .map((mirrored) => ({ motif, mirrored })),
  );
  pools.set(size, pool);
  return pool;
}
