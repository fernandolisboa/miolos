import type { ReactNode } from "react";

import styles from "./switch.module.css";

export function Switch({
  checked,
  labelledBy,
  describedBy,
  disabled = false,
  onToggle,
  children,
}: {
  readonly checked: boolean;
  readonly labelledBy: string;
  readonly describedBy?: string;
  readonly disabled?: boolean;
  readonly onToggle: (next: boolean) => void;
  readonly children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      className={styles.switch}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        onToggle(!checked);
      }}
    >
      {children}
    </button>
  );
}
