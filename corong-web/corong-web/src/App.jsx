import { useEffect, useState, useMemo, useRef } from "react";
import { supabase, isConfigured } from "./lib/supabaseClient";
import * as db from "./lib/db";
import Auth from "./Auth";
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
import {
  LayoutDashboard, Users, Trophy, CalendarCheck, Swords,
  Lightbulb, Bot, Settings as SettingsIcon, Loader2, LogOut, Users2, Lock, Camera, Mail, Sparkles,
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
  {
    id: "dummy-1",
    name: "PT Sinar Abadi Plastik",
    category: "Resin & Compound",
    stage_key: "presentasi",
    city: "Tangerang",
    key_person: "Budi Santoso",
    key_person_title: "Purchasing Manager",
    phone: "0812xxxxxx01",
    email: "budi@sinarabadi.co.id",
    visit_date: today,
    visit_meet: "Budi Santoso",
    visit_agenda: "Presentasi produk & harga penawaran",
    last_contact: "2026-08-20",
    next_action: "Follow up hasil presentasi minggu lalu",
    latitude: null,
    longitude: null,
    source: "manual"
  },
  {
    id: "dummy-2",
    name: "CV Karya Plastindo",
    category: "Pipa & Fitting",
    stage_key: "negosiasi",
    city: "Bekasi",
    key_person: "Sari Wulandari",
    key_person_title: "Direktur",
    phone: "0812xxxxxx02",
    email: "sari@karyaplastindo.id",
    visit_date: tomorrow,
    visit_meet: "Sari Wulandari",
    visit_agenda: "Trial sample produk",
    last_contact: "2026-08-18",
    next_action: "Kirim sample ke pabrik",
    latitude: null,
    longitude: null,
    source: "manual"
  },
  {
    id: "dummy-3",
    name: "PT Maju Bersama Kimia",
    category: "Kabel Listrik",
    stage_key: "deal",
    city: "Surabaya",
    key_person: "Ahmad Fauzi",
    key_person_title: "Owner",
    phone: "0812xxxxxx03",
    email: "ahmad@majubersama.co.id",
    last_contact: "2026-08-15",
    latitude: null,
    longitude: null,
    source: "telegram"
  },
];

const DUMMY_DEAL_TX = [
  {
    id: "dd-1",
    lead_id: "dummy-3",
    lead_name: "PT Maju Bersama Kimia",
    deal_date: "2026-08-15",
    deal_value: 45000000,
    tonnage: 5,
    tonnage_unit: "ton",
    chemical: "PVC Resin K67"
  },
  {
    id: "dd-2",
    lead_id: "dummy-2",
    lead_name: "CV Karya Plastindo",
    deal_date: "2026-08-10",
    deal_value: 28000000,
    tonnage: 3,
    tonnage_unit: "ton",
    chemical: "Calcium Zinc Stabilizer"
  },
];

const DUMMY_COMPETITORS = [
  {
    id: "dc-1",
    name: "PT Kompetitor Jaya",
    background: "Pemain lama di area Jabodetabek",
    product: "PVC Compound",
    notes: "Harga agresif tapi servis lambat",
    usages: [
      {
        id: "u1",
        company: "PT ABC Plastik",
        product: "Compound X",
        price: "Rp15.000/kg",
        quantity: "2 ton/bulan"
      }
    ]
  },
  {
    id: "dc-2",
    name: "CV Rival Chemical",
    background: "Fokus segmen kabel listrik",
    product: "Kabel Compound",
    notes: "Kuat di after-sales support",
    usages: []
  },
];

