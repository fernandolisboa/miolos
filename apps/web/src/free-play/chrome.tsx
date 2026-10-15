import type { ReactElement, ReactNode } from "react";

import { messages } from "../i18n";
import {
  PlayScreenChrome,
  type PlayChromeClock,
  type PlayChromeGame,
  type PlayChromeStat,
  type PlayChromeState,
} from "../play/screen-chrome";
import screen from "../play/screen.module.css";
import { FREE_PLAY_BACK } from "./back";
import { ChoicePicker, type FreePlayChoice } from "./choice-picker";

function choiceStat<T extends string | number>(
  choice: FreePlayChoice<T>,
): PlayChromeStat {
  return {
    label: choice.label,
    value: choice.optionLabel(choice.value),
    className: screen.progressCard ?? "",
  };
}

export function FreePlayChrome<T extends string | number>({
  game,
  pageModifier,
  choice,
  clock = "none",
  state,
  children,
}: {
  readonly game: PlayChromeGame;
  readonly pageModifier: string;
  readonly choice?: FreePlayChoice<T>;
  readonly clock?: PlayChromeClock;
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
      clock={clock}
      extraStat={choice === undefined ? null : choiceStat(choice)}
    >
      {choice !== undefined && <ChoicePicker {...choice} />}
      {children}
    </PlayScreenChrome>
  );
}
