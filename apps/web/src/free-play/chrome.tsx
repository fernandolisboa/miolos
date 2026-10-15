import type { ReactElement, ReactNode } from "react";

import { messages } from "../i18n";
import {
  PlayScreenChrome,
  type ChromeGame,
  type PlayChromeStat,
  type PlayChromeState,
} from "../play/screen-chrome";
import screen from "../play/screen.module.css";
import { FREE_PLAY_BACK, type FreePlayLevel } from "./catalog";
import { LevelPicker } from "./level-picker";

function levelStat(level: FreePlayLevel): PlayChromeStat {
  return {
    label: messages.freePlay.level.label,
    value: messages.freePlay.level[level],
    className: screen.progressCard ?? "",
  };
}

export function FreePlayChrome({
  game,
  pageModifier,
  level,
  state,
  children,
}: {
  readonly game: ChromeGame;
  readonly pageModifier: string;
  readonly level?: {
    readonly value: FreePlayLevel;
    readonly onChange: (level: FreePlayLevel) => void;
  };
  readonly state: PlayChromeState;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <PlayScreenChrome
      game={game}
      pageModifier={pageModifier}
      state={state}
      back={FREE_PLAY_BACK}
      topDate={messages.freePlay.modeTag}
      note={null}
      clock="none"
      extraStat={level === undefined ? null : levelStat(level.value)}
    >
      {level !== undefined && (
        <LevelPicker level={level.value} onChange={level.onChange} />
      )}
      {children}
    </PlayScreenChrome>
  );
}
