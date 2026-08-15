import { messages } from "../../../../src/i18n";
import { CARD_HEIGHT, CARD_WIDTH } from "../../../../src/og/card";
import { ogCopy } from "../../../../src/og/copy";
import { archiveCardHandler } from "../../../../src/og/handlers";

// ADR-0053 decision 2 — see `app/binairo/opengraph-image.tsx` for the
// kill-switch argument. The archive family is where it bites hardest: these
// URLs are the ones a `killed_at` writer must invalidate.
export const dynamic = "force-dynamic";
export const size = { width: CARD_WIDTH, height: CARD_HEIGHT };
export const contentType = "image/png";
export const alt = ogCopy.altGame(messages.games.binairo.name);

export default async function Image({
  params,
}: {
  readonly params: Promise<{ readonly data: string }>;
}) {
  return archiveCardHandler("binairo", (await params).data);
}
