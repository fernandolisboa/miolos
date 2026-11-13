import type { Metadata } from "next";

import { NonogramFreeScreen } from "../../../src/free-play/nonogram-free-screen";
import { routes } from "../../../src/i18n";

export const metadata: Metadata = {
  alternates: { canonical: routes.freePlayNonogram },
};

export default function FreePlayNonogramPage() {
  return <NonogramFreeScreen />;
}
