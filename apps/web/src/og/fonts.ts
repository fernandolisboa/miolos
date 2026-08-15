import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * The three static font instances every OG card registers (#34, ADR-0054
 * decision 12), read ONCE at module scope.
 *
 * **Why static instances and not the variable files.** The bundled satori
 * accepts TrueType, `OTTO`, `ttcf` and `wOFF` (WOFF **1**) only, and it does
 * not merely degrade on a variable font — it throws: `parseFvarAxis` reads
 * `font.names`, which the bundle never assigns, so any face carrying an
 * `fvar` table raises `TypeError: Cannot read properties of undefined`. That
 * would be an uncaught 500 on a crawler-facing route, not a fallback. Never
 * commit `Fraunces[SOFT,WONK,opsz,wght].ttf`.
 *
 * **Why exactly three faces, and no italic.** Satori synthesises NOTHING —
 * not weight, not oblique, and not optical size. A request for a weight with
 * no registered face returns a byte-identical render of the nearest one,
 * silently. So every weight the card sets needs its own file, and an italic
 * line would render silently upright: `DESIGN.md:26` makes Fraunces italic
 * the app's human voice, and a card is a nameplate, not a voice. If a card
 * ever wants italic, it adds the face in the same commit.
 *
 * **`process.cwd()` and not `import.meta.url`.** Turbopack's tracer follows
 * this shape and lists all three TTFs in each route's own `.nft.json`
 * (verified against a real production build); an `import.meta.url` variant
 * blew up during prerender in the same probe. There is no
 * `outputFileTracingIncludes` escape hatch — it is a no-op under Turbopack.
 *
 * **Blast radius, stated.** A throw here fails the WHOLE build rather than
 * one route. That is the correct failure mode for a missing font — fail
 * closed, at build, visibly — and it is why `T-WEB-S202` also re-computes
 * the digests in `assets/fonts/SHA256SUMS` against the files on disk.
 *
 * **The family names below are what satori matches on**, not the TTFs'
 * internal ones, so the `36pt` in the Fraunces filename never reaches the
 * card's `fontFamily`. Which optical cut that file holds is derived in plan
 * 040 §7.2a and asserted intrinsically by `T-WEB-S202`.
 */
const FONT_DIR = join(process.cwd(), "assets/fonts");

export const FONTS = [
  {
    name: "Fraunces",
    data: await readFile(join(FONT_DIR, "Fraunces-36pt-500.ttf")),
    weight: 500 as const,
    style: "normal" as const,
  },
  {
    name: "Instrument Sans",
    data: await readFile(join(FONT_DIR, "InstrumentSans-400.ttf")),
    weight: 400 as const,
    style: "normal" as const,
  },
  {
    name: "Instrument Sans",
    data: await readFile(join(FONT_DIR, "InstrumentSans-600.ttf")),
    weight: 600 as const,
    style: "normal" as const,
  },
];
