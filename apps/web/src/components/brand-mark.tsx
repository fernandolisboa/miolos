import { useId } from "react";

import styles from "./brand-mark.module.css";

const BRAIN =
  "M18 36C14 37 9 36 7 32C4 27 5 19 10 15C15 10 24 8 33 8C43 8 52 11 56 17C60 23 60 31 56 35C55 36 53 36.5 52 36.5C55 38 55 43 50 44C47 45 44.5 44.5 42.6 43.6L41.5 51.5C41 53.5 38.5 53.5 38 51.5L37.4 44.7C32 45.8 27 45.8 22 44C18 43 15 40 17 38C17.5 37 17.8 36.4 18 36Z";

interface Cut {
  readonly step: number;
  readonly outline: number;
  readonly cells: readonly (readonly [number, number, string | undefined])[];
}

const DETAILED: Cut = {
  step: 8,
  outline: 2.4,
  cells: [
    [1, 2, styles.termo],
    [3, 1, styles.sudoku],
    [5, 2, styles.nonogram],
    [2, 4, styles.binairo],
    [4, 3, styles.crossword],
    [6, 3, styles.queens],
  ],
};

const SMALL: Cut = {
  step: 16,
  outline: 4.2,
  cells: [
    [1, 1, styles.app],
    [2, 0, styles.app],
    [2, 2, styles.app],
  ],
};

function gridPath(step: number): string {
  let d = "";
  for (let at = step; at < 64; at += step) d += `M${at} 0V64M0 ${at}H64`;
  return d;
}

export function BrandMark({
  detailed = false,
  className,
}: {
  readonly detailed?: boolean;
  readonly className?: string;
}) {
  const clipId = useId();
  const { step, outline, cells } = detailed ? DETAILED : SMALL;
  const inset = step * 0.16;
  const side = step - 2 * inset;

  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="3 4 58 52"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BRAIN} />
        </clipPath>
      </defs>
      <path className={styles.paper} d={BRAIN} />
      <g clipPath={`url(#${clipId})`}>
        {cells.map(([column, row, accent]) => (
          <rect
            key={`${String(column)}-${String(row)}`}
            className={accent}
            x={column * step + inset}
            y={row * step + inset}
            width={side}
            height={side}
            rx={step * 0.12}
          />
        ))}
        <path
          className={styles.ink}
          d={gridPath(step)}
          strokeWidth={outline * 0.42}
        />
      </g>
      <path className={styles.ink} d={BRAIN} strokeWidth={outline} />
    </svg>
  );
}
