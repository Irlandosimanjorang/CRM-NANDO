import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import LegalModal from "./components/LegalModal";
import SupportChatWidget from "./components/SupportChatWidget";
import {
  Loader2,
  ArrowRight,
  Check,
  ChevronDown,
  Sparkles,
  BrainCircuit,
  TrendingUp,
  Calendar,
  Mic,
  Users,
  Zap,
  CircleCheck,
  AlertTriangle,
  Play,
  X,
  Bot,
  Pencil,
  CheckCircle2,  MessageCircle,
  Database,
  Layers,
  Volume2,
  ShieldCheck,
  Lock,
  History,
  Radar,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Klip suara robot buat landing page - STATIS, di-generate SEKALI aja lewat
// Edge Function generate-landing-audio (bukan tiap pengunjung buka web),
// jadi gak ada biaya AI berulang. URL ini deterministik dari pola public
// bucket Supabase (bucket morning-audio, folder landing/).
const LANDING_AUDIO_BASE = "https://cewggulyfshnbebcpyui.supabase.co/storage/v1/object/public/morning-audio/landing";
const ROBOT_CHATBOT_AUDIO = `${LANDING_AUDIO_BASE}/robot-chatbot.mp3`;
const ROBOT_ENGINE_LOOP_AUDIO = `${LANDING_AUDIO_BASE}/robot-engine-loop.mp3`;

// Nomor WhatsApp support Nexto - satu tempat doang, gampang diganti kalau
// suatu saat nomornya berubah.
const SUPPORT_WA_NUMBER = "6281273059284";

// Hook kecil buat tombol "Dengerin" robot - play sekali klik, gak ada
// autoplay (etika landing page publik: jangan maksa suara ke pengunjung
// asing tanpa diminta).
function useRobotVoice(src) {
  const [speaking, setSpeaking] = useState(false);
  // play() bisa dikasih callback onEnded - dipake buat nyambungin robot
  // berikutnya begitu robot ini selesai ngomong (auto-play berantai).
  const play = (onEnded) => {
    if (speaking) return;
    const audio = new Audio(src);
    audio.addEventListener("ended", () => { setSpeaking(false); onEnded && onEnded(); });
    audio.addEventListener("error", () => { setSpeaking(false); onEnded && onEnded(); });
    audio.play().then(() => setSpeaking(true)).catch(() => { setSpeaking(false); onEnded && onEnded(); });
  };
  return { speaking, play };
}
const NEXTO_LOGO_SRC = "/nexto-logo.png";

function NextoWordmark({ width = 108, className = "" }) {
  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width, lineHeight: 0 }}
      aria-label="Nexto"
      role="img"
    >
      {/* Lapisan dasar: paksa semua huruf jadi hitam */}
      <img
        src={NEXTO_LOGO_SRC}
        alt=""
        aria-hidden="true"
        className="block h-auto w-full object-contain"
        style={{ filter: "brightness(0) contrast(1.12) drop-shadow(0 1px 1px rgba(15,23,42,.08))" }}
      />
      {/* Lapisan overlay: cuma buat huruf X-nya, tetep oranye */}
      <img
        src={NEXTO_LOGO_SRC}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full object-contain"
        style={{
          clipPath: "polygon(39% 0%, 61% 0%, 61% 100%, 39% 100%)",
          WebkitClipPath: "polygon(39% 0%, 61% 0%, 61% 100%, 39% 100%)",
        }}
      />
    </div>
  );
}

// Warna visor per status - "idle" (oranye, brand default) dipake di mana pun
// robot ini cuma jadi logo/mascot biasa. "thinking" (ungu) & "syncing" (biru)
// dipake di tempat yang MEMANG lagi nunjukkin AI beneran kerja (bukan
// dekorasi) - misal loading screen atau kartu yang lagi narik data.
const NEXTO_VISOR_COLORS = { idle: "#f97316", thinking: "#8b5cf6", syncing: "#0ea5e9" };

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Redesign shape (9 Sep 2026): dulu 2 mata bulat kecil, sekarang 1 visor
// scanner - garis energi ngelewatin visor gelap + 1 inti terang di tengah,
// kesannya lebih "AI futuristic" (kayak lensa/sensor tunggal) daripada "robot
// kartun 2 mata". Pas ngomong, ada cahaya yang nyapu bolak-balik di visornya
// (efek scanning), bukan cuma pulsing biasa. Bezel-nya sendiri (metal 3-stop
// + highlight kaca pojok kiri-atas) tetap dipertahanin dari redesign
// sebelumnya.
//
// `status` (9 Sep 2026): visor sekarang JUGA jadi indikator kondisi beneran,
// bukan cuma dekorasi - "idle" (default, oranye), "thinking" (ungu, AI lagi
// mikir/proses), "syncing" (biru, lagi tarik/kirim data).
export function NextoRobotHead({ size = 32, className = "", speaking = false, status = "idle" }) {
  const visorColor = NEXTO_VISOR_COLORS[status] || NEXTO_VISOR_COLORS.idle;
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {speaking && (
        <style>{`
          @keyframes nexto-scan-sweep {
            0%, 100% { left: -35%; }
            50% { left: 100%; }
          }
          @keyframes nexto-core-pulse {
            0%, 100% { transform: scale(0.85); }
            50% { transform: scale(1.2); }
          }
        `}</style>
      )}
      {/* Bezel - metal 3-stop + highlight tipis di pojok kiri-atas */}
      <div
        className="absolute rounded-[26%] border"
        style={{
          inset: "8%",
          background: "linear-gradient(150deg, #fafbfc 0%, #dde2e8 42%, #b8c0ca 78%, #98a2ae 100%)",
          borderColor: "#8994a1",
          boxShadow: "0 4px 10px rgba(15,23,42,.16), inset 0 1px 1px rgba(255,255,255,.95)",
        }}
      />
      <div
        className="absolute rounded-[26%]"
        style={{
          inset: "8%",
          background: "radial-gradient(circle at 30% 22%, rgba(255,255,255,.65), transparent 45%)",
        }}
      />

      {/* Visor scanner - 1 garis energi + 1 inti terang di tengah */}
      <div
        className="absolute flex items-center justify-center overflow-hidden rounded-full"
        style={{
          width: "62%",
          height: "24%",
          background: "linear-gradient(165deg, #232323, #101010)",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,.5)",
        }}
      >
        <div
          className="absolute inset-y-0 inset-x-0"
          style={{ background: `linear-gradient(90deg, transparent, ${hexToRgba(visorColor, 0.6)} 50%, transparent)` }}
        />
        {speaking && (
          <div
            className="absolute inset-y-0"
            style={{
              width: "32%",
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,.85), transparent)",
              animation: "nexto-scan-sweep 1s ease-in-out infinite",
            }}
          />
        )}
        <span
          className="relative rounded-full"
          style={{
            width: "17%",
            height: "58%",
            background: `radial-gradient(circle at 35% 30%, #ffffff, ${hexToRgba(visorColor, 0.8)} 42%, ${visorColor} 78%)`,
            boxShadow: `0 0 6px ${hexToRgba(visorColor, 0.85)}`,
            animation: speaking ? "nexto-core-pulse 0.42s ease-in-out infinite" : "none",
          }}
        />
      </div>

      {/* Status online */}
      <span
        className="absolute rounded-full"
        style={{
          width: "11%",
          height: "11%",
          right: "9%",
          top: "5%",
          background: "#22c55e",
          boxShadow: "0 0 0 2px white, 0 0 7px rgba(34,197,94,.55)",
        }}
      />
    </div>
  );
}

export function NextoHeaderLogo({ width = 150, className = "" }) {
  const robotSize = Math.max(28, Math.min(34, width * 0.22));
  const wordmarkWidth = Math.max(82, width - robotSize - 12);

  return (
    <div
      className={`flex items-center ${className}`}
      style={{ width, lineHeight: 0 }}
      aria-label="Nexto AI"
      role="img"
    >
      {/* Robot AI — HEADER ONLY */}
      <NextoRobotHead size={robotSize} className="mr-2.5" />

      {/* HEADER ONLY:
          N / E / T / O = black
          X = orange
          No black rectangle/background. */}
      <div
        className="relative shrink-0"
        style={{
          width: wordmarkWidth,
          lineHeight: 0,
        }}
      >
        {/* Base layer: force all letters to black */}
        <img
          src={NEXTO_LOGO_SRC}
          alt=""
          aria-hidden="true"
          className="block h-auto w-full object-contain"
          style={{
            filter:
              "brightness(0) contrast(1.12) drop-shadow(0 1px 1px rgba(15,23,42,.08))",
          }}
        />

        {/* Orange X overlay — this layer is ONLY for the X */}
        <img
          src={NEXTO_LOGO_SRC}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 block h-full w-full object-contain"
          style={{
            clipPath: "polygon(39% 0%, 61% 0%, 61% 100%, 39% 100%)",
            WebkitClipPath:
              "polygon(39% 0%, 61% 0%, 61% 100%, 39% 100%)",
          }}
        />
      </div>
    </div>
  );
}

export function NextoDarkWordmark({ width = 108, className = "" }) {
  return (
    <div
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width, lineHeight: 0 }}
      aria-label="Nexto"
      role="img"
    >
      {/* Base: N / E / T / O white */}
      <img
        src={NEXTO_LOGO_SRC}
        alt=""
        aria-hidden="true"
        className="block h-auto w-full object-contain"
        style={{
          filter:
            "brightness(0) invert(1) contrast(1.08) drop-shadow(0 1px 1px rgba(0,0,0,.18))",
        }}
      />

      {/* Keep the X orange */}
      <img
        src={NEXTO_LOGO_SRC}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 block h-full w-full object-contain"
        style={{
          clipPath: "polygon(39% 0%, 61% 0%, 61% 100%, 39% 100%)",
          WebkitClipPath:
            "polygon(39% 0%, 61% 0%, 61% 100%, 39% 100%)",
        }}
      />
    </div>
  );
}


// ============================================================
// SECTION KEAMANAN AKUN (5 Sep 2026) - trust-building sebelum masuk ke
// pricing, sekalian ngasih tau fitur 2FA + kode recovery yang baru
// ditambahin biar user tau akun mereka gak bakal kekunci permanen kalau
// HP hilang (celah yang sempet ada, udah ditambal).
// ============================================================
// Dipadetin jadi 5 poin paling kuat (9 Sep 2026) - sebelumnya 8 card
// terpisah (akun vs database) kepanjangan buat halaman marketing, audiens
// utama Nexto tim sales/pemilik bisnis, bukan orang IT yang nyari detail
// teknis. "Dipantau AI 24 Jam" sengaja ditaro paling atas - itu yang paling
// beda dari CRM lain, sisanya digabung jadi 1 kalimat per topik.
const SECURITY_FEATURES = [
  {
    icon: Radar,
    title: "Dipantau AI 24 Jam",
    desc: "Sistem internal kami ngecek kesehatan & keamanan platform tiap beberapa jam sepanjang hari, dan langsung notif tim kami kalau ada yang janggal — bukan nunggu ada yang lapor duluan.",
  },
  {
    icon: ShieldCheck,
    title: "Login Aman Berlapis",
    desc: "Aktifin 2FA pakai app authenticator, dan kalau HP hilang ada 10 kode cadangan sekali-pakai — akun Anda gak pernah kekunci permanen dari diri sendiri.",
  },
  {
    icon: Lock,
    title: "Data Terisolasi & Terenkripsi",
    desc: "Row Level Security mastiin data organisasi Anda gak bisa ketembus organisasi lain, dan semuanya disimpan terenkripsi baik saat disimpan maupun saat dikirim lewat internet.",
  },
  {
    icon: EyeOff,
    title: "Kredensial Gak Pernah ke Browser",
    desc: "Kunci-kunci sensitif (API key, service credential) cuma hidup di server kami, gak pernah dikirim ke browser Anda — gak ada yang bisa dicuri lewat sisi perangkat pengguna.",
  },
  {
    icon: History,
    title: "Audit Log & Backup Berkala",
    desc: "Perubahan sensitif tercatat rapi dan gampang ditelusuri, sementara database di-backup otomatis secara berkala — data Anda gak gantung di satu titik kegagalan.",
  },
];

