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

/**
 * The cross-device completed view (#142, ADR-0065): a day decided on
 * another device opens a conclusion the server can honestly back, never a
 * fresh playable board. The `hub-day-truth.test.tsx` register — fake
 * `Date`, records under the rendered São Paulo day, the env stub and the
 * fetch stub as a mandatory pair, and every surface imported DYNAMICALLY so
 * `vi.resetModules()` really isolates the day-truth store's module-level
 * payload between cases.
 *
 * The tail of #142's T-WEB reservation was the reserved review-round
 * headroom, burned unspent at step 5's exit — and UNBURNED AND SPENT at
 * step 7, per the recorded unburn rule (docs/agents/test-ids.md, the
 * plan-040 `T-LINT-S45` case): the issue-adherence lens required the
 * ADR-0043 decision-10 announcer on the remote view, and its arm below
 * spends the id inside the reservation rather than minting outside it.
 * (#145's push opt-in card is still excluded by ADR-0065 decision 8 alone —
 * the card had not landed at this branch's merge-from-main, so the first
 * ticket that adds it owes that test arm.)
 */
const DATE = "2026-07-31";
const API_URL = "https://api.example.test";

/** Weekday 1 is tier 1, the cheapest rung (~0.7 ms), and it runs once. */
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

/** The requested URL as a string — every client in this app passes one. */
function urlOf(input: RequestInfo | URL): string {
  return input instanceof Request ? input.url : String(input);
}

/**
 * Routes `/day`, `/stats` and `/streak`; everything else — and every route
 * whose thunk is omitted — gets the anonymous 401, which each client
 * degrades on. A FRESH Response per call (a body reads once).
 */
function stubApi(routes: {
  day?: () => Response;
  stats?: () => Response;
  streak?: () => Response;
}) {
  const anonymous = () => jsonResponse(401, { error: "no-session" });
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = urlOf(input);
    if (url === `${API_URL}/day`) {
      return Promise.resolve((routes.day ?? anonymous)());
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
  // The shipped concluded shape: the player's OWN entries where the board
  // had no given, so the reducer's restore re-derives a solved board.
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

    // The loss stamp's whole accessible name — ADR-0043's loss discipline,
    // through the same OutcomeStamp the local loss renders.
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
    // TWO nodes carry the body sentence by design: the visible card line
    // and the T-WEB-S282 announcer's live region.
    expect(
      screen.getAllByText(messages.conclusion.remote.playedBody),
    ).not.toHaveLength(0);
    // No celebration: neither the win label nor the shared stamp label
    // appears — asserted through THE KEYS, never the pt-BR literal, so a
    // copy change cannot silently disarm this arm (#142 step 7, quality m1).
    expect(
      screen.queryByText(messages.games.termo.outcome.wonLabel),
    ).toBeNull();
    expect(screen.queryByText(messages.conclusion.stampLabel)).toBeNull();
    // No answer word — it is not stored and has no read channel.
    expect(screen.queryByText(messages.games.termo.dayWord.lead)).toBeNull();
    // No time and no hints line — a value beside a loss frames it as a
    // result, and Termo publishes neither anywhere.
    expect(container.textContent).not.toMatch(/\d{2}:\d{2}/);
    expect(screen.queryByText(messages.conclusion.hints(0))).toBeNull();
    // No share button: the text composes from the local record, which does
    // not exist here.
    expect(screen.queryByText(messages.share.label)).toBeNull();
  });
});

