/**
 * The SSR gate for every route `impeccable`'s preflight fetches (plan 018
 * §12.8, `.github/workflows/impeccable.yml`). One suite, every path, and the
 * two properties that job asserts against a live deployment, asserted here
 * against the page shells themselves: the route server-renders WITHOUT
 * THROWING, and the markup carries the marker attribute proving the screen we
 * are about to scan is the one that rendered.
 *
 * WHY THIS FILE EXISTS. `/binairo/concluido` shipped an HTTP 500 to CI while
 * every other suite was green, because every other suite renders COMPONENTS —
 * `<ConclusionView/>` directly, with props a test wrote — and never the route.
 * The defect lived in neither: it lived in the `page.tsx` → client-component
 * hand-off. `messages.games.binairo.conclusion` carried a `stampAria`
 * FUNCTION, the page is a server component, and React refuses to serialize a
 * function across the RSC boundary ("Functions cannot be passed directly to
 * Client Components…"). It typechecks, it renders fine in jsdom, and it is a
 * 500 on the first real request.
 *
 * So the suite asserts two different things, because neither alone is enough:
 *
 * 1. `renderToStaticMarkup(await Page())` — catches anything that throws while
 *    the tree renders on the server, and proves the marker attribute is in the
 *    pre-hydration paint (which is all the preflight's `grep` ever sees).
 *    It does NOT catch the boundary violation: `react-dom/server` renders a
 *    `"use client"` component as an ordinary component and never runs Flight's
 *    serializer, so on its own it is green on the exact bug that reached CI.
 * 2. `serializablePropsOnly` — the rule Flight enforces, checked structurally
 *    on the element the page returns. THIS is the assertion that fails on the
 *    regression, and it fails on any future game's copy bundle, any handler
 *    and any class instance handed to a client component from a page shell.
 */
import {
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
  type DailyBinairoResponse,
  type DailyNonogramResponse,
  type DailySudokuResponse,
  type DailyTermoResponse,
} from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateDailySudoku } from "@miolos/games/sudoku";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { routes } from "../src/i18n";

// The day the shells resolve from the wall. Fixed, because the hub derives its
// own São Paulo day from the clock and the records nothing here writes must
// not accidentally match it.
const DATE = "2026-08-01";

/** The month `DATE` belongs to, for the archive month row's params. */
const ARCHIVE_MONTH = DATE.slice(0, 7);

const BINAIRO_PUZZLE = generateBinairo({ seed: 20_260_801, weekday: 6 });

const BINAIRO: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...BINAIRO_PUZZLE.givens],
};

// Weekday 1 is tier 1, the cheapest rung of SUDOKU_WEEKDAY_CRITERIA (~0.7 ms
// per generation) — and it runs once, at module scope.
const SUDOKU_PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const SUDOKU: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU_PUZZLE.givens,
  tier: SUDOKU_PUZZLE.tier,
});

// Weekday 1 is the 5×5 nonogram class (~0.0354 ms), and it runs once, at
// module scope. Parsed rather than cast, so the fixture is the wall's exact
// four-key projection and nothing wider.
const NONOGRAM_PUZZLE = generateNonogram(20_260_801, 1);

const NONOGRAM: DailyNonogramResponse = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: DATE,
  size: NONOGRAM_PUZZLE.size,
  clues: NONOGRAM_PUZZLE.clues,
});

/**
 * Termo's whole public projection: two strings, one of which is the game's own
 * name. Parsed rather than written, so the fixture is the wall's exact
 * key set and nothing wider (ADR-0040).
 */
const TERMO: DailyTermoResponse = dailyTermoResponseSchema.parse({
  game: "termo",
  date: DATE,
});

// `vi.mock` factories are hoisted above every const in the file, so the spies
// have to be hoisted with them.
const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  getTodayDaily: vi.fn(),
  // #31 (ADR-0053): the archive's readers. The rows below feed them the same
  // fixtures the daily rows feed `getTodayDaily`, so an archive page renders
  // its real screen rather than a 404 branch.
  getArchivedDaily: vi.fn(),
  listArchivedDays: vi.fn(),
  listArchivedMonths: vi.fn(),
  archiveDateClass: vi.fn(),
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));

