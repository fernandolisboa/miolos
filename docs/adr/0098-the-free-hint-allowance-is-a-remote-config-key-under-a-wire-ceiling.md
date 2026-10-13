# ADR-0098 — The free hint allowance is a remote config key served by `GET /hints`, under a wire ceiling

**Status:** Accepted — 2026-10-13 (issue #304)
**Depends on:** [ADR-0025](./0025-remote-config-is-a-database-table.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0048](./0048-the-streak-is-a-client-fetched-server-computed-value.md), [ADR-0078](./0078-the-free-play-wall-is-proved-on-the-runtime-module-graph.md), [ADR-0097](./0097-admins-are-an-env-allow-list-and-edit-remote-config-through-the-api.md)
**Supersedes in part:** [ADR-0095](./0095-three-free-hints-per-puzzle.md) decision 1 and its "A configurable limit now" rejection
**Amends:** [ADR-0025](./0025-remote-config-is-a-database-table.md) — client-serving code now reads one config value, through `GET /hints`

## Context

Fernando wants to tune how many free hints a daily or archive puzzle offers from `/admin`, without a deploy. The count was the constant `FREE_HINTS_PER_PUZZLE`, and the same number bounded the wire, the `/day` claim and the local play record. The web reads the database as `miolos_web`, which may select only `daily_puzzles` ([ADR-0026](./0026-completions-are-write-once-rows-on-time-is-derived.md), #59), so it cannot read `remote_config` itself.

## Decision

1. **`freeHintsPerPuzzle` is a `remoteConfigSchema` key**, an integer from 1 to `HINTS_PER_PUZZLE_CEILING` (9), defaulting to `FREE_HINTS_PER_PUZZLE` (3). It appears on `/admin` like every other key.
2. **`HINTS_PER_PUZZLE_CEILING` is the only wire number.** `hintsUsedSchema` (`packages/core/src/completion.ts`) bounds every completion member, the `/day` claim and `recordHeaderShape` with it, and the reducers stop there. The server enforces only the ceiling: hints are computed on the client (ADR-0027), and lowering the value must never reject a completion already played.
3. **`GET /hints` (`apps/api/app/hints/route.ts`) answers `hintAllowanceResponseSchema`**, its own strict contract (ADR-0048 decision 3), as a credentialed `no-store` read with no session.
4. **Only the ten hinted daily and archive pages fetch it**, through `FetchedFreeHints` (`apps/web/src/api/free-hints-provider.tsx`). The play hooks and the chrome read `useFreeHintsPerPuzzle()` (`apps/web/src/play/free-hints.tsx`): `null` while loading (no hint offered, the label counts from 3), 3 on any failure. Free play has no provider and reads the default, so the free-play wall stays closed (ADR-0078).

## Consequences

- No value above 3 can be stored before the new `apps/api` is live; a new web on an old api gets a 404 and uses 3.
- **Rollback floor:** set the key to 3 or less and wait for the São Paulo rollover before rolling either app back. Even then, an old web reads a local record with more than 3 hints as no record on any date, archive included, and an open tab on the old bundle fails to parse a `/day` claim with more than 3 hints from another device.
- An open tab keeps the value it loaded. Each hinted view costs one small query.
- `FreeHintsContext` is the first React context in `apps/web`.

## Rejected

- **Reading the key in the web's RSC render.** It needs a hand-run production `GRANT` to `miolos_web` and widens [ADR-0014](./0014-apps-web-reads-the-database-directly-for-public-pages.md)'s direct reads past `daily_puzzles`.
- **An uncredentialed endpoint.** Every per-view read from the web is credentialed; one exception buys nothing.
- **A hook parameter or a `HintState` field.** Ten screen roots would thread a number the context already carries.
- **Per-game values, and 0.** One rule for every game; 0 would read "Dicas usadas" on an untouched puzzle.
