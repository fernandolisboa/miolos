"use client";

import { type TermoVariant } from "@miolos/games/termo";
import { useId, useState } from "react";

import { lazyChunk } from "../components/lazy-chunk";
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
} from "./use-free-termo";

let loadedVariants: typeof import("./termo-variants") | null = null;
const useVariantsLoaded = lazyChunk(() =>
  import("./termo-variants").then((module) => {
    loadedVariants = module;
  }),
);

const CHROME: TermoChrome = {
  back: FREE_PLAY_BACK,
  topTag: messages.freePlay.modeTag,
};

export function TermoFreeScreen({ deps }: { readonly deps?: FreeTermoDeps }) {
  const [variant, setVariant] = useState<TermoVariant>("classico");
  const { phase, regenerate } = useFreeTermo(variant, deps);
  const [asks, setAsks] = useState(0);
  const variants = useVariantsLoaded(asks) ? loadedVariants : null;
  const menuId = useId();

  const name = messages.freePlay.variant[variant];
  const chrome: TermoChrome = {
    ...CHROME,
    picker: (
      <>
        <button
          type="button"
          className={styles.variantTrigger}
          aria-label={messages.freePlay.variant.triggerAria(name)}
          popoverTarget={variants === null ? undefined : menuId}
          onClick={() => {
            if (variants === null) setAsks(asks + 1);
          }}
        >
          {name}
        </button>
        {variants !== null && (
          <variants.VariantMenu
            id={menuId}
            value={variant}
            onChange={setVariant}
          />
        )}
      </>
    ),
  };

  switch (phase.kind) {
    case "ready": {
      const key = `${String(phase.puzzle.seed)}:${variant}:${String(phase.run)}`;
      return variants !== null && variant !== "classico" ? (
        <variants.TermoVariants
          key={key}
          variant={variant}
          words={phase.puzzle.words}
          chrome={chrome}
          onVariant={setVariant}
          onNext={regenerate}
        />
      ) : (
        <TermoFreeBoard
          key={key}
          canonical={phase.puzzle.words[0] ?? ""}
          chrome={chrome}
          onNext={regenerate}
        />
      );
    }
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
      return <PlaySkeleton date={FREE_PLAY_DATE} chrome={chrome} />;
  }
}

function TermoFreeBoard({
  canonical,
  chrome,
  onNext,
}: {
  readonly canonical: string;
  readonly chrome: TermoChrome;
  readonly onNext: () => void;
}) {
  const play = useFreeTermoBoard(canonical);
  const { status } = play.state;

  return (
    <EndingStage
      over={status !== "playing"}
      won={status === "solved"}
      ending={() => (
        <FreePlaySolvedCard
          game="termo"
          words={[canonical]}
          lost={status === "lost"}
          onAgain={onNext}
        >
          <FinishedBoard guesses={play.state.guesses} />
        </FreePlaySolvedCard>
      )}
    >
      <PlayView play={play} chrome={chrome} />
    </EndingStage>
  );
}
