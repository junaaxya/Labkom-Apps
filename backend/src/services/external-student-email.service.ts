import { createOfficialSmtpTransport, VerificationDeliveryError } from "./magang-verification-email.service";
import { validateMagangEmailDelivery } from "../config";
import { buildHtmlEmail, buildPlainTextEmail, type EmailTemplateOptions } from "./email-templates";

export class ExternalStudentEmailService {
  static async sendVerification(email: string, verificationUrl: string, name: string): Promise<void> {
    try { validateMagangEmailDelivery(); } catch { throw new VerificationDeliveryError(); }
    if (process.env.MAGANG_EMAIL_DELIVERY !== "smtp" || !process.env.SMTP_PASS) throw new VerificationDeliveryError();
    const options: EmailTemplateOptions = {
      preheader: "Verifikasi email untuk mengaktifkan akun mahasiswa LabKom.",
      badgeText: "Verifikasi Akun",
      badgeColor: "#1d4ed8",
      badgeBg: "#eff6ff",
      heading: "Aktifkan Akun Mahasiswa LabKom",
      recipientName: name,
      introParagraph: "Pendaftaran akun mahasiswa Anda sudah diterima. Klik tombol berikut untuk memverifikasi email dan membuat password akun.",
      bodyParagraphs: ["Tautan ini hanya dapat digunakan satu kali dan berlaku selama 24 jam."],
      infoItems: [
        { label: "Peran", value: "Mahasiswa", badge: "info" },
        { label: "Status", value: "Menunggu verifikasi email", badge: "warning" },
      ],
      action: { label: "Verifikasi dan Buat Password", url: verificationUrl },
      actionNote: "Jika Anda tidak merasa mendaftar, abaikan email ini.",
    };
    const transporter = createOfficialSmtpTransport(process.env.SMTP_PASS);
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "LabKom <labkom@unmuhbabel.ac.id>",
      to: email,
      subject: "Verifikasi Akun Mahasiswa LabKom",
      text: buildPlainTextEmail(options),
      html: buildHtmlEmail(options),
    }).catch(() => { throw new VerificationDeliveryError(); });
  }
}
