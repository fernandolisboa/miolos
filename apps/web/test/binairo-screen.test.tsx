import type { DailyPuzzleResponse } from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BinairoScreen } from "../src/binairo/binairo-screen";
import {
  playRecordKey,
  writePlayRecord,
  type PlayRecord,
} from "../src/binairo/play-record";
import { formatElapsed, messages } from "../src/i18n";

// T-WEB-5..T-WEB-9d (plan 017 §15). UI composition is not TDD-shaped, so
// these are smoke tests written after the screens; every assertion goes
// through `messages.*` rather than a literal, except the two deliberate
// tripwires (the frame's shorter rules sentence, and "dias seguidos").

// The queue is proved by binairo-sync.test.ts with no screen mounted; here
// it is stubbed so the composition tests never touch the network and
// "no POST is issued" is an assertion rather than an absence.
const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/binairo/sync", () => sync);

// D26's guarantee is that the conclusion needs NO navigation — so the
// router is mocked purely to prove it is never asked to do anything.
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

const DAILY: DailyPuzzleResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...PUZZLE.givens],
};

// jsdom implements no layout, so `elementFromPoint` does not exist on the
// document at all and `vi.spyOn` has nothing to replace. Define it once here
// so the drag tests can stub it and `restoreAllMocks` can put it back.
Object.defineProperty(document, "elementFromPoint", {
  configurable: true,
  writable: true,
  value: () => null,
});

function cellAt(container: HTMLElement, index: number): HTMLElement {
  const cell = container.querySelector<HTMLElement>(
    `[data-cell-index="${index}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${index}`);
  }
  return cell;
}

/** Cycle every non-given cell up to its solution value (D7: null → 0 → 1). */
function solveByClicking(container: HTMLElement): void {
  for (const [index, given] of PUZZLE.givens.entries()) {
    if (given !== null) {
      continue;
    }
    fireEvent.click(cellAt(container, index));
    if (PUZZLE.solution[index] === 1) {
      fireEvent.click(cellAt(container, index));
    }
  }
}

function concludedRecord(overrides: Partial<PlayRecord> = {}): PlayRecord {
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

    expect(screen.getByText(messages.binairo.rules)).toBeInTheDocument();
    // Deliberate literal tripwire: F3 says only "nenhuma linha se repete",
    // and ADR-0020 rule 4 covers both axes (deviation 1). Shipping the
    // frame's wording would teach a rule the engine does not enforce.
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
    expect(givenCell.tagName).toBe("DIV");
    expect(givenCell).toHaveAttribute("aria-disabled", "true");
    expect(givenCell).toHaveAttribute(
      "aria-label",
      messages.binairo.cellGivenAria(
        Math.floor(FIRST_GIVEN / 8) + 1,
        (FIRST_GIVEN % 8) + 1,
        given,
      ),
    );
  });

  it("renders BOTH readout pairs, because the reflow crosses subtrees", () => {
    render(<BinairoScreen daily={DAILY} />);

    // Two timer nodes and two progress nodes exist in one DOM: `display:
    // none` in the module hides exactly one of each pair per viewport (and
    // removes it from the accessibility tree), which jsdom cannot evaluate
    // because it has no media queries (plan 017 §12.2).
    expect(
      screen.getAllByLabelText(messages.binairo.timerAria("00:00")),
    ).toHaveLength(2);
    expect(
      screen.getByText(messages.binairo.progressShort(GIVENS_COUNT, 64)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.binairo.progressLong(GIVENS_COUNT, 64)),
    ).toBeInTheDocument();
  });

  it("keeps the <h1> the first element child of its wrapper", () => {
    render(<BinairoScreen daily={DAILY} />);

    // Structural, not stylistic: impeccable's hero-eyebrow-chip and
    // kicker-above-heading rules both anchor on `h1.previousElementSibling`
    // and both return on their first guard when it is null (§12.2).
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
  it("cycles a playable cell empty → 0 → 1 → empty", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("1");
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });

  it("never changes a given", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    const before = cellAt(container, FIRST_GIVEN).textContent;

    fireEvent.click(cellAt(container, FIRST_GIVEN));

    expect(cellAt(container, FIRST_GIVEN).textContent).toBe(before);
    expect(
      screen.getByText(messages.binairo.progressLong(GIVENS_COUNT, 64)),
    ).toBeInTheDocument();
  });
});

describe("paint mode (T-WEB-8)", () => {
  it("is sticky, writes directly, and toggles back off", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    const zero = screen.getByLabelText(messages.binairo.controls.zeroAria);

    expect(zero).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(zero);
    expect(zero).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");

    fireEvent.click(zero);
    expect(zero).toHaveAttribute("aria-pressed", "false");
  });

  it("clears a cell in erase mode", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");

    fireEvent.click(screen.getByLabelText(messages.binairo.controls.eraseAria));
    fireEvent.click(cellAt(container, FIRST_EMPTY));

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });
});

