import type { ReactElement, ReactNode } from "react";

import { messages, routes } from "../i18n";
import {
  PlayScreenChrome,
  type ChromeGame,
  type PlayChromeBack,
  type PlayChromeStat,
  type PlayChromeState,
} from "../play/screen-chrome";
import screen from "../play/screen.module.css";
import type { FreePlayLevel } from "./catalog";
import { LevelPicker } from "./level-picker";

const BACK: PlayChromeBack = {
  href: routes.freePlay,
  label: messages.freePlay.back,
  ariaLabel: messages.freePlay.backToIndexAria,
};

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
  kicker,
  title,
  rules,
  level,
  onLevelChange,
  state,
  children,
}: {
  readonly game: ChromeGame;
  readonly pageModifier: string;
  readonly kicker: string;
  readonly title: string;
  readonly rules: string;
  readonly level: FreePlayLevel;
  readonly onLevelChange: (level: FreePlayLevel) => void;
  readonly state: PlayChromeState;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <PlayScreenChrome
      game={game}
      pageModifier={pageModifier}
      state={state}
      back={BACK}
      topDate={messages.freePlay.modeTag}
      kicker={kicker}
      title={title}
      rules={rules}
      note={null}
      clock="none"
      extraStat={levelStat(level)}
    >
      <LevelPicker level={level} onChange={onLevelChange} />
      {children}
    </PlayScreenChrome>
  );
}
