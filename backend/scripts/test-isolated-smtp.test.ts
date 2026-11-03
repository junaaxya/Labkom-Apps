import assert from "node:assert/strict";
import test from "node:test";
import { createOfficialSmtpTransport } from "../src/services/magang-verification-email.service";
import { SMTP_TEST_MESSAGE, classifySmtpFailure, main, normalizeGoogleAppPassword, readHiddenPassword, sendOne } from "./test-isolated-smtp";

function output() {
  let text = "";
  return { isTTY: true, write: (value: string) => { text += value; return true; }, text: () => text };
}

test("isolated SMTP runner exits safely without --send-one", async () => {
  const out = output();
  const result = await main([], {} as never, out);
  assert.equal(result, 0);
  assert.match(out.text(), /--send-one/);
});

test("isolated SMTP runner sends exactly one fixed synthetic message", async () => {
  const sent: unknown[] = [];
  await sendOne("test-password", () => ({ sendMail: async (message: unknown) => { sent.push(message); } }));
  assert.deepEqual(sent, [SMTP_TEST_MESSAGE]);
  assert.equal(SMTP_TEST_MESSAGE.to, "muismlbb2@gmail.com");
  assert.equal(SMTP_TEST_MESSAGE.subject, "[LabKom Test] Verifikasi Pengiriman SMTP Terkendali");
  assert.doesNotMatch(SMTP_TEST_MESSAGE.text, /https?:\/\//);
  assert.doesNotMatch(SMTP_TEST_MESSAGE.text, /\b[A-Za-z0-9_-]{32,}\b/);
});

test("isolated SMTP runner normalizes only whitespace from displayed Google App Password groups", () => {
  assert.equal(normalizeGoogleAppPassword("abcd efgh ijkl mnop"), "abcdefghijklmnop");
  assert.equal(normalizeGoogleAppPassword("\tabcd\nefgh "), "abcdefgh");
});

test("isolated SMTP runner reuses strict Gmail transport options without connecting", () => {
  const nodemailer = require("nodemailer") as { createTransport: (options: unknown) => unknown };
  const original = nodemailer.createTransport;
  let captured: Record<string, unknown> | undefined;
  nodemailer.createTransport = (options: Record<string, unknown>) => {
    captured = options;
    return { sendMail: async () => undefined };
  };

  try {
    createOfficialSmtpTransport("test-password");
    assert.deepEqual(captured, {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: "labkom@unmuhbabel.ac.id", pass: "test-password" },
      tls: { rejectUnauthorized: true },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      logger: false,
      debug: false,
      transactionLog: false,
    });
  } finally {
    nodemailer.createTransport = original;
  }
});

test("isolated SMTP runner rejects non-TTY password input before network access", async () => {
  await assert.rejects(
    readHiddenPassword({ isTTY: false } as never, { isTTY: false, write: () => true } as never),
    /Interactive TTY required/,
  );
});

test("isolated SMTP runner maps only approved SMTP error codes and response statuses", () => {
  assert.equal(classifySmtpFailure(new Error("ignored"), true), "PASSWORD_INPUT_ERROR");
  assert.equal(classifySmtpFailure({ code: "EAUTH" }), "SMTP_AUTH_FAILED");
  assert.equal(classifySmtpFailure({ responseCode: 535 }), "SMTP_AUTH_FAILED");
  assert.equal(classifySmtpFailure({ code: "ECONNREFUSED" }), "SMTP_CONNECTION_FAILED");
  assert.equal(classifySmtpFailure({ code: "ETIMEDOUT" }), "SMTP_TIMEOUT");
  assert.equal(classifySmtpFailure({ code: "ERR_TLS_CERT_ALTNAME_INVALID" }), "SMTP_TLS_FAILED");
  assert.equal(classifySmtpFailure({ responseCode: 550 }), "SMTP_MESSAGE_REJECTED");
  assert.equal(classifySmtpFailure({ code: "UNRECOGNIZED", responseCode: 299 }), "SMTP_UNKNOWN_ERROR");
});

test("isolated SMTP runner reports safe categories without raw SMTP errors", async () => {
  const out = output();
  const result = await main(
    ["--send-one"],
    {} as never,
    out,
    {
      readPassword: async () => "test-password",
      submit: async () => { throw { code: "EAUTH", message: "private server response" }; },
    },
  );
  assert.equal(result, 1);
  assert.match(out.text(), /SMTP_AUTH_FAILED/);
  assert.doesNotMatch(out.text(), /private|response|password/i);
});
