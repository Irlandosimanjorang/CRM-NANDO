// Halaman demo PUBLIK: nexto.site/demo (18 Sep 2026, permintaan Nando: mau
// ada link demo "beneran" buat dilampirin ke proposal sales, yang bisa
// dibuka SIAPAPUN tanpa perlu daftar/login dulu). Dirender LANGSUNG dari
// main.jsx (sama pola kayak GrokBotMcp), jadi gak kena logika auth sama
// sekali.
//
// PENTING: ini TIRUAN tampilan doang, bukan app beneran - semua data di
// sini HARDCODE contoh (gak ada koneksi Supabase), dan semua aksi tulis
// (tambah lead, drag pindah stage, dst) di-intercept jadi alert() yang
// ngarahin ke daftar akun beneran - sama prinsipnya kayak dummy data yang
// pernah dipasang di TeamLeaderboard.jsx: aman dipamerin ke siapa aja tanpa
// resiko ke data asli, karena emang gak ada data asli yang disentuh di sini.
import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, Trophy, Bot, Sparkles, Flame, Phone, Mail,
  Plus, ArrowRight, ChevronDown, MessageSquareText, Percent, Pencil,
  Trash2, Wand2, Mic, MapPin, X,
} from "lucide-react";

const STAGE_META = {
  prospek: { label: "Prospek", hex: "#94a3b8" },
  kontak: { label: "Kontak", hex: "#60a5fa" },
  presentasi: { label: "Presentasi", hex: "#fbbf24" },
  negosiasi: { label: "Negosiasi", hex: "#f97316" },
  deal: { label: "Deal", hex: "#10b981" },
};

const DEMO_LEADS = [
  { id: 1, name: "PT Sinar Abadi Plastik", city: "Tangerang", product: "Resin PVC K67", priority: "high", stage: "negosiasi", value: 145000000 },
  { id: 2, name: "CV Karya Plastindo", city: "Bekasi", product: "Kabel Listrik NYA", priority: "medium", stage: "kontak", value: 62000000 },
  { id: 3, name: "PT Maju Bersama", city: "Surabaya", product: "Kompon PVC", priority: "high", stage: "presentasi", value: 98000000 },
  { id: 4, name: "UD Sumber Rejeki", city: "Semarang", product: "Pipa & Fitting", priority: "low", stage: "prospek", value: 34000000 },
  { id: 5, name: "PT Elang Duta Asia", city: "Jakarta", product: "Kabel Listrik NYY", priority: "high", stage: "deal", value: 210000000 },
  { id: 6, name: "PT Karya Linar", city: "Cikarang", product: "Resin PVC S65", priority: "medium", stage: "kontak", value: 55000000 },
];

const DEMO_TEAM = [
  { name: "Budi Santoso", revenue: 340000000, winRate: 62, commission: 10200000 },
  { name: "Sari Wulandari", revenue: 285000000, winRate: 55, commission: 8550000 },
  { name: "Andi Pratama", revenue: 190000000, winRate: 48, commission: 5700000 },
];

const DEMO_RECOMMENDATIONS = [
  "PT Sinar Abadi Plastik udah 4 hari gak di-follow up padahal lagi di tahap Negosiasi - kirim penawaran final hari ini.",
  "CV Karya Plastindo nanya soal termin pembayaran minggu lalu, belum dijawab - ini yang paling mendesak.",
  "3 lead baru dari Generate Leads AI minggu ini cocok banget sama profil PT Elang Duta Asia yang udah closing.",
];

function demoAlert(action) {
  alert(`${action}\n\nIni demo publik - gak ada data yang beneran tersimpan di sini. Daftar gratis di nexto.site buat pakai fitur ini beneran.`);
}

function fmtRupiah(n) {
  return "Rp " + n.toLocaleString("id-ID");
}

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "leads", label: "Leads", icon: Users },
  { key: "team", label: "Performa Tim", icon: Trophy },
  { key: "ai", label: "Asisten AI", icon: Bot },
];

