import {
  dailyTermoResponseSchema,
  type DailyTermoResponse,
} from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { messages } from "../src/i18n";

// T-WEB-S95 (plan 022 §19.6). Both page shells are async server components,
// which @testing-library/react cannot render — so they are invoked as plain
// functions and asserted on the element they return, plus a
// renderToStaticMarkup leak scan.
//
// No PGlite anywhere in apps/web: `vitest.config.ts` forces jsdom for every
// file, and re-proving the wall from here would prove nothing about apps/web.
// The wall's behaviour is pinned by packages/db's own suite.

/**
 * The daily the wall would project: parsed through the response schema, never
 * cast. The schema is a strict TWO-key object, so it is also what proves the
 * drawn answer is not on it — and for Termo that is sharper than for the
 * three shipped games, because the word is derivable from nothing the client
 * holds. A server-computed reveal would be the ONLY channel, and the leak
 * would be total (ADR-0040, ADR-0043 decision 7).
 */
const DAILY: DailyTermoResponse = dailyTermoResponseSchema.parse({
  game: "termo",
  date: "2026-08-01",
});

// `vi.mock` factories are hoisted above every const in the file, so the spies
// have to be hoisted with them.
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

// Every other export of the root entry is a spy asserted never called: the
// wall is only a wall if it is the ONLY door apps/web uses.
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
  const play = await import("../app/termo/page");
  const conclusion = await import("../app/termo/concluido/page");
  return { play, conclusion };
}

beforeEach(() => {
  vi.clearAllMocks();
  spies.getDb.mockReturnValue(spies.stubDb);
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("route segment configuration (T-WEB-S95)", () => {
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

  it("renders TERMO's unavailable copy when nothing is published", async () => {
    spies.getTodayDaily.mockResolvedValue(undefined);
    const { play, conclusion } = await loadPages();

    const playMarkup = renderToStaticMarkup(await play.default());
    const conclusionMarkup = renderToStaticMarkup(await conclusion.default());

    for (const markup of [playMarkup, conclusionMarkup]) {
      expect(markup).toContain(messages.games.termo.play.unavailable.title);
      expect(markup).toContain(messages.games.termo.play.unavailable.cta);
      // The screen takes its copy as a prop, so the wrong game's block
      // reaching it is a real failure mode.
      expect(markup).not.toContain(
        messages.games.nonogram.play.unavailable.title,
      );
    }
  });
});

describe("/termo", () => {
  it("passes the wall's projection and nothing else across the RSC boundary", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = elementSchema.parse(await play.default());

    // A strict schema: any extra key on the daily fails the parse, which is
    // the exact-key-set assertion ADR-0040 asks for.
    expect(dailyTermoResponseSchema.parse(element.props.daily)).toEqual(DAILY);
    expect(Object.keys(element.props).toSorted()).toEqual(["daily"]);
    // Spelled out as well as parsed: termo's public projection is `game, date`
    // and nothing else — no answer, in any form.
    expect(
      Object.keys(
        dailyTermoResponseSchema.parse(element.props.daily),
      ).toSorted(),
    ).toEqual(["date", "game"]);
  });

  it("asks the wall for termo, and the screen receives a termo response", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play } = await loadPages();

    const element = elementSchema.parse(await play.default());

    expect(spies.getTodayDaily).toHaveBeenCalledWith(spies.stubDb, "termo");
    expect(dailyTermoResponseSchema.parse(element.props.daily).game).toBe(
      "termo",
    );
  });

  it("leaks no answer-adjacent key into the RSC payload or the markup", async () => {
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
    expect(keys.has("date")).toBe(true);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      // `canonical` and `normalized` are here because ADR-0040 put them there,
      // and `name`/`canonical` are simultaneously a key ban on the payload and
      // a SUBSTRING ban on the rendered markup — CSS-module locals render
      // verbatim, so no class on the Termo tree may contain one either.
      expect(keys.has(forbidden)).toBe(false);
      expect(markup).not.toContain(forbidden);
    }
  });

  it("keeps the substring ban true for /termo/concluido's markup as well", async () => {
    // HONEST CAVEAT, the same one nonogram-page.test.tsx records for its own
    // tree: `renderToStaticMarkup` renders the NOT-HYDRATED branch, because
    // `useSyncExternalStore`'s server snapshot says the record has not been
    // read — so only the skeleton's classes are actually scanned here, and the
    // constraint holds over the rest of the tree BY CONVENTION.
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { conclusion } = await loadPages();

    const markup = renderToStaticMarkup(await conclusion.default());

    expect(markup.length).toBeGreaterThan(0);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(markup).not.toContain(forbidden);
    }
  });
});

describe("the db surface both pages touch", () => {
  it("reads through the published-predicate helper and nothing else", async () => {
    spies.getTodayDaily.mockResolvedValue(DAILY);
    const { play, conclusion } = await loadPages();

    await play.default();
    await conclusion.default();

    expect(spies.getTodayDaily).toHaveBeenCalledTimes(2);
    expect(spies.getTodayDaily).toHaveBeenNthCalledWith(
      1,
      spies.stubDb,
      "termo",
    );
    expect(spies.getTodayDaily).toHaveBeenNthCalledWith(
      2,
      spies.stubDb,
      "termo",
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
    // `date` and NOTHING else. This route renders for players who have NOT
    // finished, so a server-supplied outcome or word here would turn a
    // bookmarkable page into a spoiler channel — and for this game it would be
    // the only one there is.
    expect(Object.keys(element.props).toSorted()).toEqual(["date"]);
  });
});
