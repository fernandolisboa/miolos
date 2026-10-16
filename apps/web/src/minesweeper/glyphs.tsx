import styles from "./minefield.module.css";

export function FlagGlyph({ crossed = false }: { readonly crossed?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={styles.glyph}>
      <path d="M8 4v16M5 20h8" stroke="currentColor" strokeWidth="2" />
      <path d="M8 4l10 4.5L8 13z" fill="var(--accent-app)" />
      {crossed && (
        <path
          d="M4 4l16 16M20 4 4 20"
          stroke="var(--accent-app)"
          strokeWidth="2.5"
        />
      )}
    </svg>
  );
}

export function MineGlyph() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={styles.glyph}>
      <path
        d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="12" cy="12" r="6" fill="currentColor" />
    </svg>
  );
}
