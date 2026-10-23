import type { CrosswordSize, DailyCrosswordResponse } from "@miolos/core";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FREE_PLAY_DATE } from "../src/free-play/catalog";
import { CrosswordFreeScreen } from "../src/free-play/crossword-free-screen";
import {
  useFreeCrossword,
  type FreeCrosswordDeps,
} from "../src/free-play/use-free-crossword";
import boardStyles from "../src/crossword/crossword-board.module.css";
import { messages } from "../src/i18n";
import { flushGeneration } from "./free-generation";

const SEED = 20_260_928;
const NEXT_SEED = 20_260_929;
const copy = messages.games.crossword.play;

async function generated(
  seed: number,
  size: CrosswordSize = 5,
): Promise<DailyCrosswordResponse> {
  const deps = { pickSeed: () => seed };
  const { result } = renderHook(() => useFreeCrossword(size, deps));
  await flushGeneration();
  const { phase } = result.current;
  if (phase.kind !== "ready") {
    throw new Error(`seed ${String(seed)} did not generate`);
  }
  return phase.puzzle.daily;
}

function boardOf(size = 5): HTMLElement {
  return screen.getByRole("group", { name: copy.boardAria(size) });
}

function cellAt(index: number, size = 5): HTMLElement {
  const cell = boardOf(size).querySelector<HTMLElement>(
    `[data-cell-index="${String(index)}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${String(index)}`);
  }
  return cell;
}

function radio(size: CrosswordSize): HTMLElement {
  return screen.getByRole("radio", { name: messages.freePlay.size.aria(size) });
}

function puzzleOf(
  seed: number,
  daily: DailyCrosswordResponse,
): ReturnType<NonNullable<FreeCrosswordDeps["generate"]>> {
  return {
    seed,
    grid: daily.grid,
    entries: daily.clues.map((clue) => ({
      number: clue.number,
      direction: clue.direction,
      row: clue.row,
      col: clue.col,
      normalized: "x".repeat(clue.length),
      canonical: "x".repeat(clue.length),
      clue: clue.clue,
    })),
  };
}

function solve(daily: DailyCrosswordResponse): void {
  for (const [index, letter] of daily.grid.flat().entries()) {
    if (letter === null) {
      continue;
    }
    if (screen.queryByText(messages.freePlay.solved.stamp) !== null) {
      return;
    }
    const cell = cellAt(index, daily.grid.length);
    fireEvent.pointerDown(cell);
    fireEvent.click(cell);
    fireEvent.keyDown(boardOf(daily.grid.length), { key: letter });
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a free crossword is today's wire shape, dated nowhere, one per seed (T-WEB-S445)", () => {
  it.each([5, 7] as const)(
    "carries FREE_PLAY_DATE and regenerates identically from the same seed at %i",
    async (size) => {
      for (const seed of [1, 42, SEED, 0xffff_ffff]) {
        const daily = await generated(seed, size);

        expect(daily.date).toBe(FREE_PLAY_DATE);
        expect(daily.grid).toHaveLength(size);
        expect(await generated(seed, size)).toEqual(daily);
      }
    },
  );
});

