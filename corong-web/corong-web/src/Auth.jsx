Pasted text(2).txt
Document
bro gua mau tampilan landing page atau tampilan awal nexto di buat seperti ui ux promax
Videos2026-08-24_194714_690.mp4
File
gua mau lu buat ktk gini bukan merubah semuanya bro.  jadi bentuknya lebih bagus coba lu buat sendiri pake kemampuan lu.
Edit
Edit
Videos2026-08-24_194714_690(1).mp4
File
gua hanya butuh lu redesign gambar yang ada di dalam komputer in idan isinya tetap sama

Nah, sekarang gue paham 100% bro. Yang mau gue redesign cuma UI yang tampil di layar laptop pada video itu — isi/fungsi/tulisan tetap sama, nggak mengubah landing page secara keseluruhan, nggak nambah section lain.

Tapi karena yang lo kirim berupa video, gue perlu targetnya dalam bentuk screenshot/frame gambar supaya bisa gue edit presisi.

Upload screenshot layar laptopnya (cukup bagian halaman Nexto yang sekarang), lalu gue langsung redesign bagian itu dengan style modern, futuristic, robot/AI, sementara semua isi dan teks tetap sama.

Edit
Pasted text(3).txt
Document
bro gua pengen lu redesign ui tampilan dari crm nexto buat sesuai dengan ui ux promax seperti lu mendesign landing page nexto
Edit

Nah bro, ini baru konsep yang menurut gue pas banget buat Nexto. Gue nggak mau chatbot-nya cuma jadi kotak chat biasa.

Gue mau chatbot jadi “otak/pusat”, lalu tiga fungsi utama bercabang dari dia:

                         ┌──────────────────────┐
                         │  📅 GOOGLE CALENDAR  │
                         │  Set Visit Otomatis   │
                         └──────────▲───────────┘
                                    │
                                    │
              ┌─────────────────────┴─────────────────────┐
              │                                           │
              │            🤖 NEXTO AI CHATBOT            │
              │                                           │
              │       "Apa yang mau kamu kerjakan?"      │
              │                                           │
              └───────────────┬───────────────┬───────────┘
                              │               │
                              ▼               ▼
                 ┌─────────────────┐   ┌──────────────────┐
                 │ 🎙 PROGRESS      │   │ ✏️ EDIT CRM AI   │
                 │ Voice / Text     │   │ AI yang kerjain  │
                 └─────────────────┘   └──────────────────┘

Visual konsepnya gue bikin seperti ini:

6
Yang paling penting: dia bergerak

Bukan gambar statis.

Di landing page nanti gue bikin:

1. Robot/chatbot di tengah melakukan idle animation

Robot sedikit floating:

↑ ↓ ↑ ↓

dengan ring/orbit orange yang bergerak.

2. Connection lines hidup

Dari chatbot menuju:

📅 Calendar
🎙 Progress
✏️ CRM

Garisnya seperti ada energy pulse yang bergerak dari pusat ke masing-masing fungsi.

3. Chat bubble muncul bergantian

Contoh:

👤 “Besok jam 10 visit PT ABC.”

↓

🤖 “Siap. Visit sudah dibuat.”

↓

Google Calendar card muncul:

10:00 — Visit PT ABC
✅ Added to Google Calendar

Kemudian reset.

Lalu:

🎙 “Hari ini gue visit PT ABC…”

↓

🤖 “Progress hari ini sudah diperbarui.”

Kemudian CRM card berubah.

Lalu:

👤 “Update PT ABC jadi Negosiasi.”

↓

🤖 “Done. CRM sudah diperbarui.”

Jadi orang yang lihat landing page langsung ngerti: oh shit, chatbot ini benar-benar mengerjakan sesuatu.

Dan secara produk, gue mau semuanya satu engine

Bukan 3 fitur yang berdiri sendiri.

Misalnya user bilang:

“Besok jam 10 gue visit PT ABC, mereka minta sample. Tolong jadwalin.”

Nexto melakukan:

CHAT
 ↓
AI memahami intent
 ↓
Cari PT ABC
 ↓
Update CRM
    ├─ visit_date
    ├─ visit_agenda
    └─ next_action
 ↓
Google Calendar
 ↓
Create event
 ↓
Response

Jadi satu command → beberapa sistem bekerja.

Begitu juga:

