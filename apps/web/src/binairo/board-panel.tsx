import { BoardCard } from "../play/board-card";
import { Controls } from "./controls";
import { Grid } from "./grid";
import type { PlayState } from "./state";
import type { BinairoControls } from "./use-binairo-controls";

export function BoardPanel({
  state,
  controls,
}: {
  readonly state: PlayState;
  readonly controls: BinairoControls;
}) {
  return (
    <BoardCard
      below={
        <Controls paint={state.paint} onToggleMode={controls.toggleMode} />
      }
    >
      <Grid
        givens={state.givens}
        solution={state.solution}
        entries={state.entries}
        mistakes={state.mistakes}
        violating={state.violating}
        selected={state.selected}
        hintIndex={state.hint.lastIndex}
        spotlight={state.hint.spotlight}
        painting={state.paint.kind !== "cycle"}
        onSelect={controls.selectCell}
        onMove={controls.moveSelection}
        onTap={controls.tapCell}
        onStrokeStart={controls.strokeStart}
        onPaintOver={controls.paintOver}
        onEnterValue={controls.enterValue}
        onClear={controls.clearCell}
      />
    </BoardCard>
  );
}
