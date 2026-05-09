"use client";

import { useState, useEffect } from "react";
import { TbCertificate, TbDownload, TbPlus, TbTrophy, TbCalendarCheck, TbTarget, TbLoader2, TbPhoto, TbTrash, TbUpload, TbX } from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import { toUploadDisplayUrl } from "@/utils/upload-url";

interface Certificate {
  id: string;
  userId: string;
  type: string;
  title: string;
  description: string | null;
  semester: string | null;
  totalPoints: number;
  missionsCompleted: number;
  issuedAt: string;
  user?: { id: string; name: string; email: string };
  issuedBy?: { id: string; name: string } | null;
}

interface CertTemplate {
  id: string;
  name: string;
  type: string;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
}

type GenerateType = "monthly-best" | "attendance-perfect" | "mission-master";
type TabType = "certificates" | "templates";

const typeLabels: Record<string, string> = {
  MONTHLY_BEST: "Asleb Terbaik",
  ATTENDANCE_PERFECT: "Kehadiran Sempurna",
  MISSION_MASTER: "Mission Master",
  SKILL_MASTER: "Skill Master",
  SEMESTER_COMPLETION: "Semester Selesai",
};

export default function CertificatesPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<TabType>("certificates");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [templates, setTemplates] = useState<CertTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [genType, setGenType] = useState<GenerateType>("monthly-best");
  const [genMonth, setGenMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [genUserId, setGenUserId] = useState("");
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState("MONTHLY_BEST");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templatePreview, setTemplatePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchCertificates();
    fetchUsers();
    fetchTemplates();
  }, []);

  const fetchCertificates = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Certificate[] }>("/certificates");
      setCertificates(res.data || []);
    } catch {
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get<{ data: CertTemplate[] }>("/certificates/templates");
      setTemplates(res.data || []);
    } catch {
      setTemplates([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get<{ data: { users: { id: string; name: string }[] } }>("/users?role=ASISTEN_LAB&limit=50");
      setUsers(res.data?.users || []);
    } catch {
      setUsers([]);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let body: any = {};
      if (genType === "monthly-best") {
        body = { month: genMonth };
      } else if (genType === "attendance-perfect") {
        body = { userId: genUserId, month: genMonth };
      } else {
        body = { userId: genUserId };
      }

      await api.post(`/certificates/${genType}`, body);
      setShowModal(false);
      fetchCertificates();
    } catch (err: any) {
      toast.error(err?.message || "Gagal generate sertifikat");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (certId: string, title: string) => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
      const response = await fetch(`${baseUrl}/certificates/${certId}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal download sertifikat");
    }
  };

  const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setTemplateFile(file);
      const reader = new FileReader();
      reader.onload = () => setTemplatePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUploadTemplate = async () => {
    if (!templateFile || !templateName || !templateType) {
      toast.warning("Nama, tipe, dan file template wajib diisi");
      return;
    }
    setUploading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";
      const formData = new FormData();
      formData.append("image", templateFile);
      formData.append("name", templateName);
      formData.append("type", templateType);

      const response = await fetch(`${baseUrl}/certificates/templates`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      setShowTemplateModal(false);
      setTemplateName("");
      setTemplateType("MONTHLY_BEST");
      setTemplateFile(null);
      setTemplatePreview(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err?.message || "Gagal upload template");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Hapus template ini?")) return;
    try {
      await api.delete(`/certificates/templates/${templateId}`);
      fetchTemplates();
    } catch {
      toast.error("Gagal menghapus template");
    }
  };

  const typeConfig: Record<string, { icon: typeof TbTrophy; color: string; label: string }> = {
    MONTHLY_BEST: { icon: TbTrophy, color: "text-yellow-500 bg-yellow-50", label: "Asleb Terbaik" },
    ATTENDANCE_PERFECT: { icon: TbCalendarCheck, color: "text-green-600 bg-green-50", label: "Kehadiran Sempurna" },
    MISSION_MASTER: { icon: TbTarget, color: "text-purple-600 bg-purple-50", label: "Mission Master" },
    SEMESTER_COMPLETION: { icon: TbCertificate, color: "text-blue-600 bg-blue-50", label: "Semester Selesai" },
    SKILL_MASTER: { icon: TbCertificate, color: "text-indigo-600 bg-indigo-50", label: "Skill Master" },
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#e8d8c9] text-[#1a1a1a] flex items-center justify-center neo-border-sm">
            <TbCertificate size={28} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a] tracking-tight">Sertifikat</h1>
            <p className="text-sm text-[#5a5a5a]">Kelola sertifikat & template</p>
          </div>
        </div>
        <div className="flex gap-2">
          {activeTab === "templates" && (
            <button
              onClick={() => setShowTemplateModal(true)}
              className="neo-btn bg-[#4b607f] text-white px-4 py-2.5 flex items-center gap-2 font-bold text-sm"
            >
              <TbUpload size={18} strokeWidth={2.2} /> Upload Template
            </button>
          )}
          {activeTab === "certificates" && (
            <button
              onClick={() => setShowModal(true)}
              className="neo-btn bg-[#f3701e] text-white px-4 py-2.5 flex items-center gap-2 font-bold text-sm"
            >
              <TbPlus size={18} strokeWidth={2.2} /> Generate Sertifikat
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b-2 border-[#1a1a1a] pb-0">
        <button
          onClick={() => setActiveTab("certificates")}
          className={`px-5 py-2.5 font-bold text-sm border-2 border-b-0 border-[#1a1a1a] rounded-t-lg transition-colors ${
            activeTab === "certificates" ? "bg-white text-[#1a1a1a] -mb-[2px]" : "bg-[#e8d8c9] text-[#5a5a5a]"
          }`}
        >
          <span className="flex items-center gap-2"><TbCertificate size={16} /> Sertifikat ({certificates.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`px-5 py-2.5 font-bold text-sm border-2 border-b-0 border-[#1a1a1a] rounded-t-lg transition-colors ${
            activeTab === "templates" ? "bg-white text-[#1a1a1a] -mb-[2px]" : "bg-[#e8d8c9] text-[#5a5a5a]"
          }`}
        >
          <span className="flex items-center gap-2"><TbPhoto size={16} /> Template ({templates.length})</span>
        </button>
      </div>

      {activeTab === "certificates" && (
        <div className="neo-card p-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <TbLoader2 className="animate-spin text-[#4b607f]" size={28} />
            </div>
          ) : certificates.length === 0 ? (
            <div className="text-center py-16">
              <TbCertificate size={40} className="mx-auto text-[#9ca3af] mb-3" />
              <p className="text-[#5a5a5a] font-medium">Belum ada sertifikat</p>
            </div>
          ) : (
            <div className="divide-y-2 divide-[#1a1a1a]">
              {certificates.map((cert) => {
                const cfg = typeConfig[cert.type] || typeConfig.SEMESTER_COMPLETION;
                const Icon = cfg.icon;
                return (
                  <div key={cert.id} className="flex items-center gap-4 p-4 hover:bg-[#fcf8f4] transition-colors">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${cfg.color}`}>
                      <Icon size={20} strokeWidth={2.2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#1a1a1a] truncate">{cert.title}</p>
                      <p className="text-xs text-[#5a5a5a]">
                        {cert.user?.name} • {new Date(cert.issuedAt).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#f5ede6] text-[#4b607f] border border-[#4b607f] hidden sm:block">
                      {cfg.label}
                    </span>
                    <button
                      onClick={() => handleDownload(cert.id, cert.title)}
                      className="neo-btn px-3 py-2 bg-white hover:bg-[#e8d8c9] transition-colors"
                      title="Download PDF"
                    >
                      <TbDownload size={18} strokeWidth={2.2} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "templates" && (
        <div className="space-y-4">
          {templates.length === 0 ? (
            <div className="neo-card p-12 text-center">
              <TbPhoto size={40} className="mx-auto text-[#9ca3af] mb-3" />
              <p className="text-[#5a5a5a] font-medium">Belum ada template</p>
              <p className="text-xs text-[#9ca3af] mt-1">Upload template PNG/JPG untuk sertifikat</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((tmpl) => (
                <div key={tmpl.id} className="neo-card p-4 space-y-3">
                  <div className="aspect-[1.414/1] rounded-lg border-2 border-[#1a1a1a] overflow-hidden bg-[#f5ede6]">
                    <img
                      src={toUploadDisplayUrl(tmpl.imageUrl)}
                      alt={tmpl.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-sm text-[#1a1a1a]">{tmpl.name}</p>
                      <p className="text-xs text-[#5a5a5a]">{typeLabels[tmpl.type] || tmpl.type}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      className="neo-btn p-2 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      title="Hapus template"
                    >
                      <TbTrash size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="neo-card w-full max-w-md p-4 sm:p-6 max-h-[90vh] overflow-y-auto bg-white shadow-[6px_6px_0px_#1a1a1a]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">Generate Sertifikat</h2>
              <button onClick={() => setShowModal(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0">
                <TbX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold block uppercase tracking-wider text-[#1a1a1a]">Tipe Sertifikat</label>
                <select
                  value={genType}
                  onChange={(e) => setGenType(e.target.value as GenerateType)}
                  className="neo-input w-full bg-white cursor-pointer"
                >
                  <option value="monthly-best">Asleb Terbaik Bulan Ini (otomatis pilih top 1)</option>
                  <option value="attendance-perfect">Kehadiran Sempurna</option>
                  <option value="mission-master">Mission Master (min. 10 misi)</option>
                </select>
              </div>

              {(genType === "monthly-best" || genType === "attendance-perfect") && (
                <div className="space-y-2">
                  <label className="text-sm font-bold block uppercase tracking-wider text-[#1a1a1a]">Bulan</label>
                  <input
                    type="month"
                    value={genMonth}
                    onChange={(e) => setGenMonth(e.target.value)}
                    className="neo-input w-full"
                  />
                </div>
              )}

              {(genType === "attendance-perfect" || genType === "mission-master") && (
                <div className="space-y-2">
                  <label className="text-sm font-bold block uppercase tracking-wider text-[#1a1a1a]">Asisten Lab</label>
                  <select
                    value={genUserId}
                    onChange={(e) => setGenUserId(e.target.value)}
                    className="neo-input w-full bg-white cursor-pointer"
                  >
                    <option value="">Pilih asisten...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t-2 border-[#1a1a1a]">
              <button onClick={() => setShowModal(false)} className="neo-btn px-4 py-2.5 flex-1 bg-white hover:bg-[#e8d8c9] transition-colors duration-200 font-bold">
                Batal
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="neo-btn bg-[#f3701e] hover:bg-[#d95f10] transition-colors duration-200 text-white px-4 py-2.5 flex-1 flex items-center justify-center gap-2 disabled:opacity-50 font-bold"
              >
                {generating ? <TbLoader2 className="w-5 h-5 animate-spin" strokeWidth={2.2} /> : <TbCertificate className="w-5 h-5" strokeWidth={2.2} />}
                {generating ? "Memproses..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { setShowTemplateModal(false); setTemplateFile(null); setTemplatePreview(null); }}>
          <div className="neo-card w-full max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto bg-white shadow-[6px_6px_0px_#1a1a1a]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">Upload Template Sertifikat</h2>
              <button onClick={() => { setShowTemplateModal(false); setTemplateFile(null); setTemplatePreview(null); }} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0">
                <TbX className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-bold block uppercase tracking-wider text-[#1a1a1a]">Nama Template</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Contoh: Template Asleb Terbaik 2025"
                  className="neo-input w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold block uppercase tracking-wider text-[#1a1a1a]">Tipe Sertifikat</label>
                <select
                  value={templateType}
                  onChange={(e) => setTemplateType(e.target.value)}
                  className="neo-input w-full bg-white cursor-pointer"
                >
                  <option value="MONTHLY_BEST">Asleb Terbaik</option>
                  <option value="ATTENDANCE_PERFECT">Kehadiran Sempurna</option>
                  <option value="MISSION_MASTER">Mission Master</option>
                  <option value="SKILL_MASTER">Skill Master</option>
                  <option value="SEMESTER_COMPLETION">Semester Selesai</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold block uppercase tracking-wider text-[#1a1a1a]">File Template (PNG/JPG)</label>
                <p className="text-xs text-[#5a5a5a] mb-2">
                  Upload gambar landscape A4. Sistem akan overlay: nama, tanggal, tipe sertifikat, dan tanda tangan koordinator.
                </p>
                <label className="neo-btn px-4 py-3 bg-[#f5ede6] hover:bg-[#e8d8c9] transition-colors cursor-pointer flex items-center justify-center gap-2 font-bold text-sm w-full">
                  <TbUpload size={18} strokeWidth={2.2} />
                  {templateFile ? templateFile.name : "Pilih File..."}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleTemplateFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {templatePreview && (
                <div className="aspect-[1.414/1] rounded-lg border-2 border-[#1a1a1a] overflow-hidden">
                  <img src={templatePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-8 pt-4 border-t-2 border-[#1a1a1a]">
              <button
                onClick={() => { setShowTemplateModal(false); setTemplateFile(null); setTemplatePreview(null); }}
                className="neo-btn px-4 py-2.5 flex-1 bg-white hover:bg-[#e8d8c9] transition-colors duration-200 font-bold"
              >
                Batal
              </button>
              <button
                onClick={handleUploadTemplate}
                disabled={uploading || !templateFile || !templateName}
                className="neo-btn bg-[#4b607f] hover:bg-[#3d4f66] transition-colors duration-200 text-white px-4 py-2.5 flex-1 flex items-center justify-center gap-2 disabled:opacity-50 font-bold"
              >
                {uploading ? <TbLoader2 className="w-5 h-5 animate-spin" strokeWidth={2.2} /> : <TbUpload className="w-5 h-5" strokeWidth={2.2} />}
                {uploading ? "Mengupload..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
