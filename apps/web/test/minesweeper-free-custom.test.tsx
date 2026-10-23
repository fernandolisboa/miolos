import { MINESWEEPER_LEVELS, layMines } from "@miolos/games/minesweeper";
import type { MinesweeperSize } from "@miolos/games/minesweeper";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MinesweeperFreeScreen } from "../src/free-play/minesweeper-free-screen";
import { messages } from "../src/i18n";
import { minesweeperFreeMessages } from "../src/minesweeper/free-messages";
import { minesweeperMessages } from "../src/minesweeper/messages";
import minefield from "../src/minesweeper/minefield.module.css";
import { bodyOf, decl, stylesheet } from "./css-source";

const copy = minesweeperFreeMessages;
const KEY = "miolos-minesweeper";
const SEED = 20_261_015;
const NEXT_SEED = 20_261_016;
const FIRST = 40;
const FIRST_OPEN_WIN = { seed: 66_614, at: 0 };

function seeds(...values: number[]): () => number {
  let at = 0;
  return () => values[Math.min(at++, values.length - 1)] ?? 0;
}

function mount(pick: () => number = seeds(SEED, NEXT_SEED)) {
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

function cells(): number {
  return document.querySelectorAll("[data-cell-index]").length;
}

function open(index: number): void {
  fireEvent.click(cell(index));
}

function win(seed: number, size: MinesweeperSize, afterMs = 0): void {
  open(FIRST);
  act(() => {
    vi.advanceTimersByTime(afterMs);
  });
  layMines({ seed, size, safe: [FIRST] }).mines.forEach((isMine, index) => {
    if (
      !isMine &&
      cell(index)
        .getAttribute("aria-label")
        ?.endsWith(minesweeperMessages.cell.hidden)
    ) {
      open(index);
    }
  });
}

function lose(seed: number, size: MinesweeperSize, afterMs = 0): void {
  open(FIRST);
  act(() => {
    vi.advanceTimersByTime(afterMs);
  });
  open(layMines({ seed, size, safe: [FIRST] }).mines.findIndex(Boolean));
}

function again(): void {
  fireEvent.click(
    screen.getByRole("button", {
      name: messages.freePlay.solved.again.minesweeper,
    }),
  );
}

function stored(): unknown {
  return JSON.parse(window.localStorage.getItem(KEY) ?? "null");
}

function chooseCustom(): void {
  fireEvent.click(screen.getByRole("radio", { name: copy.levels.customAria }));
}

function input(name: string): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>("spinbutton", { name });
}

function playSize(rows: string, columns: string, mines: string): void {
  fireEvent.change(input(copy.custom.rows), { target: { value: rows } });
  fireEvent.change(input(copy.custom.columns), { target: { value: columns } });
  fireEvent.change(input(copy.custom.mines), { target: { value: mines } });
  fireEvent.click(screen.getByRole("button", { name: copy.custom.play }));
}

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("a won level keeps its best time on the device, and the card says when it is new (T-WEB-S1044)", () => {
  // ADR-0055: contended local 2352 ms × 4 → 10_000.
  it(
    "records a first win as a new best, keeps it through a slower win, and replaces it on a faster one",
    {
      timeout: 10_000,
    },
    () => {
      mount(seeds(SEED, NEXT_SEED, SEED));

      win(SEED, MINESWEEPER_LEVELS.beginner, 12_000);
      expect(screen.getByText(copy.best.isNew)).toBeInTheDocument();
      expect(screen.getByRole("timer")).toHaveTextContent("00:12");
      expect(stored()).toEqual({ best: { beginner: 12 } });

      again();
      win(NEXT_SEED, MINESWEEPER_LEVELS.beginner, 20_000);
      expect(screen.queryByText(copy.best.isNew)).not.toBeInTheDocument();
      expect(screen.getByText(copy.best.line("00:12"))).toBeInTheDocument();
      expect(stored()).toEqual({ best: { beginner: 12 } });

      again();
      win(SEED, MINESWEEPER_LEVELS.beginner, 9_500);
      expect(screen.getByText(copy.best.isNew)).toBeInTheDocument();
      expect(stored()).toEqual({ best: { beginner: 9 } });
    },
  );

  it("records a first open that wins as 00:00", () => {
    mount(seeds(FIRST_OPEN_WIN.seed));
    open(FIRST_OPEN_WIN.at);

    expect(screen.getByText(copy.best.isNew)).toBeInTheDocument();
    expect(stored()).toEqual({ best: { beginner: 0 } });
  });

  it("keeps each level's best apart", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ best: { intermediate: 5 } }),
    );
    mount();

    win(SEED, MINESWEEPER_LEVELS.beginner, 30_000);
    expect(screen.getByText(copy.best.isNew)).toBeInTheDocument();
    expect(stored()).toEqual({ best: { beginner: 30, intermediate: 5 } });
  });
});

