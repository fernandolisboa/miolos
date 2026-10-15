# ADR-0121 — The solved Nonogram picture is painted in its motif's tones

**Status:** Accepted — 2026-10-15 (issue #366)
**Depends on:** [ADR-0021](./0021-nonogram-pictures-are-a-curated-motif-library.md), [ADR-0033](./0033-the-nonogram-reveal-ships-no-name.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0047](./0047-bundle-markers-are-route-scoped.md), [ADR-0070](./0070-the-daily-nonogram-conclusion-names-its-motif.md), [ADR-0118](./0118-a-game-that-just-ended-presses-or-runs-the-stamps-ink.md)
**Amends:** [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md) (`/modo-livre/nonogram` 69 → 76 KB); `DESIGN.md` § Motion.

## Context

Fernando asked for the Nonogram picture to turn into color when the board is solved, like a colored pixel-art reveal. The picture is a one-bit bitmap; colors that read as the subject (a yellow banana, an orange cat) are content, not something code can derive. The daily client never holds the motif library (ADR-0033, ADR-0047), free play makes no requests (ADR-0046 decision 8), and migrations are run by hand.

## Decision

1. **Every motif has curated tones**, one per filled cell, from a 14-letter palette (`PICTURE_TONES`), authored as rows in `packages/games/src/nonogram/colors-{5,8,10,15}.ts` beside the library and not on `Motif`. A harness proves each entry matches its motif's mask exactly. The bundle ships a run-length form, `tones.generated.ts` (`generate:nonogram`, staleness-tested), read through `@miolos/games/nonogram-colors`' `motifTones(motifId, mirrored)`.
2. **The daily gets its tones on its own completed `/day` claim**, as `motifTones` beside `motifName`, on the same completed-only rule (ADR-0070). `apps/api` looks them up from the stored `reveal.motifId` and `reveal.mirrored` (`getPublishedNonogramMotif`); no column, no migration. Like the name, they are today-only; the archive draws no picture.
3. **Free play looks them up on the device**: `use-free-nonogram.ts` keeps only the tones string from the generated reveal, and is the one `apps/web` module allowed to import the subpath. Zero requests still hold. The table costs about 6.8 KB raw on `/modo-livre/nonogram`, so its budget rises to 76 KB (Fernando's decision card in the thread "Nonogram colorido no fim").
4. **`PictureArt` (`play/picture-art.tsx`) paints them** over the ink silhouette in `--tone-<letter>` tokens (light and dark values), with a 1.5 px `--ink` outline so the shape keeps 3:1 against the card whatever the tones are. Tones that do not fit the solved cells are ignored.
5. **On a game that just ended, the tones wipe in diagonally from the top-left** over 900 ms. A revisit, the `endAnimation` switch off or reduced motion paints them still.

## Consequences

- `@miolos/games/nonogram-colors` holds every picture: it is banned from `apps/web/app` and `src` except `use-free-nonogram.ts`, and the run marker `heart:mrmr13` must be absent from daily-scope chunks and present in a free-play chunk.
- A new motif needs a tones entry and `generate:nonogram`, or the harness fails.
- The tones letter set is pinned on the wire (`dayGameStateSchema`) and checked against `PICTURE_TONES`.

## Rejected

- **Colors derived from the bitmap** (a hue gradient): a green cat is not the picture colored.
- **A stateless colors endpoint keyed by the solved bitmap**: a second post-completion route where ADR-0070's claim seam exists, and a free-play request.
- **Tones in the daily payload**: they would hint at the picture before it is solved.
- **Shipping the authored rows as they are**: about 26 KB on free play, against 6.8 KB run-length.
