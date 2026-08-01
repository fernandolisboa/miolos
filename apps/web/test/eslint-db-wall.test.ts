import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

// Mechanical proof that the ADR-0024 §5 wall (and its 2026-07-31 amendment,
// a named #18 duty) actually fires. The rules live in the ROOT
// eslint.config.mjs and are exercised here through ESLint's Node API against
// the real config file — asserting on the config object's shape would prove
// nothing about what `pnpm lint` does.
//
// TRAP, verified: `projectService: false` alone does NOT lint. The root config
// enables tseslint.configs.recommendedTypeChecked, and the first type-aware
// rule aborts the whole lintText call with
//   Error while loading rule '@typescript-eslint/await-thenable':
//   You have used a rule which requires type information…
// Spreading `disableTypeChecked` into the SAME override object is what makes
// the harness work. Both rules under test are purely syntactic, so nothing
// under test is weakened by it (plan 017 §14, disposition adr-2/testability-2).
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

/** The two rule ids that carry the wall. Everything else is noise here. */
const WALL_RULES = ["no-restricted-imports", "no-restricted-syntax"];

/**
 * Lint a probe as if it lived at `relativePath`. Nothing is written to disk:
 * `pnpm lint` must never see a deliberately-broken FILE, and the probe strings
 * below (which contain the banned table names on purpose) only ever exist
 * inside this test source — which the table-literal glob deliberately excludes
 * (plan 017 §14, T-LINT-7).
 */
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

    // `import type` is still an ImportDeclaration: a type-only door into the
    // server-internal surface would let apps/web NAME the banned tables.
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
    // The `paths` half of rule (1): the root entry is wall-safe as a whole,
    // but its raw-SQL re-exports are the residual the ADR-0024 amendment
    // names. Without a red proof this half of the rule is not a gate.
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

  it("T-LINT-4: dynamic import of a server-internal subpath is restricted, at SOURCE and test paths", async () => {
    const banned = [
      "export async function load() {",
      '  return await import("@miolos/db/publishing");',
      "}",
      "",
    ].join("\n");

    // Both paths on purpose. `apps/web/src/**` matches BOTH wall config
    // objects, and flat config REPLACES a rule's whole configuration rather
    // than merging it — so the source-only object must carry this selector
    // too or the dynamic-import door reopens exactly where src/db.ts lives.
    // Departure from plan 017 §14, proven red before it was fixed.
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

  it("T-LINT-8: the import bans still fire under apps/web/test/**", async () => {
    // The source/test split narrows only the table-literal selectors. If a
    // future edit widens the exemption to the import bans, this goes red.
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

    // The TemplateElement companion is not optional: a tagged `sql` template
    // slips straight through a Literal-only selector.
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

    // `\b` spares a longer word that merely starts with a banned name.
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
    // Pins the source/test split itself. `pnpm lint` lints apps/web/test, and
    // THIS file must contain the banned strings to prove the rules fire — so
    // narrowing the literal selectors to source is what keeps the lint gate
    // green. Nobody "simplifies" the glob back without going red here.
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
});
