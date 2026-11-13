import type { Metadata } from "next";

import { CrosswordFreeScreen } from "../../../src/free-play/crossword-free-screen";
import { routes } from "../../../src/i18n";

export const metadata: Metadata = {
  alternates: { canonical: routes.freePlayCrossword },
};

export default function FreePlayCrosswordPage() {
  return <CrosswordFreeScreen />;
}
