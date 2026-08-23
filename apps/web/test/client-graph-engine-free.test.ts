import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { withoutComments } from "./ts-source";

/**
 * `src/play/play-record.ts` and `src/play/day-state.ts` say in prose that they
 * import no game engine, because they sit on the client graph of the routes
 * that render a board, a conclusion or the hub. Nothing enforced it:
 * `eslint.config.mjs`'s `@miolos/games/termo` ban is attached only to
 * `apps/web/src/free-play/**` and `apps/web/app/modo-livre/**`, so a value
 * import in either would ship the Termo answer pool and red nothing.
 *
 * The scope is measured here rather than asserted, because "every route" —
 * what both files used to claim — is false in a way ADR-0053 decision 9 and
 * the free-play wall REQUIRE: the archive and free play are deliberately kept
 * off `day-state.ts`.
 */

const WEB_ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const DAY_STATE = "apps/web/src/play/day-state.ts";
const PLAY_RECORD = "apps/web/src/play/play-record.ts";
const ENGINE_PACKAGE = /["']@miolos\/games(?:\/[^"']*)?["']/;

/** `@miolos/core` → `packages/core/src`, `@miolos/core/x` → `packages/core/src/x`. */
function workspaceBase(specifier: string): string | null {
  if (!specifier.startsWith("@miolos/")) {
    return null;
  }
  const match = /^@miolos\/([a-z0-9-]+)(?:\/(.*))?$/.exec(specifier);
  if (match?.[1] === undefined) {
    // Loud rather than a silently narrowed walk: a new workspace package whose
    // name this regex misses would shrink the closure with no signal.
    throw new Error(`unresolvable workspace specifier: ${specifier}`);
  }
  return join(REPO_ROOT, "packages", match[1], "src", match[2] ?? "");
}

/**
 * `@miolos/core` is in `next.config.ts`'s `transpilePackages`, so its source is
 * bundled into the same client chunk — an engine import one package away lands
 * on a route exactly as a local one does. Following only relative specifiers
 * would leave that edge unwatched.
 */
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

/** Every `.ts`/`.tsx` module reachable from `entry`, relative or workspace. */
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

/** Every Next route entry under `apps/web/app`, repo-relative. */
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
    // A real importer, not a fixture: if `src/termo/state.ts` ever stops
    // importing the engine this reds and the scan above gets re-argued rather
    // than passing on a dead matcher.
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
    // ADR-0053 decision 9 and `T-WEB-S183` keep the day store out of the
    // archive's graph; the free-play wall bans the day client under
    // `app/modo-livre/**`. Both would be undone silently by an import here.
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
    // The archive reads the record without the day store — `card-status.ts`
    // re-derives rather than importing, for exactly that reason.
    const record = routesReaching(PLAY_RECORD);
    for (const route of routesReaching(DAY_STATE)) {
      expect(record).toContain(route);
    }
    expect(record.length).toBeGreaterThan(routesReaching(DAY_STATE).length);
  });
});
