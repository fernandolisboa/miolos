import { messages } from "../i18n";
import styles from "./mistake-marks.module.css";
import { MISTAKE_LIMIT } from "./mistakes";

export function MistakeMarks({
  left,
  className,
}: {
  readonly left: number;
  readonly className: string | undefined;
}) {
  return (
    <span
      role="img"
      aria-label={messages.play.mistakes.aria(left)}
      className={`${styles.marks ?? ""} ${className ?? ""}`}
    >
      {Array.from({ length: MISTAKE_LIMIT }, (_, at) => (
        <span key={at} className={at < left ? styles.left : styles.spent} />
      ))}
    </span>
  );
}
