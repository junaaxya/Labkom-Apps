"use client";

import { useState, useEffect, useRef } from "react";
import { TbMessageCircle, TbSend, TbRobot, TbUser, TbLoader2, TbSparkles } from "react-icons/tb";
import api from "@/services/api";

interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  category?: string;
  confidence?: number;
  timestamp: Date;
}

interface FAQItem {
  category: string;
  question: string;
  answer: string;
}

export default function FAQPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "bot",
      content: "Halo! Saya Labkom Bot. Tanyakan apa saja tentang laboratorium komputer. Contoh:\n\n• Jam buka lab?\n• Cara pinjam kunci?\n• Cara lapor kerusakan?\n• Info WiFi lab?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [showFAQList, setShowFAQList] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchFAQs();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchFAQs = async () => {
    try {
      const res = await api.get<{ data: FAQItem[] }>("/faq/list");
      setFaqs(res.data);
    } catch {}
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post<{ data: { answer: string; category: string; confidence: number } }>("/faq/ask", {
        question: userMsg.content,
      });

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: res.data.answer,
        category: res.data.category,
        confidence: res.data.confidence,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "bot",
          content: "Maaf, terjadi kesalahan. Silakan coba lagi.",
          timestamp: new Date(),
        },
      ]);
    }

    setLoading(false);
  };

  const askQuickQuestion = (question: string) => {
    setInput(question);
    setShowFAQList(false);
  };

  const categories = [...new Set(faqs.map((f) => f.category))];

  return (
    <div className="min-h-[calc(100dvh-120px)] flex flex-col">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#1a1a1a]">FAQ Bot</h1>
          <p className="text-[#4b607f] mt-1 text-sm sm:text-lg">Tanya apa saja tentang lab</p>
        </div>
        <button
          onClick={() => setShowFAQList(!showFAQList)}
          className="neo-btn flex min-h-[44px] w-full items-center justify-center gap-2 bg-white px-5 py-2.5 sm:w-auto transition-all hover:-translate-y-1 hover:shadow-[4px_4px_0px_#1a1a1a]"
        >
          <TbMessageCircle strokeWidth={2.2} className="w-5 h-5 text-[#f3701e]" />
          <span className="font-bold text-[#1a1a1a]">{showFAQList ? "Kembali ke Chat" : "Daftar FAQ"}</span>
        </button>
      </div>

      {showFAQList ? (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:space-y-6 sm:pr-2">
          {categories.map((cat) => (
            <div key={cat} className="neo-card p-4 sm:p-6 bg-white shadow-[4px_4px_0px_#1a1a1a] neo-card-hover hover:-translate-y-1 transition-all duration-200">
              <div className="flex items-start gap-3 mb-4 border-b-2 border-[#1a1a1a]/10 pb-3">
                <div className="bg-[#f5ede6] p-2 rounded-lg border-2 border-[#1a1a1a]">
                  <TbMessageCircle strokeWidth={2.2} className="w-5 h-5 text-[#4b607f]" />
                </div>
                <h3 className="font-heading font-bold text-base sm:text-xl text-[#1a1a1a]">{cat}</h3>
              </div>
              <div className="space-y-3">
                {faqs
                  .filter((f) => f.category === cat)
                  .map((faq, i) => (
                    <button
                      key={i}
                      onClick={() => askQuickQuestion(faq.question)}
                      className="w-full min-h-[44px] text-left p-3 sm:p-4 rounded-xl border-2 border-[#1a1a1a] bg-[#fff8f0] hover:bg-[#f3701e] hover:text-white group transition-all duration-200 hover:-translate-y-1 shadow-[2px_2px_0px_#1a1a1a] hover:shadow-[4px_4px_0px_#1a1a1a] flex items-center justify-between"
                    >
                      <p className="font-bold text-sm leading-relaxed">{faq.question}</p>
                      <TbSend strokeWidth={2.2} className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0" />
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto neo-card p-0 flex flex-col bg-white shadow-[4px_4px_0px_#1a1a1a]">
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] flex items-center justify-center flex-shrink-0 mt-1 ${
                      msg.role === "bot" ? "bg-[#4b607f] text-white" : "bg-[#4b607f] text-white"
                    }`}
                  >
                    {msg.role === "bot" ? <TbRobot strokeWidth={2.2} className="w-5 h-5" /> : <TbUser strokeWidth={2.2} className="w-5 h-5" />}
                  </div>
                  <div
                    className={`max-w-[calc(100%-3rem)] sm:max-w-[75%] p-3 sm:p-4 border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] ${
                      msg.role === "bot" 
                        ? "bg-white text-[#1a1a1a] rounded-2xl rounded-tl-sm" 
                        : "bg-[#f3701e] text-white rounded-2xl rounded-tr-sm"
                    }`}
                  >
                    <p className={`text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "font-medium" : ""}`}>{msg.content}</p>
                    {msg.category && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-current/10">
                        <span className="text-xs font-bold px-3 py-1 rounded-md bg-[#f5ede6] border-2 border-[#1a1a1a] text-[#1a1a1a]">
                          {msg.category}
                        </span>
                        {msg.category === "AI" && (
                          <span className="text-xs font-bold px-3 py-1 rounded-md bg-[#4b607f] border-2 border-[#1a1a1a] text-white flex items-center gap-1">
                            <TbSparkles strokeWidth={2.2} className="w-3.5 h-3.5" /> AI
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] flex items-center justify-center bg-[#4b607f] text-white mt-1">
                    <TbRobot strokeWidth={2.2} className="w-5 h-5" />
                  </div>
                  <div className="p-4 rounded-2xl rounded-tl-sm border-2 border-[#1a1a1a] shadow-[2px_2px_0px_#1a1a1a] bg-white flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[#f3701e] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 rounded-full bg-[#f3701e] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 rounded-full bg-[#f3701e] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="border-t-2 border-[#1a1a1a] p-3 sm:p-5 bg-[#f5ede6] rounded-b-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ketik pertanyaan tentang lab..."
                  className="neo-input w-full flex-1 min-h-[50px] max-h-[120px] py-3 resize-none font-medium"
                  disabled={loading}
                  rows={1}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !input.trim()}
                  className="neo-btn bg-[#f3701e] text-white min-h-[50px] w-full px-6 flex items-center justify-center gap-2 sm:w-auto disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0px_#1a1a1a] group"
                >
                  {loading ? <TbLoader2 className="w-5 h-5 animate-spin" /> : <TbSend strokeWidth={2.2} className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  <span className="font-bold">Kirim</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
