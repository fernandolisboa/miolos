import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
  type NonogramSize,
} from "@miolos/core";
import { generateNonogram } from "@miolos/games/nonogram";
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
import { Board } from "../src/nonogram/board";
import { filledTarget, solutionMarks } from "../src/nonogram/engine";
import styles from "../src/nonogram/nonogram-board.module.css";
import { NonogramConclusion } from "../src/nonogram/nonogram-conclusion";
import { NonogramScreen } from "../src/nonogram/nonogram-screen";
import type { NonogramCellValue, NonogramMark } from "../src/nonogram/state";
import {
  playRecordKey,
  type NonogramPlayRecord,
} from "../src/play/play-record";
import sharedStyles from "../src/play/screen.module.css";
import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

// T-WEB-S42..S49 (plan 020 §19). UI composition is not TDD-shaped, so these
// are smoke tests written after the screens; every assertion goes through
// `messages.*` rather than a literal.

// The queue is proved by play-sync.test.ts with no screen mounted; here it is
// stubbed so the composition tests never touch the network and "no POST is
// issued" is an assertion rather than an absence.
const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn((record?: NonogramPlayRecord) =>
    Promise.resolve(record),
  ),
}));
vi.mock("../src/play/sync", () => sync);

// The conclusion needs NO navigation — so the router is mocked purely to prove
// it is never asked to do anything.
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/nonogram",
}));

const DATE = "2026-08-01";

/** Weekday 1 is the 5×5 class — 0.0354 ms to generate and validate. */
const SMALL = daily(generateNonogram(20_260_801, 1));

/**
 * Weekday 7 is the 15×15 class — 0.1902 ms, and the ONLY fixture that can
 * prove a size-dependent claim: `Home`/`End`/`PageUp`/`PageDown` span
 * `size − 1`, and the interior group rules only exist above size 5.
 */
const BIG = daily(generateNonogram(20_260_802, 7));

function daily(puzzle: {
  readonly size: number;
  readonly clues: unknown;
}): DailyNonogramResponse {
  return dailyNonogramResponseSchema.parse({
    game: "nonogram",
    date: DATE,
    size: puzzle.size,
    clues: puzzle.clues,
  });
}

/** The picture, narrowed by a throw rather than by a cast. */
function solutionOf(fixture: DailyNonogramResponse): readonly NonogramMark[] {
  const marks = solutionMarks(fixture.clues);
  if (marks === null) {
    throw new Error("a published daily solves by construction");
  }
  return marks;
}

const SOLUTION = solutionOf(SMALL);
const TARGET = filledTarget(SMALL.clues);

/** The row-major indices the finished picture paints. */
const PICTURE: readonly number[] = SOLUTION.flatMap((mark, index) =>
  mark === 1 ? [index] : [],
);

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
function boardOf(fixture: DailyNonogramResponse): HTMLElement {
  return screen.getByRole("group", {
    name: messages.games.nonogram.play.boardAria(fixture.size),
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

/**
 * What a cell SAYS it is, read off its chromatic class. Every cell's
 * `textContent` is empty by design — the cross is drawn in CSS, which is what
 * puts `undersized-ui-text` and `tiny-text` structurally out of reach at a
 * 14px cell (§11.2) — so there is no text to assert on.
 */
function markAt(container: HTMLElement, index: number): NonogramCellValue {
  const cell = cellAt(container, index);
  if (cell.classList.contains(className("cellFilled"))) {
    return 1;
  }
  if (cell.classList.contains(className("cellCrossed"))) {
    return 0;
  }
  return null;
}

/** Paint every picture cell, crossing nothing — the fill-only finish. */
function paintThePicture(container: HTMLElement): void {
  for (const index of PICTURE) {
    fireEvent.click(cellAt(container, index));
  }
}

function concludedRecord(
  overrides: Partial<NonogramPlayRecord> = {},
): NonogramPlayRecord {
  // Mutable by inference, because the schema's arrays are: `z.infer` of a
  // `z.array` is never `readonly`, and a `readonly` annotation here would not
  // be assignable to it.
  const entries = SOLUTION.map((mark) => (mark === 1 ? 1 : null));
  return {
    v: 1,
    game: "nonogram",
    date: DATE,
    size: SMALL.size,
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
const GAME_CSS = stylesheet("src/nonogram/nonogram-board.module.css");
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
 * `querySelector` below would silently miss (landmine 24).
 */
function className(local: string): string {
  const generated = declares(GAME_CSS, local)
    ? styles[local]
    : declares(SHARED_CSS, local)
      ? sharedStyles[local]
      : undefined;
  if (generated === undefined) {
    throw new Error(
      `neither nonogram-board.module.css nor play/screen.module.css declares .${local}`,
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

// The stroke scaffolding jsdom does not provide: `elementFromPoint`, which
// does not exist on the document at all, and the two pointer-capture methods.
installPointerStubs();

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the composite widget (T-WEB-S42)", () => {
  it("is one tab stop, not size² of them, and not a role=grid", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);

    const board = boardOf(BIG);
    expect(board).toHaveAttribute("role", "group");
    // `role="grid"` needs `role="row"` children, and this flat grid also holds
    // the clue rails: a per-row wrapper would either exclude that row's rail
    // or produce a `gridcell` that is not a cell — and would need
    // `display: contents`, the canonical accessibility-tree-removal bug
    // (§11.1).
    expect(container.querySelector('[role="grid"]')).toBeNull();
    expect(container.querySelector('[role="row"]')).toBeNull();
    expect(container.querySelectorAll("[data-cell-index]")).toHaveLength(
      BIG.size ** 2,
    );
    expect(caretIndex(container)).toBe(0);
    expect(
      container.querySelectorAll('[data-cell-index][tabindex="-1"]'),
    ).toHaveLength(BIG.size ** 2 - 1);
    // A nonogram has no immutable cells, so ADR-0030 decision 4 is vacuous
    // here — nothing on the BOARD is `aria-disabled` (the hint button in the
    // sidebar is, and always has been).
    expect(board.querySelectorAll("[aria-disabled]")).toHaveLength(0);
  });

  it("selects the cell a Tab lands on, so the writing keys are not a silent no-op", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);

    // A Tab into the board reaches its ONE tab stop, which before any
    // interaction is cell 0 while `selected` is still null. `act` because a
    // bare `.focus()` is not one of testing-library's events.
    const entry = caretIndex(container);
    act(() => {
      cellAt(container, entry).focus();
    });
    expect(cellAt(container, entry).className).toContain(
      className("cellSelected"),
    );

    fireEvent.keyDown(cellAt(container, entry), { key: "1" });
    expect(markAt(container, entry)).toBe(1);
  });

  it("puts DOM focus on the cell the pointer selected", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const cell = cellAt(container, 3);

    fireEvent.click(cell);

    // jsdom's click does not move focus, which is exactly what WebKit does
    // with a `<button>` — so this passes only because the cell focuses itself.
    // Without it Safari's `activeElement` stays `<body>`, the roving-focus
    // effect returns at its guard, and no key ever reaches the board again.
    expect(cell).toHaveFocus();
    expect(caretIndex(container)).toBe(3);
  });

  it("moves the caret with the arrows and clamps at all four edges", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);
    const board = boardOf(BIG);
    const side = BIG.size;

    // From no selection at all, any move lands on the first cell.
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(caretIndex(container)).toBe(0);

    fireEvent.keyDown(board, { key: "ArrowRight" });
    fireEvent.keyDown(board, { key: "ArrowDown" });
    expect(caretIndex(container)).toBe(side + 1);

    // Clamped, never wrapped: wrapping from the last column to the first of
    // the next row is disorienting on a ruled grid, where clamping makes the
    // edges discoverable.
    for (const key of ["ArrowUp", "ArrowUp", "ArrowLeft", "ArrowLeft"]) {
      fireEvent.keyDown(board, { key });
    }
    expect(caretIndex(container)).toBe(0);

    fireEvent.click(cellAt(container, side * side - 1));
    fireEvent.keyDown(board, { key: "ArrowDown" });
    fireEvent.keyDown(board, { key: "ArrowRight" });
    expect(caretIndex(container)).toBe(side * side - 1);
  });

  it("reaches the row's and the column's ends with Home/End and PageUp/PageDown", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);
    const board = boardOf(BIG);
    const side = BIG.size;

    fireEvent.click(cellAt(container, 7 * side + 9));
    fireEvent.keyDown(board, { key: "Home" });
    expect(caretIndex(container)).toBe(7 * side);
    fireEvent.keyDown(board, { key: "End" });
    expect(caretIndex(container)).toBe(7 * side + side - 1);

    // PageUp/PageDown are this board's own addition (ADR-0037 decision 4):
    // ADR-0030 contains no prohibition, and 14 presses of ArrowUp is what the
    // vertical traversal costs without them.
    fireEvent.click(cellAt(container, 7 * side + 4));
    fireEvent.keyDown(board, { key: "PageUp" });
    expect(caretIndex(container)).toBe(4);
    fireEvent.keyDown(board, { key: "PageDown" });
    expect(caretIndex(container)).toBe((side - 1) * side + 4);
  });

  it("writes with 1 and 2 and clears with 0, Backspace and Delete", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const board = boardOf(SMALL);

    // The caret is placed with the arrows, not a click: a click would already
    // have applied the brush and the first key below would read as a clear.
    for (const key of ["ArrowRight", "ArrowRight", "ArrowRight"]) {
      fireEvent.keyDown(board, { key });
    }
    expect(caretIndex(container)).toBe(2);
    // `1` preenche and `2` marca, both WITHOUT touching the brush — the
    // keyboard's own door (§10.3). Re-entering the same value clears.
    for (const [key, value] of [
      ["1", 1],
      ["2", 0],
    ] as const) {
      fireEvent.keyDown(board, { key });
      expect(markAt(container, 2)).toBe(value);
      fireEvent.keyDown(board, { key });
      expect(markAt(container, 2)).toBeNull();
    }

    for (const key of ["0", "Backspace", "Delete"]) {
      fireEvent.keyDown(board, { key: "1" });
      expect(markAt(container, 2)).toBe(1);
      fireEvent.keyDown(board, { key });
      expect(markAt(container, 2)).toBeNull();
    }
  });

  it("prevents the page from scrolling under the caret", () => {
    render(<NonogramScreen daily={BIG} />);
    const board = boardOf(BIG);

    for (const key of [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ]) {
      const event = createEvent.keyDown(board, { key });
      fireEvent(board, event);
      expect(event.defaultPrevented).toBe(true);
    }

    // A key the board does not handle is left entirely alone — Tab out of the
    // widget has to keep working.
    const tab = createEvent.keyDown(board, { key: "Tab" });
    fireEvent(board, tab);
    expect(tab.defaultPrevented).toBe(false);
  });
});