describe("the remote grid stamp — byte-identical where full, per-line where degraded (T-WEB-S275)", () => {
  it("renders through the LOCAL stamp's own composer where the claim carries time and hints", async () => {
    // A local conclusion and a remote one showing the SAME stored values:
    // the two stamps' inner markup must be equal — one component, one
    // formatter, zero per-source styling (the T-WEB-S257 discipline).
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

    // The remote mount: the /concluido empty branch with a claim — the
    // same seam the screen root branches on, without a play hook in the way.
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
    // The deploy-skew shape: an old server publishes `elapsedMs` and no
    // `hintsUsed`. The stamp renders per line — the time it has, no hints
    // claim it cannot back (plan 060 §3's per-line rule).
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
    // The hints line is OMITTED, in the visible text and in the aria alike:
    // "sem dicas" is a claim about the solve this device cannot back.
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

// The title is scoped to the /concluido mount ON PURPOSE (#142 step 7,
// correctness F4): this route has no play hook, so "leaves the keys empty"
// is exactly what this mount can prove. The screen-root half — where the
// play lifecycle writes its own PLAYING record and only a synthesised
// CONCLUDED one is forbidden — is T-WEB-S273's claim.
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
    // ADR-0060 decision 4, verbatim: the merge lives in the projection
    // only, and the view is a projection of the claim — it dies with the
    // evidence for it rather than surviving as a synthesised record.
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
    // The payload is discarded IN FULL (ADR-0060 decision 3): after the SP
    // rollover this is what retires the remote view and the old day's
    // playable board returns — the understating direction, one surface more.
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
    // The local record holds 512 s; the server claim says 407 s (an account
    // merge can produce exactly this). The LOCAL branch must win — the
    // stamp shows the local time and the remote marker never mounts.
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

    // The claim wins over the in-progress board: the day is already decided
    // server-side (write-once row; finishing locally would record nothing).
    await waitFor(() => {
      expect(
        container.querySelector("[data-conclusion-remote]"),
      ).not.toBeNull();
    });
    expect(container.querySelector('[data-play-state="playing"]')).toBeNull();
    // The in-progress record survives — neither written nor deleted
    // (ADR-0060 decision 4 untouched): the board VIEW is lost, the record
    // is not.
    const stored = window.localStorage.getItem(playRecordKey("sudoku", DATE));
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored ?? "{}")).toEqual(written);

    // And the claim FROZE the clock (#142 step 7, correctness F3): advance
    // the wall clock and hide the tab — the hide-persist path that, with
    // the timer still running, would rewrite the preserved record with an
    // inflated elapsedMs (120 s here). This arm is red without the pause
    // the screen root dispatches when the claim wins.
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
    // The notYet card is gone whole: title, body and its "Jogar" CTA.
    expect(
      screen.queryByText(messages.games.sudoku.conclusion.notYet.title),
    ).toBeNull();
    expect(
      screen.queryByText(messages.games.sudoku.conclusion.notYet.cta),
    ).toBeNull();
    expect(screen.queryByText(messages.conclusion.notYet.body)).toBeNull();
    // NO REPLAY, not even read-only: no link into THIS game's board renders
    // anywhere on the view. (The next-pending CTA may point at ANOTHER
    // game's board — that is the chain, not a replay.)
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

    // The win stamp: `em 4/6` from the server's own count, through the
    // local outcome composers.
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
    // The distribution rendered from the SAME fetch — today's row is the
    // server's value, and exactly ONE credentialed GET /stats fired (the
    // lifted call: the stamp and the block share it).
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
    // The TermoDoneLink rule: `todayTermoGuesses` describes `stats.date`,
    // not this screen — a mismatched day may not caption the stamp.
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

    // And a null count on a matching day: the value can be null even when
    // the dates agree — label-only again, claiming nothing false.
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

    // The claim IS the gate — a server claim is strictly stronger evidence
    // than `syncOutcome === "recorded"`, which only ever proved the row is
    // on the server. The block renders the fetched values.
    expect(await screen.findByText(formatElapsed(300_000))).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByLabelText(messages.conclusion.streak.aria(3)),
      ).toBeInTheDocument();
    });
    // And no sync line: those strings name a DEVICE fact about the queue,
    // which this view has no business claiming.
    expect(screen.queryByText(messages.conclusion.sync.pending)).toBeNull();
    expect(screen.queryByText(messages.conclusion.sync.rejected)).toBeNull();
  });
});

describe("the remote swap announces itself — ADR-0043 decision 10's live region (T-WEB-S282)", () => {
  it("carries the completed sentence over a mid-play swap, and the played one on a loss", async () => {
    // The mid-play swap is the announcer's own case: ADR-0065 decision 6
    // lets a poll tick replace an ACTIVE board with this view, focus falls
    // to <body> on an in-place swap, and the role="status" region is the
    // only account a blind player gets of why the board vanished — the
    // exact gap ADR-0043 decision 10 closed for the local conclusion.
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

    // The played shape announces the loss sentence, never the win's.
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
