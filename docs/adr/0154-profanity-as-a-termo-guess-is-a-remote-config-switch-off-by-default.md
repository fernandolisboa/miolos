# ADR-0154 — Profanity as a Termo guess is a remote config switch, off by default

**Status:** Accepted — 2026-10-23 (issue #435)
**Depends on:** [ADR-0025](./0025-remote-config-is-a-database-table.md), [ADR-0078](./0078-the-free-play-wall-is-proved-on-the-runtime-module-graph.md), [ADR-0152](./0152-the-termo-guess-dictionary-is-vero-plus-the-frozen-ime-forms.md)
**Supersedes in part:** [ADR-0152](./0152-the-termo-guess-dictionary-is-vero-plus-the-frozen-ime-forms.md) decision 4 — the `PROFANITY_IS_A_GUESS` constant.
**Amends:** [ADR-0097](./0097-admins-are-an-env-allow-list-and-edit-remote-config-through-the-api.md) decision 5 and its out-of-scope "non-numeric keys" — a boolean key is a switch row on `/admin`.

## Context

Fernando (2026-10-23): "palavrão pode filtrar como 'não está na lista' sim; … da pra deixar isso como opção configurável nos ajustes do admin? mas, a princípio, filtra." ADR-0152 made the choice a build-time constant, so changing it took a deploy.

## Decision

1. **Data.** `generate:termo` writes `src/termo/profanity.generated.ts`: `PROFANITY_GUESSES`, the `profanity` rows of `excluded.txt` that are in `validation.txt` (41 forms), under the same MPL notice. The dictionary never holds them. `isValidGuess(word, acceptsProfanity)` takes a required flag and splits the list inside the call, so no new top-level value joins the five PURE markers.
2. **Config.** `remoteConfigSchema` gains `termoAcceptsProfanity: z.boolean().default(false)`. No migration: an absent row reads the default. `remoteConfigField`, `setRemoteConfigValue`, `saveRemoteConfigValue` are generic on the key, and `adminConfigWriteSchema.value` takes a number or a boolean; the per-key refine still rejects the wrong one.
3. **Server judge.** `POST /termo/guess` accepts the newest guess when it is a dictionary word, or when it is a profanity form and the stored switch is on. Config is read only in that second case.
4. **Client judge.** The daily and the archive pass `acceptsProfanity: true` and leave the profanity forms to the server; its 422 `invalid-guess` already shows "não está na lista" and gives the draft back. **Free play always refuses**: Clássico passes `false`, Dueto and Quarteto call `isValidGuess(word, false)`.
5. **`/admin`.** A boolean key renders as a switch row (label, hint, "Padrão: desligado"), saves on tap through `useAdminWrite`, holds every row while in flight, and shows the server's state after a failure. The `role="switch"` button is one shared `Switch` (`apps/web/src/components/switch.tsx`), which Ajustes' three switches also use.

## Consequences

- Turning the switch on or off takes effect on the next guess, with no deploy. Only the newest guess is judged, so a change never closes a board in play.
- On the daily and the archive a profanity form costs one round trip before "não está na lista"; every other word is still refused on the device.
- Free play has no server and its wall forbids a fetch (ADR-0078), so it cannot read the switch. Refusing there is Fernando's "a princípio, filtra", and free play records and shows nothing to anyone.
- The 246-byte list reaches the three Termo routes only. The forms are already public in `excluded.txt` and VERO, and none is an answer or a pool word, so ADR-0004 is untouched. Measured: `/termo` 154.4 of 159 KB, `/arquivo/[data]/termo` 149.4 of 154, `/modo-livre/termo` 140.8 of 145.

## Rejected

- **Fetch the switch into a context and cache it in a device store** for free play: a new endpoint, a third store and a stale value, for a mode that records nothing.
- **Extend `GET /hints`**: Termo has no hints, and each endpoint keeps its own strict contract.
- **A second `isValidGuess`** for profanity: three callers would each compose the two checks.
