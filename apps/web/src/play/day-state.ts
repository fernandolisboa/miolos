/**
 * What THE USER's day looks like, as far as this device and the server
 * together know (ADR-0031 as amended by ADR-0060, plan 018 §11.2).
 *
 * TWO INPUTS, NOT ONE, since #83. The local play records are one of them —
 * the device's own claim, an affordance and never an entitlement (ADR-0031
 * decision 6) — and `GET /day`'s payload is the other, which is the
 * authority. `readDayState` is still the ONE seam that derives completion
 * (ADR-0031 decision 1's surviving property); what it returns is now the
 * device's record merged with the server's claim for today, under the
 * invariant `mergeDayStatus` carries: the server makes a claim exactly when
 * its status is not `pending`, and `pending` from the server is the absence
 * of a completion row and therefore the absence of a claim, never a denial.
 *
 * IT STILL DOES NOT WIDEN ADR-0014's DIRECT-READ SCOPE. The payload carries
 * no puzzle content of any kind and answers about today only (ADR-0004,
 * ADR-0060 decision 2), and it arrives on the authenticated surface
 * ADR-0031 decision 4 routes server-sourced user facts to.
 *
 * WHAT SURVIVES OF THE MONOTONE ARGUMENT, and what does not. The day state
 * still can never OVERSTATE the user's day: a done tile now means the
 * device or the server holds a completion, and both are real. What is no
 * longer true is the mechanism — "absence proves nothing and reads as
 * pending" — because absence ON THE DEVICE now reads as whatever the server
 * says. The cold profile and `impeccable detect` are unchanged (no session,
 * `/day` answers 401, the pending composition is what is scanned); THE
 * SECOND DEVICE IS NOT, and that is the whole point of #83.
 *
 * THE LOCAL PROJECTION IS THE OFFLINE FALLBACK, unchanged. Every failure of
 * the fetch — env unset, 401, network, a malformed body — answers
 * `undefined`, and `undefined` leaves the shipped local reader as the whole
 * answer. Nothing on a play path awaits it.
 */
import {
  GAMES,
  mergeDayState,
  type DayGameState,
  type DayGameStatus,
  type DayResponse,
  type Game,
} from "@miolos/core";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { useDayTruth } from "../day/day-truth";
import { readPlayRecord } from "./play-record";
import { subscribeToPlayRecords } from "./use-record-snapshot";

/**
 * CONTEXT.md's verbs, minus the one no reader on this side can see: a LATE
 * completion is an archive fact the server owns (#31), so this projection
 * has three states, not four.
 *
 * AN ALIAS OF THE WIRE VOCABULARY SINCE #83, not a second spelling of it.
 * `DayGameStatus` in packages/core feeds both `dayResponseSchema` and the
 * merge arithmetic, so the local projection and the payload cannot drift
 * into two enums that agree today and diverge later — which is what makes
 * `mergeDayStatus` a merge rather than a translation.
 *
 * `played` exists because ADR-0008 decision 3 makes a lost Termo *played* and
 * never *completed*: it counts for neither streak nor Dia Perfeito, and it is
 * still visibly finished for the day.
 *
 * NEVER OVERSTATING SURVIVES #83; the mechanism behind it does not. `played`
 * is a WEAKER claim than `completed`, not a stronger one: it publishes no
 * time and enters no count. It drives a chip, a tile shape and a CTA target
 * — the affordances ADR-0031 decision 6 permits — and never an entitlement.
 * What changed is that absence on the DEVICE no longer implies `pending`:
 * the server may hold a completion this device has no record of, and then
 * the tile is done (ADR-0060 decision 3).
 *
 * AN ENUM RATHER THAN A SECOND FLAG, deliberately. A `closed` boolean beside
 * `concluded` would fail SAFE: a consumer that forgot it would read pending.
 * This fails CLOSED: `DayEntry.concluded` ceases to exist, so every consumer
 * is a red typecheck and each one has to decide. That is the same choice
 * `sync.ts`'s `const unhandled: never` and this file's spelled-out
 * `Record<Game, DayEntry>` literal already make.
 */
export type DayStatus = DayGameStatus;

