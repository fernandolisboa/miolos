import type { MinesweeperState } from "@miolos/games/minesweeper";
import type { ReactNode } from "react";

import { FlagGlyph, MineGlyph } from "./glyphs";
import { minesweeperMessages } from "./messages";
import styles from "./minefield.module.css";
import { cellView, type CellView } from "./view";

export function glyphOf(view: CellView): ReactNode {
  switch (view) {
    case "flag":
      return <FlagGlyph />;
    case "wrongFlag":
      return <FlagGlyph crossed />;
    case "mine":
    case "hit":
      return <MineGlyph />;
    case "question":
      return "?";
    case "hidden":
      return null;
    default:
      return view === 0 ? null : view;
  }
}

export function classOf(view: CellView): string {
  const shown =
    typeof view === "number" ||
    view === "hit" ||
    view === "mine" ||
    view === "wrongFlag";
  return [
    styles.cell,
    shown ? styles.open : undefined,
    typeof view === "number" && view > 0
      ? styles[`count${String(view)}`]
      : undefined,
    view === "hit" ? styles.hit : undefined,
  ]
    .filter((name) => name !== undefined)
    .join(" ");
}

export function FinishedMinefield({
  game,
  sizeClass,
}: {
  readonly game: MinesweeperState;
  readonly sizeClass: string | undefined;
}) {
  return (
    <div
      role="img"
      aria-label={minesweeperMessages.finishedAria(game.status === "won")}
      className={`${styles.field} ${styles.finished} ${sizeClass ?? ""}`}
    >
      {game.open.map((_open, index) => {
        const view = cellView(game, index);
        return (
          <span key={index} className={classOf(view)}>
            {glyphOf(view)}
          </span>
        );
      })}
    </div>
  );
}
