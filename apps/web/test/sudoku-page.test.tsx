import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { messages } from "../src/i18n";

const PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: "2026-08-01",
  givens: PUZZLE.givens,
  tier: PUZZLE.tier,
});

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  getTodayDaily: vi.fn(),
  getPublishedDaily: vi.fn(),
  createDb: vi.fn(),
  eq: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));

vi.mock("@miolos/db", () => ({
  getTodayDaily: spies.getTodayDaily,
  getPublishedDaily: spies.getPublishedDaily,
  createDb: spies.createDb,
  eq: spies.eq,
  sql: spies.sql,
  SAO_PAULO_TIME_ZONE: "America/Sao_Paulo",
  sessions: {},
  users: {},
}));

const elementSchema = z.object({
  props: z.record(z.string(), z.unknown()),
});

async function loadPages() {
  const play = await import("../app/sudoku/page");
  const conclusion = await import("../app/sudoku/concluido/page");
  return { play, conclusion };
}

beforeEach(() => {
  vi.clearAllMocks();
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("route segment configuration (T-WEB-S21)", () => {
  it("both segments are force-dynamic: a cached page would serve yesterday's puzzle", async () => {
    const { play, conclusion } = await loadPages();

    expect(play.dynamic).toBe("force-dynamic");
    expect(conclusion.dynamic).toBe("force-dynamic");
  });

  it("both segments are async server components, so the export is meaningful", async () => {
    const { play, conclusion } = await loadPages();

    expect(play.default.constructor.name).toBe("AsyncFunction");
    expect(conclusion.default.constructor.name).toBe("AsyncFunction");
  });

  it("renders SUDOKU's unavailable copy when nothing is published", async () => {
    spies.getTodayDaily.mockResolvedValue(undefined);
    const { play, conclusion } = await loadPages();

    const playMarkup = renderToStaticMarkup(await play.default());
    const conclusionMarkup = renderToStaticMarkup(await conclusion.default());

    for (const markup of [playMarkup, conclusionMarkup]) {
      expect(markup).toContain(messages.games.sudoku.play.unavailable.title);
      expect(markup).toContain(messages.games.sudoku.play.unavailable.cta);

      expect(markup).not.toContain(
        messages.games.binairo.play.unavailable.title,
      );
    }
  });
});

describe("/sudoku (T-WEB-S22, T-WEB-S24)", () => {
  it("passes the wall's projection and nothing else across the RSC boundary", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = elementSchema.parse(await play.default());

    expect(dailySudokuResponseSchema.parse(element.props.daily)).toEqual(DAILY);
    expect(Object.keys(element.props).toSorted()).toEqual(["daily"]);

    expect(
      Object.keys(dailySudokuResponseSchema.parse(element.props.daily)),
    ).toEqual(expect.arrayContaining(["game", "date", "givens", "tier"]));
    expect(
      Object.keys(dailySudokuResponseSchema.parse(element.props.daily)),
    ).toHaveLength(4);
  });

  it("asks the wall for sudoku, and the screen receives a sudoku response", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = elementSchema.parse(await play.default());

    expect(spies.getTodayDaily).toHaveBeenCalledWith(spies.stubDb, "sudoku");
    expect(dailySudokuResponseSchema.parse(element.props.daily).game).toBe(
      "sudoku",
    );
  });

  it("leaks no solution-adjacent key into the RSC payload or the markup", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = await play.default();

    const keys = collectKeys(elementSchema.parse(element).props);
    const markup = renderToStaticMarkup(element);

    expect(keys.has("givens")).toBe(true);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
      expect(markup).not.toContain(forbidden);
    }
  });
});

describe("the db surface both pages touch (T-WEB-S23)", () => {
  it("reads through the published-predicate helper and nothing else", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play, conclusion } = await loadPages();

    await play.default();
    await conclusion.default();

    expect(spies.getTodayDaily).toHaveBeenCalledTimes(2);
    expect(spies.getTodayDaily).toHaveBeenNthCalledWith(
      1,
      spies.stubDb,
      "sudoku",
    );
    expect(spies.getTodayDaily).toHaveBeenNthCalledWith(
      2,
      spies.stubDb,
      "sudoku",
    );

    expect(spies.getDb).toHaveBeenCalledTimes(2);
    for (const spy of [
      spies.createDb,
      spies.getPublishedDaily,
      spies.eq,
      spies.sql,
    ]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("takes the conclusion's day from the wall, never from the client clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-05T12:00:00Z"));
    spies.getTodayDaily.mockResolvedValue({ ...DAILY, date: "2026-07-30" });
    const { conclusion } = await loadPages();

    const element = elementSchema.parse(await conclusion.default());

    expect(element.props.date).toBe("2026-07-30");
    expect(element.props.game).toBe("sudoku");
  });
});
