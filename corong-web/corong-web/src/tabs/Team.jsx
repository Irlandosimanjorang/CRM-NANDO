import { useEffect, useId, useRef, useState } from "react";
import { Activity, MapPin, NotebookPen, ArrowRightLeft, UserPlus, AlertTriangle, RefreshCw, Trash2, RotateCcw, PencilLine, CalendarPlus, CalendarX, Trophy, Sparkles, Mail, Target, Wallet, CalendarDays, CheckCircle2 } from "lucide-react";
import * as db from "../lib/db";
import TeamLeaderboard from "../components/TeamLeaderboard";

// Tab "Team" (30 Sep 2026, permintaan Nando dari calon klien Enterprise yang
// minta "preview dashboard rekap aktivitas manager"). Khusus owner/manager
// org Enterprise. Semua dari data yang udah ada - gak manggil AI.
//
// Redesign visual (30 Sep 2026): band "Denyut Team" + grafik 7 hari, skor
// aktivitas berbentuk cincin, gauge target, bar kontrak 3 warna, grafik batang
// timeline, aksen warna per bagian, skeleton loading. Semua grafik digambar
// pake SVG sendiri (tanpa library). Animasi mati otomatis kalau user nyalain
// "kurangi gerakan" (prefers-reduced-motion).

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const INACTIVE_DAYS = 3;

function rangeFor(key) {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear(), m = wib.getUTCMonth(), d = wib.getUTCDate();
  let start;
  if (key === "today") start = Date.UTC(y, m, d);
  else if (key === "month") start = Date.UTC(y, m, 1);
  else start = Date.UTC(y, m, d - ((wib.getUTCDay() + 6) % 7));
  return { from: new Date(start - WIB_OFFSET_MS), to: new Date(now.getTime() + 60000) };
}

const RANGES = [
  { key: "today", label: "Hari ini" },
  { key: "week", label: "Minggu ini" },
  { key: "month", label: "Bulan ini" },
];

const KIND = {
  visit: { icon: MapPin, color: "text-sky-600 bg-sky-50", verb: "check-in di" },
  note: { icon: NotebookPen, color: "text-violet-600 bg-violet-50", verb: "menulis catatan di" },
  stage: { icon: ArrowRightLeft, color: "text-amber-600 bg-amber-50", verb: "memindahkan tahap" },
  lead: { icon: UserPlus, color: "text-emerald-600 bg-emerald-50", verb: "menambahkan lead" },
  lead_deleted: { icon: Trash2, color: "text-rose-600 bg-rose-50", verb: "menghapus lead" },
  lead_restored: { icon: RotateCcw, color: "text-teal-600 bg-teal-50", verb: "memulihkan lead" },
  lead_edited: { icon: PencilLine, color: "text-slate-600 bg-slate-100", verb: "mengubah data" },
  visit_scheduled: { icon: CalendarPlus, color: "text-sky-600 bg-sky-50", verb: "menjadwalkan visit ke" },
  visit_cancelled: { icon: CalendarX, color: "text-orange-600 bg-orange-50", verb: "membatalkan visit ke" },
  deal: { icon: Trophy, color: "text-emerald-700 bg-emerald-50", verb: "mencatat deal" },
  email: { icon: Mail, color: "text-blue-600 bg-blue-50", verb: "mengirim email ke" },
  ai_draft: { icon: Sparkles, color: "text-fuchsia-600 bg-fuchsia-50", verb: "membuat draft AI untuk" },
  needs_summary: { icon: Sparkles, color: "text-fuchsia-600 bg-fuchsia-50", verb: "membuat Ringkasan Kebutuhan untuk" },
};
const INLINE_DETAIL = new Set(["stage", "visit_scheduled", "deal", "ai_draft", "lead_deleted"]);

// Contoh yang ditampilin (transparan + label "Contoh") kalau timeline kosong.
const EMPTY_EXAMPLES = [
  { kind: "visit", who: "Budi", lead: "PT Mitra Logistik", when: "10:15" },
  { kind: "stage", who: "Sari", lead: "PT Bank Sejahtera", detail: "Hot Lead → Booking", when: "09:40" },
  { kind: "note", who: "Budi", lead: "PT Mitra Logistik", detail: "HRD butuh assessment 40 supervisor sebelum Q1, minta proposal minggu ini.", when: "Kemarin, 16:20" },
  { kind: "lead", who: "Andi", lead: "PT Arta Graha Konstruksi", when: "Kemarin, 11:05" },
];

