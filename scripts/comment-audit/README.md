# comment-audit

The tooling behind `pnpm comments`, the comment-budget gate. The decision it
enforces is [ADR-0075](../../docs/adr/0075-the-comment-budget-is-a-tool-not-a-rule.md);
the rule as written for agents is CLAUDE.md § *Comments*. This file is the
usage reference for the scripts, and nothing else.

## The gate

```sh
pnpm comments
```

runs, in order:

1. `node scripts/comment-audit/selftest.mjs` — the harness that proves the
   measurement is the measurement CLAUDE.md and ADR-0075 describe. It runs
   first because a gate whose implementation has silently changed reports
   green over the wrong rule.
2. `node scripts/comment-audit/density.mjs --tracked` — the budget itself,
   over every tracked file. Exits 1 if any file is over.

Both run in `.husky/pre-commit` and in `.github/workflows/ci.yml`.

## The budget

No file spends more than **3% of its lines, or two lines, whichever is
larger**, on comment-only prose. The floor is what lets a thirty-line file
carry the one comment CLAUDE.md's "write a comment for" list requires; a bare
percentage would forbid it outright.

A line counts when it carries a comment and no code. A `{/* … */}` JSX line
counts — the braces abut the comment and are not code. A trailing `//` (the
prettier anchor that keeps a nonogram bitmap one row per line) sits on a code
line and does not count; a standalone `//` is residue and does.

Directives are exempt and never counted: `eslint-disable`, `eslint-enable`, `@ts-expect-error`, `@ts-ignore`, `@ts-nocheck`, `#__PURE__`, `/// <reference`, `prettier-ignore`, `impeccable-disable`, `impeccable-ignore`, `@vitest-environment`, `c8 ignore`, `v8 ignore`, `istanbul ignore`.

That list lives in `DIRECTIVES` in `density.mjs`. The copies here and in
CLAUDE.md are read back by `selftest.mjs`, which fails if the three drift.

Generated files are skipped, and the skipped set is pinned by name in
`selftest.mjs` so that adding a fourth is a visible decision rather than a
header a file writes for itself.

## The scripts

| file | what it is |
|---|---|
| `density.mjs` | the gate. `--tracked` for the corpus, or a file list. `--max N` for a different percentage. |
| `count.mjs` | comment ranges and per-file counts, and the parser both scripts share. Its CLI reports only/touched/ranges. |
| `selftest.mjs` | the harness. Every rule the budget states has a check here. |

## Changing this directory

A change to `density.mjs`, `count.mjs`, the `comments` script in
`package.json`, or the gate steps in `.husky/pre-commit` and
`.github/workflows/ci.yml` is never a Records-row change — see CLAUDE.md
§ *Pick the flow, then work*. The gate that would catch a mistake here is the
one being edited.

Add the check before the rule. A rule with no check in `selftest.mjs` is a
rule the next refactor deletes for free.
