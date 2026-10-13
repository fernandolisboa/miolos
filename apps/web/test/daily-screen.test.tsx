import type { DayGameState } from "@miolos/core";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages } from "../src/i18n";
import { DailyScreen } from "../src/play/daily-screen";
import type { PlayCore } from "../src/play/types";

const lazy = vi.hoisted(() => ({
  preloadConclusionView: vi.fn(),
}));

vi.mock("../src/play/conclusion-lazy", () => ({
  ConclusionView: (props: Record<string, unknown>) => (
    <div data-testid="conclusion" data-props={JSON.stringify(props)} />
  ),
  RemoteConclusionView: (props: Record<string, unknown>) => (
    <div data-testid="remote" data-props={JSON.stringify(props)} />
  ),
  preloadConclusionView: lazy.preloadConclusionView,
}));

const DATE = "2026-07-30";

const OPEN: PlayCore = {
  date: DATE,
  timer: { accumulatedMs: 5_000, runningSince: 8_000 },
  status: "playing",
  pendingSync: false,
  now: 9_000,
  hydrated: true,
};

const SOLVED: PlayCore = {
  ...OPEN,
  timer: { accumulatedMs: 6_000, runningSince: null },
  status: "solved",
};

const LOST: PlayCore = { ...SOLVED, status: "lost" };

const RESULT = { elapsedMs: 6_000, hintsUsed: 1 };

const CLAIM: DayGameState = { status: "completed", elapsedMs: 1, hintsUsed: 0 };

const SKELETON = <div data-testid="skeleton" />;
const VIEW = <div data-testid="view" />;

function dailyScreen(
  overrides: {
    readonly state?: PlayCore;
    readonly claim?: DayGameState;
    readonly unavailable?: boolean;
  } = {},
  conclusion?: { render: () => ReactNode; preload: () => void },
) {
  const common = {
    game: "sudoku",
    claim: overrides.claim,
    state: overrides.state ?? OPEN,
    unavailable: overrides.unavailable,
    skeleton: SKELETON,
    view: VIEW,
  } as const;
  return conclusion === undefined ? (
    <DailyScreen {...common} result={RESULT} />
  ) : (
    <DailyScreen {...common} conclusion={conclusion} />
  );
}

function propsOf(testId: string): unknown {
  return JSON.parse(
    screen.getByTestId(testId).getAttribute("data-props") ?? "null",
  );
}

beforeEach(() => {
  lazy.preloadConclusionView.mockClear();
});

describe("the daily ladder, rung by rung (T-WEB-S483)", () => {
  it("says the daily is unavailable before anything else", () => {
    render(
      dailyScreen({
        unavailable: true,
        state: { ...OPEN, hydrated: false },
        claim: CLAIM,
      }),
    );

    expect(
      screen.getByText(messages.games.sudoku.play.unavailable.title),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("skeleton")).toBeNull();
  });

  it("paints the skeleton until the record is read", () => {
    render(dailyScreen({ state: { ...OPEN, hydrated: false } }));

    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
    expect(screen.queryByTestId("view")).toBeNull();
  });

  it("concludes a closed, frozen board with the local result", () => {
    render(dailyScreen({ state: SOLVED }));

    expect(propsOf("conclusion")).toEqual({
      game: "sudoku",
      date: DATE,
      copy: messages.games.sudoku.conclusion,
      result: RESULT,
    });
  });

  it("concludes a lost board too", () => {
    render(dailyScreen({ state: LOST }));

    expect(screen.getByTestId("conclusion")).toBeInTheDocument();
  });

  it("keeps the local conclusion over a server claim once the board is closed", () => {
    render(dailyScreen({ state: SOLVED, claim: CLAIM }));

    expect(screen.getByTestId("conclusion")).toBeInTheDocument();
    expect(screen.queryByTestId("remote")).toBeNull();
  });

  it("does not conclude a board whose clock is still running", () => {
    render(dailyScreen({ state: { ...SOLVED, timer: OPEN.timer } }));

    expect(screen.getByTestId("view")).toBeInTheDocument();
  });

  it("shows the server's claim for a day finished elsewhere", () => {
    render(dailyScreen({ claim: CLAIM }));

    expect(propsOf("remote")).toEqual({
      game: "sudoku",
      date: DATE,
      copy: messages.games.sudoku.conclusion,
      claim: CLAIM,
    });
    expect(screen.queryByTestId("view")).toBeNull();
  });

  it("plays the board otherwise", () => {
    render(dailyScreen());

    expect(screen.getByTestId("view")).toBeInTheDocument();
  });

  it("hands a closed board to the game's own conclusion when it has one", () => {
    const own = {
      render: vi.fn(() => <div data-testid="own" />),
      preload: vi.fn(),
    };
    render(dailyScreen({ state: SOLVED }, own));

    expect(screen.getByTestId("own")).toBeInTheDocument();
    expect(screen.queryByTestId("conclusion")).toBeNull();
    expect(own.render).toHaveBeenCalledTimes(1);
  });

  it("does not build the game's own conclusion while the board is open", () => {
    const own = { render: vi.fn(() => <div />), preload: vi.fn() };
    render(dailyScreen({}, own));

    expect(own.render).not.toHaveBeenCalled();
  });
});

describe("the conclusion chunk is warmed on mount (T-WEB-S483)", () => {
  it("warms the shared conclusion by default", () => {
    render(dailyScreen());

    expect(lazy.preloadConclusionView).toHaveBeenCalledTimes(1);
  });

  it("warms the game's own conclusion instead when it has one", () => {
    const own = { render: () => <div />, preload: vi.fn() };
    render(dailyScreen({}, own));

    expect(own.preload).toHaveBeenCalledTimes(1);
    expect(lazy.preloadConclusionView).not.toHaveBeenCalled();
  });

  it("warms it even when the daily is unavailable", () => {
    render(dailyScreen({ unavailable: true }));

    expect(lazy.preloadConclusionView).toHaveBeenCalledTimes(1);
  });
});
