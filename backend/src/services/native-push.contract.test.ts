import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const source = readFileSync(path.join(__dirname, "native-push.service.ts"), "utf8");
const notificationSource = readFileSync(path.join(__dirname, "notification.service.ts"), "utf8");
const routeSource = readFileSync(path.join(__dirname, "../routes/notification.routes.ts"), "utf8");

test("native push tokens stay user-scoped and invalid FCM tokens are removed", () => {
  assert.match(source, /nativePushToken\.upsert/);
  assert.match(source, /deleteMany\(\{ where: \{ userId, token \} \}\)/);
  assert.match(source, /registration-token-not-registered/);
  assert.match(source, /invalid-registration-token/);
});

test("notification service delivers through native push and authenticated token routes", () => {
  assert.match(notificationSource, /nativePushService\.sendToUser/);
  assert.match(notificationSource, /nativePushService[\s\S]*\.sendToUsers/);
  assert.match(routeSource, /router\.use\(authenticate\)/);
  assert.match(routeSource, /router\.post\("\/push\/native\/register", registerNativePush\)/);
  assert.match(routeSource, /router\.post\("\/push\/native\/unregister", unregisterNativePush\)/);
});
