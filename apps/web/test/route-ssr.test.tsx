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

const DATE = "2026-08-01";

const ARCHIVE_MONTH = DATE.slice(0, 7);

const BINAIRO_PUZZLE = generateBinairo({ seed: 20_260_801, weekday: 6 });

const BINAIRO: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...BINAIRO_PUZZLE.givens],
};

const SUDOKU_PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const SUDOKU: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU_PUZZLE.givens,
  tier: SUDOKU_PUZZLE.tier,
});

const NONOGRAM_PUZZLE = generateNonogram(20_260_801, 1);

const NONOGRAM: DailyNonogramResponse = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: DATE,
  size: NONOGRAM_PUZZLE.size,
  clues: NONOGRAM_PUZZLE.clues,
});

const TERMO: DailyTermoResponse = dailyTermoResponseSchema.parse({
  game: "termo",
  date: DATE,
});

const spies = vi.hoisted(() => ({
  stubDb: {},
  getDb: vi.fn(),
  getTodayDaily: vi.fn(),

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

const elementSchema = z.object({
  $$typeof: z.symbol(),
  type: z.unknown(),
  props: z.unknown(),
});

function nameOf(type: unknown): string {
  if (typeof type === "string") {
    return type;
  }
  if (typeof type === "function" && type.name.length > 0) {
    return type.name;
  }
  return "anonymous";
}

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

  readonly marker: string | undefined;
  readonly load: () => Promise<{
    default: (props: never) => ReactNode | Promise<ReactNode>;
  }>;

  readonly props?: { readonly params: Promise<Record<string, string>> };

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

  {
    path: "/modo-livre",
    marker: "data-free-play=",
    load: () => import("../app/modo-livre/page"),
    daily: undefined,
  },

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

  {
    path: "/privacidade",
    marker: "data-page=",
    load: () => import("../app/privacidade/page"),
    daily: undefined,
  },

  {
    path: "/termos",
    marker: "data-page=",
    load: () => import("../app/termos/page"),
    daily: undefined,
  },

  {
    path: "/estatisticas",
    marker: "data-page=",
    load: () => import("../app/estatisticas/page"),
    daily: undefined,
  },
  {
    path: routes.attach,
    marker: "data-page=",
    load: () => import("../app/vincular/page"),
    daily: undefined,
  },

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

      expect(unserializableProps(await callPage(page, props))).toEqual([]);
    },
  );

  it.each(ROUTES)(
    "$path server-renders the unavailable screen rather than throwing when nothing is published",
    async ({ path, load, props }) => {
      spies.getTodayDaily.mockResolvedValue(undefined);

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
