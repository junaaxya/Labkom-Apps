import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("Capacitor registers native push and supports notification deep links", () => {
  const native = read("../src/services/native-notifications.ts");
  const layout = read("../src/app/(dashboard)/layout.tsx");
  const topbar = read("../src/components/layout/neo-topbar.tsx");
  assert.match(native, /PushNotifications\.requestPermissions/);
  assert.match(native, /PushNotifications\.register\(\)/);
  assert.match(native, /\/notifications\/push\/native\/register/);
  assert.match(native, /pushNotificationActionPerformed/);
  assert.match(native, /window\.location\.assign\(link\)/);
  assert.match(layout, /initializeNativeNotifications/);
  assert.match(topbar, /unregisterNativeNotifications/);
});

test("native downloads use FileTransfer and Share while web keeps anchor fallback", () => {
  const download = read("../src/services/download-file.ts");
  const reports = read("../src/app/(dashboard)/reports/page.tsx");
  const certificates = read("../src/app/(dashboard)/certificates/page.tsx");
  assert.match(download, /Capacitor\.isNativePlatform\(\)/);
  assert.match(download, /FileTransfer\.downloadFile/);
  assert.match(download, /Share\.share/);
  assert.match(download, /anchor\.download = filename/);
  assert.match(reports, /downloadFile\(/);
  assert.match(certificates, /downloadFile\(/);
});
