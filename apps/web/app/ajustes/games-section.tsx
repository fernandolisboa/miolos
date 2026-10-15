import { messages } from "../../src/i18n";
import { GameSettings } from "../../src/settings/game-settings";
import styles from "./page.module.css";

const GAMES = ["sudoku", "binairo", "nonogram", "queens", "crossword"] as const;

export function GamesSection() {
  const copy = messages.settings.games;
  return (
    <section className={styles.card} aria-labelledby="settings-games-heading">
      <h2 id="settings-games-heading" className={styles.heading}>
        {copy.heading}
      </h2>
      <p className={styles.body}>{copy.lead}</p>
      <GameSettings games={GAMES} clock />
    </section>
  );
}
