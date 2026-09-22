import { useEffect, useState, useMemo, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { supabase, isConfigured } from "./lib/supabaseClient";
import * as db from "./lib/db";
import { saveOpenModal, clearOpenModal, getOpenModal, saveScrollPos, getScrollPos } from "./lib/uiPersist";
import { MAYAR_PAYMENT_LINK, TIER_LABEL, PLAN_LEVEL } from "./lib/plans";
import Auth from "./Auth";
import PreviewLock from "./components/PreviewLock";
import AppTour from "./components/AppTour";
import QuickVoiceNoteModal from "./components/QuickVoiceNoteModal";
import { buildTourSteps } from "./lib/tourSteps";
import { NextoRobotHead, NextoDarkWordmark } from "./Auth";
// Dashboard/Leads/Settings tetep IMPORT STATIS - hampir semua user langsung
// buka salah satu dari ini begitu login, jadi lazy-load-nya cuma nambah
// flicker Suspense tanpa beneran ngirit apa-apa (chunk-nya bakal langsung
// diambil ulang beberapa detik kemudian).
import Dashboard from "./tabs/Dashboard";
import Leads from "./tabs/Leads";
import SettingsTab from "./tabs/Settings";
// BUNDLE SIZE FIX (9 Sep 2026): sebelumnya SEMUA tab (termasuk yang jarang
// dibuka kayak Kompetitor/Nex/IndustryDemo) ke-bundle statis ke chunk utama -
// padahal arsitektur "SEMUA TAB SELALU KE-MOUNT" (liat komentar di bawah)
// bikin lazy-load doang gak cukup: React.lazy tetep bakal langsung minta
// SEMUA chunk-nya begitu app kebuka, soalnya semua tab langsung dirender
// (cuma disembunyiin CSS), bukan nunggu diklik. Makanya sekarang DIGABUNG 2
// teknik: (1) React.lazy - chunk-nya kepisah dari bundle utama, DAN (2)
// visitedTabs (liat state-nya di bawah) - tab yang BELUM PERNAH dibuka sama
// sekali gak dirender dulu (jadi lazy-nya beneran nunda fetch chunk-nya),
// begitu udah pernah dibuka sekali baru dia nempel permanen (biar proses
// async yang lagi jalan gak keputus pas pindah tab, sama kayak sebelumnya).
const GenerateLeads = lazy(() => import("./tabs/GenerateLeads"));
const Deal = lazy(() => import("./tabs/Deal"));
const VisitFollowup = lazy(() => import("./tabs/VisitFollowup"));
const Kompetitor = lazy(() => import("./tabs/Kompetitor"));
const Nex = lazy(() => import("./tabs/Nex"));
const Advisor = lazy(() => import("./tabs/Advisor"));
const IndustryDemo = lazy(() => import("./tabs/IndustryDemo"));
// AdminDashboard cuma dirender buat platform admin (lihat gerbang
// `settings?.is_platform_admin && tab === "adminops"` di bawah), tapi dulu
// ke-bundle statis buat SEMUA user termasuk yang bukan admin, bawa serta
// "recharts" (lumayan berat) yang gak kepake sama sekali kalau bukan admin.
const AdminDashboard = lazy(() => import("./tabs/AdminDashboard"));
import LeadModal from "./components/LeadModal";
import IndustryPicker from "./components/IndustryPicker";
import { getIndustryTemplate, INDUSTRY_TEMPLATES } from "./lib/industryTemplates";
import {
  LayoutDashboard, Users, Trophy, CalendarCheck, Swords,
  Bot, Settings as SettingsIcon, Loader2, LogOut, Users2, Lock, Camera, Mail, Sparkles, ArrowLeft, ShieldCheck,
  CheckCircle2, XCircle, Info as InfoIcon, Bell, Mic,
} from "lucide-react";

// (Logo lama NextoBadge - segitiga oranye - udah diganti robot NextoRobotHead
// di semua tempat, termasuk loading screen. Dihapus biar gak ada kode nganggur.)

// ---- DATA DUMMY buat preview tab Premium (user Free) ----
// Ngasal doang - biar user Free liat gambaran "beneran kepake" bukan tab kosong.
// Gak pernah disimpen ke database, murni buat ditampilin doang.
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const DUMMY_LEADS = [
  { id: "dummy-1", name: "PT Sinar Abadi Distribusi", category: "Bahan Baku", stage_key: "presentasi", city: "Tangerang", key_person: "Budi Santoso", key_person_title: "Purchasing Manager", phone: "0812xxxxxx01", email: "budi@sinarabadi.co.id", visit_date: today, visit_meet: "Budi Santoso", visit_agenda: "Presentasi produk & harga penawaran", last_contact: "2026-08-20", next_action: "Follow up hasil presentasi minggu lalu", latitude: null, longitude: null, source: "manual" },
  { id: "dummy-2", name: "CV Karya Mandiri", category: "Barang Jadi", stage_key: "negosiasi", city: "Bekasi", key_person: "Sari Wulandari", key_person_title: "Direktur", phone: "0812xxxxxx02", email: "sari@karyamandiri.id", visit_date: tomorrow, visit_meet: "Sari Wulandari", visit_agenda: "Trial sample produk", last_contact: "2026-08-18", next_action: "Kirim sample ke pabrik", latitude: null, longitude: null, source: "manual" },
  { id: "dummy-3", name: "PT Maju Bersama Sejahtera", category: "Jasa", stage_key: "deal", city: "Surabaya", key_person: "Ahmad Fauzi", key_person_title: "Owner", phone: "0812xxxxxx03", email: "ahmad@majubersama.co.id", last_contact: "2026-08-15", latitude: null, longitude: null, source: "telegram" },
];
const DUMMY_DEAL_TX = [
  { id: "dd-1", lead_id: "dummy-3", lead_name: "PT Maju Bersama Sejahtera", deal_date: "2026-08-15", deal_value: 45000000, tonnage: 5, tonnage_unit: "ton", chemical: "Produk A - Kemasan Reguler" },
  { id: "dd-2", lead_id: "dummy-2", lead_name: "CV Karya Mandiri", deal_date: "2026-08-10", deal_value: 28000000, tonnage: 3, tonnage_unit: "ton", chemical: "Produk B - Kemasan Grosir" },
];
const DUMMY_COMPETITORS = [
  { id: "dc-1", name: "PT Kompetitor Jaya", background: "Pemain lama di area Jabodetabek", product: "Produk Sejenis A", notes: "Harga agresif tapi servis lambat", usages: [{ id: "u1", company: "PT ABC Nusantara", product: "Produk X", price: "Rp15.000/pcs", quantity: "2000 pcs/bulan" }] },
  { id: "dc-2", name: "CV Rival Sentosa", background: "Fokus segmen menengah ke bawah", product: "Produk Sejenis B", notes: "Kuat di after-sales support", usages: [] },
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
const ADMIN_NAV_ITEM = { key: "adminops", label: "Command Center", short: "AI Ops", icon: Bot };

// ---- COST/BUG FIX (5 Sep 2026) ----
// SEMUA tab sekarang selalu di-mount (gak pernah di-unmount pas pindah tab),
// cuma disembunyiin pake CSS display:none. Awalnya cuma GenerateLeads/Dashboard/
// Leads yang dipisah khusus - tapi ternyata popup AiDraftPopup & proses async
// serupa bisa muncul dari tab MANAPUN (siapa tau ada juga di Deal/Kompetitor/
// dst yang belum ketauan), jadi lebih aman & konsisten kalau SEMUA tab
// diperlakukan sama - biar gak ada proses/popup yang keputus/ilang lagi cuma
// gara-gara pindah tab, di tab manapun.

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

// ---- TOAST NOTIFICATION GLOBAL ----
// Dipake buat ngasih tau user hasil dari proses async yang lama (generate
// leads, draft follow-up, dst) WALAUPUN user-nya udah pindah ke tab lain
// pas prosesnya masih jalan - notif ini muncul di atas SEMUA tab, gak
// peduli tab mana yang lagi aktif.
function Toast({ toast, onDismiss }) {
  const isError = toast.type === "error";
  const Icon = isError ? XCircle : toast.type === "info" ? InfoIcon : CheckCircle2;
  return (
    <div
      className={`pointer-events-auto flex items-start gap-2.5 w-full max-w-sm rounded-2xl px-4 py-3 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.35)] border ${isError ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-white border-slate-200 text-slate-800"}`}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${isError ? "text-rose-500" : "text-emerald-500"}`} />
      <span className="text-sm flex-1">{toast.text}</span>
      <button onClick={() => onDismiss(toast.id)} className="shrink-0 text-slate-300 hover:text-slate-500">
        <XCircle size={15} />
      </button>
    </div>
  );
}

// MAYAR_PAYMENT_LINK, TIER_LABEL, PLAN_LEVEL: lihat ./lib/plans.js (satu
// sumber kebenaran, jangan definisi ulang di sini).

export default function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  // BUG FIX (6 Sep 2026): SEMUA modal/popup di app (draft AI, progress, cek
  // duplikat, tambah Deal/Visit, rekam meeting, kompetitor, recycle bin,
  // rapihin data, post Nex, dst) udah bisa "inget" & restore state-nya abis
  // app di-reload paksa (kejadian umum di HP - browser/OS suka buang tab
  // yang lagi di-background pas orang buka app lain kayak Telegram, terus
  // reload ulang diam-diam pas dibuka lagi). TAPI reload SELALU balikin tab
  // aktif ke "dashboard" - jadi kalau modal yang ke-restore itu punya tab
  // LAIN (Leads/Deal/Visit/Kompetitor/Komunitas/Pengaturan), dia restore
  // diem-diem di BALIK LAYAR (display:none), orangnya ngerasa "ilang" padahal
  // cuma ketutupan. MODAL_KIND_TAB di bawah nentuin tab yang bener buat
  // setiap jenis modal, biar landing LANGSUNG di situ.
  const [tab, setTab] = useState(() => {
    try {
      const modalRaw = localStorage.getItem("nexto-open-modal");
      if (modalRaw) {
        const parsed = JSON.parse(modalRaw);
        const stillValid = Date.now() - (parsed?.savedAt || 0) < 24 * 60 * 60 * 1000;
        if (stillValid) {
          const MODAL_KIND_TAB = {
            draft: (d) => d?.source,
            progress: () => "leads",
            dupcheck: () => "leads",
            leadinline: () => "leads",
            deal: () => "deal",
            visit: () => "visitfollowup",
            meetingrecorder: () => "visitfollowup",
            competitor: () => "kompetitor",
            nexpost: () => "komunitas",
            recyclebin: () => "settings",
            datacleanup: () => "settings",
          };
          const resolver = MODAL_KIND_TAB[parsed?.kind];
          const target = resolver ? resolver(parsed?.data) : null;
          if (target) return target;
        }
      }
      // Sama kasusnya sama kode /link Telegram (lihat Settings.jsx) - kalau
      // masih ada kode yang belum expired (<10 menit), landing langsung ke
      // tab Pengaturan biar keliatan, bukan ketutupan di Dashboard.
      const tgRaw = localStorage.getItem("nexto-telegram-link-code");
      if (tgRaw) {
        const tgParsed = JSON.parse(tgRaw);
        const tgStillValid = Date.now() - (tgParsed?.savedAt || 0) < 10 * 60 * 1000;
        if (tgStillValid && tgParsed?.code) return "settings";
      }
    } catch {}
    return "dashboard";
  });
  // Tab mana aja yang UDAH PERNAH dibuka minimal sekali - dipake bareng
  // React.lazy() di atas biar tab yang belum pernah disentuh beneran gak
  // nge-fetch chunk-nya sama sekali (bukan cuma disembunyiin CSS kayak yang
  // udah pernah dibuka). Sekali masuk sini, tab-nya nempel PERMANEN (gak
  // pernah dihapus lagi) - itu yang jaga proses async gak keputus pas
  // pindah tab, sama kayak alasan "SEMUA TAB SELALU KE-MOUNT" sebelumnya.
  const [visitedTabs, setVisitedTabs] = useState(() => new Set([tab]));
  useEffect(() => {
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, [tab]);
  const [stages, setStages] = useState([]);
  const [settings, setSettings] = useState({});
  const [leads, setLeads] = useState([]);
  const [dealTransactions, setDealTransactions] = useState([]);
  const [competitors, setCompetitors] = useState([]);
  const [org, setOrg] = useState(null);
  const [myRole, setMyRole] = useState(null);
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

  // BUG FIX (6 Sep 2026): LeadModal (lihat render-nya di paling bawah file
  // ini) itu overlay GLOBAL, gak kebungkus display:none per-tab - jadi begitu
  // di-restore, dia bakal langsung keliatan gak peduli tab mana yang aktif.
  // Nyimpen/restore-nya otomatis lewat effect ini, gak perlu ubah satu-satu
  // tempat yang manggil setEditLead (Dashboard/Deal/VisitFollowup/Advisor).
  // `restoredLeadRef` jaga-jaga race condition: effect "simpan" di bawah
  // jalan JUGA pas mount pertama (editLead masih null) - tanpa guard ini dia
  // bakal langsung clearOpenModal() dan ngewipe catetan localStorage SEBELUM
  // effect restore (yang nunggu `leads` selesai load) sempet baca sama sekali.
  const restoredLeadRef = useRef(false);
  useEffect(() => {
    if (editLead?.id) saveOpenModal("lead", { leadId: editLead.id });
    else if (restoredLeadRef.current) clearOpenModal("lead");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editLead?.id]);

  useEffect(() => {
    if (!leads || leads.length === 0) return;
    restoredLeadRef.current = true;
    if (editLead) return;
    const saved = getOpenModal("lead");
    if (saved?.leadId) {
      const lead = leads.find((l) => l.id === saved.leadId);
      if (lead) setEditLead(lead);
      else clearOpenModal("lead");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length > 0]);

  // BUG FIX (6 Sep 2026): posisi scroll juga ilang tiap reload paksa - user
  // yang lagi baca/edit di bagian bawah halaman balik ke paling atas lagi.
  // Diinget PER TAB (sessionStorage, otomatis ke-hapus kalau tab BENERAN
  // ditutup) - discroll dikit aja langsung ke-simpen (throttle via rAF),
  // dipulihin abis konten tab-nya beres di-render/loading kelar.
  useEffect(() => {
    let raf = null;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { saveScrollPos(tab, window.scrollY); raf = null; });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [tab]);

  useEffect(() => {
    if (loading) return;
    const y = getScrollPos(tab);
    if (y <= 0) return;
    // Konten tiap tab (chart Dashboard, tabel Leads, dst) sering masih
    // NAMBAH TINGGI abis `loading` App-level ini kelar (masing-masing tab
    // punya loading state internal sendiri) - sekali coba scrollTo doang
    // gampang ke-CLAMP ke tinggi halaman yang masih pendek saat itu. Coba
    // beberapa kali dalam ~1.2 detik biar kena momen yang kontennya udah
    // cukup tinggi.
    const attempts = [0, 60, 150, 300, 500, 800, 1200];
    const timers = attempts.map((ms) => setTimeout(() => window.scrollTo(0, y), ms));
    return () => timers.forEach(clearTimeout);
  }, [tab, loading]);

  // ---- TOAST STATE - lihat komentar di komponen Toast di atas ----
  const [toasts, setToasts] = useState([]);
  const pushToast = (text, type = "success") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((t) => [...t, { id, text, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 7000);
  };
  const dismissToast = (id) => setToasts((t) => t.filter((x) => x.id !== id));

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

      // Data profil (nama/jabatan/perusahaan/WA) yang diisi pas daftar tadi
      // gak bisa langsung disimpen kalau akun masih nunggu verifikasi email
      // (belum ada sesi = belum boleh nulis ke DB) - jadi ditaro dulu di
      // localStorage sama Auth.jsx. Begitu beneran login pertama kali (sesi
      // udah aktif, org udah kebentuk), terapkan sekali di sini terus hapus
      // biar gak ke-apply berkali-kali tiap reload().
      try {
        const pendingRaw = localStorage.getItem("nexto_pending_profile");
        if (pendingRaw) {
          const pending = JSON.parse(pendingRaw);
          await db.saveMyProfile({ name: pending.fullName, job_title: pending.jobTitle, whatsapp: pending.whatsapp });
          if (pending.companyName) { await db.setOrgName(pending.companyName); myOrg = await db.getMyOrg(); }
          localStorage.removeItem("nexto_pending_profile");
        } else {
          // Akun yang daftar/masuk lewat "Sign in with Google" gak lewat
          // form isi nama manual (gak ada nexto_pending_profile) - ambil
          // nama dari profil Google-nya sendiri, TAPI cuma kalau namanya
          // beneran masih kosong (biar gak numpuk nge-overwrite nama yang
          // udah pernah diganti manual sama user di Pengaturan).
          const googleName = session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.name;
          if (googleName) {
            const s = await db.getSettings().catch(() => null);
            if (!s?.community_display_name) await db.saveMyProfile({ name: googleName });
          }
        }
      } catch (e) { console.error("Gagal nerapin data profil dari signup:", e); }

      setOrg(myOrg);
      let [st, se, ls, comp, dt, role] = await Promise.all([db.getStages(), db.getSettings(), db.getLeads(), db.getCompetitors(), db.getDealTransactions(), db.getMyRole()]);
      setMyRole(role);
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

  // BUG FIX (10 Sep 2026, ketauan pas Nando lapor "gak bisa masuk" - dashboard
  // blank putih abis login): useState/useEffect ini SEBELUMNYA ditaro di
  // bawah sononya, SETELAH beberapa `if (...) return <Komponen/>` (early
  // return session/mfa/industry/adminops). Itu ngelanggar Rules of Hooks -
  // begitu session berubah dari null jadi ada isinya (org lain kata: user
  // BERHASIL login), komponen ini nge-render LEBIH JAUH dari sebelumnya
  // (baru nyampe hook ini), bikin JUMLAH HOOKS beda antar render -> React
  // nge-crash total (blank putih, gak ke-catch error boundary apapun).
  // Hooks WAJIB selalu dipanggil di urutan/jumlah yang SAMA tiap render,
  // jadi dipindah ke atas SINI, sebelum satu pun early return.
  const isEnterprise = org?.plan === "enterprise";
  const canManage = !!(org && session?.user?.id && org.owner_user_id === session.user.id) || myRole === "manager";
  const [orgMembers, setOrgMembers] = useState([]);
  useEffect(() => {
    if (!canManage) { setOrgMembers([]); return; }
    db.getOrgMembers().then(setOrgMembers).catch(() => setOrgMembers([]));
  }, [canManage]);

  // Tur interaktif fitur (18 Sep 2026, permintaan Nando: "tur ke semua tab
  // sesuai plan, kalau upgrade dapet tur baru buat tab yang baru kebuka
  // aja"). onboarding_level_seen nyimpen level TERTINGGI yang udah pernah
  // dikasih tur (null = belum pernah). SAMA KAYAK isEnterprise di atas -
  // hook ini HARUS di sini, sebelum early return manapun (lihat komentar
  // panjang di atas soal bug blank putih 10 Sep 2026) - myLevel dihitung
  // ULANG secara lokal (bukan pakai const myLevel di bawah situ, yang
  // sengaja ditaro setelah early return buat kebutuhan lain).
  const tourMyLevel = org?.plan === "enterprise" ? 2 : (PLAN_LEVEL[settings.plan] ?? 0);
  const onboardingCheckedRef = useRef(false);
  const [tourSteps, setTourSteps] = useState(null);
  useEffect(() => {
    if (loading || onboardingCheckedRef.current || !session) return;
    if (settings?.onboarding_level_seen === undefined) return;
    onboardingCheckedRef.current = true;
    const steps = buildTourSteps({ myLevel: tourMyLevel, isEnterprise, previousLevel: settings.onboarding_level_seen });
    if (steps.length > 0) setTourSteps(steps);
  }, [loading, settings, session, tourMyLevel, isEnterprise]);
  const finishTour = async () => {
    setTourSteps(null);
    try { await db.markOnboardingLevelSeen(tourMyLevel); } catch (e) { console.error("Gagal nyimpen status tur:", e); }
  };

  // Catat Cepat (21 Sep 2026, permintaan Nando) - histori pendekatan yang
  // udah dicoba & GAGAL sebelum yang sekarang:
  // 1. Manifest "shortcuts" (long-press icon HP kayak Android) - Safari iOS
  //    GAK DUKUNG SAMA SEKALI, gak ada workaround dari sisi web (dikonfirmasi
  //    lewat riset, bukan cuma dugaan).
  // 2. Icon KEDUA terpisah (Add to Home Screen ke /?quickvoice=1) - teknis
  //    jalan, tapi ribet buat user (install manual, App Store address bar,
  //    dst) dan Nando tetep gak berhasil pas dicoba.
  // 3. Tombol mengambang di dalam app - jalan, tapi Nando pengennya BUKAN
  //    "harus tap tombol", maunya OTOMATIS muncul pas buka app.
  // SEKARANG (final): deteksi app-nya lagi jalan sebagai HOME SCREEN APP
  // (mode standalone - ini yang kejadian tiap kali dibuka dari icon yang
  // di-"Add to Home Screen", BEDA dari dibuka lewat tab browser biasa) -
  // kalau iya, modal recorder OTOMATIS muncul tiap kali app dibuka, gak
  // perlu ?quickvoice=1 atau icon kedua apa-apa lagi. User tetep bisa nutup
  // modalnya (tombol X / klik luar) buat lanjut ke dashboard seperti biasa.
  // Query param ?quickvoice=1 TETEP didukung sebagai fallback manual (kalau
  // suatu saat perlu link langsung), tapi bukan jalur utama lagi.
  //
  // SAMA KAYAK hook tur di atas - HARUS di sini, sebelum early return
  // manapun, walau baru kepake buat user yang session-nya udah valid.
  const quickVoiceCheckedRef = useRef(false);
  const [quickVoiceOpen, setQuickVoiceOpen] = useState(false);
  useEffect(() => {
    if (loading || quickVoiceCheckedRef.current || !session) return;
    quickVoiceCheckedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const isStandaloneHomeScreenApp = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
    const viaQuickvoiceLink = params.get("quickvoice") === "1";
    if (!isStandaloneHomeScreenApp && !viaQuickvoiceLink) return;
    if (tourMyLevel >= 2) setQuickVoiceOpen(true);
    else if (viaQuickvoiceLink) alert("NEXto (voice) itu fitur khusus paket Professional ke atas. Upgrade dulu di tab Pengaturan Nexto.");
  }, [loading, session, tourMyLevel]);

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
  if (org && !org.industry) return <IndustryPicker onSelect={handlePickIndustry} busy={pickingIndustry} onLogout={() => supabase.auth.signOut()} />;

  // Dashboard Karyawan AI - FULLSCREEN TAKEOVER, terpisah dari layout biasa
  // (sidebar & topbar ilang sementara) biar berasa "masuk command center
  // sendiri", bukan cuma nempel jadi 1 tab isi konten biasa. Cuma nendang ke
  // sini kalau admin beneran pilih tab ini - selain itu app jalan normal.
  if (settings?.is_platform_admin && tab === "adminops") {
    return (
      <div className="h-screen overflow-y-auto bg-[#05070c]">
        <div
          className="pointer-events-none fixed inset-0 opacity-[0.35]"
          style={{
            backgroundImage: "linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage: "radial-gradient(circle at 50% 0%, rgba(0,0,0,.8), transparent 70%)",
            WebkitMaskImage: "radial-gradient(circle at 50% 0%, rgba(0,0,0,.8), transparent 70%)",
          }}
        />
        {/* h-screen + overflow-y-auto (bukan min-h-screen) - biar Command
            Center KEBUKA PENUH 1 LAYAR (permintaan Nando), scroll cuma jadi
            fallback kalau layarnya beneran pendek/di-zoom, bukan default. */}
        <div className="relative max-w-[1400px] mx-auto h-full flex flex-col px-4 py-3.5 md:px-8 md:py-5">
          <div className="grid grid-cols-3 items-center gap-3 mb-3.5 shrink-0">
            <button
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                setTab("dashboard");
              }}
              className="flex items-center gap-2 text-[12px] font-mono text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 rounded-xl px-3.5 py-2 transition-colors justify-self-start"
            >
              <ArrowLeft size={13} /> Kembali ke Workspace
            </button>
            <h1 className="justify-self-center font-mono text-[26px] md:text-[32px] font-bold uppercase tracking-[0.15em] text-white mt-2.5">
              Command Center
            </h1>
            <div className="flex items-center gap-2 justify-self-end">
              <NextoRobotHead size={26} />
              <NextoDarkWordmark width={62} />
            </div>
          </div>
          <Suspense fallback={<div className="text-sm text-slate-400 py-10 text-center">Memuat…</div>}>
            <AdminDashboard />
          </Suspense>
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
  const myLevel = org?.plan === "enterprise" ? 2 : (PLAN_LEVEL[settings.plan] ?? 0);
  const isPremium = myLevel >= 2; // dipake di beberapa tempat lain (banner upgrade, dst) - "premium" di sini = Professional

  // Tier yang dipilih user pas klik tombol pricing di landing page SEBELUM
  // daftar (lihat chooseTierAndSignup di Auth.jsx) - dipake buat personalisasi
  // banner upgrade di bawah, biar gak generic "Upgrade Professional" doang
  // walau yang dipilih orangnya Standard atau Enterprise.
  let intendedTierLabel = null;
  try {
    // BUG FIX (6 Sep 2026): begitu user BENERAN udah punya plan berbayar
    // (myLevel >= 1), flag "intended" dari sebelum checkout ini jadi BASI -
    // kejadian nyata: orang niatnya klik "Upgrade ke Professional" tapi pas
    // di halaman Mayar ternyata bayar Standard (lebih murah/tergoda diskon,
    // dll) - banner-nya masih ngotot bilang "kamu pilih Professional,
    // selesaiin pembayaran Professional" padahal Standard-nya udah AKTIF,
    // bikin bingung dikira gagal. Begitu ada plan aktif, buang flag ini -
    // biar banner balik ke pesan normal sesuai plan yang BENERAN dia punya.
    if (myLevel >= 1) {
      localStorage.removeItem("nexto_intended_plan");
    } else {
      const t = localStorage.getItem("nexto_intended_plan");
      intendedTierLabel = TIER_LABEL[t] || null;
    }
  } catch {}
  // Level minimal tiap tab: 0=Free, 1=Standard, 2=Professional.
  // Tab yang gak disebutin di sini otomatis level 0 (Free).
  const TAB_MIN_LEVEL = {
    settings: 1,
    // visitfollowup diturunin ke Standard (16 Sep 2026, permintaan Nando) -
    // isinya (Meeting Prep) sekarang fitur Standard. Fitur Professional+ di
    // dalam tab ini (Rekam Meeting, GPS Check-in Enterprise) tetep di-gate
    // sendiri-sendiri di dalam VisitFollowup.jsx, bukan lewat lock tab ini.
    // advisor diturunin ke Standard (16 Sep 2026, permintaan Nando) - daily
    // digest (backend) emang udah lama ngelayanin Standard+ juga, tab
    // Advisor-nya doang yang ketinggalan masih di-lock Professional.
    generateleads: 2, deal: 2, visitfollowup: 1, kompetitor: 2, advisor: 1,
  };

  const stageList = stages.length ? stages : [{ key: "prospek", label: "Prospek", hex: "#94a3b8", type: "normal" }];


  const effectiveTab = tab;
  const isLocked = (key) => !loading && myLevel < (TAB_MIN_LEVEL[key] ?? 0);
  // Menu admin cuma nempel di daftar nav kalau akun ini beneran admin platform.
  // Customer biasa (99.9% user) gak akan pernah liat item ini nongol sama sekali.
  const navItems = settings?.is_platform_admin ? [...NAV, ADMIN_NAV_ITEM] : NAV;

  return (
    <div className="nexto-app min-h-screen text-slate-900 flex overflow-x-hidden">
      <style>{`
        .nexto-app {
          --nexto-ink: #0b1020;
          --nexto-muted: #64748b;
          --nexto-line: rgba(148,163,184,.18);
          --nexto-orange: #f97316;
          --nexto-purple: #6d5dfc;
          --nexto-blue: #3b82f6;
          --nexto-sidebar: #0b1220;
          --nexto-panel: rgba(255,255,255,.82);
          /* Panel "melayang" (16 Sep 2026, permintaan Nando, niru referensi
             Cortex) - sidebar & panel konten gak nempel mentok ke tepi layar
             lagi di desktop, ada jarak tipis di celahnya. Warna dasarnya
             TETEP #f7f8fc (warna dasar Nexto yang udah ada), cuma ditambah
             glow oranye/violet samar - bukan diganti gelap kayak referensi. */
          background:
            radial-gradient(circle at 12% 0%, rgba(109,93,252,.06), transparent 38%),
            radial-gradient(circle at 88% 100%, rgba(249,115,22,.05), transparent 42%),
            #f7f8fc;
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
            radial-gradient(circle at 20% 0%, rgba(109,93,252,.16), transparent 30%),
            linear-gradient(180deg, #0b1220 0%, #080d18 100%);
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
          background: linear-gradient(135deg, #5b5cf6 0%, #7c4dff 100%);
          box-shadow: 0 12px 28px -15px rgba(91,92,246,.9);
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
            radial-gradient(circle at 78% 2%, rgba(109,93,252,.08), transparent 24%),
            radial-gradient(circle at 20% 18%, rgba(99,102,241,.045), transparent 20%);
        }
        .nexto-app button, .nexto-app input, .nexto-app textarea, .nexto-app select {
          font-family: inherit;
        }
        .nexto-app ::selection {
          background: rgba(109,93,252,.18);
        }
        .nexto-app .nexto-nav-item:not(.nexto-nav-active) {
          border: 1px solid transparent;
        }
        .nexto-app .nexto-nav-item:not(.nexto-nav-active):hover {
          background: rgba(255,255,255,.055);
          border-color: rgba(255,255,255,.04);
        }
        .nexto-app main {
          scrollbar-width: thin;
          scrollbar-color: rgba(100,116,139,.25) transparent;
        }

        @media (max-width: 767px) {
          .nexto-app .nexto-content-glow {
            background: radial-gradient(circle at 80% 0%, rgba(109,93,252,.07), transparent 30%);
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

      {/* ---- TOAST CONTAINER - fixed di atas semua tab, gak ikut kepengaruh mount/unmount tab manapun ---- */}
      {toasts.length > 0 && (
        <div className="fixed z-[1200] top-4 inset-x-0 flex flex-col items-center gap-2 px-4 pointer-events-none md:top-5 md:right-5 md:left-auto md:items-end">
          {toasts.map((t) => <Toast key={t.id} toast={t} onDismiss={dismissToast} />)}
        </div>
      )}

      {/* DESKTOP SIDEBAR - panel melayang (16 Sep 2026), rounded penuh +
          inset dari tepi layar, ganti border-r doang jadi border keliling
          biar konsisten sama bentuk panel yang gak nempel ke sisi manapun. */}
      <aside className="nexto-sidebar hidden md:flex flex-col w-[228px] fixed top-3 left-3 h-[calc(100vh-24px)] z-30 text-white rounded-[28px] overflow-hidden border border-white/[0.07] shadow-[0_30px_70px_-35px_rgba(0,0,0,.7)]">
        {/* Header sidebar (16 Sep 2026): profil + badge plan DIPINDAH ke
            bawah (pola app pada umumnya - Slack/Notion dst naro profil di
            footer sidebar, bukan header). Header sekarang logo doang. */}
        <div className="px-4 pt-5 pb-4">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3.5 shadow-[0_14px_35px_-25px_rgba(0,0,0,.8)]">
            <div className="flex items-center gap-2.5">
              <NextoRobotHead size={30} />
              <NextoDarkWordmark width={70} />
            </div>
            {(settings?.is_platform_admin || org?.industry) && (
              <div className="pl-[38px] mt-2 flex items-center gap-1.5 flex-wrap min-w-0">
                {settings?.is_platform_admin ? (
                  <IndustryDemoSwitcher org={org} onSwitched={reload} />
                ) : (
                  org?.industry && (
                    // Warna & ukuran disamain sama badge plan di footer sidebar
                    // (16 Sep 2026, permintaan Nando) - biar 2 badge ini kerasa
                    // 1 bahasa visual, bukan 2 gaya beda sendiri-sendiri.
                    <span className="inline-block text-[7px] font-semibold uppercase tracking-wide text-slate-300 bg-white/8 ring-1 ring-white/10 rounded-full px-1.5 py-0.5 truncate max-w-full">
                      {getIndustryTemplate(org.industry).label}
                    </span>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mx-4 mb-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <nav className="flex-1 px-3 py-2.5 space-y-1 overflow-y-auto">
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
                data-tour-nav={n.key}
                onClick={() => {
                  // Command Center itu "fullscreen takeover" - minta browser
                  // masuk mode fullscreen beneran (nutupin tab/address bar),
                  // bukan cuma penuh di dalam viewport halaman. HARUS dipanggil
                  // langsung di dalam klik ini (user gesture) - kalau ditunda
                  // sedikit pun browser nolak permintaannya.
                  if (n.key === "adminops" && document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                  }
                  setTab(n.key);
                }}
                className={`nexto-nav-item relative w-full flex items-center gap-3 px-3 py-2.5 rounded-[12px] text-[12.5px] ${cls}`}
              >
                {active && !locked && !n.special && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-white/90" />}
                <I size={17} strokeWidth={active ? 2.4 : 1.9} />
                <span className="flex-1 text-left">{n.label}</span>
                {locked && <Lock size={12} className="shrink-0 text-slate-600" />}
              </button>
            );
          })}
        </nav>

        {/* Profil di footer sidebar (16 Sep 2026, permintaan Nando) - pola
            app pada umumnya (Slack/Notion dst). Klik di mana aja di baris
            ini (bukan cuma lingkaran avatar - lihat prop expanded di
            ProfileAvatar) buka popup profil, dan tombol "Keluar" ada DI
            DALAM popup itu (di bawah "Edit Profil"), bukan tombol terpisah
            di sidebar lagi. */}
        <div className="px-3 pb-3 pt-2 border-t border-white/[0.06]">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05] px-2.5 py-2.5 transition-colors">
            <ProfileAvatar settings={settings} session={session} org={org} onChanged={reload} size={36} align="left" expanded />
          </div>
        </div>
      </aside>

      {/* Panel konten juga jadi "melayang" di desktop (16 Sep 2026) - margin
          252px kiri (228px lebar sidebar + 12px inset kiri sidebar + 12px
          gap ke panel ini), plus jarak atas/kanan/bawah biar backdrop
          .nexto-app (tetep terang, cuma ditambah glow tipis) keliatan di
          celahnya. bg-[#f7f8fc] eksplisit di sini biar warnanya presisi
          sama walau nanti .nexto-app di-tweak lagi. */}
      <div className="flex-1 min-w-0 flex flex-col relative nexto-content-glow bg-[#f7f8fc] md:ml-[252px] md:mr-3 md:my-3 md:rounded-[28px] md:overflow-hidden md:shadow-[0_30px_70px_-35px_rgba(0,0,0,.5)]">
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
            <NotificationBell onNavigate={setTab} />
            <ProfileAvatar settings={settings} session={session} org={org} onChanged={reload} size={34} />
          </div>
        </header>

        {/* DESKTOP TOPBAR */}
        <header className="hidden md:flex sticky top-0 z-20 h-[64px] items-center justify-between border-b border-slate-200/60 bg-white/78 px-6 lg:px-8 backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            {/* Dibalikin persis kayak sebelumnya (16 Sep 2026, permintaan
                Nando) - sempet dihapus terus header-nya keliatan sepi/kosong. */}
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
            <NotificationBell onNavigate={setTab} />
          </div>
        </header>

        <main className="relative z-10 flex-1 w-full max-w-[1440px] mx-auto px-4 py-5 md:px-7 md:py-6 lg:px-9 pb-32">
          {/* Banner ini cuma buat user Free - begitu udah bayar (Standard ke
              atas), gak perlu terus dipajang gede di ATAS SETIAP TAB (dulu
              nongol truss walau udah jadi pelanggan bayar, kesannya maksa).
              Upgrade CTA buat Standard/Professional dipindah ke tab
              Pengaturan aja - orang yang emang mau upgrade pasti nyari ke
              situ, gak perlu dipaksa liat tiap buka app.
              BUG FIX (17 Sep 2026, ketauan Nando manual): kondisi di atas gak
              pernah SUNGGUHAN nyembunyiin banner ini pas lagi di tab
              Pengaturan - jadi banner "Upgrade Professional" ini numpuk di
              atas banner "Mode lihat-lihat" punya PreviewLock (yang nawarin
              "Upgrade ke Standard") - dua CTA beda tier, kesannya berantakan/
              tumpang tindih. Sekarang di-skip eksplisit pas effectiveTab ===
              "settings", karena tab itu udah punya CTA upgrade sendiri. */}
          {!loading && myLevel < 1 && effectiveTab !== "settings" && (
            <div className="mb-5 overflow-hidden rounded-[20px] border border-orange-200/70 bg-gradient-to-r from-orange-50 via-white to-orange-50/60 shadow-[0_12px_35px_-25px_rgba(249,115,22,.45)]">
              <div className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center md:justify-between md:px-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                    <Sparkles size={15} />
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-slate-800">
                      {intendedTierLabel ? `Anda pilih paket ${intendedTierLabel}` : myLevel === 1 ? "Anda sedang memakai Nexto Standard" : "Anda sedang memakai Nexto Free"}
                    </div>
                    <div className="mt-0.5 text-[10px] leading-4 text-slate-500">
                      {intendedTierLabel
                        ? `Akunmu udah jadi - tinggal selesaiin pembayaran ${intendedTierLabel}. Pastikan pakai email yang sama persis (${session?.user?.email || "email akun ini"}) pas bayar di Mayar.`
                        : myLevel === 1
                        ? "Leads & Komunitas aktif. Upgrade ke Professional untuk membuka AI, Deal, Visit, Calendar, dan automation."
                        : "Dashboard, Leads, & Komunitas aktif. Upgrade untuk membuka AI, Deal, Visit, Calendar, dan automation."}
                    </div>
                  </div>
                </div>
                <a href={MAYAR_PAYMENT_LINK} target="_blank" rel="noreferrer" className="shrink-0 rounded-xl bg-slate-950 px-4 py-2 text-center text-[11px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(15,23,42,.7)] hover:bg-slate-800">
                  {intendedTierLabel ? `Bayar ${intendedTierLabel} →` : "Upgrade Professional →"}
                </a>
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
              {/* ---- SEMUA TAB SELALU KE-MOUNT (lihat komentar KEEP_MOUNTED_TABS
                  di atas) - disembunyiin pake CSS display:none, BUKAN di-unmount.
                  Ini biar proses async apapun (generate leads, draft follow-up AI,
                  rekam meeting, dst) yang lagi jalan di tab manapun GAK KEPUTUS
                  cuma gara-gara user pindah tab pas nungguin. ---- */}
              <div style={{ display: effectiveTab === "dashboard" ? "block" : "none" }}>
                <Dashboard leads={leads} stages={stageList} dealTransactions={dealTransactions} settings={settings} onGo={setTab} onOpenLead={setEditLead} myLevel={myLevel} onChanged={reload} isEnterprise={isEnterprise} canManage={canManage} />
              </div>
              <div style={{ display: effectiveTab === "leads" ? "block" : "none" }}>
                <Leads leads={leads} stages={stageList} settings={settings} industry={org?.industry} customFieldLabels={org?.custom_field_labels} myLevel={myLevel} onChanged={reload} canManage={canManage} isEnterprise={isEnterprise} />
              </div>
              <Suspense fallback={<div className="text-sm text-slate-400 py-16 text-center">Memuat…</div>}>
                {visitedTabs.has("generateleads") && (
                  <div style={{ display: effectiveTab === "generateleads" ? "block" : "none" }}>
                    <PreviewLock locked={isLocked("generateleads")} minLevel={TAB_MIN_LEVEL.generateleads}>
                      <GenerateLeads stages={stageList} industry={org?.industry} onChanged={reload} onNotify={pushToast} />
                    </PreviewLock>
                  </div>
                )}
                {visitedTabs.has("deal") && (
                  <div style={{ display: effectiveTab === "deal" ? "block" : "none" }}>
                    <PreviewLock locked={isLocked("deal")} minLevel={TAB_MIN_LEVEL.deal}>
                      <Deal leads={isLocked("deal") ? DUMMY_LEADS : leads} stages={stageList} dealTransactions={isLocked("deal") ? DUMMY_DEAL_TX : dealTransactions} industry={org?.industry} onEdit={setEditLead} onChanged={reload} />
                    </PreviewLock>
                  </div>
                )}
                {visitedTabs.has("visitfollowup") && (
                  <div style={{ display: effectiveTab === "visitfollowup" ? "block" : "none" }}>
                    <PreviewLock locked={isLocked("visitfollowup")} minLevel={TAB_MIN_LEVEL.visitfollowup}>
                      <VisitFollowup leads={isLocked("visitfollowup") ? DUMMY_LEADS : leads} onEdit={setEditLead} onChanged={reload} onNotify={pushToast} isEnterprise={org?.plan === "enterprise"} myLevel={myLevel} />
                    </PreviewLock>
                  </div>
                )}
                {visitedTabs.has("kompetitor") && (
                  <div style={{ display: effectiveTab === "kompetitor" ? "block" : "none" }}>
                    <PreviewLock locked={isLocked("kompetitor")} minLevel={TAB_MIN_LEVEL.kompetitor}>
                      <Kompetitor competitors={isLocked("kompetitor") ? DUMMY_COMPETITORS : competitors} onChanged={reload} />
                    </PreviewLock>
                  </div>
                )}
                {visitedTabs.has("komunitas") && (
                  <div style={{ display: effectiveTab === "komunitas" ? "block" : "none" }}>
                    <PreviewLock locked={isLocked("komunitas")} minLevel={TAB_MIN_LEVEL.komunitas}>
                      <Nex dummy={isLocked("komunitas")} settings={settings} />
                    </PreviewLock>
                  </div>
                )}
                {visitedTabs.has("advisor") && (
                  <div style={{ display: effectiveTab === "advisor" ? "block" : "none" }}>
                    <PreviewLock locked={isLocked("advisor")} minLevel={TAB_MIN_LEVEL.advisor}>
                      <Advisor leads={isLocked("advisor") ? DUMMY_LEADS : leads} stages={stageList} onOpen={setEditLead} dummy={isLocked("advisor")} />
                    </PreviewLock>
                  </div>
                )}
                {visitedTabs.has("industridemo") && (
                  <div style={{ display: effectiveTab === "industridemo" ? "block" : "none" }}>
                    <IndustryDemo />
                  </div>
                )}
              </Suspense>
              <div style={{ display: effectiveTab === "settings" ? "block" : "none" }}>
                {/* Settings.jsx ngurus lock-nya SENDIRI di dalem (bukan
                    dibungkus PreviewLock di sini kayak tab lain) - biar aksi
                    akun universal (ganti password, export, keluar, hapus
                    akun) TETEP bisa dipake SEMUA plan, gak ikut ketutup
                    overlay generic yang dulu nutup SELURUH tab termasuk
                    tombol-tombol itu (bug: user Free gak bisa hapus akun
                    sendiri sama sekali). */}
                <SettingsTab settings={settings} stages={stageList} leads={leads} onChanged={reload} userEmail={session?.user?.email} locked={isLocked("settings")} />
              </div>
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
                <button
                  key={n.key}
                  data-tour-nav={n.key}
                  onClick={() => {
                    if (n.key === "adminops" && document.documentElement.requestFullscreen) {
                      document.documentElement.requestFullscreen().catch(() => {});
                    }
                    setTab(n.key);
                  }}
                  className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 transition-colors ${cls}`}
                >
                  <I size={18} strokeWidth={active ? 2.5 : 1.9} />
                  <span className="mt-0.5 max-w-full truncate text-[8px] font-medium leading-none">{n.short}</span>
                  {locked && <Lock size={8} className="absolute right-2 top-0.5" />}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {editLead && <LeadModal lead={editLead} stages={stageList} settings={settings} industry={org?.industry} myLevel={myLevel} onClose={() => setEditLead(null)} onSaved={() => { setEditLead(null); reload(); }} canManage={canManage} isEnterprise={isEnterprise} members={orgMembers} myUid={session?.user?.id} />}

      {/* Tombol mengambang NEXto (21-22 Sep 2026, permintaan Nando) -
          alternatif dari shortcut icon HP (gak bisa diandelin di iPhone,
          Safari sama sekali gak dukung "app shortcuts" buat web app - lihat
          diskusi di atas). Ini versi yang PASTI jalan di semua device, gak
          perlu install/Add to Home Screen apa-apa. SENGAJA cuma nongol di
          tab Dashboard (bukan di semua tab kayak sebelumnya, permintaan
          Nando 22 Sep 2026) - biar gak numpuk sama konten/tombol tab lain.
          Ditaro di ATAS bottom nav mobile (yang fixed bottom-3) biar gak
          numpuk sama itu juga. */}
      {!editLead && !tourSteps && !quickVoiceOpen && myLevel >= 2 && effectiveTab === "dashboard" && (
        <div className="fixed z-40 bottom-24 right-4 md:bottom-6 md:right-6 w-14 h-14">
          {/* Ring sonar halus - echo dari animasi idle di dalem modal
              NEXto sendiri, biar tombolnya kerasa "hidup" (bukan icon
              statis doang) dan nunjukin ini fitur AI, bukan tombol biasa. */}
          <span className="absolute inset-0 rounded-full bg-orange-500/40 animate-ping" style={{ animationDuration: "2.4s" }} />
          <button
            onClick={() => setQuickVoiceOpen(true)}
            className="relative w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 via-orange-600 to-violet-600 text-white flex items-center justify-center shadow-[0_12px_32px_-6px_rgba(234,88,12,.65)] hover:shadow-[0_14px_38px_-4px_rgba(167,139,250,.55)] transition-shadow"
            aria-label="NEXto"
            title="NEXto - voice note ke progress"
          >
            <Mic size={22} />
          </button>
        </div>
      )}
      {tourSteps && (
        <AppTour steps={tourSteps} onNavigate={(key) => setTab(key)} onFinish={finishTour} />
      )}
      {quickVoiceOpen && (
        <QuickVoiceNoteModal leads={leads} stages={stageList} settings={settings} onClose={() => setQuickVoiceOpen(false)} onSaved={() => { setQuickVoiceOpen(false); reload(); }} />
      )}
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
      {/* Warna & ukuran disamain sama badge plan/industri lain (16 Sep
          2026, permintaan Nando) - sebelumnya oranye sendiri, sekarang
          netral putih biar 1 bahasa visual. */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-[7px] font-semibold uppercase tracking-wide text-slate-300 bg-white/8 ring-1 ring-white/10 hover:bg-white/[0.12] rounded-full px-1.5 py-0.5 truncate max-w-full transition-colors"
        title="Mode demo - khusus admin, ganti industri buat pitching"
      >
        {current ? getIndustryTemplate(current).label : "Pilih industri"}
        <span className="text-slate-400">▾</span>
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
function ProfileAvatar({ settings, session, org, onChanged, size = 36, align = "right", className = "", expanded = false }) {
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
    ? { label: "Professional", cls: "bg-orange-100 text-orange-700" }
    : settings.plan === "standard"
    ? { label: "Standard", cls: "bg-sky-100 text-sky-700" }
    : { label: "Free", cls: "bg-slate-100 text-slate-500" };

  // BUG FIX (16 Sep 2026, ketauan pas trigger-nya dipindah ke footer
  // sidebar): sebelumnya SELALU buka ke BAWAH tombol (rect.bottom + 10).
  // Aman selama trigger-nya di header/topbar (deket atas layar), tapi begitu
  // trigger-nya di paling BAWAH sidebar, kartu ke-dorong ke luar viewport
  // (invisible) - yang keliatan cuma overlay gelapnya doang. Sekarang cek
  // dulu ruang di bawah cukup apa nggak, kalau enggak buka ke ATAS tombol.
  const CARD_EST_HEIGHT = 280;
  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const rawLeft = align === "left" ? rect.left : rect.right - CARD_WIDTH;
      const clampedLeft = Math.max(12, Math.min(rawLeft, window.innerWidth - CARD_WIDTH - 12));
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow < CARD_EST_HEIGHT
        ? Math.max(12, rect.top - CARD_EST_HEIGHT - 10)
        : rect.bottom + 10;
      setPos({ top, left: clampedLeft });
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
              {/* Keluar dipindah ke DALAM kartu profil ini (16 Sep 2026,
                  permintaan Nando) - sebelumnya tombol terpisah di footer
                  sidebar, sekarang jadi bagian dari popup profil. */}
              <button onClick={() => supabase.auth.signOut()} className="w-full mt-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl py-2.5 font-medium transition-colors flex items-center justify-center gap-1.5"><LogOut size={13} /> Keluar</button>
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

  // "expanded" (16 Sep 2026) - dipake di footer sidebar biar SELURUH baris
  // (avatar + nama + email) jadi 1 tombol yang buka popup profil, bukan
  // cuma lingkaran avatar-nya doang. Default (expanded=false) tetep persis
  // kayak sebelumnya (cuma lingkaran avatar) - dipake di tempat lain
  // (topbar mobile, dst).
  const avatarImg = settings.avatar_url ? <img src={settings.avatar_url} alt="" className="w-full h-full object-cover" /> : initial;
  // Badge plan versi dark-sidebar (16 Sep 2026, permintaan Nando: "gua mau
  // ada badge plan kyk standard, professional dll" di trigger footer -
  // sebelumnya badge planInfo cuma keliatan di DALAM popup kartu profil,
  // gak kelihatan di baris avatar utama sidebar). Warna beda dari planInfo
  // (yang dibikin buat kartu putih) karena background trigger ini gelap.
  // Warna disamain netral putih buat SEMUA tier (16 Sep 2026, permintaan
  // Nando: "jangan terlalu mencolok... putih biar clean rapih") - sebelumnya
  // tiap tier punya warna sendiri (violet/orange/sky), kesannya rame di
  // trigger kecil kayak gini. Sekarang cuma bedain teksnya doang.
  const planBadgeDark = {
    label: org?.plan === "enterprise" ? "Enterprise" : settings.plan === "premium" ? "Professional" : settings.plan === "standard" ? "Standard" : "Free",
    cls: "bg-white/8 text-slate-300 ring-1 ring-white/10",
  };

  return (
    <div className={`relative ${className}`}>
      {expanded ? (
        <button ref={btnRef} onClick={toggleOpen} className="w-full flex items-center gap-2.5 text-left">
          <span className="shrink-0 rounded-full overflow-hidden ring-2 ring-white/40 bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center font-semibold shadow-[0_2px_8px_-1px_rgba(0,0,0,0.3)]" style={{ width: size, height: size, fontSize: size * 0.4 }}>
            {avatarImg}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-white">{settings.community_display_name || "Akun Anda"}</span>
            {/* Subtitle diganti dari "Industri / Jabatan" jadi badge plan
                (16 Sep 2026, permintaan Nando: "hapus aja industrinya ganti
                dengan bedge plan") - lebih kepake buat cepet liat plan
                lu tanpa buka popup profil. */}
            <span className={`inline-block mt-0.5 text-[7px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${planBadgeDark.cls}`}>{planBadgeDark.label}</span>
          </span>
        </button>
      ) : (
        <button ref={btnRef} onClick={toggleOpen} className="shrink-0 rounded-full overflow-hidden ring-2 ring-white/40 bg-gradient-to-br from-orange-400 to-orange-700 text-white flex items-center justify-center font-semibold shadow-[0_2px_8px_-1px_rgba(0,0,0,0.3)]" style={{ width: size, height: size, fontSize: size * 0.4 }}>
          {avatarImg}
        </button>
      )}
      {open && createPortal(card, document.body)}
    </div>
  );
}

// Notif in-app (bell) - sumbernya sekarang cuma GPS check-in (owner/manager
// dapet notif pas sales rep check-in ke lokasi customer, lihat notify-checkin
// edge function + db.checkIn()), makanya cuma dirender buat org Enterprise -
// gak ada gunanya nampilin lonceng kosong buat tier yang gak punya fitur ini.
// Polling tiap 45 detik (bukan realtime) - simpel, cukup buat kebutuhan
// "keliatan gak lama-lama amat abis kejadian", gak perlu websocket buat ini.
function NotificationBell({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const CARD_WIDTH = 340;

  // BUG FIX (11 Sep 2026): dulu bell ini SELURUHNYA disembunyiin buat akun
  // non-Enterprise (`if (!isEnterprise) return null`) - masuk akal waktu
  // itu karena satu-satunya notifikasi yang ada (check-in GPS) emang
  // Enterprise-only. Sekarang ada notifikasi lain yang berlaku buat
  // Professional ke atas juga (Pipeline Review), jadi gerbang Enterprise
  // itu keliru - bell sekarang selalu tampil, kosong aja kalau emang gak
  // ada notifikasi buat plan itu.
  useEffect(() => {
    const refresh = () => db.getUnreadNotificationCount().then(setUnread).catch(() => {});
    refresh();
    const id = setInterval(refresh, 45000);
    return () => clearInterval(id);
  }, []);

  const toggleOpen = () => {
    if (!open) {
      db.getMyNotifications(20).then(setItems).catch(() => {});
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        const rawLeft = rect.right - CARD_WIDTH;
        const clampedLeft = Math.max(12, Math.min(rawLeft, window.innerWidth - CARD_WIDTH - 12));
        setPos({ top: rect.bottom + 10, left: clampedLeft });
      }
    }
    setOpen((v) => !v);
  };

  const openItem = (n) => {
    if (!n.read_at) {
      db.markNotificationRead(n.id).catch(() => {});
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.link_tab) onNavigate?.(n.link_tab);
  };

  const markAll = () => {
    db.markAllNotificationsRead().catch(() => {});
    setItems((prev) => prev.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
    setUnread(0);
  };

  const card = (
    <>
      <div className="fixed inset-0 z-[999]" onClick={() => setOpen(false)} />
      <div
        className="fixed w-[340px] max-w-[calc(100vw-1.5rem)] bg-white rounded-[24px] shadow-[0_16px_40px_-8px_rgba(15,23,42,0.25)] z-[1000] overflow-hidden border border-slate-100 max-h-[70vh] flex flex-col"
        style={{ top: pos.top, left: pos.left }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <span className="font-bold text-sm">Notifikasi</span>
          {items.some((n) => !n.read_at) && (
            <button onClick={markAll} className="text-[11px] text-orange-600 hover:underline font-medium">Tandai semua dibaca</button>
          )}
        </div>
        <div className="overflow-y-auto flex-1">
          {items.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-10">Belum ada notifikasi.</div>
          ) : (
            items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)} className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 flex gap-3 ${!n.read_at ? "bg-orange-50/60" : ""}`}>
                {n.photo_url && <img src={n.photo_url} alt="" className="w-11 h-11 rounded-xl object-cover shrink-0 border border-slate-200" />}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800 line-clamp-2">{n.title}</div>
                  {n.body && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>}
                  <div className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                {!n.read_at && <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0 mt-1.5" />}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="relative">
      <button ref={btnRef} onClick={toggleOpen} className="relative shrink-0 w-9 h-9 rounded-full border border-slate-200/80 bg-white/75 flex items-center justify-center text-slate-500 hover:text-orange-600 hover:border-orange-200 shadow-sm transition-colors">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">{unread > 9 ? "9+" : unread}</span>
        )}
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
  // "totp" = kode 6 digit biasa dari app authenticator. "recovery" = jalur
  // darurat kalau HP/app authenticator-nya ilang - liat mfa-recovery Edge
  // Function buat detail cara kerjanya (nambal celah "terkunci permanen").
  const [mode, setMode] = useState("totp");

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

  const verifyRecovery = async () => {
    if (!code.trim()) { setErr("Masukin kode recovery-nya (format XXXX-XXXX)."); return; }
    setBusy(true); setErr("");
    try {
      const { data, error } = await supabase.functions.invoke("mfa-recovery", { body: { action: "verify", code: code.trim() } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // 2FA baru aja dimatiin di server + sesi lama ke-invalidate (efek
      // bawaan hapus factor) - paksa login ulang dari nol biar bersih,
      // jangan coba lanjut pake sesi yang mungkin udah setengah revoked.
      await supabase.auth.signOut();
      window.location.reload();
    } catch (e) {
      setErr("Kode recovery salah/gagal: " + e.message);
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
          <p className="text-sm text-slate-500 mt-1">
            {mode === "totp" ? "Masukin kode 6 digit dari app authenticator Anda." : "Masukin salah satu kode recovery yang Anda simpan pas aktifin 2FA."}
          </p>
        </div>
        {mode === "totp" ? (
          <input
            className="w-full mt-5 px-3 py-3 text-center text-xl tracking-[0.4em] font-mono border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
            placeholder="000000"
            maxLength={6}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && verify()}
          />
        ) : (
          <input
            className="w-full mt-5 px-3 py-3 text-center text-base tracking-[0.15em] font-mono uppercase border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && verifyRecovery()}
          />
        )}
        {err && <div className="mt-3 text-xs bg-rose-50 text-rose-700 rounded-lg p-2.5">{err}</div>}
        {mode === "totp" ? (
          <button onClick={verify} disabled={busy || code.length !== 6} className="w-full mt-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Verifikasi
          </button>
        ) : (
          <button onClick={verifyRecovery} disabled={busy || !code.trim()} className="w-full mt-4 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm py-3 rounded-xl font-semibold flex items-center justify-center gap-1.5">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} Pakai Kode Recovery
          </button>
        )}
        <button
          onClick={() => { setMode(mode === "totp" ? "recovery" : "totp"); setCode(""); setErr(""); }}
          className="w-full mt-2 text-xs text-orange-600 hover:text-orange-700 py-1.5 font-medium"
        >
          {mode === "totp" ? "HP hilang? Pakai kode recovery" : "Punya akses ke app authenticator? Pakai kode 6 digit"}
        </button>
        <button onClick={onCancel} className="w-full mt-1 text-xs text-slate-400 hover:text-slate-600 py-2">
          Bukan Anda? Ganti akun
        </button>
      </div>
    </div>
  );
}

function Splash({ inline }) {
  return (
    <div className={`${inline ? "py-20" : "min-h-screen"} bg-slate-50 flex flex-col items-center justify-center gap-3`}>
      <div className="animate-pulse"><NextoRobotHead size={48} status="thinking" /></div>
      <div className="text-slate-400 text-sm flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Memuat…</div>
    </div>
  );
}
