import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck, ShieldAlert, Sparkles, MessageCircle, Loader2, RefreshCw, Zap, Users, Building2, Activity, ChevronDown, CheckCircle2, AlertTriangle, X, Orbit, LayoutGrid, Megaphone, LifeBuoy, Maximize2, Minimize2 } from "lucide-react";
import { RadialBarChart, RadialBar, PolarAngleAxis, AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import * as db from "../lib/db";

// Dashboard admin platform - versi "mission control" - CUMA keliatan buat
// email admin (dicek di App.jsx + server-side di admin-status/admin-trigger).
// Auto-refresh tiap 45 detik biar selalu nunjukin kondisi TERKINI tanpa perlu
// klik refresh manual - cocok buat "dipantengin" kayak dashboard ops beneran.
const REFRESH_INTERVAL_MS = 45000;

function timeAgo(iso) {
  if (!iso) return "belum pernah";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "barusan";
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  return `${Math.floor(hrs / 24)} hari lalu`;
}

function StatusOrb({ ok, size = 10 }) {
  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <span className={`absolute inline-flex h-full w-full rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"} opacity-60 animate-ping`} />
      <span className={`relative inline-flex rounded-full h-full w-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
    </span>
  );
}

// Gauge radial kecil - 100 = sehat total, turun sesuai jumlah temuan.
function Gauge({ value, color }) {
  const data = [{ value: Math.max(value, 3) }];
  return (
    <div className="relative w-16 h-16 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="72%" outerRadius="100%" data={data} startAngle={90} endAngle={-270}>
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
          <RadialBar dataKey="value" cornerRadius={20} fill={color} background={{ fill: "rgba(255,255,255,0.06)" }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold" style={{ color }}>{Math.round(value)}</div>
    </div>
  );
}

function TrendSparkline({ data, dataKey, color }) {
  if (!data || data.length < 2) {
    return <div className="h-10 flex items-center text-[10px] text-slate-600 font-mono">belum cukup data buat grafik tren</div>;
  }
  return (
    <div className="h-10 -mx-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#grad-${dataKey})`} isAnimationActive={false} />
          <Tooltip
            contentStyle={{ background: "#0b101a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 10 }}
            labelStyle={{ color: "#94a3b8" }}
            itemStyle={{ color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// 4 bracket sudut kayak reticle HUD sci-fi (Jarvis-style) - murni dekoratif,
// dikasih warna sesuai status card-nya biar kerasa "di-scan" bukan cuma kotak biasa.
function HudCorners({ color }) {
  const base = "absolute w-3 h-3 border-white/0";
  const style = { borderColor: color };
  return (
    <>
      <span className={`${base} top-2 left-2 border-t-2 border-l-2 rounded-tl-[6px]`} style={style} />
      <span className={`${base} top-2 right-2 border-t-2 border-r-2 rounded-tr-[6px]`} style={style} />
      <span className={`${base} bottom-2 left-2 border-b-2 border-l-2 rounded-bl-[6px]`} style={style} />
      <span className={`${base} bottom-2 right-2 border-b-2 border-r-2 rounded-br-[6px]`} style={style} />
    </>
  );
}

function EmployeeCard({ icon: Icon, title, subtitle, accentColor, glowClass, gaugeValue, trend, trendKey, children, onTrigger, triggering, triggerKey, noTrigger, noTriggerNote }) {
  return (
    <div className={`relative rounded-[22px] border border-white/[0.07] bg-white/[0.02] p-4 overflow-hidden ${glowClass}`}>
      <HudCorners color={`${accentColor}55`} />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Gauge value={gaugeValue} color={accentColor} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Icon size={13} style={{ color: accentColor }} />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-200 truncate">{title}</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 truncate">{subtitle}</div>
          </div>
        </div>
        {!noTrigger ? (
          <button
            onClick={() => onTrigger(triggerKey)}
            disabled={triggering === triggerKey}
            className="shrink-0 text-[10px] font-mono uppercase tracking-wide bg-white/[0.05] hover:bg-white/[0.09] disabled:opacity-50 border border-white/10 text-slate-300 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 transition-colors"
          >
            {triggering === triggerKey ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />} Panggil
          </button>
        ) : (
          <span className="shrink-0 text-[9px] font-mono text-slate-600 text-right max-w-[90px]">{noTriggerNote}</span>
        )}
      </div>
      <div className="mt-3">{children}</div>
      {trend && (
        <div className="mt-2 pt-2 border-t border-white/[0.05]">
          <TrendSparkline data={trend} dataKey={trendKey} color={accentColor} />
        </div>
      )}
    </div>
  );
}

// Rincian PER-SINYAL yang dicek ATOM (health-check) - dulu Command Center
// cuma nampilin status gabungan ("nihil temuan" / "N temuan"), gak keliatan
// SEMUA sinyal apa aja yang dipantau dan kondisi masing-masing satu-satu.
// SELALU KEBUKA by default (bukan collapsed lagi) - datanya udah otomatis
// paling baru sendiri kok, gak perlu nunggu diklik: ATOM jalan sendiri tiap
// 4 jam via cron, dan dashboard ini polling admin-status tiap 45 detik
// (lihat REFRESH_INTERVAL_MS) - jadi begitu ada run baru, panel ini ikut
// keupdate otomatis tanpa siapapun perlu pencet "Panggil". Toggle tetep ada
// buat yang mau nyembunyiin doang kalau kepanjangan.
// Popup detail 1 sinyal - munculin isi lengkap "detail" (temuan masalah, atau
// pesan aman) pas kartu-nya diklik, alih-alih ditumpuk mentah di bawah tiap
// kartu (yang bikin panelnya kepanjangan begitu ada beberapa temuan sekaligus).
// Buat sinyal yang BERMASALAH, popup-nya nunjukkin laporan AI yang udah
// ditulis manusiawi (security.summary - sama isi yang dikirim ke Telegram),
// bukan cuma teks mentah dari check function - jadi gak perlu tombol "Baca
// laporan lengkap" terpisah lagi, klik langsung ke sinyal yang bermasalah
// (misal "Sinkron Google Calendar") udah nampilin penjelasan lengkapnya.
function CheckDetailModal({ check, aiSummary, onClose }) {
  const bodyText = !check.ok && aiSummary ? aiSummary : check.detail;
  const [flagState, setFlagState] = useState("idle"); // idle | busy | done | error

  const doFlag = async () => {
    setFlagState("busy");
    try {
      await db.flagHealthIssue(check.key, check.label, bodyText);
      setFlagState("done");
    } catch (e) {
      alert("Gagal nandain: " + e.message);
      setFlagState("idle");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border p-5 ${
          check.ok ? "border-emerald-500/25 bg-[#070b12]" : "border-amber-500/35 bg-[#0d0a05] shadow-[0_0_60px_-15px_rgba(245,158,11,0.5)]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {check.ok ? (
              <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle size={20} className="text-amber-400 shrink-0" />
            )}
            <span className="font-mono text-base font-bold tracking-wide text-white truncate">{check.label}</span>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="text-slate-500 text-[12px] font-sans leading-relaxed mb-3">{check.desc}</div>
        <div
          className={`text-[13px] font-sans leading-relaxed whitespace-pre-wrap rounded-xl p-3 border ${
            check.ok ? "text-emerald-200 bg-emerald-500/[0.06] border-emerald-500/20" : "text-amber-100 bg-amber-500/10 border-amber-500/25"
          }`}
        >
          {bodyText}
        </div>
        {!check.ok && (
          <button
            onClick={doFlag}
            disabled={flagState === "busy" || flagState === "done"}
            className="mt-3 w-full flex items-center justify-center gap-2 text-[12px] font-mono font-bold uppercase tracking-wide rounded-xl px-3 py-2.5 border transition-colors disabled:cursor-default border-amber-500/40 bg-amber-500/[0.08] hover:bg-amber-500/[0.15] text-amber-300 disabled:opacity-60"
          >
            {flagState === "busy" ? (
              <><Loader2 size={13} className="animate-spin" /> Nandain…</>
            ) : flagState === "done" ? (
              <><CheckCircle2 size={13} /> Ditandai - notif Telegram udah dikirim</>
            ) : (
              <><Zap size={13} /> Tandai buat ditindaklanjuti</>
            )}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}

function ChecksDetailPanel({ checks, aiSummary }) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState(null);
  if (!checks || checks.length === 0) return null;
  const okCount = checks.filter((c) => c.ok).length;
  const allOk = okCount === checks.length;

  return (
    <div className="mt-4 pt-4 border-t border-white/[0.08]">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between group">
        <div className="flex items-center gap-2.5">
          <span className="relative inline-flex h-2 w-2">
            <span className={`absolute inline-flex h-full w-full rounded-full ${allOk ? "bg-emerald-400" : "bg-amber-400"} opacity-70 animate-ping`} />
            <span className={`relative inline-flex rounded-full h-full w-full ${allOk ? "bg-emerald-400" : "bg-amber-400"}`} />
          </span>
          <span className="font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-slate-200 group-hover:text-white transition-colors">
            {okCount}<span className="text-slate-600">/{checks.length}</span> Sinyal Termonitor
          </span>
        </div>
        <ChevronDown size={15} className={`text-slate-500 group-hover:text-white transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 grid gap-2">
          {checks.map((c) => (
            <button
              key={c.key}
              onClick={() => setSelected(c)}
              className={`relative rounded-xl border p-3 overflow-hidden transition-colors text-left w-full hover:brightness-125 ${
                c.ok
                  ? "border-emerald-500/[0.12] bg-emerald-500/[0.025]"
                  : "border-amber-500/30 bg-amber-500/[0.07] shadow-[0_0_28px_-10px_rgba(245,158,11,0.5)]"
              }`}
            >
              {!c.ok && <div className="absolute inset-y-0 left-0 w-[3px] bg-amber-400 shadow-[0_0_10px_2px_rgba(245,158,11,0.6)]" />}
              <div className="flex items-center gap-2.5 pl-1">
                {c.ok ? (
                  <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                )}
                <span className="font-mono text-[14px] font-bold tracking-wide text-white">{c.label}</span>
              </div>
              <div className="text-slate-500 text-[11.5px] mt-1 pl-[30px] font-sans leading-relaxed">{c.desc}</div>
            </button>
          ))}
        </div>
      )}
      {selected && <CheckDetailModal check={selected} aiSummary={aiSummary} onClose={() => setSelected(null)} />}
    </div>
  );
}

// Popup detail 1 karyawan AI - dulu detailnya nongol di panel bawah Peta
// Orbit terus-menerus, sekarang diubah jadi popup begitu node-nya diklik
// (9 Sep 2026) biar gak perlu scroll ke bawah tiap ganti-ganti karyawan yang
// mau dicek, dan Peta Orbit-nya sendiri tetep bersih gak numpuk konten.
function EmployeeDetailModal({ employee, onTrigger, triggering, onClose }) {
  if (!employee) return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`relative w-full ${employee.wide ? "max-w-6xl" : "max-w-lg"} max-h-[85vh] overflow-y-auto rounded-[22px] pt-9`}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-2 right-2 z-30 text-slate-400 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] rounded-lg p-1.5 transition-colors">
          <X size={16} />
        </button>
        <EmployeeCard
          icon={employee.icon}
          title={`${employee.title} · ${employee.subtitle}`}
          accentColor={employee.accentColor}
          glowClass={employee.glowClass}
          gaugeValue={employee.gaugeValue}
          trend={employee.trend}
          trendKey={employee.trendKey}
          onTrigger={onTrigger}
          triggering={triggering}
          triggerKey={employee.triggerKey}
          noTrigger={employee.noTrigger}
          noTriggerNote={employee.noTriggerNote}
        >
          {employee.content}
        </EmployeeCard>
      </div>
    </div>,
    document.body
  );
}

// Panel review draft konten NOVA - tiap draft nunjukkin gambar+caption, dan
// kalau statusnya masih "pending" ada tombol Approve & Post / Reject. Approve
// manggil content-action yang LANGSUNG coba publish ke Instagram (lihat
// komentar di content-action edge function) - satu-satunya jalan konten NOVA
// bisa tayang ke publik, gak ada yang otomatis dari cron content-drafter.
function ContentDraftsPanel({ drafts, onReviewed }) {
  const [busyId, setBusyId] = useState(null);
  if (!drafts || drafts.length === 0) {
    return <div className="mt-3 text-[11px] text-slate-500 font-mono">Belum ada draft konten - NOVA jalan tiap Senin, atau klik Panggil buat generate sekarang.</div>;
  }
  const doAction = async (id, action) => {
    setBusyId(id);
    try {
      const result = await db.reviewContentDraft(id, action);
      if (action === "approve" && result?.posted === false && result?.error) {
        alert("Draft udah di-approve tapi BELUM ke-post:\n\n" + result.error);
      }
      onReviewed();
    } catch (e) {
      alert("Gagal proses draft: " + e.message);
    } finally {
      setBusyId(null);
    }
  };
  const STATUS_STYLE = {
    pending: "bg-amber-500/15 text-amber-300",
    approved: "bg-sky-500/15 text-sky-300",
    posted: "bg-emerald-500/15 text-emerald-300",
    rejected: "bg-slate-500/15 text-slate-400",
    failed: "bg-rose-500/15 text-rose-300",
  };
  return (
    <div className="mt-3 grid gap-2">
      {drafts.map((d) => (
        <div key={d.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5 flex gap-2.5">
          {d.image_url && <img src={d.image_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-white/[0.08]" />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`px-1.5 py-0.5 rounded uppercase tracking-wide text-[9px] font-bold ${STATUS_STYLE[d.status] || STATUS_STYLE.rejected}`}>{d.status}</span>
              <span className="text-[10px] font-mono text-slate-600">{timeAgo(d.created_at)}</span>
            </div>
            <div className="text-[11px] text-slate-300 leading-relaxed">{d.caption.length > 140 ? `${d.caption.slice(0, 140)}…` : d.caption}</div>
            {d.status === "approved" && d.error && <div className="mt-1.5 text-[10px] text-amber-400 font-mono">{d.error}</div>}
            {d.status === "pending" && (
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => doAction(d.id, "approve")}
                  disabled={busyId === d.id}
                  className="text-[10px] font-mono uppercase font-bold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
                >
                  {busyId === d.id ? "…" : "Approve & Post"}
                </button>
                <button
                  onClick={() => doAction(d.id, "reject")}
                  disabled={busyId === d.id}
                  className="text-[10px] font-mono uppercase font-bold px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-50 transition-colors"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const TIER_LABEL = { standard: "Standard", professional: "Professional", enterprise: "Enterprise", internal: "Internal" };
const WINDOW_LABEL = { day: "hari", month: "bulan", week: "minggu", none: "" };
const SCOPE_LABEL = { user: "akun", org: "tim", platform: "platform" };
const USAGE_STATUS_STYLE = {
  ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  over: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  unlimited: "bg-slate-500/10 text-slate-500 border-white/[0.06]",
  "n/a": "bg-slate-500/[0.04] text-slate-600 border-white/[0.04]",
};

function limitText(f) {
  if (f.limit === null || f.limit === undefined) return "Tanpa batas";
  return `${f.limit}x / ${WINDOW_LABEL[f.window]} / ${SCOPE_LABEL[f.scope]}`;
}

// Legenda SEMUA fitur AI yang ada di app (metered maupun bukan) - biar admin
// tau persis batasan tiap fitur tanpa harus buka kode edge function satu-satu.
function AiFeatureCatalog({ features }) {
  return (
    <div className="grid gap-1.5">
      {features.map((f) => (
        <div key={f.key} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-white/[0.015] px-2.5 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] font-semibold text-slate-200">{f.label}</span>
              <span className="text-[8.5px] uppercase tracking-wide font-mono text-slate-500 border border-white/[0.08] rounded px-1 py-[1px]">{TIER_LABEL[f.tier]}</span>
            </div>
            {f.note && <div className="mt-0.5 text-[10px] text-slate-500 font-mono">{f.note}</div>}
          </div>
          <span className={`shrink-0 font-mono text-[10.5px] font-bold px-2 py-1 rounded-lg border ${f.metered ? "bg-sky-500/10 text-sky-300 border-sky-500/20" : "bg-slate-500/10 text-slate-500 border-white/[0.06]"}`}>
            {limitText(f)}
          </span>
        </div>
      ))}
    </div>
  );
}

// Rincian pemakaian per AKUN (bukan cuma agregat) - permintaan Nando: "bener2
// setiap akun di list", biar ketauan SEBELUM ada yang kepake lebih dari jatah
// (kebocoran), gak cuma pas udah kejadian.
function AiAccountsUsagePanel({ features, accounts }) {
  const meteredFeatures = features.filter((f) => f.metered);
  if (!accounts || accounts.length === 0) {
    return <div className="text-[11px] text-slate-500 font-mono">Belum ada akun tim (organization_members kosong).</div>;
  }
  // Kolom "Akun" dibuat STICKY (nempel di kiri pas di-scroll horizontal) -
  // sebelumnya kalau tabelnya lebih lebar dari panel (makin banyak fitur AI
  // makin lebar), nama akunnya ikut ketutup pas scroll ke kanan buat liat
  // kolom fitur yang jauh - jadi gak kebaca lagi akun siapa yang dilihat.
  const STICKY_BG = "#0c1018"; // approksimasi warna komposit card (bg-white/[0.02] di atas #05070c)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[640px]">
        <thead>
          <tr className="text-[9.5px] uppercase tracking-wide text-slate-500 font-mono">
            <th className="sticky left-0 z-10 pb-1.5 pr-2 pl-0 font-medium" style={{ background: STICKY_BG }}>Akun</th>
            <th className="pb-1.5 pr-2 font-medium">Plan</th>
            {meteredFeatures.map((f) => (
              <th key={f.key} className="pb-1.5 pr-2 font-medium whitespace-nowrap">{f.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.user_id} className="border-t border-white/[0.05]">
              <td className="sticky left-0 z-10 py-1.5 pr-2 pl-0" style={{ background: STICKY_BG }}>
                <div className="text-[11.5px] font-semibold text-slate-200 truncate max-w-[160px]">{a.display_name || a.email || a.user_id.slice(0, 8)}</div>
                <div className="text-[9.5px] text-slate-500 font-mono truncate max-w-[160px]">{a.org_name} · {a.role}</div>
              </td>
              <td className="py-1.5 pr-2">
                <span className="text-[9.5px] uppercase font-mono text-slate-400">{a.plan}</span>
              </td>
              {meteredFeatures.map((f) => {
                const u = a.usage?.[f.key];
                if (!u || !u.applicable) {
                  return <td key={f.key} className="py-1.5 pr-2"><span className="text-[10px] font-mono text-slate-600">-</span></td>;
                }
                return (
                  <td key={f.key} className="py-1.5 pr-2">
                    <span className={`font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${USAGE_STATUS_STYLE[u.status]}`}>
                      {u.used}{u.limit !== null ? `/${u.limit}` : ""}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Panel "Limit Fitur AI" - ditumpuk LANGSUNG di bawah panel sinyal security
// (ChecksDetailPanel) di dalam modal ATOM, SELALU kebuka pas ATOM diklik
// (bukan node satelit terpisah - versi itu ternyata numpuk visual sama ring
// ATOM di orbit view, jadi dibalik ke sini). 2 tabel keliatan sekaligus:
// katalog semua fitur AI + limitnya, dan rincian pemakaian per akun.
function AiLimitsPanel({ aiLimits, flaggedCount, severity }) {
  if (!aiLimits) return null;
  const { features, accounts, trend } = aiLimits;
  const hasTrend = trend && trend.length > 1;
  return (
    <div className="mt-4 pt-4 border-t border-white/[0.08] grid gap-3">
      <div className="flex items-center gap-2.5">
        <span className="relative inline-flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full ${severity === "ok" ? "bg-emerald-400" : severity === "critical" ? "bg-rose-400" : "bg-amber-400"} opacity-70 animate-ping`} />
          <span className={`relative inline-flex rounded-full h-full w-full ${severity === "ok" ? "bg-emerald-400" : severity === "critical" ? "bg-rose-400" : "bg-amber-400"}`} />
        </span>
        <span className="font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-slate-200">Limit Fitur AI</span>
      </div>
      <div className="text-[11px] text-slate-400 font-mono">
        {flaggedCount === 0 ? (
          <span className="text-emerald-400">semua akun aman, gak ada yang mendekati limit</span>
        ) : (
          <span className={severity === "critical" ? "text-rose-400" : "text-amber-400"}>
            {flaggedCount} sinyal butuh perhatian{severity === "critical" ? " (ada yang udah kebocoran)" : " (mendekati limit)"}
          </span>
        )}
      </div>
      {/* Trend 7 hari terakhir - dicatet tiap run ATOM (cron 4 jam-an) lewat
          health_check_runs.ai_flagged_count, biar keliatan POLANYA (naik
          pelan-pelan sebelum kebocoran), bukan cuma snapshot hari ini doang. */}
      {hasTrend ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-2.5">
          <div className="text-[9.5px] uppercase tracking-wide text-slate-500 font-mono mb-1">Tren sinyal butuh perhatian - 7 hari</div>
          <TrendSparkline data={trend} dataKey="count" color={severity === "critical" ? "#f43f5e" : severity === "warning" ? "#f59e0b" : "#34d399"} />
        </div>
      ) : (
        <div className="text-[10px] text-slate-600 font-mono">tren mulai kekumpul abis beberapa kali ATOM jalan (tiap ~4 jam) - belum cukup data buat grafik</div>
      )}
      <AiFeatureCatalog features={features} />
      <AiAccountsUsagePanel features={features} accounts={accounts} />
    </div>
  );
}

// Peta orbit "second brain" - hub AI di tengah dengan tiap karyawan AI
// mengorbit di sekelilingnya. Sudut per node dihitung OTOMATIS dari jumlah
// karyawan (360 / total), BUKAN hardcode per nama (9 Sep 2026 - sebelumnya
// tiap kali nambah karyawan baru harus itung ulang derajat manual satu-satu,
// gak scalable buat rencana nambah lebih banyak lagi ke depan). Karyawan
// mana pun boleh punya `subSignals` (array {key,label,ok,desc,detail}) buat
// ditampilin sebagai cincin titik-titik kecil di sekeliling node-nya sendiri
// (dulu cuma ATOM yang di-hardcode dapet perlakuan ini) - biar keliatan dia
// "punya tim sendiri" di dalam, kayak cluster departemen di video referensi.
// Posisi dihitung pake trigonometri dalam persen 0-100 biar responsif tanpa
// ukur pixel manual - lihat polarPoint().
const ORBIT_START_ANGLE = 216; // biar node pertama (biasanya ATOM) di posisi yang sama kayak sebelumnya
// Radius dikecilin dari versi awal (37/13/47) - versi lama ketauan pas dites
// beneran: node paling bawah (misal NOVA) fisiknya (ikon + label teks di
// bawahnya) bisa nembus keluar kotak orbit sendiri dan numpuk sama footer
// di bawahnya, soalnya translate(-50%,-50%) itu nge-tengahin SELURUH tumpukan
// ikon+label di titik matematis, bukan cuma ikonnya - jadi separuh tinggi
// label ikut "makan" jatah margin ke tepi kotak. Radius yang lebih kecil
// nyisain margin lebih di semua sisi (atas/bawah/kiri/kanan) buat nampung itu.
const ORBIT_MAIN_RADIUS = 32;
const ORBIT_SUB_RADIUS = 10;
const ORBIT_BOUNDARY_RADIUS = 40;

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function OrbitCommandMap({ employees, selectedKey, onSelectEmployee, onSelectSignal, overallOk, overallGauge }) {
  const cx = 50, cy = 50;
  const angleStep = 360 / Math.max(employees.length, 1);
  const nodes = employees.map((e, i) => ({ ...e, pos: polarPoint(cx, cy, ORBIT_MAIN_RADIUS, ORBIT_START_ANGLE + angleStep * i) }));
  const nodesWithSubRing = nodes.filter((n) => n.subSignals && n.subSignals.length > 0);
  // Node yang GAK punya subSignals asli (cuma ATOM yang punya) - tetep dikasih
  // cincin muter, tapi bentuknya SENGAJA beda (1 lengkungan energi nyapu
  // berputar, bukan titik-titik) biar gak keliatan kayak ngaku-ngaku punya
  // sub-sinyal beneran padahal cuma dekorasi.
  const nodesWithoutSubRing = nodes.filter((n) => !n.subSignals || n.subSignals.length === 0);
  // Klik node muncul efek "ripple" (cincin ngembang lalu ilang) sesaat -
  // feedback visual instan tanpa nunggu panel detail di bawah ke-render.
  const [rippleId, setRippleId] = useState(null);
  const selectNode = (key) => {
    onSelectEmployee(key);
    setRippleId(`${key}-${Date.now()}`);
  };

  // Ukuran kotak orbit diukur LANGSUNG dari sisa ruang yang beneran ada di
  // parent-nya (ResizeObserver), bukan ditebak pake vh/aspect-ratio CSS -
  // percobaan sebelumnya pake satuan vh gak nyambung ke tinggi ASLI yang
  // udah kepake header+ringkasan di atas, jadi orbitnya sering lebih gede
  // dari sisa ruang dan numpuk ke elemen lain. Diukur beneran = gak akan
  // pernah salah ukuran lagi, di layar berapa pun.
  const wrapRef = useRef(null);
  const [boxSize, setBoxSize] = useState(560);
  useEffect(() => {
    const parent = wrapRef.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      // Cap dinaikin ke 680 (dari 520) - sekarang toolbar+judul+strip ringkasan
      // di atasnya udah jauh lebih ringkas, jadi ada sisa ruang lebih buat
      // orbit gede tanpa nyodok elemen lain (tetep diukur beneran, gak ditebak).
      const size = Math.max(300, Math.min(680, parent.clientWidth, parent.clientHeight));
      setBoxSize(size);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} className="relative select-none shrink-0" style={{ width: boxSize, height: boxSize }}>
      <style>{`
        @keyframes orbit-ring-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes orbit-ring-spin-slow { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes orbit-dash-flow { to { stroke-dashoffset: -12; } }
        @keyframes orbit-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes orbit-ripple { from { transform: scale(0.6); opacity: .5; } to { transform: scale(2.1); opacity: 0; } }
        @keyframes orbit-pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
        @media (prefers-reduced-motion: reduce) { .orbit-motion, .orbit-motion * { animation: none !important; } }
      `}</style>

      {/* Inti orbit - satu pendar lembut doang, gak ada border/ring lagi (yang
          sebelumnya kelihatan kayak lingkaran kosong gak jelas gunanya). Cuma
          nuansa cahaya di tengah biar node-node kerasa mengelilingi sesuatu. */}
      <div
        className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl pointer-events-none"
        style={{ width: 140, height: 140, background: overallOk ? "rgba(52,211,153,0.09)" : "rgba(245,158,11,0.09)" }}
      />

      <svg viewBox="0 0 100 100" className="orbit-motion absolute inset-0 h-full w-full overflow-visible">
        <g style={{ transformOrigin: "50px 50px", animation: "orbit-ring-spin-slow 140s linear infinite" }}>
          <circle cx={cx} cy={cy} r={ORBIT_BOUNDARY_RADIUS} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="0.25" strokeDasharray="1 2.4" />
        </g>

        {/* Mesh jaringan - tiap node nyambung ke tetangganya, garis TENANG di
            keadaan diam (satu warna netral, gak animasi) - baru nyala warna
            + jalan pas salah satu ujungnya lagi dipilih. Ini yang "narasi"-nya:
            energi cuma ngalir ke node yang lagi diliat, bukan semua sekaligus. */}
        {nodes.map((n, i) => {
          const next = nodes[(i + 1) % nodes.length];
          if (nodes.length < 2) return null;
          const isActive = selectedKey === n.key || selectedKey === next.key;
          return (
            <g key={`mesh-${n.key}`}>
              <line x1={n.pos.x} y1={n.pos.y} x2={next.pos.x} y2={next.pos.y} stroke="rgba(148,163,184,0.16)" strokeWidth="0.3" />
              {isActive && (
                <line
                  x1={n.pos.x} y1={n.pos.y} x2={next.pos.x} y2={next.pos.y}
                  stroke={n.accentColor} strokeWidth="0.5" strokeDasharray="0.4 3.2" strokeLinecap="round"
                  style={{ animation: "orbit-dash-flow 1.2s linear infinite" }}
                />
              )}
            </g>
          );
        })}

        {/* Cincin sub-sinyal ATOM - titik TENANG kalau aman (steady, gak
            animasi - dashboard yang baik gak nyala-nyala kalau gak ada apa2),
            baru berkedip pelan kalau ada temuan yang perlu diliat. */}
        {nodesWithSubRing.map((n) => (
          <g key={`sub-${n.key}`}>
            <circle cx={n.pos.x} cy={n.pos.y} r={ORBIT_SUB_RADIUS} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="0.25" />
            {n.subSignals.map((sig, i) => {
              const pos = polarPoint(n.pos.x, n.pos.y, ORBIT_SUB_RADIUS, (360 / Math.max(n.subSignals.length, 1)) * i);
              return (
                <circle
                  key={sig.key || i}
                  cx={pos.x} cy={pos.y} r={0.85}
                  fill={sig.ok ? "#34d399" : "#f59e0b"}
                  style={{ cursor: "pointer", animation: sig.ok ? "none" : "orbit-pulse-dot 1.8s ease-in-out infinite" }}
                  className="transition-opacity hover:opacity-70"
                  onClick={() => onSelectSignal(sig)}
                >
                  <title>{sig.label}</title>
                </circle>
              );
            })}
          </g>
        ))}

        {/* Node lain - satu tanda kecil yang pelan-pelan ngorbit di tepi
            ring-nya sendiri (bukan lengkungan nyala gede) - cukup buat kesan
            "hidup", gak berebut perhatian sama node-nya sendiri. */}
        {nodesWithoutSubRing.map((n, idx) => (
          <g key={`deco-${n.key}`}>
            <circle cx={n.pos.x} cy={n.pos.y} r={ORBIT_SUB_RADIUS} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="0.25" />
            <g style={{ transformOrigin: `${n.pos.x}px ${n.pos.y}px`, animation: `orbit-ring-spin ${26 + idx * 4}s linear infinite` }}>
              <circle cx={n.pos.x} cy={n.pos.y - ORBIT_SUB_RADIUS} r={0.7} fill={n.accentColor} opacity="0.8" />
            </g>
          </g>
        ))}
      </svg>

      {/* Node karyawan utama */}
      {nodes.map((n, i) => {
        const Icon = n.icon;
        const isSelected = selectedKey === n.key;
        const showRipple = rippleId?.startsWith(`${n.key}-`);
        return (
          <button
            key={n.key}
            onClick={() => selectNode(n.key)}
            className="group absolute z-20 flex flex-col items-center gap-1.5"
            style={{ left: `${n.pos.x}%`, top: `${n.pos.y}%`, transform: "translate(-50%,-50%)" }}
          >
            <span
              className="orbit-motion relative flex items-center justify-center rounded-full border transition-all duration-300 group-hover:scale-105"
              style={{
                width: "clamp(46px, 8vw, 68px)",
                height: "clamp(46px, 8vw, 68px)",
                borderColor: isSelected ? n.accentColor : "rgba(148,163,184,0.3)",
                background: isSelected
                  ? `radial-gradient(circle at 30% 25%, ${n.accentColor}30, rgba(8,11,17,0.96) 72%)`
                  : "rgba(255,255,255,0.02)",
                boxShadow: isSelected ? `0 0 24px -6px ${n.accentColor}` : "none",
                animation: `orbit-float ${4.2 + i * 0.4}s ease-in-out infinite`,
                animationDelay: `${i * 0.35}s`,
              }}
            >
              {showRipple && (
                <span
                  key={rippleId}
                  onAnimationEnd={() => setRippleId(null)}
                  className="pointer-events-none absolute inset-0 rounded-full border-2"
                  style={{ borderColor: n.accentColor, animation: "orbit-ripple .6s ease-out" }}
                />
              )}
              <Icon size={18} style={{ color: isSelected ? n.accentColor : `${n.accentColor}cc` }} />
              <span
                className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[#05070c]"
                style={{ background: n.ok ? "#34d399" : "#f59e0b", animation: n.ok ? "none" : "orbit-pulse-dot 1.8s ease-in-out infinite" }}
              />
            </span>
            <span className={`font-mono text-[10px] font-bold uppercase tracking-wider transition-colors ${isSelected ? "text-white" : "text-slate-500 group-hover:text-slate-300"}`}>
              {n.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function AdminDashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triggering, setTriggering] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [, forceTick] = useState(0);
  const [viewMode, setViewMode] = useState("orbit"); // "orbit" | "grid"
  const [selectedEmployeeKey, setSelectedEmployeeKey] = useState("atom");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  const intervalRef = useRef(null);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await db.getAdminStatus();
      setStatus(data);
      setLastSync(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    intervalRef.current = setInterval(() => load(true), REFRESH_INTERVAL_MS);
    // Ticker halus tiap 15 detik - biar teks "X menit lalu" & jam ikut jalan
    // real-time walau belum waktunya auto-refresh data.
    const tick = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => { clearInterval(intervalRef.current); clearInterval(tick); };
  }, [load]);

  const trigger = async (target) => {
    setTriggering(target);
    try {
      await db.callAdminTrigger(target);
      await load(true);
    } catch (e) {
      alert("Gagal manggil: " + e.message);
    } finally {
      setTriggering(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[28px] bg-[#05070c] border border-white/[0.06] flex items-center gap-2 text-sm text-slate-500 py-16 justify-center font-mono">
        <Loader2 size={16} className="animate-spin" /> menghubungkan ke command center…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] bg-[#05070c] border border-rose-500/20 max-w-lg mx-auto mt-10 text-center py-10 px-6">
        <ShieldAlert size={28} className="mx-auto text-rose-400 mb-2" />
        <p className="text-sm text-slate-400 font-mono">{error}</p>
      </div>
    );
  }

  const security = status?.security;
  const securityHealthy = security?.status === "sehat";
  const allSystemsGo = securityHealthy || !security;
  const securityGauge = !security ? 60 : securityHealthy ? 100 : Math.max(10, 100 - (security.issue_count || 1) * 20);
  const securityTrend = (status?.security_trend || []).map((d) => ({ ...d, day: d.day.slice(5) }));
  const digestTrend = (status?.sales_advisor?.trend || []).map((d) => ({ ...d, day: d.day.slice(5) }));
  const atomChecks = security?.checks_detail || [];
  const memoPending = status?.vector_memory?.pending_embeddings ?? 0;

  // "Limit Fitur AI" - dihitung DULUAN di sini (bukan di bawah employees)
  // karena ATOM's content di array employees butuh aiFlaggedCount/aiSeverity
  // pas array-nya dibangun. Ringkasan: berapa banyak akun+fitur yang lagi
  // mendekati/lewat limit bulanan/harian - dipake buat kasih warna/teks
  // ringkasan sebelum tabel lengkapnya ditampilin (lihat AiLimitsPanel).
  const aiLimits = status?.ai_limits;
  const aiMeteredFeatures = (aiLimits?.features || []).filter((f) => f.metered);
  let aiFlaggedCount = 0;
  let aiSeverity = "ok";
  for (const acc of aiLimits?.accounts || []) {
    for (const f of aiMeteredFeatures) {
      const u = acc.usage?.[f.key];
      if (u && u.applicable && (u.status === "warning" || u.status === "over")) {
        aiFlaggedCount++;
        if (u.status === "over") aiSeverity = "critical";
        else if (aiSeverity !== "critical") aiSeverity = "warning";
      }
    }
  }

  // Satu sumber data buat "karyawan AI" - dipake bareng sama tampilan Grid
  // (klasik, gampang discan semua sekaligus) dan Peta Orbit (baru, buat
  // liat command center sebagai satu jaringan hidup) biar gak duplikat
  // logic (28 Agt 2026: RAKA/ADI/NEXA/MEMO - RAKA diganti ATOM 9 Sep 2026).
  const employees = [
    {
      key: "atom",
      title: "ATOM",
      subtitle: "Security & Ops",
      icon: securityHealthy || !security ? ShieldCheck : ShieldAlert,
      accentColor: allSystemsGo ? "#34d399" : "#f59e0b",
      glowClass: allSystemsGo ? "shadow-[0_0_40px_-25px_rgba(52,211,153,0.6)]" : "shadow-[0_0_40px_-25px_rgba(245,158,11,0.6)]",
      ok: allSystemsGo,
      gaugeValue: securityGauge,
      trend: securityTrend.length > 1 ? securityTrend : null,
      trendKey: "issues",
      triggerKey: "health-check",
      subSignals: atomChecks,
      wide: true,
      content: (
        <>
          <div className="text-[11px] text-slate-400 font-mono">
            {security ? (
              <>
                terakhir dicek <span className="text-slate-200">{timeAgo(security.checked_at)}</span> ·{" "}
                {securityHealthy ? <span className="text-emerald-400">nihil temuan</span> : <span className="text-amber-400">{security.issue_count} temuan</span>}
              </>
            ) : "belum pernah dicek - klik Panggil buat tes pertama"}
          </div>
          {/* 2 tabel bersebelahan (side-by-side) di layar lebar, numpuk balik ke
              1 kolom otomatis di HP - Sinyal Termonitor di kiri, Limit Fitur
              AI di kanan, dipisah garis vertikal tipis. */}
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <ChecksDetailPanel checks={security?.checks_detail} aiSummary={security?.summary} />
            <div className="lg:border-l lg:border-white/[0.08] lg:pl-4">
              <AiLimitsPanel aiLimits={status?.ai_limits} flaggedCount={aiFlaggedCount} severity={aiSeverity} />
            </div>
          </div>
        </>
      ),
    },
    {
      key: "adi",
      title: "ADI",
      subtitle: "Sales Advisor",
      icon: Sparkles,
      accentColor: "#f97316",
      glowClass: "shadow-[0_0_40px_-25px_rgba(249,115,22,0.6)]",
      ok: true,
      gaugeValue: Math.min(100, (status?.sales_advisor?.runs_today ?? 0) * 20),
      trend: digestTrend.length > 1 ? digestTrend : null,
      trendKey: "count",
      triggerKey: "daily-digest",
      content: (
        <div className="text-[11px] text-slate-400 font-mono">
          <span className="text-slate-200 font-bold">{status?.sales_advisor?.runs_today ?? 0}</span> user dapet digest hari ini
        </div>
      ),
    },
    {
      key: "nexa",
      title: "NEXA",
      subtitle: "Asisten Chat",
      icon: MessageCircle,
      accentColor: "#38bdf8",
      glowClass: "shadow-[0_0_40px_-25px_rgba(56,189,248,0.6)]",
      ok: true,
      gaugeValue: status?.assistant?.last_activity ? 100 : 40,
      noTrigger: true,
      noTriggerNote: "jalan pas ada chat",
      content: (
        <div className="text-[11px] text-slate-400 font-mono">
          aktivitas terakhir <span className="text-slate-200">{timeAgo(status?.assistant?.last_activity)}</span> · <span className="text-slate-200 font-bold">{status?.assistant?.messages_today ?? 0}</span> pesan hari ini
        </div>
      ),
    },
    {
      key: "memo",
      title: "MEMO",
      subtitle: "Vector Memory",
      icon: Sparkles,
      accentColor: memoPending > 0 ? "#f59e0b" : "#a78bfa",
      glowClass: memoPending > 0 ? "shadow-[0_0_40px_-25px_rgba(245,158,11,0.6)]" : "shadow-[0_0_40px_-25px_rgba(167,139,250,0.6)]",
      ok: memoPending === 0,
      gaugeValue: memoPending > 0 ? 55 : 100,
      noTrigger: true,
      noTriggerNote: "otomatis via trigger",
      content: (
        <div className="text-[11px] text-slate-400 font-mono">
          <span className="text-slate-200 font-bold">{memoPending}</span> catatan 24 jam terakhir belum ke-embed
        </div>
      ),
    },
    {
      key: "nova",
      title: "NOVA",
      subtitle: "Marketing & Content",
      icon: Megaphone,
      accentColor: "#ec4899",
      glowClass: "shadow-[0_0_40px_-25px_rgba(236,72,153,0.6)]",
      ok: (status?.content_studio?.pending_count ?? 0) === 0,
      gaugeValue: (status?.content_studio?.pending_count ?? 0) === 0 ? 100 : Math.max(30, 100 - (status.content_studio.pending_count) * 20),
      triggerKey: "content-drafter",
      content: (
        <>
          <div className="text-[11px] text-slate-400 font-mono">
            {(status?.content_studio?.pending_count ?? 0) > 0 ? (
              <span className="text-amber-400">{status.content_studio.pending_count} draft nunggu direview</span>
            ) : (
              <span className="text-emerald-400">gak ada draft yang nunggu</span>
            )}
          </div>
          <ContentDraftsPanel drafts={status?.content_studio?.recent_drafts} onReviewed={() => load(true)} />
        </>
      ),
    },
    {
      key: "sasa",
      title: "SASA",
      subtitle: "Customer Support",
      icon: LifeBuoy,
      accentColor: "#2dd4bf",
      glowClass: "shadow-[0_0_40px_-25px_rgba(45,212,191,0.6)]",
      ok: (status?.support?.escalated_today ?? 0) === 0,
      gaugeValue: (status?.support?.escalated_today ?? 0) === 0 ? 100 : Math.max(40, 100 - (status.support.escalated_today) * 15),
      noTrigger: true,
      noTriggerNote: "jalan pas ada visitor",
      content: (
        <div className="text-[11px] text-slate-400 font-mono">
          <span className="text-slate-200 font-bold">{status?.support?.messages_today ?? 0}</span> pertanyaan hari ini ·{" "}
          {(status?.support?.escalated_today ?? 0) > 0 ? (
            <span className="text-amber-400">{status.support.escalated_today} dieskalasi ke kamu</span>
          ) : (
            <span className="text-emerald-400">nihil eskalasi</span>
          )}
        </div>
      ),
    },
  ];
  const selectedEmployee = employees.find((e) => e.key === selectedEmployeeKey) || employees[0];

  return (
    <div className="relative flex h-full min-h-0 flex-col rounded-[28px] bg-[#05070c] border border-white/[0.06] p-4 md:p-5 overflow-hidden">
      {/* Grid background + glow, konsisten sama estetika landing page */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "linear-gradient(rgba(148,163,184,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.08) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(circle at 30% 0%, rgba(0,0,0,.9), transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 30% 0%, rgba(0,0,0,.9), transparent 70%)",
        }}
      />
      <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-orange-500/10 blur-[90px]" />

      <div className="relative flex h-full min-h-0 flex-col overflow-y-auto">
        {/* TOOLBAR - baris tipis doang, kontrol di kanan, biar jatah tinggi
            paling banyak jatuh ke judul besar + orbit di bawahnya. */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3 shrink-0">
          <div className="flex items-center gap-2 font-mono text-[10.5px] text-slate-500">
            <StatusOrb ok={allSystemsGo} size={8} />
            {allSystemsGo ? "SEMUA SISTEM NORMAL" : "ADA YANG PERLU DICEK"} · sync {lastSync ? timeAgo(lastSync.toISOString()) : "…"}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-0.5">
              <button
                onClick={() => setViewMode("orbit")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wide transition-colors ${viewMode === "orbit" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                <Orbit size={12} /> Orbit
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wide transition-colors ${viewMode === "grid" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                <LayoutGrid size={12} /> Grid
              </button>
            </div>
            <button onClick={() => load(false)} className="text-[10px] font-mono uppercase tracking-wide border border-white/10 bg-white/[0.03] text-slate-400 rounded-xl px-3 py-2 hover:bg-white/[0.07] hover:text-white flex items-center gap-1.5 transition-colors">
              <RefreshCw size={11} /> Sync Manual
            </button>
            {/* Toggle fullscreen manual - jaring pengaman kalau permintaan
                fullscreen otomatis pas klik menu (lihat App.jsx) ke-block
                browser (misal tab ini dibuka dari refresh/link langsung,
                gak lewat klik menu sama sekali). */}
            <button
              onClick={() => {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                else document.documentElement.requestFullscreen?.().catch(() => {});
              }}
              className="text-[10px] font-mono uppercase tracking-wide border border-white/10 bg-white/[0.03] text-slate-400 rounded-xl px-3 py-2 hover:bg-white/[0.07] hover:text-white flex items-center gap-1.5 transition-colors"
            >
              {isFullscreen ? <Minimize2 size={11} /> : <Maximize2 size={11} />} {isFullscreen ? "Keluar Fullscreen" : "Fullscreen"}
            </button>
          </div>
        </div>

        {/* JUDUL BESAR - ala terminal/Claude Code (font-mono, tracked-out),
            jadi fokus utama di atas, ganti dari layout lama (gauge kecil +
            judul kecil rata kiri) yang keliatan sisa tempat kosong gede di
            atas orbit. */}
        <div className="mb-3 shrink-0 text-center">
          <h1 className="font-mono text-[28px] sm:text-[34px] md:text-[40px] font-bold uppercase tracking-[0.08em] text-white leading-none">
            <span className="text-orange-400">&gt;_</span> Command Center
          </h1>
        </div>

        {/* RINGKASAN PLATFORM - strip tipis, bukan kartu-kartu gede lagi,
            biar sisa tinggi paling banyak jatuh ke orbit di bawahnya. */}
        <div className="mx-auto mb-4 flex shrink-0 flex-wrap items-center justify-center divide-x divide-white/10 rounded-full border border-white/[0.06] bg-white/[0.02] px-2 py-2">
          {[
            { label: "Total Leads", value: status?.platform?.total_leads ?? 0, icon: Users, color: "#f97316" },
            { label: "Organisasi", value: status?.platform?.total_orgs ?? 0, icon: Building2, color: "#a78bfa" },
            { label: "Pesan Bot", value: status?.assistant?.messages_today ?? 0, icon: MessageCircle, color: "#38bdf8" },
            { label: "Digest", value: status?.sales_advisor?.runs_today ?? 0, icon: Activity, color: "#34d399" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 px-4 font-mono text-[11px]">
              <s.icon size={12} style={{ color: s.color }} />
              <span className="font-bold text-white">{s.value}</span>
              <span className="text-slate-500 uppercase tracking-wide">{s.label}</span>
            </div>
          ))}
        </div>

        {/* KARYAWAN AI - dikasih nama biar berasa beneran tim, bukan cuma nama
            function teknis (28 Agt 2026: RAKA/ADI/NEXA/MEMO - RAKA diganti
            ATOM 9 Sep 2026). Dua cara liat: Peta Orbit (default, command
            center sebagai satu jaringan hidup - ATOM dikasih cincin
            sub-sinyalnya sendiri karena dia yang paling "rame" isinya) atau
            Grid klasik (semua kartu kebuka sekaligus, lebih gampang discan
            cepat kalau lagi buru-buru) - 9 Sep 2026. */}
        {viewMode === "orbit" ? (
          <div className="flex min-h-[380px] flex-1 flex-col items-center justify-center py-2">
            <OrbitCommandMap
              employees={employees}
              selectedKey={selectedEmployeeKey}
              onSelectEmployee={(key) => { setSelectedEmployeeKey(key); setDetailOpen(true); }}
              onSelectSignal={setSelectedCheck}
              overallOk={allSystemsGo}
              overallGauge={securityGauge}
            />
            <div className="mt-1 shrink-0 text-center text-[9.5px] font-mono text-slate-600">klik salah satu node buat liat detail lengkapnya</div>
            {detailOpen && selectedEmployee && (
              <EmployeeDetailModal
                employee={selectedEmployee}
                onTrigger={trigger}
                triggering={triggering}
                onClose={() => setDetailOpen(false)}
              />
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {employees.map((e) => (
              <EmployeeCard
                key={e.key}
                icon={e.icon}
                title={`${e.title} · ${e.subtitle}`}
                accentColor={e.accentColor}
                glowClass={e.glowClass}
                gaugeValue={e.gaugeValue}
                trend={e.trend}
                trendKey={e.trendKey}
                onTrigger={trigger}
                triggering={triggering}
                triggerKey={e.triggerKey}
                noTrigger={e.noTrigger}
                noTriggerNote={e.noTriggerNote}
              >
                {e.content}
              </EmployeeCard>
            ))}
          </div>
        )}

        {selectedCheck && (
          <CheckDetailModal check={selectedCheck} aiSummary={security?.summary} onClose={() => setSelectedCheck(null)} />
        )}

        <div className="mt-3 shrink-0 text-center text-[9px] font-mono text-slate-700 uppercase tracking-widest">
          auto-sync tiap {REFRESH_INTERVAL_MS / 1000}s · platform-wide, bukan cuma org Anda
        </div>
      </div>
    </div>
  );
}