export interface DayEntry {
  readonly status: DayStatus;
  /**
   * Only ever set on a `completed` entry, and not on every one of those. A
   * part-played board carries a real `elapsedMs` too, and publishing that as
   * the day's result would put a time on a game nobody finished — which is
   * exactly what a lost Termo is. A WON Termo carries none either: its
   * elapsed time includes every per-guess round trip (ADR-0045 decision 4),
   * so the number is meaningless for that game and is never published. Both
   * consumers therefore branch on `status` and never on this field's
   * presence. Since #141 the value can come from EITHER side of the merge —
   * the local record, or the server claim that won — with the same per-game
   * rules on both.
   */
  readonly elapsedMs: number | undefined;
}

const PENDING: DayEntry = { status: "pending", elapsedMs: undefined };

/**
 * Every game reads pending. It is both the honest cold-profile answer and
 * the pre-hydration one (below), so the first paint of the hub and of the
 * conclusion's day card is a legitimate value rather than a placeholder.
 */
const NOTHING_DONE: Readonly<Record<Game, DayEntry>> = {
  termo: PENDING,
  sudoku: PENDING,
  nonogram: PENDING,
  binairo: PENDING,
};

/**
 * The day state for the SERVER's `date` — never a client-computed today
 * (CONTEXT.md "Rollover").
 *
 * `server` is the payload `GET /day` answered with, and `undefined` means
 * NO SERVER TRUTH, FOR ANY REASON — unfetched, in flight, env unset, 401,
 * offline, malformed. In that case this is exactly the local projection
 * that shipped before #83, byte for byte, which is what makes the offline
 * fallback ADR-0031 decision 1 requires a property of the code rather than
 * a promise.
 *
 * Spelled out game by game rather than folded over `GAMES` so the return
 * type keeps the map TOTAL over `Game`: a key dropped from this literal does
 * not compile, which is what makes a missing tile impossible.
 *
 * It is NOT an exhaustiveness tripwire, and calling it one would promise a
 * safety net nobody has: `GAMES` has carried all four games since day one
 * (packages/core/src/game.ts), so #23, #25 and #27 each added no key here.
 * The member they do have to add is `playRecordSchema`'s — that union is
 * where the compile error waits (finding
 * `day-state-exhaustiveness-tripwire-cannot-fire-for-25-27`).
 *
 * What #27 DID change is everything else in this file (ADR-0044 consequence
 * (c)): the entry type, the reader, the counter and the comparator. The map
 * itself is untouched, exactly as the finding above predicted — and #83
 * leaves it untouched again, adding a second parameter rather than a key.
 */
export function readDayState(
  date: string,
  server?: DayResponse,
): Readonly<Record<Game, DayEntry>> {
  return applyDayTruth(
    {
      termo: entryFor("termo", date),
      sudoku: entryFor("sudoku", date),
      nonogram: entryFor("nonogram", date),
      binairo: entryFor("binairo", date),
    },
    date,
    server,
  );
}

/**
 * The merge, and THE DATE PRECONDITION THAT GUARDS IT (ADR-0060 decision 3).
 *
 * THE PAYLOAD IS DISCARDED IN FULL unless `server.date === date`. A payload
 * for another day is not weaker evidence — it is evidence about a DIFFERENT
 * QUESTION, and merging it across the São Paulo rollover would paint
 * yesterday's dones onto today's tiles, the false *done* ADR-0031 decision 2
 * forbids by name. The two dates really can disagree: `date` comes off the
 * WEB SERVER's clock (`app/page.tsx`) and the payload's off the DB's, so
 * they differ for seconds across midnight. This is `TermoDoneLink`'s shipped
 * `stats.date !== date` gate applied to the whole payload — with a strictly
 * larger blast radius, said out loud: that gate discards a CAPTION and the
 * tile keeps its shape, while this one discards a TILE SHAPE, so for the
 * length of the skew a cross-device done reverts to pending. What is lost is
 * only the cross-device ADDITION, never a local truth, and the next fetch
 * whose date matches restores it — WHICH IS TRUE OF THE SKEW AND NOT OF A
 * REAL ROLLOVER. `date` is resolved once, by the server component, and is
 * frozen for the tab's lifetime; across a real São Paulo midnight on an
 * already-open tab the payload's date moves to D+1 and never returns to D,
 * so no later fetch matches and a cross-device *Feito* that was on screen
 * before midnight reads *Jogar hoje* until the tab navigates or reloads.
 * That tab is showing yesterday either way, and the local reader keeps its
 * own dones, so the direction is still understating and never overstating.
 *
 * IT IS ALSO THE ROLLOVER MECHANISM: after SP midnight the payload's date
 * moves and the page's does not, so the payload is ignored and the hub falls
 * back to the local reader for the day it is actually rendering.
 *
 * `elapsedMs` FOLLOWS THE SIDE WHOSE CLAIM WON, never blended across the two
 * sources (#141, ADR-0060 decision 3's "nothing is blended field by field").
 * Where the server claims — its status is not `pending` — the entry is the
 * SERVER's claim whole: its status and its `elapsedMs`, which the payload
 * carries for a completed grid game since #141 and never for Termo or a
 * played game (ADR-0045 decision 4; a time beside a loss frames it as a
 * result). Where the server does not claim, the entry is the LOCAL one
 * whole, duration included. A cross-device `completed` therefore renders
 * the same done tile a local completion does, time and all — and where the
 * payload carries no duration (Termo), the chip-only shape the hub already
 * ships.
 *
 * The identity of `local` is handed back untouched when the merge changes
 * nothing, so an unchanged payload and unchanged records re-render nothing.
 */
