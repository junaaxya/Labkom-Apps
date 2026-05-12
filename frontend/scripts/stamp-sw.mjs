import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const swPath = path.join(root, "public", "sw.js");

const content = fs.readFileSync(swPath, "utf8");
const hash = crypto
  .createHash("sha256")
  .update(content + Date.now().toString())
  .digest("hex")
  .slice(0, 12);

const replaced = content.replace(/labkom-[A-Za-z0-9_-]+/g, `labkom-${hash}`);
fs.writeFileSync(swPath, replaced);
console.log(`sw.js cache version set to labkom-${hash}`);
