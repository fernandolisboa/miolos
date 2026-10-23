import {
  dailyTermoResponseSchema,
  type DailyTermoResponse,
} from "@miolos/core";
import {
  deriveKeyboardState,
  isValidGuess,
  MAX_GUESSES,
  TERMO_VALIDATION_WORDS,
  WORD_LENGTH,
  type TileStates,
} from "@miolos/games/termo";
import {
  act,
  createEvent,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";

import { DailyUnavailable } from "../src/components/daily-unavailable";
import { messages } from "../src/i18n";
import { ConclusionView } from "../src/play/conclusion-view";
import {
  readPlayRecord,
  writePlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";
import sharedStyles from "../src/play/screen.module.css";
import { Board } from "../src/termo/board";
import { Keyboard, KeyboardSkeleton } from "../src/termo/keyboard";
import { PlaySkeleton, PlayView } from "../src/termo/play-view";
import { initTermoPlayState, termoPlayReducer } from "../src/termo/state";
import styles from "../src/termo/termo-board.module.css";
import { TermoScreen } from "../src/termo/termo-screen";
import type { TermoPlayAction, TermoPlayState } from "../src/termo/types";
import type { TermoPlay } from "../src/termo/types";
import {
  bodyOf,
  boardFloor,
  decl,
  pixels,
  stylesheet,
  token,
} from "./css-source";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("../src/play/sync", () => sync);

const guessClient = vi.hoisted(() => ({ postGuesses: vi.fn() }));
vi.mock("../src/termo/guess-client", () => guessClient);

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/termo",
}));

const DATE = "2026-08-01";

const DAILY: DailyTermoResponse = dailyTermoResponseSchema.parse({
  game: "termo",
  date: DATE,
});

const copy = messages.games.termo.play;

const VALID = validationWord(0);
const SECOND = validationWord(1);

const INVALID = "zzzzz";

const TILES: TileStates = ["correct", "present", "absent", "absent", "absent"];

function concludedRecord(): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [
      {
        guess: VALID,
        tiles: ["correct", "correct", "correct", "correct", "correct"],
      },
    ],
    answer: VALID,
    outcome: "won",
    elapsedMs: 272_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };
}

function validationWord(index: number): string {
  const word = TERMO_VALIDATION_WORDS[index];
  if (word === undefined) {
    throw new Error(`the validation list has no word at ${String(index)}`);
  }
  return word;
}

interface PlayFixture {
  readonly play: TermoPlay;
  readonly type: ReturnType<typeof vi.fn>;
  readonly erase: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
  readonly submit: ReturnType<typeof vi.fn>;
  readonly retry: ReturnType<typeof vi.fn>;
}

function playFixture(overrides: Partial<TermoPlayState> = {}): PlayFixture {
  const state: TermoPlayState = {
    ...initTermoPlayState(DAILY.date),
    hydrated: true,
    ...overrides,
  };
  const live = state.status === "playing";
  const handlers = {
    type: vi.fn(),
    erase: vi.fn(),
    select: vi.fn(),
    submit: vi.fn(),
    retry: vi.fn(),
  };
  return {
    ...handlers,
    play: {
      state,
      used: state.guesses.length,
      activeRow: live && state.pending === null ? state.guesses.length : null,
      heldRow: state.pending === null ? null : state.guesses.length,
      keyboardState: deriveKeyboardState(state.guesses),
      unavailable: false,
      ...handlers,
    },
  };
}

function slots(word: string): readonly string[] {
  return Array.from({ length: WORD_LENGTH }, (_unused, slot) =>
    word.charAt(slot),
  );
}

function boardOf(): HTMLElement {
  return screen.getByRole("group", { name: copy.boardAria });
}

function keyboardOf(): HTMLElement {
  return screen.getByRole("group", { name: copy.keyboard.label });
}

function letterKey(letter: string): HTMLElement {
  return screen.getByRole("button", {
    name: copy.keyboard.letterAria(letter),
  });
}

function rowLabels(): readonly (string | null)[] {
  return within(boardOf())
    .getAllByRole("group")
    .map((row) => row.getAttribute("aria-label"));
}

function cellLabels(): readonly (string | null)[] {
  return within(boardOf())
    .queryAllByRole("button")
    .map((cell) => cell.getAttribute("aria-label"));
}

function typeOnBody(word: string): void {
  for (const letter of word) {
    fireEvent.keyDown(document.body, { key: letter });
  }
}

function judged(
  spent: number,
  last: TileStates,
  status: "playing" | "won" | "lost" = "playing",
  answer?: string,
): unknown {
  return {
    kind: "judged",
    tiles: [...Array.from({ length: spent }, () => TILES), last],
    status,
    answer,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  guessClient.postGuesses.mockResolvedValue({
    kind: "held",
    reason: "offline",
  });
});

afterEach(() => {
  localStorage.clear();
});

describe("judged and future rows are output; only the active row takes input (T-WEB-S86, re-aimed by #327 / ADR-0106)", () => {
  it("is a labelled group of six labelled row groups, every tile outside the active row hidden", () => {
    const { play } = playFixture({
      guesses: [{ guess: VALID, tiles: TILES }],
    });

    const { container } = render(<PlayView play={play} />);

    const board = boardOf();
    expect(within(board).getAllByRole("group")).toHaveLength(MAX_GUESSES);
    const tiles = container.querySelectorAll(`.${styles.tile ?? ""}`);
    expect(tiles).toHaveLength(MAX_GUESSES * WORD_LENGTH);
    const hidden = [...tiles].filter(
      (tile) => tile.getAttribute("aria-hidden") === "true",
    );
    expect(hidden).toHaveLength((MAX_GUESSES - 1) * WORD_LENGTH);
    const active = within(board).getByRole("group", {
      name: copy.rowActiveAria(2, MAX_GUESSES),
    });
    expect(within(active).getAllByRole("button")).toHaveLength(WORD_LENGTH);
  });

  it("puts one tab stop on the board, on the active row's cursor cell", () => {
    const { play } = playFixture({ cursor: 3 });

    render(<PlayView play={play} />);

    const board = boardOf();
    const stops = board.querySelectorAll('[tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect(stops[0]?.getAttribute("aria-label")).toBe(
      copy.cellAria(4, WORD_LENGTH, ""),
    );
    expect(board.querySelectorAll("[tabindex]")).toHaveLength(WORD_LENGTH);
  });

  it("has no input row while a turn is held or the board is closed", () => {
    for (const overrides of [{ pending: VALID }, { status: "lost" as const }]) {
      const { play } = playFixture(overrides);
      const { unmount } = render(<PlayView play={play} />);
      expect(within(boardOf()).queryAllByRole("button")).toEqual([]);
      unmount();
    }
  });

  it("uses real row boxes, never `display: contents`", () => {
    expect(stylesheet("src/termo/termo-board.module.css")).not.toContain(
      "display: contents",
    );
  });
});

