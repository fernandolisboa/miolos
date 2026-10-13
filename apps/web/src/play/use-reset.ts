import { useCallback, type Dispatch } from "react";

import type { ResetAction } from "./reset-board";

export function useReset(dispatch: Dispatch<ResetAction>): () => void {
  return useCallback(() => {
    dispatch({ type: "reset" });
  }, [dispatch]);
}
