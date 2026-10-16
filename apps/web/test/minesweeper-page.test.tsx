import {
  dailyMinesweeperResponseSchema,
  type DailyMinesweeperResponse,
} from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { generateMinesweeperDaily } from "@miolos/games/minesweeper";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { messages } from "../src/i18n";

const DATE = "2026-10-16";

const PUZZLE = generateMinesweeperDaily({ seed: 20_261_016, weekday: 5 });

const DAILY: DailyMinesweeperResponse = dailyMinesweeperResponseSchema.parse({
  game: "minesweeper",
  date: DATE,
  rows: PUZZLE.rows,
  columns: PUZZLE.columns,
  mines: PUZZLE.mines,
  start: PUZZLE.start,
});

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  getTodayDaily: vi.fn(),
  getArchivedDaily: vi.fn(),
  archiveDateClass: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({
  getTodayDaily: spies.getTodayDaily,
  getArchivedDaily: spies.getArchivedDaily,
  archiveDateClass: spies.archiveDateClass,
}));
vi.mock("next/navigation", () => ({
  notFound: spies.notFound,
  redirect: spies.redirect,
}));

const elementSchema = z.object({
  props: z.record(z.string(), z.unknown()),
});

async function loadPages() {
  const play = await import("../app/campo-minado/page");
  const conclusion = await import("../app/campo-minado/concluido/page");
  const archive = await import("../app/arquivo/[data]/campo-minado/page");
  return { play, conclusion, archive };
}

beforeEach(() => {
  vi.clearAllMocks();
  spies.getDb.mockReturnValue(spies.stubDb);
});

describe("the Campo Minado routes hand today's field across the RSC boundary and nothing else (T-WEB-S923a)", () => {
  it("/campo-minado is force-dynamic and renders the unavailable card when nothing is published", async () => {
    spies.getTodayDaily.mockResolvedValue(undefined);
    const { play } = await loadPages();

    expect(play.dynamic).toBe("force-dynamic");
    const markup = renderToStaticMarkup(await play.default());
    expect(markup).toContain(messages.games.minesweeper.play.unavailable.title);
    expect(markup).toContain(messages.games.minesweeper.play.unavailable.cta);
  });

  it("passes only the projection, with no forbidden key and no hint allowance", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = elementSchema.parse(await play.default());
    expect(Object.keys(element.props).toSorted()).toEqual(["daily"]);
    expect(dailyMinesweeperResponseSchema.parse(element.props.daily)).toEqual(
      DAILY,
    );
    expect(spies.getTodayDaily).toHaveBeenCalledWith(
      spies.stubDb,
      "minesweeper",
    );
    expect([...collectKeys(element.props.daily)].toSorted()).toEqual([
      "columns",
      "date",
      "game",
      "mines",
      "rows",
      "start",
    ]);
    const keys = collectKeys(element.props);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("serves the conclusion from the same envelope", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { conclusion } = await loadPages();

    expect(conclusion.dynamic).toBe("force-dynamic");
    const element = elementSchema.parse(await conclusion.default());
    expect(element.props.daily).toEqual(DAILY);
  });

  it("/arquivo/[data]/campo-minado plays the archived field, redirects today home and 404s the rest", async () => {
    spies.getArchivedDaily.mockResolvedValue(DAILY);
    const { archive } = await loadPages();
    const params = { params: Promise.resolve({ data: DATE }) };

    const element = elementSchema.parse(await archive.default(params));
    expect(element.props.daily).toEqual(DAILY);
    expect(spies.getArchivedDaily).toHaveBeenCalledWith(
      spies.stubDb,
      "minesweeper",
      DATE,
    );

    spies.getArchivedDaily.mockResolvedValue(undefined);
    spies.archiveDateClass.mockResolvedValue("today");
    await expect(archive.default(params)).rejects.toThrow();
    expect(spies.redirect).toHaveBeenCalledWith("/campo-minado");
    spies.archiveDateClass.mockResolvedValue("past");
    await expect(archive.default(params)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
