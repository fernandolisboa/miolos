import { z } from "zod";

export const isoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const calendarDateString = isoDateString.refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() >= 1 &&
    parsed.toISOString().slice(0, 10) === value
  );
}, "not a calendar date");

export const binairoCellSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.null(),
]);

export const dailyBinairoResponseSchema = z.strictObject({
  game: z.literal("binairo"),
  date: isoDateString,
  size: z.literal(8),
  givens: z.array(binairoCellSchema).length(64),
});

export type DailyBinairoResponse = z.infer<typeof dailyBinairoResponseSchema>;

export const sudokuDigitSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
]);

export const sudokuGivenCellSchema = z.union([z.literal(0), sudokuDigitSchema]);

export const sudokuTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const dailySudokuResponseSchema = z.strictObject({
  game: z.literal("sudoku"),
  date: isoDateString,
  givens: z.array(sudokuGivenCellSchema).length(81),
  tier: sudokuTierSchema,
});

export type DailySudokuResponse = z.infer<typeof dailySudokuResponseSchema>;

export const nonogramSizeSchema = z.union([
  z.literal(5),
  z.literal(8),
  z.literal(10),
  z.literal(15),
]);

export type NonogramSize = z.infer<typeof nonogramSizeSchema>;

const nonogramClueLineSchema = z.array(z.number().int().positive());

export const nonogramCluesSchema = z
  .strictObject({
    size: nonogramSizeSchema,
    rows: z.array(nonogramClueLineSchema),
    cols: z.array(nonogramClueLineSchema),
  })
  .refine((c) => c.rows.length === c.size && c.cols.length === c.size, {
    message: "clue line counts must equal size",
  });

export const dailyNonogramResponseSchema = z
  .strictObject({
    game: z.literal("nonogram"),
    date: isoDateString,
    size: nonogramSizeSchema,
    clues: nonogramCluesSchema,
  })
  .refine((d) => d.size === d.clues.size, {
    message: "size disagrees with clues.size",
  });

export type DailyNonogramResponse = z.infer<typeof dailyNonogramResponseSchema>;

export const dailyTermoResponseSchema = z.strictObject({
  game: z.literal("termo"),
  date: isoDateString,
});

export type DailyTermoResponse = z.infer<typeof dailyTermoResponseSchema>;

const CROSSWORD_SIZE = 5;

export const crosswordLetterSchema = z.string().regex(/^[a-z]$/);

export const crosswordGridSchema = z
  .array(z.array(crosswordLetterSchema.nullable()).length(CROSSWORD_SIZE))
  .length(CROSSWORD_SIZE);

export const crosswordDirectionSchema = z.enum(["across", "down"]);

const crosswordIndexSchema = z
  .number()
  .int()
  .min(0)
  .max(CROSSWORD_SIZE - 1);

const crosswordClueSchema = z.strictObject({
  number: z.number().int().positive(),
  direction: crosswordDirectionSchema,
  row: crosswordIndexSchema,
  col: crosswordIndexSchema,
  length: z.number().int().min(1).max(CROSSWORD_SIZE),
  clue: z.string().min(1),
});

type CrosswordClue = z.infer<typeof crosswordClueSchema>;

function clueCellsAreWhite(
  grid: z.infer<typeof crosswordGridSchema>,
  { direction, row, col, length }: CrosswordClue,
): boolean {
  if (length > CROSSWORD_SIZE) {
    return false;
  }
  return Array.from({ length }, (_, k) =>
    direction === "across" ? grid[row]?.[col + k] : grid[row + k]?.[col],
  ).every((cell) => typeof cell === "string");
}

export const dailyCrosswordResponseSchema = z
  .strictObject({
    game: z.literal("crossword"),
    date: isoDateString,
    grid: crosswordGridSchema,
    clues: z.array(crosswordClueSchema).min(1),
  })
  .refine((d) => d.clues.every((clue) => clueCellsAreWhite(d.grid, clue)), {
    message: "every clue cell must be in bounds and white",
  });

export type DailyCrosswordResponse = z.infer<
  typeof dailyCrosswordResponseSchema
>;

interface CrosswordProjectionSource {
  readonly grid: readonly (readonly (string | null)[])[];
  readonly entries: readonly {
    readonly number: number;
    readonly direction: CrosswordClue["direction"];
    readonly row: number;
    readonly col: number;
    readonly normalized: string;
    readonly clue: string;
  }[];
}

export function projectCrosswordDaily(
  date: string,
  { grid, entries }: CrosswordProjectionSource,
): DailyCrosswordResponse {
  return dailyCrosswordResponseSchema.parse({
    game: "crossword",
    date,
    grid,
    clues: entries.map((entry) => ({
      number: entry.number,
      direction: entry.direction,
      row: entry.row,
      col: entry.col,
      length: entry.normalized.length,
      clue: entry.clue,
    })),
  });
}

export const dailyPuzzleResponseSchema = z.discriminatedUnion("game", [
  dailyBinairoResponseSchema,
  dailyCrosswordResponseSchema,
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
]);

export type DailyPuzzleResponse = z.infer<typeof dailyPuzzleResponseSchema>;

export type ProjectedGame = DailyPuzzleResponse["game"];
