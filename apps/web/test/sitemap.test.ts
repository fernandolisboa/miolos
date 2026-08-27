import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routes } from "../src/i18n";

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  listArchivedDays: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({ listArchivedDays: spies.listArchivedDays }));

const { default: sitemap } = await import("../app/sitemap");
const { default: robots } = await import("../app/robots");

const ORIGIN = "https://miolos.example";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGIN);
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

async function paths(): Promise<string[]> {
  const entries = await sitemap();
  return entries.map((entry) => {
    expect(entry.url.startsWith(`${ORIGIN}/`)).toBe(true);
    return entry.url.slice(ORIGIN.length);
  });
}

describe("the sitemap (T-WEB-S174)", () => {
  it("enumerates every archived date's day page and every (date, game) play page", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-08-02", game: "binairo" },
      { date: "2026-08-02", game: "sudoku" },
      { date: "2026-07-31", game: "binairo" },
    ]);

    expect(await paths()).toEqual([
      "/",
      "/modo-livre",
      "/modo-livre/binairo",
      "/modo-livre/sudoku",
      "/modo-livre/nonogram",
      "/privacidade",
      "/termos",
      "/arquivo",
      "/arquivo/mes/2026-08",
      "/arquivo/mes/2026-07",
      "/arquivo/2026-08-02",
      "/arquivo/2026-08-02/binairo",
      "/arquivo/2026-08-02/sudoku",
      "/arquivo/2026-07-31",
      "/arquivo/2026-07-31/binairo",
    ]);
    expect(spies.listArchivedDays).toHaveBeenCalledWith(spies.stubDb);
  });

  it("nothing date-bearing enters except through the reader — the WALL excludes a future date, not a filter", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2099-01-01", game: "termo" },
    ]);
    expect(await paths()).toContain("/arquivo/2099-01-01/termo");

    spies.listArchivedDays.mockResolvedValue([]);
    expect((await paths()).filter((path) => /\d{4}-\d{2}/.test(path))).toEqual(
      [],
    );
  });

  it("the daily play routes, their conclusions, /estatisticas and /vincular are absent", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-08-02", game: "termo" },
    ]);
    const listed = await paths();
    for (const absent of [
      routes.binairo,
      routes.binairoConclusion,
      routes.sudoku,
      routes.sudokuConclusion,
      routes.nonogram,
      routes.nonogramConclusion,
      routes.termo,
      routes.termoConclusion,
      routes.stats,
      routes.attach,
    ]) {
      expect(listed).not.toContain(absent);
    }
  });

  it("every URL is ABSOLUTE against the app's one origin", async () => {
    spies.listArchivedDays.mockResolvedValue([]);
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(() => new URL(entry.url)).not.toThrow();
      expect(new URL(entry.url).origin).toBe(ORIGIN);
    }
  });
});

describe("robots.ts (T-WEB-S175)", () => {
  it("allows all, disallows /vincular, and points at the sitemap", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: [routes.attach] },
      sitemap: `${ORIGIN}/sitemap.xml`,
    });
  });

  it("the daily play routes and /estatisticas are crawlable but unlisted — absence from a sitemap is NOT noindex", async () => {
    const disallow = robots().rules;
    expect(Array.isArray(disallow)).toBe(false);
    expect(JSON.stringify(robots())).not.toContain(routes.stats);
    for (const route of [routes.binairo, routes.sudoku, routes.termo]) {
      expect(JSON.stringify(robots())).not.toContain(`"${route}"`);
    }

    spies.listArchivedDays.mockResolvedValue([]);
    expect(await paths()).not.toContain(routes.stats);
  });
});
