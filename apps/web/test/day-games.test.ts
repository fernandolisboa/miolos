import { GAMES } from "@miolos/core";
import { describe, expect, it } from "vitest";

import { DAY_GAMES } from "../src/play/day-games";

describe("DAY_GAMES is the hub's one ordering, a permutation of @miolos/core's GAMES (T-WEB-S417)", () => {
  it("carries exactly the same games as GAMES, in some order", () => {
    expect([...DAY_GAMES].sort()).toEqual([...GAMES].sort());
  });

  it("puts the Cruzadinha second, beside Termo — the two word games together", () => {
    expect(DAY_GAMES).toEqual([
      "termo",
      "crossword",
      "sudoku",
      "nonogram",
      "binairo",
    ]);
  });
});
