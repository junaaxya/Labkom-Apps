"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TbAlertCircle,
  TbBook2,
  TbChevronDown,
  TbExternalLink,
  TbHelpCircle,
  TbRefresh,
  TbRobot,
  TbSearch,
  TbX,
} from "react-icons/tb";
import api from "@/services/api";

interface FAQItem {
  category: string;
  question: string;
  answer: string;
}

const FEATURE_LINKS: Record<string, { href: string; label: string }> = {
  Ticketing: { href: "/tickets/new", label: "Buat laporan kerusakan" },
  Jadwal: { href: "/schedules", label: "Buka jadwal lab" },
  Peminjaman: { href: "/schedules", label: "Lihat jadwal dan peminjaman" },
};

export default function HelpCenterPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFAQs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get<{ data: FAQItem[] }>("/faq/list");
      setFaqs(response.data);
    } catch {
      setError("Panduan belum dapat dimuat. Periksa koneksi lalu coba lagi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void loadFAQs());
  }, [loadFAQs]);

  const categories = useMemo(
    () => ["Semua", ...Array.from(new Set(faqs.map((item) => item.category)))],
    [faqs],
  );

  const filteredFAQs = useMemo(() => {
    const keyword = query.toLocaleLowerCase("id-ID").trim();
    return faqs.filter((item) => {
      const inCategory = category === "Semua" || item.category === category;
      const matchesKeyword =
        !keyword ||
        item.question.toLocaleLowerCase("id-ID").includes(keyword) ||
        item.answer.toLocaleLowerCase("id-ID").includes(keyword) ||
        item.category.toLocaleLowerCase("id-ID").includes(keyword);
      return inCategory && matchesKeyword;
    });
  }, [category, faqs, query]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 pb-8 sm:space-y-7">
      <section className="neo-card overflow-hidden bg-white p-0">
        <div className="border-b-2 border-[#1a1a1a] bg-[#fff8f0] p-4 sm:p-7">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#f3701e] text-white shadow-[3px_3px_0px_#1a1a1a] sm:h-14 sm:w-14">
              <TbBook2 className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.2} />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#f3701e]">Panduan LabKom</p>
              <h1 className="font-heading text-2xl font-black text-[#1a1a1a] sm:text-4xl">Pusat Bantuan</h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#4b607f] sm:text-base">
                Temukan prosedur dan jawaban resmi dengan cepat. Untuk pertanyaan yang lebih spesifik, gunakan AI Assistant.
              </p>
            </div>
          </div>

          <div className="relative mt-5">
            <label htmlFor="help-search" className="sr-only">Cari panduan LabKom</label>
            <TbSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#4b607f]" />
            <input
              id="help-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari: jadwal, WiFi, kerusakan, kunci…"
              className="neo-input min-h-[50px] w-full pl-12 pr-12 text-sm sm:text-base"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-[#e8d8c9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <TbX className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {!loading && !error && (
          <div className="overflow-x-auto border-b-2 border-[#1a1a1a] p-3 sm:p-4" aria-label="Kategori bantuan">
            <div className="flex min-w-max gap-2">
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                  className={`min-h-[44px] rounded-lg border-2 border-[#1a1a1a] px-4 text-sm font-black transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                    category === item ? "bg-[#4b607f] text-white shadow-[2px_2px_0px_#1a1a1a]" : "bg-white text-[#1a1a1a] hover:bg-[#f5ede6]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 sm:p-6">
          {loading && (
            <div aria-live="polite" aria-busy="true" className="space-y-3">
              <p className="sr-only">Memuat panduan…</p>
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-xl border-2 border-[#1a1a1a]/20 bg-[#f5ede6]" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border-2 border-[#1a1a1a] bg-[#fff1f0] p-5 text-center shadow-[3px_3px_0px_#1a1a1a]" role="alert">
              <TbAlertCircle className="mx-auto h-8 w-8 text-[#c0392b]" />
              <p className="mt-2 font-bold text-[#1a1a1a]">{error}</p>
              <button type="button" onClick={() => void loadFAQs()} className="neo-btn mt-4 inline-flex min-h-[44px] items-center gap-2 bg-white px-4">
                <TbRefresh className="h-5 w-5" /> Coba lagi
              </button>
            </div>
          )}

          {!loading && !error && filteredFAQs.length === 0 && (
            <div className="py-10 text-center">
              <TbHelpCircle className="mx-auto h-10 w-10 text-[#4b607f]" />
              <h2 className="mt-3 font-heading text-xl font-black text-[#1a1a1a]">Panduan tidak ditemukan</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-[#4b607f]">Coba kata lain atau tanyakan kebutuhanmu langsung kepada AI Assistant.</p>
              <Link href="/ai-assistant" className="neo-btn mt-5 inline-flex min-h-[44px] items-center gap-2 bg-[#f3701e] px-5 text-white">
                <TbRobot className="h-5 w-5" /> Tanyakan ke AI Assistant
              </Link>
            </div>
          )}

          {!loading && !error && filteredFAQs.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-bold text-[#4b607f]" aria-live="polite">
                {filteredFAQs.length} panduan ditemukan
              </p>
              <div className="space-y-3">
                {filteredFAQs.map((faq) => {
                  const key = `${faq.category}:${faq.question}`;
                  const isOpen = openQuestion === key;
                  const feature = FEATURE_LINKS[faq.category];
                  return (
                    <article key={key} className="overflow-hidden rounded-xl border-2 border-[#1a1a1a] bg-white shadow-[3px_3px_0px_#1a1a1a]">
                      <button
                        type="button"
                        onClick={() => setOpenQuestion(isOpen ? null : key)}
                        aria-expanded={isOpen}
                        className="flex min-h-[60px] w-full items-center gap-3 p-3 text-left hover:bg-[#fff8f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] sm:p-4"
                      >
                        <span className="rounded-md bg-[#f5ede6] px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-[#4b607f]">{faq.category}</span>
                        <span className="flex-1 text-sm font-black leading-snug text-[#1a1a1a] sm:text-base">{faq.question}</span>
                        <TbChevronDown className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t-2 border-[#1a1a1a] bg-[#fffdf9] p-4 sm:p-5">
                          <p className="whitespace-pre-line text-sm leading-7 text-[#323b49] sm:text-base">{faq.answer}</p>
                          {feature && (
                            <Link href={feature.href} className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-[#1a1a1a] bg-white px-4 text-sm font-black shadow-[2px_2px_0px_#1a1a1a] hover:bg-[#f5ede6]">
                              {feature.label} <TbExternalLink className="h-4 w-4" />
                            </Link>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section
        className="flex flex-col gap-4 rounded-lg border-[3px] border-[#1a1a1a] p-4 shadow-[4px_4px_0px_#1a1a1a] sm:flex-row sm:items-center sm:justify-between sm:p-6"
        style={{ backgroundColor: "#263b5a", color: "#ffffff" }}
      >
        <div className="flex items-start gap-3">
          <TbRobot className="mt-0.5 h-7 w-7 shrink-0" style={{ color: "#ffffff" }} />
          <div>
            <h2 className="font-heading text-lg font-black sm:text-xl" style={{ color: "#ffffff" }}>
              Butuh jawaban yang lebih spesifik?
            </h2>
            <p className="mt-1 text-sm font-semibold leading-relaxed" style={{ color: "#f3f6fb" }}>
              AI Assistant dapat membantu berdasarkan panduan dan data LabKom sesuai hak aksesmu.
            </p>
          </div>
        </div>
        <Link
          href="/ai-assistant"
          className="neo-btn inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 px-5 font-black"
          style={{ backgroundColor: "#f3701e", color: "#ffffff" }}
        >
          Buka AI Assistant <TbExternalLink className="h-5 w-5" />
        </Link>
      </section>
    </main>
  );
}
