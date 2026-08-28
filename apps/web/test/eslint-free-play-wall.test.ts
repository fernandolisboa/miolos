import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it, vi } from "vitest";

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

const FREE_PATH = "apps/web/src/free-play/eslint-probe.ts";

const ROUTE_PATH = "apps/web/app/modo-livre/binairo/page.tsx";

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

    const clean = [
      'import { generateBinairo } from "@miolos/games/binairo";',
      "",
      "export const generate = generateBinairo;",
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(FREE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S58: the node_modules/@miolos symlink spellings of the Termo ban AND the db ROOT ban red from free play", async () => {
    const termoStatic = [
      'import * as termo from "../node_modules/@miolos/games/src/termo/words";',
      "",
      "export const probe = termo;",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PATH, termoStatic))).toContain(
      "no-restricted-imports",
    );

    const termoDynamic = [
      "export const load = () =>",
      '  import("../node_modules/@miolos/games/src/termo/words");',
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PATH, termoDynamic))).toContain(
      "no-restricted-syntax",
    );

    const dbRootStatic = [
      'import { getTodayDaily } from "../node_modules/@miolos/db";',
      "",
      "export const read = getTodayDaily;",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PATH, dbRootStatic))).toContain(
      "no-restricted-imports",
    );

    const dbRootDynamic = [
      "export const load = () =>",
      '  import("../node_modules/@miolos/db");',
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PATH, dbRootDynamic))).toContain(
      "no-restricted-syntax",
    );

    expect(wallHits(await lintProbe(DAILY_PATH, dbRootStatic))).toEqual([]);

    const clean = [
      'import { generateBinairo } from "../node_modules/@miolos/games/src/binairo";',
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

    const clean = [
      "export default function Page() {",
      "  return <main data-play-state='generating' />;",
      "}",
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(ROUTE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S14: replacement regression — the db subpath wall still fires inside free play, with the app-wide message", async () => {
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

      '  import("../play/conclusion-lazy");',
      '  import("../nonogram/nonogram-conclusion");',
      '  import("../termo/termo-conclusion");',
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
    const doors = [
      "../binairo/use-binairo-play",
      "../sudoku/use-sudoku-play",
      "../nonogram/use-nonogram-play",
      "../binairo/binairo-screen",
      "../sudoku/sudoku-screen",
      "../nonogram/nonogram-screen",
      "../play/conclusion-view",

      "../play/conclusion-lazy",
      "../nonogram/nonogram-conclusion",
      "../termo/termo-conclusion",
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

  it("T-LINT-S21: the streak modules — client, hook, hub island and the bare barrel form — red from free play, clean from a daily path", async () => {
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

  it("T-LINT-S24: the hub page and hub-day-state — one-hop doors to day-state and the streak — red from free play, clean from a daily path", async () => {
    const doors = ["../../app/page", "../../app/hub-day-state"];
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

  it("T-LINT-S25: dynamic-import evasions of the hub-page bans red; a local dynamic import stays clean", async () => {
    const doors = [
      '  import("../../app/page");',
      '  import("../../app/hub-day-state");',
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

  it("T-LINT-S26: the attach modules — client, hook and the bare barrel form — red from free play, clean from a daily path", async () => {
    const doors = [
      "../attach/attach-client",
      "../attach/use-attach-state",
      "../attach",
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

  it("T-LINT-S27: dynamic-import evasions of the attach bans red, the bare barrel form included; a local dynamic import stays clean", async () => {
    const doors = [
      '  import("../attach/attach-client");',
      '  import("../attach/use-attach-state");',
      '  import("../attach");',
      '  import("../../app/hub-attach");',
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

  it("T-LINT-S28: the hub-attach island — one hop from the hub page and the attach client — red from free play, clean from a daily path", async () => {
    const source = [
      'import * as banned from "../../app/hub-attach";',
      "",
      "export const probe = banned;",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PATH, source))).toContain(
      "no-restricted-imports",
    );
    expect(wallHits(await lintProbe(DAILY_PATH, source))).toEqual([]);
  });

  it("T-LINT-S49: the onboarding modules — client, hook, bare barrel form and the hub island — red from free play through BOTH arms, static and dynamic; clean from a daily path", async () => {
    const doors = [
      "../onboarding/onboarding-client",
      "../onboarding/use-onboarding-state",
      "../onboarding",
      "../../app/hub-onboarding",
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

    for (const door of doors) {
      const source = [
        "export const load = () =>",
        `  import("${door}");`,
        "",
      ].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, source)), `dynamic ${door}`)
        .toContain("no-restricted-syntax");
    }
    const clean = [
      "export const load = () =>",
      '  import("./catalog");',
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(FREE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S50: the push modules — client, hook, bare barrel form and the prompt card — red from free play through BOTH arms, static and dynamic; clean from a daily path", async () => {
    const doors = [
      "../push/push-client",
      "../push/use-push-state",
      "../push",
      "../play/push-prompt-card",
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

    for (const door of doors) {
      const source = [
        "export const load = () =>",
        `  import("${door}");`,
        "",
      ].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, source)), `dynamic ${door}`)
        .toContain("no-restricted-syntax");
    }
    const clean = [
      "export const load = () =>",
      '  import("./catalog");',
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(FREE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S31: the stats modules and the /estatisticas screen root — the bare barrel form included — red from free play, clean from a daily path", async () => {
    const doors = [
      "../stats/stats-client",
      "../stats/use-stats",
      "../stats/use-stats-calendar",
      "../stats",
      "../../app/estatisticas/page",
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

  it("T-LINT-S32: dynamic-import evasions of the stats bans red, the bare barrel form included; a local dynamic import stays clean", async () => {
    const doors = [
      '  import("../stats/stats-client");',
      '  import("../stats/use-stats-calendar");',
      '  import("../stats");',
      '  import("../../app/estatisticas/page");',
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

  it("T-LINT-S33: the medals modules — client, hook and the bare barrel form — red from free play, clean from a daily path", async () => {
    const doors = [
      "../medals/medals-client",
      "../medals/use-medals",
      "../medals",
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

  it("T-LINT-S34: dynamic-import evasions of the medals bans red, the bare barrel form included; a local dynamic import stays clean", async () => {
    const doors = [
      '  import("../medals/medals-client");',
      '  import("../medals/use-medals");',
      '  import("../medals");',
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

  it("T-LINT-S35: the archive modules — the screens, the panel and the bare barrel form — red from free play, clean from a daily path", async () => {
    const doors = [
      "../archive/sudoku-screen",
      "../archive/late-result",
      "../archive/chrome",
      "../archive",
      "../../app/arquivo/page",

      "../../app/arquivo/calendar-grid",
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

  it("T-LINT-S36: dynamic-import evasions of the archive bans red, the bare barrel form included; a local dynamic import stays clean", async () => {
    const doors = [
      '  import("../archive/sudoku-screen");',
      '  import("../archive/late-result");',
      '  import("../archive");',
      '  import("../../app/arquivo/page");',
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

  it("T-LINT-S39: play/share-text AND play/share-button are banned from free play, clean from a daily path", async () => {
    const source = [
      'import { buildShareText } from "../play/share-text";',
      "",
      "export const probe = buildShareText;",
      "",
    ].join("\n");

    expect(ruleIds(await lintProbe(FREE_PATH, source))).toContain(
      "no-restricted-imports",
    );
    expect(ruleIds(await lintProbe(ROUTE_PATH, source))).toContain(
      "no-restricted-imports",
    );

    expect(wallHits(await lintProbe(DAILY_PATH, source))).toEqual([]);

    const button = [
      'import { ShareButton } from "../play/share-button";',
      "",
      "export const probe = ShareButton;",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PATH, button))).toContain(
      "no-restricted-imports",
    );
    expect(ruleIds(await lintProbe(ROUTE_PATH, button))).toContain(
      "no-restricted-imports",
    );

    expect(wallHits(await lintProbe(DAILY_PATH, button))).toEqual([]);
  });

  it("T-LINT-S40: the dynamic-import evasion of the share-text and share-button bans reds; a local dynamic import stays clean", async () => {
    for (const specifier of ["../play/share-text", "../play/share-button"]) {
      const dynamic = [
        "export const load = () =>",
        `  import("${specifier}");`,
        "",
      ].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, dynamic)), specifier)
        .toContain("no-restricted-syntax");
    }
    const source = [
      "export const load = () =>",
      '  import("../play/share-text");',
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PATH, source))).toContain(
      "no-restricted-syntax",
    );

    const clean = [
      "export const load = () =>",
      '  import("./share-nothing");',
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(FREE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S47: the day modules — client, store and the bare barrel form — red from free play, clean from a daily path", async () => {
    const doors = ["../day/day-client", "../day/day-truth", "../day"];
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

    for (const neighbour of ["../play/day-state", "../../app/hub-day-state"]) {
      const source = [
        `import * as ok from "${neighbour}";`,
        "",
        "export const probe = ok;",
        "",
      ].join("\n");
      expect
        .soft(wallHits(await lintProbe(DAILY_PATH, source)), neighbour)
        .toEqual([]);
    }
  });

  it("T-LINT-S48: dynamic-import evasions of the day bans red, the bare barrel form included; a local dynamic import stays clean", async () => {
    const doors = [
      '  import("../day/day-client");',
      '  import("../day/day-truth");',
      '  import("../day");',
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

  it("T-LINT-S52: the telemetry relay client — and the bare barrel form — red from free play through BOTH arms, static and dynamic; clean from a daily path", async () => {
    const doors = ["../telemetry/client", "../telemetry"];
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
        .soft(ruleIds(await lintProbe(ROUTE_PATH, source)), `route ${door}`)
        .toContain("no-restricted-imports");

      expect
        .soft(wallHits(await lintProbe(DAILY_PATH, source)), door)
        .toEqual([]);
    }

    for (const door of doors) {
      const source = [
        "export const load = () =>",
        `  import("${door}");`,
        "",
      ].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, source)), `dynamic ${door}`)
        .toContain("no-restricted-syntax");
    }

    const clean = [
      "export const load = () =>",
      '  import("./catalog");',
      "",
    ].join("\n");
    expect(wallHits(await lintProbe(FREE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S61: the shared authenticated mount fetch — and the bare barrel form — red from free play through BOTH arms, static and dynamic; clean from a daily path", async () => {
    const doors = ["../api/use-mount-fetch", "../api"];
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
        .soft(ruleIds(await lintProbe(ROUTE_PATH, source)), `route ${door}`)
        .toContain("no-restricted-imports");

      expect
        .soft(wallHits(await lintProbe(DAILY_PATH, source)), door)
        .toEqual([]);
    }

    for (const door of doors) {
      const source = [
        "export const load = () =>",
        `  import("${door}");`,
        "",
      ].join("\n");
      expect
        .soft(ruleIds(await lintProbe(FREE_PATH, source)), `dynamic ${door}`)
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
