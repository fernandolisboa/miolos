import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DailyUnavailable } from "../src/components/daily-unavailable";
import { formatElapsed, messages } from "../src/i18n";
import { playRecordKey, type SudokuPlayRecord } from "../src/play/play-record";
import sharedStyles from "../src/play/screen.module.css";
import { solutionDigits, track } from "../src/sudoku/engine";
import type { SudokuDigit } from "../src/sudoku/state";
import styles from "../src/sudoku/sudoku-board.module.css";
import { SudokuScreen } from "../src/sudoku/sudoku-screen";
import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";

// T-WEB-S25..S31 and T-WEB-S34 (plan 018 §15). UI composition is not
// TDD-shaped, so these are smoke tests written after the screens; every
// assertion goes through `messages.*` rather than a literal.

// The queue is proved by play-sync.test.ts with no screen mounted; here it is
// stubbed so the composition tests never touch the network and "no POST is
// issued" is an assertion rather than an absence.
const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  // The argument is echoed back rather than dropped: the solved effect hands
  // the completion it just built to the flush, and that is what the queue
  // falls back on where `localStorage` is unavailable.
  flushPendingCompletions: vi.fn((record?: SudokuPlayRecord) =>
    Promise.resolve(record),
  ),
}));
vi.mock("../src/play/sync", () => sync);

// D26's guarantee is that the conclusion needs NO navigation — so the router
// is mocked purely to prove it is never asked to do anything.
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/sudoku",
}));

const DATE = "2026-08-01";
const SIDE = 9;
const TOTAL_CELLS = 81;

// Weekday 1 is tier 1, the cheapest rung of SUDOKU_WEEKDAY_CRITERIA (~0.7 ms
// per generation, plan 018 §19.6) — and it runs once, at module scope.
const PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: PUZZLE.givens,
  tier: PUZZLE.tier,
});

const LEVEL = messages.games.sudoku.play.level(DAILY.tier);

/** How many cells the board starts with filled — the S6 trap's real number. */
const CLUE_COUNT = PUZZLE.givens.filter((cell) => cell !== 0).length;

const FIRST_EMPTY = PUZZLE.givens.indexOf(0);
const FIRST_GIVEN = PUZZLE.givens.findIndex((cell) => cell !== 0);

/** The solution as digits, narrowed by a throw rather than by a cast. */
function solutionOf(): readonly SudokuDigit[] {
  const digits = solutionDigits(PUZZLE.givens);
  if (digits === null) {
    throw new Error("a published daily is uniquely solvable by construction");
  }
  return digits;
}

const SOLUTION = solutionOf();

function cellAt(container: HTMLElement, index: number): HTMLElement {
  const cell = container.querySelector<HTMLElement>(
    `[data-cell-index="${index}"]`,
  );
  if (cell === null) {
    throw new Error(`no cell at index ${index}`);
  }
  return cell;
}

/** The composite widget itself — one tab stop, one keyboard listener. */
function boardOf(): HTMLElement {
  return screen.getByRole("group", {
    name: messages.games.sudoku.play.boardAria,
  });
}

/** The index of the one cell carrying the roving `tabindex="0"` (ADR-0030). */
function caretIndex(container: HTMLElement): number {
  const tabbable = container.querySelectorAll<HTMLElement>(
    '[data-cell-index][tabindex="0"]',
  );
  expect(tabbable).toHaveLength(1);
  return Number(tabbable[0]?.dataset.cellIndex);
}

/** Select a cell, then write `digit` through the board's own listener. */
function type(container: HTMLElement, index: number, key: string): void {
  fireEvent.click(cellAt(container, index));
  fireEvent.keyDown(boardOf(), { key });
}

/** Fill every playable cell with its solution digit. */
function solveByTyping(container: HTMLElement): void {
  for (const [index, given] of PUZZLE.givens.entries()) {
    if (given !== 0) {
      continue;
    }
    type(container, index, String(SOLUTION[index]));
  }
}