function applyDayTruth(
  local: Readonly<Record<Game, DayEntry>>,
  date: string,
  server: DayResponse | undefined,
): Readonly<Record<Game, DayEntry>> {
  if (server === undefined || server.date !== date) {
    return local;
  }
  // POINTWISE, in packages/core: game g's answer depends on no other game's
  // status, which is what makes the date gate above the only whole-payload
  // rule anywhere in the merge.
  const merged = mergeDayState(
    {
      termo: local.termo.status,
      sudoku: local.sudoku.status,
      nonogram: local.nonogram.status,
      binairo: local.binairo.status,
    },
    {
      termo: server.games.termo.status,
      sudoku: server.games.sudoku.status,
      nonogram: server.games.nonogram.status,
      binairo: server.games.binairo.status,
    },
  );
  const next: Readonly<Record<Game, DayEntry>> = {
    termo: entryFromMerge(local.termo, merged.termo, server.games.termo),
    sudoku: entryFromMerge(local.sudoku, merged.sudoku, server.games.sudoku),
    nonogram: entryFromMerge(
      local.nonogram,
      merged.nonogram,
      server.games.nonogram,
    ),
    binairo: entryFromMerge(
      local.binairo,
      merged.binairo,
      server.games.binairo,
    ),
  };
  return GAMES.every((game) => next[game] === local[game]) ? local : next;
}

/**
 * One game's merged entry. `status` is `mergeDayState`'s answer — the
 * invariant's one spelling, in packages/core — and the duration follows the
 * side that answer came from: the server's wherever it claimed
 * (`claim.status !== "pending"`, the same condition the merge turned on),
 * the local record's where it did not. The local entry is returned by
 * IDENTITY when nothing moved, field for field, so an agreeing payload
 * re-renders nothing.
 */
function entryFromMerge(
  local: DayEntry,
  status: DayStatus,
  claim: DayGameState,
): DayEntry {
  const elapsedMs =
    claim.status === "pending"
      ? local.elapsedMs
      : status === "completed"
        ? claim.elapsedMs
        : undefined;
  return status === local.status && elapsedMs === local.elapsedMs
    ? local
    : { status, elapsedMs };
}

/**
 * How many of the day's games this device has COMPLETED — never merely
 * played. A lost Termo does not enter "X de 4 concluídos" (ADR-0008
 * decision 4: *"A day containing a lost Termo is not perfect, whatever else
 * happened"*).
 */
export function completedCount(
  state: Readonly<Record<Game, DayEntry>>,
): number {
  return Object.values(state).filter((entry) => entry.status === "completed")
    .length;
}

