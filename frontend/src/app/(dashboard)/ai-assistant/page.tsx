"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  TbAlertCircle, TbBulb, TbCheck, TbExternalLink, TbRefresh, TbRobot,
  TbSend, TbSparkles, TbThumbDown, TbThumbUp, TbTrash,
} from "react-icons/tb";
import api from "@/services/api";
import { useToast } from "@/providers/toast-provider";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface QuickAction { id: string; label: string; message: string; intent: string; href?: string; }
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  responseId?: string;
  context?: string;
  sources?: string[];
  suggestions?: string[];
  quickActions?: QuickAction[];
  failed?: boolean;
  feedback?: "UP" | "DOWN";
}
interface StoredTurn {
  responseId: string; user: string; assistant: string; intent: string; sources: string[];
  suggestions?: string[]; quickActions?: QuickAction[]; createdAt: string;
}
interface ChatResponse {
  responseId: string; answer: string; context: string; sources: string[];
  suggestions?: string[]; quickActions?: QuickAction[]; createdAt: string;
}

const FEEDBACK_REASONS = [
  ["INACCURATE", "Tidak akurat"], ["OUTDATED", "Sudah tidak relevan"],
  ["UNCLEAR", "Tidak jelas"], ["UNHELPFUL", "Tidak menjawab"], ["OTHER", "Lainnya"],
] as const;

