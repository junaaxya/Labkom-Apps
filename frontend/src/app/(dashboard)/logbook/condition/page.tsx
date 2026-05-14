"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  TbSend,
  TbCheck,
  TbAlertTriangle,
  TbCamera,
  TbX,
  TbLoader2,
  TbPhoto,
  TbMoodEmpty,
  TbBuildingWarehouse,
  TbArrowLeft,
} from "react-icons/tb";
import api from "@/services/api";
import Link from "next/link";
import { useToast } from "@/providers/toast-provider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

type Lab = { id: string; name: string };
type Condition = { id: string; labId: string; lab: Lab; fotoBukti: string[]; verified: boolean; submittedBy?: { name: string } };
type DailyLogbook = {
  id: string;
  date: string;
  status: string;
  conditions: Condition[];
};

export default function LogbookConditionPage() {
  const toast = useToast();
  const [logbook, setLogbook] = useState<DailyLogbook | null>(null);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [selectedLab, setSelectedLab] = useState<Lab | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [kerusakanBaru, setKerusakanBaru] = useState("");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => void fetchData());
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [logbookRes, labsRes] = await Promise.all([
        api.get<{ data: DailyLogbook | null }>("/logbooks/today"),
        api.get<{ data: Lab[] }>("/labs"),
      ]);
      const lb = logbookRes.data;
      setLogbook(lb || null);
      const labsRaw: unknown = labsRes.data;
      let labList: Lab[] = [];
      if (Array.isArray(labsRaw)) {
        labList = labsRaw as Lab[];
      } else if (labsRaw && typeof labsRaw === "object" && "data" in labsRaw) {
        const inner = (labsRaw as { data?: unknown }).data;
        if (Array.isArray(inner)) labList = inner as Lab[];
      }
      setLabs(labList);
    } catch {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  function handlePhotos(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - photos.length);
    const updated = [...photos, ...newFiles];
    setPhotos(updated);
    setPreviews(updated.map((f) => URL.createObjectURL(f)));
  }

  function removePhoto(idx: number) {
    const updated = photos.filter((_, i) => i !== idx);
    setPhotos(updated);
    setPreviews(updated.map((f) => URL.createObjectURL(f)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!logbook || !selectedLab || photos.length === 0) return;
    setSubmitting(true);

    try {
      const formData = new FormData();
      photos.forEach((p) => formData.append("photos", p));
      const uploadRes = await fetch(`${API_BASE}/upload/condition-photos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) throw new Error(uploadData.message || "Upload gagal");

      await api.patch(`/logbooks/${logbook.id}/condition`, {
        labId: selectedLab.id,
        fotoBukti: uploadData.data?.urls || uploadData.data || [],
        kerusakanBaru: kerusakanBaru || undefined,
        catatanKondisi: catatan || undefined,
      });

      toast.success("Kondisi berhasil disubmit.");
      setPhotos([]);
      setPreviews([]);
      setKerusakanBaru("");
      setCatatan("");
      setSelectedLab(null);
      await fetchData();
    } catch (err) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message?: unknown }).message
          : undefined;
      toast.error(typeof msg === "string" && msg ? msg : "Gagal submit kondisi");
    } finally {
      setSubmitting(false);
    }
  }

  const submittedLabIds = new Set(logbook?.conditions.map((c) => c.labId) || []);
  const availableLabs = labs.filter((l) => !submittedLabIds.has(l.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <TbLoader2 className="w-8 h-8 animate-spin text-[#4b607f]" />
      </div>
    );
  }

  if (!logbook) {
    return (
      <div className="max-w-lg mx-auto p-4 sm:p-6">
        <div className="neo-card p-8 text-center">
          <TbMoodEmpty className="w-16 h-16 mx-auto text-[#9ca3af] mb-4" />
          <h2 className="font-heading text-xl font-bold text-[#1a1a1a] mb-2">Tidak Ada Sesi Aktif</h2>
          <p className="text-[#5a5a5a]">Asisten Lab belum melakukan check-in hari ini.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 mt-4 text-[#4b607f] font-semibold hover:underline">
            <TbArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="p-2 bg-white border-2 border-[#1a1a1a] rounded-lg shadow-[2px_2px_0px_#1a1a1a] hover:shadow-none transition-all">
          <TbArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#1a1a1a]">Validasi Kondisi Lab</h1>
          <p className="text-sm text-[#5a5a5a]">Foto kondisi akhir lab setelah digunakan</p>
        </div>
      </div>

      {logbook.conditions.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-heading text-lg font-bold text-[#1a1a1a]">Sudah Disubmit</h3>
          {logbook.conditions.map((c) => (
            <div key={c.id} className="neo-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TbBuildingWarehouse className="w-5 h-5 text-[#4b607f]" />
                <span className="font-semibold">{c.lab.name}</span>
              </div>
              <span className={`px-3 py-1 text-xs font-bold rounded-full border-2 ${c.verified ? "bg-green-100 border-green-500 text-green-700" : "bg-yellow-100 border-yellow-500 text-yellow-700"}`}>
                {c.verified ? "Terverifikasi" : "Menunggu Verifikasi"}
              </span>
            </div>
          ))}
        </div>
      )}

      {availableLabs.length === 0 ? (
        <div className="neo-card p-4 sm:p-6 text-center">
          <TbCheck className="w-12 h-12 mx-auto text-green-500 mb-3" />
          <h3 className="font-heading text-lg font-bold">Semua Lab Sudah Divalidasi</h3>
          <p className="text-[#5a5a5a] text-sm mt-1">Kondisi semua lab sudah disubmit hari ini.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="neo-card p-4 sm:p-6 space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-bold text-[#1a1a1a]">Pilih Lab</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableLabs.map((lab) => (
                <button
                  key={lab.id}
                  type="button"
                  onClick={() => setSelectedLab(lab)}
                  className={`p-3 min-h-[44px] border-2 rounded-xl text-left font-semibold transition-all ${selectedLab?.id === lab.id ? "border-[#f3701e] bg-orange-50 shadow-[2px_2px_0px_#f3701e]" : "border-[#1a1a1a] bg-white hover:bg-[#f5ede6]"}`}
                >
                  <TbBuildingWarehouse className="w-5 h-5 mb-1" />
                  {lab.name}
                </button>
              ))}
            </div>
          </div>

          {selectedLab && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-bold text-[#1a1a1a]">
                  <TbPhoto className="inline w-4 h-4 mr-1" />
                  Foto Kondisi Lab ({photos.length}/5) *
                </label>
                <div className="flex flex-col sm:flex-row gap-3 mb-3">
                  <button type="button" onClick={() => cameraRef.current?.click()} className="flex-1 py-3 min-h-[44px] bg-[#4b607f] text-white neo-btn flex items-center justify-center gap-2">
                    <TbCamera className="w-5 h-5" /> Buka Kamera
                  </button>
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex-1 py-3 min-h-[44px] bg-white text-[#1a1a1a] neo-btn flex items-center justify-center gap-2">
                    <TbPhoto className="w-5 h-5" /> Pilih dari Galeri
                  </button>
                </div>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handlePhotos(e.target.files)} />
                {previews.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {previews.map((p, i) => (
                      <div key={i} className="relative border-2 border-[#1a1a1a] rounded-lg overflow-hidden">
                        <img src={p} alt={`Foto ${i + 1}`} className="w-full h-24 object-cover" />
                        <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center">
                          <TbX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-[#1a1a1a]">
                  <TbAlertTriangle className="inline w-4 h-4 mr-1 text-yellow-500" />
                  Kerusakan Baru (opsional)
                </label>
                <textarea value={kerusakanBaru} onChange={(e) => setKerusakanBaru(e.target.value)} placeholder="Jelaskan kerusakan yang ditemukan..." className="w-full p-3 min-h-[80px] neo-input focus:outline-none resize-none" rows={2} />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-[#1a1a1a]">Catatan (opsional)</label>
                <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="Catatan tambahan..." className="w-full p-3 min-h-[80px] neo-input focus:outline-none resize-none" rows={2} />
              </div>

              <button
                type="submit"
                disabled={photos.length === 0 || submitting}
                className="w-full py-3 min-h-[44px] bg-[#f3701e] text-white neo-btn font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? <TbLoader2 className="w-5 h-5 animate-spin" /> : <TbSend className="w-5 h-5" />}
                {submitting ? "Mengirim..." : "Submit Kondisi"}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
