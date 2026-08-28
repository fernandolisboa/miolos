import {
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
  TERMO_MAX_GUESSES,
  type DailySudokuResponse,
  type DailyTermoResponse,
  type DayResponse,
  type StatsResponse,
  type StreakResponse,
} from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatElapsed, messages, playRoutes } from "../src/i18n";
import {
  playRecordKey,
  writePlayRecord,
  type SudokuPlayRecord,
} from "../src/play/play-record";
import { solutionDigits } from "../src/sudoku/engine";
import type { SudokuDigit } from "../src/sudoku/state";

const DATE = "2026-07-31";
const API_URL = "https://api.example.test";

const SUDOKU_PUZZLE = generateDailySudoku({ seed: 20_260_731, weekday: 1 });

const SUDOKU_DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU_PUZZLE.givens,
  tier: SUDOKU_PUZZLE.tier,
});

const TERMO_DAILY: DailyTermoResponse = dailyTermoResponseSchema.parse({
  game: "termo",
  date: DATE,
});

const ELAPSED_MS = 512_000;

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

function emptyTimed(): StatsResponse["sudoku"] {
  return {
    solved: 0,
    bestMs: null,
    averageMs: null,
    averageSampleCount: 0,
    histogram: [0, 0, 0, 0, 0, 0],
  };
}

function statsBody(overrides: Partial<StatsResponse> = {}): StatsResponse {
  return {
    date: DATE,
    binairo: emptyTimed(),
    sudoku: emptyTimed(),
    nonogram: emptyTimed(),
    termo: { solved: 3, distribution: [0, 1, 0, 2, 0, 0, 1] },
    perfectDays: 0,
    todayTermoGuesses: 4,
    ...overrides,
  };
}

function streakBody(): StreakResponse {
  return { date: DATE, streak: 3, todayCounts: true };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

function stubApi(routes: {
  day?: () => Response;
  stats?: () => Response;
  streak?: () => Response;
  notifications?: () => Response;
}) {
  const anonymous = () => jsonResponse(401, { error: "no-session" });
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url === `${API_URL}/day`) {
      return Promise.resolve((routes.day ?? anonymous)());
    }
    if (url === `${API_URL}/notifications/state`) {
      return Promise.resolve((routes.notifications ?? anonymous)());
    }
    if (url === `${API_URL}/stats`) {
      return Promise.resolve((routes.stats ?? anonymous)());
    }
    if (url === `${API_URL}/streak`) {
      return Promise.resolve((routes.streak ?? anonymous)());
    }
    return Promise.resolve(anonymous());
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

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

function inProgressSudoku(): SudokuPlayRecord {
  const entries: (SudokuDigit | null)[] = Array.from(
    { length: 81 },
    () => null,
  );
  const firstEmpty = SUDOKU_PUZZLE.givens.findIndex((given) => given === 0);
  entries[firstEmpty] = SOLUTION[firstEmpty] ?? null;
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries,
    elapsedMs: 90_000,
    hintsUsed: 0,
    concluded: false,
    pendingSync: false,
    syncOutcome: "pending",
  };
}

async function loadSudokuScreen() {
  return (await import("../src/sudoku/sudoku-screen")).SudokuScreen;
}

async function loadTermoScreen() {
  return (await import("../src/termo/termo-screen")).TermoScreen;
}

async function loadConclusionView() {
  return (await import("../src/play/conclusion-view")).ConclusionView;
}

function playRecordKeys(): string[] {
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key !== null && key.startsWith("miolos:play:")) {
      keys.push(key);
    }
  }
  return keys;
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

