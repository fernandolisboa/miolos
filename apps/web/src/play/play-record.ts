import {
  completionOutcomeSchema,
  isoDateString,
  nonogramSizeSchema,
  sudokuDigitSchema,
  TERMO_MAX_GUESSES,
  TERMO_WORD_LENGTH,
  termoGuessWordSchema,
  termoTilesSchema,
  type Game,
} from "@miolos/core";
import { z } from "zod";

const STORAGE_PREFIX = "miolos:play:";

export const ELAPSED_CAP_MS = 86_400_000;

const MAX_NONOGRAM_CELLS = Math.max(
  ...nonogramSizeSchema.options.map((option) => option.value ** 2),
);

export const playRecordKey = (game: Game, date: string) =>
  `${STORAGE_PREFIX}${game}:${date}`;

export const binairoPlayRecordSchema = z.strictObject({
  v: z.literal(1),
  game: z.literal("binairo"),
  date: isoDateString,
  entries: z.array(z.union([z.literal(0), z.literal(1), z.null()])).length(64),

  grid: z
    .array(z.union([z.literal(0), z.literal(1)]))
    .length(64)
    .optional(),
  elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
  hintsUsed: z.number().int().min(0).max(1),
  concluded: z.boolean(),
  pendingSync: z.boolean(),
  syncOutcome: z.enum(["pending", "recorded", "rejected"]),
});

export type BinairoPlayRecord = z.infer<typeof binairoPlayRecordSchema>;

export const sudokuPlayRecordSchema = z.strictObject({
  v: z.literal(1),
  game: z.literal("sudoku"),
  date: isoDateString,
  entries: z.array(z.union([sudokuDigitSchema, z.null()])).length(81),

  grid: z.array(sudokuDigitSchema).length(81).optional(),
  elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
  hintsUsed: z.number().int().min(0).max(1),
  concluded: z.boolean(),
  pendingSync: z.boolean(),
  syncOutcome: z.enum(["pending", "recorded", "rejected"]),
});

export type SudokuPlayRecord = z.infer<typeof sudokuPlayRecordSchema>;

export const nonogramPlayRecordSchema = z
  .strictObject({
    v: z.literal(1),
    game: z.literal("nonogram"),
    date: isoDateString,
    size: nonogramSizeSchema,

    entries: z
      .array(z.union([z.literal(0), z.literal(1), z.null()]))
      .max(MAX_NONOGRAM_CELLS),

    grid: z
      .array(z.union([z.literal(0), z.literal(1)]))
      .max(MAX_NONOGRAM_CELLS)
      .optional(),
    elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),
    hintsUsed: z.number().int().min(0).max(1),
    concluded: z.boolean(),
    pendingSync: z.boolean(),
    syncOutcome: z.enum(["pending", "recorded", "rejected"]),
  })
  .superRefine((record, ctx) => {
    const cells = record.size ** 2;
    if (record.entries.length !== cells) {
      ctx.addIssue({
        code: "custom",
        message: `entries must hold ${String(cells)} cells on a ${String(record.size)}×${String(record.size)} board`,
        path: ["entries"],
      });
    }
    if (record.grid !== undefined && record.grid.length !== cells) {
      ctx.addIssue({
        code: "custom",
        message: `grid must hold ${String(cells)} cells on a ${String(record.size)}×${String(record.size)} board`,
        path: ["grid"],
      });
    }
  });

export type NonogramPlayRecord = z.infer<typeof nonogramPlayRecordSchema>;

