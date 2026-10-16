import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { evaluateGuess } from "../../src/termo/evaluate";
import { deriveBoardStatus } from "../../src/termo/status";
import { judgeBoards } from "../../src/termo/judge-boards";
import { TERMO_VARIANTS } from "../../src/termo/variants";
import { TERMO_VALIDATION_WORDS } from "../../src/termo/word-list";
import { propertyRuns } from "../property-runs";

const WORDS = TERMO_VALIDATION_WORDS.slice(0, 400);

const word = fc.constantFrom(...WORDS);

describe("the Termo variants", () => {
  it("are Clássico 1 × 6, Dueto 2 × 7 and Quarteto 4 × 9", () => {
    expect(TERMO_VARIANTS).toEqual({
      classico: { boards: 1, maxGuesses: 6 },
      dueto: { boards: 2, maxGuesses: 7 },
      quarteto: { boards: 4, maxGuesses: 9 },
    });
  });
});

describe("judgeBoards", () => {
  it("stops a board's rows at the guess that finds its word", () => {
    const [a = "", b = "", c = ""] = WORDS;
    const { boards, status } = judgeBoards([a, b, c], [b, "zurro"], 7);

    expect(boards[0]?.rows).toEqual([
      { guess: a, tiles: evaluateGuess(a, b) },
      { guess: b, tiles: evaluateGuess(b, b) },
    ]);
    expect(boards[0]?.status).toBe("won");
    expect(boards[1]?.rows.map((row) => row.guess)).toEqual([a, b, c]);
    expect(boards[1]?.status).toBe("playing");
    expect(status).toBe("playing");
  });

  it("finds an accented word from its plain spelling", () => {
    expect(judgeBoards(["abaco"], ["ábaco"], 6).status).toBe("won");
  });

  it("is won only when every word is found, lost when the guesses run out first", () => {
    const [a = "", b = "", c = ""] = WORDS;
    expect(judgeBoards([a, b], [b, a], 7).status).toBe("won");
    const lost = judgeBoards([a, c, c], [a, b], 3);
    expect(lost.status).toBe("lost");
    expect(lost.boards.map((board) => board.status)).toEqual(["won", "lost"]);
  });

  it("refuses more guesses than the variant allows", () => {
    const [a = "", b = ""] = WORDS;
    expect(() => judgeBoards([a, a, a], [b], 2)).toThrow(RangeError);
  });

  it("agrees with one board's status and is deterministic (property)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 6, max: 9 }),
        fc.array(word, { minLength: 4, maxLength: 4 }),
        fc.array(word, { minLength: 0, maxLength: 9 }),
        (count, maxGuesses, pool, raw) => {
          const answers = pool.slice(0, count);
          const guesses = raw.slice(0, maxGuesses);
          const firstWin = Math.max(
            ...answers.map((answer) => guesses.indexOf(answer)),
          );
          const played = answers.every((answer) => guesses.includes(answer))
            ? guesses.slice(0, firstWin + 1)
            : guesses;
          const judged = judgeBoards(played, answers, maxGuesses);

          expect(judgeBoards(played, answers, maxGuesses)).toEqual(judged);
          judged.boards.forEach((board, index) => {
            const answer = answers[index] ?? "";
            const found = played.indexOf(answer);
            expect(board.rows).toHaveLength(
              found === -1 ? played.length : found + 1,
            );
            expect(board.status).toBe(
              deriveBoardStatus(
                board.rows.map((row) => row.tiles),
                maxGuesses,
              ),
            );
          });
          const won = answers.every((answer) => played.includes(answer));
          expect(judged.status).toBe(
            won ? "won" : played.length === maxGuesses ? "lost" : "playing",
          );
        },
      ),
      { numRuns: propertyRuns(2000) },
    );
  });
});
