import { useEffect, useState, useMemo } from "react";
import { supabase, isConfigured } from "./lib/supabaseClient";
import * as db from "./lib/db";
import Auth from "./Auth";
import Dashboard from "./tabs/Dashboard";
import Leads from "./tabs/Leads";
import Deal from "./tabs/Deal";
import Visit from "./tabs/Visit";
import Kompetitor from "./tabs/Kompetitor";
import Followup from "./tabs/Followup";
import Advisor from "./tabs/Advisor";
import SettingsTab from "./tabs/Settings";
import LeadModal from "./components/LeadModal";
import {
  Filter, LayoutDashboard, Users, Trophy, CalendarCheck, Swords, CalendarClock,
  Lightbulb, Settings as SettingsIcon, Loader2, CheckCircle2, LogOut,
} from "lucide-react";

const NAV = [
  { key: "dashboard", label: "Dashboard", short: "Beranda", icon: LayoutDashboard },
  { key: "leads", label: "Leads", short: "Leads", icon: Users },
  { key: "deal", label: "Deal", short: "Deal", icon: Trophy },
  { key: "visit", label: "Visit", short: "Visit", icon: CalendarCheck },
  { key: "kompetitor", label: "Kompetitor", short: "Rival", icon: Swords },
  { key: "followup", label: "Follow-up", short: "Follow", icon: CalendarClock },
  { key: "advisor", label: "AI Advisor", short: "AI", icon: Lightbulb },
  { key: "settings", label: "Pengaturan", short: "Lainnya", icon: SettingsIcon },
];

function ConfigScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md bg-white border border-slate-200/80 rounded-3xl shadow-sm p-7">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25 mb-4"><Filter size={24} className="text-slate-900" /></div>
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
  const [advisor, setAdvisor] = useState({ ran_at: "", recs: [] });
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
      const [st, se, ls, comp, adv] = await Promise.all([db.getStages(), db.getSettings(), db.getLeads(), db.getCompetitors(), db.getAdvisor()]);
      setStages(st); setSettings(se); setLeads(ls); setCompetitors(comp); setAdvisor(adv);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (session) reload(); }, [session]);

  if (!isConfigured) return <ConfigScreen />;
  if (!authReady) return <Splash />;
  if (!session) return <Auth />;

  const stageList = stages.length ? stages : [{ key: "prospek", label: "Prospek", hex: "#94a3b8", type: "normal" }];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <aside className="hidden md:flex flex-col w-60 bg-slate-900 text-white sticky top-0 h-screen shrink-0">
        <div className="px-5 py-5 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25"><Filter size={18} className="text-slate-900" /></div>
          <div className="leading-tight"><div className="font-bold tracking-tight text-[15px]">Corong</div><div className="text-[10px] uppercase tracking-widest text-slate-400">PVC Sales CRM</div></div>
        </div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV.map((n) => { const I = n.icon; const active = tab === n.key; return (
            <button key={n.key} onClick={() => setTab(n.key)} className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-sm transition-all ${active ? "bg-amber-500 text-slate-900 font-semibold shadow-lg shadow-amber-500/25" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
              <I size={17} strokeWidth={active ? 2.5 : 2} /> {n.label}
            </button> ); })}
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="m-3 px-3 py-2.5 rounded-2xl bg-white/5 text-xs text-slate-300 hover:bg-white/10 flex items-center gap-2"><LogOut size={14} /> Keluar</button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200/70">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center"><Filter size={16} className="text-slate-900" /></div>
            <div className="leading-tight flex-1"><div className="font-bold tracking-tight text-sm">Corong · <span className="text-slate-500 font-medium">{NAV.find((n) => n.key === tab)?.label}</span></div></div>
            <button onClick={() => supabase.auth.signOut()} className="text-slate-400"><LogOut size={16} /></button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto pb-28">
          {loading ? <Splash inline /> : (
            <>
              {tab === "dashboard" && <Dashboard leads={leads} stages={stageList} onGo={setTab} />}
              {tab === "leads" && <Leads leads={leads} stages={stageList} settings={settings} onChanged={reload} />}
              {tab === "deal" && <Deal leads={leads} stages={stageList} onEdit={setEditLead} onChanged={reload} />}
              {tab === "visit" && <Visit leads={leads} onEdit={setEditLead} onChanged={reload} />}
              {tab === "kompetitor" && <Kompetitor competitors={competitors} onChanged={reload} />}
              {tab === "followup" && <Followup leads={leads} onEdit={setEditLead} onChanged={reload} />}
              {tab === "advisor" && <Advisor leads={leads} stages={stageList} saved={advisor} onApplied={reload} onOpen={setEditLead} />}
              {tab === "settings" && <SettingsTab settings={settings} stages={stageList} onChanged={reload} />}
            </>
          )}
        </main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 backdrop-blur-lg border-t border-slate-200">
          <div className="max-w-lg mx-auto flex justify-around px-1 pt-1.5 pb-2">
            {NAV.map((n) => { const I = n.icon; const active = tab === n.key; return (
              <button key={n.key} onClick={() => setTab(n.key)} className={`flex flex-col items-center gap-0.5 flex-1 py-1 rounded-xl ${active ? "text-amber-600" : "text-slate-400"}`}>
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
      <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25 animate-pulse"><Filter size={24} className="text-slate-900" /></div>
      <div className="text-slate-400 text-sm flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Memuat…</div>
    </div>
  );
}
