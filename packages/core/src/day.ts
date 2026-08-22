/**
 * Day state as pure functions over completion rows and the local/server
 * claims about a game's day. No clock, timezone or I/O enters this module;
 * callers hand rows already scoped to one user and one SP day, and a client
 * clock never reaches any of it.
 *
 * see ADR-0060
 */
import { z } from "zod";

import type { CompletionOutcome } from "./completion";
import type { Game } from "./game";

/**
 * The three verbs a day state is spelled with. `completed` is CONTEXT.md's
 * "Conclusão" — an on-time win, the only verb that counts for a streak,
 * medal or statistic. `played` is "Jogado" — finished and counting for
 * nothing; only Termo can land there in v1, since a grid game cannot be
 * lost. `pending` has no CONTEXT.md entry: no row, or a late win, which
 * exists but yields no claim.
 */
export const DAY_STATUSES = ["pending", "completed", "played"] as const;

export type DayGameStatus = (typeof DAY_STATUSES)[number];

export const dayGameStatusSchema = z.enum(DAY_STATUSES);

/**
 * One game's claim on the wire: status, plus the completed row's duration
 * where published. `elapsedMs` is optional and its absence is meaningful: a
 * pending/played claim never carries one (enforced below), and a completed
 * Termo carries none either, because Termo publishes no duration on any
 * projection (ADR-0045).
 */
export const dayGameStateSchema = z
  .strictObject({
    status: dayGameStatusSchema,
    // The 24 h cap mirrors every completion write contract, so the read
    // side can never accept a duration the write side would have refused
    // to store.
    elapsedMs: z.number().int().min(0).max(86_400_000).optional(),
    // `.max(1)` mirrors the write contracts for the same reason: one free
    // hint per puzzle.
    hintsUsed: z.number().int().min(0).max(1).optional(),
    /**
     * The revealed Nonogram picture's curated pt-BR motif name (ADR-0070).
     * Published only on a `completed` claim — enforced here by refinement
     * and by the producer (`dayGamesFromRows`), so ADR-0004 holds by
     * construction: the name cannot exist on a claim before the server
     * judged the day.
     *
     * Spelled `motifName`, not `name` — `"name"` is banned on
     * `FORBIDDEN_DAILY_KEYS` (`./testing.ts`). `.min(1)` relies on the
     * producer normalising an empty stored name to `undefined`; otherwise
     * one blank stored name would fail this parse and 500 the whole day
     * payload.
     */
    motifName: z.string().min(1).optional(),
  })
  .refine(
    (game) => game.elapsedMs === undefined || game.status === "completed",
    {
      message: "elapsedMs is published only on a completed game",
    },
  )
  .refine(
    (game) => game.hintsUsed === undefined || game.status === "completed",
    {
      message: "hintsUsed is published only on a completed game",
    },
  )
  .refine(
    (game) => game.motifName === undefined || game.status === "completed",
    {
      message: "motifName is published only on a completed game",
    },
  );

export type DayGameState = z.infer<typeof dayGameStateSchema>;

/** One completion row as the day projection sees it. `onTime` is produced
 *  upstream and never recomputed here — no timestamp enters this module. */
export interface DayRow {
  readonly game: Game;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
  /** Required — the column is `elapsed_ms integer NOT NULL`. Whether it is
   *  published on the wire is decided separately by `dayGamesFromRows`. */
  readonly elapsedMs: number;
  /** Required — the column is `hints_used integer NOT NULL`. Published
   *  under exactly the rules `elapsedMs` follows. */
  readonly hintsUsed: number;
}

/** A total per-game projection — every game answers, always. */
export type DayState = Readonly<Record<Game, DayGameStatus>>;

/** How much a status CLAIMS — used only by the duplicate-row fold below.
 *  The merge (`mergeDayStatus`) decides by authority, never by this. */
const STATUS_CLAIM: Readonly<Record<DayGameStatus, number>> = {
  pending: 0,
  played: 1,
  completed: 2,
};

/**
 * A `lost` row is *played* regardless of lateness (ADR-0008 rule 3 — it
 * completes nothing, so lateness has nothing to demote). A `won` row is
 * *completed* only on time; a late win reads `pending`.
 */
function statusOfRow(row: DayRow): DayGameStatus {
  if (row.outcome === "lost") {
    return "played";
  }
  return row.onTime ? "completed" : "pending";
}

/**
 * The day's four statuses from a user's rows for that day. Two rows for one
 * game are impossible (composite primary key `(user_id, game, date)`), but
 * the fold below is order-independent anyway and takes the weakest claim if
 * it ever saw two — the never-overstate direction ADR-0031 decision 2
 * permits.
 */
export function dayStateFromRows(rows: readonly DayRow[]): DayState {
  return {
    termo: statusForGame(rows, "termo"),
    sudoku: statusForGame(rows, "sudoku"),
    nonogram: statusForGame(rows, "nonogram"),
    binairo: statusForGame(rows, "binairo"),
  };
}

