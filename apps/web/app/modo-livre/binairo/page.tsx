import { BinairoFreeScreen } from "../../../src/free-play/binairo-free-screen";

/**
 * Free-play Binairo (#28, ADR-0046). STATIC by design — no `dynamic`
 * export, no db import, no fetch: the puzzle is generated in the browser
 * from a client-picked seed (ADR-0011), so there is nothing to read and
 * nothing to cache wrong. The pre-hydration HTML is the generating
 * skeleton with its `data-play-state` marker.
 */
export default function FreePlayBinairoPage() {
  return <BinairoFreeScreen />;
}
