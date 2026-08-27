import {
  dailyBinairoResponseSchema,
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
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatElapsed, messages } from "../src/i18n";
import { playRecordKey, type SudokuPlayRecord } from "../src/play/play-record";
import { solutionDigits } from "../src/sudoku/engine";
import type { SudokuDigit } from "../src/sudoku/state";

const chunk = { loads: 0 };

const DATE = "2026-07-31";
const API_URL = "https://api.example.test";
const ELAPSED_MS = 512_000;

const SUDOKU_PUZZLE = generateDailySudoku({ seed: 20_260_731, weekday: 1 });
const SUDOKU_DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU_PUZZLE.givens,
  tier: SUDOKU_PUZZLE.tier,
});

const BINAIRO_PUZZLE = generateBinairo({ seed: 20_260_730, weekday: 3 });
const BINAIRO_DAILY: DailyBinairoResponse = dailyBinairoResponseSchema.parse({
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...BINAIRO_PUZZLE.givens],
});

const NONOGRAM_PUZZLE = generateNonogram(20_260_801, 1);
const NONOGRAM_DAILY: DailyNonogramResponse = dailyNonogramResponseSchema.parse(
  {
    game: "nonogram",
    date: DATE,
    size: NONOGRAM_PUZZLE.size,
    clues: NONOGRAM_PUZZLE.clues,
  },
);

const TERMO_DAILY: DailyTermoResponse = dailyTermoResponseSchema.parse({
  game: "termo",
  date: DATE,
});

function solutionOf(): readonly SudokuDigit[] {
  const digits = solutionDigits(SUDOKU_PUZZLE.givens);
  if (digits === null) {
    throw new Error("a published daily is uniquely solvable by construction");
  }
  return digits;
}

const SOLUTION = solutionOf();

function concludedSudoku(): SudokuPlayRecord {
  const entries = SUDOKU_PUZZLE.givens.map((given, index) =>
    given === 0 ? (SOLUTION[index] ?? null) : null,
  );
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries,
    grid: [...SOLUTION],
    elapsedMs: ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

function stubApi(day?: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      if (day !== undefined && urlOf(input) === `${API_URL}/day`) {
        return Promise.resolve(day());
      }
      return Promise.resolve(jsonResponse(401, { error: "no-session" }));
    }),
  );
}

