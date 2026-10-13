import { FREE_HINTS_PER_PUZZLE } from "@miolos/core";
import { fireEvent, screen } from "@testing-library/react";

import { messages } from "../src/i18n";

export function spendFreeHints(): void {
  for (let left = FREE_HINTS_PER_PUZZLE; left > 0; left -= 1) {
    fireEvent.click(screen.getByText(messages.play.hint.available(left)));
  }
}
