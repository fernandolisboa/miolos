import { describe, expect, it } from "vitest";

import {
  CONFUSABLE_TONE_PAIRS,
  coloredPool,
} from "../../src/colored-nonogram/pool";
import { solveColoredNonogram } from "../../src/colored-nonogram/solve";
import { COLORED_SIZES, poolIds, variantIds, variantPuzzle } from "./fixtures";

type Reason = "unsolvable" | "over 7 runs" | "column run of 10+" | "confusable";

const EXCLUDED: Readonly<
  Record<(typeof COLORED_SIZES)[number], Partial<Record<Reason, string[]>>>
> = {
  5: {
    unsolvable: ["heart", "kite", "kite~", "cherry", "cherry~"],
    confusable: [
      "arrow",
      "tree",
      "sailboat",
      "sailboat~",
      "hat",
      "umbrella",
      "umbrella~",
      "flag",
      "flag~",
      "apple",
      "bottle",
    ],
  },
  10: {
    unsolvable: [
      "bee",
      "hot-air-balloon",
      "television",
      "umbrella-open",
      "umbrella-open~",
      "fox",
      "rainbow",
      "lightning",
      "lightning~",
    ],
    "over 7 runs": ["lighthouse", "basket"],
    "column run of 10+": ["chess-pawn"],
    confusable: [
      "bridge",
      "pizza",
      "strawberry",
      "tulip",
      "mushroom-cap",
      "hen",
      "hen~",
      "cow",
      "bonfire",
    ],
  },
  15: {
    unsolvable: [
      "owl-big",
      "pineapple-big",
      "pineapple-big~",
      "anteater",
      "anteater~",
    ],
    "over 7 runs": [
      "sitting-cat",
      "sitting-cat~",
      "armadillo",
      "armadillo~",
      "caterpillar",
      "caterpillar~",
      "birthday-cake",
      "birthday-cake~",
      "caipirinha",
      "caipirinha~",
      "watermelon-whole",
    ],
    "column run of 10+": [
      "toucan",
      "toucan~",
      "flamingo",
      "flamingo~",
      "tropical-fish",
      "tropical-fish~",
      "butterfly-big",
      "rocket-big",
      "cactus-pot",
      "berimbau",
      "berimbau~",
      "big-kite",
      "big-kite~",
      "seahorse",
      "seahorse~",
    ],
    confusable: [
      "caravel",
      "caravel~",
      "big-tree",
      "sunflower-big",
      "sunflower-big~",
      "teapot-big",
      "teapot-big~",
      "robot",
      "hummingbird",
      "hummingbird~",
      "cuckoo-clock",
      "cuckoo-clock~",
      "house-big",
      "windmill",
      "island-palm",
      "island-palm~",
      "popsicle",
      "popsicle~",
      "straw-hat",
      "turtle-big",
      "turtle-big~",
    ],
  },
};

function firstBrokenRule(id: string): Reason | null {
  const { clues, solution } = variantPuzzle(id);
  if (solveColoredNonogram(clues)?.join() !== solution.join()) {
    return "unsolvable";
  }
  if ([...clues.rows, ...clues.cols].some((runs) => runs.length > 7)) {
    return "over 7 runs";
  }
  if (clues.cols.flat().some((run) => run.length >= 10)) {
    return "column run of 10+";
  }
  const tones = new Set(clues.palette);
  if (CONFUSABLE_TONE_PAIRS.some(([a, b]) => tones.has(a) && tones.has(b))) {
    return "confusable";
  }
  return null;
}

describe("coloredPool", () => {
  it("names the confusable tone pairs", () => {
    expect(CONFUSABLE_TONE_PAIRS.map((pair) => pair.join(""))).toEqual([
      "bp",
      "nr",
      "rd",
      "og",
      "rg",
      "nd",
      "ty",
      "lm",
    ]);
  });

  it("holds 34, 46 and 19 variants at 5, 10 and 15", () => {
    expect(COLORED_SIZES.map((size) => coloredPool(size).length)).toEqual([
      34, 46, 19,
    ]);
  });

  it("keeps only variants that line-solve to their tones within the run cap, the column rule and the pair table", () => {
    for (const id of COLORED_SIZES.flatMap(poolIds)) {
      expect(firstBrokenRule(id), id).toBeNull();
    }
  });

  it("excludes exactly the listed variants, each for its listed reason", () => {
    for (const size of COLORED_SIZES) {
      const kept = new Set(poolIds(size));
      const excluded = variantIds(size).filter((id) => !kept.has(id));
      const listed = Object.entries(EXCLUDED[size]);

      expect(excluded.sort()).toEqual(listed.flatMap(([, ids]) => ids).sort());
      for (const [reason, ids] of listed) {
        expect(ids.map(firstBrokenRule), reason).toEqual(ids.map(() => reason));
      }
    }
  });

  it("is built once per size", () => {
    expect(coloredPool(10)).toBe(coloredPool(10));
  });
});
