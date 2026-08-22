import { NonogramFreeScreen } from "../../../src/free-play/nonogram-free-screen";

/**
 * Free-play Nonogram (#28, ADR-0046). STATIC by design — no `dynamic`
 * export, no db import, no fetch: the puzzle is generated in the browser
 * from a client-picked seed (ADR-0011). The motif library rides this
 * route's chunk (ADR-0047); its curated names stay non-user-facing **in free
 * play** (ADR-0070 narrows the rule to here — the daily conclusion names its
 * motif over the wire since #64, never from a bundled table).
 */
export default function FreePlayNonogramPage() {
  return <NonogramFreeScreen />;
}
