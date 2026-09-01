import { builtinModules } from "node:module";

import js from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const appGlobs = ["apps/web/**/*.{ts,tsx}", "apps/api/**/*.{ts,tsx}"];

const webWallExtensions = "{ts,tsx,mts,cts,js,jsx,mjs,cjs}";

const symlinkSpelling = (pkg) => [
  `**/node_modules/@miolos/${pkg}/src`,
  `**/node_modules/@miolos/${pkg}/src/*`,
  `**/node_modules/@miolos/${pkg}/src/**`,
];

const webDynamicDbImport = {
  selector:
    "ImportExpression > Literal[value=/^@miolos\\/db\\/(publishing|user|testing)(\\/|$)/]",
  message:
    "apps/web is client-serving: dynamic import of the server-internal @miolos/db subpaths is banned (ADR-0024, ADR-0026).",
};

const webDynamicPackageSource = {
  selector:
    "ImportExpression > Literal[value=/(packages|@miolos)\\/(db|core)\\/src(\\/|$)/]",
  message:
    "apps/web is client-serving: dynamic import of a relative path into packages/db/src or packages/core/src is banned — it evades the deep-path import restrictions (ADR-0024, ADR-0026, ADR-0033).",
};

const webComputedDynamicImport = {
  selector: 'ImportExpression[source.type!="Literal"]',
  message:
    "apps/web is client-serving: a computed dynamic import() specifier is banned — it evades the @miolos/db import restrictions (ADR-0024, ADR-0026).",
};

const webRequireCall = {
  selector: "CallExpression[callee.name='require']",
  message:
    "apps/web is client-serving ESM: require() is banned — it evades the @miolos/db import restrictions (ADR-0024, ADR-0026).",
};

const replayCapableClientGroups = [
  {
    group: [
      "posthog-js",
      "posthog-js/*",
      "posthog-js-lite",
      "posthog-js-lite/*",
      "@posthog/*",
      "rrweb",
      "rrweb/*",
      "@rrweb/*",
    ],
    message:
      "no session replay, and no client PostHog SDK: telemetry is five server-anchored events over a hand-rolled capture in apps/api, so the ceiling and the published no-replay promise hold by construction (CLAUDE.md invariants, ADR-0069 decision 1, /privacidade's own copy).",
  },
];

const webWallImportPatterns = [
  {
    group: [
      "@miolos/db/publishing",
      "@miolos/db/publishing/*",
      "@miolos/db/user",
      "@miolos/db/user/*",
      "@miolos/db/testing",
      "@miolos/db/testing/*",
    ],
    message:
      "apps/web is client-serving: import the wall-safe root entry `@miolos/db` only. `/publishing` carries the raw tables, the buffer writers and the solution-bearing reader; `/user` carries the completion and hint-grant writers, which belong to apps/api; `/testing` hands out a full-schema client (ADR-0024, ADR-0026).",
  },
  {
    group: [
      "**/packages/db/src",
      "**/packages/db/src/*",
      "**/packages/db/src/**",
      ...symlinkSpelling("db"),
    ],
    message:
      "apps/web is client-serving: reach the db through the `@miolos/db` package entry, never by relative path into packages/db/src — the deep path hands out every server-internal table (ADR-0024, ADR-0026).",
  },
  {
    group: [
      "**/packages/core/src",
      "**/packages/core/src/*",
      "**/packages/core/src/**",
      ...symlinkSpelling("core"),
    ],
    message:
      "apps/web is client-serving: reach the contracts through the `@miolos/core` package entry, never by relative path into packages/core/src — the deep path reaches the SERVER-ONLY daily-content schemas, whose module is retained in the browser chunk of every route the moment anything names it (commit d5bb543, ADR-0024/ADR-0033).",
  },

  ...replayCapableClientGroups,
];