describe("a played Termo opens the loss shape, with nothing fabricated (T-WEB-S274)", () => {
  it("renders the loss stamp — no celebration, no answer word, no time, no share", async () => {
    stubApi({
      day: () => jsonResponse(200, dayBody({ termo: { status: "played" } })),
    });
    const TermoScreen = await loadTermoScreen();

    const { container } = render(<TermoScreen daily={TERMO_DAILY} />);

    expect(
      await screen.findByLabelText(
        messages.games.termo.outcome.lostAria(TERMO_MAX_GUESSES),
      ),
    ).toBeInTheDocument();
    const main = container.querySelector("[data-conclusion-remote]");
    expect(main).not.toBeNull();
    expect(main).toHaveAttribute("data-conclusion-state", "lost");
    expect(
      screen.getByText(messages.conclusion.remote.playedNote),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText(messages.conclusion.remote.playedBody),
    ).not.toHaveLength(0);

    expect(
      screen.queryByText(messages.games.termo.outcome.wonLabel),
    ).toBeNull();
    expect(screen.queryByText(messages.conclusion.stampLabel)).toBeNull();

    expect(screen.queryByText(messages.games.termo.dayWord.lead)).toBeNull();

    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/);
    expect(screen.queryByText(messages.conclusion.hints(0))).toBeNull();

    expect(screen.queryByText(messages.share.label)).toBeNull();
  });
});

describe("the remote grid stamp — byte-identical where full, per-line where degraded (T-WEB-S275)", () => {
  it("renders through the LOCAL stamp's own composer where the claim carries time and hints", async () => {
    writePlayRecord(concludedSudoku());
    stubApi({
      day: () =>
        jsonResponse(
          200,
          dayBody({
            nonogram: {
              status: "completed",
              elapsedMs: ELAPSED_MS,
              hintsUsed: 0,
            },
          }),
        ),
    });
    const ConclusionView = await loadConclusionView();

    const elapsed = formatElapsed(ELAPSED_MS);
    const local = render(
      <ConclusionView
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
      />,
    );
    const localStamp = await screen.findByLabelText(
      messages.conclusion.stampAria(
        messages.games.sudoku.conclusion.title,
        elapsed,
        0,
      ),
    );

    render(
      <ConclusionView
        game="nonogram"
        date={DATE}
        copy={messages.games.nonogram.conclusion}
      />,
    );
    const remoteStamp = await screen.findByLabelText(
      messages.conclusion.stampAria(
        messages.games.nonogram.conclusion.title,
        elapsed,
        0,
      ),
    );

    expect(remoteStamp.innerHTML).toBe(localStamp.innerHTML);
    expect(remoteStamp.className).toBe(localStamp.className);
    local.unmount();
  });

  it("renders the time line and OMITS the hints line on a skew claim — never a fabricated `sem dicas`", async () => {
    stubApi({
      day: () =>
        jsonResponse(
          200,
          dayBody({
            sudoku: { status: "completed", elapsedMs: ELAPSED_MS },
          }),
        ),
    });
    const SudokuScreen = await loadSudokuScreen();

    render(<SudokuScreen daily={SUDOKU_DAILY} />);

    const elapsed = formatElapsed(ELAPSED_MS);
    const stamp = await screen.findByLabelText(
      messages.conclusion.remote.stampTimeAria(
        messages.games.sudoku.conclusion.title,
        elapsed,
      ),
    );
    expect(stamp).toHaveTextContent(elapsed);

    expect(screen.queryByText(messages.conclusion.hints(0))).toBeNull();
    expect(screen.queryByText(messages.conclusion.hints(1))).toBeNull();
    expect(
      screen.queryByLabelText(
        messages.conclusion.stampAria(
          messages.games.sudoku.conclusion.title,
          elapsed,
          0,
        ),
      ),
    ).toBeNull();
  });
});

describe("the /concluido remote mount leaves the local play keys empty (T-WEB-S276)", () => {
  it("mounts, renders, and leaves localStorage's play keys empty", async () => {
    stubApi({
      day: () =>
        jsonResponse(
          200,
          dayBody({
            nonogram: {
              status: "completed",
              elapsedMs: ELAPSED_MS,
              hintsUsed: 1,
            },
          }),
        ),
      stats: () => jsonResponse(200, statsBody()),
      streak: () => jsonResponse(200, streakBody()),
    });
    const ConclusionView = await loadConclusionView();

    const { container } = render(
      <ConclusionView
        game="nonogram"
        date={DATE}
        copy={messages.games.nonogram.conclusion}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector("[data-conclusion-remote]"),
      ).not.toBeNull();
    });

    expect(playRecordKeys()).toEqual([]);
  });
});

