import { hintAllowanceResponseSchema } from "@miolos/core";
import { getRemoteConfig } from "@miolos/db/publishing";

import { getDb } from "../../src/db";
import { readErrorResponse, readResponse } from "../../src/http/responses";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const { freeHintsPerPuzzle } = await getRemoteConfig(getDb());
    return readResponse(
      hintAllowanceResponseSchema.parse({ freeHintsPerPuzzle }),
    );
  } catch {
    return readErrorResponse(500, "internal");
  }
}
