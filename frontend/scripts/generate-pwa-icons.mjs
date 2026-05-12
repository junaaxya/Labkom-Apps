import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const src = path.join(root, "..", "logo_labkom.png");
const outDir = path.join(root, "public", "icons");
const appleOut = path.join(root, "public", "apple-touch-icon.png");
const screenshotsDir = path.join(root, "public", "screenshots");

const brandBg = { r: 75, g: 96, b: 127, alpha: 1 };
const creamBg = { r: 232, g: 216, b: 201, alpha: 1 };

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function makeSquare(size, padRatio, bg, outPath) {
  const logo = sharp(src).resize({
    width: Math.round(size * (1 - padRatio * 2)),
    height: Math.round(size * (1 - padRatio * 2)),
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  const logoBuf = await logo.png().toBuffer();
  const logoMeta = await sharp(logoBuf).metadata();
  const offsetX = Math.round((size - (logoMeta.width ?? 0)) / 2);
  const offsetY = Math.round((size - (logoMeta.height ?? 0)) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logoBuf, left: offsetX, top: offsetY }])
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(outPath);
  const stat = await fs.stat(outPath);
  console.log(`Wrote ${path.relative(root, outPath)} ${size}x${size} ${(stat.size / 1024).toFixed(1)}KB`);
}

async function run() {
  await ensureDir(outDir);
  await ensureDir(screenshotsDir);

  await makeSquare(192, 0.12, brandBg, path.join(outDir, "icon-192x192.png"));
  await makeSquare(512, 0.12, brandBg, path.join(outDir, "icon-512x512.png"));
  await makeSquare(192, 0.22, brandBg, path.join(outDir, "icon-maskable-192.png"));
  await makeSquare(512, 0.22, brandBg, path.join(outDir, "icon-maskable-512.png"));
  await makeSquare(180, 0.14, brandBg, appleOut);
  await makeSquare(1024, 0.14, brandBg, path.join(outDir, "icon-apple-1024.png"));
  await makeSquare(96, 0.12, creamBg, path.join(outDir, "favicon-96.png"));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
