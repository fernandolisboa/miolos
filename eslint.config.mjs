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

const importSource =
  ":matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression) > Literal.source";

const webNormalForm = {
  selector: `${importSource}[value=/(^|\\/)(?!\\.\\.\\/)[^\\/]+\\/\\.\\.?(\\/|$)|\\/\\.(\\/|$)|\\/\\/|[?#]/]`,
  message:
    "apps/web writes an import specifier in normal form: no `.` or empty segment, `..` only as a leading run, and no `?query` or `#fragment`. Every wall ban matches the specifier string, and `../x/../play/sync`, `../play//sync` or `../play/sync?x` walks past a ban written against `**/play/sync` (ADR-0078).",
};

const webCodeExtension = {
  selector: `${importSource}[value=/^\\.\\.?\\/.*\\.[cm]?[jt]sx?$/]`,
  message:
    "apps/web writes a relative source specifier without its code extension: `../play/sync.ts` walks past a ban written against `**/play/sync` (ADR-0078).",
};

const webDynamicDbImport = {
  selector:
    "ImportExpression > Literal[value=/^@miolos\\/db\\/(publishing|user|testing)(\\/|$)/]",
  message:
    "apps/web is client-serving: dynamic import of the server-internal @miolos/db subpaths is banned (ADR-0024, ADR-0026).",
};

const webDynamicPackageSource = {
  selector:
    "ImportExpression > Literal[value=/(packages|@miolos)\\/(db|core|games)\\/src(\\/|$)/]",
  message:
    "apps/web is client-serving: dynamic import of a relative path into packages/db/src, packages/core/src or packages/games/src is banned — it evades the deep-path import restrictions (ADR-0024, ADR-0026, ADR-0033).",
};

const webDynamicCrosswordImport = {
  selector:
    "ImportExpression > Literal[value=/^@miolos\\/games\\/crossword(\\/|$)/i]",
  message:
    'apps/web never imports @miolos/games/crossword dynamically: `no-restricted-imports` never sees `import("@miolos/games/crossword")`, and a lazy chunk escapes the bundle-check route attribution (ADR-0088).',
};

const webDynamicTermoAnswersImport = {
  selector:
    "ImportExpression > Literal[value=/^@miolos\\/games\\/termo-answers(\\/|$)/i]",
  message:
    "apps/web never imports the Termo answer list, dynamically either: no client chunk may carry it (ADR-0045 decision 5, ADR-0114).",
};

const webDynamicNonogramColorsImport = {
  selector:
    "ImportExpression > Literal[value=/^@miolos\\/games\\/nonogram-colors(\\/|$)/i]",
  message:
    "apps/web never imports the Nonogram tones table dynamically: it ships on /modo-livre/nonogram alone (ADR-0121).",
};

const webDynamicColoredNonogramImport = {
  selector:
    "ImportExpression > Literal[value=/^@miolos\\/games\\/colored-nonogram(\\/|$)/i]",
  message:
    "apps/web never imports the coloured Nonogram engine dynamically: it is imported statically inside the Cores chunk, which /modo-livre/nonogram alone loads (ADR-0132).",
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

const crosswordEngineGroup = {
  group: ["@miolos/games/crossword", "@miolos/games/crossword/*"],
  message:
    "@miolos/games/crossword carries the whole lexicon: only apps/web/src/free-play/use-free-crossword.ts imports it, statically, so the lexicon ships on /modo-livre/cruzadinha alone (ADR-0088).",
};

const nonogramColorsGroup = {
  group: ["@miolos/games/nonogram-colors", "@miolos/games/nonogram-colors/*"],
  message:
    "@miolos/games/nonogram-colors carries every motif's tones: only apps/web/src/free-play/use-free-nonogram.ts imports it, so the table ships on /modo-livre/nonogram alone and a daily gets its tones from its own completed /day claim (ADR-0121, ADR-0004). Tests may import it.",
};

const coloredNonogramGroup = {
  group: ["@miolos/games/colored-nonogram", "@miolos/games/colored-nonogram/*"],
  message:
    "@miolos/games/colored-nonogram reaches every motif's tones: only apps/web/src/colored-nonogram/** and apps/web/src/free-play/use-free-colored-nonogram.ts import it, inside the Cores chunk /modo-livre/nonogram alone loads (ADR-0132, ADR-0121). Tests may import it.",
};

const coloredNonogramModulesGroup = {
  group: [
    "**/colored-nonogram/*",
    "**/free-play/colored-nonogram-*",
    "**/free-play/use-free-colored-nonogram",
  ],
  message:
    "The Cores modules load only inside the lazy chunk /modo-livre/nonogram fetches: only apps/web/src/free-play/** and apps/web/src/colored-nonogram/** import them (ADR-0132).",
};

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
  {
    group: [
      "**/packages/games/src",
      "**/packages/games/src/*",
      "**/packages/games/src/**",
      ...symlinkSpelling("games"),
    ],
    message:
      "apps/web reaches the engines through `@miolos/games` or `@miolos/games/<game>`, never by relative path into packages/games/src — every ban on a game is written against the package specifier, and for Termo the deep path walks past all of them and ships the whole answer list (ADR-0005, ADR-0015, ADR-0047, ADR-0078).",
  },
  crosswordEngineGroup,

  ...replayCapableClientGroups,
];

