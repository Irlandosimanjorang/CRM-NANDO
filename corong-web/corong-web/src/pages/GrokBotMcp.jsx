// Halaman marketing berdiri sendiri: "Nexto x Grok Bot via MCP" (12 Sep 2026).
// Diakses via nexto.site/grok-bot - dirender LANGSUNG dari main.jsx (bukan
// lewat App.jsx/Auth.jsx), jadi gak kena logika login/session sama sekali,
// bisa dibuka publik kapan aja buat promosiin integrasi MCP ini.
import { useState } from "react";
import {
  ArrowLeft, ArrowRight, KeyRound, Link2, MessageSquareText, Check,
  ListChecks, FileSearch, PlusCircle, ArrowRightLeft, NotebookPen,
  LayoutList, Gauge, ShieldCheck, Lock, Sparkles,
} from "lucide-react";
import { NextoRobotHead, NextoDarkWordmark } from "../Auth.jsx";

const TOOLS = [
  { icon: ListChecks, name: "list_leads", desc: "List & filter lead berdasarkan stage, kategori, atau priority.", group: "read" },
  { icon: FileSearch, name: "get_lead", desc: "Detail lengkap satu lead + histori progress terbaru.", group: "read" },
  { icon: LayoutList, name: "list_stages", desc: "Lihat semua tahap pipeline yang ada di CRM.", group: "read" },
  { icon: Gauge, name: "get_pipeline_stats", desc: "Ringkasan lead aktif, overdue follow-up, dan win rate.", group: "read" },
  { icon: PlusCircle, name: "create_lead", desc: "Bikin lead/prospek baru langsung dari chat.", group: "write" },
  { icon: ArrowRightLeft, name: "update_lead_stage", desc: "Pindahin lead ke tahap pipeline lain.", group: "write" },
  { icon: NotebookPen, name: "add_progress_note", desc: "Catat hasil telepon, WA, atau meeting ke satu lead.", group: "write" },
];

const PROMPTS = [
  "Cek lead yang overdue follow-up hari ini.",
  "Bikin lead baru buat PT Sumber Makmur, kategori distribusi, priority tinggi.",
  "Pindahin PT Asiaplast ke stage Negosiasi.",
  "Kasih summary win rate pipeline gua bulan ini.",
];

const STEPS = [
  { icon: KeyRound, title: "Buat API Key", desc: "Buka Pengaturan → Integrasi MCP di Nexto, klik \"Buat API Key\". Sekali klik, langsung dapet key + Server URL." },
  { icon: Link2, title: "Sambungin ke Grok Bot", desc: "Bilang \"Pasang Nexto MCP\" ke Grok Bot, kirim Server URL + API Key-nya. Grok Bot connect sebagai custom MCP." },
  { icon: MessageSquareText, title: "Suruh dia kerja", desc: "Tinggal ngobrol biasa - \"cek lead overdue\", \"update stage PT Asiaplast\" - Grok Bot yang eksekusi ke Nexto." },
];

