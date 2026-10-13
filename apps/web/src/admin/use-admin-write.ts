"use client";

import type { AdminStateResponse } from "@miolos/core";
import { useState } from "react";

export type AdminWriteProps = {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onSaved: (state: AdminStateResponse) => void;
};

export function useAdminWrite({ setBusy, onSaved }: AdminWriteProps) {
  const [outcome, setOutcome] = useState<"saved" | "failed">();

  async function write(
    send: () => Promise<AdminStateResponse | undefined>,
  ): Promise<boolean> {
    setBusy(true);
    const state = await send();
    setBusy(false);
    setOutcome(state ? "saved" : "failed");
    if (state) {
      onSaved(state);
    }
    return state !== undefined;
  }

  return { outcome, clearOutcome: () => setOutcome(undefined), write };
}
