import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { Loader2, Users, CalendarCheck, Swords, CalendarClock, Lightbulb, Send, Calendar, Bot } from "lucide-react";
import { NextoBadge } from "./App";

const FEATURES = [
  { icon: Lightbulb, title: "AI Advisor" },
  { icon: Bot, title: "AI Asisten" },
  { icon: Send, title: "Bot Telegram" },
  { icon: Calendar, title: "Google Calendar" },
  { icon: Users, title: "Kelola Leads" },
  { icon: CalendarCheck, title: "Jadwal Visit" },
  { icon: Swords, title: "Analisa Kompetitor" },
  { icon: CalendarClock, title: "Follow-up Otomatis" },
];

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setMsg(""); setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        setMsg("Akun dibuat. Cek email buat verifikasi (kalau confirm email aktif), lalu masuk.");
      }
    } catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="h-screen overflow-hidden bg-white flex">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-12 xl:px-16 bg-slate-50 border-r border-slate-200">
        <div className="flex items-center gap-2.5 mb-10">
          <NextoBadge size={32} />
          <div className="font-bold tracking-tight text-lg text-slate-900">Nexto</div>
        </div>
        <h2 className="text-2xl xl:text-3xl font-bold tracking-tight mb-2 leading-snug text-slate-900">Satu tempat buat semua urusan sales kamu.</h2>
        <p className="text-sm text-slate-500 mb-10">Dari lead pertama masuk sampai deal closing, semua kepantau di sini.</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {FEATURES.map((f, i) => {
            const I = f.icon;
            return (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0"><I size={16} /></div>
                <span className="text-sm font-medium text-slate-700">{f.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <NextoBadge size={40} />
            <div className="leading-tight"><div className="font-bold tracking-tight">Nexto</div></div>
          </div>
          <div className="text-[11px] font-semibold text-orange-600 uppercase tracking-widest mb-2">Nexto CRM</div>
          <h1 className="text-2xl font-bold mb-1.5 text-slate-900">{mode === "signin" ? "Selamat datang kembali" : "Buat akun baru"}</h1>
          <p className="text-sm text-slate-400 mb-7">{mode === "signin" ? "Masuk buat akses pipeline-mu." : "Bikin akun buat mulai."}</p>
          <div className="space-y-3.5">
            <input className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            {msg && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2.5">{msg}</div>}
            <button onClick={submit} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors">{loading ? <Loader2 size={15} className="animate-spin" /> : null} {mode === "signin" ? "Masuk" : "Daftar"}</button>
            <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(""); }} className="w-full text-xs text-slate-400 hover:text-slate-700 transition-colors">
              {mode === "signin" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
