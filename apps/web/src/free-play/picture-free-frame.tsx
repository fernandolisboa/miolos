"use client";

import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";
import { Fragment, useEffect, type ReactNode } from "react";

import { lazyChunk } from "../components/lazy-chunk";
import { messages } from "../i18n";
import { BoardSkeleton } from "../nonogram/board";
import { ControlsSkeleton } from "../nonogram/controls";
import { nonogramPageModifier } from "../nonogram/page-class";
import { BoardCard } from "../play/board-card";
import { EndingStage } from "../play/ending-stage";
import { hintReadout } from "../play/hint-readout";
import type { HintState, LifecycleAction } from "../play/types";
import type { BinaryGridControls } from "../play/use-binary-grid-controls";
import type { FreeGeneration } from "./use-free-generation";
import { NONOGRAM_LEVEL_SIZES, type FreePlayLevel } from "./catalog";
import type { Choice } from "./choice";
import { FreePlayChrome } from "./chrome";
import { FreePlayErrorCard } from "./error-card";
import styles from "./free-play.module.css";
import { GeneratingNote } from "./generating-note";
import type { PictureSolvedProps } from "./picture-solved-card";

const useSolvedCard = lazyChunk(() =>
  import("./picture-solved-card").then((module) => module.PictureSolvedCard),
);

export function PictureFreeScreen<P extends { readonly seed: number }>({
  level,
  choices,
  generation: { phase, regenerate },
  board,
}: {
  readonly level: FreePlayLevel;
  readonly choices: readonly Choice[];
  readonly generation: FreeGeneration<P>;
  readonly board: (puzzle: P, onNext: () => void) => ReactNode;
}) {
  if (phase.kind !== "ready") {
    return (
      <NonogramFreeShell
        level={level}
        choices={choices}
        {...(phase.kind === "failed" ? { onRetry: regenerate } : {})}
      />
    );
  }
  return (
    <Fragment
      key={`${String(phase.puzzle.seed)}:${level}:${String(phase.run)}`}
    >
      {board(phase.puzzle, regenerate)}
    </Fragment>
  );
}

export function PictureFreeFrame({
  choices,
  size,
  pageModifier,
  picture,
  filled,
  target,
  hint,
  controls,
  dispatch,
  below,
  onNext,
  children,
}: {
  readonly choices: readonly Choice[];
  readonly size: NonogramSize;
  readonly pageModifier: string;
  readonly picture: PictureSolvedProps["picture"] | null;
  readonly filled: number;
  readonly target: number;
  readonly hint: {
    readonly state: HintState<unknown>;
    readonly explain: string | null;
  };
  readonly controls: BinaryGridControls;
  readonly dispatch: (action: LifecycleAction) => void;
  readonly below: ReactNode;
  readonly onNext: () => void;
  readonly children: ReactNode;
}) {
  useSolvedCard();
  useEffect(() => {
    dispatch({ type: "restore", record: undefined, now: Date.now() });
  }, [dispatch]);

  const copy = messages.games.nonogram.play;
  return (
    <EndingStage
      over={picture !== null}
      won
      ending={() =>
        picture === null ? null : (
          <PictureEnding choices={choices} picture={picture} onAgain={onNext} />
        )
      }
    >
      <FreePlayChrome
        game="nonogram"
        choices={choices}
        pageModifier={pageModifier}
        state={{
          kind: "playing",
          readouts: {
            progressShort: copy.progressShort(size, filled, target),
            progressLong: copy.progressLong(filled, target),
            hint: {
              ...hintReadout(hint.state, hint.explain),
              ready: controls.hintReady,
              onReveal: controls.revealHint,
            },
            ...controls.edits,
          },
        }}
      >
        <BoardCard below={below}>{children}</BoardCard>
      </FreePlayChrome>
    </EndingStage>
  );
}

function PictureEnding(props: PictureSolvedProps) {
  const card = useSolvedCard();
  if (card.state === "ready") {
    return <card.value {...props} />;
  }
  return (
    <main className={styles.solvedPage}>
      {card.state === "failed" && <FreePlayErrorCard onRetry={props.onAgain} />}
    </main>
  );
}

export function NonogramFreeShell({
  level,
  choices,
  onRetry,
}: {
  readonly level: FreePlayLevel;
  readonly choices: readonly Choice[];
  readonly onRetry?: () => void;
}) {
  const size = NONOGRAM_LEVEL_SIZES[level];
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
