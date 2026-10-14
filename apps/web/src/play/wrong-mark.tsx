import styles from "./wrong-mark.module.css";

export function WrongMark() {
  return <span aria-hidden className={styles.mark} />;
}