describe("the row's composed name and the two live regions (T-WEB-S87)", () => {
  it("names a judged row with its verdict, never with the bare word", async () => {
    guessClient.postGuesses.mockResolvedValue(judged(0, TILES));

    render(<TermoScreen daily={DAILY} />);
    typeOnBody(VALID);
    await act(() => {
      fireEvent.keyDown(document.body, { key: "Enter" });

      return Promise.resolve();
    });

    const labels = rowLabels();
    expect(labels[0]).toBe(copy.rowAria(1, MAX_GUESSES, VALID, TILES));
    expect(labels[0]).toContain(VALID.charAt(0));
    expect(labels[0]).not.toBe(VALID.toUpperCase());
    expect(labels[1]).toBe(copy.rowActiveAria(2, MAX_GUESSES));
    expect(labels[5]).toBe(copy.rowEmptyAria(6, MAX_GUESSES));
  });

  it("carries the DRAFT in the active row's cells and in the announcer", () => {
    render(<TermoScreen daily={DAILY} />);

    typeOnBody("ca");

    expect(rowLabels()[0]).toBe(copy.rowActiveAria(1, MAX_GUESSES));
    expect(cellLabels()).toEqual(
      [..."ca", "", "", ""].map((letter, slot) =>
        copy.cellAria(slot + 1, WORD_LENGTH, letter),
      ),
    );
    expect(announcerText()).toBe(copy.letterTypedAria("a", 2, WORD_LENGTH));
  });

  it("announces an erase too, with the letter that left", () => {
    render(<TermoScreen daily={DAILY} />);

    typeOnBody("ca");
    fireEvent.keyDown(document.body, { key: "Backspace" });

    expect(cellLabels()[1]).toBe(copy.cellAria(2, WORD_LENGTH, ""));
    expect(announcerText()).toBe(copy.letterErasedAria("a", 2, WORD_LENGTH));
  });

  it("never lets one transition write BOTH live regions — walked over every action", () => {
    const letters = (word: string): readonly TermoPlayAction[] =>
      [...word].map((letter) => ({ type: "type", letter }));
    const actions: readonly TermoPlayAction[] = [
      { type: "restore", record: undefined, now: 1 },
      ...letters(VALID),
      { type: "erase" },
      { type: "type", letter: VALID.charAt(WORD_LENGTH - 1) },
      { type: "tick", now: 2 },
      { type: "pause", now: 3 },
      { type: "resume", now: 4 },
      { type: "submit", acceptsProfanity: true },
      { type: "held", reason: "offline" },

      { type: "retry" },
      {
        type: "judged",
        guess: VALID,
        tiles: TILES,
        status: "playing",
        answer: undefined,
      },
      ...letters(SECOND),
      { type: "submit", acceptsProfanity: true },
      { type: "rejected", reason: "not-in-list" },
      { type: "submit", acceptsProfanity: true },
      { type: "rejected", reason: "refused" },
    ];

    let state = initTermoPlayState(DAILY.date);
    const seen = new Set<string>();
    const noticeWriters = new Set<string>();
    const announcementWriters = new Set<string>();
    for (const action of actions) {
      const before = state;
      state = termoPlayReducer(before, action);
      seen.add(action.type);
      const noticeMoved = state.notice !== before.notice;
      const announcementMoved = state.announcement !== before.announcement;
      expect(
        [noticeMoved, announcementMoved].filter(Boolean).length,
        `\`${action.type}\` wrote both live regions in one transition`,
      ).toBeLessThanOrEqual(1);
      if (noticeMoved) {
        noticeWriters.add(action.type);
      }
      if (announcementMoved) {
        announcementWriters.add(action.type);
      }
    }

    expect([...noticeWriters].toSorted()).toEqual([
      "held",
      "rejected",
      "retry",
      "submit",
    ]);
    expect([...announcementWriters].toSorted()).toEqual([
      "erase",
      "judged",
      "type",
    ]);

    expect([...seen].toSorted()).toEqual([
      "erase",
      "held",
      "judged",
      "pause",
      "rejected",
      "restore",
      "resume",
      "retry",
      "submit",
      "tick",
      "type",
    ]);
  });

  it("re-announces an identical rejection through the nonce, without touching the notice's own text", () => {
    expect(isValidGuess(INVALID, true)).toBe(false);
    const { container } = render(<TermoScreen daily={DAILY} />);

    typeOnBody(INVALID);
    fireEvent.keyDown(document.body, { key: "Enter" });
    const first = nonceText(container);
    expect(screen.getByText(copy.notInList)).toBeDefined();

    fireEvent.keyDown(document.body, { key: "Enter" });

    expect(nonceText(container)).not.toBe(first);

    expect(screen.getByText(copy.notInList)).toBeDefined();
  });
});

