import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

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

    expect([...codeOf(planted).matchAll(FORBIDDEN)]).toHaveLength(2);
  });
});
