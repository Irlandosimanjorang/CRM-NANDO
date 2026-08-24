import { useEffect, useState, useRef } from "react";
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
  LayoutDashboard,
  Users,
  Trophy,
  CalendarCheck,
  Swords,
  Lightbulb,
  Settings as SettingsIcon,
  Loader2,
  LogOut,
  Users2,
  Lock,
  Camera,
  Mail,
  Sparkles,
  Search,
  Bell,
  ChevronDown,
  Plus,
  TrendingUp,
  Target,
  CalendarDays,
  CircleDollarSign,
  Menu,
  X,
  Zap,
  Bot,
  MapPin,
  ArrowUpRight,
} from "lucide-react";

/* ================================================================
   NEXTO BRAND
================================================================ */

export function NextoBadge({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="shrink-0"
    >
      <path
        d="M51,92 L17.04,15.15 Q13,6 21.46,11.34 L51,30 Z"
        fill="#f97316"
      />

      <path
        d="M51,92 L51,30 L80.54,11.34 Q89,6 84.96,15.15 Z"
        fill="#9a3412"
      />
    </svg>
  );
}

/* ================================================================
   DUMMY DATA
================================================================ */

const today = new Date().toISOString().slice(0, 10);

const tomorrow = new Date(
  Date.now() + 86400000
).toISOString().slice(0, 10);

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
    source: "manual",
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
    source: "manual",
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
    source: "telegram",
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
    chemical: "PVC Resin K67",
  },

  {
    id: "dd-2",
    lead_id: "dummy-2",
    lead_name: "CV Karya Plastindo",
    deal_date: "2026-08-10",
    deal_value: 28000000,
    tonnage: 3,
    tonnage_unit: "ton",
    chemical: "Calcium Zinc Stabilizer",
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
        quantity: "2 ton/bulan",
      },
    ],
  },

  {
    id: "dc-2",
    name: "CV Rival Chemical",
    background: "Fokus segmen kabel listrik",
    product: "Kabel Compound",
    notes: "Kuat di after-sales support",
    usages: [],
  },
];

/* ================================================================
   NAVIGATION
================================================================ */

const NAV = [
  {
    key: "dashboard",
    label: "Dashboard",
    short: "Home",
    icon: LayoutDashboard,
  },

  {
    key: "leads",
    label: "Leads",
    short: "Leads",
    icon: Users,
  },

  {
    key: "generateleads",
    label: "Generate Leads",
    short: "Generate",
    icon: Sparkles,
  },

  {
    key: "deal",
    label: "Deal",
    short: "Deal",
    icon: Trophy,
  },

  {
    key: "visitfollowup",
    label: "Visit & Follow-up",
    short: "Visit",
    icon: CalendarCheck,
  },

  {
    key: "kompetitor",
    label: "Kompetitor",
    short: "Rival",
    icon: Swords,
  },

  {
    key: "komunitas",
    label: "Nex",
    short: "Nex",
    icon: Users2,
    special: true,
  },

  {
    key: "advisor",
    label: "AI Advisor",
    short: "AI",
    icon: Lightbulb,
  },

  {
    key: "settings",
    label: "Pengaturan",
    short: "Settings",
    icon: SettingsIcon,
  },
];

/* ================================================================
   CONFIG
================================================================ */

