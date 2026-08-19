import {
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
  type DailyBinairoResponse,
  type DailyNonogramResponse,
  type DailySudokuResponse,
  type DailyTermoResponse,
} from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BinairoScreen } from "../src/binairo/binairo-screen";
import { BinairoFreeScreen } from "../src/free-play/binairo-free-screen";
import { NonogramFreeScreen } from "../src/free-play/nonogram-free-screen";
import { SudokuFreeScreen } from "../src/free-play/sudoku-free-screen";
import { NonogramScreen } from "../src/nonogram/nonogram-screen";
import sharedStyles from "../src/play/screen.module.css";
import { SudokuScreen } from "../src/sudoku/sudoku-screen";
import { TermoScreen } from "../src/termo/termo-screen";

/**
 * WCAG 2.4.3 on the shared play layout (#67) — the hint button's tab position.
 *
 * `apps/web/src/play/screen.module.css` places every child of `.page` into a
 * NAMED GRID AREA, which decouples paint order from DOM order completely. The
 * hint's `<button>` shipped BEFORE `<section class="board">` in the DOM while
 * the ≤1140px grid painted it `"bar" "title" "board" "hint"` — last on the
 * screen. So a keyboard user on a phone went back link → hint (at the bottom
 * of the viewport) → board → brush controls (above the hint they had just
 * left). The hint is the lowest element on the page in BOTH bands: at >1140px
 * it is pinned to the bottom of the sidebar by the `free` spacer row, below
 * where the board starts. Last on screen, so last in the tab sequence.
 *
 * WHY THE ORDER IS READ OFF THE DOM RATHER THAN DRIVEN WITH `userEvent.tab()`.
 * `@testing-library/user-event` is not a dependency of this app and a Tier 1
 * fix does not add one. It would also be a simulation either way: jsdom
 * implements no sequential focus navigation, so `tab()` computes the order
 * from the DOM exactly as `tabSequence` below does. What this file adds on top
 * of a plain source read is that every stop is FOCUSED for real and confirmed
 * to have taken focus, and that the one assumption the DOM-order rule rests on
 * — no positive `tabindex` anywhere on the page — is asserted rather than
 * assumed.
 *
 * The suite is driven by WHICH SCREENS ACTUALLY RENDER A HINT rather than by a
 * fixed list of routes (#67's own comment asks for this): `/termo` ships no
 * hint at all under ADR-0045 decision 1, and a fifth game arriving with or
 * without one needs no edit here beyond its row.
 */

// The completion queue is proved elsewhere with no screen mounted; here it is
// stubbed so mounting four daily screens never touches the network.
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
  usePathname: () => "/binairo",
}));

const DATE = "2026-08-18";
const SEED = 20_260_818;
const WEEKDAY = 2;

const BINAIRO = generateBinairo({ seed: SEED, weekday: WEEKDAY });
const BINAIRO_DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...BINAIRO.givens],
};

const SUDOKU = generateDailySudoku({ seed: SEED, weekday: WEEKDAY });
const SUDOKU_DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU.givens,
  tier: SUDOKU.tier,
});

const NONOGRAM = generateNonogram(SEED, WEEKDAY);
const NONOGRAM_DAILY: DailyNonogramResponse = dailyNonogramResponseSchema.parse(
  {
    game: "nonogram",
    date: DATE,
    size: NONOGRAM.size,
    clues: NONOGRAM.clues,
  },
);

const TERMO_DAILY: DailyTermoResponse = dailyTermoResponseSchema.parse({
  game: "termo",
  date: DATE,
});

const FREE_DEPS = { pickSeed: () => SEED };

/**
 * EVERY screen that composes `play/screen.module.css`'s `.page` grid. Seven of
 * them, which is the number the fix has to hold for — the issue was filed
 * against three, #27 added `/termo` as a fourth, and the three `/modo-livre`
 * screens have consumed the same sheet since #28.
 */