describe("the date gate: a payload for another day never mounts the remote view (T-WEB-S277)", () => {
  it("keeps the playable board when the payload's date is not the rendered day", async () => {
    const fetchMock = stubApi({
      day: () =>
        jsonResponse(
          200,
          dayBody(
            {
              sudoku: {
                status: "completed",
                elapsedMs: ELAPSED_MS,
                hintsUsed: 0,
              },
            },
            "2026-07-30",
          ),
        ),
    });
    const SudokuScreen = await loadSudokuScreen();

    const { container } = render(<SudokuScreen daily={SUDOKU_DAILY} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(
        container.querySelector('[data-play-state="playing"]'),
      ).not.toBeNull();
    });
    expect(container.querySelector("[data-conclusion-remote]")).toBeNull();
  });
});

describe("a closed LOCAL record outranks the claim (T-WEB-S278)", () => {
  it("renders this device's own conclusion, not the remote view — the decision-7 mirror", async () => {
    writePlayRecord(concludedSudoku());
    stubApi({
      day: () =>
        jsonResponse(
          200,
          dayBody({
            sudoku: { status: "completed", elapsedMs: 407_000, hintsUsed: 1 },
          }),
        ),
    });
    const SudokuScreen = await loadSudokuScreen();

    const { container } = render(<SudokuScreen daily={SUDOKU_DAILY} />);

    expect(
      await screen.findByLabelText(
        messages.conclusion.stampAria(
          messages.games.sudoku.conclusion.title,
          formatElapsed(ELAPSED_MS),
          0,
        ),
      ),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-conclusion-remote]")).toBeNull();
  });
});

describe("an in-progress board swaps to the remote view — clock frozen, record preserved (T-WEB-S279)", () => {
  it("shows the completed view over a half-played board, and the preserved record's elapsedMs stops growing", async () => {
    const written = inProgressSudoku();
    writePlayRecord(written);
    stubApi({
      day: () =>
        jsonResponse(
          200,
          dayBody({
            sudoku: {
              status: "completed",
              elapsedMs: ELAPSED_MS,
              hintsUsed: 0,
            },
          }),
        ),
    });
    const SudokuScreen = await loadSudokuScreen();

    const { container } = render(<SudokuScreen daily={SUDOKU_DAILY} />);

    await waitFor(() => {
      expect(
        container.querySelector("[data-conclusion-remote]"),
      ).not.toBeNull();
    });
    expect(container.querySelector('[data-play-state="playing"]')).toBeNull();

    const stored = window.localStorage.getItem(playRecordKey("sudoku", DATE));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "{}")).toEqual(written);

    vi.setSystemTime(new Date(`${DATE}T12:00:30Z`));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const afterHide = window.localStorage.getItem(
      playRecordKey("sudoku", DATE),
    );
    expect(JSON.parse(afterHide ?? "{}")).toEqual(written);
  });
});

describe("the /concluido empty branch renders the remote view, with no way into a board (T-WEB-S280)", () => {
  it("replaces the notYet card and offers no `Jogar` CTA and no link to this game's route", async () => {
    stubApi({
      day: () =>
        jsonResponse(
          200,
          dayBody({
            sudoku: {
              status: "completed",
              elapsedMs: ELAPSED_MS,
              hintsUsed: 0,
            },
          }),
        ),
      stats: () => jsonResponse(200, statsBody()),
      streak: () => jsonResponse(200, streakBody()),
    });
    const ConclusionView = await loadConclusionView();

    const { container } = render(
      <ConclusionView
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector("[data-conclusion-remote]"),
      ).not.toBeNull();
    });

    expect(
      screen.queryByText(messages.games.sudoku.conclusion.notYet.title),
    ).toBeNull();
    expect(
      screen.queryByText(messages.games.sudoku.conclusion.notYet.cta),
    ).toBeNull();
    expect(screen.queryByText(messages.conclusion.notYet.body)).toBeNull();

    for (const anchor of Array.from(container.querySelectorAll("a"))) {
      expect(anchor.getAttribute("href")).not.toBe(playRoutes.sudoku);
    }
  });
});

