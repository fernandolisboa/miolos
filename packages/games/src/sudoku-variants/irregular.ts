import type { SeededRandom } from "../random";
import { floodRegion, neighbours, relabel } from "../regions";
import { CLASSIC_LAYOUT } from "../sudoku/board";
import type { SudokuLayout } from "../sudoku/types";

const SWAPS = 100;
const MAX_TRIES = 4000;

function trySwap(regions: number[], rng: SeededRandom): boolean {
  const a = rng.nextInt(81);
  const home = regions[a]!;
  const borders = [
    ...new Set(
      neighbours(9, a)
        .map((cell) => regions[cell]!)
        .filter((id) => id !== home),
    ),
  ];
  if (borders.length === 0) {
    return false;
  }
  const away = borders[rng.nextInt(borders.length)]!;
  const touching = regions.flatMap((id, cell) =>
    id === away &&
    neighbours(9, cell).some((next) => next !== a && regions[next] === home)
      ? [cell]
      : [],
  );
  if (touching.length === 0) {
    return false;
  }
  const b = touching[rng.nextInt(touching.length)]!;
  regions[a] = away;
  regions[b] = home;
  if (
    floodRegion(9, regions, a).size === 9 &&
    floodRegion(9, regions, b).size === 9
  ) {
    return true;
  }
  regions[a] = home;
  regions[b] = away;
  return false;
}

export function drawIrregularLayout(rng: SeededRandom): SudokuLayout {
  const regions = [...CLASSIC_LAYOUT.regions];
  let swaps = 0;
  for (let tries = 0; swaps < SWAPS && tries < MAX_TRIES; tries += 1) {
    if (trySwap(regions, rng)) {
      swaps += 1;
    }
  }
  return Object.freeze({
    regions: Object.freeze(relabel(regions)),
    extraUnits: Object.freeze([]),
  });
}