vi.mock("@miolos/db", () => ({
  getTodayDaily: spies.getTodayDaily,
  getArchivedDaily: spies.getArchivedDaily,
  listArchivedDays: spies.listArchivedDays,
  listArchivedMonths: spies.listArchivedMonths,
  archiveDateClass: spies.archiveDateClass,
  getPublishedDaily: vi.fn(),
  createDb: vi.fn(),
  eq: vi.fn(),
  sql: vi.fn(),
  SAO_PAULO_TIME_ZONE: "America/Sao_Paulo",
  sessions: {},
  users: {},
}));

/**
 * A React element, reached without a cast: elements are plain objects, so a
 * schema is enough and the repo's no-`as`-in-tests rule is kept. `$$typeof` is
 * what distinguishes one from an ordinary props object — and it is why the
 * walker below cannot simply recurse over every key: an element's `type` IS a
 * function (the component) and would be a false positive on every node.
 */
const elementSchema = z.object({
  $$typeof: z.symbol(),
  type: z.unknown(),
  props: z.unknown(),
});

/** How a node is named in a failure path, so a hit points at the component. */
function nameOf(type: unknown): string {
  if (typeof type === "string") {
    return type;
  }
  if (typeof type === "function" && type.name.length > 0) {
    return type.name;
  }
  return "anonymous";
}

/**
 * Every prop value in `node`'s tree that React's Flight serializer would
 * reject, as `<Component>.path.to.value` strings.
 *
 * Functions only, which is the whole of the rule that matters here: a page
 * shell's props are copy bundles, Zod-parsed responses and strings, so a
 * function is the one non-serializable value that can plausibly appear (and
 * did). Class instances and symbols are equally rejected by Flight; nothing in
 * `apps/web` constructs either into a prop, and widening the check to them
 * would flag `$$typeof` on every nested element.
 */
function unserializableProps(
  node: unknown,
  path = "",
  found: string[] = [],
): string[] {
  if (typeof node === "function") {
    found.push(path);
    return found;
  }
  if (node === null || typeof node !== "object") {
    return found;
  }
  const element = elementSchema.safeParse(node);
  if (element.success) {
    // Only `props` crosses. `type` and `key` are the element's own identity.
    return unserializableProps(
      element.data.props,
      `${path}<${nameOf(element.data.type)}>`,
      found,
    );
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) =>
      unserializableProps(item, `${path}[${index}]`, found),
    );
    return found;
  }
  for (const [key, value] of Object.entries(node)) {
    unserializableProps(value, `${path}.${key}`, found);
  }
  return found;
}

interface RouteCase {
  readonly path: string;
  /** The attribute the impeccable preflight greps for on this path. */
  readonly marker: string | undefined;
  readonly load: () => Promise<{
    default: (props: never) => ReactNode | Promise<ReactNode>;
  }>;
  /**
   * The route's params, for the dynamic segments #31 added — the first this
   * table has ever held. A page with a dynamic segment takes `{ params }` and
   * `await`s it; the three `it.each` bodies pass this straight through, so a
   * static route stays exactly the zero-argument call it always was.
   */
  readonly props?: { readonly params: Promise<Record<string, string>> };
  /** What the wall answers for this route, if it reads one at all. */
  readonly daily:
    | DailyBinairoResponse
    | DailyNonogramResponse
    | DailySudokuResponse
    | DailyTermoResponse
    | undefined;
}