describe("stats and streak gate on the claim, one GET /stats, honest `em X/6` (T-WEB-S281)", () => {
  it("a completed Termo renders `X/6` from ONE stats fetch, plus the distribution and the streak", async () => {
    const fetchMock = stubApi({
      day: () => jsonResponse(200, dayBody({ termo: { status: "completed" } })),
      stats: () => jsonResponse(200, statsBody({ todayTermoGuesses: 4 })),
      streak: () => jsonResponse(200, streakBody()),
    });
    const TermoScreen = await loadTermoScreen();

    render(<TermoScreen daily={TERMO_DAILY} />);

    expect(
      await screen.findByLabelText(
        messages.games.termo.outcome.wonAria(4, TERMO_MAX_GUESSES),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        messages.games.termo.outcome.wonDetail(4, TERMO_MAX_GUESSES),
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(messages.stats.termo.rowAria(4, 2)),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByLabelText(messages.conclusion.streak.aria(3)),
      ).toBeInTheDocument();
    });
    const statsCalls = fetchMock.mock.calls.filter(
      ([input]) => urlOf(input) === `${API_URL}/stats`,
    );
    expect(statsCalls).toHaveLength(1);
  });

  it("falls back to a label-only stamp when the stats answer is for ANOTHER day, and when the count is null", async () => {
    stubApi({
      day: () => jsonResponse(200, dayBody({ termo: { status: "completed" } })),
      stats: () => jsonResponse(200, statsBody({ date: "2026-07-30" })),
    });
    const TermoScreen = await loadTermoScreen();

    const first = render(<TermoScreen daily={TERMO_DAILY} />);
    expect(
      await screen.findByLabelText(
        messages.conclusion.remote.stampBareAria(
          messages.games.termo.conclusion.title,
        ),
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        messages.games.termo.outcome.wonDetail(4, TERMO_MAX_GUESSES),
      ),
    ).toBeNull();
    first.unmount();

    vi.resetModules();
    stubApi({
      day: () => jsonResponse(200, dayBody({ termo: { status: "completed" } })),
      stats: () => jsonResponse(200, statsBody({ todayTermoGuesses: null })),
    });
    const TermoScreenAgain = await loadTermoScreen();
    render(<TermoScreenAgain daily={TERMO_DAILY} />);
    expect(
      await screen.findByLabelText(
        messages.conclusion.remote.stampBareAria(
          messages.games.termo.conclusion.title,
        ),
      ),
    ).toBeInTheDocument();
  });

  it("a grid remote view renders the stat block and streak with no syncOutcome anywhere in sight", async () => {
    stubApi({
      day: () =>
        jsonResponse(
          200,
          dayBody({
            sudoku: {
              status: "completed",
              elapsedMs: ELAPSED_MS,
              hintsUsed: 0,
            },
          }),
        ),
      stats: () =>
        jsonResponse(
          200,
          statsBody({
            sudoku: {
              solved: 5,
              bestMs: 300_000,
              averageMs: 400_000,
              averageSampleCount: 5,
              histogram: [0, 1, 1, 2, 1, 0],
            },
          }),
        ),
      streak: () => jsonResponse(200, streakBody()),
    });
    const SudokuScreen = await loadSudokuScreen();

    render(<SudokuScreen daily={SUDOKU_DAILY} />);

    expect(await screen.findByText(formatElapsed(300_000))).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByLabelText(messages.conclusion.streak.aria(3)),
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(messages.conclusion.sync.pending)).toBeNull();
    expect(screen.queryByText(messages.conclusion.sync.rejected)).toBeNull();
  });
});

