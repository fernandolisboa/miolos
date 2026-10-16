"use client";

import { TERMO_VARIANTS, type TermoVariant } from "@miolos/games/termo";
import { useRef } from "react";

import { messages } from "../i18n";
import { BoardCard } from "../play/board-card";
import { EndingStage } from "../play/ending-stage";
import { Board, FinishedBoard } from "../termo/board";
import { TermoNotice, TermoPage, useTermoKeys } from "../termo/play-view";
import type { TermoChrome } from "../termo/types";
import { FREE_PLAY_DATE } from "./catalog";
import { variantChoice } from "./choice-picker";
import { FreePlaySolvedCard } from "./solved-card";
import { SplitKeyboard } from "./split-keyboard";
import styles from "./termo-variants.module.css";
import { useTermoVariant } from "./use-termo-variant";
import { VariantMenu } from "./variant-menu";

const copy = messages.freePlay.variant;

const VARIANTS = Object.keys(TERMO_VARIANTS) as readonly TermoVariant[];

export function TermoVariantMenu({
  id,
  value,
  onChange,
}: {
  readonly id: string;
  readonly value: TermoVariant;
  readonly onChange: (variant: TermoVariant) => void;
}) {
  return (
    <VariantMenu
      id={id}
      choice={variantChoice(VARIANTS, copy, value, onChange)}
      rules={copy.rules[value]}
    />
  );
}

export function TermoVariants({
  variant,
  words,
  chrome,
  onVariant,
  onNext,
}: {
  readonly variant: Exclude<TermoVariant, "classico">;
  readonly words: readonly string[];
  readonly chrome: TermoChrome;
  readonly onVariant: (variant: TermoVariant) => void;
  readonly onNext: () => void;
}) {
  const { maxGuesses } = TERMO_VARIANTS[variant];
  const play = useTermoVariant(words, maxGuesses);
  const { state, judged } = play;
  const refocusRef = useRef(false);
  const onKey = useTermoKeys({
    ...play,
    live: judged.status === "playing",
    cursor: state.cursor,
  });
  const editable = judged.boards.findIndex(
    (board) => board.status === "playing",
  );
  const label = (index: number) =>
    copy.boardAria(index + 1, judged.boards.length);

  return (
    <EndingStage
      over={judged.status !== "playing"}
      won={judged.status === "won"}
      ending={() => (
        <FreePlaySolvedCard
          game="termo"
          choices={[variantChoice(VARIANTS, copy, variant, onVariant)]}
          words={words}
          lost={judged.status === "lost"}
          onAgain={onNext}
        >
          <div className={styles.finished} data-wide>
            {judged.boards.map((board, index) => (
              <FinishedBoard
                key={index}
                guesses={board.rows}
                maxGuesses={maxGuesses}
                label={label(index)}
              />
            ))}
          </div>
        </FreePlaySolvedCard>
      )}
    >
      <TermoPage
        chrome={{
          ...chrome,
          rules: copy.rules[variant],
          pageClassName: `${styles.page} ${styles[variant]}`,
        }}
        date={FREE_PLAY_DATE}
        used={state.guesses.length}
        maxGuesses={maxGuesses}
        announcement={state.announcement}
      >
        <BoardCard>
          <div className={styles.boards}>
            {judged.boards.map((board, index) => (
              <Board
                key={index}
                guesses={board.rows}
                activeRow={
                  board.status === "playing" ? state.guesses.length : null
                }
                heldRow={
                  board.status === "playing" && state.pending !== null
                    ? state.guesses.length
                    : null
                }
                draft={state.draft}
                cursor={state.cursor}
                pending={state.pending}
                onSelect={play.select}
                onKey={onKey}
                maxGuesses={maxGuesses}
                label={label(index)}
                draftEditable={index === editable}
                refocusRef={refocusRef}
              />
            ))}
          </div>
        </BoardCard>

        <TermoNotice notice={state.notice} nonce={state.noticeNonce} />

        <SplitKeyboard
          states={play.keyboardStates}
          onLetter={play.type}
          onEnter={play.submit}
          onErase={play.erase}
        />
      </TermoPage>
    </EndingStage>
  );
}
