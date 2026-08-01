// Root flat config — the only ESLint config in the repo (`pnpm lint` runs once at the root).
import { builtinModules } from "node:module";

import js from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const appGlobs = ["apps/web/**/*.{ts,tsx}", "apps/api/**/*.{ts,tsx}"];

// Part of the apps/web db wall (ADR-0024 §5). Named because it has to appear
// in BOTH wall config objects below — see the comment at its second use.
const webDynamicDbImport = {
  // no-restricted-imports cannot see dynamic specifiers.
  selector:
    "ImportExpression > Literal[value=/^@miolos\\/db\\/(publishing|user|testing)(\\/|$)/]",
  message:
    "apps/web is client-serving: dynamic import of the server-internal @miolos/db subpaths is banned (ADR-0024, ADR-0026).",
};

// eslint-config-next ships a flat Linter.Config[]; scope every non-ignore
// entry to the two Next apps so its rules never leak into the packages.
// The scope must be FORCED, not defaulted (`config.files ?? appGlobs`
// does not work): its entries carry repo-wide globs like
// "**/*.{js,jsx,mjs,ts,tsx,mts,cts}", which would apply Next/React rules
// to the packages and crash eslint-plugin-react's version detection
// outside the apps. Re-verify this map on any eslint-config-next major.
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
        projectService: true,
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
      // Explicit version: eslint-plugin-react@7's auto-detection calls the
      // ESLint ≤9 API context.getFilename and crashes under ESLint 10.
      // Major only — a patch-precise pin would silently drift on react bumps.
      react: {
        version: "19",
      },
    },
  },
  {
    // Purity backstop for packages/games (ADR in CLAUDE.md invariants; primary
    // check is packages/games/test/purity.test.ts): games source may import
    // nothing but itself — no Node builtins, no React, no React Native.
    // `.mts`/`.cts` included: a `.mts` file slipping a `.ts`-only glob was a
    // proven evasion vector (step 6 review).
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
      // no-restricted-imports cannot see computed specifiers such as
      // import("node" + ":fs"). Games has no legitimate dynamic imports,
      // so ban the syntax outright.
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
    // (1) IMPORT BANS — all of apps/web, tests included. ADR-0024 §5 and its
    // 2026-07-31 amendment; a named #18 duty, live from the PR that gives
    // apps/web the @miolos/db dependency. apps/web is client-serving, so the
    // only db surface it may hold is the wall-safe root entry:
    //   - /publishing — raw tables, buffer writers, createPublishingDb,
    //     getPublishedDailyWithSolution;
    //   - /user — completions and hint grants; every write and every
    //     user-specific read belongs to apps/api (ADR-0007/0014);
    //   - /testing — createTestDb returns a FULL-schema drizzle client over
    //     daily_puzzles and pulls PGlite; apps/web runs no PGlite (plan 017
    //     D33), so it has no legitimate use for it either.
    // `.mts`/`.cts` included: a `.mts` file slipping a `.ts`-only glob is a
    // proven evasion vector (PR #48 step 6).
    files: ["apps/web/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
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
          ],
          paths: [
            {
              name: "@miolos/db",
              importNames: ["sql", "eq"],
              message:
                "apps/web must not build queries: read the daily through `getTodayDaily`. Raw SQL via the re-exported `sql` bypasses the published-predicate wall (ADR-0024 amendment).",
            },
          ],
        },
      ],
      "no-restricted-syntax": ["error", webDynamicDbImport],
    },
  },
  {
    // (2) TABLE-NAME LITERALS — apps/web SOURCE only, which is the ADR-0024
    // amendment's own wording. The residual it targets is raw SQL through the
    // root entry's re-exported `sql` / `.execute()`, which no import
    // restriction can see. apps/web/test/** is outside this glob on purpose:
    // the probe fixtures in test/eslint-db-wall.test.ts must contain these
    // exact strings to prove the rules fire, a test file ships to nobody, and
    // the import bans above still cover the whole app. T-LINT-7 pins the
    // exemption; T-LINT-5/T-LINT-5b pin that the rule still fires under
    // src/ and app/.
    files: [
      "apps/web/app/**/*.{ts,tsx,mts,cts}",
      "apps/web/src/**/*.{ts,tsx,mts,cts}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // Repeated, not inherited. Flat config REPLACES a rule's whole
        // configuration when a later object sets the same rule id — it does
        // not merge the options — so omitting this selector here would
        // silently reopen the dynamic-import door for exactly the files that
        // hold the credential (apps/web/src/db.ts). Proven red by T-LINT-4
        // against the plan's original two-object shape; do not "de-duplicate"
        // it away.
        webDynamicDbImport,
        {
          selector: "Literal[value=/\\b(daily_puzzles|remote_config)\\b/]",
          message:
            "apps/web must not name the buffer tables: raw SQL through @miolos/db's re-exported `sql` / `.execute()` bypasses the published-predicate wall (ADR-0024 amendment, named #18 duty).",
        },
        {
          // Not optional: without it, sql`select * from daily_puzzles` slips
          // straight through the Literal selector.
          selector:
            "TemplateElement[value.raw=/\\b(daily_puzzles|remote_config)\\b/]",
          message:
            "apps/web must not name the buffer tables: raw SQL through @miolos/db's re-exported `sql` / `.execute()` bypasses the published-predicate wall (ADR-0024 amendment, named #18 duty).",
        },
      ],
    },
  },
  prettier,
);
