import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const swPath = path.join(root, "public", "sw.js");

const content = fs.readFileSync(swPath, "utf8");
const source = content.replace(/labkom-pwa-[A-Za-z0-9_-]+/g, "labkom-pwa-__CACHE_VERSION__");
const buildId = process.env.NEXT_BUILD_ID ?? process.env.BUILD_ID ?? "local";
const hash = crypto
  .createHash("sha256")
  .update(`${source}\n${buildId}`)
  .digest("hex")
  .slice(0, 12);

const replaced = content.replace(/labkom-pwa-(?:__CACHE_VERSION__|[A-Za-z0-9_-]+)/, `labkom-pwa-${hash}`);
fs.writeFileSync(swPath, replaced);
console.log(`sw.js cache version set to labkom-${hash}`);