const ROUTES: readonly RouteCase[] = [
  {
    path: "/",
    marker: undefined,
    load: () => import("../app/page"),
    daily: undefined,
  },
  {
    path: "/binairo",
    marker: "data-play-state=",
    load: () => import("../app/binairo/page"),
    daily: BINAIRO,
  },
  {
    path: "/binairo/concluido",
    marker: "data-conclusion-state=",
    load: () => import("../app/binairo/concluido/page"),
    daily: BINAIRO,
  },
  {
    path: "/sudoku",
    marker: "data-play-state=",
    load: () => import("../app/sudoku/page"),
    daily: SUDOKU,
  },
  {
    path: "/sudoku/concluido",
    marker: "data-conclusion-state=",
    load: () => import("../app/sudoku/concluido/page"),
    daily: SUDOKU,
  },
  {
    path: "/nonogram",
    marker: "data-play-state=",
    load: () => import("../app/nonogram/page"),
    daily: NONOGRAM,
  },
  {
    path: "/nonogram/concluido",
    marker: "data-conclusion-state=",
    load: () => import("../app/nonogram/concluido/page"),
    daily: NONOGRAM,
  },
  {
    path: "/termo",
    marker: "data-play-state=",
    load: () => import("../app/termo/page"),
    daily: TERMO,
  },
  {
    path: "/termo/concluido",
    marker: "data-conclusion-state=",
    load: () => import("../app/termo/concluido/page"),
    daily: TERMO,
  },
  // The free-play routes (#28) read no wall at all — `daily: undefined`
  // documents that, and the "nothing published" case below is their
  // ordinary render.
  {
    path: "/modo-livre",
    marker: "data-free-play=",
    load: () => import("../app/modo-livre/page"),
    daily: undefined,
  },
  // The three game screens' static shell is the generating skeleton, whose
  // `data-play-state="generating"` satisfies the preflight's existing arm.
  {
    path: "/modo-livre/binairo",
    marker: "data-play-state=",
    load: () => import("../app/modo-livre/binairo/page"),
    daily: undefined,
  },
  {
    path: "/modo-livre/sudoku",
    marker: "data-play-state=",
    load: () => import("../app/modo-livre/sudoku/page"),
    daily: undefined,
  },
  {
    path: "/modo-livre/nonogram",
    marker: "data-play-state=",
    load: () => import("../app/modo-livre/nonogram/page"),
    daily: undefined,
  },
  // The #21 pages read no wall either: /privacidade is static by
  // construction, /vincular is request-rendered (it awaits searchParams)
  // but still db-free — its shell renders here with none supplied.
  {
    path: "/privacidade",
    marker: "data-page=",
    load: () => import("../app/privacidade/page"),
    daily: undefined,
  },
  // The #29 stats screen is the /privacidade shape — static by
  // construction, db-free, `data-page` marker: every aggregate arrives via
  // the island's mount-effect hooks only (plan 033 §6.6).
  {
    path: "/estatisticas",
    marker: "data-page=",
    load: () => import("../app/estatisticas/page"),
    daily: undefined,
  },
  {
    // `routes.attach` on purpose (step-7 finding E): the emailed link is
    // built api-side from the pinned `/vincular` literal
    // (apps/api/app/attach/request/route.ts), and THIS row is the web-side
    // consumer of the composed route — renaming the slug moves this path
    // and the render below catches a page that no longer answers it.
    path: routes.attach,
    marker: "data-page=",
    load: () => import("../app/vincular/page"),
    daily: undefined,
  },
  // #31 (ADR-0053): the seven archive routes. THREE of them carry a dynamic
  // segment, which is why `RouteCase` grew a `props` member — this table's
  // shape had never needed one, because every route before the archive was
  // addressed by a literal path.
  {
    path: routes.archive,
    marker: "data-page=",
    load: () => import("../app/arquivo/page"),
    daily: undefined,
  },
  {
    path: "/arquivo/mes/[mes]",
    marker: "data-page=",
    load: () => import("../app/arquivo/mes/[mes]/page"),
    props: { params: Promise.resolve({ mes: ARCHIVE_MONTH }) },
    daily: undefined,
  },
  {
    path: "/arquivo/[data]",
    marker: "data-page=",
    load: () => import("../app/arquivo/[data]/page"),
    props: { params: Promise.resolve({ data: DATE }) },
    daily: undefined,
  },
  {
    path: "/arquivo/[data]/binairo",
    marker: "data-play-state=",
    load: () => import("../app/arquivo/[data]/binairo/page"),
    props: { params: Promise.resolve({ data: DATE }) },
    daily: BINAIRO,
  },
  {
    path: "/arquivo/[data]/sudoku",
    marker: "data-play-state=",
    load: () => import("../app/arquivo/[data]/sudoku/page"),
    props: { params: Promise.resolve({ data: DATE }) },
    daily: SUDOKU,
  },
  {
    path: "/arquivo/[data]/nonogram",
    marker: "data-play-state=",
    load: () => import("../app/arquivo/[data]/nonogram/page"),
    props: { params: Promise.resolve({ data: DATE }) },
    daily: NONOGRAM,
  },
  {
    path: "/arquivo/[data]/termo",
    marker: "data-play-state=",
    load: () => import("../app/arquivo/[data]/termo/page"),
    props: { params: Promise.resolve({ data: DATE }) },
    daily: TERMO,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  spies.getDb.mockReturnValue(spies.stubDb);
  // The archive's list readers answer with the fixture day, so the index, the
  // month page and the day page render their real screens.
  spies.listArchivedDays.mockResolvedValue([
    { date: DATE, game: "binairo" },
    { date: DATE, game: "nonogram" },
    { date: DATE, game: "sudoku" },
    { date: DATE, game: "termo" },
  ]);
  spies.listArchivedMonths.mockResolvedValue([ARCHIVE_MONTH]);
  spies.archiveDateClass.mockResolvedValue("past");
});