const INDUSTRIES = [
  {
    label: "PROPERTY",
    flow: "Lead → Viewing → Negotiation → Closing",
  },
  {
    label: "AUTOMOTIVE",
    flow: "Lead → Test Drive → Financing → Closing",
  },
  {
    label: "B2B",
    flow: "Lead → Meeting → Trial → Quotation → PO",
  },
  {
    label: "SAAS",
    flow: "Lead → Demo → Trial → Proposal → Closing",
  },
];

// === PRICING UPDATE (5 Sep 2026) ===
// 1. Good Morning Dashboard (daily digest) sekarang RESMI jadi fitur Standard
//    (bukan cuma Professional) - backend daily-digest.ts udah dibenerin buat
//    ngasih Standard+ juga, Free tetep di-skip. Professional TETEP dapet fitur
//    ini juga - convention landing page ini "Semua fitur Standard" di baris
//    pertama Professional udah otomatis nyakup ini, jadi gak perlu ditulis
//    ulang di daftar Professional (biar gak dobel/rancu).
// 2. Generate Leads AI: "4x/bulan" (sesuai batas terbaru di generate-leads.ts,
//    6 Sep 2026 - sebelumnya "1x/minggu").
const STANDARD_FEATURES = [
  "Kelola Leads — kartu per perusahaan",
  "Smart Import",
  "Vector Memory ringan (Nexto inget catatan lama yang relevan)",
  "Recycle Bin",
  "Deteksi Duplikat",
  "Nex — Komunitas Sesama Sales",
  "Daily Digest (rekomendasi harian)",
];

const PROFESSIONAL_FEATURES = [
  "Semua fitur Standard",
  "Bot Telegram (edit CRM, progress harian, jadwal visit)",
  "Sinkron otomatis ke Google Calendar",
  "Generate Leads",
  "Rekam Meeting otomatis",
  "Customer State",
  "Outcome Memory",
  "Advisor harian",
  "Pipeline Review otomatis",
  "Draft Follow-up (WhatsApp & Email)",
  "Analisa Kompetitor",
];

const ENTERPRISE_FEATURES = [
  "Semua fitur Professional",
  "GPS Check-in (tracking kunjungan tim real-time)",
  "4 anggota tim dalam satu organisasi",
  "Role-based visibility (Owner/Manager/Sales Rep)",
  "Assign & filter leads per anggota tim",
  "Laporan Performa Tim (leaderboard revenue & win rate)",
  "Undang anggota tim via kode invite",
  "Bot Telegram kirim email otonom",
  "Approval-gate: hapus lead & export data butuh persetujuan owner/manager",
  "Prioritas support",
];

// Site key Cloudflare Turnstile (aman ditaro di frontend - beda dari secret
// key yang cuma disimpen di sisi Supabase). Dipake buat render widget
// captcha di form signup/login, dipasangin karena Supabase Auth "Enable
// Captcha protection" ditolak jalan tanpa token dari widget ini.
const TURNSTILE_SITE_KEY = "0x4AAAAAAEu6vGXceQD1CTOl";

// === EARLY BIRD PROMO (10 Sep 2026) ===
// Diskon 15% berlaku buat DUA-DUANYA siklus billing (Bulanan maupun 3
// Bulan) selama periode early bird - bukan cuma paket 3-bulanan. Begitu
// EARLY_BIRD_DEADLINE lewat, harga OTOMATIS balik ke PRICING_NORMAL (gak
// perlu ubah kode lagi) - tapi INGET, ini cuma ngubah apa yang DITAMPILIN
// di landing page. Nominal yang beneran di-charge tetep ditentuin harga
// yang di-set di Mayar dashboard - itu WAJIB diubah manual balik ke normal
// di tanggal yang sama (dan mapping AMOUNT_TO_TIER di mayar-webhook.ts
// SENGAJA tetap nyimpen nominal early bird selamanya, jangan dihapus -
// biar subscriber yang udah kadung subscribe di harga diskon pas
// perpanjangan bulanan gak "nyangkut" jadi unknown amount).
const EARLY_BIRD_DEADLINE = new Date("2026-09-30T23:59:59+07:00");
const isEarlyBird = new Date() < EARLY_BIRD_DEADLINE;

const PRICING_NORMAL = {
  standard: { monthlyPrice: "Rp79rb", quarterlyTotal: "Rp237rb" },
  professional: { monthlyPrice: "Rp269rb", quarterlyTotal: "Rp807rb" },
  enterprise: { monthlyPrice: "Rp1,3jt", quarterlyTotal: "Rp3,9jt", perPerson: "Rp325rb" },
};
const PRICING_EARLY_BIRD = {
  standard: { monthlyPrice: "Rp67rb", monthlySavings: "Rp12rb", quarterlyTotal: "Rp201rb", quarterlySavings: "Rp36rb" },
  professional: { monthlyPrice: "Rp229rb", monthlySavings: "Rp40rb", quarterlyTotal: "Rp686rb", quarterlySavings: "Rp121rb" },
  enterprise: { monthlyPrice: "Rp1,11jt", monthlySavings: "Rp195rb", quarterlyTotal: "Rp3,315jt", quarterlySavings: "Rp585rb", perPerson: "Rp276rb" },
};
const PRICING = isEarlyBird ? PRICING_EARLY_BIRD : PRICING_NORMAL;

const AI_DEMO_STATES = [
  {
    type: "calendar",
    user: "Besok jam 10 visit PT Sinar Abadi.",
    ai: "Siap. Visit sudah dibuat.",
    status: "Google Calendar diperbarui",
    detail: "Besok • 10:00 — PT Sinar Abadi",
  },
  {
    type: "progress",
    user: "Hari ini gue visit 4 customer. PT ABC interested, PT XYZ minta sample.",
    ai: "Progress hari ini sudah diperbarui.",
    status: "Progress tersimpan ke CRM",
    detail: "4 visit • 1 interested • 1 sample request",
  },
  {
    type: "crm",
    user: "Update PT Maju Bersama jadi Negosiasi.",
    ai: "Done. Data CRM sudah diperbarui.",
    status: "CRM berhasil di-edit",
    detail: "PT Maju Bersama → Negosiasi",
  },
];

