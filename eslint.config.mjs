// Root flat config — the only ESLint config in the repo (`pnpm lint` runs once at the root).
import { builtinModules } from "node:module";

import js from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const appGlobs = ["apps/web/**/*.{ts,tsx}", "apps/api/**/*.{ts,tsx}"];

// Every extension the apps/web db wall covers. `.mts`/`.cts` were added when a
// `.mts` file slipping a `.ts`-only glob turned out to be a proven evasion
// vector (PR #48 step 6); the plain-JS extensions close the identical hole
// (step 6 finding web-db-wall-glob-misses-js-jsx-mjs). apps/web/tsconfig.json
// sets `allowJs` with `checkJs` off and next.config.ts overrides no
// `pageExtensions`, so `apps/web/app/<route>/page.jsx` is a real route that
// typechecks — it must not be able to import the solution-bearing reader.
const webWallExtensions = "{ts,tsx,mts,cts,js,jsx,mjs,cjs}";

// Part of the apps/web db wall (ADR-0024 §5). Named because they have to appear
// in BOTH wall config objects below — see the comment at their second use.
const webDynamicDbImport = {
  // no-restricted-imports cannot see dynamic specifiers.
  selector:
    "ImportExpression > Literal[value=/^@miolos\\/db\\/(publishing|user|testing)(\\/|$)/]",
  message:
    "apps/web is client-serving: dynamic import of the server-internal @miolos/db subpaths is banned (ADR-0024, ADR-0026).",
};

// Companion to webDynamicDbImport, which only sees a plain string specifier:
// import(`@miolos/db/publishing`) and import("@miolos/db/" + "publishing")
// walked straight through it (step 6 finding
// dynamic-import-selector-misses-computed-specifiers). Matching on `source`
// rather than on any non-Literal child is deliberate — ImportExpression also
// carries the options argument, so `> :not(Literal)` would false-positive on
// import("./x.json", { with: { type: "json" } }).
const webComputedDynamicImport = {
  selector: 'ImportExpression[source.type!="Literal"]',
  message:
    "apps/web is client-serving: a computed dynamic import() specifier is banned — it evades the @miolos/db import restrictions (ADR-0024, ADR-0026).",
};

// no-restricted-imports does not see require() either, so covering `.cjs` above
// would otherwise leave CommonJS as an open door. apps/web is `"type": "module"`
// and has no require() call in source, so ban the call outright — the same
// closure packages/games already uses below.
const webRequireCall = {
  selector: "CallExpression[callee.name='require']",
  message:
    "apps/web is client-serving ESM: require() is banned — it evades the @miolos/db import restrictions (ADR-0024, ADR-0026).",
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
    // Plain-JS extensions under the two Next apps. Without an entry that NAMES
    // them, `.jsx` is matched by no config object in the repo at all —
    // eslint-config-next's repo-wide globs are force-scoped to `{ts,tsx}` above
    // — so ESLint skips the file outright ("File ignored because no matching
    // configuration was supplied") and the db wall below never runs on it
    // (step 6 finding web-db-wall-glob-misses-js-jsx-mjs). JSX has to be
    // enabled explicitly here: espree would otherwise die at the first `<`,
    // which would report the wall as silent for the wrong reason.
    files: ["apps/web/**/*.{js,jsx,mjs,cjs}", "apps/api/**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
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
    // The extension list is shared and deliberately wide — see
    // `webWallExtensions`.
    files: [`apps/web/**/*.${webWallExtensions}`],
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
            {
              // Banning the bare specifiers is not enough on its own: a
              // relative path into the package source reaches `completions`,
              // `hint_grants`, `daily_puzzles` and `remote_config` with no rule
              // firing, falsifying plan 017 D17's "apps/web cannot even *name*
              // completions or hint_grants" (step 6 finding
              // web-db-wall-has-no-relative-path-ban).
              group: [
                "**/packages/db/src",
                "**/packages/db/src/*",
                "**/packages/db/src/**",
              ],
              message:
                "apps/web is client-serving: reach the db through the `@miolos/db` package entry, never by relative path into packages/db/src — the deep path hands out every server-internal table (ADR-0024, ADR-0026).",
            },
          ],
          paths: [
            {
              name: "@miolos/db",
              // `users` and `sessions` are on the root entry too, and
              // `db.select().from(users)` needs neither `sql` nor `eq` — an RSC
              // payload of every user row (or every session token hash) was one
              // import away (step 6 finding
              // root-entry-users-and-sessions-are-importable-from-apps-web).
              importNames: ["sql", "eq", "users", "sessions"],
              message:
                "apps/web must not build queries or touch the identity tables: read the daily through `getTodayDaily`. Raw SQL via the re-exported `sql` bypasses the published-predicate wall (ADR-0024 amendment), and every `users`/`sessions` read belongs to apps/api (ADR-0007/0014).",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        webDynamicDbImport,
        webComputedDynamicImport,
        webRequireCall,
      ],
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
      `apps/web/app/**/*.${webWallExtensions}`,
      `apps/web/src/**/*.${webWallExtensions}`,
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        // Repeated, not inherited. Flat config REPLACES a rule's whole
        // configuration when a later object sets the same rule id — it does
        // not merge the options — so omitting these selectors here would
        // silently reopen the dynamic-import and require() doors for exactly
        // the files that hold the credential (apps/web/src/db.ts). Proven red
        // by T-LINT-4/T-LINT-4b/T-LINT-4c against the plan's original
        // two-object shape; do not "de-duplicate" them away.
        webDynamicDbImport,
        webComputedDynamicImport,
        webRequireCall,
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
