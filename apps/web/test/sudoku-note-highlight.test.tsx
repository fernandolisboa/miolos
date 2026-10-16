import { CLASSIC_LAYOUT } from "@miolos/games/sudoku";
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { NO_MISTAKES } from "../src/play/mistakes";
import { readSettings, writeSettings } from "../src/settings/settings";
import { Board } from "../src/sudoku/board";
import { NO_NOTES, toggleNote } from "../src/sudoku/notes";
import type { SudokuDigit } from "../src/sudoku/state";
import styles from "../src/sudoku/sudoku-board.module.css";

const BLANK: readonly number[] = Array.from({ length: 81 }, () => 0);
const NOOP = () => undefined;
const SELECTED = 0;
const GIVEN_FIVE = 0;
const NOTED = 80;

function renderBoard({
  locked = null,
  selected = SELECTED,
  spotlight = [],
}: {
  readonly locked?: SudokuDigit | null;
  readonly selected?: number | null;
  readonly spotlight?: readonly number[];
}) {
  const givens = BLANK.map((_, index) => (index === GIVEN_FIVE ? 5 : 0));
  const notes = toggleNote(toggleNote(NO_NOTES, NOTED, 5), NOTED, 2);
  return render(
    <Board
      layout={CLASSIC_LAYOUT}
      givens={givens}
      solution={null}
      mistakes={NO_MISTAKES}
      entries={BLANK.map(() => null)}
      notes={notes}
      selected={selected}
      locked={locked}
      violating={new Set()}
      hintIndex={null}
      spotlight={spotlight}
      onSelect={NOOP}
      onMove={NOOP}
      onDigit={NOOP}
      onNote={NOOP}
      onToggleNoting={NOOP}
      onClear={NOOP}
      onTapCell={NOOP}
    />,
  ).container;
}

function cellAt(container: HTMLElement, index: number): HTMLElement {
  const found = container.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (found === null) {
    throw new Error(`no cell at ${String(index)}`);
  }
  return found;
}

const NOTE_DIGIT = styles.cellNoteDigit ?? "";
const NOTE_MATCH = styles.noteMatch ?? "";

const matches = (container: HTMLElement) =>
  [...cellAt(container, NOTED).querySelectorAll(`.${NOTE_MATCH}`)].map(
    (slot) => slot.textContent,
  );

describe("the board draws the note highlight on the cell and its digit (T-WEB-S933)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("tints the noted cell lighter than a copy and marks only the matching note", () => {
    expect(NOTE_DIGIT).not.toBe("");
    expect(NOTE_MATCH).not.toBe("");
    const container = renderBoard({});
    const noted = cellAt(container, NOTED);
    expect(noted.className).toContain(NOTE_DIGIT);
    expect(noted.className).not.toContain(styles.cellSameDigit ?? "-");
    expect(matches(container)).toEqual(["5"]);
  });

  it("follows the fixed digit with no digit selected", () => {
    const container = renderBoard({ locked: 2, selected: null });
    expect(cellAt(container, NOTED).className).toContain(NOTE_DIGIT);
    expect(matches(container)).toEqual(["2"]);
  });

  it("gives way to the hint spotlight", () => {
    const container = renderBoard({ spotlight: [1, 2] });
    expect(cellAt(container, NOTED).className).not.toContain(NOTE_DIGIT);
    expect(matches(container)).toEqual([]);
  });

  it("is off with Destacar linha, coluna e bloco", () => {
    const current = readSettings();
    writeSettings({
      ...current,
      games: {
        ...current.games,
        sudoku: { ...current.games.sudoku, highlightSelection: false },
      },
    });
    const container = renderBoard({});
    expect(cellAt(container, NOTED).className).not.toContain(NOTE_DIGIT);
    expect(matches(container)).toEqual([]);
  });
});
