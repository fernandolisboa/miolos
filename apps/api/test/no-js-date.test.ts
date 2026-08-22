import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

/**
 * The DB clock is the only clock (ADR-0010), and the rule reaches past
 * `packages/db`: these service modules write `sql\`now()\`` and DB defaults
 * rather than constructing an instant in Node.
 *
 * `packages/db` has had this as a scan since T-DB-S89; `apps/api` had it as
 * prose in exactly these three module headers and nothing else, so a fourth
 * service could stamp a JS date and no gate would notice.
 *
 * `session/service.ts` is deliberately NOT here: it reads `Date.now()` as the
 * send-gate for the `last_seen_at` bump, with the DB-side predicate as the
 * actual guard. It never claimed the law.
 */

/** The modules whose header states the no-JS-Date law. */
const MODULES = [
  "attach/service.ts",
  "onboarding/service.ts",
  "push/service.ts",
] as const;

/**
 * Comment-stripping is load-bearing, not hygiene — the headers name the very
 * constructs counted below, so a raw scan would red on a correct module.
 *
 * Two assumptions, true of these files today: no line-TRAILING `//` comment
 * mentions a date constructor (only line-leading ones are stripped), and no
 * string or SQL template contains block-comment delimiters.
 */
function codeOf(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .replaceAll(/^[ \t]*\/\/.*$/gm, "");
}

const FORBIDDEN = /new Date\(|Date\.now\(|Date\.UTC\(|\.toISOString\(/g;

describe("the DB clock is the only clock in apps/api services (T-API-S182)", () => {
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
