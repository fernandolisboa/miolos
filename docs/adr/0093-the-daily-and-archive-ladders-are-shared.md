# ADR-0093 — The daily and archive screen ladders are shared; a game passes nodes, not branches

**Status:** Accepted — 2026-10-13 (issue #289)
**Depends on:** [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md), [ADR-0065](./0065-a-cross-device-done-day-opens-a-completed-view.md), [ADR-0076](./0076-the-shared-route-envelope-takes-a-render-callback-not-a-screen-registry.md), [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md)
**Amends:** [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md) decision 2 (the screen root is no longer per game), [ADR-0065](./0065-a-cross-device-done-day-opens-a-completed-view.md) decision 3 (the remote-claim branch moves from the screen roots into the shell), [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md) (the shared chrome now looks up per-game copy)

## Context

Six daily screen roots and six archive screen roots each carried the same ladder: unavailable, skeleton, closed and frozen, remote claim, board. Rainhas (#285) copied it a sixth time. The ladders drifted already: the grid games guarded the conclusion with `status === "solved"` and Termo and the archive did not. Every ladder change had to land in twelve files, and a test could not pin the order once.

## Decision

1. **`DailyScreen`** (`play/daily-screen.tsx`) owns the daily ladder, in this order: unavailable, skeleton until hydrated, closed and frozen (the game's conclusion), the server claim (`RemoteConclusionView`), the board. It takes the pieces as nodes: `skeleton` and `view`. A game with its own conclusion (Termo, Nonogram) passes `conclusion: { render, preload }` and the shell calls `render` only on that rung; every other game passes `result`. The shell warms the conclusion chunk on mount, once.
2. **`ArchiveScreen`** (`archive/archive-screen.tsx`) owns the archive ladder (unavailable, skeleton, `LateResult`, board) and `usePriorConclusion`. The archive stays off the conclusion tree (ADR-0053, `T-WEB-S183`).
3. **Each game's screen root keeps only its play hook and its nodes.** Neither shell imports a per-game module (`T-WEB-S364a`), ADR-0076's rule. For that to hold for `play/conclusion-lazy.tsx`, `preloadTermoConclusion` and `preloadNonogramConclusion` moved into the two screens that were their only callers.
4. **The shared chrome reads per-game copy.** `PlayScreenChrome` takes the kicker, title and rules from `messages.games[game]`, and `DailyPlayChrome` fills the back link, date and archive note. Free play's chrome drops the same props.
5. **One record header** (`recordHeader` in `play/play-record.ts`) holds the fields the six play-record schemas share.
6. **Free play may not import `daily-screen`** (`T-LINT-S69`).

## Consequences

- The ladder's order is tested once (`T-WEB-S483`, `T-WEB-S484`), not twelve times.
- The grid games now conclude on any closed board, not only a `solved` one. Their status is `"playing" | "solved"`, so nothing changes today; a game that can lose reaches its conclusion without a new branch.
- A new daily is a play hook, two views and two six-line screen roots.

## Rejected

- **A `useDailyRung()` hook.** Each game would still switch on its result, so the order would still live in twelve files and the shell would only be renamed.
- **Per-game screen roots with a shared helper for one rung.** It removes lines and keeps the drift: the ladder order is the thing that must change together.
- **A `<PlayShell>` laying out board, controls, hint and timer.** ADR-0029 and ADR-0077 rejected that, and this decision does not reopen it. `DailyScreen` selects a branch and lays out nothing.
