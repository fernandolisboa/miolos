import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it } from "vitest";

/**
 * Mechanical proof that the FREE-PLAY wall (#28, ADR-0046; plan 025 §9.1)
 * actually fires — the `eslint-db-wall.test.ts` architecture applied to the
 * new directories. Every red probe sits beside a clean probe at a DAILY
 * path, proving the ban is scoped rather than accidentally global; and the
 * two replacement-regression probes (S14/S15) prove the new flat-config
 * object REPEATED the app-wide walls instead of silently replacing them
 * with less — the trap the config's own comments name.
 */
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

/** A probe inside the walled directory... */
const FREE_PATH = "apps/web/src/free-play/eslint-probe.ts";
/** ...its route-segment sibling (T-LINT-S13 pins the second glob)... */
const ROUTE_PATH = "apps/web/app/modo-livre/binairo/page.tsx";
/** ...and the scope control: the same imports are legal from a daily path. */
const DAILY_PATH = "apps/web/src/binairo/eslint-probe.ts";

describe("the free-play import wall (#28, ADR-0046)", () => {
  it("T-LINT-S9: the sync/record/lifecycle modules are banned from free play, clean from a daily path", async () => {
    const doors = [
      "../play/sync",
      "../play/play-record",
      "../play/use-play-lifecycle",
      "../play/day-state",
      "../play/use-record-snapshot",
    ];
    for (const door of doors) {
      const source = [
        `import * as banned from "${door}";`,
        "",
        "export const probe = banned;",
        "",
      ].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, source)), door)
        .toContain("no-restricted-imports");
      // Scope control: the identical specifier from the daily directory
      // reports no wall hit — the ban is the directory's, not the app's.
      expect
        .soft(wallHits(await lintProbe(DAILY_PATH, source)), door)
        .toEqual([]);
    }
  });

  it("T-LINT-S10: termo/guess-client and both session-bootstrap shapes are banned from free play, clean from a daily path", async () => {
    const doors = [
      "../termo/guess-client",
      "../session/bootstrap",
      "../components/session-bootstrap",
    ];
    for (const door of doors) {
      const source = [
        `import * as banned from "${door}";`,
        "",
        "export const probe = banned;",
        "",
      ].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, source)), door)
        .toContain("no-restricted-imports");
      expect
        .soft(wallHits(await lintProbe(DAILY_PATH, source)), door)
        .toEqual([]);
    }
  });

  it("T-LINT-S11: the @miolos/db ROOT entry is banned from free play — stricter than the app-wide wall", async () => {
    const source = [
      'import { getTodayDaily } from "@miolos/db";',
      "",
      "export const read = getTodayDaily;",
      "",
    ].join("\n");

    expect(ruleIds(await lintProbe(FREE_PATH, source))).toContain(
      "no-restricted-imports",
    );
    // The control that makes "stricter" a measured claim: the same import
    // is the wall-safe surface everywhere else in apps/web.
    expect(wallHits(await lintProbe(DAILY_PATH, source))).toEqual([]);
  });

  it("T-LINT-S12: @miolos/games/termo is banned in every shape; @miolos/games/binairo is clean", async () => {
    const bare = [
      'import { TERMO_ANSWER_WORDS } from "@miolos/games/termo";',
      "",
      "export const list = TERMO_ANSWER_WORDS;",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PATH, bare))).toContain(
      "no-restricted-imports",
    );

    const deep = [
      'import * as termo from "../../../packages/games/src/termo/words";',
      "",
      "export const probe = termo;",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PATH, deep))).toContain(
      "no-restricted-imports",
    );

    const dynamic = [
      "export const load = () =>",
      '  import("@miolos/games/termo");',
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PATH, dynamic))).toContain(
      "no-restricted-syntax",
    );

    // The control: the game engines free play exists to consume.
    const clean = [
      'import { generateBinairo } from "@miolos/games/binairo";',
      "",
      "export const generate = generateBinairo;",
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(FREE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S13: the app/modo-livre glob carries the same wall", async () => {
    const source = [
      'import * as sync from "../../../src/play/sync";',
      "",
      "export default function Page() {",
      "  return <main data-probe={String(sync)} />;",
      "}",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(ROUTE_PATH, source))).toContain(
      "no-restricted-imports",
    );

    // And the segment is not walled off from what its pages actually do.
    const clean = [
      "export default function Page() {",
      "  return <main data-play-state='generating' />;",
      "}",
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(ROUTE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S14: replacement regression — the db subpath wall still fires inside free play, with the app-wide message", async () => {
    // Flat config REPLACES a rule's configuration per file. If the
    // free-play object had not repeated the app-wide patterns, this exact
    // probe would lint CLEAN inside the free-play directory while redding
    // everywhere else — the silent deletion the config comments warn about.
    const messages = await lintProbe(
      FREE_PATH,
      [
        'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";',
        "",
        "export const read = getPublishedDailyWithSolution;",
        "",
      ].join("\n"),
    );
    expect(ruleIds(messages)).toContain("no-restricted-imports");
    // The MESSAGE is the app-wide wall's own, proving the repetition
    // carried the original rule rather than shadowing it with a lookalike.
    expect(
      messages.some((message) =>
        message.message.includes("wall-safe root entry"),
      ),
    ).toBe(true);
  });

  it("T-LINT-S15: replacement regression — the table-name literal selectors still fire inside free play", async () => {
    const stringLiteral = await lintProbe(
      FREE_PATH,
      ['export const table = "daily_puzzles";', ""].join("\n"),
    );
    expect(ruleIds(stringLiteral)).toContain("no-restricted-syntax");

    const template = await lintProbe(
      FREE_PATH,
      ["export const query = `select * from remote_config`;", ""].join("\n"),
    );
    expect(ruleIds(template)).toContain("no-restricted-syntax");
  });

  it("T-LINT-S16: dynamic-import evasions of the free-play bans red; a local dynamic import is clean", async () => {
    const doors = [
      '  import("../play/sync");',
      '  import("../play/play-record");',
      '  import("../binairo/use-binairo-play");',
      '  import("@miolos/db");',
    ];
    for (const door of doors) {
      const source = ["export const load = () =>", door, ""].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, source)), door)
        .toContain("no-restricted-syntax");
    }

    const clean = [
      "export const load = () =>",
      '  import("./catalog");',
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(FREE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S17: the indirect doors — daily hooks, screen roots and conclusion-view — red from free play, clean from a daily path", async () => {
    // `no-restricted-imports` is per-file, not transitive: a free-play file
    // importing `use-binairo-play` would reach `use-play-lifecycle` and
    // `sync.ts` through a door the direct bans never see, so every known
    // indirect door is banned by name (plan 025 §9.1).
    const doors = [
      "../binairo/use-binairo-play",
      "../sudoku/use-sudoku-play",
      "../nonogram/use-nonogram-play",
      "../binairo/binairo-screen",
      "../sudoku/sudoku-screen",
      "../nonogram/nonogram-screen",
      "../play/conclusion-view",
    ];
    for (const door of doors) {
      const source = [
        `import * as banned from "${door}";`,
        "",
        "export const probe = banned;",
        "",
      ].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, source)), door)
        .toContain("no-restricted-imports");
      // From a daily path the same specifiers are ordinary architecture:
      // the sudoku directory may import its own screen root, and the
      // conclusion is the daily's own surface.
      expect
        .soft(wallHits(await lintProbe(DAILY_PATH, source)), door)
        .toEqual([]);
    }
  });

  it("T-LINT-S21: the streak modules — client, hook, hub island and the bare barrel form — red from free play, clean from a daily path", async () => {
    // #19's growth clause (plan 027 D9): `no-restricted-imports` bans by
    // NAME and is non-transitive, so ADR-0046's "free play never touches
    // the streak" stays true only because these names entered the list in
    // the same change that created the modules. The bare `../streak` form
    // is listed because `**/streak/**` does not match it — a future
    // `src/streak/index.ts` barrel must not become a door.
    const doors = [
      "../streak/streak-client",
      "../streak/use-streak",
      "../../app/hub-streak",
      "../streak",
    ];
    for (const door of doors) {
      const source = [
        `import * as banned from "${door}";`,
        "",
        "export const probe = banned;",
        "",
      ].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, source)), door)
        .toContain("no-restricted-imports");
      // Scope control: the identical specifiers are ordinary architecture
      // from a daily path — the hub island and the conclusion card import
      // them.
      expect
        .soft(wallHits(await lintProbe(DAILY_PATH, source)), door)
        .toEqual([]);
    }
  });

  it("T-LINT-S22: dynamic-import evasions of the streak bans red, the bare barrel form included; a local dynamic import stays clean", async () => {
    const doors = [
      '  import("../streak/streak-client");',
      '  import("../streak/use-streak");',
      '  import("../../app/hub-streak");',
      '  import("../streak");',
    ];
    for (const door of doors) {
      const source = ["export const load = () =>", door, ""].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, source)), door)
        .toContain("no-restricted-syntax");
    }

    const clean = [
      "export const load = () =>",
      '  import("./catalog");',
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(FREE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S18: the free-play directory's LEGAL surface lints clean — the wall is not a blanket ban", async () => {
    const clean = [
      'import { generateBinairo } from "@miolos/games/binairo";',
      'import { nextHint } from "../play/grid-hint";',
      'import { countFilled } from "../play/progress";',
      'import { accentVars } from "../play/accent";',
      'import { initPlayState } from "../binairo/state";',
      'import { messages, routes } from "../i18n";',
      "",
      "export const legal = {",
      "  generateBinairo,",
      "  nextHint,",
      "  countFilled,",
      "  accentVars,",
      "  initPlayState,",
      "  messages,",
      "  routes,",
      "};",
      "",
    ].join("\n");

    expect(wallHits(await lintProbe(FREE_PATH, clean))).toEqual([]);
  });
});