/**
 * `readDayState`, subscribed to BOTH of its inputs: the record store the
 * snapshot polls (plan 018 §11.2) and the day-truth store (#83) — one
 * mechanism each, so a completion settled by `sync.ts` and a completion the
 * server holds cannot reach one reader and not the other.
 *
 * Both server snapshots are the empty answer — `NOTHING_DONE` for the
 * records and `undefined` for the payload — which is what makes the
 * pre-hydration paint free AND correct: React renders the server markup and
 * the hydrating client render from `getServerSnapshot`, so the two agree by
 * construction, NO FETCH HAPPENS AT RENDER, and the stores are consulted
 * only afterwards.
 *
 * HYDRATION CAN NOW DEMOTE, IN EXACTLY ONE CASE, where every shipped surface
 * used to promise it could only ever ADD a done tile. The case is the server
 * contradicting the device on a LOST TERMO: won here, lost on another
 * device, so the merged day reads `played` and `X de 4` drops by one. That
 * is a CORRECTION, not an understatement — the row is write-once (ADR-0026
 * decision 1), the day genuinely does not count for the streak, and it is
 * the direction ADR-0031 decision 2 permits. It is Termo-only in v1: no grid
 * game can be lost. THE SAME ONE-LINE RULE PROMOTES IN THE MIRROR — lost
 * here, won elsewhere reads `Feito` — and both arms are ADR-0060 decision 7.
 *
 * `localStorage` IS read during render, inside `getSnapshot`, which is the
 * store contract and not an accident; what never happens is a read from a
 * component body or an effect racing the paint (plan 017 D28). No component
 * reads the clock either — a duration comes from the record.
 *
 * The `useMemo` is what keeps this hook's answer referentially stable: both
 * snapshots are stable across renders that changed nothing, so the merge
 * runs again only when one of them really moved.
 */
export function useDayState(date: string): Readonly<Record<Game, DayEntry>> {
  const local = useSyncExternalStore(
    subscribeToPlayRecords,
    useCallback(() => dayStateSnapshot(date), [date]),
    serverDayState,
  );
  // NO ARGUMENT, deliberately (see `day/day-truth.ts`): one module-level
  // slot serves one "today" payload, and the date filter lives below where
  // the rendered day is already a parameter.
  const truth = useDayTruth();
  return useMemo(() => applyDayTruth(local, date, truth), [local, date, truth]);
}

/**
 * The SERVER's claim about one game of the rendered day, or `undefined`
 * where it makes none (#142, ADR-0065). This is the seam the remote
 * conclusion view reads — the payload's own claim object, `elapsedMs` and
 * `hintsUsed` included — and it lives HERE so ADR-0060 consequence (d)
 * stays true: `src/day/**` is imported by this module and by nothing else.
 *
 * THE SAME TWO GATES `applyDayTruth` APPLIES, deliberately re-spelled at
 * this seam because the two consumers read different shapes:
 *
 * - the WHOLE-PAYLOAD date gate — a payload for another day is evidence
 *   about a different question, and after the SP rollover it is what retires
 *   the remote view (the tile gate's own mechanism, one surface more);
 * - `pending` is the ABSENCE of a claim, never a denial (ADR-0060 decision
 *   3), so it answers `undefined` — the caller falls through to the
 *   playable board exactly as it did before this hook existed.
 *
 * IT NEVER WRITES ANYTHING: a projection of the payload, dying with the
 * evidence for it (the store retires the payload only via the date gate).
 * The HOOK CALL HOISTS to the top of each screen root, beside the play hook
 * and before every early return (rules of hooks — each root returns early);
 * only the BRANCH on its answer sits after `isClosedAndFrozen`, so a local
 * closed record always outranks the claim (ADR-0060 decision 7's mirror).
 */
export function useServerDayClaim(
  date: string,
  game: Game,
): DayGameState | undefined {
  const truth = useDayTruth();
  if (truth === undefined || truth.date !== date) {
    return undefined;
  }
  const claim = truth.games[game];
  return claim.status === "pending" ? undefined : claim;
}

/**
 * Ask the day-truth store to refetch, once (#64, ADR-0070). Renamed on the
 * way through — `refreshDayTruth` inside `src/day/**`, `refreshServerDay`
 * out here — on `useServerDayClaim`'s own precedent: the play layer's
 * vocabulary is "server day", the store's is "day truth", and the two names
 * being different is what keeps a reader from thinking the play layer owns
 * the store.
 *
 * THE RE-EXPORT IS THE POINT, not a convenience. ADR-0060 consequence (d)
 * makes this module the SINGLE importer of `src/day/**` (`T-WEB-S244` pins
 * the list, and `apps/web/test/archive-day.test.tsx` proves the archive's
 * module graph reaches neither), so a caller in `src/play/**` that imported
 * `day-truth` directly would spend a live architectural guard to save one
 * hop. See `refreshDayTruth`'s own TSDoc for what it does and does not
 * guard, and for the no-loop proof.
 */
