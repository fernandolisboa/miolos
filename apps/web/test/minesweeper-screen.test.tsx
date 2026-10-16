import { MINESWEEPER_LEVELS, layMines } from "@miolos/games/minesweeper";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MinesweeperPage from "../app/modo-livre/campo-minado/page";
import { MinesweeperFreeScreen } from "../src/free-play/minesweeper-free-screen";
import { messages, routes } from "../src/i18n";
import { minesweeperMessages } from "../src/minesweeper/messages";
import { readSettings, writeSettings } from "../src/settings/settings";

const copy = { ...messages.games.minesweeper.play, ...minesweeperMessages };
const SEED = 20_261_015;
const FIRST = 40;
const NEXT_SEED = 20_261_016;

function seeds(...values: number[]): () => number {
  let at = 0;
  return () => values[Math.min(at++, values.length - 1)] ?? 0;
}

function mount(pick = seeds(SEED, NEXT_SEED)) {
  return render(<MinesweeperFreeScreen deps={{ pickSeed: pick }} />);
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

function open(index: number): void {
  fireEvent.click(cell(index));
}

function win(seed: number): void {
  open(FIRST);
  layMines({
    seed,
    size: MINESWEEPER_LEVELS.beginner,
    safe: [FIRST],
  }).mines.forEach((isMine, index) => {
    if (
      !isMine &&
      cell(index).getAttribute("aria-label")?.endsWith(copy.cell.hidden)
    ) {
      open(index);
    }
  });
}

function page(): HTMLElement {
  const main = document.querySelector("main");
  if (main === null) {
    throw new Error("no main");
  }
  return main;
}

const fetchSpy = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchSpy);
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  fetchSpy.mockClear();
});

