import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  dailyBinairoResponseSchema,
  type DailyBinairoResponse,
} from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { generateBinairo } from "@miolos/games/binairo";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { messages } from "../src/i18n";

// T-WEB-1..4b and T-WEB-23 (plan 017 §15). Both page shells are async
// server components, which @testing-library/react cannot render — so they
// are invoked as plain functions and asserted on the element they return,
// plus a renderToStaticMarkup leak scan. All composition lives in the
// synchronous components, which their own suites render directly.
//
// No PGlite anywhere in apps/web (D33): `vitest.config.ts` forces jsdom for
// every file, and re-proving the wall from here would prove nothing about
// apps/web. The wall's behaviour is pinned by packages/db's own suite.

const PUZZLE = generateBinairo({ seed: 20_260_730, weekday: 3 });

const DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: "2026-07-30",
  size: 8,
  givens: [...PUZZLE.givens],
};

// `vi.mock` factories are hoisted above every const in the file, so the
// spies have to be hoisted with them.
const spies = vi.hoisted(() => ({
  // The db handle never leaves the mocked seam, so its shape is irrelevant —
  // what matters is that `getDb` is the ONLY way a page reaches a database.
  stubDb: {},
  getDb: vi.fn(),
  getTodayDaily: vi.fn(),
  getPublishedDaily: vi.fn(),
  createDb: vi.fn(),
  eq: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));

// Every other export of the root entry is a spy asserted never called
// (T-WEB-4): the wall is only a wall if it is the ONLY door apps/web uses.
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

/**
 * Reach a returned element's props without a cast: React elements are
 * plain objects, so a schema is enough and the repo's no-`as`-in-tests rule
 * is kept.
 */
const elementSchema = z.object({
  props: z.record(z.string(), z.unknown()),
});

async function loadPages() {
  const play = await import("../app/binairo/page");
  const conclusion = await import("../app/binairo/concluido/page");
  return { play, conclusion };
}

beforeEach(() => {
  vi.clearAllMocks();
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("route segment configuration (T-WEB-1, T-WEB-2)", () => {
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
});

describe("/binairo (T-WEB-3)", () => {
  it("renders the pt-BR unavailable screen when nothing is published", async () => {
    spies.getTodayDaily.mockResolvedValue(undefined);
    const { play } = await loadPages();

    const markup = renderToStaticMarkup(await play.default());

    expect(markup).toContain(messages.games.binairo.play.unavailable.title);
    expect(markup).toContain(messages.games.binairo.play.unavailable.cta);
  });

  it("passes the wall's projection and nothing else across the RSC boundary", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = elementSchema.parse(await play.default());

    // A strict schema: any extra key on the props object fails the parse,
    // which is the exact-key-set assertion D4 asks for.
    expect(dailyBinairoResponseSchema.parse(element.props.daily)).toEqual(
      DAILY,
    );
    expect(Object.keys(element.props).toSorted()).toEqual(["daily"]);
  });

  it("leaks no solution-adjacent key into the RSC payload or the markup", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = await play.default();
    // Flight serializes EVERY prop crossing into a client component,
    // including values never rendered — so the props object is what the
    // scan has to cover, not only the markup.
    const keys = collectKeys(elementSchema.parse(element).props);
    const markup = renderToStaticMarkup(element);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
      expect(markup).not.toContain(forbidden);
    }
  });
});

describe("the db surface both pages touch (T-WEB-4)", () => {
  it("reads through the published-predicate helper and nothing else", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play, conclusion } = await loadPages();

    await play.default();
    await conclusion.default();

    expect(spies.getTodayDaily).toHaveBeenCalledTimes(2);
    expect(spies.getTodayDaily).toHaveBeenNthCalledWith(
      1,
      spies.stubDb,
      "binairo",
    );
    expect(spies.getTodayDaily).toHaveBeenNthCalledWith(
      2,
      spies.stubDb,
      "binairo",
    );
    // The credential is acquired through the one seam, never inline.
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
});

describe("/binairo/concluido (T-WEB-4b)", () => {
  it("takes its day from the wall, never from the client clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-05T12:00:00Z"));
    spies.getTodayDaily.mockResolvedValue({ ...DAILY, date: "2026-07-30" });
    const { conclusion } = await loadPages();

    const element = elementSchema.parse(await conclusion.default());

    expect(element.props.date).toBe("2026-07-30");
  });

  it("renders the unavailable screen when there is no server day to look up", async () => {
    spies.getTodayDaily.mockResolvedValue(undefined);
    const { conclusion } = await loadPages();

    const markup = renderToStaticMarkup(await conclusion.default());

    expect(markup).toContain(messages.games.binairo.play.unavailable.title);
  });
});

describe("the server-only guard on src/db.ts (T-WEB-23)", () => {
  it('still carries `import "server-only";` as its first statement', () => {
    // Read as TEXT, never executed: the point is that the guard cannot be
    // deleted silently. Three ESLint bans and the narrowed root @miolos/db
    // entry are compile-time walls, but a `"use client"` module importing
    // `../db` would walk around all of them — `server-only` turns that into
    // a build error (plan 017 D32).
    const source = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "src",
        "db.ts",
      ),
      "utf8",
    );
    const firstStatement = source
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("//"));

    expect(firstStatement).toBe('import "server-only";');
  });
});

describe("the least-privilege credential in src/db.ts (T-WEB-S290)", () => {
  it("reads WEB_DATABASE_URL and carries no fallback to the integration credential", () => {
    // Read as TEXT, never executed, comments stripped first (the T-LINT-S37
    // idiom: a doc block may legitimately name the very token the scan
    // forbids). #59's database grant is only a second enforcement point if
    // the app actually connects as `miolos_web`: a fallback to the
    // integration-managed variable would silently restore the all-tables
    // credential on any env drift, so the ABSENCE asserted below is the
    // ticket's claim, not an accident of spelling.
    const source = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "src",
        "db.ts",
      ),
      "utf8",
    );
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

    expect(code).toContain("process.env.WEB_DATABASE_URL");
    expect(code).not.toMatch(/process\.env\.DATABASE_URL\b/);
  });
});
