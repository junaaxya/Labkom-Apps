import assert from "node:assert/strict";
import { constants } from "node:fs";
import path from "node:path";
import test from "node:test";

const QA_FILE_SINK_DIRECTORY = "/run/user/1000/labkom-qa-mail";

function replaceProperty(target: object, property: string, value: unknown): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, property);
  Object.defineProperty(target, property, { configurable: true, value });

  return () => {
    if (descriptor) {
      Object.defineProperty(target, property, descriptor);
    } else {
      Reflect.deleteProperty(target, property);
    }
  };
}

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

test("MAGANG QA email sink accepts only its static QA directory", async () => {
  const originalEnvironment = {
    delivery: process.env.MAGANG_EMAIL_DELIVERY,
    nodeEnv: process.env.NODE_ENV,
    sinkDirectory: process.env.MAGANG_EMAIL_SINK_DIR,
  };
  const filesystem = require("node:fs/promises") as object;
  const chmodCalls: Array<[string, number]> = [];
  const mkdirCalls: string[] = [];
  const fileChmodCalls: number[] = [];
  const writtenMessages: string[] = [];
  let openedFile: { path: string; flags: number; mode: number } | undefined;
  const safeDirectory = { isDirectory: () => true, isSymbolicLink: () => false };
  const restoreLstat = replaceProperty(filesystem, "lstat", async () => safeDirectory);
  const restoreMkdir = replaceProperty(filesystem, "mkdir", async (directory: string) => {
    mkdirCalls.push(directory);
  });
  const restoreRealpath = replaceProperty(filesystem, "realpath", async (directory: string) => directory);
  const restoreChmod = replaceProperty(filesystem, "chmod", async (directory: string, mode: number) => {
    chmodCalls.push([directory, mode]);
  });
  const restoreOpen = replaceProperty(filesystem, "open", async (filePath: string, flags: number, mode: number) => {
    openedFile = { path: filePath, flags, mode };
    return {
      writeFile: async (message: string) => { writtenMessages.push(message); },
      chmod: async (fileMode: number) => { fileChmodCalls.push(fileMode); },
      close: async () => undefined,
    };
  });

  try {
    const { MagangVerificationEmailService, VerificationDeliveryError } = await import("./magang-verification-email.service");
    process.env.MAGANG_EMAIL_DELIVERY = "qa-file-sink";
    process.env.NODE_ENV = "qa";
    process.env.MAGANG_EMAIL_SINK_DIR = QA_FILE_SINK_DIRECTORY;

    await MagangVerificationEmailService.sendVerification("magang@example.test", "https://example.test/verify");

    assert.deepEqual(mkdirCalls, []);
    assert.ok(openedFile);
    assert.equal(path.dirname(openedFile.path), QA_FILE_SINK_DIRECTORY);
    assert.equal(openedFile.mode, 0o600);
    assert.ok((openedFile.flags & constants.O_NOFOLLOW) !== 0);
    assert.deepEqual(fileChmodCalls, [0o600]);
    assert.ok(chmodCalls.some(([directory, mode]) => directory === QA_FILE_SINK_DIRECTORY && mode === 0o700));

    await MagangVerificationEmailService.sendApprovalNotification(
      "magang@example.test",
      "https://example.test/login",
    );

    assert.ok(openedFile);
    assert.ok(path.basename(openedFile.path).startsWith("magang-approval-"));
    assert.equal(path.dirname(openedFile.path), QA_FILE_SINK_DIRECTORY);
    assert.equal(openedFile.mode, 0o600);
    assert.ok((openedFile.flags & constants.O_NOFOLLOW) !== 0);
    assert.equal(
      writtenMessages[1],
        "Akun MAGANG LabKom Aktif\n\nAkun MAGANG Anda telah aktif. Login:\nhttps://example.test/login\n",
    );
    assert.deepEqual(fileChmodCalls, [0o600, 0o600]);

    process.env.MAGANG_EMAIL_SINK_DIR = "/mnt/data/tmp/opencode/legacy-qa-sink";
    await MagangVerificationEmailService.sendVerification("magang@example.test", "https://example.test/verify");
    assert.ok(openedFile);
    assert.equal(path.dirname(openedFile.path), "/mnt/data/tmp/opencode/legacy-qa-sink");
    assert.deepEqual(mkdirCalls, ["/mnt/data/tmp/opencode/legacy-qa-sink"]);

    process.env.MAGANG_EMAIL_SINK_DIR = "/run/user/1000/not-authorized";
    await assert.rejects(
      MagangVerificationEmailService.sendVerification("magang@example.test", "https://example.test/verify"),
      VerificationDeliveryError,
    );

    process.env.MAGANG_EMAIL_SINK_DIR = `${QA_FILE_SINK_DIRECTORY}/nested`;
    await assert.rejects(
      MagangVerificationEmailService.sendVerification("magang@example.test", "https://example.test/verify"),
      VerificationDeliveryError,
    );

    process.env.MAGANG_EMAIL_SINK_DIR = QA_FILE_SINK_DIRECTORY;
    process.env.NODE_ENV = "production";
    await assert.rejects(
      MagangVerificationEmailService.sendVerification("magang@example.test", "https://example.test/verify"),
      VerificationDeliveryError,
    );

    process.env.NODE_ENV = "qa";
    process.env.MAGANG_EMAIL_DELIVERY = "smtp";
    await assert.rejects(
      MagangVerificationEmailService.sendVerification("magang@example.test", "https://example.test/verify"),
      VerificationDeliveryError,
    );
  } finally {
    restoreOpen();
    restoreChmod();
    restoreRealpath();
    restoreMkdir();
    restoreLstat();
    restoreEnvironment("MAGANG_EMAIL_DELIVERY", originalEnvironment.delivery);
    restoreEnvironment("NODE_ENV", originalEnvironment.nodeEnv);
    restoreEnvironment("MAGANG_EMAIL_SINK_DIR", originalEnvironment.sinkDirectory);
  }
});
