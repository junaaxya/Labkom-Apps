import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const publicDir = path.join(root, "public");
const offlinePage = path.join(root, "src", "app", "offline", "page.tsx");
const sw = fs.readFileSync(path.join(publicDir, "sw.js"), "utf8");
const stamp = fs.readFileSync(path.join(root, "scripts", "stamp-sw.mjs"), "utf8");
const layout = fs.readFileSync(path.join(root, "src", "app", "layout.tsx"), "utf8");
const manifestPath = "/manifest-labkom-20260708.webmanifest";
const cacheNamePattern = /^labkom-pwa-(?:__CACHE_VERSION__|[a-f0-9]{12})$/;
const cacheVersionPattern = /labkom-pwa-(?:__CACHE_VERSION__|[A-Za-z0-9_-]+)/g;

const normalizeCacheVersion = (content) =>
  content.replace(cacheVersionPattern, "labkom-pwa-__CACHE_VERSION__");

const stampInMemory = (content, buildId = "sw-test-build") => {
  const source = normalizeCacheVersion(content);
  const hash = crypto
    .createHash("sha256")
    .update(`${source}\n${buildId}`)
    .digest("hex")
    .slice(0, 12);
  return content.replace(cacheVersionPattern, `labkom-pwa-${hash}`);
};

const precacheUrls = [
  "/offline",
  "/manifest.json",
  manifestPath,
  "/icons/labkom-app-icon-192.png",
  "/icons/labkom-app-icon-512.png",
  "/labkom-apple-touch-icon.png",
];

test("precache list matches layout manifest and existing public assets", () => {
  assert.match(layout, new RegExp(`manifest: ["']${manifestPath.replaceAll(".", "\\.")}["']`));
  for (const url of precacheUrls) {
    assert.match(sw, new RegExp(`"${url.replaceAll(".", "\\.")}"`));
    const fileExists = url === "/offline"
      ? fs.existsSync(offlinePage)
      : fs.existsSync(path.join(publicDir, url.slice(1)));
    assert.equal(fileExists, true, url);
  }
  assert.doesNotMatch(sw, /labkom-[a-f0-9]{12}\.(?:png|webmanifest)/);
  assert.doesNotMatch(sw, /"\/"/);
});

test("install requires only stable precache resources", () => {
  const cacheName = sw.match(/const CACHE_NAME = "([^"]+)"/)?.[1];
  assert.equal(cacheNamePattern.test(cacheName ?? ""), true);
  for (const invalidCacheName of [
    "labkom-pwa-ABCDEF123456",
    "labkom-pwa-abcdef12345",
    "labkom-pwa-abcdef1234567",
    "labkom-pwa-abcdef12345g",
  ]) {
    assert.equal(cacheNamePattern.test(invalidCacheName), false, invalidCacheName);
  }
  assert.match(sw, /cache\.addAll\(PRECACHE_URLS\)/);
  assert.doesNotMatch(sw, /addAll\(PRECACHE_URLS\)[\s\S]{0,120}catch/);
  assert.match(stamp, /replace\(\/labkom-pwa-\(\?:__CACHE_VERSION__\|\[A-Za-z0-9_-\]\+\)\//);
  assert.match(stamp, /process\.env\.NEXT_BUILD_ID \?\? process\.env\.BUILD_ID/);
  assert.doesNotMatch(stamp, /Date\.now/);
  assert.doesNotMatch(stamp, /replace\(\/labkom-\[A-Za-z0-9_\-\]\+\//);
});

test("cache stamping is deterministic and idempotent in memory", () => {
  const sourceForm = normalizeCacheVersion(sw);
  assert.match(sourceForm, /const CACHE_NAME = "labkom-pwa-__CACHE_VERSION__"/);
  const stampedForm = stampInMemory(sourceForm);
  assert.match(stampedForm, /const CACHE_NAME = "labkom-pwa-[a-f0-9]{12}"/);
  assert.equal(stampInMemory(sourceForm), stampedForm);
  assert.equal(stampInMemory(stampedForm), stampedForm);
  assert.equal(stampInMemory(sw), stampedForm);
});

test("activation removes only obsolete LabKom PWA caches", () => {
  assert.match(sw, /key\.startsWith\("labkom-pwa-"\) && key !== CACHE_NAME/);
  assert.doesNotMatch(sw, /filter\(\(key\) => key !== CACHE_NAME\)/);
});

test("fetch bypasses API, uploads, auth, SSE, and cross-origin requests", () => {
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);
  assert.match(sw, /url\.pathname\.startsWith\("\/uploads\/"\)/);
  assert.match(sw, /url\.pathname\.endsWith\("\/notifications\/stream"\)/);
  assert.match(sw, /req\.headers\.has\("authorization"\)/);
});

test("navigation falls back to cached offline page", () => {
  assert.match(sw, /req\.mode === "navigate"/);
  assert.match(sw, /fetch\(req\)\.catch\(\(\) =>/);
  assert.match(sw, /cache\.match\(OFFLINE_URL\)/);
});
