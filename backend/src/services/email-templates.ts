/**
 * LabKom Email Template Builder
 * Universitas Muhammadiyah Bangka Belitung
 *
 * Designed for maximum compatibility with Gmail (Desktop, Android, iOS),
 * Apple Mail, Outlook, and webmail clients.
 * Uses HTML table layout, inline CSS, navy/white/blue palette, responsive viewport,
 * and strict HTML escaping.
 */

export interface EmailAction {
  label: string;
  url: string;
}

export interface EmailInfoItem {
  label: string;
  value: string;
  badge?: "info" | "success" | "warning" | "danger";
}

export interface EmailTemplateOptions {
  preheader: string;
  badgeText: string;
  badgeColor?: string; // hex
  badgeBg?: string; // hex
  heading: string;
  recipientName?: string;
  introParagraph: string;
  bodyParagraphs?: string[];
  infoItems?: EmailInfoItem[];
  action?: EmailAction;
  actionNote?: string;
  secondaryNote?: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char] ?? char);
}

/**
 * Builds standard plain-text fallback for email clients without HTML support.
 */
export function buildPlainTextEmail(options: EmailTemplateOptions): string {
  const greeting = options.recipientName ? `Halo ${options.recipientName},` : "Halo Rekan LabKom,";
  const lines: string[] = [];

  lines.push("==================================================");
  lines.push("LabKom - Universitas Muhammadiyah Bangka Belitung");
  lines.push("Sistem Manajemen Laboratorium Komputer Terpadu");
  lines.push("==================================================");
  lines.push("");
  lines.push(options.heading.toUpperCase());
  lines.push("");
  lines.push(greeting);
  lines.push("");
  lines.push(options.introParagraph);
  lines.push("");

  if (options.bodyParagraphs && options.bodyParagraphs.length > 0) {
    for (const paragraph of options.bodyParagraphs) {
      lines.push(paragraph);
      lines.push("");
    }
  }

  if (options.infoItems && options.infoItems.length > 0) {
    lines.push("--------------------------------------------------");
    for (const item of options.infoItems) {
      lines.push(`• ${item.label}: ${item.value}`);
    }
    lines.push("--------------------------------------------------");
    lines.push("");
  }

  if (options.action) {
    lines.push(`Silakan buka tautan berikut untuk melanjutkan:`);
    lines.push(options.action.url);
    lines.push("");
  }

  if (options.actionNote) {
    lines.push(`Catatan: ${options.actionNote}`);
    lines.push("");
  }

  if (options.secondaryNote) {
    lines.push(options.secondaryNote);
    lines.push("");
  }

  lines.push("--------------------------------------------------");
  lines.push("Email ini dikirim secara otomatis oleh Sistem LabKom.");
  lines.push("Universitas Muhammadiyah Bangka Belitung");
  lines.push("Jl. KH. Ahmad Dahlan, Pangkalpinang, Kepulauan Bangka Belitung");
  lines.push("Website: https://lab-ilkom.my.id | Email: labkom@unmuhbabel.ac.id");
  lines.push("--------------------------------------------------");

  return lines.join("\n");
}

/**
 * Builds responsive, Gmail-compatible branded HTML email template.
 */