const termoAnswersGroup = {
  group: ["@miolos/games/termo-answers", "@miolos/games/termo-answers/*"],
  message:
    "apps/web source never imports the Termo answer list: no client chunk may carry it, and a daily answer reaches the board from the server only once the board closes (ADR-0045 decision 5, ADR-0114). Tests may import it.",
};

const webClientImportPatterns = [
  ...webWallImportPatterns,
  termoAnswersGroup,
  nonogramColorsGroup,
  coloredNonogramGroup,
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
      "crosswordDailyContentSchema",
      "DailyProjectionUnsupportedError",
      "nonogramDailyContentSchema",
      "queensDailyContentSchema",
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

const freePlayTermoModules = [
  "board",
  "keyboard",
  "play-view",
  "state",
  "types",
  "use-termo-board",
  "termo-board.module.css",
];

const freeTermoMessage =
  "free Termo reuses only the Termo engine and the board, keyboard, view, state and board hook; the daily Termo modules judge on the server and record the day (ADR-0046, ADR-0114).";

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
      "**/play/daily-screen",
      "**/session/bootstrap",
      "**/components/session-bootstrap",
      "**/binairo/use-binairo-play",
      "**/sudoku/use-sudoku-play",
      "**/nonogram/use-nonogram-play",
      "**/binairo/binairo-screen",
      "**/sudoku/sudoku-screen",
      "**/nonogram/nonogram-screen",

      "**/nonogram/nonogram-conclusion",
      "**/crossword/use-crossword-play",
      "**/crossword/crossword-screen",
      "**/queens/use-queens-play",
      "**/queens/queens-screen",

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
      "**/termo/**",
      ...freePlayTermoModules.map((name) => `!**/termo/${name}`),
    ],
    message: freeTermoMessage,
  },
  {
    regex: "^(?!@miolos/games/termo/?$)(.*/)?termo/?$",
    message: freeTermoMessage,
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
    group: [
      "**/stats",
      "**/stats/**",
      "**/app/estatisticas/**",
      "**/play/conclusion-stats",
    ],
    message:
      "free play never touches the statistics: the stats client, hooks, the /estatisticas screen and the conclusion's statistics block are banned from apps/web/src/free-play and app/modo-livre (ADR-0008 rule 5, ADR-0046, ADR-0051).",
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

const freePlayTermoModulePattern = freePlayTermoModules
  .map((name) => name.replaceAll(".", "\\."))
  .join("|");

const freePlayDynamicBannedModule = {
  selector: `ImportExpression > Literal[value=/(play\\/(sync|play-record|use-play-lifecycle|day-state|use-record-snapshot|conclusion-view|conclusion-lazy|conclusion-stats|share-text|share-button|push-prompt-card|daily-route|daily-screen)|(?<!^@miolos\\/games)(^|\\/)termo(\\/(?!(${freePlayTermoModulePattern})$)|$)|session\\/bootstrap|components\\/session-bootstrap|binairo\\/(use-binairo-play|binairo-screen)|sudoku\\/(use-sudoku-play|sudoku-screen)|nonogram\\/(use-nonogram-play|nonogram-screen|nonogram-conclusion)|crossword\\/(use-crossword-play|crossword-screen)|queens\\/(use-queens-play|queens-screen)|streak(\\/|$)|hub-streak|attach(\\/|$)|hub-attach|onboarding(\\/|$)|hub-onboarding|\\/push(\\/|$)|stats(\\/|$)|medals(\\/|$)|\\/day(\\/|$)|\\/telemetry(\\/|$)|\\/api(\\/|$)|estatisticas|archive(\\/|$)|arquivo|app\\/page$|app\\/hub-day-state|(^|\\/)@miolos\\/db(\\/|$))/i]`,
  message:
    "free play records nothing, fetches nothing, fires no telemetry, never touches the daily Termo, the streak, the day, the statistics, the medals, the attach flow, the onboarding flow or the push opt-in: dynamic import of the banned modules is banned too (ADR-0011, ADR-0008 rule 5, ADR-0046, ADR-0048, ADR-0050, ADR-0051, ADR-0052, ADR-0060, ADR-0061, ADR-0064, ADR-0069).",
};

const ogBannedGameGroups = [
  {
    group: ["@miolos/games", "@miolos/games/*"],
    message:
      "an OG card draws no puzzle content: @miolos/games is banned from the card and the image routes — `solveNonogram(clues)` recovers the Nonogram picture from the published clues, and refusing to draw it is the product decision ADR-0033 decision 2 records (ADR-0054 decision 8).",
  },
];

const ogDynamicGamesImport = {
  selector: "ImportExpression > Literal[value=/^@miolos\\/games(\\/|$)/i]",
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
        webDynamicCrosswordImport,
        webDynamicTermoAnswersImport,
        webDynamicNonogramColorsImport,
        webDynamicColoredNonogramImport,
        webComputedDynamicImport,
        webRequireCall,
        webNormalForm,
      ],
    },
  },
  {
    files: [
      `apps/web/app/**/*.${webWallExtensions}`,
      `apps/web/src/**/*.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...webClientImportPatterns, coloredNonogramModulesGroup],
          paths: webWallImportPaths,
        },
      ],
      "no-restricted-syntax": [
        "error",

        webDynamicDbImport,
        webDynamicPackageSource,
        webDynamicCrosswordImport,
        webDynamicTermoAnswersImport,
        webDynamicNonogramColorsImport,
        webDynamicColoredNonogramImport,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
        webNormalForm,
        webCodeExtension,
      ],
    },
  },
  {
    files: [
      `apps/web/src/free-play/**/*.${webWallExtensions}`,
      `apps/web/src/colored-nonogram/**/*.${webWallExtensions}`,
      `apps/web/app/modo-livre/**/*.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [...webClientImportPatterns, ...freePlayBannedModuleGroups],
          paths: webWallImportPaths,
        },
      ],
      "no-restricted-syntax": [
        "error",
        webDynamicDbImport,
        webDynamicPackageSource,
        webDynamicCrosswordImport,
        webDynamicTermoAnswersImport,
        webDynamicNonogramColorsImport,
        webDynamicColoredNonogramImport,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
        webNormalForm,
        webCodeExtension,
        freePlayDynamicBannedModule,
      ],
    },
  },
  {
    files: [`apps/web/app/modo-livre/**/*.${webWallExtensions}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...webClientImportPatterns,
            ...freePlayBannedModuleGroups,
            coloredNonogramModulesGroup,
          ],
          paths: webWallImportPaths,
        },
      ],
    },
  },
  {
    files: ["apps/web/src/free-play/use-free-crossword.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...webClientImportPatterns.filter(
              (pattern) => pattern !== crosswordEngineGroup,
            ),
            ...freePlayBannedModuleGroups,
          ],
          paths: webWallImportPaths,
        },
      ],
    },
  },
  {
    files: ["apps/web/src/free-play/use-free-nonogram.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...webClientImportPatterns.filter(
              (pattern) => pattern !== nonogramColorsGroup,
            ),
            ...freePlayBannedModuleGroups,
          ],
          paths: webWallImportPaths,
        },
      ],
    },
  },
  {
    files: [
      "apps/web/src/free-play/use-free-colored-nonogram.ts",
      `apps/web/src/colored-nonogram/**/*.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...webClientImportPatterns.filter(
              (pattern) => pattern !== coloredNonogramGroup,
            ),
            ...freePlayBannedModuleGroups,
          ],
          paths: webWallImportPaths,
        },
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
        webDynamicCrosswordImport,
        webDynamicTermoAnswersImport,
        webDynamicNonogramColorsImport,
        webDynamicColoredNonogramImport,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
        webNormalForm,
        webCodeExtension,
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
        webDynamicCrosswordImport,
        webDynamicTermoAnswersImport,
        webDynamicNonogramColorsImport,
        webDynamicColoredNonogramImport,
        webComputedDynamicImport,
        webRequireCall,
        webTableNameLiteral,
        webTableNameTemplate,
        webNormalForm,
        webCodeExtension,
        freePlayDynamicBannedModule,
        ogDynamicGamesImport,
      ],
    },
  },
  prettier,
);