function DashboardTab() {
  const [expanded, setExpanded] = useState(true);
  const totalLeads = DEMO_LEADS.length;
  const overdue = 2;
  const winRate = 58;
  return (
    <div className="grid gap-5">
      <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white border border-slate-800">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 85% 10%, rgba(109,93,252,.42), transparent 35%)" }} />
        <div className="relative p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Sparkles size={20} className="text-violet-300" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-violet-300">NEX AI</p>
                <p className="text-lg font-bold">Rekomendasi Hari Ini</p>
              </div>
            </div>
            <button onClick={() => setExpanded((v) => !v)} className="p-1.5 rounded-lg hover:bg-white/10">
              <ChevronDown size={18} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
          {expanded && (
            <div className="mt-4 grid gap-2.5">
              {DEMO_RECOMMENDATIONS.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                  <p className="text-sm text-slate-300 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => demoAlert("Buka NEX AI Advisor")} className="mt-4 bg-white text-slate-950 rounded-xl px-4 py-2 text-sm font-semibold">Buka NEX AI Advisor</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total Leads</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">{totalLeads}</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase">Win Rate</p>
          <p className="text-3xl font-bold text-emerald-600 mt-1">{winRate}%</p>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase">Follow-up Overdue</p>
          <p className="text-3xl font-bold text-rose-500 mt-1">{overdue}</p>
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead }) {
  const sm = STAGE_META[lead.stage];
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 hover:shadow-[0_10px_30px_-16px_rgba(15,23,42,0.3)] transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-white font-bold" style={{ background: sm.hex }}>
            {lead.name.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">{lead.name}</p>
            <p className="text-xs text-slate-500">{lead.city} · {lead.product}</p>
          </div>
        </div>
        {lead.priority === "high" && <Flame size={16} className="text-orange-500 fill-orange-500 shrink-0" />}
      </div>
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full mt-3" style={{ background: `${sm.hex}17`, color: sm.hex }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.hex }} />
        {sm.label}
      </span>
      <div className="h-1.5 rounded-full bg-slate-100 mt-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: "60%", background: sm.hex }} />
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-sm font-semibold text-slate-700">{fmtRupiah(lead.value)}</p>
        <div className="flex items-center gap-1">
          <button onClick={() => demoAlert("Kirim WhatsApp")} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Phone size={14} /></button>
          <button onClick={() => demoAlert("Kirim Email")} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"><Mail size={14} /></button>
          <button onClick={() => demoAlert("Edit lead")} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"><Pencil size={14} /></button>
          <button onClick={() => demoAlert("Hapus lead")} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 size={14} /></button>
        </div>
      </div>
    </div>
  );
}

function LeadsTab() {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{DEMO_LEADS.length} leads contoh - klik tombol apa aja buat lihat cara kerjanya</p>
        <button onClick={() => demoAlert("Tambah lead baru")} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
          <Plus size={16} /> Tambah Lead
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEMO_LEADS.map((l) => <LeadCard key={l.id} lead={l} />)}
      </div>
    </div>
  );
}

