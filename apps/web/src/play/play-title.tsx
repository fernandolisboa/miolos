"use client";

import { useId, type ReactNode } from "react";

import { messages } from "../i18n";
import tip from "./info-tip.module.css";
import screen from "./screen.module.css";

export interface PlayTitleNote {
  readonly text: string;
  readonly className: string;
}

export function PlayTitle({
  kicker,
  title,
  rules,
  note,
  inert = false,
  children,
}: {
  readonly kicker: string;
  readonly title: string;
  readonly rules: string;
  readonly note: PlayTitleNote | null;
  readonly inert?: boolean;
  readonly children?: ReactNode;
}) {
  const rulesId = useId();

  return (
    <div className={screen.titleBlock}>
      <p className={screen.titleKicker}>{kicker}</p>

      <div className={screen.titleRow}>
        <h1 className={screen.title}>{title}</h1>
        <span className={screen.rulesToggle}>
          {inert ? (
            <span aria-hidden className={tip.button}>
              i
            </span>
          ) : (
            <button
              type="button"
              className={tip.button}
              aria-label={messages.play.rulesAria}
              popoverTarget={rulesId}
            >
              i
            </button>
          )}
        </span>
        {children}
      </div>
      <p id={rulesId} popover="auto" className={screen.rules}>
        {rules}
      </p>
      {note === null ? null : <p className={note.className}>{note.text}</p>}
    </div>
  );
}
