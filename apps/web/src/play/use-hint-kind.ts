import { useCallback, useState, type Dispatch } from "react";

import type { ResetAction } from "./reset-board";

export function useHintKind<K>(dispatch: Dispatch<ResetAction>) {
  const [hintKind, setHintKind] = useState<K | null>(null);

  const reset = useCallback(() => {
    setHintKind(null);
    dispatch({ type: "reset" });
  }, [dispatch]);

  return { hintKind, setHintKind, reset };
}
