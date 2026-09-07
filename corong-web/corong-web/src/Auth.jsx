
Today 1:59 PM
a93d0d8d-5a98-4031-a917-d48cc8e0e9f9.png
bro lu punya design lain gak yang lebih menarik untuk ini

Edit


ada yang lain?

Edit

Nah bro, yang kedua ini menurut gue lebih kuat. Flow-nya lebih jelas: Context → Reason → Plan → Act → Learn, jadi konsep agentic loop-nya langsung kebaca.

Kalau buat landing page Nexto, gue malah akan lanjut eksplor 2–3 arah:

AI Brain / Neural Core — lebih futuristik dan “AI-first”.

Sales Command Center — lebih enterprise, banyak live opportunity yang bergerak.

Agentic Loop Visualization — fokus 100% ke loop, dengan customer → AI → action → result → learning yang muter terus.

Kalau lu mau, gue bisa bikin versi nomor 2: Sales Command Center yang jauh lebih “wow” dan kelihatan seperti dashboard perusahaan masa depan, bukan sekadar infographic.



Pasted markdown(3).md
File
bro ini codenya, tolong lu ganti page NEXTO AI Engine Loops dengan design yang kedua yang lu buat

Bisa bro. Gue udah ganti section NEXTO AI Engine Loops di code lu dengan konsep design kedua yang tadi gue buat. 


Yang berubah:

NEXTO AI CORE jadi pusat visual utama

Flow atas: Think → Remember → Act → Improve

Context masuk ke AI Core

Memory Engine di kiri

Decision Engine di kanan

Action & Feedback di bawah

Ada Real-time Insight

Orbit dan particle animation

Gradient cyan → blue → purple → orange

Ada visual loop:
Context → Reason → Plan → Act → Learn

Responsive untuk mobile/tablet

Tombol Listen robot tetap gue pertahankan

Section lama gue replace, jadi nggak perlu bongkar bagian lain

Full code yang sudah direvisi


Menurut gue ini jauh lebih cocok dengan positioning Nexto yang lagi kita bangun: bukan sekadar CRM dengan AI, tapi sebuah AI Sales Engine yang punya loop sendiri. 🔥 




Library
/
Nexto_Landing_Engine_Loops_Redesign.md


