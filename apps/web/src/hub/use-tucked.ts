"use client";

import type { Game } from "@miolos/core";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import { useServerDoneGames } from "../play/day-state";
import { mirrorServerDone } from "./server-done";
import { liftHold, scriptedTuck, tuckedGames } from "./tuck";

const NONE: ReadonlySet<Game> = new Set();

export const TuckedGames = createContext<ReadonlySet<Game>>(NONE);

const neverChanges = () => () => undefined;

// Read once per mount and never again (ADR-0157). On a hard load React adopts
// what the pre-paint script painted, as storage may have changed in between.
export function useSettledTuck(date: string): ReadonlySet<Game> {
  const serverDone = useServerDoneGames(date);
  const settled = useRef<ReadonlySet<Game>>(undefined);
  const tucked = useSyncExternalStore(
    neverChanges,
    () =>
      (settled.current ??= scriptedTuck(date) ?? tuckedGames(date, serverDone)),
    () => NONE,
  );

  useEffect(liftHold, []);

  useEffect(() => {
    if (serverDone !== undefined) {
      mirrorServerDone(date, serverDone);
    }
  }, [serverDone, date]);

  return tucked;
}

export function useTucked(game: Game): boolean {
  return useContext(TuckedGames).has(game);
}

export function useHydrating(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => false,
    () => true,
  );
}
