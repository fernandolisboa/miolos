"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { useSettings } from "../settings/settings";
import styles from "./ending-stage.module.css";

const SPREAD_MS = 700;
const SAFETY_MS = 3000;
const CELLS = "[data-cell-index]:not([data-block])";

export function EndingStage({
  over,
  won,
  ending,
  children,
}: {
  readonly over: boolean;
  readonly won: boolean;
  readonly ending: () => ReactNode;
  readonly children: ReactNode;
}) {
  const { endAnimation } = useSettings();
  const [glowed, setGlowed] = useState(false);
  if (glowed && !over) {
    setGlowed(false);
  }
  const glowing = over && won && endAnimation && !glowed && motionAllowed();
  const frameRef = useRef<HTMLDivElement>(null);
  const lastCell = useRef<string | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!glowing || frame === null) {
      return;
    }
    const finish = () => {
      setGlowed(true);
    };
    const farthest = spreadGlow(frame, lastCell.current);
    farthest?.addEventListener("animationend", finish);
    const timer = setTimeout(finish, farthest ? SAFETY_MS : 0);
    return () => {
      clearTimeout(timer);
      farthest?.removeEventListener("animationend", finish);
    };
  }, [glowing]);

  if (over && !glowing) {
    return ending();
  }

  const remember = (cell: Element | null | undefined) => {
    const index = (
      cell?.closest(CELLS) ??
      frameRef.current?.querySelector(`${CELLS}[tabindex="0"]`)
    )?.getAttribute("data-cell-index");
    if (typeof index === "string") {
      lastCell.current = index;
    }
  };

  return (
    <div
      ref={frameRef}
      className={glowing ? `${styles.frame} ${styles.glow}` : styles.frame}
      inert={glowing}
      onPointerDownCapture={(event) => {
        remember(event.target as Element);
      }}
      onPointerMoveCapture={(event) => {
        if (event.buttons !== 0 && "elementFromPoint" in document) {
          remember(document.elementFromPoint(event.clientX, event.clientY));
        }
      }}
      onKeyDownCapture={() => {
        remember(null);
      }}
    >
      {children}
    </div>
  );
}

function motionAllowed(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function spreadGlow(frame: Element, last: string | null): HTMLElement | null {
  const cells = Array.from(frame.querySelectorAll<HTMLElement>(CELLS));
  const centres = cells.map(centreOf);
  const origin =
    frame.querySelector("[data-wave-origin]") ??
    (last === null ? null : frame.querySelector(`[data-cell-index="${last}"]`));
  const [x, y] = origin ? centreOf(origin) : middleOf(centres);
  const distances = centres.map(([cx, cy]) => Math.hypot(cx - x, cy - y));
  const far = Math.max(0, ...distances);
  let farthest: HTMLElement | null = null;
  cells.forEach((cell, index) => {
    const distance = distances[index] ?? 0;
    const delay = far === 0 ? 0 : Math.round((distance / far) * SPREAD_MS);
    cell.style.setProperty("--wave-delay", `${String(delay)}ms`);
    if (distance === far) {
      farthest = cell;
    }
  });
  return farthest;
}

function centreOf(element: Element): readonly [number, number] {
  const box = element.getBoundingClientRect();
  return [box.left + box.width / 2, box.top + box.height / 2];
}

function middleOf(
  points: readonly (readonly [number, number])[],
): readonly [number, number] {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ];
}