function concludedRecord(
  overrides: Partial<SudokuPlayRecord> = {},
): SudokuPlayRecord {
  // Mutable by inference, because the schema's `entries` is: `z.infer` of a
  // `z.array` is never `readonly`, and a `readonly` annotation here would not
  // be assignable to it.
  const entries = PUZZLE.givens.map((given, index) =>
    given === 0 ? (SOLUTION[index] ?? null) : null,
  );
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries,
    grid: [...SOLUTION],
    elapsedMs: 272_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

/** The two sheets the play screen is split across (plan 018 §5.5). */
const GAME_CSS = stylesheet("src/sudoku/sudoku-board.module.css");
const SHARED_CSS = stylesheet("src/play/screen.module.css");

/** Does this sheet DECLARE `.local` — not `.localSomething`? */
function declares(css: string, local: string): boolean {
  return new RegExp(`(?:^|[\\s,])\\.${local}(?![\\w-])`, "m").test(css);
}

/**
 * A CSS Module class, refused rather than silently wrong. Which sheet to ask
 * is decided from the CSS TEXT, not by a lookup: CSS Modules hash per file,
 * and the test runner hands back a per-module proxy that answers EVERY key
 * with a hashed name — so `styles[local] ?? shared[local]` would return the
 * game module's hash for a class only the shared sheet declares, and every
 * `querySelector` below would silently miss (plan 018 §5.5, landmine 24).
 */
function className(local: string): string {
  const generated = declares(GAME_CSS, local)
    ? styles[local]
    : declares(SHARED_CSS, local)
      ? sharedStyles[local]
      : undefined;
  if (generated === undefined) {
    throw new Error(
      `neither sudoku-board.module.css nor play/screen.module.css declares .${local}`,
    );
  }
  return generated;
}

/**
 * Every class the stylesheets place in one of `.page`'s named grid areas —
 * read off the CSS rather than listed here, so a new area added to `PlayView`
 * puts itself under the skeleton tripwire below without anyone remembering to.
 */
const GRID_AREA_CLASSES = [
  ...new Set(
    [GAME_CSS, SHARED_CSS]
      .flatMap((sheet) => [...sheet.matchAll(/^\.(\w+)[^{]*\{([^}]*)\}/gm)])
      .filter(([, , body]) => /(?:^|;)\s*grid-area\s*:/.test(body ?? ""))
      .map(([, local]) => local ?? ""),
  ),
];

/** Server markup as a DOM, so it can be queried the way a browser would. */
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

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the board and its readouts (T-WEB-S25)", () => {
  it("states every rule the engine enforces — rows, columns AND 3×3 blocks", () => {
    render(<SudokuScreen daily={DAILY} />);

    const rules = messages.games.sudoku.play.rules;
    expect(screen.getByText(rules)).toBeInTheDocument();
    // Deliberate literal tripwire: a blurb that omits the block rule teaches
    // a game the engine does not enforce (the binairo deviation-1
    // precedent). These three clauses are the whole of Sudoku.
    expect(rules).toContain("linha");
    expect(rules).toContain("coluna");
    expect(rules).toContain("3×3");
  });

  it("renders 81 cells, with givens focusable, aria-disabled and named as fixed", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);

    expect(container.querySelectorAll("[data-cell-index]")).toHaveLength(
      TOTAL_CELLS,
    );

    const given = PUZZLE.givens[FIRST_GIVEN];
    if (given === undefined || given === 0) {
      throw new Error("the fixture puzzle has no givens");
    }
    const givenCell = cellAt(container, FIRST_GIVEN);
    // A button, not an inert div: the caret has to be able to cross a given,
    // and `disabled` would make it unreachable (ADR-0030 decision 4).
    expect(givenCell.tagName).toBe("BUTTON");
    expect(givenCell).toHaveAttribute("aria-disabled", "true");
    expect(givenCell).toHaveAttribute(
      "aria-label",
      messages.games.sudoku.play.cellGivenAria(
        Math.floor(FIRST_GIVEN / SIDE) + 1,
        (FIRST_GIVEN % SIDE) + 1,
        given,
      ),
    );
  });

  it("renders BOTH readout pairs, because the reflow crosses subtrees", () => {
    render(<SudokuScreen daily={DAILY} />);

    // Two timer nodes and two progress nodes exist in one DOM: `display:
    // none` in the module hides exactly one of each pair per viewport (and
    // removes it from the accessibility tree), which jsdom cannot evaluate
    // because it has no media queries.
    expect(
      screen.getAllByLabelText(messages.play.timerAria("00:00")),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        messages.games.sudoku.play.progressShort(
          LEVEL,
          CLUE_COUNT,
          TOTAL_CELLS,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.games.sudoku.play.progressLong(CLUE_COUNT, TOTAL_CELLS),
      ),
    ).toBeInTheDocument();
  });

  it("reports the CLUE COUNT filled on a fresh board, never 81 of 81", () => {
    render(<SudokuScreen daily={DAILY} />);

    // The S6 trap (landmine 22): `countFilled` tests
    // `(given ?? entries[i] ?? null) !== null`, and `0` is NOT nullish — fed
    // the raw SudokuGrid it reports every empty cell as filled and the
    // readout says "81 de 81" from the first paint. Only
    // `playableGivens(givens)` prevents it.
    expect(CLUE_COUNT).toBeLessThan(TOTAL_CELLS);
    expect(
      screen.queryByText(
        messages.games.sudoku.play.progressLong(TOTAL_CELLS, TOTAL_CELLS),
      ),
    ).not.toBeInTheDocument();
  });

  it("renders the Nível readout on both viewports (§12.5)", () => {
    render(<SudokuScreen daily={DAILY} />);

    // Desktop: its own third `.statRow`. Mobile: folded into `.progressBar`,
    // because a desktop-only difficulty would make S10's case for shipping
    // `tier` over the wire half-true.
    expect(
      screen.getByText(messages.games.sudoku.play.levelLabel),
    ).toBeInTheDocument();
    expect(screen.getByText(LEVEL)).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.games.sudoku.play.progressShort(
          LEVEL,
          CLUE_COUNT,
          TOTAL_CELLS,
        ),
      ),
    ).toBeInTheDocument();
  });
});

