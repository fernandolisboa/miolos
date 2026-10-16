import type { DayGameState, Game } from "@miolos/core";
import { render } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArchiveBinairoScreen } from "../src/archive/binairo-screen";
import { ArchiveCrosswordScreen } from "../src/archive/crossword-screen";
import { ArchiveNonogramScreen } from "../src/archive/nonogram-screen";
import { ArchiveQueensScreen } from "../src/archive/queens-screen";
import { ArchiveSudokuScreen } from "../src/archive/sudoku-screen";
import { ArchiveTermoScreen } from "../src/archive/termo-screen";
import { BinairoScreen } from "../src/binairo/binairo-screen";
import { CrosswordScreen } from "../src/crossword/crossword-screen";
import { NonogramScreen } from "../src/nonogram/nonogram-screen";
import { QueensScreen } from "../src/queens/queens-screen";
import { SudokuScreen } from "../src/sudoku/sudoku-screen";
import { TermoScreen } from "../src/termo/termo-screen";

const DATE = "2026-07-30";
const CLAIM: DayGameState = { status: "completed", elapsedMs: 1, hintsUsed: 0 };
const ELAPSED = 42_000;

const spies = vi.hoisted(() => ({
  claim: vi.fn(),
  daily: vi.fn(),
  archive: vi.fn(),
  ownConclusion: vi.fn(),
  hooks: {
    binairo: vi.fn(),
    sudoku: vi.fn(),
    nonogram: vi.fn(),
    crossword: vi.fn(),
    queens: vi.fn(),
    termo: vi.fn(),
  },
}));

vi.mock("../src/play/day-state", async (original) => ({
  ...(await original<object>()),
  useServerDayClaim: spies.claim,
}));
vi.mock("../src/play/conclusion-lazy", async (original) => ({
  ...(await original<object>()),
  resilientConclusion: () => ({
    Conclusion: (props: object) => {
      spies.ownConclusion(props);
      return null;
    },
    preload: () => undefined,
  }),
}));
vi.mock("../src/play/daily-screen", () => ({
  DailyScreen: (props: object) => {
    spies.daily(props);
    return null;
  },
}));
vi.mock("../src/archive/archive-screen", () => ({
  ArchiveScreen: (props: object) => {
    spies.archive(props);
    return null;
  },
}));
vi.mock("../src/binairo/use-binairo-play", () => ({
  useBinairoPlay: spies.hooks.binairo,
}));
vi.mock("../src/sudoku/use-sudoku-play", () => ({
  useSudokuPlay: spies.hooks.sudoku,
}));
vi.mock("../src/nonogram/use-nonogram-play", () => ({
  useNonogramPlay: spies.hooks.nonogram,
}));
vi.mock("../src/crossword/use-crossword-play", () => ({
  useCrosswordPlay: spies.hooks.crossword,
}));
vi.mock("../src/queens/use-queens-play", () => ({
  useQueensPlay: spies.hooks.queens,
}));
vi.mock("../src/termo/use-termo-play", () => ({
  useTermoPlay: spies.hooks.termo,
}));

type HookGame = keyof typeof spies.hooks;

interface Root {
  readonly game: HookGame;
  readonly daily: ComponentType<{ daily: never }>;
  readonly archive: ComponentType<{ daily: never }>;
  readonly ownConclusion: boolean;
}

const ROOTS: readonly Root[] = [
  {
    game: "binairo",
    daily: BinairoScreen,
    archive: ArchiveBinairoScreen,
    ownConclusion: false,
  },
  {
    game: "sudoku",
    daily: SudokuScreen,
    archive: ArchiveSudokuScreen,
    ownConclusion: false,
  },
  {
    game: "crossword",
    daily: CrosswordScreen,
    archive: ArchiveCrosswordScreen,
    ownConclusion: false,
  },
  {
    game: "queens",
    daily: QueensScreen,
    archive: ArchiveQueensScreen,
    ownConclusion: false,
  },
  {
    game: "nonogram",
    daily: NonogramScreen,
    archive: ArchiveNonogramScreen,
    ownConclusion: true,
  },
  {
    game: "termo",
    daily: TermoScreen,
    archive: ArchiveTermoScreen,
    ownConclusion: true,
  },
];

const PLAY = {
  state: {
    date: DATE,
    hint: { used: 1 },
    solution: [],
    hydrated: true,
    timer: { accumulatedMs: ELAPSED, runningSince: null },
    now: 0,
    size: 5,
    entries: [],
    guesses: [],
  },
  elapsed: ELAPSED,
  unavailable: false,
};

const UNAVAILABLE_PLAY = {
  ...PLAY,
  state: { ...PLAY.state, solution: null },
  unavailable: true,
};

const OWN_CONCLUSION_ROOTS = ROOTS.filter((root) => root.ownConclusion);

function dailyOf(game: Game): never {
  return { game, date: DATE } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  spies.claim.mockReturnValue(CLAIM);
  for (const hook of Object.values(spies.hooks)) hook.mockReturnValue(PLAY);
});

describe("every screen root wires its game into the shared shell (T-WEB-S487)", () => {
  it.each(ROOTS)(
    "$game: the daily root passes its claim, state and result",
    (root) => {
      const daily = dailyOf(root.game);
      const Screen = root.daily;
      render(<Screen daily={daily} />);

      expect(spies.claim).toHaveBeenCalledWith(DATE, root.game);
      expect(spies.hooks[root.game]).toHaveBeenCalledWith(daily, true);
      expect(spies.daily).toHaveBeenCalledWith(
        expect.objectContaining({
          game: root.game,
          claim: CLAIM,
          state: PLAY.state,
        }),
      );
      const props = spies.daily.mock.calls[0]?.[0] as {
        result?: unknown;
        conclusion?: unknown;
      };
      if (root.ownConclusion) {
        expect(props.result).toBeUndefined();
        const own = props.conclusion as { render: () => ReactNode };
        render(<>{own.render()}</>);
        expect(spies.ownConclusion).toHaveBeenCalledWith(
          expect.objectContaining({
            date: DATE,
            result: {
              elapsedMs: ELAPSED,
              hintsUsed: root.game === "termo" ? 0 : 1,
            },
          }),
        );
      } else {
        expect(props.result).toEqual({ elapsedMs: ELAPSED, hintsUsed: 1 });
      }
    },
  );

  it.each(ROOTS)(
    "$game: the archive root passes its game and state, unclaimed",
    (root) => {
      const daily = dailyOf(root.game);
      const Screen = root.archive;
      render(<Screen daily={daily} />);

      expect(spies.claim).not.toHaveBeenCalled();
      expect(spies.hooks[root.game]).toHaveBeenCalledWith(daily);
      expect(spies.archive).toHaveBeenCalledWith(
        expect.objectContaining({ game: root.game, state: PLAY.state }),
      );
    },
  );

  it.each(OWN_CONCLUSION_ROOTS)(
    "$game: both roots pass the hook's unavailable verdict to the shell",
    (root) => {
      spies.hooks[root.game].mockReturnValue(UNAVAILABLE_PLAY);
      const daily = dailyOf(root.game);
      const Daily = root.daily;
      const Archive = root.archive;
      render(<Daily daily={daily} />);
      render(<Archive daily={daily} />);

      expect(spies.daily).toHaveBeenCalledWith(
        expect.objectContaining({ unavailable: true }),
      );
      expect(spies.archive).toHaveBeenCalledWith(
        expect.objectContaining({ unavailable: true }),
      );
    },
  );
});
