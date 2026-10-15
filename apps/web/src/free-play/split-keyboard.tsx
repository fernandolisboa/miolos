"use client";

import type { KeyboardState, TileState } from "@miolos/games/termo";

import { messages } from "../i18n";
import { LetterKeyboard } from "../play/letter-keyboard";
import {
  activateKey,
  ariaFor,
  KEY_ROWS,
  labelFor,
  type KeyHandlers,
} from "../termo/keyboard";
import board from "../termo/termo-board.module.css";
import styles from "./termo-variants.module.css";
const SEGMENT_CLASS = {
  correct: styles.segmentCorrect,
  present: styles.segmentPresent,
  absent: styles.segmentAbsent,
} satisfies Record<TileState, string | undefined>;

type Mark = Parameters<typeof messages.freePlay.variant.letterAria>[1][number];

export function SplitKeyboard({
  states,
  ...handlers
}: KeyHandlers & { readonly states: readonly (KeyboardState | null)[] }) {
  const rows = KEY_ROWS.map((row) => ({
    keys: row.map(({ id, column, span }) => {
      const command = id === "enter" || id === "erase";
      const marks: readonly Mark[] = states.map((state) =>
        state === null ? null : state[id],
      );
      const open = marks.filter((mark) => mark !== null);
      const struck =
        !command && open.length > 0 && open.every((mark) => mark === "absent");
      return {
        id,
        column,
        span,
        label:
          command || struck ? labelFor(id) : <Segments id={id} marks={marks} />,
        ariaLabel: command
          ? ariaFor(id, {})
          : messages.freePlay.variant.letterAria(id, marks),
        className: `${board.key} ${styles.splitKey}${struck ? ` ${board.keyAbsent}` : ""}`,
        onActivate: () => {
          activateKey(id, handlers);
        },
      };
    }),
  }));

  return (
    <LetterKeyboard
      rows={rows}
      groupClassName={board.keyboard ?? ""}
      groupLabel={messages.games.termo.play.keyboard.label}
    />
  );
}

function Segments({
  id,
  marks,
}: {
  readonly id: string;
  readonly marks: readonly Mark[];
}) {
  return (
    <>
      <span aria-hidden className={styles.segments}>
        {marks.map((mark, index) => (
          <span
            key={index}
            className={mark == null ? undefined : SEGMENT_CLASS[mark]}
          />
        ))}
      </span>
      <span className={styles.glyph}>{id}</span>
    </>
  );
}