export default function AIAssistantPage() {
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messageSequenceRef = useRef(0);

  const loadInitial = async () => {
    setHistoryLoading(true); setHistoryError(false);
    try {
      const [historyRes, actionsRes, insightsRes] = await Promise.all([
        api.get<{ data: StoredTurn[] }>("/ai/chat/history"),
        api.get<{ data: QuickAction[] }>("/ai/quick-actions"),
        api.get<{ data: string[] }>("/ai/insights").catch(() => ({ data: [] })),
      ]);
      setMessages(historyRes.data.flatMap((turn) => {
        const timestamp = new Date(turn.createdAt);
        return [
          { id: `${turn.responseId}-user`, role: "user" as const, content: turn.user, timestamp },
          { id: turn.responseId, responseId: turn.responseId, role: "assistant" as const, content: turn.assistant, context: turn.intent, sources: turn.sources, suggestions: turn.suggestions, quickActions: turn.quickActions, timestamp },
        ];
      }));
      setActions(actionsRes.data);
      setInsights(insightsRes.data);
    } catch (error) {
      setHistoryError(true);
      toast.error(error instanceof Error ? error.message : "Riwayat belum dapat dimuat");
    } finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    queueMicrotask(() => void loadInitial());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  useEffect(() => {
    const el = textareaRef.current; if (!el) return;
    el.style.height = "44px"; el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  const sendMessage = async (text?: string, actionId?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    messageSequenceRef.current += 1;
    const userId = `user-pending-${messageSequenceRef.current}`;
    setMessages((prev) => [...prev, { id: userId, role: "user", content, timestamp: new Date() }]);
    setInput(""); setLoading(true);
    try {
      const res = await api.post<{ data: ChatResponse }>("/ai/chat", actionId ? { actionId } : { message: content });
      setMessages((prev) => [...prev, {
        id: res.data.responseId, responseId: res.data.responseId, role: "assistant",
        content: res.data.answer, context: res.data.context, sources: res.data.sources,
        suggestions: res.data.suggestions, quickActions: res.data.quickActions,
        timestamp: new Date(res.data.createdAt),
      }]);
    } catch (error) {
      setMessages((prev) => prev.map((msg) => msg.id === userId ? { ...msg, failed: true } : msg));
      toast.error(error instanceof Error ? error.message : "Pesan belum dapat dikirim");
    } finally { setLoading(false); }
  };

  const retryMessage = (message: Message) => {
    setMessages((prev) => prev.filter((item) => item.id !== message.id));
    void sendMessage(message.content);
  };

  const clearHistory = async () => {
    setClearing(true);
    try { await api.delete("/ai/chat/history"); setMessages([]); setConfirmClear(false); toast.success("Riwayat percakapan dihapus"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Riwayat gagal dihapus"); }
    finally { setClearing(false); }
  };

  const submitFeedback = async (messageId: string, rating: "UP" | "DOWN", reason?: string) => {
    try {
      await api.post("/ai/feedback", { responseId: messageId, rating, reason });
      setMessages((prev) => prev.map((msg) => msg.responseId === messageId ? { ...msg, feedback: rating } : msg));
      setFeedbackTarget(null); toast.success("Terima kasih, feedback sudah dicatat");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Feedback gagal dikirim"); }
  };

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col gap-3 sm:gap-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-[#4b607f] shadow-[2px_2px_0_#1a1a1a]">
            <TbRobot className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div className="min-w-0"><h1 className="truncate font-heading text-xl font-bold sm:text-2xl">Asisten LabKom</h1><p className="truncate text-xs text-[#4b607f] sm:text-sm">Informasi lab berdasarkan hak akses akun</p></div>
        </div>
        <button type="button" onClick={() => setConfirmClear(true)} disabled={!messages.length} aria-label="Hapus riwayat percakapan" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-[#1a1a1a] bg-white disabled:opacity-40"><TbTrash className="h-5 w-5" /></button>
      </header>

      {insights.length > 0 && messages.length === 0 && !historyLoading && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Informasi terkini">
          {insights.map((insight) => <div key={insight} className="flex min-w-[240px] items-start gap-2 rounded-xl border-2 border-[#f3701e] bg-[#fff8f0] p-3 text-sm"><TbBulb className="mt-0.5 h-4 w-4 shrink-0 text-[#f3701e]" />{insight}</div>)}
        </div>
      )}

      <section className="neo-card flex min-h-[520px] flex-1 flex-col overflow-hidden p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-5" aria-live="polite">
          {historyLoading && <div role="status" className="flex h-full flex-col items-center justify-center gap-3 text-[#4b607f]"><TbSparkles className="h-8 w-8 animate-pulse" /><span>Memuat percakapan…</span></div>}
          {historyError && !historyLoading && <div role="alert" className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-xl border-2 border-red-400 bg-red-50 p-5 text-center"><TbAlertCircle className="h-8 w-8 text-red-600" /><strong>Riwayat belum dapat dimuat</strong><button onClick={() => void loadInitial()} className="neo-btn flex min-h-11 items-center gap-2 bg-white px-4"><TbRefresh /> Coba lagi</button></div>}
          {!historyLoading && !historyError && messages.length === 0 && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-2 text-center">
              <TbRobot className="mb-3 h-12 w-12 text-[#4b607f]" /><h2 className="font-heading text-xl font-bold">Apa yang ingin kamu cari?</h2><p className="mb-5 mt-1 max-w-sm text-sm text-[#4b607f]">Tanyakan jadwal, status fasilitas, tiket, atau panduan aplikasi.</p>
              <div className="flex w-full max-w-full snap-x gap-2 overflow-x-auto pb-3 sm:flex-wrap sm:justify-center">
                {actions.map((action) => <button key={action.id} onClick={() => void sendMessage(action.message, action.id)} className="min-h-11 shrink-0 snap-start rounded-full border-2 border-[#1a1a1a] bg-white px-4 text-sm font-semibold shadow-[2px_2px_0_#1a1a1a] hover:bg-[#f3701e] hover:text-white">{action.label}</button>)}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-2xl border-2 border-[#1a1a1a] px-3 py-2.5 shadow-[2px_2px_0_#1a1a1a] sm:max-w-[75%] sm:p-4 ${msg.role === "user" ? "rounded-tr-sm bg-[#f3701e] text-white" : "rounded-tl-sm bg-white"} ${msg.failed ? "border-red-600 bg-red-50 text-[#1a1a1a]" : ""}`}>
                {msg.role === "assistant" ? <div className="break-words text-sm leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>, strong: ({children}) => <strong>{children}</strong>, ul: ({children}) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>, ol: ({children}) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>, a: ({children,href}) => <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{children}</a>, table: ({children}) => <div className="overflow-x-auto"><table className="min-w-full">{children}</table></div>, pre: ({children}) => <pre className="overflow-x-auto rounded bg-slate-100 p-2">{children}</pre> }}>{msg.content}</ReactMarkdown></div> : <p className="whitespace-pre-wrap break-words text-sm">{msg.content}</p>}
                {msg.failed && <button onClick={() => retryMessage(msg)} className="mt-2 flex min-h-11 items-center gap-2 text-sm font-bold text-red-700"><TbRefresh /> Kirim ulang</button>}
                {msg.role === "assistant" && msg.sources?.length ? <details className="mt-3 border-t border-black/10 pt-2 text-xs"><summary className="cursor-pointer font-semibold text-[#4b607f]">Detail jawaban</summary><div className="mt-2 flex flex-wrap gap-1.5">{msg.sources.map((source) => <span key={source} className="rounded-full border border-[#4b607f] bg-[#f5ede6] px-2 py-1">{source}</span>)}</div></details> : null}
                {msg.role === "assistant" && msg.quickActions?.some((item) => item.href) ? <div className="mt-3 flex flex-wrap gap-2">{msg.quickActions.filter((item) => item.href).slice(0,2).map((item) => <Link key={item.id} href={item.href!} className="flex min-h-10 items-center gap-1 rounded-lg border-2 border-[#1a1a1a] bg-[#f5ede6] px-3 text-xs font-bold">{item.label}<TbExternalLink /></Link>)}</div> : null}
                {msg.role === "assistant" && msg.responseId && <div className="mt-2 flex items-center gap-1 border-t border-black/10 pt-2"><span className="mr-1 text-xs text-[#4b607f]">Membantu?</span><button aria-label="Jawaban membantu" aria-pressed={msg.feedback === "UP"} onClick={() => void submitFeedback(msg.responseId!, "UP")} disabled={Boolean(msg.feedback)} className={`flex h-11 w-11 items-center justify-center rounded-lg ${msg.feedback === "UP" ? "bg-green-100 text-green-700" : "hover:bg-green-50"}`}><TbThumbUp /></button><button aria-label="Jawaban tidak membantu" aria-pressed={msg.feedback === "DOWN"} onClick={() => setFeedbackTarget(msg.responseId!)} disabled={Boolean(msg.feedback)} className={`flex h-11 w-11 items-center justify-center rounded-lg ${msg.feedback === "DOWN" ? "bg-red-100 text-red-700" : "hover:bg-red-50"}`}><TbThumbDown /></button>{msg.feedback && <span className="ml-1 flex items-center gap-1 text-xs text-green-700"><TbCheck /> Terkirim</span>}</div>}
                {feedbackTarget === msg.responseId && <div className="mt-2 rounded-lg bg-red-50 p-2"><p className="mb-2 text-xs font-semibold">Apa yang kurang tepat?</p><div className="flex flex-wrap gap-2">{FEEDBACK_REASONS.map(([reason,label]) => <button key={reason} onClick={() => void submitFeedback(msg.responseId!, "DOWN", reason)} className="min-h-10 rounded-lg border border-red-300 bg-white px-3 text-xs">{label}</button>)}</div></div>}
              </div>
            </div>
          ))}

          {loading && <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-[#4b607f]"><TbSparkles className="h-5 w-5 animate-pulse" /><span>Sedang menyiapkan jawaban…</span></div>}
          <div ref={endRef} />
        </div>

        {!historyLoading && <div className="border-t-2 border-[#1a1a1a] bg-white p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:p-4">
          {actions.length > 0 && messages.length > 0 && <div className="mb-2 flex gap-2 overflow-x-auto pb-1">{actions.slice(0,5).map((action) => <button key={action.id} onClick={() => void sendMessage(action.message, action.id)} className="shrink-0 rounded-full border border-[#4b607f] px-3 py-1.5 text-xs font-semibold">{action.label}</button>)}</div>}
          <div className="flex items-end gap-2"><textarea ref={textareaRef} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Tanya sesuatu tentang lab…" maxLength={1000} rows={1} disabled={loading} aria-label="Pesan untuk Asisten LabKom" className="neo-input min-h-11 flex-1 resize-none py-2.5 text-base" /><button type="button" onClick={() => void sendMessage()} disabled={!input.trim() || loading} aria-label="Kirim pesan" className="neo-btn flex h-11 w-11 shrink-0 items-center justify-center bg-[#f3701e] p-0 text-white disabled:opacity-50"><TbSend /></button></div>
          {input.length >= 850 && <p className="mt-1 text-right text-xs text-[#4b607f]">{input.length}/1000</p>}
        </div>}
      </section>
      <ConfirmModal open={confirmClear} title="Hapus riwayat percakapan?" message="Riwayat AI pada akun ini akan dihapus. Tindakan ini tidak mengubah data LabKom lainnya." confirmLabel="Hapus riwayat" loading={clearing} onConfirm={() => void clearHistory()} onCancel={() => setConfirmClear(false)} />
    </div>
  );
}
