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
  Lightbulb, Bot, Settings as SettingsIcon, Loader2, LogOut, Users2, Lock, Camera,
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
  const [org, setOrg] = useState(null);
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
      let [st, se, ls, comp, dt] = await Promise.all([db.getStages(), db.getSettings(), db.getLeads(), db.getCompetitors(), db.getDealTransactions()]);
      // Akun baru (belum pernah setup pipeline sama sekali) - otomatis kasih
      // pipeline default biar gak kosong melompong abis daftar sendiri.
      if (st.length === 0) {
        try { await db.initDefaultStages(); st = await db.getStages(); } catch (e) { console.error(e); }
      }
      try { setOrg(await db.getMyOrg()); } catch (e) { console.error(e); }
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
  const isPremium = settings.plan === "premium" || org?.plan === "enterprise";
  const FREE_TABS = ["dashboard", "leads"];

  const stageList = stages.length ? stages : [{ key: "prospek", label: "Prospek", hex: "#94a3b8", type: "normal" }];
  const effectiveTab = tab;
  const isLocked = (key) => !isPremium && !FREE_TABS.includes(key);

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
          <div className="leading-tight flex-1"><div className="font-bold tracking-tight text-[15px]">Nexto</div></div>
          <ProfileAvatar settings={settings} onChanged={reload} size={32} />
        </div>
        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
          {NAV.map((n) => { const I = n.icon; const active = effectiveTab === n.key; const locked = isLocked(n.key);
            const cls = locked
              ? "text-slate-500 hover:bg-white/[0.03] cursor-pointer"
              : n.special
              ? (active ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-lg shadow-violet-600/25" : "text-violet-300 hover:bg-violet-500/10 hover:text-violet-200")
              : (active ? "bg-orange-600 text-white font-semibold shadow-lg shadow-orange-600/20" : "text-slate-300 hover:bg-white/[0.06] hover:text-white");
            return (
            <button key={n.key} onClick={() => setTab(n.key)} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition-all duration-150 ${cls}`}>
              <I size={17} strokeWidth={active ? 2.5 : 2} /> <span className="flex-1 text-left">{n.label}</span> {locked && <Lock size={13} className="shrink-0" />}
            </button> ); })}
        </nav>
        <button onClick={() => supabase.auth.signOut()} className="m-3 px-4 py-2.5 rounded-2xl bg-white/[0.04] text-xs text-slate-300 hover:bg-white/10 flex items-center gap-2 transition-colors"><LogOut size={14} /> Keluar</button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/60 shadow-[0_1px_12px_-2px_rgba(15,23,42,0.06)]">
          <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center gap-2.5">
            <NextoBadge size={32} />
            <div className="leading-tight flex-1"><div className="font-bold tracking-tight text-sm">Nexto · <span className="text-slate-500 font-medium">{NAV.find((n) => n.key === effectiveTab)?.label}</span></div></div>
            <ProfileAvatar settings={settings} onChanged={reload} size={32} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto pb-32">
          {!isPremium && (
            <div className="mb-4 bg-orange-50 border border-orange-200 text-orange-800 text-xs rounded-2xl px-4 py-2.5 flex items-center justify-between gap-2">
              <span>Kamu sekarang di paket <b>Free</b> (Dashboard &amp; Leads doang). Upgrade ke Premium (Rp149rb/bulan) buat buka semua fitur + bot Telegram + Calendar + AI.</span>
              <a href="https://subscription.myr.id/m/nexto-premium-88379/" target="_blank" rel="noreferrer" className="shrink-0 underline font-medium">Upgrade</a>
            </div>
          )}
          {loading ? <Splash inline /> : (
            <>
              {effectiveTab === "dashboard" && <Dashboard leads={leads} stages={stageList} dealTransactions={dealTransactions} onGo={setTab} />}
              {effectiveTab === "leads" && <Leads leads={leads} stages={stageList} settings={settings} onChanged={reload} />}
              {effectiveTab === "deal" && <PreviewLock locked={isLocked("deal")}><Deal leads={isLocked("deal") ? DUMMY_LEADS : leads} stages={stageList} dealTransactions={isLocked("deal") ? DUMMY_DEAL_TX : dealTransactions} onEdit={setEditLead} onChanged={reload} /></PreviewLock>}
              {effectiveTab === "visitfollowup" && <PreviewLock locked={isLocked("visitfollowup")}><VisitFollowup leads={isLocked("visitfollowup") ? DUMMY_LEADS : leads} onEdit={setEditLead} onChanged={reload} /></PreviewLock>}
              {effectiveTab === "kompetitor" && <PreviewLock locked={isLocked("kompetitor")}><Kompetitor competitors={isLocked("kompetitor") ? DUMMY_COMPETITORS : competitors} onChanged={reload} /></PreviewLock>}
              {effectiveTab === "komunitas" && <PreviewLock locked={isLocked("komunitas")}><Nex dummy={isLocked("komunitas")} /></PreviewLock>}
              {effectiveTab === "advisor" && <PreviewLock locked={isLocked("advisor")}><Advisor leads={isLocked("advisor") ? DUMMY_LEADS : leads} stages={stageList} onOpen={setEditLead} dummy={isLocked("advisor")} /></PreviewLock>}
              {effectiveTab === "settings" && <PreviewLock locked={isLocked("settings")}><SettingsTab settings={settings} stages={stageList} leads={leads} onChanged={reload} /></PreviewLock>}
            </>
          )}
        </main>

        <nav className="md:hidden fixed bottom-3 inset-x-3 z-40">
          <div className="max-w-lg mx-auto flex justify-around px-1.5 py-2 bg-white/90 backdrop-blur-xl rounded-[26px] shadow-[0_8px_32px_-6px_rgba(15,23,42,0.18)] border border-white/60">
            {NAV.map((n) => { const I = n.icon; const active = effectiveTab === n.key; const locked = isLocked(n.key);
              const cls = locked
                ? "text-slate-300"
                : n.special
                ? (active ? "text-violet-600 bg-violet-50" : "text-violet-400")
                : (active ? "text-orange-600 bg-orange-50" : "text-slate-400");
              return (
              <button key={n.key} onClick={() => setTab(n.key)} className={`relative flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-2xl transition-colors ${cls}`}>
                <I size={19} strokeWidth={active ? 2.5 : 2} /><span className="text-[9px] font-medium leading-none truncate max-w-full mt-0.5">{n.short}</span>
                {locked && <Lock size={9} className="absolute top-0.5 right-2" />}
              </button> ); })}
          </div>
        </nav>
      </div>

      {editLead && <LeadModal lead={editLead} stages={stageList} settings={settings} onClose={() => setEditLead(null)} onSaved={() => { setEditLead(null); reload(); }} />}
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

// Avatar bulat pojok kanan atas (kayak Gmail/Notion) - klik buka menu kecil
// isinya foto, jabatan, dan tombol edit.
function ProfileAvatar({ settings, onChanged, size = 36 }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [jobTitle, setJobTitle] = useState(settings.job_title || "");
  const [name, setName] = useState(settings.community_display_name || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const initial = (settings.community_display_name || "?").charAt(0).toUpperCase();

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

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="shrink-0 rounded-full overflow-hidden bg-orange-600 text-white flex items-center justify-center font-semibold" style={{ width: size, height: size, fontSize: size * 0.4 }}>
        {settings.avatar_url ? <img src={settings.avatar_url} alt="" className="w-full h-full object-cover" /> : initial}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setEditing(false); }} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-lg z-50 p-4">
            {!editing ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-orange-600 text-white flex items-center justify-center font-semibold text-lg shrink-0">
                    {settings.avatar_url ? <img src={settings.avatar_url} alt="" className="w-full h-full object-cover" /> : initial}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{settings.community_display_name || "Belum ada nama"}</div>
                    <div className="text-xs text-slate-400 truncate">{settings.job_title || "Belum ada jabatan"}</div>
                  </div>
                </div>
                <button onClick={() => setEditing(true)} className="w-full text-xs border border-slate-300 rounded-xl py-2 hover:bg-slate-50">Edit Profil</button>
              </>
            ) : (
              <>
                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-orange-600 text-white flex items-center justify-center font-semibold text-lg shrink-0 relative">
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : settings.avatar_url ? <img src={settings.avatar_url} alt="" className="w-full h-full object-cover" /> : initial}
                  </div>
                  <span className="text-xs text-orange-600 flex items-center gap-1"><Camera size={13} /> Ganti foto</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
                </label>
                <input className="w-full mb-2 px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500" placeholder="Nama" value={name} onChange={(e) => setName(e.target.value)} />
                <input className="w-full mb-3 px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500" placeholder="Jabatan (misal Sales Executive)" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex-1 text-xs border border-slate-300 rounded-xl py-2 hover:bg-slate-50">Batal</button>
                  <button onClick={saveProfile} disabled={saving} className="flex-1 text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl py-2 font-medium">{saving ? "..." : "Simpan"}</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
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
