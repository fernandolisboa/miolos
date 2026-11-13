import type { Metadata } from "next";

import { BinairoFreeScreen } from "../../../src/free-play/binairo-free-screen";
import { routes } from "../../../src/i18n";

export const metadata: Metadata = {
  alternates: { canonical: routes.freePlayBinairo },
};

export default function FreePlayBinairoPage() {
  return <BinairoFreeScreen />;
}
