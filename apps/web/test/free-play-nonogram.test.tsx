/**
 * The free-play Nonogram screen (#28): the zero-fetch solve whose payoff
 * is the painted picture and NEVER the curated name (plan 025 §6.4,
 * ADR-0033's copy rule), and the level-switch remount (T-WEB-S121).
 *
 * The solve's inputs are derived from the generator's own
 * `reveal.solution` — the `boolean[][]` grid — but `reveal` never enters
 * the hook (the state's solution is clue-derived via `solutionMarks`);
 * here it is only the test's answer key, determinism being the proved
 * engine invariant (ADR-0023).
 */
import { generateNonogram } from "@miolos/games/nonogram";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LEVEL_WEEKDAYS } from "../src/free-play/catalog";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { messages } from "../src/i18n";
import boardStyles from "../src/nonogram/nonogram-board.module.css";

const SEED = 20_260_812;
const LEVE_PUZZLE = generateNonogram(SEED, LEVEL_WEEKDAYS.leve);

function stableDeps(seeds: readonly number[]) {
  const queue = [...seeds];
  return {
    pickSeed: () => {
      const seed = queue.shift();
      if (seed === undefined) {
        throw new Error("the test drew more seeds than it pinned");
      }
      return seed;
    },
  };
}

function cells(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("[data-cell-index]")];
}

function cellAt(container: HTMLElement, index: number): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-cell-index="${index}"]`);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("free-play Nonogram zero-fetch solve and the nameless picture (T-WEB-S120)", () => {
  it("paints the picture from the clues alone and shows it unnamed on the solved card", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(
      // Two draws: the default Médio mount, then the switch to Leve.
      <NonogramFreeScreen deps={stableDeps([SEED, SEED])} />,
    );

    fireEvent.click(
      screen.getByRole("radio", { name: messages.freePlay.level.aria("Leve") }),
    );

    // The answer key: reveal.solution's boolean[][] converted to the flat
    // fill set. The fill brush is the default, so one click paints a cell.
    const size = LEVE_PUZZLE.size;
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        if (LEVE_PUZZLE.reveal.solution[row]?.[column] !== true) {
          continue;
        }
        const cell = cellAt(container, row * size + column);
        if (cell === null) {
          break; // solved — the swap took the board with it
        }
        fireEvent.click(cell);
      }
    }

    // The solved card: the painted picture, by its composed accessible
    // name...
    expect(
      screen.getByText(messages.freePlay.solved.stamp),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: messages.freePlay.solved.pictureAria,
      }),
    ).toBeInTheDocument();

    // ...and NEVER the curated name or id, anywhere in the document.
    expect(document.body.textContent).not.toContain(LEVE_PUZZLE.reveal.name);
    expect(document.body.textContent).not.toContain(LEVE_PUZZLE.reveal.motifId);
    expect(document.body.innerHTML).not.toContain(LEVE_PUZZLE.reveal.name);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("control: the fixture's reveal actually carries a name to leak", () => {
    // The not.toContain pair above is vacuous against an empty name.
    expect(LEVE_PUZZLE.reveal.name.length).toBeGreaterThan(0);
    expect(LEVE_PUZZLE.reveal.motifId.length).toBeGreaterThan(0);
  });
});

describe("level switch remounts the board (T-WEB-S121)", () => {
  it("resets the entries and regenerates at LEVEL_WEEKDAYS[level]'s size", () => {
    vi.stubGlobal("fetch", vi.fn());
    const seeds = [SEED, SEED + 1, SEED + 2];
    const { container } = render(
      <NonogramFreeScreen deps={stableDeps(seeds)} />,
    );

    // Médio (the default) is the weekday-4 class: a 10×10 board.
    const medio = generateNonogram(SEED, LEVEL_WEEKDAYS.medio);
    expect(medio.size).toBe(10);
    expect(cells(container)).toHaveLength(100);

    // An entry, then a switch: the new board must not carry it.
    const first = cellAt(container, 0);
    expect(first).not.toBeNull();
    if (first !== null) {
      fireEvent.click(first);
      expect(first.className).toContain(boardStyles.cellFilled);
    }

    fireEvent.click(
      screen.getByRole("radio", { name: messages.freePlay.level.aria("Leve") }),
    );
    const leve = generateNonogram(SEED + 1, LEVEL_WEEKDAYS.leve);
    expect(leve.size).toBe(5);
    expect(cells(container)).toHaveLength(25);
    // Fresh state: nothing filled on the remounted board.
    for (const cell of cells(container)) {
      expect(cell.className).not.toContain(boardStyles.cellFilled);
    }

    fireEvent.click(
      screen.getByRole("radio", {
        name: messages.freePlay.level.aria("Difícil"),
      }),
    );
    const dificil = generateNonogram(SEED + 2, LEVEL_WEEKDAYS.dificil);
    expect(dificil.size).toBe(15);
    expect(cells(container)).toHaveLength(225);
  });
});
