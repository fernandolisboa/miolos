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

/**
 * The lazy conclusion boundary's OWN suite (#145 step 7b): the pending
 * skeleton, the retry-once error boundary with its degraded static
 * fallback (T-WEB-S288), and the mount-time preload each screen root owes
 * (T-WEB-S289).
 *
 * The `remote-conclusion.test.tsx` register: fake `Date` pinned to the
 * fixture day (the prune reads the clock), the env stub and the fetch stub
 * as a mandatory pair, and every surface imported DYNAMICALLY after
 * `vi.resetModules()` — here that isolation is not hygiene but the SUBJECT:
 * `next/dynamic` keeps one module-level load state per registry, so only a
 * fresh registry renders the cold-chunk frame these tests pin, and only a
 * fresh registry lets the load counter below count one test's imports.
 *
 * THE COUNTING MOCK is half the apparatus: every import of
 * `conclusion-view` — direct, or transitive through a per-game wrapper —
 * bumps `chunk.loads`. Stripping a screen root's preload effect leaves
 * `chunk.loads` at zero and reds T-WEB-S289; before that test existed,
 * stripping all four left the entire gate green (#145 step-7b review,
 * major 4).
 *
 * `vi.doMock` in `beforeEach`, NEVER a top-level `vi.mock`: a `vi.mock`
 * factory's product survives `vi.resetModules()` (mocked modules are
 * exempt from the registry reset), so the factory runs once for the whole
 * file and the counter would count only the first test. Re-registering per
 * test is what makes each import re-evaluate the factory.
 *
 * THE FAILURE HALF deliberately does NOT mock the module: vitest's mocker
 * cannot model a persistently failing module (a throwing factory is
 * treated as a broken mock, and the next import — the boundary's retry —
 * quietly falls back to the real file, "healing" the failure mid-test).
 * The failure tests instead reject at `resilientConclusion`'s `load`
 * argument, which is the exact seam a failed chunk fetch rejects through
 * in the app build, composed with the SAME shipped fallback builders the
 * real exports use.
 */
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

/** The solution as digits, narrowed by a throw rather than by a cast. */
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

/** Everything 401s (the anonymous default every client degrades on) except
 *  an optional `/day` thunk — a FRESH Response per call (a body reads once). */
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
    // The deterministic half of #145 step-7b major 3: a fresh registry is
    // the only place the pre-flush frame is guaranteed cold (the screen
    // suites' own restore tests run after tests that already flushed the
    // chunk, so there the frame is legitimately the conclusion itself).
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
    // Non-empty — an empty container was exactly what the pre-fix
    // assertion could not tell from a skeleton.
    expect(pending?.childElementCount).toBeGreaterThan(0);
    expect(container.querySelector("[data-cell-index]")).toBeNull();

    // Flushing the same import the lazy component awaits lands the real
    // conclusion — the skeleton is a frame, not a destination.
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
        // Never settles: the frame under test is the retry window itself.
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
    // Once, not per re-render and not per failure: the boundary spends its
    // single retry and settles.
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
    // The blocker-2 scenario end to end through the SHIPPED helper: a
    // loader that genuinely rejects, twice — the first rejection surfaces
    // through the lazy element, the boundary's one retry runs the SAME
    // loader and rejects again — composed with the SAME fallback builder
    // the shipped `ConclusionView` export hands to `resilientConclusion`
    // (`localConclusionFallback`, by name, one reference in the source).
    // The player's win must land on the static fallback — the stamp word
    // and the recorded time, from props already in memory — never on a
    // blank page and never on Next's generic client-exception screen.
    //
    // The loader is a REAL rejection rather than a vi.mock of the module:
    // vitest's mocker cannot model a persistently failing module (a
    // throwing factory is treated as a broken mock and the next import
    // falls back to the real file), and this seam — `resilientConclusion`'s
    // `load` argument — is the exact seam a failed chunk fetch rejects
    // through in the app build.
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
    // The way home survives the degradation.
    expect(screen.getByText(messages.conclusion.back)).toBeInTheDocument();
    const frame = container.querySelector("[data-conclusion-state]");
    expect(frame).toHaveAttribute("data-conclusion-state", "degraded");
    expect(container.querySelector("[data-cell-index]")).toBeNull();
    // The loader ran for the lazy mount and ONCE more for the boundary's
    // retry — the "retries the import once" claim, counted at the seam.
    expect(loads.length).toBe(2);
  });

  it("never puts the stamp word on a claim that is not a completed one — the REMOTE fallback understates", async () => {
    // The remote arm of the same failure, on the shipped builders: a Termo
    // `played` claim (a lost board) degrades to the titled card ALONE —
    // `Concluído` on a loss would be the lie ADR-0043's loss discipline
    // exists to forbid — and a deploy-skew claim carrying a bare time
    // composes no stamp either, rather than fabricating a hint count.
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
  // One parameterised arm over the four roots (a cross-file spread of one
  // claim is what the sibling-letter rule exists to prevent). Each case
  // renders a fresh PLAYABLE board — no record, no claim — where NOTHING
  // else in the graph imports `conclusion-view`: the lazy component never
  // renders, so the counter can only move if the mount-time preload fires.
  // Stripping a screen root's preload effect leaves `chunk.loads` at 0 and
  // this arm red (#145 step-7b review, major 4).
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
      // The anti-vacuity control: nothing this test imported has loaded the
      // conclusion graph yet — the counter can only be moved by the mount.
      expect(chunk.loads).toBe(0);

      await mount();

      // The preload is a background import; waitFor rides real timers (only
      // `Date` is faked above).
      await waitFor(() => {
        expect(chunk.loads).toBeGreaterThan(0);
      });
    },
  );
});
