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
import { choiceLabel, type Choice } from "./choice";
import { ChoicePicker } from "./choice-picker";

function choiceStat(choice: Choice): PlayChromeStat {
  return {
    label: choice.label,
    value: choiceLabel(choice),
    className: screen.progressCard ?? "",
  };
}

export function FreePlayChrome({
  game,
  pageModifier,
  choices,
  clock = "none",
  state,
  children,
}: {
  readonly game: PlayChromeGame;
  readonly pageModifier: string;
  readonly choices?: readonly Choice[];
  readonly clock?: PlayChromeClock;
  readonly state: PlayChromeState;
  readonly children: ReactNode;
}): ReactElement {
  const first = choices?.[0];
  return (
    <PlayScreenChrome
      game={game}
      pageModifier={pageModifier}
      state={state}
      back={FREE_PLAY_BACK}
      topDate={messages.freePlay.modeTag}
      note={null}
      clock={clock}
      extraStat={first === undefined ? null : choiceStat(first)}
    >
      {choices?.map((choice) => (
        <ChoicePicker key={choice.label} {...choice} />
      ))}
      {children}
    </PlayScreenChrome>
  );
}
