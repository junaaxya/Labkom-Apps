import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { authorize } from "../middlewares/auth.middleware";

type AuthorizationResult = { status?: number; nextCalled: boolean };

function authorizeRole(roles: string[], role?: string): AuthorizationResult {
  const result: AuthorizationResult = { nextCalled: false };
  const response = { status(code: number) { result.status = code; return this; }, json() { return this; } };
  const middleware = authorize(...roles);
  Reflect.apply(middleware, undefined, [role ? { user: { userId: "user-1", role } } : {}, response, () => { result.nextCalled = true; }]);
  return result;
}

const source = readFileSync(path.join(__dirname, "support-chat.routes.ts"), "utf8");
const indexSource = readFileSync(path.join(__dirname, "index.ts"), "utf8");

test("support chat routes expose explicit assistant claim and student receipt endpoints", () => {
  assert.match(source, /router\.post\("\/", authenticate, authorize\("MAHASISWA"\), SupportChatController\.create\);/);
  assert.match(source, /router\.post\("\/:id\/claim", authenticate, authorize\("ASISTEN_LAB"\), SupportChatController\.claim\);/);
  assert.match(source, /router\.post\("\/:id\/messages", authenticate, authorize\("MAHASISWA", "ASISTEN_LAB"\), SupportChatController\.createMessage\);/);
  assert.match(source, /router\.patch\("\/:id\/messages\/:messageId\/receipt", authenticate, authorize\("MAHASISWA", "ASISTEN_LAB"\), SupportChatController\.recordReceipt\);/);
  assert.match(indexSource, /router\.use\("\/support-chats", supportChatRoutes\);/);

  assert.equal(authorizeRole(["ASISTEN_LAB"], "ASISTEN_LAB").nextCalled, true);
  for (const role of ["MAHASISWA", "KOORDINATOR_LAB", "MAGANG"]) assert.equal(authorizeRole(["ASISTEN_LAB"], role).status, 403);
  assert.equal(authorizeRole(["MAHASISWA", "ASISTEN_LAB"], "MAHASISWA").nextCalled, true);
  assert.equal(authorizeRole(["MAHASISWA", "ASISTEN_LAB"], "ASISTEN_LAB").nextCalled, true);
  for (const role of ["KOORDINATOR_LAB", "MAGANG"]) assert.equal(authorizeRole(["MAHASISWA", "ASISTEN_LAB"], role).status, 403);
});
