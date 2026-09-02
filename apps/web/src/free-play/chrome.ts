import { messages, routes } from "../i18n";
import type { PlayChromeBack, PlayChromeStat } from "../play/screen-chrome";
import screen from "../play/screen.module.css";
import type { FreePlayLevel } from "./catalog";

export const FREE_PLAY_BACK: PlayChromeBack = {
  href: routes.freePlay,
  label: messages.freePlay.back,
  ariaLabel: messages.freePlay.backToIndexAria,
};

export function levelStat(level: FreePlayLevel): PlayChromeStat {
  return {
    label: messages.freePlay.level.label,
    value: messages.freePlay.level[level],
    className: screen.progressCard ?? "",
  };
}
