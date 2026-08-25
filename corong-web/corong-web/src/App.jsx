import { useEffect, useState, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase, isConfigured } from "./lib/supabaseClient";
import * as db from "./lib/db";
import Auth from "./Auth";
import { NextoRobotHead, NextoDarkWordmark } from "./Auth";
import Dashboard from "./tabs/Dashboard";
import Leads from "./tabs/Leads";
import GenerateLeads from "./tabs/GenerateLeads";
import Deal from "./tabs/Deal";
import VisitFollowup from "./tabs/VisitFollowup";
import Kompetitor from "./tabs/Kompetitor";
import Nex from "./tabs/Nex";
import Advisor from "./tabs/Advisor";
import SettingsTab from "./tabs/Settings";
import LeadModal from "./components/LeadModal";
import IndustryPicker from "./components/IndustryPicker";
import IndustryDemo from "./tabs/IndustryDemo";
import { getIndustryTemplate } from "./lib/industryTemplates";
import {
  LayoutDashboard, Users, Trophy, CalendarCheck, Swords,
  Lightbulb, Bot, Settings as SettingsIcon, Loader2, LogOut, Users2, Lock, Camera, Mail, Sparkles, Eye,
} from "lucide-react";

export function NextoBadge({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <path d="M51,92 L17.04,15.15 Q13,6 21.46,11.34 L51,30 Z" fill="#f97316" />
      <path d="M51,92 L51,30 L80.54,11.34 Q89,6 84.96,15.15 Z" fill="#9a3412" />
    </svg>
  );
}

// ---- DATA DUMMY buat preview tab Premium (user Free) ----
// Ngasal doang - biar user Free liat gambaran "beneran kepake" bukan tab kosong.
// Gak pernah disimpen ke database, murni buat ditampilin doang.
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const DUMMY_LEADS = [
  { id: "dummy-1", name: "PT Sinar Abadi Plastik", category: "Resin & Compound", stage_key: "presentasi", city: "Tangerang", key_person: "Budi Santoso", key_person_title: "Purchasing Manager", phone: "0812xxxxxx01", email: "budi@sinarabadi.co.id", visit_date: today, visit_meet: "Budi Santoso", visit_agenda: "Presentasi produk & harga penawaran", last_contact: "2026-08-20", next_action: "Follow up hasil presentasi minggu lalu", latitude: null, longitude: null, source: "manual" },
  { id: "dummy-2", name: "CV Karya Plastindo", category: "Pipa & Fitting", stage_key: "negosiasi", city: "Bekasi", key_person: "Sari Wulandari", key_person_title: "Direktur", phone: "0812xxxxxx02", email: "sari@karyaplastindo.id", visit_date: tomorrow, visit_meet: "Sari Wulandari", visit_agenda: "Trial sample produk", last_contact: "2026-08-18", next_action: "Kirim sample ke pabrik", latitude: null, longitude: null, source: "manual" },
  { id: "dummy-3", name: "PT Maju Bersama Kimia", category: "Kabel Listrik", stage_key: "deal", city: "Surabaya", key_person: "Ahmad Fauzi", key_person_title: "Owner", phone: "0812xxxxxx03", email: "ahmad@majubersama.co.id", last_contact: "2026-08-15", latitude: null, longitude: null, source: "telegram" },
];
const DUMMY_DEAL_TX = [
  { id: "dd-1", lead_id: "dummy-3", lead_name: "PT Maju Bersama Kimia", deal_date: "2026-08-15", deal_value: 45000000, tonnage: 5, tonnage_unit: "ton", chemical: "PVC Resin K67" },
  { id: "dd-2", lead_id: "dummy-2", lead_name: "CV Karya Plastindo", deal_date: "2026-08-10", deal_value: 28000000, tonnage: 3, tonnage_unit: "ton", chemical: "Calcium Zinc Stabilizer" },
];
const DUMMY_COMPETITORS = [
  { id: "dc-1", name: "PT Kompetitor Jaya", background: "Pemain lama di area Jabodetabek", product: "PVC Compound", notes: "Harga agresif tapi servis lambat", usages: [{ id: "u1", company: "PT ABC Plastik", product: "Compound X", price: "Rp15.000/kg", quantity: "2 ton/bulan" }] },
  { id: "dc-2", name: "CV Rival Chemical", background: "Fokus segmen kabel listrik", product: "Kabel Compound", notes: "Kuat di after-sales support", usages: [] },
];

