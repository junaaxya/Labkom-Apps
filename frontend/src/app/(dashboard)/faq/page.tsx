"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  TbAlertCircle,
  TbApps,
  TbAward,
  TbBuilding,
  TbCalendar,
  TbCertificate,
  TbCheck,
  TbChevronDown,
  TbClipboardList,
  TbClock,
  TbExternalLink,
  TbFilter,
  TbHelpCircle,
  TbKey,
  TbPhone,
  TbPrinter,
  TbRefresh,
  TbRobot,
  TbSearch,
  TbTicket,
  TbUserCheck,
  TbWifi,
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
  Absensi: { href: "/attendance", label: "Buka absensi asisten" },
  Misi: { href: "/missions", label: "Lihat misi operasional" },
  Logbook: { href: "/logbook", label: "Buka logbook lab" },
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Semua: TbApps,
  Operasional: TbClock,
  Kunci: TbKey,
  Ticketing: TbTicket,
  Jadwal: TbCalendar,
  Absensi: TbUserCheck,
  Misi: TbAward,
  Logbook: TbClipboardList,
  WiFi: TbWifi,
  Print: TbPrinter,
  Sertifikat: TbCertificate,
  Kontak: TbPhone,
  Peminjaman: TbBuilding,
  AI: TbRobot,
};