function statusForGame(rows: readonly DayRow[], game: Game): DayGameStatus {
  let weakest: DayGameStatus | undefined;
  for (const row of rows) {
    if (row.game !== game) {
      continue;
    }
    const status = statusOfRow(row);
    if (weakest === undefined || STATUS_CLAIM[status] < STATUS_CLAIM[weakest]) {
      weakest = status;
    }
  }
  // No row is not a denial — it is the absence of evidence, and that is
  // what `pending` means here.
  return weakest ?? "pending";
}

/**
 * The four per-game claims the wire carries: `dayStateFromRows`'s statuses,
 * with the completed row's duration/hints/motif attached where published
 * (see `dayGameStateSchema` above for what may be attached and why).
 * `motifName` differs from the other two in where it comes from: not a row
 * field, but curated content the caller reads behind the publication wall
 * and hands in through `extras` — this function only decides whether a
 * claim may carry it, never fetches it.
 */
export function dayGamesFromRows(
  rows: readonly DayRow[],
  extras?: DayClaimExtras,
): Readonly<Record<Game, DayGameState>> {
  const statuses = dayStateFromRows(rows);
  return {
    termo: claimForGame(rows, "termo", statuses.termo),
    sudoku: claimForGame(rows, "sudoku", statuses.sudoku),
    nonogram: claimForGame(rows, "nonogram", statuses.nonogram, extras),
    binairo: claimForGame(rows, "binairo", statuses.binairo),
  };
}

/**
 * Daily content a claim may carry that no completion row can supply — the
 * day's published puzzle content, read from behind the publication wall.
 * Kept separate from `DayRow` so a caller cannot smuggle content in as
 * though the user had produced it. Optional at every level: an absent name
 * is the honest degraded case (killed row, unpublished day, parse failure,
 * empty stored name), never an error.
 */
export interface DayClaimExtras {
  /** Already normalised by the wall read: `undefined`, never `""`, for a
   *  missing, killed, unparseable or blank stored name. */
  readonly nonogramMotifName?: string;
}

function claimForGame(
  rows: readonly DayRow[],
  game: Game,
  status: DayGameStatus,
  extras?: DayClaimExtras,
): DayGameState {
  if (status !== "completed" || game === "termo") {
    return { status };
  }
  let elapsedMs: number | undefined;
  let hintsUsed: number | undefined;
  for (const row of rows) {
    if (row.game !== game || statusOfRow(row) !== "completed") {
      continue;
    }
    if (elapsedMs === undefined || row.elapsedMs > elapsedMs) {
      elapsedMs = row.elapsedMs;
    }
    // Largest hint count wins, like duration — the humbler claim: "sem
    // dicas" on a day any duplicate row spent a hint would overstate it.
    if (hintsUsed === undefined || row.hintsUsed > hintsUsed) {
      hintsUsed = row.hintsUsed;
    }
  }
  // Spread-per-field, not a key set to `undefined`: the wire schema is
  // strict, so an absent field must be ABSENT, not present-and-undefined.
  // Truthiness, never `!== undefined`, on motifName: an empty stored name
  // that slips past the wall's normalisation would otherwise attach
  // `motifName: ""`, fail the schema's `.min(1)`, and 500 the whole payload.
  const motifName =
    game === "nonogram" && extras?.nonogramMotifName
      ? extras.nonogramMotifName
      : undefined;
  return {
    status,
    ...(elapsedMs === undefined ? {} : { elapsedMs }),
    ...(hintsUsed === undefined ? {} : { hintsUsed }),
    ...(motifName === undefined ? {} : { motifName }),
  };
}

/**
 * The merge invariant (ADR-0060 decision 3), for one game.
 *
 * Two different kinds of claim exist about a game's day. The device claims
 * "this device concluded this game today" — self-reported, an affordance
 * and never an entitlement. The server claims "a completion row exists for
 * (user, game, today)" — the authority for the streak, statistics and
 * medals.
 *
 * The server makes a claim exactly when its status is not `pending`;
 * `pending` from the server is the absence of a claim, never a denial.
 * Where the server claims, its claim wins; where it does not, the device's
 * does. Nothing is blended field by field and no third value is
 * synthesised.
 *
 * Not "the stronger verb wins": local `completed` + server `played` is
 * reachable (Termo, won on one device having lost on another) and the
 * server's `played` wins, because the row is write-once and the day
 * genuinely does not count for the streak.
 */
export function mergeDayStatus(
  local: DayGameStatus,
  server: DayGameStatus,
): DayGameStatus {
  return server === "pending" ? local : server;
}

/**
 * `mergeDayStatus` over the four games, pointwise — game g's result depends
 * on no other game's status. The whole-payload date-equality gate (discard
 * the payload unless its date matches the rendered day) lives in the
 * caller: this module has no clock and no notion of "the rendered day".
 */
export function mergeDayState(local: DayState, server: DayState): DayState {
  return {
    termo: mergeDayStatus(local.termo, server.termo),
    sudoku: mergeDayStatus(local.sudoku, server.sudoku),
    nonogram: mergeDayStatus(local.nonogram, server.nonogram),
    binairo: mergeDayStatus(local.binairo, server.binairo),
  };
}
