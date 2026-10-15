import { normalizeWord } from "@miolos/games";
import { MAX_GUESSES, TERMO_VALIDATION_WORDS } from "@miolos/games/termo";
import { drawFreeTermoWord } from "@miolos/games/termo-free";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ArchiveScreen } from "../src/archive/archive-screen";
import { Board as CrosswordBoard } from "../src/crossword/board";
import { TermoFreeScreen } from "../src/free-play/termo-free-screen";
import { messages } from "../src/i18n";
import { DailyScreen } from "../src/play/daily-screen";
import type { PlayCore } from "../src/play/types";
import { readSettings, writeSettings } from "../src/settings/settings";
import { bodyOf, decl, stylesheet } from "./css-source";
import { flushGeneration } from "./free-generation";
import { parseCss, uncoveredSelectors } from "./reduced-motion";

vi.mock("../src/play/sync", () => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));

vi.mock("../src/play/conclusion-lazy", () => ({
  ConclusionView: () => <div data-testid="result" />,
  RemoteConclusionView: () => <div data-testid="remote" />,
  preloadConclusionView: vi.fn(),
}));

const DATE = "2026-07-30";

const OPEN: PlayCore = {
  date: DATE,
  timer: { accumulatedMs: 5_000, runningSince: 8_000 },
  status: "playing",
  pendingSync: false,
  now: 9_000,
  hydrated: true,
};
const SOLVED: PlayCore = {
  ...OPEN,
  timer: { accumulatedMs: 6_000, runningSince: null },
  status: "solved",
};
const LOST: PlayCore = { ...SOLVED, status: "lost" };

function Board() {
  return (
    <div data-testid="board">
      {[0, 1, 2, 3].map((index) => (
        <button
          key={index}
          type="button"
          data-cell-index={index}
          data-x={(index % 2) * 40}
          data-y={Math.floor(index / 2) * 40}
          tabIndex={index === 1 ? 0 : -1}
        />
      ))}
      <button type="button" data-testid="key" />
    </div>
  );
}

const daily = (state: PlayCore) => (
  <DailyScreen
    game="sudoku"
    claim={undefined}
    state={state}
    skeleton={<div data-testid="skeleton" />}
    view={<Board />}
    result={{ elapsedMs: 6_000, hintsUsed: 0 }}
  />
);

const archive = (state: PlayCore) => (
  <ArchiveScreen
    game="sudoku"
    state={state}
    skeleton={<div data-testid="skeleton" />}
    view={<Board />}
  />
);

function allowMotion(reduce = false) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: reduce })),
  );
}

function cell(index: number): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (found === null) {
    throw new Error(`no cell ${String(index)}`);
  }
  return found;
}

function delayOf(index: number): string {
  return cell(index).style.getPropertyValue("--wave-delay");
}

