import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { AI_FEATURES, AI_GROUPS } from "../lib/aiFeatureCatalog";

// Kartu FITUR AI di Command Center (10 Okt 2026, permintaan Nando): semua fitur AI tanpa kecuali, tiap fitur berupa
// dropdown (klik untuk melihat detail): model, paket dan batas (gate), biaya nyata per panggilan, perkiraan biaya maksimal
// per pengguna, dan pemakaian bulan ini. Data pemakaian dari admin_ai_usage_report().feature_stats (tabel ai_usage);
// definisi fitur dan batas dari src/lib/aiFeatureCatalog.js.
const BLOCK = "rounded-xl border border-white/[0.14] bg-[#111826]";
const PLANS = [
  { key: "standard", short: "Standard", color: "#38bdf8" },
  { key: "professional", short: "Pro", color: "#a78bfa" },
  { key: "enterprise", short: "Enterprise", color: "#f59e0b" },
];
const usd = (n, d) => {
  const v = Number(n) || 0;
  const dec = d ?? (Math.abs(v) > 0 && Math.abs(v) < 1 ? 4 : 2);
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: dec })}`;
};
const idr = (n) => `Rp${Math.round(Math.abs(Number(n) || 0)).toLocaleString("id-ID")}`;
const when = (iso) => (iso ? new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "belum pernah");
const limitLabel = (v) => (v === null ? "-" : v === "auto" ? "otomatis" : `${v}x`);

function aggregate(feat, rows) {
  const keys = new Set(feat.logKeys);
  const mine = (rows || []).filter((r) => keys.has(r.feature));
  const sum = (k) => mine.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const calls_all = sum("calls_all");
  return {
    calls_month: sum("calls_month"), cost_month: sum("cost_month"), calls_all, cost_all: sum("cost_all"),
    max_cost: mine.reduce((m, r) => Math.max(m, Number(r.max_cost) || 0), 0),
    avg_in: calls_all ? mine.reduce((s, r) => s + (Number(r.avg_in) || 0) * (Number(r.calls_all) || 0), 0) / calls_all : 0,
    avg_out: calls_all ? mine.reduce((s, r) => s + (Number(r.avg_out) || 0) * (Number(r.calls_all) || 0), 0) / calls_all : 0,
    audio_s: sum("audio_s"), users_month: mine.reduce((m, r) => Math.max(m, Number(r.users_month) || 0), 0),
    last_at: mine.reduce((m, r) => (r.last_at && (!m || r.last_at > m) ? r.last_at : m), null),
    primary_calls: mine.filter((r) => r.feature === feat.logKeys[0]).reduce((s, r) => s + (Number(r.calls_all) || 0), 0),
  };
}

// Biaya per penggunaan: data nyata bila sudah cukup sampel (>= 3) dan bukan fitur yang hanya diperkirakan, jika tidak pakai perkiraan.
function costOf(feat, st) {
  if (!feat.est) return { avg: null, worst: null, source: "none" };
  const measuredOk = !feat.estOnly && st.calls_all >= 3;
  if (feat.perRun) {
    const runs = st.primary_calls;
    if (runs >= 1 && !feat.estOnly) return { avg: st.cost_all / runs, worst: Math.max(feat.est.worst, st.max_cost), source: "measured", n: runs };
    return { avg: feat.est.avg, worst: feat.est.worst, source: "est" };
  }
  if (measuredOk) return { avg: st.cost_all / st.calls_all, worst: Math.max(feat.est.worst, st.max_cost), source: "measured", n: st.calls_all };
  return { avg: feat.est.avg, worst: Math.max(feat.est.worst, st.max_cost), source: "est", n: st.calls_all };
}

function Chip({ plan, value }) {
  const off = value === null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border" style={{ color: off ? "#64748b" : plan.color, borderColor: off ? "#334155" : `${plan.color}88`, background: off ? "transparent" : `${plan.color}1a` }}>
      {plan.short} {limitLabel(value)}
    </span>
  );
}

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] font-mono uppercase tracking-wide text-slate-400 mb-0.5">{label}</div>
      <div className="text-[12px] text-slate-100 leading-relaxed break-words">{children}</div>
    </div>
  );
}

export default function AiFeaturesPanel({ stats, kurs }) {
  const rate = Number(kurs) || 17900;
  const [open, setOpen] = useState(() => new Set());
  const rows = useMemo(() => AI_FEATURES.map((f) => {
    const st = aggregate(f, stats);
    return { f, st, cost: costOf(f, st) };
  }), [stats]);

  const totals = useMemo(() => {
    const t = { standard: { avg: 0, worst: 0 }, professional: { avg: 0, worst: 0 }, enterprise: { avg: 0, worst: 0 } };
    for (const { f, cost } of rows) {
      if (f.group === "off" || !cost.avg) continue;
      for (const p of PLANS) {
        const n = f.plans[p.key];
        if (typeof n === "number") { t[p.key].avg += n * cost.avg; t[p.key].worst += n * cost.worst; }
      }
    }
    return t;
  }, [rows]);

  const monthCost = rows.reduce((s, r) => s + r.st.cost_month, 0);
  const unlogged = AI_FEATURES.filter((f) => f.logged === false).length;
  const toggle = (id) => setOpen((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOpen = open.size >= AI_FEATURES.length;

  return (
    <div className="grid gap-4 min-w-0">
      <div className={`${BLOCK} p-3 grid gap-3`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[12px] font-bold uppercase tracking-wider text-slate-100">Biaya token maksimal per pengguna per bulan</div>
          <div className="text-[10.5px] font-mono text-slate-400">kalau semua kuota fitur terpakai habis · kurs Rp{rate.toLocaleString("id-ID")}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {PLANS.map((p) => (
            <div key={p.key} className="rounded-xl border border-white/[0.14] bg-[#0a0f18] px-3 py-2.5">
              <div className="text-[10px] font-mono uppercase tracking-wide" style={{ color: p.color }}>{p.short === "Pro" ? "Professional" : p.short}</div>
              <div className="text-[18px] font-bold font-mono text-white">{usd(totals[p.key].avg, 2)} <span className="text-[11px] font-normal text-slate-400">realistis</span></div>
              <div className="text-[12px] font-mono text-slate-300">{usd(totals[p.key].worst, 2)} terburuk</div>
              <div className="text-[10.5px] font-mono text-slate-400 mt-0.5">{idr(totals[p.key].avg * rate)} · {idr(totals[p.key].worst * rate)}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-slate-400 font-mono leading-relaxed">
          Realistis = batas bulanan × biaya rata-rata nyata per panggilan. Terburuk = batas bulanan × biaya tertinggi (meeting 60 menit, suara 3 menit). Fitur yang belum punya data nyata memakai perkiraan dan diberi label.
          Biaya AI tercatat bulan ini: <span className="text-white font-bold">{usd(monthCost)}</span>.
          {unlogged > 0 && <span className="text-amber-300"> {unlogged} fitur internal belum mencatat biaya ke ai_usage (kecil), jadi tagihan Anthropic bisa sedikit di atas angka di Cash Flow.</span>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-mono text-slate-300">{AI_FEATURES.length} fitur terdaftar · klik baris untuk melihat detail</div>
        <button onClick={() => setOpen(allOpen ? new Set() : new Set(AI_FEATURES.map((f) => f.id)))} className="text-[11px] font-mono font-bold px-2.5 py-1.5 rounded-lg border border-white/[0.25] bg-[#111826] text-slate-100 hover:bg-[#182033]">
          {allOpen ? "Tutup semua" : "Buka semua"}
        </button>
      </div>

      {AI_GROUPS.map((g) => {
        const list = rows.filter((r) => r.f.group === g.key);
        if (!list.length) return null;
        return (
          <section key={g.key} className="grid gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-300">{g.label}</h3>
            {list.map(({ f, st, cost }) => {
              const isOpen = open.has(f.id);
              const dead = f.group === "off";
              return (
                <div key={f.id} className={`${BLOCK} overflow-hidden ${dead ? "opacity-80" : ""}`}>
                  <button onClick={() => toggle(f.id)} aria-expanded={isOpen} className="w-full flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left hover:bg-[#182033] transition-colors">
                    <ChevronDown className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                    <span className="text-[12.5px] font-bold text-white min-w-[160px]">{f.label}</span>
                    {!dead && <span className="flex flex-wrap gap-1">{PLANS.map((p) => <Chip key={p.key} plan={p} value={f.plans[p.key]} />)}</span>}
                    {f.logged === false && <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-300/60 text-amber-200">biaya tidak tercatat</span>}
                    {dead && <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-slate-500 text-slate-300">{f.id === "mcp" ? "tanpa AI Nexto" : "dimatikan"}</span>}
                    <span className="ml-auto flex items-center gap-4 text-[11px] font-mono tabular-nums">
                      {!dead && f.logged !== false && <span className="text-slate-300">{st.calls_month}x bulan ini</span>}
                      {!dead && f.logged !== false && <span className="text-pink-200 font-bold w-[78px] text-right">{usd(st.cost_month)}</span>}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-white/[0.14] bg-[#0a0f18] p-3 grid gap-3">
                      <div className="text-[12px] text-slate-200 leading-relaxed">{f.desc}</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Detail label="Fungsi">{f.fn}</Detail>
                        <Detail label="Model">{f.model}</Detail>
                        <Detail label="Gate dan batas">{f.gate}</Detail>
                        {!dead && (
                          <Detail label="Batas per paket (per pengguna)">
                            <span className="flex flex-wrap gap-1">{PLANS.map((p) => <Chip key={p.key} plan={p} value={f.plans[p.key]} />)}</span>
                          </Detail>
                        )}
                        {cost.avg !== null && (
                          <Detail label={f.perRun ? "Biaya per pencarian" : "Biaya per panggilan"}>
                            rata-rata <b className="text-white">{usd(cost.avg, 4)}</b> · tertinggi <b className="text-white">{usd(cost.worst, 4)}</b>
                            <div className="text-[10.5px] font-mono text-slate-400 mt-0.5">
                              {cost.source === "measured" ? `data nyata dari ${cost.n} ${f.perRun ? "pencarian" : "panggilan"}` : f.logged === false ? "perkiraan (tidak dicatat)" : st.calls_all > 0 ? `perkiraan (data nyata baru ${st.calls_all} panggilan)` : "perkiraan (belum ada data nyata)"}
                            </div>
                          </Detail>
                        )}
                        {!dead && cost.avg !== null && PLANS.some((p) => typeof f.plans[p.key] === "number") && (
                          <Detail label="Biaya maksimal per pengguna per bulan">
                            {PLANS.filter((p) => typeof f.plans[p.key] === "number").map((p) => (
                              <div key={p.key} className="text-[11.5px] font-mono">
                                <span style={{ color: p.color }}>{p.short}</span>: {usd(f.plans[p.key] * cost.avg, 2)} realistis · {usd(f.plans[p.key] * cost.worst, 2)} terburuk
                              </div>
                            ))}
                          </Detail>
                        )}
                        {f.logged !== false && !dead && (
                          <Detail label="Pemakaian bulan ini">
                            {st.calls_month} panggilan · {usd(st.cost_month)} · {st.users_month} akun
                            <div className="text-[10.5px] font-mono text-slate-400 mt-0.5">total sejak pencatatan: {st.calls_all} panggilan · {usd(st.cost_all)}</div>
                          </Detail>
                        )}
                        {f.logged !== false && !dead && st.calls_all > 0 && (
                          <Detail label="Rata-rata token dan terakhir dipakai">
                            masuk {Math.round(st.avg_in).toLocaleString("id-ID")} · keluar {Math.round(st.avg_out).toLocaleString("id-ID")}{st.audio_s > 0 ? ` · audio ${Math.round(st.audio_s)} dtk` : ""}
                            <div className="text-[10.5px] font-mono text-slate-400 mt-0.5">terakhir: {when(st.last_at)}</div>
                          </Detail>
                        )}
                      </div>
                      {f.note && <div className="text-[11px] text-amber-200/90 font-mono leading-relaxed border-l-2 border-amber-400/60 pl-2">{f.note}</div>}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
