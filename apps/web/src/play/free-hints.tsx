import { FREE_HINTS_PER_PUZZLE } from "@miolos/core";
import { createContext, useContext } from "react";

export const FreeHintsContext = createContext<number | null>(
  FREE_HINTS_PER_PUZZLE,
);

export function useFreeHintsPerPuzzle(): number | null {
  return useContext(FreeHintsContext);
}

export function hasHintLeft(used: number, allowance: number | null): boolean {
  return allowance !== null && used < allowance;
}
