import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Mic, MicOff, Volume2, VolumeX, Loader2, PhoneCall, PhoneOff } from "lucide-react";
import * as db from "../lib/db";

function useSpeechRecognition() {
  const recRef = useRef(null);
  const supported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const listenOnce = () => {
    return new Promise((resolve, reject) => {
      if (!supported) { reject(new Error("Browser ga dukung voice input")); return; }
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = "id-ID";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      let done = false;
      rec.onresult = (e) => { done = true; resolve(e.results[0][0].transcript); };
      rec.onerror = (e) => { if (!done) reject(new Error(e.error || "voice error")); };
      rec.onend = () => { if (!done) reject(new Error("no-speech")); };
      recRef.current = rec;
      rec.start();
    });
  };
  const abort = () => { try { recRef.current?.abort(); } catch (_) {} };

  return { supported, listenOnce, abort };
}

function speakAsync(text) {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || !text) { resolve(); return; }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.replace(/\*\*/g, "").replace(/[#*_`]/g, ""));
    utter.lang = "id-ID";
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang === "id-ID");
    if (idVoice) utter.voice = idVoice;
    utter.onend = resolve;
    utter.onerror = resolve;
    window.speechSynthesis.speak(utter);
  });
}

function renderText(text) {
  // render sederhana: **bold** jadi <b>, baris baru tetap
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>);
}

export default function ChatAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [callActive, setCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState(""); // "listening" | "thinking" | "speaking"
  const bottomRef = useRef(null);
  const callActiveRef = useRef(false);

  const { supported: micSupported, listenOnce, abort } = useSpeechRecognition();

  useEffect(() => { db.getChatHistory().then((rows) => setMessages(rows)).finally(() => setLoading(false)); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendText = async (text) => {
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const reply = await db.sendChatMessage(text);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      return reply;
    } catch (e) {
      const errMsg = "⚠️ Gagal dapat balasan: " + e.message;
      setMessages((m) => [...m, { role: "assistant", content: errMsg }]);
      return errMsg;
    } finally { setSending(false); }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const reply = await sendText(text);
    if (voiceOn) speakAsync(reply);
  };

  const callLoop = useCallback(async () => {
    while (callActiveRef.current) {
      setCallStatus("listening");
      let heard;
      try {
        heard = await listenOnce();
      } catch (e) {
        if (!callActiveRef.current) break;
        continue; // ga kedengeran apa-apa, coba dengerin lagi
      }
      if (!callActiveRef.current) break;
      if (!heard || !heard.trim()) continue;

      setCallStatus("thinking");
      const reply = await sendText(heard.trim());

      if (!callActiveRef.current) break;
      setCallStatus("speaking");
      await speakAsync(reply);
    }
    setCallStatus("");
  }, [listenOnce]);

  const startCall = () => {
    if (!micSupported) { alert("Browser kamu ga dukung voice input. Coba pakai Chrome."); return; }
    callActiveRef.current = true;
    setCallActive(true);
    callLoop();
  };
  const stopCall = () => {
    callActiveRef.current = false;
    setCallActive(false);
    setCallStatus("");
    abort();
    window.speechSynthesis.cancel();
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Bot size={20} className="text-orange-500" /><h1 className="text-2xl font-bold tracking-tight">Asisten Nexto</h1></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setVoiceOn((v) => !v)} className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-xl px-3 py-2 bg-white hover:bg-slate-50 text-slate-600">
            {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />} {voiceOn ? "Suara aktif" : "Suara mati"}
          </button>
          {micSupported && (
            callActive ? (
              <button onClick={stopCall} className="text-xs flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-3 py-2 font-medium">
                <PhoneOff size={14} /> Akhiri obrolan
              </button>
            ) : (
              <button onClick={startCall} className="text-xs flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl px-3 py-2 font-medium">
                <PhoneCall size={14} /> Mulai Ngobrol
              </button>
            )
          )}
        </div>
      </div>

      {callActive && (
        <div className="mb-3 bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center justify-center gap-3">
          <div className={`w-3 h-3 rounded-full ${callStatus === "listening" ? "bg-emerald-500 animate-pulse" : callStatus === "thinking" ? "bg-amber-500 animate-pulse" : callStatus === "speaking" ? "bg-orange-500 animate-pulse" : "bg-slate-300"}`} />
          <span className="text-sm font-medium text-orange-800">
            {callStatus === "listening" ? "Mendengarkan… silakan ngomong" : callStatus === "thinking" ? "Asisten lagi mikir…" : callStatus === "speaking" ? "Asisten lagi ngomong…" : "Menyiapkan…"}
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 space-y-3 mb-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-400 gap-2"><Loader2 size={16} className="animate-spin" /> Memuat percakapan…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-10">
            <Bot size={32} className="mx-auto text-slate-300 mb-3" />
            Tanya apa aja soal pipeline kamu, misalnya:<br />
            <span className="italic">"Minggu ini siapa yang harus gua hubungi?"</span>
            {micSupported && <div className="mt-3 text-xs">Atau klik <b>Mulai Ngobrol</b> buat obrolan suara hands-free.</div>}
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                {renderText(m.content)}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex items-center gap-2">
        <input
          className="flex-1 px-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={callActive ? "Lagi mode ngobrol suara…" : "Tanya sesuatu…"}
          disabled={callActive}
        />
        <button onClick={send} disabled={sending || callActive} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white p-2.5 rounded-xl">
          {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>
    </div>
  );
}
