import { act } from "@testing-library/react";

export const SPOKEN = { selector: "[aria-live] p" } as const;

export async function hintCardLoaded(): Promise<void> {
  await act(async () => {
    await import("../src/play/hint-card");
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
