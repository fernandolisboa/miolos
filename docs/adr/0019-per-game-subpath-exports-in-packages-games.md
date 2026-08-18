# 0019 — Per-game subpath exports in packages/games

**Status:** Accepted — 2026-07-31

## Context

ADR-0011 requires per-game code-splitting in the web bundle: the Sudoku
generator must not ride along on the Binairo page. `@miolos/games` exposed a
single root export (`"."`). If game modules were re-exported from the root
barrel, every consumer of any game would statically reach all games, and
splitting would depend on tree-shaking heuristics — fragile, and invisible
when it breaks. Four game engines (Binairo, Sudoku, Nonogram, Termo) are
being built on parallel branches and need a mergeable convention now.

## Decision

- Each game lives in `packages/games/src/<game>/` with its public API in
  `src/<game>/index.ts`.
- `package.json` `exports` maps one subpath per game:
  `"./<game>": "./src/<game>/index.ts"`. Keys are ordered `"."` first, then
  game subpaths alphabetically, so parallel branches produce mergeable hunks.
- The root barrel `src/index.ts` exports shared substrate only (seeded PRNG,
  `Weekday`) and never re-exports a game module.
- Consumers import `@miolos/games/<game>` (e.g. `@miolos/games/binairo`);
  `apps/web` resolves this with `moduleResolution: bundler` against the
  source-level exports map — no build step, matching the existing setup.

## Consequences

- The module boundary, not tree-shaking, guarantees per-game splitting.
- Cross-game imports would have to be written explicitly as relative paths
  across game directories; reviewers treat any such import as a smell.
- The purity gates (test/purity.test.ts raw-text scan, eslint games block,
  `types: []` tsconfig backstop) already scan `src/**` recursively and apply
  to every game directory unchanged.
- The Sudoku, Nonogram and Termo engine tickets follow this convention and
  cite this ADR instead of re-deciding.
