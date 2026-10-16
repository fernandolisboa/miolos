import { messages } from "../i18n";
import styles from "./free-play.module.css";

export function VariantTrigger({
  name,
  menuId,
  onClick,
}: {
  readonly name: string;
  readonly menuId: string | undefined;
  readonly onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={styles.variantTrigger}
      aria-label={messages.freePlay.variant.triggerAria(name)}
      popoverTarget={menuId}
      onClick={onClick}
    >
      {name}
    </button>
  );
}
