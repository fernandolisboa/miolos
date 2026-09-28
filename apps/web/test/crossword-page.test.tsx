import {
  dailyCrosswordResponseSchema,
  type DailyCrosswordResponse,
} from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { messages } from "../src/i18n";

const DATE = "2026-08-01";

const DAILY: DailyCrosswordResponse = dailyCrosswordResponseSchema.parse({
  game: "crossword",
  date: DATE,
  grid: [
    ["c", "a", "t", null, null],
    ["a", null, "o", null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
  clues: [
    {
      number: 1,
      direction: "across",
      row: 0,
      col: 0,
      length: 3,
      clue: "felino",
    },
    {
      number: 1,
      direction: "down",
      row: 0,
      col: 0,
      length: 2,
      clue: "pronome",
    },
    { number: 2, direction: "down", row: 0, col: 2, length: 2, clue: "verbo" },
  ],
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
  const play = await import("../app/cruzadinha/page");
  const archive = await import("../app/arquivo/[data]/cruzadinha/page");
  return { play, archive };
}

beforeEach(() => {
  vi.clearAllMocks();
  spies.getDb.mockReturnValue(spies.stubDb);
});

describe("/cruzadinha (T-WEB-S429)", () => {
  it("is force-dynamic and an async server component", async () => {
    const { play } = await loadPages();
    expect(play.dynamic).toBe("force-dynamic");
    expect(play.default.constructor.name).toBe("AsyncFunction");
  });

  it("renders the unavailable card when nothing is published", async () => {
    spies.getTodayDaily.mockResolvedValue(undefined);
    const { play } = await loadPages();

    const markup = renderToStaticMarkup(await play.default());
    expect(markup).toContain(messages.games.crossword.play.unavailable.title);
    expect(markup).toContain(messages.games.crossword.play.unavailable.cta);
  });

  it("passes the shipped grid and clues across the RSC boundary, with no forbidden key", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = elementSchema.parse(await play.default());
    expect(dailyCrosswordResponseSchema.parse(element.props.daily)).toEqual(
      DAILY,
    );
    expect(Object.keys(element.props).toSorted()).toEqual(["daily"]);

    expect(spies.getTodayDaily).toHaveBeenCalledWith(spies.stubDb, "crossword");

    const keys = collectKeys(element.props);
    expect(keys.has("grid")).toBe(true);
    expect(keys.has("clues")).toBe(true);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });
});

describe("/arquivo/[data]/cruzadinha (T-WEB-S429)", () => {
  it("renders the archived daily's play view when published", async () => {
    spies.getArchivedDaily.mockResolvedValue(DAILY);
    const { archive } = await loadPages();

    const element = elementSchema.parse(
      await archive.default({ params: Promise.resolve({ data: DATE }) }),
    );
    expect(dailyCrosswordResponseSchema.parse(element.props.daily)).toEqual(
      DAILY,
    );
    expect(spies.getArchivedDaily).toHaveBeenCalledWith(
      spies.stubDb,
      "crossword",
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
    expect(spies.redirect).toHaveBeenCalledWith("/cruzadinha");

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
        messages.games.crossword.name,
        "1 de agosto de 2026",
      ),
    );
  });
});