const webWallImportPaths = [
  {
    name: "@miolos/db",

    importNames: ["sql", "eq", "users", "sessions"],
    message:
      "apps/web must not build queries or touch the identity tables: read the daily through `getTodayDaily`. Raw SQL via the re-exported `sql` bypasses the published-predicate wall (ADR-0024 amendment), and every `users`/`sessions` read belongs to apps/api (ADR-0007/0014).",
  },
  {
    name: "@miolos/core",

    importNames: [
      "binairoDailyContentSchema",
      "DailyProjectionUnsupportedError",
      "nonogramDailyContentSchema",
      "stripDailyContent",
      "sudokuDailyContentSchema",
      "termoDailyContentSchema",
    ],
    message:
      "these are the SERVER-ONLY daily-content schemas (packages/core/src/contracts/daily-content.ts). apps/web receives the wall's already-stripped projection and must never name the content shape: one value import re-ships the withheld object's shape in every route's client chunk (commit d5bb543, ADR-0024/ADR-0033).",
  },
];

const webTableNameLiteral = {
  selector: "Literal[value=/\\b(daily_puzzles|remote_config)\\b/]",
  message:
    "apps/web must not name the buffer tables: raw SQL through @miolos/db's re-exported `sql` / `.execute()` bypasses the published-predicate wall (ADR-0024 amendment, named #18 duty).",
};

const webTableNameTemplate = {
  selector: "TemplateElement[value.raw=/\\b(daily_puzzles|remote_config)\\b/]",
  message:
    "apps/web must not name the buffer tables: raw SQL through @miolos/db's re-exported `sql` / `.execute()` bypasses the published-predicate wall (ADR-0024 amendment, named #18 duty).",
};

const freePlayBannedModuleGroups = [
  {
    group: [
      "**/play/sync",
      "**/play/play-record",
      "**/play/use-play-lifecycle",
      "**/play/day-state",
      "**/play/use-record-snapshot",
      "**/play/conclusion-view",

      "**/play/conclusion-lazy",

      "**/play/share-text",

      "**/play/share-button",
      "**/play/daily-route",
      "**/termo/guess-client",
      "**/session/bootstrap",
      "**/components/session-bootstrap",
      "**/binairo/use-binairo-play",
      "**/sudoku/use-sudoku-play",
      "**/nonogram/use-nonogram-play",
      "**/binairo/binairo-screen",
      "**/sudoku/sudoku-screen",
      "**/nonogram/nonogram-screen",

      "**/nonogram/nonogram-conclusion",
      "**/termo/termo-conclusion",

      "**/app/page",
      "**/app/hub-day-state",
    ],
    message:
      "free play records nothing and fetches nothing: the sync/record/lifecycle/session modules — and the daily hooks, screen roots, the daily route envelope, hub page and hub islands that reach them one hop in — are banned from apps/web/src/free-play and app/modo-livre (ADR-0011, ADR-0008 rule 5, ADR-0046).",
  },
  {
    group: [
      "@miolos/db",
      "@miolos/db/*",
      "**/node_modules/@miolos/db",
      "**/node_modules/@miolos/db/**",
    ],
    message:
      "free play is generated on the client and reads no database at all — not even the wall-safe root entry (ADR-0011, ADR-0046).",
  },
  {
    group: [
      "@miolos/games/termo",
      "@miolos/games/termo/*",
      "**/packages/games/src/termo",
      "**/packages/games/src/termo/**",
      "**/node_modules/@miolos/games/src/termo",
      "**/node_modules/@miolos/games/src/termo/**",
    ],
    message:
      "Termo is excluded from free play by project invariant: its word list is finite curated content and free play would burn it (ADR-0005, ADR-0015, ADR-0046).",
  },
  {
    group: ["**/streak", "**/streak/**", "**/hub-streak"],
    message:
      "free play never touches the streak: the streak client, hook and hub island are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0048).",
  },
  {
    group: ["**/attach", "**/attach/**", "**/hub-attach"],
    message:
      "free play never touches identity or the attach flow: the attach client, hook and hub island are banned from apps/web/src/free-play and app/modo-livre (ADR-0011, ADR-0046, ADR-0050).",
  },
  {
    group: ["**/onboarding", "**/onboarding/**", "**/hub-onboarding"],
    message:
      "free play never touches identity or the first-visit introduction: the onboarding client, hook and hub island are banned from apps/web/src/free-play and app/modo-livre (ADR-0011, ADR-0046, ADR-0061).",
  },
  {
    group: ["**/stats", "**/stats/**", "**/app/estatisticas/**"],
    message:
      "free play never touches the statistics: the stats client, hooks and the /estatisticas screen are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0051).",
  },
  {
    group: ["**/archive", "**/archive/**", "**/app/arquivo/**"],
    message:
      "free play records nothing and reads no archive: the archive's screens, its late-result panel and the /arquivo routes are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0053).",
  },
  {
    group: ["**/medals", "**/medals/**"],
    message:
      "free play never touches the medals: the medals client and hook are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0052).",
  },
  {
    group: ["**/push", "**/push/**", "**/play/push-prompt-card"],
    message:
      "free play never touches identity or the push opt-in: the push client, hook and prompt card are banned from apps/web/src/free-play and app/modo-livre (ADR-0011, ADR-0046, ADR-0064).",
  },
  {
    group: ["**/day", "**/day/**"],
    message:
      "free play never touches the day: the day client and the day-truth store are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0060).",
  },
  {
    group: ["**/telemetry", "**/telemetry/**"],
    message:
      "free play fires no telemetry: the puzzle_started relay client is banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0069).",
  },
  {
    group: ["**/api", "**/api/**"],
    message:
      "free play fetches nothing and mints no session: the shared authenticated mount fetch and the shared API client are banned from apps/web/src/free-play and app/modo-livre (ADR-0011, ADR-0046, ADR-0048).",
  },
];