const ROLE_LABEL = { owner: "Owner", manager: "Manager", sales_rep: "Sales" };
const COLS = [
  { key: "visits", label: "Kunjungan" },
  { key: "notes", label: "Notulen" },
  { key: "new_leads", label: "Lead baru" },
  { key: "stage_moves", label: "Pindah tahap" },
  { key: "deals", label: "Deal" },
];

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
const fmtRp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const fmtJt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e9) return "Rp" + (v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (v >= 1e6) return "Rp" + (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
  return fmtRp(v);
};
function monthStartIso(offset = 0) {
  const wib = new Date(Date.now() + WIB_OFFSET_MS);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() + offset, 1)).toISOString().slice(0, 10);
}
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
function dayBounds(isoDay) {
  const [y, m, d] = isoDay.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d) - WIB_OFFSET_MS);
  return { from, to: new Date(from.getTime() + 86400000) };
}
const todayIso = () => new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);

const AVATAR_BG = ["bg-orange-500", "bg-violet-500", "bg-sky-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500"];
function avatarBg(uid) {
  let h = 0;
  for (const ch of String(uid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}
function initialsOf(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}
function activityStatus(m) {
  const idle = daysSince(m.last_activity_at);
  if (idle == null) return { dot: "bg-rose-500", text: "belum ada aktivitas", cls: "text-rose-600" };
  if (idle === 0) return { dot: "bg-emerald-500", text: "aktif hari ini", cls: "text-emerald-600" };
  if (idle < INACTIVE_DAYS) return { dot: "bg-slate-300", text: `${idle} hari lalu`, cls: "text-slate-500" };
  return { dot: "bg-amber-400", text: `${idle} hari tidak aktif`, cls: "text-amber-600" };
}

const CARD = "rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-[0_14px_40px_-30px_rgba(15,23,42,.32)]";
const TONES = {
  orange: "bg-orange-50 text-orange-500",
  violet: "bg-violet-50 text-violet-500",
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
};

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---------- Primitif visual (SVG sendiri) ----------

function SectionHead({ icon: Icon, tone, title, sub, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${TONES[tone]}`}><Icon size={17} /></div>
        <div>
          <div className="text-sm font-bold text-slate-800">{title}</div>
          {sub && <div className="text-[10.5px] text-slate-400">{sub}</div>}
        </div>
      </div>
      {right}
    </div>
  );
}

function Segmented({ options, value, onChange, dark }) {
  return (
    <div className={`flex rounded-2xl border p-1 ${dark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white shadow-sm"}`}>
      {options.map(([k, l]) => (
        <button key={k} onClick={() => onChange(k)} className={`rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-colors ${value === k ? (dark ? "bg-white text-slate-950" : "bg-slate-950 text-white") : (dark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900")}`}>{l}</button>
      ))}
    </div>
  );
}

function Skeleton({ className = "" }) {
  return <div className={`rounded-xl bg-slate-100 motion-safe:animate-pulse ${className}`} />;
}

// Angka "menghitung naik" sekali tiap nilainya berubah.
function CountUp({ value, format = (v) => Math.round(v).toLocaleString("id-ID") }) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);
  useEffect(() => {
    if (prefersReducedMotion()) { setShown(value); from.current = value; return; }
    const start = performance.now(), a = from.current, b = Number(value) || 0, dur = 700;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (b - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

// Kurva aktivitas 7 hari (area oranye -> violet).
function Sparkline({ values, width = 300, height = 64 }) {
  const id = useId().replace(/:/g, "");
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const pts = values.map((v, i) => [i * step, height - 6 - (v / max) * (height - 14)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full overflow-visible" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`s${id}`} x1="0" x2="1"><stop offset="0" stopColor="#fb923c" /><stop offset="1" stopColor="#a78bfa" /></linearGradient>
        <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f97316" stopOpacity=".35" /><stop offset="1" stopColor="#6d5dfc" stopOpacity="0" /></linearGradient>
      </defs>
      <path d={area} fill={`url(#a${id})`} />
      <path d={line} fill="none" stroke={`url(#s${id})`} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="4" fill="#a78bfa" stroke="#0b1020" strokeWidth="2" />
    </svg>
  );
}

// Cincin skor 0-100.
function Ring({ pct, size = 46 }) {
  const r = (size - 7) / 2, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`Skor aktivitas ${p}/100 (dibandingkan anggota lain)`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f97316" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-black tabular-nums text-slate-800">{p}</div>
    </div>
  );
}

// Gauge setengah lingkaran: busur tebal = tercapai, busur muda = + forecast.
function Gauge({ pct, forecastPct }) {
  const r = 52, len = Math.PI * r;
  const arc = `M 8 62 A ${r} ${r} 0 0 1 112 62`;
  const clamp = (v) => Math.max(0, Math.min(100, v || 0));
  return (
    <svg viewBox="0 0 120 70" className="w-full max-w-[150px]" aria-hidden="true">
      <path d={arc} fill="none" stroke="#f1f5f9" strokeWidth="10" strokeLinecap="round" />
      <path d={arc} fill="none" stroke="#fed7aa" strokeWidth="10" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - clamp(forecastPct) / 100)} />
      <path d={arc} fill="none" stroke="#f97316" strokeWidth="10" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - clamp(pct) / 100)} className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700" />
      <text x="60" y="56" textAnchor="middle" className="fill-slate-900" style={{ fontSize: 20, fontWeight: 900 }}>{Math.max(0, pct || 0)}%</text>
    </svg>
  );
}

// Bar 3 lapis: masuk (hijau) / ditagih belum dibayar (biru) / belum ditagih (abu).
function StackBar({ contract, invoiced, paid, overdue, className = "h-2.5" }) {
  const total = Math.max(1, Number(contract) || 0);
  const p = (v) => `${Math.max(0, (Number(v) || 0) / total) * 100}%`;
  const inv = Math.max(0, Number(invoiced) - Number(paid));
  const rest = Math.max(0, Number(contract) - Number(invoiced));
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-slate-100 ${Number(overdue) > 0 ? "ring-2 ring-rose-300 ring-offset-1" : ""} ${className}`}>
      <div className="bg-emerald-500" style={{ width: p(paid) }} />
      <div className="bg-sky-400" style={{ width: p(inv) }} />
      <div className="bg-slate-200" style={{ width: p(rest) }} />
    </div>
  );
}

// Grafik batang 7 hari yang bisa diklik per tanggal.
function DayBars({ days, selected, onSelect }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const t = todayIso();
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const dt = new Date(d.day + "T00:00:00Z");
        const active = d.day === selected;
        const h = d.count > 0 ? Math.max(10, Math.round((d.count / max) * 100)) : 4;
        return (
          <button key={d.day} onClick={() => onSelect(d.day)} className={`group flex flex-col items-center rounded-2xl px-1 pb-2 pt-2 transition-colors ${active ? "bg-slate-950" : "hover:bg-slate-50"}`} aria-pressed={active}>
            <span className={`text-[11px] font-bold tabular-nums ${active ? "text-orange-300" : d.count ? "text-slate-700" : "text-slate-300"}`}>{d.count}</span>
            <div className="mt-1 flex h-20 w-full items-end justify-center">
              <div className={`w-3/5 max-w-[26px] rounded-t-lg motion-safe:transition-all motion-safe:duration-500 ${active ? "bg-gradient-to-t from-orange-500 to-violet-400" : d.count ? "bg-orange-200 group-hover:bg-orange-300" : "bg-slate-100"}`} style={{ height: `${h}%` }} />
            </div>
            <span className={"mt-1.5 text-[10px] text-slate-400"}>{d.day === t ? "Hari ini" : HARI[dt.getUTCDay()]}</span>
            <span className={`text-[13px] font-bold leading-tight ${active ? "text-white" : "text-slate-700"}`}>{dt.getUTCDate()}</span>
          </button>
        );
      })}
    </div>
  );
}

// ---------- Tab Team ----------

export default function Team({ leads, stages, dealTransactions, onOpenLead, canManage }) {
  const api = db;
  const [range, setRange] = useState("week");
  const [data, setData] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [daysRaw, setDays] = useState(null); // null = belum dimuat
  const days = daysRaw || [];
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = () => {
    const { from, to } = rangeFor(range);
    setLoading(true);
    setErr("");
    setReloadKey((k) => k + 1);
    api.getTeamContracts().then(setContracts).catch(() => setContracts([]));
    api.getTeamActivityDays(7).then(setDays).catch(() => setDays([]));
    api.getTeamActivity(from, to)
      .then(setData)
      .catch((e) => setErr(e.message || "Gagal memuat rekap aktivitas"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [range]);

  const members = data?.members || [];
  const nameOf = Object.fromEntries(members.map((m) => [m.user_id, m.name]));
  const openLeadById = (id) => {
    const l = (leads || []).find((x) => x.id === id);
    if (l) onOpenLead?.(l);
  };
  const rangeLabel = RANGES.find((r) => r.key === range)?.label || "";

  const maxOf = Object.fromEntries(COLS.map((c) => [c.key, Math.max(1, ...members.map((m) => Number(m[c.key]) || 0))]));
  const totalOf = (m) => COLS.reduce((s, c) => s + (Number(m[c.key]) || 0), 0);
  const maxTotal = Math.max(1, ...members.map(totalOf));

  const dealValue = members.reduce((s, m) => s + Number(m.deal_value || 0), 0);
  const activeCount = members.filter((m) => totalOf(m) > 0).length;
  const running = contracts.filter((c) => Number(c.paid) < Number(c.contract));
  const remaining = running.reduce((s, c) => s + Number(c.contract) - Number(c.paid), 0);
  const weekTotal = days.reduce((s, d) => s + d.count, 0);
  const attention = [
    ...members
      .filter((m) => m.role === "sales_rep" && (m.last_activity_at == null || daysSince(m.last_activity_at) >= INACTIVE_DAYS))
      .map((m) => ({ key: "idle-" + m.user_id, tone: "amber", title: m.name, text: m.last_activity_at ? `tidak ada aktivitas ${daysSince(m.last_activity_at)} hari` : "belum pernah ada aktivitas" })),
    ...running
      .filter((c) => Number(c.overdue) > 0)
      .map((c) => ({ key: "late-" + c.lead_id, tone: "rose", title: c.lead_name, text: `telat bayar ${fmtJt(c.overdue)}`, leadId: c.lead_id })),
    ...running
      .filter((c) => !(Number(c.overdue) > 0) && c.days_left != null && c.days_left >= 0 && c.days_left <= 3 && !c.next_invoiced)
      .map((c) => ({ key: "due-" + c.lead_id, tone: "sky", title: c.lead_name, text: `${c.next_label || "termin"} jatuh tempo ${c.days_left === 0 ? "hari ini" : `${c.days_left} hari lagi`}, belum ditagih`, leadId: c.lead_id })),
  ];
  const ATT_TONE = {
    amber: "bg-amber-400/10 text-amber-200 ring-amber-300/20",
    rose: "bg-rose-500/15 text-rose-200 ring-rose-300/25",
    sky: "bg-sky-400/10 text-sky-200 ring-sky-300/20",
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-500">Khusus owner & manager</div>
          <h1 className="mt-1 text-[26px] font-black leading-none tracking-[-0.04em] text-slate-900">Team</h1>
        </div>
        <div className="flex items-center gap-2">
          <Segmented options={RANGES.map((r) => [r.key, r.label])} value={range} onChange={setRange} />
          <button onClick={load} disabled={loading} className="rounded-2xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm hover:text-slate-900 disabled:opacity-50" title="Muat ulang" aria-label="Muat ulang">
            <RefreshCw size={14} className={loading ? "motion-safe:animate-spin" : ""} />
          </button>
        </div>
      </div>

      {err && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      {/* DENYUT TEAM - satu-satunya kartu gelap di tab ini. */}
      <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 text-white shadow-[0_24px_60px_-34px_rgba(15,23,42,.8)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr] bg-[radial-gradient(circle_at_12%_0%,rgba(249,115,22,.24),transparent_38%),radial-gradient(circle_at_95%_100%,rgba(109,93,252,.32),transparent_42%)]">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[.18em] text-orange-300">Denyut team · {rangeLabel}</div>
            {loading && !data ? (
              <div className="mt-4 grid grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-12 rounded-xl bg-white/10 motion-safe:animate-pulse" />)}</div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[26px] font-black leading-none tracking-[-0.04em] tabular-nums"><CountUp value={dealValue} format={fmtJt} /></div>
                  <div className="mt-1.5 text-[11px] text-slate-400">Deal masuk</div>
                </div>
                <div>
                  <div className="text-[26px] font-black leading-none tracking-[-0.04em] tabular-nums"><CountUp value={activeCount} /><span className="text-slate-500">/{members.length}</span></div>
                  <div className="mt-1.5 text-[11px] text-slate-400">Anggota aktif</div>
                </div>
                <div>
                  <div className="text-[26px] font-black leading-none tracking-[-0.04em] tabular-nums text-emerald-300"><CountUp value={remaining} format={fmtJt} /></div>
                  <div className="mt-1.5 text-[11px] text-slate-400">Belum masuk dari {running.length} proyek</div>
                </div>
              </div>
            )}
            <div className="mt-5">
              <div className="flex items-baseline justify-between text-[10.5px] text-slate-400">
                <span>Aktivitas team 7 hari terakhir</span>
                <span className="tabular-nums text-slate-300">{weekTotal} aktivitas</span>
              </div>
              <Sparkline values={days.map((d) => d.count)} />
              <div className="flex justify-between text-[9.5px] text-slate-500">
                {days.map((d) => <span key={d.day}>{HARI[new Date(d.day + "T00:00:00Z").getUTCDay()]}</span>)}
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-white">
              {attention.length ? <AlertTriangle size={14} className="text-amber-300" /> : <CheckCircle2 size={14} className="text-emerald-300" />}
              {attention.length ? `Perlu perhatian (${attention.length})` : "Semua aman"}
            </div>
            {attention.length === 0 ? (
              <p className="mt-2 text-[11.5px] text-slate-400">Tidak ada sales yang pasif dan tidak ada termin yang telat atau mendekati jatuh tempo.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {attention.slice(0, 5).map((a) => (
                  <li key={a.key}>
                    <button onClick={() => a.leadId && openLeadById(a.leadId)} className={`w-full rounded-xl px-3 py-2 text-left text-[11.5px] ring-1 transition-colors ${ATT_TONE[a.tone]} ${a.leadId ? "hover:bg-white/10" : "cursor-default"}`}>
                      <b className="text-white">{a.title}</b> <span>{a.text}</span>
                    </button>
                  </li>
                ))}
                {attention.length > 5 && <li className="text-[11px] text-slate-400">+{attention.length - 5} lagi</li>}
              </ul>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* REKAP AKTIVITAS */}
        <section className={CARD}>
          <SectionHead icon={Activity} tone="orange" title="Rekap Aktivitas" sub={`${rangeLabel} · cincin = skor aktivitas dibandingkan anggota lain`} />
          {loading && !data ? (
            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)}</div>
          ) : (
            <div className="space-y-3">
              {members.map((m) => {
                const st = activityStatus(m);
                const score = Math.round((totalOf(m) / maxTotal) * 100);
                return (
                  <div key={m.user_id} className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/80 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_12px_30px_-20px_rgba(249,115,22,.55)] motion-reduce:transform-none">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-[12px] font-bold text-white ${avatarBg(m.user_id)}`}>{initialsOf(m.name)}</div>
                        <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${st.dot}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-bold text-slate-900">{m.name}</div>
                        <div className="text-[10.5px] text-slate-400">{ROLE_LABEL[m.role] || m.role} · <span className={`font-semibold ${st.cls}`}>{st.text}</span></div>
                      </div>
                      <Ring pct={score} />
                    </div>
                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {COLS.map((c) => {
                        const v = Number(m[c.key]) || 0;
                        return (
                          <div key={c.key} className="min-w-0">
                            <div className={`text-[17px] font-black leading-none tabular-nums ${v > 0 ? "text-slate-900" : "text-slate-300"}`}>{v}</div>
                            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200/70">
                              <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${Math.round((v / maxOf[c.key]) * 100)}%` }} />
                            </div>
                            <div className="mt-1 truncate text-[10px] text-slate-500">{c.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <p className="text-[10.5px] text-slate-400">"Pindah tahap" & "Deal" dihitung dari perubahan tahap lead yang tercatat sejak 30 Sep 2026.</p>
            </div>
          )}
        </section>

        <TargetsCard api={api} members={members} reloadKey={reloadKey} />
      </div>

      <PaymentsCard nameOf={nameOf} rows={contracts} loading={loading && !data} onOpenLead={openLeadById} />

      <ActivityTimeline api={api} nameOf={nameOf} days={days} daysLoaded={daysRaw !== null} reloadKey={reloadKey} />

      <TeamLeaderboard leads={leads} stages={stages} dealTransactions={dealTransactions} onOpenLead={onOpenLead} canManage={canManage} />
    </div>
  );
}

// Timeline 7 hari: grafik batang (klik tanggal) + daftar aktivitas hari itu.
function ActivityTimeline({ api, nameOf, days, daysLoaded, reloadKey }) {
  const [selected, setSelected] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!days.length) return;
    setSelected((cur) => (cur && days.some((x) => x.day === cur) ? cur : days[days.length - 1].day));
  }, [days]);

  useEffect(() => {
    if (!selected) return;
    const { from, to } = dayBounds(selected);
    setLoading(true);
    api.getTeamFeed(from, to, 200).then(setFeed).catch(() => setFeed([])).finally(() => setLoading(false));
  }, [selected, reloadKey]);

  const sel = days.find((d) => d.day === selected);
  const selLabel = selected ? new Date(selected + "T00:00:00Z").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "";
  const showExamples = !loading && feed.length === 0 && days.length > 0 && days.every((d) => d.count === 0);

  return (
    <section className={CARD}>
      <SectionHead icon={CalendarDays} tone="sky" title="Aktivitas 7 Hari Terakhir" sub="Klik batang untuk melihat aktivitas pada tanggal tersebut" />
      {!daysLoaded ? <Skeleton className="h-36 rounded-2xl" /> : days.length === 0 ? <p className="text-[12px] text-slate-500">Timeline belum dapat dimuat. Klik tombol muat ulang di kanan atas.</p> : <DayBars days={days} selected={selected} onSelect={setSelected} />}

      {selected && (<>
      <div className="mb-3 mt-5 flex items-baseline justify-between gap-2 border-t border-slate-100 pt-4">
        <div className="text-[13px] font-bold capitalize text-slate-800">{selLabel}</div>
        {sel && <div className="text-[11px] tabular-nums text-slate-400">{sel.count} aktivitas</div>}
      </div>

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="flex gap-3"><Skeleton className="h-8 w-8" /><Skeleton className="h-8 flex-1" /></div>)}</div>
      ) : feed.length === 0 ? (
        showExamples ? (
          <div>
            <p className="text-[12px] text-slate-500">Belum ada aktivitas. Aktivitas akan muncul otomatis di sini setiap anggota team melakukan check-in GPS, menulis catatan, menambah/mengubah/menghapus lead, menjadwalkan visit, memindahkan tahap, mencatat deal, atau mengirim email - seperti contoh di bawah.</p>
            <ul className="mt-4 space-y-3 opacity-50" aria-label="Contoh tampilan">
              {EMPTY_EXAMPLES.map((e, i) => {
                const k = KIND[e.kind];
                const I = k.icon;
                return (
                  <li key={i} className="flex gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${k.color}`}><I size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] text-slate-700">
                        <span className="mr-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">Contoh</span>
                        <b className="text-slate-900">{e.who}</b> {k.verb} <b className="text-slate-900">{e.lead}</b>
                        {e.detail && e.kind === "stage" && <span className="text-slate-500"> ({e.detail})</span>}
                      </div>
                      {e.kind === "note" && <div className="mt-0.5 text-[11.5px] text-slate-500">{e.detail}</div>}
                      <div className="mt-0.5 text-[10.5px] text-slate-400">{e.when}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="py-6 text-center text-[12px] text-slate-400">Tidak ada aktivitas pada tanggal ini.</div>
        )
      ) : (
        <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-4 before:top-2 before:w-px before:bg-slate-100">
          {feed.map((e, i) => {
            const k = KIND[e.kind] || KIND.note;
            const I = k.icon;
            return (
              <li key={i} className="relative flex gap-3">
                <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-4 ring-white ${k.color}`}><I size={14} /></span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="text-[12.5px] text-slate-700">
                    <b className="text-slate-900">{nameOf[e.user_id] || "Anggota"}</b> {k.verb} <b className="text-slate-900">{e.lead_name || "-"}</b>
                    {INLINE_DETAIL.has(e.kind) && e.detail && <span className="text-slate-500"> ({e.detail})</span>}
                  </div>
                  {!INLINE_DETAIL.has(e.kind) && e.detail && <div className="mt-0.5 line-clamp-2 text-[11.5px] text-slate-500">{e.detail}</div>}
                  <div className="mt-0.5 text-[10.5px] text-slate-400">{new Date(e.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      </>)}
    </section>
  );
}

// Target bulanan per sales (gauge) + pencapaian + forecast.
function TargetsCard({ api, members, reloadKey }) {
  const [month, setMonth] = useState(monthStartIso(0));
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.getTeamTargets(month).then(setRows).catch(() => setRows([]));
  useEffect(() => { setRows(null); load(); }, [month, reloadKey]);

  const save = async (uid) => {
    setBusy(true);
    try {
      await api.setSalesTarget(uid, month, Number(input.replace(/[^\d]/g, "")) || 0);
      setEditing(null);
      await load();
    } catch (e) { alert("Gagal menyimpan target: " + e.message); } finally { setBusy(false); }
  };

  const byId = Object.fromEntries((rows || []).map((r) => [r.user_id, r]));
  const monthLabel = new Date(month + "T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  const noValue = (rows || []).reduce((s, r) => s + (r.open_without_value || 0), 0);

  return (
    <section className={CARD}>
      <SectionHead icon={Target} tone="violet" title="Target & Forecast" sub={`${monthLabel} · klik angka target untuk mengubah`}
        right={<Segmented options={[[monthStartIso(0), "Bulan ini"], [monthStartIso(1), "Bulan depan"]]} value={month} onChange={setMonth} />} />
      {rows === null ? (
        <div className="grid grid-cols-2 gap-4">{[0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {members.map((m) => {
              const r = byId[m.user_id] || { target: 0, achieved: 0, forecast: 0, pipeline: 0 };
              const pct = r.target > 0 ? Math.round((r.achieved / r.target) * 100) : 0;
              const projected = r.target > 0 ? Math.round(((Number(r.achieved) + Number(r.forecast)) / r.target) * 100) : 0;
              return (
                <div key={m.user_id} className="flex flex-col items-center rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-violet-50/40 p-3 text-center">
                  <div className="flex w-full items-center gap-2">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${avatarBg(m.user_id)}`}>{initialsOf(m.name)}</div>
                    <div className="min-w-0 truncate text-left text-[12px] font-bold text-slate-800">{m.name}</div>
                  </div>
                  {r.target > 0 ? <Gauge pct={pct} forecastPct={projected} /> : <div className="flex h-[70px] items-center text-[11px] text-slate-400">Belum ada target</div>}
                  {editing === m.user_id ? (
                    <div className="mt-1 flex w-full flex-col gap-1.5">
                      <input autoFocus inputMode="numeric" className="w-full rounded-lg border border-slate-300 px-2 py-1 text-[12px]" placeholder="Target (Rp)" value={input}
                        onChange={(e) => setInput(e.target.value.replace(/[^\d]/g, "") ? Number(e.target.value.replace(/[^\d]/g, "")).toLocaleString("id-ID") : "")}
                        onKeyDown={(e) => { if (e.key === "Enter") save(m.user_id); if (e.key === "Escape") setEditing(null); }} />
                      <div className="flex gap-1.5">
                        <button disabled={busy} onClick={() => save(m.user_id)} className="flex-1 rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50">Simpan</button>
                        <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] text-slate-500">Batal</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setEditing(m.user_id); setInput(r.target ? Number(r.target).toLocaleString("id-ID") : ""); }} className="mt-0.5 text-[12px] tabular-nums text-slate-600 hover:text-violet-600">
                      <b className="text-slate-900">{fmtJt(r.achieved)}</b> / {r.target > 0 ? fmtJt(r.target) : <span className="underline decoration-dotted">set target</span>}
                    </button>
                  )}
                  <div className="mt-1 text-[10.5px] tabular-nums text-slate-400">Forecast {fmtJt(r.forecast)}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-orange-500" />Tercapai</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-orange-200" />Jika forecast closing</span>
          </div>
          {noValue > 0 && <p className="mt-2 text-[10.5px] text-slate-400">{noValue} lead aktif belum memiliki nilai proyek - lengkapi di detail lead agar forecast akurat.</p>}
        </>
      )}
    </section>
  );
}

