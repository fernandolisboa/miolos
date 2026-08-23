import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { withoutComments } from "./ts-source";

/**
 * `src/play/day-state.ts` is reached from every route, so whatever it pulls
 * in is on every route's client bundle. Three modules in that closure say in
 * prose that they import no game engine for exactly that reason; nothing
 * enforced it. `eslint.config.mjs`'s `@miolos/games/termo` ban is attached
 * only to `apps/web/src/free-play/**` and `apps/web/app/modo-livre/**`, so a
 * value import here would ship the Termo answer pool to `/` and red nothing.
 */

const WEB_ROOT = join(import.meta.dirname, "..");
const ENTRY = "src/play/day-state.ts";
const ENGINE_PACKAGE = /["']@miolos\/games(?:\/[^"']*)?["']/;

function resolveSpecifier(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(join(WEB_ROOT, fromFile)), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && /\.tsx?$/.test(candidate)) {
      return relative(WEB_ROOT, candidate).replaceAll("\\", "/");
    }
  }
  return null;
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
    const code = withoutComments(readFileSync(join(WEB_ROOT, current), "utf8"));
    for (const match of code.matchAll(
      /(?:from|import)\s*\(?\s*["'](\.[^"']*)["']/g,
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
    withoutComments(readFileSync(join(WEB_ROOT, module), "utf8")),
  );
}

describe("the day-state closure carries no game engine (T-WEB-S354)", () => {
  const closure = closureOf(ENTRY);

  it("reaches the three modules whose doc blocks claim the rule, so the scan is not vacuous", () => {
    expect(closure).toEqual(
      expect.arrayContaining([
        "src/play/day-state.ts",
        "src/play/play-record.ts",
        "src/play/use-record-snapshot.ts",
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
    expect(importsEngine("src/termo/state.ts")).toBe(true);
    expect(closureOf("src/termo/state.ts").filter(importsEngine)).not.toEqual(
      [],
    );
  });
});
