import { messages, routes } from "../i18n";
import type { PlayChromeBack } from "../play/screen-chrome";

export const FREE_PLAY_BACK: PlayChromeBack = {
  href: routes.freePlay,
  label: messages.freePlay.back,
  ariaLabel: messages.freePlay.backToIndexAria,
};
