# ADR-0157 — *Feitos hoje* settles before first paint and never moves after

**Status:** Accepted — 2026-10-26 (issue #446, epic #442)
**Depends on:** [ADR-0079](./0079-the-theme-is-a-device-preference-applied-before-paint.md), [ADR-0156](./0156-each-daily-is-its-own-taped-card-and-no-card-sits-alone-on-a-row.md)
**Amended in place:** #452 — decision 5: desktop slips share the content box in equal tracks instead of a fixed 300px.
**Amends:** ADR-0156's consequence that a tucked card must leave the DOM; [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md) decision 1, since the tuck rule derives "finished" a second time, from the raw records, because it must run before any bundle has loaded.

## Context

A daily finished today leaves the hub's card grid for a compact *Feitos hoje* list. The hub is server-rendered with every daily pending; the device's play records are read only after hydration, and the server's day truth later still. Moving cards at either moment reshuffles the page in front of the player.

## Decision

1. **Two raw inline scripts, never bundled** (`holdScript`, `tuckScript` in `src/hub/tuck.ts`), rendered by `HubBoard` around the board. The first sets `data-hub-hold` on `<html>`, which hides the board while it streams; the second reads only the lineup's own record keys plus one mirror key, hides finished cards, unhides their rows, sets `--card-count`, and lifts the hold in a `finally`. The board is painted once, already partitioned.
2. **One partition per visit.** `useSettledTuck` reads the same rule (`tuckedGames`, Zod over the raw records) once per mount through `useSyncExternalStore`, so hydration renders the server's markup and the next commit writes the attributes the script already set. Its mount effect lifts the hold, in case the script never ran, and clears the stamp, so a later mount reads storage again. Only the card or the row that shows a game subscribes to its day state. A client navigation reads it in the first commit and renders no script. Afterwards nothing re-partitions: a game finished in another tab or confirmed by the server flips its card's stamp in place, and the next visit tucks it.
3. **Hide, don't remove.** React-owned nodes cannot leave the DOM before hydration, so tucked cards and untucked rows carry `hidden`, and the tilt cycle and the phone's odd-last-card rule count `:not([hidden])` through `:nth-child(… of S)`.
4. **The server's word survives the visit.** When the day truth arrives, the games it holds as finished are mirrored to `miolos:hub-server-done` (`src/hub/server-done.ts`) for that date; a game finished on another device is tucked from the next load on. Deleting the account clears it.
5. **A row never shows a wrong word.** Until its state is known a row shows only its swatch and name; the chip and the result fill in place. Desktop slips share the content box in equal tracks of at least 330px (`repeat(auto-fit, minmax(330px, 1fr))`; a tucked row is `display: none` and takes no track), so the list ends where the doors do and a track's width depends only on the box and the slip count: filling a slip never re-wraps the list. 330px keeps "Campo Minado" on one line.

## Consequences

- `:nth-child(… of S)` needs Chrome 111, Firefox 113, Safari 9: inside the window ADR-0156 accepted for `round()`.
- React reads the client snapshot only after hydration, seconds after the script on a slow phone. So on a hard load `useSettledTuck` adopts what the script painted (`scriptedTuck`, keyed by `data-hub-settled`), never a second storage read: a game finished in that window flips its stamp in place.
- A record that passes the tuck rule but fails the full play-record schema is tucked with a name-only row.
- With JavaScript off, neither script runs and the server layout shows every card pending.
- The mirror belongs to the device, not the account: after switching accounts it can tuck the previous account's games for one visit, until the new day truth overwrites it.
- A `script-src` policy, if one is ever added, must carry a nonce or hash for both scripts; without them the board partitions only after hydration, and moves once.

## Rejected

- **Reserving the layout until hydration:** it paints an empty or wrongly sized region, then moves everything below it once JavaScript arrives.
- **A cookie mirror for server rendering:** every record write path would keep a second store in sync, and it would still go stale against storage.
- **A script that only runs after the board without the hold:** the browser can paint a partly parsed board between network chunks.
