import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const apkPath = path.join(root, "public", "downloads", "labkom-management.apk");
const checksumPath = `${apkPath}.sha256`;
const expectedHash = "0d335fc38cd7798fbe1c1786977cb4fb1fa3546c6dd24b8a2c479f1a2a857406";

test("download page serves verified LabKom APK", () => {
  const page = fs.readFileSync(path.join(root, "src", "app", "download", "page.tsx"), "utf8");
  const apk = fs.readFileSync(apkPath);
  const checksum = fs.readFileSync(checksumPath, "utf8");

  assert.match(page, /"\/downloads\/labkom-management\.apk"/);
  assert.equal(crypto.createHash("sha256").update(apk).digest("hex"), expectedHash);
  assert.equal(checksum, `${expectedHash}  labkom-management.apk\n`);
});
