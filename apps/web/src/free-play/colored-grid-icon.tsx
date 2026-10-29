import styles from "./free-play.module.css";

const TONES = ["r", "y", "g", "b", "r", "y", "g", "b", "r"] as const;
const PITCH = 7.5;

export function ColoredGridIcon() {
  return (
    <svg aria-hidden viewBox="0 0 21 21" className={styles.toggleIcon}>
      {TONES.map((tone, at) => (
        <rect
          key={at}
          data-tone={tone}
          x={(at % 3) * PITCH}
          y={Math.floor(at / 3) * PITCH}
          width={6}
          height={6}
          rx={1}
        />
      ))}
    </svg>
  );
}
