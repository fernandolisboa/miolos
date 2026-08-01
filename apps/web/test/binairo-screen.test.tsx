import type { DailyBinairoResponse } from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BinairoScreen } from "../src/binairo/binairo-screen";
import styles from "../src/binairo/binairo-screen.module.css";
import sharedStyles from "../src/play/screen.module.css";
import {
  playRecordKey,
  readPlayRecord,
  writePlayRecord,
  type BinairoPlayRecord,
} from "../src/play/play-record";
import { formatElapsed, messages } from "../src/i18n";
import { bodyOf, decl, pixels, stylesheet, token } from "./css-source";
import { installPointerStubs, stubElementFromPoint } from "./pointer";

// T-WEB-5..T-WEB-9d (plan 017 §15). UI composition is not TDD-shaped, so
// these are smoke tests written after the screens; every assertion goes
// through `messages.*` rather than a literal, except the two deliberate
// tripwires (the frame's shorter rules sentence, and "dias seguidos").

// The queue is proved by binairo-sync.test.ts with no screen mounted; here
// it is stubbed so the composition tests never touch the network and
// "no POST is issued" is an assertion rather than an absence.
const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  // The argument is echoed back rather than dropped: the solved effect hands
  // the completion it just built to the flush, and that is what the queue
  // falls back on where `localStorage` is unavailable.
  flushPendingCompletions: vi.fn((record?: BinairoPlayRecord) =>
    Promise.resolve(record),
  ),
}));
vi.mock("../src/play/sync", () => sync);

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

const DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...PUZZLE.givens],
};

// The stroke scaffolding jsdom does not provide (`./pointer`, plan 020 §19):
// `elementFromPoint`, which does not exist on the document at all, and the
// two pointer-capture methods.
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

/** The cells to cross, plus one the stroke never touches. */
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

/** Three playable cells side by side in one row — a rule 2 violation waiting. */
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

/** The two sheets the play screen is now split across (plan 018 §5.5). */
const GAME_CSS = stylesheet("src/binairo/binairo-screen.module.css");
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
 * The game module wins where both declare a name, exactly as the cascade
 * cannot.
 */
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

/**
 * Every class the stylesheets place in one of `.page`'s named grid areas —
 * read off the CSS rather than listed here, so a new area added to `PlayView`
 * puts itself under the skeleton tripwire below without anyone remembering to.
 *
 * The UNION over both sheets, deduped (plan 018 §5.5): every `grid-area`
 * block (`.topBar`, `.titleBlock`, `.statsCard`, `.hint`, `.board`) moved to
 * the shared layout module, so reading the game module alone would yield
 * `[]` and the anti-vacuity assertion below would silently pass on nothing.
 */
const GRID_AREA_CLASSES = [
  ...new Set(
    [GAME_CSS, SHARED_CSS]
      .flatMap((sheet) => [...sheet.matchAll(/^\.(\w+)[^{]*\{([^}]*)\}/gm)])
      .filter(([, , body]) => /(?:^|;)\s*grid-area\s*:/.test(body ?? ""))
      .map(([, local]) => local ?? ""),
  ),
];

/** The readouts the skeleton reserves with a blank line box rather than a value. */
const BLANK_READOUTS = [
  "timerBar",
  "timerCard",
  "progressBar",
  "progressCard",
] as const;