export function buildHtmlEmail(options: EmailTemplateOptions): string {
  const safePreheader = escapeHtml(options.preheader);
  const safeBadge = escapeHtml(options.badgeText);
  const safeHeading = escapeHtml(options.heading);
  const safeGreeting = options.recipientName ? `Halo <strong>${escapeHtml(options.recipientName)}</strong>,` : "Halo <strong>Rekan LabKom</strong>,";
  const safeIntro = escapeHtml(options.introParagraph);
  const badgeColor = options.badgeColor || "#1e40af";
  const badgeBg = options.badgeBg || "#eff6ff";

  // Build Info Items table if present
  let infoTableHtml = "";
  if (options.infoItems && options.infoItems.length > 0) {
    const rows = options.infoItems.map((item) => {
      let badgeStyle = "font-weight: 600; color: #0f172a;";
      if (item.badge === "success") {
        badgeStyle = "display: inline-block; background-color: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 4px; border: 1px solid #a7f3d0;";
      } else if (item.badge === "warning") {
        badgeStyle = "display: inline-block; background-color: #fffbeb; color: #92400e; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 4px; border: 1px solid #fde68a;";
      } else if (item.badge === "danger") {
        badgeStyle = "display: inline-block; background-color: #fef2f2; color: #991b1b; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 4px; border: 1px solid #fecaca;";
      } else if (item.badge === "info") {
        badgeStyle = "display: inline-block; background-color: #eff6ff; color: #1e40af; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 4px; border: 1px solid #bfdbfe;";
      }

      return `
        <tr>
          <td style="padding: 10px 14px; font-size: 13px; color: #64748b; font-weight: 500; border-bottom: 1px solid #f1f5f9; width: 38%; vertical-align: top;">
            ${escapeHtml(item.label)}
          </td>
          <td style="padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; vertical-align: top;">
            <span style="${badgeStyle}">${escapeHtml(item.value)}</span>
          </td>
        </tr>
      `;
    }).join("");

    infoTableHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; margin-top: 18px; margin-bottom: 22px;">
        ${rows}
      </table>
    `;
  }

  // Build Body Paragraphs
  let bodyParagraphsHtml = "";
  if (options.bodyParagraphs && options.bodyParagraphs.length > 0) {
    bodyParagraphsHtml = options.bodyParagraphs.map((p) => {
      return `<p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: #334155;">${escapeHtml(p)}</p>`;
    }).join("");
  }

  // Build Action Button
  let actionHtml = "";
  if (options.action) {
    const safeUrl = escapeHtml(options.action.url);
    const safeLabel = escapeHtml(options.action.label);
    const safeActionNote = options.actionNote
      ? `<p style="margin: 12px 0 0 0; font-size: 12px; line-height: 1.5; color: #64748b; text-align: center;">${escapeHtml(options.actionNote)}</p>`
      : "";

    actionHtml = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 24px; margin-bottom: 20px;">
        <tr>
          <td align="center">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeUrl}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="12%" stroke="f" fillcolor="#1e3a8a">
              <w:anchorlock/>
              <center style="color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;">${safeLabel}</center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); background-color: #1e3a8a; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); text-align: center; border: 1px solid #1d4ed8; letter-spacing: 0.3px;">
              ${safeLabel}
            </a>
            <!--<![endif]-->
            ${safeActionNote}
          </td>
        </tr>
      </table>
      <div style="background-color: #f1f5f9; border-radius: 6px; padding: 12px 14px; margin-top: 14px; margin-bottom: 20px;">
        <p style="margin: 0 0 4px 0; font-size: 11px; color: #64748b; font-weight: 600;">Jika tombol di atas tidak berfungsi, salin dan buka tautan berikut di browser Anda:</p>
        <p style="margin: 0; font-size: 11px; color: #2563eb; word-break: break-all; font-family: Consolas, monospace;">${safeUrl}</p>
      </div>
    `;
  }

  // Build secondary note
  let secondaryNoteHtml = "";
  if (options.secondaryNote) {
    secondaryNoteHtml = `
      <div style="border-left: 3px solid #3b82f6; padding: 10px 14px; background-color: #f0fdf4; border-radius: 0 6px 6px 0; margin-top: 18px; margin-bottom: 18px;">
        <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #166534;">
          ${escapeHtml(options.secondaryNote)}
        </p>
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
  <title>${safeHeading}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: #f1f5f9;
    }
    table, td {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content-padding {
        padding: 24px 18px !important;
      }
      .header-padding {
        padding: 24px 18px !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preheader text for inbox preview -->
  <div style="display: none; font-size: 1px; color: #f1f5f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${safePreheader} &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; width: 100%;">
    <tr>
      <td align="center" style="padding: 28px 12px;">
        <!-- Email Card Wrapper -->
        <table role="presentation" class="email-container" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; width: 100%; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- BRAND HEADER -->
          <tr>
            <td class="header-padding" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 60%, #1d4ed8 100%); background-color: #0f172a; padding: 32px 32px 28px 32px; text-align: left; border-bottom: 3px solid #f3701e;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Institution Title & Lab Brand -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="padding-right: 12px; vertical-align: middle;">
                          <div style="width: 40px; height: 40px; background-color: #ffffff; border-radius: 8px; text-align: center; line-height: 40px; font-weight: 900; font-size: 20px; color: #0f172a; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                            LK
                          </div>
                        </td>
                        <td style="vertical-align: middle;">
                          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">LabKom</h1>
                          <p style="margin: 2px 0 0 0; font-size: 11px; font-weight: 500; color: #cbd5e1; letter-spacing: 0.5px; text-transform: uppercase;">Universitas Muhammadiyah Bangka Belitung</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- MAIN BODY CONTENT -->
          <tr>
            <td class="content-padding" style="padding: 36px 32px 28px 32px;">
              <!-- Status Badge -->
              <div style="margin-bottom: 16px;">
                <span style="display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.6px; border: 1px solid ${badgeColor}33;">
                  ${safeBadge}
                </span>
              </div>

              <!-- Main Heading -->
              <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 800; color: #0f172a; line-height: 1.35; letter-spacing: -0.2px;">
                ${safeHeading}
              </h2>

              <!-- Greeting -->
              <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #1e293b;">
                ${safeGreeting}
              </p>

              <!-- Intro Paragraph -->
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                ${safeIntro}
              </p>

              <!-- Body Paragraphs -->
              ${bodyParagraphsHtml}

              <!-- Info Table -->
              ${infoTableHtml}

              <!-- Action Button & Note -->
              ${actionHtml}

              <!-- Secondary Note / Alert -->
              ${secondaryNoteHtml}

              <!-- Sign-off -->
              <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9;">
                <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #475569;">
                  Hormat kami,<br>
                  <strong style="color: #0f172a;">Pengelola Laboratorium Komputer</strong><br>
                  <span style="font-size: 12px; color: #64748b;">Fakultas Teknik &amp; Sains - Universitas Muhammadiyah Bangka Belitung</span>
                </p>
              </div>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #64748b; font-weight: 500;">
                Sistem Manajemen Laboratorium Komputer (LabKom) Terpadu
              </p>
              <p style="margin: 0 0 10px 0; font-size: 11px; color: #94a3b8; line-height: 1.5;">
                Universitas Muhammadiyah Bangka Belitung<br>
                Jl. KH. Ahmad Dahlan, Pangkalpinang, Kepulauan Bangka Belitung
              </p>
              <p style="margin: 0 0 12px 0; font-size: 11px; color: #94a3b8;">
                Hubungi kami: <a href="mailto:labkom@unmuhbabel.ac.id" style="color: #2563eb; text-decoration: none;">labkom@unmuhbabel.ac.id</a> | 
                <a href="https://lab-ilkom.my.id" style="color: #2563eb; text-decoration: none;">https://lab-ilkom.my.id</a>
              </p>
              <p style="margin: 0; font-size: 10px; color: #cbd5e1; line-height: 1.4;">
                Email ini dibuat secara otomatis oleh sistem. Anda menerima email ini karena mendaftar pada program magang atau memiliki akun di LabKom Unmuh Babel. Mohon untuk tidak membalas email ini secara langsung.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