describe("the keyboard is the composite widget (T-WEB-S88)", () => {
  it("is one labelled group of 28 command keys, with no Ç and no aria-pressed", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);

    const keys = within(keyboardOf()).getAllByRole("button");
    expect(keys).toHaveLength(28);
    for (const key of keys) {
      expect(key.getAttribute("aria-pressed")).toBeNull();
    }

    expect(
      keys.map((key) => key.textContent).filter((label) => label === "ç"),
    ).toEqual([]);
    expect(keys.map((key) => key.textContent).join("")).toContain("z");
  });

  it("is ONE tab stop: exactly one key carries tabindex=0, seeded on Q", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);

    expect(tabbableKeys()).toHaveLength(1);
    expect(tabbableKeys()[0]).toBe(letterKey("q"));
  });

  it("emits the keys row-major WITH the commands, so reading order matches the drawing", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);

    const names = within(keyboardOf())
      .getAllByRole("button")
      .map((key) => key.getAttribute("aria-label"));
    expect(names[0]).toBe(copy.keyboard.letterAria("q"));
    expect(names[10]).toBe(copy.keyboard.eraseAria);
    expect(names[11]).toBe(copy.keyboard.letterAria("a"));
    expect(names[20]).toBe(copy.keyboard.enterAria);
    expect(names[21]).toBe(copy.keyboard.letterAria("z"));
    expect(names[27]).toBe(copy.keyboard.letterAria("m"));
  });

  it("moves the CARET with the arrows, clamping at every edge", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);
    focusKey(letterKey("q"));

    press("ArrowRight");
    expect(document.activeElement).toBe(letterKey("w"));
    press("ArrowLeft");
    expect(document.activeElement).toBe(letterKey("q"));
    press("ArrowLeft");
    expect(document.activeElement).toBe(letterKey("q"));
    press("ArrowDown");
    expect(document.activeElement).toBe(letterKey("a"));
    press("ArrowUp");
    expect(document.activeElement).toBe(letterKey("q"));
    press("ArrowUp");
    expect(document.activeElement).toBe(letterKey("q"));
    press("End");
    expect(document.activeElement).toBe(commandKey("erase"));
    press("ArrowRight");
    expect(document.activeElement).toBe(commandKey("erase"));
    press("Home");
    expect(document.activeElement).toBe(letterKey("q"));
  });

  it("stays inside the keyboard, and End on rows 1 and 2 is the command", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);

    focusKey(letterKey("q"));
    press("End");
    expect(document.activeElement).toBe(commandKey("erase"));
    press("ArrowDown");
    expect(document.activeElement).toBe(commandKey("enter"));
    press("ArrowDown");
    expect(document.activeElement).toBe(letterKey("m"));
    press("Home");
    expect(document.activeElement).toBe(letterKey("z"));
    press("ArrowUp");
    expect(document.activeElement).toBe(letterKey("s"));
  });

  it("moves up and down to the key drawn nearest, not to the same index", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);

    focusKey(letterKey("h"));
    press("ArrowDown");
    expect(document.activeElement).toBe(letterKey("b"));
    press("ArrowUp");
    expect(document.activeElement).toBe(letterKey("h"));
    press("ArrowUp");
    expect(document.activeElement).toBe(letterKey("y"));
    press("ArrowDown");
    expect(document.activeElement).toBe(letterKey("h"));
  });

  it("keeps the caret and the single tab stop across a judged re-render", () => {
    const { play } = playFixture();

    const { rerender } = render(<PlayView play={play} />);
    focusKey(letterKey("d"));
    const focused = document.activeElement;

    rerender(
      <PlayView
        play={playFixture({ guesses: [{ guess: VALID, tiles: TILES }] }).play}
      />,
    );

    expect(document.activeElement).toBe(focused);
    expect(tabbableKeys()).toHaveLength(1);
  });

  it("blurs a POINTER activation and keeps a keyboard one, so physical typing survives", () => {
    const fixture = playFixture();

    render(<PlayView play={fixture.play} />);

    const keyA = letterKey("a");
    focusKey(keyA);
    fireEvent.click(keyA, { detail: 1 });
    expect(document.activeElement).not.toBe(keyA);
    expect(fixture.type).toHaveBeenCalledWith("a");

    focusKey(keyA);
    fireEvent.click(keyA, { detail: 0 });
    expect(document.activeElement).toBe(keyA);
  });

  it("carries the judged state in the key's NAME, never in colour alone", () => {
    const { play } = playFixture({
      guesses: [{ guess: VALID, tiles: TILES }],
    });

    render(<PlayView play={play} />);

    expect(
      screen.getByRole("button", {
        name: copy.keyboard.letterStateAria(VALID.charAt(0), "correct"),
      }),
    ).toBeDefined();
  });
});

describe("the window keydown listener serves the UNFOCUSED page (T-WEB-S89)", () => {
  it("does not submit when Enter lands on `enviar` — the button's own click is the one submit", () => {
    const fixture = playFixture({ draft: slots(VALID) });

    render(<PlayView play={fixture.play} />);
    const enviar = commandKey("enter");
    fireEvent.keyDown(enviar, { key: "Enter" });
    fireEvent.click(enviar, { detail: 0 });

    expect(fixture.submit).toHaveBeenCalledTimes(1);
  });

  it("does not submit when Enter lands on a LETTER key", () => {
    const fixture = playFixture({ draft: slots(VALID) });

    render(<PlayView play={fixture.play} />);
    fireEvent.keyDown(letterKey("a"), { key: "Enter" });

    expect(fixture.submit).toHaveBeenCalledTimes(0);

    fireEvent.click(letterKey("a"), { detail: 0 });
    expect(fixture.type).toHaveBeenCalledTimes(1);
    expect(fixture.type).toHaveBeenCalledWith("a");
  });

  it("does not submit when Enter lands on the back link", () => {
    const fixture = playFixture({ draft: slots(VALID) });

    render(<PlayView play={fixture.play} />);
    fireEvent.keyDown(
      screen.getByRole("link", { name: messages.play.backAria }),
      { key: "Enter" },
    );

    expect(fixture.submit).toHaveBeenCalledTimes(0);
  });

  it("DOES submit when Enter lands on the body — the case it exists for", () => {
    const fixture = playFixture({ draft: slots(VALID) });

    render(<PlayView play={fixture.play} />);
    fireEvent.keyDown(document.body, { key: "Enter" });

    expect(fixture.submit).toHaveBeenCalledTimes(1);
  });

  it("stands down while the board is closed, and on every modifier", () => {
    const fixture = playFixture({ status: "lost", draft: slots(VALID) });

    render(<PlayView play={fixture.play} />);
    fireEvent.keyDown(document.body, { key: "Enter" });
    fireEvent.keyDown(document.body, { key: "a" });

    expect(fixture.submit).not.toHaveBeenCalled();
    expect(fixture.type).not.toHaveBeenCalled();

    const open = playFixture();
    render(<PlayView play={open.play} />);
    for (const modifier of ["metaKey", "ctrlKey", "altKey"]) {
      fireEvent.keyDown(document.body, { key: "a", [modifier]: true });
    }
    expect(open.type).not.toHaveBeenCalled();
  });

  it("normalizes the keystroke, so `á` types `a` and `ç` types `c` (AC 2)", () => {
    const fixture = playFixture();

    render(<PlayView play={fixture.play} />);
    fireEvent.keyDown(document.body, { key: "á" });
    fireEvent.keyDown(document.body, { key: "ç" });
    fireEvent.keyDown(document.body, { key: "Shift" });
    fireEvent.keyDown(document.body, { key: "1" });

    expect(fixture.type.mock.calls).toEqual([["a"], ["c"]]);
  });

  it("prevents Backspace's default, because it is a history-back gesture", () => {
    const fixture = playFixture({ draft: slots("ca"), cursor: 2 });

    render(<PlayView play={fixture.play} />);
    const event = createEvent.keyDown(document.body, { key: "Backspace" });
    fireEvent(document.body, event);

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.erase).toHaveBeenCalledTimes(1);
  });

  it("is torn down with the screen", () => {
    const fixture = playFixture({ draft: slots(VALID) });

    const { unmount } = render(<PlayView play={fixture.play} />);
    unmount();
    fireEvent.keyDown(document.body, { key: "Enter" });

    expect(fixture.submit).not.toHaveBeenCalled();
  });
});

