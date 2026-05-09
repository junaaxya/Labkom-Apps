"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TbAlertTriangle,
  TbBuildingWarehouse,
  TbCategory,
  TbPhoto,
  TbCpu,
  TbFileDescription,
  TbSend,
} from "react-icons/tb";
import api from "@/services/api";
import type { Lab, PC, TicketCategory } from "@/types";
import { useToast } from "@/providers/toast-provider";
import { PhotoUpload } from "@/components/ui/photo-upload";

type CreateTicketBody = {
  labId: string;
  category: TicketCategory;
  title: string;
  description: string;
  pcId?: string;
  photo?: string[];
};

type CreateTicketResponse = {
  data?: {
    id?: string;
  };
  id?: string;
  message?: string;
};

const CATEGORIES: TicketCategory[] = [
  "MOUSE",
  "KEYBOARD",
  "MONITOR",
  "CPU",
  "JARINGAN",
  "SOFTWARE",
  "KURSI_MEJA",
  "AC_LISTRIK",
  "PROYEKTOR",
  "LAINNYA",
];

export default function NewTicketPage() {
  const toast = useToast();
  const router = useRouter();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [pcs, setPcs] = useState<PC[]>([]);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [loadingPcs, setLoadingPcs] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<CreateTicketBody>({
    labId: "",
    category: "MOUSE",
    title: "",
    description: "",
    pcId: "",
    photo: [],
  });

  const fetchLabs = async () => {
    setLoadingLabs(true);
    try {
      const res = await api.get<{ data: Lab[] }>("/labs");
      setLabs(res.data ?? []);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal memuat daftar lab.");
      setLabs([]);
    } finally {
      setLoadingLabs(false);
    }
  };

  const fetchPcs = async (labId: string) => {
    if (!labId) {
      setPcs([]);
      return;
    }

    setLoadingPcs(true);
    try {
      const res = await api.get<{ data: PC[] }>(`/labs/${labId}/pcs`);
      setPcs(res.data ?? []);
    } catch {
      setPcs([]);
    } finally {
      setLoadingPcs(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, []);

  useEffect(() => {
    fetchPcs(form.labId);
    setForm((prev) => ({ ...prev, pcId: "" }));
  }, [form.labId]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload: CreateTicketBody = {
        labId: form.labId,
        category: form.category,
        title: form.title.trim(),
        description: form.description.trim(),
        pcId: form.pcId || undefined,
        photo: form.photo && form.photo.length > 0 ? form.photo : undefined,
      };

      const res = await api.post<CreateTicketResponse>("/tickets", payload);
      const ticketId = res?.data?.id || res?.id || "(ID tidak tersedia)";

      toast.success(`Laporan berhasil dikirim. Ticket ID: ${ticketId}. Mengalihkan ke riwayat...`);
      setForm({
        labId: "",
        category: "MOUSE",
        title: "",
        description: "",
        pcId: "",
        photo: [],
      });
      setPcs([]);

      setTimeout(() => {
        router.push("/tickets/my");
      }, 1300);
    } catch (err: any) {
      toast.error(err?.message ?? "Gagal mengirim laporan kerusakan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="neo-card p-6" style={{ backgroundColor: "#fff" }}>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-lg bg-[#f3701e] text-white neo-border-sm flex items-center justify-center">
            <TbAlertTriangle size={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Lapor Kerusakan</h1>
            <p className="text-sm text-[#5a5a5a] mt-1">
              Laporkan kerusakan perangkat laboratorium agar segera ditangani.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="neo-card p-4 sm:p-6 space-y-5" style={{ backgroundColor: "#fff" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
              <TbBuildingWarehouse size={18} strokeWidth={2.2} />
              Pilih Lab
            </label>
            <select
              required
              value={form.labId}
              onChange={(e) => setForm((prev) => ({ ...prev, labId: e.target.value }))}
              className="w-full px-4 py-3 min-h-[44px] neo-input bg-white text-sm focus:outline-none"
              disabled={loadingLabs}
            >
              <option value="">{loadingLabs ? "Memuat lab..." : "Pilih lab"}</option>
              {labs.map((lab) => (
                <option key={lab.id} value={lab.id}>
                  {lab.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
              <TbCategory size={18} strokeWidth={2.2} />
              Kategori Kerusakan
            </label>
            <select
              required
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as TicketCategory }))}
              className="w-full px-4 py-3 min-h-[44px] neo-input bg-white text-sm focus:outline-none"
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-[#1a1a1a]">Judul Laporan</label>
          <input
            required
            type="text"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Contoh: Mouse tidak terdeteksi di PC 12"
            className="w-full px-4 py-3 min-h-[44px] neo-input bg-white text-sm focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
            <TbFileDescription size={18} strokeWidth={2.2} />
            Deskripsi Kerusakan
          </label>
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Jelaskan gejala kerusakan, waktu kejadian, dan kondisi terakhir perangkat."
            className="w-full px-4 py-3 min-h-[120px] neo-input bg-white text-sm focus:outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-[#1a1a1a] flex items-center gap-2">
              <TbCpu size={18} strokeWidth={2.2} />
              Pilih PC (Opsional)
            </label>
            <select
              value={form.pcId}
              onChange={(e) => setForm((prev) => ({ ...prev, pcId: e.target.value }))}
              className="w-full px-4 py-3 min-h-[44px] neo-input bg-white text-sm focus:outline-none"
              disabled={!form.labId || loadingPcs}
            >
              <option value="">
                {!form.labId
                  ? "Pilih lab terlebih dahulu"
                  : loadingPcs
                    ? "Memuat PC..."
                    : "Tidak spesifik / pilih PC"}
              </option>
              {pcs.map((pc) => (
                <option key={pc.id} value={pc.id}>
                  {pc.pcCode} - {pc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <PhotoUpload
              value={form.photo ?? []}
              onChange={(urls) => setForm((prev) => ({ ...prev, photo: urls }))}
              category="tickets"
              label="Foto Kerusakan"
              maxFiles={3}
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="neo-btn w-full sm:w-auto px-6 py-3 min-h-[44px] bg-[#4b607f] text-white font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            <TbSend size={18} strokeWidth={2.2} />
            {submitting ? "Mengirim..." : "Kirim Laporan"}
          </button>
        </div>
      </form>
    </div>
  );
}