const freePlayDynamicBannedModule = {
  selector:
    "ImportExpression > Literal[value=/(play\\/(sync|play-record|use-play-lifecycle|day-state|use-record-snapshot|conclusion-view|conclusion-lazy|share-text|share-button|push-prompt-card|daily-route)|termo\\/(guess-client|termo-conclusion)|session\\/bootstrap|components\\/session-bootstrap|binairo\\/(use-binairo-play|binairo-screen)|sudoku\\/(use-sudoku-play|sudoku-screen)|nonogram\\/(use-nonogram-play|nonogram-screen|nonogram-conclusion)|streak(\\/|$)|hub-streak|attach(\\/|$)|hub-attach|onboarding(\\/|$)|hub-onboarding|\\/push(\\/|$)|stats(\\/|$)|medals(\\/|$)|\\/day(\\/|$)|\\/telemetry(\\/|$)|\\/api(\\/|$)|estatisticas|archive(\\/|$)|arquivo|app\\/page$|app\\/hub-day-state|(^|\\/)@miolos\\/db(\\/|$)|^@miolos\\/games\\/termo(\\/|$)|(packages|@miolos)\\/games\\/src\\/termo)/]",
  message:
    "free play records nothing, fetches nothing, fires no telemetry, never touches Termo, the streak, the day, the statistics, the medals, the attach flow, the onboarding flow or the push opt-in: dynamic import of the banned modules is banned too (ADR-0011, ADR-0008 rule 5, ADR-0046, ADR-0048, ADR-0050, ADR-0051, ADR-0052, ADR-0060, ADR-0061, ADR-0064, ADR-0069).",
};

const ogBannedGameGroups = [
  {
    group: [
      "@miolos/games",
      "@miolos/games/*",
      "**/packages/games/src",
      "**/packages/games/src/*",
      "**/packages/games/src/**",
      ...symlinkSpelling("games"),
    ],
    message:
      "an OG card draws no puzzle content: @miolos/games is banned from the card and the image routes — `solveNonogram(clues)` recovers the Nonogram picture from the published clues, and refusing to draw it is the product decision ADR-0033 decision 2 records (ADR-0054 decision 8).",
  },
];

