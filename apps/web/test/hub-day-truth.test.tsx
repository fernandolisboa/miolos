import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
  type DayResponse,
} from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { render, screen, waitFor, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatElapsed, messages, playRoutes, routes } from "../src/i18n";
import {
  playRecordKey,
  writePlayRecord,
  type BinairoPlayRecord,
  type SudokuPlayRecord,
} from "../src/play/play-record";

/** Weekday 1 is tier 1, the cheapest rung (~0.7 ms), and it runs once. */
const SUDOKU_PUZZLE = generateDailySudoku({ seed: 20_260_731, weekday: 1 });

/**
 * The day payload on the rendered surfaces (#83, ADR-0060): the hub tile
 * whose shape a SERVER claim decides, the conclusion that must still stamp
 * itself when the fetch fails, and the honest gap behind a cross-device
 * done tile.
 *
 * The `hoje.smoke` register: fake `Date`, records written under the hub's
 * own São Paulo day, and the env stub plus the fetch stub as a MANDATORY
 * PAIR — with only the fetch stub every client's env guard short-circuits
 * and the stub is dead code.
 *
 * THE THREE SURFACES ARE IMPORTED DYNAMICALLY, and that is what makes
 * `vi.resetModules()` in `beforeEach` mean anything. The day-truth store is
 * a MODULE-LEVEL slot that deliberately RETAINS its payload across
 * unmounts; `vi.resetModules()` only affects modules imported *after* it, so
 * with `import HojePage from "../app/page"` at the top of the file the store
 * instance was bound once at file load and every payload leaked from one
 * `it` to the next. That is a latent vacuity — a case whose `waitFor`
 * expects the tile a PREVIOUS case's payload already produced passes
 * without fetching anything — and it made the first assertion of the
 * cross-device case (the tile is still the pending button *before* the
 * payload lands) depend on suite order. Reloading the tree per test costs a
 * few hundred milliseconds and buys real isolation. `@testing-library/react`
 * and React itself stay static: they are externalised deps, which
 * `resetModules` does not touch, so there is no split-React hazard.
 */
const DATE = "2026-07-31";
const API_URL = "https://api.example.test";
const SUDOKU_ELAPSED_MS = 512_000;
const BINAIRO_ELAPSED_MS = 407_000;

const SUDOKU_DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU_PUZZLE.givens,
  tier: SUDOKU_PUZZLE.tier,
});

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

function concludedSudoku(): SudokuPlayRecord {
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: Array.from({ length: 81 }, () => null),
    grid: Array.from({ length: 9 }, () => DIGITS).flat(),
    elapsedMs: SUDOKU_ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };
}

function concludedBinairo(): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: Array.from({ length: 64 }, () => null),
    grid: Array.from({ length: 64 }, (_unused, index) =>
      index % 2 === 0 ? 0 : 1,
    ),
    elapsedMs: BINAIRO_ELAPSED_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
  };
}

