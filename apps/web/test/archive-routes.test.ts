import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  archiveDayCardRoute,
  archiveDayRoute,
  archiveGameRoute,
  archiveMonthCardRoute,
  archiveMonthRoute,
  routes,
  routeSlugs,
} from "../src/i18n";

const ROOTS = ["app", "src"] as const;
const SOURCE = /\.(?:tsx?|mts|cts|jsx?|mjs|cjs)$/;

const ARCHIVE_LITERAL = /["'`]\/arquivo/;

const CARD_LITERAL = /["'`]\/cartao/;

const CARD_LINK = /(?:href\s*=|<Link\b)[^\n]*\/cartao/;

function code(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")

    .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
}

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

  it("no `/cartao` string literal exists outside routes.ts, and nothing LINKS one", () => {
    const files = sourceFiles().map(
      (path) => [path, code(readFileSync(path, "utf8"))] as const,
    );

    expect(files.length).toBeGreaterThan(50);

    const literals = files
      .filter(([path]) => !path.endsWith(join("src", "i18n", "routes.ts")))
      .filter(([, source]) => CARD_LITERAL.test(source))
      .map(([path]) => path);
    expect(literals).toEqual([]);

    const links = files
      .filter(([, source]) => CARD_LINK.test(source))
      .map(([path]) => path);
    expect(links).toEqual([]);
  });

  it("the `/cartao` scans are not vacuous — both regexes match a real offender", () => {
    expect(CARD_LITERAL.test('const u = "/cartao/2026-08-01";')).toBe(true);
    expect(CARD_LITERAL.test("const u = `/cartao/mes/${month}`;")).toBe(true);
    expect(CARD_LINK.test('<a href="/cartao/2026-08-01">card</a>')).toBe(true);
    expect(CARD_LINK.test("<Link href={archiveDayCardRoute(d)}>x</Link>")).toBe(
      false,
    );
    expect(CARD_LINK.test('<Link href="/cartao/mes/2026-08" />')).toBe(true);

    expect(routeSlugs.card).toBe("cartao");
    expect(archiveDayCardRoute("2026-08-01")).toBe("/cartao/2026-08-01");
    expect(archiveMonthCardRoute("2026-08")).toBe("/cartao/mes/2026-08");
  });

  it("the scan is not vacuous — routes.ts itself matches it, and comment-stripping does not hide code", () => {
    const routesSource = readFileSync(
      join(import.meta.dirname, "..", "src", "i18n", "routes.ts"),
      "utf8",
    );

    expect(ARCHIVE_LITERAL.test('href="/arquivo/2026-08-01"')).toBe(true);
    expect(routesSource).toContain('archive: "arquivo"');
    expect(routesSource).toContain('month: "mes"');

    expect(code('const a = "/arquivo"; // "/arquivo"')).toContain(
      'const a = "/arquivo";',
    );
    expect(code('/* "/arquivo" */ const b = 1;').trim()).toBe("const b = 1;");
    expect(code('const c = "https://miolos.app/arquivo";')).toContain(
      "/arquivo",
    );
  });
});
