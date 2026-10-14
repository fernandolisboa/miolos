import { deriveClues } from "@miolos/games/nonogram";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import { Board } from "../src/nonogram/board";
import styles from "../src/nonogram/nonogram-board.module.css";
import type { NonogramCellValue } from "../src/nonogram/state";
import { contrast } from "./contrast";
import { bodyOf, colorTokens, decl, stylesheet } from "./css-source";

const CLUES = deriveClues(
  ["##.#.", ".#...", "#####", ".....", "#.#.#"].map((row) =>
    [...row].map((ch) => ch === "#"),
  ),
);

const ENTRIES: readonly NonogramCellValue[] = [
  1,
  1,
  0,
  1,
  null,
  ...new Array<NonogramCellValue>(20).fill(null),
];

function renderBoard() {
  return render(
    <Board
      size={5}
      clues={CLUES}
      solution={null}
      entries={ENTRIES}
      selected={null}
      hintIndex={null}
      spotlight={[]}
      onSelect={vi.fn()}
      onMove={vi.fn()}
      onMarkCell={vi.fn()}
      onStrokeStart={vi.fn()}
      onEnterValue={vi.fn()}
      onClear={vi.fn()}
      onPaintOver={vi.fn()}
    />,
  );
}

function firstRow(container: HTMLElement) {
  const rail = container.querySelector<HTMLElement>("#nonogram-clue-row-0");
  if (rail === null) {
    throw new Error("no rail for row 1");
  }
  return { rail, numbers: [...rail.querySelectorAll("span")] };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("a clue number its marks already place is struck, and named done (T-WEB-S606)", () => {
  const runs = CLUES.rows[0] ?? [];
  const placedClass = styles.clueNumberPlaced ?? "";

  it("strikes a row whose marks are its clue, in the rail and in its label", () => {
    expect(runs).toEqual([2, 1]);
    const { rail, numbers } = firstRow(renderBoard().container);

    expect(numbers.map((number) => number.textContent)).toEqual(["2", "1"]);
    for (const number of numbers) {
      expect(number).toHaveClass(placedClass);
    }
    expect(rail.getAttribute("aria-label")).toContain("feito");
    expect(rail).toHaveAttribute(
      "aria-label",
      messages.games.nonogram.play.rowCluesAria(1, runs, [true, true]),
    );
  });

  it("strikes nothing when the setting is off", () => {
    window.localStorage.setItem(
      "miolos-settings",
      JSON.stringify({ games: { nonogram: { strikePlacedRuns: false } } }),
    );
    const { container } = renderBoard();
    const { rail } = firstRow(container);

    expect(container.querySelector(`.${placedClass}`)).toBeNull();
    expect(rail).toHaveAttribute(
      "aria-label",
      messages.games.nonogram.play.rowCluesAria(1, runs, [false, false]),
    );
  });

  it("never calls the empty line's 0 done", () => {
    expect(messages.games.nonogram.play.rowCluesAria(4, [], [true])).toBe(
      "números da linha 4: 0",
    );
    expect(
      messages.games.nonogram.play.columnCluesAria(2, [1, 2, 1], [true]),
    ).toBe("números da coluna 2: 1 feito, 2, 1");
  });
});

describe("the struck clue number reads in both themes and keeps its box (T-WEB-S607)", () => {
  const PLACED = bodyOf(
    stylesheet("src/nonogram/nonogram-board.module.css"),
    ".clueNumberPlaced",
  );

  it("is the second ink, struck through, and changes nothing that sizes the glyph", () => {
    expect(decl(PLACED, "color")).toBe("var(--ink-2)");
    expect(decl(PLACED, "text-decoration-line")).toBe("line-through");
    expect(PLACED).not.toMatch(
      /(?:^|[;\s])(?:font[\w-]*|padding[\w-]*|margin[\w-]*|width|letter-spacing)\s*:/,
    );
  });

  for (const theme of ["light", "dark"] as const) {
    it(`${theme}: --ink-2 clears 4.5:1 on the card paper`, () => {
      const tokens = colorTokens(theme);
      const ink = tokens.get("--ink-2");
      const paper = tokens.get("--paper-card");
      if (ink === undefined || paper === undefined) {
        throw new Error(`a token is missing in ${theme}`);
      }

      expect(contrast(ink, paper)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
