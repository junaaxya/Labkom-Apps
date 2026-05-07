import prisma from "../config/database";
import { config } from "../config";

interface FAQEntry {
  keywords: string[];
  question: string;
  answer: string;
  category: string;
}

const FAQ_DATABASE: FAQEntry[] = [
  {
    category: "Operasional",
    keywords: ["jam buka", "buka jam", "jam operasional", "jam lab", "buka kapan", "tutup jam"],
    question: "Jam operasional lab?",
    answer: "Lab buka:\n• Senin - Jumat: 07:30 - 21:00\n• Sabtu: 08:00 - 17:00\n• Minggu & Libur: Tutup\n\nDi luar jam tersebut, lab hanya bisa diakses dengan izin Koordinator Lab.",
  },
  {
    category: "Kunci",
    keywords: ["pinjam kunci", "ambil kunci", "cara pinjam", "kunci lab", "buka lab"],
    question: "Bagaimana cara pinjam kunci lab?",
    answer: "Cara pinjam kunci:\n1. Hanya Ketua Kelas atau Asisten Lab yang bisa meminjam\n2. Buka aplikasi Labkom → menu Kunci\n3. Scan QR code di loker kunci\n4. Kunci tercatat otomatis di sistem\n\n⚠️ Wajib dikembalikan setelah selesai. Sistem akan mengirim reminder jika >2 jam.",
  },
  {
    category: "Ticketing",
    keywords: ["lapor rusak", "pc rusak", "komputer rusak", "kerusakan", "error", "mati", "tidak nyala"],
    question: "Bagaimana cara melaporkan kerusakan?",
    answer: "Cara lapor kerusakan:\n1. Buka aplikasi Labkom → Ticketing\n2. Scan QR code di PC yang bermasalah (atau pilih manual)\n3. Pilih kategori kerusakan\n4. Isi deskripsi masalah\n5. Submit — tim akan segera menangani\n\nPrioritas: Critical (1 jam), High (4 jam), Medium (1 hari), Low (3 hari)",
  },
  {
    category: "Jadwal",
    keywords: ["jadwal", "praktikum", "kapan kelas", "mata kuliah", "schedule"],
    question: "Bagaimana melihat jadwal lab?",
    answer: "Lihat jadwal:\n1. Buka aplikasi Labkom → Jadwal\n2. Filter berdasarkan hari, lab, atau semester\n3. Jadwal juga bisa disinkronkan ke Google Calendar\n\nAtau ketik /jadwal di WhatsApp bot untuk jadwal hari ini.",
  },
  {
    category: "Absensi",
    keywords: ["absen", "absensi", "check in", "checkin", "hadir", "telat"],
    question: "Bagaimana sistem absensi asisten lab?",
    answer: "Sistem absensi Asisten Lab:\n1. Buka aplikasi Labkom → Absensi\n2. Klik Check-in (GPS akan diverifikasi)\n3. Isi daily task log selama bertugas\n4. Check-out saat selesai\n\n⏰ Batas check-in: 08:00. Setelah itu dihitung terlambat.\n📍 Harus berada dalam radius lab.",
  },
  {
    category: "Misi",
    keywords: ["misi", "mission", "poin", "point", "reward", "leaderboard", "ranking"],
    question: "Apa itu sistem misi?",
    answer: "Sistem Misi Labkom:\n• Koordinator membuat misi (tugas tambahan)\n• Asisten Lab bisa claim dan mengerjakan\n• Setelah submit bukti, Koordinator verifikasi\n• Poin diberikan otomatis\n• Ranking ditampilkan di Leaderboard\n\nPoin bisa menghasilkan sertifikat otomatis!",
  },
  {
    category: "Logbook",
    keywords: ["logbook", "log book", "buku log", "catatan lab", "kondisi lab"],
    question: "Apa itu digital logbook?",
    answer: "Digital Logbook mencatat:\n1. Check-in: Asisten/Dosen membuka sesi\n2. Pengambilan kunci\n3. Kondisi lab (sebelum & sesudah)\n4. Verifikasi oleh Koordinator\n5. Check-out & pengembalian kunci\n\nSemua tercatat otomatis untuk laporan bulanan.",
  },
  {
    category: "WiFi",
    keywords: ["wifi", "internet", "password wifi", "koneksi", "jaringan"],
    question: "Info WiFi lab?",
    answer: "Info WiFi Lab:\n• SSID: Lab-Informatika\n• Password: Hubungi Asisten Lab yang bertugas\n• Gunakan hanya untuk keperluan akademik\n• Jika koneksi bermasalah, laporkan via Ticketing",
  },
  {
    category: "Print",
    keywords: ["print", "printer", "cetak", "ngeprint"],
    question: "Apakah bisa print di lab?",
    answer: "Info Printer:\n• Printer tersedia di Lab Dasar\n• Hubungi Asisten Lab untuk bantuan\n• Bawa kertas sendiri jika diperlukan\n• Untuk print dalam jumlah banyak, koordinasi dulu dengan Asisten Lab",
  },
  {
    category: "Sertifikat",
    keywords: ["sertifikat", "certificate", "penghargaan"],
    question: "Bagaimana mendapatkan sertifikat?",
    answer: "Sertifikat otomatis diberikan untuk:\n• 🏆 Monthly Best — Asisten dengan poin tertinggi bulan ini\n• ✅ Perfect Attendance — 0 absen & 0 telat dalam sebulan\n• 🎯 Mission Master — Menyelesaikan 10+ misi\n\nSertifikat bisa didownload dalam format PDF.",
  },
  {
    category: "Kontak",
    keywords: ["kontak", "hubungi", "admin", "koordinator", "telepon", "email"],
    question: "Bagaimana menghubungi pengelola lab?",
    answer: "Kontak Lab:\n• Gunakan fitur Ticketing untuk laporan resmi\n• Chat Asisten Lab via WhatsApp (jika terdaftar)\n• Datang langsung ke lab saat jam operasional\n• Untuk urusan mendesak, hubungi Koordinator Lab via aplikasi",
  },
  {
    category: "Peminjaman",
    keywords: ["pinjam lab", "booking", "reservasi", "sewa lab", "pakai lab"],
    question: "Bagaimana cara meminjam/booking lab?",
    answer: "Cara booking lab:\n1. Hubungi Koordinator Lab minimal 3 hari sebelumnya\n2. Sebutkan: tanggal, jam, keperluan, jumlah peserta\n3. Koordinator akan cek ketersediaan\n4. Jika disetujui, jadwal akan muncul di sistem\n\nPeminjaman hanya untuk kegiatan akademik/organisasi kampus.",
  },
];

