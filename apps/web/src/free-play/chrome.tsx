import type { ReactElement, ReactNode } from "react";

import { messages } from "../i18n";
import {
  PlayScreenChrome,
  type ChromeGame,
  type PlayChromeStat,
  type PlayChromeState,
} from "../play/screen-chrome";
import screen from "../play/screen.module.css";
import { FREE_PLAY_BACK } from "./back";
import {
  ChoicePicker,
  choiceLabel,
  type FreePlayChoice,
  type FreePlayChoices,
} from "./choice-picker";

function choiceStat<T extends string | number>(
  choice: FreePlayChoice<T>,
): PlayChromeStat {
  return {
    label: choice.label,
    value: choiceLabel(choice),
    className: screen.progressCard ?? "",
  };
}

export function FreePlayChrome<
  A extends string | number,
  B extends string | number = never,
>({
  game,
  pageModifier,
  choices,
  state,
  children,
}: {
  readonly game: ChromeGame;
  readonly pageModifier: string;
  readonly choices?: FreePlayChoices<A, B>;
  readonly state: PlayChromeState;
  readonly children: ReactNode;
}): ReactElement {
  const [first, second] = choices ?? [];
  return (
    <PlayScreenChrome
      game={game}
      pageModifier={pageModifier}
      state={state}
      back={FREE_PLAY_BACK}
      topDate={messages.freePlay.modeTag}
      note={null}
      clock="none"
      extraStat={first === undefined ? null : choiceStat(first)}
    >
      {first !== undefined && <ChoicePicker {...first} />}
      {second !== undefined && <ChoicePicker {...second} />}
      {children}
    </PlayScreenChrome>
  );
}
