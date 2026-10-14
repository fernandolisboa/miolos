import { messages } from "../i18n";
import styles from "./free-play.module.css";

export function GeneratingNote() {
  return <p className={styles.generating}>{messages.freePlay.generating}</p>;
}
