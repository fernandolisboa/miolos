"use client";

import { useLayoutEffect, useRef, useState } from "react";

import styles from "./hint-card.module.css";
import {
  hintArea,
  hintCardWidth,
  placeHintCard,
  revealScroll,
} from "./hint-card-place";
import { useDismiss } from "./use-dismiss";

const KEEPS_OPEN = new Set([
  "Tab",
  "Shift",
  "Control",
  "Alt",
  "AltGraph",
  "Meta",
  "CapsLock",
]);

function closesHintCard(event: KeyboardEvent): boolean {
  return !event.repeat && !KEEPS_OPEN.has(event.key);
}

export function HintCard({
  text,
  cell,
}: {
  readonly text: string;
  readonly cell: number;
}) {
  const [open, setOpen] = useState(true);
  const cardRef = useRef<HTMLParagraphElement>(null);
  useDismiss(open, cardRef, setOpen, closesHintCard);

  useLayoutEffect(() => {
    const card = cardRef.current;
    const board = card?.parentElement;
    if (!card || !board) return;
    const place = (): number => {
      const target = board.querySelector(`[data-cell-index="${cell}"]`);
      const frame = target?.closest("[data-board-card]");
      const field = board.querySelector("[data-cell-index]");
      if (!target || !frame || !field) {
        card.hidden = true;
        return 0;
      }
      card.hidden = false;
      const box = target.getBoundingClientRect();
      const area = hintArea(
        frame.getBoundingClientRect(),
        field.getBoundingClientRect().top,
        document.documentElement.clientWidth,
      );
      card.style.maxWidth = `${String(hintCardWidth(box, area))}px`;
      const spot = placeHintCard(
        box,
        { width: card.offsetWidth, height: card.offsetHeight },
        area,
      );
      const origin = board.getBoundingClientRect();
      card.style.left = `${String(spot.left - origin.left)}px`;
      card.style.top = `${String(spot.top - origin.top)}px`;
      card.style.setProperty("--tail", `${String(spot.tail)}px`);
      card.dataset.side = spot.below ? "below" : "above";
      return revealScroll(spot.top, card.offsetHeight, window.innerHeight);
    };
    const reveal = place();
    if (reveal !== 0) window.scrollBy(0, reveal);
    const replace = () => {
      place();
    };
    window.addEventListener("resize", replace);
    return () => {
      window.removeEventListener("resize", replace);
    };
  }, [open, cell, text]);

  return open ? (
    <p ref={cardRef} aria-hidden className={styles.card}>
      {text}
    </p>
  ) : null;
}
