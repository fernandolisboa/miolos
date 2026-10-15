"use client";

import { useId, useRef, useState, type PointerEvent } from "react";

import { messages } from "../i18n";
import styles from "./info-tip.module.css";
import { closesOnEscape, useDismiss } from "./use-dismiss";

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
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const pressedBy = useRef<string | null>(null);

  useDismiss(open, rootRef, setOpen, closesOnEscape);

  const hover = (next: boolean) => (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    pressedBy.current = null;
    setOpen(next);
  };

  return (
    <span
      ref={rootRef}
      className={`${styles.root} ${ALIGN[align] ?? ""}`}
      onPointerEnter={hover(true)}
      onPointerLeave={hover(false)}
    >
      <button
        type="button"
        className={styles.button}
        aria-label={messages.play.tipAria}
        aria-expanded={open}
        aria-describedby={tipId}
        onMouseDown={(event) => {
          event.preventDefault();
        }}
        onPointerDown={(event) => {
          pressedBy.current = event.pointerType;
        }}
        onPointerCancel={() => {
          pressedBy.current = null;
        }}
        onFocus={() => {
          if (pressedBy.current === null) setOpen(true);
        }}
        onBlur={() => {
          pressedBy.current = null;
          setOpen(false);
        }}
        onClick={() => {
          const mouse = pressedBy.current === "mouse";
          pressedBy.current = null;
          setOpen((was) => mouse || !was);
        }}
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
