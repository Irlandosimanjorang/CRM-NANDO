import { useState, useRef, useEffect } from "react";
import { Bot, Send, Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import * as db from "../lib/db";

function useSpeechRecognition(onResult) {
  const recRef = useRef(null);
  const [listening, setListening] = useState(false);
  const supported = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = () => {
    if (!supported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "id-ID";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => { const text = e.results[0][0].transcript; onResult(text); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };
  const stop = () => { recRef.current?.stop(); setListening(false); };

  return { supported, listening, start, stop };
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "id-ID";
  const voices = window.speechSynthesis.getVoices();
  const idVoice = voices.find((v) => v.lang === "id-ID");
  if (idVoice) utter.voice = idVoice;
  window.speechSynthesis.speak(utter);
}

export default function ChatAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const bottomRef = useRef(null);

  const { supported: micSupported, listening, start, stop } = useSpeechRecognition((text) => setInput(text));

  useEffect(() => { db.getChatHistory().then((rows) => setMessages(rows)).finally(() => setLoading(false)); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const reply = await db.sendChatMessage(text);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (voiceOn) speak(reply);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ Gagal dapat balasan: " + e.message }]);
    } finally { setSending(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-6rem)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2"><Bot size={20} className="text-orange-500" /><h1 className="text-2xl font-bold tracking-tight">Asisten Nexto</h1></div>
        <button onClick={() => setVoiceOn((v) => !v)} className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-xl px-3 py-2 bg-white hover:bg-slate-50 text-slate-600">
          {voiceOn ? <Volume2 size={14} /> : <VolumeX size={14} />} {voiceOn ? "Suara aktif" : "Suara mati"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4 space-y-3 mb-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-sm text-slate-400 gap-2"><Loader2 size={16} className="animate-spin" /> Memuat percakapan…</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-10">
            <Bot size={32} className="mx-auto text-slate-300 mb-3" />
            Tanya apa aja soal pipeline kamu, misalnya:<br />
            <span className="italic">"Minggu ini siapa yang harus gua hubungi?"</span>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                {m.content}
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
          placeholder="Tanya sesuatu…"
        />
        {micSupported && (
          <button onClick={listening ? stop : start} className={`p-2.5 rounded-xl border ${listening ? "bg-rose-500 border-rose-500 text-white animate-pulse" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {listening ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
        )}
        <button onClick={send} disabled={sending} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white p-2.5 rounded-xl">
          {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>
    </div>
  );
}
