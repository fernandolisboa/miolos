import { readdirSync, readFileSync } from "node:fs";
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

// The plain-JS extensions. apps/web/tsconfig.json sets `allowJs` with `checkJs`
// off and next.config.ts overrides no `pageExtensions`, so a `.jsx` under app/
// is a real, typechecking route — and before the step 6 finding
// web-db-wall-glob-misses-js-jsx-mjs the wall's `{ts,tsx,mts,cts}` globs saw
// none of these. T-LINT-9/T-LINT-10 keep the extension list from being
// narrowed back silently, the way T-LINT-7/T-LINT-8 pin the source/test split.
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

  it("T-LINT-S4: packages/core's client contracts never import the server-only ones", () => {
    // The OTHER half of the same wall, and it belongs beside the lint probe
    // rather than in `packages/core/test/`: that package compiles with
    // `"types": []` and `lib: ES2023`, so it cannot name `node:fs` at all.
    //
    // Commit d5bb543 split the content schemas out of `contracts/daily.ts`
    // because a module-scope `z.strictObject(...)` is a call the bundler
    // cannot prove pure — so while they sat in that file every one of them,
    // `nonogramRevealSchema`'s `motifId` / `name` / `mirrored` / `solution`
    // key strings included, was retained in the browser chunk of all eight
    // routes. `daily.ts`'s header states the rule as an absolute
    // ("nothing in this file may import from ./daily-content.ts") and nothing
    // checked it: one re-added import reinstates the regression with
    // typecheck, lint and the whole suite green (step-6 round-3 finding
    // `core-client-server-split-is-prose-only`).
    //
    // A SOURCE read, not a module-graph walk: what the bundler retains is the
    // import, and this must keep failing for a type-only import promoted to a
    // value one.
    // Comments are stripped first, because BOTH file headers discuss the rule
    // in prose and quote the very specifier they forbid — a raw match reds on
    // the documentation instead of on an import.
    const read = (relative: string) =>
      readFileSync(join(repoRoot, relative), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
    const client = read("packages/core/src/contracts/daily.ts");

    expect(client).not.toMatch(/from\s+["']\.\/daily-content/);

    // Anti-vacuity: the stripper left the code, the file is the one meant, and
    // the dependency really does run the other way.
    expect(client).toMatch(/export const nonogramSizeSchema/);
    expect(read("packages/core/src/contracts/daily-content.ts")).toMatch(
      /from\s+["']\.\/daily["']/,
    );
  });

  it("T-LINT-S5: the server-only daily-content schemas are banned by name off @miolos/core", async () => {
    // The client/server split commit d5bb543 landed was enforced by a comment
    // in two file headers and a hand-run bundle grep — a single
    // `import { stripDailyContent } from "@miolos/core"` in a `"use client"`
    // module reinstated the regression with every gate green (step-6 round-3
    // finding `core-client-server-split-is-prose-only`). That the name list is
    // COMPLETE is `T-LINT-S7` below; this is the red proof that it fires.
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

    // The rest of the entry is wall-safe: the CLIENT-facing half must keep
    // importing cleanly, or this ban would be a wall against the app itself.
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
    // The ban above is BARE-SPECIFIER-ONLY, which is the identical hole
    // `T-LINT-3c` closed for `@miolos/db` one ticket earlier: a relative path
    // into the package source linted, typechecked and tested clean while
    // re-shipping `nonogramRevealSchema`'s `motifId` / `name` / `mirrored` /
    // `solution` key strings into every route's browser chunk (step-6 round-4
    // finding `core-server-only-ban-is-bare-specifier-only`). The hand-run
    // bundle tripwire WOULD have caught it, and its own header says nothing in
    // CI invokes it — so a green suite was not evidence.
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

    // The directory itself resolves to its index too.
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

    // And the dynamic form, which `no-restricted-imports` cannot see at all.
    const dynamic = await lintProbe(
      SOURCE_PATH,
      [
        "export const load = () =>",
        '  import("../../../packages/core/src/contracts/daily-content");',
        "",
      ].join("\n"),
    );
    expect(ruleIds(dynamic)).toContain("no-restricted-syntax");

    // The package ENTRY is still importable for its client half — this is a
    // path ban, not a ban on @miolos/core.
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
    // `T-LINT-S5`'s config comment asserts "the names are the five values
    // `packages/core/src/index.ts` re-exports from `contracts/daily-content.ts`"
    // — a guarantee nothing checked. #27 adds `termoDailyContentSchema` to that
    // module and re-exports it; forgetting the one config line would leave it
    // importable from a `"use client"` module with typecheck, lint and the
    // whole suite green, reinstating exactly the bundle regression commit
    // d5bb543 exists to prevent (step-6 round-4 finding ISS-R4-4). #25 blocks
    // #27, so this is the next ticket in the chain.
    //
    // Derived from the SOURCE on both sides rather than from a second hand
    // copy: the module's own `export const|class|function` identifiers, and
    // the `importNames` array read out of the config file.
    const content = readFileSync(
      join(repoRoot, "packages/core/src/contracts/daily-content.ts"),
      "utf8",
    );
    const exported = [
      ...content.matchAll(
        /^export\s+(?:const|class|function)\s+([A-Za-z0-9_$]+)/gm,
      ),
    ].map(([, name]) => name);

    // Anti-vacuity: the regex really did find the module's exports.
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

    // Every value the server-only module exports, and nothing else — a name
    // in the ban that the module no longer exports is just as much a defect,
    // because it reads as coverage that is not there.
    expect([...bannedNames].sort()).toEqual([...exported].sort());

    // The list is only load-bearing if `index.ts` actually re-exports it, so
    // that the bare specifier can reach the names at all.
    const barrel = readFileSync(
      join(repoRoot, "packages/core/src/index.ts"),
      "utf8",
    );
    expect(barrel).toMatch(/from\s+["']\.\/contracts\/daily-content["']/);
  });

  it("T-LINT-S8: the wall fires from apps/web/src/termo/**, and a clean Termo file reports nothing", async () => {
    // #27 adds a whole new source directory to `apps/web/src`, and every glob
    // in the wall is written against `apps/web/src/**` rather than against an
    // enumerated list of game directories. That is a claim about the globs,
    // not about the files, so it is asserted from the new directory itself:
    // a `src/termo` file that reached `@miolos/db/publishing` or named a
    // server-only content schema would ship the credential or the answer
    // shape into the browser chunk of `/termo` (ADR-0024, ADR-0040).
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

    // Anti-vacuity, and the half that keeps the wall from being a wall
    // against the game itself: the client-safe surface a Termo screen
    // actually imports reports ZERO wall hits.
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
    // The T-LINT-S8 claim above, on the source directory #34 adds. It is the
    // same claim — "every glob in the wall is written against
    // `apps/web/src/**` rather than against an enumerated list of
    // directories" — so it takes the sibling letter rather than a fresh id.
    //
    // It matters more here than it did for `src/termo`: `src/og` is the
    // directory whose modules DO read the database, on an unauthenticated
    // crawler-facing path, and #34 adds a fourth flat-config wall object
    // whose globs cover it. Flat config replaces rather than merges, so this
    // is the assertion that the app-wide wall survived that addition from
    // inside the new directory itself (T-LINT-S43 asserts the same thing from
    // the route side).
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

    // Anti-vacuity: what the shipped handlers actually import reports ZERO
    // wall hits. `getPublishedDaily` and `getTodayDaily` are on the root
    // entry and on `WALL_SURFACE`, so `T-LINT-S37` needs no new name either.
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
    // Step 6 finding web-db-wall-has-no-relative-path-ban: the bare-specifier
    // groups match none of this, so `completions` and `hint_grants` were one
    // `../` away from apps/web — falsifying plan 017 D17.
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

    // The directory itself resolves to its index too.
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

  it("T-LINT-3d: `users` and `sessions` are banned by name off the root entry", async () => {
    // Step 6 finding root-entry-users-and-sessions-are-importable-from-apps-web:
    // `db.select().from(users)` needs neither `sql` nor `eq`, so restricting
    // only those two left every user row — and every session token hash — one
    // import away from an RSC payload.
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

  it("T-LINT-4b: a COMPUTED dynamic import specifier is restricted at every apps/web path", async () => {
    // Step 6 finding dynamic-import-selector-misses-computed-specifiers: the
    // literal selector of T-LINT-4 sees only a plain string, so both of these
    // linted clean while resolving at runtime to the very module the wall
    // exists to keep out.
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

    // All three paths, for the same flat-config reason as T-LINT-4: the
    // source-only object REPLACES the rule's configuration rather than merging
    // it, so the selector has to be listed in both arrays.
    for (const path of [SOURCE_PATH, APP_PATH, TEST_PATH]) {
      expect(ruleIds(await lintProbe(path, templateLiteral))).toContain(
        "no-restricted-syntax",
      );
      expect(ruleIds(await lintProbe(path, concatenated))).toContain(
        "no-restricted-syntax",
      );
    }

    // Matching on `source` rather than on "any non-Literal child" is what makes
    // this safe: ImportExpression also carries the options argument, and an
    // import attribute must not be mistaken for a computed specifier.
    const withAttributes = [
      "export async function load() {",
      '  return await import("./data.json", { with: { type: "json" } });',
      "}",
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(SOURCE_PATH, withAttributes))).toEqual([]);
  });

  it("T-LINT-4c: require() is banned at every apps/web path", async () => {
    // no-restricted-imports never sees require(), so covering `.cjs` in the
    // wall globs would leave CommonJS as an open door (step 6 finding
    // web-db-wall-glob-misses-js-jsx-mjs). apps/web is `"type": "module"` and
    // calls require() nowhere, so the whole call is banned.
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

    // `.cjs` is parsed as CommonJS, so its door is require(), not import.
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
    // The hole under T-LINT-9 was worse than a silent wall: eslint-config-next's
    // repo-wide globs are force-scoped to `{ts,tsx}`, so nothing in the repo
    // named `.jsx` and ESLint skipped the file with "File ignored because no
    // matching configuration was supplied" — a green lint on an unlinted route.
    // A rule from js.configs.recommended firing is the proof the file is reached.
    const redeclared = [
      "var a = 1;",
      "var a = 2;",
      "export default a;",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(APP_JSX_PATH, redeclared))).toContain(
      "no-redeclare",
    );

    // And JSX itself must parse: without ecmaFeatures.jsx the file dies at the
    // first `<`, which would report the wall as silent for the wrong reason.
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

  it("T-LINT-S3: the wall fires from apps/web/src/nonogram/**, and a clean nonogram file reports zero", async () => {
    // #25's standing duty (ADR-0024 §5, plan 020 §18): the ticket adds a whole
    // new directory under `apps/web/src/`, and the wall's globs are
    // `apps/web/**` / `apps/web/src/**` — so it covers the new path BY
    // CONSTRUCTION rather than by anyone remembering to widen a list. That is
    // exactly the kind of claim worth a red proof: a future narrowing of the
    // glob to a per-feature list would pass every other test in this file.
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

    // And the other half: the wall is not a blanket ban on the directory. The
    // two imports every real nonogram module makes report nothing.
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

/**
 * AC 2 as a TEST rather than a hand-run grep (#31, ADR-0014 :16 / ADR-0053
 * decision 4). The issue's second acceptance criterion is that `apps/web`'s
 * direct database reads go only through the published-predicate helper, with
 * no parallel query path — and until #31 that was a sentence in a PR body.
 *
 * A source scan in `T-WEB-S166`'s register: it enumerates every `@miolos/db`
 * import in `apps/web` and asserts the imported NAMES are wall readers.
 * ESLint already bans the dangerous subpaths and the four bypass names off
 * the root entry; what it cannot express is "and nothing NEW on the root
 * entry either", which is the thing an archive PR is most likely to get
 * wrong.
 */
// The ids in this file live on `it(...)`, never on the `describe` — every
// other block here does it that way, and `docs/agents/test-ids.md` records
// `eslint-*-wall.test.ts` as keeping its own convention. This block landed
// carrying the id on the `describe` AND on both of its `it`s, which is a
// same-file duplicate whichever convention you read it under (step-7
// verification round, plan 037 §14 I65). `T-LINT-S37` stays on the assertion §13's AC 2 cites; the
// counter-assertion added at step 7 takes the sibling letter.
describe("no parallel query path in apps/web", () => {
  /**
   * The wall readers `apps/web` may name, plus the one type the archive's
   * grouping helper takes. Every one of them carries `published_at <= now()`
   * and `killed_at IS NULL` in SQL — `archiveDateClass` is the single
   * exception and it reads no table at all, so there is nothing for a wall
   * to guard (ADR-0053 decision 4).
   *
   * Adding a name here without adding its wall tests in `packages/db` is the
   * move this list exists to make visible.
   */
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

  /**
   * The file with its comments removed, so the counter-assertion below
   * counts CODE references to `@miolos/db` and not the doc blocks that
   * discuss the wall at length. The same stripper `archive-routes.test.ts`
   * uses, and it deliberately does not eat the `//` of a URL scheme.
   */
  function code(source: string): string {
    return source
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/(^|[^:])\/\/.*$/gm, "$1");
  }

  /** Every `@miolos/db*` import in the file, as `{ from, names }`. */
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
      // THE COUNTER-ASSERTION, and it is what makes this suite AC 2's proof
      // rather than a scan of one import shape (step-6 F19). The parser above
      // only sees BRACED named imports, so `import * as db from "@miolos/db"`,
      // a default import and `await import("@miolos/db")` all pass it by
      // yielding no matches at all — and the root entry is deliberately NOT
      // ESLint-banned, which is this suite's whole premise, so the one hole
      // sits in the one place the test claims to cover. A file that mentions
      // the package in code and yields no parsed import is now an offender:
      // an unparsed import shape reds instead of passing.
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
    // The archive's four readers really are found by the parser above, so an
    // empty offender list means "all clean", not "nothing scanned".
    expect(seen.has("getArchivedDaily")).toBe(true);
    expect(seen.has("listArchivedDays")).toBe(true);
    expect(seen.has("listArchivedMonths")).toBe(true);
    expect(seen.has("archiveDateClass")).toBe(true);
    expect(seen.has("getTodayDaily")).toBe(true);
    // And a planted parallel path is seen for what it is.
    expect(
      dbImports('import { sql, users } from "@miolos/db";')[0]?.names,
    ).toEqual(["sql", "users"]);
    expect(
      dbImports(
        'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";',
      )[0]?.from,
    ).toBe("@miolos/db/publishing");

    // The three shapes the parser CANNOT read, pinned as unreadable so the
    // counter-assertion above is the thing catching them and nobody later
    // mistakes the parser for exhaustive (step-6 F19).
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
