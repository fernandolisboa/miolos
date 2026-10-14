import styles from "./key-glyph.module.css";

const PATHS = {
  backspace:
    "M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7ZM12 9.5l5 5M17 9.5l-5 5",
  enter: "M20 5v7a2 2 0 0 1-2 2H5M9 10l-4 4 4 4",
} as const;

export type KeyGlyphName = keyof typeof PATHS;

export function KeyGlyph({ name }: { readonly name: KeyGlyphName }) {
  return (
    <svg
      className={styles.glyph}
      aria-hidden
      focusable="false"
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
