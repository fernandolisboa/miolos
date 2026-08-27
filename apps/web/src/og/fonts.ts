import { readFile } from "node:fs/promises";
import { join } from "node:path";

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
