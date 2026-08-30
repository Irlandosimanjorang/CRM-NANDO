import { useState, useEffect, useRef, useCallback } from "react";
import { ShieldCheck, ShieldAlert, Sparkles, MessageCircle, Loader2, RefreshCw, Zap, Users, Building2, Activity } from "lucide-react";
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

function EmployeeCard({ icon: Icon, title, subtitle, accentColor, glowClass, gaugeValue, trend, trendKey, children, onTrigger, triggering, triggerKey, noTrigger, noTriggerNote }) {
  return (
    <div className={`relative rounded-[22px] border border-white/[0.07] bg-white/[0.02] p-4 overflow-hidden ${glowClass}`}>
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

export default function AdminDashboard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [triggering, setTriggering] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [, forceTick] = useState(0);
  const intervalRef = useRef(null);

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

  return (
    <div className="relative rounded-[28px] bg-[#05070c] border border-white/[0.06] p-5 md:p-6 overflow-hidden">
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

      <div className="relative">
        {/* HEADER */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2">
              <StatusOrb ok={allSystemsGo} size={9} />
              <h1 className="font-mono text-lg font-bold tracking-tight text-white">AI OPS COMMAND CENTER</h1>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              {allSystemsGo ? "SEMUA SISTEM NORMAL" : "ADA YANG PERLU DICEK"} · sync terakhir {lastSync ? timeAgo(lastSync.toISOString()) : "…"}
            </p>
          </div>
          <button onClick={() => load(false)} className="text-[10px] font-mono uppercase tracking-wide border border-white/10 bg-white/[0.03] text-slate-400 rounded-xl px-3 py-2 hover:bg-white/[0.07] hover:text-white flex items-center gap-1.5 transition-colors">
            <RefreshCw size={11} /> Sync Manual
          </button>
        </div>

        {/* RINGKASAN PLATFORM */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-5">
          {[
            { label: "Total Leads", value: status?.platform?.total_leads ?? 0, icon: Users, color: "#f97316" },
            { label: "Organisasi", value: status?.platform?.total_orgs ?? 0, icon: Building2, color: "#a78bfa" },
            { label: "Pesan Bot Hari Ini", value: status?.assistant?.messages_today ?? 0, icon: MessageCircle, color: "#38bdf8" },
            { label: "Digest Hari Ini", value: status?.sales_advisor?.runs_today ?? 0, icon: Activity, color: "#34d399" },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <s.icon size={13} style={{ color: s.color }} className="mb-1.5" />
              <div className="font-mono text-lg font-bold text-white leading-none">{s.value}</div>
              <div className="text-[9px] text-slate-500 mt-1 uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>

        {/* KARTU KARYAWAN AI - dikasih nama biar berasa beneran tim, bukan cuma
            nama function teknis (28 Agt 2026: RAKA/ADI/NEXA/MEMO) */}
        <div className="grid md:grid-cols-2 gap-3">
          <EmployeeCard
            icon={securityHealthy || !security ? ShieldCheck : ShieldAlert}
            title="RAKA · Security & Ops"
            subtitle="health-check · pantau kesehatan sistem"
            accentColor={allSystemsGo ? "#34d399" : "#f59e0b"}
            glowClass={allSystemsGo ? "shadow-[0_0_40px_-25px_rgba(52,211,153,0.6)]" : "shadow-[0_0_40px_-25px_rgba(245,158,11,0.6)]"}
            gaugeValue={securityGauge}
            trend={securityTrend.length > 1 ? securityTrend : null}
            trendKey="issues"
            onTrigger={trigger}
            triggering={triggering}
            triggerKey="health-check"
          >
            <div className="text-[11px] text-slate-400 font-mono">
              {security ? (
                <>
                  terakhir dicek <span className="text-slate-200">{timeAgo(security.checked_at)}</span> ·{" "}
                  {securityHealthy ? <span className="text-emerald-400">nihil temuan</span> : <span className="text-amber-400">{security.issue_count} temuan</span>}
                  {!securityHealthy && security.summary && <div className="mt-1.5 text-slate-400 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg p-2 whitespace-pre-wrap font-sans">{security.summary}</div>}
                </>
              ) : "belum pernah dicek - klik Panggil buat tes pertama"}
            </div>
          </EmployeeCard>

          <EmployeeCard
            icon={Sparkles}
            title="ADI · Sales Advisor"
            subtitle="daily-digest · analisis lead & rekomendasi"
            accentColor="#f97316"
            glowClass="shadow-[0_0_40px_-25px_rgba(249,115,22,0.6)]"
            gaugeValue={Math.min(100, (status?.sales_advisor?.runs_today ?? 0) * 20)}
            trend={digestTrend.length > 1 ? digestTrend : null}
            trendKey="count"
            onTrigger={trigger}
            triggering={triggering}
            triggerKey="daily-digest"
          >
            <div className="text-[11px] text-slate-400 font-mono">
              <span className="text-slate-200 font-bold">{status?.sales_advisor?.runs_today ?? 0}</span> user dapet digest hari ini
            </div>
          </EmployeeCard>

          <EmployeeCard
            icon={MessageCircle}
            title="NEXA · Asisten Chat"
            subtitle="telegram-webhook · eksekusi perintah"
            accentColor="#38bdf8"
            glowClass="shadow-[0_0_40px_-25px_rgba(56,189,248,0.6)]"
            gaugeValue={status?.assistant?.last_activity ? 100 : 40}
            noTrigger
            noTriggerNote="jalan pas ada chat"
          >
            <div className="text-[11px] text-slate-400 font-mono">
              aktivitas terakhir <span className="text-slate-200">{timeAgo(status?.assistant?.last_activity)}</span> · <span className="text-slate-200 font-bold">{status?.assistant?.messages_today ?? 0}</span> pesan hari ini
            </div>
          </EmployeeCard>

          <EmployeeCard
            icon={Sparkles}
            title="MEMO · Vector Memory"
            subtitle="embed-progress-note · memori semantik"
            accentColor={(status?.vector_memory?.pending_embeddings ?? 0) > 0 ? "#f59e0b" : "#a78bfa"}
            glowClass={(status?.vector_memory?.pending_embeddings ?? 0) > 0 ? "shadow-[0_0_40px_-25px_rgba(245,158,11,0.6)]" : "shadow-[0_0_40px_-25px_rgba(167,139,250,0.6)]"}
            gaugeValue={(status?.vector_memory?.pending_embeddings ?? 0) > 0 ? 55 : 100}
            noTrigger
            noTriggerNote="otomatis via trigger"
          >
            <div className="text-[11px] text-slate-400 font-mono">
              <span className="text-slate-200 font-bold">{status?.vector_memory?.pending_embeddings ?? 0}</span> catatan 24 jam terakhir belum ke-embed
            </div>
          </EmployeeCard>
        </div>

        <div className="mt-4 text-center text-[9px] font-mono text-slate-700 uppercase tracking-widest">
          auto-sync tiap {REFRESH_INTERVAL_MS / 1000}s · platform-wide, bukan cuma org kamu
        </div>
      </div>
    </div>
  );
}
