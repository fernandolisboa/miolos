"use client";

import { messages } from "../i18n";
import styles from "./info-tip.module.css";
import { useTip } from "./use-tip";

type Align = "start" | "center";

const ALIGN: Readonly<Record<Align, string | undefined>> = {
  start: styles.alignStart,
  center: styles.alignCenter,
};

export function InfoTip({
  text,
  align,
}: {
  readonly text: string;
  readonly align: Align;
}) {
  const [open, tipId, rootProps, buttonProps] = useTip<HTMLSpanElement>();

  return (
    <span className={`${styles.root} ${ALIGN[align] ?? ""}`} {...rootProps}>
      <button
        type="button"
        className={styles.button}
        aria-label={messages.play.tipAria}
        {...buttonProps}
      >
        <span aria-hidden>i</span>
      </button>
      <span id={tipId} role="tooltip" hidden={!open} className={styles.tip}>
        {text}
      </span>
    </span>
  );
}

export function InfoTipSkeleton() {
  return (
    <span aria-hidden className={styles.root}>
      <span className={styles.button}>i</span>
    </span>
  );
}
