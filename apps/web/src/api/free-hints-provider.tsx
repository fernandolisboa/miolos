"use client";

import {
  FREE_HINTS_PER_PUZZLE,
  hintAllowanceResponseSchema,
  type HintAllowanceResponse,
} from "@miolos/core";
import type { ReactElement, ReactNode } from "react";

import { FreeHintsContext } from "../play/free-hints";
import { apiGet } from "./client";
import { useMountFetch } from "./use-mount-fetch";

async function fetchHintAllowance(): Promise<
  HintAllowanceResponse | undefined
> {
  return await apiGet(
    "/hints",
    hintAllowanceResponseSchema,
    "hint allowance fetch skipped, every puzzle offers the default free hints",
  );
}

export function FetchedFreeHints({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement {
  const fetched = useMountFetch(fetchHintAllowance);
  const settled = fetched?.freeHintsPerPuzzle ?? FREE_HINTS_PER_PUZZLE;
  const allowance = fetched === undefined ? null : settled;
  return <FreeHintsContext value={allowance}>{children}</FreeHintsContext>;
}
