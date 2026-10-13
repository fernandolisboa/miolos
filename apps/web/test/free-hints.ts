import { FREE_HINTS_PER_PUZZLE } from "@miolos/core";
import { fireEvent, screen } from "@testing-library/react";
import { isValidElement, type ReactNode } from "react";

import { FetchedFreeHints } from "../src/api/free-hints-provider";
import { messages } from "../src/i18n";

export function spendFreeHints(): void {
  for (let left = FREE_HINTS_PER_PUZZLE; left > 0; left -= 1) {
    fireEvent.click(screen.getByText(messages.play.hint.available(left)));
  }
}

export function hintedScreen(page: ReactNode): ReactNode {
  if (
    !isValidElement<{ readonly children: ReactNode }>(page) ||
    page.type !== FetchedFreeHints
  ) {
    throw new Error("the page does not fetch the hint allowance");
  }
  return page.props.children;
}
