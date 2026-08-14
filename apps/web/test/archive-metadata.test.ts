import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatLongDate, formatMonth, messages } from "../src/i18n";

// Every archive route's metadata (#31 AC 1, ADR-0053 decision 1 / plan 037
// D6). Titles and descriptions are DISTINCT across dates and across games —
// which is what stops ~5 near-identical board pages a day from being thin
// duplicates — and every canonical is self-referential.

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  listArchivedDays: vi.fn(),
  listArchivedMonths: vi.fn(),
  archiveDateClass: vi.fn(),
  getArchivedDaily: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));
vi.mock("@miolos/db", () => ({
  listArchivedDays: spies.listArchivedDays,
  listArchivedMonths: spies.listArchivedMonths,
  archiveDateClass: spies.archiveDateClass,
  getArchivedDaily: spies.getArchivedDaily,
}));
vi.mock("next/navigation", () => ({
  notFound: spies.notFound,
  redirect: spies.redirect,
}));

const index = await import("../app/arquivo/page");
const month = await import("../app/arquivo/mes/[mes]/page");
const day = await import("../app/arquivo/[data]/page");

beforeEach(() => {
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("archive metadata (T-WEB-S173)", () => {
  it("every route composes its title and description from messages.archive, with a SELF-REFERENTIAL canonical", async () => {
    expect(index.generateMetadata()).toEqual({
      title: messages.archive.meta.indexTitle,
      description: messages.archive.meta.indexDescription,
      alternates: { canonical: "/arquivo" },
    });

    expect(
      await month.generateMetadata({
        params: Promise.resolve({ mes: "2026-08" }),
      }),
    ).toEqual({
      title: messages.archive.meta.monthTitle(formatMonth("2026-08-01")),
      description: messages.archive.meta.monthDescription(
        formatMonth("2026-08-01"),
      ),
      alternates: { canonical: "/arquivo/mes/2026-08" },
    });

    expect(
      await day.generateMetadata({
        params: Promise.resolve({ data: "2026-08-03" }),
      }),
    ).toEqual({
      title: messages.archive.meta.dayTitle(formatLongDate("2026-08-03")),
      description: messages.archive.meta.dayDescription(
        formatLongDate("2026-08-03"),
      ),
      alternates: { canonical: "/arquivo/2026-08-03" },
    });
  });

  it("titles and descriptions are DISTINCT across dates and across months", async () => {
    const titles = new Set<unknown>();
    const descriptions = new Set<unknown>();
    for (const data of ["2026-08-01", "2026-08-02", "2026-08-03"]) {
      const metadata = await day.generateMetadata({
        params: Promise.resolve({ data }),
      });
      titles.add(metadata.title);
      descriptions.add(metadata.description);
    }
    for (const mes of ["2026-07", "2026-08"]) {
      const metadata = await month.generateMetadata({
        params: Promise.resolve({ mes }),
      });
      titles.add(metadata.title);
      descriptions.add(metadata.description);
    }
    titles.add(index.generateMetadata().title);
    descriptions.add(index.generateMetadata().description);

    expect(titles.size).toBe(6);
    expect(descriptions.size).toBe(6);
  });

  it("a HOSTILE segment yields robots.index false, no alternates, and never an off-origin URL", async () => {
    const hostile = [
      "//evil.example.com",
      "https://evil.example.com",
      "..%2F..%2Fetc",
      "2026-08-03/../../evil",
      // Year zero: shape-valid, calendar-invalid, and a Postgres 22008 at the
      // reader if it ever got past the parser (step-6 F2). Refused here too,
      // so `generateMetadata` composes no canonical for it either.
      "0000-01",
      "0000-01-01",
    ];
    for (const raw of hostile) {
      const asMonth = await month.generateMetadata({
        params: Promise.resolve({ mes: raw }),
      });
      const asDay = await day.generateMetadata({
        params: Promise.resolve({ data: raw }),
      });
      for (const metadata of [asMonth, asDay]) {
        expect(metadata.alternates).toBeUndefined();
        expect(metadata.robots).toEqual({ index: false });
        // Nothing attacker-controlled is reflected into the title either.
        expect(JSON.stringify(metadata)).not.toContain("evil.example.com");
      }
    }
  });

  it("no metadata function carries a string literal — every string comes from messages.archive", () => {
    // ADR-0018 :15 applies to `generateMetadata` exactly as it applies to a
    // component: the composers live in `messages.ts`, and a title assembled
    // here would be copy outside the migration contract.
    for (const file of [
      join("app", "arquivo", "page.tsx"),
      join("app", "arquivo", "mes", "[mes]", "page.tsx"),
      join("app", "arquivo", "[data]", "page.tsx"),
    ]) {
      const source = readFileSync(
        join(import.meta.dirname, "..", file),
        "utf8",
      );
      const body = source.slice(source.indexOf("generateMetadata"));
      const metadataBlock = body.slice(0, body.indexOf("\n}\n") + 3);
      // Anti-vacuity: the slice really is the metadata function's body, so
      // an empty match list below means "no literals", not "no text".
      expect(metadataBlock).toContain("canonical");
      // Only the Metadata KEYS may appear here; a pt-BR sentence or a path
      // fragment would show up as quoted text.
      const literals = [...metadataBlock.matchAll(/(["'])(?:(?!\1).){2,}\1/g)];
      expect(literals.map((match) => match[0])).toEqual([]);
    }
  });
});