describe("the six tile states and the four key states, as stylesheet text (T-WEB-S90)", () => {
  const css = stylesheet("src/termo/termo-board.module.css");

  it("gives every state a second carrier that is not colour", () => {
    expect(decl(bodyOf(css, ".tileTyped"), "border-color")).toBe(
      "var(--ink-2)",
    );

    expect(decl(bodyOf(css, ".tileHeld"), "border-color")).toBe("var(--ink-2)");
    expect(decl(bodyOf(css, ".tileHeld"), "border-style")).toBe("dashed");
    expect(decl(bodyOf(css, ".tileCaret"), "outline")).toBe(
      "2px solid var(--ink)",
    );
    expect(decl(bodyOf(css, ".tileCaret"), "outline-offset")).toBe("-2px");
    expect(decl(bodyOf(css, ".tileAbsent"), "text-decoration")).toBe(
      "line-through",
    );
    expect(decl(bodyOf(css, ".tilePresent"), "text-decoration")).toBe(
      "underline",
    );
    expect(decl(bodyOf(css, ".tileCorrect"), "background")).toBe(
      "var(--accent)",
    );
    expect(decl(bodyOf(css, ".tileCorrect"), "border-color")).toBe(
      "var(--ink)",
    );
  });

  it("draws both strikes in --ink, never in the glyph's own --ink-2", () => {
    for (const selector of [".tileAbsent", ".keyAbsent"]) {
      expect(decl(bodyOf(css, selector), "color")).toBe("var(--ink-2)");
      expect(decl(bodyOf(css, selector), "text-decoration-color")).toBe(
        "var(--ink)",
      );
    }
  });

  it("steps the absent KEY's border to --ink-2, its only 3:1 carrier besides the strike", () => {
    expect(decl(bodyOf(css, ".key"), "border-color")).toBeUndefined();
    expect(decl(bodyOf(css, ".key"), "border")).toBe("1.5px solid var(--line)");
    expect(decl(bodyOf(css, ".keyAbsent"), "border-color")).toBe(
      "var(--ink-2)",
    );
    expect(decl(bodyOf(css, ".keyAbsent"), "box-shadow")).toBe("none");
  });

  it("reads the accent's ink through --ink-on-accent with desk paper as the fallback", () => {
    for (const selector of [".tileCorrect", ".keyCorrect"]) {
      expect(decl(bodyOf(css, selector), "color")).toBe(
        "var(--ink-on-accent, var(--paper-desk))",
      );
    }
  });

  it("carries `:not(.keyAbsent)` on EVERY shadow rule, at both viewports", () => {
    expect(decl(bodyOf(css, ".key:active"), "box-shadow")).toBeUndefined();
    expect(decl(bodyOf(css, ".key:active"), "transform")).toBe(
      "translate(1px, 1px)",
    );
    expect(
      decl(bodyOf(css, ".key:not(.keyAbsent):active"), "box-shadow"),
    ).toContain("2px 2px 0");

    const chrome = mobileChrome(css);
    expect(decl(bodyOf(chrome, ".key"), "box-shadow")).toBeUndefined();
    expect(
      decl(bodyOf(chrome, ".key:not(.keyAbsent)"), "box-shadow"),
    ).toContain("2px 2px 0");
    expect(
      decl(bodyOf(chrome, ".key:not(.keyAbsent):active"), "box-shadow"),
    ).toContain("1px 1px 0");
  });

  it("keeps the underline off the border at both viewports", () => {
    expect(decl(bodyOf(css, ".tilePresent"), "text-underline-offset")).toBe(
      "4px",
    );
    expect(decl(bodyOf(css, ".tilePresent"), "text-decoration-thickness")).toBe(
      "3px",
    );
    const geometry = bodyOf(css, "@media (max-width: 768px)");
    expect(
      decl(bodyOf(geometry, ".tilePresent"), "text-decoration-thickness"),
    ).toBe("2px");
    expect(
      decl(bodyOf(geometry, ".tilePresent"), "text-underline-offset"),
    ).toBeUndefined();
    expect(decl(bodyOf(css, ".keyPresent"), "text-underline-offset")).toBe(
      "3px",
    );
    expect(decl(bodyOf(css, ".keyPresent"), "text-decoration-thickness")).toBe(
      "2px",
    );
  });

  it("puts `touch-action` on the KEYBOARD and nowhere near the read-only board", () => {
    expect(decl(bodyOf(css, ".keyboard"), "touch-action")).toBe("manipulation");
    expect(decl(bodyOf(css, ".grid"), "touch-action")).toBeUndefined();
    expect(decl(bodyOf(css, ".tile"), "touch-action")).toBeUndefined();
  });
});

