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
} from "lucide-react";

/* ================================================================
   NEXTO LOGO
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

const today = new Date()
  .toISOString()
  .slice(0, 10);

const tomorrow = new Date(
  Date.now() + 86400000
)
  .toISOString()
  .slice(0, 10);

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
    visit_agenda:
      "Presentasi produk & harga penawaran",
    last_contact: "2026-08-20",
    next_action:
      "Follow up hasil presentasi minggu lalu",
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
    next_action:
      "Kirim sample ke pabrik",
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
    background:
      "Pemain lama di area Jabodetabek",
    product: "PVC Compound",
    notes:
      "Harga agresif tapi servis lambat",
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
    background:
      "Fokus segmen kabel listrik",
    product: "Kabel Compound",
    notes:
      "Kuat di after-sales support",
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
    short: "Beranda",
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
    short: "Cari Lead",
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
    short: "Lainnya",
    icon: SettingsIcon,
  },
];

/* ================================================================
   CONFIG SCREEN
================================================================ */

function ConfigScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 text-white"
      style={{
        background: "#15110D",
      }}
    >
      <div
        className="
          max-w-md
          w-full
          rounded-3xl
          p-7
          border
          border-white/[0.07]
          shadow-2xl
        "
        style={{
          background: "#1B1611",
        }}
      >
        <div className="mb-4">
          <NextoBadge size={48} />
        </div>

        <h1 className="text-lg font-bold mb-2 text-[#F4F1EC]">
          Sambungin ke Supabase dulu
        </h1>

        <p className="text-sm text-[#A8A098] mb-3">
          Buat file{" "}
          <code className="bg-black/30 px-1 rounded">
            .env
          </code>{" "}
          di root project.
        </p>

        <pre className="text-xs bg-black/30 text-[#DDD7CF] rounded-xl p-3 overflow-x-auto">
{`VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...`}
        </pre>

        <p className="text-xs text-[#706961] mt-3">
          Ambil dari Supabase → Project Settings
          → API lalu restart project.
        </p>
      </div>
    </div>
  );
}

/* ================================================================
   APP
================================================================ */