function NextoAISalesEngine({ robotVoice }) {
  const [active, setActive] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsTyping(true);

      setTimeout(() => {
        setActive((prev) => (prev + 1) % AI_DEMO_STATES.length);
        setIsTyping(false);
      }, 650);
    }, 4200);

    return () => clearInterval(timer);
  }, []);

  const current = AI_DEMO_STATES[active];

  const setDemo = (index) => {
    if (index === active) return;

    setIsTyping(true);

    setTimeout(() => {
      setActive(index);
      setIsTyping(false);
    }, 400);
  };

  return (
    <section
      id="ai-engine"
      className="relative overflow-hidden text-white"
      style={{
        background:
          "radial-gradient(circle at 50% 42%, rgba(15,30,48,.92) 0%, #080b11 34%, #05070c 72%)",
      }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.12]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(249,115,22,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.18) 1px, transparent 1px)",
            backgroundSize: "55px 55px",
            maskImage:
              "radial-gradient(circle at center, black 0%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(circle at center, black 0%, transparent 75%)",
          }}
        />
      </div>

      {/* Ambient glows */}
      <div className="absolute left-1/2 top-[45%] -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute left-[8%] top-[25%] w-[220px] h-[220px] rounded-full bg-cyan-400/5 blur-[100px] pointer-events-none" />
      <div className="absolute right-[8%] top-[25%] w-[220px] h-[220px] rounded-full bg-orange-500/5 blur-[100px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28">
        {/* Section heading */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2.5 rounded-lg border border-orange-500/25 bg-black/50 px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-orange-400 shadow-[0_0_30px_rgba(249,115,22,0.1)] backdrop-blur-sm">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70" />
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
            </span>
            <span className="h-3 w-px bg-white/10" />
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-400" />
            </span>
            NEXTO COMMAND CENTER
          </div>

          <h2 className="mt-5 text-3xl md:text-5xl font-bold tracking-[-0.045em] leading-[1.05]">
            Anda cukup{" "}
            <span className="text-orange-500">ngomong.</span>
            <br />
            Nexto yang kerja.
          </h2>

          <p className="mt-5 text-sm md:text-base leading-7 text-stone-400 max-w-2xl mx-auto">
            Chatbot Nexto menjadi pusat kendali sales Anda. Satu chat bisa
            mengatur visit, memperbarui progress, mengedit CRM, bahkan
            <span className="text-orange-400 font-medium"> menyuruh Nexto kirim email follow-up ke lead secara otomatis</span> —
            tanpa harus buka satu-satu.
          </p>
        </div>

        {/* =========================================================
            ENGINE AREA
        ========================================================== */}
        <div className="relative mt-14 md:mt-20 flex flex-col md:block md:min-h-[680px]">
          {/* Desktop connection lines */}
          <div className="hidden md:block absolute inset-0 pointer-events-none">
            {/* left line */}
            <div className="absolute left-[25%] top-[38%] w-[18%] h-px bg-gradient-to-r from-transparent via-orange-500 to-orange-400 rotate-[-18deg] origin-right opacity-70">
              <div className="energy-dot energy-left" />
            </div>

            {/* right line */}
            <div className="absolute right-[25%] top-[38%] w-[18%] h-px bg-gradient-to-l from-transparent via-orange-500 to-orange-400 rotate-[18deg] origin-left opacity-70">
              <div className="energy-dot energy-right" />
            </div>

            {/* bottom line */}
            <div className="absolute left-1/2 top-[61%] h-[15%] w-px -translate-x-1/2 bg-gradient-to-b from-orange-500 via-orange-400 to-transparent opacity-70">
              <div className="energy-dot energy-down" />
            </div>
          </div>

          {/* =======================================================
              LEFT — CALENDAR
          ======================================================== */}
          <div className="engine-card relative md:absolute left-0 top-0 md:top-[5%] md:w-[29%] w-full md:max-w-none order-1 md:order-none">
            <EngineCard
              active={active === 0}
              number="01"
              icon={<Calendar size={19} />}
              title="Setting Visit"
              accent="Google Calendar"
              description="Cukup bilang kapan dan siapa yang mau Anda visit. Nexto otomatis membuat jadwal dan menyinkronkannya ke Google Calendar."
            >
              <div className="mt-4 rounded-xl border border-white/[0.08] bg-black/30 p-3">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[7px] uppercase tracking-widest text-slate-500">
                    Visit baru
                  </span>

                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[7px] font-semibold text-emerald-400">
                    <CheckCircle2 size={9} />
                    Synced
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-orange-500/10 border border-orange-500/20">
                    <span className="text-[7px] uppercase text-orange-400">
                      BESOK
                    </span>
                    <span className="text-base font-bold text-white">
                      10
                    </span>
                  </div>

                  <div>
                    <div className="text-[10px] font-semibold text-white">
                      PT Sinar Abadi
                    </div>
                    <div className="mt-1 text-[8px] text-slate-500">
                      10:00 — 11:00
                    </div>
                    <div className="mt-1 text-[8px] text-orange-400">
                      Google Calendar
                    </div>
                  </div>
                </div>
              </div>
            </EngineCard>
          </div>

          {/* =======================================================
              RIGHT — CRM
          ======================================================== */}
          <div className="engine-card relative md:absolute right-0 top-0 md:top-[5%] md:w-[29%] w-full md:max-w-none mt-6 md:mt-0 order-3 md:order-none">
            <EngineCard
              active={active === 2}
              number="03"
              icon={<Pencil size={19} />}
              title="Edit CRM"
              accent="AI yang Kerjain"
              description="Update status, edit lead, ubah next action, tambah catatan — cukup perintah lewat chat."
            >
              <div className="mt-4 space-y-2.5">
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircle
                      size={11}
                      className="text-orange-400"
                    />
                    <span className="text-[7px] uppercase tracking-widest text-orange-400">
                      Perintah
                    </span>
                  </div>

                  <p className="text-[9px] leading-4 text-slate-300">
                    “Update PT Maju Bersama jadi Negosiasi.”
                  </p>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      size={12}
                      className="text-emerald-400"
                    />

                    <span className="text-[9px] font-semibold text-white">
                      CRM berhasil diperbarui
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[8px]">
                    <span className="text-slate-500">
                      PT Maju Bersama
                    </span>

                    <span className="rounded-full bg-orange-500/10 px-2 py-1 text-orange-400">
                      Negosiasi
                    </span>
                  </div>
                </div>
              </div>
            </EngineCard>
          </div>

          {/* =======================================================
              CENTER ROBOT
          ======================================================== */}
          <div className="relative flex justify-center md:absolute md:block md:left-1/2 md:top-[21%] md:-translate-x-1/2 z-20 my-8 md:my-0 order-2 md:order-none">
            <div className="relative flex h-[270px] w-[270px] items-center justify-center md:h-[320px] md:w-[320px]">
              {/* outer rotating ring */}
              <div className="absolute inset-0 rounded-full border border-orange-500/20 animate-spin-slow" />

              <div className="absolute inset-[18px] rounded-full border border-orange-500/10 animate-spin-reverse" />

              <div className="absolute inset-[38px] rounded-full border border-dashed border-orange-400/20 animate-spin-slow" />

              {/* orbital particles */}
              <div className="absolute inset-0 animate-spin-slow">
                <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-orange-400 shadow-[0_0_15px_#fb923c]" />
                <span className="absolute right-2 top-1/2 h-1.5 w-1.5 rounded-full bg-orange-300 shadow-[0_0_12px_#fb923c]" />
                <span className="absolute bottom-5 left-[20%] h-1.5 w-1.5 rounded-full bg-orange-500 shadow-[0_0_12px_#fb923c]" />
              </div>

              {/* glow */}
              <div className="absolute h-44 w-44 md:h-52 md:w-52 rounded-full bg-orange-500/20 blur-[55px] animate-pulse" />

              {/* robot core */}
              <div className="robot-float relative h-36 w-36 md:h-44 md:w-44 rounded-[38%] border border-orange-400/30 bg-gradient-to-br from-slate-200 via-slate-400 to-slate-800 shadow-[0_0_60px_rgba(249,115,22,0.28)]">
                <div className="absolute inset-[7px] rounded-[35%] bg-gradient-to-br from-[#d9dee5] via-[#8e969f] to-[#252a30]" />

                {/* face visor */}
                <div className="absolute left-[15%] right-[15%] top-[28%] h-[30%] rounded-[28px] bg-[#080a0c] border border-orange-400/30 shadow-[inset_0_0_30px_rgba(249,115,22,0.12)]">
                  <div className="absolute left-[24%] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-orange-400 shadow-[0_0_15px_#fb923c] animate-pulse" />

                  <div className="absolute right-[24%] top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-orange-400 shadow-[0_0_15px_#fb923c] animate-pulse" />

                  <div className="absolute left-1/2 bottom-[20%] h-[2px] w-7 -translate-x-1/2 rounded-full bg-orange-400/70" style={robotVoice.speaking ? { animation: "nexto-mouth-talk 0.35s ease-in-out infinite alternate" } : undefined} />
                </div>

                {/* Nexto logo mark removed — the new wordmark is used across the landing page. */}

                {/* ears */}
                <div className="absolute -left-3 top-[37%] h-12 w-5 rounded-full border border-orange-400/20 bg-slate-700" />
                <div className="absolute -right-3 top-[37%] h-12 w-5 rounded-full border border-orange-400/20 bg-slate-700" />
              </div>

              {/* floating chat bubble */}
              <div className="absolute -top-7 left-1/2 w-[200px] md:w-[235px] -translate-x-1/2 md:translate-x-[20%] rounded-2xl border border-orange-400/30 bg-[#111214]/90 px-3.5 py-2.5 shadow-[0_15px_40px_-15px_rgba(249,115,22,0.45)] backdrop-blur-xl">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15">
                    <Bot size={11} className="text-orange-400" />
                  </div>

                  <div className="min-w-0">
                    <div className="text-[7px] uppercase tracking-widest text-orange-400">
                      Nexto AI
                    </div>

                    <div className="mt-1 text-[9px] leading-4 text-white">
                      {isTyping
                        ? "Nexto sedang bekerja..."
                        : current.ai}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tombol dengerin robot ngomong - klik doang, gak autoplay */}
              <button
                onClick={robotVoice.play}
                disabled={robotVoice.speaking}
                className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-orange-400/30 bg-[#111214]/90 px-3 py-1.5 text-[9px] font-semibold text-orange-300 backdrop-blur-xl transition-opacity disabled:opacity-70"
              >
                <Volume2 size={11} className={robotVoice.speaking ? "animate-pulse" : ""} />
                {robotVoice.speaking ? "Speaking…" : "Listen"}
              </button>
            </div>
          </div>

          {/* =======================================================
              BOTTOM — PROGRESS
          ======================================================== */}
          <div className="engine-card relative md:absolute md:left-1/2 bottom-auto md:bottom-[2%] md:-translate-x-1/2 w-full md:w-[40%] mt-6 md:mt-0 order-4 md:order-none">
            <EngineCard
              active={active === 1}
              number="02"
              icon={<Mic size={19} />}
              title="Update Progress"
              accent="Voice & Text"
              description="Lagi di jalan? Tinggal ngomong. Lagi bisa mengetik? Chat. Nexto memahami dan menyimpan progress ke CRM."
            >
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
                  <div className="flex items-center gap-2 text-[8px] text-slate-500">
                    <Mic size={11} className="text-orange-400" />
                    Voice
                  </div>

                  <div className="mt-3 flex items-center justify-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-500/10 border border-orange-500/20">
                      <Mic
                        size={17}
                        className="text-orange-400 animate-pulse"
                      />
                    </div>
                  </div>

                  <div className="mt-2 text-center text-[8px] text-slate-500">
                    “Ketemu Pak Budi…”
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3">
                  <div className="flex items-center gap-2 text-[8px] text-slate-500">
                    <MessageCircle
                      size={11}
                      className="text-orange-400"
                    />
                    Text
                  </div>

                  <div className="mt-3 rounded-lg bg-orange-500/[0.06] border border-orange-500/10 px-2.5 py-2 text-[8px] leading-4 text-slate-300">
                    {current.type === "progress"
                      ? current.user
                      : "Hari ini visit 4 customer..."}
                  </div>

                  <div className="mt-2 text-[8px] text-emerald-400">
                    ✓ Saved to CRM
                  </div>
                </div>
              </div>
            </EngineCard>
          </div>

        </div>

        {/* =========================================================
            LIVE DEMO SWITCHER
        ========================================================== */}
        <div className="mx-auto mt-8 max-w-2xl">
          <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.025] p-2 backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-1">
              <DemoButton
                active={active === 0}
                icon={<Calendar size={13} />}
                label="Atur Visit"
                onClick={() => setDemo(0)}
              />

              <DemoButton
                active={active === 1}
                icon={<Mic size={13} />}
                label="Update Progress"
                onClick={() => setDemo(1)}
              />

              <DemoButton
                active={active === 2}
                icon={<Pencil size={13} />}
                label="Edit CRM"
                onClick={() => setDemo(2)}
              />
            </div>
          </div>
        </div>

        {/* integration strip */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <IntegrationBadge label="Nexto CRM" />
          <span className="text-slate-700">—</span>
          <IntegrationBadge label="Google Calendar" />
          <span className="text-slate-700">—</span>
          <IntegrationBadge label="Voice AI" />
          <span className="text-slate-700">—</span>
          <IntegrationBadge label="AI Assistant" />
        </div>

        {/* final statement */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05] px-3.5 py-2 text-[9px] text-emerald-400">
            <CheckCircle2 size={12} />
            Satu percakapan → semua aktivitas sales terhubung
          </div>
        </div>

        {/* =========================================================
            JEMBATAN NARASI ke section "NEXTO AI Engine Loops" di bawah -
            nyambungin secara cerita ("ini yang kamu liat" -> "ini yang
            jalan di baliknya"), bukan garis yang motong 2 section beda.
        ========================================================== */}
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <p className="max-w-xs text-[11px] leading-relaxed text-slate-500">
            Itu yang Anda liat & ajak ngobrol.
            <span className="block text-white font-medium">Ini yang jalan di baliknya.</span>
          </p>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full border border-orange-500/25 bg-orange-500/[0.06]"
            style={{ animation: "nexto-bridge-bounce 1.8s ease-in-out infinite" }}
          >
            <ChevronDown size={14} className="text-orange-400" />
          </span>
        </div>
      </div>

      <style>{`
        @keyframes nexto-bridge-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(6px); opacity: 1; }
        }
        .animate-spin-slow {
          animation: nextoSpin 18s linear infinite;
        }

        .animate-spin-reverse {
          animation: nextoSpinReverse 24s linear infinite;
        }

        .robot-float {
          animation: robotFloat 3.8s ease-in-out infinite;
        }

        .energy-dot {
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #fb923c;
          box-shadow:
            0 0 8px #fb923c,
            0 0 18px rgba(249,115,22,0.8);
        }

        .energy-left {
          right: 0;
          top: -3px;
          animation: energyLeft 2.4s linear infinite;
        }

        .energy-right {
          left: 0;
          top: -3px;
          animation: energyRight 2.4s linear infinite;
        }

        .energy-down {
          left: -3px;
          top: 0;
          animation: energyDown 2.2s linear infinite;
        }

        @keyframes nextoSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes nexto-mouth-talk {
          from { transform: translateX(-50%) scaleX(0.6); opacity: 0.6; }
          to { transform: translateX(-50%) scaleX(1.15); opacity: 1; }
        }

        @keyframes nextoSpinReverse {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        @keyframes robotFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-9px);
          }
        }

        @keyframes energyLeft {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateX(-170px);
            opacity: 0;
          }
        }

        @keyframes energyRight {
          0% {
            transform: translateX(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateX(170px);
            opacity: 0;
          }
        }

        @keyframes energyDown {
          0% {
            transform: translateY(0);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            transform: translateY(120px);
            opacity: 0;
          }
        }

        @media (max-width: 767px) {
          .engine-card {
            position: relative !important;
            left: auto !important;
            right: auto !important;
            top: auto !important;
            bottom: auto !important;
            transform: none !important;
            margin-top: 0 !important;
            margin-bottom: 18px !important;
          }

          .engine-card:nth-child(1) {
            margin-bottom: 350px !important;
          }

          .engine-card:nth-child(2) {
            margin-bottom: 18px !important;
          }

          .engine-card:nth-child(3) {
            margin-bottom: 18px !important;
          }

          .engine-card:nth-child(4) {
            margin-top: 0 !important;
          }
        }
      `}</style>
    </section>
  );
}

