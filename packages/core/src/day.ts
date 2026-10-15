import { z } from "zod";

import { hintsUsedSchema, type CompletionOutcome } from "./completion";
import { GAMES, recordFor, type Game } from "./game";

export const DAY_STATUSES = ["pending", "completed", "played"] as const;

export type DayGameStatus = (typeof DAY_STATUSES)[number];

export const dayGameStatusSchema = z.enum(DAY_STATUSES);

export const dayGameStateSchema = z
  .strictObject({
    status: dayGameStatusSchema,

    elapsedMs: z.number().int().min(0).max(86_400_000).optional(),

    hintsUsed: hintsUsedSchema.optional(),

    motifName: z.string().min(1).optional(),

    motifTones: z
      .string()
      .regex(/^[.kelntroygdsbpm]+$/)
      .optional(),
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
  )
  .refine(
    (game) => game.motifTones === undefined || game.status === "completed",
    {
      message: "motifTones is published only on a completed game",
    },
  );

export type DayGameState = z.infer<typeof dayGameStateSchema>;

export interface DayRow {
  readonly game: Game;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;

  readonly elapsedMs: number;

  readonly hintsUsed: number;
}

export type DayState = Readonly<Record<Game, DayGameStatus>>;

const STATUS_CLAIM: Readonly<Record<DayGameStatus, number>> = {
  pending: 0,
  played: 1,
  completed: 2,
};

function statusOfRow(row: DayRow): DayGameStatus {
  if (row.outcome === "lost") {
    return "played";
  }
  return row.onTime ? "completed" : "pending";
}

export function dayStateFromRows(rows: readonly DayRow[]): DayState {
  return recordFor(GAMES, (game) => statusForGame(rows, game));
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

  return weakest ?? "pending";
}

export function dayGamesFromRows(
  rows: readonly DayRow[],
  extras?: DayClaimExtras,
): Readonly<Record<Game, DayGameState>> {
  const statuses = dayStateFromRows(rows);
  return recordFor(GAMES, (game) =>
    claimForGame(rows, game, statuses[game], extras),
  );
}

export interface DayClaimExtras {
  readonly nonogramMotifName?: string;

  readonly nonogramMotifTones?: string;
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

    if (hintsUsed === undefined || row.hintsUsed > hintsUsed) {
      hintsUsed = row.hintsUsed;
    }
  }

  const motif = game === "nonogram" ? extras : undefined;
  return {
    status,
    ...(elapsedMs === undefined ? {} : { elapsedMs }),
    ...(hintsUsed === undefined ? {} : { hintsUsed }),
    ...(motif?.nonogramMotifName ? { motifName: motif.nonogramMotifName } : {}),
    ...(motif?.nonogramMotifTones
      ? { motifTones: motif.nonogramMotifTones }
      : {}),
  };
}

export function mergeDayStatus(
  local: DayGameStatus,
  server: DayGameStatus,
): DayGameStatus {
  return server === "pending" ? local : server;
}

export function mergeDayState(local: DayState, server: DayState): DayState {
  return recordFor(GAMES, (game) => mergeDayStatus(local[game], server[game]));
}