function solveFromOpen(screenAt: (state: PlayCore) => ReactElement) {
  const view = render(screenAt(OPEN));
  view.rerender(screenAt(SOLVED));
}

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    function (this: Element) {
      const x = Number(this.getAttribute("data-x") ?? 0);
      const y = Number(this.getAttribute("data-y") ?? 0);
      return DOMRect.fromRect({ x, y, width: 40, height: 40 });
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("the result waits for nothing when the glow cannot run (T-WEB-S760)", () => {
  it("swaps at once without matchMedia, as on the server and in jsdom", () => {
    solveFromOpen(daily);
    expect(screen.getByTestId("result")).toBeInTheDocument();
    expect(screen.queryByTestId("board")).toBeNull();
  });

  it("swaps at once under reduced motion", () => {
    allowMotion(true);
    solveFromOpen(daily);
    expect(screen.getByTestId("result")).toBeInTheDocument();
  });

  it("swaps at once when the player turned the animation off", () => {
    allowMotion();
    writeSettings({ ...readSettings(), endAnimation: false });
    solveFromOpen(daily);
    expect(screen.getByTestId("result")).toBeInTheDocument();
  });

  it("swaps at once on a loss, and on a revisit", () => {
    allowMotion();
    const lost = render(daily(OPEN));
    lost.rerender(daily(LOST));
    expect(screen.getByTestId("result")).toBeInTheDocument();
    lost.unmount();

    render(daily(SOLVED));
    expect(screen.getByTestId("result")).toBeInTheDocument();
  });
});

describe("a win that just ended glows across the same board first (T-WEB-S761)", () => {
  it("keeps the board node, locks it, and shows the result after the farthest cell", () => {
    allowMotion();
    const view = render(daily(OPEN));
    const board = screen.getByTestId("board");
    fireEvent.pointerDown(cell(3));
    view.rerender(daily(SOLVED));

    expect(screen.getByTestId("board")).toBe(board);
    expect(screen.queryByTestId("result")).toBeNull();
    expect(board.parentElement).toHaveAttribute("inert");
    expect(delayOf(3)).toBe("0ms");
    expect(delayOf(0)).toBe("700ms");
    expect(delayOf(1)).toBe(delayOf(2));

    fireEvent.animationEnd(cell(1));
    expect(screen.queryByTestId("result")).toBeNull();
    fireEvent.animationEnd(cell(0));
    expect(screen.getByTestId("result")).toBeInTheDocument();
  });

  it("does the same on an archive day", () => {
    allowMotion();
    const view = render(archive(OPEN));
    const board = screen.getByTestId("board");
    view.rerender(archive(SOLVED));

    expect(screen.getByTestId("board")).toBe(board);
    fireEvent.animationEnd(cell(3));
    expect(screen.queryByTestId("board")).toBeNull();
  });

  it("still shows the result if no animation ever ends", () => {
    vi.useFakeTimers();
    allowMotion();
    solveFromOpen(daily);
    expect(screen.queryByTestId("result")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByTestId("result")).toBeInTheDocument();
  });
});

describe("the glow starts from the cell the player touched last (T-WEB-S762)", () => {
  it("takes the selected cell when the last press was a key outside the grid", () => {
    allowMotion();
    const view = render(daily(OPEN));
    fireEvent.pointerDown(cell(3));
    fireEvent.pointerDown(screen.getByTestId("key"));
    view.rerender(daily(SOLVED));

    expect(delayOf(1)).toBe("0ms");
    expect(delayOf(2)).toBe("700ms");
  });

  it("takes the selected cell after a physical key", () => {
    allowMotion();
    const view = render(daily(OPEN));
    fireEvent.keyDown(cell(1), { key: "5" });
    view.rerender(daily(SOLVED));

    expect(delayOf(1)).toBe("0ms");
  });

  it("follows a drag to the last cell painted", () => {
    allowMotion();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => cell(0),
    });
    const view = render(daily(OPEN));
    fireEvent.pointerDown(cell(3));
    fireEvent.pointerMove(cell(3), { buttons: 1 });
    view.rerender(daily(SOLVED));
    Reflect.deleteProperty(document, "elementFromPoint");

    expect(delayOf(0)).toBe("0ms");
    expect(delayOf(3)).toBe("700ms");
  });

  it("ignores a hover with no button down", () => {
    allowMotion();
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => cell(0),
    });
    const view = render(daily(OPEN));
    fireEvent.pointerDown(cell(3));
    fireEvent.pointerMove(cell(3), { buttons: 0 });
    view.rerender(daily(SOLVED));
    Reflect.deleteProperty(document, "elementFromPoint");

    expect(delayOf(3)).toBe("0ms");
  });

  it("never waits on a Cruzadinha black square", () => {
    allowMotion();
    const blocked = (state: PlayCore) => (
      <DailyScreen
        game="crossword"
        claim={undefined}
        state={state}
        skeleton={<div data-testid="skeleton" />}
        view={
          <div data-testid="board">
            <button type="button" data-cell-index={0} data-x={0} />
            <button type="button" data-cell-index={1} data-x={40} />
            <button type="button" data-cell-index={2} data-x={400} data-block />
          </div>
        }
        result={{ elapsedMs: 6_000, hintsUsed: 0 }}
      />
    );
    const view = render(blocked(OPEN));
    fireEvent.pointerDown(cell(0));
    view.rerender(blocked(SOLVED));

    expect(delayOf(2)).toBe("");
    expect(delayOf(1)).toBe("700ms");
    fireEvent.animationEnd(cell(1));
    expect(screen.getByTestId("result")).toBeInTheDocument();
  });

  it("starts from the middle when nothing was touched", () => {
    allowMotion();
    solveFromOpen(daily);

    expect(new Set([0, 1, 2, 3].map(delayOf))).toEqual(new Set(["700ms"]));
  });
});

