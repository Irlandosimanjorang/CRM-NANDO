import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import IndustryDemo from "./tabs/IndustryDemo";
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

} from "lucide-react";
const NEXTO_LOGO_SRC = "/nexto-logo.png";

function NextoWordmark({ width = 108, className = "" }) {
  return (
    <img
      src={NEXTO_LOGO_SRC}
      alt="Nexto"
      width={width}
      className={`block h-auto w-auto object-contain ${className}`}
    />
  );
}

export function NextoRobotHead({ size = 32, className = "" }) {
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
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
          }}
        />
        <span
          className="rounded-full"
          style={{
            width: "10%",
            height: "24%",
            background: "#f97316",
            boxShadow: "0 0 5px rgba(249,115,22,.7)",
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


const CAPABILITIES = [
  {
    icon: Target,
    title: "Know what to do",
    desc: "AI memprioritaskan lead dan opportunity yang paling layak dikejar sekarang.",
  },
  {
    icon: MessageSquare,
    title: "Know what to say",
    desc: "Pahami konteks customer dan bantu sales menyiapkan respons yang lebih tepat.",
  },
  {
    icon: Clock3,
    title: "Never miss a follow-up",
    desc: "Nexto mengingat commitment, jadwal, buying signal, dan opportunity yang mulai stagnan.",
  },
  {
    icon: TrendingUp,
    title: "Find more revenue",
    desc: "Temukan peluang reorder, upsell, dormant customer, dan deal yang berisiko hilang.",
  },
];

const SUPPORTING_FEATURES = [
  {
    icon: Sparkles,
    title: "AI Advisor",
    desc: "Rekomendasi lead potensial dan prioritas follow-up.",
  },
  {
    icon: Send,
    title: "Telegram Agent",
    desc: "Update CRM langsung lewat chat atau voice note.",
  },
  {
    icon: MapPin,
    title: "GPS Check-in",
    desc: "Catat kunjungan dan validasi lokasi sales.",
  },
  {
    icon: Mic,
    title: "Meeting Intelligence",
    desc: "Ubah hasil meeting menjadi catatan dan next action.",
  },
  {
    icon: Calendar,
    title: "Google Calendar",
    desc: "Sinkronkan jadwal visit dan meeting otomatis.",
  },
  {
    icon: Users,
    title: "Lead Management",
    desc: "Kelola seluruh prospek dalam satu tempat.",
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

const FREE_FEATURES = [
  "Dashboard",
  "Kelola Leads",
];

const PREMIUM_FEATURES = [
  "Semua fitur di paket Free",
  "Deal & tracking transaksi",
  "Visit & Follow-up + Check-in GPS",
  "Rekam Meeting otomatis",
  "Analisa Kompetitor",
  "AI Advisor harian",
  "Bot Telegram (agent aktif)",
  "Sinkron Google Calendar",
  "Nex — komunitas sesama sales",
];

const FAQS = [
  {
    q: "Nexto itu CRM untuk industri apa?",
    a: "Nexto dibuat sebagai sales engine yang fleksibel untuk berbagai industri. Property, automotive, B2B, SaaS, insurance, education, dan tim sales lainnya bisa menyesuaikan proses penjualannya.",
  },
  {
    q: "Apa bedanya Nexto dengan CRM biasa?",
    a: "CRM biasa banyak berfungsi sebagai tempat menyimpan data. Nexto dirancang untuk terus mendorong sales ke next best action — siapa yang perlu dihubungi, apa yang harus dilakukan, dan apa langkah berikutnya.",
  },
  {
    q: "Paket Free-nya kayak gimana?",
    a: "Free bisa dipakai selamanya dengan akses Dashboard dan Leads. Cocok untuk mulai merapikan data prospek sebelum menggunakan fitur sales intelligence yang lebih lengkap.",
  },
  {
    q: "Bisa berhenti kapan aja?",
    a: "Bisa. Tidak ada kontrak jangka panjang. Kamu bisa berhenti atau upgrade kapan saja.",
  },
  {
    q: "Data saya aman?",
    a: "Data setiap organisasi dipisahkan berdasarkan akun dan permission yang berlaku. Akses data mengikuti struktur organisasi dan role pengguna.",
  },
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

function NextoAISalesEngine() {
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
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/[0.07] px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-orange-400 shadow-[0_0_30px_rgba(249,115,22,0.08)]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-orange-400" />
            </span>
            NEXTO AI SALES ENGINE
          </div>

          <h2 className="mt-5 text-3xl md:text-5xl font-bold tracking-[-0.045em] leading-[1.05]">
            Kamu cukup{" "}
            <span className="text-orange-500">ngomong.</span>
            <br />
            Nexto yang kerja.
          </h2>

          <p className="mt-5 text-sm md:text-base leading-7 text-stone-400 max-w-2xl mx-auto">
            Chatbot Nexto menjadi pusat kendali sales kamu. Satu chat bisa
            mengatur visit, memperbarui progress, dan mengedit CRM tanpa harus
            buka satu-satu.
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

                  <div className="absolute left-1/2 bottom-[20%] h-[2px] w-7 -translate-x-1/2 rounded-full bg-orange-400/70" />
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
      </div>

      <style>{`
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

function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[650px]">
      <div className="absolute -inset-10 rounded-[60px] bg-orange-500/10 blur-3xl" />

      <div className="relative overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_35px_100px_-30px_rgba(15,23,42,0.32)]">
        <div className="flex h-11 items-center justify-between border-b border-slate-100 bg-white px-4">
          <div className="flex items-center">
            <NextoWordmark width={78} />
          </div>

          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full bg-slate-200" />
            <div className="h-2 w-2 rounded-full bg-slate-200" />
            <div className="h-2 w-2 rounded-full bg-slate-200" />
          </div>
        </div>

        <div className="grid min-h-[420px] grid-cols-[150px_1fr] bg-slate-50">
          <div className="hidden border-r border-slate-100 bg-white p-4 sm:block">
            <div className="mb-6 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-300">
              Workspace
            </div>

            <div className="space-y-1.5">
              {["Today", "Leads", "Deals", "Visits", "AI Advisor"].map(
                (item, index) => (
                  <div
                    key={item}
                    className={`rounded-lg px-3 py-2 text-[10px] font-medium ${
                      index === 0
                        ? "bg-orange-50 text-orange-700"
                        : "text-slate-400"
                    }`}
                  >
                    {item}
                  </div>
                )
              )}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="mb-5 flex items-end justify-between">
              <div>
                <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-orange-500">
                  Sales command center
                </div>
                <div className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                  Good morning, Nando 👋
                </div>
                <div className="mt-1 text-[10px] text-slate-400">
                  5 actions need your attention.
                </div>
              </div>

              <div className="hidden rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] text-slate-400 sm:block">
                Today
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between">
              <div className="text-[10px] font-bold text-slate-700">
                Next best actions
              </div>
              <div className="text-[9px] text-slate-400">AI prioritized</div>
            </div>

            <div className="space-y-2.5">
              <div className="rounded-xl border border-orange-100 bg-white p-3 shadow-sm">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                    <Zap size={14} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold text-slate-900">
                          Call PT ABC
                        </div>
                        <div className="mt-0.5 text-[9px] text-slate-400">
                          Rp180M opportunity
                        </div>
                      </div>

                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[8px] font-bold text-orange-600">
                        HIGH
                      </span>
                    </div>

                    <div className="mt-2 text-[9px] leading-relaxed text-slate-500">
                      Quotation dikirim 3 hari lalu. Customer belum merespons.
                    </div>

                    <div className="mt-2.5 flex gap-1.5">
                      <button className="rounded-md bg-slate-900 px-2.5 py-1.5 text-[8px] font-semibold text-white">
                        Call
                      </button>
                      <button className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[8px] font-semibold text-slate-600">
                        WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <MapPin size={14} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold text-slate-900">
                          Visit PT XYZ
                        </div>
                        <div className="mt-0.5 text-[9px] text-slate-400">
                          1.2 km away
                        </div>
                      </div>

                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-600">
                        REORDER
                      </span>
                    </div>

                    <div className="mt-2 text-[9px] leading-relaxed text-slate-500">
                      Customer biasanya order setiap 30 hari. Hari ini hari ke-29.
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <MessageSquare size={14} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] font-bold text-slate-900">
                          Follow up Sarah
                        </div>
                        <div className="mt-0.5 text-[9px] text-slate-400">
                          High buying intent
                        </div>
                      </div>

                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[8px] font-bold text-blue-600">
                        TODAY
                      </span>
                    </div>

                    <div className="mt-2 text-[9px] leading-relaxed text-slate-500">
                      Customer bertanya harga kemarin.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 py-2.5 text-[8px] font-medium text-slate-400">
              <Sparkles size={11} className="text-orange-500" />
              AI terus mencari langkah berikutnya
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoopVisual() {
  const nodes = [
    { label: "Customer Signal", active: false },
    { label: "AI Understands", active: true },
    { label: "Next Best Action", active: true },
    { label: "Sales Action", active: false },
    { label: "Customer Response", active: false },
    { label: "Next Action", active: true },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="relative rounded-[30px] border border-slate-800 bg-[#0b0d10] p-5 shadow-[0_35px_100px_-35px_rgba(0,0,0,0.5)] sm:p-8">
        <div className="absolute inset-x-10 top-1/2 h-32 -translate-y-1/2 rounded-full bg-orange-500/10 blur-3xl" />

        <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3">
          {nodes.map((node, index) => (
            <div key={node.label} className="relative">
              <div
                className={`rounded-2xl border p-4 transition ${
                  node.active
                    ? "border-orange-500/40 bg-orange-500/[0.08]"
                    : "border-white/[0.08] bg-white/[0.03]"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      node.active ? "bg-orange-400" : "bg-slate-600"
                    }`}
                  />
                  <span className="text-[8px] font-medium text-slate-600">
                    0{index + 1}
                  </span>
                </div>

                <div className="text-[10px] font-semibold leading-relaxed text-white sm:text-[11px]">
                  {node.label}
                </div>
              </div>

              {index < nodes.length - 1 && (
                <div className="absolute -right-2 top-1/2 z-10 hidden h-px w-4 bg-orange-500/40 sm:block" />
              )}
            </div>
          ))}
        </div>

        <div className="relative mt-5 flex items-center justify-center gap-2 text-[9px] font-medium text-slate-500">
          <div className="h-px w-10 bg-orange-500/30" />
          The loop keeps moving
          <div className="h-px w-10 bg-orange-500/30" />
        </div>
      </div>
    </div>
  );
}

function CopilotMockup() {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_80px_-35px_rgba(15,23,42,0.3)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <BrainCircuit size={18} />
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-900">
              Nexto AI
            </div>
            <div className="text-[9px] text-emerald-600">
              Sales copilot active
            </div>
          </div>
        </div>

        <div className="rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-bold text-emerald-600">
          ONLINE
        </div>
      </div>

      <div className="space-y-4 bg-slate-50 p-5 sm:p-7">
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-slate-900 px-4 py-3 text-[10px] leading-relaxed text-white">
          Siapa yang harus gue follow up hari ini?
        </div>

        <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-4">
          <div className="mb-3 text-[10px] leading-relaxed text-slate-600">
            Gue menemukan <strong className="text-slate-900">4 opportunity</strong>{" "}
            yang paling penting buat lo hari ini.
          </div>

          <div className="space-y-2">
            {[
              ["01", "PT ABC", "87% closing probability"],
              ["02", "PT XYZ", "Reorder expected"],
              ["03", "Sarah", "High buying intent"],
              ["04", "PT DEF", "Deal at risk"],
            ].map(([num, name, reason]) => (
              <div
                key={name}
                className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <span className="text-[8px] font-bold text-orange-500">
                  {num}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold text-slate-900">
                    {name}
                  </div>
                  <div className="mt-0.5 text-[8px] text-slate-400">
                    {reason}
                  </div>
                </div>
                <ArrowUpRight size={13} className="text-slate-300" />
              </div>
            ))}
          </div>

          <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-2.5 text-[9px] font-bold text-white">
            <Sparkles size={12} />
            Prepare all follow-ups
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-[8px] text-slate-400">
        <CircleCheck size={11} className="text-emerald-500" />
        AI recommendations are based on your sales context
      </div>
    </div>
  );
}

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

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
              href="#fitur"
              className="text-[12px] font-medium text-slate-500 transition hover:text-slate-950"
            >
              Fitur
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
                ["#fitur", "Fitur"],
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
        <section className="relative overflow-hidden bg-[#fbfaf8]">
          <div className="absolute left-[-180px] top-[-180px] h-[500px] w-[500px] rounded-full bg-orange-200/20 blur-3xl" />
          <div className="absolute bottom-[-250px] right-[-150px] h-[550px] w-[550px] rounded-full bg-orange-100/30 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 py-16 sm:px-7 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:px-10 lg:py-24">
            <div>
              <SectionLabel>AI Sales Operating System</SectionLabel>

              <h1 className="mt-5 max-w-[620px] text-[42px] font-bold leading-[1.02] tracking-[-0.055em] text-slate-950 sm:text-[58px] lg:text-[66px]">
                Stop managing leads.
                <span className="block text-orange-600">
                  Start closing deals.
                </span>
              </h1>

              <p className="mt-6 max-w-[570px] text-[15px] leading-7 text-slate-500 sm:text-[16px]">
                Nexto membantu sales tahu{" "}
                <strong className="font-semibold text-slate-800">
                  siapa yang harus dihubungi, apa yang harus dilakukan,
                </strong>{" "}
                dan apa langkah berikutnya — tanpa harus terus-terusan mikir
                dan update CRM.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={goToSignup}
                  className="group inline-flex items-center gap-2.5 rounded-xl bg-slate-950 px-5 py-3.5 text-[12px] font-bold text-white shadow-[0_12px_30px_-12px_rgba(15,23,42,0.5)] transition hover:-translate-y-0.5 hover:bg-slate-800"
                >
                  Mulai Gratis
                  <ArrowRight
                    size={14}
                    className="transition group-hover:translate-x-0.5"
                  />
                </button>

                <a
                  href="#cara-kerja"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-[12px] font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Play size={12} />
                  Lihat cara kerja
                </a>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] font-medium text-slate-400">
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

            <div className="lg:pl-2">
              <ProductMockup />
            </div>
          </div>
        </section>

        {/* =========================================================
            NEXTO AI SALES ENGINE
            TAMBAHAN — LANDING PAGE EXISTING TETAP
        ========================================================== */}
        <NextoAISalesEngine />

        {/* =========================================================
            TRUST STRIP
        ========================================================== */}
        <section className="border-y border-slate-100 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-5 text-center sm:px-7 lg:px-10">
            <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-300">
              Built for modern sales teams
            </span>
            <span className="hidden h-3 w-px bg-slate-200 sm:block" />
            <span className="text-[10px] font-medium text-slate-400">
              Lead management
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              AI recommendations
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              Sales activity
            </span>
            <span className="text-[10px] font-medium text-slate-400">
              Customer intelligence
            </span>
          </div>
        </section>

        {/* =========================================================
            PROBLEM
        ========================================================== */}
        <section className="bg-white px-5 py-20 sm:px-7 sm:py-24 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <SectionLabel>The old way</SectionLabel>

              <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] text-slate-950 sm:text-[46px]">
                CRM kamu menyimpan banyak data.
                <span className="block text-slate-400">
                  Tapi siapa yang bilang sales harus ngapain?
                </span>
              </h2>
            </div>

            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {[
                {
                  number: "01",
                  title: "Terlalu banyak lead",
                  desc: "Sales punya ratusan prospek tapi tidak tahu mana yang paling penting untuk dikejar hari ini.",
                },
                {
                  number: "02",
                  title: "Follow-up sering hilang",
                  desc: "Customer bilang “minggu depan”, quotation sudah dikirim, tapi akhirnya tidak ada yang follow-up.",
                },
                {
                  number: "03",
                  title: "Terlalu banyak admin",
                  desc: "Waktu sales habis untuk input CRM, padahal seharusnya digunakan untuk menjual.",
                },
              ].map((item) => (
                <div
                  key={item.number}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 p-6"
                >
                  <div className="mb-10 text-[10px] font-bold tracking-[0.15em] text-orange-500">
                    {item.number}
                  </div>

                  <div className="text-[16px] font-bold tracking-tight text-slate-900">
                    {item.title}
                  </div>

                  <p className="mt-2 text-[12px] leading-6 text-slate-500">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================
            LOOP ENGINE
        ========================================================== */}
        <section
          id="cara-kerja"
          className="overflow-hidden bg-[#080a0d] px-5 py-20 text-white sm:px-7 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400">
                <Sparkles size={12} />
                The Nexto Loop
              </div>

              <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] sm:text-[48px]">
                Your sales should
                <span className="block text-orange-400">
                  never get stuck.
                </span>
              </h2>

              <p className="mt-5 text-[13px] leading-6 text-slate-400 sm:text-[14px]">
                Setiap interaksi menghasilkan signal baru. Nexto membaca
                signal tersebut dan membantu sales menentukan langkah terbaik
                berikutnya.
              </p>
            </div>

            <div className="mt-12">
              <LoopVisual />
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-3 sm:grid-cols-3">
              {[
                ["01", "Signal", "Customer melakukan sesuatu."],
                ["02", "Decision", "AI memahami konteksnya."],
                ["03", "Action", "Sales tahu harus melakukan apa."],
              ].map(([num, title, desc]) => (
                <div
                  key={num}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5"
                >
                  <div className="text-[9px] font-bold tracking-[0.16em] text-orange-400">
                    {num}
                  </div>
                  <div className="mt-3 text-[12px] font-bold text-white">
                    {title}
                  </div>
                  <div className="mt-1 text-[10px] leading-5 text-slate-500">
                    {desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =========================================================
            NEXT BEST ACTION
        ========================================================== */}
        <section className="bg-[#fbfaf8] px-5 py-20 sm:px-7 sm:py-28 lg:px-10">
          <div className="mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <SectionLabel>Next Best Action</SectionLabel>

              <h2 className="mt-4 max-w-xl text-[34px] font-bold leading-tight tracking-[-0.045em] text-slate-950 sm:text-[48px]">
                Jangan buka CRM untuk mencari pekerjaan.
                <span className="block text-slate-400">
                  Buka Nexto untuk tahu pekerjaanmu.
                </span>
              </h2>

              <p className="mt-5 max-w-lg text-[13px] leading-6 text-slate-500">
                Nexto memprioritaskan opportunity berdasarkan konteks,
                aktivitas, intent, nilai deal, waktu, dan signal customer.
              </p>

              <div className="mt-7 space-y-3">
                {[
                  "Siapa yang paling layak dihubungi?",
                  "Opportunity mana yang mulai berisiko?",
                  "Customer mana yang kemungkinan reorder?",
                  "Apa action paling penting hari ini?",
                ].map((text) => (
                  <div
                    key={text}
                    className="flex items-center gap-3 text-[12px] font-medium text-slate-700"
                  >
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                      <Check size={12} />
                    </div>
                    {text}
                  </div>
                ))}
              </div>
            </div>

            <ProductMockup />
          </div>
        </section>

        {/* =========================================================
            AI COPILOT
        ========================================================== */}
        <section className="bg-white px-5 py-20 sm:px-7 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_0.95fr]">
              <CopilotMockup />

              <div>
                <SectionLabel>AI Sales Copilot</SectionLabel>

                <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] text-slate-950 sm:text-[46px]">
                  Punya AI sales manager
                  <span className="block text-orange-600">
                    di sampingmu.
                  </span>
                </h2>

                <p className="mt-5 max-w-xl text-[13px] leading-6 text-slate-500">
                  Tanyakan apa pun tentang pipeline kamu. Nexto membaca data
                  sales dan mengubahnya menjadi rekomendasi yang bisa langsung
                  dikerjakan.
                </p>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {[
                    "“Siapa yang harus gue follow up?”",
                    "“Deal mana yang berisiko?”",
                    "“Kenapa pipeline gue turun?”",
                    "“Customer mana yang mau reorder?”",
                  ].map((question) => (
                    <div
                      key={question}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-medium text-slate-600"
                    >
                      {question}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            CAPABILITIES
        ========================================================== */}
        <section id="fitur" className="bg-[#fbfaf8] px-5 py-20 sm:px-7 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <SectionLabel>Sales intelligence</SectionLabel>

              <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] text-slate-950 sm:text-[48px]">
                Bukan sekadar lebih banyak fitur.
                <span className="block text-slate-400">
                  Lebih sedikit hal yang harus dipikirkan sales.
                </span>
              </h2>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CAPABILITIES.map((item, index) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="group rounded-[24px] border border-slate-200 bg-white p-6 transition duration-300 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_20px_50px_-30px_rgba(234,88,12,0.35)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white transition group-hover:bg-orange-600">
                        <Icon size={17} />
                      </div>

                      <span className="text-[9px] font-bold text-slate-300">
                        0{index + 1}
                      </span>
                    </div>

                    <h3 className="mt-7 text-[14px] font-bold tracking-tight text-slate-900">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 border-t border-slate-200 pt-10">
              <div className="mb-5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                And it already works with your daily sales workflow
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SUPPORTING_FEATURES.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                        <Icon size={14} />
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-slate-900">
                          {item.title}
                        </div>
                        <div className="mt-1 text-[9px] leading-4 text-slate-400">
                          {item.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

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

            {/* Demo interaktif - klik industri, langsung kelihatan pipeline,
                field, dan contoh lead yang bakal dipakai. */}
            <div className="mt-14">
              <div className="mx-auto max-w-2xl text-center mb-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">
                  Coba sendiri
                </div>
                <h3 className="mt-2 text-[20px] font-bold tracking-[-0.02em] text-slate-950 sm:text-[24px]">
                  Klik industri kamu, lihat langsung isinya
                </h3>
              </div>
              <IndustryDemo />
            </div>
          </div>
        </section>

        {/* =========================================================
            BEFORE / AFTER
        ========================================================== */}
        <section className="bg-[#080a0d] px-5 py-20 text-white sm:px-7 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel>From data to action</SectionLabel>

              <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] sm:text-[48px]">
                CRM data is useful.
                <span className="block text-orange-400">
                  Actionable CRM is better.
                </span>
              </h2>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[26px] border border-white/[0.08] bg-white/[0.03] p-7">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                  Without Nexto
                </div>

                <div className="mt-7 space-y-4">
                  {[
                    "327 leads",
                    "Sales buka CRM",
                    "“Siapa yang harus gue hubungi?”",
                    "Scroll dan cari-cari",
                    "Follow-up terlambat",
                    "Opportunity hilang",
                  ].map((text, index) => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.06] text-[9px] font-bold text-slate-600">
                        {index + 1}
                      </div>
                      <div className="text-[11px] text-slate-400">{text}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[26px] border border-orange-500/20 bg-orange-500/[0.05] p-7">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-400">
                  With Nexto
                </div>

                <div className="mt-7 space-y-4">
                  {[
                    "327 leads",
                    "AI menganalisis",
                    "Top 5 actions",
                    "Sales langsung bertindak",
                    "Customer merespons",
                    "Next action otomatis terbentuk",
                  ].map((text, index) => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/10 text-orange-400">
                        <Check size={12} />
                      </div>
                      <div className="text-[11px] text-slate-300">{text}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-7 flex items-center gap-2 text-[9px] font-semibold text-orange-400">
                  <Sparkles size={11} />
                  The loop keeps moving.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            PRICING
        ========================================================== */}
        <section
          id="harga"
          className="bg-[#fbfaf8] px-5 py-20 sm:px-7 sm:py-28 lg:px-10"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <SectionLabel>Simple pricing</SectionLabel>

              <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] text-slate-950 sm:text-[46px]">
                Mulai gratis.
                <span className="block text-slate-400">
                  Upgrade saat sales kamu siap.
                </span>
              </h2>
            </div>

            <div className="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
              <div className="rounded-[26px] border border-slate-200 bg-white p-7">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                  Free
                </div>

                <div className="mt-3 flex items-end gap-1">
                  <span className="text-[42px] font-bold tracking-[-0.05em] text-slate-950">
                    Rp0
                  </span>
                </div>

                <div className="mt-1 text-[10px] text-slate-400">
                  Selamanya gratis
                </div>

                <div className="my-7 h-px bg-slate-100" />

                <ul className="space-y-3">
                  {FREE_FEATURES.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2.5 text-[11px] text-slate-600"
                    >
                      <Check
                        size={13}
                        className="shrink-0 text-emerald-500"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={goToSignup}
                  className="mt-8 w-full rounded-xl border border-slate-200 py-3 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Mulai Gratis
                </button>
              </div>

              <div className="relative overflow-hidden rounded-[26px] border border-orange-300 bg-white p-7 shadow-[0_25px_70px_-35px_rgba(234,88,12,0.4)]">
                <div className="absolute right-5 top-5 rounded-full bg-orange-50 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.12em] text-orange-600">
                  Recommended
                </div>

                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-600">
                  Premium
                </div>

                <div className="mt-3 flex items-end gap-1">
                  <span className="text-[42px] font-bold tracking-[-0.05em] text-slate-950">
                    Rp149rb
                  </span>
                  <span className="mb-1.5 text-[10px] text-slate-400">
                    /bulan
                  </span>
                </div>

                <div className="mt-1 text-[10px] text-slate-400">
                  Akses semua fitur
                </div>

                <div className="my-7 h-px bg-slate-100" />

                <ul className="space-y-3">
                  {PREMIUM_FEATURES.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2.5 text-[11px] text-slate-600"
                    >
                      <Check
                        size={13}
                        className="shrink-0 text-emerald-500"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={goToSignup}
                  className="mt-8 w-full rounded-xl bg-orange-600 py-3 text-[11px] font-bold text-white shadow-sm transition hover:bg-orange-700"
                >
                  Upgrade ke Premium
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================
            FAQ
        ========================================================== */}
        <section className="bg-white px-5 py-20 sm:px-7 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-3xl">
            <div className="text-center">
              <SectionLabel>FAQ</SectionLabel>

              <h2 className="mt-4 text-[34px] font-bold leading-tight tracking-[-0.045em] text-slate-950 sm:text-[44px]">
                Yang sering ditanyain.
              </h2>
            </div>

            <div className="mt-10 space-y-2.5">
              {FAQS.map((faq, index) => {
                const isOpen = openFaq === index;

                return (
                  <div
                    key={faq.q}
                    className={`overflow-hidden rounded-2xl border transition ${
                      isOpen
                        ? "border-orange-200 bg-orange-50/30"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? null : index)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    >
                      <span className="text-[12px] font-bold text-slate-800">
                        {faq.q}
                      </span>

                      <ChevronDown
                        size={15}
                        className={`shrink-0 text-slate-400 transition ${
                          isOpen ? "rotate-180 text-orange-600" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="border-t border-slate-100 px-5 pb-5 pt-3 text-[11px] leading-6 text-slate-500">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
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
                    Dengan membuat akun, kamu setuju menggunakan Nexto sesuai
                    ketentuan layanan yang berlaku.
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
      </footer>
    </div>
  );
}
