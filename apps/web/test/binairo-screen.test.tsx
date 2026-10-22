import { FREE_HINTS_PER_PUZZLE, type DailyBinairoResponse } from "@miolos/core";
import { generateBinairo, nextBinairoStep } from "@miolos/games/binairo";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GamesSection } from "../app/ajustes/games-section";
import { BinairoScreen } from "../src/binairo/binairo-screen";
import styles from "../src/binairo/binairo-screen.module.css";
import { binairoHintExplanation } from "../src/binairo/hint";
import tipStyles from "../src/play/info-tip.module.css";
import sharedStyles from "../src/play/screen.module.css";
import spotlightStyles from "../src/play/spotlight.module.css";
import {
  playRecordKey,
  readPlayRecord,
  writePlayRecord,
  type BinairoPlayRecord,
} from "../src/play/play-record";
import { formatElapsed, messages } from "../src/i18n";
import {
  bodyOf,
  boardFloor,
  decl,
  pixels,
  stylesheet,
  token,
} from "./css-source";
import { freeHintSteps, spendFreeHints } from "./free-hints";
import { installPointerStubs, stubElementFromPoint } from "./pointer";
import { SPOKEN } from "./hint-reason";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),

  flushPendingCompletions: vi.fn((record?: BinairoPlayRecord) =>
    Promise.resolve(record),
  ),
}));
vi.mock("../src/play/sync", () => sync);

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/binairo",
}));

const DATE = "2026-07-30";
const PUZZLE = generateBinairo({ seed: 20_260_730, weekday: 3 });
const GIVENS_COUNT = PUZZLE.givens.filter((cell) => cell !== null).length;
const FIRST_EMPTY = PUZZLE.givens.findIndex((cell) => cell === null);
const FIRST_GIVEN = PUZZLE.givens.findIndex((cell) => cell !== null);

const DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...PUZZLE.givens],
};

installPointerStubs();

function cellAt(container: HTMLElement, index: number): HTMLElement {
  const cell = container.querySelector<HTMLElement>(
    `[data-cell-index="${index}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${index}`);
  }
  return cell;
}

function gridOf(container: HTMLElement): HTMLElement {
  const grid = cellAt(container, 0).parentElement;
  if (grid === null) {
    throw new Error("the grid container is missing");
  }
  return grid;
}

function playableQuad(): [number, number, number, number] {
  const playable = PUZZLE.givens.flatMap((given, index) =>
    given === null ? [index] : [],
  );
  const [first, second, third, fourth] = playable;
  if (
    first === undefined ||
    second === undefined ||
    third === undefined ||
    fourth === undefined
  ) {
    throw new Error("the fixture puzzle has fewer than four empty cells");
  }
  return [first, second, third, fourth];
}

function consecutiveInARow(): [number, number, number] {
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column + 2 < 8; column += 1) {
      const start = row * 8 + column;
      const triple: [number, number, number] = [start, start + 1, start + 2];
      if (triple.every((index) => PUZZLE.givens[index] === null)) {
        return triple;
      }
    }
  }
  throw new Error("the fixture puzzle has no three playable cells in a row");
}

function solveByClicking(container: HTMLElement): void {
  for (const [index, given] of PUZZLE.givens.entries()) {
    if (given !== null) {
      continue;
    }
    fireEvent.click(cellAt(container, index));
    if (PUZZLE.solution[index] === 0) {
      fireEvent.click(cellAt(container, index));
    }
  }
}

const GAME_CSS = stylesheet("src/binairo/binairo-screen.module.css");
const SHARED_CSS = stylesheet("src/play/screen.module.css");

function declares(css: string, local: string): boolean {
  return new RegExp(`(?:^|[\\s,])\\.${local}(?![\\w-])`, "m").test(css);
}

function className(local: string): string {
  const generated = declares(GAME_CSS, local)
    ? styles[local]
    : declares(SHARED_CSS, local)
      ? sharedStyles[local]
      : undefined;
  if (generated === undefined) {
    throw new Error(
      `neither binairo-screen.module.css nor play/screen.module.css declares .${local}`,
    );
  }
  return generated;
}

const GRID_AREA_CLASSES = [
  ...new Set(
    [GAME_CSS, SHARED_CSS]
      .flatMap((sheet) => [...sheet.matchAll(/^\.(\w+)[^{]*\{([^}]*)\}/gm)])
      .filter(([, , body]) => /(?:^|;)\s*grid-area\s*:/.test(body ?? ""))
      .map(([, local]) => local ?? ""),
  ),
];

