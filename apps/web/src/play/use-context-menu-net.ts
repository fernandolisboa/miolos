import { useRef } from "react";

function armContextMenuNet(): () => void {
  let lapse: ReturnType<typeof setTimeout> | undefined;
  const release = () => {
    clearTimeout(lapse);
    window.removeEventListener("contextmenu", swallow, true);
    window.removeEventListener("pointerup", settle, true);
    window.removeEventListener("pointercancel", settle, true);
  };
  const swallow = (event: Event) => {
    event.preventDefault();
    release();
  };
  const settle = () => {
    clearTimeout(lapse);
    lapse = setTimeout(release, 0);
  };
  window.addEventListener("contextmenu", swallow, true);
  window.addEventListener("pointerup", settle, true);
  window.addEventListener("pointercancel", settle, true);
  return release;
}

// Windows fires `contextmenu` after mouseup at whatever is then under the cursor, so
// the net outlives a board that ends or unmounts mid-press, until the release.
export function useContextMenuNet(): () => void {
  const release = useRef<(() => void) | null>(null);
  return () => {
    release.current?.();
    release.current = armContextMenuNet();
  };
}