describe("geometry, as stylesheet text (T-WEB-S91)", () => {
  const css = stylesheet("src/termo/termo-board.module.css");

  it("declares the board ceiling, aspect and floor on the page element, and no card cap", () => {
    const root = bodyOf(css, ".pageTermo");
    expect(pixels(decl(root, "--board-max"))).toBe(360);
    expect(Number(decl(root, "--board-aspect"))).toBeGreaterThan(0.8);
    expect(
      pixels(decl(root, "--board-min")) * Number(decl(root, "--board-aspect")),
    ).toBeGreaterThanOrEqual(boardFloor());
    expect(
      decl(
        bodyOf(stylesheet("src/play/screen.module.css"), ".gridCard"),
        "max-width",
      ),
    ).toBeUndefined();
  });

  it("is a fourth distinct rotation signature, read out of all four stylesheets", () => {
    const signature = (sheet: string, selector: string) =>
      ["--grid-card-rot", "--stats-card-rot", "--tape-rot"].map((property) =>
        decl(bodyOf(stylesheet(sheet), selector), property),
      );

    const termo = signature("src/termo/termo-board.module.css", ".pageTermo");
    expect(termo).toEqual(["0.7deg", "-0.9deg", "4deg"]);
    for (const [sheet, selector] of [
      ["src/binairo/binairo-screen.module.css", ".pageBinairo"],
      ["src/sudoku/sudoku-board.module.css", ".pageSudoku"],
      ["src/nonogram/nonogram-board.module.css", ".pageNonogram"],
    ] as const) {
      expect(signature(sheet, selector)).not.toEqual(termo);
    }
  });

  it("sizes the tile as a fluid square, with the gap 4px above 768px and 3px below", () => {
    const tile = bodyOf(css, ".tile");
    expect(decl(tile, "flex")).toBe("1 1 0");
    expect(decl(tile, "aspect-ratio")).toBe("1");
    expect(decl(tile, "width")).toBeUndefined();
    expect(decl(tile, "height")).toBeUndefined();
    expect(decl(tile, "font-size")).toMatch(/^clamp\(\s*14px,/);
    expect(pixels(decl(bodyOf(css, ".grid"), "gap"))).toBe(4);
    expect(pixels(decl(bodyOf(css, ".row"), "gap"))).toBe(4);

    const geometry = bodyOf(css, "@media (max-width: 768px)");
    expect(bodyOf(geometry, ".tilePresent")).toBeDefined();
    expect(pixels(decl(bodyOf(geometry, ".grid"), "gap"))).toBe(3);
    expect(pixels(decl(bodyOf(geometry, ".row"), "gap"))).toBe(3);
  });

  it("keeps the card's width over its height at or above --board-aspect, at every size", () => {
    const shared = stylesheet("src/play/screen.module.css");
    const aspect = Number(decl(bodyOf(css, ".pageTermo"), "--board-aspect"));
    const ceiling = pixels(decl(bodyOf(css, ".pageTermo"), "--board-max"));
    const border = pixels(
      (decl(bodyOf(shared, ".gridCard"), "border") ?? "").split(" ")[0],
    );
    const bands = [
      {
        padding: pixels(
          decl(
            bodyOf(bodyOf(shared, "@media (max-width: 768px)"), ".gridCard"),
            "padding",
          ),
        ),
        gap: pixels(
          decl(bodyOf(bodyOf(css, "@media (max-width: 768px)"), ".row"), "gap"),
        ),
      },
      {
        padding: token("--space-4"),
        gap: pixels(decl(bodyOf(css, ".row"), "gap")),
      },
    ];

    for (const { padding, gap } of bands) {
      for (let side = boardFloor(); side <= ceiling; side += 10) {
        const chrome = 2 * (padding + border);
        const tile = (side - chrome - (WORD_LENGTH - 1) * gap) / WORD_LENGTH;
        const height = MAX_GUESSES * tile + (MAX_GUESSES - 1) * gap + chrome;

        expect(side / height).toBeGreaterThanOrEqual(aspect);
      }
    }
  });

  it("keeps every tile clear of WCAG 2.5.8's 24px floor at the board floor", () => {
    const shared = stylesheet("src/play/screen.module.css");
    const padding = pixels(
      decl(
        bodyOf(bodyOf(shared, "@media (max-width: 768px)"), ".gridCard"),
        "padding",
      ),
    );
    const gap = pixels(
      decl(bodyOf(bodyOf(css, "@media (max-width: 768px)"), ".row"), "gap"),
    );
    const tile =
      (boardFloor() - 2 * (padding + 1) - (WORD_LENGTH - 1) * gap) /
      WORD_LENGTH;

    expect(tile).toBeGreaterThanOrEqual(24);
  });

  it("is one 22-column grid at both viewports, 608px desktop and capped at 350px below", () => {
    const keyboard = bodyOf(css, ".keyboard");
    expect(decl(keyboard, "grid-template-columns")).toBe(
      "repeat(22, minmax(0, 1fr))",
    );
    expect(decl(keyboard, "grid-template-rows")).toBe("repeat(3, 48px)");
    expect(pixels(decl(keyboard, "width"))).toBe(608);
    expect(decl(keyboard, "max-width")).toBe("100%");

    expect(decl(keyboard, "gap")).toBe("var(--space-2)");
    expect(decl(keyboard, "margin-top")).toBe(
      "var(--keyboard-gap, var(--space-5))",
    );

    const chrome = mobileChrome(css);
    const mobile = bodyOf(chrome, ".keyboard");
    expect(decl(mobile, "width")).toBe("100%");
    expect(pixels(decl(mobile, "max-width"))).toBe(350);
    expect(decl(mobile, "grid-template-rows")).toBeUndefined();
    expect(decl(mobile, "grid-template-columns")).toBeUndefined();
  });

  it("keeps the notice row reserved at its tallest state, so the retry button is a paint", () => {
    expect(pixels(decl(bodyOf(css, ".noticeRow"), "min-height"))).toBe(36);
    expect(decl(bodyOf(css, ".notice"), "padding")).toBe(
      "var(--space-1) var(--space-2)",
    );
  });

  it("keeps the affordance a SIBLING rule, with a margin a grid item could not honour", () => {
    expect(decl(bodyOf(css, ".affordance"), "margin-top")).toBe(
      "var(--space-3)",
    );
    expect(decl(bodyOf(mobileChrome(css), ".affordance"), "display")).toBe(
      "none",
    );
  });

  it("declares this module's own `.placeholder`, AFTER `.key` and `.tile`, and `.tileSkeleton` after `.tile`", () => {
    expect(decl(bodyOf(css, ".placeholder"), "pointer-events")).toBe("none");
    expect(css.indexOf(".placeholder")).toBeGreaterThan(css.indexOf(".key {"));
    expect(css.indexOf(".placeholder")).toBeGreaterThan(css.indexOf(".tile {"));
    expect(css.indexOf(".tileSkeleton")).toBeGreaterThan(
      css.indexOf(".tile {"),
    );
  });
});

describe("motion (T-WEB-S92)", () => {
  const css = stylesheet("src/termo/termo-board.module.css");

  it("ships NO @keyframes at all, which is stronger than avoiding the banned names", () => {
    expect(css).not.toContain("@keyframes");
    expect(css).not.toMatch(/bounce|elastic|wobble|jiggle|spring/i);
    expect(css).not.toContain("animation");
  });

  it("transitions paint properties only, never a layout one", () => {
    for (const selector of [".tile", ".key"]) {
      const transition = decl(bodyOf(css, selector), "transition") ?? "";
      expect(transition.length).toBeGreaterThan(0);
      expect(transition).not.toMatch(/\b(width|height|padding|margin)\b/);
    }
  });

  it("stands down the STAGGER as well as the transition, in this module", () => {
    const reduced = bodyOf(css, "@media (prefers-reduced-motion: reduce)");
    expect(decl(bodyOf(reduced, ".tile,\n  .key"), "transition")).toBe("none");
    for (let column = 1; column <= WORD_LENGTH; column += 1) {
      expect(reduced).toContain(`.tileJudged:nth-child(${String(column)})`);
    }
    expect(decl(reduced, "transition-delay")).toBe("0s");
  });

  it("staggers the reveal 60ms per column, on the judged class only", () => {
    expect(decl(bodyOf(css, ".grid"), "--reveal-stagger")).toBe("60ms");
    expect(
      decl(bodyOf(css, ".tileJudged:nth-child(1)"), "transition-delay"),
    ).toBe("0ms");
    for (let column = 2; column <= WORD_LENGTH; column += 1) {
      expect(
        decl(
          bodyOf(css, `.tileJudged:nth-child(${String(column)})`),
          "transition-delay",
        ),
      ).toBe(`calc(var(--reveal-stagger) * ${String(column - 1)})`);
    }
  });
});

describe("the <h1> guard, which is TWO mechanisms and not one (T-WEB-S93)", () => {
  it("makes the <h1> the FIRST element child of its wrapper in the play, skeleton and conclusion views", () => {
    for (const view of [
      <PlayView key="play" play={playFixture().play} />,
      <PlaySkeleton key="skeleton" date={DATE} />,
      <ConclusionView
        key="conclusion"
        game="termo"
        date={DATE}
        copy={messages.games.termo.conclusion}
        result={{ elapsedMs: 60_000, hintsUsed: 0 }}
      />,
    ]) {
      const { container, unmount } = render(view);
      const heading = container.querySelector("h1");
      expect(heading).not.toBeNull();
      expect(heading?.previousElementSibling).toBeNull();
      unmount();
    }
  });

  it("lets DailyUnavailable keep its decorative tape, because the sibling carries NO text", () => {
    const { container } = render(<DailyUnavailable copy={copy.unavailable} />);

    const sibling = container.querySelector("h1")?.previousElementSibling;
    expect(sibling).not.toBeNull();
    expect(sibling?.getAttribute("aria-hidden")).toBe("true");
    expect(sibling?.textContent?.trim()).toBe("");
  });
});

describe("apagar and enviar sit where a physical keyboard has them (T-WEB-S620)", () => {
  it("places apagar after P and enviar after L on the 22-column grid, as on a physical keyboard", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);

    const keys = within(keyboardOf()).getAllByRole("button");
    expect(keys[0]?.style.gridColumn).toBe("1 / span 2");
    expect(keys[9]?.style.gridColumn).toBe("19 / span 2");
    expect(keys[10]?.style.gridColumn).toBe("21 / span 2");

    expect(keys[11]?.style.gridColumn).toBe("2 / span 2");
    expect(keys[19]?.style.gridColumn).toBe("18 / span 2");
    expect(keys[20]?.style.gridColumn).toBe("20 / span 3");

    expect(keys[21]?.style.gridColumn).toBe("5 / span 2");
    expect(keys[27]?.style.gridColumn).toBe("17 / span 2");
  });

  it("draws the commands as glyphs, never as words, and keeps their names", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);

    for (const id of ["enter", "erase"] as const) {
      const key = commandKey(id);
      expect(key.textContent).toBe("");
      expect(key.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
        "true",
      );
    }
    expect(commandKey("enter").innerHTML).not.toBe(
      commandKey("erase").innerHTML,
    );
  });
});

