import type { ReactNode } from "react";

import { BrandMark } from "../components/brand-mark";
import screen from "./screen.module.css";

export function BoardCard({
  placeholder = false,
  below,
  overlay,
  children,
}: {
  readonly placeholder?: boolean;
  readonly below?: ReactNode;
  readonly overlay?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className={screen.boardWell}>
      <div
        aria-hidden={placeholder || undefined}
        className={screen.gridCard}
        data-board-card
      >
        {children}
      </div>
      {below}
      {overlay !== undefined ? (
        <div className={screen.boardOverlay}>{overlay}</div>
      ) : placeholder ? (
        <BrandMark detailed shuffling className={screen.boardLoading} />
      ) : null}
    </div>
  );
}
