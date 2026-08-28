import { z } from "zod";

import type { CompletionOutcome } from "./completion";
import type { Game } from "./game";

export const DAY_STATUSES = ["pending", "completed", "played"] as const;

export type DayGameStatus = (typeof DAY_STATUSES)[number];

export const dayGameStatusSchema = z.enum(DAY_STATUSES);

export const dayGameStateSchema = z
  .strictObject({
    status: dayGameStatusSchema,

    elapsedMs: z.number().int().min(0).max(86_400_000).optional(),

    hintsUsed: z.number().int().min(0).max(1).optional(),

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

  return weakest ?? "pending";
}

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

export interface DayClaimExtras {
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

    if (hintsUsed === undefined || row.hintsUsed > hintsUsed) {
      hintsUsed = row.hintsUsed;
    }
  }

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

export function mergeDayStatus(
  local: DayGameStatus,
  server: DayGameStatus,
): DayGameStatus {
  return server === "pending" ? local : server;
}

export function mergeDayState(local: DayState, server: DayState): DayState {
  return {
    termo: mergeDayStatus(local.termo, server.termo),
    sudoku: mergeDayStatus(local.sudoku, server.sudoku),
    nonogram: mergeDayStatus(local.nonogram, server.nonogram),
    binairo: mergeDayStatus(local.binairo, server.binairo),
  };
}