export { refreshDayTruth as refreshServerDay } from "../day/day-truth";

/**
 * The file's first per-game branch, and it is the narrowest one that can
 * express ADR-0008 decision 3. It is NOT a widening of `readDayState`'s map,
 * which stays total over `Game` and gains no key.
 *
 * `outcome` is READ rather than derived from the tiles because this module is
 * on every route's client graph and must never import a game engine — see the
 * import note in `play-record.ts`. The derivation keeps exactly one
 * definition, in the Termo reducer's `restore`. The honest consequence is
 * ADR-0044 consequence (f): a hand-edited `{concluded: true, outcome: "won"}`
 * on a six-loss board yields `completed` on THIS DEVICE. It is device-local,
 * self-inflicted, and never reaches the wire — the completion body carries
 * the guess words and no verdict.
 *
 * ZERO BEHAVIOUR CHANGE FOR THE THREE SHIPPED GAMES: this returns
 * `"completed"` with the record's `elapsedMs` wherever it returned
 * `concluded: true`, and `"pending"` wherever it returned `PENDING`. The
 * `elapsedMs: undefined` arm is reached only by a termo record.
 */
function entryFor(game: Game, date: string): DayEntry {
  const record = readPlayRecord(game, date);
  if (record === undefined || !record.concluded) {
    return PENDING;
  }
  if (record.game === "termo") {
    // A won Termo publishes no duration either (plan 022 §15.3): the number
    // includes every per-guess round trip and both ADR-0043 and ADR-0045
    // call it meaningless for this game. The hub's `TermoDoneLink` captions
    // the tile `em 4/6` from the SERVER value (#29); `DayEntry` still
    // publishes no duration and gains nothing.
    return record.outcome === "lost"
      ? { status: "played", elapsedMs: undefined }
      : { status: "completed", elapsedMs: undefined };
  }
  return { status: "completed", elapsedMs: record.elapsedMs };
}

/**
 * The REACT SSR snapshot — "the server" here is the rendering server, not
 * the API. It is spelled `serverDayState` and the API's answer is spelled
 * `dayTruth` (`src/day/day-truth.ts`) precisely so the two never read as the
 * same thing two lines apart.
 */
const serverDayState = (): Readonly<Record<Game, DayEntry>> => NOTHING_DONE;

/**
 * A cache for the reason every `getSnapshot` needs one: it must return a
 * referentially stable value or `useSyncExternalStore` loops forever, and
 * `readDayState` builds a fresh object on every call. Keyed on the date,
 * because that is this projection's whole key — it already spans every game.
 *
 * A SINGLE DATE-KEYED SLOT, where `use-record-snapshot.ts` now keys a staleness-swept
 * `Map` (#96, ADR-0056 decision 1): that module has per-game consumers on one
 * page and this projection has none. The defect is the same one level up —
 * two day-states for different dates in one session would evict each other —
 * and it is unreachable today because the hub renders one date. A surface
 * that mounts two owes the same repair here.
 */
let cachedDayState:
  | { readonly date: string; readonly state: Readonly<Record<Game, DayEntry>> }
  | undefined;

function dayStateSnapshot(date: string): Readonly<Record<Game, DayEntry>> {
  // ONE ARGUMENT on purpose: this is the record store's snapshot, so it is
  // the LOCAL projection only. `useDayState` merges the payload in
  // afterwards, which keeps this cache keyed on the records alone and out of
  // the payload's refresh cycle.
  const next = readDayState(date);
  const cached = cachedDayState;
  if (cached?.date === date && sameDayState(cached.state, next)) {
    return cached.state;
  }
  cachedDayState = { date, state: next };
  return next;
}

/**
 * Iterated over `GAMES` rather than `Object.entries`, which widens its keys
 * to `string` and would need a cast to read them back out of a
 * `Record<Game, …>`.
 */
function sameDayState(
  previous: Readonly<Record<Game, DayEntry>>,
  next: Readonly<Record<Game, DayEntry>>,
): boolean {
  return GAMES.every(
    (game) =>
      // `status`, not a duration: a won and a lost Termo both carry
      // `elapsedMs: undefined`, so comparing the duration alone would hand
      // every reader a cached `completed` for the rest of the session.
      previous[game].status === next[game].status &&
      previous[game].elapsedMs === next[game].elapsedMs,
  );
}
