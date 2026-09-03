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
import AdminDashboard from "./tabs/AdminDashboard";
import LeadModal from "./components/LeadModal";
import IndustryPicker from "./components/IndustryPicker";
import IndustryDemo from "./tabs/IndustryDemo";
import { getIndustryTemplate, INDUSTRY_TEMPLATES } from "./lib/industryTemplates";
import {
  LayoutDashboard, Users, Trophy, CalendarCheck, Swords,
  Bot, Settings as SettingsIcon, Loader2, LogOut, Users2, Lock, Camera, Mail, Sparkles, ArrowLeft, ShieldCheck,
} from "lucide-react";

// (Logo lama NextoBadge - segitiga oranye - udah diganti robot NextoRobotHead
// di semua tempat, termasuk loading screen. Dihapus biar gak ada kode nganggur.)

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
  { key: "settings", label: "Pengaturan", short: "Lainnya", icon: SettingsIcon },
];
// Menu ini DIPISAH dari NAV biasa - cuma ditambahin ke daftar tab kalau
// settings.is_platform_admin true (dicek pas render, bukan hardcode di sini).
// Ini murni buat kerapian UI - keamanan ASLI-nya di server (ADMIN_EMAIL),
// jadi meskipun somehow ke-tembus tampil, data-nya tetep ke-block backend.
const ADMIN_NAV_ITEM = { key: "adminops", label: "Dashboard Karyawan AI", short: "AI Ops", icon: Bot };

function ConfigScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md bg-white border border-slate-200/80 rounded-3xl shadow-sm p-7">
        <div className="mb-4"><NextoRobotHead size={48} /></div>
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

  // ---- 2FA GATE ----
  // Supabase kasih sesi VALID (aal1) begitu password bener, WALAUPUN user
  // itu punya 2FA aktif - kode 2FA-nya sendiri itu langkah TAMBAHAN buat naik
  // ke aal2, bukan syarat sesi ke-buat. Makanya App HARUS ngecek level ini
  // sendiri tiap kali sesi berubah, dan nahan akses ke seluruh app (bukan
  // cuma nampilin peringatan) sampe kode 2FA-nya beneran diverifikasi -
  // kalau enggak, 2FA yang di-setup di Settings cuma jadi hiasan doang.
  const [mfa, setMfa] = useState({ checking: true, needed: false, verified: false });
  useEffect(() => {
    if (!session) { setMfa({ checking: false, needed: false, verified: false }); return; }
    setMfa((m) => ({ ...m, checking: true }));
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      if (error) { setMfa({ checking: false, needed: false, verified: false }); return; }
      const needsStep = data.nextLevel === "aal2" && data.currentLevel !== "aal2";
      setMfa({ checking: false, needed: needsStep, verified: !needsStep });
    });
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

  // Sesi udah valid (password bener), TAPI kalau user ini punya 2FA aktif
  // dan belum verifikasi kode-nya di sesi ini, app-nya DIBLOKIR total -
  // gak nampilin apapun dari isi app sampe kode 2FA bener.
  if (mfa.checking) return <Splash />;
  if (mfa.needed && !mfa.verified) {
    return <MfaVerifyScreen onVerified={() => setMfa((m) => ({ ...m, verified: true, needed: false }))} onCancel={() => supabase.auth.signOut()} />;
  }

  // Org baru yang belum pernah milih industri bisnisnya - tampilin picker dulu
  // sebelum masuk ke dashboard. Org lama (industry udah keisi lewat SQL backfill)
  // gak bakal pernah kena kondisi ini.
  if (org && !org.industry) return <IndustryPicker onSelect={handlePickIndustry} busy={pickingIndustry} />;

  // Dashboard Karyawan AI - FULLSCREEN TAKEOVER, terpisah dari layout biasa
  // (sidebar & topbar ilang sementara) biar berasa "masuk command center
  // sendiri", bukan cuma nempel jadi 1 tab isi konten biasa. Cuma nendang ke
  // sini kalau admin beneran pilih tab ini - selain itu app jalan normal.
  if (settings?.is_platform_admin && tab === "adminops") {
    return (
      <div className="min-h-screen bg-[#05070c]">
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(circle at 50% 0%, rgba(0,0,0,.8), transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 0%, rgba(0,0,0,.8), transparent 70%)",
          }}
        />
        <div className="relative max-w-[1400px] mx-auto px-4 py-5 md:px-8 md:py-8">
          <div className="flex items-center justify-between gap-3 mb-5">
            <button
              onClick={() => setTab("dashboard")}
              className="flex items-center gap-2 text-[12px] font-mono text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 rounded-xl px-3.5 py-2 transition-colors"
            >
              <ArrowLeft size={13} /> Kembali ke Workspace
            </button>
            <div className="flex items-center gap-2">
              <NextoRobotHead size={26} />
              <NextoDarkWordmark width={62} />
            </div>
          </div>
          <AdminDashboard />
        </div>
      </div>
    );
  }

  // ---- SISTEM 3 TIER (FREE / STANDARD / PROFESSIONAL) ----
  // Gak ada trial otomatis - daftar langsung dapet Free (Dashboard & Leads doang).
  // "premium" tetep dipake sebagai VALUE di database (biar user yang udah
  // bayar sekarang gak perlu di-migrasi) tapi sekarang artinya "Professional"
  // (tier tertinggi individual) - "standard" adalah tier BARU di antara
  // Free dan Professional. Enterprise (org.plan) otomatis dapet level
  // Professional + fitur tim tambahan yang di-gate terpisah di Settings.jsx.
  const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
  const myLevel = org?.plan === "enterprise" ? 2 : (PLAN_LEVEL[settings.plan] ?? 0);
  const isPremium = myLevel >= 2; // dipake di beberapa tempat lain (banner upgrade, dst) - "premium" di sini = Professional
  // Level minimal tiap tab: 0=Free, 1=Standard, 2=Professional.
  // Tab yang gak disebutin di sini otomatis level 0 (Free).
  const TAB_MIN_LEVEL = {
    komunitas: 1, settings: 1,
    generateleads: 2, deal: 2, visitfollowup: 2, kompetitor: 2, advisor: 2,
  };

  const stageList = stages.length ? stages : [{ key: "prospek", label: "Prospek", hex: "#94a3b8", type: "normal" }];
  const effectiveTab = tab;
  const isLocked = (key) => !loading && myLevel < (TAB_MIN_LEVEL[key] ?? 0);
  // Menu admin cuma nempel di daftar nav kalau akun ini beneran admin platform.
  // Customer biasa (99.9% user) gak akan pernah liat item ini nongol sama sekali.
  const navItems = settings?.is_platform_admin ? [...NAV, ADMIN_NAV_ITEM] : NAV;

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
      <aside className="nexto-sidebar hidden md:flex flex-col w-[248px] fixed top-0 left-0 h-screen z-30 text-white border-r border-white/[0.06]">
        <div className="px-4 pt-4 pb-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 shadow-[0_12px_30px_-22px_rgba(0,0,0,.9)]">
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
            <div className="pl-[38px] mt-2 flex items-center gap-1.5 flex-wrap min-w-0">
              {settings?.is_platform_admin ? (
                <IndustryDemoSwitcher org={org} onSwitched={reload} />
              ) : (
                org?.industry && (
                  <span className="inline-block text-[9px] font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5 truncate max-w-full">
                    {getIndustryTemplate(org.industry).label}
                  </span>
                )
              )}
              <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wide text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 nexto-status-dot" />
                {myLevel >= 2 ? "PRO" : myLevel === 1 ? "STANDARD" : "FREE"}
              </span>
            </div>
          </div>
        </div>

        <div className="mx-4 mb-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-600">Menu utama</div>
          {navItems.map((n) => {
            const I = n.icon;
            const active = effectiveTab === n.key;
            const locked = n.key === "adminops" ? false : isLocked(n.key);
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

      <div className="flex-1 min-w-0 flex flex-col relative nexto-content-glow md:ml-[248px]">
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
          {!loading && myLevel < 2 && (
            <div className="mb-5 overflow-hidden rounded-[20px] border border-orange-200/70 bg-gradient-to-r from-orange-50 via-white to-orange-50/60 shadow-[0_12px_35px_-25px_rgba(249,115,22,.45)]">
              <div className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center md:justify-between md:px-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Sparkles size={15} />
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-slate-800">{myLevel === 1 ? "Kamu sedang memakai Nexto Standard" : "Kamu sedang memakai Nexto Free"}</div>
                    <div className="mt-0.5 text-[10px] leading-4 text-slate-500">{myLevel === 1 ? "Leads & Komunitas aktif. Upgrade ke Professional untuk membuka AI, Deal, Visit, Calendar, dan automation." : "Dashboard & Leads aktif. Upgrade untuk membuka Komunitas, AI, Deal, Visit, Calendar, dan automation."}</div>
                  </div>
                </div>
                <a href="https://subscription.myr.id/m/nexto-premium-88379/" target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-slate-950 px-4 py-2 text-center text-[11px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(15,23,42,.7)] hover:bg-slate-800">Upgrade Professional →</a>
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
            {navItems.map((n) => {
              const I = n.icon;
              const active = effectiveTab === n.key;
              const locked = n.key === "adminops" ? false : isLocked(n.key);
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

      {editLead && <LeadModal lead={editLead} stages={stageList} settings={settings} industry={org?.industry} myLevel={myLevel} onClose={() => setEditLead(null)} onSaved={() => { setEditLead(null); reload(); }} />}
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

// Switcher industri - CUMA muncul buat admin platform (is_platform_admin).
// Beda dari IndustryPicker (onboarding sekali doang), ini boleh dipencet
// berkali-kali - dipake Nando buat gonta-ganti industri pas demo/pitching,
// biar calon klien liat langsung gimana Nexto "berubah bentuk" nyesuain
// bisnis mereka (label field, kategori, & pipeline stages-nya ikut berubah).
function IndustryDemoSwitcher({ org, onSwitched }) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(null);
  const current = org?.industry;

  const doSwitch = async (key) => {
    if (key === current || switching) return;
    setSwitching(key);
    try {
      await db.switchDemoIndustry(key);
      await onSwitched();
      setOpen(false);
    } catch (e) {
      alert("Gagal ganti industri: " + e.message);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[9px] font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 rounded-full px-2 py-0.5 truncate max-w-full transition-colors"
        title="Mode demo - khusus admin, ganti industri buat pitching"
      >
        {current ? getIndustryTemplate(current).label : "Pilih industri"}
        <span className="text-orange-400/70">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[998]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 w-56 bg-[#0b101a] border border-white/10 rounded-2xl shadow-[0_16px_40px_-8px_rgba(0,0,0,0.6)] z-[999] overflow-hidden py-1.5">
            <div className="px-3 py-1.5 text-[9px] font-mono uppercase tracking-widest text-slate-600">Mode Demo - Pitching</div>
            {Object.entries(INDUSTRY_TEMPLATES).map(([key, tpl]) => (
              <button
                key={key}
                onClick={() => doSwitch(key)}
                disabled={!!switching}
                className={`w-full text-left px-3 py-2 text-[12px] flex items-center justify-between gap-2 transition-colors disabled:opacity-50 ${key === current ? "text-orange-300 bg-orange-500/10" : "text-slate-300 hover:bg-white/[0.05]"}`}
              >
                <span className="truncate">{tpl.label}</span>
                {switching === key ? <Loader2 size={12} className="animate-spin shrink-0" /> : key === current ? <span className="text-[9px] shrink-0">●</span> : null}
              </button>
            ))}
          </div>
        </>
      )}
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

// Layar input kode 2FA pas login - muncul SETELAH password bener tapi
// SEBELUM app-nya keliatan, kalau user itu punya 2FA aktif.
function MfaVerifyScreen({ onVerified, onCancel }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const verify = async () => {
    if (code.length !== 6) { setErr("Kode harus 6 digit."); return; }
    setBusy(true); setErr("");
    try {
      const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
      if (listErr) throw listErr;
      const factor = (factors?.totp || []).find((f) => f.status === "verified");
      if (!factor) throw new Error("Gak ketemu 2FA yang aktif.");
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
      if (verifyErr) throw verifyErr;
      onVerified();
    } catch (e) {
      setErr("Kode salah/kedaluwarsa: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-sm w-full bg-white border border-slate-200/80 rounded-3xl shadow-sm p-7">
        <div className="mb-4 flex justify-center"><NextoRobotHead size={48} /></div>
        <div className="text-center mb-1">
          <ShieldCheck size={22} className="mx-auto text-orange-600 mb-2" />
          <h1 className="text-lg font-bold">Verifikasi 2FA</h1>
          <p className="text-sm text-slate-500 mt-1">Masukin kode 6 digit dari app authenticator kamu.</p>
        </div>
        <input
          className="w-full mt-5 px-3 py-3 text-center text-xl tracking-[0.4em] font-mono border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
          placeholder="000000"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && verify()}
        />
        {err && <div className="mt-3 text-xs bg-rose-50 text-rose-700 rounded-lg p-2.5">{err}</div>}
        <button onClick={verify} disabled={busy || code.length !== 6} className="w-full mt-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Verifikasi
        </button>
        <button onClick={onCancel} className="w-full mt-2 text-xs text-slate-400 hover:text-slate-600 py-2">
          Bukan kamu? Ganti akun
        </button>
      </div>
    </div>
  );
}

function Splash({ inline }) {
  return (
    <div className={`${inline ? "py-20" : "min-h-screen"} bg-slate-50 flex flex-col items-center justify-center gap-3`}>
      <div className="animate-pulse"><NextoRobotHead size={48} /></div>
      <div className="text-slate-400 text-sm flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Memuat…</div>
    </div>
  );
}