function ToolCard({ tool }) {
  const Icon = tool.icon;
  const isWrite = tool.group === "write";
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0d1119] p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${isWrite ? "bg-orange-500/15 text-orange-400" : "bg-sky-500/15 text-sky-400"}`}>
          <Icon size={15} />
        </span>
        <code className="text-[13px] font-semibold text-white">{tool.name}</code>
      </div>
      <p className="text-[12.5px] leading-relaxed text-slate-400">{tool.desc}</p>
    </div>
  );
}

export default function GrokBotMcp() {
  const [promptIdx, setPromptIdx] = useState(0);

  return (
    <div className="min-h-screen bg-[#05070c] text-white">
      {/* ---- Header ---- */}
      <header className="border-b border-white/[0.06] px-5 py-4 sm:px-7 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <NextoRobotHead size={30} />
            <NextoDarkWordmark width={92} />
          </a>
          <a href="/" className="flex items-center gap-1.5 text-[13px] font-medium text-slate-400 hover:text-white">
            <ArrowLeft size={14} /> Kembali ke Nexto
          </a>
        </div>
      </header>

      {/* ---- Hero ---- */}
      <section className="relative overflow-hidden px-5 py-16 sm:px-7 sm:py-24 lg:px-10">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
          style={{ background: "radial-gradient(60% 60% at 50% 0%, rgba(249,115,22,0.14), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-orange-400/25 bg-orange-500/10 px-3.5 py-1.5 text-[12px] font-semibold text-orange-300">
            <Sparkles size={13} /> Integrasi baru · Nexto × Grok Bot (xAI)
          </div>
          <h1 className="mt-5 text-center text-[34px] font-extrabold leading-[1.12] tracking-tight sm:text-5xl">
            Grok Bot sekarang bisa<br className="hidden sm:block" /> masuk & <span className="text-orange-500">kerja langsung</span> di Nexto.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-center text-[15px] leading-relaxed text-slate-400 sm:text-base">
            Lewat protokol MCP, agent AI seperti Grok Bot bisa baca lead, pindahin stage pipeline, dan catat progress -
            atas nama akun Anda, tanpa pernah pegang password Anda.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/" className="flex items-center gap-1.5 rounded-2xl bg-orange-600 px-5 py-3 text-[14px] font-semibold text-white shadow-[0_15px_35px_-12px_rgba(249,115,22,0.55)] hover:bg-orange-700">
              Aktifkan di Pengaturan <ArrowRight size={15} />
            </a>
            <span className="text-[12.5px] text-slate-500">Fitur Professional & Enterprise</span>
          </div>

          {/* Mockup percakapan */}
          <div className="mx-auto mt-14 max-w-lg overflow-hidden rounded-[22px] border border-white/10 bg-[#0d1119] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)]">
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.8)]" />
              <span className="text-[11px] font-medium text-slate-400">Grok Bot · Nexto MCP connected · 7 tools</span>
            </div>
            <div className="space-y-3 p-4">
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-orange-600 px-3.5 py-2.5 text-[12.5px] font-medium text-white">
                Cek lead yang overdue follow-up hari ini.
              </div>
              <div className="mr-auto flex max-w-[75%] items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1.5 text-[10.5px] text-slate-400">
                <Gauge size={11} className="text-sky-400" /> memanggil <code className="text-slate-300">list_leads</code> via MCP…
              </div>
              <div className="mr-auto max-w-[88%] rounded-2xl rounded-bl-sm bg-[#141a26] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-200">
                Ada 2 lead overdue: <b>PT Elang Duta Asia</b> (6 hari) dan <b>PT Karya Linar</b> (9 hari). Mau saya catetin hasil follow-up-nya begitu Anda hubungi?
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Apa itu MCP ---- */}
      <section className="border-t border-white/[0.06] px-5 py-16 sm:px-7 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">Apa itu MCP?</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">
            <b className="text-slate-200">Model Context Protocol (MCP)</b> adalah standar terbuka yang bikin AI agent
            seperti Grok Bot bisa "bicara" langsung ke aplikasi lain lewat sekumpulan perintah (tools) yang jelas dan
            terbatas - bukan login sembarangan, bukan akses penuh ke semua data. Nexto expose 7 tools spesifik lewat MCP,
            jadi Grok Bot cuma bisa ngerjain hal-hal yang memang dimaksudkan buat sales, gak lebih dari itu.
          </p>
        </div>
      </section>

      {/* ---- Cara kerja ---- */}
      <section className="border-t border-white/[0.06] px-5 py-16 sm:px-7 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">3 langkah, langsung jalan</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative rounded-2xl border border-white/[0.08] bg-[#0d1119] p-5">
                  <span className="absolute -top-3 -left-3 flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-[12px] font-bold text-white">{i + 1}</span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-3 text-[15px] font-semibold text-white">{s.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- Tools ---- */}
      <section className="border-t border-white/[0.06] px-5 py-16 sm:px-7 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">7 tools yang bisa dipakai Grok Bot</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-[13.5px] text-slate-400">
            Dibagi 2: yang cuma baca data (biru), dan yang bisa nulis/ubah data (oranye) - semuanya cuma nyentuh data
            di dalam akun Anda sendiri.
          </p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => <ToolCard key={t.name} tool={t} />)}
          </div>
        </div>
      </section>

      {/* ---- Contoh prompt ---- */}
      <section className="border-t border-white/[0.06] px-5 py-16 sm:px-7 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Tinggal ngobrol aja</h2>
          <p className="mt-3 text-center text-[13.5px] text-slate-400">Gak perlu hafal perintah teknis - coba salah satu ini ke Grok Bot Anda:</p>
          <div className="mt-8 space-y-2.5">
            {PROMPTS.map((p, i) => (
              <button
                key={p}
                onClick={() => setPromptIdx(i)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-[13.5px] transition-colors ${
                  promptIdx === i ? "border-orange-400/40 bg-orange-500/10 text-white" : "border-white/[0.08] bg-[#0d1119] text-slate-300 hover:border-white/20"
                }`}
              >
                "{p}"
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Keamanan ---- */}
      <section className="border-t border-white/[0.06] px-5 py-16 sm:px-7 sm:py-20 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Aman by design</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { icon: Lock, text: "API key terpisah dari password login Anda - Grok Bot gak pernah tau password Anda." },
              { icon: ShieldCheck, text: "Setiap key discope ke akun Anda sendiri - gak bisa nyentuh data organisasi lain." },
              { icon: Check, text: "Bisa dicabut kapan aja dari Pengaturan - Grok Bot langsung kehilangan akses saat itu juga." },
              { icon: ListChecks, text: "Cuma 7 aksi spesifik yang di-expose - gak ada akses generik ke billing atau anggota tim." },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.text} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#0d1119] p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400"><Icon size={15} /></span>
                  <p className="text-[13px] leading-relaxed text-slate-300">{f.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---- CTA akhir ---- */}
      <section className="border-t border-white/[0.06] px-5 py-16 text-center sm:px-7 sm:py-20 lg:px-10">
        <h2 className="text-2xl font-bold sm:text-3xl">Siap sambungin Grok Bot ke Nexto?</h2>
        <p className="mx-auto mt-3 max-w-md text-[13.5px] text-slate-400">
          Tersedia buat paket Professional & Enterprise. Generate API key-nya dari Pengaturan, sambungin, langsung jalan.
        </p>
        <a href="/" className="mt-7 inline-flex items-center gap-1.5 rounded-2xl bg-orange-600 px-6 py-3.5 text-[14px] font-semibold text-white shadow-[0_15px_35px_-12px_rgba(249,115,22,0.55)] hover:bg-orange-700">
          Buka Nexto <ArrowRight size={15} />
        </a>
      </section>

      <footer className="border-t border-white/[0.06] px-5 py-8 text-center text-[12px] text-slate-500 sm:px-7 lg:px-10">
        © {new Date().getFullYear()} Nexto. Grok Bot adalah produk xAI - integrasi ini dibangun Nexto lewat protokol MCP terbuka.
      </footer>
    </div>
  );
}
