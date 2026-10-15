"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { boardCardOf } from "./board-card";
import styles from "./hint-card.module.css";
import { hintArea, hintCardWidth, placeHintCard } from "./hint-card-place";
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
    const place = () => {
      const target = board.querySelector(`[data-cell-index="${cell}"]`);
      const frame = target ? boardCardOf(target) : null;
      const field = board.querySelector("[data-cell-index]");
      if (!target || !frame || !field) {
        card.hidden = true;
        return;
      }
      card.hidden = false;
      const box = target.getBoundingClientRect();
      const area = hintArea(
        frame.getBoundingClientRect(),
        field.getBoundingClientRect().top,
        box,
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
    };
    place();
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("resize", place);
    };
  }, [cell, text]);

  return open ? (
    <p ref={cardRef} aria-hidden className={styles.card}>
      {text}
    </p>
  ) : null;
}
