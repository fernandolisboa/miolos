import { z } from "zod";

import { remoteConfigField } from "../remote-config";

export const hintAllowanceResponseSchema = z.strictObject({
  freeHintsPerPuzzle: remoteConfigField("freeHintsPerPuzzle"),
});
export type HintAllowanceResponse = z.infer<typeof hintAllowanceResponseSchema>;
