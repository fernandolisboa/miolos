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
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DailyUnavailable } from "../src/components/daily-unavailable";
import { messages } from "../src/i18n";
import { ConclusionView } from "../src/play/conclusion-view";
import sharedStyles from "../src/play/screen.module.css";
import { Board } from "../src/termo/board";
import { Keyboard } from "../src/termo/keyboard";
import { PlaySkeleton, PlayView } from "../src/termo/play-view";
import { initTermoPlayState, termoPlayReducer } from "../src/termo/state";
import styles from "../src/termo/termo-board.module.css";
import { TermoScreen } from "../src/termo/termo-screen";
import type { TermoPlayAction, TermoPlayState } from "../src/termo/types";
import type { TermoPlay } from "../src/termo/use-termo-play";
import { bodyOf, decl, pixels, stylesheet } from "./css-source";

// T-WEB-S86..S94, S102, S103 (plan 022 §19.6). UI composition is not
// TDD-shaped, so the rendering tests are smoke tests written against the
// screen; every assertion goes through `messages.*` or the stylesheet's own
// text rather than a literal. The four assertions that ARE behavioural — the
// window listener's guards, the announcer's draft, the reducer's live-region
// invariant and the roving caret — are driven at the seam, not through the
// happy path.

// The queue is proved by play-sync.test.ts with no screen mounted; here it is
// stubbed so the composition tests never touch the network.
const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock("../src/play/sync", () => sync);

// Every guess the integration tests make resolves here, so a verdict is a
// value this file writes rather than a network round trip.
const guessClient = vi.hoisted(() => ({ postGuesses: vi.fn() }));
vi.mock("../src/termo/guess-client", () => guessClient);

// The screen needs NO navigation — so the router is mocked purely to prove it
// is never asked to do anything.
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

/** Two real accepted guesses, taken from the engine's own validation list. */
const VALID = validationWord(0);
const SECOND = validationWord(1);

/** Five letters the list does not contain — the local "não está na lista". */
const INVALID = "zzzzz";

const TILES: TileStates = ["correct", "present", "absent", "absent", "absent"];

const here = path.dirname(fileURLToPath(import.meta.url));

function validationWord(index: number): string {
  const word = TERMO_VALIDATION_WORDS[index];
  if (word === undefined) {
    throw new Error(`the validation list has no word at ${String(index)}`);
  }
  return word;
}

/**
 * A `TermoPlay` whose handlers are spies, so "the window listener submitted
 * exactly once" is a call count rather than an inference from a POST. The
 * derived members are computed the way `useTermoPlay` computes them, so a
 * fixture cannot describe a state the hook could not produce.
 */
interface PlayFixture {
  readonly play: TermoPlay;
  readonly type: ReturnType<typeof vi.fn>;
  readonly erase: ReturnType<typeof vi.fn>;
  readonly submit: ReturnType<typeof vi.fn>;
  readonly retry: ReturnType<typeof vi.fn>;
}