// Kontrak & Pembayaran per proyek: tab Berjalan / Selesai, bar 3 warna.
function PaymentsCard({ nameOf, rows, loading, onOpenLead }) {
  const [view, setView] = useState("running");

  const running = rows.filter((r) => Number(r.paid) < Number(r.contract));
  const done = rows.filter((r) => Number(r.paid) >= Number(r.contract));
  const list = view === "running" ? running : done;
  const sum = (k) => list.reduce((s, r) => s + Number(r[k] || 0), 0);
  const contract = sum("contract"), invoiced = sum("invoiced"), paid = sum("paid"), overdue = sum("overdue");
  const pctIn = contract > 0 ? Math.round((paid / contract) * 100) : 0;

  const tiles = [
    { label: "Nilai kontrak", hint: "Total nilai proyek yang sudah deal", value: contract, cls: "text-slate-900", dot: "bg-slate-300" },
    { label: "Sudah ditagih", hint: "Invoice yang sudah dikirim ke klien", value: invoiced, cls: "text-sky-700", dot: "bg-sky-400" },
    { label: "Sudah masuk", hint: "Uang yang sudah diterima (Cash In)", value: paid, cls: "text-emerald-700", dot: "bg-emerald-500" },
    { label: "Telat dibayar", hint: "Lewat jatuh tempo, belum dibayar", value: overdue, cls: overdue > 0 ? "text-rose-600" : "text-slate-400", dot: overdue > 0 ? "bg-rose-500" : "bg-slate-200" },
  ];

  return (
    <section className={CARD}>
      <SectionHead icon={Wallet} tone="emerald" title="Kontrak & Pembayaran" sub="Booking → Revenue → Cash In · dari termin di tiap lead"
        right={<Segmented options={[["running", `Berjalan (${running.length})`], ["done", `Selesai (${done.length})`]]} value={view} onChange={setView} />} />

      {loading ? (
        <div className="space-y-3"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div><Skeleton className="h-3" /></div>
      ) : rows.length === 0 ? (
        <p className="text-[12px] text-slate-500">Belum ada kontrak. Buka detail lead yang sudah deal, isi <b>Nilai proyek</b>, lalu catat termin pembayarannya di bagian <b>Kontrak & Termin Pembayaran</b>.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3.5 py-3">
                <div className={`text-[16px] font-black tabular-nums ${t.cls}`}><CountUp value={t.value} format={fmtJt} /></div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-600"><span className={`h-2 w-2 rounded-full ${t.dot}`} />{t.label}</div>
                <div className="text-[10px] leading-snug text-slate-400">{t.hint}</div>
              </div>
            ))}
          </div>

          {contract > 0 && (
            <div className="mt-5 rounded-2xl bg-slate-50/70 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-[12px] text-slate-600">
                <span><b className="text-emerald-700">{fmtJt(paid)}</b> dari {fmtJt(contract)} sudah masuk</span>
                <span className="text-[18px] font-black tabular-nums text-slate-900">{pctIn}%</span>
              </div>
              <StackBar contract={contract} invoiced={invoiced} paid={paid} overdue={overdue} className="mt-2 h-3.5" />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-emerald-500" />Sudah masuk</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-sky-400" />Ditagih, belum dibayar</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-full bg-slate-200" />Belum ditagih</span>
                {view === "running" && <span className="ml-auto font-semibold text-slate-700">Sisa belum masuk: {fmtJt(contract - paid)}</span>}
              </div>
            </div>
          )}

          <div className="mt-5 overflow-x-auto">
            {list.length === 0 ? (
              <p className="text-[12px] text-slate-400">{view === "running" ? "Semua proyek sudah lunas." : "Belum ada proyek yang lunas 100%."}</p>
            ) : (
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-3 font-semibold">Proyek</th>
                    <th className="px-2 py-2 text-right font-semibold">Nilai kontrak</th>
                    <th className="px-2 py-2 text-right font-semibold">Sudah masuk</th>
                    <th className="px-2 py-2 text-right font-semibold">Sisa</th>
                    <th className="py-2 pl-3 font-semibold">{view === "running" ? "Termin berikutnya" : "Termin"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((r) => {
                    const pct = Number(r.contract) > 0 ? Math.round((Number(r.paid) / Number(r.contract)) * 100) : 0;
                    const late = r.days_left != null && r.days_left < 0;
                    return (
                      <tr key={r.lead_id} onClick={() => onOpenLead(r.lead_id)} className="cursor-pointer transition-colors hover:bg-slate-50/80">
                        <td className="py-3 pr-3">
                          <div className="font-semibold text-slate-800">{r.lead_name}</div>
                          <div className="text-[10.5px] text-slate-400">{nameOf[r.user_id] || "-"} · {r.terms_paid}/{r.terms} termin lunas</div>
                          <StackBar contract={r.contract} invoiced={r.invoiced} paid={r.paid} overdue={r.overdue} className="mt-1.5 h-1.5 w-40" />
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums text-slate-700">{fmtJt(r.contract)}</td>
                        <td className="px-2 py-3 text-right tabular-nums font-semibold text-emerald-700">{fmtJt(r.paid)} <span className="text-[10.5px] font-normal text-slate-400">({pct}%)</span></td>
                        <td className={`px-2 py-3 text-right tabular-nums font-semibold ${Number(r.overdue) > 0 ? "text-rose-600" : "text-slate-800"}`}>{fmtJt(Number(r.contract) - Number(r.paid))}</td>
                        <td className="py-3 pl-3">
                          {view === "running" && r.next_label != null ? (
                            <>
                              <div className="text-slate-700">{r.next_label || "Termin"}</div>
                              <div className={`text-[10.5px] font-semibold ${late ? "text-rose-600" : r.days_left != null && r.days_left <= 3 ? "text-amber-600" : "text-slate-400"}`}>
                                {r.days_left == null ? "belum ada jatuh tempo" : late ? `Telat ${-r.days_left} hari` : r.days_left === 0 ? "Jatuh tempo hari ini" : `${r.days_left} hari lagi`}
                                {r.next_invoiced ? " · sudah ditagih" : " · belum ditagih"}
                              </div>
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><CheckCircle2 size={11} />Lunas</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}
