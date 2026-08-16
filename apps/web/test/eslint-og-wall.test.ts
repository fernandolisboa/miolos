import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import tseslint from "typescript-eslint";
import { describe, expect, it, vi } from "vitest";

/**
 * Mechanical proof that the OG wall (#34, ADR-0054 decisions 8 and 15) fires
 * — the `eslint-db-wall.test.ts` / `eslint-free-play-wall.test.ts`
 * architecture applied to the card and the eight image routes — plus the
 * root path B1 emptied and the `twitter-image` path nothing has opened yet,
 * both kept inside the globs because a wall that only covers files that
 * already exist is a wall that arrives after the mistake.
 *
 * Three claims, and the last two are the ones that are easy to get wrong.
 *
 * **The games ban.** `solveNonogram(clues)` recovers the Nonogram picture
 * from the PUBLISHED clues in under a millisecond, so an OG route — which
 * already holds `daily.clues` from its wall read — is one import from
 * painting the exact bitmap into a chat bubble for people who have not
 * played. Refusing to draw it is a product decision (ADR-0033 decision 2), and
 * this is its mechanical half. Measured before the wall existed: every probe
 * below lint CLEAN at every OG path, with zero hits.
 *
 * **The replacement regression.** Flat config REPLACES a rule's whole
 * configuration per matching file. The OG object's globs sit entirely inside
 * the app-wide wall's, so an object declaring only the games ban would
 * silently DELETE the db wall for exactly the eight files that call `getDb()`
 * on an unauthenticated crawler-facing path. Measured: eight probes, all
 * clean against that naive shape, nine messages against the shipped one.
 * `T-LINT-S43` is that measurement, kept.
 *
 * **The same regression one wall over.** The OG object's globs also intersect
 * the FREE-PLAY object's, so a future `app/modo-livre/<x>/opengraph-image.tsx`
 * would have had its free-play bans deleted the same way — including the ones
 * stricter than the app-wide wall. `T-LINT-S46` is that measurement, and
 * `eslint.config.mjs`'s object (5) is the fix.
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

// Explicit test timeout, FILE-scoped (ADR-0055 decisions 2, 3 and 4). The
// cost this budgets is a property of the file, not of any one test: the
// `new ESLint()` above is cheap, but the FIRST `lintText` lazily loads the
// root flat config and everything eslint-config-next/core-web-vitals and
// typescript-eslint pull in. Whichever `it` runs first pays it, and three
// measurement sessions disagreed about which one that is, so pinning the
// budget to a named test would pin a scheduling accident.
//
// This file's own figures are the TRIO'S ANCHOR: 9832 ms under contended
// local fan-out — the largest figure any of the three has produced over 11
// pooled samples — against 3477 ms on CI (gate run 31888933252 — 69.5 % of
// vitest's 5000 ms default).
//
// The three wall suites build byte-identical ESLint options over the same
// config and differ only in when they are scheduled, so they are ONE
// population and all three take that maximum: 9832 x 4 = 39 328 -> 40 000
// ms. The anchor is a sample maximum, not a bound — it has grown twice
// already (4983 -> 7907 -> 9832 ms) — and the x4 with the round-up is what
// absorbs the next surprise.
//
// A ceiling, not a target: any of these tests over budget / 2 = 20 000 ms
// is a defect to diagnose and record, never a number to raise. The line is
// budget / 2 and not budget / 4 because budget = anchor x 4, so budget / 4
// IS the anchor: a tripwire there fires whenever a session sets a new
// sample maximum, which ADR-0055 decision 2 predicts as normal. Twice the
// anchor is drift; one times it is a draw.
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

/** The card's own directory. */
const OG_SOURCE_PATH = "apps/web/src/og/eslint-probe.ts";
/**
 * The root-card PATH — `**` matches zero segments, and this is what proves
 * it. No file lives here since B1 turned the root card into a static
 * `opengraph-image.png`, and the glob stays covering it deliberately: the
 * cheapest way to reintroduce the traced-`next/og`-everywhere regression is
 * to write this module again, and it must not arrive OUTSIDE the wall when
 * someone does. Same argument as `twitter-image` below; `lintText` needs no
 * file on disk either way.
 */
const ROOT_CARD_PATH = "apps/web/app/opengraph-image.tsx";
/** One of each dated family. */
const DAILY_CARD_PATH = "apps/web/app/sudoku/opengraph-image.tsx";
const ARCHIVE_CARD_PATH =
  "apps/web/app/arquivo/[data]/sudoku/opengraph-image.tsx";
/** A file the root layout's `twitter` defaults mean will never exist. */
const TWITTER_CARD_PATH = "apps/web/app/sudoku/twitter-image.tsx";
/**
 * The INTERSECTION of the free-play wall and the OG wall — object (5) in
 * `eslint.config.mjs`. No such file exists today; `lintText` needs none, and
 * the whole point is that the wall is standing before the file arrives.
 */
const FREE_PLAY_CARD_PATH = "apps/web/app/modo-livre/opengraph-image.tsx";
/** Its control: the shipped free-play route, matched by object (3) alone. */
const FREE_PLAY_PAGE_PATH = "apps/web/app/modo-livre/page.tsx";

