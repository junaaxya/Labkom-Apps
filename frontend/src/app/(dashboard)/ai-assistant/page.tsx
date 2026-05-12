"use client";

import { useState, useRef, useEffect } from "react";
import {
  TbRobot,
  TbSend,
  TbTrash,
  TbBulb,
  TbLoader2,
  TbSparkles,
  TbUser,
} from "react-icons/tb";
import api from "@/services/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  context?: string;
  confidence?: number;
  sources?: string[];
  suggestions?: string[];
  timestamp: Date;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchInsights();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchInsights = async () => {
    try {
      const res = await api.get<{ data: string[] }>("/ai/insights");
      setInsights(res.data || []);
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post<{
        data: {
          answer: string;
          context: string;
          confidence: number;
          sources: string[];
          suggestions?: string[];
        };
      }>("/ai/chat", { message: userMsg.content });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.data.answer,
        context: res.data.context,
        confidence: res.data.confidence,
        sources: res.data.sources,
        suggestions: res.data.suggestions,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Maaf, terjadi kesalahan. Silakan coba lagi.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await api.delete("/ai/chat/history");
      setMessages([]);
    } catch {}
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[#1a1a1a] tracking-tight">
            AI Assistant
          </h1>
          <p className="text-[#4b607f] mt-1 text-sm sm:text-base leading-relaxed">
            Tanya apa saja tentang lab — status, jadwal, tiket, dan lainnya
          </p>
        </div>
        <button
          onClick={clearHistory}
          className="neo-btn flex items-center gap-2 px-4 min-h-[44px] bg-white text-[#1a1a1a] w-full sm:w-auto"
        >
          <TbTrash strokeWidth={2.2} className="w-4 h-4" />
          <span>Clear Chat</span>
        </button>
      </div>

      {insights.length > 0 && messages.length === 0 && (
        <div className="neo-card p-5 bg-[#fff8f0] border-[#f3701e] transition-all duration-200">
          <div className="flex items-center gap-2 mb-4">
            <TbBulb className="w-5 h-5 text-[#f3701e]" />
            <span className="font-bold font-heading text-lg text-[#1a1a1a]">Insights Terkini</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((insight, i) => (
              <div key={i} className="text-sm text-[#1a1a1a] bg-white neo-border-sm p-3 rounded-lg hover:shadow-[2px_2px_0px_#1a1a1a] hover:-translate-y-0.5 transition-all duration-200">
                {insight}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="neo-card p-0 flex flex-col shadow-[4px_4px_0px_#1a1a1a] transition-all duration-200" style={{ height: "calc(100dvh - 320px)", minHeight: "400px" }}>
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-20 h-20 bg-[#f5ede6] neo-border-sm flex items-center justify-center mb-4 shadow-[2px_2px_0px_#1a1a1a]">
                <TbRobot strokeWidth={2.2} className="w-10 h-10 text-[#4b607f]" />
              </div>
              <h3 className="font-heading font-bold text-xl sm:text-2xl text-[#1a1a1a] mb-2 tracking-tight">
                Halo! Saya Labkom AI Assistant
              </h3>
              <p className="text-[#4b607f] mb-6 sm:mb-8 max-w-md text-sm sm:text-base leading-relaxed">
                Saya bisa membantu kamu dengan informasi lab secara real-time.
                Coba tanyakan sesuatu!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
                {[
                  "Status lab sekarang",
                  "Jadwal hari ini",
                  "PC mana yang rusak?",
                  "Siapa yang belum absen?",
                  "Misi yang tersedia",
                  "Poin saya berapa?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestionClick(q)}
                    className="text-sm font-medium neo-border-sm p-3 rounded-xl bg-white hover:bg-[#f3701e] hover:text-white transition-all duration-200 text-left hover:-translate-y-1 shadow-[2px_2px_0px_#1a1a1a] hover:shadow-[4px_4px_0px_#1a1a1a]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full neo-border-sm bg-[#4b607f] flex items-center justify-center flex-shrink-0 mt-1 shadow-[2px_2px_0px_#1a1a1a]">
                  <TbSparkles strokeWidth={2.2} className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[75%] ${
                  msg.role === "user"
                    ? "neo-border-sm bg-[#f3701e] text-white p-4 rounded-2xl rounded-tr-sm shadow-[2px_2px_0px_#1a1a1a]"
                    : "neo-border-sm bg-white text-[#1a1a1a] p-4 rounded-2xl rounded-tl-sm shadow-[2px_2px_0px_#1a1a1a]"
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
                {msg.confidence !== undefined && (
                  <div className="mt-3 flex items-center gap-2 text-xs opacity-80 pt-2 border-t border-current/10">
                    <span className="font-bold">Confidence: {Math.round(msg.confidence * 100)}%</span>
                    {msg.sources && <span>• {msg.sources.join(", ")}</span>}
                  </div>
                )}
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-current/10">
                    {msg.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(s)}
                        className="text-xs px-3 py-1.5 rounded-full bg-[#e8d8c9] text-[#1a1a1a] font-medium border-2 border-[#1a1a1a] hover:bg-[#f3701e] hover:text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[2px_2px_0px_#1a1a1a]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full neo-border-sm bg-[#4b607f] flex items-center justify-center flex-shrink-0 mt-1 shadow-[2px_2px_0px_#1a1a1a]">
                  <TbUser strokeWidth={2.2} className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full neo-border-sm bg-[#4b607f] flex items-center justify-center flex-shrink-0 mt-1 shadow-[2px_2px_0px_#1a1a1a]">
                <TbSparkles className="w-4 h-4 text-white" />
              </div>
              <div className="neo-border-sm bg-white p-4 rounded-2xl rounded-tl-sm shadow-[2px_2px_0px_#1a1a1a] flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-[#4b607f] animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[#4b607f] animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-[#4b607f] animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t-2 border-[#1a1a1a] p-3 sm:p-5 bg-white/50 backdrop-blur-sm rounded-b-xl">
          <div className="flex gap-2 sm:gap-3 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Tanya sesuatu tentang lab..."
              className="neo-input flex-1 min-h-[44px] max-h-[120px] py-3 resize-none text-sm sm:text-base"
              disabled={loading}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="neo-btn bg-[#f3701e] text-white p-3 min-h-[44px] min-w-[44px] flex items-center justify-center disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_#1a1a1a]"
            >
              <TbSend strokeWidth={2.2} className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
