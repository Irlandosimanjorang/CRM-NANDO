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
// 2. Generate Leads AI dibenerin dari "2x/bulan" (gak sesuai kode) jadi
//    "1x/minggu" (sesuai batas asli di generate-leads.ts).
const STANDARD_FEATURES = [
  "Kelola Leads — kartu per perusahaan",
  "Smart Import AI",
  "Recycle Bin",
  "Deteksi Duplikat",
  "Nex — Komunitas Sesama Sales",
  "Good Morning Dashboard (rekomendasi AI harian)",
];

const PROFESSIONAL_FEATURES = [
  "Semua fitur Standard",
  "Bot Telegram (edit CRM, progress harian, jadwal visit)",
  "Sinkron otomatis ke Google Calendar",
  "Generate Leads AI (1x/minggu)",
  "Rekam Meeting otomatis (AI)",
  "Customer State (AI)",
  "Outcome Memory (AI)",
  "Vector Memory (AI)",
  "GPS Check-in",
  "AI Advisor harian",
  "AI Draft Follow-up (WhatsApp & Email)",
  "Analisa Kompetitor",
];

const ENTERPRISE_FEATURES = [
  "Semua fitur Professional",
  "5 anggota tim dalam satu organisasi",
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
        <div className="relative mt-14 md:mt-20 min-h-[760px] md:min-h-[680px]">
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
          <div className="engine-card absolute left-0 top-[5%] md:w-[29%] w-full md:max-w-none">
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
          <div className="engine-card absolute right-0 top-[5%] md:w-[29%] w-full md:max-w-none mt-[510px] md:mt-0">
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
          <div className="absolute left-1/2 top-[27%] md:top-[21%] -translate-x-1/2 z-20">
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
              <div className="absolute -top-7 left-1/2 w-[235px] -translate-x-1/2 translate-x-[20%] rounded-2xl border border-orange-400/30 bg-[#111214]/90 px-3.5 py-2.5 shadow-[0_15px_40px_-15px_rgba(249,115,22,0.45)] backdrop-blur-xl">
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
          <div className="engine-card absolute left-1/2 bottom-0 md:bottom-[2%] -translate-x-1/2 w-full md:w-[40%]">
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

          {/* Mobile connector / central label */}
          <div className="md:hidden absolute top-[43%] left-1/2 -translate-x-1/2 z-10">
            <div className="flex items-center gap-2 rounded-full border border-orange-500/20 bg-[#0c0b09]/90 px-3 py-1.5 text-[7px] uppercase tracking-[0.18em] text-orange-400 backdrop-blur">
              <Zap size={9} />
              Nexto Engine
            </div>
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
// NEXTO AI ENGINE LOOPS - diagram signature, section sendiri di landing page.
// 4 node (Context/Decision/Action/Memory) tersambung garis yang "hidup" -
// titik cahaya ngalir turun terus-menerus, representasiin engine yang gak
// pernah berhenti muter. Robot NEXTO jadi sumber/inti di paling atas.
// ============================================================
const ENGINE_NODES = [
  {
    key: "context",
    label: "CONTEXT ENGINE",
    icon: Database,
    color: "#38bdf8",
    desc: "Baca semua data lead - CRM, progress notes, deal, customer state, histori percakapan.",
  },
  {
    key: "decision",
    label: "DECISION ENGINE",
    icon: BrainCircuit,
    color: "#f97316",
    desc: "Nentuin apa yang terjadi, next action apa, kenapa, dan kapan waktu yang tepat.",
  },
  {
    key: "action",
    label: "ACTION ENGINE",
    icon: Zap,
    color: "#a855f7",
    desc: "Eksekusi - update CRM, sinkron calendar, bikin draft pesan, jadwalin follow-up.",
  },
  {
    key: "memory",
    label: "MEMORY ENGINE",
    icon: Layers,
    color: "#22d3ee",
    desc: "Simpen hasilnya - customer state, outcome menang/kalah - buat keputusan besok lebih tajam.",
  },
];

function AiEngineLoopSection({ robotVoice }) {
  const RADIUS = 300; // radius orbit desktop, px
  const nodesWithAngle = ENGINE_NODES.map((n, i) => ({ ...n, angle: -90 + i * 90 })); // mulai dari atas, muter searah jarum jam

  return (
    <section id="cara-kerja" className="relative overflow-hidden bg-[#05070c] px-5 pb-24 pt-10 text-white sm:px-7 sm:pb-32 sm:pt-14 lg:px-10">
      <style>{`
        @keyframes nexto-flow-pulse {
          0% { top: -8%; opacity: 0; }
          8% { opacity: 1; }
          92% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes nexto-orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes nexto-core-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,.45), 0 0 44px 10px rgba(249,115,22,.28); }
          50% { box-shadow: 0 0 0 14px rgba(249,115,22,0), 0 0 68px 16px rgba(249,115,22,.45); }
        }
        @keyframes nexto-ring-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes nexto-spoke-travel {
          0% { left: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: 100%; opacity: 0; }
        }
      `}</style>

      {/* Grid + glow background - lebar penuh, kesan "zoomed out" */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[720px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.22] blur-[130px]"
        style={{ background: "radial-gradient(circle, #f97316, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full opacity-20 blur-[130px]"
        style={{ background: "radial-gradient(circle, #22d3ee, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-0 left-0 h-[420px] w-[420px] -translate-x-1/3 translate-y-1/3 rounded-full opacity-[0.14] blur-[120px]"
        style={{ background: "radial-gradient(circle, #a855f7, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <SectionLabel>The Engine</SectionLabel>
        <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] sm:text-[52px]">
          NEXTO AI Engine Loops
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-slate-400 sm:text-[16px]">
          Bukan sekadar chatbot yang jawab pertanyaan. Ini loop yang jalan terus - baca konteks, mutusin next action, eksekusi, simpen hasilnya, terus balik lagi buat mutusin yang lebih tajam besok.
        </p>
      </div>

      {/* ---- Diagram orbital (desktop/tablet lebar) - baru nongol dari
          breakpoint xl (1280px) ke atas, BUKAN md (768px). Diagram ini
          butuh ruang ~880px biar semua kartu (radius 300px + lebar kartu
          240px) gak kepotong. Kalau dipaksa muncul dari md, kartu Decision
          Engine & Memory Engine (paling kiri/kanan) bisa ke-clip invisible
          di lebar 768-1024px karena section-nya overflow-hidden. ---- */}
      <div className="relative mx-auto mt-20 hidden xl:block" style={{ width: RADIUS * 2 + 280, height: RADIUS * 2 + 40, maxWidth: "100%" }}>
        {/* Cincin orbit - muter pelan terus-menerus */}
        <div
          className="absolute left-1/2 top-1/2 rounded-full border border-dashed"
          style={{
            width: RADIUS * 2, height: RADIUS * 2,
            marginLeft: -RADIUS, marginTop: -RADIUS,
            borderColor: "rgba(255,255,255,.14)",
            animation: "nexto-ring-rotate 40s linear infinite",
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: RADIUS * 2 - 2, height: RADIUS * 2 - 2,
            marginLeft: -(RADIUS - 1), marginTop: -(RADIUS - 1),
            background: "conic-gradient(from 0deg, #f9731633, transparent 25%, transparent 75%, #22d3ee33)",
            animation: "nexto-ring-rotate 14s linear infinite",
          }}
        />

        {/* Garis spoke dari inti ke tiap node - garis-nya "hidup", ada titik
            cahaya yang ngalir terus dari robot ke tiap engine, delay beda-beda
            per node biar keliatan organik (bukan gerak barengan kaku). */}
        {nodesWithAngle.map((n, i) => {
          const rad = (n.angle * Math.PI) / 180;
          const x2 = RADIUS * Math.cos(rad);
          const y2 = RADIUS * Math.sin(rad);
          const len = Math.sqrt(x2 * x2 + y2 * y2);
          const rot = (Math.atan2(y2, x2) * 180) / Math.PI;
          return (
            <div
              key={`spoke-${n.key}`}
              className="absolute left-1/2 top-1/2 h-px origin-left"
              style={{ width: len, background: `linear-gradient(90deg, ${n.color}66, ${n.color}22)`, transform: `rotate(${rot}deg)` }}
            >
              <span
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                style={{
                  background: n.color,
                  boxShadow: `0 0 10px 3px ${n.color}bb`,
                  animation: `nexto-spoke-travel 2.8s ease-in-out infinite`,
                  animationDelay: `${i * 0.45}s`,
                }}
              />
            </div>
          );
        })}

        {/* Inti / robot - sumber loop-nya, di tengah lingkaran */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-orange-400/30 bg-gradient-to-br from-orange-500/25 to-orange-700/10" style={{ animation: "nexto-core-pulse 2.6s ease-in-out infinite" }}>
            <NextoRobotHead size={34} speaking={robotVoice.speaking} />
          </div>
          <div className="mt-3 text-[10px] font-bold uppercase tracking-[0.22em] text-orange-400/80">Nexto AI Core</div>
          <button
            onClick={robotVoice.play}
            disabled={robotVoice.speaking}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-white/[0.03] px-3 py-1.5 text-[9px] font-semibold text-orange-300 backdrop-blur-xl disabled:opacity-70"
          >
            <Volume2 size={11} className={robotVoice.speaking ? "animate-pulse" : ""} />
            {robotVoice.speaking ? "Speaking…" : "Listen"}
          </button>
        </div>

        {/* 4 node engine, disebar keliling lingkaran */}
        {nodesWithAngle.map((n) => {
          const Icon = n.icon;
          const rad = (n.angle * Math.PI) / 180;
          const x = RADIUS * Math.cos(rad);
          const y = RADIUS * Math.sin(rad);
          return (
            <div
              key={n.key}
              className="absolute left-1/2 top-1/2 w-[240px]"
              style={{ transform: `translate(${x}px, ${y}px) translate(-50%, -50%)` }}
            >
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-left backdrop-blur-sm shadow-[0_20px_50px_-25px_rgba(0,0,0,0.6)]">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${n.color}1f`, color: n.color, boxShadow: `0 0 0 1px ${n.color}33` }}>
                    <Icon size={17} />
                  </span>
                  <span className="text-[12px] font-bold tracking-[0.08em]" style={{ color: n.color }}>{n.label}</span>
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-slate-400">{n.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Diagram vertikal (mobile + tablet + laptop kecil, sampe
          breakpoint xl) - dipake lebih luas dari sebelumnya (dulu cuma
          sampe md) biar gak ada rentang lebar layar yang kena bug clipping
          di versi orbital. ---- */}
      <div className="relative mx-auto mt-16 max-w-md xl:hidden">
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-400/30 bg-gradient-to-br from-orange-500/20 to-orange-700/10" style={{ animation: "nexto-core-pulse 2.6s ease-in-out infinite" }}>
          <NextoRobotHead size={28} speaking={robotVoice.speaking} />
        </div>
        <div className="mt-3 text-center text-[10px] font-bold uppercase tracking-[0.22em] text-orange-400/80">Nexto AI Core</div>
        <div className="text-center">
          <button
            onClick={robotVoice.play}
            disabled={robotVoice.speaking}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-white/[0.03] px-3 py-1.5 text-[9px] font-semibold text-orange-300 backdrop-blur-xl disabled:opacity-70"
          >
            <Volume2 size={11} className={robotVoice.speaking ? "animate-pulse" : ""} />
            {robotVoice.speaking ? "Speaking…" : "Listen"}
          </button>
        </div>

        <div className="relative mx-auto mt-4 w-px" style={{ height: `${ENGINE_NODES.length * 148}px` }}>
          <div className="absolute inset-0 w-px bg-gradient-to-b from-orange-400/40 via-white/10 to-cyan-400/40" />
          <div
            className="absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-orange-300"
            style={{ boxShadow: "0 0 12px 3px rgba(251,146,60,.8)", animation: "nexto-flow-pulse 3.6s linear infinite" }}
          />
          {ENGINE_NODES.map((n, i) => {
            const Icon = n.icon;
            return (
              <div key={n.key} className="absolute left-1/2 flex -translate-x-1/2 items-start gap-4" style={{ top: `${i * 148 + 24}px`, width: "min(88vw, 420px)" }}>
                <span className="absolute left-1/2 top-1 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: n.color, background: "#05070c" }} />
                <div className="ml-8 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left backdrop-blur-sm sm:ml-10">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${n.color}1f`, color: n.color }}>
                      <Icon size={16} />
                    </span>
                    <span className="text-[12px] font-bold tracking-[0.08em]" style={{ color: n.color }}>{n.label}</span>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-slate-400">{n.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Loop-back indicator - dipake di dua ukuran layar */}
      <div className="relative mx-auto mt-10 flex max-w-[460px] items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15" style={{ animation: "nexto-orbit-spin 3s linear infinite" }}>
          <ArrowRight size={12} className="text-slate-300 -rotate-90" />
        </span>
        <p className="text-[11.5px] leading-relaxed text-slate-400">
          Hasil dari Memory Engine balik lagi jadi konteks buat Decision Engine besok - <span className="text-white font-medium">loop-nya gak pernah berhenti.</span>
        </p>
      </div>
    </section>
  );
}

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
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
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: pw,
        });

        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: pw,
        });

        if (error) throw error;

        setMsg(
          "Akun dibuat. Cek email buat verifikasi (kalau confirm email aktif), lalu masuk."
        );
      }
    } catch (e) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

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
                Standard cuma CRM. Dari Professional ke atas, engine AI-nya beneran nyala — analisis, draft pesan, dan eksekusi jalan sendiri di belakang layar.
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
                  CRM inti, tanpa AI — untuk yang mau rapiin data dulu
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
                  onClick={goToSignup}
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
                    Rp199rb
                  </span>
                  <span className="mb-1.5 text-[10px] text-slate-500">/bulan</span>
                </div>

                <div className="relative mt-1 text-[10px] text-slate-400">
                  AI Sales Engine penuh — solo, tapi kerja kayak ada tim
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
                  onClick={goToSignup}
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
                      Rp2,5jt
                    </span>
                    <span className="mb-1.5 text-[10px] text-slate-500">/bulan</span>
                  </div>

                  <div className="mt-1 text-[10px] text-slate-400">
                    Untuk 5 orang (≈Rp500rb/orang) — tim sales dengan visibilitas penuh
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
                    onClick={goToSignup}
                    className="mt-8 w-full rounded-xl bg-violet-600 py-3 text-[11px] font-bold text-white shadow-sm transition hover:bg-violet-500"
                  >
                    Hubungi Sales
                  </button>
                </div>
              </div>
            </div>
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
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-[9px] font-semibold text-slate-400">
                        EMAIL
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
                        PASSWORD
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
                    </div>

                    {msg && (
                      <div className="flex gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-[9px] leading-5 text-rose-300">
                        <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                        <span>{msg}</span>
                      </div>
                    )}

                    <button
                      onClick={submit}
                      disabled={loading}
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

                  <div className="mt-5 border-t border-white/[0.06] pt-4 text-center text-[8px] leading-4 text-slate-600">
                    Dengan membuat akun, kamu setuju menggunakan Nexto sesuai{" "}
                    <button onClick={() => setLegalModal("tos")} className="underline hover:text-slate-400">ketentuan layanan</button>{" "}
                    dan{" "}
                    <button onClick={() => setLegalModal("privacy")} className="underline hover:text-slate-400">kebijakan privasi</button>{" "}
                    yang berlaku.
                  </div>
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