/** `PlaySkeleton`'s blank — one line box in the readout's own font. */
const BLANK = "\u00a0";

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
      messages.games.binairo.play.cellGivenAria(
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

  it("names a rule-breaking cell with the copy module's composed string", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    const [first, second, third] = consecutiveInARow();

    // Three zeros side by side break rule 2, so all three become violating.
    for (const index of [first, second, third]) {
      fireEvent.click(cellAt(container, index));
    }

    // The WHOLE accessible name comes from messages.ts, separator included:
    // it is user-facing copy, and a component is not where copy is composed
    // (ADR-0018, finding `adr-0018-aria-label-composed-in-component`).
    expect(cellAt(container, second)).toHaveAttribute(
      "aria-label",
      messages.games.binairo.play.cellInvalidAria(
        Math.floor(second / 8) + 1,
        (second % 8) + 1,
        0,
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

  it("clears a cell in erase mode", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");

    fireEvent.click(
      screen.getByLabelText(messages.games.binairo.play.controls.eraseAria),
    );
    fireEvent.click(cellAt(container, FIRST_EMPTY));

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
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

// Under pointer capture the browser retargets the trailing `click` to the
// CONTAINER, so the cell button's own onClick is never in its propagation
// path: a stationary tap in paint mode used to write nothing at all and
// paint was drag-only (issue #18 asks for tap-to-cycle PLUS a paint mode).
// jsdom simulates none of that, so these tests drive the pointer sequence
// the browser produces and pin the handler that has to resolve it.
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
    // `detail: 1` is what makes this a POINTER click: jsdom's fireEvent
    // defaults to 0, which is the keyboard-activation value.
    fireEvent.click(cellAt(container, FIRST_EMPTY), { detail: 1 });

    // In paint mode `tap` toggles, so honouring both would clear it again.
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");
  });

  it("clears a cell with one tap in erase mode", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    fireEvent.click(cellAt(container, FIRST_EMPTY));
    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("0");
    fireEvent.click(
      screen.getByLabelText(messages.games.binairo.play.controls.eraseAria),
    );
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

    expect(cellAt(container, FIRST_EMPTY).textContent).toBe("");
  });

  it("writes nothing when a non-primary button opens the stroke", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);
    stubElementFromPoint(container);
    enterPaintMode();
    const grid = gridOf(container);

    // A trackpad two-finger tap, a right-click or a middle-click. Resolving
    // the tap on `pointerup` made this reachable for the first time: the
    // browser fires `auxclick`, not `click`, for a non-primary button, so
    // the cell's own handler was never in its path (finding
    // `right-button-pointerup-writes-a-cell`). A single touch contact
    // reports `button === 0`, so touch keeps taking the path above.
    fireEvent.pointerDown(grid, {
      clientX: FIRST_EMPTY,
      clientY: 0,
      pointerId: 1,
      button: 2,
    });
    fireEvent.pointerUp(grid, {
      clientX: FIRST_EMPTY,
      clientY: 0,
      pointerId: 1,
      button: 2,
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
    // The trailing pointer click the browser fires on the release target is
    // suppressed — honouring it would toggle the stroke's last cell back off.
    fireEvent.click(cellAt(container, c), { detail: 1 });
    expect(cellAt(container, c).textContent).toBe("1");

    // Enter on a cell the drag never touched: no pointer event precedes it,
    // and `detail` is 0. The drag flag may never swallow this (the grid's
    // whole keyboard story depends on it).
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

    // Finger 1 opens the stroke and crosses two cells.
    fireEvent.pointerDown(grid, { clientX: a, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(grid, { clientX: b, clientY: 0, pointerId: 1 });

    // A second contact lands and lifts — a palm, the holding thumb, a second
    // finger. Every handler is scoped to the pointer that opened the stroke
    // (finding `grid-stroke-state-is-not-scoped-to-a-pointerid`); without
    // that scoping this `pointerup` ran `endDrag()` and finger 1's remaining
    // cells were silently dropped, with nothing on screen to say so.
    fireEvent.pointerDown(grid, { clientX: d, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(grid, { clientX: d, clientY: 0, pointerId: 2 });

    // Finger 1 carries on.
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

    // The hazard scoping introduces: a stroke that never closes would latch
    // the board dead. `lostpointercapture` fires whenever capture ends for
    // any reason, so the next stroke always opens.
    fireEvent.pointerDown(grid, { clientX: a, clientY: 0, pointerId: 1 });
    fireEvent.lostPointerCapture(grid, { pointerId: 1 });

    fireEvent.pointerDown(grid, { clientX: b, clientY: 0, pointerId: 2 });
    fireEvent.pointerUp(grid, { clientX: b, clientY: 0, pointerId: 2 });

    expect(cellAt(container, b).textContent).toBe("1");
  });
});

describe("the one free hint (T-WEB-9)", () => {
  it("fills exactly one cell, then renders the exhausted variant", () => {
    render(<BinairoScreen daily={DAILY} />);

    fireEvent.click(
      screen.getByText(messages.games.binairo.play.hint.available),
    );

    expect(
      screen.getByText(
        messages.games.binairo.play.progressLong(GIVENS_COUNT + 1, 64),
      ),
    ).toBeInTheDocument();
    const exhausted = screen.getByText(messages.games.binairo.play.hint.used);
    expect(exhausted).toHaveAttribute("aria-disabled", "true");
    // The one-line explanation names which case fired (§10.2). An empty
    // fixture grid has no contradiction yet, so it is always a fill.
    expect(
      screen.getByText(messages.games.binairo.play.hint.explain.fill),
    ).toBeInTheDocument();

    fireEvent.click(exhausted);

    expect(
      screen.getByText(
        messages.games.binairo.play.progressLong(GIVENS_COUNT + 1, 64),
      ),
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
    expect(
      screen.getByText(messages.conclusion.stampLabel),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-cell-index]")).toBeNull();
    // The offline guarantee (D26): a force-dynamic route with no service
    // worker is unreachable offline, so the conclusion never navigates.
    expect(router.push).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(sync.flushPendingCompletions).toHaveBeenCalled();
  });

  it("hands the completion it just built to the flush, not just the store", () => {
    const { container } = render(<BinairoScreen daily={DAILY} />);

    solveByClicking(container);

    // Where `localStorage` is unavailable the write is a silent no-op and
    // the queue reads back empty, so a flush with no argument would post
    // nothing at all and the day would be lost (finding
    // `completion-lost-when-localstorage-is-unavailable`).
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

    // The record still in storage at the swap is the last PLAYING one, whose
    // `syncOutcome` predates this completion — reading the offline sentence
    // off it told an online player their result was stuck (findings
    // `pending-sync-line-on-the-happy-path` / `sync-pending-line-on-happy-path`).
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

    // A Cmd/middle-click from Hoje loads the document hidden: `load` and
    // `pageshow` still fire, and no `visibilitychange` ever will. An ungated
    // `pageshow → resume` would count every minute until the player opens
    // the tab, and `completions` is write-once (finding
    // `pageshow-resumes-timer-in-a-hidden-tab`).
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

    // The iOS back-navigation this listener exists for: a restore is visible
    // by definition, so gating it costs nothing.
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

    // Tab B is still `playing`; one tap re-runs its persist effect over the
    // same (game, date) key. The queued completion is the ONLY copy the
    // server has not acknowledged (finding
    // `in-progress-write-clobbers-a-queued-completion`).
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

    // `pagehide` is the OTHER writer of this key, through a far more common
    // door than an entry change: the screen's own "voltar" link, a reload, a
    // tab close and a bfcache entry all fire it, and `toRecord` reports a
    // still-playing mount as `concluded: false, grid: undefined` (finding
    // `pagehide-write-still-clobbers-a-queued-completion`).
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

    // The timer never started: five seconds later the stamp reads the same.
    expect(screen.getByLabelText(stamped)).toBeInTheDocument();
    // And the completion is never re-queued — the row is write-once
    // server-side, and re-posting would resurrect a settled sync (D15).
    expect(sync.flushPendingCompletions).not.toHaveBeenCalled();
  });
});

describe("the first paint (T-WEB-9d)", () => {
  it("is a board-shaped skeleton: no record, no clock, no live affordance", () => {
    writePlayRecord(concludedRecord());
    const readStorage = vi.spyOn(Storage.prototype, "getItem");

    // The server render is the first paint by definition — no effects run,
    // so this is exactly the markup the client hydrates against (D28).
    const markup = renderToStaticMarkup(<BinairoScreen daily={DAILY} />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(markup).toContain('data-play-state="skeleton"');
    // Everything below is derived from a record that has not been read yet.
    // Painting it first shows a day the player already finished as an empty
    // board with a live hint button and a stopped clock, for as long as
    // hydration takes (finding
    // `binairo-reload-flashes-a-blank-board-over-a-finished-day`).
    expect(markup).not.toContain("00:00");
    expect(markup).not.toContain(
      messages.games.binairo.play.progressLong(GIVENS_COUNT, 64),
    );
    expect(markup).not.toContain(messages.games.binairo.play.hint.available);
    expect(markup).not.toContain("<button");
    // Not the conclusion either, even though a concluded record is sitting
    // in storage: nothing record-derived may reach the first paint.
    expect(markup).not.toContain(messages.conclusion.stampLabel);
  });

  it("paints no cell before the record has been read", () => {
    const markup = renderToStaticMarkup(<BinairoScreen daily={DAILY} />);

    // The screen's identity still paints immediately; only the values read
    // off the record wait. This says NOTHING about the wire and must not be
    // read as an ADR-0004 guard: `daily` is a prop of a "use client"
    // component, so the givens travel in the same response's RSC payload.
    // The wall that keeps a puzzle off the client is `getTodayDaily`'s
    // solution strip, asserted where it lives (finding
    // `givens-off-the-wire-is-false`).
    expect(markup).toContain(messages.games.binairo.play.title);
    expect(markup).toContain(messages.games.binairo.play.rules);
    expect(markup).not.toContain("data-cell-index");
  });

  it("reserves every box the play shell occupies, so nothing moves", () => {
    // jsdom has no layout, so this is the tripwire and not the measurement:
    // the board card jumped upward 71.7px at 390x844 and 41.0px at 1440x900
    // because `.board` is a centred flex column and the mobile `hint` row is
    // `auto`, so an absent control row and an absent hint bar hand their
    // height to the board as an OFFSET. The pixels were measured in Chrome
    // and live in the PR body; what is pinned here is that the skeleton and
    // the hydrated screen occupy the same boxes (finding
    // `play-skeleton-is-not-at-final-dimensions`).
    const skeleton = parsed(
      renderToStaticMarkup(<BinairoScreen daily={DAILY} />),
    );
    const { container: hydrated } = render(<BinairoScreen daily={DAILY} />);

    // Anti-vacuity: `GRID_AREA_CLASSES` is read off the CSS with a regex, and
    // an empty list would make the comparison below pass on nothing.
    expect(occupantsIn(hydrated)).toEqual(
      expect.arrayContaining(["board", "hint", "statsCard"]),
    );
    expect(occupantsIn(skeleton)).toEqual(occupantsIn(hydrated));
    // Not a grid area, and the largest single contributor: `.controls` sits
    // INSIDE `.board`, so its absence re-centres the card by half its height.
    expect(skeleton.querySelector(`.${className("controls")}`)).not.toBeNull();
  });

  it("reserves them without a value, a control or a tab stop", () => {
    const skeleton = parsed(
      renderToStaticMarkup(<BinairoScreen daily={DAILY} />),
    );

    // The boxes are reserved; what fills them is not. A no-break space is
    // what gives a blank readout its line box, so the card it sits in is the
    // height it will be after hydration rather than a collapsed one.
    for (const readout of BLANK_READOUTS) {
      expect(
        skeleton.querySelector(`.${className(readout)}`)?.textContent,
      ).toBe(BLANK);
    }
    // The only tab stop in the whole skeleton is the way back out.
    expect(
      skeleton.querySelectorAll("button, a[href], [tabindex]"),
    ).toHaveLength(1);
  });
});

/**
 * The two mobile layout defects, read off the stylesheet as TEXT.
 *
 * jsdom implements no layout at all, so nothing above this line can see a
 * board wider than its phone or a 38px-wide button — both were found by
 * measuring the real page in a browser (step 6) and both are pinned here by
 * doing the arithmetic the browser does. This is a tripwire, not the
 * measurement: the live numbers live in the PR body.
 */
describe("the mobile board and controls (layout tripwires)", () => {
  const CSS = GAME_CSS;
  const MOBILE = bodyOf(CSS, "@media (max-width: 768px)");
  /** The shared layout's own mobile block — `.gridCard` lives there now. */
  const SHARED_MOBILE = bodyOf(SHARED_CSS, "@media (max-width: 768px)");
  /** `.page`'s own horizontal padding in this band, both sides. */
  const PAGE_PADDING = 2 * token("--space-5");
  /** The narrowest phone the layout has to survive. */
  const NARROWEST_VIEWPORT = 320;

  it("sizes the board fluidly with 38px as a cap, never as a fixed track", () => {
    // finding `board-overflows-horizontally-below-369px`: fixed 38px columns
    // made the card 347px wide against the 280px a 320px phone leaves, so the
    // whole DOCUMENT scrolled sideways (368 vs 320) and the last two columns
    // were unreachable. CLAUDE.md: the page body must never scroll
    // horizontally.
    const grid = bodyOf(MOBILE, ".grid");
    const card = bodyOf(SHARED_MOBILE, ".gridCard");

    expect(decl(grid, "grid-template-columns")).not.toMatch(/\d+px/);
    expect(decl(grid, "grid-template-columns")).toBe(
      "repeat(8, minmax(0, 1fr))",
    );
    // Without border-box the cap would exclude the padding and the border,
    // and the card would overflow its own cap by 22px.
    expect(decl(card, "box-sizing")).toBe("border-box");
    expect(decl(card, "width")).toBe("100%");
    expect(decl(card, "max-width")).toBe("var(--board-mobile-max)");
  });

  it("keeps the cap at DESIGN.md's 38px cells and inside a 390px viewport", () => {
    // `--board-mobile-max` is declared on the game's own page class now, not
    // inside the shared mobile `.page` block: a per-game class cannot open a
    // media query the shared sheet owns, and it is only ever READ there
    // (plan 018 §12.2/§5.5).
    const cap = pixels(decl(bodyOf(CSS, ".pageBinairo"), "--board-mobile-max"));
    const gap = pixels(decl(bodyOf(MOBILE, ".grid"), "gap"));
    const padding = pixels(decl(bodyOf(SHARED_MOBILE, ".gridCard"), "padding"));
    // .gridCard's `1px solid var(--line)`, from the rule outside the query.
    const border = 1;

    const cell = (cap - 2 * padding - 2 * border - 7 * gap) / 8;

    expect(cell).toBe(38);
    expect(cap).toBeLessThanOrEqual(390 - PAGE_PADDING);
  });

  it("gives the control row the board's width so its flex ratios apply", () => {
    // finding `mobile-controls-shrink-to-fit-and-sub-44px-targets`: `.board`
    // is a column flex container, so a row with no width is shrink-to-fit on
    // the cross axis and `flex: 1.4/1.4/1` was resolved against max-content —
    // 43.5px and 38px digits, under PRODUCT.md:39's 44px floor, on the
    // primary input of a touch game.
    const controls = bodyOf(MOBILE, ".controls");

    expect(decl(controls, "width")).toBe("100%");
    expect(decl(controls, "max-width")).toBe("var(--board-mobile-max)");
  });

  it("leaves every control clear of the 44px touch target at 320px", () => {
    const controls = bodyOf(MOBILE, ".controls");
    // The premise the arithmetic below rests on: a max-content row makes it
    // fiction, which is exactly how the defect got in.
    expect(decl(controls, "width")).toBe("100%");

    const cap = pixels(decl(bodyOf(CSS, ".pageBinairo"), "--board-mobile-max"));
    const row = Math.min(cap, NARROWEST_VIEWPORT - PAGE_PADDING);
    const free = row - 2 * pixels(decl(controls, "gap"));
    const digit = Number(decl(bodyOf(MOBILE, ".controlDigit"), "flex"));
    const erase = Number(decl(bodyOf(MOBILE, ".controlErase"), "flex"));
    const total = 2 * digit + erase;
    const minimum = token("--touch-target-min");

    expect(free * (digit / total)).toBeGreaterThanOrEqual(minimum);
    expect(free * (erase / total)).toBeGreaterThanOrEqual(minimum);
    expect(
      pixels(decl(bodyOf(MOBILE, ".controlDigit"), "height")),
    ).toBeGreaterThanOrEqual(minimum);
    expect(
      pixels(decl(bodyOf(MOBILE, ".controlErase"), "height")),
    ).toBeGreaterThanOrEqual(minimum);
  });
});
