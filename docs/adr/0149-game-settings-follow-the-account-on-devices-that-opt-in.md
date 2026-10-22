# ADR-0149 — Game settings follow the account on devices that opt in

**Status:** Accepted — 2026-10-22 (issue #317)
**Amends:** [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 1 ("settings live on the device… nothing else of free play is stored"); [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decision 4 and [ADR-0078](./0078-the-free-play-wall-is-proved-on-the-runtime-module-graph.md) decision 1, for the settings only

## Context

Settings were device-local (ADR-0102). Fernando wants them across devices, but only where the player asks: a phone and a PC may want different settings (2026-10-22). `users.game_settings jsonb` exists on production (migration 0018).

## Decision

1. **Per-device opt-in.** Ajustes' *Jogos* card has *Sincronizar com a conta*, off by default. The flag lives in `miolos-settings-sync` (`{ on, pending }`, `apps/web/src/settings/sync-state.ts`) and never syncs itself.
2. **The server is blind to setting names.** `gameSettingsPayloadSchema` bounds the shape (three levels, key pattern, leaf types, 40 keys, 4096 characters); the web parses what it reads with its own schema (`settingsFrom`), so ADR-0102 keeps one place to add a setting. `GET /account/game-settings/state`, `POST /account/game-settings` replace the whole copy.
3. **Who wins.** Turning sync on adopts the account copy; an empty account is seeded only by a device whose `miolos-settings` key exists. A change is `pending` from the moment it is seen until a 2xx; a pending device pushes on its next start. A change made while the account is read beats the read. A 4xx clears `pending`.
4. **One module talks to the server** (`account-sync.ts`): started lazily by `SessionBootstrap` when the flag is on, and by the switch. It listens in-tab only (`subscribeInTab`), so one tab pushes one change. Every push re-reads the flag first, so *off* stops it in every tab.
5. **Merge and deletion.** `mergeAccounts` keeps the winner's copy, takes the loser's when the winner has none, and empties the tombstone. A successful deletion clears this device's flag.

## Consequences

- With sync on, a settings change made on a free-play page leaves the device through the root layout. `T-WEB-S374` still holds: free play's own graph reaches no sync module.
- A tab running an older build drops a newer key from the copy it sends; that setting falls back to its default elsewhere until changed again.
- Root-layout growth is not budgeted by `bundle-check` (it measures over `/`); the PR states `/`'s first load.

## Rejected

- **Sync for every signed-in player:** Fernando's per-device answer.
- **The settings schema in `packages/core`:** a second place to edit per setting, with no consumer that needs names.
- **Per-field last write wins:** timestamps per field for a dozen switches.