function CategoryPickerModal({
  isOpen,
  onClose,
  categories,
  categoryCounts,
  selectedCategory,
  onSelectCategory,
}: {
  isOpen: boolean;
  onClose: () => void;
  categories: string[];
  categoryCounts: Record<string, number>;
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border-t-2 border-[#1a1a1a] bg-white shadow-2xl sm:rounded-2xl sm:border-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b-2 border-[#1a1a1a]/10 bg-[#fff8f0] px-4 pt-3 pb-3 sm:px-5 sm:pt-4">
          <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-[#1a1a1a]/20 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-[#1a1a1a] bg-[#f3701e] text-white shadow-[2px_2px_0px_#1a1a1a]">
                <TbFilter className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-heading text-lg font-black text-[#1a1a1a]">Pilih Kategori</h2>
                <p className="text-xs text-[#5a5a5a]">Filter panduan berdasarkan topik</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-white hover:bg-[#f5ede6] shadow-[2px_2px_0px_#1a1a1a] active:translate-x-[1px] active:translate-y-[1px]"
              aria-label="Tutup"
            >
              <TbX className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Categories Grid */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2">
            {categories.map((cat) => {
              const Icon = CATEGORY_ICONS[cat] || TbHelpCircle;
              const isSelected = selectedCategory === cat;
              const count = categoryCounts[cat] ?? 0;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    onSelectCategory(cat);
                    onClose();
                  }}
                  className={`flex min-h-[58px] items-center justify-between gap-2.5 rounded-xl border-2 border-[#1a1a1a] p-3 text-left transition-all ${
                    isSelected
                      ? "bg-[#1a1a1a] text-white shadow-[3px_3px_0px_#f3701e]"
                      : "bg-[#fffdf9] text-[#1a1a1a] hover:bg-[#fff8f0] shadow-[2px_2px_0px_#1a1a1a]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1a1a1a] ${
                        isSelected
                          ? "bg-[#f3701e] text-white"
                          : "bg-[#f5ede6] text-[#1a1a1a]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs sm:text-sm font-black leading-tight">{cat}</p>
                      <p className={`text-[11px] ${isSelected ? "text-white/70" : "text-[#5a5a5a]"}`}>
                        {count} panduan
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <TbCheck className="h-5 w-5 shrink-0 text-[#f3701e]" strokeWidth={3} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t-2 border-[#1a1a1a]/10 bg-[#fff8f0] p-3 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-center">
          <button
            type="button"
            onClick={() => {
              onSelectCategory("Semua");
              onClose();
            }}
            className="w-full rounded-xl border-2 border-[#1a1a1a] bg-white py-2.5 text-xs sm:text-sm font-bold text-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] hover:bg-[#f5ede6] active:translate-x-[1px] active:translate-y-[1px]"
          >
            Tampilkan Semua Kategori ({categoryCounts["Semua"] ?? 0})
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function HelpCenterPage() {
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Semua");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCategorySheet, setShowCategorySheet] = useState(false);

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

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { Semua: faqs.length };
    for (const item of faqs) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [faqs]);

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
    <main className="mx-auto w-full max-w-4xl space-y-6 pb-32 sm:space-y-8 sm:pb-16">
      <CategoryPickerModal
        isOpen={showCategorySheet}
        onClose={() => setShowCategorySheet(false)}
        categories={categories}
        categoryCounts={categoryCounts}
        selectedCategory={category}
        onSelectCategory={(cat) => setCategory(cat)}
      />

      <section className="neo-card overflow-hidden bg-white p-0">
        <div className="border-b-2 border-[#1a1a1a] bg-[#fff8f0] p-5 sm:p-8">
          <div>
            <h1 className="font-heading text-3xl font-black tracking-tight text-[#1a1a1a] sm:text-4xl">Pusat Bantuan</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#4b607f] sm:text-base">
              Cari prosedur resmi penggunaan layanan LabKom.
            </p>
          </div>

          <div className="relative mt-6 sm:mt-7">
            <label htmlFor="help-search" className="sr-only">Cari panduan LabKom</label>
            <TbSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#4b607f]" />
            <input
              id="help-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari: jadwal, WiFi, kerusakan, kunci…"
              className="neo-input min-h-[48px] sm:min-h-[50px] w-full pl-12 pr-12 text-sm sm:text-base"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-[#e8d8c9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <TbX className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Bar */}
        {!loading && !error && (
          <div className="border-b-2 border-[#1a1a1a] bg-white p-2.5 sm:p-3.5" aria-label="Kategori bantuan">
            {/* Mobile: one stable Android-style selector, no horizontal scrolling. */}
            <button
              type="button"
              onClick={() => setShowCategorySheet(true)}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-xl border-2 border-[#1a1a1a] bg-[#fff8f0] px-3 text-left shadow-[3px_3px_0px_#1a1a1a] transition-transform active:translate-x-[1px] active:translate-y-[1px] sm:hidden"
              aria-label="Pilih kategori panduan"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f3701e] text-white">
                {(() => {
                  const ActiveIcon = CATEGORY_ICONS[category] || TbFilter;
                  return <ActiveIcon className="h-5 w-5" />;
                })()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-[#5a5a5a]">Kategori</span>
                <span className="block truncate text-sm font-bold text-[#1a1a1a]">{category}</span>
              </span>
              <span className="rounded-full bg-[#4b607f] px-2 py-1 text-[11px] font-black text-white">
                {categoryCounts[category] ?? faqs.length}
              </span>
              <TbChevronDown className="h-5 w-5 shrink-0 text-[#1a1a1a]" />
            </button>

            {/* Tablet/desktop: all categories wrap; no hidden horizontal state. */}
            <div className="hidden flex-wrap gap-2 sm:flex" aria-label="Daftar kategori">
              {categories.map((item) => {
                const Icon = CATEGORY_ICONS[item] || TbHelpCircle;
                const isSelected = category === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    aria-pressed={isSelected}
                    className={`inline-flex min-h-[42px] items-center gap-2 rounded-xl border-2 border-[#1a1a1a] px-3 text-sm font-bold transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                      isSelected
                        ? "bg-[#4b607f] text-white shadow-[2px_2px_0px_#1a1a1a]"
                        : "bg-white text-[#1a1a1a] shadow-[1px_1px_0px_#1a1a1a] hover:bg-[#f5ede6]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isSelected ? "bg-white/20" : "bg-[#f5ede6] text-[#5a5a5a]"}`}>
                      {categoryCounts[item] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>

            {category !== "Semua" && (
              <button
                type="button"
                onClick={() => setCategory("Semua")}
                className="mt-3 min-h-[44px] text-sm font-semibold text-[#405574] underline-offset-4 hover:underline"
              >
                Hapus filter {category}
              </button>
            )}
          </div>
        )}

        <div className="px-4 py-5 sm:px-8 sm:py-7">
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
              <p className="mb-3 text-sm text-[#4b607f]" aria-live="polite">
                {filteredFAQs.length} hasil
              </p>
              <div className="space-y-0">
                {filteredFAQs.map((faq) => {
                  const key = `${faq.category}:${faq.question}`;
                  const isOpen = openQuestion === key;
                  const feature = FEATURE_LINKS[faq.category];
                  const Icon = CATEGORY_ICONS[faq.category] || TbHelpCircle;

                  return (
                    <article key={key} className="overflow-hidden rounded-xl border-2 border-[#1a1a1a] bg-white shadow-[2px_2px_0px_#1a1a1a] sm:shadow-[3px_3px_0px_#1a1a1a]">
                      <button
                        type="button"
                        onClick={() => setOpenQuestion(isOpen ? null : key)}
                        aria-expanded={isOpen}
                        className="flex min-h-[56px] sm:min-h-[60px] w-full items-center gap-2.5 sm:gap-3 p-3 text-left hover:bg-[#fff8f0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] sm:p-4"
                      >
                        <span className="flex items-center gap-1 rounded-md bg-[#f5ede6] px-2 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wide text-[#4b607f] shrink-0">
                          <Icon className="h-3 w-3" />
                          <span>{faq.category}</span>
                        </span>
                        <span className="flex-1 text-xs sm:text-base font-black leading-snug text-[#1a1a1a]">{faq.question}</span>
                        <TbChevronDown className={`h-5 w-5 shrink-0 text-[#1a1a1a] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                      </button>
                      {isOpen && (
                        <div className="border-t-2 border-[#1a1a1a] bg-[#fffdf9] p-3.5 sm:p-5">
                          <p className="whitespace-pre-line text-xs leading-relaxed text-[#323b49] sm:text-base sm:leading-7">{faq.answer}</p>
                          {feature && (
                            <Link href={feature.href} className="mt-3 sm:mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-lg border-2 border-[#1a1a1a] bg-white px-3.5 py-1.5 text-xs sm:text-sm font-black shadow-[2px_2px_0px_#1a1a1a] hover:bg-[#f5ede6] active:translate-x-[1px] active:translate-y-[1px]">
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
        className="flex flex-col gap-3 rounded-xl border-2 sm:border-[3px] border-[#1a1a1a] p-4 shadow-[3px_3px_0px_#1a1a1a] sm:flex-row sm:items-center sm:justify-between sm:p-6"
        style={{ backgroundColor: "#263b5a", color: "#ffffff" }}
      >
        <div className="flex items-start gap-3">
          <TbRobot className="mt-0.5 h-6 w-6 sm:h-7 sm:w-7 shrink-0" style={{ color: "#ffffff" }} />
          <div>
            <h2 className="font-heading text-base font-bold text-white sm:text-lg">
              Pertanyaan belum terjawab?
            </h2>
            <p className="mt-1 text-sm leading-6 text-white">
              Tanyakan konteks khususmu kepada AI Assistant.
            </p>
          </div>
        </div>
        <Link
          href="/ai-assistant"
          className="neo-btn inline-flex min-h-[44px] sm:min-h-[48px] shrink-0 items-center justify-center gap-2 px-4 sm:px-5 text-xs sm:text-sm font-black active:translate-x-[1px] active:translate-y-[1px]"
          style={{ backgroundColor: "#f3701e", color: "#ffffff" }}
        >
          Buka AI Assistant <TbExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
        </Link>
      </section>
    </main>
  );
}