const BLANK_READOUTS = [
  "timerBar",
  "timerCard",
  "progressBar",
  "progressCard",
] as const;

const BLANK = "\u00a0";

function parsed(markup: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = markup;
  return host;
}

function occupantsIn(root: HTMLElement): string[] {
  return GRID_AREA_CLASSES.filter(
    (local) => root.querySelector(`.${className(local)}`) !== null,
  );
}

function concludedRecord(
  overrides: Partial<BinairoPlayRecord> = {},
): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: PUZZLE.givens.map((given, index) =>
      given === null ? (PUZZLE.solution[index] ?? null) : null,
    ),
    grid: [...PUZZLE.solution],
    elapsedMs: 272_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the rules blurb (T-WEB-5)", () => {
  it("states rule 4 for rows AND columns, on every viewport", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    expect(
      screen.getByText(messages.games.binairo.play.rules),
    ).toBeInTheDocument();

    expect(container.textContent).not.toContain("nenhuma linha se repete.");
  });
});

describe("the board and its readouts (T-WEB-6)", () => {
  it("renders 64 cells, with givens inert and carrying the given aria", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    expect(container.querySelectorAll("[data-cell-index]")).toHaveLength(64);

    const given = PUZZLE.givens[FIRST_GIVEN];
    if (given === null || given === undefined) {
      throw new Error("the fixture puzzle has no givens");
    }
    const givenCell = cellAt(container, FIRST_GIVEN);
    expect(givenCell.tagName).toBe("BUTTON");
    expect(givenCell).toHaveAttribute("aria-disabled", "true");
    expect(givenCell).toHaveAttribute(
      "aria-label",
      messages.games.binairo.play.cellGivenAria(
        Math.floor(FIRST_GIVEN / 8) + 1,
        (FIRST_GIVEN % 8) + 1,
        given,
      ),
    );
  });

  it("renders BOTH readout pairs, because the reflow crosses subtrees", () => {
    render(<BinairoScreen daily={DAILY} />);

    expect(
      screen.getAllByLabelText(messages.play.timerAria("00:00")),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        messages.games.binairo.play.progressShort(GIVENS_COUNT, 64),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.games.binairo.play.progressLong(GIVENS_COUNT, 64),
      ),
    ).toBeInTheDocument();
  });

  it("keeps the <h1> the first element child of its wrapper", () => {
    render(<BinairoScreen daily={DAILY} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.previousElementSibling).toBeNull();
    expect(heading.parentElement?.firstElementChild).toBe(heading);
  });

  it("never uses the frames' streak labels (amendment table: sequência)", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    expect(container.textContent).not.toContain("dias seguidos");
  });
});

describe("tap-to-cycle (T-WEB-7)", () => {
  it("cycles a playable cell empty → 1 → 0 → empty", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("1");
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });

  it("names a rule-breaking cell with the copy module's composed string", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    const [first, second, third] = consecutiveInARow();

    for (const index of [first, second, third]) {
      fireEvent.click(cellAt(container, index));
    }

    expect(cellAt(container, second)).toHaveAttribute(
      "aria-label",
      messages.games.binairo.play.cellInvalidAria(
        Math.floor(second / 8) + 1,
        (second % 8) + 1,
        1,
      ),
    );
  });

  it("never changes a given", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    const before = cellAt(container, FIRST_GIVEN).textContent;

    fireEvent.click(cellAt(container, FIRST_GIVEN));

    expect(cellAt(container, FIRST_GIVEN).textContent).toBe(before);
    expect(
      screen.getByText(
        messages.games.binairo.play.progressLong(GIVENS_COUNT, 64),
      ),
    ).toBeInTheDocument();
  });
});

describe("paint mode (T-WEB-8)", () => {
  it("is sticky, writes directly, and toggles back off", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    const zero = screen.getByLabelText(
      messages.games.binairo.play.controls.zeroAria,
    );

    expect(zero).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(zero);
    expect(zero).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");

    fireEvent.click(zero);
    expect(zero).toHaveAttribute("aria-pressed", "false");
  });

  it("has no erase control, and a tap on the cell holding the brush's value clears it", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    const { controls } = messages.games.binairo.play;

    expect(screen.queryByText("apagar")).toBeNull();
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(2);

    fireEvent.click(screen.getByLabelText(controls.oneAria));
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("1");

    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });
});

