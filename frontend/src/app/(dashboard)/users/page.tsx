"use client";

import { useState, useEffect, useCallback } from "react";
import { TbUserPlus, TbSearch, TbEdit, TbLock, TbToggleLeft, TbToggleRight, TbX } from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import { MobileCard } from "@/components/ui/mobile-card";

interface ApiRes<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface User {
  id: string;
  email: string;
  name: string;
  nim: string | null;
  nip: string | null;
  role: string;
  semester: string | null;
  className: string | null;
  isKetuaKelas: boolean;
  isActive: boolean;
  createdAt: string;
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  byRole: { role: string; count: number }[];
}

const ROLES = ["KOORDINATOR_LAB", "ASISTEN_LAB", "MAHASISWA"] as const;

const ROLE_LABELS: Record<string, string> = {
  KOORDINATOR_LAB: "Koordinator Lab",
  ASISTEN_LAB: "Asisten Lab",
  MAHASISWA: "Mahasiswa",
};

const ROLE_COLORS: Record<string, string> = {
  KOORDINATOR_LAB: "bg-[#f3701e] text-white",
  ASISTEN_LAB: "bg-[#4b607f] text-white",
  MAHASISWA: "bg-gray-200 text-gray-800",
};

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "15");
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);

      const res = await api.get<ApiRes<{ users: User[]; pagination: { totalPages: number } }>>(`/users?${params.toString()}`);
      if (res.success) {
        setUsers(res.data.users);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch {
      console.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  const fetchStats = async () => {
    try {
      const res = await api.get<ApiRes<UserStats>>("/users/stats");
      if (res.success) setStats(res.data);
    } catch {
      console.error("Failed to fetch stats");
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleToggleActive = async (u: User) => {
    try {
      await api.patch<ApiRes<User>>(`/users/${u.id}/toggle-active`, {});
      fetchUsers();
      fetchStats();
    } catch {
      console.error("Failed to toggle user");
      toast.error("Gagal mengubah status user");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-[family-name:var(--font-heading)] text-[#1a1a1a] mb-1">
            Manajemen User
          </h1>
          <p className="text-[#5a5a5a] text-sm">Kelola semua pengguna sistem Labkom</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="neo-btn flex items-center justify-center gap-2 bg-[#f3701e] text-white px-6 py-3 font-bold hover:bg-[#e05b0c] transition-colors"
        >
          <TbUserPlus className="w-5 h-5" strokeWidth={2.5} />
          Tambah User
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="neo-card p-5 bg-white neo-card-hover transition-all duration-200">
            <p className="text-3xl font-heading font-bold text-[#1a1a1a] leading-none mb-1">{stats.total}</p>
            <p className="text-sm font-bold text-[#5a5a5a]">Total User</p>
          </div>
          <div className="neo-card p-5 bg-white neo-card-hover transition-all duration-200">
            <p className="text-3xl font-heading font-bold text-green-600 leading-none mb-1">{stats.active}</p>
            <p className="text-sm font-bold text-[#5a5a5a]">Aktif</p>
          </div>
          <div className="neo-card p-5 bg-white neo-card-hover transition-all duration-200">
            <p className="text-3xl font-heading font-bold text-red-500 leading-none mb-1">{stats.inactive}</p>
            <p className="text-sm font-bold text-[#5a5a5a]">Nonaktif</p>
          </div>
          <div className="neo-card p-5 bg-white neo-card-hover transition-all duration-200 overflow-hidden">
            <p className="text-sm font-bold text-[#1a1a1a] mb-2">Berdasarkan Role</p>
            <div className="flex flex-col gap-1.5 overflow-y-auto max-h-12 scrollbar-hide">
              {stats.byRole.map((r) => (
                <div key={r.role} className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#5a5a5a]">{ROLE_LABELS[r.role]}</span>
                  <span className="font-bold text-[#1a1a1a] bg-[#f8f9fa] px-2 py-0.5 rounded-md neo-border-sm">{r.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="neo-card p-5 bg-white">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <TbSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#5a5a5a] w-5 h-5" strokeWidth={2.2} />
            <input
              type="text"
              placeholder="Cari nama, email, NIM..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="neo-input pl-12 py-3.5 w-full bg-white text-base focus:shadow-[4px_4px_0px_#4b607f] transition-all"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="neo-input py-3.5 px-4 w-full md:w-64 bg-white text-base focus:shadow-[4px_4px_0px_#4b607f] transition-all cursor-pointer"
          >
            <option value="">Semua Role</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="lg:hidden space-y-3">
        {loading ? (
          <div className="neo-card p-8 text-center text-[#5a5a5a] font-bold bg-white">Memuat data...</div>
        ) : users.length === 0 ? (
          <div className="neo-card p-10 text-center bg-white">
            <TbSearch className="w-10 h-10 text-[#4b607f]/40 mx-auto mb-3" strokeWidth={1.5} />
            <p className="font-bold text-[#1a1a1a] mb-1">Tidak ada user ditemukan</p>
            <p className="text-[#5a5a5a] text-sm">Coba gunakan kata kunci pencarian yang lain.</p>
          </div>
        ) : (
          users.map((user) => (
            <MobileCard
              key={user.id}
              title={
                <span className="flex items-center gap-2">
                  {user.name}
                  {user.isKetuaKelas && (
                    <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-md neo-border-sm font-bold uppercase tracking-wider">KK</span>
                  )}
                </span>
              }
              subtitle={user.email}
              badge={
                <span className={`text-xs px-2.5 py-1 rounded-lg font-bold neo-border-sm ${ROLE_COLORS[user.role]}`}>
                  {ROLE_LABELS[user.role]}
                </span>
              }
              fields={[
                {
                  label: "NIM/NIP",
                  value: <span className="font-mono font-bold bg-[#f5ede6] px-2 py-0.5 rounded neo-border-sm">{user.nim || user.nip || "-"}</span>,
                },
                {
                  label: "Status",
                  value: (
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-bold neo-border-sm ${user.isActive ? "bg-[#e8f5e9] text-green-800" : "bg-red-50 text-red-800"}`}>
                      <span className={`w-2 h-2 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`} />
                      {user.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  ),
                },
              ]}
              actions={[
                {
                  label: "Edit",
                  icon: <TbEdit className="w-4 h-4" />,
                  onClick: () => { setSelectedUser(user); setShowEditModal(true); },
                  variant: "secondary",
                },
                {
                  label: "Reset PW",
                  icon: <TbLock className="w-4 h-4" />,
                  onClick: () => { setSelectedUser(user); setShowResetModal(true); },
                  variant: "secondary",
                },
                {
                  label: user.isActive ? "Nonaktifkan" : "Aktifkan",
                  icon: user.isActive ? <TbToggleRight className="w-4 h-4 text-green-600" /> : <TbToggleLeft className="w-4 h-4 text-gray-400" />,
                  onClick: () => handleToggleActive(user),
                  variant: user.isActive ? "danger" : "success",
                },
              ]}
            />
          ))
        )}
      </div>

      <div className="hidden lg:block neo-card overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#4b607f] text-white border-b-2 border-[#1a1a1a]">
              <tr>
                <th className="p-4 font-heading font-bold whitespace-nowrap">Nama</th>
                <th className="p-4 font-heading font-bold whitespace-nowrap">Email</th>
                <th className="p-4 font-heading font-bold whitespace-nowrap">NIM/NIP</th>
                <th className="p-4 font-heading font-bold whitespace-nowrap">Role</th>
                <th className="p-4 font-heading font-bold whitespace-nowrap">Status</th>
                <th className="p-4 font-heading font-bold text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-[#1a1a1a]/10">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-[#5a5a5a] font-bold">Memuat data...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <TbSearch className="w-12 h-12 text-[#4b607f]/40 mb-3" strokeWidth={1.5} />
                      <p className="text-lg font-bold text-[#1a1a1a] mb-1">Tidak ada user ditemukan</p>
                      <p className="text-[#5a5a5a] text-sm">Coba gunakan kata kunci pencarian yang lain.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#f8f9fa] transition-colors group">
                    <td className="p-4 align-top">
                      <div className="font-bold text-[#1a1a1a] text-base">{user.name}</div>
                      {user.isKetuaKelas && (
                        <span className="inline-block mt-1 text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-md neo-border-sm font-bold uppercase tracking-wider">Ketua Kelas</span>
                      )}
                    </td>
                    <td className="p-4 text-[#5a5a5a] font-medium align-top">{user.email}</td>
                    <td className="p-4 align-top">
                      <span className="font-mono text-sm font-bold bg-[#f5ede6] px-2 py-1 rounded-md neo-border-sm text-[#1a1a1a]">{user.nim || user.nip || "-"}</span>
                    </td>
                    <td className="p-4 align-top">
                      <span className={`text-xs px-3 py-1.5 rounded-lg font-bold neo-border-sm whitespace-nowrap ${ROLE_COLORS[user.role]}`}>
                        {ROLE_LABELS[user.role]}
                      </span>
                    </td>
                    <td className="p-4 align-top">
                      <span className={`text-xs px-3 py-1.5 rounded-lg font-bold neo-border-sm whitespace-nowrap flex items-center w-fit gap-1.5 ${user.isActive ? "bg-[#e8f5e9] text-green-800" : "bg-red-50 text-red-800"}`}>
                        <span className={`w-2 h-2 rounded-full ${user.isActive ? "bg-green-500" : "bg-red-500"}`}></span>
                        {user.isActive ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="p-4 align-top">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setSelectedUser(user); setShowEditModal(true); }}
                          className="w-8 h-8 rounded-lg neo-border flex items-center justify-center bg-white hover:bg-[#e8d8c9] hover:shadow-[2px_2px_0px_#1a1a1a] hover:-translate-y-[2px] hover:-translate-x-[2px] transition-all"
                          title="Edit User"
                        >
                          <TbEdit className="w-4 h-4 text-[#1a1a1a]" strokeWidth={2.2} />
                        </button>
                        <button
                          onClick={() => { setSelectedUser(user); setShowResetModal(true); }}
                          className="w-8 h-8 rounded-lg neo-border flex items-center justify-center bg-white hover:bg-orange-100 hover:text-[#f3701e] hover:shadow-[2px_2px_0px_#f3701e] hover:-translate-y-[2px] hover:-translate-x-[2px] transition-all"
                          title="Reset Password"
                        >
                          <TbLock className="w-4 h-4" strokeWidth={2.2} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(user)}
                          className={`w-8 h-8 rounded-lg neo-border flex items-center justify-center bg-white hover:shadow-[2px_2px_0px_#1a1a1a] hover:-translate-y-[2px] hover:-translate-x-[2px] transition-all ${user.isActive ? "hover:bg-red-50" : "hover:bg-green-50"}`}
                          title={user.isActive ? "Nonaktifkan User" : "Aktifkan User"}
                        >
                          {user.isActive ? (
                            <TbToggleRight className="w-5 h-5 text-green-600" strokeWidth={2.2} />
                          ) : (
                            <TbToggleLeft className="w-5 h-5 text-gray-400" strokeWidth={2.2} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 md:px-6 bg-[#f8f9fa] border-t-2 border-[#1a1a1a]">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="neo-btn px-4 py-2 text-sm font-bold bg-white text-[#1a1a1a] disabled:opacity-50 hover:bg-[#e8d8c9] transition-colors"
            >
              Sebelumnya
            </button>
            <span className="text-sm font-bold text-[#1a1a1a] bg-white px-4 py-2 rounded-lg neo-border-sm">
              Halaman {page} dari {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="neo-btn px-4 py-2 text-sm font-bold bg-white text-[#1a1a1a] disabled:opacity-50 hover:bg-[#e8d8c9] transition-colors"
            >
              Selanjutnya
            </button>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="lg:hidden flex items-center justify-between p-4 neo-card bg-white">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="neo-btn px-4 py-2.5 text-sm font-bold bg-white text-[#1a1a1a] disabled:opacity-50"
          >
            Sebelumnya
          </button>
          <span className="text-sm font-bold text-[#1a1a1a]">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="neo-btn px-4 py-2.5 text-sm font-bold bg-white text-[#1a1a1a] disabled:opacity-50"
          >
            Selanjutnya
          </button>
        </div>
      )}

      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { setShowCreateModal(false); fetchUsers(); fetchStats(); }}
        />
      )}

      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
          onSuccess={() => { setShowEditModal(false); setSelectedUser(null); fetchUsers(); fetchStats(); }}
        />
      )}

      {showResetModal && selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          onClose={() => { setShowResetModal(false); setSelectedUser(null); }}
          onSuccess={() => { setShowResetModal(false); setSelectedUser(null); }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    email: "", password: "", name: "", nim: "", nip: "",
    role: "MAHASISWA" as string, semester: "", className: "", isKetuaKelas: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        email: form.email,
        password: form.password,
        name: form.name,
        role: form.role,
        isKetuaKelas: form.isKetuaKelas,
      };
      if (form.nim) payload.nim = form.nim;
      if (form.nip) payload.nip = form.nip;
      if (form.semester) payload.semester = form.semester;
      if (form.className) payload.className = form.className;

      const res = await api.post<ApiRes<User>>("/users", payload);
      if (res.success) onSuccess();
      else toast.error(res.message || "Gagal membuat user");
    } catch {
      toast.error("Gagal membuat user");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="neo-card p-4 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#e8d8c9] shadow-[8px_8px_0px_#1a1a1a]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold font-heading flex items-center gap-3 text-[#1a1a1a]">
            <div className="w-12 h-12 bg-white rounded-xl neo-border flex items-center justify-center shadow-[2px_2px_0px_#1a1a1a] flex-shrink-0">
              <TbUserPlus className="w-6 h-6 text-[#f3701e]" strokeWidth={2.2} />
            </div>
            Tambah User Baru
          </h2>
          <button type="button" onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-red-100 text-red-500 transition-colors flex-shrink-0">
            <TbX className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-xl neo-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Nama Lengkap *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white focus:shadow-[4px_4px_0px_#4b607f]" placeholder="Masukkan nama lengkap..." />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Email *</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white focus:shadow-[4px_4px_0px_#4b607f]" placeholder="email@contoh.com" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Password *</label>
              <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white focus:shadow-[4px_4px_0px_#4b607f]" placeholder="Minimal 6 karakter" />
            </div>
            <div className="col-span-1 sm:col-span-2">
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Role *</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white cursor-pointer focus:shadow-[4px_4px_0px_#4b607f]">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            
            <div className="col-span-1 sm:col-span-2 border-t-2 border-dashed border-gray-200 pt-4 mt-2">
              <p className="text-sm font-bold text-[#4b607f] mb-4">Data Akademik (Opsional)</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">NIM</label>
              <input type="text" value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white focus:shadow-[4px_4px_0px_#4b607f]" placeholder="Untuk mahasiswa" />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">NIP</label>
              <input type="text" value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white focus:shadow-[4px_4px_0px_#4b607f]" placeholder="Untuk staff" />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Semester</label>
              <input type="text" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white focus:shadow-[4px_4px_0px_#4b607f]" placeholder="Contoh: 4" />
            </div>
            <div>
              <label className="block text-sm font-bold text-[#1a1a1a] mb-2">Kelas</label>
              <input type="text" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white focus:shadow-[4px_4px_0px_#4b607f]" placeholder="Contoh: TI-2A" />
            </div>
            <div className="col-span-1 sm:col-span-2 bg-[#f8f9fa] p-4 rounded-xl neo-border mt-2">
              <label className="flex items-center gap-3 cursor-pointer w-fit">
                <input type="checkbox" checked={form.isKetuaKelas} onChange={(e) => setForm({ ...form, isKetuaKelas: e.target.checked })} className="w-5 h-5 accent-[#f3701e] border-2 border-[#1a1a1a] rounded cursor-pointer" />
                <span className="text-sm font-bold text-[#1a1a1a]">Tandai sebagai Ketua Kelas</span>
              </label>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t-2 border-dashed border-gray-200">
            <button type="button" onClick={onClose} className="neo-btn py-3.5 bg-[#f8f9fa] text-[#1a1a1a] flex-1 font-bold hover:bg-[#e8d8c9] transition-colors">Batal</button>
            <button type="submit" disabled={submitting} className="neo-btn bg-[#f3701e] text-white py-3.5 flex-1 font-bold disabled:opacity-50 hover:bg-[#e05b0c] transition-colors">
              {submitting ? "Menyimpan..." : "Simpan User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: user.name,
    email: user.email,
    nim: user.nim || "",
    nip: user.nip || "",
    role: user.role,
    semester: user.semester || "",
    className: user.className || "",
    isKetuaKelas: user.isKetuaKelas,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        isKetuaKelas: form.isKetuaKelas,
      };
      if (form.nim) payload.nim = form.nim;
      else payload.nim = null;
      if (form.nip) payload.nip = form.nip;
      else payload.nip = null;
      if (form.semester) payload.semester = form.semester;
      else payload.semester = null;
      if (form.className) payload.className = form.className;
      else payload.className = null;

      const res = await api.put<ApiRes<User>>(`/users/${user.id}`, payload);
      if (res.success) onSuccess();
      else toast.error(res.message || "Gagal mengupdate user");
    } catch {
      toast.error("Gagal mengupdate user");
    } finally {
      setSubmitting(false);
    }
  };

  const roleBadge: Record<string, string> = {
    KOORDINATOR_LAB: "bg-[#4b607f] text-white",
    ASISTEN_LAB: "bg-[#f3701e] text-white",
    MAHASISWA: "bg-emerald-500 text-white",
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="neo-card w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white shadow-[6px_6px_0px_#1a1a1a]" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 sm:px-6 py-4 bg-[#4b607f] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <TbEdit className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-heading text-lg font-bold text-white">Edit User</h2>
              <p className="text-xs text-white/70 truncate max-w-[180px] sm:max-w-full">{user.email}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="min-w-[44px] min-h-[44px] rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0">
            <TbX className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-[#1a1a1a]">Nama Lengkap</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white" placeholder="Masukkan nama lengkap" />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-[#1a1a1a]">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white" placeholder="email@labkom.ac.id" />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-[#1a1a1a]">Role</label>
              <div className="flex gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, role: r })}
                    className={`flex-1 py-2.5 rounded-xl border-2 border-[#1a1a1a] text-xs font-bold transition-all duration-150 ${
                      form.role === r
                        ? `${roleBadge[r]} shadow-[3px_3px_0px_#1a1a1a]`
                        : "bg-white text-[#5a5a5a] shadow-[2px_2px_0px_#1a1a1a] hover:-translate-y-0.5"
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t-2 border-dashed border-[#d5c4b5]">
            <p className="text-xs font-bold uppercase tracking-wider text-[#4b607f] mb-4">Data Akademik</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#1a1a1a]">NIM</label>
                <input type="text" value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white" placeholder="2210xxx" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#1a1a1a]">NIP</label>
                <input type="text" value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white" placeholder="19xxxx" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#1a1a1a]">Semester</label>
                <input type="text" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white" placeholder="4" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[#1a1a1a]">Kelas</label>
                <input type="text" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white" placeholder="TI-4A" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setForm({ ...form, isKetuaKelas: !form.isKetuaKelas })}
              className="flex items-center gap-3 cursor-pointer w-fit mt-4 p-3 rounded-xl bg-[#f5ede6] border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] hover:-translate-y-0.5 transition-transform"
            >
              <div className={`w-5 h-5 rounded-md border-2 border-[#1a1a1a] flex items-center justify-center transition-colors ${form.isKetuaKelas ? "bg-[#f3701e]" : "bg-white"}`}>
                {form.isKetuaKelas && <span className="text-white text-xs font-bold">✓</span>}
              </div>
              <span className="text-sm font-bold text-[#1a1a1a]">Ketua Kelas</span>
            </button>
          </div>

          <div className="flex gap-3 mt-6 pt-5 border-t-2 border-dashed border-[#d5c4b5]">
            <button type="button" onClick={onClose} className="neo-btn py-3 flex-1 bg-white text-[#1a1a1a] font-bold hover:bg-[#f5ede6] transition-colors">
              Batal
            </button>
            <button type="submit" disabled={submitting} className="neo-btn py-3 flex-1 bg-[#4b607f] hover:bg-[#3a4f6a] text-white font-bold disabled:opacity-50 transition-colors">
              {submitting ? "Memperbarui..." : "Simpan Perubahan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose, onSuccess }: { user: User; onClose: () => void; onSuccess: () => void }) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.patch<ApiRes<{ message: string }>>(`/users/${user.id}/reset-password`, { newPassword: password });
      if (res.success) onSuccess();
      else toast.error(res.message || "Gagal reset password");
    } catch {
      toast.error("Gagal reset password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="neo-card w-full max-w-sm max-h-[90vh] overflow-y-auto bg-white shadow-[6px_6px_0px_#1a1a1a]" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 sm:px-6 py-4 bg-[#f3701e] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <TbLock className="w-5 h-5 text-white" strokeWidth={2.2} />
            </div>
            <h2 className="font-heading text-lg font-bold text-white">Reset Password</h2>
          </div>
          <button type="button" onClick={onClose} className="min-w-[44px] min-h-[44px] rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors flex-shrink-0">
            <TbX className="w-5 h-5" strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="p-4 rounded-xl bg-[#f5ede6] border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] mb-5">
            <p className="text-xs text-[#5a5a5a] mb-0.5">Reset password untuk</p>
            <p className="font-heading font-bold text-[#1a1a1a]">{user.name}</p>
            <p className="text-xs text-[#5a5a5a]">{user.email}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-[#1a1a1a]">Password Baru</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="neo-input w-full px-4 py-3 min-h-[44px] bg-white" placeholder="Minimal 6 karakter" />
            </div>

            <div className="flex gap-3 pt-4 border-t-2 border-dashed border-[#d5c4b5]">
              <button type="button" onClick={onClose} className="neo-btn py-3 flex-1 bg-white text-[#1a1a1a] font-bold hover:bg-[#f5ede6] transition-colors">
                Batal
              </button>
              <button type="submit" disabled={submitting} className="neo-btn py-3 flex-1 bg-[#f3701e] hover:bg-[#d95f10] text-white font-bold disabled:opacity-50 transition-colors">
                {submitting ? "Memproses..." : "Reset Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
