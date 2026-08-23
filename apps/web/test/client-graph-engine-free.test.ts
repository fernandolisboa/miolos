import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { withoutComments } from "./ts-source";

/**
 * `src/play/day-state.ts` is reached from every route, so whatever it pulls
 * in is on every route's client bundle. Two modules in that closure say in
 * prose that they import no game engine for exactly that reason; nothing
 * enforced it. `eslint.config.mjs`'s `@miolos/games/termo` ban is attached
 * only to `apps/web/src/free-play/**` and `apps/web/app/modo-livre/**`, so a
 * value import here would ship the Termo answer pool to `/` and red nothing.
 */

const WEB_ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");
const ENTRY = "apps/web/src/play/day-state.ts";
const ENGINE_PACKAGE = /["']@miolos\/games(?:\/[^"']*)?["']/;

/**
 * Relative hops AND workspace hops. `@miolos/core` is in `next.config.ts`'s
 * `transpilePackages`, so its source is bundled into the same client chunk —
 * an engine import one package away lands on `/` exactly as a local one does.
 * Following only relative specifiers would leave that edge unwatched.
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

/** `@miolos/core` → `packages/core/src`, `@miolos/core/x` → `packages/core/src/x`. */
function workspaceBase(specifier: string): string | null {
  const match = /^@miolos\/([a-z-]+)(?:\/(.*))?$/.exec(specifier);
  if (match === null || match[1] === undefined) {
    return null;
  }
  return join(REPO_ROOT, "packages", match[1], "src", match[2] ?? "");
}

/** Every `.ts`/`.tsx` module reachable from `entry` through relative imports. */
function closureOf(entry: string): readonly string[] {
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
  return [...seen].sort();
}

function importsEngine(module: string): boolean {
  return ENGINE_PACKAGE.test(
    withoutComments(readFileSync(join(REPO_ROOT, module), "utf8")),
  );
}

describe("the day-state closure carries no game engine (T-WEB-S354)", () => {
  const closure = closureOf(ENTRY);

  it("reaches the modules the rule is about, so the scan is not vacuous", () => {
    expect(closure).toEqual(
      expect.arrayContaining([
        "apps/web/src/play/day-state.ts",
        "apps/web/src/play/play-record.ts",
        "packages/core/src/day.ts",
      ]),
    );
  });

  it("imports `@miolos/games` from nowhere in the closure", () => {
    expect(closure.filter(importsEngine)).toEqual([]);
  });

  it("flags a module that does import the engine, so a green run above means something", () => {
    // The control is a real importer, not a fixture: if `src/termo/state.ts`
    // ever stops importing the engine this assertion reds and the negative
    // scan above gets re-argued rather than quietly passing on a dead matcher.
    expect(importsEngine("apps/web/src/termo/state.ts")).toBe(true);
    expect(
      closureOf("apps/web/src/termo/state.ts").filter(importsEngine),
    ).not.toEqual([]);
  });
});
