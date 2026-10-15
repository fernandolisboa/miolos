import { generateColoredNonogram } from "@miolos/games/colored-nonogram";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ColoredBoard } from "../src/colored-nonogram/board";
import styles from "../src/colored-nonogram/colored-board.module.css";
import { ColoredControls } from "../src/colored-nonogram/controls";
import { coloredCopy, toneName } from "../src/colored-nonogram/copy";
import {
  coloredNonogramReducer,
  initColoredNonogramState,
} from "../src/colored-nonogram/state";
import { messages } from "../src/i18n";
import { Controls } from "../src/nonogram/controls";
import boardStyles from "../src/nonogram/nonogram-board.module.css";
import { useNonogramControls } from "../src/nonogram/use-nonogram-controls";
import wrongMark from "../src/play/wrong-mark.module.css";
import { installPointerStubs } from "./pointer";

installPointerStubs();

const PUZZLE = generateColoredNonogram(20_260_801, 5);
const { clues, solution } = PUZZLE;
const SIZE = 5;

function Harness() {
  const [state, dispatch] = useReducer(
    coloredNonogramReducer,
    { date: "1970-01-01", size: SIZE, clues, solution },
    initColoredNonogramState,
  );
  const controls = useNonogramControls(state, dispatch);
  return (
    <>
      <button
        type="button"
        onClick={() => dispatch({ type: "set-tone", tone: 2 })}
      >
        tone 2
      </button>
      <button type="button" onClick={controls.revealHint}>
        hint
      </button>
      <ColoredBoard
        size={SIZE}
        clues={clues}
        solution={state.solution}
        entries={state.entries}
        selected={state.selected}
        hintIndex={state.hint.lastIndex}
        spotlight={state.hint.spotlight}
        onSelect={controls.selectCell}
        onMove={controls.moveSelection}
        onMarkCell={controls.markCell}
        onStrokeStart={controls.strokeStart}
        onEnterValue={controls.enterValue}
        onClear={controls.clearCell}
        onPaintOver={controls.paintOver}
      />
    </>
  );
}

function withSettings(nonogram: Record<string, boolean>) {
  window.localStorage.setItem(
    "miolos-settings",
    JSON.stringify({ games: { nonogram } }),
  );
}