function ConfigScreen() {
  return (
    <div className="min-h-screen bg-[#07080a] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#101216] border border-white/[0.08] rounded-[28px] shadow-2xl p-7">
        <div className="mb-5">
          <NextoBadge size={52} />
        </div>

        <h1 className="text-lg font-bold mb-2">
          Sambungin ke Supabase dulu
        </h1>

        <p className="text-sm text-slate-400 mb-4">
          Buat file{" "}
          <code className="bg-white/[0.06] px-1.5 py-0.5 rounded">
            .env
          </code>{" "}
          di root project:
        </p>

        <pre className="text-xs bg-black/50 text-slate-200 border border-white/[0.06] rounded-2xl p-4 overflow-x-auto">
{`VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...`}
        </pre>

        <p className="text-xs text-slate-500 mt-4">
          Ambil dari Supabase → Project Settings → API.
          Setelah itu restart npm run dev.
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN APP
================================================================ */

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [tab, setTab] = useState("dashboard");

  const [stages, setStages] = useState([]);
  const [settings, setSettings] = useState({
    sales_names: [],
  });

  const [leads, setLeads] = useState([]);
  const [dealTransactions, setDealTransactions] = useState([]);
  const [competitors, setCompetitors] = useState([]);

  const [org, setOrg] = useState(null);

  const [joinCode, setJoinCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");

  const [editLead, setEditLead] = useState(null);

  const [loading, setLoading] = useState(true);

  /* --------------------------------------------------------------
     MOBILE SIDEBAR
  -------------------------------------------------------------- */

  const [mobileMenu, setMobileMenu] = useState(false);

  /* --------------------------------------------------------------
     INVITE
  -------------------------------------------------------------- */

  const joinWithCode = async () => {
    if (!joinCode.trim()) return;

    setJoinBusy(true);
    setJoinMsg("");

    try {
      const res = await db.redeemInviteCode(
        joinCode.trim()
      );

      setJoinMsg(
        `✅ Gabung ke ${res.org_name}! Semua fitur Enterprise sekarang kebuka.`
      );

      setJoinCode("");

      await reload();
    } catch (e) {
      setJoinMsg("Gagal: " + e.message);
    } finally {
      setJoinBusy(false);
    }
  };

  /* --------------------------------------------------------------
     AUTH
  -------------------------------------------------------------- */

  useEffect(() => {
    if (!isConfigured) {
      setAuthReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: sub,
    } = supabase.auth.onAuthStateChange((_e, s) => {
      db.clearOrgCache();
      setSession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  /* --------------------------------------------------------------
     DATA RELOAD
  -------------------------------------------------------------- */

  const reload = async () => {
    setLoading(true);

    try {
      let [
        st,
        se,
        ls,
        comp,
        dt,
      ] = await Promise.all([
        db.getStages(),
        db.getSettings(),
        db.getLeads(),
        db.getCompetitors(),
        db.getDealTransactions(),
      ]);

      if (st.length === 0) {
        try {
          await db.initDefaultStages();
          st = await db.getStages();
        } catch (e) {
          console.error(e);
        }
      }

      try {
        setOrg(await db.getMyOrg());
      } catch (e) {
        console.error(e);
      }

      setStages(st);
      setSettings(se);
      setLeads(ls);
      setCompetitors(comp);
      setDealTransactions(dt);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  /* --------------------------------------------------------------
     SILENT RELOAD
  -------------------------------------------------------------- */

  const silentReload = async () => {
    try {
      const [
        st,
        se,
        ls,
        comp,
        dt,
      ] = await Promise.all([
        db.getStages(),
        db.getSettings(),
        db.getLeads(),
        db.getCompetitors(),
        db.getDealTransactions(),
      ]);

      setStages(st);
      setSettings(se);
      setLeads(ls);
      setCompetitors(comp);
      setDealTransactions(dt);
    } catch (e) {
      console.error(e);
    }
  };

  /* --------------------------------------------------------------
     SESSION CHANGE
  -------------------------------------------------------------- */

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

  /* --------------------------------------------------------------
     VISIBILITY REFRESH
  -------------------------------------------------------------- */

  useEffect(() => {
    let hiddenAt = null;

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && session) {
        const awayMs = Date.now() - hiddenAt;

        if (awayMs > 5 * 60 * 1000) {
          silentReload();
        }

        hiddenAt = null;
      }
    };

    document.addEventListener(
      "visibilitychange",
      onVisibility
    );

    return () =>
      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
  }, [session]);

  /* --------------------------------------------------------------
     PULL TO REFRESH
  -------------------------------------------------------------- */

  const [pullVisual, setPullVisual] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const pullDistanceRef = useRef(0);
  const touchStartY = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    if (!session) return;

    const onTouchStart = (e) => {
      if (
        window.scrollY === 0 &&
        !refreshing
      ) {
        touchStartY.current =
          e.touches[0].clientY;

        pulling.current = true;
      }
    };

    const onTouchMove = (e) => {
      if (!pulling.current) return;

      const delta =
        e.touches[0].clientY -
        touchStartY.current;

      if (
        delta > 0 &&
        window.scrollY === 0
      ) {
        const d = Math.min(
          delta * 0.5,
          90
        );

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

    document.addEventListener(
      "touchstart",
      onTouchStart,
      { passive: true }
    );

    document.addEventListener(
      "touchmove",
      onTouchMove,
      { passive: true }
    );

    document.addEventListener(
      "touchend",
      onTouchEnd
    );

    return () => {
      document.removeEventListener(
        "touchstart",
        onTouchStart
      );

      document.removeEventListener(
        "touchmove",
        onTouchMove
      );

      document.removeEventListener(
        "touchend",
        onTouchEnd
      );
    };
  }, [session, refreshing]);

  /* --------------------------------------------------------------
     EARLY STATES
  -------------------------------------------------------------- */

  if (!isConfigured) {
    return <ConfigScreen />;
  }

  if (!authReady) {
    return <Splash />;
  }

  if (!session) {
    return <Auth />;
  }

  /* --------------------------------------------------------------
     PLAN
  -------------------------------------------------------------- */

  const isPremium =
    settings.plan === "premium" ||
    org?.plan === "enterprise";

  const FREE_TABS = [
    "dashboard",
    "leads",
  ];

  const stageList = stages.length
    ? stages
    : [
        {
          key: "prospek",
          label: "Prospek",
          hex: "#94a3b8",
          type: "normal",
        },
      ];

  const effectiveTab = tab;

  const isLocked = (key) =>
    !loading &&
    !isPremium &&
    !FREE_TABS.includes(key);

  const currentNav =
    NAV.find(
      (n) => n.key === effectiveTab
    ) || NAV[0];

  /* --------------------------------------------------------------
     RENDER
  -------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[#07080a] text-white flex overflow-hidden">
      {/* ============================================================
          GLOBAL STYLE
      ============================================================ */}

      <style>{`
        @keyframes nextoGlow {
          0%, 100% {
            opacity: .55;
            transform: scale(1);
          }

          50% {
            opacity: 1;
            transform: scale(1.08);
          }
        }

        @keyframes nextoPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(249,115,22,.15);
          }

          50% {
            box-shadow: 0 0 0 8px rgba(249,115,22,0);
          }
        }

        @keyframes nextoFloat {
          0%, 100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-3px);
          }
        }

        .nexto-grid {
          background-image:
            linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px);
          background-size: 42px 42px;
        }

        .nexto-glow {
          animation: nextoGlow 4s ease-in-out infinite;
        }

        .nexto-float {
          animation: nextoFloat 4s ease-in-out infinite;
        }

        .nexto-pulse {
          animation: nextoPulse 2.4s ease-in-out infinite;
        }

        .nexto-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }

        .nexto-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .nexto-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,.08);
          border-radius: 999px;
        }

        .nexto-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(249,115,22,.35);
        }
      `}</style>

      {/* ============================================================
          DESKTOP SIDEBAR
      ============================================================ */}

      <aside className="hidden md:flex w-[250px] shrink-0 h-screen sticky top-0 flex-col bg-[#0b0c0f] border-r border-white/[0.055] relative z-30">
        {/* glow */}
        <div className="absolute top-[-120px] left-[-100px] w-[260px] h-[260px] bg-orange-600/10 blur-[100px] pointer-events-none" />

        {/* LOGO */}
        <div className="relative h-[78px] px-5 flex items-center border-b border-white/[0.055]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-orange-500/20 blur-xl" />

              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-800 flex items-center justify-center shadow-[0_8px_25px_-8px_rgba(249,115,22,.7)]">
                <NextoBadge size={27} />
              </div>
            </div>

            <div>
              <div className="font-bold text-[16px] tracking-[-0.02em]">
                Nexto
              </div>

              <div className="text-[8px] uppercase tracking-[0.18em] text-slate-600">
                Sales OS
              </div>
            </div>
          </div>

          <div className="ml-auto">
            <ProfileAvatar
              settings={settings}
              session={session}
              org={org}
              onChanged={reload}
              size={31}
              align="left"
              dark
            />
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="px-4 pt-5 pb-2">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-[8px] uppercase tracking-[0.18em] font-bold text-slate-600">
              Workspace
            </span>

            <span className="text-[8px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Online
            </span>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-white/[0.035] border border-white/[0.055] px-3 py-2.5">
            <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <Zap size={13} className="text-orange-400" />
            </div>

            <div className="min-w-0">
              <div className="text-[10px] font-semibold truncate">
                {org?.name || "My Sales Workspace"}
              </div>

              <div className="text-[8px] text-slate-600">
                {isPremium
                  ? "Premium workspace"
                  : "Free workspace"}
              </div>
            </div>

            <ChevronDown
              size={13}
              className="ml-auto text-slate-600"
            />
          </div>
        </div>

        {/* NAV */}
        <nav className="relative flex-1 px-3 py-3 overflow-y-auto nexto-scrollbar">
          <div className="px-2 mb-2 text-[8px] uppercase tracking-[0.18em] font-bold text-slate-600">
            Main menu
          </div>

          <div className="space-y-1">
            {NAV.map((n) => {
              const I = n.icon;
              const active =
                effectiveTab === n.key;

              const locked =
                isLocked(n.key);

              return (
                <button
                  key={n.key}
                  onClick={() => {
                    setTab(n.key);
                    setMobileMenu(false);
                  }}
                  className={`
                    group relative w-full flex items-center gap-3
                    px-3 py-2.5 rounded-xl
                    text-[11px] transition-all duration-200
                    ${
                      active
                        ? n.special
                          ? "bg-gradient-to-r from-violet-600/20 to-fuchsia-600/10 text-violet-300 border border-violet-500/20"
                          : "bg-orange-500/[0.11] text-orange-400 border border-orange-500/20 shadow-[0_8px_25px_-15px_rgba(249,115,22,.65)]"
                        : locked
                        ? "text-slate-600 hover:bg-white/[0.025]"
                        : "text-slate-400 hover:bg-white/[0.035] hover:text-white"
                    }
                  `}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 rounded-full bg-orange-500 shadow-[0_0_12px_#f97316]" />
                  )}

                  <I
                    size={15}
                    strokeWidth={
                      active ? 2.4 : 1.8
                    }
                    className={
                      active
                        ? n.special
                          ? "text-violet-400"
                          : "text-orange-400"
                        : ""
                    }
                  />

                  <span className="flex-1 text-left">
                    {n.label}
                  </span>

                  {n.key === "advisor" &&
                    !locked && (
                      <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/10">
                        AI
                      </span>
                    )}

                  {locked && (
                    <Lock
                      size={11}
                      className="text-slate-700"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* AI COMMAND CARD */}
          <div className="mt-7 mx-1 rounded-2xl border border-orange-500/15 bg-gradient-to-br from-orange-500/[0.09] to-transparent p-3.5 relative overflow-hidden">
            <div className="absolute right-[-25px] top-[-25px] w-20 h-20 rounded-full bg-orange-500/10 blur-2xl" />

            <div className="relative flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
                <Bot size={14} className="text-orange-400" />
              </div>

              <div>
                <div className="text-[9px] font-bold">
                  Nexto AI
                </div>

                <div className="text-[7px] text-slate-600">
                  Sales copilot
                </div>
              </div>

              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </div>

            <p className="relative text-[8px] leading-4 text-slate-500">
              “Siapa yang harus gue follow-up hari ini?”
            </p>
          </div>
        </nav>

        {/* USER / LOGOUT */}
        <div className="p-3 border-t border-white/[0.055]">
          <button
            onClick={() =>
              supabase.auth.signOut()
            }
            className="w-full px-3 py-2.5 rounded-xl bg-white/[0.025] hover:bg-white/[0.055] text-[10px] text-slate-500 hover:text-white flex items-center gap-2 transition-colors"
          >
            <LogOut size={13} />
            Keluar
          </button>
        </div>
      </aside>

      {/* ============================================================
          MOBILE MENU
      ============================================================ */}

      {mobileMenu && (
        <div className="md:hidden fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() =>
              setMobileMenu(false)
            }
          />

          <aside className="relative w-[280px] h-full bg-[#0b0c0f] border-r border-white/[0.07] p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-7">
              <div className="flex items-center gap-2.5">
                <NextoBadge size={32} />

                <div>
                  <div className="font-bold text-sm">
                    Nexto
                  </div>

                  <div className="text-[7px] uppercase tracking-widest text-slate-600">
                    Sales OS
                  </div>
                </div>
              </div>

              <button
                onClick={() =>
                  setMobileMenu(false)
                }
                className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1">
              {NAV.map((n) => {
                const I = n.icon;
                const active =
                  effectiveTab === n.key;
                const locked =
                  isLocked(n.key);

                return (
                  <button
                    key={n.key}
                    onClick={() => {
                      setTab(n.key);
                      setMobileMenu(false);
                    }}
                    className={`
                      w-full flex items-center gap-3
                      px-3 py-3 rounded-xl text-xs
                      ${
                        active
                          ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                          : locked
                          ? "text-slate-700"
                          : "text-slate-400"
                      }
                    `}
                  >
                    <I size={16} />

                    <span className="flex-1 text-left">
                      {n.label}
                    </span>

                    {locked && (
                      <Lock size={11} />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}

      {/* ============================================================
          MAIN AREA
      ============================================================ */}

      <div className="flex-1 min-w-0 flex flex-col relative bg-[#090a0c]">
        {/* background glow */}
        <div className="absolute pointer-events-none inset-0 overflow-hidden">
          <div className="absolute top-[-180px] right-[5%] w-[450px] h-[450px] rounded-full bg-orange-600/[0.055] blur-[130px]" />

          <div className="absolute bottom-[-250px] left-[20%] w-[500px] h-[500px] rounded-full bg-blue-600/[0.025] blur-[150px]" />
        </div>

        {/* GRID */}
        <div className="absolute inset-0 nexto-grid pointer-events-none opacity-30" />

        {/* ==========================================================
            TOPBAR
        ========================================================== */}

        <header className="relative z-30 h-[72px] shrink-0 border-b border-white/[0.055] bg-[#090a0c]/85 backdrop-blur-xl">
          <div className="h-full px-4 md:px-7 flex items-center gap-3">
            {/* mobile menu */}
            <button
              onClick={() =>
                setMobileMenu(true)
              }
              className="md:hidden w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.05] flex items-center justify-center text-slate-400"
            >
              <Menu size={17} />
            </button>

            {/* mobile logo */}
            <div className="md:hidden flex items-center gap-2">
              <NextoBadge size={27} />

              <span className="font-bold text-sm">
                Nexto
              </span>
            </div>

            {/* page title */}
            <div className="hidden md:block">
              <div className="text-[8px] uppercase tracking-[0.18em] text-slate-600 mb-0.5">
                Workspace
              </div>

              <div className="font-semibold text-[14px]">
                {currentNav.label}
              </div>
            </div>

            {/* search */}
            <div className="hidden sm:flex ml-6 w-[260px] h-9 rounded-xl bg-white/[0.035] border border-white/[0.055] items-center px-3 gap-2">
              <Search
                size={14}
                className="text-slate-600"
              />

              <input
                className="flex-1 bg-transparent outline-none text-[10px] text-white placeholder:text-slate-700"
                placeholder="Search leads, companies..."
              />

              <span className="text-[7px] text-slate-700 border border-white/[0.05] rounded px-1.5 py-0.5">
                /
              </span>
            </div>

            <div className="flex-1" />

            {/* AI button */}
            <button
              onClick={() => setTab("advisor")}
              className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.06] text-orange-400 hover:bg-orange-500/[0.1] transition-colors"
            >
              <Sparkles size={13} />

              <span className="text-[9px] font-semibold">
                Ask Nexto
              </span>
            </button>

            {/* notification */}
            <button className="relative w-9 h-9 rounded-xl bg-white/[0.035] border border-white/[0.055] flex items-center justify-center text-slate-500 hover:text-white transition-colors">
              <Bell size={15} />

              <span className="absolute right-[8px] top-[7px] w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_7px_#f97316]" />
            </button>

            {/* profile */}
            <ProfileAvatar
              settings={settings}
              session={session}
              org={org}
              onChanged={reload}
              size={34}
              dark
            />
          </div>
        </header>

        {/* ==========================================================
            CONTENT
        ========================================================== */}

        <main className="relative flex-1 overflow-y-auto nexto-scrollbar">
          <div className="max-w-[1450px] mx-auto p-4 md:p-6 lg:p-7 pb-28">
            {/* ======================================================
                FREE PLAN BANNER
            ====================================================== */}

            {!loading && !isPremium && (
              <div className="mb-5 rounded-2xl border border-orange-500/15 bg-gradient-to-r from-orange-500/[0.07] to-transparent px-4 py-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 shrink-0 rounded-xl bg-orange-500/10 flex items-center justify-center">
                      <Zap
                        size={14}
                        className="text-orange-400"
                      />
                    </div>

                    <div>
                      <div className="text-[10px] font-semibold text-white">
                        Kamu sekarang di paket Free
                      </div>

                      <div className="text-[8px] text-slate-500 mt-0.5">
                        Dashboard & Leads aktif.
                        Upgrade untuk membuka AI,
                        Calendar, Telegram, Visit &
                        semua fitur premium.
                      </div>
                    </div>
                  </div>

                  <a
                    href="https://subscription.myr.id/m/nexto-premium-88379/"
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-semibold text-center shadow-[0_8px_20px_-10px_rgba(249,115,22,.8)]"
                  >
                    Upgrade Premium
                  </a>
                </div>

                <div className="mt-3 pt-3 border-t border-orange-500/10">
                  <div className="flex gap-2">
                    <input
                      className="flex-1 max-w-[260px] px-3 py-2 text-[9px] border border-orange-500/15 rounded-xl uppercase bg-black/20 text-white outline-none focus:border-orange-500/40 placeholder:text-slate-700"
                      placeholder="KODE UNDANGAN"
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(
                          e.target.value.toUpperCase()
                        )
                      }
                      maxLength={6}
                    />

                    <button
                      onClick={joinWithCode}
                      disabled={joinBusy}
                      className="text-[9px] bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl px-4 font-semibold"
                    >
                      {joinBusy
                        ? "..."
                        : "Gabung"}
                    </button>
                  </div>

                  {joinMsg && (
                    <p
                      className={`text-[8px] mt-2 ${
                        joinMsg.startsWith("Gagal")
                          ? "text-rose-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {joinMsg}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ======================================================
                QUICK KPI STRIP
            ====================================================== */}

            {effectiveTab === "dashboard" &&
              !loading && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                  <QuickMetric
                    icon={<Users size={14} />}
                    label="Total Leads"
                    value={leads.length}
                    change="+12.5%"
                    positive
                  />

                  <QuickMetric
                    icon={
                      <Target size={14} />
                    }
                    label="Active Pipeline"
                    value={
                      leads.filter(
                        (l) =>
                          l.stage_key !== "deal"
                      ).length
                    }
                    change="+8.2%"
                    positive
                  />

                  <QuickMetric
                    icon={
                      <CircleDollarSign
                        size={14}
                      />
                    }
                    label="Deals"
                    value={
                      dealTransactions.length
                    }
                    change="+18.4%"
                    positive
                  />

                  <QuickMetric
                    icon={
                      <CalendarDays
                        size={14}
                      />
                    }
                    label="Upcoming Visit"
                    value={
                      leads.filter(
                        (l) => l.visit_date
                      ).length
                    }
                    change="Today"
                    positive
                  />
                </div>
              )}

            {/* ======================================================
                TAB CONTENT
            ====================================================== */}

            {loading ? (
              <Splash inline />
            ) : (
              <div className="nexto-app-content">
                {effectiveTab ===
                  "dashboard" && (
                  <Dashboard
                    leads={leads}
                    stages={stageList}
                    dealTransactions={
                      dealTransactions
                    }
                    onGo={setTab}
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

                {effectiveTab ===
                  "generateleads" && (
                  <PreviewLock
                    locked={isLocked(
                      "generateleads"
                    )}
                  >
                    <GenerateLeads
                      stages={stageList}
                      onChanged={reload}
                    />
                  </PreviewLock>
                )}

                {effectiveTab === "deal" && (
                  <PreviewLock
                    locked={isLocked("deal")}
                  >
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

                {effectiveTab ===
                  "visitfollowup" && (
                  <PreviewLock
                    locked={isLocked(
                      "visitfollowup"
                    )}
                  >
                    <VisitFollowup
                      leads={
                        isLocked(
                          "visitfollowup"
                        )
                          ? DUMMY_LEADS
                          : leads
                      }
                      onEdit={setEditLead}
                      onChanged={reload}
                    />
                  </PreviewLock>
                )}

                {effectiveTab ===
                  "kompetitor" && (
                  <PreviewLock
                    locked={isLocked(
                      "kompetitor"
                    )}
                  >
                    <Kompetitor
                      competitors={
                        isLocked(
                          "kompetitor"
                        )
                          ? DUMMY_COMPETITORS
                          : competitors
                      }
                      onChanged={reload}
                    />
                  </PreviewLock>
                )}

                {effectiveTab ===
                  "komunitas" && (
                  <PreviewLock
                    locked={isLocked(
                      "komunitas"
                    )}
                  >
                    <Nex
                      dummy={isLocked(
                        "komunitas"
                      )}
                    />
                  </PreviewLock>
                )}

                {effectiveTab === "advisor" && (
                  <PreviewLock
                    locked={isLocked(
                      "advisor"
                    )}
                  >
                    <Advisor
                      leads={
                        isLocked("advisor")
                          ? DUMMY_LEADS
                          : leads
                      }
                      stages={stageList}
                      onOpen={setEditLead}
                      dummy={isLocked(
                        "advisor"
                      )}
                    />
                  </PreviewLock>
                )}

                {effectiveTab ===
                  "settings" && (
                  <PreviewLock
                    locked={isLocked(
                      "settings"
                    )}
                  >
                    <SettingsTab
                      settings={settings}
                      stages={stageList}
                      leads={leads}
                      onChanged={reload}
                    />
                  </PreviewLock>
                )}
              </div>
            )}
          </div>
        </main>

        {/* ==========================================================
            MOBILE BOTTOM NAV
        ========================================================== */}

        <nav className="md:hidden fixed bottom-3 inset-x-3 z-40">
          <div className="max-w-lg mx-auto flex items-center gap-1 px-1.5 py-2 bg-[#111216]/90 backdrop-blur-2xl rounded-[22px] shadow-[0_12px_40px_-10px_rgba(0,0,0,.8)] border border-white/[0.08]">
            {NAV.slice(0, 5).map((n) => {
              const I = n.icon;
              const active =
                effectiveTab === n.key;
              const locked =
                isLocked(n.key);

              return (
                <button
                  key={n.key}
                  onClick={() =>
                    setTab(n.key)
                  }
                  className={`
                    relative flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl
                    ${
                      active
                        ? "text-orange-400 bg-orange-500/[0.08]"
                        : locked
                        ? "text-slate-700"
                        : "text-slate-500"
                    }
                  `}
                >
                  <I
                    size={17}
                    strokeWidth={
                      active ? 2.5 : 1.8
                    }
                  />

                  <span className="text-[7px] font-medium leading-none">
                    {n.short}
                  </span>

                  {active && (
                    <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-orange-500 shadow-[0_0_7px_#f97316]" />
                  )}
                </button>
              );
            })}

            <button
              onClick={() =>
                setMobileMenu(true)
              }
              className="flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl text-slate-500"
            >
              <Menu size={17} />

              <span className="text-[7px] font-medium">
                More
              </span>
            </button>
          </div>
        </nav>
      </div>

      {/* ============================================================
          EDIT LEAD
      ============================================================ */}

      {editLead && (
        <LeadModal
          lead={editLead}
          stages={stageList}
          settings={settings}
          onClose={() =>
            setEditLead(null)
          }
          onSaved={() => {
            setEditLead(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ================================================================
   QUICK METRIC
================================================================ */

function QuickMetric({
  icon,
  label,
  value,
  change,
  positive,
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.055] bg-[#101114]/90 px-4 py-3.5 group hover:border-orange-500/15 transition-colors">
      <div className="absolute right-[-25px] top-[-25px] w-20 h-20 rounded-full bg-orange-500/[0.035] blur-2xl group-hover:bg-orange-500/[0.07] transition-colors" />

      <div className="relative flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/[0.035] border border-white/[0.05] flex items-center justify-center text-orange-400">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-[8px] uppercase tracking-[0.13em] text-slate-600 font-bold">
            {label}
          </div>

          <div className="flex items-end gap-2 mt-0.5">
            <span className="text-[18px] font-bold tracking-tight">
              {value}
            </span>

            <span
              className={`text-[7px] font-semibold mb-1 ${
                positive
                  ? "text-emerald-400"
                  : "text-rose-400"
              }`}
            >
              {change}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   PREMIUM LOCK
================================================================ */

function PreviewLock({
  locked,
  children,
}) {
  if (!locked) return children;

  return (
    <div className="relative">
      <div className="mb-3 rounded-2xl border border-orange-500/15 bg-orange-500/[0.06] text-orange-300 px-4 py-3 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <Lock size={13} />
        </div>

        <div className="flex-1">
          <div className="text-[9px] font-semibold">
            Premium Feature
          </div>

          <div className="text-[8px] text-orange-400/60 mt-0.5">
            Mode preview — upgrade untuk menggunakan
            fitur ini.
          </div>
        </div>

        <span className="text-[7px] uppercase tracking-widest text-orange-500 border border-orange-500/20 rounded-full px-2 py-1">
          Premium
        </span>
      </div>

      <div
        onClick={() =>
          alert(
            "Ini fitur Premium bro — upgrade ke Premium Rp149rb/bulan untuk menggunakan fitur ini."
          )
        }
        className="absolute inset-0 top-14 z-20 cursor-pointer"
      />

      <div className="opacity-75">
        {children}
      </div>
    </div>
  );
}

/* ================================================================
   PROFILE
================================================================ */

function ProfileAvatar({
  settings,
  session,
  org,
  onChanged,
  size = 36,
  align = "right",
  dark = false,
}) {
  const [open, setOpen] =
    useState(false);

  const [editing, setEditing] =
    useState(false);

  const [jobTitle, setJobTitle] =
    useState(
      settings.job_title || ""
    );

  const [name, setName] =
    useState(
      settings.community_display_name ||
        ""
    );

  const [uploading, setUploading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const initial = (
    settings.community_display_name ||
    session?.user?.email ||
    "?"
  )
    .charAt(0)
    .toUpperCase();

  const email =
    session?.user?.email || "";

  const planInfo =
    org?.plan === "enterprise"
      ? {
          label: "Enterprise",
          cls: dark
            ? "bg-violet-500/10 text-violet-400 border-violet-500/15"
            : "bg-violet-100 text-violet-700",
        }
      : settings.plan === "premium"
      ? {
          label: "Premium",
          cls: dark
            ? "bg-orange-500/10 text-orange-400 border-orange-500/15"
            : "bg-orange-100 text-orange-700",
        }
      : {
          label: "Free",
          cls: dark
            ? "bg-white/[0.04] text-slate-500 border-white/[0.06]"
            : "bg-slate-100 text-slate-500",
        };

  const handleFile = async (
    e
  ) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    setUploading(true);

    try {
      const url =
        await db.uploadAvatar(
          file
        );

      await db.saveMyProfile({
        avatar_url: url,
      });

      onChanged();
    } catch (err) {
      alert(
        "Gagal upload foto: " +
          err.message
      );
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
      alert(
        "Gagal simpan: " +
          err.message
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() =>
          setOpen((v) => !v)
        }
        className="
          shrink-0 rounded-full overflow-hidden
          bg-gradient-to-br from-orange-400 to-orange-800
          text-white flex items-center justify-center
          font-semibold
          ring-2 ring-orange-500/20
          shadow-[0_4px_15px_-5px_rgba(249,115,22,.45)]
        "
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
            className={`
              absolute
              ${
                align === "left"
                  ? "left-0"
                  : "right-0"
              }
              top-full mt-2.5
              w-72
              ${
                dark
                  ? "bg-[#111216] border-white/[0.08] text-white"
                  : "bg-white border-slate-100 text-slate-900"
              }
              rounded-[24px]
              shadow-[0_20px_60px_-15px_rgba(0,0,0,.7)]
              z-50 overflow-hidden border
            `}
          >
            {!editing ? (
              <>
                {/* PROFILE HEADER */}
                <div className="h-16 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-900 relative">
                  <div className="absolute -bottom-7 left-5 w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-800 text-white flex items-center justify-center font-bold text-2xl ring-4 ring-[#111216] shadow-xl">
                    {settings.avatar_url ? (
                      <img
                        src={
                          settings.avatar_url
                        }
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initial
                    )}
                  </div>
                </div>

                <div className="pt-9 pb-5 px-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-[14px] truncate">
                      {settings.community_display_name ||
                        "Belum ada nama"}
                    </div>

                    <span
                      className={`shrink-0 text-[8px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-1 border ${planInfo.cls}`}
                    >
                      {planInfo.label}
                    </span>
                  </div>

                  {settings.job_title && (
                    <span className="inline-block mt-2 text-[8px] font-semibold uppercase tracking-wide bg-white/[0.04] text-slate-500 border border-white/[0.05] rounded-full px-2.5 py-1">
                      {settings.job_title}
                    </span>
                  )}

                  {email && (
                    <div className="flex items-center gap-1.5 mt-3 text-[9px] text-slate-600">
                      <Mail size={10} />

                      <span className="truncate">
                        {email}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setEditing(true)
                    }
                    className="w-full mt-4 text-[9px] bg-orange-500 hover:bg-orange-600 text-white rounded-xl py-2.5 font-semibold transition-colors"
                  >
                    Edit Profil
                  </button>
                </div>
              </>
            ) : (
              <div className="p-5">
                <label className="flex items-center gap-3 mb-4 cursor-pointer">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-800 text-white flex items-center justify-center font-bold text-xl shrink-0 ring-2 ring-orange-500/20">
                    {uploading ? (
                      <Loader2
                        size={18}
                        className="animate-spin"
                      />
                    ) : settings.avatar_url ? (
                      <img
                        src={
                          settings.avatar_url
                        }
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      initial
                    )}
                  </div>

                  <span className="text-[9px] text-orange-400 font-medium flex items-center gap-1">
                    <Camera size={12} />
                    Ganti foto
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={
                      handleFile
                    }
                    disabled={uploading}
                  />
                </label>

                <label className="block mb-3">
                  <span className="text-[9px] font-medium text-slate-600">
                    Nama
                  </span>

                  <input
                    className="w-full mt-1 px-3 py-2.5 text-xs text-white bg-white/[0.03] border border-white/[0.07] rounded-xl focus:outline-none focus:border-orange-500/40"
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target.value
                      )
                    }
                  />
                </label>

                <label className="block mb-4">
                  <span className="text-[9px] font-medium text-slate-600">
                    Jabatan
                  </span>

                  <input
                    className="w-full mt-1 px-3 py-2.5 text-xs text-white bg-white/[0.03] border border-white/[0.07] rounded-xl focus:outline-none focus:border-orange-500/40"
                    placeholder="Sales Executive"
                    value={jobTitle}
                    onChange={(e) =>
                      setJobTitle(
                        e.target.value
                      )
                    }
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setEditing(false)
                    }
                    className="flex-1 text-[9px] text-slate-500 border border-white/[0.07] rounded-xl py-2.5 hover:bg-white/[0.04] font-medium"
                  >
                    Batal
                  </button>

                  <button
                    onClick={
                      saveProfile
                    }
                    disabled={saving}
                    className="flex-1 text-[9px] bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white rounded-xl py-2.5 font-semibold"
                  >
                    {saving
                      ? "..."
                      : "Simpan"}
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

/* ================================================================
   SPLASH
================================================================ */

function Splash({ inline }) {
  return (
    <div
      className={`
        ${
          inline
            ? "min-h-[420px]"
            : "min-h-screen"
        }
        bg-transparent
        flex flex-col
        items-center
        justify-center
        gap-3
      `}
    >
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-orange-500/20 blur-2xl" />

        <div className="relative nexto-pulse">
          <NextoBadge size={48} />
        </div>
      </div>

      <div className="text-slate-600 text-[10px] flex items-center gap-2">
        <Loader2
          size={12}
          className="animate-spin text-orange-500"
        />

        Memuat workspace...
      </div>
    </div>
  );
}
