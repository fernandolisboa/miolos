import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
} from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { generateNonogram } from "@miolos/games/nonogram";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { messages } from "../src/i18n";

// T-WEB-S53, T-WEB-S54 (plan 020 §19). Both page shells are async server
// components, which @testing-library/react cannot render — so they are invoked
// as plain functions and asserted on the element they return, plus a
// renderToStaticMarkup leak scan. All composition lives in the synchronous
// components, which `nonogram-screen.test.tsx` renders directly.
//
// No PGlite anywhere in apps/web: `vitest.config.ts` forces jsdom for every
// file, and re-proving the wall from here would prove nothing about apps/web.
// The wall's behaviour is pinned by packages/db's own suite.

/** Weekday 1 is the 5×5 class — 0.0354 ms to generate and validate. */
const PUZZLE = generateNonogram(20_260_801, 1);

/**
 * The daily the wall would project: parsed through the response schema, never
 * cast. The schema is a strict four-key object, so it is also what proves the
 * reveal is not on it (ADR-0033).
 */
const DAILY: DailyNonogramResponse = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: "2026-08-01",
  size: PUZZLE.size,
  clues: PUZZLE.clues,
});

// `vi.mock` factories are hoisted above every const in the file, so the spies
// have to be hoisted with them.
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

// Every other export of the root entry is a spy asserted never called: the wall
// is only a wall if it is the ONLY door apps/web uses.
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
 * Reach a returned element's props without a cast: React elements are plain
 * objects, so a schema is enough and the repo's no-`as`-in-tests rule is kept.
 */
const elementSchema = z.object({
  props: z.record(z.string(), z.unknown()),
});

async function loadPages() {
  const play = await import("../app/nonogram/page");
  const conclusion = await import("../app/nonogram/concluido/page");
  return { play, conclusion };
}

beforeEach(() => {
  vi.clearAllMocks();
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("route segment configuration (T-WEB-S53)", () => {
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

  it("renders NONOGRAM's unavailable copy when nothing is published", async () => {
    spies.getTodayDaily.mockResolvedValue(undefined);
    const { play, conclusion } = await loadPages();

    const playMarkup = renderToStaticMarkup(await play.default());
    const conclusionMarkup = renderToStaticMarkup(await conclusion.default());

    for (const markup of [playMarkup, conclusionMarkup]) {
      expect(markup).toContain(messages.games.nonogram.play.unavailable.title);
      expect(markup).toContain(messages.games.nonogram.play.unavailable.cta);
      // The screen takes its copy as a prop, so the wrong game's block
      // reaching it is a real failure mode.
      expect(markup).not.toContain(
        messages.games.sudoku.play.unavailable.title,
      );
    }
  });
});

describe("/nonogram (T-WEB-S53)", () => {
  it("passes the wall's projection and nothing else across the RSC boundary", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = elementSchema.parse(await play.default());

    // A strict schema: any extra key on the daily fails the parse, which is
    // the exact-key-set assertion ADR-0033 asks for.
    expect(dailyNonogramResponseSchema.parse(element.props.daily)).toEqual(
      DAILY,
    );
    expect(Object.keys(element.props).toSorted()).toEqual(["daily"]);
    // Spelled out as well as parsed: the strip table's nonogram row is
    // `game, date, size, clues` and nothing else — no `reveal`, in any form.
    expect(
      Object.keys(
        dailyNonogramResponseSchema.parse(element.props.daily),
      ).toSorted(),
    ).toEqual(["clues", "date", "game", "size"]);
  });

  it("asks the wall for nonogram, and the screen receives a nonogram response", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = elementSchema.parse(await play.default());

    // The generic narrowing at the consumer (plan 018 S11): `getTodayDaily(db,
    // "nonogram")` is typed to return the nonogram member, and this is the
    // runtime half of that claim.
    expect(spies.getTodayDaily).toHaveBeenCalledWith(spies.stubDb, "nonogram");
    expect(dailyNonogramResponseSchema.parse(element.props.daily).game).toBe(
      "nonogram",
    );
  });

  it("leaks no reveal-adjacent key into the RSC payload or the markup", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = await play.default();
    // Flight serializes EVERY prop crossing into a client component, including
    // values never rendered — so the props object is what the scan has to
    // cover, not only the markup. `collectKeys` over an HTML STRING returns an
    // empty set, which would make every assertion below vacuously true.
    const keys = collectKeys(elementSchema.parse(element).props);
    const markup = renderToStaticMarkup(element);

    // Anti-vacuity: the scan is worthless if it walked nothing.
    expect(keys.has("clues")).toBe(true);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      // `motifId`, `name` and `mirrored` are here because ADR-0033 put them
      // there — and `name` is simultaneously a key ban on the payload and a
      // SUBSTRING ban on the rendered markup, which is why no element on this
      // screen carries a `name` attribute or a lowercase `name*` class.
      expect(keys.has(forbidden)).toBe(false);
      expect(markup).not.toContain(forbidden);
    }
  });
});

describe("the db surface both pages touch (T-WEB-S54)", () => {
  it("reads through the published-predicate helper and nothing else", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play, conclusion } = await loadPages();

    await play.default();
    await conclusion.default();

    expect(spies.getTodayDaily).toHaveBeenCalledTimes(2);
    expect(spies.getTodayDaily).toHaveBeenNthCalledWith(
      1,
      spies.stubDb,
      "nonogram",
    );
    expect(spies.getTodayDaily).toHaveBeenNthCalledWith(
      2,
      spies.stubDb,
      "nonogram",
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

  it("takes the conclusion's day from the wall, never from the client clock", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-05T12:00:00Z"));
    spies.getTodayDaily.mockResolvedValue({ ...DAILY, date: "2026-07-30" });
    const { conclusion } = await loadPages();

    const element = elementSchema.parse(await conclusion.default());

    expect(element.props.date).toBe("2026-07-30");
    // `date` and NOTHING else. The game is the wrapper's own identity now
    // (plan 020 §13.3), and the key set is the mechanical half of ADR-0034
    // decision 3: a server-computed `picture` on this route would put a
    // derived solution into the RSC payload of a page that also renders for
    // players who have NOT solved.
    expect(Object.keys(element.props).toSorted()).toEqual(["date"]);
  });
});