describe("the Campo Minado screen is a static page that plays and records nothing (T-WEB-S887)", () => {
  it("draws the beginner board at once, with the counter, the clock and no hint or undo", () => {
    mount();

    expect(page()).toHaveAttribute("data-play-state", "playing");
    expect(document.querySelectorAll("[data-cell-index]")).toHaveLength(81);
    expect(
      screen.getByRole("radio", { checked: true, name: /Iniciante/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(copy.progressLong(10)).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByRole("timer")[0]).toHaveTextContent("00:00");
    expect(
      screen.queryByRole("button", { name: /dica/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: messages.play.undo }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: copy.reset.label }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: copy.tap.open, pressed: true }),
    ).toBeInTheDocument();
  });

  it("runs the clock from the first open, and counts flags against the mines", () => {
    vi.useFakeTimers();
    mount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getAllByRole("timer")[0]).toHaveTextContent("00:00");

    open(FIRST);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.getAllByRole("timer")[0]).toHaveTextContent("00:03");

    const closed = document.querySelector<HTMLElement>(
      '[aria-label$="fechada"]',
    );
    closed?.focus();
    fireEvent.keyDown(closed as HTMLElement, { key: "f" });
    expect(screen.getAllByText(copy.progressLong(9)).length).toBeGreaterThan(0);
  });

  it("hides the clock when Mostrar cronômetro is off, and still counts", () => {
    writeSettings({ ...readSettings(), showClock: false });
    mount();

    expect(screen.queryAllByRole("timer")).toHaveLength(0);
  });

  it("asks before Novo jogo throws a game away, then deals another from a new seed", () => {
    const pick = vi.fn(seeds(SEED, NEXT_SEED));
    mount(pick);
    open(FIRST);

    fireEvent.click(screen.getByRole("button", { name: copy.reset.label }));
    expect(screen.getByText(copy.reset.question)).toBeInTheDocument();
    fireEvent.click(
      screen.getAllByRole("button", { name: copy.reset.label }).at(-1)!,
    );

    expect(pick).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('[aria-label$="fechada"]')).toHaveLength(
      81,
    );
    expect(screen.getAllByRole("timer")[0]).toHaveTextContent("00:00");
    expect(
      screen.getByRole("button", { name: copy.reset.label }),
    ).toHaveFocus();
  });

  it("keeps focus on the level chip through two arrow presses", () => {
    mount();
    const checked = () => screen.getByRole("radio", { checked: true });

    checked().focus();
    fireEvent.keyDown(checked(), { key: "ArrowRight" });
    expect(checked()).toHaveAccessibleName(/Intermediário/);
    expect(checked()).toHaveFocus();
    fireEvent.keyDown(document.activeElement as HTMLElement, {
      key: "ArrowRight",
    });
    expect(checked()).toHaveAccessibleName(/Especialista/);
    expect(checked()).toHaveFocus();
  });

  it("changes level by dealing a new board of that size", () => {
    mount();

    fireEvent.click(
      screen.getByRole("radio", {
        name: copy.levels.aria(copy.levels.intermediate, 16, 16, 40),
      }),
    );
    expect(document.querySelectorAll("[data-cell-index]")).toHaveLength(256);
    expect(screen.getAllByText(copy.progressLong(40)).length).toBeGreaterThan(
      0,
    );

    fireEvent.click(
      screen.getByRole("radio", {
        name: copy.levels.aria(copy.levels.expert, 16, 30, 99),
      }),
    );
    expect(document.querySelectorAll("[data-cell-index]")).toHaveLength(480);
  });

  it("ends a loss on the card: the finished field with every mine, the time, and a way on", () => {
    vi.useFakeTimers();
    mount();
    open(FIRST);
    act(() => {
      vi.advanceTimersByTime(7000);
    });
    const mine = layMines({
      seed: SEED,
      size: MINESWEEPER_LEVELS.beginner,
      safe: [FIRST],
    }).mines.findIndex(Boolean);
    open(mine);

    expect(page()).toHaveAttribute("data-play-state", "lost");
    expect(
      screen.getByText(messages.freePlay.solved.lostStamp),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: copy.finishedAria(false) }),
    ).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("00:07");
    expect(
      screen.getByRole("button", {
        name: messages.freePlay.solved.again.minesweeper,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: messages.freePlay.backToIndexAria }),
    ).toHaveAttribute("href", routes.freePlay);
  });

  it("ends a win on the card, and Mais um deals the same level again", () => {
    mount();
    win(SEED);

    expect(page()).toHaveAttribute("data-play-state", "solved");
    expect(
      screen.getByText(messages.freePlay.solved.stamp),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: copy.finishedAria(true) }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: messages.freePlay.solved.again.minesweeper,
      }),
    );
    expect(document.querySelectorAll("[data-cell-index]")).toHaveLength(81);
  });

  it("glows before the card on every win, not only the first", () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    mount();
    const again = () =>
      screen.queryByRole("button", {
        name: messages.freePlay.solved.again.minesweeper,
      });

    win(SEED);
    expect(again()).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(again()).toBeInTheDocument();

    fireEvent.click(again() as HTMLElement);
    win(NEXT_SEED);
    expect(again()).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(again()).toBeInTheDocument();
  });

  it("keeps the board when the level already chosen is chosen again, and deals only when it changes", () => {
    const pick = vi.fn(seeds(SEED, NEXT_SEED));
    mount(pick);
    open(FIRST);
    const closed = () =>
      document.querySelectorAll('[aria-label$="fechada"]').length;
    const before = closed();
    expect(before).toBeLessThan(81);

    fireEvent.click(screen.getByRole("radio", { checked: true }));
    expect(closed()).toBe(before);
    expect(pick).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("radio", {
        name: copy.levels.aria(copy.levels.intermediate, 16, 16, 40),
      }),
    );
    expect(pick).toHaveBeenCalledTimes(2);
    expect(closed()).toBe(256);
  });

  it("cycles a closed cell through bandeira, interrogação and back when Marcas (?) is on", () => {
    writeSettings({
      ...readSettings(),
      games: {
        ...readSettings().games,
        minesweeper: { questionMarks: true },
      },
    });
    mount();
    const name = () => cell(0).getAttribute("aria-label") ?? "";

    cell(0).focus();
    fireEvent.keyDown(cell(0), { key: "f" });
    expect(name()).toMatch(new RegExp(`${copy.cell.flag}$`));
    fireEvent.keyDown(cell(0), { key: "f" });
    expect(name()).toMatch(new RegExp(`${copy.cell.question}$`));
    fireEvent.keyDown(cell(0), { key: "f" });
    expect(name()).toMatch(new RegExp(`${copy.cell.hidden}$`));
  });

  it("fetches nothing and writes nothing but the settings, through a whole game", () => {
    mount();
    open(FIRST);
    const mine = layMines({
      seed: SEED,
      size: MINESWEEPER_LEVELS.beginner,
      safe: [FIRST],
    }).mines.findIndex(Boolean);
    open(mine);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
  });

  it("is mounted by the page, with no props and no generation step", () => {
    render(<MinesweeperPage />);
    expect(document.querySelectorAll("[data-cell-index]")).toHaveLength(81);
  });
});
