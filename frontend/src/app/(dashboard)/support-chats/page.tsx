"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { TbChevronRight, TbLoader2, TbMessageCircle, TbRefresh } from "react-icons/tb";
import api from "@/services/api";
import { useSupportChatStream } from "@/components/notifications/support-chat-stream";
import type { ApiResponse, SupportChat, SupportChatStatus } from "@/types";

const statusLabel: Record<SupportChatStatus, string> = { WAITING: "Tersedia untuk dibalas", HANDLED: "Sedang ditangani" };
const statusClass: Record<SupportChatStatus, string> = { WAITING: "bg-[#f3701e] text-white", HANDLED: "bg-[#4b607f] text-white" };

function chatList(data: SupportChat[] | { items?: SupportChat[] }): SupportChat[] {
  return Array.isArray(data) ? data : data.items ?? [];
}

export default function SupportChatsPage() {
  const [chats, setChats] = useState<SupportChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadingRef = useRef(false);

  const loadChats = useCallback(async (showLoading = true) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (showLoading) setLoading(true);
    setError("");
    try {
      const response = await api.get<ApiResponse<SupportChat[] | { items?: SupportChat[] }>>(`/support-chats`);
      setChats(chatList(response.data));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chat belum dapat dimuat.");
    } finally {
      loadingRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, []);

  const handleStreamEvent = useCallback(
    (event: { event: string }) => {
      if (
        event.event === "support-chat.created" ||
        event.event === "support-chat.claimed" ||
        event.event === "support-chat.message"
      ) {
        void loadChats(false);
      }
    },
    [loadChats],
  );

  const { isStreamConnected } = useSupportChatStream(handleStreamEvent);

  useEffect(() => {
    queueMicrotask(() => void loadChats());
    const refreshWhenFocused = () => {
      if (document.visibilityState === "visible") void loadChats(false);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadChats(false);
    };

    let interval: number | undefined;
    if (!isStreamConnected) {
      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") void loadChats(false);
      }, 15_000);
    }

    window.addEventListener("focus", refreshWhenFocused);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
      window.removeEventListener("focus", refreshWhenFocused);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [loadChats, isStreamConnected]);

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
      <header className="flex items-start justify-between gap-3 border-b-2 border-[#1a1a1a] pb-4 sm:pb-6">
        <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#4b607f] text-white neo-border-sm"><TbMessageCircle size={26} /></div><div><h1 className="font-heading text-2xl font-bold sm:text-3xl">Chat Dukungan</h1><p className="text-sm font-medium text-[#4b607f]">Tanya asisten tentang PC yang sedang kamu gunakan.</p></div></div>
        <button type="button" onClick={() => void loadChats()} aria-label="Muat ulang chat" className="neo-btn flex h-11 w-11 items-center justify-center bg-white p-0"><TbRefresh size={19} /></button>
      </header>

      {loading && <div role="status" className="neo-card flex items-center justify-center gap-2 bg-white p-10 text-[#4b607f]"><TbLoader2 className="animate-spin" /> Memuat chat...</div>}
      {error && !loading && <div role="alert" className="neo-card space-y-3 bg-red-50 p-6 text-red-800"><p className="font-bold">Chat belum dapat dimuat</p><p className="text-sm">{error}</p><button type="button" onClick={() => void loadChats()} className="neo-btn min-h-11 bg-white px-4">Coba lagi</button></div>}
      {!loading && !error && chats.length === 0 && <div className="neo-card bg-white p-10 text-center"><TbMessageCircle className="mx-auto mb-3 text-[#4b607f]" size={42} /><h2 className="font-heading text-xl font-bold">Belum ada chat</h2><p className="mt-1 text-sm text-[#5a5a5a]">Mulai chat dari halaman scan PC.</p></div>}
      {!loading && !error && chats.length > 0 && <div className="grid gap-3">{chats.map((chat) => {
        const participant = chat.assistant?.name || chat.student?.name || "Peserta chat";
        return <Link key={chat.id} href={`/support-chats/${chat.id}`} className="neo-card flex min-h-11 items-center gap-3 bg-white p-4 transition-transform hover:-translate-y-0.5 sm:p-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-lg font-bold">{chat.pc.name} <span className="text-sm font-medium text-[#4b607f]">({chat.pc.pcCode})</span></h2>
              <span className={`neo-badge px-2 py-1 text-xs font-bold ${statusClass[chat.status]}`}>{statusLabel[chat.status]}</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-[#4b607f]">{chat.lab.name} · {chat.status === "WAITING" ? "Menunggu asisten lab" : `Ditangani oleh ${participant}`}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="line-clamp-2 text-sm text-[#5a5a5a]">{chat.lastMessage?.body || "Belum ada pesan"}</p>
              {chat.lastMessage?.createdAt && (
                <time className="shrink-0 text-xs font-semibold text-[#4b607f]">
                  {new Date(chat.lastMessage.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                </time>
              )}
            </div>
          </div>
          <TbChevronRight className="shrink-0 text-[#f3701e]" size={24} /></Link>;
      })}</div>}
    </div>
  );
}