function cellAt(index: number): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell ${String(index)}`);
  }
  return cell;
}

function letterOf(tone: number): string {
  return clues.palette[tone - 1] ?? "";
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("the coloured board: chips, names, errors, straight drag and keys (T-WEB-S873)", () => {
  it("puts every clue number on a chip in its tone, inked with that tone's label ink, and reads it by name", () => {
    render(<Harness />);
    clues.rows.forEach((runs, row) => {
      const rail = document.getElementById(`nonogram-clue-row-${String(row)}`);
      const named = runs.map((run) =>
        coloredCopy.run(run.length, toneName(clues.palette, run.tone)),
      );
      expect(rail?.getAttribute("aria-label")).toBe(
        messages.games.nonogram.play.rowCluesAria(row + 1, named, []),
      );
      const chips = [...(rail?.querySelectorAll<HTMLElement>("span") ?? [])];
      if (runs.length === 0) {
        expect(chips.map((chip) => chip.textContent)).toEqual(["0"]);
        return;
      }
      expect(chips.map((chip) => chip.textContent)).toEqual(
        runs.map((run) => String(run.length)),
      );
      chips.forEach((chip, at) => {
        const letter = letterOf(runs[at]?.tone ?? 0);
        expect(chip.className).toBe(styles.chip);
        expect(chip.style.background).toBe(`var(--tone-${letter})`);
        expect(chip.style.getPropertyValue("--cell-ink")).toBe(
          `var(--ink-on-tone-${letter})`,
        );
      });
    });
    expect(coloredCopy.run(2, "vermelho")).toBe("2 vermelho");
  });

  it("paints a tapped cell in the current tone and names it", () => {
    render(<Harness />);
    fireEvent.click(cellAt(0));
    const letter = letterOf(1);
    expect(cellAt(0).className).toContain(styles.cellTone);
    expect(cellAt(0).style.background).toBe(`var(--tone-${letter})`);
    expect(cellAt(0).getAttribute("aria-label")).toBe(
      coloredCopy.cellAria(1, 1, coloredCopy.toneName(letter)),
    );
  });

  it("Mostrar erros flags a cell painted in the wrong tone, and not one in its own", () => {
    withSettings({ showErrors: true });
    render(<Harness />);
    const painted = solution.findIndex((mark) => mark !== 0);
    const own = solution[painted] ?? 1;
    if (own !== 1) {
      fireEvent.click(cellAt(painted));
    } else {
      fireEvent.click(screen.getByRole("button", { name: "tone 2" }));
      fireEvent.click(cellAt(painted));
    }
    expect(
      cellAt(painted).querySelector(`.${wrongMark.mark ?? ""}`),
    ).not.toBeNull();
    expect(cellAt(painted).getAttribute("aria-label")).toContain(
      messages.play.wrongCell(""),
    );
  });

  it("holds a drag on its row when Arrastar só em linha reta is on", () => {
    withSettings({ straightDrag: true });
    const { container } = render(<Harness />);
    vi.spyOn(document, "elementFromPoint").mockImplementation((x, y) =>
      container.querySelector(
        `[data-cell-index="${String(Math.floor(y) * SIZE + Math.floor(x))}"]`,
      ),
    );
    const board = screen.getByRole("group", {
      name: messages.games.nonogram.play.boardAria(SIZE),
    });
    const at = (x: number, y: number) => ({
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      button: 0,
    });
    fireEvent.pointerDown(board, at(0.5, 0.5));
    fireEvent.pointerMove(board, at(1.5, 0.5));
    fireEvent.pointerMove(board, at(2.5, 1.4));
    fireEvent.pointerUp(board, at(2.5, 1.4));

    for (const index of [0, 1, 2]) {
      expect(cellAt(index).className).toContain(styles.cellTone);
    }
    expect(cellAt(7).className).not.toContain(styles.cellTone);
  });

  it("1 paints the current tone, 2 crosses and 0 clears", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "tone 2" }));
    const cell = cellAt(3);
    act(() => {
      cell.focus();
    });
    fireEvent.keyDown(cell, { key: "1" });
    expect(cellAt(3).style.background).toBe(`var(--tone-${letterOf(2)})`);
    fireEvent.keyDown(cellAt(3), { key: "2" });
    expect(cellAt(3).className).toContain(boardStyles.cellCrossed);
    fireEvent.keyDown(cellAt(3), { key: "0" });
    expect(cellAt(3).className).not.toContain(boardStyles.cellCrossed);
    expect(cellAt(3).className).not.toContain(styles.cellTone);
  });

  it("rings a hinted painted cell in its own ink", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "hint" }));
    const ringed = document.querySelectorAll(`.${styles.cellToneHinted ?? ""}`);
    expect(ringed).toHaveLength(1);
    expect(ringed[0]?.className).toContain(styles.cellTone);
  });
});

describe("the palette is ✕ then the puzzle's tones, each named and pressed by brush (T-WEB-S874)", () => {
  it("orders, names and presses the swatches, and reports the tone or ✕ it picks", () => {
    const onSetBrush = vi.fn();
    const onSetTone = vi.fn();
    const { rerender } = render(
      <ColoredControls
        palette={["r", "b", "y"]}
        brush="fill"
        tone={2}
        onSetBrush={onSetBrush}
        onSetTone={onSetTone}
      />,
    );
    const buttons = screen.getAllByRole("button");
    const swatches = buttons.filter((button) =>
      button.hasAttribute("aria-pressed"),
    );
    expect(swatches.map((button) => button.getAttribute("aria-label"))).toEqual(
      [
        messages.games.nonogram.play.controls.crossAria,
        "pintar de vermelho",
        "pintar de azul",
        "pintar de amarelo",
      ],
    );
    expect(
      swatches.map((button) => button.getAttribute("aria-pressed")),
    ).toEqual(["false", "false", "true", "false"]);

    fireEvent.click(swatches[3] ?? document.body);
    expect(onSetTone).toHaveBeenCalledWith(3);
    fireEvent.click(swatches[0] ?? document.body);
    expect(onSetBrush).toHaveBeenCalledWith("cross");

    rerender(
      <ColoredControls
        palette={["r", "b", "y"]}
        brush="cross"
        tone={2}
        onSetBrush={onSetBrush}
        onSetTone={onSetTone}
      />,
    );
    expect(
      screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-pressed") === "true")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([messages.games.nonogram.play.controls.crossAria]);
  });

  it("narrows on a phone past two segments and everywhere past four; mono keeps its two", () => {
    const toggle = (palette: readonly string[]) => {
      const { container, unmount } = render(
        <ColoredControls
          palette={palette}
          brush="fill"
          tone={1}
          onSetBrush={vi.fn()}
          onSetTone={vi.fn()}
        />,
      );
      const className =
        container.querySelector("button")?.parentElement?.className;
      unmount();
      return className ?? "";
    };
    expect(toggle(["r", "b"])).toContain(boardStyles.brushToggleNarrow);
    expect(toggle(["r", "b", "y", "k", "s"])).toContain(
      boardStyles.brushToggleCompact,
    );

    const { container } = render(
      <Controls brush="fill" onSetBrush={vi.fn()} />,
    );
    const pressed = container.querySelectorAll("button[aria-pressed]");
    expect(
      [...pressed].map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      messages.games.nonogram.play.controls.crossAria,
      messages.games.nonogram.play.controls.fillAria,
    ]);
    expect(pressed[0]?.parentElement?.className).toBe(boardStyles.brushToggle);
  });
});
