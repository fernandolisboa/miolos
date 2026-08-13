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

// The day the shells resolve from the wall. Fixed, because the hub derives its
// own São Paulo day from the clock and the records nothing here writes must
// not accidentally match it.
const DATE = "2026-08-01";

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
}));

vi.mock("../src/db", () => ({ getDb: spies.getDb }));

vi.mock("@miolos/db", () => ({
  getTodayDaily: spies.getTodayDaily,
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
    default: () => ReactNode | Promise<ReactNode>;
  }>;
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
];

beforeEach(() => {
  vi.clearAllMocks();
  spies.getDb.mockReturnValue(spies.stubDb);
});

afterEach(() => {
  localStorage.clear();
});

describe("every route the impeccable preflight fetches (T-WEB-S56)", () => {
  it.each(ROUTES)(
    "$path server-renders without throwing, with its marker in the pre-hydration paint",
    async ({ marker, load, daily }) => {
      spies.getTodayDaily.mockResolvedValue(daily);
      const page = await load();

      const markup = renderToStaticMarkup(await page.default());

      expect(markup.length).toBeGreaterThan(0);
      if (marker !== undefined) {
        expect(markup).toContain(marker);
      }
    },
  );

  it.each(ROUTES)(
    "$path hands the client tree nothing React's Flight serializer would reject",
    async ({ load, daily }) => {
      spies.getTodayDaily.mockResolvedValue(daily);
      const page = await load();

      // The element a page returns IS the RSC payload's root: every prop on it
      // is serialized before it reaches the browser, rendered or not. A hit
      // here is an HTTP 500 on the real route, which no component test can
      // see (the regression this suite exists for).
      expect(unserializableProps(await page.default())).toEqual([]);
    },
  );

  it.each(ROUTES)(
    "$path server-renders the unavailable screen rather than throwing when nothing is published",
    async ({ load }) => {
      spies.getTodayDaily.mockResolvedValue(undefined);
      const page = await load();

      const element = await page.default();

      expect(renderToStaticMarkup(element).length).toBeGreaterThan(0);
      expect(unserializableProps(element)).toEqual([]);
    },
  );
});

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
