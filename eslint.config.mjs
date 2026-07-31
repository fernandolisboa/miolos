// Root flat config — the only ESLint config in the repo (`pnpm lint` runs once at the root).
import { builtinModules } from "node:module";

import js from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

const appGlobs = ["apps/web/**/*.{ts,tsx}", "apps/api/**/*.{ts,tsx}"];

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
  prettier,
);