function TeamTab() {
  return (
    <div className="grid gap-5">
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={18} className="text-amber-500" />
          <p className="font-bold text-slate-900">Laporan Performa Tim</p>
          <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-600">Enterprise</span>
        </div>
        <div className="grid gap-2.5">
          {DEMO_TEAM.map((m, i) => (
            <div key={m.name} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50">
              <span className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <p className="font-semibold text-slate-800 text-sm flex-1">{m.name}</p>
              <p className="text-sm text-slate-500">Win rate <b className="text-emerald-600">{m.winRate}%</b></p>
              <p className="text-sm font-semibold text-slate-900 w-40 text-right">{fmtRupiah(m.revenue)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-white border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Percent size={18} className="text-orange-500" />
          <p className="font-bold text-slate-900">Sistem Komisi Tim</p>
        </div>
        <div className="grid gap-2.5">
          {DEMO_TEAM.map((m) => (
            <div key={m.name} className="flex items-center justify-between text-sm">
              <p className="text-slate-700">{m.name} <span className="text-slate-400">(3% dari revenue closing)</span></p>
              <p className="font-semibold text-emerald-600">{fmtRupiah(m.commission)}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-2xl bg-white border border-slate-200 p-5 flex items-center gap-3">
        <MapPin size={18} className="text-sky-500 shrink-0" />
        <p className="text-sm text-slate-600">GPS Check-in aktif: <b>Budi Santoso</b> baru check-in di <b>PT Sinar Abadi Plastik, Tangerang</b> - 12 menit lalu.</p>
      </div>
    </div>
  );
}

function AiTab() {
  return (
    <div className="grid gap-5">
      <div className="rounded-3xl bg-slate-950 text-white p-5 border border-slate-800">
        <div className="flex items-center gap-2 mb-4">
          <MessageSquareText size={18} className="text-emerald-400" />
          <p className="text-sm font-semibold text-slate-300">Bot Telegram Nexto</p>
        </div>
        <div className="grid gap-2.5">
          <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-orange-600 px-3.5 py-2.5 text-sm">Cek lead yang overdue follow-up hari ini.</div>
          <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-white/10 px-3.5 py-2.5 text-sm text-slate-200">Ada 2 lead overdue: PT Sinar Abadi Plastik (4 hari) dan CV Karya Plastindo (2 hari). Mau saya catetin hasil follow-up-nya?</div>
        </div>
        <button onClick={() => demoAlert("Chat sama Bot Telegram")} className="mt-4 text-sm font-semibold text-emerald-400">Coba chat sendiri &rarr;</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button onClick={() => demoAlert("Smart Import AI")} className="rounded-2xl bg-white border border-slate-200 p-5 text-left hover:border-orange-300">
          <Wand2 size={22} className="text-orange-500 mb-3" />
          <p className="font-semibold text-slate-900 text-sm">Smart Import AI</p>
          <p className="text-xs text-slate-500 mt-1">Rapikan Excel berantakan jadi data lead siap pakai.</p>
        </button>
        <button onClick={() => demoAlert("Rekam Meeting Otomatis")} className="rounded-2xl bg-white border border-slate-200 p-5 text-left hover:border-orange-300">
          <Mic size={22} className="text-orange-500 mb-3" />
          <p className="font-semibold text-slate-900 text-sm">Rekam Meeting Otomatis</p>
          <p className="text-xs text-slate-500 mt-1">Hasil meeting langsung jadi progress note.</p>
        </button>
        <button onClick={() => demoAlert("Generate Leads AI")} className="rounded-2xl bg-white border border-slate-200 p-5 text-left hover:border-orange-300">
          <Sparkles size={22} className="text-orange-500 mb-3" />
          <p className="font-semibold text-slate-900 text-sm">Generate Leads AI</p>
          <p className="text-xs text-slate-500 mt-1">Cari calon customer baru otomatis lewat web search.</p>
        </button>
      </div>
    </div>
  );
}

export default function PublicDemo() {
  const [tab, setTab] = useState("dashboard");
  const [bannerOpen, setBannerOpen] = useState(true);

  useEffect(() => {
    document.title = "Nexto - Demo Interaktif";
    try {
      // SKIP TRACKING BUAT NANDO SENDIRI (18 Sep 2026) - liat Auth.jsx buat
      // penjelasan lengkap, pola/key localStorage-nya sama persis.
      const params = new URLSearchParams(window.location.search);
      if (params.get("admin") === "1") localStorage.setItem("nexto_skip_tracking", "1");
      if (localStorage.getItem("nexto_skip_tracking") === "1") return;

      let sessionId = localStorage.getItem("nexto_visitor_id");
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem("nexto_visitor_id", sessionId);
      }
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      fetch("https://cewggulyfshnbebcpyui.supabase.co/functions/v1/track-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_path: "/demo", session_id: sessionId, referrer: document.referrer || null, device: isMobile ? "mobile" : "desktop" }),
      }).catch(() => {});
    } catch (_) {}
  }, []);

  const TabContent = { dashboard: DashboardTab, leads: LeadsTab, team: TeamTab, ai: AiTab }[tab];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col sm:flex-row">
      <aside className="hidden sm:flex w-60 shrink-0 bg-slate-950 flex-col p-5 gap-1">
        <a href="/" className="flex items-center gap-2 mb-8 px-1">
          <span className="text-orange-500 font-extrabold text-xl">Nexto</span>
        </a>
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-colors ${active ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
            >
              <Icon size={17} /> {t.label}
            </button>
          );
        })}
        <div className="mt-auto pt-5 border-t border-white/10">
          <a href="/" className="flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl">
            Daftar Gratis <ArrowRight size={14} />
          </a>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {bannerOpen && (
          <div className="bg-orange-600 text-white text-sm px-5 py-2.5 flex items-center justify-between gap-3">
            <p className="font-medium">Ini demo publik dengan data contoh - gak ada yang tersimpan beneran.</p>
            <div className="flex items-center gap-3 shrink-0">
              <a href="/" className="font-semibold underline">Daftar gratis</a>
              <button onClick={() => setBannerOpen(false)}><X size={16} /></button>
            </div>
          </div>
        )}
        <header className="sm:hidden flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200">
          <a href="/" className="text-orange-600 font-extrabold text-lg">Nexto</a>
          <a href="/" className="text-xs font-semibold bg-orange-600 text-white px-3 py-1.5 rounded-lg">Daftar</a>
        </header>
        <nav className="sm:hidden flex overflow-x-auto gap-1 px-3 py-2 bg-white border-b border-slate-200">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${active ? "bg-orange-600 text-white" : "text-slate-500"}`}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </nav>
        <main className="p-5 sm:p-8 max-w-5xl mx-auto">
          <TabContent />
        </main>
      </div>
    </div>
  );
}
