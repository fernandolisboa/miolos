import type { ReactNode } from "react";

import screen from "./screen.module.css";

export function boardCardOf(element: Element): Element | null {
  return element.closest(`.${screen.gridCard ?? ""}`);
}

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
      <div aria-hidden={placeholder || undefined} className={screen.gridCard}>
        {children}
      </div>
      {below}
      {overlay === undefined ? null : (
        <div className={screen.boardOverlay}>{overlay}</div>
      )}
    </div>
  );
}
