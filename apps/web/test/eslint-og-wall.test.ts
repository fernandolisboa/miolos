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

const OG_SOURCE_PATH = "apps/web/src/og/eslint-probe.ts";

const ROOT_CARD_PATH = "apps/web/app/opengraph-image.tsx";

const DAILY_CARD_PATH = "apps/web/app/sudoku/opengraph-image.tsx";
const ARCHIVE_CARD_PATH =
  "apps/web/app/arquivo/[data]/sudoku/opengraph-image.tsx";

const TWITTER_CARD_PATH = "apps/web/app/sudoku/twitter-image.tsx";

const FREE_PLAY_CARD_PATH = "apps/web/app/modo-livre/opengraph-image.tsx";

const FREE_PLAY_PAGE_PATH = "apps/web/app/modo-livre/page.tsx";

const DAY_CARD_ROUTE_PATH = "apps/web/app/cartao/[data]/route.ts";
const MONTH_CARD_ROUTE_PATH = "apps/web/app/cartao/mes/[mes]/route.ts";

const OG_PATHS = [
  OG_SOURCE_PATH,
  ROOT_CARD_PATH,
  DAILY_CARD_PATH,
  ARCHIVE_CARD_PATH,
  TWITTER_CARD_PATH,
  DAY_CARD_ROUTE_PATH,
  MONTH_CARD_ROUTE_PATH,
];

const SHARE_TEXT_PATH = "apps/web/src/play/share-text.ts";
const PAGE_PATH = "apps/web/app/sudoku/page.tsx";