describe("the impeccable structural guard (T-WEB-S26)", () => {
  /**
   * What actually stands impeccable's two rules down, asserted rather than
   * assumed: `checkHeroEyebrow` returns on `text.length < 2` and
   * `isKickerCandidate` on its own text gate, so an h1 whose previous element
   * sibling carries NO TEXT can fire neither
   * (node_modules/impeccable/cli/engine/rules/checks.mjs:428, :2501).
   */
  function assertNoEyebrowAboveHeadings(root: ParentNode): void {
    const headings = [...root.querySelectorAll("h1")];
    expect(headings.length).toBeGreaterThan(0);
    for (const heading of headings) {
      expect(heading.previousElementSibling?.textContent ?? "").toBe("");
    }
  }

  /** The stronger form: the wrapper this ticket's own screens ship for it. */
  function assertHeadingIsFirstChild(root: ParentNode): void {
    const heading = root.querySelector("h1");
    expect(heading).not.toBeNull();
    expect(heading?.previousElementSibling).toBeNull();
    expect(heading?.parentElement?.firstElementChild).toBe(heading);
  }

  it("holds in PlayView and in PlaySkeleton, by the .titleRow wrapper", () => {
    // Structural, not stylistic (§12.4). At 1440 the h1 is 54px ≥ 48 so the
    // hero rule would fire; at 390 it is 34px so the kicker rule fires
    // instead. No card wrapper, no `data-impeccable-allow-kickers` and no
    // `display: none` saves either one — only the structure does.
    const skeleton = parsed(
      renderToStaticMarkup(<SudokuScreen daily={DAILY} />),
    );
    assertHeadingIsFirstChild(skeleton);
    assertNoEyebrowAboveHeadings(skeleton);

    const { container: play } = render(<SudokuScreen daily={DAILY} />);
    assertHeadingIsFirstChild(play);
    assertNoEyebrowAboveHeadings(play);
  });

  it("holds in DailyUnavailable and in the conclusion", () => {
    const { container: unavailable } = render(
      <DailyUnavailable copy={messages.games.sudoku.play.unavailable} />,
    );
    // DailyUnavailable's h1 follows its `aria-hidden` tape rather than
    // nothing — shipped #18 markup this ticket does not touch. The tape has
    // no text, so both rules still return on their first guard; asserting
    // `=== null` here would be asserting something the code does not do.
    assertNoEyebrowAboveHeadings(unavailable);

    window.localStorage.setItem(
      playRecordKey("sudoku", DATE),
      JSON.stringify(concludedRecord()),
    );
    const { container: conclusion } = render(<SudokuScreen daily={DAILY} />);
    expect(conclusion.querySelector("[data-conclusion-state]")).not.toBeNull();
    assertHeadingIsFirstChild(conclusion);
    assertNoEyebrowAboveHeadings(conclusion);
  });
});

