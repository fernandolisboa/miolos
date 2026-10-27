import type { Game } from "@miolos/core";

import { safely } from "../safely";

export const SERVER_DONE_KEY = "miolos:hub-server-done";

export function mirrorServerDone(date: string, games: readonly Game[]): void {
  safely(() => {
    window.localStorage.setItem(
      SERVER_DONE_KEY,
      JSON.stringify({ date, games }),
    );
  }, undefined);
}

export function forgetServerDone(): void {
  safely(() => {
    window.localStorage.removeItem(SERVER_DONE_KEY);
  }, undefined);
}
