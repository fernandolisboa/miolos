import type { Game } from "@miolos/core";
import { z } from "zod";

import { DAY_GAMES } from "../play/day-games";
import { playRecordKey } from "../play/play-record";
import { safely } from "../safely";

export const HUB_CARDS_ID = "hub-cards";
export const HUB_DONE_ID = "hub-done";
export const SERVER_DONE_KEY = "miolos:hub-server-done";

const finishedRecord = (game: Game, date: string) =>
  z.object({
    game: z.literal(game),
    date: z.literal(date),
    concluded: z.literal(true),
  });

const mirroredRecord = (date: string) =>
  z.object({ date: z.literal(date), games: z.array(z.unknown()) });

function stored(key: string): unknown {
  return JSON.parse(window.localStorage.getItem(key) ?? "null");
}

export function tuckedGames(
  date: string,
  serverDone: readonly Game[] = [],
): ReadonlySet<Game> {
  const mirrored = safely(
    () => mirroredRecord(date).parse(stored(SERVER_DONE_KEY)).games,
    [],
  );
  return new Set(
    DAY_GAMES.filter(
      (game) =>
        mirrored.includes(game) ||
        serverDone.includes(game) ||
        safely(
          () =>
            finishedRecord(game, date).safeParse(
              stored(playRecordKey(game, date)),
            ).success,
          false,
        ),
    ),
  );
}

export function mirrorServerDone(date: string, games: readonly Game[]): void {
  safely(() => {
    window.localStorage.setItem(
      SERVER_DONE_KEY,
      JSON.stringify({ date, games }),
    );
  }, undefined);
}

const HOLD = "hubHold";

const literal = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");

export const holdScript = `document.documentElement.dataset.${HOLD}="";`;

// Raw JS, run before paint (ADR-0157): the twin of `tuckedGames`, applied to
// the server's markup so the board settles once, then shown.
export function tuckScript(date: string): string {
  const keys = DAY_GAMES.map((game) => [game, playRecordKey(game, date)]);
  return `(function(){var h=document.documentElement;try{var d=${literal(date)},k=${literal(keys)},c=document.getElementById(${literal(HUB_CARDS_ID)}),l=document.getElementById(${literal(HUB_DONE_ID)}),m=[],t=[];if(!c||!l)return;try{var s=JSON.parse(localStorage.getItem(${literal(SERVER_DONE_KEY)}));if(s&&s.date===d&&Array.isArray(s.games))m=s.games}catch(e){}for(var i=0;i<k.length;i++){var g=k[i][0],r=null;try{r=JSON.parse(localStorage.getItem(k[i][1]))}catch(e){}if(m.indexOf(g)!==-1||(r&&r.concluded===true&&r.game===g&&r.date===d)){var a=c.querySelector('[data-hub-card="'+g+'"]'),b=l.querySelector('[data-hub-done="'+g+'"]');if(!a||!b)return;t.push([a,b])}}if(!t.length)return;for(var j=0;j<t.length;j++){t[j][0].hidden=true;t[j][1].hidden=false}var n=k.length-t.length;c.style.setProperty("--card-count",String(n));c.hidden=n===0;l.hidden=false}catch(e){}finally{delete h.dataset.${HOLD}}})();`;
}
