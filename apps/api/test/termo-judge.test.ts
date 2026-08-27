import { MAX_GUESSES } from "@miolos/games/termo";
import { describe, expect, it } from "vitest";

import { judgeGuessList } from "../src/termo/judge";

describe("judgeGuessList — the shared Termo ladder's own gates", () => {
  const ANSWER = "sinal";

  it("T-API-S45: refuses an over-length list instead of letting deriveBoardStatus throw", () => {
    const overLong = Array.from({ length: MAX_GUESSES + 1 }, () => "cacau");

    expect(() => judgeGuessList(overLong, ANSWER)).not.toThrow();
    expect(judgeGuessList(overLong, ANSWER)).toBeNull();

    const atBound = Array.from({ length: MAX_GUESSES }, () => "cacau");
    expect(judgeGuessList(atBound, ANSWER)?.status).toBe("lost");
  });

  it("T-API-S45: refuses a row that follows a winning row, and accepts a win in the last row", () => {
    expect(judgeGuessList([ANSWER, "cacau"], ANSWER)).toBeNull();
    expect(judgeGuessList([ANSWER, ANSWER], ANSWER)).toBeNull();

    expect(judgeGuessList(["cacau", ANSWER], ANSWER)?.status).toBe("won");
    expect(judgeGuessList([ANSWER], ANSWER)?.status).toBe("won");
  });

  it("T-API-S45: judges a non-word row rather than refusing it — the dictionary gate is not here", () => {
    const judged = judgeGuessList(["zzzzz", "cacau"], ANSWER);

    expect(judged).not.toBeNull();
    expect(judged?.status).toBe("playing");
    expect(judged?.tiles).toHaveLength(2);
  });
});
