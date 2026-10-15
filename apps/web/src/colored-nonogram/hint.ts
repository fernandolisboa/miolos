import {
  nextColoredStep,
  type ColoredNonogramClues,
  type ColoredNonogramStep,
} from "@miolos/games/colored-nonogram";

import { messages } from "../i18n";
import {
  nextPictureHint,
  pictureHintExplanation,
  type PictureHintReason,
} from "../nonogram/hint";
import type { Revealed } from "../play/grid-hint";
import { coloredCopy, toneName } from "./copy";

export type ColoredHintReason = PictureHintReason<ColoredNonogramStep>;

export function nextColoredHint(
  clues: ColoredNonogramClues,
  solution: readonly number[],
  entries: readonly (number | null)[],
): Revealed<number, ColoredHintReason> | null {
  return nextPictureHint(solution, entries, () =>
    nextColoredStep(clues, entries),
  );
}

export function coloredHintExplanation(
  clues: ColoredNonogramClues,
  reason: ColoredHintReason | null,
): string | null {
  return pictureHintExplanation(clues.size, reason, ({ runs, value }) => ({
    runs: runs.map((run) =>
      coloredCopy.run(run.length, toneName(clues.palette, run.tone)),
    ),
    mark:
      value === 0
        ? messages.games.nonogram.play.hint.explain.crossed
        : coloredCopy.painted(toneName(clues.palette, value)),
  }));
}