const ogDynamicGamesImport = {
  selector:
    "ImportExpression > Literal[value=/(^@miolos\\/games(\\/|$)|(packages|@miolos)\\/games\\/src)/]",
  message:
    'an OG card draws no puzzle content, dynamically either: `no-restricted-imports` never sees `import("@miolos/games/nonogram")`, and one dynamic import is all `solveNonogram` needs (ADR-0033 decision 2, ADR-0054 decision 8).',
};

const nextConfigs = nextCoreWebVitals.map((config) =>
  config.ignores && !config.rules && !config.plugins
    ? config
    : { ...config, files: appGlobs },
);

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "docs/**",
      "content/**",
      ".claude/**",
      "pnpm-lock.yaml",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            "vitest.shared.ts",
            "packages/db/vitest.config.ts",
            "packages/core/vitest.config.ts",
            "packages/ui/vitest.config.ts",
            "apps/api/vitest.config.ts",
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...nextConfigs,
  {
    files: appGlobs,
    settings: {
      next: {
        rootDir: ["apps/web", "apps/api"],
      },

      react: {
        version: "19",
      },
    },
  },
  {
    files: ["apps/web/**/*.{js,jsx,mjs,cjs}", "apps/api/**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
  {
    files: ["apps/web/public/sw.js"],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    files: [
      "apps/api/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
      "packages/**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: replayCapableClientGroups },
      ],
    },
  },
  {
    files: ["packages/games/src/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "node:*",
                ...builtinModules,
                "react",
                "react-dom",
                "react-native",
              ],
              message:
                "packages/games is pure TypeScript: only relative imports of its own source are allowed.",
            },
          ],
        },
      ],

      "no-restricted-syntax": [
        "error",
        {
          selector: "ImportExpression",
          message:
            "packages/games is pure TypeScript: dynamic import() is banned (computed specifiers evade the import restriction).",
        },
        {
          selector: "CallExpression[callee.name='require']",
          message: "packages/games is pure TypeScript: require() is banned.",
        },
      ],
    },
  },
  {
    files: [`apps/web/**/*.${webWallExtensions}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: webWallImportPatterns,
          paths: webWallImportPaths,
        },
      ],
      "no-restricted-syntax": [
        "error",
        webDynamicDbImport,
        webDynamicPackageSource,
        webComputedDynamicImport,
        webRequireCall,
      ],
    },
  },
  {
    files: [
      `apps/web/app/**/*.${webWallExtensions}`,
      `apps/web/src/**/*.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-syntax": [
        "error",

        webDynamicDbImport,
        webDynamicPackageSource,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
      ],
    },
  },
  {
    files: [
      `apps/web/src/free-play/**/*.${webWallExtensions}`,
      `apps/web/app/modo-livre/**/*.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...webWallImportPatterns, ...freePlayBannedModuleGroups],
          paths: webWallImportPaths,
        },
      ],
      "no-restricted-syntax": [
        "error",
        webDynamicDbImport,
        webDynamicPackageSource,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
        freePlayDynamicBannedModule,
      ],
    },
  },
  {
    files: [
      `apps/web/src/og/**/*.${webWallExtensions}`,

      `apps/web/app/**/opengraph-image.${webWallExtensions}`,

      `apps/web/app/**/twitter-image.${webWallExtensions}`,

      `apps/web/app/cartao/**/*.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...webWallImportPatterns, ...ogBannedGameGroups],
          paths: webWallImportPaths,
        },
      ],
      "no-restricted-syntax": [
        "error",
        webDynamicDbImport,
        webDynamicPackageSource,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
        ogDynamicGamesImport,
      ],
    },
  },
  {
    files: [
      `apps/web/app/modo-livre/**/opengraph-image.${webWallExtensions}`,
      `apps/web/app/modo-livre/**/twitter-image.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...webWallImportPatterns,
            ...freePlayBannedModuleGroups,
            ...ogBannedGameGroups,
          ],
          paths: webWallImportPaths,
        },
      ],
      "no-restricted-syntax": [
        "error",
        webDynamicDbImport,
        webDynamicPackageSource,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
        freePlayDynamicBannedModule,
        ogDynamicGamesImport,
      ],
    },
  },
  prettier,
);
