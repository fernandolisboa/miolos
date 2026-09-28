import { messages } from "../i18n";
import {
  activeEntry,
  indexOf,
  type CrosswordClue,
  type CrosswordDirection,
} from "./grid";
import styles from "./clues.module.css";

const copy = messages.games.crossword.play;

export function ActiveClueBar({
  clues,
  selected,
  direction,
}: {
  readonly clues: readonly CrosswordClue[];
  readonly selected: number | null;
  readonly direction: CrosswordDirection;
}) {
  const clue =
    selected === null ? undefined : activeEntry(clues, selected, direction);
  return (
    <p role="status" className={styles.activeBar}>
      {clue === undefined
        ? " "
        : `${copy.clueLabel(clue.number, clue.direction)} · ${clue.clue}`}
    </p>
  );
}

export function ClueLists({
  clues,
  selected,
  direction,
  onSelect,
}: {
  readonly clues: readonly CrosswordClue[];
  readonly selected: number | null;
  readonly direction: CrosswordDirection;

  readonly onSelect: (index: number, direction: CrosswordDirection) => void;
}) {
  const active =
    selected === null ? undefined : activeEntry(clues, selected, direction);

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
                      onSelect(indexOf(clue.row, clue.col), clue.direction);
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
