import { motifTones } from "../nonogram-colors";
import { createSeededRandom } from "../random";
import { deriveColoredClues, toneGrid } from "./clues";
import { coloredPool } from "./pool";
import type { ColoredNonogramPuzzle } from "./types";

export function generateColoredNonogram(
  seed: number,
  size: number,
): ColoredNonogramPuzzle {
  const pool = coloredPool(size);
  if (pool.length === 0) {
    throw new RangeError(`no coloured Nonogram has size ${String(size)}`);
  }
  const entry = pool[createSeededRandom(seed).nextInt(pool.length)]!;
  const tones = motifTones(entry.motif.id, entry.mirrored) ?? "";
  const clues = deriveColoredClues(size, tones);
  return {
    seed: seed >>> 0,
    size,
    clues,
    solution: toneGrid(clues.palette, tones),
  };
}