export const termoPlayRecordSchema = z
  .strictObject({
    v: z.literal(1),
    game: z.literal("termo"),
    date: isoDateString,

    guesses: z
      .array(
        z.strictObject({
          guess: termoGuessWordSchema,
          tiles: termoTilesSchema,
        }),
      )
      .max(TERMO_MAX_GUESSES),

    answer: z.string().length(TERMO_WORD_LENGTH).optional(),

    outcome: completionOutcomeSchema.optional(),
    elapsedMs: z.number().int().min(0).max(ELAPSED_CAP_MS),

    hintsUsed: z.number().int().min(0).max(1),
    concluded: z.boolean(),
    pendingSync: z.boolean(),
    syncOutcome: z.enum(["pending", "recorded", "rejected"]),
  })
  .superRefine((record, ctx) => {
    const wonAt = record.guesses.findIndex((row) =>
      row.tiles.every((tile) => tile === "correct"),
    );
    if (wonAt !== -1 && wonAt !== record.guesses.length - 1) {
      ctx.addIssue({
        code: "custom",
        message: "no guess may follow a winning row",
        path: ["guesses"],
      });
    }
    if (record.concluded !== (record.answer !== undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "answer is written exactly when the board closes",
        path: ["answer"],
      });
    }
    if (record.concluded !== (record.outcome !== undefined)) {
      ctx.addIssue({
        code: "custom",
        message: "outcome is written exactly when the board closes",
        path: ["outcome"],
      });
    }
    if (record.concluded && record.guesses.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "a closed board has at least one judged guess",
        path: ["guesses"],
      });
    }
  });

export type TermoPlayRecord = z.infer<typeof termoPlayRecordSchema>;

export const playRecordSchema = z.discriminatedUnion("game", [
  binairoPlayRecordSchema,
  nonogramPlayRecordSchema,
  sudokuPlayRecordSchema,
  termoPlayRecordSchema,
]);

export type PlayRecord = z.infer<typeof playRecordSchema>;

function storage(): Storage | undefined {
  try {
    if (typeof window === "undefined") {
      return undefined;
    }
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const WRITE_PROBE_KEY = "miolos:write-probe";

export function playRecordsWritable(): boolean {
  const store = storage();
  if (store === undefined) {
    return false;
  }
  try {
    store.setItem(WRITE_PROBE_KEY, "");
    store.removeItem(WRITE_PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}

function playRecordKeys(store: Storage): string[] {
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key !== null && key.startsWith(STORAGE_PREFIX)) {
      keys.push(key);
    }
  }
  return keys;
}

function parseAt(store: Storage, key: string): PlayRecord | undefined {
  const raw = store.getItem(key);
  if (raw === null) {
    return undefined;
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const parsed = playRecordSchema.safeParse(json);
  return parsed.success ? parsed.data : undefined;
}

export function readPlayRecord(
  game: Game,
  date: string,
): PlayRecord | undefined {
  const store = storage();
  if (store === undefined) {
    return undefined;
  }
  const key = playRecordKey(game, date);
  const record = parseAt(store, key);
  return record !== undefined && playRecordKey(record.game, record.date) === key
    ? record
    : undefined;
}

export function writePlayRecord(record: PlayRecord): void {
  const store = storage();
  if (store === undefined) {
    return;
  }
  const clamped: PlayRecord = {
    ...record,

    elapsedMs: Math.min(Math.max(record.elapsedMs, 0), ELAPSED_CAP_MS),
  };
  try {
    store.setItem(
      playRecordKey(clamped.game, clamped.date),
      JSON.stringify(clamped),
    );
  } catch {
    // A blocked or full store loses the local copy, never the turn.
  }
}

export function listPendingRecords(): PlayRecord[] {
  const store = storage();
  if (store === undefined) {
    return [];
  }
  const pending: PlayRecord[] = [];
  for (const key of playRecordKeys(store)) {
    const record = parseAt(store, key);
    if (
      record?.pendingSync === true &&
      playRecordKey(record.game, record.date) === key
    ) {
      pending.push(record);
    }
  }
  return pending;
}

const RETAINED_PAST_RECORDS = 50;

export function prunePlayRecords(keepDate: string): void {
  const store = storage();
  if (store === undefined) {
    return;
  }
  const candidates: { key: string; date: string }[] = [];
  for (const key of playRecordKeys(store)) {
    const record = parseAt(store, key);
    if (record === undefined) {
      continue;
    }
    if (playRecordKey(record.game, record.date) !== key) {
      store.removeItem(key);
      continue;
    }
    if (!record.pendingSync && record.date < keepDate) {
      candidates.push({ key, date: record.date });
    }
  }

  candidates.sort((a, b) =>
    a.date === b.date
      ? a.key.localeCompare(b.key)
      : b.date.localeCompare(a.date),
  );
  for (const stale of candidates.slice(RETAINED_PAST_RECORDS)) {
    store.removeItem(stale.key);
  }
}
