import { CARD_HEIGHT, CARD_WIDTH } from "./card";

export interface OgImageEntry {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
  readonly type: string;
}

export function cardImage(args: {
  readonly url: string;
  readonly alt: string;
}): OgImageEntry {
  return {
    url: args.url,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alt: args.alt,
    type: "image/png",
  };
}
