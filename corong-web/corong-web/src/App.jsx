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
import ChatAssistant from "./tabs/ChatAssistant";
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
  { key: "asisten", label: "Asisten", short: "Chat", icon: Bot },
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
      const [st, se, ls, comp] = await Promise.all([db.getStages(), db.getSettings(), db.getLeads(), db.getCompetitors()]);
      setStages(st); setSettings(se); setLeads(ls); setCompetitors(comp);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  // Reload diem-diem (TANPA nyalain loading spinner) - dipakai buat nyegerin data
  // pas balik dari tab/app lain yang udah lama ditinggal, tanpa bikin layar kedip loading.
  const silentReload = async () => {
    try {
      const [st, se, ls, comp] = await Promise.all([db.getStages(), db.getSettings(), db.getLeads(), db.getCompetitors()]);
      setStages(st); setSettings(se); setLeads(ls); setCompetitors(comp);
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

  if (!isConfigured) return <ConfigScreen />;
  if (!authReady) return <Splash />;
  if (!session) return <Auth />;

  const stageList = stages.length ? stages : [{ key: "prospek", label: "Prospek", hex: "#94a3b8", type: "normal" }];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <aside className="hidden md:flex flex-col w-60 bg-slate-900 text-white sticky top-0 h-screen shrink-0">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <NextoBadge size={36} />
          <div className="leading-tight"><div className="font-bold tracking-tight text-[15px]">Nexto</div></div>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => { const I = n.icon; const active = tab === n.key;
            const cls = n.special
              ? (active ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-violet-600/25" : "text-violet-300 hover:bg-violet-500/10 hover:text-violet-200")
              : (active ? "bg-orange-600 text-white font-semibold shadow-lg shadow-orange-600/25" : "text-slate-300 hover:bg-white/5 hover:text-white");
            return (
            <button key={n.key} onClick={() => setTab(n.key)} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm transition-all ${cls}`}>
              <I size={17} strokeWidth={active ? 2.5 : 2} /> {n.label}
            </button> ); })}
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="m-3 px-3 py-2.5 rounded-2xl bg-white/5 text-xs text-slate-300 hover:bg-white/10 flex items-center gap-2"><LogOut size={14} /> Keluar</button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200/70">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2.5">
            <NextoBadge size={32} />
            <div className="leading-tight flex-1"><div className="font-bold tracking-tight text-sm">Nexto · <span className="text-slate-500 font-medium">{NAV.find((n) => n.key === tab)?.label}</span></div></div>
            <button onClick={() => supabase.auth.signOut()} className="text-slate-400"><LogOut size={16} /></button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto pb-28">
          {loading ? <Splash inline /> : (
            <>
              {tab === "dashboard" && <Dashboard leads={leads} stages={stageList} onGo={setTab} />}
              {tab === "leads" && <Leads leads={leads} stages={stageList} settings={settings} onChanged={reload} />}
              {tab === "deal" && <Deal leads={leads} stages={stageList} onEdit={setEditLead} onChanged={reload} />}
              {tab === "visitfollowup" && <VisitFollowup leads={leads} onEdit={setEditLead} onChanged={reload} />}
              {tab === "kompetitor" && <Kompetitor competitors={competitors} onChanged={reload} />}
              {tab === "komunitas" && <Nex />}
              {tab === "advisor" && <Advisor leads={leads} stages={stageList} onOpen={setEditLead} />}
              {tab === "asisten" && <ChatAssistant />}
              {tab === "settings" && <SettingsTab settings={settings} stages={stageList} leads={leads} onChanged={reload} />}
            </>
          )}
        </main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-lg border-t border-slate-200">
          <div className="max-w-lg mx-auto flex justify-around px-1 pt-1.5 pb-2 overflow-x-auto">
            {NAV.map((n) => { const I = n.icon; const active = tab === n.key;
              const cls = n.special ? (active ? "text-violet-600" : "text-violet-400") : (active ? "text-orange-600" : "text-slate-400");
              return (
              <button key={n.key} onClick={() => setTab(n.key)} className={`flex flex-col items-center gap-0.5 flex-1 py-1 rounded-xl ${cls}`}>
                <I size={20} strokeWidth={active ? 2.5 : 2} /><span className="text-[9px] font-medium leading-none truncate max-w-full">{n.short}</span>
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