// Deliberately bare — no timeout (ADR-0055 decision 1; #109, plan 051).
// #109's third residual is the `it` below, "renders one labelled rail per
// row and per column": 990 ms maximum on CI over nine genuine gate runs
// (32196991090; 376–944 ms on the other eight) = 19.8 % of vitest's
// 5000 ms default, and 624 ms pooled maximum over 3 uncapped local runs at
// #109 (`pnpm test --force --concurrency=10`). Under the trigger on both
// axes; 990 x 4 = 3 960 -> the 5000 ms default it already rides. Under
// decision 2 the anchor is a SAMPLE maximum, so a later run above it is the
// estimator working, not a falsified record: this comment owes an update
// only when a sample crosses the 2000 ms trigger, never on every new gate
// row. The 2368 / 1959 ms that filed it (plan 042 §2.3) were taken at
// apps/web's pre-#120 seven workers — history, not anchors: ADR-0055
// annotation (o).
describe("the clue rails (T-WEB-S43)", () => {
  it("renders one labelled rail per row and per column", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);
    const copy = messages.games.nonogram.play;

    for (const [row, runs] of BIG.clues.rows.entries()) {
      expect(
        screen.getByLabelText(copy.rowCluesAria(row + 1, runs)),
      ).toBeInTheDocument();
    }
    for (const [column, runs] of BIG.clues.cols.entries()) {
      expect(
        screen.getByLabelText(copy.columnCluesAria(column + 1, runs)),
      ).toBeInTheDocument();
    }
    expect(container.querySelectorAll('[id^="nonogram-clue-"]')).toHaveLength(
      2 * BIG.size,
    );
  });

  it("is never a role-less labelled div — the defect class N16 names", () => {
    const { container } = render(<NonogramScreen daily={BIG} />);

    const rails = container.querySelectorAll('[id^="nonogram-clue-"]');
    expect(rails.length).toBeGreaterThan(0);
    for (const rail of rails) {
      // `aria-label` on a role-less <div> is not reliably exposed, which is
      // exactly what `binairo/grid.tsx` ships today. `group` permits author
      // naming, so the label is a name AT can actually reach.
      expect(rail).toHaveAttribute("role", "group");
      expect(rail.getAttribute("aria-label") ?? "").not.toBe("");
    }
  });

  it("renders `0` for an all-empty line, in the rail AND in its label", () => {
    // The engine's own contract: an all-empty line's clue is `[]` and the UI
    // renders "0" (nonogram/types.ts:10). The rail's numbers and the composed
    // label must agree, and only one fixture in the shipped library is
    // guaranteed to have such a line — so the assertion is conditional on
    // finding one and anti-vacuous through the label's own text.
    const { container } = render(<NonogramScreen daily={BIG} />);
    const empty = BIG.clues.rows.findIndex((runs) => runs.length === 0);
    if (empty === -1) {
      expect(messages.games.nonogram.play.rowCluesAria(1, [])).toContain("0");
      return;
    }

    const rail = container.querySelector(`#nonogram-clue-row-${empty}`);
    expect(rail?.textContent).toBe("0");
    expect(rail).toHaveAttribute(
      "aria-label",
      messages.games.nonogram.play.rowCluesAria(empty + 1, []),
    );
  });

  it("describes every cell by its two rails, and names it by its state", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const copy = messages.games.nonogram.play;
    const side = SMALL.size;

    for (let index = 0; index < side * side; index += 1) {
      const row = Math.floor(index / side);
      const column = index % side;
      const described = cellAt(container, index).getAttribute(
        "aria-describedby",
      );
      expect(described).toBe(
        `nonogram-clue-row-${row} nonogram-clue-col-${column}`,
      );
      // Both ids resolve: a description pointing at nothing is worse than no
      // description, because it announces as absent rather than as broken.
      for (const id of described?.split(" ") ?? []) {
        expect(container.querySelector(`#${id}`)).not.toBeNull();
      }
    }

    // All three cell states, through the copy module's composed name — colour
    // is never the only carrier (DESIGN.md).
    const board = boardOf(SMALL);
    fireEvent.click(cellAt(container, 0));
    expect(cellAt(container, 0)).toHaveAttribute(
      "aria-label",
      copy.cellAria(1, 1, 1),
    );
    fireEvent.keyDown(board, { key: "2" });
    expect(cellAt(container, 0)).toHaveAttribute(
      "aria-label",
      copy.cellAria(1, 1, 0),
    );
    fireEvent.keyDown(board, { key: "0" });
    expect(cellAt(container, 0)).toHaveAttribute(
      "aria-label",
      copy.cellAria(1, 1, null),
    );
  });

  it("announces each run ONCE, through the rail's label and never as bare digits (T-WEB-S68)", () => {
    // Naming a `role="group"` supplies the group's NAME; it does not prune
    // the group's descendants. Without `aria-hidden` every clue numeral stays
    // its own text node and its own virtual-cursor stop, so a screen-reader
    // user hears every run twice — once through the composed label (and again
    // through each cell's `aria-describedby`) and once as naked digits with
    // nothing saying which line they belong to. 90 extra stops on a size-15
    // day (finding `clue-rails-announce-every-run-twice`). Binairo and Sudoku
    // do not have this: their digits live inside NAMED buttons.
    const { container } = render(<NonogramScreen daily={BIG} />);

    const numerals = container.querySelectorAll(
      '[id^="nonogram-clue-"] > span',
    );
    // Anti-vacuity: the query must be finding the rails' numerals at all.
    expect(numerals.length).toBeGreaterThanOrEqual(BIG.size * 2);
    for (const numeral of numerals) {
      expect(numeral).toHaveAttribute("aria-hidden", "true");
      // And the digit is still PAINTED — this hides from the a11y tree, it
      // does not blank the rail.
      expect(numeral.textContent).toMatch(/^\d+$/);
    }

    // The rail keeps its own name, which is what makes the hiding safe: an
    // `aria-hidden` element referenced by `aria-describedby` still
    // contributes its accessible name.
    const rail = container.querySelector("#nonogram-clue-row-0");
    expect(rail).toHaveAttribute(
      "aria-label",
      messages.games.nonogram.play.rowCluesAria(1, BIG.clues.rows[0] ?? []),
    );
  });
});

