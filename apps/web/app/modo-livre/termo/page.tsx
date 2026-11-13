import type { Metadata } from "next";

import { TermoFreeScreen } from "../../../src/free-play/termo-free-screen";
import { routes } from "../../../src/i18n";

export const metadata: Metadata = {
  alternates: { canonical: routes.freePlayTermo },
};

export default function FreePlayTermoPage() {
  return <TermoFreeScreen />;
}
