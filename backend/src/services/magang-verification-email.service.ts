import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { validateMagangEmailDelivery } from "../config";

const QA_FILE_SINK_ROOT = "/mnt/data/tmp/opencode";
const QA_FILE_SINK_DIRECTORY = "/run/user/1000/labkom-qa-mail";
const QA_FILE_SINK_MODE = "qa-file-sink";

type MailKind = "verification" | "approval" | "rejection";

export function createOfficialSmtpTransport(password: string) {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: "labkom@unmuhbabel.ac.id", pass: password },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    logger: false,
    debug: false,
    transactionLog: false,
  });
}

export class VerificationDeliveryError extends Error {
  constructor() {
    super("Pengajuan tersimpan tetapi email verifikasi belum dapat dikirim. Hubungi administrator.");
    this.name = "VerificationDeliveryError";
  }
}

function isWithin(parent: string, child: string): boolean {
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}

async function requireDirectory(directory: string): Promise<void> {
  const details = await lstat(directory);
  if (!details.isDirectory() || details.isSymbolicLink()) {
    throw new Error("QA email sink tidak aman");
  }
}

async function getQaFileSinkDirectory(): Promise<string> {
  if (process.env.MAGANG_EMAIL_DELIVERY !== QA_FILE_SINK_MODE || process.env.NODE_ENV !== "qa") {
    throw new VerificationDeliveryError();
  }

  const configuredDirectory = process.env.MAGANG_EMAIL_SINK_DIR;
  if (!configuredDirectory) throw new VerificationDeliveryError();

  const sinkDirectory = path.resolve(configuredDirectory);
  const qaSinkDirectory = path.resolve(QA_FILE_SINK_DIRECTORY);
  const isDedicatedQaSink = sinkDirectory === qaSinkDirectory;
  const root = isDedicatedQaSink ? qaSinkDirectory : path.resolve(QA_FILE_SINK_ROOT);
  if (!isWithin(root, sinkDirectory) || (!isDedicatedQaSink && sinkDirectory === root)) {
    throw new VerificationDeliveryError();
  }

  try {
    await requireDirectory(root);
    if ((await realpath(root)) !== root) throw new Error("QA email sink root tidak aman");

    let currentDirectory = root;
    for (const segment of path.relative(root, sinkDirectory).split(path.sep).filter(Boolean)) {
      currentDirectory = path.join(currentDirectory, segment);
      await mkdir(currentDirectory, { mode: 0o700 });
      await requireDirectory(currentDirectory);
      await chmod(currentDirectory, 0o700);
    }

    if (!isWithin(root, await realpath(sinkDirectory))) throw new Error("QA email sink keluar dari root");
    await chmod(sinkDirectory, 0o700);
    return sinkDirectory;
  } catch (error) {
    if (error instanceof VerificationDeliveryError) throw error;
    throw new VerificationDeliveryError();
  }
}

export class MagangVerificationEmailService {
  private static escapeHtml(value: string): string {
    return value.replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character] ?? character);
  }

  private static async deliver(kind: MailKind, recipientEmail: string, url: string): Promise<"QA_CAPTURED" | "SENT"> {
    try { validateMagangEmailDelivery(); } catch { throw new VerificationDeliveryError(); }
    const mode = process.env.MAGANG_EMAIL_DELIVERY || "disabled";
    if (mode === "disabled") throw new VerificationDeliveryError();
    if (mode === QA_FILE_SINK_MODE) {
      await this.writeQaMessage(kind, url);
      return "QA_CAPTURED";
    }

    const copy = kind === "verification"
      ? { subject: "Verifikasi Email MAGANG LabKom", text: `Buka tautan verifikasi ini: ${url}`, heading: "Verifikasi Email MAGANG" }
      : kind === "approval"
        ? { subject: "Akun MAGANG LabKom Aktif", text: `Akun MAGANG Anda telah aktif. Login: ${url}`, heading: "Akun MAGANG Aktif" }
        : { subject: "Status Pengajuan MAGANG LabKom", text: `Pengajuan MAGANG Anda tidak dapat disetujui. Informasi umum: ${url}`, heading: "Status Pengajuan MAGANG" };
    const transporter = createOfficialSmtpTransport(process.env.SMTP_PASS || "");
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "",
      to: recipientEmail,
      subject: copy.subject,
      text: copy.text,
      html: `<p>${this.escapeHtml(copy.heading)}</p><p><a href="${this.escapeHtml(url)}">Buka halaman LabKom</a></p>`,
    });
    return "SENT";
  }

  private static async writeQaMessage(kind: MailKind, url: string): Promise<void> {
    const sinkDirectory = await getQaFileSinkDirectory();
    const prefix = kind === "verification" ? "magang-verification" : kind === "approval" ? "magang-approval" : "magang-rejection";
    const filename = `${prefix}-${randomUUID()}.txt`;
    const filePath = path.resolve(sinkDirectory, filename);
    if (!isWithin(sinkDirectory, filePath) || filePath === sinkDirectory) throw new VerificationDeliveryError();
    const message = kind === "verification"
      ? `Verifikasi Email MAGANG LabKom\n\nBuka tautan verifikasi:\n${url}\n\nTautan berlaku 24 jam.\n`
      : kind === "approval"
        ? `Akun MAGANG LabKom Aktif\n\nAkun MAGANG Anda telah aktif. Login:\n${url}\n`
        : `Status Pengajuan MAGANG LabKom\n\nPengajuan Anda tidak dapat disetujui. Informasi umum:\n${url}\n`;
    try {
      const file = await open(filePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await file.writeFile(message, { encoding: "utf8" }); await file.chmod(0o600); } finally { await file.close(); }
    } catch { throw new VerificationDeliveryError(); }
  }

  static async sendVerification(email: string, verificationUrl: string): Promise<void> {
    await this.deliver("verification", email, verificationUrl);
  }

  static async sendApprovalNotification(email: string, loginUrl: string): Promise<"QA_CAPTURED" | "SENT"> {
    return this.deliver("approval", email, loginUrl);
  }

  static async sendRejectionNotification(email: string, informationUrl: string): Promise<"QA_CAPTURED" | "SENT"> {
    return this.deliver("rejection", email, informationUrl);
  }
}