describe("the brush (T-WEB-S44)", () => {
  const copy = messages.games.nonogram.play.controls;

  function brushButton(mode: "fill" | "cross" | "erase"): HTMLElement {
    return screen.getByLabelText(
      { fill: copy.fillAria, cross: copy.crossAria, erase: copy.eraseAria }[
        mode
      ],
    );
  }

  it("is three sticky modes with exactly one pressed, `preencher` first", () => {
    render(<NonogramScreen daily={SMALL} />);

    const pressed = screen
      .getAllByRole("button", { pressed: true })
      .map((button) => button.getAttribute("aria-label"));
    expect(pressed).toEqual([copy.fillAria]);
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(2);
    // The sighted half of the same state (DES-6): `aria-pressed` alone would
    // leave the pressed brush invisible.
    expect(brushButton("fill").className).toContain(className("controlActive"));
    for (const mode of ["cross", "erase"] as const) {
      expect(brushButton(mode).className).not.toContain(
        className("controlActive"),
      );
    }
  });

  it("changes what a tap writes, and pressing the active brush is a no-op", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);

    fireEvent.click(cellAt(container, 1));
    expect(markAt(container, 1)).toBe(1);

    fireEvent.click(brushButton("cross"));
    fireEvent.click(cellAt(container, 2));
    expect(markAt(container, 2)).toBe(0);

    // There is no cycle to fall back to, so re-pressing the active brush must
    // leave it active rather than disarming the board (P21).
    fireEvent.click(brushButton("cross"));
    expect(brushButton("cross")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(cellAt(container, 3));
    expect(markAt(container, 3)).toBe(0);

    // The erase brush clears a filled cell in one tap.
    fireEvent.click(brushButton("erase"));
    fireEvent.click(cellAt(container, 1));
    expect(markAt(container, 1)).toBeNull();
  });
});

describe("the stroke (T-WEB-S45)", () => {
  it("paints every cell it crosses, as a SET rather than a toggle", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 2, clientY: 0, pointerId: 1 });
    // Back over a cell the stroke already painted: a drag must be idempotent
    // over the cells it crosses, so this may not clear cell 1.
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 1, clientY: 0, pointerId: 1 });

    for (const index of [0, 1, 2]) {
      expect(markAt(container, index)).toBe(1);
    }
  });

  it("writes a stationary tap from pointerup, without double-applying", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    // Under pointer capture the browser retargets the trailing `click` to the
    // CONTAINER, so a paint tap has to be resolved on `pointerup` — and the
    // trailing click must then not re-apply the brush and clear the cell.
    fireEvent.pointerDown(board, { clientX: 4, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 4, clientY: 0, pointerId: 1 });
    expect(markAt(container, 4)).toBe(1);

    fireEvent.click(cellAt(container, 4), { detail: 1 });
    expect(markAt(container, 4)).toBe(1);
  });

  it("writes nothing for a non-primary button", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, {
      clientX: 4,
      clientY: 0,
      pointerId: 1,
      button: 2,
    });
    fireEvent.pointerUp(board, {
      clientX: 4,
      clientY: 0,
      pointerId: 1,
      button: 2,
    });

    expect(markAt(container, 4)).toBeNull();
  });

  it("survives a second finger touching and lifting mid-stroke", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    // A palm, the holding thumb, a deliberate second finger. Every handler is
    // scoped to the pointer that opened the stroke.
    fireEvent.pointerDown(board, { clientX: 9, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(board, { clientX: 9, clientY: 0, pointerId: 2 });
    fireEvent.pointerMove(board, { clientX: 2, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 2, clientY: 0, pointerId: 1 });

    for (const index of [0, 1, 2]) {
      expect(markAt(container, index)).toBe(1);
    }
    expect(markAt(container, 9)).toBeNull();
  });

  it("reopens after a stroke whose pointer never lifts", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    // The hazard scoping introduces: a stroke that never closes would latch
    // the board dead. `lostpointercapture` fires whenever capture ends for any
    // reason, so the next stroke always opens.
    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.lostPointerCapture(board, { pointerId: 1 });

    fireEvent.pointerDown(board, { clientX: 6, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(board, { clientX: 6, clientY: 0, pointerId: 2 });

    expect(markAt(container, 6)).toBe(1);
  });

  it("hands the caret back to the cell the stroke ended on", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    stubElementFromPoint(container);
    const board = boardOf(SMALL);

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(board, { clientX: 1, clientY: 0, pointerId: 1 });
    fireEvent.pointerUp(board, { clientX: 1, clientY: 0, pointerId: 1 });

    // The focus door pointer capture leaves open (ADR-0037 decision 2): the
    // browser retargets the trailing `click` to the container, so the cell's
    // own focus fix never runs during a stroke and the caret would be stranded
    // wherever it was.
    expect(cellAt(container, 1)).toHaveFocus();
    expect(caretIndex(container)).toBe(1);
  });
});

