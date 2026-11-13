import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";

import { routes } from "../src/i18n";

vi.mock("../src/db", () => ({ getDb: () => ({}) }));
vi.mock("@miolos/db", () => ({ listArchivedDays: () => Promise.resolve([]) }));

const ORIGIN = "https://miolos.example";
vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGIN);

const { default: sitemap } = await import("../app/sitemap");

const PAGES: Readonly<Record<string, { metadata: Metadata }>> = {
  [routes.home]: await import("../app/page"),
  [routes.freePlay]: await import("../app/modo-livre/page"),
  [routes.freePlayBinairo]: await import("../app/modo-livre/binairo/page"),
  [routes.freePlaySudoku]: await import("../app/modo-livre/sudoku/page"),
  [routes.freePlayNonogram]: await import("../app/modo-livre/nonogram/page"),
  [routes.freePlayTermo]: await import("../app/modo-livre/termo/page"),
  [routes.freePlayCrossword]: await import("../app/modo-livre/cruzadinha/page"),
  [routes.freePlayQueens]: await import("../app/modo-livre/rainhas/page"),
  [routes.freePlayMinesweeper]:
    await import("../app/modo-livre/campo-minado/page"),
  [routes.privacy]: await import("../app/privacidade/page"),
  [routes.terms]: await import("../app/termos/page"),
};

describe("every page the sitemap lists outside the archive names itself canonical (T-WEB-S1113)", () => {
  it("the page map is exactly the sitemap's fixed entries", async () => {
    const fixed = (await sitemap())
      .map((entry) => entry.url.slice(ORIGIN.length))
      .filter((path) => !path.startsWith(routes.archive));
    expect(Object.keys(PAGES).sort()).toEqual(fixed.sort());
  });

  it("each declares its own route, so www and query-string copies fold into it", () => {
    for (const [route, page] of Object.entries(PAGES)) {
      expect(page.metadata.alternates?.canonical, route).toBe(route);
    }
  });
});