function EngineCard({
  number,
  icon,
  title,
  accent,
  description,
  active,
  children,
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[26px] border p-5 md:p-5 backdrop-blur-xl transition-all duration-700 ${
        active
          ? "border-orange-500/50 bg-orange-500/[0.055] shadow-[0_0_50px_-18px_rgba(249,115,22,0.65)]"
          : "border-white/[0.08] bg-[#0d0d0e]/85"
      }`}
    >
      {/* active glow */}
      <div
        className={`absolute -right-16 -top-16 h-32 w-32 rounded-full bg-orange-500/10 blur-3xl transition-opacity duration-700 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />

      <div className="relative">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${
              active
                ? "border-orange-500/30 bg-orange-500/15 text-orange-400"
                : "border-white/[0.08] bg-white/[0.03] text-orange-500"
            }`}
          >
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[7px] font-bold tracking-[0.18em] text-orange-500">
                {number}
              </span>

              <span className="text-[7px] uppercase tracking-[0.18em] text-slate-600">
                Nexto AI
              </span>
            </div>

            <h3 className="mt-1 text-[15px] font-bold tracking-tight text-white">
              {title}
            </h3>

            <div className="mt-0.5 text-[9px] font-semibold text-orange-400">
              {accent}
            </div>
          </div>
        </div>

        <p className="relative mt-3 text-[9px] leading-4 text-slate-500">
          {description}
        </p>

        {children}
      </div>
    </div>
  );
}

function DemoButton({ active, icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-[15px] px-3 py-2.5 text-[8px] font-semibold transition-all ${
        active
          ? "bg-orange-500 text-white shadow-[0_5px_20px_-8px_rgba(249,115,22,0.8)]"
          : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IntegrationBadge({ label }) {
  return (
    <div className="rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-[8px] font-medium text-slate-500">
      {label}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">
      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
      {children}
    </div>
  );
}

// ============================================================
// NEXTO AI ENGINE LOOPS
// AI Command Center visual:
// Context -> Reason -> Plan -> Act -> Learn -> back to Context.
// ============================================================
const ENGINE_NODES = [
  {
    key: "context",
    label: "CONTEXT",
    title: "Live Context",
    icon: Database,
    color: "#38bdf8",
    position: "top",
  },
  {
    key: "reason",
    label: "REASON",
    title: "Memory Engine",
    icon: Layers,
    color: "#22d3ee",
    position: "left",
  },
  {
    key: "plan",
    label: "PLAN",
    title: "Decision Engine",
    icon: BrainCircuit,
    color: "#f97316",
    position: "right",
  },
  {
    key: "act",
    label: "ACT",
    title: "Action Engine",
    icon: Zap,
    color: "#a855f7",
    position: "bottom",
  },
  {
    key: "learn",
    label: "LEARN",
    title: "Feedback Loop",
    icon: TrendingUp,
    color: "#34d399",
    position: "bottom",
  },
];

function AiEngineLoopSection({ robotVoice }) {
  const [activeLoop, setActiveLoop] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveLoop((prev) => (prev + 1) % 5);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const activeNode = ENGINE_NODES[activeLoop];

  return (
    <section
      id="cara-kerja"
      className="relative overflow-hidden bg-[#05070c] px-5 pb-24 pt-14 text-white sm:px-7 sm:pb-32 sm:pt-20 lg:px-10"
    >
      <style>{`
        @keyframes nexto-command-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow:
              0 0 0 1px rgba(255,255,255,.10),
              0 0 45px rgba(59,130,246,.16),
              0 0 110px rgba(168,85,247,.08);
          }
          50% {
            transform: scale(1.025);
            box-shadow:
              0 0 0 1px rgba(255,255,255,.18),
              0 0 65px rgba(59,130,246,.28),
              0 0 140px rgba(168,85,247,.13);
          }
        }

        @keyframes nexto-command-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes nexto-command-spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes nexto-command-flow {
          0% { left: 0%; opacity: 0; }
          12% { opacity: 1; }
          82% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }

        @keyframes nexto-command-flow-reverse {
          0% { right: 0%; opacity: 0; }
          12% { opacity: 1; }
          82% { opacity: 1; }
          100% { right: 100%; opacity: 0; }
        }

        @keyframes nexto-command-dot {
          0%, 100% { opacity: .25; transform: scale(.75); }
          50% { opacity: 1; transform: scale(1); }
        }

        @keyframes nexto-command-scan {
          0% { transform: translateY(-180px); opacity: 0; }
          18% { opacity: .8; }
          75% { opacity: .35; }
          100% { transform: translateY(180px); opacity: 0; }
        }

        @keyframes nexto-command-card-in {
          from { opacity: .45; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .nexto-command-grid {
          background-image:
            linear-gradient(rgba(255,255,255,.038) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.038) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, black 0%, transparent 82%);
          -webkit-mask-image: radial-gradient(circle at center, black 0%, transparent 82%);
        }

        .nexto-command-glass {
          background:
            linear-gradient(145deg, rgba(255,255,255,.065), rgba(255,255,255,.018));
          border: 1px solid rgba(255,255,255,.085);
          box-shadow:
            0 28px 90px -45px rgba(0,0,0,.95),
            inset 0 1px 0 rgba(255,255,255,.035);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .nexto-command-noise {
          background-image: radial-gradient(rgba(255,255,255,.16) .6px, transparent .6px);
          background-size: 13px 13px;
        }

        @media (prefers-reduced-motion: reduce) {
          .nexto-command-motion,
          .nexto-command-motion * {
            animation: none !important;
          }
        }
      `}</style>

      {/* Background */}
      <div className="pointer-events-none absolute inset-0 nexto-command-grid" />
      <div className="pointer-events-none absolute left-1/2 top-[42%] h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/[0.07] blur-[120px]" />
      <div className="pointer-events-none absolute left-[8%] top-[28%] h-[330px] w-[330px] rounded-full bg-cyan-500/[0.055] blur-[120px]" />
      <div className="pointer-events-none absolute right-[5%] top-[32%] h-[360px] w-[360px] rounded-full bg-orange-500/[0.05] blur-[125px]" />

      <div className="relative mx-auto max-w-[1400px]">
        {/* Section heading */}
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel>How Nexto thinks</SectionLabel>
          <h2 className="mt-4 text-[34px] font-bold leading-[1.02] tracking-[-0.05em] sm:text-[52px]">
            The engine behind the next action.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[14px] leading-6 text-slate-400 sm:text-[16px] sm:leading-7">
            Nexto reads live context, remembers what happened, decides what matters,
            takes action, and learns from the result — then the loop starts again.
          </p>
        </div>

        {/* Command-center canvas */}
        <div className="relative mx-auto mt-14 min-h-[780px] max-w-[1260px] lg:mt-16">
          {/* Main atmospheric orbit */}
          <div className="nexto-command-motion pointer-events-none absolute left-1/2 top-[44%] hidden h-[610px] w-[610px] -translate-x-1/2 -translate-y-1/2 lg:block">
            <div
              className="absolute inset-0 rounded-full border border-white/[0.075]"
              style={{ animation: "nexto-command-spin 42s linear infinite" }}
            />
            <div
              className="absolute inset-[48px] rounded-full border border-dashed border-cyan-400/[0.09]"
              style={{ animation: "nexto-command-spin-reverse 27s linear infinite" }}
            />
            <div
              className="absolute inset-[106px] rounded-full border border-blue-400/[0.075]"
              style={{ animation: "nexto-command-spin 19s linear infinite" }}
            />
          </div>

          {/* top context card */}
          <div className="absolute left-1/2 top-0 hidden w-[270px] -translate-x-1/2 lg:block">
            <EngineContextCard active={activeLoop === 0} />
          </div>

          {/* left memory/reason card */}
          <div className="absolute left-0 top-[34%] hidden w-[285px] lg:block">
            <EngineMemoryCard active={activeLoop === 1} />
          </div>

          {/* right decision/next action card */}
          <div className="absolute right-0 top-[34%] hidden w-[300px] lg:block">
            <EngineDecisionCard active={activeLoop === 2} />
          </div>

          {/* bottom action card */}
          <div className="absolute left-1/2 bottom-[8px] hidden w-[580px] -translate-x-1/2 lg:block">
            <EngineActionCard active={activeLoop === 3} />
          </div>

          {/* core - relative/mx-auto di mobile (ikut alur normal, gak numpuk sama
              panel "Mobile: same composition" di bawahnya), balik ke absolute
              cuma di lg+ buat komposisi canvas orbit desktop (10 Sep 2026 -
              sebelumnya SELALU absolute top-[35%], bikin nimpa card LIVE
              CONTEXT di HP karena badge LOOP ACTIVE-nya nongol jauh lebih
              bawah dari 405px tempat panel mobile mulai). */}
          <div className="relative z-20 mx-auto w-fit lg:absolute lg:left-1/2 lg:top-[42%] lg:mx-0 lg:w-auto lg:-translate-x-1/2">
            <div className="relative flex h-[330px] w-[330px] items-center justify-center sm:h-[360px] sm:w-[360px]">
              <div
                className="nexto-command-motion absolute inset-[40px] rounded-full border border-blue-300/[0.08]"
                style={{ animation: "nexto-command-spin 16s linear infinite" }}
              />
              <div
                className="nexto-command-motion absolute inset-[68px] rounded-full border border-orange-300/[0.08]"
                style={{ animation: "nexto-command-spin-reverse 11s linear infinite" }}
              />

              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <span
                  key={i}
                  className="nexto-command-motion absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-300"
                  style={{
                    transform: `rotate(${i * 45}deg) translateY(-${128 + (i % 2) * 28}px)`,
                    boxShadow: "0 0 14px 3px rgba(103,232,249,.75)",
                    animation: `nexto-command-dot ${1.6 + (i % 3) * .35}s ease-in-out infinite`,
                    animationDelay: `${i * .15}s`,
                  }}
                />
              ))}

              <div className="absolute h-[250px] w-[250px] rounded-full bg-blue-500/[0.09] blur-[55px]" />

              <div
                className="nexto-command-motion relative flex h-[205px] w-[205px] flex-col items-center justify-center rounded-[48px] border border-white/[0.14] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.12),rgba(16,21,31,.96)_45%,rgba(5,7,12,.99)_100%)]"
                style={{ animation: "nexto-command-pulse 3s ease-in-out infinite" }}
              >
                <div className="absolute inset-0 rounded-[48px] bg-gradient-to-br from-cyan-400/[0.04] via-transparent to-orange-400/[0.05]" />

                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.14] bg-white/[0.07]">
                  <NextoRobotHead size={42} speaking={robotVoice.speaking} />
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#111722] bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
                </div>

                <div className="relative mt-4 text-[11px] font-bold uppercase tracking-[0.24em] text-white">
                  NEXTO AI CORE
                </div>
                <div className="relative mt-1 text-[8px] uppercase tracking-[0.16em] text-slate-600">
                  Observe · Think · Act · Learn
                </div>

                <button
                  onClick={robotVoice.play}
                  disabled={robotVoice.speaking}
                  className="relative mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.045] px-3.5 py-1.5 text-[9px] font-semibold text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-60"
                >
                  <Volume2 size={11} className={robotVoice.speaking ? "animate-pulse" : ""} />
                  {robotVoice.speaking ? "Speaking…" : "Listen"}
                </button>
              </div>

              {/* live status */}
              <div className="absolute -bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-emerald-400/15 bg-emerald-400/[0.045] px-3 py-1.5 backdrop-blur-xl">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[8px] font-bold tracking-[0.12em] text-emerald-300">
                  LOOP ACTIVE
                </span>
              </div>
            </div>
          </div>

          {/* connection lines */}
          <div className="nexto-command-motion pointer-events-none absolute inset-0 hidden lg:block">
            {/* Context -> Core */}
            <div className="absolute left-1/2 top-[19%] h-[23%] w-px -translate-x-1/2 bg-gradient-to-b from-cyan-400/30 via-cyan-400/20 to-white/5">
              <span
                className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-300"
                style={{
                  boxShadow: "0 0 14px 4px rgba(103,232,249,.7)",
                  animation: "nexto-command-scan 2.6s linear infinite",
                }}
              />
            </div>

            {/* Core -> Decision */}
            <div className="absolute left-[57%] top-[46%] h-px w-[20%] rotate-[-4deg] origin-left bg-gradient-to-r from-blue-400/25 to-orange-400/20">
              <span
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-orange-300"
                style={{
                  boxShadow: "0 0 14px 4px rgba(253,186,116,.7)",
                  animation: "nexto-command-flow 2.5s ease-in-out infinite",
                }}
              />
            </div>

            {/* Memory -> Core */}
            <div className="absolute right-[57%] top-[46%] h-px w-[20%] -rotate-[-4deg] origin-right bg-gradient-to-l from-cyan-400/25 to-blue-400/10">
              <span
                className="absolute right-0 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-cyan-300"
                style={{
                  boxShadow: "0 0 14px 4px rgba(103,232,249,.7)",
                  animation: "nexto-command-flow-reverse 2.5s ease-in-out infinite",
                }}
              />
            </div>

            {/* Core -> Action */}
            <div className="absolute left-1/2 top-[57%] h-[29%] w-px -translate-x-1/2 bg-gradient-to-b from-purple-400/25 via-purple-400/18 to-emerald-400/20">
              <span
                className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-purple-300"
                style={{
                  boxShadow: "0 0 14px 4px rgba(192,132,252,.7)",
                  animation: "nexto-command-scan 2.9s linear infinite",
                }}
              />
            </div>

            {/* feedback arc — visual cue that the result returns to context */}
            <div className="absolute left-1/2 top-[73%] h-[150px] w-[650px] -translate-x-1/2 rounded-[50%] border-b border-emerald-400/[0.18]" />
          </div>

          {/* bottom loop label */}
          <div className="absolute bottom-[-4px] left-1/2 hidden -translate-x-1/2 items-center gap-3 whitespace-nowrap lg:flex">
            {["CONTEXT", "REASON", "PLAN", "ACT", "LEARN"].map((item, i) => (
              <span key={item} className="contents">
                <span
                  className={`text-[8px] font-bold tracking-[0.17em] transition-colors duration-500 ${
                    activeLoop === i ? "text-white" : "text-slate-700"
                  }`}
                >
                  {item}
                </span>
                {i < 4 && <span className="text-slate-800">→</span>}
              </span>
            ))}
            <span className="text-slate-800">↺</span>
          </div>

          {/* Mobile: same composition, stacked cleanly - normal flow (bukan
              absolute+top-px tetap), biar otomatis ngikutin tinggi asli si
              "core" robot di atasnya, gak ngasal nimpa. mt-16 (bukan mt-8)
              biar jarak cukup buat ngelewatin badge "LOOP ACTIVE" yang
              nongol di luar box robot (-bottom-8 dari box-nya sendiri). */}
          <div className="mt-16 space-y-3 lg:hidden">
            <div className="nexto-command-glass rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-bold tracking-[0.14em] text-cyan-300">
                    LIVE CONTEXT
                  </div>
                  <div className="mt-1 text-[19px] font-bold tracking-[-0.03em] text-white">
                    1,284 customers
                  </div>
                </div>
                <Database size={20} className="text-cyan-300" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  ["Percakapan", "8.4K"],
                  ["Opportunity", "367"],
                  ["Aktivitas", "2.1K"],
                  ["Riwayat deal", "12.8K"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
                    <div className="text-[8px] text-slate-500">{label}</div>
                    <div className="mt-0.5 text-[9px] font-semibold text-slate-300">{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <EngineMemoryCard active={activeLoop === 1} compact />
              <EngineDecisionCard active={activeLoop === 2} compact />
            </div>

            <EngineActionCard active={activeLoop === 3} compact />

            <div className="nexto-command-glass rounded-2xl px-4 py-3 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2 text-[8px] font-bold tracking-[0.13em]">
                {["CONTEXT", "REASON", "PLAN", "ACT", "LEARN"].map((item, i) => (
                  <span
                    key={item}
                    className={activeLoop === i ? "text-white" : "text-slate-600"}
                  >
                    {item}{i < 4 ? " →" : " ↺"}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-5 text-slate-500">
                Hasil hari ini menjadi konteks untuk keputusan berikutnya.
              </p>
            </div>
          </div>
        </div>

        {/* Active loop readout */}
        <div className="mx-auto mt-2 flex max-w-3xl flex-col items-center justify-center gap-3 text-center sm:mt-4 sm:flex-row sm:text-left">
          <div
            className="h-2 w-2 shrink-0 rounded-full"
            style={{
              background: activeNode.color,
              boxShadow: `0 0 14px 4px ${activeNode.color}66`,
            }}
          />
          <p className="text-[11px] leading-5 text-slate-500">
            Sekarang:{" "}
            <span className="font-semibold text-slate-300">{activeNode.label}</span>
            {" — "}
            Nexto terus menjalankan loop ini tanpa harus menunggu sales membuka CRM.
          </p>
        </div>
      </div>
    </section>
  );
}

function EngineContextCard({ active = false }) {
  return (
    <div
      className={`nexto-command-glass rounded-[22px] p-4 transition-all duration-500 ${
        active ? "border-cyan-400/25 shadow-[0_0_45px_-25px_rgba(56,189,248,.65)]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] text-cyan-300">
            LIVE CONTEXT
          </div>
          <div className="mt-1 text-[20px] font-bold tracking-[-0.035em] text-white">
            1,284 customers
          </div>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300">
          <Database size={17} />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          ["Percakapan", "8.4K"],
          ["Opportunity", "367"],
          ["Aktivitas", "2.1K"],
          ["Riwayat deal", "12.8K"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
            <div className="text-[8px] text-slate-500">{label}</div>
            <div className="mt-0.5 text-[9px] font-semibold text-slate-300">{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EngineMemoryCard({ active = false, compact = false }) {
  return (
    <div
      className={`nexto-command-glass rounded-[22px] ${compact ? "p-4" : "p-5"} transition-all duration-500 ${
        active ? "border-cyan-400/25 shadow-[0_0_50px_-25px_rgba(34,211,238,.6)]" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300">
          <Layers size={18} />
        </span>
        <div>
          <div className="text-[10px] font-bold tracking-[0.12em] text-cyan-300">
            MEMORY ENGINE
          </div>
          <div className="mt-1 text-[8px] uppercase tracking-[0.14em] text-slate-600">
            Understand the past
          </div>
        </div>
      </div>

      <p className="mt-4 text-[10px] leading-5 text-slate-400">
        Simpan customer state, histori, dan outcome supaya keputusan berikutnya
        tidak mulai dari nol.
      </p>

      <div className="mt-3 space-y-2">
        {["Customer state", "Outcome menang / kalah", "Pattern yang ditemukan"].map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
            <CheckCircle2 size={11} className="text-cyan-300" />
            <span className="text-[8px] text-slate-300">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EngineDecisionCard({ active = false, compact = false }) {
  return (
    <div
      className={`nexto-command-glass rounded-[22px] ${compact ? "p-4" : "p-5"} transition-all duration-500 ${
        active ? "border-orange-400/25 shadow-[0_0_50px_-25px_rgba(249,115,22,.65)]" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-400/20 bg-orange-400/[0.08] text-orange-300">
          <BrainCircuit size={18} />
        </span>
        <div>
          <div className="text-[10px] font-bold tracking-[0.12em] text-orange-300">
            NEXT BEST ACTION
          </div>
          <div className="mt-1 text-[8px] uppercase tracking-[0.14em] text-slate-600">
            Decide what matters
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-orange-400/15 bg-orange-400/[0.035] p-3">
        <div className="text-[8px] font-bold uppercase tracking-[0.14em] text-orange-300">
          High Priority
        </div>
        <div className="mt-1.5 text-[12px] font-bold text-white">
          PT ABC · Rp280 Juta
        </div>
        <div className="mt-1 text-[8px] leading-4 text-slate-500">
          Quotation 11 hari lalu · belum ada respons
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="flex items-center gap-2 text-[8px] text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Follow-up hari ini
        </span>
        <ArrowRight size={12} className="text-orange-300" />
      </div>
    </div>
  );
}

function EngineActionCard({ active = false, compact = false }) {
  return (
    <div
      className={`nexto-command-glass rounded-[22px] ${compact ? "p-4" : "p-5"} transition-all duration-500 ${
        active ? "border-purple-400/25 shadow-[0_0_50px_-25px_rgba(168,85,247,.65)]" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-400/[0.08] text-purple-300">
          <Zap size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold tracking-[0.12em] text-purple-300">
            ACTION ENGINE
          </div>
          <div className="mt-1 text-[8px] uppercase tracking-[0.14em] text-slate-600">
            Execute & measure
          </div>
        </div>
        <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-1 text-[7px] font-bold tracking-[0.12em] text-emerald-300">
          ACTIVE
        </span>
      </div>

      <p className="mt-4 text-[10px] leading-5 text-slate-400">
        Dari keputusan menjadi action nyata — tanpa kehilangan hasilnya dari loop.
      </p>

      <div className={`mt-4 grid ${compact ? "grid-cols-1" : "grid-cols-3"} gap-2`}>
        {[
          [MessageCircle, "Kirim follow-up"],
          [Calendar, "Jadwalkan"],
          [TrendingUp, "Ukur hasil"],
        ].map(([Icon, label]) => (
          <div key={label} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
            <Icon size={12} className="text-purple-300" />
            <span className="text-[8px] font-medium text-slate-300">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Toggle billing kecil, ditaro DI DALAM tiap kartu paket (bawah harga) -
// bukan bar toggle gede terpisah di atas grid (versi awal, user minta
// dipindah ke sini per-card, 9 Sep 2026). State billingCycle-nya tetep
// satu/shared dari parent, jadi klik toggle di kartu mana pun ngubah
// ketiga kartu sekaligus - cuma kontrolnya yang ditaro di tiap kartu.
function MiniBillingToggle({ billingCycle, setBillingCycle, accent }) {
  const activeBg = { slate: "bg-white text-slate-950", orange: "bg-orange-500 text-white", violet: "bg-violet-500 text-white" }[accent];
  return (
    <div className="mt-2 inline-flex items-center gap-0.5 rounded-full bg-white/[0.06] p-0.5">
      {/* min-h-[34px] - versi awal cuma ~21px tinggi (padding py-1), ketauan
          pas ngecek mobile kalau itu di bawah standar tap target nyaman
          (Apple/Google nyaranin ~44px; 34px kompromi biar tetep keliatan
          compact tapi gak susah dipencet jari, 9 Sep 2026). */}
      <button
        onClick={() => setBillingCycle("monthly")}
        className={`min-h-[34px] rounded-full px-3 text-[10px] font-bold transition-colors ${billingCycle === "monthly" ? activeBg : "text-slate-400 hover:text-slate-200"}`}
      >
        Bulanan
      </button>
      <button
        onClick={() => setBillingCycle("quarterly")}
        className={`min-h-[34px] rounded-full px-3 text-[10px] font-bold transition-colors ${billingCycle === "quarterly" ? activeBg : "text-slate-400 hover:text-slate-200"}`}
      >
        3 Bulan
      </button>
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // "tos" | "privacy" | null

  // Carousel horizontal section "Keamanan Akun" - scroll manual lewat
  // tombol panah, bukan library carousel terpisah (cuma 5 kartu, overkill).
  const securityScrollRef = useRef(null);
  const scrollSecurity = (dir) => {
    securityScrollRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  // Cloudflare Turnstile (captcha) - token sekali-pake, di-reset abis tiap
  // percobaan submit (sukses maupun gagal) biar gak nyoba dipake dua kali.
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef(null);
  const turnstileWidgetId = useRef(null);
  useEffect(() => {
    let cancelled = false;
    const tryRender = () => {
      if (cancelled || !turnstileRef.current || turnstileWidgetId.current) return;
      if (!window.turnstile) { setTimeout(tryRender, 200); return; }
      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      });
    };
    tryRender();
    return () => { cancelled = true; };
  }, []);
  // Toggle harga per kartu (Standard/Professional/Enterprise) - INDEPENDEN
  // satu sama lain, gak shared, biar klik "3 Bulan" di 1 kartu gak ikut
  // ngubah kartu lain (9 Sep 2026, sebelumnya shared dan itu kerasa aneh).
  const [standardCycle, setStandardCycle] = useState("monthly");
  const [professionalCycle, setProfessionalCycle] = useState("monthly");
  const [enterpriseCycle, setEnterpriseCycle] = useState("monthly");

  const chatbotVoice = useRobotVoice(ROBOT_CHATBOT_AUDIO);
  const engineLoopVoice = useRobotVoice(ROBOT_ENGINE_LOOP_AUDIO);

  const submit = async () => {
    setMsg("");

    if (mode === "signup") {
      if (!fullName.trim() || !companyName.trim()) {
        setMsg("Nama lengkap dan nama perusahaan wajib diisi.");
        return;
      }
      if (!Object.values(pwChecks(pw)).every(Boolean)) {
        setMsg("Password belum memenuhi semua syarat di bawah.");
        return;
      }
      if (!agreedTerms) {
        setMsg("Centang dulu persetujuan ketentuan layanan & kebijakan privasi.");
        return;
      }
    }

    // BUG FIX (10 Sep 2026) - sebelumnya di sini ADA hard-block "gak boleh
    // submit tanpa captchaToken", dan itu BIKIN SEMUA ORANG GAK BISA LOGIN
    // sama sekali begitu widget Turnstile gagal ngeluarin token (kejadian
    // nyata - token nyangkut kosong selamanya, gak ada UI buat user bantu
    // nyelesain verifikasinya, form-nya diem doang). Sekarang captchaToken
    // (isi apa adanya, walau kosong) tetep dikirim ke Supabase - biar
    // SERVER yang mutusin butuh captcha apa enggak, bukan frontend nge-
    // block preemptif. Kalau Supabase emang lagi wajibin captcha dan
    // tokennya kosong/invalid, error asli dari Supabase yang keliatan di
    // pesan (bukan diem gak bisa ngapa-ngapain).
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pw,
          options: { captchaToken },
        });

        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: { captchaToken },
        });

        if (error) throw error;

        // Data profil (nama, jabatan, perusahaan, WA) belum bisa langsung
        // disimpen ke tabel settings/organizations kalau Supabase masih
        // nunggu verifikasi email dulu (belum ada sesi aktif = belum boleh
        // nulis ke DB). Disimpen dulu di localStorage - App.jsx bakal
        // nerapin ini otomatis begitu akunnya beneran login pertama kali
        // (lihat pending profile check di reload()).
        try {
          localStorage.setItem("nexto_pending_profile", JSON.stringify({ fullName: fullName.trim(), jobTitle: jobTitle.trim(), companyName: companyName.trim(), whatsapp: whatsapp.trim() }));
        } catch {}

        if (!data.session) {
          setMsg("Akun dibuat. Cek email buat verifikasi, lalu masuk.");
        }
      }
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
      // Token Turnstile sekali-pake - reset widget-nya abis tiap percobaan
      // (sukses maupun gagal) biar dapet token baru buat percobaan berikutnya.
      setCaptchaToken("");
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.reset(turnstileWidgetId.current);
      }
    }
  };

  // Login/daftar pake Google - beda alur dari email/password (redirect ke
  // Google terus balik lagi ke sini), gak butuh captcha Turnstile kayak
  // signInWithPassword/signUp (Google sendiri yang jadi lapisan verifikasi
  // "bukan bot"-nya). Buat akun BARU yang pertama kali masuk lewat sini,
  // gak ada form isi nama/perusahaan dulu kayak signup email - App.jsx
  // ambil nama dari profil Google-nya (lihat reload() di App.jsx),
  // perusahaan dibiarin default (bisa diganti nanti di Pengaturan).
  const signInWithGoogle = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setMsg(error.message);
  };

  // Syarat password - dicek LIVE tiap ngetik, ditampilin sbg checklist biar
  // user tau persis kurang apa (bukan cuma "password terlalu lemah" doang).
  const pwChecks = (v) => ({
    length: v.length >= 8,
    upper: /[A-Z]/.test(v),
    lower: /[a-z]/.test(v),
    number: /[0-9]/.test(v),
    special: /[^A-Za-z0-9]/.test(v),
  });

  const goToSignup = () => {
    setMode("signup");
    setMsg("");

    setTimeout(() => {
      document.getElementById("daftar")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  // Dipanggil dari tombol pricing (Standard/Professional/Enterprise) - orang
  // HARUS bikin akun Nexto dulu sebelum bayar (biar webhook Mayar bisa
  // nyocokin email pembayaran ke akun yang benar - lihat catatan di
  // mayar-webhook.ts). Tier pilihan disimpen di localStorage biar dashboard
  // bisa nampilin banner "lanjutkan bayar [tier]" abis mereka selesai daftar.
  const chooseTierAndSignup = (tier) => {
    try { localStorage.setItem("nexto_intended_plan", tier); } catch {}
    goToSignup();
  };

  const goToSignin = () => {
    setMode("signin");
    setMsg("");

    setTimeout(() => {
      document.getElementById("daftar")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900 selection:bg-orange-100 selection:text-orange-900">
      {/* =========================================================
          NAVIGATION
      ========================================================== */}
      <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-7 lg:px-10">
          <a href="#" className="flex items-center">
            <NextoHeaderLogo width={150} />
          </a>

          <nav className="hidden items-center gap-7 md:flex">
            <a
              href="#cara-kerja"
              className="text-[12px] font-medium text-slate-500 transition hover:text-slate-950"
            >
              Cara Kerja
            </a>
            <a
              href="#industri"
              className="text-[12px] font-medium text-slate-500 transition hover:text-slate-950"
            >
              Industri
            </a>
            <a
              href="#keamanan"
              className="text-[12px] font-medium text-slate-500 transition hover:text-slate-950"
            >
              Keamanan
            </a>
            <a
              href="#harga"
              className="text-[12px] font-medium text-slate-500 transition hover:text-slate-950"
            >
              Harga
            </a>
          </nav>

          <div className="hidden items-center gap-2.5 md:flex">
            <button
              onClick={goToSignin}
              className="px-3 py-2 text-[12px] font-semibold text-slate-600 transition hover:text-slate-950"
            >
              Masuk
            </button>

            <button
              onClick={goToSignup}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-[12px] font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
            >
              Start Free
              <ArrowRight size={13} />
            </button>
          </div>

          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 md:hidden"
            aria-label="Menu"
          >
            {showMobileMenu ? <X size={17} /> : <span className="text-lg">☰</span>}
          </button>
        </div>

        {showMobileMenu && (
          <div className="border-t border-slate-100 bg-white px-5 py-4 md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {[
                ["#cara-kerja", "Cara Kerja"],
                ["#industri", "Industri"],
                ["#keamanan", "Keamanan"],
                ["#harga", "Harga"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setShowMobileMenu(false)}
                  className="rounded-xl px-3 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  {label}
                </a>
              ))}

              <button
                onClick={() => {
                  setShowMobileMenu(false);
                  goToSignup();
                }}
                className="mt-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
              >
                Start Free
              </button>
            </div>
          </div>
        )}
      </header>

      {/* =========================================================
          HERO
      ========================================================== */}
      <main>
        <section className="relative overflow-hidden bg-[#05070c]">
          {/* Background clean & konsisten sama section AI Engine Loops di
              bawahnya - grid halus + satu glow oranye di tengah, BUKAN 2
              blob oranye ngambang kayak sebelumnya (lebih rapi/minimal). */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              maskImage: "radial-gradient(circle at 50% 30%, black 0%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(circle at 50% 30%, black 0%, transparent 70%)",
            }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-[30%] h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-[130px]"
            style={{ background: "radial-gradient(circle, #f97316, transparent 70%)" }}
          />

          {/* Single-column, di-tengahin - headline jadi fokus utama, gak
              kebagi perhatian sama mockup produk lagi. */}
          <div className="relative mx-auto max-w-5xl px-5 py-20 text-center sm:px-7 sm:py-24 lg:px-10 lg:py-28">
            <div className="flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[8px] font-medium uppercase tracking-[0.14em] text-slate-400">
                <Users size={9} className="text-orange-500" />
                Built by Salesperson
              </span>
            </div>

            <div className="mt-4 flex justify-center">
              <SectionLabel>AI Sales Loop Engine</SectionLabel>
            </div>

            {/* === HEADLINE UPDATE (5 Sep 2026) ===
                Final pick abis beberapa ronde brainstorm: kontras
                "lo di lapangan" vs "Nexto kerja di belakang layar",
                pake istilah "plays" (playbook/strategi per lead) biar
                kesannya lebih strategic daripada "moves" yang generik. */}
            <h1 className="mx-auto mt-5 max-w-none text-[40px] font-bold leading-[1.0] tracking-[-0.055em] text-white sm:text-[56px] lg:text-[68px]">
              You sell. Nexto thinks.
              <span className="block text-orange-500">
                Always know what’s next.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-[15px] leading-7 text-slate-400 sm:text-[16px]">
              Nexto turns your sales data, conversations, and customer activity into your next best action.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={goToSignup}
                className="group inline-flex items-center gap-2.5 rounded-xl bg-orange-600 px-5 py-3.5 text-[12px] font-bold text-white shadow-[0_14px_34px_-12px_rgba(234,88,12,0.6)] transition hover:-translate-y-0.5 hover:bg-orange-500"
              >
                Start Free
                <ArrowRight
                  size={14}
                  className="transition group-hover:translate-x-0.5"
                />
              </button>

              <a
                href="#cara-kerja"
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3.5 text-[12px] font-bold text-slate-200 transition hover:border-white/25 hover:bg-white/[0.08]"
              >
                <Play size={12} />
                Lihat cara kerja
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <CircleCheck size={12} className="text-emerald-500" />
                Start Free
              </span>
              <span className="flex items-center gap-1.5">
                <CircleCheck size={12} className="text-emerald-500" />
                Tanpa setup ribet
              </span>
              <span className="flex items-center gap-1.5">
                <CircleCheck size={12} className="text-emerald-500" />
                Untuk semua industri
              </span>
            </div>

          </div>
        </section>

        {/* =========================================================
            NEXTO AI SALES ENGINE
            TAMBAHAN — LANDING PAGE EXISTING TETAP
        ========================================================== */}
        <NextoAISalesEngine robotVoice={chatbotVoice} />

        {/* =========================================================
            NEXTO AI ENGINE LOOPS - section sendiri, gak digabung sama
            section lain. Diagram signature nunjukin gimana engine-nya
            beneran jalan (Context -> Decision -> Action -> Memory -> loop).
        ========================================================== */}
        <AiEngineLoopSection robotVoice={engineLoopVoice} />

        {/* =========================================================
            UNIVERSAL INDUSTRIES
        ========================================================== */}
        <section
          id="industri"
          className="bg-[#f8f7f4] px-5 py-20 sm:px-7 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel>Universal sales engine</SectionLabel>

              <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] text-slate-950 sm:text-[48px]">
                One sales engine.
                <span className="block text-orange-600">Any industry.</span>
              </h2>

              <p className="mt-5 text-[13px] leading-6 text-slate-500">
                Fundamental sales problem-nya sama. Nexto menyesuaikan konteks
                dan proses penjualan perusahaan Anda.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {INDUSTRIES.map((industry, index) => (
                <div
                  key={industry.label}
                  className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-[#fbfaf8] p-6 transition hover:border-orange-200"
                >
                  <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-orange-100/50 blur-2xl transition group-hover:bg-orange-200/60" />

                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-bold tracking-[0.16em] text-orange-600">
                        {industry.label}
                      </div>
                      <span className="text-[9px] font-bold text-slate-300">
                        0{index + 1}
                      </span>
                    </div>

                    <div className="mt-8 text-[13px] font-semibold tracking-tight text-slate-800 sm:text-[14px]">
                      {industry.flow}
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-[9px] font-medium text-slate-400">
                      <CircleCheck size={12} className="text-emerald-500" />
                      Powered by the same sales engine
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center">
              <div className="text-[12px] font-bold text-slate-800">
                Different industries. Same fundamental sales problem.
              </div>
              <div className="mt-1 text-[10px] leading-5 text-slate-400">
                Lead → Understand → Contact → Offer → Follow-up → Negotiate →
                Close → Repeat.
              </div>
            </div>

          </div>
        </section>

        {/* =========================================================
            KEAMANAN - carousel horizontal (layout ala Hostinger), tapi
            warna balik terang (bg-[#fbfaf8]) matching sisa landing page -
            versi gelap sempet dicoba, user minta balik terang lagi
            (11 Sep 2026).
        ========================================================== */}
        <section id="keamanan" className="relative overflow-hidden bg-[#fbfaf8] px-5 py-20 sm:px-7 sm:py-28 lg:px-10">
          <div className="relative mx-auto max-w-7xl">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-xl">
                <SectionLabel>Keamanan</SectionLabel>
                <h2 className="mt-4 text-[32px] font-bold leading-tight tracking-[-0.04em] text-slate-950 sm:text-[44px]">
                  Data lead Anda,
                  <span className="block text-orange-600">dijaga kayak brankas.</span>
                </h2>
                <p className="mt-4 text-[13px] leading-6 text-slate-500">
                  Ribuan lead & histori progress ada di CRM ini — kami ngerti itu aset bisnis Anda. Makanya keamanan akun bukan fitur tempelan.
                </p>
              </div>
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                <button
                  onClick={() => scrollSecurity(-1)}
                  aria-label="Kartu sebelumnya"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-orange-300 hover:text-orange-600"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => scrollSecurity(1)}
                  aria-label="Kartu berikutnya"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:border-orange-300 hover:text-orange-600"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div
              ref={securityScrollRef}
              className="mt-10 flex gap-4 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {SECURITY_FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="group w-[270px] shrink-0 rounded-[24px] border border-slate-200 bg-white p-6 transition hover:border-orange-200"
                    style={{ scrollSnapAlign: "start" }}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                      <Icon size={19} />
                    </div>
                    <div className="mt-5 text-[15px] font-bold tracking-tight text-slate-900">{f.title}</div>
                    <p className="mt-2 text-[12px] leading-5 text-slate-500">{f.desc}</p>
                  </div>
                );
              })}
            </div>

            <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center">
              <div className="text-[12px] font-bold text-slate-800">
                Transparan soal data Anda
              </div>
              <div className="mt-1 text-[10px] leading-5 text-slate-400">
                Data lead/progress tetap milik Anda, gak pernah dijual ke pihak ketiga. Sebagian fitur AI memang mengirim data relevan ke Anthropic (Claude) &amp; OpenAI untuk diproses — kami sebutkan jelas apa & kenapa di{" "}
                <button onClick={() => setLegalModal("privacy")} className="font-semibold text-orange-600 underline hover:text-orange-700">
                  Kebijakan Privasi
                </button>.
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            PRICING
        ========================================================== */}
        <section
          id="harga"
          className="relative overflow-hidden bg-[#05070c] px-5 py-20 text-white sm:px-7 sm:py-28 lg:px-10"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-70"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.045) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "linear-gradient(to bottom, rgba(0,0,0,.7), transparent 75%)",
              WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,.7), transparent 75%)",
            }}
          />

          <div className="relative mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-[34px] font-bold leading-tight tracking-[-0.045em] text-white sm:text-[46px]">
                Berapa banyak "karyawan AI"
                <span className="block text-slate-500">yang mau Anda pekerjakan?</span>
              </h2>
              {isEarlyBird && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-[13px] font-bold text-orange-300 sm:text-sm">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                  </span>
                  Early Bird Registration — daftar sebelum 30 September 2026
                </div>
              )}
            </div>

            <div className="mx-auto mt-14 grid max-w-6xl gap-5 lg:grid-cols-3 lg:items-start">
              {/* ---- STANDARD - AI engine OFF ---- */}
              <div className="rounded-[26px] border border-white/[0.08] bg-white/[0.02] p-7">
                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
                  Mode Standar
                </div>

                <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Standard
                </div>

                <div className="mt-3 flex items-end gap-2">
                  {isEarlyBird && (
                    <span className="mb-1 text-xl font-semibold text-slate-600 line-through">
                      {standardCycle === "monthly" ? PRICING_NORMAL.standard.monthlyPrice : PRICING_NORMAL.standard.quarterlyTotal}
                    </span>
                  )}
                  <span className="text-[38px] font-bold tracking-[-0.05em] text-white">
                    {standardCycle === "monthly" ? PRICING.standard.monthlyPrice : PRICING.standard.quarterlyTotal}
                  </span>
                  <span className="mb-1.5 text-[10px] text-slate-500">{standardCycle === "monthly" ? "/bulan" : "/3 bulan"}</span>
                </div>

                <div className="mt-1 text-[10px] text-slate-500">
                  CRM inti + AI ringan — untuk yang mau rapiin data leads dulu
                </div>
                <MiniBillingToggle billingCycle={standardCycle} setBillingCycle={setStandardCycle} accent="slate" />
                {isEarlyBird && (
                  <div className="mt-1.5 text-[9px] text-slate-500">Hemat {standardCycle === "monthly" ? PRICING.standard.monthlySavings + "/bulan" : PRICING.standard.quarterlySavings} selama early bird</div>
                )}

                <div className="my-7 h-px bg-white/[0.06]" />

                <ul className="space-y-3">
                  {STANDARD_FEATURES.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-[11px] text-slate-400"
                    >
                      <Check size={13} className="mt-0.5 shrink-0 text-slate-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => chooseTierAndSignup("standard")}
                  className="mt-8 w-full rounded-xl border border-white/10 py-3 text-[11px] font-bold text-slate-300 transition hover:bg-white/[0.05]"
                >
                  Mulai Standard
                </button>
              </div>

              {/* ---- PROFESSIONAL - AI engine ON (recommended) ---- */}
              <div className="relative overflow-hidden rounded-[26px] border border-orange-500/30 bg-gradient-to-b from-orange-500/[0.07] to-white/[0.02] p-7 shadow-[0_25px_70px_-35px_rgba(234,88,12,0.5)] lg:-translate-y-3">
                <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-orange-500/20 blur-[70px]" />
                <div className="absolute right-5 top-5 rounded-full bg-orange-500/10 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-orange-400">
                  Paling Direkomendasikan
                </div>

                <div className="relative flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-orange-400">
                  <span className="relative inline-flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
                    <span className="relative inline-flex h-full w-full rounded-full bg-orange-400" />
                  </span>
                  AI Engine Aktif
                </div>

                <div className="relative mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-orange-400">
                  Professional
                </div>

                <div className="relative mt-3 flex items-end gap-2">
                  {isEarlyBird && (
                    <span className="mb-1 text-xl font-semibold text-orange-200/40 line-through">
                      {professionalCycle === "monthly" ? PRICING_NORMAL.professional.monthlyPrice : PRICING_NORMAL.professional.quarterlyTotal}
                    </span>
                  )}
                  <span className="text-[38px] font-bold tracking-[-0.05em] text-white">
                    {professionalCycle === "monthly" ? PRICING.professional.monthlyPrice : PRICING.professional.quarterlyTotal}
                  </span>
                  <span className="mb-1.5 text-[10px] text-slate-500">{professionalCycle === "monthly" ? "/bulan" : "/3 bulan"}</span>
                </div>

                <div className="relative mt-1 text-[10px] text-slate-400">
                  AI Sales Engine penuh — solo, tapi kerja kayak ada tim
                </div>
                <div className="relative">
                  <MiniBillingToggle billingCycle={professionalCycle} setBillingCycle={setProfessionalCycle} accent="orange" />
                </div>
                {isEarlyBird && (
                  <div className="relative mt-1.5 text-[9px] text-orange-300/80">Hemat {professionalCycle === "monthly" ? PRICING.professional.monthlySavings + "/bulan" : PRICING.professional.quarterlySavings} selama early bird</div>
                )}

                <div className="relative my-7 h-px bg-white/[0.08]" />

                <ul className="relative space-y-3">
                  {PROFESSIONAL_FEATURES.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-[11px] text-slate-300"
                    >
                      <Check size={13} className="mt-0.5 shrink-0 text-orange-400" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => chooseTierAndSignup("premium")}
                  className="relative mt-8 w-full rounded-xl bg-orange-600 py-3 text-[11px] font-bold text-white shadow-sm transition hover:bg-orange-500"
                >
                  Upgrade ke Professional
                </button>
              </div>

              {/* ---- ENTERPRISE - AI engine ON, tim ---- */}
              <div className="relative overflow-hidden rounded-[26px] border border-violet-500/30 bg-gradient-to-b from-violet-500/[0.08] to-white/[0.02] p-7 shadow-[0_25px_70px_-35px_rgba(124,58,237,0.5)]">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-violet-500/20 blur-[70px]" />

                <div className="relative">
                  <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-violet-300">
                    <span className="relative inline-flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-60" />
                      <span className="relative inline-flex h-full w-full rounded-full bg-violet-400" />
                    </span>
                    AI Engine + Tim
                  </div>

                  <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-violet-300">
                    Enterprise
                  </div>

                  <div className="mt-3 flex items-end gap-2">
                    {isEarlyBird && (
                      <span className="mb-1 text-xl font-semibold text-violet-200/40 line-through">
                        {enterpriseCycle === "monthly" ? PRICING_NORMAL.enterprise.monthlyPrice : PRICING_NORMAL.enterprise.quarterlyTotal}
                      </span>
                    )}
                    <span className="text-[38px] font-bold tracking-[-0.05em] text-white">
                      {enterpriseCycle === "monthly" ? PRICING.enterprise.monthlyPrice : PRICING.enterprise.quarterlyTotal}
                    </span>
                    <span className="mb-1.5 text-[10px] text-slate-500">{enterpriseCycle === "monthly" ? "/bulan" : "/3 bulan"}</span>
                  </div>

                  <div className="mt-1 text-[10px] text-slate-400">
                    Untuk 4 orang (≈{PRICING.enterprise.perPerson}/orang) — tim sales dengan visibilitas penuh
                  </div>

                  {/* Tim lebih dari 4 orang - bukan harga standar, arahin
                      langsung ngobrol sama SASA (yang udah dibekelin cara
                      jawab kasus ini) daripada nyoba masukin harga custom
                      ke tabel harga publik. Warna amber sengaja kontras
                      sama tema violet kartu ini, tapi HALUS - outline
                      tipis + teks violet muda, bukan pill solid warna
                      nyala (amber kesannya "warning", ketauan kurang pas
                      buat CTA upsell premium - direvisi 9 Sep 2026). */}
                  <button
                    onClick={() => window.__nextoOpenSasaChat?.("Saya butuh tim lebih dari 4 orang, ada opsi harga khusus?")}
                    className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 px-3 py-1.5 text-[10px] font-semibold text-violet-200 transition hover:border-violet-400/50 hover:text-white"
                  >
                    Butuh tim lebih dari 4 orang? Hubungi kami
                  </button>

                  <div className="mt-3">
                    <MiniBillingToggle billingCycle={enterpriseCycle} setBillingCycle={setEnterpriseCycle} accent="violet" />
                  </div>
                  {isEarlyBird && (
                    <div className="mt-1.5 text-[9px] text-violet-300/80">Hemat {enterpriseCycle === "monthly" ? PRICING.enterprise.monthlySavings + "/bulan" : PRICING.enterprise.quarterlySavings} selama early bird</div>
                  )}

                  <div className="my-7 h-px bg-white/10" />

                  <ul className="space-y-3">
                    {ENTERPRISE_FEATURES.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-[11px] text-slate-300"
                      >
                        <Check size={13} className="mt-0.5 shrink-0 text-violet-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => chooseTierAndSignup("enterprise")}
                    className="mt-8 w-full rounded-xl bg-violet-600 py-3 text-[11px] font-bold text-white shadow-sm transition hover:bg-violet-500"
                  >
                    Upgrade ke Enterprise
                  </button>
                </div>
              </div>
            </div>

            <p className="mx-auto mt-8 max-w-xl text-center text-[10px] leading-relaxed text-slate-500">
              Penting: pas isi form di halaman pembayaran, pakai <b className="text-slate-300">email yang sama persis</b> dengan email akun Nexto Anda — supaya akun Anda otomatis ke-upgrade begitu pembayaran selesai.
            </p>
          </div>
        </section>

        {/* =========================================================
            FINAL CTA + AUTH
        ========================================================== */}
        <section
          id="daftar"
          className="bg-[#080a0d] px-5 py-20 text-white sm:px-7 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_390px]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-orange-400">
                  <Sparkles size={11} />
                  Start your next sales loop
                </div>

                <h2 className="mt-6 max-w-2xl text-[38px] font-bold leading-[1.05] tracking-[-0.05em] sm:text-[54px]">
                  Your next deal is already somewhere in your pipeline.
                  <span className="block text-orange-400">
                    Let Nexto find it.
                  </span>
                </h2>

                <p className="mt-5 max-w-xl text-[13px] leading-6 text-slate-400">
                  Start Free dan biarkan Nexto membantu sales Anda tahu
                  apa yang harus dilakukan berikutnya.
                </p>

                <div className="mt-7 flex flex-wrap gap-4 text-[10px] text-slate-500">
                  <span className="flex items-center gap-2">
                    <CircleCheck size={12} className="text-emerald-500" />
                    Free plan
                  </span>
                  <span className="flex items-center gap-2">
                    <CircleCheck size={12} className="text-emerald-500" />
                    Multi-industry
                  </span>
                  <span className="flex items-center gap-2">
                    <CircleCheck size={12} className="text-emerald-500" />
                    AI-powered
                  </span>
                </div>
              </div>

              <div className="scroll-mt-24">
                <div className="rounded-[28px] border border-white/[0.09] bg-white/[0.04] p-6 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.8)] sm:p-7">
                  <div className="mb-6 flex items-center justify-between gap-3">
                    <NextoDarkWordmark width={108} />
                    <div className="text-right">
                      <div className="text-[8px] text-slate-500">
                        Sales Loop Engine
                      </div>
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-orange-400">
                      {mode === "signin" ? "Welcome back" : "Start free"}
                    </div>

                    <h3 className="mt-2 text-[22px] font-bold tracking-tight text-white">
                      {mode === "signin"
                        ? "Masuk ke Nexto"
                        : "Buat akun Nexto"}
                    </h3>

                    <p className="mt-1 text-[10px] leading-5 text-slate-500">
                      {mode === "signin"
                        ? "Lanjutkan mengelola sales loop Anda."
                        : "Gratis buat mulai. Upgrade kapan Anda siap."}
                    </p>

                    {mode === "signup" && (() => {
                      let intended = null;
                      try { intended = localStorage.getItem("nexto_intended_plan"); } catch {}
                      const label = { standard: "Standard", premium: "Professional", enterprise: "Enterprise" }[intended];
                      if (!label) return null;
                      return (
                        <div className="mt-3 rounded-lg border border-orange-500/20 bg-orange-500/[0.06] px-3 py-2 text-[10px] leading-4 text-orange-300">
                          Anda pilih paket <b>{label}</b> — daftar gratis dulu di sini, abis itu kita arahin buat pembayarannya.
                        </div>
                      );
                    })()}
                  </div>

                  <div className="space-y-3">
                    {mode === "signup" && (
                      <>
                        <div>
                          <label className="mb-1.5 block text-[9px] font-semibold text-slate-400">
                            NAMA LENGKAP <span className="text-orange-400">*</span>
                          </label>
                          <input
                            type="text"
                            className="w-full rounded-xl border border-white/[0.09] bg-white/[0.05] px-3.5 py-3 text-[11px] text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500/60 focus:ring-4 focus:ring-orange-500/10"
                            placeholder="Nama Anda"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1.5 block text-[9px] font-semibold text-slate-400">
                              JABATAN
                            </label>
                            <input
                              type="text"
                              className="w-full rounded-xl border border-white/[0.09] bg-white/[0.05] px-3.5 py-3 text-[11px] text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500/60 focus:ring-4 focus:ring-orange-500/10"
                              placeholder="Sales Manager"
                              value={jobTitle}
                              onChange={(e) => setJobTitle(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-[9px] font-semibold text-slate-400">
                              NO. WHATSAPP
                            </label>
                            <input
                              type="tel"
                              className="w-full rounded-xl border border-white/[0.09] bg-white/[0.05] px-3.5 py-3 text-[11px] text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500/60 focus:ring-4 focus:ring-orange-500/10"
                              placeholder="0812xxxxxxx"
                              value={whatsapp}
                              onChange={(e) => setWhatsapp(e.target.value)}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-[9px] font-semibold text-slate-400">
                            NAMA PERUSAHAAN <span className="text-orange-400">*</span>
                          </label>
                          <input
                            type="text"
                            className="w-full rounded-xl border border-white/[0.09] bg-white/[0.05] px-3.5 py-3 text-[11px] text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500/60 focus:ring-4 focus:ring-orange-500/10"
                            placeholder="PT / CV Anda"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="mb-1.5 block text-[9px] font-semibold text-slate-400">
                        EMAIL {mode === "signup" && <span className="text-orange-400">*</span>}
                      </label>
                      <input
                        type="email"
                        className="w-full rounded-xl border border-white/[0.09] bg-white/[0.05] px-3.5 py-3 text-[11px] text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500/60 focus:ring-4 focus:ring-orange-500/10"
                        placeholder="nama@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[9px] font-semibold text-slate-400">
                        PASSWORD {mode === "signup" && <span className="text-orange-400">*</span>}
                      </label>
                      <input
                        type="password"
                        className="w-full rounded-xl border border-white/[0.09] bg-white/[0.05] px-3.5 py-3 text-[11px] text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500/60 focus:ring-4 focus:ring-orange-500/10"
                        placeholder="••••••••"
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        onKeyDown={(e) =>
                          e.key === "Enter" && submit()
                        }
                      />
                      {mode === "signup" && (() => {
                        const checks = pwChecks(pw);
                        const items = [
                          [checks.length, "Minimal 8 karakter"],
                          [checks.upper, "Ada huruf besar (A-Z)"],
                          [checks.lower, "Ada huruf kecil (a-z)"],
                          [checks.number, "Ada angka (0-9)"],
                          [checks.special, "Ada karakter spesial (!@#$dll, minimal 1)"],
                        ];
                        return (
                          <div className="mt-2.5 grid grid-cols-1 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                            {items.map(([ok, label]) => (
                              <div key={label} className={`flex items-center gap-2 text-[9.5px] ${ok ? "text-emerald-400" : "text-slate-500"}`}>
                                {ok ? <CheckCircle2 size={12} className="shrink-0" /> : <span className="ml-0.5 mr-0.5 h-3 w-3 shrink-0 rounded-full border border-slate-600" />}
                                {label}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {msg && (
                      <div className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-[9px] leading-5 text-rose-300">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        <span>{msg}</span>
                      </div>
                    )}

                    {mode === "signup" && (
                      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[9.5px] leading-4 text-slate-400">
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-orange-500"
                          checked={agreedTerms}
                          onChange={(e) => setAgreedTerms(e.target.checked)}
                        />
                        <span>
                          Saya setuju menggunakan Nexto sesuai{" "}
                          <button type="button" onClick={(e) => { e.preventDefault(); setLegalModal("tos"); }} className="text-orange-400 underline hover:text-orange-300">ketentuan layanan</button>{" "}
                          dan{" "}
                          <button type="button" onClick={(e) => { e.preventDefault(); setLegalModal("privacy"); }} className="text-orange-400 underline hover:text-orange-300">kebijakan privasi</button>{" "}
                          yang berlaku.
                        </span>
                      </label>
                    )}

                    <div ref={turnstileRef} className="flex justify-center" />

                    <button
                      onClick={submit}
                      disabled={loading || (mode === "signup" && !agreedTerms)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-[11px] font-bold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loading && (
                        <Loader2 size={14} className="animate-spin" />
                      )}
                      {mode === "signin"
                        ? "Masuk ke Nexto"
                        : "Buat Akun Gratis"}
                      {!loading && <ArrowRight size={13} />}
                    </button>

                    <div className="flex items-center gap-3 py-1">
                      <div className="h-px flex-1 bg-white/[0.08]" />
                      <span className="text-[9px] uppercase tracking-wide text-slate-500">atau</span>
                      <div className="h-px flex-1 bg-white/[0.08]" />
                    </div>

                    <button
                      type="button"
                      onClick={signInWithGoogle}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-3 text-[11px] font-semibold text-white transition hover:bg-white/[0.08]"
                    >
                      <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C33.9 5.4 29.2 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-3.5z" />
                        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.6 15.5 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C33.9 5.4 29.2 3 24 3c-7.6 0-14.1 4.3-17.7 10.7z" />
                        <path fill="#4CAF50" d="M24 45c5.1 0 9.8-2 13.3-5.2l-6.2-5.2c-2 1.4-4.5 2.2-7.1 2.2-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.8 40.6 16.3 45 24 45z" />
                        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.2 5.2C40.9 36 44 30.5 44 24c0-1.4-.1-2.7-.4-3.5z" />
                      </svg>
                      {mode === "signin" ? "Masuk dengan Google" : "Daftar dengan Google"}
                    </button>

                    <button
                      onClick={() => {
                        setMode(mode === "signin" ? "signup" : "signin");
                        setMsg("");
                      }}
                      className="w-full py-2 text-[9px] font-medium text-slate-500 transition hover:text-white"
                    >
                      {mode === "signin"
                        ? "Belum punya akun? Daftar gratis"
                        : "Sudah punya akun? Masuk"}
                    </button>
                  </div>

                  {mode === "signin" && (
                    <div className="mt-5 border-t border-white/[0.06] pt-4 text-center text-[8px] leading-4 text-slate-600">
                      Dengan masuk, Anda setuju menggunakan Nexto sesuai{" "}
                      <button onClick={() => setLegalModal("tos")} className="underline hover:text-slate-400">ketentuan layanan</button>{" "}
                      dan{" "}
                      <button onClick={() => setLegalModal("privacy")} className="underline hover:text-slate-400">kebijakan privasi</button>{" "}
                      yang berlaku.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================
          FOOTER
      ========================================================== */}
      <footer className="border-t border-white/[0.06] bg-[#080a0d] px-5 pb-8 text-white sm:px-7 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-white/[0.06] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <NextoDarkWordmark width={82} />
            <div className="text-[8px] text-slate-600">
              Sales Loop Engine
            </div>
          </div>

          <div className="text-[9px] text-slate-600">
            © {new Date().getFullYear()} Nexto. Built for modern sales teams.
          </div>
        </div>

        {/* ---- LEGAL LINKS ----
            Link WA "Butuh Bantuan? Chat Support" yang dulu di sini DIHAPUS
            (9 Sep 2026) - numpuk sama bubble chat SASA yang fixed di pojok
            kanan bawah begitu discroll ke footer. Jalan pintas ke WA
            sekarang ada DI DALAM panel SASA sendiri (header widget-nya). */}
        <div className="mx-auto mt-5 flex max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.06] pt-5 text-[9px] text-slate-500">
          <button onClick={() => setLegalModal("tos")} className="hover:text-slate-300 transition">Ketentuan Layanan</button>
          <button onClick={() => setLegalModal("privacy")} className="hover:text-slate-300 transition">Kebijakan Privasi</button>
        </div>
      </footer>

      {legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} supportWaNumber={SUPPORT_WA_NUMBER} />}
      <SupportChatWidget supportWaNumber={SUPPORT_WA_NUMBER} />
    </div>
  );
}