describe("the board's re-render budget (T-WEB-S57)", () => {
  it("is memoized, so an unrelated tick cannot reconcile 225 cells", () => {
    // `state.now` moves once a second for the two timer readouts, and the
    // board's props do not move with it. Without `memo` every tick rebuilds
    // 225 `<button>` elements, 30 rails and 225 composed aria strings that
    // cannot have changed — measured at ~2.5 ms per tick on a 15×15, paid
    // again per cell crossed during a drag.
    //
    // Asserted structurally because the cost is React's element allocation
    // and prop diffing, which no DOM assertion can see: the cells keep their
    // node identity across a tick either way. If this reds because `Board`
    // was unwrapped, the fix is to re-wrap it, not to delete the assertion.
    expect(Board).toHaveProperty("$$typeof", Symbol.for("react.memo"));
    expect(Board).toHaveProperty("type", expect.any(Function));
  });

  it("composes ONE label per painted cell during a drag — cells AND rails, not size² + 2·size (T-WEB-S66)", () => {
    // The half `Board`'s own memo cannot buy, and the reason `Cell` is
    // memoized (step-6 round-3 finding PERF-R3-1). `paint-over` allocates a
    // new `entries` array, so `Board` re-enters on every pointer move by
    // construction; without the per-cell memo each of those re-composes all
    // 225 aria labels, and this drag would cost 225 × N compositions on the
    // game's PRIMARY gesture (ADR-0037).
    //
    // THE RAIL COUNTERS ARE ROUND 4's ADDITION (finding PERF-R4-1). This test
    // spied on `cellAria` alone, so it was green while the 30 clue rails were
    // still rebuilt inline in `Board`'s body — 1230 further compositions of
    // the same kind on the same drag, i.e. 31 × N against the N the comment
    // claimed. It would have stayed green if the rails had grown to 60 × N.
    //
    // The three composers are the honest probe: they are the per-element work
    // that scales, and each is called exactly once per rendered cell or rail.
    // A DOM assertion cannot see any of this — React writes no attribute when
    // the value is unchanged, so the markup is identical either way, which is
    // why the sibling assertion above is structural.
    const { container } = render(<NonogramScreen daily={BIG} />);
    stubElementFromPoint(container);
    const board = boardOf(BIG);
    const cells = BIG.size * BIG.size;
    const painted = 8;

    const cellAria = vi.spyOn(messages.games.nonogram.play, "cellAria");
    const rowCluesAria = vi.spyOn(messages.games.nonogram.play, "rowCluesAria");
    const columnCluesAria = vi.spyOn(
      messages.games.nonogram.play,
      "columnCluesAria",
    );

    fireEvent.pointerDown(board, { clientX: 0, clientY: 0, pointerId: 1 });
    for (let index = 1; index < painted; index += 1) {
      fireEvent.pointerMove(board, {
        clientX: index,
        clientY: 0,
        pointerId: 1,
      });
    }
    fireEvent.pointerUp(board, {
      clientX: painted - 1,
      clientY: 0,
      pointerId: 1,
    });

    // Anti-vacuity: the stroke really painted, so a zero count would be a
    // stalled drag rather than a perfect memo.
    for (let index = 0; index < painted; index += 1) {
      expect(markAt(container, index)).toBe(1);
    }
    // O(N), with generous slack for the caret and hint rings the same stroke
    // moves. The number that must never come back is 225 × N = 1800.
    expect(cellAria.mock.calls.length).toBeLessThan(cells);
    // The rails bail out PERMANENTLY — `clues.rows[i]` / `clues.cols[i]` keep
    // their identity for the life of the mount — so this is exactly zero after
    // the initial render, not merely O(N). The number that must never come
    // back is 2 · size · N = 1200 at this stroke length.
    expect(rowCluesAria.mock.calls.length).toBe(0);
    expect(columnCluesAria.mock.calls.length).toBe(0);
    cellAria.mockRestore();
    rowCluesAria.mockRestore();
    columnCluesAria.mockRestore();
  });
});

