"use client";

import { FormEvent, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { TbArrowLeft, TbCheck, TbChecks, TbHandStop, TbLoader2, TbMessageCircle, TbSend } from "react-icons/tb";
import api from "@/services/api";
import { useSupportChatStream } from "@/components/notifications/support-chat-stream";
import type { ApiResponse, SupportChat, SupportChatMessage, SupportChatStatus } from "@/types";

type UserContext = { id?: string; role?: string };
function errorText(error: unknown): string { return error instanceof Error ? error.message : "Terjadi kesalahan. Coba lagi."; }
function errorStatus(error: unknown): number | undefined { return error instanceof Error ? (error as Error & { status?: number }).status : undefined; }

export default function SupportChatDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [chat, setChat] = useState<SupportChat | null>(null);
  const [user, setUser] = useState<UserContext>({});
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const loadingRef = useRef(false);
  const acknowledgedDeliveredRef = useRef<Set<string>>(new Set());
  const acknowledgedReadRef = useRef<Set<string>>(new Set());

  const loadChat = useCallback(async (showLoading = true) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (showLoading) setLoading(true);
    setError("");
    try {
      const response = await api.get<ApiResponse<SupportChat>>(`/support-chats/${id}`);
      setChat(response.data);
    } catch (loadError) {
      setError(errorStatus(loadError) === 403 ? "Chat ini sudah tidak dapat kamu akses." : errorText(loadError));
    } finally {
      loadingRef.current = false;
      if (showLoading) setLoading(false);
    }
  }, [id]);

  const handleStreamEvent = useCallback(
    (event: { event: string; chatId: string }) => {
      if (event.chatId !== id) return;
      if (
        event.event === "support-chat.created" ||
        event.event === "support-chat.claimed" ||
        event.event === "support-chat.message"
      ) {
        void loadChat(false);
      }
    },
    [id, loadChat],
  );

  const { isStreamConnected } = useSupportChatStream(handleStreamEvent);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        setUser(JSON.parse(localStorage.getItem("user") || "{}") as UserContext);
      } catch {
        setUser({});
      }
      void loadChat();
    });

    const refreshWhenFocused = () => {
      if (document.visibilityState === "visible") void loadChat(false);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadChat(false);
    };

    let interval: number | undefined;
    if (!isStreamConnected) {
      interval = window.setInterval(() => {
        if (document.visibilityState === "visible") void loadChat(false);
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
  }, [loadChat, isStreamConnected]);

  const messages = useMemo(() => chat?.messages ?? [], [chat?.messages]);
  const isAssistant = user.role === "ASISTEN_LAB";
  const isOwnerAssistant = Boolean(
    isAssistant && chat && chat.assignedAssistantId === user.id,
  );
  const canClaim = Boolean(
    isAssistant && chat && chat.status === "WAITING",
  );

  const waitingCopy = isAssistant
    ? chat?.status === "WAITING"
      ? "Chat tersedia untuk semua asisten lab aktif. Klik 'Ambil Chat' untuk mulai menangani."
      : isOwnerAssistant
        ? "Kamu sedang menangani chat ini."
        : `Chat sedang ditangani oleh ${chat?.assistant?.name || "asisten lab"}.`
    : chat?.status === "WAITING"
      ? "Pesanmu sudah diterima dan diteruskan ke seluruh asisten lab aktif."
      : `Asisten lab (${chat?.assistant?.name || "Asisten"}) sedang menangani chat ini.`;

  useEffect(() => {
    if (!chat || !chat.messages || !user.id) return;

    const incomingMessages = chat.messages.filter(
      (m) => m.senderId !== user.id,
    );

    for (const message of incomingMessages) {
      if (!message.deliveredAt && !acknowledgedDeliveredRef.current.has(message.id)) {
        acknowledgedDeliveredRef.current.add(message.id);
        void api.patch(`/support-chats/${id}/messages/${message.id}/receipt`, { status: "DELIVERED" }).catch(() => {
          acknowledgedDeliveredRef.current.delete(message.id);
        });
      }

      if (!message.readAt && !acknowledgedReadRef.current.has(message.id)) {
        acknowledgedReadRef.current.add(message.id);
        void api.patch(`/support-chats/${id}/messages/${message.id}/receipt`, { status: "READ" }).catch(() => {
          acknowledgedReadRef.current.delete(message.id);
        });
      }
    }
  }, [chat, id, user.id]);

  const claimChat = async () => {
    if (claiming) return;
    setClaiming(true);
    setSendError("");
    try {
      const response = await api.post<ApiResponse<SupportChat>>(`/support-chats/${id}/claim`, {});
      setChat(response.data);
    } catch (claimFailure) {
      const status = errorStatus(claimFailure);
      if (status === 409) {
        setSendError("Chat ini sudah diambil oleh asisten lain.");
        await loadChat(false);
      } else {
        setSendError(errorText(claimFailure));
      }
    } finally {
      setClaiming(false);
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || sending) return;

    if (isAssistant && !isOwnerAssistant) {
      setSendError("Kamu harus mengambil chat terlebih dahulu sebelum membalas.");
      return;
    }

    setSending(true);
    setSendError("");
    try {
      const response = await api.post<ApiResponse<Omit<SupportChatMessage, "chatStatus"> & { chatStatus: SupportChatStatus }>>(
        `/support-chats/${id}/messages`,
        { body: trimmed },
      );
      setBody("");
      setChat((current) =>
        current
          ? {
              ...current,
              status: response.data.chatStatus,
              messages: [...(current.messages ?? []), response.data],
              lastMessage: response.data,
            }
          : current,
      );
    } catch (sendFailure) {
      const status = errorStatus(sendFailure);
      if (status === 409) {
        setSendError("Chat ini sudah diambil asisten lain. Pesanmu tidak terkirim; status chat akan diperbarui.");
        await loadChat(false);
      } else {
        setSendError(errorText(sendFailure));
      }
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div role="status" className="neo-card p-10 text-center text-[#4b607f]">
        <TbLoader2 className="mx-auto mb-2 animate-spin" size={26} />
        Memuat chat...
      </div>
    );
  }

  if (error || !chat) {
    return (
      <div className="neo-card space-y-3 bg-red-50 p-6 text-red-800">
        <p className="font-bold">Chat tidak dapat dibuka</p>
        <p className="text-sm">{error || "Chat tidak ditemukan."}</p>
        <Link href="/support-chats" className="neo-btn inline-flex min-h-11 items-center bg-white px-4">
          Kembali
        </Link>
      </div>
    );
  }

  const canSendMessage = !isAssistant || isOwnerAssistant;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-9rem)] max-w-3xl flex-col gap-4">
      <Link href="/support-chats" className="neo-btn inline-flex min-h-11 w-fit items-center gap-2 bg-white px-4">
        <TbArrowLeft /> Semua chat
      </Link>
      <section className="neo-card flex min-h-[560px] flex-1 flex-col overflow-hidden bg-white p-0">
        <header className="border-b-2 border-[#1a1a1a] bg-[#f5ede6] p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4b607f] text-white neo-border-sm">
                <TbMessageCircle size={22} />
              </div>
              <div className="min-w-0">
                <h1 className="truncate font-heading text-xl font-bold">
                  {chat.pc.name} <span className="text-sm font-medium text-[#4b607f]">({chat.pc.pcCode})</span>
                </h1>
                <p className="truncate text-sm font-semibold text-[#4b607f]">
                  {chat.lab.name} · {isAssistant ? chat.student?.name || "Mahasiswa" : chat.assistant?.name || "Asisten Lab"}
                </p>
              </div>
            </div>
            {canClaim && (
              <button
                type="button"
                onClick={() => void claimChat()}
                disabled={claiming}
                className="neo-btn flex min-h-11 items-center gap-2 bg-[#f3701e] px-4 font-bold text-white"
              >
                {claiming ? <TbLoader2 className="animate-spin" /> : <TbHandStop size={18} />}
                Ambil Chat
              </button>
            )}
          </div>
          <p className="mt-3 rounded-lg border-2 border-[#4b607f] bg-white p-3 text-sm font-semibold text-[#4b607f]" role="status">
            {waitingCopy}
          </p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-5" aria-live="polite">
          {messages.length === 0 && (
            <p className="py-12 text-center text-sm text-[#5a5a5a]">Belum ada pesan. Tulis pertanyaan pertama.</p>
          )}
          {messages.map((message) => {
            const mine = message.senderId === user.id;
            const showTicks = mine;
            const isRead = Boolean(message.readAt);
            const isDelivered = Boolean(message.deliveredAt);

            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[88%] rounded-xl border-2 border-[#1a1a1a] p-3 shadow-[2px_2px_0_#1a1a1a] sm:max-w-[75%] ${
                    mine ? "bg-[#f3701e] text-white" : "bg-[#f5ede6]"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                  <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] opacity-80">
                    <time>
                      {new Date(message.createdAt).toLocaleString("id-ID", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </time>
                    {showTicks && (
                      <span
                        className="inline-flex items-center"
                        title={
                          isRead
                            ? `Dibaca: ${new Date(message.readAt!).toLocaleTimeString("id-ID")}`
                            : isDelivered
                              ? `Terkirim: ${new Date(message.deliveredAt!).toLocaleTimeString("id-ID")}`
                              : "Terkirim ke server"
                        }
                        aria-label={isRead ? "Dibaca" : isDelivered ? "Terkirim" : "Menunggu"}
                      >
                        {isRead ? (
                          <TbChecks className={mine ? "text-cyan-200" : "text-[#4b607f]"} size={15} />
                        ) : isDelivered ? (
                          <TbCheck className="opacity-80" size={14} />
                        ) : null}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={sendMessage} className="border-t-2 border-[#1a1a1a] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={2000}
              rows={2}
              disabled={sending || !canSendMessage}
              aria-label="Pesan dukungan"
              placeholder={
                !canSendMessage
                  ? "Ambil chat terlebih dahulu untuk membalas..."
                  : "Tulis pesan..."
              }
              className="neo-input min-h-11 flex-1 resize-none"
            />
            <button
              type="submit"
              disabled={!body.trim() || sending || !canSendMessage}
              className="neo-btn flex h-11 w-11 shrink-0 items-center justify-center bg-[#f3701e] p-0 text-white disabled:opacity-50"
              aria-label="Kirim pesan"
            >
              {sending ? <TbLoader2 className="animate-spin" /> : <TbSend />}
            </button>
          </div>
          {sendError && (
            <p role="alert" className="mt-2 text-sm font-bold text-red-700">
              {sendError}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
