import { useSyncExternalStore } from "react";
import { z } from "zod";

const STORAGE_KEY = "miolos-settings";

const flag = (fallback: boolean) => z.boolean().catch(fallback);

const errorsOnly = z.object({ showErrors: flag(false) });

const sudoku = z.object({
  showErrors: flag(false),
  lockDigit: flag(false),
  highlightSelection: flag(true),
});

const nonogram = z.object({
  showErrors: flag(false),
  strikePlacedRuns: flag(true),
});

const crossword = z.object({
  showErrors: flag(false),
  skipFilled: flag(true),
});

const games = z.object({
  sudoku: sudoku.catch(sudoku.parse({})),
  binairo: errorsOnly.catch(errorsOnly.parse({})),
  nonogram: nonogram.catch(nonogram.parse({})),
  queens: errorsOnly.catch(errorsOnly.parse({})),
  crossword: crossword.catch(crossword.parse({})),
});

const base = z.object({
  showClock: flag(true),
  games: games.catch(games.parse({})),
});

const schema = base.catch(base.parse({}));

export type Settings = z.infer<typeof schema>;
export type SettingsGame = keyof Settings["games"];

const DEFAULTS: Settings = schema.parse(undefined);

function safely<T>(read: () => T, fallback: T): T {
  try {
    return read();
  } catch {
    return fallback;
  }
}

function parse(raw: string | null): Settings {
  return schema.parse(
    raw === null
      ? undefined
      : safely<unknown>(() => JSON.parse(raw), undefined),
  );
}

let cache: { readonly raw: string | null; readonly settings: Settings } | null =
  null;

export function readSettings(): Settings {
  const raw = safely(() => localStorage.getItem(STORAGE_KEY), null);
  if (cache?.raw !== raw) {
    cache = { raw, settings: parse(raw) };
  }
  return cache.settings;
}

const listeners = new Set<() => void>();

export function writeSettings(next: Settings): void {
  safely(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, undefined);
  for (const listener of listeners) {
    listener();
  }
}

function subscribeToSettings(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    subscribeToSettings,
    readSettings,
    () => DEFAULTS,
  );
}
