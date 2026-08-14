import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { routes } from "../src/i18n";

// The sitemap and the crawl posture (#31 AC 1, ADR-0004, ADR-0053). The
// sitemap's ADR-0004 compliance is STRUCTURAL rather than procedural: the
// only source of a date-bearing URL is `listArchivedDays()`, which carries
// the publication wall AND `date < the DB clock's São Paulo day` in SQL, so
// a future-dated URL is never PRODUCED — not produced and then filtered.

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

/** Every path in the sitemap, origin stripped. */
async function paths(): Promise<string[]> {
  const entries = await sitemap();
  return entries.map((entry) => {
    expect(entry.url.startsWith(`${ORIGIN}/`)).toBe(true);
    return entry.url.slice(ORIGIN.length);
  });
}

describe("the sitemap (T-WEB-S174)", () => {
  it("T-WEB-S174: enumerates every archived date's day page and every (date, game) play page", async () => {
    spies.listArchivedDays.mockResolvedValue([
      { date: "2026-08-02", game: "binairo" },
      { date: "2026-08-02", game: "sudoku" },
      { date: "2026-07-31", game: "binairo" },
    ]);

    // The sitemap is the ONE unbounded read: no `limit`, no range.
    expect(await paths()).toEqual([
      "/",
      "/modo-livre",
      "/modo-livre/binairo",
      "/modo-livre/sudoku",
      "/modo-livre/nonogram",
      "/privacidade",
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

  it("T-WEB-S174: nothing date-bearing enters except through the reader — the WALL excludes a future date, not a filter", async () => {
    // The reader is mocked to do something it cannot actually do: return a
    // future date. The sitemap emits it, and that is the POINT — it proves
    // the sitemap adds no filter of its own, so the only thing keeping a
    // future URL out is the reader's SQL, which is where ADR-0004 puts it.
    // A sitemap that filtered here would be a second enforcement point,
    // exactly what ADR-0014 :16 exists to prevent.
    spies.listArchivedDays.mockResolvedValue([
      { date: "2099-01-01", game: "termo" },
    ]);
    expect(await paths()).toContain("/arquivo/2099-01-01/termo");

    // And with the reader empty, NO date-bearing URL exists at all.
    spies.listArchivedDays.mockResolvedValue([]);
    expect((await paths()).filter((path) => /\d{4}-\d{2}/.test(path))).toEqual(
      [],
    );
  });

  it("T-WEB-S174: the daily play routes, their conclusions, /estatisticas and /vincular are absent", async () => {
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

  it("T-WEB-S174: every URL is ABSOLUTE against the app's one origin", async () => {
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
  it("T-WEB-S175: allows all, disallows /vincular, and points at the sitemap", () => {
    expect(robots()).toEqual({
      rules: { userAgent: "*", allow: "/", disallow: [routes.attach] },
      sitemap: `${ORIGIN}/sitemap.xml`,
    });
  });

  it("T-WEB-S175: the daily play routes and /estatisticas are crawlable but unlisted — absence from a sitemap is NOT noindex", async () => {
    // The assertion this test exists for: nothing in `robots.ts` marks the
    // unlisted surfaces `noindex`. They are simply not an SEO surface worth a
    // sitemap slot (ADR-0028 :28-30), not secrets — and if either should
    // genuinely leave the index, the instrument is that route's own metadata.
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
