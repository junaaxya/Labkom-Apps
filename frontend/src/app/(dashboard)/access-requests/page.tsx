"use client";

import { useEffect, useMemo, useState } from "react";
import { TbCheck, TbClockHour4, TbFileDescription, TbMail, TbMapPin, TbPhone, TbUsers, TbX } from "react-icons/tb";
import api from "@/services/api";
import type { AccessRequest, AccessRequestStatus, AccessRequestType } from "@/types";
import { useToast } from "@/providers/toast-provider";

type ListResponse = {
  items: AccessRequest[];
  pagination: { page: number; totalPages: number; total: number };
};

const statusStyles: Record<AccessRequestStatus, string> = {
  PENDING: "bg-yellow-400 text-[#1a1a1a]",
  APPROVED: "bg-green-500 text-white",
  REJECTED: "bg-red-500 text-white",
  REVISION: "bg-[#4b607f] text-white",
};

const typeLabels: Record<AccessRequestType, string> = {
  PEMINJAMAN_LAB: "Peminjaman Lab",
  MAGANG: "Magang",
  AKSES_SEMENTARA: "Akses Tamu Sementara",
};

const approvalHelpText: Record<AccessRequestType, string> = {
  PEMINJAMAN_LAB: "Approve akan membuat booking dan jadwal peminjaman lab.",
  MAGANG: "Approve akan langsung membuat akun MAGANG aktif dengan password awal = kode pengajuan.",
  AKSES_SEMENTARA: "Approve akan langsung membuat akun akses sementara dengan password awal = kode pengajuan.",
};

export default function AccessRequestsPage() {
  const toast = useToast();
  const [items, setItems] = useState<AccessRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<"" | AccessRequestStatus>("");
  const [typeFilter, setTypeFilter] = useState<"" | AccessRequestType>("");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    return params.toString();
  }, [statusFilter, typeFilter]);

  const fetchItems = async (currentQuery: string) => {
    const res = await api.get<{ success: boolean; data: ListResponse }>(`/access-requests?${currentQuery}`);
    return res.data.items ?? [];
  };

  const reload = async (currentQuery: string) => {
    setLoading(true);
    try {
      const nextItems = await fetchItems(currentQuery);
      setItems(nextItems);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memuat pengajuan";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await Promise.resolve();
      try {
        const nextItems = await fetchItems(query);
        if (!cancelled) {
          setItems(nextItems);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Gagal memuat pengajuan";
          toast.error(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [query, toast]);

  const review = async (id: string, status: "APPROVED" | "REJECTED" | "REVISION") => {
    setActingId(id);
    try {
      await api.patch(`/access-requests/${id}/status`, {
        status,
        reviewerNotes: notesById[id] || undefined,
      });
      toast.success("Pengajuan berhasil diproses");
        await reload(query);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal memproses pengajuan";
      toast.error(message);
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="neo-card p-4 sm:p-6 md:p-8 bg-white">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a]">Pengajuan Akses</h1>
        <p className="mt-2 text-[#5a5a5a] font-medium">Review pengajuan publik untuk peminjaman lab, magang, atau akses sementara.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => {
          setLoading(true);
          setStatusFilter(e.target.value as "" | AccessRequestStatus);
        }} className="neo-input min-h-[44px] px-4 py-2 bg-white">
          <option value="">Semua Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="REVISION">Revision</option>
        </select>
        <select value={typeFilter} onChange={(e) => {
          setLoading(true);
          setTypeFilter(e.target.value as "" | AccessRequestType);
        }} className="neo-input min-h-[44px] px-4 py-2 bg-white">
          <option value="">Semua Tipe</option>
          <option value="PEMINJAMAN_LAB">Peminjaman Lab</option>
          <option value="MAGANG">Magang</option>
          <option value="AKSES_SEMENTARA">Akses Sementara</option>
        </select>
      </div>

      {loading ? <div className="neo-card p-6 bg-white text-[#5a5a5a]">Memuat pengajuan...</div> : (
        <div className="space-y-4">
          {items.length === 0 ? <div className="neo-card p-6 bg-white text-[#5a5a5a]">Belum ada pengajuan.</div> : items.map((item) => (
            <div key={item.id} className="neo-card p-4 sm:p-6 bg-white space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">{item.title}</h2>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${statusStyles[item.status]}`}>{item.status}</span>
                    <span className="rounded-full px-3 py-1 text-xs font-black bg-[#f5ede6] text-[#1a1a1a] neo-border-sm">{typeLabels[item.type]}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#5a5a5a]">Kode: {item.requestCode}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm font-medium text-[#1a1a1a]">
                <p className="flex items-center gap-2"><TbUsers /> {item.applicantName}</p>
                <p className="flex items-center gap-2"><TbMail /> {item.applicantEmail}</p>
                {item.applicantPhone && <p className="flex items-center gap-2"><TbPhone /> {item.applicantPhone}</p>}
                {item.lab && <p className="flex items-center gap-2"><TbMapPin /> {item.lab.name} - {item.lab.location}</p>}
                {item.date && <p className="flex items-center gap-2"><TbClockHour4 /> {new Date(item.date).toLocaleDateString("id-ID")} {item.startTime && item.endTime ? `• ${item.startTime}-${item.endTime}` : ""}</p>}
                {item.requestedRole && <p className="flex items-center gap-2"><TbFileDescription /> Role diminta: {item.requestedRole}</p>}
              </div>

              {(item.purpose || item.description) && <div className="rounded-lg bg-[#f5ede6] p-4 neo-border-sm space-y-2 text-sm text-[#1a1a1a]"><p><span className="font-bold">Tujuan:</span> {item.purpose || "-"}</p><p><span className="font-bold">Deskripsi:</span> {item.description || "-"}</p></div>}

              {item.status !== "APPROVED" && item.status !== "REJECTED" && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-[#5a5a5a]">{approvalHelpText[item.type]}</p>
                  <textarea
                    rows={3}
                    value={notesById[item.id] || ""}
                    onChange={(e) => setNotesById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Catatan reviewer (opsional untuk approve, wajib secara praktik untuk reject/revision)"
                    className="neo-input w-full px-4 py-3 bg-white"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" disabled={actingId === item.id} onClick={() => void review(item.id, "APPROVED")} className="neo-btn min-h-[44px] flex-1 bg-green-500 text-white px-4 py-2"><span className="flex items-center justify-center gap-2"><TbCheck /> Approve</span></button>
                    <button type="button" disabled={actingId === item.id} onClick={() => void review(item.id, "REVISION")} className="neo-btn min-h-[44px] flex-1 bg-[#4b607f] text-white px-4 py-2">Revision</button>
                    <button type="button" disabled={actingId === item.id} onClick={() => void review(item.id, "REJECTED")} className="neo-btn min-h-[44px] flex-1 bg-red-500 text-white px-4 py-2"><span className="flex items-center justify-center gap-2"><TbX /> Reject</span></button>
                  </div>
                </div>
              )}

              {item.reviewerNotes && <div className="text-sm text-[#5a5a5a] font-medium">Catatan reviewer: {item.reviewerNotes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
