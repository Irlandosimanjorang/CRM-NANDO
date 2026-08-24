import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import {
  Loader2,
  Users,
  CalendarCheck,
  Swords,
  CalendarClock,
  Lightbulb,
  Send,
  Calendar,
  Bot,
  MapPin,
  Mic,
  Trophy,
  Check,
  X,
  ArrowRight,
  Sparkles,
  Pencil,
  MessageCircle,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { NextoBadge } from "./App";

const FEATURES = [
  {
    icon: Lightbulb,
    title: "AI Advisor",
    desc: "Rekomendasi lead potensial tiap pagi.",
  },
  {
    icon: Send,
    title: "Bot Telegram",
    desc: "Update lead & progress langsung via chat, tanpa buka app.",
  },
  {
    icon: MapPin,
    title: "Check-in GPS",
    desc: "Bukti kunjungan asli, otomatis kedeteksi jarak lokasi.",
  },
  {
    icon: Mic,
    title: "Rekam Meeting",
    desc: "Rekam obrolan, otomatis jadi catatan rapi + next action.",
  },
  {
    icon: Calendar,
    title: "Google Calendar",
    desc: "Jadwal visit otomatis masuk ke kalender kamu.",
  },
  {
    icon: Trophy,
    title: "Deal Multi-Transaksi",
    desc: "Repeat order kehitung semua, gak ketimpa yang lama.",
  },
  {
    icon: Users,
    title: "Kelola Leads",
    desc: "Prospek tersusun rapi dalam satu pipeline.",
  },
  {
    icon: CalendarCheck,
    title: "Jadwal Visit",
    desc: "Catat kunjungan tanpa ada yang kelewat.",
  },
  {
    icon: Swords,
    title: "Analisa Kompetitor",
    desc: "Data pesaing buat strategi lebih tajam.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Daftar, pipeline langsung siap",
    desc: "Gak perlu setting apa-apa — begitu daftar, tahap pipeline default udah kebentuk otomatis.",
  },
  {
    n: "2",
    title: "Masukin lead kamu",
    desc: "Tambah manual atau import langsung dari Excel, sistem baca sendiri format kolomnya.",
  },
  {
    n: "3",
    title: "Kelola dari chat & web",
    desc: "Update progress lewat Telegram sambil di jalan, atau buka web pas mau lihat laporan lengkap.",
  },
];

const FREE_FEATURES = ["Dashboard", "Kelola Leads"];

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
    q: "Paket Free-nya kayak gimana?",
    a: "Free bisa dipake selamanya, akses Dashboard & Leads. Cukup buat mulai rapiin data lead kamu.",
  },
  {
    q: "Fitur AI (bot Telegram, AI Advisor, dst) kenapa berbayar?",
    a: "Fitur AI itu jalan pake API berbayar (token AI), jadi kebukanya di paket Premium biar biayanya kekover.",
  },
  {
    q: "Bisa berhenti kapan aja?",
    a: "Bisa. Gak ada kontrak/kunci jangka panjang.",
  },
  {
    q: "Data aku aman gak?",
    a: "Data kamu terkunci per akun, gak bisa diakses akun lain. Disimpen di infrastruktur cloud yang sama dipakai banyak aplikasi bisnis lainnya.",
  },
];

/* ================================================================
   NEXTO AI SALES ENGINE
   SECTION TAMBAHAN.
   TIDAK MENGGANTIKAN SECTION LAMA.
================================================================ */

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

                {/* Nexto mark */}
                <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 border border-orange-400/20">
                  <NextoBadge size={22} />
                </div>

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

/* ================================================================
   AUTH / LANDING PAGE
================================================================ */

