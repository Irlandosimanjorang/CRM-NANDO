import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  Loader2, Users, CalendarCheck, Swords, CalendarClock, Lightbulb, Send, Calendar, Bot,
  MapPin, Mic, Trophy, Check, X, ArrowRight,
} from "lucide-react";
import { NextoBadge } from "./App";

const FEATURES = [
  { icon: Lightbulb, title: "AI Advisor", desc: "Rekomendasi lead potensial tiap pagi." },
  { icon: Send, title: "Bot Telegram", desc: "Update lead & progress langsung via chat, tanpa buka app." },
  { icon: MapPin, title: "Check-in GPS", desc: "Bukti kunjungan asli, otomatis kedeteksi jarak lokasi." },
  { icon: Mic, title: "Rekam Meeting", desc: "Rekam obrolan, otomatis jadi catatan rapi + next action." },
  { icon: Calendar, title: "Google Calendar", desc: "Jadwal visit otomatis masuk ke kalender kamu." },
  { icon: Trophy, title: "Deal Multi-Transaksi", desc: "Repeat order kehitung semua, gak ketimpa yang lama." },
  { icon: Users, title: "Kelola Leads", desc: "Prospek tersusun rapi dalam satu pipeline." },
  { icon: CalendarCheck, title: "Jadwal Visit", desc: "Catat kunjungan tanpa ada yang kelewat." },
  { icon: Swords, title: "Analisa Kompetitor", desc: "Data pesaing buat strategi lebih tajam." },
];

const STEPS = [
  { n: "1", title: "Daftar, pipeline langsung siap", desc: "Gak perlu setting apa-apa — begitu daftar, tahap pipeline default udah kebentuk otomatis." },
  { n: "2", title: "Masukin lead kamu", desc: "Tambah manual atau import langsung dari Excel, sistem baca sendiri format kolomnya." },
  { n: "3", title: "Kelola dari chat & web", desc: "Update progress lewat Telegram sambil di jalan, atau buka web pas mau lihat laporan lengkap." },
];

const FREE_FEATURES = ["Dashboard", "Kelola Leads"];
const PREMIUM_FEATURES = ["Semua fitur di paket Free", "Deal & tracking transaksi", "Visit & Follow-up + Check-in GPS", "Rekam Meeting otomatis", "Analisa Kompetitor", "AI Advisor harian", "Bot Telegram (agent aktif)", "Sinkron Google Calendar", "Nex — komunitas sesama sales"];

