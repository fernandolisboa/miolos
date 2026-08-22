import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

/**
 * The DB clock is the only clock (ADR-0010): every date and instant in a
 * statement comes from Postgres, never from the Node process. Nine modules
 * state that law in their header; until now only `published.ts` had a scan
 * behind it (`T-DB-S53b`, and that one counts wall spellings rather than
 * dates). The other eight were prose.
 */

/** The modules whose header states the no-JS-Date law. */
const MODULES = [
  "buffer.ts",
  "completions.ts",
  "medals.ts",
  "merge.ts",
  "notify.ts",
  "published.ts",
  "schema.ts",
  "seen-days.ts",
  "stats.ts",
] as const;

/**
 * Comment-stripping is load-bearing, not hygiene — the headers name the very
 * constructs counted below, so a raw scan would red on a correct module.
 * (`T-DB-S53b`'s idiom.)
 *
 * Two assumptions, both true of `packages/db/src` today: no line-TRAILING
 * `//` comment mentions a date constructor (only line-leading ones are
 * stripped, so a trailing one would red a correct module), and no string or
 * SQL template contains block-comment delimiters (the block regex is
 * context-free and would eat real code between them). Neither is enforced;
 * if this test ever reds on a module you believe is clean, check these first.
 */
function codeOf(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/^[ \t]*\/\/.*$/gm, "");
}

const FORBIDDEN = /new Date\(|Date\.now\(|Date\.UTC\(|\.toISOString\(/g;

describe("the DB clock is the only clock (T-DB-S89)", () => {
  it.each(MODULES)("%s constructs no JS date", async (module) => {
    const source = await readFile(
      new URL(`../src/${module}`, import.meta.url),
      "utf8",
    );
    expect([...codeOf(source).matchAll(FORBIDDEN)].map((m) => m[0])).toEqual(
      [],
    );
  });

  it("the scan is not vacuous — it catches a date the stripper must not hide", () => {
    const planted = [
      "const a = new Date();",
      "const b = Date.now();",
      "// const c = new Date();",
      "/** d = new Date() */",
    ].join("\n");
    // The two commented forms are stripped; the two real ones are not.
    expect([...codeOf(planted).matchAll(FORBIDDEN)]).toHaveLength(2);
  });
});
