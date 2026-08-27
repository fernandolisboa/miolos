import { messages } from "../../../../src/i18n";
import { CARD_HEIGHT, CARD_WIDTH } from "../../../../src/og/card";
import { ogCopy } from "../../../../src/og/copy";
import { archiveGameCardHandler } from "../../../../src/og/handlers";

export const dynamic = "force-dynamic";
export const size = { width: CARD_WIDTH, height: CARD_HEIGHT };
export const contentType = "image/png";
export const alt = ogCopy.altGame(messages.games.sudoku.name);

export default async function Image({
  params,
}: {
  readonly params: Promise<{ readonly data: string }>;
}) {
  return archiveGameCardHandler("sudoku", (await params).data);
}