describe("the four branches (T-WEB-S47)", () => {
  /**
   * What actually stands impeccable's two rules down, asserted rather than
   * assumed: `checkHeroEyebrow` returns on `text.length < 2` and
   * `isKickerCandidate` on its own text gate, so an h1 whose previous element
   * sibling carries NO TEXT can fire neither.
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

  it("renders the unavailable card when the clues do not solve — BEFORE the hydration gate", () => {
    // A clue set no bitmap satisfies: one row demands a run the board cannot
    // hold. It is unreachable for a published daily (ADR-0021 decision 3 is a
    // binary gate over all 265 motif variants), and the branch still has to be
    // defined — `solutionMarks` returns null and the screen must not crash.
    const impossible = dailyNonogramResponseSchema.parse({
      game: "nonogram",
      date: DATE,
      size: 5,
      clues: {
        size: 5,
        rows: [[5], [5], [5], [5], [5]],
        cols: [[1], [1], [1], [1], [1]],
      },
    });

    const { container } = render(<NonogramScreen daily={impossible} />);

    expect(
      screen.getByText(messages.games.nonogram.play.unavailable.title),
    ).toBeInTheDocument();
    // It is the FIRST branch, above `!hydrated`: neither marker attribute is
    // emitted, so the impeccable preflight fails loudly rather than scanning a
    // board that never rendered.
    expect(container.querySelector("[data-play-state]")).toBeNull();
    expect(container.querySelector("[data-conclusion-state]")).toBeNull();
  });

  it("paints a board-shaped skeleton first: no record, no clock, no live affordance", () => {
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const readStorage = vi.spyOn(Storage.prototype, "getItem");
    const clock = vi.spyOn(Date, "now");

    // The server render is the first paint by definition — no effects run, so
    // this is exactly the markup the client hydrates against.
    const markup = renderToStaticMarkup(<NonogramScreen daily={SMALL} />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(clock).not.toHaveBeenCalled();
    expect(markup).toContain('data-play-state="skeleton"');
    expect(markup).not.toContain("00:00");
    expect(markup).not.toContain(
      messages.games.nonogram.play.progressLong(0, TARGET),
    );
    expect(markup).not.toContain(messages.games.nonogram.play.hint.available);
    // Not the conclusion either, even though a concluded record is sitting in
    // storage: nothing record-derived may reach the first paint.
    expect(markup).not.toContain(messages.conclusion.stampLabel);
    expect(markup).not.toContain("data-cell-index");
    expect(markup).not.toContain('tabindex="0"');
  });

  it("still paints the screen's own identity, including the rules and the size", () => {
    const markup = renderToStaticMarkup(<NonogramScreen daily={SMALL} />);

    // This says NOTHING about the wire and must not be read as an ADR-0004
    // guard: `daily` is a prop of a "use client" component, so the clues travel
    // in the same response's RSC payload. The size is on the wire too, which
    // is exactly why `Tamanho` does not have to wait.
    expect(markup).toContain(messages.games.nonogram.play.title);
    expect(markup).toContain(messages.games.nonogram.play.rules);
    expect(markup).toContain(messages.games.nonogram.play.sizeLabel);
  });

  it("reserves every box the play shell occupies, so nothing moves", () => {
    // jsdom has no layout, so this is the tripwire and not the measurement:
    // `.board` is a centred flex column and the mobile `hint` row is `auto`,
    // so an absent brush row or an absent hint bar hands its height to the
    // board as an OFFSET.
    const skeleton = parsed(
      renderToStaticMarkup(<NonogramScreen daily={SMALL} />),
    );
    const { container: hydrated } = render(<NonogramScreen daily={SMALL} />);

    // Anti-vacuity: `GRID_AREA_CLASSES` is read off the CSS with a regex, and
    // an empty list would make the comparison below pass on nothing.
    expect(occupantsIn(hydrated)).toEqual(
      expect.arrayContaining(["board", "hint", "statsCard"]),
    );
    expect(occupantsIn(skeleton)).toEqual(occupantsIn(hydrated));

    // Not grid areas, and the largest single contributors: all three sit
    // INSIDE `.board`, so their absence re-centres the card by half their
    // height. The rails are here because the gutter tracks are `max-content` —
    // a blank rail reserves the wrong WIDTH.
    for (const [local, count] of [
      ["cell", SMALL.size ** 2],
      ["clueRow", SMALL.size],
      ["clueCol", SMALL.size],
      ["control", 3],
    ] as const) {
      expect(skeleton.querySelectorAll(`.${className(local)}`)).toHaveLength(
        count,
      );
      expect(hydrated.querySelectorAll(`.${className(local)}`)).toHaveLength(
        count,
      );
    }
    // Reserved without a control or a tab stop: the only one in the whole
    // skeleton is the way back out.
    expect(
      skeleton.querySelectorAll("button, a[href], [tabindex]"),
    ).toHaveLength(1);
    // A no-break space is what gives a blank readout its line box, so the card
    // it sits in is the height it will be after hydration.
    for (const readout of [
      "timerBar",
      "timerCard",
      "progressBar",
      "progressCard",
    ]) {
      expect(
        skeleton.querySelector(`.${className(readout)}`)?.textContent,
      ).toBe("\u00a0");
    }
  });

  it("reports the PICTURE's cell count on a fresh board, never size²", () => {
    render(<NonogramScreen daily={SMALL} />);

    // A player finishes without crossing a single cell, so a `de size²`
    // readout would stand at 21% at the instant they win (P13).
    expect(TARGET).toBeLessThan(SMALL.size ** 2);
    expect(
      screen.getByText(messages.games.nonogram.play.progressLong(0, TARGET)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        messages.games.nonogram.play.progressLong(0, SMALL.size ** 2),
      ),
    ).not.toBeInTheDocument();
  });

  it("renders both readout pairs and the screen's own third stat row", () => {
    render(<NonogramScreen daily={SMALL} />);
    const copy = messages.games.nonogram.play;

    // Two timer nodes in one DOM: `display: none` in the module hides exactly
    // one per viewport, which jsdom cannot evaluate.
    expect(
      screen.getAllByLabelText(messages.play.timerAria("00:00")),
    ).toHaveLength(2);
    expect(screen.getByText(copy.rules)).toBeInTheDocument();
    expect(screen.getByText(copy.sizeLabel)).toBeInTheDocument();
    expect(screen.getByText(copy.size(SMALL.size))).toBeInTheDocument();
    expect(
      screen.getByText(copy.progressShort(SMALL.size, 0, TARGET)),
    ).toBeInTheDocument();
  });

  it("swaps the conclusion in place on a fill-only finish, with no navigation", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);

    paintThePicture(container);

    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "result",
    );
    expect(container.querySelector("[data-cell-index]")).toBeNull();
    // Crossing is never required (ADR-0032): the picture alone closes it.
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    const [queued] = sync.flushPendingCompletions.mock.calls.at(-1) ?? [];
    expect(queued).toMatchObject({
      game: "nonogram",
      date: DATE,
      size: SMALL.size,
      concluded: true,
      pendingSync: true,
      grid: [...SOLUTION],
    });
  });

  it("restores a finished day straight into the conclusion, clock stopped", () => {
    vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
    const record = concludedRecord();
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(record),
    );

    const { container } = render(<NonogramScreen daily={SMALL} />);

    const stamped = messages.conclusion.stampAria(
      messages.games.nonogram.conclusion.title,
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
    // server-side, and re-posting would resurrect a settled sync.
    expect(sync.flushPendingCompletions).not.toHaveBeenCalled();
  });

  it("keeps the h1 the first element child in every view", () => {
    // Structural, not stylistic: at 1440 the h1 is 54px ≥ 48 so impeccable's
    // hero rule would fire; at 390 it is 34px so the kicker rule fires
    // instead. No card wrapper and no `display: none` saves either one — only
    // the structure does.
    const skeleton = parsed(
      renderToStaticMarkup(<NonogramScreen daily={SMALL} />),
    );
    assertHeadingIsFirstChild(skeleton);
    assertNoEyebrowAboveHeadings(skeleton);

    const { container: play } = render(<NonogramScreen daily={SMALL} />);
    assertHeadingIsFirstChild(play);
    assertNoEyebrowAboveHeadings(play);

    const { container: unavailable } = render(
      <DailyUnavailable copy={messages.games.nonogram.play.unavailable} />,
    );
    // DailyUnavailable's h1 follows its `aria-hidden` tape rather than
    // nothing — shipped markup this ticket does not touch. The tape has no
    // text, so both rules still return on their first guard.
    assertNoEyebrowAboveHeadings(unavailable);

    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );
    const { container: conclusion } = render(<NonogramScreen daily={SMALL} />);
    expect(conclusion.querySelector("[data-conclusion-state]")).not.toBeNull();
    assertHeadingIsFirstChild(conclusion);
    assertNoEyebrowAboveHeadings(conclusion);
  });

  it("spends the one free hint on a picture cell and explains which case fired", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);
    const copy = messages.games.nonogram.play;

    // The caret is placed WITHOUT writing: a wrong mark would put a
    // contradiction on the board and turn the hint into a correction.
    fireEvent.keyDown(boardOf(SMALL), { key: "ArrowRight" });
    const caret = caretIndex(container);

    fireEvent.click(screen.getByText(copy.hint.available));

    const exhausted = screen.getByText(copy.hint.used);
    expect(exhausted).toHaveAttribute("aria-disabled", "true");
    // An untouched picture cell exists, so pass 2 lands on a FILL — never the
    // cross the unmodified `nextHint` returns 239 times in 280 (N29). The
    // filled count moving by exactly one is the same claim, measured.
    expect(screen.getByText(copy.hint.explain.fill)).toBeInTheDocument();
    expect(screen.getByText(copy.progressLong(1, TARGET))).toBeInTheDocument();
    // Exactly one cell was written, and it is a cell the picture paints. The
    // compound `.cellFilled.cellHinted` is the class the hint actually emits —
    // `.cellHinted` alone declares nothing, deliberately, because the ring is
    // the INVERSE of the cell's own ink and one colour cannot serve both.
    const filled = container.querySelectorAll(
      `.${className("cellFilled")}[data-cell-index]`,
    );
    expect(filled).toHaveLength(1);
    expect(PICTURE).toContain(
      Number(filled[0]?.getAttribute("data-cell-index")),
    );
    // The caret is the player's and the highlight is the app's: moving it
    // would make the hinted cell always also the selected cell, and the ring
    // could never render on its own (plan 018 finding D3).
    expect(caretIndex(container)).toBe(caret);
  });
});

/**
 * The picture reveal (T-WEB-S51, plan 020 §13, ADR-0034). Two mounts, two
 * sources, one bitmap: the play state on the in-place swap, and the concluded
 * record on `/nonogram/concluido` — and the second is the reason the reveal
 * survives a reload with no name, no server round trip and no new read path.
 */
describe("the picture reveal (T-WEB-S51)", () => {
  /**
   * The `d` the reveal owes for a bitmap, derived HERE from the solution
   * rather than imported from the component — the same discipline the
   * completion route's encoding pin follows. Row-major `M{col} {row}`, one
   * subpath per filled cell.
   */
  function pathFor(size: number, cells: readonly NonogramMark[]): string {
    return cells
      .map((cell, index) =>
        cell === 1
          ? `M${String(index % size)} ${String(Math.floor(index / size))}h1v1h-1z`
          : "",
      )
      .join("");
  }

  const REVEAL = messages.games.nonogram.reveal.aria;

  function figure(): HTMLElement {
    return screen.getByRole("img", { name: REVEAL });
  }

  it("hands the reveal down from the play state the moment the picture closes", () => {
    const { container } = render(<NonogramScreen daily={SMALL} />);

    paintThePicture(container);

    expect(figure()).toHaveAttribute(
      "viewBox",
      `0 0 ${String(SMALL.size)} ${String(SMALL.size)}`,
    );
    expect(figure().querySelector("path")).toHaveAttribute(
      "d",
      pathFor(SMALL.size, SOLUTION),
    );
    // Additive to the stamp, never instead of it (DESIGN.md:44). The stamp's
    // own duration is asserted by T-WEB-S47's restore case, which is the one
    // that can pin a time; here it would be a live clock.
    expect(
      screen.getByText(messages.conclusion.stampLabel),
    ).toBeInTheDocument();
  });

  it("derives the same picture from a concluded record, with no prop at all", () => {
    // `/nonogram/concluido`: the server segment passes only `date`, because a
    // server-computed bitmap would put a derived solution in the RSC payload
    // of a route players who have NOT solved also open (ADR-0034 decision 3).
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(concludedRecord()),
    );

    render(<NonogramConclusion date={DATE} />);

    expect(figure().querySelector("path")).toHaveAttribute(
      "d",
      pathFor(SMALL.size, SOLUTION),
    );
  });

  it("stamps a concluded record that carries no grid, and reveals nothing", () => {
    // A record written before this ticket, or one whose completion never
    // closed: the stamp is honest and the figure is OMITTED, never a labelled
    // `<svg>` with an empty `d` (CLI-5/DES-9).
    //
    // A DIFFERENT day from the case above, deliberately: `use-record-snapshot`
    // caches one snapshot per `{game, date}` in a module slot and decides
    // staleness from the five fields the stamp renders — `grid` is not among
    // them, so a same-day re-render inside this file would be handed the
    // previous record. That is a test-isolation constraint and not a product
    // path: in the app the key changes with the day and `concluded` flips
    // exactly once, from a record with no grid to one that has it.
    const day = "2026-07-31";
    window.localStorage.setItem(
      playRecordKey("nonogram", day),
      JSON.stringify(concludedRecord({ date: day, grid: undefined })),
    );

    const { container } = render(<NonogramConclusion date={day} />);

    expect(
      screen.getByLabelText(
        messages.conclusion.stampAria(
          messages.games.nonogram.conclusion.title,
          formatElapsed(272_000),
          0,
        ),
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("reveals the picture in place even where localStorage throws", () => {
    // Safari private mode and an Android WebView with DOM storage off throw on
    // the PROPERTY, so no record is ever written and none can ever be read.
    // The prop is the whole reason the in-place reveal still lands — and it is
    // the same reason `ConclusionResult` exists at all (plan 017 D26).
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("access denied", "SecurityError");
      },
    });

    try {
      const { container } = render(<NonogramScreen daily={SMALL} />);

      paintThePicture(container);

      expect(figure().querySelector("path")).toHaveAttribute(
        "d",
        pathFor(SMALL.size, SOLUTION),
      );
    } finally {
      if (original !== undefined) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  });
});

/**
 * The board's arithmetic, read off the stylesheet as TEXT (T-WEB-S48,
 * assertions A1–A14 plus C1).
 *
 * jsdom implements no layout at all, so nothing above this line can see a
 * board wider than its phone or a 14px cell. §12 does the arithmetic on paper;
 * this re-derives it from the declarations the stylesheet actually ships, so
 * the numbers cannot drift silently.
 */
describe("the board geometry (T-WEB-S48)", () => {
  const PAGE_PADDING = 2 * token("--space-5");
  /** The 1140px fold's board column at its narrowest: 1141 − the chrome. */
  const FOLD_COLUMN = 1141 - (80 + 330 + 72 + 80);
  /** `.gridCard`'s `1px solid var(--line)`, from the rule outside the query. */
  const CARD_BORDER = 1;
  const SIZES: readonly NonogramSize[] = [5, 8, 10, 15];

  /**
   * MEASURED, not recalled — and this is the one number in the suite that no
   * stylesheet can re-derive, so it carries its provenance and its
   * invalidation trigger. Chrome 151 (puppeteer 25.4.0), against the woff2
   * `next/font` emits for the latin subset of Instrument Sans: every digit is
   * 6.609375px at 11px with `font-variant-numeric: tabular-nums`, spread
   * 0.000000. Fraunces has NO tabular figures (ADR-0036).
   *
   * INVALIDATED BY: any change to `--font-ui`, to `.clueNumber`'s weight, or
   * to its font-size. A9 asserts all three at the exact values the measurement
   * was taken at, so such a change reds the assertion that OWNS this number
   * rather than silently leaving A3 computing with a stale constant against
   * 0.98px of slack.
   */
  const DIGIT = 6.609375;
  const TWO_DIGIT = 2 * DIGIT;

  /**
   * [digit chars, runs] for the worst row of each size across the whole
   * shipped motif library. Pinned in
   * `packages/games/test/nonogram/clue-bounds.test.ts` — a two-way citation,
   * because the two packages cannot import from each other (`apps/web` may
   * never pull `MOTIFS` into the client bundle, ADR-0033 (d)) and a bare
   * "pinned there" would be a hope rather than a link. If they ever disagree,
   * the games-side enumeration is the source of truth and this is the consumer
   * that must be updated.
   */
  const WORST_ROW: Readonly<Record<NonogramSize, readonly [number, number]>> = {
    5: [3, 3],
    8: [4, 4],
    10: [5, 5],
    15: [5, 5],
  };

  /**
   * TWO `@media (max-width: 768px)` blocks, in the fixed order §12.4 rule (ii)
   * states: geometry (`.size*`, `.cell`) then chrome (`.controls`,
   * `.control`, `.affordance`). `bodyOf` is first-match and THROWS, so the
   * second is reachable only by slicing past the first — a bare nested lookup
   * would search the geometry block and raise "no block for `.controls`".
   */
  const MOBILE_GEOMETRY = bodyOf(GAME_CSS, "@media (max-width: 768px)");
  const AFTER_GEOMETRY = GAME_CSS.slice(
    GAME_CSS.indexOf(MOBILE_GEOMETRY) + MOBILE_GEOMETRY.length,
  );
  const MOBILE_CHROME = bodyOf(AFTER_GEOMETRY, "@media (max-width: 768px)");
  const SHARED_MOBILE = bodyOf(SHARED_CSS, "@media (max-width: 768px)");

  /** The cap the page root actually resolves for this size (§12.4, §12.8). */
  function mobileCap(size: NonogramSize): number {
    return pixels(
      decl(
        bodyOf(GAME_CSS, size === 5 ? ".mobileCap5" : ".pageNonogram"),
        "--board-mobile-max",
      ),
    );
  }

  /** The row-clue gutter, from `.clueRow`'s own declarations. */
  function gutterWidth(size: NonogramSize): number {
    const rail = bodyOf(GAME_CSS, ".clueRow");
    const gap = pixels(decl(rail, "column-gap"));
    const pad = pixels(decl(rail, "padding-inline-end"));
    const [chars, runs] = WORST_ROW[size];
    return chars * DIGIT + (runs - 1) * gap + pad;
  }

  function innerWidth(size: NonogramSize, viewport: number): number {
    const padding = pixels(decl(bodyOf(SHARED_MOBILE, ".gridCard"), "padding"));
    const card = Math.min(mobileCap(size), viewport - PAGE_PADDING);
    return card - 2 * padding - 2 * CARD_BORDER;
  }

  function mobileCell(size: NonogramSize, viewport: number): number {
    return (innerWidth(size, viewport) - gutterWidth(size)) / size;
  }

  /** The fixed cell track a desktop `.sizeN` template declares. */
  function desktopCell(size: NonogramSize): number {
    const template = decl(
      bodyOf(GAME_CSS, `.size${size}`),
      "grid-template-columns",
    );
    return Number(
      /repeat\(\d+,\s*(\d+(?:\.\d+)?)px\)/.exec(template ?? "")?.[1],
    );
  }

  it("declares its two mobile blocks in the fixed order the assertions read", () => {
    // Anti-vacuity, not decoration: a merged or reordered module makes one of
    // these fail loudly instead of silently handing an assertion the wrong
    // body (§12.4 rule ii).
    expect(MOBILE_GEOMETRY).toContain(".size15");
    expect(MOBILE_CHROME).toContain(".controls");
  });

  it("A1 — sizes the board fluidly on a phone, with no px cell track left", () => {
    for (const size of SIZES) {
      const template = decl(
        bodyOf(MOBILE_GEOMETRY, `.size${size}`),
        "grid-template-columns",
      );
      expect(template).toBe(
        `max-content repeat(${String(size)}, minmax(0, 1fr))`,
      );
      // The desktop 525px board reaching a 328px card is the
      // `board-overflows-horizontally-below-369px` class of defect.
      expect(template).not.toMatch(/\d+px/);
    }
  });

  it("A2 — declares the mobile cap the shared sheet reads with NO fallback", () => {
    expect(mobileCap(15)).toBe(350);
    expect(mobileCap(15)).toBeLessThanOrEqual(390 - PAGE_PADDING);
    // `screen.module.css` reads `var(--board-mobile-max)` with no fallback, so
    // omitting the declaration deletes the ≤768px cap in silence (N12/N34).
    expect(decl(bodyOf(SHARED_MOBILE, ".gridCard"), "max-width")).toBe(
      "var(--board-mobile-max)",
    );
  });

  it("A3 — clears the two-digit column-clue floor at 320px and at 390px", () => {
    for (const size of SIZES) {
      // Against the cap that size actually RESOLVES: `.mobileCap5` sits on the
      // page root and custom properties inherit, so a size-5 row computed
      // against 350 would be a loosening — the direction that hides a
      // regression.
      expect(mobileCell(size, 320)).toBeGreaterThanOrEqual(TWO_DIGIT);
      expect(mobileCell(size, 390)).toBeGreaterThanOrEqual(TWO_DIGIT);
      expect(mobileCell(size, 390)).toBeGreaterThan(mobileCell(size, 320));
    }
    // The decision this whole section rests on, and the anti-vacuity guard on
    // the loop above: the worst case has 0.98px of measured slack over the
    // floor, so any reintroduced `gap` fails — a gapped 15-class board gives
    // 12.33px at 320 against the 13.203px a two-digit column clue needs.
    expect(mobileCell(15, 320) - TWO_DIGIT).toBeLessThan(1.5);
  });

  it("A4 — draws the ruled field as per-cell borders, at gap 0", () => {
    const cell = bodyOf(GAME_CSS, ".cell");
    const hairline =
      "1px solid color-mix(in srgb, var(--ink) 50%, transparent)";

    expect(decl(bodyOf(GAME_CSS, ".grid"), "gap")).toBe("0");
    expect(decl(cell, "border-top")).toBe(hairline);
    expect(decl(cell, "border-left")).toBe(hairline);
    expect(decl(bodyOf(GAME_CSS, ".cellRuleTop"), "border-top-width")).toBe(
      "2px",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellRuleTop"), "border-top-color")).toBe(
      "var(--ink)",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellRuleLeft"), "border-left-width")).toBe(
      "2px",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellRuleLeft"), "border-left-color")).toBe(
      "var(--ink)",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellEdgeRight"), "border-right")).toBe(
      "2px solid var(--ink)",
    );
    expect(decl(bodyOf(GAME_CSS, ".cellEdgeBottom"), "border-bottom")).toBe(
      "2px solid var(--ink)",
    );
  });

  it("A5 — the single top-level .cell carries no radius and is border-box", () => {
    const cell = bodyOf(GAME_CSS, ".cell");

    // Anti-vacuity: only the TOP-LEVEL block declares this background, so a
    // `bodyOf` that read the mobile `.cell { aspect-ratio: 1 }` instead would
    // fail here rather than pass "declares no border-radius" for the wrong
    // reason (TR-5).
    expect(decl(cell, "background")).toBe("var(--paper-desk)");
    expect(decl(cell, "box-sizing")).toBe("border-box");
    // At gap 0 a 5px radius notches all four corners of every interior
    // junction (deviation 2); without border-box the 2px rules widen tracks.
    expect(decl(cell, "border-radius")).toBeUndefined();
  });

  it("A6 — every desktop board still fits the shared 1140px fold", () => {
    for (const size of SIZES) {
      const board = gutterWidth(size) + size * desktopCell(size);
      const card = board + 2 * token("--space-4") + 2;
      // The 1141–1440 band CI never scans — the only mechanical statement that
      // the shared fold still holds.
      expect(card).toBeLessThanOrEqual(FOLD_COLUMN);
    }
  });

  it("A7 — every desktop template is square", () => {
    for (const size of SIZES) {
      const body = bodyOf(GAME_CSS, `.size${size}`);
      expect(decl(body, "grid-template-rows")).toBe(
        decl(body, "grid-template-columns"),
      );
    }
  });

  it("A8 — gives the grid and both rails no boundary at all", () => {
    // `cramped-padding`'s flush branch reads computed borders and backgrounds
    // and needs a visible boundary; `nested-cards` needs a shadow or a
    // `border` class name. Neither can fire on any of these three.
    for (const local of [".grid", ".clueRow", ".clueCol"]) {
      const body = bodyOf(GAME_CSS, local);
      for (const property of [
        "background",
        "background-color",
        "border",
        "outline",
        "box-shadow",
      ]) {
        expect(decl(body, property)).toBeUndefined();
      }
    }
  });

  it("A9 — sets the clue numerals at the exact triple DIGIT was measured at", () => {
    const number = bodyOf(GAME_CSS, ".clueNumber");

    // An `>=` here would let a 12px edit through while A3 kept computing with
    // a stale 6.609375. 11px is simultaneously the measurement's size and
    // `undersized-ui-text`'s floor.
    expect(decl(number, "font-family")).toBe("var(--font-ui)");
    expect(decl(number, "font-weight")).toBe("600");
    expect(pixels(decl(number, "font-size"))).toBe(11);
    expect(decl(number, "font-variant-numeric")).toBe("tabular-nums");
  });

  it("A10 — keeps every brush control clear of the 44px touch target", () => {
    const controls = bodyOf(MOBILE_CHROME, ".controls");
    const minimum = token("--touch-target-min");

    // The premise the arithmetic rests on: a max-content row makes it fiction,
    // which is how #18's sub-44px controls got in.
    expect(decl(controls, "width")).toBe("100%");
    expect(decl(controls, "max-width")).toBe("var(--board-mobile-max)");
    const gap = pixels(decl(controls, "gap"));
    // BOTH caps the page root can resolve — `.mobileCap5` sits on the same
    // element and custom properties inherit, so a Monday's row is 310px wide.
    for (const cap of [mobileCap(15), mobileCap(5)]) {
      const row = Math.min(cap, 320 - PAGE_PADDING);
      expect((row - 2 * gap) / 3).toBeGreaterThanOrEqual(minimum);
    }
    const control = bodyOf(MOBILE_CHROME, ".control");
    expect(pixels(decl(control, "height"))).toBeGreaterThanOrEqual(minimum);
    // `(row - 2 * gap) / 3` above is arithmetic over CSS text, and a flex
    // item's automatic minimum size is its MIN-CONTENT width — so without
    // this the division is fiction: measured in Chrome at 320px against the
    // built CSS, the row came out 89.06 / 87.47 / 87.47 rather than three
    // 88s. jsdom cannot see it and CI's mobile scan runs at 390px, where it
    // does not appear at all.
    expect(decl(control, "min-width")).toBe("0");
    // And the label has to fit the equal share it is now held to: at 88px a
    // 12px inline inset plus the 1.5px border leaves 61px for a 68.4px word.
    expect(decl(control, "padding")).toBe("var(--space-2) var(--space-1)");
    // A phone has no keyboard to advertise.
    expect(decl(bodyOf(MOBILE_CHROME, ".affordance"), "display")).toBe("none");
  });

  it("A10b — places the keyboard affordance the way a flex ROW allows", () => {
    // `.controls` is `display: flex; align-items: center`, so a `margin-top`
    // does not start a second line — it offsets the span 6px below the
    // buttons' centre while it stays inline to their right (measured in
    // Chrome at 1440px). Sudoku's affordance uses `margin-top` legitimately
    // because Sudoku GRID-places it on an explicit second row; the structural
    // precedent here is Binairo's, and this is Binairo's rule.
    const affordance = bodyOf(GAME_CSS, ".affordance");
    const controls = bodyOf(GAME_CSS, ".controls");

    expect(decl(controls, "display")).toBe("flex");
    expect(decl(controls, "align-items")).toBe("center");
    expect(decl(affordance, "margin-top")).toBeUndefined();
    expect(decl(affordance, "margin-left")).toBe("var(--space-3)");
    // The size both shipped affordances use, and above `undersized-ui-text`.
    expect(pixels(decl(affordance, "font-size"))).toBe(13);
  });

  it("A11 — carries a rotation signature no other game's board declares", () => {
    const page = bodyOf(GAME_CSS, ".pageNonogram");
    const rotations = ["--grid-card-rot", "--stats-card-rot", "--tape-rot"];
    const mine = rotations.map((name) => decl(page, name));

    for (const value of mine) {
      expect(value).toBeDefined();
    }
    for (const card of mine.slice(0, 2)) {
      const degrees = Math.abs(Number(/^(-?[\d.]+)deg$/.exec(card ?? "")?.[1]));
      expect(degrees).toBeGreaterThanOrEqual(0.3);
      expect(degrees).toBeLessThanOrEqual(2.4);
    }
    const tape = Math.abs(Number(/^(-?[\d.]+)deg$/.exec(mine[2] ?? "")?.[1]));
    expect(tape).toBeGreaterThanOrEqual(3);
    expect(tape).toBeLessThanOrEqual(5);

    // Makes `sudoku-board.module.css`'s "distinct signature" rule mechanical
    // instead of a comment.
    for (const [sheet, local] of [
      ["src/binairo/binairo-screen.module.css", ".pageBinairo"],
      ["src/sudoku/sudoku-board.module.css", ".pageSudoku"],
    ] as const) {
      const other = bodyOf(stylesheet(sheet), local);
      expect(mine).not.toEqual(rotations.map((name) => decl(other, name)));
    }
  });

  it("A12 — caps a Monday's CARD so the board still fills its paper", () => {
    expect(mobileCap(5)).toBe(310);
    // 310 = 288 board + 2×10 padding + 2×1 border, i.e. a 52.03px cell — the
    // desktop 52px, so the Monday board is not LARGER on a phone than on a
    // desktop and its card is not 31px wider than its board (DES-5).
    expect(Math.abs(mobileCell(5, 390) - 52)).toBeLessThan(1);
    expect(
      decl(bodyOf(MOBILE_GEOMETRY, ".size5"), "max-width"),
    ).toBeUndefined();
  });

  it("A13 — spends the last free channel on the hint, additively", () => {
    expect(decl(bodyOf(GAME_CSS, ".cellFilled"), "background")).toBe(
      "var(--accent)",
    );
    for (const local of [".cellFilled.cellHinted", ".cellCrossed.cellHinted"]) {
      const body = bodyOf(GAME_CSS, local);
      // A copied `background: color-mix(… 10% …)` would REPLACE the fill and
      // render the day's one free hint as a ~10% tint on a board where the
      // fill IS the payload (DES-1).
      expect(decl(body, "box-shadow")).toBeDefined();
      for (const property of [
        "background",
        "background-color",
        "border-color",
      ]) {
        expect(decl(body, property)).toBeUndefined();
      }
    }

    // The brush pair is a clean inversion asserted BY VALUE, not by counting
    // declarations: `decl()` cannot see inside `.control`'s `border`
    // shorthand, so a `border-color` clause would pass for the wrong reason.
    const control = bodyOf(GAME_CSS, ".control");
    const active = bodyOf(GAME_CSS, ".controlActive");
    expect(decl(control, "background")).toBe("var(--paper-card)");
    expect(decl(control, "color")).toBe("var(--accent)");
    expect(decl(active, "background")).toBe("var(--accent)");
    expect(decl(active, "color")).toBe("var(--paper-card)");
    expect(decl(active, "border")).toBeUndefined();
    expect(decl(active, "border-color")).toBeUndefined();
  });

  it("A14 — transitions paint only, and declares its own reduced-motion branch", () => {
    const reduced = bodyOf(GAME_CSS, "@media (prefers-reduced-motion: reduce)");
    expect(reduced).toContain(".cell");
    expect(reduced).toContain(".control");

    const transition = decl(bodyOf(GAME_CSS, ".cell"), "transition");
    // The anti-vacuity guard: a second top-level `.cell` rule would send this
    // lookup to the ruled-field half, which declares none, and the assertions
    // below would pass on `undefined` (§12.4 rule iii).
    expect(transition).toBeDefined();
    for (const property of [
      "transform",
      "width",
      "height",
      "padding",
      "margin",
    ]) {
      expect(transition).not.toContain(property);
    }
  });

  it("A(caret) — declares selection and focus as ONE block, inset (T-WEB-S49)", () => {
    // ADR-0030 consequence (c) — the caret and the selection can never
    // disagree — held mechanically rather than by discipline. This is the
    // claim ADR-0030 says is assertable and that nothing in the repo asserts
    // for any board (G7/N17).
    expect(GAME_CSS).toMatch(/^\.cellSelected,\n\.cell:focus-visible \{/m);

    const caret = bodyOf(GAME_CSS, ".cell:focus-visible");
    // INK, not the accent: a filled cell IS solid --accent-nonogram, so an
    // accent caret on it would be 1:1 — invisible on exactly the cells the
    // player is working.
    expect(decl(caret, "outline")).toBe("2px solid var(--ink)");
    // Inset, never offset: at gap 0 a positive offset paints over the
    // neighbouring cell.
    expect(pixels(decl(caret, "outline-offset"))).toBeLessThan(0);
  });

  it("C1 — draws the frame and the every-five rule as classes, not comments", () => {
    for (const fixture of [SMALL, BIG]) {
      const { container, unmount } = render(<NonogramScreen daily={fixture} />);
      const side = fixture.size;
      for (let index = 0; index < side * side; index += 1) {
        const row = Math.floor(index / side);
        const column = index % side;
        const classes = cellAt(container, index).classList;
        expect(classes.contains(className("cellRuleTop"))).toBe(row % 5 === 0);
        expect(classes.contains(className("cellRuleLeft"))).toBe(
          column % 5 === 0,
        );
        expect(classes.contains(className("cellEdgeRight"))).toBe(
          column === side - 1,
        );
        expect(classes.contains(className("cellEdgeBottom"))).toBe(
          row === side - 1,
        );
      }
      unmount();
    }
  });
});

/**
 * The reveal's own CSS (T-WEB-S52, plan 020 §13.4/§13.5). It lives in the
 * SHARED conclusion module and not in this game's, because CSS Modules hash
 * per file and a `.picture` block declared anywhere else could never reach the
 * node `conclusion-view.tsx` renders (landmine 24) — so this is where the
 * contained-celebration rules become mechanical.
 */
describe("the picture reveal's CSS (T-WEB-S52)", () => {
  const CONCLUSION_CSS = stylesheet("src/play/conclusion-view.module.css");

  it("settles once on mount, on the tokens the design system already carries", () => {
    const animation = decl(bodyOf(CONCLUSION_CSS, ".picture"), "animation");

    expect(animation).toContain("picture-settle");
    // The forbidden-name regex is impeccable's `bounce-easing` rule, and it
    // matches on the animation NAME, not on the curve.
    expect(animation).not.toMatch(/bounce|elastic|wobble|jiggle|spring/i);
    // Exactly one mount keyframe, no repeat.
    expect(animation).not.toMatch(/infinite|alternate/);
    // No new bezier: `--ease-settle`'s 1.05 y2 is inside the rule's allowed
    // [-0.1, 1.1] band, and `--duration-slow` (250 ms) sits at the top of
    // DESIGN.md:44's 150–250 ms band.
    expect(animation).toContain("var(--duration-slow)");
    expect(animation).toContain("var(--ease-settle)");
  });

  it("moves paint only, so `layout-transition` cannot fire on it", () => {
    const keyframe = bodyOf(CONCLUSION_CSS, "@keyframes picture-settle");
    const animated = new Set(
      [...keyframe.matchAll(/(?:^|;|\{)\s*([a-z-]+)\s*:/g)].map(
        ([, property]) => property,
      ),
    );

    expect(animated).toEqual(new Set(["transform", "opacity"]));
  });

  it("is not a card inside a card", () => {
    // impeccable's `isCardLikeFromProps` returns false on its FIRST guard for
    // an element with neither shadow nor border, and "card dentro de card" is
    // a DESIGN.md anti-reference verbatim.
    for (const local of [".picture", ".pictureRow"]) {
      const body = bodyOf(CONCLUSION_CSS, local);
      for (const property of [
        "background",
        "background-color",
        "border",
        "border-radius",
        "box-shadow",
      ]) {
        expect(decl(body, property)).toBeUndefined();
      }
    }
  });

  it("stands the mount keyframe down for reduced motion, in the SAME module", () => {
    const reduced = bodyOf(
      CONCLUSION_CSS,
      "@media (prefers-reduced-motion: reduce)",
    );

    expect(reduced).toContain(".picture");
    expect(decl(bodyOf(reduced, ".picture"), "animation")).toBe("none");
    // The keyframe's END state, not its start: standing the animation down
    // must not leave the figure at `opacity: 0`.
    expect(decl(bodyOf(reduced, ".picture"), "opacity")).toBe("1");
  });
});
