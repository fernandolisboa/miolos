"use client";

import type { CSSProperties, ReactNode } from "react";

import { useSettings } from "../settings/settings";
import styles from "./ending-flourish.module.css";

const FLICKS = Array.from({ length: 8 }, (_, index) => {
  const degrees = index * 45 + 22.5;
  const radians = (degrees * Math.PI) / 180;
  return {
    left: `${String(Math.round(50 + Math.cos(radians) * 62))}%`,
    top: `${String(Math.round(50 + Math.sin(radians) * 62))}%`,
    "--angle": `${String(degrees)}deg`,
  } satisfies CSSProperties;
});

const DRIPS: readonly CSSProperties[] = [
  { left: "38%", "--drip-delay": "0ms" },
  { left: "52%", "--drip-delay": "180ms" },
  { left: "63%", "--drip-delay": "90ms" },
];

export function EndingFlourish({
  outcome,
  play,
  children,
}: {
  readonly outcome: "won" | "lost";
  readonly play: boolean;
  readonly children: ReactNode;
}) {
  const { endAnimation } = useSettings();
  const on = play && endAnimation;
  const won = outcome === "won";
  const motion = won ? styles.press : styles.sag;
  return (
    <div className={on ? `${styles.anchor} ${motion}` : styles.anchor}>
      {children}
      {on ? (
        <div aria-hidden className={styles.flourish} data-ending={outcome}>
          {won ? (
            <>
              <span className={styles.ring} />
              {FLICKS.map((style, index) => (
                <span key={index} className={styles.flick} style={style} />
              ))}
            </>
          ) : (
            DRIPS.map((style, index) => (
              <span key={index} className={styles.drip} style={style} />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
