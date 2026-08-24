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
  LayoutDashboard,
  Users,
  Trophy,
  CalendarCheck,
  Swords,
  Lightbulb,
  Bot,
  Settings as SettingsIcon,
  Loader2,
  LogOut,
  Users2,
  Lock,
  Camera,
  Mail,
  Sparkles,
} from "lucide-react";

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

// ---- DATA DUMMY buat preview tab Premium (user Free) ----
// Ngasal doang - biar user Free liat gambaran "beneran kepake" bukan tab kosong.
// Gak pernah disimpen ke database, murni buat ditampilin doang.
const today = new Date().toISOString().slice(0, 10);
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

function ConfigScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 text-white"
      style={{
        background: `
          radial-gradient(
            circle at 50% 10%,
            rgba(130, 55, 10, 0.30) 0%,
            rgba(55, 25, 8, 0.18) 30%,
            transparent 60%
          ),
          #19100A
        `,
      }}
    >
      <div className="max-w-md bg-[#21130a] border border-orange-500/15 rounded-3xl shadow-2xl p-7">
        <div className="mb-4">
          <NextoBadge size={48} />
        </div>

        <h1 className="text-lg font-bold mb-2">
          Sambungin ke Supabase dulu
        </h1>

        <p className="text-sm text-orange-100/50 mb-3">
          Buat file{" "}
          <code className="bg-black/30 px-1 rounded">
            .env
          </code>{" "}
          di root project (salin dari{" "}
          <code className="bg-black/30 px-1 rounded">
            .env.example
          </code>
          ), isi:
        </p>

        <pre className="text-xs bg-black/50 text-orange-50 rounded-xl p-3 overflow-x-auto">
{`VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...`}
        </pre>

        <p className="text-xs text-orange-100/40 mt-3">
          Ambil dari Supabase → Project Settings →
          API. Terus restart{" "}
          <code className="bg-black/30 px-1 rounded">
            npm run dev
          </code>
          .
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [stages, setStages] = useState([]);
  const [settings, setSettings] = useState({
    sales_names: [],
  });
  const [leads, setLeads] = useState([]);
  const [dealTransactions, setDealTransactions] =
    useState([]);
  const [competitors, setCompetitors] =
    useState([]);
  const [org, setOrg] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");

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
        `✅ Gabung ke ${res.org_name}! Semua fitur Enterprise sekarang kebuka.`
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

  const [editLead, setEditLead] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

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
      (_e, s) => {
        db.clearOrgCache();
        setSession(s);
      }
    );

    return () =>
      sub.subscription.unsubscribe();
  }, []);

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

      // Akun baru (belum pernah setup pipeline sama sekali)
      // otomatis kasih pipeline default.
      if (st.length === 0) {
        try {
          await db.initDefaultStages();
          st = await db.getStages();
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

  // Reload diem-diem tanpa loading spinner.
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

  const prevUserId = useRef(null);

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

  // Kalau tab ditinggal lebih dari 5 menit
  // lalu dibuka lagi, sync data.
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

  // Pull-to-refresh
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

  if (!isConfigured)
    return <ConfigScreen />;

  if (!authReady)
    return <Splash />;

  if (!session)
    return <Auth />;

  // ---- SISTEM 2 TIPE (FREE / PREMIUM) ----
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

  return (
    <div
      className="min-h-screen text-white flex relative overflow-hidden"
      style={{
        background: `
          radial-gradient(
            circle at 50% 8%,
            rgba(120, 52, 10, 0.30) 0%,
            rgba(68, 30, 9, 0.20) 22%,
            rgba(30, 18, 11, 0.08) 42%,
            transparent 65%
          ),
          radial-gradient(
            circle at 85% 40%,
            rgba(105, 45, 8, 0.12) 0%,
            transparent 45%
          ),
          radial-gradient(
            circle at 10% 70%,
            rgba(90, 38, 8, 0.10) 0%,
            transparent 45%
          ),
          #19100A
        `,
      }}
    >
      {/* ============================================================
          NEXTO AMBIENT BACKGROUND
          Terinspirasi langsung dari visual robot yang lo kirim.
      ============================================================ */}

      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {/* Center warm glow */}
        <div
          className="
            absolute
            left-1/2
            top-[-80px]
            -translate-x-1/2
            w-[760px]
            h-[560px]
            rounded-full
            blur-[120px]
          "
          style={{
            background:
              "radial-gradient(circle, rgba(150,65,12,.34) 0%, rgba(75,32,8,.16) 38%, transparent 72%)",
          }}
        />

        {/* Top orange light */}
        <div
          className="
            absolute
            -top-[180px]
            left-[30%]
            w-[560px]
            h-[420px]
            rounded-full
            blur-[130px]
          "
          style={{
            background:
              "rgba(180,75,10,.11)",
          }}
        />

        {/* Right ambient light */}
        <div
          className="
            absolute
            right-[-220px]
            top-[22%]
            w-[520px]
            h-[520px]
            rounded-full
            blur-[150px]
          "
          style={{
            background:
              "rgba(120,48,8,.09)",
          }}
        />

        {/* Bottom ambient */}
        <div
          className="
            absolute
            left-[20%]
            bottom-[-280px]
            w-[650px]
            h-[420px]
            rounded-full
            blur-[150px]
          "
          style={{
            background:
              "rgba(85,35,8,.09)",
          }}
        />

        {/* Futuristic grid */}
        <div
          className="absolute inset-0 opacity-[0.045]"
          style={{
            backgroundImage: `
              linear-gradient(
                rgba(255,255,255,.11) 1px,
                transparent 1px
              ),
              linear-gradient(
                90deg,
                rgba(255,255,255,.11) 1px,
                transparent 1px
              )
            `,
            backgroundSize:
              "48px 48px",
            maskImage:
              "radial-gradient(circle at center, black 0%, transparent 78%)",
            WebkitMaskImage:
              "radial-gradient(circle at center, black 0%, transparent 78%)",
          }}
        />

        {/* Large orbital ring */}
        <div
          className="
            absolute
            left-1/2
            top-[60px]
            -translate-x-1/2
            w-[680px]
            h-[680px]
            rounded-full
            border
            border-orange-500/[0.025]
          "
        />

        {/* Second orbital ring */}
        <div
          className="
            absolute
            left-1/2
            top-[115px]
            -translate-x-1/2
            w-[560px]
            h-[560px]
            rounded-full
            border
            border-orange-500/[0.022]
          "
        />

        {/* Third orbital ring */}
        <div
          className="
            absolute
            left-1/2
            top-[175px]
            -translate-x-1/2
            w-[440px]
            h-[440px]
            rounded-full
            border
            border-orange-500/[0.018]
          "
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
            transition-[height]
            duration-150
          "
          style={{
            height: refreshing
              ? 56
              : pullVisual,
          }}
        >
          <div className="bg-[#28170c] border border-orange-500/20 rounded-full p-2 shadow-[0_10px_30px_rgba(0,0,0,.5)] mt-2">
            <Loader2
              size={18}
              className="text-orange-500"
              style={
                refreshing
                  ? {
                      animation:
                        "spin 0.8s linear infinite",
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
          SIDEBAR
      ============================================================ */}

      <aside
        className="
          hidden
          md:flex
          flex-col
          w-60
          text-white
          sticky
          top-0
          h-screen
          shrink-0
          relative
          z-20
          border-r
          border-orange-500/[0.07]
        "
        style={{
          background: `
            linear-gradient(
              180deg,
              rgba(28,17,10,.98) 0%,
              rgba(20,13,9,.98) 100%
            )
          `,
        }}
      >
        {/* Sidebar ambient */}
        <div className="absolute top-[-100px] left-[-100px] w-[260px] h-[260px] rounded-full bg-orange-600/[0.07] blur-[100px] pointer-events-none" />

        <div className="relative px-5 py-6 flex items-center gap-2.5 border-b border-orange-500/[0.06]">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500/20 blur-xl rounded-full" />

            <div className="relative">
              <NextoBadge size={36} />
            </div>
          </div>

          <div className="leading-tight flex-1">
            <div className="font-bold tracking-tight text-[15px]">
              Nexto
            </div>

            <div className="text-[7px] uppercase tracking-[0.2em] text-orange-500/40 mt-0.5">
              Sales OS
            </div>
          </div>

          <ProfileAvatar
            settings={settings}
            session={session}
            org={org}
            onChanged={reload}
            size={32}
            align="left"
          />
        </div>

        <nav className="relative flex-1 px-3 py-3 space-y-1.5 overflow-y-auto">
          {NAV.map((n) => {
            const I = n.icon;
            const active =
              effectiveTab === n.key;

            const locked =
              isLocked(n.key);

            const cls = locked
              ? "text-orange-100/25 hover:bg-orange-500/[0.025] cursor-pointer"
              : n.special
              ? active
                ? "bg-gradient-to-r from-violet-600/80 to-fuchsia-600/70 text-white font-semibold shadow-lg shadow-violet-900/30"
                : "text-violet-300 hover:bg-violet-500/10 hover:text-violet-200"
              : active
              ? "bg-orange-600/90 text-white font-semibold shadow-lg shadow-orange-900/30"
              : "text-orange-100/55 hover:bg-orange-500/[0.05] hover:text-white";

            return (
              <button
                key={n.key}
                onClick={() =>
                  setTab(n.key)
                }
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm transition-all duration-150 ${cls}`}
              >
                <I
                  size={17}
                  strokeWidth={
                    active ? 2.5 : 2
                  }
                />

                <span className="flex-1 text-left">
                  {n.label}
                </span>

                {locked && (
                  <Lock
                    size={13}
                    className="shrink-0"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() =>
            supabase.auth.signOut()
          }
          className="
            relative
            m-3
            px-4
            py-2.5
            rounded-2xl
            bg-orange-500/[0.035]
            border
            border-orange-500/[0.05]
            text-xs
            text-orange-100/45
            hover:bg-orange-500/[0.08]
            hover:text-white
            flex
            items-center
            gap-2
            transition-colors
          "
        >
          <LogOut size={14} />
          Keluar
        </button>
      </aside>

      {/* ============================================================
          MAIN
      ============================================================ */}

      <div className="relative z-10 flex-1 min-w-0 flex flex-col">
        {/* ============================================================
            MOBILE HEADER
        ============================================================ */}

        <header
          className="
            md:hidden
            sticky
            top-0
            z-30
            backdrop-blur-xl
            border-b
            border-orange-500/[0.07]
          "
          style={{
            background:
              "rgba(25,16,10,.86)",
          }}
        >
          <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center gap-2.5">
            <NextoBadge size={32} />

            <div className="leading-tight flex-1">
              <div className="font-bold tracking-tight text-sm">
                Nexto ·{" "}
                <span className="text-orange-100/40 font-medium">
                  {
                    NAV.find(
                      (n) =>
                        n.key ===
                        effectiveTab
                    )?.label
                  }
                </span>
              </div>
            </div>

            <ProfileAvatar
              settings={settings}
              session={session}
              org={org}
              onChanged={reload}
              size={32}
            />
          </div>
        </header>

        {/* ============================================================
            MAIN CONTENT
        ============================================================ */}

        <main className="relative flex-1 p-4 md:p-6 max-w-5xl w-full mx-auto pb-32">
          {/* Subtle content glow */}
          <div className="pointer-events-none absolute top-[-100px] left-1/2 -translate-x-1/2 w-[500px] h-[250px] rounded-full bg-orange-600/[0.025] blur-[100px]" />

          {!loading &&
            !isPremium && (
              <div
                className="
                  relative
                  mb-4
                  border
                  border-orange-500/20
                  rounded-2xl
                  px-4
                  py-3
                  space-y-2.5
                "
                style={{
                  background:
                    "linear-gradient(135deg, rgba(89,39,9,.28), rgba(35,20,10,.55))",
                }}
              >
                <div className="flex items-center justify-between gap-2 text-xs text-orange-100/70">
                  <span>
                    Kamu sekarang di paket{" "}
                    <b className="text-orange-300">
                      Free
                    </b>{" "}
                    (Dashboard &amp; Leads
                    doang). Upgrade ke Premium
                    (Rp149rb/bulan) buat buka
                    semua fitur + bot Telegram +
                    Calendar + AI.
                  </span>

                  <a
                    href="https://subscription.myr.id/m/nexto-premium-88379/"
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 underline font-medium text-orange-400"
                  >
                    Upgrade
                  </a>
                </div>

                <div className="border-t border-orange-500/10 pt-2.5">
                  <p className="text-[11px] text-orange-200/50 mb-1.5">
                    Atau punya kode undangan
                    dari tim (bos kamu udah
                    Enterprise)? Masukin di sini,
                    gratis buat kamu:
                  </p>

                  <div className="flex gap-2">
                    <input
                      className="
                        flex-1
                        px-3
                        py-1.5
                        text-xs
                        border
                        border-orange-500/20
                        rounded-lg
                        uppercase
                        bg-black/20
                        text-orange-50
                        placeholder:text-orange-100/20
                        focus:outline-none
                        focus:border-orange-500/40
                      "
                      placeholder="MASUKIN KODE"
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
                        bg-orange-600
                        hover:bg-orange-700
                        disabled:opacity-60
                        text-white
                        rounded-lg
                        px-3
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
                      className={`text-[11px] mt-1.5 ${
                        joinMsg.startsWith(
                          "Gagal"
                        )
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

              {effectiveTab === "deal" && (
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

        {/* ============================================================
            MOBILE BOTTOM NAV
        ============================================================ */}

        <nav className="md:hidden fixed bottom-3 inset-x-3 z-40">
          <div
            className="
              max-w-lg
              mx-auto
              flex
              justify-around
              px-1.5
              py-2
              rounded-[26px]
              shadow-[0_8px_32px_-6px_rgba(0,0,0,0.65)]
              border
              border-orange-500/[0.08]
              backdrop-blur-xl
            "
            style={{
              background:
                "rgba(31,18,10,.92)",
            }}
          >
            {NAV.map((n) => {
              const I = n.icon;
              const active =
                effectiveTab === n.key;
              const locked =
                isLocked(n.key);

              const cls = locked
                ? "text-orange-100/20"
                : n.special
                ? active
                  ? "text-violet-400 bg-violet-500/10"
                  : "text-violet-400"
                : active
                ? "text-orange-400 bg-orange-500/10"
                : "text-orange-100/35";

              return (
                <button
                  key={n.key}
                  onClick={() =>
                    setTab(n.key)
                  }
                  className={`relative flex flex-col items-center gap-0.5 flex-1 py-1.5 rounded-2xl transition-colors ${cls}`}
                >
                  <I
                    size={19}
                    strokeWidth={
                      active ? 2.5 : 2
                    }
                  />

                  <span className="text-[9px] font-medium leading-none truncate max-w-full mt-0.5">
                    {n.short}
                  </span>

                  {locked && (
                    <Lock
                      size={9}
                      className="absolute top-0.5 right-2"
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

// ================================================================
// PREMIUM PREVIEW LOCK
// ================================================================

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
          text-white
          text-xs
          rounded-2xl
          px-4
          py-2.5
          flex
          items-center
          gap-2
          border
          border-orange-500/10
        "
        style={{
          background:
            "rgba(45,25,12,.82)",
        }}
      >
        <Lock
          size={13}
          className="shrink-0 text-orange-400"
        />

        <span className="text-orange-100/60">
          Mode lihat-lihat doang - upgrade ke
          Premium buat bisa nambah/ubah data di
          sini.
        </span>
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

// ================================================================
// PROFILE AVATAR
// ================================================================

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
          cls: "bg-violet-500/10 text-violet-300 border border-violet-500/10",
        }
      : settings.plan === "premium"
      ? {
          label: "Premium",
          cls: "bg-orange-500/10 text-orange-300 border border-orange-500/10",
        }
      : {
          label: "Free",
          cls: "bg-white/[0.05] text-orange-100/40 border border-orange-500/[0.06]",
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
          ring-2
          ring-orange-500/20
          bg-gradient-to-br
          from-orange-400
          to-orange-800
          text-white
          flex
          items-center
          justify-center
          font-semibold
          shadow-[0_2px_12px_-1px_rgba(249,115,22,.4)]
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
              bg-[#21140b]
              rounded-[24px]
              shadow-[0_16px_50px_-8px_rgba(0,0,0,.7)]
              z-50
              overflow-hidden
              border
              border-orange-500/[0.12]
            `}
          >
            {!editing ? (
              <>
                <div className="h-16 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-900 relative">
                  <div className="absolute -bottom-7 left-5 w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-800 text-white flex items-center justify-center font-bold text-2xl ring-4 ring-[#21140b] shadow-md">
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
                    <div className="font-bold text-[15px] text-orange-50 truncate">
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
                    <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-wide bg-white/[0.05] text-orange-100/45 rounded-full px-2.5 py-1">
                      {settings.job_title}
                    </span>
                  )}

                  {email && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-orange-100/35">
                      <Mail
                        size={11}
                        className="shrink-0"
                      />

                      <span className="truncate">
                        {email}
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setEditing(true)
                    }
                    className="w-full mt-4 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-xl py-2.5 font-medium transition-colors"
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

                <label className="block mb-2.5">
                  <span className="text-[11px] font-medium text-orange-100/35">
                    Nama
                  </span>

                  <input
                    className="
                      w-full
                      mt-1
                      px-3
                      py-2
                      text-sm
                      text-orange-50
                      bg-black/20
                      border
                      border-orange-500/[0.12]
                      rounded-xl
                      focus:outline-none
                      focus:border-orange-500/40
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
                  <span className="text-[11px] font-medium text-orange-100/35">
                    Jabatan
                  </span>

                  <input
                    className="
                      w-full
                      mt-1
                      px-3
                      py-2
                      text-sm
                      text-orange-50
                      bg-black/20
                      border
                      border-orange-500/[0.12]
                      rounded-xl
                      focus:outline-none
                      focus:border-orange-500/40
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
                      text-orange-100/45
                      border
                      border-orange-500/[0.12]
                      rounded-xl
                      py-2.5
                      hover:bg-orange-500/[0.05]
                      font-medium
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
                      bg-orange-600
                      hover:bg-orange-700
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

// ================================================================
// SPLASH
// ================================================================

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
      style={{
        background:
          "transparent",
      }}
    >
      <div
        className="animate-pulse"
        style={{
          filter:
            "drop-shadow(0 0 18px rgba(249,115,22,.35))",
        }}
      >
        <NextoBadge size={48} />
      </div>

      <div className="text-orange-100/35 text-sm flex items-center gap-1.5">
        <Loader2
          size={13}
          className="animate-spin text-orange-500"
        />

        Memuat…
      </div>
    </div>
  );
}
