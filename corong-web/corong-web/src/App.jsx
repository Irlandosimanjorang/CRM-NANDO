import { useEffect, useState, useMemo, useRef } from "react";
import { supabase, isConfigured } from "./lib/supabaseClient";
import * as db from "./lib/db";
import Auth from "./Auth";
import Dashboard from "./tabs/Dashboard";
import Leads from "./tabs/Leads";
import Deal from "./tabs/Deal";
import VisitFollowup from "./tabs/VisitFollowup";
import Kompetitor from "./tabs/Kompetitor";
import Nex from "./tabs/Nex";
import Advisor from "./tabs/Advisor";
import SettingsTab from "./tabs/Settings";
import LeadModal from "./components/LeadModal";
import {
  LayoutDashboard, Users, Trophy, CalendarCheck, Swords,
  Lightbulb, Bot, Settings as SettingsIcon, Loader2, LogOut, Users2,
} from "lucide-react";

export function NextoBadge({ size = 36 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="shrink-0">
      <path d="M51,92 L17.04,15.15 Q13,6 21.46,11.34 L51,30 Z" fill="#f97316" />
      <path d="M51,92 L51,30 L80.54,11.34 Q89,6 84.96,15.15 Z" fill="#9a3412" />
    </svg>
  );
}

const NAV = [
  { key: "dashboard", label: "Dashboard", short: "Beranda", icon: LayoutDashboard },
  { key: "leads", label: "Leads", short: "Leads", icon: Users },
  { key: "deal", label: "Deal", short: "Deal", icon: Trophy },
  { key: "visitfollowup", label: "Visit & Follow-up", short: "Visit", icon: CalendarCheck },
  { key: "kompetitor", label: "Kompetitor", short: "Rival", icon: Swords },
  { key: "komunitas", label: "Nex", short: "Nex", icon: Users2, special: true },
  { key: "advisor", label: "AI Advisor", short: "AI", icon: Lightbulb },
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
  const [editLead, setEditLead] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const reload = async () => {
    setLoading(true);
    try {
      let [st, se, ls, comp, dt] = await Promise.all([db.getStages(), db.getSettings(), db.getLeads(), db.getCompetitors(), db.getDealTransactions()]);
      // Akun baru (belum pernah setup pipeline sama sekali) - otomatis kasih
      // pipeline default biar gak kosong melompong abis daftar sendiri.
      if (st.length === 0) {
        try { await db.initDefaultStages(); st = await db.getStages(); } catch (e) { console.error(e); }
      }
      setStages(st); setSettings(se); setLeads(ls); setCompetitors(comp); setDealTransactions(dt);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
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

  // ---- SISTEM 2 TIPE (FREE / PREMIUM) ----
  // Gak ada trial otomatis - daftar langsung dapet Free (Dashboard & Leads doang).
  // Fitur AI (Bot Telegram, AI Advisor, Rekam Meeting, dst) pake token API
  // berbayar, jadi cuma kebuka abis di-upgrade ke Premium (settings.plan = 'premium').
  const isPremium = settings.plan === "premium";
  const FREE_TABS = ["dashboard", "leads"];

  const stageList = stages.length ? stages : [{ key: "prospek", label: "Prospek", hex: "#94a3b8", type: "normal" }];
  const visibleNav = isPremium ? NAV : NAV.filter((n) => FREE_TABS.includes(n.key));
  const effectiveTab = isPremium || FREE_TABS.includes(tab) ? tab : "dashboard";

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/50 via-slate-50 to-slate-50 text-slate-900 flex">
      {(pullVisual > 0 || refreshing) && (
        <div
          className="md:hidden fixed top-0 inset-x-0 z-50 flex items-start justify-center pointer-events-none transition-[height] duration-150"
          style={{ height: refreshing ? 56 : pullVisual }}
        >
          <div className="bg-white rounded-full p-2 shadow-lg mt-2">
            <Loader2
              size={18}
              className="text-orange-500"
              style={refreshing ? { animation: "spin 0.8s linear infinite" } : { transform: `rotate(${pullVisual * 3}deg)` }}
            />
          </div>
        </div>
      )}
      <aside className="hidden md:flex flex-col w-60 bg-slate-900 text-white sticky top-0 h-screen shrink-0">
        <div className="px-5 py-6 flex items-center gap-2.5 border-b border-white/5">
          <NextoBadge size={36} />
          <div className="leading-tight"><div className="font-bold tracking-tight text-[15px]">Nexto</div></div>
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
          {visibleNav.map((n) => { const I = n.icon; const active = effectiveTab === n.key;
            const cls = n.special
              ? (active ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-violet-600/25" : "text-violet-300 hover:bg-violet-500/10 hover:text-violet-200")
              : (active ? "bg-orange-600 text-white font-semibold shadow-lg shadow-orange-600/20" : "text-slate-300 hover:bg-white/[0.06] hover:text-white");
            return (
            <button key={n.key} onClick={() => setTab(n.key)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition-all duration-150 ${cls}`}>
              <I size={17} strokeWidth={active ? 2.5 : 2} /> {n.label}
            </button> ); })}
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="m-3 px-4 py-2.5 rounded-2xl bg-white/[0.04] text-xs text-slate-300 hover:bg-white/10 flex items-center gap-2 transition-colors"><LogOut size={14} /> Keluar</button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/60 shadow-[0_1px_12px_-2px_rgba(15,23,42,0.06)]">
          <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center gap-2.5">
            <NextoBadge size={32} />
            <div className="leading-tight flex-1"><div className="font-bold tracking-tight text-sm">Nexto · <span className="text-slate-500 font-medium">{NAV.find((n) => n.key === effectiveTab)?.label}</span></div></div>
            <button onClick={() => supabase.auth.signOut()} className="text-slate-400"><LogOut size={16} /></button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto pb-32">
          {!isPremium && (
            <div className="mb-4 bg-orange-50 border border-orange-200 text-orange-800 text-xs rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2">
              <span>Kamu sekarang di paket <b>Free</b> (Dashboard &amp; Leads doang). Upgrade ke Premium (Rp149rb/bulan) buat buka semua fitur + bot Telegram + Calendar + AI.</span>
              <a href="https://wa.me/6281234567890" target="_blank" rel="noreferrer" className="shrink-0 underline font-medium">Upgrade</a>
            </div>
          )}
          {loading ? <Splash inline /> : (
            <>
              {effectiveTab === "dashboard" && <Dashboard leads={leads} stages={stageList} dealTransactions={dealTransactions} onGo={setTab} />}
              {effectiveTab === "leads" && <Leads leads={leads} stages={stageList} settings={settings} onChanged={reload} />}
              {effectiveTab === "deal" && <Deal leads={leads} stages={stageList} dealTransactions={dealTransactions} onEdit={setEditLead} onChanged={reload} />}
              {effectiveTab === "visitfollowup" && <VisitFollowup leads={leads} onEdit={setEditLead} onChanged={reload} />}
              {effectiveTab === "kompetitor" && <Kompetitor competitors={competitors} onChanged={reload} />}
              {effectiveTab === "komunitas" && <Nex />}
              {effectiveTab === "advisor" && <Advisor leads={leads} stages={stageList} onOpen={setEditLead} />}
              {effectiveTab === "settings" && <SettingsTab settings={settings} stages={stageList} leads={leads} onChanged={reload} />}
            </>
          )}
        </main>

        <nav className="md:hidden fixed bottom-3 inset-x-3 z-40">
          <div className="max-w-lg mx-auto flex justify-around px-1.5 py-2 bg-white/90 backdrop-blur-xl rounded-[26px] shadow-[0_8px_32px_-6px_rgba(15,23,42,0.18)] border border-white/60">
            {visibleNav.map((n) => { const I = n.icon; const active = effectiveTab === n.key;
              const cls = n.special
                ? (active ? "text-violet-600 bg-violet-50" : "text-violet-400")
                : (active ? "text-orange-600 bg-orange-50" : "text-slate-400");
              return (
              <button key={n.key} onClick={() => setTab(n.key)} className={`flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-2xl transition-colors ${cls}`}>
                <I size={19} strokeWidth={active ? 2.5 : 2} /><span className="text-[9px] font-medium leading-none truncate max-w-full mt-0.5">{n.short}</span>
              </button> ); })}
          </div>
        </nav>
      </div>

      {editLead && <LeadModal lead={editLead} stages={stageList} settings={settings} onClose={() => setEditLead(null)} onSaved={() => { setEditLead(null); reload(); }} />}
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