const SEED = 20_261_015;
const WORD = drawFreeTermoWord(SEED);
const MISSES = TERMO_VALIDATION_WORDS.filter(
  (word) => word !== normalizeWord(WORD),
).slice(0, MAX_GUESSES);
const [MISS = ""] = MISSES;

async function guess(word: string): Promise<void> {
  for (const letter of normalizeWord(word)) {
    fireEvent.keyDown(document.body, { key: letter });
  }
  await act(async () => {
    fireEvent.keyDown(document.body, { key: "Enter" });
    await Promise.resolve();
  });
}

describe("free play glows on a win and goes straight to the card on a loss (T-WEB-S763)", () => {
  it("keeps the free Termo board after a win, from the last tile of the winning row", async () => {
    allowMotion();
    render(<TermoFreeScreen deps={{ pickSeed: () => SEED }} />);
    await flushGeneration();
    await guess(MISS);
    const board = screen.getByRole("group", {
      name: messages.games.termo.play.boardAria,
    });
    await guess(WORD);

    expect(screen.queryByText(messages.freePlay.solved.stamp)).toBeNull();
    expect(
      screen.getByRole("group", { name: messages.games.termo.play.boardAria }),
    ).toBe(board);
    const origins = document.querySelectorAll("[data-wave-origin]");
    expect(origins).toHaveLength(1);
    expect(origins[0]).toBe(cell(9));
    expect(document.querySelectorAll("[data-cell-index]")).toHaveLength(
      MAX_GUESSES * 5,
    );

    fireEvent.animationEnd(cell(MAX_GUESSES * 5 - 1));
    expect(screen.getByText(messages.freePlay.solved.stamp)).toBeVisible();
  });

  it("shows the lost card at once", async () => {
    allowMotion();
    render(<TermoFreeScreen deps={{ pickSeed: () => SEED }} />);
    await flushGeneration();
    for (const word of MISSES) {
      await guess(word);
    }

    expect(screen.getByText(messages.freePlay.solved.lostStamp)).toBeVisible();
  });
});

describe("the glow is paint on the cells, calm under reduced motion (T-WEB-S764)", () => {
  const CSS = stylesheet("src/play/ending-stage.module.css");
  const RULE = ".glow [data-cell-index]:not([data-block])";

  it("waits for the lead and each cell's own delay", () => {
    expect(decl(bodyOf(CSS, RULE), "animation")).toMatch(
      /board-glow .*calc\(var\(--wave-lead, 0ms\) \+ var\(--wave-delay, 0ms\)\)/s,
    );
    expect(
      decl(
        bodyOf(stylesheet("src/termo/termo-board.module.css"), ".grid"),
        "--wave-lead",
      ),
    ).toBe("calc(var(--duration-fast) + var(--reveal-stagger) * 4)");
  });

  it("paints the accent and moves nothing, so gapless boards keep their edges", () => {
    const glow = bodyOf(CSS, "@keyframes board-glow");
    expect(decl(glow, "background-color")).toBe("var(--accent)");
    expect(glow).not.toMatch(/transform|scale|translate/);
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|\binfinite\b/i);
  });

  it("stands the glow down by name", () => {
    expect(uncoveredSelectors(parseCss(CSS))).toEqual([]);
  });

  it("leaves the Cruzadinha's black squares dark", () => {
    render(
      <CrosswordBoard
        boardRef={createRef()}
        size={2}
        solution={["A", null, "B", "C"]}
        clues={[]}
        entries={[null, null, null, null]}
        selected={null}
        direction="across"
        hintIndex={null}
        onSelect={vi.fn()}
        onToggleDirection={vi.fn()}
        onMove={vi.fn()}
        onLetter={vi.fn()}
        onBackspace={vi.fn()}
      />,
    );

    expect(
      Array.from(document.querySelectorAll("[data-block]"), (element) =>
        element.getAttribute("data-cell-index"),
      ),
    ).toEqual(["1"]);
  });
});