describe("a lost game shows the level's best time and writes nothing (T-WEB-S1045)", () => {
  it("shows Melhor tempo when the level has one", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ best: { beginner: 83 } }),
    );
    mount();

    lose(SEED, MINESWEEPER_LEVELS.beginner, 4_000);
    expect(screen.getByText(copy.best.line("01:23"))).toBeInTheDocument();
    expect(stored()).toEqual({ best: { beginner: 83 } });
  });

  it("shows no best-time line when the level has none", () => {
    mount();

    lose(SEED, MINESWEEPER_LEVELS.beginner);
    expect(screen.queryByText(/Melhor tempo/)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.best.isNew)).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(0);
  });
});

describe("Personalizado deals the last custom size at once and plays like a level, with no best time (T-WEB-S1046)", () => {
  it("is the fourth chip, deals 9 by 9 with 10 mines the first time and shows the form", () => {
    mount();
    expect(
      screen.queryByRole("form", { name: copy.custom.label }),
    ).not.toBeInTheDocument();
    const chips = screen
      .getAllByRole("radio")
      .map((chip) => chip.textContent ?? "");
    expect(chips).toEqual([
      copy.levels.beginner,
      copy.levels.intermediate,
      copy.levels.expert,
      copy.levels.custom,
    ]);

    chooseCustom();
    expect(cells()).toBe(81);
    expect(
      screen.getAllByText(minesweeperMessages.progressLong(10)).length,
    ).toBeGreaterThan(0);
    expect(input(copy.custom.rows).value).toBe("9");
    expect(input(copy.custom.columns).value).toBe("9");
    expect(input(copy.custom.mines).value).toBe("10");
    expect(window.localStorage.length).toBe(0);
  });

  it("Jogar deals the size typed, remembers it, and a later visit deals it at once", () => {
    const { unmount } = mount();
    chooseCustom();

    playSize("24", "30", "667");
    expect(cells()).toBe(720);
    expect(
      screen.getAllByText(minesweeperMessages.progressLong(667)).length,
    ).toBeGreaterThan(0);
    expect(stored()).toEqual({ custom: { rows: 24, columns: 30, mines: 667 } });
    unmount();

    mount();
    expect(cells()).toBe(81);
    chooseCustom();
    expect(cells()).toBe(720);
    expect(input(copy.custom.columns).value).toBe("30");
  });

  it("Jogar mid-game deals without a confirm, Novo jogo and Mais um deal the same size, and a win keeps no best", () => {
    mount(seeds(SEED, NEXT_SEED, SEED, NEXT_SEED));
    chooseCustom();
    open(FIRST);

    playSize("9", "9", "10");
    expect(
      screen.queryByText(messages.games.minesweeper.play.reset.question),
    ).not.toBeInTheDocument();
    expect(document.querySelectorAll('[aria-label$="fechada"]')).toHaveLength(
      81,
    );

    win(SEED, MINESWEEPER_LEVELS.beginner, 3_000);
    expect(screen.queryByText(copy.best.isNew)).not.toBeInTheDocument();
    expect(screen.queryByText(/Melhor tempo/)).not.toBeInTheDocument();
    expect(stored()).toEqual({ custom: { rows: 9, columns: 9, mines: 10 } });

    again();
    expect(cells()).toBe(81);
    expect(
      screen.getByRole("radio", {
        checked: true,
        name: copy.levels.customAria,
      }),
    ).toBeInTheDocument();
  });

  it("does nothing when Personalizado is chosen again, and hides the form on a level", () => {
    const pick = vi.fn(seeds(SEED, NEXT_SEED, SEED));
    mount(pick);
    chooseCustom();
    open(FIRST);
    const closed = document.querySelectorAll('[aria-label$="fechada"]').length;

    chooseCustom();
    expect(pick).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('[aria-label$="fechada"]')).toHaveLength(
      closed,
    );

    fireEvent.click(
      screen.getByRole("radio", {
        name: copy.levels.aria(copy.levels.intermediate, 16, 16, 40),
      }),
    );
    expect(cells()).toBe(256);
    expect(
      screen.queryByRole("form", { name: copy.custom.label }),
    ).not.toBeInTheDocument();
  });
});