“Hari ini gue udah visit PT ABC. Mereka tertarik, tapi minta harga baru minggu depan.”

Nexto:

Voice / Text
      ↓
Speech-to-text (kalau voice)
      ↓
AI memahami isi
      ↓
PT ABC ditemukan
      ↓
CRM UPDATE
 ├─ last contact
 ├─ status
 ├─ notes
 └─ next action
      ↓
FOLLOW-UP
      ↓
AI response

Ini yang menurut gue bakal bikin Nexto beda dari CRM biasa.

Tapi ada satu hal penting

Untuk landing page, gue akan bikin ini sebagai interactive product demonstration.

Artinya visitor bisa mencoba:

“Besok jam 10 visit PT ABC.”

lalu Nexto menjawab secara demo.

Jangan langsung menghubungkan chatbot publik ke CRM/Google Calendar asli.

Karena orang random yang buka nexto.site belum authenticated. Kita nggak mau chatbot publik bisa menyentuh database atau Calendar user.

Setelah login:

chatbot yang sama → benar-benar menjalankan action.

Jadi arsitekturnya:

                 NEXTO CHAT ENGINE
                        │
              ┌─────────┴─────────┐
              │                   │
         LANDING DEMO          LOGGED USER
              │                   │
        Simulated actions       Real actions
                                  │
                 ┌────────────────┼───────────────┐
                 │                │               │
                 ▼                ▼               ▼
              CRM DB       Google Calendar    Voice/Text

Dan ini nyambung banget dengan sistem yang sudah lo punya sekarang, karena Nexto lo sudah punya Google Calendar OAuth, Telegram command parsing, voice transcription, CRM update, dan AI Advisor.

Jadi kita sebenarnya nggak perlu bikin Nexto dari nol. Kita bikin Chat Engine sebagai pusat orchestration, lalu connector yang sudah ada kita satukan di belakangnya.

Nama konsepnya:
NEXT0 AI SALES ENGINE

You talk. Nexto works.

Menurut gue ini jauh lebih kuat daripada positioning:

“CRM dengan chatbot.”

Karena yang kita jual adalah:

“Sales cukup ngomong ke Nexto. Nexto yang mengerjakan CRM-nya.”

Dan visual yang gue buat tadi bisa kita jadikan hero interactive section di landing page, bukan sekadar gambar.

Edit
bro tampilan apps jsx gua pengen seperti ini yang lu buat. jadi keren bangett bro gass buatin dan copy full code kesini
bro bagian background di app jsx di buat warnanya seperti background gambar yang gua lampirkan ini
bro gua oengen lu hapus semua heder yang ada di setiap tab dari dashboard sampe pengaturan. 

Iya bro, sekarang gue nangkep masalahnya. Yang mau lo hapus itu bukan sidebar/mobile header, tapi header internal di setiap tab yang kelihatan seperti:

Workspace / Leads
SALES WORKSPACE
Leads
Kelola dan prioritaskan seluruh prospek kamu.

Dan pola yang sama muncul lagi di Generate Leads, Deal, sampai Pengaturan.

Gue setuju dihapus semua. Karena sekarang Nexto sudah punya navigation utama di sidebar, header internal itu jadi redundant dan bikin ruang atas kebuang. Screenshot lo memang menunjukkan header tersebut berulang di setiap halaman.

Tapi gue nggak mau kasih full App.jsx palsu lagi, bro. Header yang lo tunjuk itu berada di masing-masing component tab, bukan di App.jsx. App.jsx memang hanya memanggil <Dashboard />, <Leads />, <GenerateLeads />, <Deal />, <VisitFollowup />, <Kompetitor />, <Advisor />, dan <SettingsTab />.

Jadi kalau gue cuma kasih App.jsx, header-nya tetap muncul.

Yang harus kita lakukan

Kita hapus bagian header dari:

src/tabs/Dashboard.jsx
src/tabs/Leads.jsx
src/tabs/GenerateLeads.jsx
src/tabs/Deal.jsx
src/tabs/VisitFollowup.jsx
src/tabs/Kompetitor.jsx
src/tabs/Nex.jsx
src/tabs/Advisor.jsx
src/tabs/Settings.jsx

Tapi isi/functionality di bawah header jangan disentuh.

Hasil akhirnya:

