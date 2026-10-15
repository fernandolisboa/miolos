"use client";

import { lazyChunk } from "../components/lazy-chunk";
import type { ConclusionPicture } from "../play/types";
import styles from "./free-play.module.css";

let LoadedPictureArt: typeof import("../play/picture-art").PictureArt | null =
  null;
const usePictureArtChunk = lazyChunk(() =>
  import("../play/picture-art").then((module) => {
    LoadedPictureArt = module.PictureArt;
  }),
);

export function FreePlayPicture({
  picture,
}: {
  readonly picture: ConclusionPicture;
}) {
  const ready = usePictureArtChunk() === "ready";
  return ready && LoadedPictureArt !== null ? (
    <LoadedPictureArt picture={picture} className={styles.picture} />
  ) : (
    <div aria-hidden className={styles.picture} />
  );
}
