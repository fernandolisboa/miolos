import type { PlayChromeReadouts } from "./screen-chrome";
import type { HintState } from "./types";

export function hintReadout<R>(
  hint: HintState<R>,
  explain: string | null,
): Pick<NonNullable<PlayChromeReadouts["hint"]>, "used" | "explain" | "cell"> {
  return { used: hint.used, explain, cell: hint.lastIndex };
}