const NAV = [
  { key: "dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { key: "leads", label: "Leads", short: "Leads", icon: Users },
  { key: "generateleads", label: "Generate Leads", short: "Generate", icon: Sparkles, premium: true },
  { key: "deal", label: "Deal", short: "Deal", icon: Trophy, premium: true },
  { key: "visitfollowup", label: "Visit & Follow-up", short: "Visit", icon: CalendarCheck, premium: true },
  { key: "kompetitor", label: "Kompetitor", short: "Kompetitor", icon: Swords, premium: true },
  { key: "komunitas", label: "Komunitas", short: "Komunitas", icon: Users2, premium: true, special: true },
  { key: "advisor", label: "AI Advisor", short: "AI", icon: Lightbulb, premium: true, special: true },
  { key: "settings", label: "Pengaturan", short: "Setting", icon: SettingsIcon, premium: true },
];

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
  const [editLead, setEditLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullVisual, setPullVisual] = useState(0);

  const touchStartY = useRef(null);
  const touchCurrentY = useRef(null);

  useEffect(() => {
    if (!isConfigured) {
      setAuthReady(true);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadData = async () => {
    if (!session?.user) return;

    setLoading(true);

    try {
      const [
        mySettings,
        myStages,
        myLeads,
        myDeals,
        myCompetitors,
        myOrg,
      ] = await Promise.all([
        db.getMySettings(),
        db.getStages(),
        db.getLeads(),
        db.getDealTransactions(),
        db.getCompetitors(),
        db.getMyOrg(),
      ]);

      setSettings(mySettings || { sales_names: [] });
      setStages(myStages || []);
      setLeads(myLeads || []);
      setDealTransactions(myDeals || []);
      setCompetitors(myCompetitors || []);
      setOrg(myOrg || null);
    } catch (err) {
      console.error("loadData:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      loadData();
    }
  }, [session]);

  const reload = async () => {
    await loadData();
  };

  const stageList = useMemo(() => {
    return stages?.length
      ? stages
      : [
          { key: "lead", label: "Lead" },
          { key: "kontak", label: "Kontak" },
          { key: "presentasi", label: "Presentasi" },
          { key: "negosiasi", label: "Negosiasi" },
          { key: "deal", label: "Deal" },
        ];
  }, [stages]);

  const isPremium =
    settings?.plan === "premium" ||
    org?.plan === "enterprise";

  const isLocked = (key) => {
    const item = NAV.find((n) => n.key === key);
    if (!item?.premium) return false;
    return !isPremium;
  };

  const effectiveTab =
    isLocked(tab) && tab !== "dashboard" && tab !== "leads"
      ? tab
      : tab;

  const setTabSafe = (nextTab) => {
    setTab(nextTab);
  };

  useEffect(() => {
    const onPopState = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && NAV.some((n) => n.key === hash)) {
        setTab(hash);
      }
    };

    onPopState();
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (tab) {
      window.history.replaceState(null, "", `#${tab}`);
    }
  }, [tab]);

  const handleTouchStart = (e) => {
    if (window.scrollY <= 0) {
      touchStartY.current = e.touches?.[0]?.clientY || null;
      touchCurrentY.current = touchStartY.current;
    }
  };

  const handleTouchMove = (e) => {
    if (touchStartY.current == null) return;

    touchCurrentY.current = e.touches?.[0]?.clientY || touchStartY.current;

    const diff = touchCurrentY.current - touchStartY.current;

    if (diff > 0 && window.scrollY <= 0) {
      const visual = Math.min(diff * 0.45, 72);
      setPullVisual(visual);
    }
  };

  const handleTouchEnd = async () => {
    if (touchStartY.current == null) return;

    const diff =
      (touchCurrentY.current || touchStartY.current) -
      touchStartY.current;

    touchStartY.current = null;
    touchCurrentY.current = null;

    if (diff > 100 && window.scrollY <= 0) {
      setRefreshing(true);
      setPullVisual(56);

      try {
        await reload();
      } finally {
        setRefreshing(false);
        setPullVisual(0);
      }
    } else {
      setPullVisual(0);
    }
  };

  const joinWithCode = async () => {
    if (!joinCode.trim()) {
      setJoinMsg("Masukkan kode Enterprise.");
      return;
    }

    setJoinBusy(true);
    setJoinMsg("");

    try {
      await db.joinOrganizationByCode(joinCode.trim().toUpperCase());
      setJoinMsg("Berhasil bergabung ke organization.");
      setJoinCode("");
      await reload();
    } catch (err) {
      setJoinMsg("Gagal: " + err.message);
    } finally {
      setJoinBusy(false);
    }
  };

  if (!authReady) {
    return <Splash />;
  }

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <NextoBadge size={38} />
            <div>
              <div className="font-bold text-slate-900">Nexto</div>
              <div className="text-xs text-slate-400">Sales Operating System</div>
            </div>
          </div>

          <h1 className="text-lg font-bold text-slate-900">
            Supabase belum dikonfigurasi
          </h1>

          <p className="text-sm text-slate-500 mt-2 leading-6">
            Pastikan environment variable Supabase sudah tersedia di Vercel.
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(pullVisual > 0 || refreshing) && (
        <div
          className="md:hidden fixed top-0 inset-x-0 z-50 flex items-start justify-center pointer-events-none transition-[height] duration-150"
          style={{ height: refreshing ? 56 : pullVisual }}
        >
          <div className="bg-white rounded-full p-2 shadow-lg mt-2 border border-slate-100">
            <Loader2
              size={18}
              className="text-orange-500"
              style={
                refreshing
                  ? { animation: "spin 0.8s linear infinite" }
                  : {
                      transform: `rotate(${pullVisual * 3}deg)`,
                    }
              }
            />
          </div>
        </div>
      )}

      <div className="md:flex min-h-screen">
        {/* DESKTOP SIDEBAR */}
        <aside className="hidden md:flex flex-col w-[230px] sticky top-0 h-screen bg-white border-r border-slate-200 shrink-0">
          <div className="px-5 py-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <NextoBadge size={34} />

              <div className="min-w-0">
                <div className="font-extrabold tracking-tight text-slate-900">
                  NE<span className="text-orange-500">X</span>TO
                </div>
                <div className="text-[9px] uppercase tracking-[0.15em] text-slate-400">
                  Sales Operating System
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV.map((n) => {
              const I = n.icon;
              const active = effectiveTab === n.key;
              const locked = isLocked(n.key);

              return (
                <button
                  key={n.key}
                  onClick={() => setTabSafe(n.key)}
                  className={[
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors",
                    active
                      ? "bg-orange-50 text-orange-700 font-semibold"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                    locked ? "opacity-70" : "",
                  ].join(" ")}
                >
                  <I size={17} />
                  <span className="flex-1 text-left">{n.label}</span>

                  {locked && (
                    <Lock
                      size={12}
                      className="text-slate-400"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="px-4 pb-4">
            <ProfileAvatar
              settings={settings}
              session={session}
              org={org}
              onChanged={reload}
              size={38}
              align="left"
            />

            <button
              onClick={() => supabase.auth.signOut()}
              className="mt-3 w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut size={14} />
              Keluar
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* MOBILE TOPBAR */}
          <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
            <div className="px-4 py-3 flex items-center gap-3">
              <NextoBadge size={30} />

              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-sm tracking-tight">
                  NE<span className="text-orange-500">X</span>TO
                </div>
                <div className="text-[9px] text-slate-400">
                  {NAV.find((n) => n.key === effectiveTab)?.label}
                </div>
              </div>

              <ProfileAvatar
                settings={settings}
                session={session}
                org={org}
                onChanged={reload}
                size={34}
              />
            </div>
          </header>

          {/* DESKTOP TOPBAR */}
          <header className="hidden md:flex sticky top-0 z-20 h-16 items-center justify-between border-b border-slate-200 bg-white/95 backdrop-blur px-6">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Workspace</span>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-700">
                {NAV.find((n) => n.key === effectiveTab)?.label}
              </span>
            </div>

            <ProfileAvatar
              settings={settings}
              session={session}
              org={org}
              onChanged={reload}
              size={36}
            />
          </header>

          <main className="w-full max-w-[1400px] mx-auto px-4 md:px-7 lg:px-9 py-5 md:py-7 pb-28">
            {!loading && !isPremium && (
              <div className="mb-5 bg-orange-50 border border-orange-100 rounded-2xl overflow-hidden">
                <div className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                      <Sparkles size={15} />
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        Kamu sedang memakai Nexto Free
                      </div>

                      <div className="text-[10px] leading-4 text-slate-500 mt-0.5">
                        Dashboard & Leads aktif. Upgrade untuk membuka AI,
                        Deal, Visit, Calendar, dan automation.
                      </div>
                    </div>
                  </div>

                  <a
                    href="https://subscription.myr.id/m/nexto-premium-88379/"
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-xl bg-slate-900 px-4 py-2 text-center text-[11px] font-semibold text-white hover:bg-slate-800"
                  >
                    Upgrade Premium →
                  </a>
                </div>

                <div className="border-t border-orange-100 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="text-[10px] text-orange-800/80">
                      Punya kode Enterprise?
                    </div>

                    <div className="flex flex-1 gap-2 sm:max-w-md">
                      <input
                        className="min-w-0 flex-1 rounded-xl border border-orange-200 bg-white px-3 py-2 text-[10px] uppercase text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
                        placeholder="MASUKIN KODE"
                        value={joinCode}
                        onChange={(e) =>
                          setJoinCode(e.target.value.toUpperCase())
                        }
                        maxLength={6}
                      />

                      <button
                        onClick={joinWithCode}
                        disabled={joinBusy}
                        className="rounded-xl bg-orange-600 px-3.5 text-[10px] font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                      >
                        {joinBusy ? "..." : "Gabung"}
                      </button>
                    </div>

                    {joinMsg && (
                      <p
                        className={`text-[10px] ${
                          joinMsg.startsWith("Gagal")
                            ? "text-rose-600"
                            : "text-emerald-700"
                        }`}
                      >
                        {joinMsg}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <Splash inline />
            ) : (
              <>
                {effectiveTab === "dashboard" && (
                  <Dashboard
                    leads={leads}
                    stages={stageList}
                    dealTransactions={dealTransactions}
                    onGo={setTabSafe}
                  />
                )}

                {effectiveTab === "leads" && (
                  <Leads
                    leads={leads}
                    stages={stageList}
                    settings={settings}
                    onChanged={reload}
                  />
                )}

                {effectiveTab === "generateleads" && (
                  <PreviewLock locked={isLocked("generateleads")}>
                    <GenerateLeads
                      stages={stageList}
                      onChanged={reload}
                    />
                  </PreviewLock>
                )}

                {effectiveTab === "deal" && (
                  <PreviewLock locked={isLocked("deal")}>
                    <Deal
                      leads={
                        isLocked("deal")
                          ? DUMMY_LEADS
                          : leads
                      }
                      stages={stageList}
                      dealTransactions={
                        isLocked("deal")
                          ? DUMMY_DEAL_TX
                          : dealTransactions
                      }
                      onEdit={setEditLead}
                      onChanged={reload}
                    />
                  </PreviewLock>
                )}

                {effectiveTab === "visitfollowup" && (
                  <PreviewLock locked={isLocked("visitfollowup")}>
                    <VisitFollowup
                      leads={
                        isLocked("visitfollowup")
                          ? DUMMY_LEADS
                          : leads
                      }
                      onEdit={setEditLead}
                      onChanged={reload}
                    />
                  </PreviewLock>
                )}

                {effectiveTab === "kompetitor" && (
                  <PreviewLock locked={isLocked("kompetitor")}>
                    <Kompetitor
                      competitors={
                        isLocked("kompetitor")
                          ? DUMMY_COMPETITORS
                          : competitors
                      }
                      onChanged={reload}
                    />
                  </PreviewLock>
                )}

                {effectiveTab === "komunitas" && (
                  <PreviewLock locked={isLocked("komunitas")}>
                    <Nex
                      dummy={isLocked("komunitas")}
                    />
                  </PreviewLock>
                )}

                {effectiveTab === "advisor" && (
                  <PreviewLock locked={isLocked("advisor")}>
                    <Advisor
                      leads={
                        isLocked("advisor")
                          ? DUMMY_LEADS
                          : leads
                      }
                      stages={stageList}
                      onOpen={setEditLead}
                      dummy={isLocked("advisor")}
                    />
                  </PreviewLock>
                )}

                {effectiveTab === "settings" && (
                  <PreviewLock locked={isLocked("settings")}>
                    <SettingsTab
                      settings={settings}
                      stages={stageList}
                      leads={leads}
                      onChanged={reload}
                    />
                  </PreviewLock>
                )}
              </>
            )}
          </main>

          {/* MOBILE BOTTOM NAV */}
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200">
            <div className="flex justify-around px-1 py-1.5">
              {NAV.map((n) => {
                const I = n.icon;
                const active = effectiveTab === n.key;
                const locked = isLocked(n.key);

                return (
                  <button
                    key={n.key}
                    onClick={() => setTabSafe(n.key)}
                    className={[
                      "relative flex flex-1 flex-col items-center gap-1 py-1.5 rounded-xl transition-colors",
                      active
                        ? "text-orange-600 bg-orange-50"
                        : "text-slate-400",
                      locked ? "opacity-60" : "",
                    ].join(" ")}
                  >
                    <I
                      size={18}
                      strokeWidth={active ? 2.4 : 1.8}
                    />

                    <span className="text-[8px] font-medium leading-none truncate max-w-full">
                      {n.short}
                    </span>

                    {locked && (
                      <Lock
                        size={8}
                        className="absolute right-2 top-0.5"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>

      {editLead && (
        <LeadModal
          lead={editLead}
          stages={stageList}
          settings={settings}
          onClose={() => setEditLead(null)}
          onSaved={() => {
            setEditLead(null);
            reload();
          }}
        />
      )}
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
        <Lock size={13} className="shrink-0" />
        Mode lihat-lihat doang - upgrade ke Premium buat bisa nambah/ubah data di sini.
      </div>

      <div
        onClick={() =>
          alert(
            "Ini fitur Premium bro - di paket Free cuma bisa dilihat doang, gak bisa diubah. Upgrade dulu (Rp149rb/bulan) buat bisa pake fiturnya."
          )
        }
        className="absolute inset-0 top-11 z-20 cursor-pointer"
      />

      {children}
    </div>
  );
}

// Avatar bulat pojok kanan atas (kayak Gmail/Notion) - klik buka kartu profil
// isinya foto, jabatan, email, dan tombol edit.
function ProfileAvatar({
  settings,
  session,
  org,
  onChanged,
  size = 36,
  align = "right",
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [jobTitle, setJobTitle] = useState(settings.job_title || "");
  const [name, setName] = useState(
    settings.community_display_name || ""
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const initial = (
    settings.community_display_name ||
    session?.user?.email ||
    "?"
  )
    .charAt(0)
    .toUpperCase();

  const email = session?.user?.email || "";

  const planInfo =
    org?.plan === "enterprise"
      ? {
          label: "Enterprise",
          cls: "bg-violet-100 text-violet-700",
        }
      : settings.plan === "premium"
      ? {
          label: "Premium",
          cls: "bg-orange-100 text-orange-700",
        }
      : {
          label: "Free",
          cls: "bg-slate-100 text-slate-500",
        };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      const url = await db.uploadAvatar(file);
      await db.saveMyProfile({
        avatar_url: url,
      });

      onChanged();
    } catch (err) {
      alert("Gagal upload foto: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);

    try {
      await db.saveMyProfile({
        job_title: jobTitle,
        name,
      });

      onChanged();
      setEditing(false);
    } catch (err) {
      alert("Gagal simpan: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="shrink-0 rounded-full overflow-hidden ring-2 ring-white/40 bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center font-semibold shadow-[0_2px_8px_-1px_rgba(0,0,0,0.3)]"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.4,
        }}
      >
        {settings.avatar_url ? (
          <img
            src={settings.avatar_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          initial
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setOpen(false);
              setEditing(false);
            }}
          />

          <div
            className={`absolute ${
              align === "left" ? "left-0" : "right-0"
            } top-full mt-2.5 w-72 bg-white rounded-[24px] shadow-[0_16px_40px_-8px_rgba(15,23,42,0.25)] z-50 overflow-hidden border border-slate-100`}
          >
            {!editing ? (
              <>
                <div className="h-16 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-800 relative">
                  <div className="absolute -bottom-7 left-5 w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center font-bold text-2xl ring-4 ring-white shadow-md">
                    {settings.avatar_url ? (
                      <img
                        src={settings.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initial
                    )}
                  </div>
                </div>

                <div className="pt-9 pb-4 px-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-[15px] text-slate-900 truncate">
                      {settings.community_display_name ||
                        "Belum ada nama"}
                    </div>

                    <span
                      className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-1 ${planInfo.cls}`}
                    >
                      {planInfo.label}
                    </span>
                  </div>

                  {settings.job_title && (
                    <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-2.5 py-1">
                      {settings.job_title}
                    </span>
                  )}

                  {email && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-400">
                      <Mail size={11} className="shrink-0" />
                      <span className="truncate">
                        {email}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => setEditing(true)}
                    className="w-full mt-4 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 font-medium transition-colors"
                  >
                    Edit Profil
                  </button>
                </div>
              </>
            ) : (
              <div className="p-5">
                <label className="flex items-center gap-3 mb-4 cursor-pointer">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center font-bold text-xl shrink-0 ring-2 ring-orange-100">
                    {uploading ? (
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                    ) : settings.avatar_url ? (
                      <img
                        src={settings.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initial
                    )}
                  </div>

                  <span className="text-xs text-orange-600 font-medium flex items-center gap-1">
                    <Camera size={13} />
                    Ganti foto
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFile}
                    disabled={uploading}
                  />
                </label>

                <label className="block mb-2.5">
                  <span className="text-[11px] font-medium text-slate-400">
                    Nama
                  </span>

                  <input
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                  />
                </label>

                <label className="block mb-4">
                  <span className="text-[11px] font-medium text-slate-400">
                    Jabatan
                  </span>

                  <input
                    className="w-full mt-1 px-3 py-2 text-sm text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                    placeholder="Sales Executive"
                    value={jobTitle}
                    onChange={(e) =>
                      setJobTitle(e.target.value)
                    }
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 text-xs text-slate-700 border border-slate-200 rounded-xl py-2.5 hover:bg-slate-50 font-medium"
                  >
                    Batal
                  </button>

                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="flex-1 text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl py-2.5 font-medium"
                  >
                    {saving ? "..." : "Simpan"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Splash({ inline }) {
  return (
    <div
      className={`${
        inline ? "py-20" : "min-h-screen"
      } bg-slate-50 flex flex-col items-center justify-center gap-3`}
    >
      <div className="animate-pulse">
        <NextoBadge size={48} />
      </div>

      <div className="text-slate-400 text-sm flex items-center gap-1.5">
        <Loader2
          size={13}
          className="animate-spin"
        />
        Memuat…
      </div>
    </div>
  );
}
