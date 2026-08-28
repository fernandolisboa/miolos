import { readdir, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { errorResponse, readResponse } from "../src/http/responses";

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

    const code = responses
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/^[ \t]*\/\/.*$/gm, "");
    expect(code.match(/Cache-Control/g)).toHaveLength(1);

    expect(readResponse({}).headers.get("cache-control")).toBe("no-store");
    expect(errorResponse(500, "internal").headers.get("cache-control")).toBe(
      null,
    );
    for (const [, source] of sources) {
      expect(source).not.toMatch(/Cache-Control/);
    }
  });
});
