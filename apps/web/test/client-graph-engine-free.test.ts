import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { withoutComments } from "./ts-source";

const WEB_ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const DAY_STATE = "apps/web/src/play/day-state.ts";
const PLAY_RECORD = "apps/web/src/play/play-record.ts";
const ENGINE_PACKAGE = /["']@miolos\/games(?:\/[^"']*)?["']/;

function workspaceBase(specifier: string): string | null {
  if (!specifier.startsWith("@miolos/")) {
    return null;
  }
  const match = /^@miolos\/([a-z0-9-]+)(?:\/(.*))?$/.exec(specifier);
  if (match?.[1] === undefined) {
    throw new Error(`unresolvable workspace specifier: ${specifier}`);
  }
  return join(REPO_ROOT, "packages", match[1], "src", match[2] ?? "");
}

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith(".")
    ? resolve(dirname(join(REPO_ROOT, fromFile)), specifier)
    : workspaceBase(specifier);
  if (base === null) {
    return null;
  }
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && /\.tsx?$/.test(candidate)) {
      return relative(REPO_ROOT, candidate).replaceAll("\\", "/");
    }
  }
  return null;
}

function closureOf(entry: string): ReadonlySet<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined || seen.has(current)) {
      continue;
    }
    seen.add(current);
    const code = withoutComments(
      readFileSync(join(REPO_ROOT, current), "utf8"),
    );
    for (const match of code.matchAll(
      /(?:from|import)\s*\(?\s*["']([^"']+)["']/g,
    )) {
      const specifier = match[1];
      if (specifier === undefined) {
        continue;
      }
      const resolved = resolveSpecifier(current, specifier);
      if (resolved !== null) {
        queue.push(resolved);
      }
    }
  }
  return seen;
}

function importsEngine(module: string): boolean {
  return ENGINE_PACKAGE.test(
    withoutComments(readFileSync(join(REPO_ROOT, module), "utf8")),
  );
}

function routeEntries(): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(join(WEB_ROOT, "app"), {
    recursive: true,
    withFileTypes: true,
  })) {
    if (entry.isFile() && /^(page|layout)\.tsx$/.test(entry.name)) {
      found.push(
        relative(REPO_ROOT, join(entry.parentPath, entry.name)).replaceAll(
          "\\",
          "/",
        ),
      );
    }
  }
  expect(found.length).toBeGreaterThan(20);
  return found.sort();
}

function routesReaching(module: string): readonly string[] {
  return routeEntries().filter((route) => closureOf(route).has(module));
}

describe("the shared play modules carry no game engine (T-WEB-S354)", () => {
  it("imports `@miolos/games` from nowhere either module can reach", () => {
    const union = new Set([...closureOf(DAY_STATE), ...closureOf(PLAY_RECORD)]);
    expect([...union].filter(importsEngine)).toEqual([]);
  });

  it("flags a module that does import the engine, so a green run above means something", () => {
    expect(importsEngine("apps/web/src/termo/state.ts")).toBe(true);
    expect(
      [...closureOf("apps/web/src/termo/state.ts")].filter(importsEngine),
    ).not.toEqual([]);
  });

  it("reaches `packages/core`, so losing workspace resolution cannot pass quietly", () => {
    expect(closureOf(DAY_STATE)).toContain("packages/core/src/day.ts");
  });
});

describe("what those modules are actually on, measured (T-WEB-S354)", () => {
  it("keeps `day-state.ts` off every archive and free-play route", () => {
    const leaked = routesReaching(DAY_STATE).filter(
      (route) => route.includes("/arquivo/") || route.includes("/modo-livre/"),
    );
    expect(leaked).toEqual([]);
  });

  it("puts `day-state.ts` on the hub and on all four boards and conclusions", () => {
    expect(routesReaching(DAY_STATE)).toEqual([
      "apps/web/app/binairo/concluido/page.tsx",
      "apps/web/app/binairo/page.tsx",
      "apps/web/app/nonogram/concluido/page.tsx",
      "apps/web/app/nonogram/page.tsx",
      "apps/web/app/page.tsx",
      "apps/web/app/sudoku/concluido/page.tsx",
      "apps/web/app/sudoku/page.tsx",
      "apps/web/app/termo/concluido/page.tsx",
      "apps/web/app/termo/page.tsx",
    ]);
  });

  it("puts `play-record.ts` on strictly more routes than `day-state.ts`", () => {
    const record = routesReaching(PLAY_RECORD);
    for (const route of routesReaching(DAY_STATE)) {
      expect(record).toContain(route);
    }
    expect(record.length).toBeGreaterThan(routesReaching(DAY_STATE).length);
  });
});
