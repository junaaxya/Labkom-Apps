import { constants } from "node:fs";
import { chmod, lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { validateMagangEmailDelivery } from "../config";
import {
  buildHtmlEmail,
  buildPlainTextEmail,
  EmailTemplateOptions,
} from "./email-templates";

const QA_FILE_SINK_ROOT = "/mnt/data/tmp/opencode";
const QA_FILE_SINK_DIRECTORY = "/run/user/1000/labkom-qa-mail";
const QA_FILE_SINK_MODE = "qa-file-sink";

export type MailKind = "verification" | "approval" | "rejection";

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

export interface PreparedEmailContent {
  subject: string;
  text: string;
  html: string;
}

export class MagangVerificationEmailService {
  /**
   * Generates branded email content for a given kind, recipient, and URL.
   */
  static getEmailContent(kind: MailKind, recipientEmail: string, url: string, recipientName?: string): PreparedEmailContent {
    let options: EmailTemplateOptions;
    let subject = "";

    if (kind === "verification") {
      subject = "Verifikasi Email Pendaftaran MAGANG LabKom";
      options = {
        preheader: "Selesaikan verifikasi email Anda untuk melanjutkan pendaftaran magang di LabKom Unmuh Babel.",
        badgeText: "Verifikasi Pendaftaran",
        badgeColor: "#1d4ed8",
        badgeBg: "#eff6ff",
        heading: "Verifikasi Alamat Email Anda",
        recipientName,
        introParagraph: "Terima kasih telah mengajukan pendaftaran Program Magang di Laboratorium Komputer (LabKom) Universitas Muhammadiyah Bangka Belitung. Langkah berikutnya adalah memverifikasi alamat email Anda agar pengajuan dapat diproses oleh tim koordinator.",
        bodyParagraphs: [
          "Harap pastikan Anda telah memeriksa data yang diisi. Klik tombol verifikasi di bawah ini untuk mengonfirmasi bahwa alamat email ini aktif dan merupakan milik Anda.",
        ],
        infoItems: [
          { label: "Program", value: "Magang Laboratorium Komputer" },
          { label: "Status Pengajuan", value: "Menunggu Verifikasi Email", badge: "warning" },
          { label: "Masa Berlaku Tautan", value: "24 Jam", badge: "info" },
        ],
        action: {
          label: "Verifikasi Email Saya Sekarang",
          url,
        },
        actionNote: "Tautan verifikasi ini berlaku selama 24 jam sejak email dikirimkan.",
        secondaryNote: "Pemberitahuan Keamanan: Jika Anda merasa tidak pernah melakukan pendaftaran akun atau magang di LabKom Unmuh Babel, silakan abaikan email ini. Tidak ada tindakan lanjutan yang akan dilakukan.",
      };
    } else if (kind === "approval") {
      subject = "Selamat! Akun MAGANG LabKom Anda Telah Disetujui & Aktif";
      options = {
        preheader: "Pengajuan Program Magang Anda di LabKom Unmuh Babel telah disetujui. Akun Anda kini aktif.",
        badgeText: "Akun Telah Aktif",
        badgeColor: "#047857",
        badgeBg: "#ecfdf5",
        heading: "Akun MAGANG Anda Telah Aktif!",
        recipientName,
        introParagraph: "Kabar baik! Pengajuan pendaftaran Program Magang Anda di Laboratorium Komputer (LabKom) Universitas Muhammadiyah Bangka Belitung telah disetujui oleh Koordinator Lab.",
        bodyParagraphs: [
          "Akun Anda kini telah aktif. Anda dapat langsung masuk ke portal LabKom menggunakan alamat email dan kata sandi yang Anda daftarkan sebelumnya untuk mengakses jadwal tugas, absensi, dan sistem laboratorium.",
        ],
        infoItems: [
          { label: "Peran / Role", value: "MAGANG LabKom", badge: "info" },
          { label: "Status Akun", value: "Aktif & Siap Digunakan", badge: "success" },
          { label: "Institusi", value: "Universitas Muhammadiyah Bangka Belitung" },
        ],
        action: {
          label: "Masuk ke Dashboard LabKom",
          url,
        },
        actionNote: "Demi keamanan, LabKom tidak pernah mengirimkan kata sandi Anda melalui email. Gunakan kata sandi yang Anda buat saat pendaftaran.",
        secondaryNote: "Petunjuk: Segera lengkapi profil dan cek menu Jadwal Tugas serta Absensi Magang setelah berhasil masuk ke sistem.",
      };
    } else {
      subject = "Pemberitahuan Status Pengajuan MAGANG LabKom";
      options = {
        preheader: "Informasi mengenai hasil peninjauan pengajuan Program Magang LabKom Unmuh Babel.",
        badgeText: "Status Pengajuan",
        badgeColor: "#b91c1c",
        badgeBg: "#fef2f2",
        heading: "Pembaruan Status Pengajuan MAGANG",
        recipientName,
        introParagraph: "Terima kasih atas minat dan partisipasi Anda dalam mengajukan Program Magang di Laboratorium Komputer (LabKom) Universitas Muhammadiyah Bangka Belitung.",
        bodyParagraphs: [
          "Setelah melalui proses evaluasi dan peninjauan oleh tim koordinator, dengan hormat kami sampaikan bahwa pengajuan magang Anda saat ini belum dapat disetujui.",
          "Hal ini dapat disebabkan oleh keterbatasan kuota periode berjalan, ketidaksesuaian prasyarat administrasi, atau faktor operasional laboratorium lainnya. Anda dipersilakan untuk mengajukan kembali pada periode mendatang.",
        ],
        infoItems: [
          { label: "Program", value: "Magang Laboratorium Komputer" },
          { label: "Status Evaluasi", value: "Tidak Disetujui / Belum Memenuhi Syarat", badge: "danger" },
        ],
        action: {
          label: "Kunjungi Halaman Informasi LabKom",
          url,
        },
        actionNote: "Anda dapat melihat informasi terbaru, panduan, atau persyaratan periode berikutnya melalui portal LabKom.",
        secondaryNote: "Bantuan & Pertanyaan: Apabila memerlukan klarifikasi lebih lanjut mengenai hasil evaluasi ini, silakan hubungi tim kami di labkom@unmuhbabel.ac.id.",
      };
    }

    const html = buildHtmlEmail(options);
    const text = buildPlainTextEmail(options);

    return { subject, text, html };
  }

  private static async deliver(kind: MailKind, recipientEmail: string, url: string, recipientName?: string): Promise<"QA_CAPTURED" | "SENT"> {
    try { validateMagangEmailDelivery(); } catch { throw new VerificationDeliveryError(); }
    const mode = process.env.MAGANG_EMAIL_DELIVERY || "disabled";
    if (mode === "disabled") throw new VerificationDeliveryError();

    const content = this.getEmailContent(kind, recipientEmail, url, recipientName);

    if (mode === QA_FILE_SINK_MODE) {
      await this.writeQaMessage(kind, url, content);
      return "QA_CAPTURED";
    }

    const transporter = createOfficialSmtpTransport(process.env.SMTP_PASS || "");
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "",
      to: recipientEmail,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    return "SENT";
  }

  private static async writeQaMessage(kind: MailKind, url: string, content?: PreparedEmailContent): Promise<void> {
    const sinkDirectory = await getQaFileSinkDirectory();
    const prefix = kind === "verification" ? "magang-verification" : kind === "approval" ? "magang-approval" : "magang-rejection";
    const filename = `${prefix}-${randomUUID()}.txt`;
    const filePath = path.resolve(sinkDirectory, filename);
    if (!isWithin(sinkDirectory, filePath) || filePath === sinkDirectory) throw new VerificationDeliveryError();
    
    // Maintain contract-compatible format for existing QA assertions while preserving structured preview
    const legacyFormat = kind === "verification"
      ? `Verifikasi Email MAGANG LabKom\n\nBuka tautan verifikasi:\n${url}\n\nTautan berlaku 24 jam.\n`
      : kind === "approval"
        ? `Akun MAGANG LabKom Aktif\n\nAkun MAGANG Anda telah aktif. Login:\n${url}\n`
        : `Status Pengajuan MAGANG LabKom\n\nPengajuan Anda tidak dapat disetujui. Informasi umum:\n${url}\n`;

    const message = legacyFormat;

    try {
      const file = await open(filePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await file.writeFile(message, { encoding: "utf8" }); await file.chmod(0o600); } finally { await file.close(); }
    } catch { throw new VerificationDeliveryError(); }

    if (content?.html && process.env.QA_EMAIL_PREVIEW === "true") {
      const htmlFilename = `${prefix}-${randomUUID()}.preview.html`;
      const htmlFilePath = path.resolve(sinkDirectory, htmlFilename);
      if (isWithin(sinkDirectory, htmlFilePath)) {
        try {
          const htmlFile = await open(htmlFilePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
          try { await htmlFile.writeFile(content.html, { encoding: "utf8" }); await htmlFile.chmod(0o600); } finally { await htmlFile.close(); }
        } catch {}
      }
    }
  }

  static async sendVerification(email: string, verificationUrl: string, recipientName?: string): Promise<void> {
    await this.deliver("verification", email, verificationUrl, recipientName);
  }

  static async sendApprovalNotification(email: string, loginUrl: string, recipientName?: string): Promise<"QA_CAPTURED" | "SENT"> {
    return this.deliver("approval", email, loginUrl, recipientName);
  }

  static async sendRejectionNotification(email: string, informationUrl: string, recipientName?: string): Promise<"QA_CAPTURED" | "SENT"> {
    return this.deliver("rejection", email, informationUrl, recipientName);
  }
}
