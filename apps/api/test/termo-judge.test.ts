import { MAX_GUESSES } from "@miolos/games/termo";
import { describe, expect, it } from "vitest";

import { judgeGuessList } from "../src/termo/judge";

/**
 * Unit tests for the ONE Termo judging ladder (#27 step-7 finding A-2).
 *
 * The route-level behaviour is pinned from both sides — `T-API-S38`/`S42` on
 * `POST /termo/guess`, `T-API-S39`/`S43` on `POST /completions`. What those
 * cannot reach is the ladder's own preconditions, because both routes cap the
 * list at six through zod before calling. This file exercises the function
 * directly, which is the only way to prove that a THIRD caller — or a relaxed
 * `.max()` — gets a `null` rather than the 500 an uncaught `RangeError` in a
 * route handler becomes.
 */
describe("judgeGuessList — the shared Termo ladder's own gates", () => {
  const ANSWER = "sinal";

  it("T-API-S45: refuses an over-length list instead of letting deriveBoardStatus throw", () => {
    // `deriveBoardStatus` throws a RangeError on `rows.length > MAX_GUESSES`
    // (packages/games/src/termo/status.ts) just as it does on a row after a
    // win. An earlier draft of the hoist guarded only the second, which was
    // safe ONLY by a precondition living in the two callers — the exact thing
    // one shared judge exists to end (#27 round-2 finding G-1).
    const overLong = Array.from({ length: MAX_GUESSES + 1 }, () => "cacau");

    expect(() => judgeGuessList(overLong, ANSWER)).not.toThrow();
    expect(judgeGuessList(overLong, ANSWER)).toBeNull();

    // Anti-vacuity: exactly at the bound it still judges, so the guard is a
    // boundary and not a blanket refusal.
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
    // Finding A-1: gating on the accumulated list soft-locks a board across an
    // independent `apps/web` deploy. The judge therefore never consults the
    // dictionary; `POST /termo/guess` checks the newest guess only.
    const judged = judgeGuessList(["zzzzz", "cacau"], ANSWER);

    expect(judged).not.toBeNull();
    expect(judged?.status).toBe("playing");
    expect(judged?.tiles).toHaveLength(2);
  });
});
