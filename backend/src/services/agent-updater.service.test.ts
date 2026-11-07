import assert from "node:assert/strict";
import test from "node:test";
import zlib from "node:zlib";
import { AGENT_BUNDLE_FILES, buildZip, canTransitionUpdate, compareSemver, githubVersion, requireSemver, verifyCiToken } from "./agent-updater.service";

test("updater compares numeric SemVer and rejects invalid versions", () => {
  assert.equal(compareSemver("1.10.0", "1.9.9") > 0, true);
  assert.equal(compareSemver("2.0.0", "2.0.0"), 0);
  assert.throws(() => requireSemver("1.2", "version"), /SemVer/);
  assert.throws(() => requireSemver("01.2.3", "version"), /SemVer/);
});

test("runtime may roll back after swap/start failure while agent cannot report success", () => {
  assert.equal(canTransitionUpdate("INSTALLING", "ROLLING_BACK"), true);
  assert.equal(canTransitionUpdate("INSTALLING", "FAILED"), true);
  assert.equal(canTransitionUpdate("AWAITING_HEARTBEAT", "SUCCEEDED"), false);
  assert.equal(canTransitionUpdate("ROLLING_BACK", "ROLLED_BACK"), true);
});

test("CI token check is constant-time, rejects missing/wrong token", () => {
  assert.equal(verifyCiToken("secret-token", "secret-token"), true);
  assert.equal(verifyCiToken("secret-tokeX", "secret-token"), false);
  assert.equal(verifyCiToken("short", "secret-token"), false);
  assert.equal(verifyCiToken(undefined, "secret-token"), false);
  assert.equal(verifyCiToken("", ""), false);
});

test("GitHub tag normalizes to SemVer", () => {
  assert.equal(githubVersion("v1.1.0"), "1.1.0");
  assert.equal(githubVersion("1.2.3\n"), "1.2.3");
  assert.throws(() => githubVersion("latest"), /SemVer/);
});

test("buildZip emits valid STORE zip with exactly the updater-allowed files", () => {
  const files = AGENT_BUNDLE_FILES.map((name) => ({ name, data: Buffer.from(`content of ${name}`) }));
  const zip = buildZip(files);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const eocd = zip.length - 22;
  assert.equal(zip.readUInt32LE(eocd), 0x06054b50);
  assert.equal(zip.readUInt16LE(eocd + 10), files.length);
  let ptr = zip.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let i = 0; i < files.length; i += 1) {
    assert.equal(zip.readUInt32LE(ptr), 0x02014b50);
    const nameLen = zip.readUInt16LE(ptr + 28);
    const localOffset = zip.readUInt32LE(ptr + 42);
    const name = zip.subarray(ptr + 46, ptr + 46 + nameLen).toString();
    const size = zip.readUInt32LE(localOffset + 18);
    const data = zip.subarray(localOffset + 30 + nameLen, localOffset + 30 + nameLen + size);
    assert.equal(zlib.crc32(data), zip.readUInt32LE(ptr + 16));
    assert.equal(data.toString(), `content of ${name}`);
    names.push(name);
    ptr += 46 + nameLen;
  }
  assert.deepEqual(names.sort(), ["VERSION", "agent.py", "requirements.txt", "updater.py"]);
});