export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

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

  const CARD =
    "bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* =========================================================
          HEADER
      ========================================================== */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <NextoBadge size={32} />

            <div className="font-bold tracking-tight text-base">
              Nexto
            </div>
          </div>

          <a
            href="#daftar"
            className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-4 py-2 rounded-xl font-medium"
          >
            Masuk / Daftar
          </a>
        </div>
      </header>

      {/* =========================================================
          EXISTING HERO — TETAP
      ========================================================== */}
      <section className="text-white" style={{ background: "#1c1917" }}>
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-24">
          <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-widest mb-4">
            CRM Sales B2B + AI
          </div>

          <h1 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-5 max-w-2xl">
            Satu tempat buat semua urusan sales kamu.
          </h1>

          <p className="text-stone-400 text-sm md:text-base mb-8 max-w-xl leading-relaxed">
            Dari lead pertama masuk sampai deal closing — kelola pipeline,
            update progress lewat chat Telegram, dan biarin AI bantu nyaranin
            lead mana yang harus dikejar duluan.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#daftar"
              className="bg-orange-600 hover:bg-orange-700 text-white text-sm px-6 py-3 rounded-xl font-medium flex items-center gap-2"
            >
              Daftar Gratis
              <ArrowRight size={15} />
            </a>

            <a
              href="#harga"
              className="text-stone-300 hover:text-white text-sm px-4 py-3"
            >
              Lihat harga →
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================
          EXISTING BOT SECTION — TETAP
      ========================================================== */}
      <section
        className="text-white"
        style={{ background: "#0c0b09" }}
      >
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-widest mb-3">
              Satu chat, semua kerjaan
            </div>

            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              1 bot Telegram, ngerjain semuanya
            </h2>

            <p className="text-sm text-stone-400 max-w-xl mx-auto">
              Gak perlu buka app buat tiap kerjaan kecil — tinggal chat aja,
              bot-nya yang urus ke CRM.
            </p>
          </div>

          <svg
            width="100%"
            viewBox="0 0 700 580"
            role="img"
            className="max-w-2xl mx-auto block"
          >
            <title>Diagram cara kerja bot Telegram Nexto</title>

            <desc>
              Bot Telegram sebagai hub bercahaya di tengah, terhubung lewat
              garis glowing ke tiga kartu fungsi: atur jadwal visit yang
              otomatis masuk Google Calendar, update progress lewat chat atau
              voice note, dan edit data CRM langsung dari obrolan.
            </desc>

            <defs>
              <radialGradient
                id="orbCore"
                cx="42%"
                cy="38%"
                r="70%"
              >
                <stop offset="0" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#7c2d12" />
              </radialGradient>

              <linearGradient
                id="cardGlow"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor="#2a1f16" />
                <stop offset="1" stopColor="#1a1613" />
              </linearGradient>

              <filter
                id="glow"
                x="-60%"
                y="-60%"
                width="220%"
                height="220%"
              >
                <feGaussianBlur stdDeviation="7" result="b" />

                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter
                id="glowSoft"
                x="-80%"
                y="-80%"
                width="260%"
                height="260%"
              >
                <feGaussianBlur stdDeviation="12" />
              </filter>

              <filter
                id="cardBorderGlow"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feGaussianBlur
                  stdDeviation="3"
                  result="b"
                />

                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <circle
              cx="350"
              cy="290"
              r="100"
              fill="#f97316"
              opacity="0.22"
              filter="url(#glowSoft)"
            />

            <path
              d="M195,178 Q270,210 313,248"
              fill="none"
              stroke="#fb923c"
              strokeWidth="2"
              opacity="0.8"
              strokeLinecap="round"
              filter="url(#glow)"
            />

            <path
              d="M505,178 Q430,210 387,248"
              fill="none"
              stroke="#fb923c"
              strokeWidth="2"
              opacity="0.8"
              strokeLinecap="round"
              filter="url(#glow)"
            />

            <path
              d="M350,415 Q368,386 350,357"
              fill="none"
              stroke="#fb923c"
              strokeWidth="2"
              opacity="0.8"
              strokeLinecap="round"
              filter="url(#glow)"
            />

            <circle
              cx="350"
              cy="290"
              r="68"
              fill="url(#orbCore)"
              filter="url(#glow)"
            />

            <g fill="#fff7ed">
              <circle cx="337" cy="268" r="1.6" opacity="0.6" />
              <circle cx="363" cy="262" r="1.1" opacity="0.45" />
              <circle cx="328" cy="292" r="2" opacity="0.65" />
              <circle cx="358" cy="302" r="1.4" opacity="0.5" />
              <circle cx="344" cy="313" r="1" opacity="0.35" />
              <circle cx="372" cy="282" r="1.7" opacity="0.55" />
              <circle cx="320" cy="278" r="1.2" opacity="0.4" />
              <circle cx="365" cy="310" r="1" opacity="0.3" />
            </g>

            <text
              x="350"
              y="286"
              textAnchor="middle"
              fill="#fff7ed"
              fontSize="14"
              fontWeight="700"
            >
              Bot Telegram
            </text>

            <text
              x="350"
              y="303"
              textAnchor="middle"
              fill="#ffe4c4"
              fontSize="10.5"
            >
              1 chat, semua beres
            </text>

            <rect
              x="15"
              y="30"
              width="290"
              height="148"
              rx="20"
              fill="url(#cardGlow)"
              stroke="#fb923c"
              strokeOpacity="0.6"
              strokeWidth="1.2"
              filter="url(#cardBorderGlow)"
            />

            <circle
              cx="48"
              cy="62"
              r="5"
              fill="#fb923c"
              filter="url(#glow)"
            />

            <text
              x="65"
              y="67"
              fill="#ffffff"
              fontSize="14"
              fontWeight="700"
            >
              Atur jadwal visit
            </text>

            <text
              x="40"
              y="90"
              fill="#c4b8ab"
              fontSize="11.5"
            >
              <tspan x="40" dy="0">
                Sebut nama perusahaan +
              </tspan>

              <tspan x="40" dy="16">
                tanggal, langsung tercatat
              </tspan>

              <tspan x="40" dy="16">
                di jadwal kunjungan kamu.
              </tspan>
            </text>

            <rect
              x="40"
              y="132"
              width="234"
              height="24"
              rx="12"
              fill="#fb923c"
              fillOpacity="0.15"
              stroke="#fb923c"
              strokeOpacity="0.5"
              strokeWidth="1"
            />

            <text
              x="52"
              y="148"
              fill="#fdba74"
              fontSize="11"
              fontWeight="600"
            >
              📅 Otomatis sinkron ke Google Calendar
            </text>

            <text
              x="40"
              y="170"
              fill="#8a7f74"
              fontSize="10.5"
              fontStyle="italic"
            >
              "Jadwalin visit PT Sinar Abadi Senin depan"
            </text>

            <rect
              x="395"
              y="30"
              width="290"
              height="148"
              rx="20"
              fill="url(#cardGlow)"
              stroke="#fb923c"
              strokeOpacity="0.6"
              strokeWidth="1.2"
              filter="url(#cardBorderGlow)"
            />

            <circle
              cx="428"
              cy="62"
              r="5"
              fill="#fb923c"
              filter="url(#glow)"
            />

            <text
              x="445"
              y="67"
              fill="#ffffff"
              fontSize="14"
              fontWeight="700"
            >
              Update progress
            </text>

            <text
              x="420"
              y="90"
              fill="#c4b8ab"
              fontSize="11.5"
            >
              <tspan x="420" dy="0">
                Sebut key person &amp; hasil
              </tspan>

              <tspan x="420" dy="16">
                obrolan, langsung ke-log
              </tspan>

              <tspan x="420" dy="16">
                rapi di kartu lead-nya.
              </tspan>
            </text>

            <rect
              x="420"
              y="132"
              width="230"
              height="24"
              rx="12"
              fill="#fb923c"
              fillOpacity="0.15"
              stroke="#fb923c"
              strokeOpacity="0.5"
              strokeWidth="1"
            />

            <text
              x="432"
              y="148"
              fill="#fdba74"
              fontSize="11"
              fontWeight="600"
            >
              🎤 Bisa ketik atau kirim voice note
            </text>

            <text
              x="420"
              y="170"
              fill="#8a7f74"
              fontSize="10.5"
              fontStyle="italic"
            >
              "Ketemu Pak Budi, minat trial 2 ton"
            </text>

            <rect
              x="175"
              y="418"
              width="350"
              height="140"
              rx="20"
              fill="url(#cardGlow)"
              stroke="#fb923c"
              strokeOpacity="0.6"
              strokeWidth="1.2"
              filter="url(#cardBorderGlow)"
            />

            <circle
              cx="208"
              cy="450"
              r="5"
              fill="#fb923c"
              filter="url(#glow)"
            />

            <text
              x="225"
              y="455"
              fill="#ffffff"
              fontSize="14"
              fontWeight="700"
            >
              Edit data CRM
            </text>

            <text
              x="200"
              y="478"
              fill="#c4b8ab"
              fontSize="11.5"
            >
              <tspan x="200" dy="0">
                Tambah lead baru, hapus, atau ubah
              </tspan>

              <tspan x="200" dy="16">
                data — cukup nyuruh lewat chat,
              </tspan>

              <tspan x="200" dy="16">
                tanpa buka aplikasi sama sekali.
              </tspan>
            </text>

            <text
              x="200"
              y="546"
              fill="#8a7f74"
              fontSize="10.5"
              fontStyle="italic"
            >
              "Hapus lead CV Maju Jaya, salah input"
            </text>
          </svg>
        </div>
      </section>

      {/* =========================================================
          NEW ADDITION — AI SALES ENGINE
          INI TAMBAHAN BARU, BUKAN PENGGANTI SECTION DI ATAS.
      ========================================================== */}
      <NextoAISalesEngine />

      {/* =========================================================
          FITUR — EXISTING
      ========================================================== */}
      <section id="fitur" className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-20">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Fitur yang beneran kepake
          </h2>

          <p className="text-sm text-slate-500">
            Bukan cuma nyimpen kontak — Nexto bantu kerjaan sales sehari-hari.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {FEATURES.map((f, i) => {
            const I = f.icon;

            return (
              <div key={i} className={`${CARD} p-5`}>
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-3">
                  <I size={18} />
                </div>

                <div className="font-semibold text-sm mb-1">
                  {f.title}
                </div>

                <div className="text-xs text-slate-500 leading-relaxed">
                  {f.desc}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* =========================================================
          CARA KERJA — EXISTING
      ========================================================== */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              Mulainya gampang
            </h2>

            <p className="text-sm text-slate-500">
              3 langkah, gak ada setup ribet.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((s) => (
              <div key={s.n}>
                <div className="w-9 h-9 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-sm mb-3">
                  {s.n}
                </div>

                <div className="font-semibold text-sm mb-1.5">
                  {s.title}
                </div>

                <div className="text-xs text-slate-500 leading-relaxed">
                  {s.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          HARGA — EXISTING
      ========================================================== */}
      <section
        id="harga"
        className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-20"
      >
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Harga simpel, gak pake ribet
          </h2>

          <p className="text-sm text-slate-500">
            Mulai gratis, upgrade kapan aja kamu siap.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl mx-auto">
          <div className={`${CARD} p-6`}>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Free
            </div>

            <div className="text-3xl font-bold mb-1">
              Rp0
            </div>

            <div className="text-xs text-slate-400 mb-5">
              Selamanya gratis
            </div>

            <ul className="space-y-2.5 mb-6">
              {FREE_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <Check
                    size={15}
                    className="text-emerald-500 shrink-0"
                  />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="#daftar"
              className="block text-center w-full border border-slate-300 hover:bg-slate-50 text-sm py-2.5 rounded-xl font-medium"
            >
              Mulai Gratis
            </a>
          </div>

          <div
            className={`${CARD} p-6 border-orange-300 relative overflow-hidden`}
          >
            <div className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-1">
              Premium
            </div>

            <div className="text-3xl font-bold mb-1">
              Rp149rb
              <span className="text-sm font-normal text-slate-400">
                /bulan
              </span>
            </div>

            <div className="text-xs text-slate-400 mb-5">
              Akses semua fitur
            </div>

            <ul className="space-y-2.5 mb-6">
              {PREMIUM_FEATURES.map((f) => (
                <li
                  key={f}
                  className="flex items-center gap-2 text-sm text-slate-600"
                >
                  <Check
                    size={15}
                    className="text-emerald-500 shrink-0"
                  />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="#daftar"
              className="block text-center w-full bg-orange-600 hover:bg-orange-700 text-white text-sm py-2.5 rounded-xl font-medium"
            >
              Upgrade ke Premium
            </a>
          </div>
        </div>
      </section>

      {/* =========================================================
          FAQ — EXISTING
      ========================================================== */}
      <section className="bg-white border-y border-slate-100">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-16 md:py-20">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-8 text-center">
            Pertanyaan yang sering ditanyain
          </h2>

          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={i} className={`${CARD} p-5`}>
                <div className="font-semibold text-sm mb-1.5">
                  {f.q}
                </div>

                <div className="text-xs text-slate-500 leading-relaxed">
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          FORM DAFTAR / MASUK — EXISTING
      ========================================================== */}
      <section
        id="daftar"
        className="max-w-5xl mx-auto px-4 md:px-6 py-16 md:py-20"
      >
        <div className="max-w-sm mx-auto">
          <div className={`${CARD} p-7`}>
            <div className="flex items-center gap-2.5 mb-5">
              <NextoBadge size={36} />

              <div className="leading-tight">
                <div className="font-bold tracking-tight">
                  Nexto
                </div>
              </div>
            </div>

            <div className="text-[11px] font-semibold text-orange-600 uppercase tracking-widest mb-2">
              Nexto CRM
            </div>

            <h3 className="text-xl font-bold mb-1">
              {mode === "signin"
                ? "Selamat datang kembali"
                : "Buat akun baru"}
            </h3>

            <p className="text-xs text-slate-400 mb-5">
              {mode === "signin"
                ? "Masuk buat akses pipeline-mu."
                : "Gratis buat mulai, upgrade kapan aja kamu siap."}
            </p>

            <div className="space-y-3">
              <input
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                type="password"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
                placeholder="Password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && submit()
                }
              />

              {msg && (
                <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2">
                  {msg}
                </div>
              )}

              <button
                onClick={submit}
                disabled={loading}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm py-2.5 rounded-xl font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2
                    size={15}
                    className="animate-spin"
                  />
                ) : null}

                {mode === "signin" ? "Masuk" : "Daftar"}
              </button>

              <button
                onClick={() => {
                  setMode(
                    mode === "signin"
                      ? "signup"
                      : "signin"
                  );

                  setMsg("");
                }}
                className="w-full text-xs text-slate-500 hover:text-slate-800"
              >
                {mode === "signin"
                  ? "Belum punya akun? Daftar"
                  : "Sudah punya akun? Masuk"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          FOOTER — EXISTING
      ========================================================== */}
      <footer className="border-t border-slate-100">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <NextoBadge size={20} />
            Nexto CRM
          </div>

          <div>
            © {new Date().getFullYear()} Nexto. Dibuat buat sales B2B
            Indonesia.
          </div>
        </div>
      </footer>
    </div>
  );
}