const FAQS = [
  { q: "Trial-nya berapa lama?", a: "30 hari penuh, semua fitur kebuka gratis. Gak perlu kartu kredit buat mulai." },
  { q: "Abis trial gimana kalau belum upgrade?", a: "Akun kamu otomatis turun ke paket Free — data kamu tetap aman, cuma akses fiturnya dibatasi ke Dashboard & Leads doang." },
  { q: "Bisa berhenti kapan aja?", a: "Bisa. Gak ada kontrak/kunci jangka panjang." },
  { q: "Data aku aman gak?", a: "Data kamu terkunci per akun, gak bisa diakses akun lain. Disimpen di infrastruktur cloud yang sama dipakai banyak aplikasi bisnis lainnya." },
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

  const CARD = "bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <NextoBadge size={32} />
            <div className="font-bold tracking-tight text-base">Nexto</div>
          </div>
          <a href="#daftar" className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-4 py-2 rounded-xl font-medium">Masuk / Daftar</a>
        </div>
      </header>

      {/* HERO */}
      <section className="text-white" style={{ background: "#1c1917" }}>
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-widest mb-4">CRM Sales B2B + AI</div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-5 max-w-2xl">Satu tempat buat semua urusan sales kamu.</h1>
          <p className="text-stone-400 text-sm md:text-base mb-8 max-w-xl leading-relaxed">Dari lead pertama masuk sampai deal closing — kelola pipeline, update progress lewat chat Telegram, dan biarin AI bantu nyaranin lead mana yang harus dikejar duluan.</p>
          <div className="flex flex-wrap items-center gap-3">
            <a href="#daftar" className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-6 py-3 rounded-xl font-medium flex items-center gap-2">Daftar Gratis, Trial 30 Hari <ArrowRight size={15} /></a>
            <a href="#harga" className="text-stone-300 hover:text-white text-sm px-4 py-3">Lihat harga →</a>
          </div>
        </div>
      </section>

      {/* FITUR */}
      <section id="fitur" className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Fitur yang beneran kepake</h2>
          <p className="text-sm text-slate-500">Bukan cuma nyimpen kontak — Nexto bantu kerjaan sales sehari-hari.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {FEATURES.map((f, i) => {
            const I = f.icon;
            return (
              <div key={i} className={`${CARD} p-5`}>
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3"><I size={18} /></div>
                <div className="font-semibold text-sm mb-1">{f.title}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{f.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CARA KERJA */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Mulainya gampang</h2>
            <p className="text-sm text-slate-500">3 langkah, gak ada setup ribet.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="w-9 h-9 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-sm mb-3">{s.n}</div>
                <div className="font-semibold text-sm mb-1.5">{s.title}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HARGA */}
      <section id="harga" className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Harga simpel, gak pake ribet</h2>
          <p className="text-sm text-slate-500">Mulai gratis, upgrade kapan aja kamu siap.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
          <div className={`${CARD} p-6`}>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Free</div>
            <div className="text-3xl font-bold mb-1">Rp0</div>
            <div className="text-xs text-slate-400 mb-5">Selamanya gratis</div>
            <ul className="space-y-2.5 mb-6">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600"><Check size={15} className="text-emerald-500 shrink-0" /> {f}</li>
              ))}
            </ul>
            <a href="#daftar" className="block text-center w-full border border-slate-300 hover:bg-slate-50 text-sm py-2.5 rounded-xl font-medium">Mulai Gratis</a>
          </div>
          <div className={`${CARD} p-6 border-orange-300 relative overflow-hidden`}>
            <div className="absolute top-0 right-0 bg-orange-600 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">TRIAL 30 HARI</div>
            <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">Premium</div>
            <div className="text-3xl font-bold mb-1">Rp149rb<span className="text-sm font-normal text-slate-400">/bulan</span></div>
            <div className="text-xs text-slate-400 mb-5">Akses semua fitur</div>
            <ul className="space-y-2.5 mb-6">
              {PREMIUM_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-600"><Check size={15} className="text-emerald-500 shrink-0" /> {f}</li>
              ))}
            </ul>
            <a href="#daftar" className="block text-center w-full bg-orange-600 hover:bg-orange-700 text-white text-sm py-2.5 rounded-xl font-medium">Coba 30 Hari Gratis</a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-16 md:py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8 text-center">Pertanyaan yang sering ditanyain</h2>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={i} className={`${CARD} p-5`}>
                <div className="font-semibold text-sm mb-1.5">{f.q}</div>
                <div className="text-xs text-slate-500 leading-relaxed">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FORM DAFTAR / MASUK */}
      <section id="daftar" className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-20">
        <div className="max-w-sm mx-auto">
          <div className={`${CARD} p-7`}>
            <div className="flex items-center gap-2.5 mb-5">
              <NextoBadge size={36} />
              <div className="leading-tight"><div className="font-bold tracking-tight">Nexto</div></div>
            </div>
            <div className="text-[11px] font-semibold text-orange-600 uppercase tracking-widest mb-2">Nexto CRM</div>
            <h3 className="text-xl font-bold mb-1">{mode === "signin" ? "Selamat datang kembali" : "Buat akun baru"}</h3>
            <p className="text-xs text-slate-400 mb-5">{mode === "signin" ? "Masuk buat akses pipeline-mu." : "Gratis, trial 30 hari, gak perlu kartu kredit."}</p>
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
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2"><NextoBadge size={20} /> Nexto CRM</div>
          <div>© {new Date().getFullYear()} Nexto. Dibuat buat sales B2B Indonesia.</div>
        </div>
      </footer>
    </div>
  );
}
