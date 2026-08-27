//

//

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const master = join(webRoot, "app", "icon.svg");
const iconsDir = join(webRoot, "public", "icons");

const PAPER_DESK = "#F7F2E9";

await mkdir(iconsDir, { recursive: true });

async function renderPlain(size, outPath) {
  await sharp(master, { density: (72 * size) / 512 })
    .resize(size, size)
    .png()
    .toFile(outPath);
  console.log(`rendered ${outPath} (${String(size)}x${String(size)})`);
}

async function renderMaskable(size, outPath) {
  const inner = Math.round(size * 0.8);
  const artwork = await sharp(master, { density: (72 * inner) / 512 })
    .resize(inner, inner)
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: PAPER_DESK,
    },
  })
    .composite([{ input: artwork, gravity: "centre" }])
    .png()
    .toFile(outPath);
  console.log(`rendered ${outPath} (${String(size)}x${String(size)} maskable)`);
}

await renderPlain(192, join(iconsDir, "icon-192.png"));
await renderPlain(512, join(iconsDir, "icon-512.png"));
await renderMaskable(512, join(iconsDir, "icon-maskable-512.png"));
await renderPlain(180, join(webRoot, "app", "apple-icon.png"));
