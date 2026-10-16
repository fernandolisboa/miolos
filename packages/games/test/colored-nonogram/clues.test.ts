import { describe, expect, it } from "vitest";

import { deriveColoredClues } from "../../src/colored-nonogram/clues";

describe("deriveColoredClues", () => {
  it("same-tone runs keep a gap, different tones touch", () => {
    const tones = ["bb.b", "rbb.", "...r", "r..r"].join("");

    expect(deriveColoredClues(4, tones)).toEqual({
      size: 4,
      palette: ["r", "b"],
      rows: [
        [
          { tone: 2, length: 2 },
          { tone: 2, length: 1 },
        ],
        [
          { tone: 1, length: 1 },
          { tone: 2, length: 2 },
        ],
        [{ tone: 1, length: 1 }],
        [
          { tone: 1, length: 1 },
          { tone: 1, length: 1 },
        ],
      ],
      cols: [
        [
          { tone: 2, length: 1 },
          { tone: 1, length: 1 },
          { tone: 1, length: 1 },
        ],
        [{ tone: 2, length: 2 }],
        [{ tone: 2, length: 1 }],
        [
          { tone: 2, length: 1 },
          { tone: 1, length: 2 },
        ],
      ],
    });
  });
});