┌─────────────────────────────────────────────────────────┐
│ Nexto                              Profile               │
├──────────────┬──────────────────────────────────────────┤
│ Dashboard    │                                          │
│ Leads        │   [langsung masuk ke isi Dashboard]     │
│ Generate     │                                          │
│ Deal         │   KPI / Pipeline / Activity              │
│ Visit        │                                          │
│ Kompetitor   │                                          │
│ Nex          │                                          │
│ AI Advisor   │                                          │
│ Pengaturan   │                                          │
└──────────────┴──────────────────────────────────────────┘

Jadi nggak ada lagi:

Workspace / Leads

● SALES WORKSPACE

Leads

Kelola dan prioritaskan...

Dan juga nggak ada lagi versi Generate Leads / Deal / Settings-nya.

Ini jauh lebih cocok dengan arah desain yang tadi kita sepakati: clean, compact, readable, premium.

Gue perlu source masing-masing src/tabs/*.jsx yang sekarang dipakai supaya gue bisa kasih full code per file yang benar-benar aman dipaste, bukan nebak-nebak dan berisiko ngerusak logic. Saat ini source yang tersedia di file context menunjukkan struktur pemanggilan tab dan beberapa source lama, tetapi belum memberi full isi versi terbaru semua tab.

Kalau lo upload/paste folder src/tabs atau file-file tab tersebut, gue bisa langsung balikin full code tiap file, tinggal paste ke GitHub satu-satu.

Bro, bisa. Tapi source full yang ada sekarang cuma App.jsx, dan header yang lo tunjuk di screenshot bukan berada di App.jsx—App cuma me-render masing-masing tab (Dashboard, Leads, GenerateLeads, Deal, VisitFollowup, Kompetitor, Nex, Advisor, Settings).

Jadi kalau gue copy full App.jsx dan bilang itu sudah menghapus header, bohong—header bakal tetap muncul.

Yang gue butuhin cuma source full:

src/tabs/Dashboard.jsx
src/tabs/Leads.jsx
src/tabs/GenerateLeads.jsx
src/tabs/Deal.jsx
src/tabs/VisitFollowup.jsx
src/tabs/Kompetitor.jsx
src/tabs/Nex.jsx
src/tabs/Advisor.jsx
src/tabs/Settings.jsx

Setelah itu gue bisa kasih full code masing-masing file yang sudah dibersihkan, bukan potongan kode.

Targetnya persis:

Workspace / Leads          ❌ HAPUS
● SALES WORKSPACE          ❌ HAPUS
Leads                      ❌ HAPUS
Kelola dan prioritaskan... ❌ HAPUS

↓ langsung ↓

[isi utama Leads]

Sidebar + mobile navigation + profile tetap ada. Struktur navigation utama memang sudah di App.jsx.

Kalau lo paste/upload folder tabs-nya, gue langsung copy full code + hapus semua header tersebut di semua tab.

Pasted markdown.md
File
ini

Nah ini file yang lo kirim. Gue sudah redesign khusus bagian App.jsx-nya: mobile header + desktop top bar + header “Sales Workspace / Leads / Deal / dll” gue hapus, jadi area utama langsung masuk ke konten tab. Header yang tadi bikin tampilan tiap tab seperti screenshot memang berasal dari blok tersebut.

Yang tetap gue pertahankan:

Sidebar kiri desktop
Bottom navigation mobile
Profile/avatar
Premium banner
Semua tab & logic database
Preview lock
Lead modal
Pull-to-refresh
Supabase/auth
Semua fungsi existing

Yang gue hapus:

Workspace / Leads
Workspace / Generate Leads
Workspace / Deal
Nexto + nama tab mobile header
SALES WORKSPACE
Judul besar Leads / Generate Leads / Deal / ...
Deskripsi di bawah judul

Ini full App.jsx yang sudah dibersihkan:

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
  ArrowUpRight,
  Zap,
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

// ================================================================
// DATA DUMMY UNTUK PREVIEW PREMIUM
// ================================================================

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

// ================================================================
// NAVIGATION
// ================================================================

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
    ai: true,
  },

  {
    key: "settings",
    label: "Pengaturan",
    short: "More",
    icon: SettingsIcon,
  },
];

// ================================================================
// CONFIG SCREEN
// ================================================================

function ConfigScreen() {
  return (
    <div className="min-h-screen bg-[#f7f8fa] flex items-center justify-center p-4">
      <div className="max-w-md bg-white border border-slate-200/80 rounded-[28px] shadow-[0_20px_60px_-25px_rgba(15,23,42,0.18)] p-7">
        <div className="mb-4">
          <NextoBadge size={48} />
        </div>

        <h1 className="text-lg font-bold mb-2 text-slate-950">
          Sambungin ke Supabase dulu
        </h1>

        <p className="text-sm text-slate-500 mb-3">
          Buat file{" "}
          <code className="bg-slate-100 px-1 rounded">
            .env
          </code>{" "}
          di root project (salin dari{" "}
          <code className="bg-slate-100 px-1 rounded">
            .env.example
          </code>
          ), isi:
        </p>

        <pre className="text-xs bg-slate-950 text-slate-100 rounded-xl p-3 overflow-x-auto">
          VITE_SUPABASE_URL=...
          {"\n"}
          VITE_SUPABASE_ANON_KEY=...
        </pre>

        <p className="text-xs text-slate-400 mt-3">
          Ambil dari Supabase → Project Settings → API. Terus
          restart{" "}
          <code className="bg-slate-100 px-1 rounded">
            npm run dev
          </code>
          .
        </p>
      </div>
    </div>
  );
}

// ================================================================
// APP
// ================================================================

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

  // ==============================================================
  // JOIN ENTERPRISE
  // ==============================================================

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

  // ==============================================================
  // AUTH
  // ==============================================================

  useEffect(() => {
    if (!isConfigured) {
      setAuthReady(true);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: sub } =
      supabase.auth.onAuthStateChange((_e, s) => {
        db.clearOrgCache();
        setSession(s);
      });

    return () =>
      sub.subscription.unsubscribe();
  }, []);

  // ==============================================================
  // RELOAD DATA
  // ==============================================================

  const reload = async () => {
    setLoading(true);

    try {
      let [st, se, ls, comp, dt] =
        await Promise.all([
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

  // ==============================================================
  // SILENT RELOAD
  // ==============================================================

  const silentReload = async () => {
    try {
      const [st, se, ls, comp, dt] =
        await Promise.all([
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

  // ==============================================================
  // SESSION CHANGE
  // ==============================================================

  const prevUserId = useRef(null);

  useEffect(() => {
    const uid = session?.user?.id || null;

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

  // ==============================================================
  // AUTO REFRESH AFTER TAB IS LEFT
  // ==============================================================

  useEffect(() => {
    let hiddenAt = null;

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else if (hiddenAt && session) {
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

  // ==============================================================
  // MOBILE PULL REFRESH
  // ==============================================================

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
      {
        passive: true,
      }
    );

    document.addEventListener(
      "touchmove",
      onTouchMove,
      {
        passive: true,
      }
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

  // ==============================================================
  // INITIAL STATES
  // ==============================================================

  if (!isConfigured)
    return <ConfigScreen />;

  if (!authReady)
    return <Splash />;

  if (!session)
    return <Auth />;

  // ==============================================================
  // PLAN
  // ==============================================================

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

  // ==============================================================
  // NAVIGATION
  // ==============================================================

  const goTo = (key) => {
    setTab(key);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ==============================================================
  // MAIN UI
  // ==============================================================

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-900 flex selection:bg-orange-100 selection:text-orange-900">

      {/* =========================================================
          MOBILE PULL REFRESH
      ========================================================== */}

      {(pullVisual > 0 || refreshing) && (
        <div
          className="md:hidden fixed top-0 inset-x-0 z-[80] flex items-start justify-center pointer-events-none transition-[height] duration-150"
          style={{
            height: refreshing
              ? 56
              : pullVisual,
          }}
        >
          <div className="bg-white rounded-full p-2 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.3)] mt-2 border border-slate-100">
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
                      transform: `rotate(${pullVisual * 3}deg)`,
                    }
              }
            />
          </div>
        </div>
      )}

      {/* =========================================================
          DESKTOP SIDEBAR
      ========================================================== */}

      <aside className="hidden md:flex flex-col w-[248px] bg-[#0b0d10] text-white sticky top-0 h-screen shrink-0 border-r border-white/[0.04]">

        <div className="px-5 pt-5 pb-5">
          <div className="flex items-center gap-3">

            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-orange-500/20 blur-lg" />

              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08]">
                <NextoBadge size={28} />
              </div>
            </div>

            <div className="flex-1 leading-tight">
              <div className="font-bold tracking-[-0.03em] text-[16px]">
                Nexto
              </div>

              <div className="text-[8px] uppercase tracking-[0.18em] text-slate-600 mt-0.5">
                Sales Intelligence
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
        </div>

        <div className="px-6 pb-2 text-[8px] font-bold uppercase tracking-[0.18em] text-slate-700">
          Workspace
        </div>

        <nav className="flex-1 px-3 py-1 space-y-1 overflow-y-auto scrollbar-none">

          {NAV.map((n) => {
            const I = n.icon;
            const active =
              effectiveTab === n.key;

            const locked =
              isLocked(n.key);

            let cls = "";

            if (locked) {
              cls =
                "text-slate-600 hover:bg-white/[0.025] cursor-pointer";
            } else if (n.special) {
              cls = active
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold shadow-[0_8px_25px_-10px_rgba(139,92,246,0.8)]"
                : "text-violet-300 hover:bg-violet-500/10 hover:text-violet-200";
            } else if (n.ai) {
              cls = active
                ? "bg-orange-500/10 text-orange-300 font-semibold border border-orange-500/15"
                : "text-orange-400/80 hover:bg-orange-500/[0.07] hover:text-orange-300";
            } else {
              cls = active
                ? "bg-white/[0.08] text-white font-semibold shadow-inner"
                : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-200";
            }

            return (
              <button
                key={n.key}
                onClick={() =>
                  goTo(n.key)
                }
                className={`group relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[12px] transition-all duration-150 ${cls}`}
              >

                {active &&
                  !locked &&
                  !n.special && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-orange-500" />
                  )}

                <I
                  size={16}
                  strokeWidth={
                    active ? 2.5 : 1.8
                  }
                  className={
                    n.ai
                      ? "text-orange-400"
                      : active
                      ? "text-white"
                      : "text-slate-500 group-hover:text-slate-300"
                  }
                />

                <span className="flex-1 text-left">
                  {n.label}
                </span>

                {n.ai && (
                  <span className="rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[7px] font-bold text-orange-400">
                    AI
                  </span>
                )}

                {locked && (
                  <Lock
                    size={11}
                    className="shrink-0 text-slate-700"
                  />
                )}

              </button>
            );
          })}

        </nav>

        <div className="p-3">

          <div className="mb-2 rounded-xl border border-white/[0.05] bg-white/[0.025] px-3 py-2.5">

            <div className="flex items-center gap-2">

              <div
                className={`h-1.5 w-1.5 rounded-full ${
                  isPremium
                    ? "bg-emerald-400"
                    : "bg-slate-500"
                }`}
              />

              <span className="text-[9px] font-medium text-slate-400">
                {org?.plan ===
                "enterprise"
                  ? "Enterprise workspace"
                  : settings.plan ===
                    "premium"
                  ? "Premium workspace"
                  : "Free workspace"}
              </span>

            </div>
          </div>

          <button
            onClick={() =>
              supabase.auth.signOut()
            }
            className="w-full px-3.5 py-2.5 rounded-xl text-[10px] text-slate-500 hover:bg-white/[0.05] hover:text-slate-300 flex items-center gap-2 transition-colors"
          >
            <LogOut size={13} />
            Keluar
          </button>

        </div>
      </aside>

      {/* =========================================================
          MAIN AREA
      ========================================================== */}

      <div className="flex-1 min-w-0 flex flex-col">

        {/* =======================================================
            NO GLOBAL HEADER
            Tab langsung dimulai dari content.
        ======================================================== */}

        <main className="flex-1 p-3 sm:p-4 md:p-6 max-w-[1180px] w-full mx-auto pb-28 md:pb-10">

          {/* =====================================================
              FREE PLAN BANNER
          ====================================================== */}

          {!loading &&
            !isPremium && (
              <div className="mb-5 overflow-hidden rounded-[18px] border border-orange-200/80 bg-gradient-to-r from-orange-50 via-white to-orange-50/50">

                <div className="px-4 py-3.5">

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">

                    <div className="flex items-start gap-3">

                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                        <Zap size={13} />
                      </div>

                      <div>

                        <div className="text-[10px] font-bold text-orange-900">
                          Kamu sedang menggunakan paket Free
                        </div>

                        <div className="mt-1 max-w-2xl text-[9px] leading-4 text-orange-700/70">
                          Dashboard & Leads tersedia.
                          Upgrade ke Premium untuk
                          membuka AI, Bot Telegram,
                          Calendar, Visit, Deal,
                          Kompetitor, dan fitur sales
                          lainnya.
                        </div>

                      </div>
                    </div>

                    <a
                      href="https://subscription.myr.id/m/nexto-premium-88379/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-orange-600 px-3.5 py-2 text-[9px] font-bold text-white transition hover:bg-orange-700"
                    >
                      Upgrade Rp149rb/bulan
                      <ArrowUpRight size={11} />
                    </a>

                  </div>

                  <div className="mt-3 border-t border-orange-200/60 pt-3">

                    <p className="mb-2 text-[9px] font-medium text-orange-700/70">
                      Punya kode undangan dari tim Enterprise?
                      Gabung gratis.
                    </p>

                    <div className="flex gap-2">

                      <input
                        className="min-w-0 flex-1 rounded-lg border border-orange-200 bg-white px-3 py-2 text-[10px] uppercase text-slate-800 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
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
                        className="rounded-lg bg-orange-600 px-3.5 text-[9px] font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                      >
                        {joinBusy
                          ? "..."
                          : "Gabung"}
                      </button>

                    </div>

                    {joinMsg && (
                      <p
                        className={`mt-1.5 text-[9px] ${
                          joinMsg.startsWith(
                            "Gagal"
                          )
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

          {/* =====================================================
              TAB CONTENT
              LANGSUNG TANPA PAGE HEADER
          ====================================================== */}

          {loading ? (
            <Splash inline />
          ) : (
            <>

              {/* ==================================================
                  DASHBOARD
              =================================================== */}

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

              {/* ==================================================
                  LEADS
              =================================================== */}

              {effectiveTab ===
                "leads" && (
                <Leads
                  leads={leads}
                  stages={stageList}
                  settings={settings}
                  onChanged={reload}
                />
              )}

              {/* ==================================================
                  GENERATE LEADS
              =================================================== */}

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

              {/* ==================================================
                  DEAL
              =================================================== */}

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

              {/* ==================================================
                  VISIT & FOLLOW UP
              =================================================== */}

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

              {/* ==================================================
                  KOMPETITOR
              =================================================== */}

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

              {/* ==================================================
                  NEX
              =================================================== */}

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

              {/* ==================================================
                  AI ADVISOR
              =================================================== */}

              {effectiveTab ===
                "advisor" && (
                <PreviewLock
                  locked={isLocked(
                    "advisor"
                  )}
                >
                  <Advisor
                    leads={
                      isLocked(
                        "advisor"
                      )
                        ? DUMMY_LEADS
                        : leads
                    }
                    stages={stageList}
                    onOpen={
                      setEditLead
                    }
                    dummy={isLocked(
                      "advisor"
                    )}
                  />
                </PreviewLock>
              )}

              {/* ==================================================
                  SETTINGS
              =================================================== */}

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

        {/* =======================================================
            MOBILE BOTTOM NAV
        ======================================================== */}

        <nav className="md:hidden fixed bottom-3 inset-x-3 z-40">

          <div className="max-w-lg mx-auto flex items-center gap-1 px-1.5 py-1.5 bg-[#0b0d10]/95 backdrop-blur-2xl rounded-[22px] shadow-[0_15px_45px_-10px_rgba(15,23,42,0.35)] border border-white/[0.08]">

            {NAV.map((n) => {
              const I = n.icon;

              const active =
                effectiveTab === n.key;

              const locked =
                isLocked(n.key);

              let cls = "";

              if (locked) {
                cls =
                  "text-slate-600";
              } else if (
                n.special
              ) {
                cls = active
                  ? "text-violet-300 bg-violet-500/15"
                  : "text-violet-400";
              } else if (n.ai) {
                cls = active
                  ? "text-orange-400 bg-orange-500/10"
                  : "text-orange-500";
              } else {
                cls = active
                  ? "text-white bg-white/[0.09]"
                  : "text-slate-500";
              }

              return (
                <button
                  key={n.key}
                  onClick={() =>
                    goTo(n.key)
                  }
                  className={`relative flex flex-col items-center gap-1 flex-1 py-2 rounded-2xl transition-colors ${cls}`}
                >

                  <I
                    size={17}
                    strokeWidth={
                      active
                        ? 2.5
                        : 1.8
                    }
                  />

                  <span className="text-[7px] font-medium leading-none truncate max-w-full">
                    {n.short}
                  </span>

                  {locked && (
                    <Lock
                      size={7}
                      className="absolute top-1 right-2 text-slate-700"
                    />
                  )}

                </button>
              );
            })}

          </div>
        </nav>

      </div>

      {/* =========================================================
          EDIT LEAD
      ========================================================== */}

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
// PREMIUM LOCK
// ================================================================

function PreviewLock({
  locked,
  children,
}) {
  if (!locked) return children;

  return (
    <div className="relative">

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-[#0b0d10] px-4 py-2.5 text-[9px] text-slate-300 shadow-sm">

        <Lock
          size={12}
          className="shrink-0 text-orange-400"
        />

        <span className="flex-1">
          Mode preview — upgrade ke Premium
          untuk menggunakan fitur ini.
        </span>

        <span className="hidden sm:block rounded-full bg-orange-500/10 px-2 py-1 text-[7px] font-bold uppercase tracking-wide text-orange-400">
          Premium
        </span>

      </div>

      <div
        onClick={() =>
          alert(
            "Ini fitur Premium bro — di paket Free cuma bisa dilihat doang. Upgrade dulu (Rp149rb/bulan) buat pake fiturnya."
          )
        }
        className="absolute inset-0 top-11 z-20 cursor-pointer"
      />

      <div className="opacity-[0.82]">
        {children}
      </div>

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
          cls:
            "bg-violet-100 text-violet-700",
        }
      : settings.plan === "premium"
      ? {
          label: "Premium",
          cls:
            "bg-orange-100 text-orange-700",
        }
      : {
          label: "Free",
          cls:
            "bg-slate-100 text-slate-500",
        };

  // ==============================================================
  // UPLOAD AVATAR
  // ==============================================================

  const handleFile = async (e) => {
    const file =
      e.target.files?.[0];

    if (!file) return;

    setUploading(true);

    try {
      const url =
        await db.uploadAvatar(file);

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

  // ==============================================================
  // SAVE PROFILE
  // ==============================================================

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

  // ==============================================================
  // PROFILE UI
  // ==============================================================

  return (
    <div className="relative">

      <button
        onClick={() =>
          setOpen((v) => !v)
        }
        className="shrink-0 rounded-full overflow-hidden ring-2 ring-white/40 bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center font-semibold shadow-[0_2px_10px_-1px_rgba(0,0,0,0.25)]"
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
            className={`absolute ${
              align === "left"
                ? "left-0"
                : "right-0"
            } top-full mt-2.5 w-72 bg-white rounded-[24px] shadow-[0_20px_55px_-12px_rgba(15,23,42,0.3)] z-50 overflow-hidden border border-slate-100`}
          >

            {!editing ? (
              <>
                <div className="h-16 bg-gradient-to-br from-[#17191d] via-[#101215] to-orange-950 relative">

                  <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-1 text-[7px] font-bold uppercase tracking-wide text-white/70">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Online
                  </div>

                  <div className="absolute -bottom-7 left-5 w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center font-bold text-2xl ring-4 ring-white shadow-md">

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

                    <div className="font-bold text-[15px] text-slate-900 truncate">
                      {settings.community_display_name ||
                        "Belum ada nama"}
                    </div>

                    <span
                      className={`shrink-0 text-[9px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-1 ${planInfo.cls}`}
                    >
                      {planInfo.label}
                    </span>

                  </div>

                  {settings.job_title && (
                    <span className="inline-block mt-1.5 text-[9px] font-semibold uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-2.5 py-1">
                      {settings.job_title}
                    </span>
                  )}

                  {email && (
                    <div className="flex items-center gap-1.5 mt-3 text-[10px] text-slate-400">
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
                    className="w-full mt-4 text-[10px] bg-slate-950 hover:bg-slate-800 text-white rounded-xl py-2.5 font-semibold transition-colors"
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

                  <span className="text-[10px] text-orange-600 font-semibold flex items-center gap-1">
                    <Camera
                      size={13}
                    />
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

                  <span className="text-[10px] font-medium text-slate-400">
                    Nama
                  </span>

                  <input
                    className="w-full mt-1 px-3 py-2.5 text-[11px] text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target.value
                      )
                    }
                  />

                </label>

                <label className="block mb-4">

                  <span className="text-[10px] font-medium text-slate-400">
                    Jabatan
                  </span>

                  <input
                    className="w-full mt-1 px-3 py-2.5 text-[11px] text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
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
                    className="flex-1 text-[10px] text-slate-700 border border-slate-200 rounded-xl py-2.5 hover:bg-slate-50 font-medium"
                  >
                    Batal
                  </button>

                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="flex-1 text-[10px] bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-xl py-2.5 font-medium"
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
// LOADING / SPLASH
// ================================================================

function Splash({
  inline,
}) {
  return (
    <div
      className={`${
        inline
          ? "py-24"
          : "min-h-screen"
      } bg-transparent flex flex-col items-center justify-center gap-4`}
    >

      <div className="relative">

        <div className="absolute inset-0 rounded-2xl bg-orange-500/20 blur-xl animate-pulse" />

        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0b0d10] shadow-[0_15px_40px_-12px_rgba(15,23,42,0.3)]">
          <NextoBadge size={38} />
        </div>

      </div>

      <div className="text-slate-400 text-[10px] flex items-center gap-1.5">

        <Loader2
          size={12}
          className="animate-spin text-orange-500"
        />

        Nexto sedang menyiapkan workspace…

      </div>

    </div>
  );
}

Paste ini menggantikan App.jsx lo.

Hasilnya nanti struktur desktop jadi:

┌───────────────┬──────────────────────────────────────┐
│               │                                      │
│    NEXTО      │                                      │
│               │        [ CONTENT TAB ]               │
│ Dashboard     │                                      │
│ Leads         │                                      │
│ Generate      │                                      │
│ Deal          │                                      │
│ Visit         │                                      │
│ Kompetitor    │                                      │
│ Nex           │                                      │
│ AI Advisor    │                                      │
│ Pengaturan    │                                      │
│               │                                      │
└───────────────┴──────────────────────────────────────┘

Jadi nggak ada lagi bar Workspace / Leads di atas dan nggak ada lagi ● SALES WORKSPACE → Leads → deskripsi. Konten tab langsung mulai dari atas.

Catatan penting: kalau setelah ini masih muncul tulisan Leads / Generate Leads / Deal di dalam halaman, berarti itu header yang berada di file tab masing-masing (Dashboard.jsx, Leads.jsx, dst.), bukan dari App.jsx. Source yang lo kirim sekarang memang menunjukkan App sebagai parent yang me-render semua tab tersebut.

Pasted text(4).txt
Document
bro gua mau landing page exto balik seperti code yang gua lampirkan dan lu tambahkan robot chatbot itu ke dalam landing page

Nah bro, gue balikin landing page berdasarkan code yang lo lampirin, bukan gue rombak jadi desain baru. Struktur, section, pricing, FAQ, auth, navigation, dan copy existing tetap dipertahankan.

Yang gue tambahin adalah robot Nexto AI seperti visual yang lo kasih:

Robot 3D-style di tengah hero
Orange glowing ring / aura
Card Setting Visit
Card Edit CRM
Card Update Progress — Voice & Text
Notification “Done. Data CRM sudah diperbarui.”
Klik robot → chatbot Nexto AI kebuka
Ada quick prompt:
“Siapa yang harus gue follow up?”
“Deal mana yang berisiko?”
“Update CRM gue”
Bisa ketik pertanyaan sendiri
Responsive untuk mobile
Existing landing page section lainnya tetap ada, termasuk AI Copilot, fitur, industri, pricing, FAQ, dan auth. Struktur tersebut memang sudah ada di source asli lo.

File hasilnya:

Download Auth.jsx — Landing Page + Nexto Robot Chatbot

Satu hal: chatbot yang gue pasang sekarang frontend demo, jadi belum benar-benar mengubah database/CRM. Gue sengaja bikin begitu supaya landing page-nya langsung jalan tanpa merusak Supabase yang sekarang. Auth existing tetap menggunakan supabase.auth.signInWithPassword dan signUp.

Kalau nanti kita sambungkan ke AI Agent Nexto beneran, robot yang sama bisa jadi pintu masuk ke agent: user tinggal bilang “update PT ABC jadi negosiasi”, “siapa yang harus gue visit besok?”, “follow up semua lead yang panas”, dll. 

Auth_with_Nexto_Robot_Chatbot.jsx
Code