describe("the size form clamps what is typed to Windows' limits and shows the clamped size (T-WEB-S1047)", () => {
  it("clamps out-of-range values, and the mines to (rows − 1) × (columns − 1)", () => {
    mount();
    chooseCustom();

    playSize("100", "3", "9999");
    expect(input(copy.custom.rows).value).toBe("24");
    expect(input(copy.custom.columns).value).toBe("9");
    expect(input(copy.custom.mines).value).toBe("184");
    expect(cells()).toBe(24 * 9);
    expect(stored()).toEqual({ custom: { rows: 24, columns: 9, mines: 184 } });
  });

  it("takes the minimum for an empty field and truncates a fraction", () => {
    mount();
    chooseCustom();

    playSize("12.7", "", "");
    expect(input(copy.custom.rows).value).toBe("12");
    expect(input(copy.custom.columns).value).toBe("9");
    expect(input(copy.custom.mines).value).toBe("10");
    expect(cells()).toBe(12 * 9);
  });

  it("keeps the mines' range in step with the rows and columns typed", () => {
    mount();
    chooseCustom();
    const range = () =>
      document.getElementById(
        input(copy.custom.mines).getAttribute("aria-describedby") ?? "",
      )?.textContent;

    expect(range()).toBe(copy.custom.range(10, 64));
    fireEvent.change(input(copy.custom.rows), { target: { value: "16" } });
    fireEvent.change(input(copy.custom.columns), { target: { value: "30" } });
    expect(range()).toBe(copy.custom.range(10, 435));
    expect(input(copy.custom.mines)).toHaveAttribute("max", "435");
  });
});

describe("a new custom size remounts the field, even on the same seed (T-WEB-S1048)", () => {
  it("drops the roving tab stop of the old size", () => {
    mount(() => SEED);
    chooseCustom();
    fireEvent.focus(cell(80));
    expect(cell(80)).toHaveAttribute("tabindex", "0");

    playSize("9", "9", "11");
    expect(cell(0)).toHaveAttribute("tabindex", "0");
    expect(cell(80)).toHaveAttribute("tabindex", "-1");
  });
});

describe("the screen renders without storage on the server and hydrates over a stored best and custom size quietly (T-WEB-S1049)", () => {
  it("never reads storage into the markup", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("no storage on the server");
      });
    const html = renderToString(
      <MinesweeperFreeScreen deps={{ pickSeed: () => SEED }} />,
    );
    getItem.mockRestore();

    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        best: { beginner: 12 },
        custom: { rows: 20, columns: 20, mines: 60 },
      }),
    );
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const error = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const recovered: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;

    act(() => {
      root = hydrateRoot(
        container,
        <MinesweeperFreeScreen deps={{ pickSeed: () => SEED }} />,
        { onRecoverableError: (cause) => recovered.push(cause) },
      );
    });

    expect(error).not.toHaveBeenCalled();
    expect(recovered).toEqual([]);
    expect(
      within(container).getByRole("radio", {
        checked: true,
        name: /Iniciante/,
      }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("[data-cell-index]")).toHaveLength(81);
    act(() => {
      root?.unmount();
    });
    container.remove();
  });
});

