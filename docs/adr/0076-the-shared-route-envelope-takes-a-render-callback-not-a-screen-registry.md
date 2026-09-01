# ADR-0076 — The shared route envelope takes a render callback, not a screen registry

**Status:** Accepted — 2026-09-01
**Depends on:** [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0047](./0047-bundle-markers-are-route-scoped.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md)

## Context

#206 cluster 5 extracts the wall-read envelope out of twelve per-game route files into `src/play/daily-route.tsx` and `src/archive/game-route.tsx`. The issue names `src/og/handlers.ts` as the model: one function parameterized by `game: ProjectedGame`, called from a named `async function` in each route file. That transfers for everything except the screen. An OG card is produced from data, so `og/handlers.ts` imports no per-game module. A play route must mount `BinairoScreen`, `ArchiveTermoScreen`, `NonogramConclusion` or `ConclusionView`. A shared envelope can obtain one in two ways: a `Record<ProjectedGame, (daily) => ReactNode>` registry inside the shared module, or a `render` parameter supplied by the route file.

## Decision

The `render` callback. **Neither shared envelope imports a per-game screen or conclusion, ever.** The game token is a literal argument; the JSX composition stays in the route file.

## Consequences

- A registry would put all four screens — and, through `src/termo/termo-conclusion.tsx`, `@miolos/games/termo` — on the module graph of every route importing the shared module. `pnpm bundle-check`'s per-route 40 KB budget is the only thing that measures the cost, and it is not in CI: `ci.yml` runs typecheck, lint, comments, test, build. That gap is #155.
- Nothing else in the gate would see it. `T-WEB-S183` (`archive-day.test.tsx`) matches per-game screens only under `/src/(binairo|sudoku|nonogram|termo)/`, so `src/archive/*-screen` in a registry is invisible to it. `T-WEB-S354` (`client-graph-engine-free.test.ts`) pins nine routes that already reach `day-state`, so a registry cannot move it.
- **`T-WEB-S364` is this decision's wall**: the two envelopes' closures carry no per-game module, and each is reached by exactly its own routes. It exists because the ADR has no other enforcement.
- Cost: one `render` argument per route file, and the game token appears twice per file — once in the envelope call, once in the screen import. That is the price of keeping four screens off eight graphs.
- This is ADR-0029 decision 2 applied, not undone: *"the non-visual layer is shared, JSX composition is per game."* Only the wall read and its failure branches move.

## Rejected

- **A `Record<ProjectedGame, ComponentType>` registry in the shared module.** Reads better and matches `og/handlers.ts` more literally, but couples every consumer to every game, with no gate that fails when it happens.
- **A `[jogo]` dynamic segment.** Already rejected by ADR-0053 decision 1; unchanged here.
