import type { ReactNode } from "react";

import { messages } from "../i18n";
import { InfoTip, InfoTipSkeleton } from "../play/info-tip";
import styles from "./nonogram-board.module.css";
import type { NonogramBrush } from "./state";

const SEGMENTS = [
  { brush: "cross", label: "crossAria", Icon: CrossIcon },
  { brush: "fill", label: "fillAria", Icon: FillIcon },
] as const;

export interface BrushSegment {
  readonly key: string;
  readonly label: string;
  readonly pressed: boolean;
  readonly onPress: () => void;
  readonly icon: ReactNode;
}

export function BrushToggle({
  segments,
  affordance,
}: {
  readonly segments: readonly BrushSegment[];
  readonly affordance: string;
}) {
  const density =
    segments.length > 4
      ? ` ${styles.brushToggleCompact}`
      : segments.length > 2
        ? ` ${styles.brushToggleNarrow}`
        : "";
  return (
    <div className={styles.controls}>
      <div className={`${styles.brushToggle}${density}`}>
        {segments.map(({ key, label, pressed, onPress, icon }) => (
          <button
            key={key}
            type="button"
            className={`${styles.control}${pressed ? ` ${styles.controlActive}` : ""}`}
            aria-label={label}
            aria-pressed={pressed}
            onClick={onPress}
          >
            {icon}
          </button>
        ))}
      </div>
      <span className={styles.affordance}>
        <InfoTip text={affordance} align="center" />
      </span>
    </div>
  );
}

export function Controls({
  brush,
  onSetBrush,
}: {
  readonly brush: NonogramBrush;
  readonly onSetBrush: (brush: NonogramBrush) => void;
}) {
  const copy = messages.games.nonogram.play.controls;
  return (
    <BrushToggle
      affordance={copy.affordance}
      segments={SEGMENTS.map(({ brush: mode, label, Icon }) => ({
        key: mode,
        label: copy[label],
        pressed: brush === mode,
        onPress: () => onSetBrush(mode),
        icon: <Icon />,
      }))}
    />
  );
}

export function ControlsSkeleton() {
  return (
    <div aria-hidden className={styles.controls}>
      <div className={styles.brushToggle}>
        {SEGMENTS.map(({ brush, Icon }) => (
          <div
            key={brush}
            className={`${styles.control} ${styles.placeholder}`}
          >
            <Icon />
          </div>
        ))}
      </div>
      <span className={styles.affordance}>
        <InfoTipSkeleton />
      </span>
    </div>
  );
}

export function CrossIcon() {
  return (
    <svg aria-hidden className={styles.brushIcon} viewBox="0 0 24 24">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="square"
      />
    </svg>
  );
}

function FillIcon() {
  return (
    <svg aria-hidden className={styles.brushIcon} viewBox="0 0 24 24">
      <rect x="5" y="5" width="14" height="14" fill="currentColor" />
    </svg>
  );
}