describe("the custom size's rows and columns reach the board well and the finished field (T-WEB-S1050)", () => {
  it("wraps the board card, then the finished field, in a box-less custom-size element", () => {
    mount();
    chooseCustom();
    playSize("24", "9", "20");

    const wrapper =
      document.querySelector("[data-board-card]")?.parentElement?.parentElement;
    expect(wrapper).toHaveClass(String(minefield.customSize));
    expect(wrapper?.style.getPropertyValue("--rows")).toBe("24");
    expect(wrapper?.style.getPropertyValue("--columns")).toBe("9");

    lose(NEXT_SEED, { rows: 24, columns: 9, mines: 20 });
    const finished = screen.getByRole("img", {
      name: minesweeperMessages.finishedAria(false),
    });
    expect(finished.parentElement).toHaveClass(String(minefield.customSize));
    expect(finished.parentElement?.style.getPropertyValue("--columns")).toBe(
      "9",
    );
  });

  it("leaves the three levels on their own classes", () => {
    mount();

    expect(
      document.querySelector(`.${String(minefield.customSize)}`),
    ).toBeNull();
  });
});

describe("the size form is a labelled, keyboard-ready form with 44px targets (T-WEB-S1051)", () => {
  it("names the form, labels and describes each field, and bounds each input", () => {
    mount();
    chooseCustom();

    const form = screen.getByRole("form", { name: copy.custom.label });
    expect(form).toHaveAttribute("novalidate");
    const expected = [
      [copy.custom.rows, "9", "24"],
      [copy.custom.columns, "9", "30"],
      [copy.custom.mines, "10", "64"],
    ] as const;
    for (const [name, min, max] of expected) {
      const field = input(name);
      expect(field).toHaveAttribute("type", "number");
      expect(field).toHaveAttribute("inputmode", "numeric");
      expect(field).toHaveAttribute("min", min);
      expect(field).toHaveAttribute("max", max);
      expect(field).toHaveAttribute("step", "1");
      expect(field).toHaveAccessibleDescription(
        copy.custom.range(Number(min), Number(max)),
      );
    }
    expect(
      within(form).getByRole("button", { name: copy.custom.play }),
    ).toHaveAttribute("type", "submit");
  });

  it("submits on Enter, as a form does", () => {
    mount();
    chooseCustom();
    fireEvent.change(input(copy.custom.rows), { target: { value: "10" } });

    fireEvent.keyDown(input(copy.custom.rows), { key: "Enter" });
    fireEvent.submit(screen.getByRole("form", { name: copy.custom.label }));
    expect(cells()).toBe(90);
  });

  it("gives the Personalizado chip a fixed name, never one read from storage", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ custom: { rows: 20, columns: 20, mines: 60 } }),
    );
    mount();

    expect(
      screen.getByRole("radio", { name: copy.levels.customAria }),
    ).toBeInTheDocument();
  });

  it("keeps every input and Jogar at the touch-target minimum", () => {
    const css = stylesheet("src/free-play/minesweeper-free.module.css");

    expect(decl(bodyOf(css, ".sizeInput"), "min-height")).toBe(
      "var(--touch-target-min)",
    );
    expect(decl(bodyOf(css, ".sizePlay"), "composes")).toBe(
      'again from "./free-play.module.css"',
    );
    expect(
      decl(
        bodyOf(stylesheet("src/free-play/free-play.module.css"), ".again"),
        "min-height",
      ),
    ).toBe("var(--touch-target-min)");
  });
});