/** Every path the OG wall must reach. */
const OG_PATHS = [
  OG_SOURCE_PATH,
  ROOT_CARD_PATH,
  DAILY_CARD_PATH,
  ARCHIVE_CARD_PATH,
  TWITTER_CARD_PATH,
];

/** Scope controls: the identical source is legal from these. */
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
      // Scope control: the ban is the OG SURFACE's, not the app's. #34's own
      // share composer imports nothing from games and must stay free to.
      expect
        .soft(wallHits(await lintProbe(SHARE_TEXT_PATH, source)), door)
        .toEqual([]);
      expect
        .soft(wallHits(await lintProbe(PAGE_PATH, source)), door)
        .toEqual([]);
    }
  });

  it("T-LINT-S42: the dynamic-import evasion of the games ban reds; a local dynamic import stays clean", async () => {
    // `no-restricted-imports` never sees `import("@miolos/games/nonogram")`,
    // and one dynamic import is all `solveNonogram` needs.
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

  it("T-LINT-S43: replacement regression — the app-wide db wall still fires inside the OG surface", async () => {
    // The eight probes measured red-to-clean against an OG object declaring
    // only the games ban. Nine MESSAGES across eight probes: the root-entry
    // probe is one line that reds twice, once for `sql` and once for `users`.
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
    // NINE messages across EIGHT probes — the count, not the row count.
    expect(messageCount).toBe(9);

    // And the MESSAGE is the app-wide wall's own, which is what proves the
    // repetition carried the original rule rather than shadowing it with a
    // lookalike (the `T-LINT-S14` idiom).
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
    // `apps/web/app/**/opengraph-image.*` — `**` matches ZERO segments, so
    // the ROOT path is inside the glob. Verified here rather than assumed.
    // Eight of the nine are files today; the ninth is the root path B1
    // emptied, kept in the list because a rewritten root module must land
    // inside the wall rather than beside it.
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
    // The source directory, and the twitter-image door nothing opens today.
    for (const path of [OG_SOURCE_PATH, TWITTER_CARD_PATH]) {
      expect
        .soft(ruleIds(await lintProbe(path, source)), path)
        .toContain("no-restricted-imports");
    }
    // Clean at the sibling PAGE, which legitimately renders the puzzle.
    expect(wallHits(await lintProbe(PAGE_PATH, source))).toEqual([]);
  });

  it("T-LINT-S45: the OG surface's LEGAL imports lint clean — the wall is not a blanket ban", async () => {
    // Headroom id, spent on the anti-vacuity control the four probes above
    // need: a wall that reds on everything proves nothing about what it bans.
    // This is exactly what the shipped handlers and card import.
    const clean = [
      'import type { ProjectedGame } from "@miolos/core";',
      'import { getPublishedDaily, getTodayDaily } from "@miolos/db";',
      'import { ImageResponse } from "next/og";',
      "",
      "export const legal = {",
      "  getPublishedDaily,",
      "  getTodayDaily,",
      "  ImageResponse,",
      "};",
      "export type G = ProjectedGame;",
      "",
    ].join("\n");
    for (const path of OG_PATHS) {
      expect.soft(wallHits(await lintProbe(path, clean)), path).toEqual([]);
    }
  });

  it("T-LINT-S46: the OG wall does not DELETE the free-play wall where the two globs intersect", async () => {
    // THE SAME REPLACEMENT FAILURE AS `T-LINT-S43`, ONE WALL OVER (step-6
    // finding K1). `app/modo-livre/**/opengraph-image.tsx` matches object
    // (3)'s `apps/web/app/modo-livre/**` AND object (4)'s
    // `apps/web/app/**/opengraph-image.*`; flat config replaces per rule and
    // (4) is later, so before object (5) existed the OG wall was that file's
    // ENTIRE configuration and every free-play ban vanished — including the
    // ones STRICTER than the app-wide wall, which (4) repeats. Measured
    // against the shipped config without (5): all five probes below CLEAN at
    // the card path, all five red at the page control.
    //
    // `T-LINT-S43` cannot see this: it probes `app/opengraph-image.tsx`, and
    // the free-play suite's own `ROUTE_PATH` is a `page.tsx`.
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
        // The sharpest of the five: object (3) bans the ROOT entry outright
        // ("not even the wall-safe root entry"), while `webWallImportPatterns`
        // — all object (4) repeats — permits it. The intersection was
        // strictly weaker than either parent.
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
      // The control, in the same terms: the ban being asserted is genuinely
      // free play's own, and it fires on the route that already exists.
      expect
        .soft(wallHits(await lintProbe(FREE_PLAY_PAGE_PATH, source)), label)
        .not.toEqual([]);
    }

    // And object (5) carries the OG half too — it is an intersection, not a
    // replacement of (4) by (3).
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

    // Anti-vacuity: the games ban really is free play's LEGAL surface, so a
    // wall that reds on everything would pass the two lines above for the
    // wrong reason. `@miolos/games` lints clean at the free-play PAGE.
    expect(wallHits(await lintProbe(FREE_PLAY_PAGE_PATH, games))).toEqual([]);
  });
});
