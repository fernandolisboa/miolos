import {
  statsResponseSchema,
  type AttachStateResponse,
  type MedalsResponse,
  type StatsCalendarResponse,
  type StatsResponse,
  type StreakResponse,
} from "@miolos/core";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import { useAttachState } from "../src/attach/use-attach-state";
import { useMedals } from "../src/medals/use-medals";
import { useStats } from "../src/stats/use-stats";
import { useStatsCalendar } from "../src/stats/use-stats-calendar";
import { useStreak } from "../src/streak/use-streak";

//

//

const ATTACH: AttachStateResponse = { eligible: true };
const STREAK: StreakResponse = {
  date: "2026-08-22",
  streak: 7,
  todayCounts: true,
};
const MEDALS: MedalsResponse = { medals: ["founder"] };

const STATS: StatsResponse = statsResponseSchema.parse({
  date: "2026-08-22",
  binairo: {
    solved: 1,
    bestMs: 238_000,
    averageMs: 238_000,
    averageSampleCount: 1,
    histogram: [1, 0, 0, 0, 0, 0],
  },
  sudoku: {
    solved: 0,
    bestMs: null,
    averageMs: null,
    averageSampleCount: 0,
    histogram: [0, 0, 0, 0, 0, 0],
  },
  nonogram: {
    solved: 0,
    bestMs: null,
    averageMs: null,
    averageSampleCount: 0,
    histogram: [0, 0, 0, 0, 0, 0],
  },
  termo: { solved: 0, distribution: [0, 0, 0, 0, 0, 0, 0] },
  perfectDays: 0,
  todayTermoGuesses: null,
});
const CALENDAR: StatsCalendarResponse = {
  days: [{ date: "2026-08-22", state: "onTime", perfect: false }],
};

const clients = vi.hoisted(() => ({
  fetchAttachState: vi.fn(),
  fetchStreak: vi.fn(),
  fetchMedals: vi.fn(),
  fetchStats: vi.fn(),
  fetchStatsCalendar: vi.fn(),
}));
vi.mock("../src/attach/attach-client", () => ({
  fetchAttachState: clients.fetchAttachState,
}));
vi.mock("../src/streak/streak-client", () => ({
  fetchStreak: clients.fetchStreak,
}));
vi.mock("../src/medals/medals-client", () => ({
  fetchMedals: clients.fetchMedals,
}));
vi.mock("../src/stats/stats-client", () => ({
  fetchStats: clients.fetchStats,
  fetchStatsCalendar: clients.fetchStatsCalendar,
}));

const bootstrapMock = vi.hoisted(() => ({
  ensureSession: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("../src/session/bootstrap", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/session/bootstrap")>();
  return { ...actual, ensureSession: bootstrapMock.ensureSession };
});

beforeEach(() => {
  bootstrapMock.ensureSession.mockReset();
  bootstrapMock.ensureSession.mockImplementation(() => Promise.resolve());
  clients.fetchAttachState.mockReset();
  clients.fetchAttachState.mockResolvedValue(ATTACH);
  clients.fetchStreak.mockReset();
  clients.fetchStreak.mockResolvedValue(STREAK);
  clients.fetchMedals.mockReset();
  clients.fetchMedals.mockResolvedValue(MEDALS);
  clients.fetchStats.mockReset();
  clients.fetchStats.mockResolvedValue(STATS);
  clients.fetchStatsCalendar.mockReset();
  clients.fetchStatsCalendar.mockResolvedValue(CALENDAR);
});

async function assertAwaitsTheMint<T>(
  useHook: () => T | null | undefined,
  read: Mock,
  settled: T,
): Promise<void> {
  let releaseMint = (): void => undefined;
  bootstrapMock.ensureSession.mockReturnValue(
    new Promise<void>((resolve) => {
      releaseMint = resolve;
    }),
  );

  const { result } = renderHook(() => useHook());
  await waitFor(() => {
    expect(bootstrapMock.ensureSession).toHaveBeenCalled();
  });

  expect(read).not.toHaveBeenCalled();
  expect(result.current).toBeUndefined();

  releaseMint();
  await waitFor(() => {
    expect(result.current).toEqual(settled);
  });
  expect(read).toHaveBeenCalledTimes(1);
}

describe("useAttachState awaits the mint before it reads (T-WEB-S339)", () => {
  it("GET /attach/state is not issued until ensureSession resolves — on a re-mint load the eligible player's prompt would otherwise 401 away for the whole load", async () => {
    await assertAwaitsTheMint(useAttachState, clients.fetchAttachState, ATTACH);
  });
});

describe("useStreak awaits the mint before it reads (T-WEB-S340)", () => {
  it("GET /streak is not issued until ensureSession resolves — the hub stamp would otherwise read 0 on a re-mint load, which is a false claim about a real streak", async () => {
    await assertAwaitsTheMint(useStreak, clients.fetchStreak, STREAK);
  });
});

describe("useMedals awaits the mint before it reads (T-WEB-S341)", () => {
  it("GET /medals is not issued until ensureSession resolves — the medals section would otherwise stay empty on a re-mint load", async () => {
    await assertAwaitsTheMint(useMedals, clients.fetchMedals, MEDALS);
  });
});

describe("useStats and useStatsCalendar await the mint before they read (T-WEB-S342)", () => {
  it("neither GET /stats nor GET /stats/calendar is issued until ensureSession resolves — one claim over two hooks, since use-stats-calendar.ts is use-stats.ts's twin over the same client module", async () => {
    await assertAwaitsTheMint(useStats, clients.fetchStats, STATS);
    await assertAwaitsTheMint(
      useStatsCalendar,
      clients.fetchStatsCalendar,
      CALENDAR,
    );
  });
});
