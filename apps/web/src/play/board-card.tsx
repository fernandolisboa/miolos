import type { ReactNode } from "react";

import screen from "./screen.module.css";

export function BoardCard({
  placeholder = false,
  below,
  children,
}: {
  readonly placeholder?: boolean;
  readonly below?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className={screen.boardWell}>
      <div aria-hidden={placeholder || undefined} className={screen.gridCard}>
        {children}
      </div>
      {below}
    </div>
  );
}