describe("the remote swap announces itself — ADR-0043 decision 10's live region (T-WEB-S282)", () => {
  it("carries the completed sentence over a mid-play swap, and the played one on a loss", async () => {
    writePlayRecord(inProgressSudoku());
    stubApi({
      day: () =>
        jsonResponse(
          200,
          dayBody({
            sudoku: {
              status: "completed",
              elapsedMs: ELAPSED_MS,
              hintsUsed: 0,
            },
          }),
        ),
    });
    const SudokuScreen = await loadSudokuScreen();

    const first = render(<SudokuScreen daily={SUDOKU_DAILY} />);
    await waitFor(() => {
      expect(
        first.container.querySelector("[data-conclusion-remote]"),
      ).not.toBeNull();
    });
    const region = first.getByRole("status");
    expect(region).toHaveTextContent(messages.conclusion.remote.completedBody);
    first.unmount();

    vi.resetModules();
    window.localStorage.clear();
    stubApi({
      day: () => jsonResponse(200, dayBody({ termo: { status: "played" } })),
    });
    const TermoScreen = await loadTermoScreen();
    const second = render(<TermoScreen daily={TERMO_DAILY} />);
    await waitFor(() => {
      expect(
        second.container.querySelector("[data-conclusion-remote]"),
      ).not.toBeNull();
    });
    const playedRegion = second.getByRole("status");
    expect(playedRegion).toHaveTextContent(
      messages.conclusion.remote.playedBody,
    );
    expect(playedRegion).not.toHaveTextContent(
      messages.conclusion.remote.completedBody,
    );
  });
});

function installAskablePushBrowser(): void {
  Object.defineProperty(window, "Notification", {
    value: { permission: "default" },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(window, "PushManager", {
    value: class PushManager {},
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, "serviceWorker", {
    value: { getRegistration: () => Promise.resolve(undefined) },
    configurable: true,
  });
}

function removePushBrowser(): void {
  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(window, "PushManager");
  Reflect.deleteProperty(navigator, "serviceWorker");
}

describe("the push card mounts LAST in the LOCAL aside, and never on the remote view (T-WEB-S272)", () => {
  afterEach(() => {
    removePushBrowser();
  });

  const eligiblePush = () =>
    jsonResponse(200, { eligible: true, vapidPublicKey: "BServerKey" });

  it("a locally-concluded day renders the card as the aside's last child — the mount-point pin: deleting the ConclusionAside prompt slot or its call-site fill goes red here", async () => {
    installAskablePushBrowser();
    writePlayRecord(concludedSudoku());
    stubApi({
      stats: () => jsonResponse(200, statsBody()),
      streak: () => jsonResponse(200, streakBody()),
      notifications: eligiblePush,
    });
    const ConclusionView = await loadConclusionView();

    render(
      <ConclusionView
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
      />,
    );

    const title = await screen.findByText(messages.push.title);
    const section = title.closest("section");
    const aside = title.closest("aside");
    expect(section).not.toBeNull();
    expect(aside).not.toBeNull();

    expect(aside?.lastElementChild).toBe(section);
  });

  it("the remote completed view — same eligibility, same askable browser — renders no card and fires no push state fetch (ADR-0065 decision 8's owed arm)", async () => {
    installAskablePushBrowser();
    const fetchMock = stubApi({
      day: () =>
        jsonResponse(
          200,
          dayBody({
            sudoku: {
              status: "completed",
              elapsedMs: ELAPSED_MS,
              hintsUsed: 0,
            },
          }),
        ),
      stats: () => jsonResponse(200, statsBody()),
      streak: () => jsonResponse(200, streakBody()),
      notifications: eligiblePush,
    });
    const ConclusionView = await loadConclusionView();

    const { container } = render(
      <ConclusionView
        game="sudoku"
        date={DATE}
        copy={messages.games.sudoku.conclusion}
      />,
    );

    await waitFor(() => {
      expect(
        container.querySelector("[data-conclusion-remote]"),
      ).not.toBeNull();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(screen.queryByText(messages.push.title)).toBeNull();

    expect(
      fetchMock.mock.calls.some(([input]) =>
        urlOf(input).endsWith("/notifications/state"),
      ),
    ).toBe(false);
  });
});
