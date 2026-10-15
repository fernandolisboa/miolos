import { messages } from "../i18n";
import styles from "./brand-mark.module.css";

export const BRAIN =
  "M18 36C14 37 9 36 7 32C4 27 5 19 10 15C15 10 24 8 33 8C43 8 52 11 56 17C60 23 60 31 56 35C55 36 53 36.5 52 36.5C55 38 55 43 50 44C47 45 44.5 44.5 42.6 43.6L41.5 51.5C41 53.5 38.5 53.5 38 51.5L37.4 44.7C32 45.8 27 45.8 22 44C18 43 15 40 17 38C17.5 37 17.8 36.4 18 36Z";

const LOBES = [
  styles.termo,
  styles.sudoku,
  styles.nonogram,
  styles.binairo,
  styles.crossword,
  styles.queens,
];

interface Cut {
  readonly step: number;
  readonly outline: number;
  readonly cells: string;
}

// Each cell is three characters: its column and row in base 36, then its lobe.
const DETAILED: Cut = {
  step: 4,
  outline: 2.4,
  cells:
    "410510610811911220320420520620821921a21130230330430530630831931a31c32140240340440540640741841941a41c42d42150250350450550650751851951a51b52c52d52160260360460560b62c62d62270373573673773873973a73c72483583683783883983a83c84493593693793893993b949a59b5",
};

const SMALL: Cut = {
  step: 6,
  outline: 3.6,
  cells:
    "210310410511611120220320521621822030130230330531631832140240842353453553653363463563764",
};

function cellsOf({
  cells,
}: Cut): readonly (readonly [number, number, number])[] {
  const decoded: [number, number, number][] = [];
  for (let at = 0; at < cells.length; at += 3) {
    decoded.push([
      parseInt(cells.charAt(at), 36),
      parseInt(cells.charAt(at + 1), 36),
      Number(cells.charAt(at + 2)),
    ]);
  }
  return decoded;
}

export function BrandMark({
  detailed = false,
  shuffling = false,
  className,
}: {
  readonly detailed?: boolean;
  readonly shuffling?: boolean;
  readonly className?: string;
}) {
  const cut = detailed ? DETAILED : SMALL;
  const side = cut.step * 0.8;
  const offset = (cut.step - side) / 2;

  return (
    <svg
      aria-hidden="true"
      className={
        shuffling
          ? `${className ?? styles.mark} ${styles.shuffling}`
          : (className ?? styles.mark)
      }
      viewBox="3 4 58 52"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path className={styles.paper} d={BRAIN} />
      {cellsOf(cut).map(([column, row, lobe]) => (
        <rect
          key={`${String(column)}-${String(row)}`}
          className={LOBES[lobe]}
          x={3 + column * cut.step + offset}
          y={4 + row * cut.step + offset}
          width={side}
          height={side}
          rx={cut.step * 0.18}
        />
      ))}
      <path className={styles.ink} d={BRAIN} strokeWidth={cut.outline} />
    </svg>
  );
}

export function Wordmark({
  detailed = false,
  className,
}: {
  readonly detailed?: boolean;
  readonly className?: string;
}) {
  return (
    <span className={className}>
      <BrandMark detailed={detailed} />
      {messages.brand.wordmark}
    </span>
  );
}
