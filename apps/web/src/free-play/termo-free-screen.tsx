"use client";

import { messages } from "../i18n";
import { accentVars } from "../play/accent";
import { FinishedBoard } from "../termo/board";
import { PlaySkeleton, PlayView } from "../termo/play-view";
import type { TermoChrome } from "../termo/types";
import { EndingStage } from "../play/ending-stage";
import { FREE_PLAY_BACK } from "./back";
import { FREE_PLAY_DATE } from "./catalog";
import { FreePlayErrorCard } from "./error-card";
import styles from "./free-play.module.css";
import { FreePlaySolvedCard } from "./solved-card";
import {
  useFreeTermo,
  useFreeTermoBoard,
  type FreeTermoDeps,
  type FreeTermoPuzzle,
} from "./use-free-termo";

const CHROME: TermoChrome = {
  back: FREE_PLAY_BACK,
  topTag: messages.freePlay.modeTag,
};

export function TermoFreeScreen({ deps }: { readonly deps?: FreeTermoDeps }) {
  const { phase, regenerate } = useFreeTermo(deps);

  switch (phase.kind) {
    case "ready":
      return (
        <TermoFreeBoard
          key={`${String(phase.puzzle.seed)}:${String(phase.run)}`}
          puzzle={phase.puzzle}
          onNext={regenerate}
        />
      );
    case "failed":
      return (
        <main
          className={styles.solvedPage}
          style={accentVars("termo")}
          data-play-state="error"
        >
          <FreePlayErrorCard onRetry={regenerate} />
        </main>
      );
    case "generating":
      return <PlaySkeleton date={FREE_PLAY_DATE} chrome={CHROME} />;
  }
}

function TermoFreeBoard({
  puzzle,
  onNext,
}: {
  readonly puzzle: FreeTermoPuzzle;
  readonly onNext: () => void;
}) {
  const play = useFreeTermoBoard(puzzle.canonical);
  const { status } = play.state;

  return (
    <EndingStage
      over={status !== "playing"}
      won={status === "solved"}
      ending={() => (
        <FreePlaySolvedCard
          game="termo"
          word={{ canonical: puzzle.canonical, won: status === "solved" }}
          onAgain={onNext}
        >
          <FinishedBoard guesses={play.state.guesses} />
        </FreePlaySolvedCard>
      )}
    >
      <PlayView play={play} chrome={CHROME} />
    </EndingStage>
  );
}