async function loadLazyModule() {
  return await import("../src/play/conclusion-lazy");
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DATE}T12:00:00Z`));
  window.localStorage.clear();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
  chunk.loads = 0;
  vi.doMock("../src/play/conclusion-view", async () => {
    chunk.loads += 1;
    return await vi.importActual("../src/play/conclusion-view");
  });
});

afterEach(() => {
  vi.doUnmock("../src/play/conclusion-view");
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the lazy conclusion's failure story — skeleton, one retry, degraded static fallback (T-WEB-S288)", () => {
  it("paints the conclusion-shaped skeleton, never a blank frame, while a COLD chunk resolves", async () => {
    window.localStorage.setItem(
      playRecordKey("sudoku", DATE),
      JSON.stringify(concludedSudoku()),
    );
    stubApi();
    const { SudokuScreen } = await import("../src/sudoku/sudoku-screen");

    const { container } = render(<SudokuScreen daily={SUDOKU_DAILY} />);

    const pending = container.querySelector(
      '[data-conclusion-state="skeleton"]',
    );
    expect(pending).not.toBeNull();

    expect(pending?.childElementCount).toBeGreaterThan(0);
    expect(container.querySelector("[data-cell-index]")).toBeNull();

    await act(async () => {
      await import("../src/play/conclusion-view");
    });
    expect(container.querySelector("[data-conclusion-state]")).toHaveAttribute(
      "data-conclusion-state",
      "result",
    );
  });

  it("recovers through ONE retry: a successful second import renders the real module directly", async () => {
    const { ConclusionChunkBoundary } = await loadLazyModule();
    function Thrower(): never {
      throw new Error("chunk load failed (test)");
    }
    const retry = vi.fn(() => Promise.resolve("recovered-module"));

    render(
      <ConclusionChunkBoundary
        retry={retry}
        recovered={(value) => <p>recovered: {value}</p>}
        fallback={<p>fallback</p>}
      >
        <Thrower />
      </ConclusionChunkBoundary>,
    );

    expect(
      await screen.findByText("recovered: recovered-module"),
    ).toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("fallback")).toBeNull();
  });

  it("holds the skeleton frame while the retry is in flight — still never a blank", async () => {
    const { ConclusionChunkBoundary } = await loadLazyModule();
    function Thrower(): never {
      throw new Error("chunk load failed (test)");
    }

    const { container } = render(
      <ConclusionChunkBoundary
        retry={() => new Promise(() => undefined)}
        recovered={() => <p>recovered</p>}
        fallback={<p>fallback</p>}
      >
        <Thrower />
      </ConclusionChunkBoundary>,
    );

    const pending = container.querySelector(
      '[data-conclusion-state="skeleton"]',
    );
    expect(pending).not.toBeNull();
    expect(pending?.childElementCount).toBeGreaterThan(0);
  });

  it("settles on the fallback when the retry also fails, and never loops", async () => {
    const { ConclusionChunkBoundary } = await loadLazyModule();
    function Thrower(): never {
      throw new Error("chunk load failed (test)");
    }
    const retry = vi.fn(() =>
      Promise.reject(new Error("still unreachable (test)")),
    );

    render(
      <ConclusionChunkBoundary
        retry={retry}
        recovered={() => <p>recovered</p>}
        fallback={<p>fallback</p>}
      >
        <Thrower />
      </ConclusionChunkBoundary>,
    );

    expect(await screen.findByText("fallback")).toBeInTheDocument();

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("treats a throw from the RECOVERED render as terminal — the retry is spent, the fallback stands", async () => {
    const { ConclusionChunkBoundary } = await loadLazyModule();
    function Thrower(): never {
      throw new Error("chunk load failed (test)");
    }
    const retry = vi.fn(() => Promise.resolve("recovered-module"));

    render(
      <ConclusionChunkBoundary
        retry={retry}
        recovered={() => <Thrower />}
        fallback={<p>fallback</p>}
      >
        <Thrower />
      </ConclusionChunkBoundary>,
    );

    expect(await screen.findByText("fallback")).toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("renders the LOCAL win's degraded fallback — stamp word and frozen time from memory — when the chunk never loads", async () => {
    //

    const lazy = await loadLazyModule();
    const loads: number[] = [];
    const Broken = lazy.resilientConclusion(() => {
      loads.push(loads.length);
      return Promise.reject(new Error("chunk fetch failed (test)"));
    }, lazy.localConclusionFallback);

    const { container } = render(
      <Broken
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
        result={{ elapsedMs: ELAPSED_MS, hintsUsed: 0 }}
      />,
    );

    const degraded = await screen.findByText(messages.conclusion.stampLabel);
    expect(degraded).toBeInTheDocument();
    expect(screen.getByText(formatElapsed(ELAPSED_MS))).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        messages.conclusion.stampAria(
          messages.games.sudoku.conclusion.title,
          formatElapsed(ELAPSED_MS),
          0,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.games.sudoku.conclusion.title),
    ).toBeInTheDocument();

    expect(screen.getByText(messages.conclusion.back)).toBeInTheDocument();
    const frame = container.querySelector("[data-conclusion-state]");
    expect(frame).toHaveAttribute("data-conclusion-state", "degraded");
    expect(container.querySelector("[data-cell-index]")).toBeNull();

    expect(loads.length).toBe(2);
  });

  it("never puts the stamp word on a claim that is not a completed one — the REMOTE fallback understates", async () => {
    const { remoteFallbackStamp, remoteConclusionFallback } =
      await loadLazyModule();

    expect(remoteFallbackStamp({ status: "played" })).toBeUndefined();
    expect(
      remoteFallbackStamp({ status: "completed", elapsedMs: ELAPSED_MS }),
    ).toBeUndefined();
    expect(
      remoteFallbackStamp({
        status: "completed",
        elapsedMs: ELAPSED_MS,
        hintsUsed: 0,
      }),
    ).toEqual({ elapsedMs: ELAPSED_MS, hintsUsed: 0 });

    render(
      remoteConclusionFallback({
        game: "termo",
        date: DATE,
        copy: messages.games.termo.conclusion,
        claim: { status: "played" },
      }),
    );
    expect(
      screen.getByText(messages.games.termo.conclusion.title),
    ).toBeInTheDocument();
    expect(screen.queryByText(messages.conclusion.stampLabel)).toBeNull();
    expect(screen.getByText(messages.conclusion.back)).toBeInTheDocument();
  });
});

describe("every screen root warms the conclusion chunk on mount (T-WEB-S289)", () => {
  it.each([
    {
      game: "sudoku",
      mount: async () => {
        const { SudokuScreen } = await import("../src/sudoku/sudoku-screen");
        render(<SudokuScreen daily={SUDOKU_DAILY} />);
      },
    },
    {
      game: "binairo",
      mount: async () => {
        const { BinairoScreen } = await import("../src/binairo/binairo-screen");
        render(<BinairoScreen daily={BINAIRO_DAILY} />);
      },
    },
    {
      game: "nonogram",
      mount: async () => {
        const { NonogramScreen } =
          await import("../src/nonogram/nonogram-screen");
        render(<NonogramScreen daily={NONOGRAM_DAILY} />);
      },
    },
    {
      game: "termo",
      mount: async () => {
        const { TermoScreen } = await import("../src/termo/termo-screen");
        render(<TermoScreen daily={TERMO_DAILY} />);
      },
    },
  ])(
    "$game preloads the conclusion while the board is still open",
    async ({ mount }) => {
      stubApi();

      expect(chunk.loads).toBe(0);

      await mount();

      await waitFor(() => {
        expect(chunk.loads).toBeGreaterThan(0);
      });
    },
  );
});