describe("writing with the keypad (T-WEB-S27)", () => {
  it("writes at the selected cell, and re-tapping the same digit clears it", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const seven = screen.getByLabelText(
      messages.games.sudoku.play.keypad.digitAria(7),
    );

    // Cell-first (S3): nothing is written until a cell is selected.
    fireEvent.click(seven);
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");

    fireEvent.click(cellAt(container, FIRST_EMPTY));
    fireEvent.click(seven);
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("7");

    // A one-tap undo, mirroring Binairo's "re-tapping clears" (D8).
    fireEvent.click(seven);
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });

  it("clears the selected cell with apagar", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);

    fireEvent.click(cellAt(container, FIRST_EMPTY));
    fireEvent.click(
      screen.getByLabelText(messages.games.sudoku.play.keypad.digitAria(4)),
    );
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("4");

    fireEvent.click(
      screen.getByLabelText(messages.games.sudoku.play.keypad.eraseAria),
    );

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });

  it("never changes a given", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const before = cellAt(container, FIRST_GIVEN).textContent;

    fireEvent.click(cellAt(container, FIRST_GIVEN));
    fireEvent.click(
      screen.getByLabelText(messages.games.sudoku.play.keypad.digitAria(5)),
    );
    fireEvent.click(
      screen.getByLabelText(messages.games.sudoku.play.keypad.eraseAria),
    );

    expect(cellAt(container, FIRST_GIVEN).textContent).toBe(before);
    expect(
      screen.getByText(
        messages.games.sudoku.play.progressLong(CLUE_COUNT, TOTAL_CELLS),
      ),
    ).toBeInTheDocument();
  });

  it("names a repeating cell with the copy module's composed string", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    // The first empty cell's row already holds a given; writing that digit
    // makes both cells participate in a duplicate.
    const row = Math.floor(FIRST_EMPTY / SIDE);
    const clash = PUZZLE.givens
      .slice(row * SIDE, row * SIDE + SIDE)
      .find((cell) => cell !== 0);
    if (clash === undefined) {
      throw new Error("the fixture puzzle has a row with no givens");
    }

    type(container, FIRST_EMPTY, String(clash));

    // The WHOLE accessible name comes from messages.ts, separator included:
    // it is user-facing copy, and a component is not where copy is composed
    // (ADR-0018). `aria-invalid` is unavailable on role=button.
    expect(cellAt(container, FIRST_EMPTY)).toHaveAttribute(
      "aria-label",
      messages.games.sudoku.play.cellInvalidAria(
        row + 1,
        (FIRST_EMPTY % SIDE) + 1,
        clash,
      ),
    );
    expect(cellAt(container, FIRST_EMPTY)).not.toHaveAttribute("aria-invalid");
  });
});

describe("the one free hint (T-WEB-S28a)", () => {
  it("fills exactly one cell, then renders the exhausted variant", () => {
    render(<SudokuScreen daily={DAILY} />);

    fireEvent.click(
      screen.getByText(messages.games.sudoku.play.hint.available),
    );

    expect(
      screen.getByText(
        messages.games.sudoku.play.progressLong(CLUE_COUNT + 1, TOTAL_CELLS),
      ),
    ).toBeInTheDocument();
    const exhausted = screen.getByText(messages.games.sudoku.play.hint.used);
    expect(exhausted).toHaveAttribute("aria-disabled", "true");
    // The one-line explanation names which case fired. An untouched board has
    // no contradiction yet, so it is always a fill.
    expect(
      screen.getByText(messages.games.sudoku.play.hint.explain.fill),
    ).toBeInTheDocument();

    fireEvent.click(exhausted);

    expect(
      screen.getByText(
        messages.games.sudoku.play.progressLong(CLUE_COUNT + 1, TOTAL_CELLS),
      ),
    ).toBeInTheDocument();
  });

  it("leaves the caret where the player put it (§8.3)", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(caretIndex(container)).toBe(FIRST_EMPTY);

    fireEvent.click(
      screen.getByText(messages.games.sudoku.play.hint.available),
    );

    // The caret is the player's and the highlight is the app's: moving it
    // would make the hinted cell always also the selected cell, and the
    // `hint-filled` state — the free hint's one visual payload — could never
    // render on its own (review finding D3).
    expect(caretIndex(container)).toBe(FIRST_EMPTY);
  });
});