class FAQBotService {
  async getAnswer(question: string): Promise<{ answer: string; category: string; confidence: number } | null> {
    const lowerQuestion = question.toLowerCase().trim();

    let bestMatch: FAQEntry | null = null;
    let bestScore = 0;

    for (const faq of FAQ_DATABASE) {
      let score = 0;
      for (const keyword of faq.keywords) {
        if (lowerQuestion.includes(keyword)) {
          score += keyword.split(" ").length;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = faq;
      }
    }

    if (bestMatch && bestScore > 0) {
      const confidence = Math.min(bestScore / 3, 1);
      return {
        answer: bestMatch.answer,
        category: bestMatch.category,
        confidence,
      };
    }

    if (config.openaiApiKey) {
      return this.getAIAnswer(question);
    }

    return null;
  }

  private async getAIAnswer(question: string): Promise<{ answer: string; category: string; confidence: number } | null> {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `Kamu adalah asisten FAQ untuk Labkom (Laboratorium Komputer) di kampus.
Jawab pertanyaan dengan singkat, jelas, dan dalam Bahasa Indonesia.
Jika pertanyaan tidak relevan dengan lab komputer, jawab dengan sopan bahwa kamu hanya bisa menjawab pertanyaan seputar lab.
Konteks: Lab buka Senin-Jumat 07:30-21:00, Sabtu 08:00-17:00. Ada 2 lab (Lab Dasar 20 PC, Lab Multimedia 12 PC).
Fitur sistem: logbook digital, peminjaman kunci QR, ticketing kerusakan, absensi GPS, misi & poin, jadwal lab.`,
            },
            { role: "user", content: question },
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      if (!response.ok) return null;

      const data = await response.json() as any;
      const answer = data.choices?.[0]?.message?.content;

      if (!answer) return null;

      return {
        answer,
        category: "AI",
        confidence: 0.8,
      };
    } catch {
      return null;
    }
  }

  getAllFAQs(): { category: string; question: string; answer: string }[] {
    return FAQ_DATABASE.map((f) => ({
      category: f.category,
      question: f.question,
      answer: f.answer,
    }));
  }

  getCategories(): string[] {
    return [...new Set(FAQ_DATABASE.map((f) => f.category))];
  }

  async getStats(): Promise<{ totalFAQs: number; categories: number; hasAI: boolean }> {
    return {
      totalFAQs: FAQ_DATABASE.length,
      categories: this.getCategories().length,
      hasAI: !!config.openaiApiKey,
    };
  }
}

export const faqBotService = new FAQBotService();
