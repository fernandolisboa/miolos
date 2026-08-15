import { messages } from "../../src/i18n";
import { CARD_HEIGHT, CARD_WIDTH } from "../../src/og/card";
import { ogCopy } from "../../src/og/copy";
import { dailyCardHandler } from "../../src/og/handlers";

// ADR-0053 decision 2 (ADR-0054 decision 9): an image route advertised to
// every scraper by the page's own head is inside the kill-switch precondition
// — no `revalidate` before a `killed_at` writer exists to invalidate it. It is
// NOT inherited from the sibling `page.tsx`; route segment config comes from
// the layouts on the path plus the leaf, and the only layout is the root.
export const dynamic = "force-dynamic";
export const size = { width: CARD_WIDTH, height: CARD_HEIGHT };
export const contentType = "image/png";
// Dateless by CONSTRAINT: `alt` is a static module export and cannot read
// params. Recorded so it does not read as an oversight.
export const alt = ogCopy.altGame(messages.games.nonogram.name);

export default async function Image() {
  return dailyCardHandler("nonogram");
}
