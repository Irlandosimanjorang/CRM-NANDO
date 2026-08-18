import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { Loader2, Users, CalendarCheck, Swords, CalendarClock, Lightbulb, Send, Calendar, Bot } from "lucide-react";
import { NextoBadge } from "./App";

const FEATURES = [
  { icon: Lightbulb, title: "AI Advisor", desc: "Rekomendasi lead potensial tiap pagi." },
  { icon: Bot, title: "AI Asisten", desc: "Ngobrol bebas soal pipeline kapan aja." },
  { icon: Send, title: "Bot Telegram", desc: "Tambah lead & catat progress via chat." },
  { icon: Calendar, title: "Google Calendar", desc: "Jadwal otomatis masuk ke calendar kamu." },
  { icon: Users, title: "Kelola Leads", desc: "Prospek tersusun rapi dalam satu pipeline." },
  { icon: CalendarCheck, title: "Jadwal Visit", desc: "Catat kunjungan tanpa ada yang kelewat." },
  { icon: Swords, title: "Analisa Kompetitor", desc: "Data pesaing buat strategi lebih tajam." },
  { icon: CalendarClock, title: "Follow-up Otomatis", desc: "Pengingat biar ga ada lead terabaikan." },
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
    <div className="h-screen overflow-hidden bg-slate-50 flex">
      <div className="hidden lg:flex lg:w-1/2 text-white flex-col justify-center px-8 xl:px-12 relative overflow-hidden" style={{ background: "#2b1710" }}>
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-28 -left-14 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5 mb-4">
            <NextoBadge size={32} />
            <div className="font-bold tracking-tight text-base">Nexto</div>
          </div>
          <h2 className="text-lg xl:text-xl font-bold tracking-tight mb-1 leading-snug">Satu tempat buat semua urusan sales kamu.</h2>
          <p className="text-xs text-orange-100/60 mb-5">Dari lead pertama masuk sampai deal closing, semua kepantau di sini.</p>
          <div className="grid grid-cols-2 gap-2.5">
            {FEATURES.map((f, i) => {
              const I = f.icon;
              return (
                <div key={i} className="rounded-xl p-3" style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.18)" }}>
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-300 flex items-center justify-center mb-2"><I size={16} /></div>
                  <div className="font-semibold text-sm mb-0.5">{f.title}</div>
                  <div className="text-xs text-orange-100/50 leading-snug">{f.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl shadow-sm p-7">
          <div className="flex items-center gap-2.5 mb-5 lg:hidden">
            <NextoBadge size={40} />
            <div className="leading-tight"><div className="font-bold tracking-tight">Nexto</div></div>
          </div>
          <div className="text-[11px] font-semibold text-orange-600 uppercase tracking-widest mb-2">Nexto CRM</div>
          <h1 className="text-xl font-bold mb-1">{mode === "signin" ? "Selamat datang kembali" : "Buat akun baru"}</h1>
          <p className="text-xs text-slate-400 mb-5">{mode === "signin" ? "Masuk buat akses pipeline-mu." : "Bikin akun buat mulai."}</p>
          <div className="space-y-3">
            <input className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            {msg && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2">{msg}</div>}
            <button onClick={submit} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm py-2.5 rounded-xl font-medium flex items-center justify-center gap-2">{loading ? <Loader2 size={15} className="animate-spin" /> : null} {mode === "signin" ? "Masuk" : "Daftar"}</button>
            <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(""); }} className="w-full text-xs text-slate-500 hover:text-slate-800">
              {mode === "signin" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