describe("a free crossword plays, solves and goes again with nothing recorded (T-WEB-S446)", () => {
  it("has no clock and no level, offers a size at 5x5, solves to its own card, and 'Mais uma' draws a fresh board — zero fetch, zero writes", async () => {
    const fetchMock = vi.fn(() => {
      throw new Error("free play must not fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const first = await generated(SEED);
    const next = await generated(NEXT_SEED);
    const seeds = [SEED, NEXT_SEED];
    const pickSeed = vi.fn(() => seeds.shift() ?? 0);

    render(<CrosswordFreeScreen deps={{ pickSeed }} />);
    await flushGeneration();

    expect(screen.queryByText(messages.play.timerLabel)).toBeNull();
    expect(
      screen.getByRole("radiogroup", { name: messages.freePlay.size.label }),
    ).toBeInTheDocument();
    expect(screen.queryByText(messages.freePlay.level.label)).toBeNull();

    solve(first);

    expect(
      screen.getByText(messages.freePlay.solved.stamp),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Modo livre · Cruzadinha · 5×5"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mais uma"));
    await flushGeneration();

    expect(pickSeed).toHaveBeenCalledTimes(2);
    const blocks = next.grid.flat().map((cell) => cell === null);
    for (const [index, block] of blocks.entries()) {
      expect(cellAt(index).getAttribute("aria-disabled") === "true").toBe(
        block,
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("a failed free crossword offers a retry that recovers (T-WEB-S447)", () => {
  it("shows the shared error card, then a board once retry generates", async () => {
    const real = await generated(SEED);
    let throws = true;
    const generate: NonNullable<FreeCrosswordDeps["generate"]> = (seed) => {
      if (throws) {
        throws = false;
        throw new Error("generation failed");
      }
      return puzzleOf(seed, real);
    };

    render(<CrosswordFreeScreen deps={{ pickSeed: () => SEED, generate }} />);
    await flushGeneration();

    expect(screen.getByText(messages.freePlay.error.title)).toBeInTheDocument();

    fireEvent.click(screen.getByText(messages.freePlay.error.retry));
    await flushGeneration();

    expect(screen.queryByText(messages.freePlay.error.title)).toBeNull();
    expect(boardOf()).toBeInTheDocument();
  });
});

describe("the size picker is a Tamanho radiogroup (T-WEB-S672)", () => {
  it("offers 5x5 checked and 7x7, with one tab stop, in the generating state too", async () => {
    render(<CrosswordFreeScreen deps={{ pickSeed: () => SEED }} />);

    expect(radio(5)).toHaveAttribute("aria-checked", "true");
    expect(radio(5)).toHaveAttribute("tabindex", "0");
    expect(radio(7)).toHaveAttribute("aria-checked", "false");
    expect(radio(7)).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText(messages.freePlay.generating)).toBeInTheDocument();

    await flushGeneration();

    expect(radio(5)).toHaveAttribute("aria-checked", "true");
    expect(radio(7)).toHaveTextContent("7×7");
  });

  it("moves with the arrows, wrapping at both ends", async () => {
    render(<CrosswordFreeScreen deps={{ pickSeed: () => SEED }} />);
    await flushGeneration();

    fireEvent.keyDown(radio(5), { key: "ArrowRight" });
    await flushGeneration();
    expect(radio(7)).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(radio(7), { key: "ArrowRight" });
    await flushGeneration();
    expect(radio(5)).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(radio(5), { key: "ArrowLeft" });
    await flushGeneration();
    expect(radio(7)).toHaveAttribute("aria-checked", "true");
  });
});

describe("a 7x7 free crossword goes through the real engine and stays 7x7 (T-WEB-S673)", () => {
  async function chooseSeven() {
    await flushGeneration();
    fireEvent.click(radio(7));
    await flushGeneration();
  }

  // ADR-0055: CI gate 1494 ms × 4 → 10_000; contended local 5124 ms timed out at 5_000.
  it("draws a 7x7 board, names the size, solves to its mode line and goes again at 7 — zero fetch, zero writes", async () => {
    const fetchMock = vi.fn(() => {
      throw new Error("free play must not fetch");
    });
    vi.stubGlobal("fetch", fetchMock);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const seven = await generated(SEED, 7);

    render(<CrosswordFreeScreen deps={{ pickSeed: () => SEED }} />);
    await chooseSeven();

    expect(boardOf(7).querySelectorAll("[data-cell-index]")).toHaveLength(49);
    expect(
      screen.getByText(messages.freePlay.size.label).nextElementSibling,
    ).toHaveTextContent("7×7");

    solve(seven);

    expect(
      screen.getByText(messages.freePlay.solved.stamp),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Modo livre · Cruzadinha · 7×7"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByText("Mais uma"));
    await flushGeneration();

    expect(boardOf(7).querySelectorAll("[data-cell-index]")).toHaveLength(49);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  }, 10_000);

  it("keeps the 7x7 floor on the page and the seven tracks on the grid, while generating and once ready", async () => {
    const { container } = render(
      <CrosswordFreeScreen deps={{ pickSeed: () => SEED }} />,
    );
    await flushGeneration();
    const page = () => container.querySelector("main");
    const sevenTracks = () =>
      container.querySelector<HTMLElement>(`.${boardStyles.size7 ?? ""}`);
    expect(page()).not.toHaveClass(boardStyles.pageSize7 ?? "");
    expect(sevenTracks()).toBeNull();

    fireEvent.click(radio(7));

    expect(page()).toHaveClass(boardStyles.pageCrossword ?? "");
    expect(page()).toHaveClass(boardStyles.pageSize7 ?? "");
    expect(sevenTracks()?.style.getPropertyValue("--crossword-size")).toBe("7");

    await flushGeneration();

    expect(page()).toHaveClass(boardStyles.pageSize7 ?? "");
    expect(sevenTracks()).toBe(boardOf(7));
    expect(boardOf(7).style.getPropertyValue("--crossword-size")).toBe("7");
  });

  it("goes back to 5x5 when asked", async () => {
    render(<CrosswordFreeScreen deps={{ pickSeed: () => SEED }} />);
    await chooseSeven();

    fireEvent.click(radio(5));
    await flushGeneration();

    expect(boardOf(5).querySelectorAll("[data-cell-index]")).toHaveLength(25);
    expect(boardOf(5).style.getPropertyValue("--crossword-size")).toBe("5");
  });

  it("lands a failed 7x7 on the error card and retries at 7", async () => {
    const five = await generated(SEED, 5);
    const seven = await generated(SEED, 7);
    let throws = false;
    const sizes: number[] = [];
    const generate: NonNullable<FreeCrosswordDeps["generate"]> = (
      seed,
      size,
    ) => {
      sizes.push(size ?? 5);
      if (size === 7 && throws) {
        throws = false;
        throw new Error("generation failed");
      }
      return puzzleOf(seed, size === 7 ? seven : five);
    };
    render(<CrosswordFreeScreen deps={{ pickSeed: () => SEED, generate }} />);
    await flushGeneration();
    expect(boardOf(5)).toBeInTheDocument();
    throws = true;
    fireEvent.click(radio(7));
    await flushGeneration();

    expect(screen.getByText(messages.freePlay.error.title)).toBeInTheDocument();
    expect(radio(7)).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByText(messages.freePlay.error.retry));
    await flushGeneration();

    expect(boardOf(7)).toBeInTheDocument();
    expect(sizes).toEqual([5, 7, 7]);
  });
});
