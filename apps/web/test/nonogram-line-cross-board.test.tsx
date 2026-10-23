import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
} from "@miolos/core";
import {
  coloredRuns,
  type ColoredNonogramClues,
} from "@miolos/games/colored-nonogram";
import { deriveClues, lineCells } from "@miolos/games/nonogram";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GamesSection } from "../app/ajustes/games-section";
import { ColoredBoard } from "../src/colored-nonogram/board";
import choiceStyles from "../src/components/choice.module.css";
import { messages } from "../src/i18n";
import { NonogramScreen } from "../src/nonogram/nonogram-screen";
import { NO_MISTAKES } from "../src/play/mistakes";
import wrongMark from "../src/play/wrong-mark.module.css";
import type { LineCross } from "../src/settings/settings";
import { installPointerStubs } from "./pointer";
import { openTab } from "./open-tab";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn((record?: unknown) => Promise.resolve(record)),
}));
vi.mock("../src/play/sync", () => sync);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/nonogram",
}));

installPointerStubs();

const copy = messages.settings.games;

const DAILY: DailyNonogramResponse = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: "2026-10-18",
  size: 5,
  clues: deriveClues(
    [".###.", "##.##", "#####", "#...#", "##.##"].map((row) =>
      [...row].map((cell) => cell === "#"),
    ),
  ),
});

function withLineCross(lineCross: LineCross): void {
  localStorage.setItem(
    "miolos-settings",
    JSON.stringify({ games: { nonogram: { lineCross } } }),
  );
}

function cellAt(index: number): HTMLElement {
  const cell = document.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at ${String(index)}`);
  }
  return cell;
}

function flagged(cells: readonly number[]): boolean[] {
  return cells.map(
    (index) => cellAt(index).querySelector(`.${wrongMark.mark ?? ""}`) !== null,
  );
}

function crossed(cells: readonly number[]): boolean[] {
  return cells.map((index) =>
    (cellAt(index).getAttribute("aria-label") ?? "").includes(
      messages.games.nonogram.play.cellAria(1, (index % 5) + 1, 0),
    ),
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Marcar ✕ ao completar a linha is a four-way choice in Ajustes (T-WEB-S977)", () => {
  it("offers Sempre, Sempre e mostrar o erro, Só se estiver certa and Desligado under Nonogram, Sempre checked", () => {
    render(<GamesSection />);
    openTab("Nonogram");
    const nonogram = screen.getByRole("group", { name: "Nonogram" });
    const choice = within(nonogram).getByRole("radiogroup", {
      name: copy.flags.lineCross.label,
    });

    expect(choice).toHaveAccessibleDescription(copy.flags.lineCross.hint);
    expect(
      within(choice)
        .getAllByRole("radio")
        .map((radio) => radio.parentElement?.textContent),
    ).toEqual([
      copy.lineCross.always,
      copy.lineCross.flag,
      copy.lineCross.correct,
      copy.lineCross.off,
    ]);
    expect(
      within(choice).getByRole("radio", { name: copy.lineCross.always }),
    ).toBeChecked();
    expect(choice.parentElement).toHaveClass(choiceStyles.stacked ?? "");
  });

  it("saves the choice on this device and a mounted board follows it", () => {
    render(
      <>
        <NonogramScreen daily={DAILY} />
        <GamesSection />
      </>,
    );
    openTab("Nonogram");
    fireEvent.click(screen.getByRole("radio", { name: copy.lineCross.off }));
    expect(
      JSON.parse(localStorage.getItem("miolos-settings") ?? "{}"),
    ).toMatchObject({ games: { nonogram: { lineCross: "off" } } });

    for (const index of [1, 2, 3]) {
      fireEvent.click(cellAt(index));
    }
    expect(crossed([0, 4])).toEqual([false, false]);

    fireEvent.click(screen.getByRole("radio", { name: copy.lineCross.always }));
    fireEvent.click(cellAt(2));
    fireEvent.click(cellAt(2));
    expect(crossed([0, 4])).toEqual([true, true]);
  });
});

describe("Sempre e mostrar o erro flags the wrong cells of a formed line (T-WEB-S978)", () => {
  it("on the Clássico board, only inside lines that form their clue", () => {
    withLineCross("flag");
    render(<NonogramScreen daily={DAILY} />);
    for (const index of [0, 1, 2, 7]) {
      fireEvent.click(cellAt(index));
    }
    expect(flagged([0, 1, 2, 3, 7])).toEqual([true, false, false, true, false]);
  });

  it("never under Sempre", () => {
    withLineCross("always");
    render(<NonogramScreen daily={DAILY} />);
    for (const index of [0, 1, 2]) {
      fireEvent.click(cellAt(index));
    }
    expect(flagged([0, 3])).toEqual([false, false]);
  });

  it("on the Cores board, by tone", () => {
    const tones = [
      [0, 1, 1, 2, 0],
      [1, 1, 0, 2, 2],
      [1, 0, 0, 0, 2],
      [1, 1, 1, 2, 2],
      [0, 0, 1, 0, 0],
    ].flat();
    const runs = lineCells(5).map(({ cells }) =>
      coloredRuns(cells.map((cell) => tones[cell] ?? 0)),
    );
    const clues: ColoredNonogramClues = {
      size: 5,
      palette: ["r", "b"],
      rows: runs.slice(0, 5),
      cols: runs.slice(5),
    };
    const entries = tones.map((_, at) =>
      at === 0 || at === 1 ? 1 : at === 2 ? 2 : null,
    );
    const noop = () => undefined;
    const board = (
      <ColoredBoard
        size={5}
        clues={clues}
        solution={tones}
        entries={entries}
        mistakes={NO_MISTAKES}
        selected={null}
        hintIndex={null}
        spotlight={[]}
        onSelect={noop}
        onMove={noop}
        onMarkCell={noop}
        onStrokeStart={noop}
        onEnterValue={noop}
        onClear={noop}
        onPaintOver={noop}
      />
    );

    withLineCross("flag");
    const { unmount } = render(board);
    expect(flagged([0, 1, 2])).toEqual([true, false, true]);
    unmount();

    withLineCross("always");
    render(board);
    expect(flagged([0, 1, 2])).toEqual([false, false, false]);
  });
});
