import { messages } from "../i18n";
import styles from "./free-play.module.css";

export function FreePlayErrorCard({
  onRetry,
}: {
  readonly onRetry: () => void;
}) {
  return (
    <div className={styles.errorCard}>
      <p className={styles.errorTitle}>{messages.freePlay.error.title}</p>
      <p className={styles.errorBody}>{messages.freePlay.error.body}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        {messages.freePlay.error.retry}
      </button>
    </div>
  );
}