describe("the drag path (T-WEB-8b)", () => {
  /** The cells to cross, chosen from the fixture's playable indices. */
  function playableTriple(): [number, number, number] {
    const playable = PUZZLE.givens.flatMap((given, index) =>
      given === null ? [index] : [],
    );
    const [first, second, third] = playable;
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error("the fixture puzzle has fewer than three empty cells");
    }
    return [first, second, third];
  }

  /**
   * `elementFromPoint` is the ONLY way to know which cell a drag is over:
   * with pointer capture — and on touch generally — `pointerenter` never
   * fires on the cells being crossed (§8.2). The stub maps clientX straight
   * to a cell index.
   */
  function stubElementFromPoint(container: HTMLElement): void {
    vi.spyOn(document, "elementFromPoint").mockImplementation((x: number) =>
      container.querySelector(`[data-cell-index="${x}"]`),
    );
  }

  it("paints every crossed cell in paint mode", () => {
    const [a, b, c] = playableTriple();
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    fireEvent.click(screen.getByLabelText(messages.binairo.controls.oneAria));
    const grid = cellAt(container, a).parentElement;
    if (grid === null) {
      throw new Error("the grid container is missing");
    }

    fireEvent.pointerDown(grid, { clientX: a, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: b, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: c, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(grid, { clientX: c, clientY: 0, pointerId: 1 });

    for (const index of [a, b, c]) {
      expect(cellAt(container, index).textContent).toBe("1");
    }
  });

  it("paints nothing in cycle mode — cycling on drag is chaos (D8)", () => {
    const [a, b, c] = playableTriple();
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    const grid = cellAt(container, a).parentElement;
    if (grid === null) {
      throw new Error("the grid container is missing");
    }

    fireEvent.pointerDown(grid, { clientX: a, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: b, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: c, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(grid, { clientX: c, clientY: 0, pointerId: 1 });

    for (const index of [a, b, c]) {
      expect(cellAt(container, index).textContent).toBe("");
    }
  });
});

describe("the one free hint (T-WEB-9)", () => {
  it("fills exactly one cell, then renders the exhausted variant", () => {
    render(<BinairoScreen daily={DAILY} />);

    fireEvent.click(screen.getByText(messages.binairo.hint.available));

    expect(
      screen.getByText(messages.binairo.progressLong(GIVENS_COUNT + 1, 64)),
    ).toBeInTheDocument();
    const exhausted = screen.getByText(messages.binairo.hint.used);
    expect(exhausted).toHaveAttribute("aria-disabled", "true");
    // The one-line explanation names which case fired (§10.2). An empty
    // fixture grid has no contradiction yet, so it is always a fill.
    expect(
      screen.getByText(messages.binairo.hint.explain.fill),
    ).toBeInTheDocument();

    fireEvent.click(exhausted);

    expect(
      screen.getByText(messages.binairo.progressLong(GIVENS_COUNT + 1, 64)),
    ).toBeInTheDocument();
  });
});

describe("closing the grid (T-WEB-9b)", () => {
  it("swaps the conclusion in place, with no navigation at all", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    solveByClicking(container);

    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "result",
    );
    expect(screen.getByText(messages.conclusao.stampLabel)).toBeInTheDocument();
    expect(container.querySelector("[data-cell-index]")).toBeNull();
    // The offline guarantee (D26): a force-dynamic route with no service
    // worker is unreachable offline, so the conclusion never navigates.
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(sync.flushPendingCompletions).toHaveBeenCalled();
  });
});

describe("re-entering a finished day (T-WEB-9c)", () => {
  it("restores straight into the conclusion, with the clock stopped", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    const record = concludedRecord();
    window.localStorage.setItem(
      playRecordKey("binairo", DATE),
      JSON.stringify(record),
    );

    const { container } = render(<BinairoScreen daily={DAILY} />);

    // The stamp's own composed label, not `getByText`: the day card repeats
    // the same time in the Binairo chip.
    const stamped = messages.conclusao.stampAria(
      formatElapsed(record.elapsedMs),
      record.hintsUsed,
    );
    expect(container.querySelector("[data-cell-index]")).toBeNull();
    expect(screen.getByLabelText(stamped)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    // The timer never started: five seconds later the stamp reads the same.
    expect(screen.getByLabelText(stamped)).toBeInTheDocument();
    // And the completion is never re-queued — the row is write-once
    // server-side, and re-posting would resurrect a settled sync (D15).
    expect(sync.flushPendingCompletions).not.toHaveBeenCalled();
  });
});

describe("the first paint (T-WEB-9d)", () => {
  it("is deterministic: givens only, 00:00, no record and no clock", () => {
    writePlayRecord(concludedRecord());
    const readStorage = vi.spyOn(Storage.prototype, "getItem");

    // The server render is the first paint by definition — no effects run,
    // so this is exactly the markup the client hydrates against (D28).
    const markup = renderToStaticMarkup(<BinairoScreen daily={DAILY} />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(markup).toContain("00:00");
    expect(markup).toContain(messages.binairo.progressLong(GIVENS_COUNT, 64));
    // Not the conclusion, even though a concluded record is sitting in
    // storage: nothing record-derived may reach the first paint.
    expect(markup).not.toContain(messages.conclusao.stampLabel);
  });
});
