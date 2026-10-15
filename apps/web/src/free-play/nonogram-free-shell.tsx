import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";

import { messages } from "../i18n";
import { BoardSkeleton } from "../nonogram/board";
import { ControlsSkeleton } from "../nonogram/controls";
import { nonogramPageModifier } from "../nonogram/page-class";
import { BoardCard } from "../play/board-card";
import { hintReadout } from "../play/hint-readout";
import type { PlayChromeReadouts } from "../play/screen-chrome";
import type { HintState } from "../play/types";
import type { BinaryGridControls } from "../play/use-binary-grid-controls";
import type { FreePlayLevel } from "./catalog";
import type { FreePlayChoices } from "./choice-picker";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
import { GeneratingNote } from "./generating-note";

export const NONOGRAM_VARIANTS = ["classico", "cores"] as const;

export type NonogramVariant = (typeof NONOGRAM_VARIANTS)[number];

export type NonogramChoices = FreePlayChoices<FreePlayLevel, NonogramVariant>;

export const LEVEL_SIZES: Readonly<Record<FreePlayLevel, NonogramSize>> = {
  leve: 5,
  medio: 10,
  dificil: 15,
};

export function NonogramFreeShell({
  level,
  choices,
  onRetry,
}: {
  readonly level: FreePlayLevel;
  readonly choices: NonogramChoices;
  readonly onRetry?: () => void;
}) {
  const size = LEVEL_SIZES[level];
  return (
    <FreePlayChrome
      game="nonogram"
      choices={choices}
      state={{ kind: onRetry === undefined ? "generating" : "error" }}
      pageModifier={nonogramPageModifier(size)}
    >
      {onRetry === undefined ? (
        <GeneratingBoard size={size} />
      ) : (
        <FreePlayErrorCard onRetry={onRetry} />
      )}
    </FreePlayChrome>
  );
}

export function pictureReadouts(
  size: number,
  filled: number,
  target: number,
  hint: { readonly state: HintState<unknown>; readonly explain: string | null },
  controls: BinaryGridControls,
): PlayChromeReadouts {
  const copy = messages.games.nonogram.play;
  return {
    progressShort: copy.progressShort(size, filled, target),
    progressLong: copy.progressLong(filled, target),
    hint: {
      ...hintReadout(hint.state, hint.explain),
      ready: controls.hintReady,
      onReveal: controls.revealHint,
    },
    ...controls.edits,
  };
}

function GeneratingBoard({ size }: { readonly size: NonogramSize }) {
  const emptyClues: NonogramClues = {
    size,
    rows: Array.from({ length: size }, () => []),
    cols: Array.from({ length: size }, () => []),
  };
  return (
    <BoardCard
      placeholder
      below={<ControlsSkeleton />}
      overlay={<GeneratingNote />}
    >
      <BoardSkeleton size={size} clues={emptyClues} />
    </BoardCard>
  );
}
