import type { Metadata } from "next";

import { QueensFreeScreen } from "../../../src/free-play/queens-free-screen";
import { routes } from "../../../src/i18n";

export const metadata: Metadata = {
  alternates: { canonical: routes.freePlayQueens },
};

export default function FreePlayQueensPage() {
  return <QueensFreeScreen />;
}
