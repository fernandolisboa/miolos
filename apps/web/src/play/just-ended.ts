import { createContext, useState } from "react";

export const JustEnded = createContext(false);

export function useSawPlay(playing: boolean): boolean {
  const [saw, setSaw] = useState(playing);
  if (playing && !saw) {
    setSaw(true);
  }
  return saw;
}
