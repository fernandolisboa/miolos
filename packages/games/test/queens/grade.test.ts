import { describe, expect, it } from "vitest";

import { gradeQueens } from "../../src/queens/index";
import { board, instrumentSolutions } from "./fixtures";

describe("gradeQueens", () => {
  it("finishes a board that single candidates alone solve, with no advanced step", () => {
    expect(gradeQueens(board("00012 00022 22222 32422 33332"))).toEqual({
      solved: true,
      maxTier: 1,
      advancedSteps: 0,
    });
  });

  it("needs one tier-2 step when region 3 confined to column 0 unlocks the rest", () => {
    const four = board("0011 0211 3221 3222");
    expect(instrumentSolutions(four)).toHaveLength(1);
    expect(gradeQueens(four)).toEqual({
      solved: true,
      maxTier: 2,
      advancedSteps: 1,
    });
  });

  it("needs a tier-3 step, two regions confined to two lines, among its advanced steps", () => {
    const five = board("00011 20031 22333 22234 22244");
    expect(instrumentSolutions(five)).toHaveLength(1);
    expect(gradeQueens(five)).toEqual({
      solved: true,
      maxTier: 3,
      advancedSteps: 5,
    });
  });

  it("stalls on a unique board beyond the ladder", () => {
    const five = board("00011 02211 00233 44233 42233");
    expect(instrumentSolutions(five)).toHaveLength(1);
    expect(gradeQueens(five).solved).toBe(false);
  });

  it("never finishes a board with no solution or with several", () => {
    expect(gradeQueens(board("1002 0000 3333 3333")).solved).toBe(false);
    expect(gradeQueens(board("0000 1111 2222 3333")).solved).toBe(false);
  });
});