export default function App() {
  const [session, setSession] =
    useState(null);

  const [authReady, setAuthReady] =
    useState(false);

  const [tab, setTab] =
    useState("dashboard");

  const [stages, setStages] =
    useState([]);

  const [settings, setSettings] =
    useState({
      sales_names: [],
    });

  const [leads, setLeads] =
    useState([]);

  const [dealTransactions, setDealTransactions] =
    useState([]);

  const [competitors, setCompetitors] =
    useState([]);

  const [org, setOrg] =
    useState(null);

  const [joinCode, setJoinCode] =
    useState("");

  const [joinBusy, setJoinBusy] =
    useState(false);

  const [joinMsg, setJoinMsg] =
    useState("");

  const [editLead, setEditLead] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  /* ================================================================
     JOIN ORGANIZATION
  ================================================================ */

  const joinWithCode = async () => {
    if (!joinCode.trim()) return;

    setJoinBusy(true);
    setJoinMsg("");

    try {
      const res =
        await db.redeemInviteCode(
          joinCode.trim()
        );

      setJoinMsg(
        `Berhasil bergabung ke ${res.org_name}.`
      );

      setJoinCode("");

      await reload();
    } catch (e) {
      setJoinMsg(
        "Gagal: " + e.message
      );
    } finally {
      setJoinBusy(false);
    }
  };

  /* ================================================================
     AUTH
  ================================================================ */

  useEffect(() => {
    if (!isConfigured) {
      setAuthReady(true);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setAuthReady(true);
      });

    const {
      data: sub,
    } = supabase.auth.onAuthStateChange(
      (_event, sessionData) => {
        db.clearOrgCache();
        setSession(sessionData);
      }
    );

    return () =>
      sub.subscription.unsubscribe();
  }, []);

  /* ================================================================
     LOAD DATA
  ================================================================ */

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

          st =
            await db.getStages();
        } catch (e) {
          console.error(e);
        }
      }

      try {
        setOrg(
          await db.getMyOrg()
        );
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

  /* ================================================================
     SILENT RELOAD
  ================================================================ */

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

  /* ================================================================
     USER CHANGE
  ================================================================ */

  const prevUserId =
    useRef(null);

  useEffect(() => {
    const uid =
      session?.user?.id || null;

    if (
      uid &&
      uid !== prevUserId.current
    ) {
      prevUserId.current = uid;
      reload();
    } else if (!uid) {
      prevUserId.current = null;
    }
  }, [session]);

  /* ================================================================
     VISIBILITY RELOAD
  ================================================================ */

  useEffect(() => {
    let hiddenAt = null;

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (
        hiddenAt &&
        session
      ) {
        const awayMs =
          Date.now() - hiddenAt;

        if (
          awayMs >
          5 * 60 * 1000
        ) {
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

  /* ================================================================
     PULL TO REFRESH
  ================================================================ */

  const [pullVisual, setPullVisual] =
    useState(0);

  const [refreshing, setRefreshing] =
    useState(false);

  const pullDistanceRef =
    useRef(0);

  const touchStartY =
    useRef(0);

  const pulling =
    useRef(false);

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
      if (!pulling.current)
        return;

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

        pullDistanceRef.current =
          d;

        setPullVisual(d);
      } else {
        pulling.current = false;
        pullDistanceRef.current = 0;
        setPullVisual(0);
      }
    };

    const onTouchEnd =
      async () => {
        if (!pulling.current)
          return;

        pulling.current = false;

        const d =
          pullDistanceRef.current;

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
  }, [
    session,
    refreshing,
  ]);

  /* ================================================================
     AUTH SCREENS
  ================================================================ */

  if (!isConfigured)
    return <ConfigScreen />;

  if (!authReady)
    return <Splash />;

  if (!session)
    return <Auth />;

  /* ================================================================
     PLAN
  ================================================================ */

  const isPremium =
    settings.plan === "premium" ||
    org?.plan === "enterprise";

  const FREE_TABS = [
    "dashboard",
    "leads",
  ];

  const stageList =
    stages.length
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

  /* ================================================================
     MAIN APP
  ================================================================ */

  return (
    <div
      className="
        min-h-screen
        text-[#F4F1EC]
        flex
        relative
        overflow-hidden
      "
      style={{
        backgroundColor:
          "#15110D",
      }}
    >
      {/* ============================================================
          CLEAN BACKGROUND
      ============================================================ */}

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* One very subtle warm light */}
        <div
          className="
            absolute
            left-1/2
            top-[-180px]
            -translate-x-1/2
            w-[650px]
            h-[400px]
            rounded-full
            blur-[120px]
          "
          style={{
            background:
              "rgba(154,65,12,.075)",
          }}
        />

        {/* Very subtle side light */}
        <div
          className="
            absolute
            right-[-250px]
            top-[30%]
            w-[500px]
            h-[500px]
            rounded-full
            blur-[150px]
          "
          style={{
            background:
              "rgba(105,45,10,.035)",
          }}
        />

        {/* Almost invisible grid */}
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(255,255,255,.15) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255,255,255,.15) 1px,
                transparent 1px
              )
            `,
            backgroundSize:
              "56px 56px",
            maskImage:
              "linear-gradient(to bottom, black, transparent 85%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black, transparent 85%)",
          }}
        />
      </div>

      {/* ============================================================
          PULL TO REFRESH
      ============================================================ */}

      {(pullVisual > 0 ||
        refreshing) && (
        <div
          className="
            md:hidden
            fixed
            top-0
            inset-x-0
            z-50
            flex
            items-start
            justify-center
            pointer-events-none
          "
          style={{
            height: refreshing
              ? 56
              : pullVisual,
          }}
        >
          <div
            className="
              bg-[#1B1611]
              border
              border-white/[0.08]
              rounded-full
              p-2
              shadow-lg
              mt-2
            "
          >
            <Loader2
              size={18}
              className="text-orange-500"
              style={
                refreshing
                  ? {
                      animation:
                        "spin .8s linear infinite",
                    }
                  : {
                      transform: `rotate(${
                        pullVisual * 3
                      }deg)`,
                    }
              }
            />
          </div>
        </div>
      )}

      {/* ============================================================
          DESKTOP SIDEBAR
      ============================================================ */}

      <aside
        className="
          hidden
          md:flex
          flex-col
          w-[236px]
          sticky
          top-0
          h-screen
          shrink-0
          relative
          z-20
          border-r
          border-white/[0.055]
        "
        style={{
          background:
            "rgba(20,16,12,.94)",
        }}
      >
        {/* Logo */}

        <div
          className="
            px-5
            py-5
            flex
            items-center
            gap-2.5
            border-b
            border-white/[0.045]
          "
        >
          <div
            className="
              w-9
              h-9
              rounded-xl
              flex
              items-center
              justify-center
              bg-orange-500/[0.07]
              border
              border-orange-500/[0.10]
            "
          >
            <NextoBadge size={27} />
          </div>

          <div className="leading-tight flex-1">
            <div className="font-semibold text-[15px] tracking-tight text-[#F4F1EC]">
              Nexto
            </div>

            <div className="text-[7px] uppercase tracking-[0.2em] text-[#706961] mt-0.5">
              Sales OS
            </div>
          </div>

          <ProfileAvatar
            settings={settings}
            session={session}
            org={org}
            onChanged={reload}
            size={30}
            align="left"
          />
        </div>

        {/* Navigation */}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[8px] uppercase tracking-[0.18em] font-semibold text-[#625B54]">
            Workspace
          </div>

          {NAV.map((n) => {
            const I = n.icon;

            const active =
              effectiveTab === n.key;

            const locked =
              isLocked(n.key);

            const className = locked
              ? `
                text-[#625B54]
                hover:bg-white/[0.02]
              `
              : n.special
              ? active
                ? `
                  bg-violet-500/[0.10]
                  text-violet-300
                  border
                  border-violet-500/[0.10]
                `
                : `
                  text-violet-400/70
                  hover:bg-violet-500/[0.06]
                  hover:text-violet-300
                `
              : active
              ? `
                bg-white/[0.055]
                text-[#F4F1EC]
                border
                border-white/[0.065]
              `
              : `
                text-[#8E8780]
                hover:bg-white/[0.025]
                hover:text-[#DDD7CF]
              `;

            return (
              <button
                key={n.key}
                onClick={() =>
                  setTab(n.key)
                }
                className={`
                  w-full
                  flex
                  items-center
                  gap-3
                  px-3
                  py-2.5
                  rounded-xl
                  text-[12px]
                  transition-all
                  duration-150
                  border
                  border-transparent
                  ${className}
                `}
              >
                <I
                  size={16}
                  strokeWidth={
                    active ? 2.2 : 1.8
                  }
                />

                <span className="flex-1 text-left">
                  {n.label}
                </span>

                {locked && (
                  <Lock
                    size={11}
                    className="shrink-0 opacity-50"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Account */}

        <div className="p-3">
          <button
            onClick={() =>
              supabase.auth.signOut()
            }
            className="
              w-full
              px-3
              py-2.5
              rounded-xl
              border
              border-white/[0.045]
              bg-white/[0.018]
              text-[#777069]
              hover:text-[#D4CEC6]
              hover:bg-white/[0.035]
              flex
              items-center
              gap-2.5
              text-[11px]
              transition-colors
            "
          >
            <LogOut size={14} />

            Keluar
          </button>
        </div>
      </aside>

      {/* ============================================================
          MAIN WRAPPER
      ============================================================ */}

      <div className="relative z-10 flex-1 min-w-0 flex flex-col">
        {/* ==========================================================
            MOBILE HEADER
        ========================================================== */}

        <header
          className="
            md:hidden
            sticky
            top-0
            z-30
            backdrop-blur-xl
            border-b
            border-white/[0.055]
          "
          style={{
            background:
              "rgba(21,17,13,.92)",
          }}
        >
          <div className="px-4 py-3 flex items-center gap-2.5">
            <div
              className="
                w-8
                h-8
                rounded-xl
                bg-orange-500/[0.07]
                border
                border-orange-500/[0.10]
                flex
                items-center
                justify-center
              "
            >
              <NextoBadge size={24} />
            </div>

            <div className="leading-tight flex-1">
              <div className="font-semibold text-sm text-[#F4F1EC]">
                Nexto
              </div>

              <div className="text-[8px] text-[#706961]">
                {
                  NAV.find(
                    (n) =>
                      n.key ===
                      effectiveTab
                  )?.label
                }
              </div>
            </div>

            <ProfileAvatar
              settings={settings}
              session={session}
              org={org}
              onChanged={reload}
              size={31}
            />
          </div>
        </header>

        {/* ==========================================================
            CONTENT
        ========================================================== */}

        <main className="relative flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto pb-32">
          {!loading &&
            !isPremium && (
              <div
                className="
                  relative
                  mb-5
                  rounded-2xl
                  px-4
                  py-3
                  border
                  border-orange-500/[0.12]
                "
                style={{
                  background:
                    "rgba(35,24,16,.82)",
                }}
              >
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#A8A098] leading-5">
                    Paket kamu sekarang{" "}
                    <b className="text-orange-400">
                      Free
                    </b>
                    . Upgrade ke Premium untuk
                    membuka seluruh fitur Nexto.
                  </span>

                  <a
                    href="https://subscription.myr.id/m/nexto-premium-88379/"
                    target="_blank"
                    rel="noreferrer"
                    className="
                      shrink-0
                      text-orange-400
                      hover:text-orange-300
                      font-medium
                    "
                  >
                    Upgrade
                  </a>
                </div>

                <div className="border-t border-white/[0.05] mt-3 pt-3">
                  <p className="text-[11px] text-[#706961] mb-2">
                    Punya kode undangan dari
                    tim Enterprise?
                  </p>

                  <div className="flex gap-2">
                    <input
                      className="
                        flex-1
                        px-3
                        py-2
                        text-xs
                        rounded-lg
                        uppercase
                        bg-black/20
                        border
                        border-white/[0.07]
                        text-[#F4F1EC]
                        placeholder:text-[#625B54]
                        focus:outline-none
                        focus:border-orange-500/30
                      "
                      placeholder="MASUKKAN KODE"
                      value={joinCode}
                      onChange={(e) =>
                        setJoinCode(
                          e.target.value.toUpperCase()
                        )
                      }
                      maxLength={6}
                    />

                    <button
                      onClick={
                        joinWithCode
                      }
                      disabled={joinBusy}
                      className="
                        text-xs
                        bg-orange-500
                        hover:bg-orange-600
                        disabled:opacity-50
                        text-white
                        rounded-lg
                        px-4
                        font-medium
                      "
                    >
                      {joinBusy
                        ? "..."
                        : "Gabung"}
                    </button>
                  </div>

                  {joinMsg && (
                    <p
                      className={`
                        text-[11px]
                        mt-2
                        ${
                          joinMsg.startsWith(
                            "Gagal"
                          )
                            ? "text-red-400"
                            : "text-emerald-400"
                        }
                      `}
                    >
                      {joinMsg}
                    </p>
                  )}
                </div>
              </div>
            )}

          {loading ? (
            <Splash inline />
          ) : (
            <>
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

              {effectiveTab ===
                "leads" && (
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

              {effectiveTab ===
                "deal" && (
                <PreviewLock
                  locked={isLocked(
                    "deal"
                  )}
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

              {effectiveTab ===
                "advisor" && (
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
            </>
          )}
        </main>

        {/* ==========================================================
            MOBILE NAV
        ========================================================== */}

        <nav className="md:hidden fixed bottom-3 inset-x-3 z-40">
          <div
            className="
              max-w-lg
              mx-auto
              flex
              justify-around
              px-1
              py-1.5
              rounded-2xl
              border
              border-white/[0.07]
              backdrop-blur-xl
              shadow-2xl
            "
            style={{
              background:
                "rgba(27,22,17,.94)",
            }}
          >
            {NAV.map((n) => {
              const I = n.icon;

              const active =
                effectiveTab === n.key;

              const locked =
                isLocked(n.key);

              const cls = locked
                ? "text-[#57514B]"
                : n.special
                ? active
                  ? "text-violet-300 bg-violet-500/[0.08]"
                  : "text-violet-400/70"
                : active
                ? "text-orange-400 bg-orange-500/[0.08]"
                : "text-[#777069]";

              return (
                <button
                  key={n.key}
                  onClick={() =>
                    setTab(n.key)
                  }
                  className={`
                    relative
                    flex
                    flex-col
                    items-center
                    gap-1
                    flex-1
                    py-1.5
                    rounded-xl
                    transition-colors
                    ${cls}
                  `}
                >
                  <I
                    size={18}
                    strokeWidth={
                      active ? 2.3 : 1.8
                    }
                  />

                  <span className="text-[8px] font-medium leading-none">
                    {n.short}
                  </span>

                  {locked && (
                    <Lock
                      size={8}
                      className="absolute top-0.5 right-2 opacity-60"
                    />
                  )}
                </button>
              );
            })}
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
   PREMIUM PREVIEW LOCK
================================================================ */

function PreviewLock({
  locked,
  children,
}) {
  if (!locked) return children;

  return (
    <div className="relative">
      <div
        className="
          mb-3
          rounded-xl
          px-4
          py-2.5
          flex
          items-center
          gap-2
          border
          border-white/[0.06]
        "
        style={{
          background:
            "rgba(29,24,19,.86)",
        }}
      >
        <Lock
          size={13}
          className="shrink-0 text-orange-400"
        />

        <span className="text-[#8E8780] text-xs">
          Mode preview. Upgrade ke Premium
          untuk menggunakan fitur ini.
        </span>
      </div>

      <div
        onClick={() =>
          alert(
            "Ini fitur Premium bro. Upgrade dulu untuk menggunakan fitur ini."
          )
        }
        className="
          absolute
          inset-0
          top-11
          z-20
          cursor-pointer
        "
      />

      {children}
    </div>
  );
}

/* ================================================================
   PROFILE AVATAR
================================================================ */

function ProfileAvatar({
  settings,
  session,
  org,
  onChanged,
  size = 36,
  align = "right",
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
          cls:
            "bg-violet-500/[0.08] text-violet-300 border border-violet-500/10",
        }
      : settings.plan === "premium"
      ? {
          label: "Premium",
          cls:
            "bg-orange-500/[0.08] text-orange-300 border border-orange-500/10",
        }
      : {
          label: "Free",
          cls:
            "bg-white/[0.04] text-[#817A73] border border-white/[0.06]",
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
          shrink-0
          rounded-full
          overflow-hidden
          ring-1
          ring-white/[0.10]
          bg-gradient-to-br
          from-orange-400
          to-orange-800
          text-white
          flex
          items-center
          justify-center
          font-semibold
        "
        style={{
          width: size,
          height: size,
          fontSize: size * 0.4,
        }}
      >
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
              top-full
              mt-2.5
              w-72
              rounded-[22px]
              shadow-[0_20px_60px_rgba(0,0,0,.55)]
              z-50
              overflow-hidden
              border
              border-white/[0.07]
            `}
            style={{
              background:
                "#1B1611",
            }}
          >
            {!editing ? (
              <>
                <div className="h-14 bg-gradient-to-br from-orange-500 to-orange-800 relative">
                  <div className="absolute -bottom-7 left-5 w-16 h-16 rounded-full overflow-hidden bg-orange-700 text-white flex items-center justify-center font-bold text-2xl ring-4 ring-[#1B1611]">
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

                <div className="pt-9 pb-4 px-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-[15px] text-[#F4F1EC] truncate">
                      {settings.community_display_name ||
                        "Belum ada nama"}
                    </div>

                    <span
                      className={`
                        shrink-0
                        text-[9px]
                        font-semibold
                        rounded-full
                        px-2
                        py-1
                        ${planInfo.cls}
                      `}
                    >
                      {planInfo.label}
                    </span>
                  </div>

                  {settings.job_title && (
                    <span className="inline-block mt-1.5 text-[10px] text-[#817A73]">
                      {settings.job_title}
                    </span>
                  )}

                  {email && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-[#706961]">
                      <Mail size={11} />

                      <span className="truncate">
                        {email}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setEditing(true)
                    }
                    className="
                      w-full
                      mt-4
                      text-xs
                      bg-orange-500
                      hover:bg-orange-600
                      text-white
                      rounded-xl
                      py-2.5
                      font-medium
                    "
                  >
                    Edit Profil
                  </button>
                </div>
              </>
            ) : (
              <div className="p-5">
                <label className="flex items-center gap-3 mb-4 cursor-pointer">
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-800 text-white flex items-center justify-center font-bold text-xl shrink-0">
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

                  <span className="text-xs text-orange-400 font-medium flex items-center gap-1">
                    <Camera size={13} />
                    Ganti foto
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={
                      handleFile
                    }
                    disabled={
                      uploading
                    }
                  />
                </label>

                <label className="block mb-3">
                  <span className="text-[11px] text-[#817A73]">
                    Nama
                  </span>

                  <input
                    className="
                      w-full
                      mt-1
                      px-3
                      py-2
                      text-sm
                      text-[#F4F1EC]
                      bg-black/20
                      border
                      border-white/[0.07]
                      rounded-xl
                      focus:outline-none
                      focus:border-orange-500/30
                    "
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target.value
                      )
                    }
                  />
                </label>

                <label className="block mb-4">
                  <span className="text-[11px] text-[#817A73]">
                    Jabatan
                  </span>

                  <input
                    className="
                      w-full
                      mt-1
                      px-3
                      py-2
                      text-sm
                      text-[#F4F1EC]
                      bg-black/20
                      border
                      border-white/[0.07]
                      rounded-xl
                      focus:outline-none
                      focus:border-orange-500/30
                    "
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
                    className="
                      flex-1
                      text-xs
                      text-[#817A73]
                      border
                      border-white/[0.07]
                      rounded-xl
                      py-2.5
                    "
                  >
                    Batal
                  </button>

                  <button
                    onClick={
                      saveProfile
                    }
                    disabled={saving}
                    className="
                      flex-1
                      text-xs
                      bg-orange-500
                      hover:bg-orange-600
                      disabled:opacity-60
                      text-white
                      rounded-xl
                      py-2.5
                      font-medium
                    "
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
            ? "py-20"
            : "min-h-screen"
        }
        flex
        flex-col
        items-center
        justify-center
        gap-3
      `}
    >
      <div>
        <NextoBadge size={46} />
      </div>

      <div className="text-[#706961] text-sm flex items-center gap-1.5">
        <Loader2
          size={13}
          className="animate-spin text-orange-500"
        />

        Memuat…
      </div>
    </div>
  );
}
