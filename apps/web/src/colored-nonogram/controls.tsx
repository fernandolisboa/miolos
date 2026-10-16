import type { PictureTone } from "@miolos/games/colored-nonogram";

import { messages } from "../i18n";
import { BrushToggle, CrossIcon } from "../nonogram/controls";
import type { NonogramBrush } from "../nonogram/state";
import { toneStyle } from "./board";
import styles from "./colored-board.module.css";
import { coloredCopy, toneName } from "./copy";

export function ColoredControls({
  palette,
  brush,
  tone,
  onSetBrush,
  onSetTone,
}: {
  readonly palette: readonly PictureTone[];
  readonly brush: NonogramBrush;
  readonly tone: number;
  readonly onSetBrush: (brush: NonogramBrush) => void;
  readonly onSetTone: (tone: number) => void;
}) {
  return (
    <BrushToggle
      affordance={coloredCopy.affordance}
      className={styles.dense}
      segments={[
        {
          key: "cross",
          label: messages.games.nonogram.play.controls.crossAria,
          pressed: brush === "cross",
          onPress: () => onSetBrush("cross"),
          icon: <CrossIcon />,
        },
        ...palette.map((letter, at) => ({
          key: letter,
          label: coloredCopy.swatchAria(toneName(palette, at + 1)),
          pressed: brush === "fill" && tone === at + 1,
          onPress: () => onSetTone(at + 1),
          icon: (
            <span
              aria-hidden
              className={styles.swatch}
              style={toneStyle(letter)}
            />
          ),
        })),
      ]}
    />
  );
}