describe("the OG import wall (#34, ADR-0054 decision 8)", () => {
  it("T-LINT-S41: @miolos/games is banned from the card and the image routes, clean elsewhere", async () => {
    const doors = [
      "@miolos/games",
      "@miolos/games/nonogram",
      "../../../packages/games/src/nonogram",
    ];
    for (const door of doors) {
      const source = [
        `import { solveNonogram } from "${door}";`,
        "",
        "export const probe = solveNonogram;",
        "",
      ].join("\n");
      for (const path of OG_PATHS) {
        expect
          .soft(ruleIds(await lintProbe(path, source)), `${door} @ ${path}`)
          .toContain("no-restricted-imports");
      }

      expect
        .soft(wallHits(await lintProbe(SHARE_TEXT_PATH, source)), door)
        .toEqual([]);
      expect
        .soft(wallHits(await lintProbe(PAGE_PATH, source)), door)
        .toEqual([]);
    }
  });

  it("T-LINT-S42: the dynamic-import evasion of the games ban reds; a local dynamic import stays clean", async () => {
    for (const door of ["@miolos/games/nonogram", "../../packages/games/src"]) {
      const source = [
        "export const load = () =>",
        `  import("${door}");`,
        "",
      ].join("\n");
      for (const path of OG_PATHS) {
        expect
          .soft(ruleIds(await lintProbe(path, source)), `${door} @ ${path}`)
          .toContain("no-restricted-syntax");
      }
      expect
        .soft(wallHits(await lintProbe(SHARE_TEXT_PATH, source)), door)
        .toEqual([]);
    }

    const clean = ["export const load = () =>", '  import("./card");', ""].join(
      "\n",
    );
    expect(wallHits(await lintProbe(OG_SOURCE_PATH, clean))).toEqual([]);
  });

  it("T-LINT-S57: the node_modules/@miolos symlink spelling of the games ban reds too, static and dynamic", async () => {
    const staticDoors = [
      "../../../node_modules/@miolos/games/src/nonogram",
      "../node_modules/@miolos/games/src",
    ];
    for (const door of staticDoors) {
      const source = [
        `import { solveNonogram } from "${door}";`,
        "",
        "export const probe = solveNonogram;",
        "",
      ].join("\n");
      for (const path of OG_PATHS) {
        expect
          .soft(ruleIds(await lintProbe(path, source)), `${door} @ ${path}`)
          .toContain("no-restricted-imports");
      }

      expect
        .soft(wallHits(await lintProbe(SHARE_TEXT_PATH, source)), door)
        .toEqual([]);
      expect
        .soft(wallHits(await lintProbe(PAGE_PATH, source)), door)
        .toEqual([]);
    }

    for (const door of staticDoors) {
      const source = [
        "export const load = () =>",
        `  import("${door}");`,
        "",
      ].join("\n");
      for (const path of OG_PATHS) {
        expect
          .soft(ruleIds(await lintProbe(path, source)), `dyn ${door} @ ${path}`)
          .toContain("no-restricted-syntax");
      }
      expect
        .soft(wallHits(await lintProbe(SHARE_TEXT_PATH, source)), `dyn ${door}`)
        .toEqual([]);
    }
  });

  it("T-LINT-S43: replacement regression — the app-wide db wall still fires inside the OG surface", async () => {
    const probes: [string, string, string][] = [
      [
        "db subpath",
        'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";\nexport const p = getPublishedDailyWithSolution;\n',
        "no-restricted-imports",
      ],
      [
        "relative into packages/db/src",
        'import { dailyPuzzles } from "../../../packages/db/src/schema";\nexport const p = dailyPuzzles;\n',
        "no-restricted-imports",
      ],
      [
        "root entry sql / users",
        'import { sql, users } from "@miolos/db";\nexport const p = { sql, users };\n',
        "no-restricted-imports",
      ],
      [
        "stripDailyContent from @miolos/core",
        'import { stripDailyContent } from "@miolos/core";\nexport const p = stripDailyContent;\n',
        "no-restricted-imports",
      ],
      [
        "table-name literal",
        'export const t = "daily_puzzles";\n',
        "no-restricted-syntax",
      ],
      [
        "table-name template",
        "export const q = `select * from remote_config`;\n",
        "no-restricted-syntax",
      ],
      [
        "computed dynamic import",
        "export const load = (s: string) => import(s);\n",
        "no-restricted-syntax",
      ],
      [
        "require()",
        'export const p = require("@miolos/db");\n',
        "no-restricted-syntax",
      ],
    ];

    let messageCount = 0;
    for (const [label, source, rule] of probes) {
      const messages = await lintProbe(ROOT_CARD_PATH, source);
      expect.soft(ruleIds(messages), label).toContain(rule);
      messageCount += wallHits(messages).length;
    }

    expect(messageCount).toBe(9);

    const subpath = await lintProbe(
      ROOT_CARD_PATH,
      'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";\nexport const p = getPublishedDailyWithSolution;\n',
    );
    expect(
      subpath.some((message) =>
        message.message.includes("wall-safe root entry"),
      ),
    ).toBe(true);
  });

  it("T-LINT-S44: the wall's globs reach all nine route paths, the root path included", async () => {
    const source = [
      'import { solveNonogram } from "@miolos/games/nonogram";',
      "",
      "export const probe = solveNonogram;",
      "",
    ].join("\n");

    const games = ["binairo", "sudoku", "nonogram", "termo"];
    const everyRoute = [
      "apps/web/app/opengraph-image.tsx",
      ...games.map((game) => `apps/web/app/${game}/opengraph-image.tsx`),
      ...games.map(
        (game) => `apps/web/app/arquivo/[data]/${game}/opengraph-image.tsx`,
      ),
    ];
    expect(everyRoute).toHaveLength(9);
    for (const path of everyRoute) {
      expect
        .soft(ruleIds(await lintProbe(path, source)), path)
        .toContain("no-restricted-imports");
    }

    for (const path of [OG_SOURCE_PATH, TWITTER_CARD_PATH]) {
      expect
        .soft(ruleIds(await lintProbe(path, source)), path)
        .toContain("no-restricted-imports");
    }

    expect(wallHits(await lintProbe(PAGE_PATH, source))).toEqual([]);
  });

  it("T-LINT-S45: the OG surface's LEGAL imports lint clean — the wall is not a blanket ban", async () => {
    const clean = [
      'import type { ProjectedGame } from "@miolos/core";',
      "import {",
      "  getPublishedDaily,",
      "  getTodayDaily,",

      "  listArchivedDays,",
      '} from "@miolos/db";',
      'import { ImageResponse } from "next/og";',
      "",
      "export const legal = {",
      "  getPublishedDaily,",
      "  getTodayDaily,",
      "  listArchivedDays,",
      "  ImageResponse,",
      "};",
      "export type G = ProjectedGame;",
      "",
    ].join("\n");

    for (const path of OG_PATHS) {
      expect.soft(wallHits(await lintProbe(path, clean)), path).toEqual([]);
    }
  });

  it("T-LINT-S54: the wall reaches the two /cartao card handlers, games ban AND db wall", async () => {
    const cardPaths = [DAY_CARD_ROUTE_PATH, MONTH_CARD_ROUTE_PATH];

    const games = [
      'import { solveNonogram } from "@miolos/games/nonogram";',
      "",
      "export const probe = solveNonogram;",
      "",
    ].join("\n");
    const dynamicGames =
      'export const load = () => import("@miolos/games/nonogram");\n';
    for (const path of cardPaths) {
      expect
        .soft(ruleIds(await lintProbe(path, games)), `games @ ${path}`)
        .toContain("no-restricted-imports");
      expect
        .soft(ruleIds(await lintProbe(path, dynamicGames)), `dynamic @ ${path}`)
        .toContain("no-restricted-syntax");
    }

    const dbProbes: [string, string, string][] = [
      [
        "db subpath",
        'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";\nexport const p = getPublishedDailyWithSolution;\n',
        "no-restricted-imports",
      ],
      [
        "relative into packages/db/src",
        'import { dailyPuzzles } from "../../../../packages/db/src/schema";\nexport const p = dailyPuzzles;\n',
        "no-restricted-imports",
      ],
      [
        "table-name literal",
        'export const t = "daily_puzzles";\n',
        "no-restricted-syntax",
      ],
      [
        "computed dynamic import",
        "export const load = (s: string) => import(s);\n",
        "no-restricted-syntax",
      ],
    ];
    for (const path of cardPaths) {
      for (const [label, source, rule] of dbProbes) {
        expect
          .soft(ruleIds(await lintProbe(path, source)), `${label} @ ${path}`)
          .toContain(rule);
      }
    }

    for (const path of cardPaths) {
      const subpath = await lintProbe(
        path,
        'import { getPublishedDailyWithSolution } from "@miolos/db/publishing";\nexport const p = getPublishedDailyWithSolution;\n',
      );
      expect
        .soft(
          subpath.some((message) =>
            message.message.includes("wall-safe root entry"),
          ),
          path,
        )
        .toBe(true);
    }
  });

  it("T-LINT-S46: the OG wall does not DELETE the free-play wall where the two globs intersect", async () => {
    const probes: [string, string][] = [
      [
        "play/sync",
        'import { startCompletionSync } from "../../src/play/sync";\nexport const p = startCompletionSync;\n',
      ],
      [
        "play/share-text",
        'import { buildShareText } from "../../src/play/share-text";\nexport const p = buildShareText;\n',
      ],
      [
        "@miolos/db root entry",
        'import { getTodayDaily } from "@miolos/db";\nexport const p = getTodayDaily;\n',
      ],
      [
        "streak",
        'import { streakCopy } from "../../src/streak/copy";\nexport const p = streakCopy;\n',
      ],
      [
        "dynamic play/sync",
        'export const load = () => import("../../src/play/sync");\n',
      ],
    ];

    for (const [label, source] of probes) {
      expect
        .soft(wallHits(await lintProbe(FREE_PLAY_CARD_PATH, source)), label)
        .not.toEqual([]);

      expect
        .soft(wallHits(await lintProbe(FREE_PLAY_PAGE_PATH, source)), label)
        .not.toEqual([]);
    }

    const games = [
      'import { solveNonogram } from "@miolos/games/nonogram";',
      "",
      "export const probe = solveNonogram;",
      "",
    ].join("\n");
    expect(ruleIds(await lintProbe(FREE_PLAY_CARD_PATH, games))).toContain(
      "no-restricted-imports",
    );
    expect(
      ruleIds(
        await lintProbe(
          FREE_PLAY_CARD_PATH,
          'export const load = () => import("@miolos/games/nonogram");\n',
        ),
      ),
    ).toContain("no-restricted-syntax");

    expect(wallHits(await lintProbe(FREE_PLAY_PAGE_PATH, games))).toEqual([]);
  });
});