describe("the keyboard skeleton equals the live keyboard (T-WEB-S621)", () => {
  it("draws every key box where and as the live keyboard does", () => {
    const live = render(
      <Keyboard
        state={{}}
        onLetter={vi.fn()}
        onEnter={vi.fn()}
        onErase={vi.fn()}
        activeKeyRef={{ current: null }}
      />,
    ).container;
    const skeleton = render(<KeyboardSkeleton />).container;

    const boxes = (root: HTMLElement) =>
      [...root.querySelectorAll<HTMLElement>(`.${styles.key ?? ""}`)].map(
        (key) => [key.style.gridColumn, key.innerHTML],
      );
    expect(boxes(skeleton)).toHaveLength(28);
    expect(boxes(skeleton)).toEqual(boxes(live));
  });
});

describe("the pre-hydration skeleton (T-WEB-S94)", () => {
  it("reserves 30 tiles, all 28 key boxes with their real labels, and the one-row stats card", () => {
    const { container } = render(<PlaySkeleton date={DATE} />);

    expect(container.querySelectorAll(`.${styles.tile ?? ""}`)).toHaveLength(
      MAX_GUESSES * WORD_LENGTH,
    );
    expect(container.querySelectorAll(`.${styles.key ?? ""}`)).toHaveLength(28);

    expect(
      container.querySelectorAll(`.${styles.keyboard ?? ""} svg`),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll(`.${sharedStyles.statRow ?? ""}`),
    ).toHaveLength(1);
  });

  it("reserves the notice row at its FULL height and the affordance line beside the keyboard", () => {
    const { container } = render(<PlaySkeleton date={DATE} />);

    const row = container.querySelector(`.${styles.noticeRow ?? ""}`);
    expect(row).not.toBeNull();
    const affordance = container.querySelector(`.${styles.affordance ?? ""}`);
    expect(affordance?.parentElement?.className).not.toContain(
      styles.keyboard ?? "",
    );
  });

  it("keeps the top bar at THREE children below 1024px, with a blank progress slot", () => {
    const { container } = render(<PlaySkeleton date={DATE} />);

    const slot = container.querySelector(`.${sharedStyles.progressBar ?? ""}`);
    expect(slot?.textContent).toBe(" ");
  });

  it("puts nothing focusable in it, and marks the route with data-play-state", () => {
    const { container } = render(<PlaySkeleton date={DATE} />);

    expect(within(container).queryAllByRole("button")).toEqual([]);
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
    expect(
      container
        .querySelector("[data-play-state]")
        ?.getAttribute("data-play-state"),
    ).toBe("skeleton");
  });

  it("is what /termo paints before the record is read", async () => {
    render(<TermoScreen daily={DAILY} />);

    await act(() => Promise.resolve());
    expect(
      document
        .querySelector("[data-play-state]")
        ?.getAttribute("data-play-state"),
    ).toBe("playing");
  });
});

describe("the first paint of /termo (T-WEB-S356)", () => {
  let readStorage: MockInstance | undefined;

  afterEach(() => {
    readStorage?.mockRestore();
    readStorage = undefined;
  });

  it("is the skeleton: nothing is read from the play-record store, and no live control paints", () => {
    const record = concludedRecord();
    writePlayRecord(record);
    expect(readPlayRecord("termo", DATE)).toEqual(record);
    readStorage = vi.spyOn(Storage.prototype, "getItem");

    const markup = renderToStaticMarkup(<TermoScreen daily={DAILY} />);

    expect(readStorage).not.toHaveBeenCalled();
    expect(markup).toContain('data-play-state="skeleton"');
    expect(markup).not.toContain("<button");
  });
});

