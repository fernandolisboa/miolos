import type { ReactElement, ReactNode } from "react";

import { formatLongDate, messages, routes } from "../i18n";
import {
  PlayScreenChrome,
  type ChromeGame,
  type PlayChromeBack,
  type PlayChromeClock,
  type PlayChromeStat,
  type PlayChromeState,
} from "./screen-chrome";
import type { ArchivePlayChrome } from "./types";

const DAILY_PLAY_BACK: PlayChromeBack = {
  href: routes.home,
  label: messages.play.back,
  ariaLabel: messages.play.backAria,
};

export function DailyPlayChrome({
  game,
  pageModifier,
  date,
  archive,
  clock,
  extraStat,
  state,
  children,
}: {
  readonly game: ChromeGame;
  readonly pageModifier: string;
  readonly date: string;
  readonly archive?: ArchivePlayChrome;
  readonly clock: PlayChromeClock;
  readonly extraStat: PlayChromeStat | null;
  readonly state: PlayChromeState;
  readonly children: ReactNode;
}): ReactElement {
  return (
    <PlayScreenChrome
      game={game}
      pageModifier={pageModifier}
      state={state}
      back={archive?.back ?? DAILY_PLAY_BACK}
      topDate={formatLongDate(date)}
      note={archive?.note ?? null}
      clock={clock}
      extraStat={extraStat}
    >
      {children}
    </PlayScreenChrome>
  );
}
