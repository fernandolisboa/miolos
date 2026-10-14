import { messages } from "../i18n";
import {
  activeEntry,
  indexOf,
  type CrosswordClue,
  type CrosswordDirection,
} from "./grid";
import styles from "./clues.module.css";

const copy = messages.games.crossword.play;

export function ClueRow({
  clues,
  selected,
  direction,
  listsId,
  open,
  onToggle,
}: {
  readonly clues: readonly CrosswordClue[];
  readonly selected: number | null;
  readonly direction: CrosswordDirection;
  readonly listsId: string;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  const clue =
    selected === null ? undefined : activeEntry(clues, selected, direction);
  return (
    <div className={styles.clueRow}>
      <p role="status" className={styles.activeBar}>
        {clue === undefined
          ? copy.cluePrompt
          : `${copy.clueLabel(clue.number, clue.direction)} · ${clue.clue}`}
      </p>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={listsId}
        onClick={onToggle}
      >
        {copy.cluesHeading}
      </button>
    </div>
  );
}

export function ClueRowSkeleton() {
  return (
    <div aria-hidden className={styles.clueRow}>
      <p className={styles.activeBar}>{copy.cluePrompt}</p>
      <span className={styles.toggle}>{copy.cluesHeading}</span>
    </div>
  );
}

export function ClueLists({
  id,
  clues,
  selected,
  direction,
  onSelect,
}: {
  readonly id: string;
  readonly clues: readonly CrosswordClue[];
  readonly selected: number | null;
  readonly direction: CrosswordDirection;
  readonly onSelect: (index: number, direction: CrosswordDirection) => void;
}) {
  const active =
    selected === null ? undefined : activeEntry(clues, selected, direction);

  return (
    <div id={id} className={styles.lists}>
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