const SCREENS = [
  { route: "/binairo", mount: () => <BinairoScreen daily={BINAIRO_DAILY} /> },
  { route: "/sudoku", mount: () => <SudokuScreen daily={SUDOKU_DAILY} /> },
  {
    route: "/nonogram",
    mount: () => <NonogramScreen daily={NONOGRAM_DAILY} />,
  },
  { route: "/termo", mount: () => <TermoScreen daily={TERMO_DAILY} /> },
  {
    route: "/modo-livre/binairo",
    mount: () => <BinairoFreeScreen deps={FREE_DEPS} />,
  },
  {
    route: "/modo-livre/sudoku",
    mount: () => <SudokuFreeScreen deps={FREE_DEPS} />,
  },
  {
    route: "/modo-livre/nonogram",
    mount: () => <NonogramFreeScreen deps={FREE_DEPS} />,
  },
] as const;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the hint button is the last tab stop, not the second (T-WEB-S232)", () => {
  it.each(SCREENS)(
    "$route puts its hint after its board in the tab sequence",
    ({ route, mount }) => {
      const { container } = render(mount());
      const page = container.querySelector<HTMLElement>(
        `.${sharedStyles.page ?? "page"}`,
      );
      expect(page, `${route} does not render the shared .page grid`).not.toBe(
        null,
      );
      if (page === null) {
        return;
      }

      const hint = page.querySelector<HTMLElement>(
        `button.${sharedStyles.hint ?? "hint"}`,
      );
      if (hint === null) {
        // The control, and the reason this suite is driven by the render and
        // not by a route list: `/termo` ships no hint (ADR-0045 decision 1),
        // so it has no order to get wrong. Asserting its ABSENCE here is what
        // keeps that a decision rather than a gap.
        expect(route).toBe("/termo");
        return;
      }

      const sequence = tabSequence(page);
      expect(
        sequence.indexOf(hint),
        `${route}: the hint is stop ${sequence.indexOf(hint) + 1} of ${sequence.length}, but it paints last in both bands`,
      ).toBe(sequence.length - 1);
    },
  );

  /**
   * The anti-vacuity half. Every assertion above is satisfied by a screen that
   * renders no hint, so without this a refactor that stopped rendering the
   * button — or a class rename that made the query miss — would pass the whole
   * suite green.
   */
  it("holds for six hint-bearing screens, with /termo the only screen exempt", () => {
    const withHint: string[] = [];
    const withoutHint: string[] = [];
    for (const { route, mount } of SCREENS) {
      const { container, unmount } = render(mount());
      const found = container.querySelector(
        `button.${sharedStyles.hint ?? "hint"}`,
      );
      (found === null ? withoutHint : withHint).push(route);
      unmount();
    }

    expect(withHint).toEqual([
      "/binairo",
      "/sudoku",
      "/nonogram",
      "/modo-livre/binairo",
      "/modo-livre/sudoku",
      "/modo-livre/nonogram",
    ]);
    expect(withoutHint).toEqual(["/termo"]);
  });

  /**
   * The structural half, independent of what jsdom will consent to focus: the
   * hint's NODE follows the whole `<section class="board">` — cells, brush or
   * keypad controls and the hint explainer included — rather than merely
   * following the last thing that happened to take focus. This is the property
   * the shared grid's named areas hid, and it is what a fifth game inherits.
   */
  it.each(SCREENS.filter(({ route }) => route !== "/termo"))(
    "$route puts the hint's node after the whole board section",
    ({ route, mount }) => {
      const { container } = render(mount());
      const board = container.querySelector<HTMLElement>(
        `.${sharedStyles.board ?? "board"}`,
      );
      const hint = container.querySelector<HTMLElement>(
        `button.${sharedStyles.hint ?? "hint"}`,
      );
      expect(board, `${route} renders no .board section`).not.toBe(null);
      expect(hint, `${route} renders no hint button`).not.toBe(null);
      if (board === null || hint === null) {
        return;
      }

      // The board is not empty, so "after the board" is a real claim about a
      // populated subtree rather than about an empty element.
      expect(
        board.querySelectorAll("[data-cell-index]").length,
        `${route} renders no board cells`,
      ).toBeGreaterThan(0);

      expect(
        Boolean(
          board.compareDocumentPosition(hint) &
          Node.DOCUMENT_POSITION_FOLLOWING,
        ),
        `${route}: the hint's node precedes the board it belongs under`,
      ).toBe(true);
    },
  );
});

/**
 * The elements a browser would visit, in order, for a page with no positive
 * `tabindex` — which is asserted here rather than assumed, because a single
 * positive value would reorder the sequence and make DOM order the wrong
 * model. Each candidate is focused for real and kept only if it took focus,
 * so an element jsdom refuses to focus cannot inflate the count.
 */
function tabSequence(page: HTMLElement): readonly HTMLElement[] {
  const candidates = [
    ...page.querySelectorAll<HTMLElement>(
      "a[href], button, input, select, textarea, [tabindex]",
    ),
  ];

  const positive = candidates.filter(
    (element) => Number(element.getAttribute("tabindex") ?? "0") > 0,
  );
  expect(
    positive.map((element) => element.outerHTML.slice(0, 80)),
    "a positive tabindex would make DOM order the wrong model for this page",
  ).toEqual([]);

  const reachable: HTMLElement[] = [];
  for (const element of candidates) {
    if (Number(element.getAttribute("tabindex") ?? "0") < 0) {
      continue;
    }
    if (element.hasAttribute("disabled")) {
      continue;
    }
    element.focus();
    if (document.activeElement === element) {
      reachable.push(element);
    }
  }
  return reachable;
}
