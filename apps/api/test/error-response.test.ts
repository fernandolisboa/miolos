import { readdir, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { errorResponse, readResponse } from "../src/http/responses";

/**
 * One error envelope, and the GET/mutation split is structural.
 *
 * Eighteen routes each carried their own `errorResponse`. Eight were GETs and
 * sent `Cache-Control: no-store`; ten were mutations and did not. That split
 * was correct — nothing caches a POST — but it was enforced by whoever
 * remembered to paste it. `src/http/responses.ts` now owns both halves, and
 * this scan is what stops an eleventh copy.
 */
const APP = new URL("../app/", import.meta.url);

async function routeSources(): Promise<Map<string, string>> {
  const names = (await readdir(APP, { recursive: true }))
    .filter((name) => name.endsWith("route.ts"))
    .sort();
  const found = new Map<string, string>();
  for (const name of names) {
    found.set(name, await readFile(new URL(name, APP), "utf8"));
  }
  return found;
}

const sources = await routeSources();

describe("the error envelope has one owner (T-API-S184)", () => {
  it("the scan sees every route file — non-vacuity", () => {
    expect(sources.size).toBeGreaterThanOrEqual(28);
  });

  it.each([...sources])("%s defines no errorResponse of its own", (_n, s) => {
    expect(s).not.toMatch(/function errorResponse\(/);
  });

  it.each([...sources])(
    "%s builds no error body by hand — apiErrorResponseSchema stays in src/http",
    (_n, s) => {
      expect(s).not.toMatch(/apiErrorResponseSchema/);
    },
  );

  it.each([...sources])(
    "%s that calls errorResponse imports it — the POSITIVE half, which a negative scan cannot give",
    (_n, s) => {
      // A copy written as `const errorResponse = (status, error) => …` evades
      // both scans above. Requiring the import is what catches it.
      if (!s.includes("errorResponse(")) return;
      expect(s).toMatch(/from "(\.\.\/)+src\/http\/responses"/);
    },
  );

  it("the stripper is not vacuous — it cannot hide a real occurrence", () => {
    const planted = [
      'const a = "Cache-Control";',
      "// Cache-Control",
      "/** Cache-Control */",
    ].join("\n");
    const code = planted
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/^[ \t]*\/\/.*$/gm, "");
    expect(code.match(/Cache-Control/g)).toHaveLength(1);
  });

  it("no mutation route sends Cache-Control, and the authenticated-read envelope does", async () => {
    const responses = await readFile(
      new URL("../src/http/responses.ts", import.meta.url),
      "utf8",
    );
    // The split lives in exactly one place: `readResponse` carries the header,
    // `errorResponse` does not. If a future edit adds it to both, this reds.
    // Comments stripped first — the doc block names the header it governs.
    const code = responses
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/^[ \t]*\/\/.*$/gm, "");
    expect(code.match(/Cache-Control/g)).toHaveLength(1);
    // Bound to the FUNCTIONS, not to a count: swapping the header between the
    // two is the exact inversion of this module's thesis, and a file-wide
    // count cannot see it.
    expect(readResponse({}).headers.get("cache-control")).toBe("no-store");
    expect(errorResponse(500, "internal").headers.get("cache-control")).toBe(
      null,
    );
    for (const [, source] of sources) {
      expect(source).not.toMatch(/Cache-Control/);
    }
  });
});
