import {
  MINESWEEPER_LEVELS,
  customMinesweeperSize,
  type MinesweeperLevel,
  type MinesweeperSize,
} from "@miolos/games/minesweeper";
import { z } from "zod";

import { safely } from "../safely";

const STORAGE_KEY = "miolos-minesweeper";

const seconds = z.number().int().nonnegative().optional().catch(undefined);

const best = z.object({
  beginner: seconds,
  intermediate: seconds,
  expert: seconds,
});

const custom = z
  .object({ rows: z.number(), columns: z.number(), mines: z.number() })
  .transform(({ rows, columns, mines }) =>
    customMinesweeperSize(rows, columns, mines),
  )
  .optional()
  .catch(undefined);

const base = z.object({ best: best.optional().catch(undefined), custom });

const schema = base.catch({});

type Stored = z.infer<typeof schema>;

function read(): Stored {
  const raw = safely(() => localStorage.getItem(STORAGE_KEY), null);
  return schema.parse(
    raw === null ? {} : safely<unknown>(() => JSON.parse(raw), {}),
  );
}

function write(next: Stored): void {
  safely(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, undefined);
}

export function readBestTime(level: MinesweeperLevel): number | null {
  return read().best?.[level] ?? null;
}

export function saveBestTime(level: MinesweeperLevel, time: number): void {
  const stored = read();
  const previous = stored.best?.[level];
  if (previous === undefined || time < previous) {
    write({ ...stored, best: { ...stored.best, [level]: time } });
  }
}

export function readCustomSize(): MinesweeperSize {
  return read().custom ?? MINESWEEPER_LEVELS.beginner;
}

export function saveCustomSize(size: MinesweeperSize): void {
  write({ ...read(), custom: size });
}

export function bestTimeAfter(
  previous: number | null,
  won: number | null,
): { readonly best: number | null; readonly isNew: boolean } {
  if (won !== null && (previous === null || won < previous)) {
    return { best: won, isNew: true };
  }
  return { best: previous, isNew: false };
}