describe("the keyboard model (T-WEB-S28)", () => {
  it("is one composite widget, not 81 tab stops, and not a role=grid", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);

    const board = boardOf();
    expect(board).toHaveAttribute("role", "group");
    // `role="grid"` needs `role="row"` children, which a flat 81-item CSS
    // grid cannot have without wrappers — and `display: contents` on a
    // role-bearing element is the canonical accessibility-tree-removal bug
    // (ADR-0030 decision 2).
    expect(container.querySelector('[role="grid"]')).toBeNull();
    expect(container.querySelector('[role="row"]')).toBeNull();
    expect(caretIndex(container)).toBe(0);
    expect(
      container.querySelectorAll('[data-cell-index][tabindex="-1"]'),
    ).toHaveLength(TOTAL_CELLS - 1);
  });

  it("moves the caret with the arrows and clamps at all four edges", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const board = boardOf();

    // From no selection at all, any move lands on the first cell.
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(caretIndex(container)).toBe(0);

    fireEvent.keyDown(board, { key: "ArrowRight" });
    fireEvent.keyDown(board, { key: "ArrowDown" });
    expect(caretIndex(container)).toBe(SIDE + 1);

    // Clamped, never wrapped: wrapping from column 9 to column 1 of the next
    // row is disorienting on a boxed grid (§8.3).
    for (const key of ["ArrowUp", "ArrowUp", "ArrowLeft", "ArrowLeft"]) {
      fireEvent.keyDown(board, { key });
    }
    expect(caretIndex(container)).toBe(0);

    fireEvent.click(cellAt(container, TOTAL_CELLS - 1));
    fireEvent.keyDown(board, { key: "ArrowDown" });
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(caretIndex(container)).toBe(TOTAL_CELLS - 1);
  });

  it("jumps to the first and last column of the row with Home and End", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const board = boardOf();

    fireEvent.click(cellAt(container, 4 * SIDE + 5));
    fireEvent.keyDown(board, { key: "Home" });
    expect(caretIndex(container)).toBe(4 * SIDE);

    fireEvent.keyDown(board, { key: "End" });
    expect(caretIndex(container)).toBe(4 * SIDE + SIDE - 1);
  });

  it("writes with 1–9 and clears with 0, Backspace and Delete", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);
    const cell = cellAt(container, FIRST_EMPTY);

    // Every writing key, not a sample: `asDigit` is a nine-case switch and a
    // missing case is invisible until a player hits that digit.
    for (const digit of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      type(container, FIRST_EMPTY, String(digit));
      expect(cell.textContent).toBe(String(digit));
      // Re-entering the same digit clears it, so the next iteration starts
      // from an empty cell (§8.3).
      fireEvent.keyDown(boardOf(), { key: String(digit) });
      expect(cell.textContent).toBe("");
    }

    for (const key of ["0", "Backspace", "Delete"]) {
      type(container, FIRST_EMPTY, "6");
      expect(cell.textContent).toBe("6");
      fireEvent.keyDown(boardOf(), { key });
      expect(cell.textContent).toBe("");
    }
  });

  it("prevents the page from scrolling under the caret", () => {
    render(<SudokuScreen daily={DAILY} />);
    const board = boardOf();

    for (const key of [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
    ]) {
      const event = createEvent.keyDown(board, { key });
      fireEvent(board, event);
      expect(event.defaultPrevented).toBe(true);
    }

    // A key the board does not handle is left entirely alone — Tab out of
    // the widget has to keep working.
    const tab = createEvent.keyDown(board, { key: "Tab" });
    fireEvent(board, tab);
    expect(tab.defaultPrevented).toBe(false);
  });
});

