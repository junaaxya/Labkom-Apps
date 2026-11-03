import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildHtmlEmail,
  buildPlainTextEmail,
  escapeHtml,
  getResolvedLogoUrl,
  DEFAULT_LABKOM_LOGO_PATH,
} from './email-templates';
import { MagangVerificationEmailService } from './magang-verification-email.service';

test('escapeHtml sanitizes untrusted input', () => {
  assert.equal(
    escapeHtml('<script>alert("xss")</script> & "quotes"'),
    '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;'
  );
});

test('MagangVerificationEmailService.getEmailContent verification generates branded email', () => {
  const content = MagangVerificationEmailService.getEmailContent(
    'verification',
    'budi@example.com',
    'https://lab-ilkom.my.id/auth/verify?token=abc-123',
    'Budi Raharjo'
  );

  assert.match(content.subject, /Verifikasi Email Pendaftaran MAGANG/);
  assert.match(content.html, /LabKom/);
  assert.match(content.html, /Universitas Muhammadiyah Bangka Belitung/);
  assert.match(content.html, /Halo <strong>Budi Raharjo<\/strong>/);
  assert.match(content.html, /https:\/\/lab-ilkom\.my\.id\/auth\/verify\?token=abc-123/);
  assert.match(content.html, /24 Jam/);
  assert.match(content.text, /Budi Raharjo/);
  assert.match(content.text, /https:\/\/lab-ilkom\.my\.id\/auth\/verify\?token=abc-123/);
});

test('MagangVerificationEmailService.getEmailContent approval contains active status and login CTA', () => {
  const content = MagangVerificationEmailService.getEmailContent(
    'approval',
    'siti@example.com',
    'https://lab-ilkom.my.id/login',
    'Siti Aisyah'
  );

  assert.match(content.subject, /Selamat! Akun MAGANG LabKom Anda Telah Disetujui/);
  assert.match(content.html, /Aktif &amp; Siap Digunakan/);
  assert.match(content.html, /Halo <strong>Siti Aisyah<\/strong>/);
  assert.match(content.html, /Masuk ke Dashboard LabKom/);
  assert.match(content.html, /https:\/\/lab-ilkom\.my\.id\/login/);
  assert.doesNotMatch(content.html, /password/i);
});

test('MagangVerificationEmailService.getEmailContent rejection contains explanation and contact info', () => {
  const content = MagangVerificationEmailService.getEmailContent(
    'rejection',
    'joko@example.com',
    'https://lab-ilkom.my.id/info-magang',
    'Joko Anwar'
  );

  assert.match(content.subject, /Pemberitahuan Status Pengajuan MAGANG LabKom/);
  assert.match(content.html, /Halo <strong>Joko Anwar<\/strong>/);
  assert.match(content.html, /belum dapat disetujui/i);
  assert.match(content.html, /https:\/\/lab-ilkom\.my\.id\/info-magang/);
  assert.match(content.html, /labkom@unmuhbabel\.ac\.id/);
});

test('buildPlainTextEmail generates cleanly formatted plain text fallback', () => {
  const plainText = buildPlainTextEmail({
    preheader: 'Preheader text',
    badgeText: 'Status',
    heading: 'Verifikasi Email Pendaftaran',
    recipientName: 'Andi',
    introParagraph: 'Terima kasih telah mendaftar.',
    bodyParagraphs: ['Silakan klik link berikut.'],
    action: {
      label: 'Verifikasi Email',
      url: 'https://lab-ilkom.my.id/verify',
    },
    infoItems: [{ label: 'Batas Waktu', value: '24 Jam' }],
    actionNote: 'Jangan bagikan link ini.',
  });

  assert.match(plainText, /LabKom - Universitas Muhammadiyah Bangka Belitung/);
  assert.match(plainText, /Halo Andi,/);
  assert.match(plainText, /Terima kasih telah mendaftar\./);
  assert.match(plainText, /Batas Waktu: 24 Jam/);
  assert.match(plainText, /https:\/\/lab-ilkom\.my\.id\/verify/);
  assert.match(plainText, /Catatan: Jangan bagikan link ini\./);
});

test('buildHtmlEmail incorporates table structure, styling, and safe fallbacks', () => {
  const html = buildHtmlEmail({
    preheader: 'Pratinjau email penting',
    badgeText: 'Pemberitahuan',
    badgeColor: '#1d4ed8',
    badgeBg: '#eff6ff',
    heading: 'Uji Render HTML Email',
    recipientName: '<BadActor>',
    introParagraph: 'Ini adalah paragraf intro pengujian.',
    infoItems: [
      { label: 'Kategori', value: 'Pengujian', badge: 'info' },
      { label: 'Status', value: 'Berhasil', badge: 'success' },
      { label: 'Peringatan', value: 'Perhatian', badge: 'warning' },
      { label: 'Gagal', value: 'Batal', badge: 'danger' },
    ],
    action: {
      label: 'Tombol Aksi Utama',
      url: 'https://lab-ilkom.my.id/action',
    },
    actionNote: 'Catatan tambahan tombol.',
    secondaryNote: 'Peringatan keamanan tambahan.',
  });

  assert.match(html, /&lt;BadActor&gt;/);
  assert.doesNotMatch(html, /<BadActor>/);
  assert.match(html, /border-bottom: 3px solid #f3701e/);
  assert.match(html, /Tombol Aksi Utama/);
  assert.match(html, /https:\/\/lab-ilkom\.my\.id\/action/);
  assert.match(html, /<img src="https:\/\/lab-ilkom\.my\.id\/icons\/labkom-app-icon-192\.png"/);
  assert.match(html, /alt="Logo LabKom"/);
  assert.match(html, /width="38"/);
  assert.match(html, /height="38"/);
  assert.doesNotMatch(html, />\s*LK\s*<\/div>/);
});

test('getResolvedLogoUrl uses custom logoUrl when provided or falls back to APP_URL', () => {
  assert.equal(
    getResolvedLogoUrl('https://custom.example.com/logo.png'),
    'https://custom.example.com/logo.png'
  );

  const originalAppUrl = process.env.APP_URL;
  try {
    process.env.APP_URL = 'https://portal.unmuhbabel.ac.id/';
    assert.equal(
      getResolvedLogoUrl(),
      `https://portal.unmuhbabel.ac.id${DEFAULT_LABKOM_LOGO_PATH}`
    );
  } finally {
    process.env.APP_URL = originalAppUrl;
  }
});
