import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
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
} from "lucide-react";
import { NextoBadge } from "./App";

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
          <div className="flex items-center gap-2">
            <NextoBadge size={23} />
            <span className="text-[11px] font-bold tracking-tight text-slate-900">
              Nexto
            </span>
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
          <a href="#" className="flex items-center gap-2.5">
            <NextoBadge size={32} />
            <div className="text-[17px] font-bold tracking-[-0.03em] text-slate-950">
              Nexto
            </div>
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
                  <div className="mb-6 flex items-center gap-2.5">
                    <NextoBadge size={34} />
                    <div>
                      <div className="text-[13px] font-bold text-white">
                        Nexto
                      </div>
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
          <div className="flex items-center gap-2.5">
            <NextoBadge size={23} />
            <div>
              <div className="text-[11px] font-bold text-white">Nexto</div>
              <div className="text-[8px] text-slate-600">
                Sales Loop Engine
              </div>
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
