import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2, ExternalLink } from "lucide-react";
import * as db from "../lib/db";

// Widget chat publik landing page - karyawan AI "SASA" (Customer Support).
// Ditaro cuma di Auth.jsx (halaman publik/marketing), bukan di app yang
// udah login. session_id acak disimpen di localStorage per browser visitor
// (BUKAN akun Nexto - visitor bisa nanya duluan sebelum daftar), dipake
// server buat rate limit & histori 1 sesi (lihat customer-chat edge
// function). Histori percakapan juga disimpen di localStorage biar gak
// ilang kalau visitor reload halaman.
const SESSION_KEY = "nexto_support_chat_session";
const HISTORY_KEY = "nexto_support_chat_history";

function getOrCreateSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch (_) {
    return crypto.randomUUID();
  }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveHistory(messages) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(messages)); } catch (_) {}
}

const GREETING = "Halo! Aku SASA, asisten Nexto. Ada yang mau ditanyain soal harga, fitur, atau cara mulai?";

export default function SupportChatWidget({ supportWaNumber, insideApp }) {
  // insideApp = dipasang di dalam app yang udah login (Settings.jsx), bukan
  // landing page publik - app punya nav bar bawah di mobile (App.jsx,
  // fixed bottom-3), jadi bubble & panelnya perlu naik dikit di mobile biar
  // gak ketiban, sama kayak tombol WA lama yang digantiin widget ini.
  const bubbleBottomClass = insideApp ? "bottom-20 md:bottom-5" : "bottom-5";
  const panelBottomClass = insideApp ? "bottom-36 md:bottom-20" : "bottom-20";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    const saved = loadHistory();
    return saved.length > 0 ? saved : [{ role: "assistant", content: GREETING }];
  });
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sessionIdRef = useRef(null);
  const scrollRef = useRef(null);

  if (!sessionIdRef.current) sessionIdRef.current = getOrCreateSessionId();

  useEffect(() => { saveHistory(messages); }, [messages]);

  useEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const result = await db.sendSupportChatMessage(sessionIdRef.current, text);
      setMessages((m) => [...m, { role: "assistant", content: result.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "Maaf, ada gangguan teknis sesaat. Coba lagi sebentar lagi ya, atau chat WhatsApp kami langsung." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`fixed ${bubbleBottomClass} right-5 z-[150] flex h-11 w-11 items-center justify-center rounded-full bg-orange-500 text-white shadow-[0_8px_30px_-8px_rgba(249,115,22,0.6)] transition-transform hover:scale-105 active:scale-95`}
        aria-label="Buka chat bantuan"
      >
        {open ? <X size={18} /> : <MessageCircle size={18} />}
      </button>

      {open && (
        <div className={`fixed ${panelBottomClass} right-5 z-[150] flex h-[min(480px,70vh)] w-[340px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0a0e16] shadow-2xl`}>
          <div className="flex items-center gap-2.5 border-b border-white/[0.08] bg-white/[0.02] px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/15">
              <MessageCircle size={15} className="text-orange-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-white">SASA · Nexto</div>
              <div className="text-[10px] text-slate-500">Biasanya balas dalam beberapa detik</div>
            </div>
          </div>

          {/* Jalan pintas ke manusia - selalu keliatan, gak nunggu SASA
              "nyerah" dulu baru nawarin. Visitor yang emang maunya chat
              orang langsung gak perlu mancing-mancing AI dulu. */}
          {supportWaNumber && (
            <a
              href={`https://wa.me/${supportWaNumber}?text=${encodeURIComponent("Halo, saya butuh bantuan soal Nexto CRM.")}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 border-b border-white/[0.08] bg-white/[0.015] py-2 text-[10.5px] font-medium text-emerald-400 transition-colors hover:bg-white/[0.03]"
            >
              Lebih suka chat orang langsung? <span className="underline">Via WhatsApp</span> <ExternalLink size={11} />
            </a>
          )}

          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3.5 py-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-orange-500 text-white"
                      : "rounded-bl-sm bg-white/[0.06] text-slate-200"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-white/[0.06] px-3.5 py-2.5 text-slate-400">
                  <Loader2 size={13} className="animate-spin" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-white/[0.08] p-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Tulis pertanyaan..."
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12.5px] text-white placeholder:text-slate-600 focus:border-orange-500/50 focus:outline-none"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white transition-opacity disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