const NAV = [
  { key: "dashboard", label: "Dashboard", short: "Beranda", icon: LayoutDashboard },
  { key: "leads", label: "Leads", short: "Leads", icon: Users },
  { key: "generateleads", label: "Generate Leads", short: "Cari Lead", icon: Sparkles },
  { key: "deal", label: "Deal", short: "Deal", icon: Trophy },
  { key: "visitfollowup", label: "Visit & Follow-up", short: "Visit", icon: CalendarCheck },
  { key: "kompetitor", label: "Kompetitor", short: "Rival", icon: Swords },
  { key: "komunitas", label: "Nex", short: "Nex", icon: Users2, special: true },
  { key: "advisor", label: "AI Advisor", short: "AI", icon: Lightbulb },
  { key: "industridemo", label: "Demo Industri", short: "Demo", icon: Eye },
  { key: "settings", label: "Pengaturan", short: "Lainnya", icon: SettingsIcon },
];

function ConfigScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md bg-white border border-slate-200/80 rounded-3xl shadow-sm p-7">
        <div className="mb-4"><NextoBadge size={48} /></div>
        <h1 className="text-lg font-bold mb-2">Sambungin ke Supabase dulu</h1>
        <p className="text-sm text-slate-500 mb-3">Buat file <code className="bg-slate-100 px-1 rounded">.env</code> di root project (salin dari <code className="bg-slate-100 px-1 rounded">.env.example</code>), isi:</p>
        <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 overflow-x-auto">VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...</pre>
        <p className="text-xs text-slate-400 mt-3">Ambil dari Supabase → Project Settings → API. Terus restart <code className="bg-slate-100 px-1 rounded">npm run dev</code>.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [stages, setStages] = useState([]);
  const [settings, setSettings] = useState({ sales_names: [] });
  const [leads, setLeads] = useState([]);
  const [dealTransactions, setDealTransactions] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [org, setOrg] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");
  const joinWithCode = async () => {
    if (!joinCode.trim()) return;
    setJoinBusy(true); setJoinMsg("");
    try {
      const res = await db.redeemInviteCode(joinCode.trim());
      setJoinMsg(`✅ Gabung ke ${res.org_name}! Semua fitur Enterprise sekarang kebuka.`);
      setJoinCode("");
      await reload();
    } catch (e) {
      setJoinMsg("Gagal: " + e.message);
    } finally {
      setJoinBusy(false);
    }
  };
  const [editLead, setEditLead] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { db.clearOrgCache(); setSession(s); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      let myOrg = null;
      try { myOrg = await db.getMyOrg(); } catch (e) { console.error(e); }
      setOrg(myOrg);
      let [st, se, ls, comp, dt] = await Promise.all([db.getStages(), db.getSettings(), db.getLeads(), db.getCompetitors(), db.getDealTransactions()]);
      // Akun baru (belum pernah setup pipeline sama sekali) - otomatis kasih
      // pipeline default biar gak kosong melompong abis daftar sendiri.
      // TAPI kalau org-nya belum pernah milih industri (industry masih null),
      // tunda dulu - biar IndustryPicker yang munculin pilihan, baru abis dipilih
      // pipeline-nya di-seed sesuai template industri itu (lihat handlePickIndustry).
      if (st.length === 0 && myOrg?.industry) {
        try { await db.initDefaultStages(); st = await db.getStages(); } catch (e) { console.error(e); }
      }
      setStages(st); setSettings(se); setLeads(ls); setCompetitors(comp); setDealTransactions(dt);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const [pickingIndustry, setPickingIndustry] = useState(false);
  const handlePickIndustry = async (industryKey) => {
    setPickingIndustry(true);
    try {
      await db.setOrgIndustry(industryKey);
      await db.initDefaultStages();
      await reload();
    } catch (e) {
      alert("Gagal simpan pilihan industri: " + e.message);
    } finally {
      setPickingIndustry(false);
    }
  };

  // Reload diem-diem (TANPA nyalain loading spinner) - dipakai buat nyegerin data
  // pas balik dari tab/app lain yang udah lama ditinggal, tanpa bikin layar kedip loading.
  const silentReload = async () => {
    try {
      const [st, se, ls, comp, dt] = await Promise.all([db.getStages(), db.getSettings(), db.getLeads(), db.getCompetitors(), db.getDealTransactions()]);
      setStages(st); setSettings(se); setLeads(ls); setCompetitors(comp); setDealTransactions(dt);
    } catch (e) { console.error(e); }
  };

  // Supabase otomatis ngecek/refresh token pas tab balik fokus, yang bikin onAuthStateChange
  // nembak terus tiap kali pindah tab/app - walau user-nya sama aja, bukan login baru.
  // Makanya reload PENUH (loading spinner) cuma dipicu kalau user_id-nya beneran ganti
  // (login pertama kali / ganti akun), bukan tiap kali sesi ke-refresh doang.
  const prevUserId = useRef(null);
  useEffect(() => {
    const uid = session?.user?.id || null;
    if (uid && uid !== prevUserId.current) {
      prevUserId.current = uid;
      reload();
    } else if (!uid) {
      prevUserId.current = null;
    }
  }, [session]);

  // Kalau tab ditinggal lebih dari 5 menit terus dibuka lagi, sync data diem-diem
  // (ga nyalain loading spinner) biar tetep fresh tanpa bikin capek liat loading mulu.
  useEffect(() => {
    let hiddenAt = null;
    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && session) {
        const awayMs = Date.now() - hiddenAt;
        if (awayMs > 5 * 60 * 1000) silentReload();
        hiddenAt = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [session]);

  // Pull-to-refresh: tarik layar dari paling atas (cuma aktif kalau scroll udah
  // di posisi 0) buat refresh data manual - berguna soalnya PWA yang di-install
  // gak punya tombol refresh browser lagi.
  const [pullVisual, setPullVisual] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullDistanceRef = useRef(0);
  const touchStartY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    if (!session) return;
    const onTouchStart = (e) => {
      if (window.scrollY === 0 && !refreshing) {
        touchStartY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };
    const onTouchMove = (e) => {
      if (!pulling.current) return;
      const delta = e.touches[0].clientY - touchStartY.current;
      if (delta > 0 && window.scrollY === 0) {
        const d = Math.min(delta * 0.5, 90);
        pullDistanceRef.current = d;
        setPullVisual(d);
      } else {
        pulling.current = false;
        pullDistanceRef.current = 0;
        setPullVisual(0);
      }
    };
    const onTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      const d = pullDistanceRef.current;
      pullDistanceRef.current = 0;
      setPullVisual(0);
      if (d > 60) {
        setRefreshing(true);
        await silentReload();
        setRefreshing(false);
      }
    };
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: true });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [session, refreshing]);

  if (!isConfigured) return <ConfigScreen />;
  if (!authReady) return <Splash />;
  if (!session) return <Auth />;
  // Org baru yang belum pernah milih industri bisnisnya - tampilin picker dulu
  // sebelum masuk ke dashboard. Org lama (industry udah keisi lewat SQL backfill)
  // gak bakal pernah kena kondisi ini.
  if (org && !org.industry) return <IndustryPicker onSelect={handlePickIndustry} busy={pickingIndustry} />;

  // ---- SISTEM 2 TIPE (FREE / PREMIUM) ----
  // Gak ada trial otomatis - daftar langsung dapet Free (Dashboard & Leads doang).
  // Fitur AI (Bot Telegram, AI Advisor, Rekam Meeting, dst) pake token API
  // berbayar, jadi cuma kebuka abis di-upgrade ke Premium (settings.plan = 'premium').
  const isPremium = settings.plan === "premium" || org?.plan === "enterprise";
  const FREE_TABS = ["dashboard", "leads", "industridemo"];

  const stageList = stages.length ? stages : [{ key: "prospek", label: "Prospek", hex: "#94a3b8", type: "normal" }];
  const effectiveTab = tab;
  const isLocked = (key) => !loading && !isPremium && !FREE_TABS.includes(key);

  return (
    <div className="nexto-app min-h-screen bg-[#f5f7fb] text-slate-900 flex overflow-x-hidden">
      <style>{`
        .nexto-app {
          --nexto-ink: #0b1020;
          --nexto-muted: #64748b;
          --nexto-line: rgba(148,163,184,.18);
          --nexto-orange: #f97316;
          --nexto-panel: rgba(255,255,255,.82);
        }
        .nexto-app .nexto-grid {
          background-image:
            linear-gradient(rgba(148,163,184,.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,.045) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: linear-gradient(to bottom, rgba(0,0,0,.65), transparent 75%);
          -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,.65), transparent 75%);
        }
        .nexto-app .nexto-sidebar {
          background:
            radial-gradient(circle at 15% 5%, rgba(249,115,22,.14), transparent 28%),
            linear-gradient(180deg, #0b101a 0%, #080c14 100%);
        }
        .nexto-app .nexto-panel {
          background: var(--nexto-panel);
          border: 1px solid rgba(255,255,255,.72);
          box-shadow:
            0 18px 55px -34px rgba(15,23,42,.28),
            0 1px 2px rgba(15,23,42,.04);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }
        .nexto-app .nexto-nav-active {
          background: linear-gradient(135deg, rgba(249,115,22,.98), rgba(234,88,12,.94));
          box-shadow: 0 12px 28px -15px rgba(249,115,22,.9);
        }
        .nexto-app .nexto-nav-item {
          transition: transform .16s ease, background .16s ease, color .16s ease;
        }
        .nexto-app .nexto-nav-item:hover {
          transform: translateX(2px);
        }
        .nexto-app .nexto-status-dot {
          box-shadow: 0 0 0 4px rgba(34,197,94,.08), 0 0 14px rgba(34,197,94,.5);
        }
        .nexto-app .nexto-content-glow {
          background:
            radial-gradient(circle at 78% 2%, rgba(249,115,22,.09), transparent 24%),
            radial-gradient(circle at 20% 18%, rgba(99,102,241,.045), transparent 20%);
        }
        @media (max-width: 767px) {
          .nexto-app .nexto-content-glow {
            background: radial-gradient(circle at 80% 0%, rgba(249,115,22,.08), transparent 30%);
          }
        }
      `}</style>

      {(pullVisual > 0 || refreshing) && (
        <div
          className="md:hidden fixed top-0 inset-x-0 z-50 flex items-start justify-center pointer-events-none transition-[height] duration-150"
          style={{ height: refreshing ? 56 : pullVisual }}
        >
          <div className="bg-white/95 backdrop-blur-xl rounded-full p-2 shadow-[0_10px_30px_-8px_rgba(15,23,42,.3)] mt-2 border border-white">
            <Loader2
              size={18}
              className="text-orange-500"
              style={refreshing ? { animation: "spin 0.8s linear infinite" } : { transform: `rotate(${pullVisual * 3}deg)` }}
            />
          </div>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="nexto-sidebar hidden md:flex flex-col w-[248px] sticky top-0 h-screen shrink-0 text-white border-r border-white/[0.06]">
        <div className="px-4 pt-4 pb-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 shadow-[0_12px_30px_-22px_rgba(0,0,0,.9)]">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                <NextoRobotHead size={30} />
                <NextoDarkWordmark width={70} />
                <ProfileAvatar
                  settings={settings}
                  session={session}
                  org={org}
                  onChanged={reload}
                  size={34}
                  align="left"
                  className="ml-auto"
                />
              </div>
              <div className="pl-[38px] min-w-0">
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Sales OS
                </div>
                {org?.industry && (
                  <div className="mt-1.5 inline-block text-[9px] font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5 truncate max-w-full">
                    {getIndustryTemplate(org.industry).label}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-4 mb-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 nexto-status-dot" />
            <span className="text-[10px] font-semibold text-slate-400">Workspace aktif</span>
            <span className="ml-auto rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[8px] font-bold tracking-wide text-slate-500">{isPremium ? "PRO" : "FREE"}</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Menu utama</div>
          {NAV.map((n) => {
            const I = n.icon;
            const active = effectiveTab === n.key;
            const locked = isLocked(n.key);
            const cls = locked
              ? "text-slate-600 hover:bg-white/[0.03] cursor-pointer"
              : n.special
              ? (active ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-[0_14px_32px_-18px_rgba(168,85,247,.9)]" : "text-violet-300 hover:bg-violet-500/10 hover:text-violet-200")
              : (active ? "nexto-nav-active text-white font-semibold" : "text-slate-400 hover:bg-white/[0.055] hover:text-white");

            return (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                className={`nexto-nav-item relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-[14px] text-[13px] ${cls}`}
              >
                {active && !locked && !n.special && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-white/90" />}
                <I size={17} strokeWidth={active ? 2.4 : 1.9} />
                <span className="flex-1 text-left">{n.label}</span>
                {locked && <Lock size={12} className="shrink-0 text-slate-600" />}
              </button>
            );
          })}
        </nav>

        <div className="px-4 pb-4">
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2 text-[10px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 nexto-status-dot" />
            <span>Semua perubahan tersimpan</span>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full px-3.5 py-2.5 rounded-[14px] bg-white/[0.035] border border-white/[0.06] text-[12px] text-slate-400 hover:bg-white/[0.07] hover:text-white flex items-center gap-2.5 transition-colors"
          >
            <LogOut size={14} /> Keluar
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col relative nexto-content-glow">
        <div className="nexto-grid pointer-events-none absolute inset-x-0 top-0 h-72 opacity-70" />

        {/* MOBILE TOPBAR */}
        <header className="md:hidden sticky top-0 z-30 bg-white/82 backdrop-blur-2xl border-b border-slate-200/70">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-slate-950 text-orange-400 shadow-[0_8px_20px_-10px_rgba(15,23,42,.55)]">
              <Bot size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold tracking-[-0.03em] text-[14px]">NE<span className="text-orange-500">X</span>TO</div>
              <div className="text-[9px] font-medium text-slate-400 truncate">{NAV.find((n) => n.key === effectiveTab)?.label}</div>
            </div>
            <ProfileAvatar settings={settings} session={session} org={org} onChanged={reload} size={34} />
          </div>
        </header>

        {/* DESKTOP TOPBAR */}
        <header className="hidden md:flex sticky top-0 z-20 h-[68px] items-center justify-between border-b border-slate-200/70 bg-white/72 px-6 lg:px-8 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-500">Sales Workspace</div>
              <div className="mt-0.5 flex items-center gap-2 text-[13px] font-medium text-slate-400">
                <span>Workspace</span>
                <span className="text-slate-300">/</span>
                <span className="text-slate-700">{NAV.find((n) => n.key === effectiveTab)?.label}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-3.5 py-2 text-[10px] text-slate-400 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Data tersinkron
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto px-4 py-5 md:px-7 md:py-7 lg:px-9 pb-32">
          {!loading && !isPremium && (
            <div className="mb-5 overflow-hidden rounded-[20px] border border-orange-200/70 bg-gradient-to-r from-orange-50 via-white to-orange-50/60 shadow-[0_12px_35px_-25px_rgba(249,115,22,.45)]">
              <div className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center md:justify-between md:px-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Sparkles size={15} />
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-slate-800">Kamu sedang memakai Nexto Free</div>
                    <div className="mt-0.5 text-[10px] leading-4 text-slate-500">Dashboard & Leads aktif. Upgrade untuk membuka AI, Deal, Visit, Calendar, dan automation.</div>
                  </div>
                </div>
                <a href="https://subscription.myr.id/m/nexto-premium-88379/" target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-slate-950 px-4 py-2 text-center text-[11px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(15,23,42,.7)] hover:bg-slate-800">Upgrade Premium →</a>
              </div>
              <div className="border-t border-orange-200/50 px-4 py-3 md:px-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="text-[10px] text-orange-800/80">Punya kode Enterprise?</div>
                  <div className="flex flex-1 gap-2 sm:max-w-md">
                    <input className="min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-3 py-2 text-[10px] uppercase text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10" placeholder="MASUKIN KODE" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={6} />
                    <button onClick={joinWithCode} disabled={joinBusy} className="rounded-xl bg-orange-600 px-3.5 text-[10px] font-semibold text-white hover:bg-orange-700 disabled:opacity-60">{joinBusy ? "..." : "Gabung"}</button>
                  </div>
                  {joinMsg && <p className={`text-[10px] ${joinMsg.startsWith("Gagal") ? "text-rose-600" : "text-emerald-700"}`}>{joinMsg}</p>}
                </div>
              </div>
            </div>
          )}

          {loading ? <Splash inline /> : (
            <>
              {effectiveTab === "dashboard" && <Dashboard leads={leads} stages={stageList} dealTransactions={dealTransactions} settings={settings} onGo={setTab} onOpenLead={setEditLead} />}
              {effectiveTab === "leads" && <Leads leads={leads} stages={stageList} settings={settings} industry={org?.industry} onChanged={reload} />}
              {effectiveTab === "generateleads" && <PreviewLock locked={isLocked("generateleads")}><GenerateLeads stages={stageList} onChanged={reload} /></PreviewLock>}
              {effectiveTab === "deal" && <PreviewLock locked={isLocked("deal")}><Deal leads={isLocked("deal") ? DUMMY_LEADS : leads} stages={stageList} dealTransactions={isLocked("deal") ? DUMMY_DEAL_TX : dealTransactions} onEdit={setEditLead} onChanged={reload} /></PreviewLock>}
              {effectiveTab === "visitfollowup" && <PreviewLock locked={isLocked("visitfollowup")}><VisitFollowup leads={isLocked("visitfollowup") ? DUMMY_LEADS : leads} onEdit={setEditLead} onChanged={reload} /></PreviewLock>}
              {effectiveTab === "kompetitor" && <PreviewLock locked={isLocked("kompetitor")}><Kompetitor competitors={isLocked("kompetitor") ? DUMMY_COMPETITORS : competitors} onChanged={reload} /></PreviewLock>}
              {effectiveTab === "komunitas" && <PreviewLock locked={isLocked("komunitas")}><Nex dummy={isLocked("komunitas")} /></PreviewLock>}
              {effectiveTab === "advisor" && <PreviewLock locked={isLocked("advisor")}><Advisor leads={isLocked("advisor") ? DUMMY_LEADS : leads} stages={stageList} onOpen={setEditLead} dummy={isLocked("advisor")} /></PreviewLock>}
              {effectiveTab === "industridemo" && <IndustryDemo />}
              {effectiveTab === "settings" && <PreviewLock locked={isLocked("settings")}><SettingsTab settings={settings} stages={stageList} leads={leads} onChanged={reload} /></PreviewLock>}
            </>
          )}
        </main>

        {/* MOBILE BOTTOM NAV */}
        <nav className="md:hidden fixed bottom-3 inset-x-3 z-40">
          <div className="max-w-lg mx-auto flex justify-around px-1.5 py-2 bg-slate-950/95 backdrop-blur-2xl rounded-[24px] shadow-[0_16px_42px_-10px_rgba(15,23,42,.42)] border border-white/10">
            {NAV.map((n) => {
              const I = n.icon;
              const active = effectiveTab === n.key;
              const locked = isLocked(n.key);
              const cls = locked
                ? "text-slate-600"
                : n.special
                ? (active ? "text-violet-300 bg-violet-500/15" : "text-violet-400")
                : (active ? "text-orange-300 bg-orange-500/15" : "text-slate-400");
              return (
                <button key={n.key} onClick={() => setTab(n.key)} className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors ${cls}`}>
                  <I size={18} strokeWidth={active ? 2.5 : 1.9} />
                  <span className="mt-0.5 max-w-full truncate text-[8px] font-medium leading-none">{n.short}</span>
                  {locked && <Lock size={8} className="absolute right-2 top-0.5" />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {editLead && <LeadModal lead={editLead} stages={stageList} settings={settings} industry={org?.industry} onClose={() => setEditLead(null)} onSaved={() => { setEditLead(null); reload(); }} />}
    </div>
  );
}

// Bungkus konten tab yang butuh Premium - kelihatan isinya (biar user tau apa
// yang bakal mereka dapet), tapi klik apapun di dalemnya (tombol, form, dst)
// ke-tangkep sama lapisan transparan ini dan cuma munculin ajakan upgrade -
// gak ada perubahan data yang beneran kejadian.
function PreviewLock({ locked, children }) {
  if (!locked) return children;
  return (
    <div className="relative">
      <div className="mb-3 bg-slate-800 text-white text-xs rounded-2xl px-4 py-2.5 flex items-center gap-2">
        <Lock size={13} className="shrink-0" /> Mode lihat-lihat doang - upgrade ke Premium buat bisa nambah/ubah data di sini.
      </div>
      <div
        onClick={() => alert("Ini fitur Premium bro - di paket Free cuma bisa dilihat doang, gak bisa diubah. Upgrade dulu (Rp149rb/bulan) buat bisa pake fiturnya.")}
        className="absolute inset-0 top-11 z-20 cursor-pointer"
      />
      {children}
    </div>
  );
}

// Avatar bulat pojok kanan atas (kayak Gmail/Notion) - klik buka kartu profil
// isinya foto, jabatan, email, dan tombol edit.
// Kartu dropdown-nya di-render via portal (createPortal ke document.body) -
// PENTING karena kalau dipanggil di dalam sidebar yang position:sticky,
// sidebar itu otomatis bikin "stacking context" sendiri yang ngekurung
// z-index di dalamnya, jadi kartu ini gak akan pernah bisa nutupin konten
// utama di sebelahnya walau z-index-nya udah paling tinggi sekalipun.
// Portal ngebypass masalah itu total - kartu ini render langsung di root document.
function ProfileAvatar({ settings, session, org, onChanged, size = 36, align = "right", className = "" }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [jobTitle, setJobTitle] = useState(settings.job_title || "");
  const [name, setName] = useState(settings.community_display_name || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const CARD_WIDTH = 288; // w-72

  const initial = (settings.community_display_name || session?.user?.email || "?").charAt(0).toUpperCase();
  const email = session?.user?.email || "";
  const planInfo = org?.plan === "enterprise"
    ? { label: "Enterprise", cls: "bg-violet-100 text-violet-700" }
    : settings.plan === "premium"
    ? { label: "Premium", cls: "bg-orange-100 text-orange-700" }
    : { label: "Free", cls: "bg-slate-100 text-slate-500" };

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const rawLeft = align === "left" ? rect.left : rect.right - CARD_WIDTH;
      const clampedLeft = Math.max(12, Math.min(rawLeft, window.innerWidth - CARD_WIDTH - 12));
      setPos({ top: rect.bottom + 10, left: clampedLeft });
    }
    setOpen((v) => !v);
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await db.uploadAvatar(file);
      await db.saveMyProfile({ avatar_url: url });
      onChanged();
    } catch (err) { alert("Gagal upload foto: " + err.message); }
    finally { setUploading(false); }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await db.saveMyProfile({ job_title: jobTitle, name });
      onChanged();
      setEditing(false);
    } catch (err) { alert("Gagal simpan: " + err.message); }
    finally { setSaving(false); }
  };

  const card = (
    <>
      <div className="fixed inset-0 z-[999] bg-slate-900/25 backdrop-blur-[1px]" onClick={() => { setOpen(false); setEditing(false); }} />
      <div
        className="fixed w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-[24px] shadow-[0_16px_40px_-8px_rgba(15,23,42,0.25)] z-[1000] overflow-hidden border border-slate-100"
        style={{ top: pos.top, left: pos.left }}
      >
        {!editing ? (
          <>
            {/* Header gradient band + avatar nongol - pola kartu profil app mobile */}
            <div className="h-16 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-800 relative">
              <div className="absolute -bottom-7 left-5 w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center font-bold text-2xl ring-4 ring-white shadow-md">
                {settings.avatar_url ? <img src={settings.avatar_url} alt="" className="w-full h-full object-cover" /> : initial}
              </div>
            </div>
            <div className="pt-9 pb-4 px-5">
              <div className="flex items-center justify-between gap-2">
                <div className="font-bold text-[15px] text-slate-900 truncate">{settings.community_display_name || "Belum ada nama"}</div>
                <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-1 ${planInfo.cls}`}>{planInfo.label}</span>
              </div>
              {settings.job_title && (
                <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-2.5 py-1">{settings.job_title}</span>
              )}
              {email && (
                <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
                  <Mail size={11} className="shrink-0" /><span className="truncate">{email}</span>
                </div>
              )}
              <button onClick={() => setEditing(true)} className="w-full mt-4 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 font-medium transition-colors">Edit Profil</button>
            </div>
          </>
        ) : (
          <div className="p-5">
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center font-bold text-xl shrink-0 ring-2 ring-orange-100">
                {uploading ? <Loader2 size={18} className="animate-spin" /> : settings.avatar_url ? <img src={settings.avatar_url} alt="" className="w-full h-full object-cover" /> : initial}
              </div>
              <span className="text-xs text-orange-600 font-medium flex items-center gap-1"><Camera size={13} /> Ganti foto</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            </label>
            <label className="block mb-2.5">
              <span className="text-[11px] font-medium text-slate-400">Nama</span>
              <input className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block mb-4">
              <span className="text-[11px] font-medium text-slate-400">Jabatan</span>
              <input className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" placeholder="Sales Executive" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button onClick={() => setEditing(false)} className="flex-1 text-xs text-slate-700 border border-slate-200 rounded-xl py-2.5 hover:bg-slate-50 font-medium">Batal</button>
              <button onClick={saveProfile} disabled={saving} className="flex-1 text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl py-2.5 font-medium">{saving ? "..." : "Simpan"}</button>
            </div>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className={`relative ${className}`}>
      <button ref={btnRef} onClick={toggleOpen} className="shrink-0 rounded-full overflow-hidden ring-2 ring-white/40 bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center font-semibold shadow-[0_2px_8px_-1px_rgba(0,0,0,0.3)]" style={{ width: size, height: size, fontSize: size * 0.4 }}>
        {settings.avatar_url ? <img src={settings.avatar_url} alt="" className="w-full h-full object-cover" /> : initial}
      </button>
      {open && createPortal(card, document.body)}
    </div>
  );
}

function Splash({ inline }) {
  return (
    <div className={`${inline ? "py-20" : "min-h-screen"} bg-slate-50 flex flex-col items-center justify-center gap-3`}>
      <div className="animate-pulse"><NextoBadge size={48} /></div>
      <div className="text-slate-400 text-sm flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Memuat…</div>
    </div>
  );
}
