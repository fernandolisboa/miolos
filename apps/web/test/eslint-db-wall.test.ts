import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it, vi } from "vitest";

//

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfigFile: join(repoRoot, "eslint.config.mjs"),
  overrideConfig: [
    {
      files: ["**/*.{ts,tsx}"],
      ...tseslint.configs.disableTypeChecked,
      languageOptions: {
        parserOptions: { projectService: false, project: false },
      },
    },
  ],
});

//

//

//

vi.setConfig({ testTimeout: 40_000 });

const WALL_RULES = ["no-restricted-imports", "no-restricted-syntax"];

async function lintProbe(relativePath: string, source: string) {
  const [result] = await eslint.lintText(source, {
    filePath: join(repoRoot, relativePath),
  });
  if (result === undefined) {
    throw new Error(`ESLint returned no result for ${relativePath}`);
  }
  return result.messages;
}

function ruleIds(messages: { ruleId: string | null }[]): (string | null)[] {
  return messages.map((message) => message.ruleId);
}

function wallHits(messages: { ruleId: string | null }[]): (string | null)[] {
  return ruleIds(messages).filter(
    (ruleId) => ruleId !== null && WALL_RULES.includes(ruleId),
  );
}

const SOURCE_PATH = "apps/web/src/eslint-probe.ts";
const APP_PATH = "apps/web/app/eslint-probe.ts";
const TEST_PATH = "apps/web/test/eslint-probe.test.ts";

const SOURCE_JS_PATH = "apps/web/src/eslint-probe.js";
const APP_JSX_PATH = "apps/web/app/eslint-probe.jsx";
const SOURCE_MJS_PATH = "apps/web/src/eslint-probe.mjs";
const SOURCE_CJS_PATH = "apps/web/src/eslint-probe.cjs";