function playFixture(overrides: Partial<TermoPlayState> = {}): PlayFixture {
  const state: TermoPlayState = {
    ...initTermoPlayState(DAILY),
    hydrated: true,
    ...overrides,
  };
  const live = state.status === "playing";
  const handlers = {
    type: vi.fn(),
    erase: vi.fn(),
    submit: vi.fn(),
    retry: vi.fn(),
    pause: vi.fn(),
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

function typeOnBody(word: string): void {
  for (const letter of word) {
    fireEvent.keyDown(document.body, { key: letter });
  }
}

/** A judged verdict for a board that has already spent `spent` rows. */
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

describe("the board is read-only output (T-WEB-S86)", () => {
  it("is a labelled group of six labelled row groups, with every tile hidden", () => {
    const { play } = playFixture();

    const { container } = render(<PlayView play={play} />);

    const board = boardOf();
    expect(within(board).getAllByRole("group")).toHaveLength(MAX_GUESSES);
    const tiles = container.querySelectorAll(`.${styles.tile ?? ""}`);
    expect(tiles).toHaveLength(MAX_GUESSES * WORD_LENGTH);
    for (const tile of tiles) {
      expect(tile.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("puts NOTHING focusable on the board — the keyboard is the whole input surface", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);

    const board = boardOf();
    expect(within(board).queryAllByRole("button")).toEqual([]);
    expect(board.querySelectorAll("[tabindex]")).toHaveLength(0);
    // Anti-vacuity: the keyboard beside it IS focusable, so an empty board is
    // a fact about the board rather than about the query.
    expect(within(keyboardOf()).getAllByRole("button").length).toBeGreaterThan(
      0,
    );
  });

  it("uses real row boxes, never `display: contents`", () => {
    // A role-bearing element with `display: contents` has a long, documented
    // history of being dropped from the accessibility tree (ADR-0030's
    // Rejected list), and every row here carries `role="group"`.
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
      // The guess client's promise settles in a microtask, so the verdict has
      // to be flushed inside the same `act` as the keystroke that armed it.
      return Promise.resolve();
    });

    const labels = rowLabels();
    expect(labels[0]).toBe(copy.rowAria(1, MAX_GUESSES, VALID, TILES));
    expect(labels[0]).toContain(VALID.charAt(0));
    expect(labels[0]).not.toBe(VALID.toUpperCase());
    expect(labels[1]).toBe(copy.rowActiveAria(2, MAX_GUESSES, ""));
    expect(labels[5]).toBe(copy.rowEmptyAria(6, MAX_GUESSES));
  });

  it("carries the DRAFT in the active row's name and in the announcer", () => {
    // The tiles are aria-hidden and a changed `aria-label` on a non-live
    // element is announced by no AT, so without BOTH of these a
    // screen-reader user gets nothing at all between the first keypress and
    // `enviar`.
    render(<TermoScreen daily={DAILY} />);

    typeOnBody("ca");

    expect(rowLabels()[0]).toBe(copy.rowActiveAria(1, MAX_GUESSES, "ca"));
    expect(announcerText()).toBe(copy.letterTypedAria("a", 2, WORD_LENGTH));
  });

  it("announces an erase too, with the letter that left", () => {
    render(<TermoScreen daily={DAILY} />);

    typeOnBody("ca");
    fireEvent.keyDown(document.body, { key: "Backspace" });

    expect(rowLabels()[0]).toBe(copy.rowActiveAria(1, MAX_GUESSES, "c"));
    expect(announcerText()).toBe(copy.letterErasedAria("a", 1, WORD_LENGTH));
  });

  it("never lets one transition write BOTH live regions — walked over every action", () => {
    // A REDUCER PROPERTY, not a render-time one, and a happy-path test proves
    // nothing here: the only transition where the natural placement collides
    // is a held turn that succeeds on RETRY, which writes the row sentence
    // into the announcer while clearing the connection line out of the
    // notice. Two polite regions mutating in one commit is exactly the race
    // two regions are supposed to avoid.
    // Every member of the action union appears, and the sequence REPLAYS
    // rather than resets, so `submit` arms from a full draft, `retry` finds a
    // held turn and `rejected` finds a pending one — the states those actions
    // no-op outside of.
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
      { type: "submit" },
      { type: "held", reason: "offline" },
      // THE COLLIDING PAIR: a held turn cleared by `retry`, then the verdict
      // that follows it. Under the placement that "reads natural" — clearing
      // the notice on `judged` — this last step writes the row sentence into
      // the announcer AND blanks the connection line in the same commit.
      { type: "retry" },
      {
        type: "judged",
        guess: VALID,
        tiles: TILES,
        status: "playing",
        answer: undefined,
      },
      ...letters(SECOND),
      { type: "submit" },
      { type: "rejected", reason: "not-in-list" },
      { type: "submit" },
      { type: "rejected", reason: "refused" },
    ];

    let state = initTermoPlayState(DAILY);
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

    // The invariant is DISJOINT WRITERS, so the sets are asserted as well as
    // the per-transition count: a placement that merely happens not to
    // collide on this walk is one refactor away from doing so, and the
    // withdrawn design — clearing on `judged` instead of on `submit`/`retry`
    // — is exactly that shape.
    // `submit` and `retry` CLEAR it; `held` and `rejected` set it. `judged`
    // appearing in this set is the withdrawn design, and `type`/`erase`
    // appearing in it is the other one.
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
    // Anti-vacuity: a walk that skipped an action would pass silently.
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
    // `role="status"` is implicitly aria-atomic and React leaves a text node
    // it rewrites identically alone, so the second identical rejection would
    // be silent on the one channel telling the player why the board is not
    // moving.
    expect(isValidGuess(INVALID)).toBe(false);
    const { container } = render(<TermoScreen daily={DAILY} />);

    typeOnBody(INVALID);
    fireEvent.keyDown(document.body, { key: "Enter" });
    const first = nonceText(container);
    expect(screen.getByText(copy.notInList)).toBeDefined();

    // The draft is untouched by a local rejection, so re-submitting the same
    // word is one keypress.
    fireEvent.keyDown(document.body, { key: "Enter" });

    expect(nonceText(container)).not.toBe(first);
    // The marker is a SIBLING span, never appended to the notice's own text
    // node, so an exact-text query still matches.
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
      // Keys are COMMANDS, not modes: a Termo key writes a letter and has no
      // mode to be in (ADR-0042 decision 3).
      expect(key.getAttribute("aria-pressed")).toBeNull();
    }
    // A Ç key would write the SAME letter as C — `normalizeWord` maps ç → c —
    // and could never carry its own state.
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
    // "26 letters, then the two commands" would put `enviar` visually first
    // and second-to-last in reading and tab order — a WCAG 1.3.2 / 2.4.3
    // mismatch.
    const { play } = playFixture();

    render(<PlayView play={play} />);

    const names = within(keyboardOf())
      .getAllByRole("button")
      .map((key) => key.getAttribute("aria-label"));
    expect(names[0]).toBe(copy.keyboard.letterAria("q"));
    expect(names[10]).toBe(copy.keyboard.letterAria("a"));
    expect(names[19]).toBe(copy.keyboard.enterAria);
    expect(names[27]).toBe(copy.keyboard.eraseAria);
  });

  it("places all 28 keys on the 20-column grid, letters spanning 2 and commands 3", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);

    const keys = within(keyboardOf()).getAllByRole("button");
    expect(keys[0]?.style.gridColumn).toBe("1 / span 2");
    expect(keys[9]?.style.gridColumn).toBe("19 / span 2");
    // Row 2 is inset one column each side — the QWERTY half-key stagger,
    // drawn by tracks rather than by spacers.
    expect(keys[10]?.style.gridColumn).toBe("2 / span 2");
    expect(keys[19]?.style.gridColumn).toBe("1 / span 3");
    expect(keys[27]?.style.gridColumn).toBe("18 / span 3");
  });

  it("moves the CARET with the arrows, clamping at every edge", () => {
    // Every assertion is pinned on `document.activeElement`, never on the
    // `tabIndex` attribute: an attribute-only assertion passes on an
    // implementation that moves `tabindex` and leaves the caret where it was,
    // which is the exact defect a roving tabindex exists to avoid.
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
    expect(document.activeElement).toBe(letterKey("p"));
    press("ArrowRight");
    expect(document.activeElement).toBe(letterKey("p"));
    press("Home");
    expect(document.activeElement).toBe(letterKey("q"));
  });

  it("clamps the column into the shorter row, and Home/End on row 3 are the commands", () => {
    const { play } = playFixture();

    render(<PlayView play={play} />);

    // Row 1's `p` sits at column index 9; row 2 has nine keys, so
    // `min(9, 8)` lands on `l`.
    focusKey(letterKey("p"));
    press("ArrowDown");
    expect(document.activeElement).toBe(letterKey("l"));
    // Row 2's `l` sits at index 8; row 3 has nine members and index 8 is
    // `apagar`.
    press("ArrowDown");
    expect(document.activeElement).toBe(commandKey("erase"));
    press("Home");
    expect(document.activeElement).toBe(commandKey("enter"));
    press("End");
    expect(document.activeElement).toBe(commandKey("erase"));
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

    // 28 keys re-render with new classes and new accessible names; `focused`
    // is the keyboard's OWN state and is not derived from the play state, and
    // the buttons are keyed off a module-level table, so React reconciles
    // them in place and no DOM node is remounted.
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
  // jsdom does not synthesise the activation `click` a browser produces from
  // `Enter` on a focused control, so each case below fires BOTH events
  // exactly as a browser would and asserts the TOTAL. Without guard 3 the
  // window listener adds a second handler for one keypress.

  it("does not submit when Enter lands on `enviar` — the button's own click is the one submit", () => {
    const fixture = playFixture({ draft: VALID });

    render(<PlayView play={fixture.play} />);
    const enviar = commandKey("enter");
    fireEvent.keyDown(enviar, { key: "Enter" });
    fireEvent.click(enviar, { detail: 0 });

    expect(fixture.submit).toHaveBeenCalledTimes(1);
  });

  it("does not submit when Enter lands on a LETTER key", () => {
    // Otherwise the listener submits the draft AND the synthesised click
    // types that letter into the row the submit just consumed.
    const fixture = playFixture({ draft: VALID });

    render(<PlayView play={fixture.play} />);
    fireEvent.keyDown(letterKey("a"), { key: "Enter" });

    expect(fixture.submit).toHaveBeenCalledTimes(0);
    // And the key's own activation still writes its letter.
    fireEvent.click(letterKey("a"), { detail: 0 });
    expect(fixture.type).toHaveBeenCalledTimes(1);
    expect(fixture.type).toHaveBeenCalledWith("a");
  });

  it("does not submit when Enter lands on the back link", () => {
    // A guess spent while the page navigates away from the board that would
    // have shown the verdict.
    const fixture = playFixture({ draft: VALID });

    render(<PlayView play={fixture.play} />);
    fireEvent.keyDown(
      screen.getByRole("link", { name: messages.play.backAria }),
      { key: "Enter" },
    );

    expect(fixture.submit).toHaveBeenCalledTimes(0);
  });

  it("DOES submit when Enter lands on the body — the case it exists for", () => {
    const fixture = playFixture({ draft: VALID });

    render(<PlayView play={fixture.play} />);
    fireEvent.keyDown(document.body, { key: "Enter" });

    expect(fixture.submit).toHaveBeenCalledTimes(1);
  });

  it("stands down while the board is closed, and on every modifier", () => {
    const fixture = playFixture({ status: "lost", draft: VALID });

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
    const fixture = playFixture({ draft: "ca" });

    render(<PlayView play={fixture.play} />);
    const event = createEvent.keyDown(document.body, { key: "Backspace" });
    fireEvent(document.body, event);

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.erase).toHaveBeenCalledTimes(1);
  });

  it("is torn down with the screen", () => {
    const fixture = playFixture({ draft: VALID });

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
    // The SIXTH state (ADR-0039 consequence (g)), and the one a "five states"
    // reading drops. Its carrier is a SHAPE difference from `typed`.
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
    // Same-colour mark and glyph is 1.0000:1 — on every letterform with a
    // horizontal midstroke the strike merges into the letter and `A` reads as
    // `Ⱥ`. --ink is 13.9929:1 against the tint it is drawn on.
    for (const selector of [".tileAbsent", ".keyAbsent"]) {
      expect(decl(bodyOf(css, selector), "color")).toBe("var(--ink-2)");
      expect(decl(bodyOf(css, selector), "text-decoration-color")).toBe(
        "var(--ink)",
      );
    }
  });

  it("steps the absent KEY's border to --ink-2, its only 3:1 carrier besides the strike", () => {
    // untouched --line (L 0.63605722) against absent --ink-2 (L 0.13539008) is
    // (0.63605722 + 0.05) / (0.13539008 + 0.05) = 3.7006:1. The fill
    // (1.1196:1), the glyph (2.9557:1) and the shadow all miss 1.4.11's floor.
    expect(decl(bodyOf(css, ".key"), "border-color")).toBeUndefined();
    expect(decl(bodyOf(css, ".key"), "border")).toBe("1.5px solid var(--line)");
    expect(decl(bodyOf(css, ".keyAbsent"), "border-color")).toBe(
      "var(--ink-2)",
    );
    expect(decl(bodyOf(css, ".keyAbsent"), "box-shadow")).toBe("none");
  });

  it("reads the accent's ink through --ink-on-accent with desk paper as the fallback", () => {
    // Since #161 (ADR-0067) the accent is the deep #8D6212 and desk paper ON
    // it is 4.8433:1, so this surface carries the same light-label treatment
    // as the other three games and the fallback matches the resolved value.
    // The old `var(--ink)` fallback was for the old light mustard, on which
    // desk was 2.7311:1; --ink on the DEEP value is 3.0996:1 and illegal
    // (ADR-0041 consequence (c) as amended by ADR-0067).
    for (const selector of [".tileCorrect", ".keyCorrect"]) {
      expect(decl(bodyOf(css, selector), "color")).toBe(
        "var(--ink-on-accent, var(--paper-desk))",
      );
    }
  });

  it("carries `:not(.keyAbsent)` on EVERY shadow rule, at both viewports", () => {
    // The cascade defect jsdom cannot compute. `.key:active` is (0,2,0) and
    // `.keyAbsent` is (0,1,0), so a bare `.key:active { box-shadow }`
    // outranks `.keyAbsent { box-shadow: none }`; and a bare
    // `.key { box-shadow }` inside the mobile block is (0,1,0) and sits LATER
    // in the file, so it wins at equal specificity and silently restores the
    // shadow on every spent key at the PRIMARY viewport.
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
    // At offset 6 / thickness 3 the mark landed 3.1px above a 1.5px ink
    // border of the SAME colour at ≤768px and the pair read as one doubled
    // edge. The THICKNESS steps with the glyph; the OFFSET does not.
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
    // `manipulation` costs double-tap-to-zoom, and the board is the one
    // element of this screen a low-vision player wants to enlarge.
    expect(decl(bodyOf(css, ".keyboard"), "touch-action")).toBe("manipulation");
    expect(decl(bodyOf(css, ".grid"), "touch-action")).toBeUndefined();
    expect(decl(bodyOf(css, ".tile"), "touch-action")).toBeUndefined();
  });
});

