import type { Game } from "@miolos/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import HojePage from "../app/page";
import { formatElapsed, messages, routes } from "../src/i18n";
import {
  writePlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";

/**
 * The hub Termo tile's `em 4/6` (#29, plan 033 D5): `TermoDoneLink` owns
 * the whole done anchor for a COMPLETED Termo and captions it with the
 * SERVER's guess count from GET /stats — never a duration, never a local
 * derivation (ADR-0031: device state decides the shape, the server value
 * only captions it). The hoje.smoke register: fake Date, records under the
 * hub's own SP day, env + fetch stubs as a mandatory pair.
 */
const DATE = "2026-07-31";
const OTHER_DATE = "2026-07-30";
const API_URL = "https://api.example.test";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SUDOKU_ELAPSED_MS = 512_000;

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

type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const TERMO_MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const TERMO_WIN: Tiles = [
  "correct",
  "correct",
  "correct",
  "correct",
  "correct",
];

function wonTermo(overrides: Partial<TermoPlayRecord> = {}): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [
      { guess: "cafes", tiles: [...TERMO_MISS] },
      { guess: "praga", tiles: [...TERMO_WIN] },
    ],
    answer: "praga",
    outcome: "won",
    elapsedMs: 188_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

const lostTermo = () =>
  wonTermo({
    guesses: "abcdef".split("").map((letter) => ({
      guess: letter.repeat(5),
      tiles: [...TERMO_MISS],
    })),
    outcome: "lost",
  });

/** A /stats body whose Termo half says: won today, in `guesses` tries. */
function statsBody(date: string, guesses: number | null): unknown {
  const timed = {
    solved: 0,
    bestMs: null,
    averageMs: null,
    averageSampleCount: 0,
    histogram: [0, 0, 0, 0, 0, 0],
  };
  return {
    date,
    binairo: timed,
    sudoku: timed,
    nonogram: timed,
    termo: {
      solved: guesses === null ? 0 : 1,
      distribution:
        guesses === null
          ? [0, 0, 0, 0, 0, 0, 0]
          : [0, 0, 0, 0, 0, 0, 0].map((zero, index) =>
              index === guesses - 1 ? 1 : zero,
            ),
    },
    perfectDays: 0,
    todayTermoGuesses: guesses,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** The requested URL as a string — every client in this app passes one. */
function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

/** Answers /stats with `stats`; every other read (streak, attach) gets the
 *  anonymous 401, so the rest of the hub keeps its shipped zero state. */
function stubFetchByUrl(stats: () => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) =>
    Promise.resolve(
      urlOf(input) === `${API_URL}/stats`
        ? stats()
        : jsonResponse(401, { error: "no-session" }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function cardFor(game: Game): HTMLElement {
  const card = screen.getByText(messages.games[game].name).closest("article");
  if (card === null) {
    throw new Error(`the ${game} card is not inside an <article>`);
  }
  return card;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${DATE}T12:00:00Z`));
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the hub Termo tile's server-fetched result (T-WEB-S156)", () => {
  it("captions a completed Termo `em 4/6` once the value lands and the dates match", async () => {
    writePlayRecord(wonTermo());
    stubFetchByUrl(() => jsonResponse(200, statsBody(DATE, 4)));

    render(<HojePage />);

    const card = within(cardFor("termo"));
    const link = await card.findByLabelText(
      messages.hoje.doneGuessesAria(messages.games.termo.name, 4),
    );
    expect(link).toHaveAttribute("href", routes.termo);
    expect(card.getByText(messages.hoje.done)).toBeInTheDocument();
    expect(
      card.getByText(messages.hoje.doneResultLong("4/6")),
    ).toBeInTheDocument();
    expect(
      card.getByText(messages.hoje.doneResultShort("4/6")),
    ).toBeInTheDocument();
  });

  it("keeps the shipped name and holds the result line box open while unsettled", () => {
    writePlayRecord(wonTermo());
    // A promise that never settles inside this test: the pre-resolution
    // paint is the unsettled state.
    stubFetchByUrl(() => new Promise<Response>(() => undefined));

    render(<HojePage />);

    const link = within(cardFor("termo")).getByLabelText(
      messages.hoje.completedAria(messages.games.termo.name),
    );
    expect(link).toHaveAttribute("href", routes.termo);
    // The blank-values idiom: a U+00A0 holds the line box open so the value
    // landing shifts nothing (#37's CLS≈0).
    expect(link.textContent).toContain(" ");
  });

  it("collapses to the chip-only form on settled-null and keeps the shipped name", async () => {
    writePlayRecord(wonTermo());
    const fetchMock = stubFetchByUrl(() =>
      jsonResponse(401, { error: "no-session" }),
    );

    render(<HojePage />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/stats`, {
        credentials: "include",
      });
    });

    const link = within(cardFor("termo")).getByLabelText(
      messages.hoje.completedAria(messages.games.termo.name),
    );
    // Chip only: no result span, no held-open blank box.
    await waitFor(() => {
      expect(link.textContent).toBe(messages.hoje.done);
    });
  });

  it("collapses to the chip-only form when the server answers for a different SP day", async () => {
    // The DB clock and the web server's SP day can disagree across
    // midnight — a value about yesterday must not caption today's tile.
    writePlayRecord(wonTermo());
    const fetchMock = stubFetchByUrl(() =>
      jsonResponse(200, statsBody(OTHER_DATE, 4)),
    );

    render(<HojePage />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/stats`, {
        credentials: "include",
      });
    });

    const link = within(cardFor("termo")).getByLabelText(
      messages.hoje.completedAria(messages.games.termo.name),
    );
    await waitFor(() => {
      expect(link.textContent).toBe(messages.hoje.done);
    });
    expect(
      within(cardFor("termo")).queryByText(messages.hoje.doneResultLong("4/6")),
    ).not.toBeInTheDocument();
  });

  it("leaves a LOST termo on the generic played path, with no /stats fetch at all", async () => {
    writePlayRecord(lostTermo());
    const fetchMock = stubFetchByUrl(() =>
      jsonResponse(200, statsBody(DATE, 4)),
    );

    render(<HojePage />);
    // Let the mount effects that DO fire (streak, attach) settle first, so
    // the absence below is a settled absence rather than a race.
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const card = within(cardFor("termo"));
    expect(
      card.getByLabelText(messages.hoje.playedAria(messages.games.termo.name)),
    ).toBeInTheDocument();
    expect(card.getByText(messages.hoje.played)).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.every(
        ([input]) => urlOf(input) !== `${API_URL}/stats`,
      ),
    ).toBe(true);
  });

  it("keeps a grid game's done tile byte-identical: the duration, never a guess count", async () => {
    writePlayRecord(concludedSudoku());
    writePlayRecord(wonTermo());
    stubFetchByUrl(() => jsonResponse(200, statsBody(DATE, 4)));

    render(<HojePage />);
    await within(cardFor("termo")).findByLabelText(
      messages.hoje.doneGuessesAria(messages.games.termo.name, 4),
    );

    const sudoku = within(cardFor("sudoku"));
    const link = sudoku.getByLabelText(
      messages.hoje.doneAria(
        messages.games.sudoku.name,
        formatElapsed(SUDOKU_ELAPSED_MS),
      ),
    );
    expect(link).toHaveAttribute("href", routes.sudoku);
    expect(
      sudoku.getByText(
        messages.hoje.doneResultLong(formatElapsed(SUDOKU_ELAPSED_MS)),
      ),
    ).toBeInTheDocument();
    expect(
      sudoku.queryByText(messages.hoje.doneResultLong("4/6")),
    ).not.toBeInTheDocument();
  });
});
