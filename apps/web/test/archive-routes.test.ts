import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  archiveDayRoute,
  archiveGameRoute,
  archiveMonthRoute,
  routes,
  routeSlugs,
} from "../src/i18n";

// The archive's paths (#31, ADR-0053 decision 1). `/arquivo` has exactly one
// home in the app, and the second half of this file is what makes that a
// mechanical claim rather than a convention: route typing is NOT enabled in
// this repo (`next.config.ts` sets no `typedRoutes`), so nothing in the type
// system stops a literal path at a call site.

const ROOTS = ["app", "src"] as const;
const SOURCE = /\.(?:tsx?|mts|cts|jsx?|mjs|cjs)$/;

/** A quoted `/arquivo` path — the shape a hardcoded route takes in code. */
const ARCHIVE_LITERAL = /["'`]\/arquivo/;

/**
 * The file with its comments removed. Load-bearing rather than hygiene: this
 * repo's doc blocks discuss `/arquivo` at length (ADR references, the
 * routes table's own note), so a raw scan would red on prose and the claim
 * would have to be weakened to survive it.
 */
function code(source: string): string {
  return (
    source
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      // A trailing `//` comment, but never the `//` of a URL scheme: an
      // absolute `https://host/arquivo/...` in code IS an offender, and a
      // stripper that ate it would hide the one case worth catching most.
      .replaceAll(/(^|[^:])\/\/.*$/gm, "$1")
  );
}

/** Every source file under `apps/web/app` and `apps/web/src`. */
function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(path);
      } else if (SOURCE.test(entry.name)) {
        found.push(path);
      }
    }
  };
  for (const root of ROOTS) {
    walk(join(import.meta.dirname, "..", root));
  }
  return found;
}

describe("the archive's paths have one home (T-WEB-S166)", () => {
  it("routes.archive and the three builders compose the exact pt-BR paths", () => {
    expect(routeSlugs.archive).toBe("arquivo");
    expect(routeSlugs.month).toBe("mes");
    expect(routes.archive).toBe("/arquivo");
    expect(archiveMonthRoute("2026-08")).toBe("/arquivo/mes/2026-08");
    expect(archiveDayRoute("2026-08-01")).toBe("/arquivo/2026-08-01");
    expect(archiveGameRoute("2026-08-01", "termo")).toBe(
      "/arquivo/2026-08-01/termo",
    );
    // The game segment is LITERAL, and each of the four composes through the
    // same slug table the daily routes use — so a fifth game's archive path
    // cannot be invented at a call site.
    expect(archiveGameRoute("2026-08-01", "binairo")).toBe(
      "/arquivo/2026-08-01/binairo",
    );
    expect(archiveGameRoute("2026-08-01", "sudoku")).toBe(
      "/arquivo/2026-08-01/sudoku",
    );
    expect(archiveGameRoute("2026-08-01", "nonogram")).toBe(
      "/arquivo/2026-08-01/nonogram",
    );
  });

  it("no `/arquivo` string literal exists in apps/web outside routes.ts", () => {
    const offenders = sourceFiles()
      .filter((path) => !path.endsWith(join("src", "i18n", "routes.ts")))
      .filter((path) => ARCHIVE_LITERAL.test(code(readFileSync(path, "utf8"))));
    expect(offenders).toEqual([]);
  });

  it("the scan is not vacuous — routes.ts itself matches it, and comment-stripping does not hide code", () => {
    const routesSource = readFileSync(
      join(import.meta.dirname, "..", "src", "i18n", "routes.ts"),
      "utf8",
    );
    // The one file the scan excludes is the one file that must match: an
    // exclusion over a file that never matched would make the scan green by
    // construction.
    // `routes.ts` composes the path from its slug table rather than writing
    // it out, so the literal does not appear even there — which is the
    // stronger shape, and it means the regex's own non-vacuity has to be
    // asserted directly.
    expect(ARCHIVE_LITERAL.test('href="/arquivo/2026-08-01"')).toBe(true);
    expect(routesSource).toContain('archive: "arquivo"');
    expect(routesSource).toContain('month: "mes"');
    // And the comment-stripping strips COMMENTS only. Prose in this repo
    // discusses `/arquivo` constantly (this file included), so a raw scan
    // would red on doc blocks; a stripper that also ate code would make the
    // scan above pass on a real offender.
    expect(code('const a = "/arquivo"; // "/arquivo"')).toContain(
      'const a = "/arquivo";',
    );
    expect(code('/* "/arquivo" */ const b = 1;').trim()).toBe("const b = 1;");
    expect(code('const c = "https://miolos.app/arquivo";')).toContain(
      "/arquivo",
    );
  });
});