function dayBody(
  games: Partial<DayResponse["games"]> = {},
  date: string = DATE,
): DayResponse {
  return {
    date,
    games: {
      termo: { status: "pending" },
      sudoku: { status: "pending" },
      nonogram: { status: "pending" },
      binairo: { status: "pending" },
      ...games,
    },
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** The requested URL as a string — every client in this app passes one. */
function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

/**
 * Answers `/day` with `day()`; every other read (streak, stats, attach) gets
 * the anonymous 401, so the rest of the hub keeps its shipped zero state.
 */
function stubFetchByUrl(day: () => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) =>
    urlOf(input) === `${API_URL}/day`
      ? Promise.resolve(day())
      : Promise.resolve(jsonResponse(401, { error: "no-session" })),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function cardFor(game: "termo" | "sudoku" | "nonogram" | "binairo") {
  const card = screen.getByText(messages.games[game].name).closest("article");
  if (card === null) {
    throw new Error(`the ${game} card is not inside an <article>`);
  }
  return within(card);
}

/** The hub, the conclusion and the play screen, re-bound after each reset. */
async function loadHojePage() {
  return (await import("../app/page")).default;
}

async function loadConclusionView() {
  return (await import("../src/play/conclusion-view")).ConclusionView;
}

async function loadSudokuScreen() {
  return (await import("../src/sudoku/sudoku-screen")).SudokuScreen;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DATE}T12:00:00Z`));
  window.localStorage.clear();
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the hub's first paint is untouched (T-WEB-S239)", () => {
  it("renders every tile pending from the server snapshot, and issues NO fetch during render", async () => {
    const fetchMock = stubFetchByUrl(() => jsonResponse(200, dayBody()));
    const HojePage = await loadHojePage();

    const markup = renderToStaticMarkup(<HojePage />);

    // Both server snapshots are the empty answer — `NOTHING_DONE` for the
    // records and `undefined` for the payload — so the server markup and
    // the pre-hydration client render agree byte-for-byte.
    expect(markup).toContain(messages.hoje.playCta);
    expect(markup).not.toContain(messages.hoje.done);
    expect(markup).toContain(messages.hoje.completedOfTotal(0, 4));
    // The store subscribes in an EFFECT, and `renderToStaticMarkup` runs
    // none, so the ADR-0004-adjacent claim holds: nothing is fetched to
    // paint the hub.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("a game completed on another device (T-WEB-S240)", () => {
  it("renders `Feito`, chip-only when the claim carries no duration, and `X de 4` counts it", async () => {
    // A claim WITHOUT `elapsedMs` — Termo's only completed shape, and any
    // degraded payload. Since #141 a completed grid claim normally carries
    // one and the tile renders it (T-WEB-S257 below); this pins the honest
    // fallback: no value in the payload, no time on the tile.
    stubFetchByUrl(() =>
      jsonResponse(200, dayBody({ nonogram: { status: "completed" } })),
    );
    const HojePage = await loadHojePage();

    render(<HojePage />);

    // Before the payload lands the tile is the shipped pending button.
    expect(
      cardFor("nonogram").getByText(messages.hoje.playCta),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        cardFor("nonogram").getByLabelText(
          messages.hoje.completedAria(messages.games.nonogram.name),
        ),
      ).toBeInTheDocument();
    });
    const card = cardFor("nonogram");
    expect(card.getByText(messages.hoje.done)).toBeInTheDocument();
    // Chip-only: no fabricated value ever reaches a composer.
    expect(
      card.queryByText(
        messages.hoje.doneResultLong(formatElapsed(SUDOKU_ELAPSED_MS)),
      ),
    ).toBeNull();
    expect(
      screen.getByText(messages.hoje.completedOfTotal(1, 4)),
    ).toBeInTheDocument();
  });

  it("adds to what this device already knows rather than replacing it", async () => {
    writePlayRecord(concludedBinairo());
    stubFetchByUrl(() =>
      jsonResponse(200, dayBody({ sudoku: { status: "completed" } })),
    );
    const HojePage = await loadHojePage();

    render(<HojePage />);

    await waitFor(() => {
      expect(
        screen.getByText(messages.hoje.completedOfTotal(2, 4)),
      ).toBeInTheDocument();
    });
    // The device's own done keeps its duration; this claim carries none.
    expect(
      cardFor("binairo").getByText(
        messages.hoje.doneResultLong(formatElapsed(BINAIRO_ELAPSED_MS)),
      ),
    ).toBeInTheDocument();
    expect(
      cardFor("sudoku").getByLabelText(
        messages.hoje.completedAria(messages.games.sudoku.name),
      ),
    ).toBeInTheDocument();
  });

  it("ignores a payload for another day IN FULL", async () => {
    stubFetchByUrl(() =>
      jsonResponse(
        200,
        dayBody(
          {
            sudoku: { status: "completed", elapsedMs: SUDOKU_ELAPSED_MS },
            nonogram: { status: "completed" },
          },
          "2026-07-30",
        ),
      ),
    );
    const HojePage = await loadHojePage();

    render(<HojePage />);

    await waitFor(() => {
      expect(
        cardFor("sudoku").getByText(messages.hoje.playCta),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(messages.hoje.completedOfTotal(0, 4)),
    ).toBeInTheDocument();
  });
});

/**
 * Fernando's answer to PR #135 veto decision 1 (#141): look and feel match
 * across devices. The cross-device done tile renders the server-carried
 * duration through EXACTLY the shipped local path — same `HubCardAction`,
 * same `formatElapsed`, same composers — so the presentation is identical by
 * construction, and this suite asserts the identity rather than trusting it.
 */
describe("a cross-device done tile shows its time exactly as a local one (T-WEB-S257)", () => {
  it("renders the payload's duration through the local tile's own composers", async () => {
    stubFetchByUrl(() =>
      jsonResponse(
        200,
        dayBody({
          nonogram: { status: "completed", elapsedMs: SUDOKU_ELAPSED_MS },
        }),
      ),
    );
    const HojePage = await loadHojePage();

    render(<HojePage />);

    const elapsed = formatElapsed(SUDOKU_ELAPSED_MS);
    await waitFor(() => {
      expect(
        cardFor("nonogram").getByLabelText(
          messages.hoje.doneAria(messages.games.nonogram.name, elapsed),
        ),
      ).toBeInTheDocument();
    });
    const card = cardFor("nonogram");
    expect(card.getByText(messages.hoje.done)).toBeInTheDocument();
    expect(
      card.getByText(messages.hoje.doneResultLong(elapsed)),
    ).toBeInTheDocument();
    expect(
      card.getByText(messages.hoje.doneResultShort(elapsed)),
    ).toBeInTheDocument();
    expect(
      screen.getByText(messages.hoje.completedOfTotal(1, 4)),
    ).toBeInTheDocument();
  });

  it("is BYTE-IDENTICAL to the local tile's rendering of the same time, modulo the game", async () => {
    // One game done locally, another done on the server with the SAME
    // stored duration: the two anchors' inner markup must be equal once the
    // game-specific strings are normalised away — one component, one
    // formatter, zero per-source styling.
    writePlayRecord(concludedBinairo());
    stubFetchByUrl(() =>
      jsonResponse(
        200,
        dayBody({
          nonogram: { status: "completed", elapsedMs: BINAIRO_ELAPSED_MS },
        }),
      ),
    );
    const HojePage = await loadHojePage();

    render(<HojePage />);

    const elapsed = formatElapsed(BINAIRO_ELAPSED_MS);
    await waitFor(() => {
      expect(
        cardFor("nonogram").getByLabelText(
          messages.hoje.doneAria(messages.games.nonogram.name, elapsed),
        ),
      ).toBeInTheDocument();
    });
    const localAnchor = cardFor("binairo").getByLabelText(
      messages.hoje.doneAria(messages.games.binairo.name, elapsed),
    );
    const serverAnchor = cardFor("nonogram").getByLabelText(
      messages.hoje.doneAria(messages.games.nonogram.name, elapsed),
    );
    expect(serverAnchor.innerHTML).toBe(localAnchor.innerHTML);
    expect(serverAnchor.className).toBe(localAnchor.className);
    expect(
      screen.getByText(messages.hoje.completedOfTotal(2, 4)),
    ).toBeInTheDocument();
  });
});

describe("the conclusion still finishes offline (T-WEB-S241)", () => {
  it("renders its stamp when the day fetch rejects", async () => {
    writePlayRecord(concludedBinairo());
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );

    const ConclusionView = await loadConclusionView();

    render(
      <ConclusionView
        game="binairo"
        date={DATE}
        copy={messages.games.binairo.conclusion}
      />,
    );

    // ADR-0031 decision 1's offline fallback: the local reader is the whole
    // answer, and nothing on this path awaited the fetch.
    expect(
      await screen.findByLabelText(
        messages.conclusion.stampAria(
          messages.games.binairo.conclusion.title,
          formatElapsed(BINAIRO_ELAPSED_MS),
          0,
        ),
      ),
    ).toBeInTheDocument();
  });
});

describe("a cross-device done tile leads to a PLAYABLE board (T-WEB-S245)", () => {
  it("keeps its href, and the play route behind it has no local record to restore", async () => {
    stubFetchByUrl(() =>
      jsonResponse(200, dayBody({ sudoku: { status: "completed" } })),
    );
    const HojePage = await loadHojePage();

    render(<HojePage />);

    const link = await waitFor(() =>
      cardFor("sudoku").getByLabelText(
        messages.hoje.completedAria(messages.games.sudoku.name),
      ),
    );
    // ADR-0060 decision 8, decided rather than discovered: the tile is a
    // `<Link href="/sudoku">` and the screen behind it swaps to the
    // conclusion only via `isClosedAndFrozen(play.state)`, which reads the
    // LOCAL record. Cross-device there is none, so `/sudoku` renders a
    // fresh playable board — ADR-0053 decision 10 layer 3's "honest gap",
    // reached from the daily hub for the first time. The replay writes
    // nothing (layer 1).
    expect(link).toHaveAttribute("href", playRoutes.sudoku);
    expect(playRoutes.sudoku).toBe(routes.sudoku);
    // The premise the paragraph above rests on, asserted rather than
    // assumed: the payload never becomes a play record, so there is nothing
    // for the screen to restore.
    expect(
      window.localStorage.getItem(playRecordKey("sudoku", DATE)),
    ).toBeNull();
  });

  it("the /sudoku screen behind it renders a fresh PLAYABLE board — asserted, not assumed", async () => {
    // No local record, and the server says completed. `isClosedAndFrozen`
    // reads the record, so the swap never happens and the board is live.
    stubFetchByUrl(() =>
      jsonResponse(200, dayBody({ sudoku: { status: "completed" } })),
    );

    const SudokuScreen = await loadSudokuScreen();

    const { container } = render(<SudokuScreen daily={SUDOKU_DAILY} />);

    await waitFor(() => {
      expect(
        container.querySelector('[data-play-state="playing"]'),
      ).not.toBeNull();
    });
    // Not the conclusion: no stamp, no "Feito" — the honest gap, named.
    expect(screen.queryByText(messages.conclusion.stampLabel)).toBeNull();
  });

  it("never writes the server's claim into a play record", async () => {
    writePlayRecord(concludedSudoku());
    stubFetchByUrl(() =>
      jsonResponse(
        200,
        dayBody({
          termo: { status: "completed" },
          nonogram: { status: "played" },
        }),
      ),
    );
    const HojePage = await loadHojePage();

    render(<HojePage />);

    await waitFor(() => {
      expect(
        screen.getByText(messages.hoje.completedOfTotal(2, 4)),
      ).toBeInTheDocument();
    });
    // The merge lives in the PROJECTION only. A synthesised record would
    // imply board content the device does not have and would make a
    // cross-device done outlive the evidence for it (ADR-0060 decision 3's
    // "what is not merged").
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key !== null && key.startsWith("miolos:play:")) {
        keys.push(key);
      }
    }
    expect(keys).toEqual([playRecordKey("sudoku", DATE)]);
  });
});