describe("the stylesheet's SEVEN recorded deviations (T-WEB-S102)", () => {
  const css = stylesheet("src/termo/termo-board.module.css");
  const shadow =
    "var(--shadow-sm) color-mix(in srgb, var(--ink) 10%, transparent)";
  const ring = "2px solid var(--ink)";
  type Fact = readonly [selector: string, property: string, value: string];
  const deviations: readonly { n: number; facts: readonly Fact[] }[] = [
    { n: 1, facts: [[".pageTermo", "--board-max", "360px"]] },
    {
      n: 2,
      facts: [
        [".keyboard", "grid-template-columns", "repeat(22, minmax(0, 1fr))"],
        [".keyboard", "grid-template-rows", "repeat(3, 48px)"],
      ],
    },
    {
      n: 3,
      facts: [
        [".tilePresent", "text-decoration", "underline"],
        [".tileAbsent", "text-decoration", "line-through"],
        [".keyPresent", "text-decoration", "underline"],
        [".keyAbsent", "text-decoration", "line-through"],
      ],
    },
    { n: 4, facts: [[".key", "box-shadow", shadow]] },
    {
      n: 5,
      facts: [
        [".tile", "color", "var(--ink)"],
        [".tile", "font-weight", "600"],
      ],
    },
    {
      n: 6,
      facts: [
        [".key:focus-visible", "outline", ring],
        [".tileEditable:focus-visible", "outline", ring],
        [".noticeRetry:focus-visible", "outline", ring],
      ],
    },
    {
      n: 7,
      facts: [
        [".keyPresent", "text-underline-offset", "3px"],
        [".noticeRetry", "text-underline-offset", "3px"],
      ],
    },
  ];

  it("holds each one's identifying declaration in the stylesheet", () => {
    for (const { n, facts } of deviations) {
      for (const [selector, property, value] of facts) {
        expect(
          decl(bodyOf(css, selector), property),
          `deviation ${String(n)}: ${selector} ${property}`,
        ).toBe(value);
      }
    }
  });

  it("names every off-4pt length the STYLESHEET actually ships", () => {
    const declarations =
      /(?:^|[\s;{])(?:gap|row-gap|column-gap|margin(?:-[a-z]+)?|padding(?:-[a-z-]+)?|text-underline-offset)\s*:\s*([^;{}]+)/g;

    const offScale = new Set<string>();
    for (const [, value] of css.matchAll(declarations)) {
      for (const [, length] of (value ?? "").matchAll(/(-?\d+)px/g)) {
        const px = Number(length);
        if (px > 0 && px % 4 !== 0) {
          offScale.add(`${String(px)}px`);
        }
      }
    }

    expect(offScale.size).toBeGreaterThan(0);
    expect([...offScale].sort()).toEqual(["3px"]);

    const named = new Set(
      (deviations[6]?.facts ?? []).map(([, , value]) => value),
    );
    for (const length of offScale) {
      expect(named, `deviation 7 must name ${length}`).toContain(length);
    }
  });
});

describe("the retry button's placement and the focus order (T-WEB-S103)", () => {
  it("renders only on the held branch, as a SIBLING of the live region", () => {
    const idle = playFixture();
    const { container: without } = render(<PlayView play={idle.play} />);
    expect(
      within(without).queryByRole("button", { name: copy.retry }),
    ).toBeNull();

    const held = playFixture({
      pending: VALID,
      held: true,
      notice: copy.offline,
    });
    render(<PlayView play={held.play} />);

    const retry = screen.getByRole("button", { name: copy.retry });
    const region = screen.getByText(copy.offline);
    expect(region.getAttribute("role")).toBe("status");

    expect(region.contains(retry)).toBe(false);
    expect(retry.parentElement).toBe(region.parentElement);
  });

  it("hands the caret to the keyboard on a KEYBOARD activation, because it is about to unmount", () => {
    const held = playFixture({
      pending: VALID,
      held: true,
      notice: copy.offline,
    });

    render(<PlayView play={held.play} />);
    const retry = screen.getByRole("button", { name: copy.retry });

    fireEvent.click(retry, { detail: 0 });

    expect(held.retry).toHaveBeenCalledTimes(1);

    expect(document.activeElement).toBe(letterKey("q"));
  });

  it("leaves the page UNFOCUSED on a mouse click, or the physical keyboard dies", () => {
    const held = playFixture({
      pending: VALID,
      held: true,
      notice: copy.offline,
    });

    render(<PlayView play={held.play} />);
    const retry = screen.getByRole("button", { name: copy.retry });
    fireEvent.click(retry, { detail: 1 });

    expect(held.retry).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(letterKey("q"));
    expect(document.activeElement).toBe(document.body);
  });

  it("is FIVE stops at most, in document order: back → the rules (i) → retry → the keyboard → the (i) tip", () => {
    const held = playFixture({
      pending: VALID,
      held: true,
      notice: copy.offline,
    });

    const { container } = render(<PlayView play={held.play} />);

    const stops = [
      ...container.querySelectorAll<HTMLElement>(
        'a[href], button:not([tabindex="-1"])',
      ),
    ];
    expect(stops).toHaveLength(5);
    expect(stops[0]?.tagName).toBe("A");
    expect(stops[1]).toBe(
      screen.getByRole("button", { name: messages.play.rulesAria }),
    );
    expect(stops[2]).toBe(screen.getByRole("button", { name: copy.retry }));
    expect(stops[3]).toBe(letterKey("q"));
    expect(stops[4]).toBe(
      screen.getByRole("button", { name: messages.play.tipAria }),
    );
  });
});

describe("the 1 Hz tick paints nothing, because there is no clock (T-WEB-S104)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("composes ZERO row and key labels across ten timer ticks", () => {
    expect(Board).toHaveProperty("$$typeof", Symbol.for("react.memo"));
    expect(Keyboard).toHaveProperty("$$typeof", Symbol.for("react.memo"));

    render(<TermoScreen daily={DAILY} />);

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(vi.getTimerCount()).toBeGreaterThan(0);

    const rowEmptyAria = vi.spyOn(copy, "rowEmptyAria");
    const rowActiveAria = vi.spyOn(copy, "rowActiveAria");
    const letterAria = vi.spyOn(copy.keyboard, "letterAria");

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(rowEmptyAria).not.toHaveBeenCalled();
    expect(rowActiveAria).not.toHaveBeenCalled();
    expect(letterAria).not.toHaveBeenCalled();

    act(() => {
      fireEvent.keyDown(window, { key: "a" });
    });
    expect(rowActiveAria).toHaveBeenCalled();

    rowEmptyAria.mockRestore();
    rowActiveAria.mockRestore();
    letterAria.mockRestore();
  });
});