describe("geometry, as stylesheet text (T-WEB-S91)", () => {
  const css = stylesheet("src/termo/termo-board.module.css");

  it("declares --board-mobile-max UNCONDITIONALLY, or the ≤768px cap dies in silence", () => {
    // `screen.module.css`'s `.gridCard` reads it with NO fallback, so omitting
    // it makes `max-width` invalid at computed-value time and it falls back to
    // `none`.
    const root = bodyOf(css, ".pageTermo");
    expect(pixels(decl(root, "--board-mobile-max"))).toBe(254);
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

  it("is 52/4 above 768px and 44/3 below — the desktop pair is DESIGN.md:50 verbatim", () => {
    const tile = bodyOf(css, ".tile");
    expect(pixels(decl(tile, "width"))).toBe(52);
    expect(pixels(decl(tile, "height"))).toBe(52);
    expect(pixels(decl(tile, "font-size"))).toBe(28);
    expect(pixels(decl(bodyOf(css, ".grid"), "gap"))).toBe(4);
    expect(pixels(decl(bodyOf(css, ".row"), "gap"))).toBe(4);

    const geometry = bodyOf(css, "@media (max-width: 768px)");
    expect(pixels(decl(bodyOf(geometry, ".tile"), "width"))).toBe(44);
    expect(pixels(decl(bodyOf(geometry, ".tile"), "height"))).toBe(44);
    expect(pixels(decl(bodyOf(geometry, ".tile"), "font-size"))).toBe(24);
    expect(pixels(decl(bodyOf(geometry, ".grid"), "gap"))).toBe(3);
    expect(pixels(decl(bodyOf(geometry, ".row"), "gap"))).toBe(3);
  });

  it("agrees with the card cap: 5 tiles + 4 gaps + padding + border = 254 at ≤768px", () => {
    const geometry = bodyOf(css, "@media (max-width: 768px)");
    const tile = pixels(decl(bodyOf(geometry, ".tile"), "width"));
    const gap = pixels(decl(bodyOf(geometry, ".row"), "gap"));
    const shared = stylesheet("src/play/screen.module.css");
    const cardMobile = bodyOf(
      bodyOf(shared, "@media (max-width: 768px)"),
      ".gridCard",
    );
    const padding = pixels(decl(cardMobile, "padding"));
    const border = pixels(
      (decl(bodyOf(shared, ".gridCard"), "border") ?? "").split(" ")[0],
    );

    expect(
      WORD_LENGTH * tile + (WORD_LENGTH - 1) * gap + 2 * padding + 2 * border,
    ).toBe(pixels(decl(bodyOf(css, ".pageTermo"), "--board-mobile-max")));
  });

  it("is one 20-column grid at both viewports, 552px desktop and capped at 350px below", () => {
    const keyboard = bodyOf(css, ".keyboard");
    expect(decl(keyboard, "grid-template-columns")).toBe(
      "repeat(20, minmax(0, 1fr))",
    );
    expect(decl(keyboard, "grid-template-rows")).toBe("repeat(3, 52px)");
    expect(pixels(decl(keyboard, "width"))).toBe(552);
    // THE TOKEN, not the 8px literal it resolves to (finding B-13): the
    // mobile `.keyboard` below already reaches for `var(--space-1)`, and two
    // idioms for one kind of length in one sheet is how a token stops being
    // the source of truth.
    expect(decl(keyboard, "gap")).toBe("var(--space-2)");
    expect(pixels(decl(keyboard, "margin-top"))).toBe(30);

    const chrome = mobileChrome(css);
    const mobile = bodyOf(chrome, ".keyboard");
    expect(decl(mobile, "width")).toBe("100%");
    expect(pixels(decl(mobile, "max-width"))).toBe(350);
    expect(decl(mobile, "grid-template-rows")).toBe("repeat(3, 48px)");
    expect(decl(mobile, "grid-template-columns")).toBeUndefined();
  });

  it("holds the command label at `undersized-ui-text`'s 11px floor exactly", () => {
    // 11px is the floor and cannot go lower — `checks.mjs:3439` needs
    // `fontSize < 11 && dtLen >= 2`, and `enviar`/`apagar` are six characters
    // inside a <button>. So the 320px fit is bought with PADDING instead:
    // 38.6 − 4 − 3 = 31.6px of content box against 38.6 − 16 − 3 = 19.6px.
    expect(decl(bodyOf(css, ".keyCommand"), "font")).toBe("var(--text-button)");
    const command = bodyOf(mobileChrome(css), ".keyCommand");
    expect(pixels(decl(command, "font-size"))).toBe(11);
    expect(pixels(decl(command, "padding-inline"))).toBe(2);
  });

  it("keeps the notice row reserved at its tallest state, so the retry button is a paint", () => {
    // 14px × 1.5 line-height = 21px + 2 × 4px padding = 29px, cleared with
    // 7px to spare; the 13px notice line is 19.5px.
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

  it("declares this module's own `.placeholder`, AFTER `.key` and `.tile`", () => {
    // A class hashed in `screen.module.css` cannot reach one hashed here.
    expect(decl(bodyOf(css, ".placeholder"), "pointer-events")).toBe("none");
    expect(css.indexOf(".placeholder")).toBeGreaterThan(css.indexOf(".key {"));
    expect(css.indexOf(".placeholder")).toBeGreaterThan(css.indexOf(".tile {"));
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
    // A delay on a paint that no longer animates is 390ms of a
    // reduced-motion user staring at a stale row.
    const reduced = bodyOf(css, "@media (prefers-reduced-motion: reduce)");
    expect(decl(bodyOf(reduced, ".tile,\n  .key"), "transition")).toBe("none");
    for (let column = 1; column <= WORD_LENGTH; column += 1) {
      expect(reduced).toContain(`.tileJudged:nth-child(${String(column)})`);
    }
    expect(decl(reduced, "transition-delay")).toBe("0s");
  });

  it("staggers the reveal 60ms per column, on the judged class only", () => {
    for (let column = 1; column <= WORD_LENGTH; column += 1) {
      expect(
        decl(
          bodyOf(css, `.tileJudged:nth-child(${String(column)})`),
          "transition-delay",
        ),
      ).toBe(`${String((column - 1) * 60)}ms`);
    }
  });
});

describe("the <h1> guard, which is TWO mechanisms and not one (T-WEB-S93)", () => {
  // impeccable's `hero-eyebrow-chip` (checks.mjs:423) and
  // `kicker-above-heading` (:2500) both anchor on `h1.previousElementSibling`.
  // Three of the four views make it null; `DailyUnavailable` does NOT, and it
  // passes one guard later, on the sibling's TEXT. A single uniform assertion
  // across all four would red a shipped component that is green in the real
  // scan.
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

describe("the pre-hydration skeleton (T-WEB-S94)", () => {
  it("reserves 30 tiles, all 28 key boxes with their real labels, and the one-row stats card", () => {
    const { container } = render(<PlaySkeleton date={DATE} />);

    expect(container.querySelectorAll(`.${styles.tile ?? ""}`)).toHaveLength(
      MAX_GUESSES * WORD_LENGTH,
    );
    expect(container.querySelectorAll(`.${styles.key ?? ""}`)).toHaveLength(28);
    // A key cap is a constant — it owes the record nothing and can paint
    // complete (`keypad.tsx:69-71`).
    expect(container.textContent).toContain(copy.keyboard.enter);
    expect(container.textContent).toContain(copy.keyboard.erase);
    expect(
      container.querySelectorAll(`.${sharedStyles.statRow ?? ""}`),
    ).toHaveLength(1);
  });

  it("reserves the notice row at its FULL height and the affordance line beside the keyboard", () => {
    // The row is 36px in every play state INCLUDING the held one, so the
    // retry button appearing is a paint and never a reflow; and `.affordance`
    // is a sibling, so an auto-placed span never lands in an implicit fourth
    // grid row.
    const { container } = render(<PlaySkeleton date={DATE} />);

    const row = container.querySelector(`.${styles.noticeRow ?? ""}`);
    expect(row).not.toBeNull();
    const affordance = container.querySelector(`.${styles.affordance ?? ""}`);
    expect(affordance?.parentElement?.className).not.toContain(
      styles.keyboard ?? "",
    );
  });

  it("keeps the top bar at THREE children below 1140px, with a blank progress slot", () => {
    // `justify-content: space-between` with two items throws PALAVRAS hard
    // right, where three shipped screens centre it — so the slot has to exist
    // before hydration too.
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

    // The hydrated screen replaces it in the same act(), so the assertion is
    // that the play view — not a conclusion and not an unavailable screen —
    // is what the record produced.
    await act(() => Promise.resolve());
    expect(
      document
        .querySelector("[data-play-state]")
        ?.getAttribute("data-play-state"),
    ).toBe("playing");
  });
});

describe("the stylesheet's SEVEN recorded deviations (T-WEB-S102)", () => {
  // §12.1 requires all seven to be written into the file's own header,
  // numbered, the way `nonogram-board.module.css:1-60` writes its six. A
  // later contributor deleting one for tidiness reds this rather than passing
  // quietly. Read RAW, because `stylesheet()` strips comments.
  const header = readFileSync(
    path.join(here, "..", "src/termo/termo-board.module.css"),
    "utf8",
  ).split("RECORDED DESIGN-SYSTEM DEVIATIONS")[1];

  it("declares exactly seven numbered items", () => {
    expect(header).toBeDefined();
    const items = [...(header ?? "").matchAll(/^ {5}(\d)\. /gm)];
    expect(items.map((item) => item[1])).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
    ]);
  });

  it("carries the arithmetic that identifies each one", () => {
    const items = (header ?? "").split(/^ {5}\d\. /gm).slice(1);
    expect(items).toHaveLength(7);
    const tokens = [
      "44px",
      "24 × 24",
      "text-decoration",
      "10 %",
      "600",
      "15.0124",
      "30px",
    ];
    for (const [index, tokenText] of tokens.entries()) {
      expect(items[index], `deviation ${String(index + 1)}`).toContain(
        tokenText,
      );
    }
  });

  it("names every off-4pt length the STYLESHEET actually ships, not only the two the prose used to", () => {
    // Finding B-13, and it is the half this describe structurally could not
    // reach: everything above regexes the header comment, so the assertion was
    // about the PROSE and never about the declarations. Deviation 7 said "two
    // off-4pt lengths" while `.grid` and `.row` shipped `gap: 3px` at ≤768px —
    // a third, and unlike a decoration offset it is literally spacing between
    // boxes, the case the deviation governs.
    //
    // The property list is spacing plus `text-underline-offset`, which is a
    // DISTANCE; `text-decoration-thickness` is deliberately out, because a
    // stroke weight is not spacing on any scale. Negative lengths are out too:
    // the only one is `.announcer`'s `margin: -1px`, the visually-hidden clip
    // idiom, which is not a gap between anything.
    const sheet = stylesheet("src/termo/termo-board.module.css");
    const declarations =
      /(?:^|[\s;{])(?:gap|row-gap|column-gap|margin(?:-[a-z]+)?|padding(?:-[a-z-]+)?|text-underline-offset)\s*:\s*([^;{}]+)/g;

    const offScale = new Set<string>();
    for (const [, value] of sheet.matchAll(declarations)) {
      for (const [, length] of (value ?? "").matchAll(/(-?\d+)px/g)) {
        const px = Number(length);
        if (px > 0 && px % 4 !== 0) {
          offScale.add(`${String(px)}px`);
        }
      }
    }

    // Anti-vacuity: the scan found declarations at all.
    expect(offScale.size).toBeGreaterThan(0);
    expect([...offScale].sort()).toEqual(["2px", "30px", "3px"]);

    const deviation = (header ?? "").split(/^ {5}\d\. /gm)[7] ?? "";
    for (const length of offScale) {
      expect(deviation, `deviation 7 must name ${length}`).toContain(length);
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
    // A focusable element inside a mutating live region would be re-read on
    // every write; the region's atomic re-read has to be the sentence alone.
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
    // `detail: 0` is Enter/Space on the button — the same test `keyboard.tsx`
    // uses one component over.
    fireEvent.click(retry, { detail: 0 });

    expect(held.retry).toHaveBeenCalledTimes(1);
    // A focused element that unmounts drops the caret to <body> mid-game —
    // a 2.4.3 failure.
    expect(document.activeElement).toBe(letterKey("q"));
  });

  it("leaves the page UNFOCUSED on a mouse click, or the physical keyboard dies", () => {
    // Finding B-3, and it is the mirror image of the rule above. The window
    // `keydown` listener serves the UNFOCUSED page and bails on any
    // `INTERACTIVE_TARGET` — which every one of the 28 keys is — and the
    // keyboard's own `onKeyDown` handles arrows and Home/End only. So focusing
    // a key after a MOUSE click means every physical letter keypress lands on
    // that <button> and types nothing, until the player clicks the page
    // background with no indication why.
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

  it("is THREE stops at most, in document order: back → retry → the keyboard", () => {
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
    expect(stops).toHaveLength(3);
    expect(stops[0]?.tagName).toBe("A");
    expect(stops[1]).toBe(screen.getByRole("button", { name: copy.retry }));
    expect(stops[2]).toBe(letterKey("q"));
  });
});

describe("the 1 Hz tick paints nothing, because there is no clock (T-WEB-S104)", () => {
  // Finding B-4, and the #25 precedent is `nonogram/board.tsx`'s own memo
  // (findings PERF-R4-1/R4-2). `usePlayLifecycle` runs
  // `setInterval(() => dispatch({type:"tick", now: Date.now()}), 1000)` for
  // the whole live game, and ADR-0045 decision 4 removed the only thing that
  // tick exists to repaint — `/termo` renders no timer at all. Without `memo`
  // on `Board` and `Keyboard` every tick re-rendered all 58 elements for ZERO
  // DOM writes: a player who thinks for five minutes burns 300 ticks,
  // ~10 200 aria compositions and ~17 400 reconciliations.
  //
  // The composers are the honest probe, exactly as they are for Nonogram: a
  // DOM assertion cannot see this, because React writes no attribute when the
  // value is unchanged and the markup is identical either way.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("composes ZERO row and key labels across ten timer ticks", () => {
    // Anti-vacuity, half ZERO — the nonogram precedent's structural pin
    // (`nonogram-screen.test.tsx`, "is memoized, so an unrelated tick cannot
    // reconcile 225 cells"), and the two lines that close the gaps the other
    // two halves leave (finding E-8). `vi.getTimerCount() > 0` below cannot
    // tell the lifecycle's 1 Hz tick from `subscribeToPlayRecords`'s 1 Hz poll
    // (`use-record-snapshot.ts`), which also runs on this screen and produces
    // zero re-renders — so without this the test would stay green while
    // measuring nothing if `usePlayLifecycle` ever stopped arming here. And
    // half two below drives only the BOARD spy: a keystroke does not re-render
    // `Keyboard` (its `state` is `useMemo([state.guesses])`), so `letterAria`
    // is never shown to be reachable. If either of these reds because the
    // component was unwrapped, the fix is to re-wrap it, not to delete the
    // assertion.
    expect(Board).toHaveProperty("$$typeof", Symbol.for("react.memo"));
    expect(Keyboard).toHaveProperty("$$typeof", Symbol.for("react.memo"));

    render(<TermoScreen daily={DAILY} />);
    // Let the mount effect's restore, the derived resume and their persists
    // settle, so what the spies see afterwards is only what the ticks cause.
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // Anti-vacuity, half one: the interval really is armed.
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    const rowEmptyAria = vi.spyOn(copy, "rowEmptyAria");
    const rowActiveAria = vi.spyOn(copy, "rowActiveAria");
    const letterAria = vi.spyOn(copy.keyboard, "letterAria");

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // The numbers that must never come back are 5 × 10, 1 × 10 and 26 × 10.
    expect(rowEmptyAria).not.toHaveBeenCalled();
    expect(rowActiveAria).not.toHaveBeenCalled();
    expect(letterAria).not.toHaveBeenCalled();

    // Anti-vacuity, half two: the spies ARE wired, and a keystroke — which
    // moves `draft` and therefore the active row — still repaints the board.
    act(() => {
      fireEvent.keyDown(window, { key: "a" });
    });
    expect(rowActiveAria).toHaveBeenCalled();

    rowEmptyAria.mockRestore();
    rowActiveAria.mockRestore();
    letterAria.mockRestore();
  });
});

/** The one key carrying the roving `tabindex="0"`. */
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

/**
 * Move the caret the way a browser does, inside `act` so the `onFocus` that
 * records it is committed before the next event — otherwise the assertions
 * below would race React rather than the implementation.
 */
function focusKey(element: HTMLElement): void {
  act(() => {
    element.focus();
  });
}

/** A key press on whatever currently holds the caret. */
function press(key: string): void {
  const active = document.activeElement;
  if (active === null) {
    throw new Error("nothing is focused");
  }
  fireEvent.keyDown(active, { key });
}

/** The visually-hidden announcer — the LAST `role="status"` on the screen. */
function announcerText(): string {
  const regions = screen.getAllByRole("status");
  return regions.at(-1)?.textContent ?? "";
}

function nonceText(container: HTMLElement): string {
  return container.querySelector(`.${styles.nonce ?? ""}`)?.textContent ?? "";
}

/** The SECOND `@media (max-width: 768px)` block — `bodyOf` is first-match. */
function mobileChrome(css: string): string {
  const geometry = bodyOf(css, "@media (max-width: 768px)");
  const rest = css.slice(css.indexOf(geometry) + geometry.length);
  return bodyOf(rest, "@media (max-width: 768px)");
}
