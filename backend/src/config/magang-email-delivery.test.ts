import assert from "node:assert/strict";
import test from "node:test";
import { validateMagangEmailDelivery } from "./index";

const SMTP = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "465",
  SMTP_SECURE: "true",
  SMTP_USER: "labkom@unmuhbabel.ac.id",
  SMTP_FROM: "LabKom <labkom@unmuhbabel.ac.id>",
  SMTP_PASS: "test-only-private-value",
};

function withEnvironment(values: Record<string, string | undefined>, run: () => void): void {
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("MAGANG email delivery validates fail-closed modes without exposing SMTP password", () => {
  withEnvironment({ NODE_ENV: "qa", MAGANG_EMAIL_DELIVERY: "smtp", ...SMTP }, () => {
    assert.throws(validateMagangEmailDelivery, /SMTP dilarang pada QA/);
  });
  withEnvironment({ NODE_ENV: "production", MAGANG_EMAIL_DELIVERY: "qa-file-sink" }, () => {
    assert.throws(validateMagangEmailDelivery, /QA email sink dilarang/);
  });
  withEnvironment({ NODE_ENV: "production", MAGANG_EMAIL_DELIVERY: "smtp", ...SMTP, SMTP_PASS: undefined }, () => {
    assert.throws(validateMagangEmailDelivery, /SMTP LabKom tidak lengkap atau tidak valid/);
  });
  withEnvironment({ NODE_ENV: "production", MAGANG_EMAIL_DELIVERY: "smtp", ...SMTP, SMTP_SECURE: "false" }, () => {
    assert.throws(validateMagangEmailDelivery, /SMTP LabKom tidak lengkap atau tidak valid/);
  });
  withEnvironment({ NODE_ENV: "production", MAGANG_EMAIL_DELIVERY: "smtp", ...SMTP }, () => {
    assert.doesNotThrow(validateMagangEmailDelivery);
  });
});
