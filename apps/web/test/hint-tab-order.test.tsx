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