afterEach(() => {
  localStorage.clear();
});

describe("every route the impeccable preflight fetches (T-WEB-S56)", () => {
  it.each(ROUTES)(
    "$path server-renders without throwing, with its marker in the pre-hydration paint",
    async ({ marker, load, daily, props }) => {
      spies.getTodayDaily.mockResolvedValue(daily);
      spies.getArchivedDaily.mockResolvedValue(daily);
      const page = await load();

      const markup = renderToStaticMarkup(await callPage(page, props));

      expect(markup.length).toBeGreaterThan(0);
      if (marker !== undefined) {
        expect(markup).toContain(marker);
      }
    },
  );

  it.each(ROUTES)(
    "$path hands the client tree nothing React's Flight serializer would reject",
    async ({ load, daily, props }) => {
      spies.getTodayDaily.mockResolvedValue(daily);
      spies.getArchivedDaily.mockResolvedValue(daily);
      const page = await load();

      // The element a page returns IS the RSC payload's root: every prop on it
      // is serialized before it reaches the browser, rendered or not. A hit
      // here is an HTTP 500 on the real route, which no component test can
      // see (the regression this suite exists for).
      expect(unserializableProps(await callPage(page, props))).toEqual([]);
    },
  );

  it.each(ROUTES)(
    "$path server-renders the unavailable screen rather than throwing when nothing is published",
    async ({ path, load, props }) => {
      spies.getTodayDaily.mockResolvedValue(undefined);
      // The archive answers a real 404 where the daily renders an unavailable
      // card at 200 — "no puzzle today" is not "no such resource", and an
      // archived day that is not there IS. `notFound()` throws by design, so
      // the archive rows assert the throw rather than a rendered screen.
      spies.getArchivedDaily.mockResolvedValue(undefined);
      spies.listArchivedDays.mockResolvedValue([]);
      spies.archiveDateClass.mockResolvedValue("past");
      const page = await load();

      if (path.startsWith("/arquivo/")) {
        await expect(callPage(page, props)).rejects.toThrow();
        return;
      }

      const element = await callPage(page, props);

      expect(renderToStaticMarkup(element).length).toBeGreaterThan(0);
      expect(unserializableProps(element)).toEqual([]);
    },
  );
});

/**
 * Call a page shell with its params, if it has any. The cast is the one this
 * table cannot avoid: `default` is typed to accept `never` so a static route's
 * zero-argument call stays exactly that, and the three dynamic routes hand it
 * the `{ params }` object Next really passes.
 */
async function callPage(
  page: { default: (props: never) => ReactNode | Promise<ReactNode> },
  props: RouteCase["props"],
): Promise<ReactNode> {
  const call = page.default as (
    props?: RouteCase["props"],
  ) => ReactNode | Promise<ReactNode>;
  return await call(props);
}

describe("the walker itself", () => {
  // Anti-vacuity: a scan that finds nothing because it walks nothing would
  // make every assertion above pass on the exact bug they exist to catch.
  it("finds a function handed to a component, at any depth", () => {
    const Component = ({ copy }: { readonly copy: unknown }) => (
      <output>{String(copy)}</output>
    );
    const stampAria = () => "Binairo concluído";

    expect(
      unserializableProps(
        <Component copy={{ title: "Binairo", notYet: { stampAria } }} />,
      ),
    ).toEqual(["<Component>.copy.notYet.stampAria"]);
  });

  it("does not flag an element's own component type", () => {
    const Component = () => <output>ok</output>;

    expect(unserializableProps(<Component />)).toEqual([]);
  });
});