describe("closing the grid (T-WEB-S29)", () => {
  it("swaps the conclusion in place, with no navigation at all", () => {
    const { container } = render(<SudokuScreen daily={DAILY} />);

    solveByTyping(container);

    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "result",
    );
    expect(
      screen.getByText(messages.conclusion.stampLabel),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-cell-index]")).toBeNull();
    // The offline guarantee (D26): a force-dynamic route with no service
    // worker is unreachable offline, so the conclusion never navigates.
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    // Where `localStorage` is unavailable the write is a silent no-op and the
    // queue reads back empty, so a flush with no argument would post nothing
    // at all and the day would be lost (finding
    // `completion-lost-when-localstorage-is-unavailable`).
    const [queued] = sync.flushPendingCompletions.mock.calls.at(-1) ?? [];
    expect(queued).toMatchObject({
      game: "sudoku",
      date: DATE,
      concluded: true,
      pendingSync: true,
      grid: [...SOLUTION],
    });
    // ~41 playable cells × 2 events, each re-rendering 81 cells; ~0.4 s here
    // and CI runners are ~4× slower (commit 271a935), so 30 s is honest
    // margin over vitest's 5 000 ms default.
  }, 30_000);

  it("restores a finished day straight into the conclusion, clock stopped", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    const record = concludedRecord();
    window.localStorage.setItem(
      playRecordKey("sudoku", DATE),
      JSON.stringify(record),
    );

    const { container } = render(<SudokuScreen daily={DAILY} />);

    const stamped = messages.games.sudoku.conclusion.stampAria(
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

describe("the first paint (T-WEB-S30, T-WEB-S31)", () => {
  it("is a board-shaped skeleton: no record, no clock, no live affordance", () => {
    window.localStorage.setItem(
      playRecordKey("sudoku", DATE),
      JSON.stringify(concludedRecord()),
    );
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const clock = vi.spyOn(Date, "now");

    // The server render is the first paint by definition — no effects run, so
    // this is exactly the markup the client hydrates against (D28).
    const markup = renderToStaticMarkup(<SudokuScreen daily={DAILY} />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(markup).toContain('data-play-state="skeleton"');
    // Everything below is derived from a record that has not been read yet.
    expect(markup).not.toContain("00:00");
    expect(markup).not.toContain(
      messages.games.sudoku.play.progressLong(CLUE_COUNT, TOTAL_CELLS),
    );
    expect(markup).not.toContain(messages.games.sudoku.play.hint.available);
    expect(markup).not.toContain("<button");
    // Not the conclusion either, even though a concluded record is sitting in
    // storage: nothing record-derived may reach the first paint.
    expect(markup).not.toContain(messages.conclusion.stampLabel);
    // No caret before the player has touched anything, so hydration cannot
    // find a selection the record contradicts (plan 017 D28).
    expect(markup).not.toContain("data-cell-index");
    expect(markup).not.toContain('tabindex="0"');
  });

  it("still paints the screen's own identity, including the level", () => {
    const markup = renderToStaticMarkup(<SudokuScreen daily={DAILY} />);

    // This says NOTHING about the wire and must not be read as an ADR-0004
    // guard: `daily` is a prop of a "use client" component, so the givens
    // travel in the same response's RSC payload. `tier` is on the wire too
    // (S10), which is exactly why `Nível` does not have to wait.
    expect(markup).toContain(messages.games.sudoku.play.title);
    expect(markup).toContain(messages.games.sudoku.play.rules);
    expect(markup).toContain(LEVEL);
  });

  it("reserves every box the play shell occupies, so nothing moves", () => {
    // jsdom has no layout, so this is the tripwire and not the measurement:
    // `.board` is a centred flex column and the mobile `hint` row is `auto`,
    // so an absent keypad or an absent hint bar hands its height to the board
    // as an OFFSET (finding `play-skeleton-is-not-at-final-dimensions`).
    const skeleton = parsed(
      renderToStaticMarkup(<SudokuScreen daily={DAILY} />),
    );
    const { container: hydrated } = render(<SudokuScreen daily={DAILY} />);

    // Anti-vacuity: `GRID_AREA_CLASSES` is read off the CSS with a regex, and
    // an empty list would make the comparison below pass on nothing.
    expect(occupantsIn(hydrated)).toEqual(
      expect.arrayContaining(["board", "hint", "statsCard"]),
    );
    expect(occupantsIn(skeleton)).toEqual(occupantsIn(hydrated));

    // Not grid areas, and the largest single contributors: both sit INSIDE
    // `.board`, so their absence re-centres the card by half their height.
    for (const [local, count] of [
      ["cell", TOTAL_CELLS],
      ["keypadDigit", 9],
      ["keypadErase", 1],
      ["rule", 4],
    ] as const) {
      expect(skeleton.querySelectorAll(`.${className(local)}`)).toHaveLength(
        count,
      );
      expect(hydrated.querySelectorAll(`.${className(local)}`)).toHaveLength(
        count,
      );
    }
  });

  it("reserves them without a value, a control or a tab stop", () => {
    const skeleton = parsed(
      renderToStaticMarkup(<SudokuScreen daily={DAILY} />),
    );

    // A no-break space is what gives a blank readout its line box, so the
    // card it sits in is the height it will be after hydration.
    for (const readout of [
      "timerBar",
      "timerCard",
      "progressBar",
      "progressCard",
    ]) {
      expect(
        skeleton.querySelector(`.${className(readout)}`)?.textContent,
      ).toBe(" ");
    }
    // The only tab stop in the whole skeleton is the way back out.
    expect(
      skeleton.querySelectorAll("button, a[href], [tabindex]"),
    ).toHaveLength(1);
  });
});

/**
 * The board and keypad arithmetic, read off the stylesheet as TEXT
 * (T-WEB-S34).
 *
 * jsdom implements no layout at all, so nothing above this line can see a
 * board wider than its phone or a sub-44px button. §12.3 and §12.6 do the
 * arithmetic on paper; this re-derives it from the declarations the
 * stylesheet actually ships, so the numbers cannot drift silently.
 */
describe("the board and keypad arithmetic (T-WEB-S34)", () => {
  const MOBILE = bodyOf(GAME_CSS, "@media (max-width: 768px)");
  const SHARED_MOBILE = bodyOf(SHARED_CSS, "@media (max-width: 768px)");
  /** `.page`'s own horizontal padding in this band, both sides. */
  const PAGE_PADDING = 2 * token("--space-5");
  const NARROWEST_VIEWPORT = 320;
  const REFERENCE_VIEWPORT = 390;
  /** `.gridCard`'s `1px solid var(--line)`, from the rule outside the query. */
  const CARD_BORDER = 1;
  /** Nine cells, ten gaps across eleven tracks, two 2px gutter tracks. */
  const GAPS = 10;
  const GUTTERS = 2;

  /** The board's inner width at `viewport`, capped by `--board-mobile-max`. */
  function boardInnerWidth(viewport: number): number {
    const cap = pixels(
      decl(bodyOf(GAME_CSS, ".pageSudoku"), "--board-mobile-max"),
    );
    const padding = pixels(decl(bodyOf(SHARED_MOBILE, ".gridCard"), "padding"));
    const card = Math.min(cap, viewport - PAGE_PADDING);
    return card - 2 * padding - 2 * CARD_BORDER;
  }

  function mobileCell(viewport: number): number {
    const gap = pixels(decl(bodyOf(MOBILE, ".grid"), "gap"));
    const gutter = 2;
    return (boardInnerWidth(viewport) - GAPS * gap - GUTTERS * gutter) / SIDE;
  }

  function mobileKeypadButton(viewport: number): number {
    const keypad = bodyOf(MOBILE, ".keypad");
    const gap = pixels(decl(keypad, "gap"));
    const cap = pixels(
      decl(bodyOf(GAME_CSS, ".pageSudoku"), "--board-mobile-max"),
    );
    const row = Math.min(cap, viewport - PAGE_PADDING);
    return (row - 3 * gap) / 4;
  }

  it("sizes the board fluidly, with the gutter tracks fixed", () => {
    const grid = bodyOf(MOBILE, ".grid");
    const card = bodyOf(SHARED_MOBILE, ".gridCard");

    // Fixed cell tracks would make the card wider than a 320px phone and the
    // whole DOCUMENT would scroll sideways — CLAUDE.md: the page body must
    // never scroll horizontally (finding
    // `board-overflows-horizontally-below-369px`, inherited from #18).
    expect(decl(grid, "grid-template-columns")).toContain("minmax(0, 1fr)");
    expect(decl(grid, "grid-template-columns")).toBe(
      decl(grid, "grid-template-rows"),
    );
    // The 2px gutters stay fixed, so the box rule keeps its hierarchy step at
    // every width.
    expect(decl(grid, "grid-template-columns")).toContain("2px");
    expect(decl(grid, "aspect-ratio")).toBe("1");
    // Without border-box the cap would exclude the padding and the border.
    expect(decl(card, "box-sizing")).toBe("border-box");
    expect(decl(card, "width")).toBe("100%");
    expect(decl(card, "max-width")).toBe("var(--board-mobile-max)");
  });

  it("keeps every cell clear of WCAG 2.5.8's 24px floor down to 320px", () => {
    // ≥44px is arithmetically impossible on a nine-column phone board:
    // 9 × 44 = 396px exceeds the 350px available BEFORE any gap, gutter,
    // padding or border (deviation 1).
    expect(mobileCell(REFERENCE_VIEWPORT)).toBeGreaterThanOrEqual(24);
    expect(mobileCell(NARROWEST_VIEWPORT)).toBeGreaterThanOrEqual(24);
    expect(mobileCell(REFERENCE_VIEWPORT)).toBeGreaterThan(
      mobileCell(NARROWEST_VIEWPORT),
    );
  });

  it("keeps every keypad key clear of the 44px touch target down to 320px", () => {
    const keypad = bodyOf(MOBILE, ".keypad");
    const minimum = token("--touch-target-min");
    const rows = decl(keypad, "grid-template-rows")?.split(/\s+/) ?? [];

    // The premise the arithmetic rests on: a max-content row makes it
    // fiction, which is exactly how #18's sub-44px controls got in (finding
    // `mobile-controls-shrink-to-fit-and-sub-44px-targets`).
    expect(decl(keypad, "width")).toBe("100%");
    expect(decl(keypad, "max-width")).toBe("var(--board-mobile-max)");
    expect(decl(keypad, "grid-template-columns")).toBe(
      "repeat(4, minmax(0, 1fr))",
    );
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(pixels(row)).toBeGreaterThanOrEqual(minimum);
    }
    expect(mobileKeypadButton(REFERENCE_VIEWPORT)).toBeGreaterThanOrEqual(
      minimum,
    );
    expect(mobileKeypadButton(NARROWEST_VIEWPORT)).toBeGreaterThanOrEqual(
      minimum,
    );
    // `apagar` spans three of the four columns, so it is wider still — which
    // is the whole reason 4×3 beats a 5×2 grid whose single erase slot is
    // 49.6px at 320 against a ≈45px label (§12.6).
    expect(decl(bodyOf(MOBILE, ".keypadErase"), "grid-column")).toBe("2 / -1");
  });

  it("gives the desktop keypad the board's exact inner width and tracks", () => {
    const grid = bodyOf(GAME_CSS, ".grid");
    const keypad = bodyOf(GAME_CSS, ".keypad");
    const template = decl(grid, "grid-template-columns") ?? "";
    const cell = Number(/repeat\(3,\s*(\d+(?:\.\d+)?)px\)/.exec(template)?.[1]);
    const gutter = Number(/\)\s+(\d+(?:\.\d+)?)px/.exec(template)?.[1]);
    const gap = pixels(decl(grid, "gap"));

    // The digit row shares the board's template, so digit n sits under column
    // n and the box rhythm is legible twice (§12.6).
    expect(decl(keypad, "grid-template-columns")).toBe(template);
    expect(pixels(decl(keypad, "width"))).toBe(
      SIDE * cell + GAPS * gap + GUTTERS * gutter,
    );
  });

  it("places each digit on the column `track()` computes for that cell", () => {
    // The CSS mirrors `engine.ts`'s arithmetic because an inline style would
    // also apply at ≤768px, where these track numbers do not exist. Mirrored
    // values drift; this is what stops them.
    for (let index = 0; index < SIDE; index += 1) {
      const rule = bodyOf(GAME_CSS, `.keypadDigit:nth-child(${index + 1})`);
      expect(Number(decl(rule, "grid-column"))).toBe(track(index));
    }
  });
});