function tabbableKeys(): readonly HTMLElement[] {
  return [
    ...keyboardOf().querySelectorAll<HTMLElement>('button[tabindex="0"]'),
  ];
}

function commandKey(id: "enter" | "erase"): HTMLElement {
  return screen.getByRole("button", {
    name: id === "enter" ? copy.keyboard.enterAria : copy.keyboard.eraseAria,
  });
}

function focusKey(element: HTMLElement): void {
  act(() => {
    element.focus();
  });
}

function press(key: string): void {
  const active = document.activeElement;
  if (active === null) {
    throw new Error("nothing is focused");
  }
  fireEvent.keyDown(active, { key });
}

function announcerText(): string {
  const regions = screen.getAllByRole("status");
  return regions.at(-1)?.textContent ?? "";
}

function nonceText(container: HTMLElement): string {
  return container.querySelector(`.${styles.nonce ?? ""}`)?.textContent ?? "";
}

function mobileChrome(css: string): string {
  const geometry = bodyOf(css, "@media (max-width: 768px)");
  const rest = css.slice(css.indexOf(geometry) + geometry.length);
  return bodyOf(rest, "@media (max-width: 768px)");
}

describe("the active row is a roving-focus input row (T-WEB-S641)", () => {
  function cell(slot: number): HTMLElement {
    const found = within(boardOf()).getAllByRole("button")[slot];
    if (found === undefined) {
      throw new Error(`the active row has no cell ${String(slot)}`);
    }
    return found;
  }

  function caretCell(): Element | null {
    return boardOf().querySelector(`.${styles.tileCaret ?? ""}`);
  }

  it("moves the caret to a tapped cell and types there, leaving a gap", () => {
    render(<TermoScreen daily={DAILY} />);

    fireEvent.click(cell(2));
    expect(caretCell()).toBe(cell(2));
    expect(document.activeElement).toBe(cell(2));

    fireEvent.click(letterKey("f"));
    expect(cellLabels()).toEqual(
      ["", "", "f", "", ""].map((letter, slot) =>
        copy.cellAria(slot + 1, WORD_LENGTH, letter),
      ),
    );
    expect(caretCell()).toBe(cell(3));
  });

  it("types into the focused cell once, and focus follows the caret", () => {
    render(<TermoScreen daily={DAILY} />);

    fireEvent.click(cell(1));
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "a" });

    expect(cellLabels()[1]).toBe(copy.cellAria(2, WORD_LENGTH, "a"));
    expect(cellLabels().filter((label) => label?.endsWith(": a"))).toHaveLength(
      1,
    );
    expect(document.activeElement).toBe(cell(2));
  });

  it("moves with the arrows focused or not, and with Home and End inside the row", () => {
    render(<TermoScreen daily={DAILY} />);

    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(caretCell()).toBe(cell(2));
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(caretCell()).toBe(cell(1));
    const end = createEvent.keyDown(document.body, { key: "End" });
    fireEvent(document.body, end);
    expect(end.defaultPrevented).toBe(false);
    expect(caretCell()).toBe(cell(1));

    fireEvent.click(cell(1));
    const home = createEvent.keyDown(cell(1), { key: "Home" });
    fireEvent(cell(1), home);
    expect(home.defaultPrevented).toBe(true);
    expect(caretCell()).toBe(cell(0));
    expect(document.activeElement).toBe(cell(0));

    fireEvent.keyDown(cell(0), { key: "ArrowLeft" });
    expect(caretCell()).toBe(cell(0));
    fireEvent.keyDown(cell(0), { key: "ArrowRight" });
    expect(document.activeElement).toBe(cell(1));
  });

  it("submits once on Enter from a focused cell, and gives focus back to the next row", async () => {
    guessClient.postGuesses.mockResolvedValue(judged(0, TILES));
    render(<TermoScreen daily={DAILY} />);
    typeOnBody(VALID);

    fireEvent.click(cell(0));
    const enter = createEvent.keyDown(cell(0), { key: "Enter" });
    await act(() => {
      fireEvent(cell(0), enter);
      return Promise.resolve();
    });

    expect(enter.defaultPrevented).toBe(true);
    expect(guessClient.postGuesses).toHaveBeenCalledTimes(1);
    expect(rowLabels()[1]).toBe(copy.rowActiveAria(2, MAX_GUESSES));
    expect(document.activeElement).toBe(cell(0));
    expect(within(boardOf()).getAllByRole("button")).toHaveLength(WORD_LENGTH);
  });

  it("gives focus back to the same row when the server refuses the word", async () => {
    guessClient.postGuesses.mockResolvedValue({
      kind: "rejected",
      reason: "refused",
    });
    render(<TermoScreen daily={DAILY} />);
    typeOnBody(VALID);

    fireEvent.click(cell(4));
    await act(() => {
      fireEvent.keyDown(cell(4), { key: "Enter" });
      return Promise.resolve();
    });

    expect(rowLabels()[0]).toBe(copy.rowActiveAria(1, MAX_GUESSES));
    expect(document.activeElement).toBe(cell(WORD_LENGTH - 1));
  });

  it("does not take focus after a submit made from the on-screen keyboard", async () => {
    guessClient.postGuesses.mockResolvedValue(judged(0, TILES));
    render(<TermoScreen daily={DAILY} />);
    typeOnBody(VALID);

    const enviar = commandKey("enter");
    enviar.focus();
    await act(() => {
      fireEvent.click(enviar);
      return Promise.resolve();
    });

    expect(rowLabels()[1]).toBe(copy.rowActiveAria(2, MAX_GUESSES));
    expect(document.activeElement).toBe(enviar);
  });
});

describe("the Termo top bar carries the brand mark beside the wordmark (T-WEB-S752)", () => {
  it("draws the decorative mark inside the wordmark and keeps its text", () => {
    const { play } = playFixture();
    render(<PlayView play={play} />);

    const wordmark = screen.getByText(messages.brand.wordmark);
    expect(wordmark.textContent).toBe(messages.brand.wordmark);
    expect(wordmark.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