describe("the mouse buttons write the two values (T-WEB-S499)", () => {
  function press(
    container: HTMLElement,
    index: number,
    init: { readonly button: number; readonly pointerType: string },
  ): void {
    const grid = gridOf(container);
    const at = { clientX: index, clientY: 0, pointerId: 1, ...init };
    fireEvent.pointerDown(grid, at);
    fireEvent.pointerUp(grid, at);
  }

  it("a right click writes 0, a left click writes 1, and the same button again clears", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);

    press(container, FIRST_EMPTY, { button: 2, pointerType: "mouse" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");

    press(container, FIRST_EMPTY, { button: 2, pointerType: "mouse" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");

    press(container, FIRST_EMPTY, { button: 0, pointerType: "mouse" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("1");

    press(container, FIRST_EMPTY, { button: 2, pointerType: "mouse" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");
  });

  it("with a brush, left writes the brush and right the other value", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    fireEvent.click(
      screen.getByLabelText(messages.games.binairo.play.controls.zeroAria),
    );

    press(container, FIRST_EMPTY, { button: 0, pointerType: "mouse" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");

    press(container, FIRST_EMPTY, { button: 2, pointerType: "mouse" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("1");
  });

  it("a right drag under a brush writes the other value across the stroke", () => {
    const [a, b, c] = playableQuad();
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    fireEvent.click(
      screen.getByLabelText(messages.games.binairo.play.controls.oneAria),
    );
    const grid = gridOf(container);
    const base = { clientY: 0, pointerId: 1, pointerType: "mouse", button: 2 };

    fireEvent.pointerDown(grid, { ...base, clientX: a });
    fireEvent.pointerMove(grid, { ...base, clientX: b });
    fireEvent.pointerMove(grid, { ...base, clientX: c });
    fireEvent.pointerUp(grid, { ...base, clientX: c });

    for (const index of [a, b, c]) {
      expect(cellAt(container, index).textContent).toBe("0");
    }
  });

  it("a touch tap still cycles, from pointerup and not again from the click", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);

    press(container, FIRST_EMPTY, { button: 0, pointerType: "touch" });
    fireEvent.click(cellAt(container, FIRST_EMPTY), { detail: 1 });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("1");

    press(container, FIRST_EMPTY, { button: 0, pointerType: "touch" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");
  });

  it("blocks the context menu on the grid", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    expect(fireEvent.contextMenu(gridOf(container))).toBe(false);
    expect(
      fireEvent.contextMenu(
        screen.getByLabelText(messages.games.binairo.play.controls.zeroAria),
      ),
    ).toBe(true);
  });
});

describe("the drag path (T-WEB-8b)", () => {
  it("paints every crossed cell in paint mode", () => {
    const [a, b, c] = playableQuad();
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    fireEvent.click(
      screen.getByLabelText(messages.games.binairo.play.controls.oneAria),
    );
    const grid = gridOf(container);

    fireEvent.pointerDown(grid, { clientX: a, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: b, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: c, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(grid, { clientX: c, clientY: 0, pointerId: 1 });

    for (const index of [a, b, c]) {
      expect(cellAt(container, index).textContent).toBe("1");
    }
  });

  it("paints nothing in cycle mode — cycling on drag is chaos (D8)", () => {
    const [a, b, c] = playableQuad();
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    const grid = gridOf(container);

    fireEvent.pointerDown(grid, { clientX: a, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: b, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: c, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(grid, { clientX: c, clientY: 0, pointerId: 1 });

    for (const index of [a, b, c]) {
      expect(cellAt(container, index).textContent).toBe("");
    }
  });
});

describe("a single tap in paint mode (T-WEB-8c)", () => {
  function enterPaintMode(): void {
    fireEvent.click(
      screen.getByLabelText(messages.games.binairo.play.controls.zeroAria),
    );
  }

  it("writes the cell from pointerup, without waiting for a click", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    enterPaintMode();
    const grid = gridOf(container);

    fireEvent.pointerDown(grid, {
      clientX: FIRST_EMPTY,
      clientY: 0,
      pointerId: 1,
    });
    fireEvent.pointerUp(grid, {
      clientX: FIRST_EMPTY,
      clientY: 0,
      pointerId: 1,
    });

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");
  });

  it("does not double-toggle when the trailing click does reach the cell", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    enterPaintMode();
    const grid = gridOf(container);

    fireEvent.pointerDown(grid, {
      clientX: FIRST_EMPTY,
      clientY: 0,
      pointerId: 1,
    });
    fireEvent.pointerUp(grid, {
      clientX: FIRST_EMPTY,
      clientY: 0,
      pointerId: 1,
    });

    fireEvent.click(cellAt(container, FIRST_EMPTY), { detail: 1 });

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");
  });

  it("writes nothing when a middle button opens the stroke", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    enterPaintMode();
    const grid = gridOf(container);

    fireEvent.pointerDown(grid, {
      clientX: FIRST_EMPTY,
      clientY: 0,
      pointerId: 1,
      button: 1,
    });
    fireEvent.pointerUp(grid, {
      clientX: FIRST_EMPTY,
      clientY: 0,
      pointerId: 1,
      button: 1,
    });

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });

  it("still writes on a keyboard activation after a paint drag", () => {
    const [a, b, c, d] = playableQuad();
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    fireEvent.click(
      screen.getByLabelText(messages.games.binairo.play.controls.oneAria),
    );
    const grid = gridOf(container);

    fireEvent.pointerDown(grid, { clientX: a, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: b, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: c, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(grid, { clientX: c, clientY: 0, pointerId: 1 });

    fireEvent.click(cellAt(container, c), { detail: 1 });
    expect(cellAt(container, c).textContent).toBe("1");

    fireEvent.click(cellAt(container, d), { detail: 0 });

    expect(cellAt(container, d).textContent).toBe("1");
  });

  it("keeps painting when a second finger touches and lifts mid-stroke", () => {
    const [a, b, c, d] = playableQuad();
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    fireEvent.click(
      screen.getByLabelText(messages.games.binairo.play.controls.oneAria),
    );
    const grid = gridOf(container);

    fireEvent.pointerDown(grid, { clientX: a, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: b, clientY: 0, pointerId: 1 });

    fireEvent.pointerDown(grid, { clientX: d, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(grid, { clientX: d, clientY: 0, pointerId: 2 });

    fireEvent.pointerMove(grid, { clientX: c, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(grid, { clientX: c, clientY: 0, pointerId: 1 });

    for (const index of [a, b, c]) {
      expect(cellAt(container, index).textContent).toBe("1");
    }
  });

  it("reopens after a stroke whose pointer never lifts", () => {
    const [a, b] = playableQuad();
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    fireEvent.click(
      screen.getByLabelText(messages.games.binairo.play.controls.oneAria),
    );
    const grid = gridOf(container);

    fireEvent.pointerDown(grid, { clientX: a, clientY: 0, pointerId: 1 });
    fireEvent.lostPointerCapture(grid, { pointerId: 1 });

    fireEvent.pointerDown(grid, { clientX: b, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(grid, { clientX: b, clientY: 0, pointerId: 2 });

    expect(cellAt(container, b).textContent).toBe("1");
  });
});

const FREE_STEPS = freeHintSteps(
  PUZZLE.givens,
  nextBinairoStep,
  (step) => step.value,
);
const FREE_SENTENCES = FREE_STEPS.map((step) =>
  binairoHintExplanation({ kind: "step", step }),
);

describe("the hint names its rule and lights the cells it reasons about (T-WEB-S567)", () => {
  const [FIRST] = FREE_STEPS;
  const SENTENCE = FREE_SENTENCES[0] ?? "";

  function spotlit(container: HTMLElement): number[] {
    return [...container.querySelectorAll<HTMLElement>("[data-cell-index]")]
      .filter((cell) => cell.classList.contains(spotlightStyles.spotlit ?? ""))
      .map((cell) => Number(cell.dataset.cellIndex));
  }

  it("writes the step's cell, reads out why and tints the rule's cells until the next board action", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    expect(spotlit(container)).toEqual([]);

    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    expect(cellAt(container, FIRST?.index ?? -1).textContent).toBe(
      String(FIRST?.value),
    );
    expect(cellAt(container, FIRST?.index ?? -1).classList).toContain(
      styles.cellHinted,
    );
    expect(screen.getByText(SENTENCE, SPOKEN)).toBeInTheDocument();
    expect(spotlit(container)).toEqual(FIRST?.cells);

    fireEvent.click(cellAt(container, FIRST_EMPTY));

    expect(spotlit(container)).toEqual([]);
    expect(screen.getByText(SENTENCE, SPOKEN)).toBeInTheDocument();
  });

  it("reads out a correction and lights nothing", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    const wrong = PUZZLE.solution[FIRST_EMPTY] === 1 ? 0 : 1;

    fireEvent.click(cellAt(container, FIRST_EMPTY));
    if (cellAt(container, FIRST_EMPTY).textContent !== String(wrong)) {
      fireEvent.click(cellAt(container, FIRST_EMPTY));
    }
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe(String(wrong));
    fireEvent.click(
      screen.getByText(messages.play.hint.available(FREE_HINTS_PER_PUZZLE)),
    );

    expect(
      screen.getByText(
        messages.games.binairo.play.hint.explain.correction,
        SPOKEN,
      ),
    ).toBeInTheDocument();
    expect(spotlit(container)).toEqual([]);
  });
});

describe("the free hints (T-WEB-9)", () => {
  it("fills one cell per free hint, then renders the exhausted variant", () => {
    render(<BinairoScreen daily={DAILY} />);

    spendFreeHints();

    expect(
      screen.getByText(
        messages.games.binairo.play.progressLong(
          GIVENS_COUNT + FREE_HINTS_PER_PUZZLE,
          64,
        ),
      ),
    ).toBeInTheDocument();
    const exhausted = screen.getByRole("button", {
      name: messages.play.hint.used,
    });
    expect(exhausted).toHaveAttribute("aria-disabled", "true");

    expect(
      screen.getByText(FREE_SENTENCES.at(-1) ?? "", SPOKEN),
    ).toBeInTheDocument();

    fireEvent.click(exhausted);

    expect(
      screen.getByText(
        messages.games.binairo.play.progressLong(
          GIVENS_COUNT + FREE_HINTS_PER_PUZZLE,
          64,
        ),
      ),
    ).toBeInTheDocument();
  });
});

describe("closing the grid (T-WEB-9b)", () => {
  it("swaps the conclusion in place, with no navigation at all", async () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    solveByClicking(container);

    await act(async () => {
      await import("../src/play/conclusion-view");
    });
    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "result",
    );
    expect(
      screen.getByText(messages.conclusion.stampLabel),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-cell-index]")).toBeNull();

    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(sync.flushPendingCompletions).toHaveBeenCalled();
  });

  it("hands the completion it just built to the flush, not just the store", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    solveByClicking(container);

    const [queued] = sync.flushPendingCompletions.mock.calls.at(-1) ?? [];
    expect(queued).toMatchObject({
      game: "binairo",
      date: DATE,
      concluded: true,
      pendingSync: true,
    });
  });

  it("never claims the result is stranded on the device while it is online", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    solveByClicking(container);

    expect(
      screen.queryByText(messages.conclusion.sync.pending),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(messages.conclusion.sync.rejected),
    ).not.toBeInTheDocument();
  });
});

describe("the count-up clock's visibility rules (T-WEB-9e)", () => {
  function hideDocument(): void {
    vi.spyOn(Document.prototype, "visibilityState", "get").mockReturnValue(
      "hidden",
    );
  }

  it("stays paused when a pageshow lands in a tab that was born hidden", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    hideDocument();

    render(<BinairoScreen daily={DAILY} />);

    act(() => {
      window.dispatchEvent(new Event("pageshow"));
      vi.advanceTimersByTime(120_000);
    });

    expect(
      screen.getAllByLabelText(messages.play.timerAria("00:00")),
    ).toHaveLength(2);
  });

  it("still resumes on a bfcache restore into a visible tab", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });

    render(<BinairoScreen daily={DAILY} />);

    act(() => {
      window.dispatchEvent(new Event("pageshow"));
      vi.advanceTimersByTime(5_000);
    });

    expect(
      screen.getAllByLabelText(messages.play.timerAria("00:05")),
    ).toHaveLength(2);
  });
});

describe("a second tab still playing (T-WEB-9f)", () => {
  it("never overwrites a completion another mount has queued", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    const queuedCompletion = concludedRecord({
      pendingSync: true,
      syncOutcome: "pending",
    });
    writePlayRecord(queuedCompletion);

    fireEvent.click(cellAt(container, FIRST_EMPTY));

    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      concluded: true,
      pendingSync: true,
      grid: [...PUZZLE.solution],
    });
  });

  it("never overwrites one on the way out of the page either", () => {
    render(<BinairoScreen daily={DAILY} />);
    writePlayRecord(
      concludedRecord({ pendingSync: true, syncOutcome: "pending" }),
    );

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      concluded: true,
      pendingSync: true,
      grid: [...PUZZLE.solution],
    });
  });
});

describe("re-entering a finished day (T-WEB-9c)", () => {
  it("restores straight into the conclusion, with the clock stopped", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    const record = concludedRecord();
    window.localStorage.setItem(
      playRecordKey("binairo", DATE),
      JSON.stringify(record),
    );

    const { container } = render(<BinairoScreen daily={DAILY} />);

    const frame = container.querySelector("[data-conclusion-state]");
    expect(frame).not.toBeNull();
    expect(frame?.childElementCount).toBeGreaterThan(0);
    expect(container.querySelector("[data-cell-index]")).toBeNull();

    await act(async () => {
      await import("../src/play/conclusion-view");
    });

    const stamped = messages.conclusion.stampAria(
      messages.games.binairo.conclusion.title,

      formatElapsed(record.elapsedMs),
      record.hintsUsed,
    );
    expect(container.querySelector("[data-cell-index]")).toBeNull();
    expect(screen.getByLabelText(stamped)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByLabelText(stamped)).toBeInTheDocument();

    expect(sync.flushPendingCompletions).not.toHaveBeenCalled();
  });
});

describe("the first paint (T-WEB-9d)", () => {
  it("is a board-shaped skeleton: no record, no clock, no live affordance", () => {
    writePlayRecord(concludedRecord());
    const readStorage = vi.spyOn(Storage.prototype, "getItem");

    const markup = renderToStaticMarkup(<BinairoScreen daily={DAILY} />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(markup).toContain('data-play-state="skeleton"');

    expect(markup).not.toContain("00:00");
    expect(markup).not.toContain(
      messages.games.binairo.play.progressLong(GIVENS_COUNT, 64),
    );
    expect(markup).not.toContain(
      messages.play.hint.available(FREE_HINTS_PER_PUZZLE),
    );
    expect(markup).not.toContain("<button");

    expect(markup).not.toContain(messages.conclusion.stampLabel);
  });

  it("paints no cell before the record has been read", () => {
    const markup = renderToStaticMarkup(<BinairoScreen daily={DAILY} />);

    expect(markup).toContain(messages.games.binairo.play.title);
    expect(markup).toContain(messages.games.binairo.play.rules);
    expect(markup).not.toContain("data-cell-index");
  });

  it("reserves every box the play shell occupies, so nothing moves", () => {
    const skeleton = parsed(
      renderToStaticMarkup(<BinairoScreen daily={DAILY} />),
    );
    const { container: hydrated } = render(<BinairoScreen daily={DAILY} />);

    expect(occupantsIn(hydrated)).toEqual(
      expect.arrayContaining(["board", "hint", "statsCard"]),
    );
    expect(occupantsIn(skeleton)).toEqual(occupantsIn(hydrated));

    expect(skeleton.querySelector(`.${className("controls")}`)).not.toBeNull();
  });

  it("reserves them without a value, a control or a tab stop", () => {
    const skeleton = parsed(
      renderToStaticMarkup(<BinairoScreen daily={DAILY} />),
    );

    for (const readout of BLANK_READOUTS) {
      expect(
        skeleton.querySelector(`.${className(readout)}`)?.textContent,
      ).toBe(BLANK);
    }

    expect(
      skeleton.querySelectorAll("button, a[href], [tabindex]"),
    ).toHaveLength(1);
  });
});

describe("the board and controls track the board side (layout tripwires)", () => {
  const MOBILE = bodyOf(GAME_CSS, "@media (max-width: 768px)");

  it("sizes the board fluidly at every width, never from a fixed track", () => {
    const grid = bodyOf(GAME_CSS, ".grid");

    expect(decl(grid, "grid-template-columns")).toBe(
      "repeat(8, minmax(0, 1fr))",
    );
    expect(decl(bodyOf(GAME_CSS, ".cell"), "aspect-ratio")).toBe("1");
    expect(decl(bodyOf(GAME_CSS, ".pageBinairo"), "--board-max")).toMatch(
      /^\d+px$/,
    );
  });

  it("gives the control row the board's width so its flex ratios apply", () => {
    expect(decl(bodyOf(GAME_CSS, ".controls"), "width")).toBe(
      "var(--board-side)",
    );
    expect(decl(bodyOf(MOBILE, ".controlDigit"), "flex")).toBe("1");
  });

  it("leaves every control clear of the 44px touch target at the board floor", () => {
    const digits = bodyOf(MOBILE, ".digits");
    const minimum = token("--touch-target-min");
    const digit = (boardFloor() - pixels(decl(digits, "gap"))) / 2;

    expect(digit).toBeGreaterThanOrEqual(minimum);
    expect(
      pixels(decl(bodyOf(MOBILE, ".controlDigit"), "height")),
    ).toBeGreaterThanOrEqual(minimum);
  });

  it("reserves the control row under the card, desktop and phone", () => {
    const desktop = decl(bodyOf(GAME_CSS, ".pageBinairo"), "--board-below");
    const phone = decl(bodyOf(MOBILE, ".pageBinairo"), "--board-below");
    const height = pixels(decl(bodyOf(MOBILE, ".controlDigit"), "height"));

    expect(desktop).toBe("calc(var(--space-6) + 52px)");
    expect(phone).toBe(`calc(var(--space-4) + ${String(height)}px)`);
  });
});

describe("the mouse affordance (T-WEB-S499a)", () => {
  it("shows the affordance only where a fine pointer can hover", () => {
    const base = bodyOf(GAME_CSS, ".affordance");
    const fine = bodyOf(GAME_CSS, "@media (hover: hover) and (pointer: fine)");

    expect(decl(base, "display")).toBe("none");
    expect(decl(bodyOf(fine, ".affordance"), "display")).not.toBe("none");
  });

  it("is reserved by the skeleton as well, as the (i) ring", () => {
    const html = renderToStaticMarkup(<BinairoScreen daily={DAILY} />);

    expect(html).toContain(`class="${tipStyles.button ?? ""}"`);
  });
});

describe("Primeiro valor in Ajustes turns the board's order around (T-WEB-S609)", () => {
  const copy = messages.settings.games;

  function press(
    container: HTMLElement,
    index: number,
    init: { readonly button: number; readonly pointerType: string },
  ): void {
    const grid = gridOf(container);
    const at = { clientX: index, clientY: 0, pointerId: 1, ...init };
    fireEvent.pointerDown(grid, at);
    fireEvent.pointerUp(grid, at);
  }

  it("offers 1 and 0 under Binairo, with 1 checked by default", () => {
    render(<GamesSection />);
    const binairo = screen.getByRole("group", { name: "Binairo" });
    const choice = within(binairo).getByRole("radiogroup", {
      name: copy.flags.firstValue.label,
    });

    expect(choice).toHaveAccessibleDescription(copy.flags.firstValue.hint);
    expect(
      within(choice)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("value")),
    ).toEqual(["1", "0"]);
    expect(within(choice).getByRole("radio", { name: "1" })).toBeChecked();
  });

  it("saves 0 on this device and a mounted board taps, clicks and reads 0 first", () => {
    const { container } = render(
      <>
        <BinairoScreen daily={DAILY} />
        <GamesSection />
      </>,
    );
    stubElementFromPoint(container);
    expect(
      screen.getByText(messages.games.binairo.play.controls.affordance(1)),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "0" }));

    expect(
      JSON.parse(localStorage.getItem("miolos-settings") ?? "{}"),
    ).toMatchObject({ games: { binairo: { firstValue: 0 } } });
    expect(screen.getByRole("radio", { name: "0" })).toBeChecked();
    expect(
      screen.getByText(messages.games.binairo.play.controls.affordance(0)),
    ).toBeInTheDocument();

    press(container, FIRST_EMPTY, { button: 0, pointerType: "touch" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");
    press(container, FIRST_EMPTY, { button: 0, pointerType: "touch" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("1");
    press(container, FIRST_EMPTY, { button: 0, pointerType: "touch" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");

    press(container, FIRST_EMPTY, { button: 0, pointerType: "mouse" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");
    press(container, FIRST_EMPTY, { button: 2, pointerType: "mouse" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("1");
  });

  it("names the brush's order while a digit brush is on", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    const { affordance, zeroAria } = messages.games.binairo.play.controls;

    fireEvent.click(screen.getByLabelText(zeroAria));
    expect(screen.getByText(affordance(0))).toBeInTheDocument();
    press(container, FIRST_EMPTY, { button: 0, pointerType: "mouse" });
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");

    fireEvent.click(screen.getByLabelText(zeroAria));
    expect(screen.getByText(affordance(1))).toBeInTheDocument();
  });
});