describe("apps/web db wall — import bans (ADR-0024 §5)", () => {
  it("T-LINT-1: importing @miolos/db/publishing is restricted", async () => {
    const messages = await lintProbe(
      SOURCE_PATH,
      [
        'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";',
        "",
        "export const read = getPublishedDailyWithSolution;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(messages)).toContain("no-restricted-imports");
  });

  it("T-LINT-2: importing @miolos/db/user is restricted", async () => {
    const messages = await lintProbe(
      SOURCE_PATH,
      [
        'import { recordCompletion } from "@miolos/db/user";',
        "",
        "export const write = recordCompletion;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(messages)).toContain("no-restricted-imports");
  });

  it("T-LINT-3: importing @miolos/db/testing is restricted, type-only imports included", async () => {
    const value = await lintProbe(
      SOURCE_PATH,
      [
        'import { createTestDb } from "@miolos/db/testing";',
        "",
        "export const make = createTestDb;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(value)).toContain("no-restricted-imports");

    const typeOnly = await lintProbe(
      SOURCE_PATH,
      [
        'import type { CompletionRecord } from "@miolos/db/user";',
        "",
        "export type Alias = CompletionRecord;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(typeOnly)).toContain("no-restricted-imports");
  });

  it("T-LINT-3b: `sql` and `eq` are banned by name off the root entry", async () => {
    const messages = await lintProbe(
      SOURCE_PATH,
      [
        'import { sql, eq } from "@miolos/db";',
        "",
        "export const raw = { sql, eq };",
        "",
      ].join("\n"),
    );
    expect(ruleIds(messages)).toContain("no-restricted-imports");
  });

  it("T-LINT-S4: packages/core's client contracts never import the server-only ones", () => {
    //

    //

    const read = (relative: string) =>
      readFileSync(join(repoRoot, relative), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
    const client = read("packages/core/src/contracts/daily.ts");

    expect(client).not.toMatch(/from\s+["']\.\/daily-content/);

    expect(client).toMatch(/export const nonogramSizeSchema/);
    expect(read("packages/core/src/contracts/daily-content.ts")).toMatch(
      /from\s+["']\.\/daily["']/,
    );
  });

  it("T-LINT-S5: the server-only daily-content schemas are banned by name off @miolos/core", async () => {
    const messages = await lintProbe(
      SOURCE_PATH,
      [
        'import { stripDailyContent } from "@miolos/core";',
        "",
        "export const strip = stripDailyContent;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(messages)).toContain("no-restricted-imports");

    const allowed = await lintProbe(
      SOURCE_PATH,
      [
        'import { isoDateString, nonogramSizeSchema } from "@miolos/core";',
        "",
        "export const schemas = { isoDateString, nonogramSizeSchema };",
        "",
      ].join("\n"),
    );
    expect(wallHits(allowed)).toEqual([]);
  });

  it("T-LINT-S6: a relative path or dynamic import into packages/core/src is restricted too", async () => {
    const deep = await lintProbe(
      SOURCE_PATH,
      [
        'import { stripDailyContent } from "../../../packages/core/src/contracts/daily-content";',
        "",
        "export const strip = stripDailyContent;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(deep)).toContain("no-restricted-imports");

    const index = await lintProbe(
      SOURCE_PATH,
      [
        'import { isoDateString } from "../../../packages/core/src";',
        "",
        "export const shape = isoDateString;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(index)).toContain("no-restricted-imports");

    const dynamic = await lintProbe(
      SOURCE_PATH,
      [
        "export const load = () =>",
        '  import("../../../packages/core/src/contracts/daily-content");',
        "",
      ].join("\n"),
    );
    expect(ruleIds(dynamic)).toContain("no-restricted-syntax");

    const allowed = await lintProbe(
      SOURCE_PATH,
      [
        'import { isoDateString } from "@miolos/core";',
        "",
        "export const shape = isoDateString;",
        "",
      ].join("\n"),
    );
    expect(wallHits(allowed)).toEqual([]);
  });

  it("T-LINT-S7: the banned name list IS the server-only module's value exports, derived not copied", () => {
    //

    const content = readFileSync(
      join(repoRoot, "packages/core/src/contracts/daily-content.ts"),
      "utf8",
    );
    const exported = [
      ...content.matchAll(
        /^export\s+(?:const|class|function)\s+([A-Za-z0-9_$]+)/gm,
      ),
    ].map(([, name]) => name);

    expect(exported).toContain("stripDailyContent");
    expect(exported.length).toBeGreaterThanOrEqual(5);

    const config = readFileSync(join(repoRoot, "eslint.config.mjs"), "utf8");
    const banned = config
      .slice(config.indexOf('name: "@miolos/core"'))
      .match(/importNames:\s*\[([^\]]*)\]/)?.[1];
    expect(
      banned,
      "the @miolos/core paths entry lost its importNames",
    ).toBeDefined();
    const bannedNames = [...(banned ?? "").matchAll(/"([A-Za-z0-9_$]+)"/g)].map(
      ([, name]) => name,
    );

    expect([...bannedNames].sort()).toEqual([...exported].sort());

    const barrel = readFileSync(
      join(repoRoot, "packages/core/src/index.ts"),
      "utf8",
    );
    expect(barrel).toMatch(/from\s+["']\.\/contracts\/daily-content["']/);
  });

  it("T-LINT-S8: the wall fires from apps/web/src/termo/**, and a clean Termo file reports nothing", async () => {
    const TERMO_PATH = "apps/web/src/termo/eslint-probe.ts";

    const bare = await lintProbe(
      TERMO_PATH,
      [
        'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";',
        "",
        "export const read = getPublishedDailyWithSolution;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(bare)).toContain("no-restricted-imports");

    const contentSchema = await lintProbe(
      TERMO_PATH,
      [
        'import { termoDailyContentSchema } from "@miolos/core";',
        "",
        "export const shape = termoDailyContentSchema;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(contentSchema)).toContain("no-restricted-imports");

    const relative = await lintProbe(
      TERMO_PATH,
      [
        'import { dailyPuzzles } from "../../../../packages/db/src/schema";',
        "",
        "export const table = dailyPuzzles;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(relative)).toContain("no-restricted-imports");

    const dynamic = await lintProbe(
      TERMO_PATH,
      [
        "export const load = () =>",
        '  import("../../../../packages/core/src/contracts/daily-content");',
        "",
      ].join("\n"),
    );
    expect(ruleIds(dynamic)).toContain("no-restricted-syntax");

    const clean = await lintProbe(
      TERMO_PATH,
      [
        'import { isoDateString } from "@miolos/core";',
        'import { MAX_GUESSES } from "@miolos/games/termo";',
        "",
        "export const shape = { isoDateString, MAX_GUESSES };",
        "",
      ].join("\n"),
    );
    expect(wallHits(clean)).toEqual([]);
  });

  it("T-LINT-S8a: the wall fires from apps/web/src/og/**, and a clean OG file reports nothing", async () => {
    //

    const OG_PATH = "apps/web/src/og/eslint-probe.ts";

    const bare = await lintProbe(
      OG_PATH,
      [
        'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";',
        "",
        "export const read = getPublishedDailyWithSolution;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(bare)).toContain("no-restricted-imports");

    const contentSchema = await lintProbe(
      OG_PATH,
      [
        'import { stripDailyContent } from "@miolos/core";',
        "",
        "export const strip = stripDailyContent;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(contentSchema)).toContain("no-restricted-imports");

    const relative = await lintProbe(
      OG_PATH,
      [
        'import { dailyPuzzles } from "../../../../packages/db/src/schema";',
        "",
        "export const table = dailyPuzzles;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(relative)).toContain("no-restricted-imports");

    const dynamic = await lintProbe(
      OG_PATH,
      [
        "export const load = () =>",
        '  import("../../../../packages/core/src/contracts/daily-content");',
        "",
      ].join("\n"),
    );
    expect(ruleIds(dynamic)).toContain("no-restricted-syntax");

    const clean = await lintProbe(
      OG_PATH,
      [
        'import { getPublishedDaily, getTodayDaily } from "@miolos/db";',
        "",
        "export const readers = { getPublishedDaily, getTodayDaily };",
        "",
      ].join("\n"),
    );
    expect(wallHits(clean)).toEqual([]);
  });

  it("T-LINT-3c: a relative path into packages/db/src is restricted", async () => {
    const deep = await lintProbe(
      SOURCE_PATH,
      [
        'import { completions } from "../../../packages/db/src/schema";',
        "",
        "export const table = completions;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(deep)).toContain("no-restricted-imports");

    const index = await lintProbe(
      SOURCE_PATH,
      [
        'import { createDb } from "../../../packages/db/src";',
        "",
        "export const make = createDb;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(index)).toContain("no-restricted-imports");
  });

  it("T-LINT-S56: the node_modules/@miolos SYMLINK spelling of that same reach is restricted too, static and dynamic", async () => {
    //

    const db = await lintProbe(
      SOURCE_PATH,
      [
        'import { completions } from "../node_modules/@miolos/db/src/schema";',
        "",
        "export const table = completions;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(db)).toContain("no-restricted-imports");

    const dbIndex = await lintProbe(
      SOURCE_PATH,
      [
        'import { createDb } from "../node_modules/@miolos/db/src";',
        "",
        "export const make = createDb;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(dbIndex)).toContain("no-restricted-imports");

    const core = await lintProbe(
      SOURCE_PATH,
      [
        'import { stripDailyContent } from "../node_modules/@miolos/core/src/contracts/daily-content";',
        "",
        "export const strip = stripDailyContent;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(core)).toContain("no-restricted-imports");

    const dynamic = await lintProbe(
      SOURCE_PATH,
      [
        "export const load = () =>",
        '  import("../node_modules/@miolos/db/src/publishing");',
        "",
      ].join("\n"),
    );
    expect(ruleIds(dynamic)).toContain("no-restricted-syntax");

    for (const prefix of ["./", "../", "../../", "../../../"]) {
      const atDepth = await lintProbe(
        SOURCE_PATH,
        [
          `import { completions } from "${prefix}node_modules/@miolos/db/src/schema";`,
          "",
          "export const table = completions;",
          "",
        ].join("\n"),
      );
      expect(ruleIds(atDepth)).toContain("no-restricted-imports");
    }
  });

  it("T-LINT-3d: `users` and `sessions` are banned by name off the root entry", async () => {
    const messages = await lintProbe(
      SOURCE_PATH,
      [
        'import { users, sessions } from "@miolos/db";',
        "",
        "export const identity = { users, sessions };",
        "",
      ].join("\n"),
    );
    expect(ruleIds(messages)).toContain("no-restricted-imports");
  });

  it("T-LINT-4: dynamic import of a server-internal subpath is restricted, at SOURCE and test paths", async () => {
    const banned = [
      "export async function load() {",
      '  return await import("@miolos/db/publishing");',
      "}",
      "",
    ].join("\n");

    expect(ruleIds(await lintProbe(SOURCE_PATH, banned))).toContain(
      "no-restricted-syntax",
    );
    expect(ruleIds(await lintProbe(APP_PATH, banned))).toContain(
      "no-restricted-syntax",
    );
    expect(ruleIds(await lintProbe(TEST_PATH, banned))).toContain(
      "no-restricted-syntax",
    );

    const allowed = [
      "export async function load() {",
      '  return await import("@miolos/db");',
      "}",
      "",
    ].join("\n");
    expect(await lintProbe(SOURCE_PATH, allowed)).toEqual([]);
  });

  it("T-LINT-4b: a COMPUTED dynamic import specifier is restricted at every apps/web path", async () => {
    const templateLiteral = [
      "export async function load() {",
      "  return await import(`@miolos/db/publishing`);",
      "}",
      "",
    ].join("\n");
    const concatenated = [
      'const specifier = "@miolos/db/" + "publishing";',
      "export async function load() {",
      "  return await import(specifier);",
      "}",
      "",
    ].join("\n");

    for (const path of [SOURCE_PATH, APP_PATH, TEST_PATH]) {
      expect(ruleIds(await lintProbe(path, templateLiteral))).toContain(
        "no-restricted-syntax",
      );
      expect(ruleIds(await lintProbe(path, concatenated))).toContain(
        "no-restricted-syntax",
      );
    }

    const withAttributes = [
      "export async function load() {",
      '  return await import("./data.json", { with: { type: "json" } });',
      "}",
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(SOURCE_PATH, withAttributes))).toEqual([]);
  });

  it("T-LINT-4c: require() is banned at every apps/web path", async () => {
    const source = [
      'const publishing = require("@miolos/db/publishing");',
      "",
      "export const read = publishing;",
      "",
    ].join("\n");

    for (const path of [SOURCE_PATH, APP_PATH, TEST_PATH]) {
      expect(ruleIds(await lintProbe(path, source))).toContain(
        "no-restricted-syntax",
      );
    }
  });

  it("T-LINT-8: the import bans still fire under apps/web/test/**", async () => {
    const messages = await lintProbe(
      TEST_PATH,
      [
        'import { createTestDb } from "@miolos/db/testing";',
        "",
        "export const make = createTestDb;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(messages)).toContain("no-restricted-imports");
  });
});

describe("apps/web db wall — table-name literals (ADR-0024 amendment)", () => {
  it("T-LINT-5: string, template and interpolated-template table names all report under src/", async () => {
    const stringLiteral = await lintProbe(
      SOURCE_PATH,
      ['export const table = "daily_puzzles";', ""].join("\n"),
    );
    expect(ruleIds(stringLiteral)).toContain("no-restricted-syntax");

    const template = await lintProbe(
      SOURCE_PATH,
      ["export const query = `select * from remote_config`;", ""].join("\n"),
    );
    expect(ruleIds(template)).toContain("no-restricted-syntax");

    const interpolated = await lintProbe(
      SOURCE_PATH,
      [
        "export function query(column: string, id: string): string {",
        "  return `select ${column} from daily_puzzles where id = ${id}`;",
        "}",
        "",
      ].join("\n"),
    );
    expect(ruleIds(interpolated)).toContain("no-restricted-syntax");

    const nearMiss = await lintProbe(
      SOURCE_PATH,
      ['export const setting = "remote_configuration";', ""].join("\n"),
    );
    expect(wallHits(nearMiss)).toEqual([]);
  });

  it("T-LINT-5b: the literal selectors also fire under apps/web/app/**", async () => {
    const messages = await lintProbe(
      APP_PATH,
      ['export const table = "daily_puzzles";', ""].join("\n"),
    );
    expect(ruleIds(messages)).toContain("no-restricted-syntax");
  });

  it("T-LINT-7: the same probe reports nothing under apps/web/test/**", async () => {
    const stringLiteral = await lintProbe(
      TEST_PATH,
      ['export const table = "daily_puzzles";', ""].join("\n"),
    );
    expect(wallHits(stringLiteral)).toEqual([]);

    const template = await lintProbe(
      TEST_PATH,
      ["export const query = `select * from remote_config`;", ""].join("\n"),
    );
    expect(wallHits(template)).toEqual([]);
  });
});

describe("apps/web db wall — extension coverage (step 6: js/jsx/mjs/cjs)", () => {
  it("T-LINT-9: the import bans fire at .js, .jsx and .mjs paths, and require() at .cjs", async () => {
    const banned = [
      'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";',
      "",
      "export const read = getPublishedDailyWithSolution;",
      "",
    ].join("\n");

    for (const path of [SOURCE_JS_PATH, APP_JSX_PATH, SOURCE_MJS_PATH]) {
      expect(ruleIds(await lintProbe(path, banned))).toContain(
        "no-restricted-imports",
      );
    }

    const commonJs = [
      'const publishing = require("@miolos/db/publishing");',
      "",
      "module.exports = publishing;",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(SOURCE_CJS_PATH, commonJs))).toContain(
      "no-restricted-syntax",
    );
  });

  it("T-LINT-9b: a .jsx file is linted at all, JSX syntax included", async () => {
    const redeclared = [
      "var a = 1;",
      "var a = 2;",
      "export default a;",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(APP_JSX_PATH, redeclared))).toContain(
      "no-redeclare",
    );

    const jsx = [
      "export default function Probe() {",
      '  return <div className="probe">ok</div>;',
      "}",
      "",
    ].join("\n");
    expect(await lintProbe(APP_JSX_PATH, jsx)).toEqual([]);
  });

  it("T-LINT-10: the table-literal bans fire at .js, .jsx and .mjs paths too", async () => {
    for (const path of [SOURCE_JS_PATH, APP_JSX_PATH, SOURCE_MJS_PATH]) {
      const stringLiteral = await lintProbe(
        path,
        ['export const table = "daily_puzzles";', ""].join("\n"),
      );
      expect(ruleIds(stringLiteral)).toContain("no-restricted-syntax");

      const template = await lintProbe(
        path,
        ["export const query = `select * from remote_config`;", ""].join("\n"),
      );
      expect(ruleIds(template)).toContain("no-restricted-syntax");
    }
  });
});

describe("apps/web db wall — not a blanket ban", () => {
  it("T-LINT-6: a legitimate apps/web file reports nothing at all", async () => {
    const messages = await lintProbe(
      SOURCE_PATH,
      [
        'import { getTodayDaily } from "@miolos/db";',
        "",
        "export const readDaily = getTodayDaily;",
        "",
      ].join("\n"),
    );
    expect(messages).toEqual([]);
  });

  it("T-LINT-S59: the symlink bans are PACKAGE-SCOPED — @miolos/ui through node_modules stays legal", async () => {
    //

    const ui = await lintProbe(
      SOURCE_PATH,
      [
        'import { spacing } from "../node_modules/@miolos/ui/src/tokens";',
        "",
        "export const gap = spacing;",
        "",
      ].join("\n"),
    );
    expect(wallHits(ui)).toEqual([]);

    const rootEntry = await lintProbe(
      SOURCE_PATH,
      [
        'import { getTodayDaily } from "@miolos/db";',
        'import { isoDateString } from "@miolos/core";',
        "",
        "export const surface = { getTodayDaily, isoDateString };",
        "",
      ].join("\n"),
    );
    expect(wallHits(rootEntry)).toEqual([]);
  });

  it("T-LINT-S3: the wall fires from apps/web/src/nonogram/**, and a clean nonogram file reports zero", async () => {
    const nonogramPath = "apps/web/src/nonogram/eslint-probe.ts";

    const bannedImport = await lintProbe(
      nonogramPath,
      [
        'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";',
        "",
        "export const read = getPublishedDailyWithSolution;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(bannedImport)).toContain("no-restricted-imports");

    const tableLiteral = await lintProbe(
      nonogramPath,
      ['export const table = "daily_puzzles";', ""].join("\n"),
    );
    expect(ruleIds(tableLiteral)).toContain("no-restricted-syntax");

    const clean = await lintProbe(
      nonogramPath,
      [
        'import { getTodayDaily } from "@miolos/db";',
        'import { solveNonogram } from "@miolos/games/nonogram";',
        "",
        "export const engine = { getTodayDaily, solveNonogram };",
        "",
      ].join("\n"),
    );
    expect(clean).toEqual([]);
  });
});

describe("the no-session-replay wall (#33, ADR-0069 decision 1)", () => {
  it("T-LINT-S53: a replay-capable client is an import error in every tree, and the ban is not a substring heuristic", async () => {
    //

    const bannedAt = [
      ["apps/web/src/eslint-probe.ts", 'import "posthog-js";'],
      ["apps/web/src/free-play/eslint-probe.ts", 'import "posthog-js-lite";'],
      ["apps/web/app/opengraph-image.tsx", 'import "rrweb";'],
      [
        "apps/web/app/modo-livre/opengraph-image.tsx",
        'import "posthog-js/react";',
      ],
      ["apps/api/src/eslint-probe.ts", 'import "posthog-js";'],
      ["packages/core/src/eslint-probe.ts", 'import "@posthog/nextjs";'],
    ] as const;

    for (const [path, source] of bannedAt) {
      const messages = await lintProbe(path, `${source}\n`);
      expect(
        wallHits(messages),
        `${path} did not report the replay ban`,
      ).toContain("no-restricted-imports");
    }

    for (const clean of [
      'import "./posthog-js-notes";',
      'import "../telemetry/client";',
    ]) {
      const messages = await lintProbe(
        "apps/web/src/eslint-probe.ts",
        `${clean}\n`,
      );
      expect(wallHits(messages), `${clean} should be clean`).toEqual([]);
    }
  });
});

describe("no parallel query path in apps/web", () => {
  const WALL_SURFACE = new Set([
    "ArchivedDay",
    "archiveDateClass",
    "createDb",
    "getArchivedDaily",
    "getPublishedDaily",
    "getTodayDaily",
    "listArchivedDays",
    "listArchivedMonths",
    "type Db",
  ]);

  const SOURCE_FILE = /\.(?:tsx?|mts|cts|jsx?|mjs|cjs)$/;

  function webSources(): string[] {
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(path);
        } else if (SOURCE_FILE.test(entry.name)) {
          found.push(path);
        }
      }
    };
    for (const root of ["app", "src"]) {
      walk(join(import.meta.dirname, "..", root));
    }
    return found;
  }

  function code(source: string): string {
    return source
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
  }

  function dbImports(
    source: string,
  ): { readonly from: string; readonly names: string[] }[] {
    return [
      ...source.matchAll(
        /import\s+(type\s+)?\{([^}]*)\}\s+from\s+"(@miolos\/db[^"]*)"/g,
      ),
    ].map((match) => ({
      from: match[3] ?? "",
      names: (match[2] ?? "")
        .split(",")
        .map((name) => name.trim().replace(/\s+as\s+.*$/, ""))
        .filter((name) => name.length > 0)
        .map((name) => (match[1] === undefined ? name : `type ${name}`)),
    }));
  }

  it("T-LINT-S37: every @miolos/db import in apps/web names only wall readers, on the root entry", () => {
    const offenders: string[] = [];
    for (const path of webSources()) {
      const source = readFileSync(path, "utf8");
      const found = dbImports(source);
      for (const entry of found) {
        if (entry.from !== "@miolos/db") {
          offenders.push(`${path}: subpath ${entry.from}`);
        }
        for (const name of entry.names) {
          const bare = name.replace(/^type /, "");
          if (!WALL_SURFACE.has(name) && !WALL_SURFACE.has(bare)) {
            offenders.push(`${path}: ${name}`);
          }
        }
      }

      if (code(source).includes('"@miolos/db') && found.length === 0) {
        offenders.push(
          `${path}: an @miolos/db reference this scan cannot parse`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it("T-LINT-S37a: the scan is not vacuous — it sees the real imports and would catch a new name", () => {
    const seen = new Set<string>();
    for (const path of webSources()) {
      for (const found of dbImports(readFileSync(path, "utf8"))) {
        for (const name of found.names) {
          seen.add(name.replace(/^type /, ""));
        }
      }
    }

    expect(seen.has("getArchivedDaily")).toBe(true);
    expect(seen.has("listArchivedDays")).toBe(true);
    expect(seen.has("listArchivedMonths")).toBe(true);
    expect(seen.has("archiveDateClass")).toBe(true);
    expect(seen.has("getTodayDaily")).toBe(true);

    expect(
      dbImports('import { sql, users } from "@miolos/db";')[0]?.names,
    ).toEqual(["sql", "users"]);
    expect(
      dbImports(
        'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";',
      )[0]?.from,
    ).toBe("@miolos/db/publishing");

    for (const unparsed of [
      'import * as db from "@miolos/db";',
      'import db from "@miolos/db";',
      'const db = await import("@miolos/db");',
    ]) {
      expect(dbImports(unparsed)).toEqual([]);
      expect(code(unparsed).includes('"@miolos/db')).toBe(true);
    }
  });
});
