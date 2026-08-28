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

const SUDOKU_PUZZLE = generateDailySudoku({ seed: 20_260_731, weekday: 1 });

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

function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

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

    expect(markup).toContain(messages.hoje.playCta);
    expect(markup).not.toContain(messages.hoje.done);
    expect(markup).toContain(messages.hoje.completedOfTotal(0, 4));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("a game completed on another device (T-WEB-S240)", () => {
  it("renders `Feito`, chip-only when the claim carries no duration, and `X de 4` counts it", async () => {
    stubFetchByUrl(() =>
      jsonResponse(200, dayBody({ nonogram: { status: "completed" } })),
    );
    const HojePage = await loadHojePage();

    render(<HojePage />);

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

describe("a cross-device done tile keeps its href and writes no record (T-WEB-S245)", () => {
  it("keeps its href — the route behind it now ANSWERS completed, so the link needs no rewrite", async () => {
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
    expect(link).toHaveAttribute("href", playRoutes.sudoku);
    expect(playRoutes.sudoku).toBe(routes.sudoku);

    expect(
      window.localStorage.getItem(playRecordKey("sudoku", DATE)),
    ).toBeNull();
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

describe("a cross-device Feito tile's route renders the COMPLETED view, not a playable board (T-WEB-S273)", () => {
  it("swaps /sudoku to the remote conclusion once the claim lands, with no playable board behind it", async () => {
    stubFetchByUrl(() =>
      jsonResponse(
        200,
        dayBody({
          sudoku: {
            status: "completed",
            elapsedMs: SUDOKU_ELAPSED_MS,
            hintsUsed: 0,
          },
        }),
      ),
    );

    const SudokuScreen = await loadSudokuScreen();

    const { container } = render(<SudokuScreen daily={SUDOKU_DAILY} />);

    expect(
      await screen.findByLabelText(
        messages.conclusion.stampAria(
          messages.games.sudoku.conclusion.title,
          formatElapsed(SUDOKU_ELAPSED_MS),
          0,
        ),
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-conclusion-remote]")).not.toBeNull();

    expect(container.querySelector('[data-play-state="playing"]')).toBeNull();

    const raw = window.localStorage.getItem(playRecordKey("sudoku", DATE));
    expect(raw).not.toBeNull();

    expect(JSON.parse(raw ?? "{}")).toMatchObject({ concluded: false });
  });
});
