import {
  dailyQueensResponseSchema,
  type DailyQueensResponse,
} from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { generateQueens } from "@miolos/games/queens";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { messages } from "../src/i18n";
import { hintedScreen } from "./hinted-screen";

const DATE = "2026-08-01";

const PUZZLE = generateQueens({ seed: 20_260_801, weekday: 6 });

const DAILY: DailyQueensResponse = dailyQueensResponseSchema.parse({
  game: "queens",
  date: DATE,
  size: PUZZLE.size,
  regions: PUZZLE.regions,
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
  const play = await import("../app/rainhas/page");
  const conclusion = await import("../app/rainhas/concluido/page");
  const archive = await import("../app/arquivo/[data]/rainhas/page");
  return { play, conclusion, archive };
}

beforeEach(() => {
  vi.clearAllMocks();
  spies.getDb.mockReturnValue(spies.stubDb);
});

describe("/rainhas (T-WEB-S455)", () => {
  it("is force-dynamic and an async server component", async () => {
    const { play } = await loadPages();
    expect(play.dynamic).toBe("force-dynamic");
    expect(play.default.constructor.name).toBe("AsyncFunction");
  });

  it("renders the unavailable card when nothing is published", async () => {
    spies.getTodayDaily.mockResolvedValue(undefined);
    const { play } = await loadPages();

    const markup = renderToStaticMarkup(await play.default());
    expect(markup).toContain(messages.games.queens.play.unavailable.title);
    expect(markup).toContain(messages.games.queens.play.unavailable.cta);
  });

  it("passes only the size and the region map across the RSC boundary, with no forbidden key", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = elementSchema.parse(hintedScreen(await play.default()));
    expect(dailyQueensResponseSchema.parse(element.props.daily)).toEqual(DAILY);
    expect(Object.keys(element.props).toSorted()).toEqual(["daily"]);

    expect(spies.getTodayDaily).toHaveBeenCalledWith(spies.stubDb, "queens");

    const keys = collectKeys(element.props);
    expect([...collectKeys(element.props.daily)].toSorted()).toEqual([
      "date",
      "game",
      "regions",
      "size",
    ]);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("serves its conclusion page from the same daily envelope", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { conclusion } = await loadPages();
    expect(conclusion.dynamic).toBe("force-dynamic");

    const element = elementSchema.parse(await conclusion.default());
    expect(element.props.game).toBe("queens");
    expect(element.props.date).toBe(DATE);
    expect(element.props.copy).toBe(messages.games.queens.conclusion);
  });
});

describe("/arquivo/[data]/rainhas (T-WEB-S455)", () => {
  it("renders the archived daily's play view when published", async () => {
    spies.getArchivedDaily.mockResolvedValue(DAILY);
    const { archive } = await loadPages();

    const element = elementSchema.parse(
      hintedScreen(
        await archive.default({ params: Promise.resolve({ data: DATE }) }),
      ),
    );
    expect(dailyQueensResponseSchema.parse(element.props.daily)).toEqual(DAILY);
    expect(spies.getArchivedDaily).toHaveBeenCalledWith(
      spies.stubDb,
      "queens",
      DATE,
    );
  });

  it("redirects today's unpublished date home, and 404s any other", async () => {
    spies.getArchivedDaily.mockResolvedValue(undefined);
    spies.archiveDateClass.mockResolvedValue("today");
    const { archive } = await loadPages();

    await expect(
      archive.default({ params: Promise.resolve({ data: DATE }) }),
    ).rejects.toThrow();
    expect(spies.redirect).toHaveBeenCalledWith("/rainhas");

    spies.archiveDateClass.mockResolvedValue("past");
    await expect(
      archive.default({ params: Promise.resolve({ data: DATE }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("declares its own openGraph metadata via the shared archive helper", async () => {
    const { archive } = await loadPages();
    const metadata = await archive.generateMetadata({
      params: Promise.resolve({ data: DATE }),
    });
    expect(metadata.title).toBe(
      messages.archive.meta.gameTitle(
        messages.games.queens.name,
        "1 de agosto de 2026",
      ),
    );
  });
});
