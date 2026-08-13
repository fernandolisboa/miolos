// Renders the PWA icon set from the committed SVG master (#19, plan 027
// D12). Hand-run, outputs committed — the binaries in the repo have a
// reproducible provenance and a Nano Banana swap is: replace app/icon.svg,
// re-run this, commit.
//
//   cd apps/web && node scripts/render-icons.mjs
//
// The maskable variant insets the artwork to the ~80% safe zone on the
// desk-paper ground, so a platform mask (circle, squircle) never clips the
// card. 192 + 512 are Chromium's installability floor; PNG rather than SVG
// because SVG manifest-icon support is Chromium-only. apple-icon.png is
// 180×180 full-bleed — iOS applies its own corner mask.
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const master = join(webRoot, "app", "icon.svg");
const iconsDir = join(webRoot, "public", "icons");

/** --paper-desk (packages/ui/tokens.css) — the maskable ground. */
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
  // The safe zone is a centred circle of 40% radius (80% diameter): render
  // the artwork at 80% and centre it on the desk-paper ground.
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
