import { isValidElement, type ReactNode } from "react";

import { FetchedFreeHints } from "../src/api/free-hints-provider";

export function hintedScreen(page: ReactNode): ReactNode {
  if (
    !isValidElement<{ readonly children: ReactNode }>(page) ||
    page.type !== FetchedFreeHints
  ) {
    throw new Error("the page does not fetch the hint allowance");
  }
  return page.props.children;
}
