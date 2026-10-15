import { messages } from "../i18n";
import {
  activeEntry,
  indexOf,
  type CrosswordClue,
  type CrosswordDirection,
} from "./grid";
import styles from "./clues.module.css";

const copy = messages.games.crossword.play;

export function ClueBar({
  clues,
  selected,
  direction,
  size,
}: {
  readonly clues: readonly CrosswordClue[];
  readonly selected: number | null;
  readonly direction: CrosswordDirection;
  readonly size: number;
}) {
  const clue =
    selected === null
      ? undefined
      : activeEntry(clues, selected, direction, size);
  return (
    <p role="status" className={styles.activeBar}>
      <span className={styles.activeText}>
        {selected === null
          ? copy.cluePrompt
          : clue === undefined
            ? "\u00a0"
            : `${copy.clueLabel(clue.number, clue.direction)} · ${clue.clue}`}
      </span>
    </p>
  );
}

export function ClueBarSkeleton() {
  return (
    <p aria-hidden className={styles.activeBar}>
      <span className={styles.activeText}>{copy.cluePrompt}</span>
    </p>
  );
}

export function ClueLists({
  clues,
  selected,
  direction,
  size,
  onSelect,
}: {
  readonly clues: readonly CrosswordClue[];
  readonly selected: number | null;
  readonly direction: CrosswordDirection;
  readonly size: number;
  readonly onSelect: (index: number, direction: CrosswordDirection) => void;
}) {
  const active =
    selected === null
      ? undefined
      : activeEntry(clues, selected, direction, size);

  return (
    <div className={styles.lists}>
      <h2 className={styles.heading}>{copy.cluesHeading}</h2>
      {(["across", "down"] as const).map((dir) => (
        <div key={dir} className={styles.group}>
          <h3 className={styles.groupHeading}>{copy.direction[dir]}</h3>
          <ul className={styles.list}>
            {clues
              .filter((clue) => clue.direction === dir)
              .map((clue) => (
                <li key={clue.number}>
                  <button
                    type="button"
                    className={
                      clue === active
                        ? `${styles.item} ${styles.itemActive}`
                        : styles.item
                    }
                    onClick={() => {
                      onSelect(
                        indexOf(clue.row, clue.col, size),
                        clue.direction,
                      );
                    }}
                  >
                    {copy.clueLabel(clue.number, clue.direction)} — {clue.clue}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
