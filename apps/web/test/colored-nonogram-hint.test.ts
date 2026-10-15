import { generateColoredNonogram } from "@miolos/games/colored-nonogram";
import { PICTURE_TONES } from "@miolos/games/nonogram-colors";
import { describe, expect, it } from "vitest";

import { coloredCopy, toneName } from "../src/colored-nonogram/copy";
import {
  coloredHintExplanation,
  nextColoredHint,
} from "../src/colored-nonogram/hint";
import { messages } from "../src/i18n";

const PUZZLE = generateColoredNonogram(20_260_801, 10);
const { clues, solution } = PUZZLE;
const EMPTY: readonly (number | null)[] = solution.map(() => null);

describe("the coloured hint corrects a wrong tone first, then takes a logical step that names its tone (T-WEB-S872)", () => {
  it("corrects a cell painted in the wrong tone before anything else", () => {
    const painted = solution.findLastIndex((mark) => mark !== 0);
    const wrongTone = (solution[painted] ?? 1) === 1 ? 2 : 1;
    const entries = EMPTY.map((entry, at) =>
      at === painted ? wrongTone : entry,
    );

    const hint = nextColoredHint(clues, solution, entries);
    expect(hint).toMatchObject({
      index: painted,
      value: solution[painted],
      reason: { kind: "correction" },
    });
  });

  it("on an empty board, takes a logical step that paints a cell in its own tone", () => {
    const hint = nextColoredHint(clues, solution, EMPTY);
    expect(hint?.reason.kind).toBe("step");
    expect(hint?.value).toBeGreaterThan(0);
    expect(hint?.value).toBe(solution[hint?.index ?? -1]);
    expect(hint?.spotlight.length).toBe(clues.size);
  });

  it("walks the whole picture by logical steps alone, each one true", () => {
    let entries = [...EMPTY];
    for (let step = 0; step < solution.length; step += 1) {
      const hint = nextColoredHint(clues, solution, entries);
      if (hint === null) {
        break;
      }
      expect(hint.reason.kind).toBe("step");
      expect(hint.value).toBe(solution[hint.index]);
      entries = entries.map((entry, at) =>
        at === hint.index ? hint.value : entry,
      );
    }
    expect(entries).toEqual(solution);
  });

  it("names the tone of the cell and of every run in the sentence", () => {
    const hint = nextColoredHint(clues, solution, EMPTY);
    if (hint?.reason.kind !== "step") {
      throw new Error("an empty board has a logical first step");
    }
    const sentence = coloredHintExplanation(clues, hint.reason) ?? "";
    expect(sentence).toContain(
      coloredCopy.painted(toneName(clues.palette, hint.value)),
    );
    for (const run of hint.reason.step.runs) {
      expect(sentence).toContain(
        coloredCopy.run(run.length, toneName(clues.palette, run.tone)),
      );
    }
    expect(coloredHintExplanation(clues, { kind: "correction" })).toBe(
      messages.games.nonogram.play.hint.explain.correction,
    );
    expect(coloredHintExplanation(clues, null)).toBeNull();
  });

  it("names every tone of the palette in pt-BR", () => {
    for (const letter of PICTURE_TONES) {
      expect(coloredCopy.toneName(letter)).not.toBe(letter);
    }
  });
});