import { useEffect, useState, useRef } from "react";
import { supabase } from "./lib/supabaseClient";
import IndustryDemo from "./tabs/IndustryDemo";
import LegalModal from "./components/LegalModal";
import {
  Loader2,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Sparkles,
  BrainCircuit,
  Target,
  MessageSquare,
  Clock3,
  TrendingUp,
  MapPin,
  Calendar,
  Mic,
  Send,
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
  KeyRound,
  Lock,
  History,

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

export function NextoRobotHead({ size = 32, className = "", speaking = false }) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {speaking && (
        <style>{`
          @keyframes nexto-talk-bar {
            0%, 100% { transform: scaleY(0.5); }
            50% { transform: scaleY(1.15); }
          }
        `}</style>
      )}
      <div
        className="absolute rounded-[28%] border"
        style={{
          inset: "8%",
          background:
            "linear-gradient(145deg, #f3f5f7 0%, #cbd2da 48%, #9aa5b2 100%)",
          borderColor: "#7f8b98",
          boxShadow:
            "0 3px 8px rgba(15,23,42,.14), inset 0 1px 1px rgba(255,255,255,.9)",
        }}
      />
      <div
        className="absolute flex items-center justify-center rounded-full"
        style={{
          width: "58%",
          height: "30%",
          background: "#171717",
          boxShadow: "inset 0 1px 3px rgba(0,0,0,.35)",
        }}
      >
        <span
          className="mr-1 rounded-full"
          style={{
            width: "10%",
            height: "24%",
            background: "#f97316",
            boxShadow: "0 0 5px rgba(249,115,22,.7)",
            animation: speaking ? "nexto-talk-bar 0.42s ease-in-out infinite" : "none",
            animationDelay: speaking ? "0.08s" : "0s",
          }}
        />
        <span
          className="rounded-full"
          style={{
            width: "10%",
            height: "24%",
            background: "#f97316",
            boxShadow: "0 0 5px rgba(249,115,22,.7)",
            animation: speaking ? "nexto-talk-bar 0.42s ease-in-out infinite" : "none",
          }}
        />
      </div>
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
const SECURITY_FEATURES = [
  {
    icon: ShieldCheck,
    title: "Autentikasi 2 Langkah (2FA)",
    desc: "Aktifin 2FA pakai app authenticator (Google Authenticator, Authy, dll) — abis password bener, login masih minta kode 6 digit. Akun tetep aman walau password bocor.",
  },
  {
    icon: KeyRound,
    title: "Kode Recovery",
    desc: "Begitu 2FA aktif, kamu dikasih 10 kode cadangan sekali-pakai. HP hilang atau app authenticator-nya kehapus? Tinggal pakai satu kode itu buat tetep bisa masuk — gak pernah kekunci permanen dari akun sendiri.",
  },
  {
    icon: Lock,
    title: "Data Timmu Terisolasi",
    desc: "Row Level Security (RLS) mastiin data organisasimu gak bisa ketembus/keliatan sama organisasi lain, sekalipun sama-sama pengguna Nexto.",
  },
  {
    icon: History,
    title: "Audit Log Aktivitas",
    desc: "Perubahan sensitif (hapus lead, hapus kompetitor, dst) tercatat rapi — gampang ditelusuri kalau ada yang perlu dicek ulang.",
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
  "Smart Import AI",
  "Vector Memory ringan (AI inget catatan lama yang relevan)",
  "Recycle Bin",
  "Deteksi Duplikat",
  "Nex — Komunitas Sesama Sales",
  "Daily Digest (rekomendasi AI harian)",
];

const PROFESSIONAL_FEATURES = [
  "Semua fitur Standard",
  "Bot Telegram (edit CRM, progress harian, jadwal visit)",
  "Sinkron otomatis ke Google Calendar",
  "Generate Leads AI (4x/bulan)",
  "Rekam Meeting otomatis (AI)",
  "Customer State (AI)",
  "Outcome Memory (AI)",
  "AI Advisor harian",
  "AI Draft Follow-up (WhatsApp & Email)",
  "Analisa Kompetitor",
];

const ENTERPRISE_FEATURES = [
  "Semua fitur Professional",
  "GPS Check-in (tracking kunjungan tim real-time)",
  "4 anggota tim dalam satu organisasi",
  "Role-based visibility (Owner/Manager/Sales Rep)",
  "Undang anggota tim via kode invite",
  "Bot Telegram kirim email otonom",
  "Approval-gate & keamanan tim",
  "Prioritas support",
];

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
          "radial-gradient(circle at 50% 42%, #24150b 0%, #0d0b09 34%, #050505 72%)",
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
      <div className="absolute left-1/2 top-[45%] -translate-x-1/2 w-[480px] h-[480px] rounded-full bg-orange-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute left-[8%] top-[25%] w-[220px] h-[220px] rounded-full bg-orange-500/5 blur-[100px] pointer-events-none" />
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
            Kamu cukup{" "}
            <span className="text-orange-500">ngomong.</span>
            <br />
            Nexto yang kerja.
          </h2>

          <p className="mt-5 text-sm md:text-base leading-7 text-stone-400 max-w-2xl mx-auto">
            Chatbot Nexto menjadi pusat kendali sales kamu. Satu chat bisa
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
              description="Cukup bilang kapan dan siapa yang mau kamu visit. Nexto otomatis membuat jadwal dan menyinkronkannya ke Google Calendar."
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
            Itu yang kamu liat & ajak ngobrol.
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
// NEXTO AI ENGINE LOOPS - redesigned as the "AI Core" command center.
// Flow: Context -> Reason -> Plan -> Act -> Learn.
// The visual is intentionally closer to a futuristic product console:
// one central intelligence core, three functional engines, live signals,
// and a visible feedback loop.
// ============================================================

const LOOP_MODULES = [
  {
    key: "memory",
    label: "MEMORY ENGINE",
    kicker: "Learn & Remember",
    icon: Layers,
    color: "#22d3ee",
    description:
      "Simpan hal yang relevan — customer state, histori, outcome menang/kalah, dan insight penting.",
    items: ["Customer history", "Deal outcomes", "Pattern & insights"],
  },
  {
    key: "decision",
    label: "DECISION ENGINE",
    kicker: "Plan & Decide",
    icon: BrainCircuit,
    color: "#f59e0b",
    description:
      "Tentukan apa yang sedang terjadi, next action apa, kenapa, dan kapan waktu yang paling tepat.",
    items: ["Prioritize leads", "Recommend next action", "Optimal timing"],
  },
  {
    key: "action",
    label: "ACTION & FEEDBACK",
    kicker: "Take Action & Improve",
    icon: Zap,
    color: "#2dd4bf",
    description:
      "Jalankan action, update hasil, ukur performa, lalu bawa hasilnya kembali ke loop.",
    items: ["Send message", "Update CRM", "Track results"],
  },
];

function AiEngineLoopSection({ robotVoice }) {
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPulse((prev) => (prev + 1) % 4);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      id="cara-kerja"
      className="relative overflow-hidden bg-[#05070c] px-5 pb-24 pt-12 text-white sm:px-7 sm:pb-32 sm:pt-16 lg:px-10"
    >
      <style>{`
        @keyframes nexto-ai-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes nexto-ai-orbit-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes nexto-ai-core {
          0%, 100% {
            transform: scale(1);
            box-shadow:
              0 0 0 1px rgba(59,130,246,.20),
              0 0 55px rgba(59,130,246,.22),
              0 0 110px rgba(168,85,247,.10);
          }
          50% {
            transform: scale(1.035);
            box-shadow:
              0 0 0 1px rgba(45,212,191,.32),
              0 0 75px rgba(59,130,246,.34),
              0 0 140px rgba(168,85,247,.18);
          }
        }

        @keyframes nexto-ai-particle {
          0% { transform: translateY(0) scale(.7); opacity: .15; }
          50% { opacity: 1; }
          100% { transform: translateY(-34px) scale(1); opacity: 0; }
        }

        @keyframes nexto-ai-flow-left {
          0% { left: 0%; opacity: 0; }
          12% { opacity: 1; }
          86% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }

        @keyframes nexto-ai-flow-right {
          0% { right: 0%; opacity: 0; }
          12% { opacity: 1; }
          86% { opacity: 1; }
          100% { right: 100%; opacity: 0; }
        }

        @keyframes nexto-ai-feedback {
          0% { stroke-dashoffset: 520; opacity: .2; }
          45% { opacity: .9; }
          100% { stroke-dashoffset: 0; opacity: .15; }
        }

        @keyframes nexto-ai-signal {
          0%, 100% { opacity: .35; transform: scale(.92); }
          50% { opacity: 1; transform: scale(1); }
        }

        .nexto-ai-glass {
          background:
            linear-gradient(145deg, rgba(255,255,255,.055), rgba(255,255,255,.018));
          border: 1px solid rgba(255,255,255,.09);
          box-shadow:
            0 24px 80px -45px rgba(0,0,0,.95),
            inset 0 1px 0 rgba(255,255,255,.035);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
        }

        .nexto-ai-grid {
          background-image:
            linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(circle at center, black 0%, transparent 78%);
          -webkit-mask-image: radial-gradient(circle at center, black 0%, transparent 78%);
        }

        @media (prefers-reduced-motion: reduce) {
          .nexto-ai-motion,
          .nexto-ai-motion * {
            animation: none !important;
          }
        }
      `}</style>

      {/* Background atmosphere */}
      <div className="pointer-events-none absolute inset-0 nexto-ai-grid" />
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,.17) 0%, rgba(168,85,247,.10) 38%, rgba(249,115,22,.07) 58%, transparent 72%)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-20 h-[380px] w-[380px] rounded-full bg-cyan-500/[0.06] blur-[120px]"
      />
      <div
        className="pointer-events-none absolute -right-24 top-20 h-[420px] w-[420px] rounded-full bg-orange-500/[0.055] blur-[130px]"
      />

      <div className="relative mx-auto max-w-7xl">
        {/* Top console bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.07] pb-5">
          <div className="flex items-center gap-4">
            <NextoDarkWordmark width={118} />
            <span className="hidden h-5 w-px bg-white/10 sm:block" />
            <span className="hidden text-[9px] font-medium tracking-[0.12em] text-slate-500 sm:block">
              AI-POWERED CRM
            </span>
          </div>

          <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.16em] text-slate-500">
            {["Think", "Remember", "Act", "Improve"].map((step, index) => (
              <span key={step} className="contents">
                <span
                  className={`transition-colors duration-500 ${
                    pulse === index ? "text-white" : ""
                  }`}
                >
                  {step}
                </span>
                {index < 3 && <span className="text-slate-700">›</span>}
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-[8px] font-bold tracking-[0.12em] text-emerald-300">
              AI AGENT ACTIVE
            </span>
          </div>
        </div>

        {/* Heading */}
        <div className="mx-auto max-w-3xl pt-14 text-center sm:pt-16">
          <SectionLabel>The Engine</SectionLabel>
          <h2 className="mt-4 text-[34px] font-bold leading-[1.02] tracking-[-0.05em] sm:text-[52px]">
            Bukan cuma AI yang jawab.
            <span className="block bg-gradient-to-r from-cyan-300 via-blue-300 to-orange-300 bg-clip-text text-transparent">
              Ini AI yang terus bergerak.
            </span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[14px] leading-6 text-slate-400 sm:text-[16px] sm:leading-7">
            Nexto membaca konteks, mengambil keputusan, menjalankan action,
            melihat hasilnya, lalu membawa hasil itu kembali ke loop.
            <span className="text-slate-200"> Terus berulang.</span>
          </p>
        </div>

        {/* Main command-center canvas */}
        <div className="relative mt-14 min-h-[860px] sm:mt-16 lg:min-h-[760px]">
          {/* Decorative orbit / feedback path */}
          <div className="nexto-ai-motion pointer-events-none absolute left-1/2 top-[48%] hidden h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 lg:block">
            <div
              className="absolute inset-0 rounded-full border border-white/[0.08]"
              style={{ animation: "nexto-ai-orbit 38s linear infinite" }}
            />
            <div
              className="absolute inset-[34px] rounded-full border border-dashed border-cyan-400/[0.10]"
              style={{ animation: "nexto-ai-orbit-reverse 24s linear infinite" }}
            />
            <div
              className="absolute inset-[78px] rounded-full border border-blue-400/[0.07]"
              style={{ animation: "nexto-ai-orbit 18s linear infinite" }}
            />
          </div>

          {/* Context inputs — left of core */}
          <div className="absolute left-0 top-[20%] hidden w-[250px] lg:block">
            <div className="nexto-ai-glass rounded-[22px] p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.09] text-cyan-300">
                  <Database size={18} />
                </span>
                <div>
                  <div className="text-[11px] font-bold tracking-[0.08em] text-cyan-300">
                    CONTEXT
                  </div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-slate-600">
                    Everything it knows
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {["Customer Data", "Conversation", "Past Results"].map((item, i) => (
                  <div
                    key={item}
                    className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-[9px] text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                      {item}
                    </span>
                    <span className="text-[8px] text-slate-600">
                      {["1,284", "8,421", "367"][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Memory module */}
          <div className="absolute left-0 top-[50%] hidden w-[290px] -translate-y-1/2 lg:block">
            <LoopModuleCard module={LOOP_MODULES[0]} />
          </div>

          {/* Decision module */}
          <div className="absolute right-0 top-[20%] hidden w-[290px] lg:block">
            <LoopModuleCard module={LOOP_MODULES[1]} />
          </div>

          {/* Live insight module */}
          <div className="absolute right-0 top-[50%] hidden w-[290px] -translate-y-1/2 lg:block">
            <div className="nexto-ai-glass rounded-[22px] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={15} className="text-emerald-300" />
                  <span className="text-[10px] font-bold tracking-[0.12em] text-slate-200">
                    REAL-TIME INSIGHT
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[8px] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {[
                  ["PT Maju Plastics", "Lead baru", "10:24"],
                  ["Analisis percakapan", "Pak Budi", "10:22"],
                  ["Deal negotiation", "Updated", "10:20"],
                  ["Follow-up", "PT Pralon", "10:18"],
                ].map(([name, detail, time]) => (
                  <div
                    key={`${name}-${time}`}
                    className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[9px] font-semibold text-slate-200">
                        {name}
                      </span>
                      <span className="shrink-0 text-[7px] text-slate-600">
                        {time}
                      </span>
                    </div>
                    <div className="mt-1 text-[8px] text-slate-500">{detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Central AI Core */}
          <div className="absolute left-1/2 top-[3%] z-20 -translate-x-1/2 lg:top-[18%]">
            <div className="relative flex h-[330px] w-[330px] items-center justify-center sm:h-[370px] sm:w-[370px]">
              {/* signal rings */}
              <div className="nexto-ai-motion absolute inset-0 rounded-full border border-blue-400/[0.08]" style={{ animation: "nexto-ai-orbit 18s linear infinite" }} />
              <div className="nexto-ai-motion absolute inset-[26px] rounded-full border border-purple-400/[0.10]" style={{ animation: "nexto-ai-orbit-reverse 13s linear infinite" }} />
              <div className="nexto-ai-motion absolute inset-[54px] rounded-full border border-cyan-400/[0.10]" style={{ animation: "nexto-ai-orbit 10s linear infinite" }} />

              {/* orbit particles */}
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="nexto-ai-motion absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-300"
                  style={{
                    transform: `rotate(${i * 60}deg) translateY(-${145 + (i % 2) * 22}px)`,
                    boxShadow: "0 0 12px rgba(103,232,249,.9)",
                    animation: `nexto-ai-signal ${1.7 + i * .18}s ease-in-out infinite`,
                    animationDelay: `${i * .22}s`,
                  }}
                />
              ))}

              {/* core glow */}
              <div className="absolute h-[210px] w-[210px] rounded-full bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-orange-500/15 blur-[48px]" />

              {/* core */}
              <div
                className="nexto-ai-motion relative flex h-[178px] w-[178px] flex-col items-center justify-center rounded-[42%] border border-white/15 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,.18),rgba(20,25,36,.94)_45%,rgba(6,8,14,.98)_100%)]"
                style={{ animation: "nexto-ai-core 3.2s ease-in-out infinite" }}
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07]">
                  <NextoRobotHead size={35} speaking={robotVoice.speaking} />
                </div>
                <div className="text-[10px] font-bold tracking-[0.24em] text-white">
                  NEXTO AI CORE
                </div>
                <div className="mt-1 text-center text-[8px] leading-4 text-slate-500">
                  Your AI Co-Pilot for
                  <br />
                  Sales Growth
                </div>
              </div>

              <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap text-[8px] font-bold uppercase tracking-[0.18em] text-slate-500">
                <span className="text-cyan-300">Context</span>
                <span>→</span>
                <span className="text-blue-300">Reason</span>
                <span>→</span>
                <span className="text-orange-300">Plan</span>
                <span>→</span>
                <span className="text-emerald-300">Act</span>
                <span>→</span>
                <span className="text-purple-300">Learn</span>
              </div>

              <button
                onClick={robotVoice.play}
                disabled={robotVoice.speaking}
                className="absolute -bottom-12 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-semibold text-slate-300 backdrop-blur-xl transition hover:bg-white/[0.07] disabled:opacity-60"
              >
                <Volume2 size={11} className={robotVoice.speaking ? "animate-pulse" : ""} />
                {robotVoice.speaking ? "Speaking…" : "Listen"}
              </button>
            </div>
          </div>

          {/* Animated connection lines */}
          <div className="nexto-ai-motion pointer-events-none absolute inset-0 hidden lg:block">
            <div className="absolute left-[25%] top-[38%] h-px w-[25%] rotate-[8deg] bg-gradient-to-r from-cyan-400/0 via-cyan-400/35 to-cyan-400/10">
              <span
                className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan-300"
                style={{ boxShadow: "0 0 12px 3px rgba(103,232,249,.65)", animation: "nexto-ai-flow-left 2.5s linear infinite" }}
              />
            </div>
            <div className="absolute right-[25%] top-[38%] h-px w-[25%] -rotate-[8deg] bg-gradient-to-l from-orange-400/0 via-orange-400/35 to-orange-400/10">
              <span
                className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-orange-300"
                style={{ boxShadow: "0 0 12px 3px rgba(253,186,116,.65)", animation: "nexto-ai-flow-right 2.5s linear infinite" }}
              />
            </div>
          </div>

          {/* Action & Feedback — bottom center */}
          <div className="absolute left-1/2 top-[66%] hidden w-[min(92vw,620px)] -translate-x-1/2 lg:block">
            <LoopActionCard />
          </div>

          {/* Feedback badge */}
          <div className="absolute left-1/2 top-[89%] hidden -translate-x-1/2 lg:block">
            <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2 text-[8px] text-emerald-300 backdrop-blur-xl">
              <TrendingUp size={11} />
              Results → Feedback → kembali ke Context
            </div>
          </div>

          {/* Mobile/tablet stacked version */}
          <div className="absolute inset-x-0 top-[455px] space-y-4 lg:hidden">
            <div className="nexto-ai-glass rounded-[22px] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-300">
                  <Database size={16} />
                </span>
                <div>
                  <div className="text-[10px] font-bold tracking-[0.1em] text-cyan-300">CONTEXT ENGINE</div>
                  <div className="mt-1 text-[8px] text-slate-500">CRM • conversations • past results</div>
                </div>
              </div>
            </div>
            <LoopModuleCard module={LOOP_MODULES[0]} compact />
            <LoopModuleCard module={LOOP_MODULES[1]} compact />
            <LoopActionCard compact />
            <div className="flex items-center justify-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-2 text-[8px] text-emerald-300">
              <TrendingUp size={11} />
              Results → Feedback → kembali ke Context
            </div>
          </div>
        </div>

        {/* Bottom philosophy */}
        <div className="mx-auto mt-10 max-w-4xl border-t border-white/[0.07] pt-8 text-center">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.16em] text-slate-600">
            <span>Context</span>
            <span className="text-slate-800">→</span>
            <span>Reason</span>
            <span className="text-slate-800">→</span>
            <span>Plan</span>
            <span className="text-slate-800">→</span>
            <span>Act</span>
            <span className="text-slate-800">→</span>
            <span>Learn</span>
            <span className="text-slate-800">↺</span>
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-[12px] leading-6 text-slate-500">
            Dari data ke keputusan. Dari keputusan ke action. Dari action ke hasil.
            Dan setiap hasil membuat loop berikutnya lebih tajam.
          </p>
        </div>
      </div>
    </section>
  );
}

function LoopModuleCard({ module, compact = false }) {
  const Icon = module.icon;

  return (
    <div
      className={`nexto-ai-glass rounded-[22px] ${compact ? "p-4" : "p-5"}`}
      style={{ boxShadow: `0 24px 70px -40px ${module.color}66` }}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
          style={{
            color: module.color,
            background: `${module.color}12`,
            borderColor: `${module.color}35`,
          }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <div
            className="text-[10px] font-bold tracking-[0.10em]"
            style={{ color: module.color }}
          >
            {module.label}
          </div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.14em] text-slate-600">
            {module.kicker}
          </div>
        </div>
      </div>

      <p className={`${compact ? "mt-3 text-[10px]" : "mt-4 text-[10px]"} leading-5 text-slate-400`}>
        {module.description}
      </p>

      <div className="mt-4 space-y-2">
        {module.items.map((item) => (
          <div
            key={item}
            className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: module.color,
                boxShadow: `0 0 8px ${module.color}`,
              }}
            />
            <span className="text-[8px] text-slate-300">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoopActionCard({ compact = false }) {
  return (
    <div className="nexto-ai-glass rounded-[24px] border-emerald-400/15 bg-emerald-400/[0.025] p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
          <Zap size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold tracking-[0.10em] text-emerald-300">
            ACTION & FEEDBACK
          </div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.14em] text-slate-600">
            Take Action & Improve
          </div>
        </div>

        <span className="flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2 py-1 text-[7px] font-bold text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          LOOP ACTIVE
        </span>
      </div>

      <p className="mt-4 text-[10px] leading-5 text-slate-400">
        Jalankan action, update hasil, ukur performa, dan bawa hasilnya kembali
        menjadi konteks untuk keputusan berikutnya.
      </p>

      <div className={`mt-4 grid ${compact ? "grid-cols-1" : "grid-cols-3"} gap-2`}>
        {[
          [MessageCircle, "Send message"],
          [Database, "Update CRM"],
          [TrendingUp, "Track results"],
        ].map(([Icon, label]) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5"
          >
            <Icon size={12} className="text-emerald-300" />
            <span className="text-[8px] font-medium text-slate-300">{label}</span>
          </div>
        ))}
      </div>
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
  const [showIndustryDemo, setShowIndustryDemo] = useState(false);
  const [legalModal, setLegalModal] = useState(null); // "tos" | "privacy" | null

  // ---- AUTO-PLAY ROBOT NGOMONG ----
  // Browser blokir audio bersuara yang muter sendiri TANPA interaksi user
  // sama sekali (aturan platform, bukan batasan Nexto). Solusinya: putus
  // audionya di INTERAKSI PERTAMA pengunjung (scroll/klik/sentuh pertama),
  // bukan nunggu tombol khusus - kerasanya udah kayak "langsung jalan
  // sendiri" karena hampir semua orang scroll begitu buka halaman.
  // Robot chatbot ngomong duluan, abis kelar baru robot AI Engine Loops.
  const chatbotVoice = useRobotVoice(ROBOT_CHATBOT_AUDIO);
  const engineLoopVoice = useRobotVoice(ROBOT_ENGINE_LOOP_AUDIO);
  const autoPlayedRef = useRef(false);

  useEffect(() => {
    const triggerAutoPlay = () => {
      if (autoPlayedRef.current) return;
      autoPlayedRef.current = true;
      chatbotVoice.play(() => {
        setTimeout(() => engineLoopVoice.play(), 500);
      });
    };
    const events = ["scroll", "click", "touchstart", "keydown"];
    events.forEach((evt) => window.addEventListener(evt, triggerAutoPlay, { once: true, passive: true }));
    return () => events.forEach((evt) => window.removeEventListener(evt, triggerAutoPlay));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pw,
        });

        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pw,
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
    }
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
              Mulai Gratis
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
                Mulai Gratis
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
          <div className="relative mx-auto max-w-4xl px-5 py-24 text-center sm:px-7 sm:py-32 lg:px-10 lg:py-40">
            <div className="flex justify-center">
              <SectionLabel>AI Sales Operating System</SectionLabel>
            </div>

            {/* === HEADLINE UPDATE (5 Sep 2026) ===
                Final pick abis beberapa ronde brainstorm: kontras
                "lo di lapangan" vs "Nexto kerja di belakang layar",
                pake istilah "plays" (playbook/strategi per lead) biar
                kesannya lebih strategic daripada "moves" yang generik. */}
            <h1 className="mx-auto mt-6 max-w-3xl text-[42px] font-bold leading-[1.02] tracking-[-0.055em] text-white sm:text-[58px] lg:text-[72px]">
              Go out and sell.
              <span className="block text-orange-500">
                We run your plays.
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-[15px] leading-7 text-slate-400 sm:text-[16px]">
              Nexto membantu sales tahu{" "}
              <strong className="font-semibold text-slate-200">
                siapa yang harus dihubungi, apa yang harus dilakukan,
              </strong>{" "}
              dan apa langkah berikutnya — tanpa harus terus-terusan mikir
              dan update CRM.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={goToSignup}
                className="group inline-flex items-center gap-2.5 rounded-xl bg-orange-600 px-5 py-3.5 text-[12px] font-bold text-white shadow-[0_12px_30px_-12px_rgba(234,88,12,0.6)] transition hover:-translate-y-0.5 hover:bg-orange-500"
              >
                Mulai Gratis
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
                Mulai gratis
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
          className="bg-white px-5 py-20 sm:px-7 sm:py-28 lg:px-10"
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
                dan proses penjualan perusahaan kamu.
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

            {/* Demo interaktif - disembunyiin di balik tombol CTA biar landing
                page gak berat/keramean; abis diklik baru muncul full demo. */}
            <div className="mt-14">
              {!showIndustryDemo ? (
                <div className="mx-auto max-w-2xl text-center">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600 mb-3">
                    Coba sendiri
                  </div>
                  <button
                    onClick={() => setShowIndustryDemo(true)}
                    className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-orange-500 via-orange-600 to-red-600 px-8 py-4 text-white shadow-[0_20px_50px_-15px_rgba(234,88,12,0.55)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_25px_60px_-15px_rgba(234,88,12,0.7)]"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-white/20 skew-x-12 transition-transform duration-700 group-hover:translate-x-full" />
                    <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                      <Play size={15} className="fill-white" />
                    </span>
                    <span className="relative text-left">
                      <span className="block text-[15px] font-bold leading-tight">Coba Demo Interaktif</span>
                      <span className="block text-[10px] font-medium text-orange-100">Klik industri kamu, lihat langsung isinya</span>
                    </span>
                  </button>
                </div>
              ) : (
                <div>
                  <div className="mx-auto max-w-2xl text-center mb-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">
                      Coba sendiri
                    </div>
                    <div className="mt-2 flex items-center justify-center gap-3">
                      <h3 className="text-[20px] font-bold tracking-[-0.02em] text-slate-950 sm:text-[24px]">
                        Klik industri kamu, lihat langsung isinya
                      </h3>
                      <button
                        onClick={() => setShowIndustryDemo(false)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
                        aria-label="Tutup demo"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                  <IndustryDemo />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* =========================================================
            KEAMANAN AKUN
        ========================================================== */}
        <section id="keamanan" className="bg-[#fbfaf8] px-5 py-20 sm:px-7 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel>Keamanan akun</SectionLabel>

              <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] text-slate-950 sm:text-[48px]">
                Data lead kamu,
                <span className="block text-orange-600">dijaga kayak brankas.</span>
              </h2>

              <p className="mt-5 text-[13px] leading-6 text-slate-500">
                Ribuan lead & histori progress ada di CRM ini — kami ngerti itu aset bisnis kamu. Makanya keamanan akun bukan fitur tempelan.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {SECURITY_FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white p-6 transition hover:border-orange-200"
                  >
                    <div className="absolute right-[-40px] top-[-40px] h-32 w-32 rounded-full bg-orange-100/50 blur-2xl transition group-hover:bg-orange-200/60" />
                    <div className="relative">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                        <Icon size={18} />
                      </div>
                      <div className="mt-4 text-[14px] font-bold tracking-tight text-slate-900">{f.title}</div>
                      <p className="mt-2 text-[12px] leading-5 text-slate-500">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 px-6 py-5 text-center">
              <div className="text-[12px] font-bold text-slate-800">
                Transparan soal data kamu
              </div>
              <div className="mt-1 text-[10px] leading-5 text-slate-400">
                Data lead/progress tetap milikmu, gak pernah dijual ke pihak ketiga. Sebagian fitur AI memang mengirim data relevan ke Anthropic (Claude) &amp; OpenAI untuk diproses — kami sebutkan jelas apa & kenapa di{" "}
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
              <SectionLabel>Simple pricing</SectionLabel>

              <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] text-white sm:text-[46px]">
                Berapa banyak "karyawan AI"
                <span className="block text-slate-500">yang mau kamu pekerjakan?</span>
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-[13px] leading-relaxed text-slate-500">
                Standard udah dibekelin AI ringan (import & rekomendasi harian). Dari Professional ke atas, AI Sales Engine-nya nyala penuh — analisis, draft pesan, dan eksekusi jalan sendiri di belakang layar.
              </p>
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

                <div className="mt-3 flex items-end gap-1">
                  <span className="text-[38px] font-bold tracking-[-0.05em] text-white">
                    Rp79rb
                  </span>
                  <span className="mb-1.5 text-[10px] text-slate-500">/bulan</span>
                </div>

                <div className="mt-1 text-[10px] text-slate-500">
                  CRM inti + AI ringan — untuk yang mau rapiin data leads dulu
                </div>
                <div className="mt-2 inline-block rounded-full bg-white/[0.06] px-2.5 py-1 text-[9px] font-semibold text-slate-400">
                  atau Rp395rb/6 bulan — bayar 5, dapat 6
                </div>

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

                <div className="relative mt-3 flex items-end gap-1">
                  <span className="text-[38px] font-bold tracking-[-0.05em] text-white">
                    Rp269rb
                  </span>
                  <span className="mb-1.5 text-[10px] text-slate-500">/bulan</span>
                </div>

                <div className="relative mt-1 text-[10px] text-slate-400">
                  AI Sales Engine penuh — solo, tapi kerja kayak ada tim
                </div>
                <div className="relative mt-2 inline-block rounded-full bg-orange-500/10 px-2.5 py-1 text-[9px] font-semibold text-orange-300">
                  atau Rp1,345jt/6 bulan — bayar 5, dapat 6
                </div>

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

                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-[38px] font-bold tracking-[-0.05em] text-white">
                      Rp1,3jt
                    </span>
                    <span className="mb-1.5 text-[10px] text-slate-500">/bulan</span>
                  </div>

                  <div className="mt-1 text-[10px] text-slate-400">
                    Untuk 4 orang (≈Rp325rb/orang) — tim sales dengan visibilitas penuh
                  </div>
                  <div className="mt-2 inline-block rounded-full bg-violet-500/10 px-2.5 py-1 text-[9px] font-semibold text-violet-300">
                    atau Rp6,5jt/6 bulan — bayar 5, dapat 6
                  </div>

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
              Penting: pas isi form di halaman pembayaran, pakai <b className="text-slate-300">email yang sama persis</b> dengan email akun Nexto kamu — supaya akunmu otomatis ke-upgrade begitu pembayaran selesai.
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
                  Mulai gratis dan biarkan Nexto membantu sales kamu tahu
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
                        ? "Lanjutkan mengelola sales loop kamu."
                        : "Gratis buat mulai. Upgrade kapan kamu siap."}
                    </p>

                    {mode === "signup" && (() => {
                      let intended = null;
                      try { intended = localStorage.getItem("nexto_intended_plan"); } catch {}
                      const label = { standard: "Standard", premium: "Professional", enterprise: "Enterprise" }[intended];
                      if (!label) return null;
                      return (
                        <div className="mt-3 rounded-lg border border-orange-500/20 bg-orange-500/[0.06] px-3 py-2 text-[10px] leading-4 text-orange-300">
                          Kamu pilih paket <b>{label}</b> — daftar gratis dulu di sini, abis itu kita arahin buat pembayarannya.
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
                            placeholder="Nama kamu"
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
                            placeholder="PT / CV kamu"
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
                      Dengan masuk, kamu setuju menggunakan Nexto sesuai{" "}
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

        {/* ---- SUPPORT + LEGAL LINKS (5 Sep 2026) ---- */}
        <div className="mx-auto mt-5 flex max-w-7xl flex-wrap items-center justify-between gap-4 border-t border-white/[0.06] pt-5">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[9px] text-slate-500">
            <button onClick={() => setLegalModal("tos")} className="hover:text-slate-300 transition">Ketentuan Layanan</button>
            <button onClick={() => setLegalModal("privacy")} className="hover:text-slate-300 transition">Kebijakan Privasi</button>
          </div>
          <a
            href={`https://wa.me/${SUPPORT_WA_NUMBER}?text=${encodeURIComponent("Halo, saya butuh bantuan soal Nexto CRM.")}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-[10px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <MessageCircle size={13} />
            Butuh Bantuan? Chat Support
          </a>
        </div>
      </footer>

      {legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} supportWaNumber={SUPPORT_WA_NUMBER} />}
    </div>
  );
}
