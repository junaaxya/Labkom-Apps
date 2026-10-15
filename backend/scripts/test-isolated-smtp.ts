import { Readable, Writable } from "node:stream";
import { createOfficialSmtpTransport } from "../src/services/magang-verification-email.service";

const RECIPIENT = "muismlbb2@gmail.com";
const SUBJECT = "[LabKom Test] Verifikasi Pengiriman SMTP Terkendali";

type Transport = {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<unknown>;
};

type PasswordInput = Pick<Readable, "isTTY" | "setRawMode" | "resume" | "pause" | "on" | "removeListener">;
type PasswordOutput = Pick<Writable, "isTTY" | "write">;
export type SmtpFailureCategory =
  | "PASSWORD_INPUT_ERROR"
  | "SMTP_AUTH_FAILED"
  | "SMTP_CONNECTION_FAILED"
  | "SMTP_TIMEOUT"
  | "SMTP_TLS_FAILED"
  | "SMTP_MESSAGE_REJECTED"
  | "SMTP_UNKNOWN_ERROR";

type SmtpError = { code?: unknown; responseCode?: unknown };

const CONNECTION_CODES = new Set(["ECONNECTION", "ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH", "ENETUNREACH"]);
const TIMEOUT_CODES = new Set(["ETIMEDOUT", "ESOCKETTIMEDOUT"]);
const TLS_CODES = new Set([
  "ESOCKET",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
]);

export function classifySmtpFailure(error: unknown, passwordInputFailed = false): SmtpFailureCategory {
  if (passwordInputFailed) return "PASSWORD_INPUT_ERROR";
  if (!error || typeof error !== "object") return "SMTP_UNKNOWN_ERROR";

  const { code, responseCode } = error as SmtpError;
  if (code === "EAUTH" || responseCode === 535) return "SMTP_AUTH_FAILED";
  if (typeof code === "string" && TIMEOUT_CODES.has(code)) return "SMTP_TIMEOUT";
  if (typeof code === "string" && TLS_CODES.has(code)) return "SMTP_TLS_FAILED";
  if (typeof code === "string" && CONNECTION_CODES.has(code)) return "SMTP_CONNECTION_FAILED";
  if (typeof responseCode === "number" && responseCode >= 400 && responseCode <= 599) {
    return "SMTP_MESSAGE_REJECTED";
  }
  return "SMTP_UNKNOWN_ERROR";
}

export const SMTP_TEST_MESSAGE = {
  from: "LabKom <labkom@unmuhbabel.ac.id>",
  to: RECIPIENT,
  subject: SUBJECT,
  text: "Halo Tim LabKom,\n\nIni adalah pesan pengujian koneksi SMTP terisolasi dari sistem LabKom. Pesan ini tidak memuat kredensial, token akun, atau data pengguna.\n\nDelivery Target: operator-controlled test mailbox\n",
} as const;

export function printUsage(output: Pick<Writable, "write">): void {
  output.write("Usage: npx tsx scripts/test-isolated-smtp.ts --send-one\n");
  output.write("Requires an interactive TTY. App Password is prompted privately and never read from arguments or environment.\n");
}

export function readHiddenPassword(input: PasswordInput, output: PasswordOutput): Promise<string> {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(new Error("Interactive TTY required for private password input"));
  }

  output.write("Google App Password: ");
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let password = "";
    const finish = (error?: Error) => {
      input.removeListener("data", onData);
      input.setRawMode?.(false);
      input.pause();
      output.write("\n");
      if (error) reject(error);
      else resolve(password);
    };
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) return finish(new Error("Password input cancelled"));
        if (byte === 13 || byte === 10) return finish();
        if (byte === 127 || byte === 8) password = password.slice(0, -1);
        else if (byte >= 32 && byte <= 126) password += String.fromCharCode(byte);
      }
    };
    input.on("data", onData);
  });
}

export function normalizeGoogleAppPassword(value: string): string {
  return value.replace(/\s+/g, "");
}

export async function sendOne(
  password: string,
  createTransport: (password: string) => Transport = createOfficialSmtpTransport,
): Promise<void> {
  const normalizedPassword = normalizeGoogleAppPassword(password);
  if (!normalizedPassword) throw new Error("Password input was empty");
  const transporter: Transport = createTransport(normalizedPassword);
  await transporter.sendMail(SMTP_TEST_MESSAGE);
}

export async function main(
  args: readonly string[],
  input: PasswordInput,
  output: PasswordOutput,
  dependencies = { readPassword: readHiddenPassword, submit: sendOne },
): Promise<number> {
  if (args.length !== 1 || args[0] !== "--send-one") {
    printUsage(output);
    return 0;
  }

  let password: string;
  try {
    password = await dependencies.readPassword(input, output);
  } catch (error) {
    output.write(`SMTP test was not completed: ${classifySmtpFailure(error, true)}\n`);
    return 1;
  }

  try {
    await dependencies.submit(password);
    output.write("SMTP accepted one synthetic LabKom test message. Confirm inbox delivery separately.\n");
    return 0;
  } catch (error) {
    output.write(`SMTP test was not completed: ${classifySmtpFailure(error)}\n`);
    return 1;
  }
}

if (require.main === module) {
  void main(process.argv.slice(2), process.stdin, process.stdout).then((code) => {
    process.exitCode = code;
  });
}
