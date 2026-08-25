import { useEffect, useMemo, useState } from "react";
import { Users, TrendingUp, CheckCircle2, AlertCircle, Mail, CalendarCheck, Eye, EyeOff, Wallet, BarChart3, Filter as FunnelIcon, Sparkles, Sun, Phone, MessageCircle, MapPin, FileText, Clock, CalendarClock, TriangleAlert, Loader2 } from "lucide-react";
import * as db from "../lib/db";
import { todayISO, fmtRp } from "../lib/helpers";

const ACTION_ICON = {
  Call: Phone, WhatsApp: MessageCircle, Visit: MapPin, "Kirim Penawaran": FileText,
  "Follow-up": Clock, "Jadwalkan Meeting": CalendarClock, Tunggu: Clock, Eskalasi: TriangleAlert, Closing: CheckCircle2,
};
const URGENCY_META = { high: { label: "High", hex: "#e11d48" }, medium: { label: "Medium", hex: "#d97706" }, low: { label: "Low", hex: "#64748b" } };

// "Good Morning" card - reads the AI digest that ALREADY RAN this morning (cron
// at 8am, Mon-Fri), never triggers a new AI call on open - purely displays what's
// already stored, so it's FREE every time the dashboard is opened.
function GoodMorningCard({ settings, onGo, onOpenLead, leads }) {
  const [state, setState] = useState({ status: "loading", run: null });

  useEffect(() => {
    let alive = true;
    db.getTodayAdvisorRun()
      .then((run) => { if (alive) setState({ status: run ? "ready" : "empty", run }); })
      .catch(() => { if (alive) setState({ status: "empty", run: null }); });
    return () => { alive = false; };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Good morning" : hour < 15 ? "Good afternoon" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = (settings?.community_display_name || "").split(" ")[0];

  if (state.status === "loading") {
    return (
      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-5 flex items-center gap-2 text-sm text-slate-400">
        <Loader2 size={15} className="animate-spin" /> Loading summary…
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Sun size={16} className="text-orange-500" /> {greeting}{name ? `, Mr ${name}` : ""}</div>
        <p className="text-xs text-slate-400 mt-2">No summary yet for today — automatic analysis runs every day at 8am (Mon–Fri). Check back later, or see your email.</p>
      </div>
    );
  }

  const { run } = state;
  const stats = run.stats || {};
  const topRecs = (run.recs || []).slice(0, 3);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-[28px] shadow-[0_8px_30px_-10px_rgba(15,23,42,0.4)] p-5 text-white">
      <div className="flex items-center gap-2 text-sm font-semibold"><Sun size={16} className="text-orange-400" /> {greeting}{name ? `, Mr ${name}` : ""}</div>
      <p className="text-[11px] text-slate-400 mt-1">Here's your CRM summary for today.</p>

      <div className="grid grid-cols-3 gap-2 mt-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5">
          <div className="text-lg font-bold font-mono">{stats.total_active ?? "—"}</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Active leads</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5">
          <div className="text-lg font-bold font-mono text-rose-400">{stats.overdue_followup ?? "—"}</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Overdue follow-ups</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-2.5">
          <div className="text-lg font-bold font-mono text-emerald-400">{stats.win_rate !== null && stats.win_rate !== undefined ? `${stats.win_rate}%` : "—"}</div>
          <div className="text-[9px] text-slate-400 mt-0.5">Win rate</div>
        </div>
      </div>

      {topRecs.length > 0 && (
        <div className="mt-4 space-y-2">
          {topRecs.map((r, i) => {
            const Icon = ACTION_ICON[r.action_type] || Clock;
            const um = URGENCY_META[r.urgency] || URGENCY_META.low;
            const lead = (leads || []).find((l) => l.id === r.id);
            return (
              <button
                key={i}
                onClick={() => lead && onOpenLead && onOpenLead(lead)}
                className="w-full text-left flex items-start gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3 transition-colors"
              >
                <span className="w-7 h-7 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 mt-0.5"><Icon size={13} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] font-semibold truncate">{r.name}</span>
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: um.hex }}>{um.label}</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400 mt-0.5 line-clamp-1">{r.action}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <button onClick={() => onGo("advisor")} className="w-full mt-4 text-xs font-medium bg-white/10 hover:bg-white/15 transition-colors rounded-2xl py-2.5 text-center">
        View all recommendations →
      </button>
    </div>
  );
}

function StatCard({ icon: I, label, value, accent, small }) {
  const ac = accent === "orange" ? "text-orange-600" : accent === "emerald" ? "text-emerald-600" : "text-slate-800";
  const bub = accent === "orange" ? "bg-orange-100 text-orange-600" : accent === "emerald" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500";
  return (
    <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4 transition-transform hover:-translate-y-0.5">
      <span className={`w-9 h-9 rounded-2xl flex items-center justify-center mb-2.5 ${bub}`}><I size={16} /></span>
      <div className={`font-mono font-bold leading-none ${small ? "text-base" : "text-2xl"} ${ac}`}>{value}</div>
      <div className="text-[11px] text-slate-400 mt-1.5">{label}</div>
    </div>
  );
}

function RevenueCard({ label, value, dark }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className={dark ? "bg-slate-900 rounded-[28px] shadow-[0_4px_24px_-6px_rgba(15,23,42,0.35)] p-4 text-white" : "bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4"}>
      <div className={`flex items-center justify-between text-xs mb-3 ${dark ? "text-slate-300" : "text-slate-400"}`}>
        <div className="flex items-center gap-2">
          <span className={`w-8 h-8 rounded-2xl flex items-center justify-center ${dark ? "bg-orange-600/20 text-orange-400" : "bg-orange-100 text-orange-600"}`}><Wallet size={15} /></span>
          {label}
        </div>
        <button onClick={() => setRevealed((v) => !v)} className={dark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"} title={revealed ? "Hide" : "Show"}>
          {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      <div className={`font-mono font-bold text-xl tracking-tight ${dark ? "" : "text-slate-800"}`}>
        {revealed ? fmtRp(value) : "Rp ••••••••"}
      </div>
    </div>
  );
}

function RevenueTrendChart({ months }) {
  const max = Math.max(...months.map((m) => m.value), 1);
  const w = 100 / months.length;
  return (
    <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4"><span className="w-7 h-7 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><BarChart3 size={14} /></span> Revenue Trend (Last 6 Months)</div>
      <svg viewBox="0 0 300 140" className="w-full" style={{ height: "160px" }}>
        {months.map((m, i) => {
          const barH = max > 0 ? (m.value / max) * 90 : 0;
          const x = i * w;
          return (
            <g key={i}>
              <rect x={`${x + w * 0.2}%`} y={110 - barH} width={`${w * 0.6}%`} height={barH} rx="3" fill={m.value > 0 ? "#ea580c" : "#e2e8f0"} />
              <text x={`${x + w * 0.5}%`} y="128" textAnchor="middle" fontSize="9" fill="#94a3b8">{m.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PipelineFunnel({ stages, counts }) {
  const max = Math.max(...counts.map((c) => c.count), 1);
  return (
    <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4"><span className="w-7 h-7 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><FunnelIcon size={14} /></span> Pipeline Funnel</div>
      <div className="space-y-3">
        {counts.map((c, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-600 font-medium">{c.label}</span>
              <span className="text-slate-400 font-mono">{c.count}</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(c.count / max) * 100}%`, backgroundColor: c.hex }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Win rate, average days to close, and top category - calculated from leads
// that are already closed (won/lost). 8-lead threshold matches AI Advisor &
// proactive-check, so insights appear consistently across the app.
function PerformanceInsight({ leads, stages }) {
  const wonKeys = stages.filter((s) => s.type === "won").map((s) => s.key);
  const lostKeys = stages.filter((s) => s.type === "lost").map((s) => s.key);
  const closedWon = leads.filter((l) => wonKeys.includes(l.stage_key));
  const closedLost = leads.filter((l) => lostKeys.includes(l.stage_key));
  const totalClosed = closedWon.length + closedLost.length;

  if (totalClosed < 8) {
    return (
      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-1"><span className="w-7 h-7 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><Sparkles size={14} /></span> Performance Insights</div>
        <p className="text-xs text-slate-400 mt-2">Only {totalClosed} leads closed so far (won/lost). Collect at least 8 to see patterns here.</p>
      </div>
    );
  }

  const winRate = Math.round((closedWon.length / totalClosed) * 100);
  const daysArr = closedWon
    .map((l) => {
      if (!l.created_at || !l.deal_date) return null;
      const d = Math.floor((new Date(l.deal_date) - new Date(l.created_at)) / 86400000);
      return d >= 0 ? d : null;
    })
    .filter((d) => d !== null);
  const avgDays = daysArr.length ? Math.round(daysArr.reduce((a, b) => a + b, 0) / daysArr.length) : null;

  const catWin = {};
  for (const l of closedWon) { const k = l.category || "Other"; catWin[k] = (catWin[k] || 0) + 1; }
  const topCat = Object.entries(catWin).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3"><span className="w-7 h-7 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><Sparkles size={14} /></span> Performance Insights</div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="text-2xl font-bold font-mono text-orange-600">{winRate}%</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Win rate</div>
        </div>
        <div>
          <div className="text-2xl font-bold font-mono text-slate-800">{avgDays ?? "—"}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Avg. days to close</div>
        </div>
        <div>
          <div className="text-sm font-bold text-slate-800 truncate" title={topCat ? topCat[0] : ""}>{topCat ? topCat[0] : "—"}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Top category</div>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">Based on {totalClosed} closed leads.</p>
    </div>
  );
}

export default function Dashboard({ leads, stages, dealTransactions, settings, onGo, onOpenLead }) {
  const s = useMemo(() => {
    const won = stages.filter((x) => x.type === "won").map((x) => x.key);
    const activeKeys = stages.filter((x, i) => x.type === "normal" && i !== 0).map((x) => x.key);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    // Revenue sekarang dihitung dari SEMUA transaksi deal (bukan cuma nilai
    // terakhir per lead), biar repeat order/transaksi berkali-kali ke perusahaan
    // yang sama kehitung semua, bukan cuma yang paling baru doang.
    const txs = dealTransactions || [];
    const revYear = txs.reduce((a, t) => {
      const d = t.deal_date ? new Date(t.deal_date) : null;
      return d && d.getFullYear() === curYear ? a + (Number(t.deal_value) || 0) : a;
    }, 0);
    const revMonth = txs.reduce((a, t) => {
      const d = t.deal_date ? new Date(t.deal_date) : null;
      return d && d.getFullYear() === curYear && d.getMonth() === curMonth ? a + (Number(t.deal_value) || 0) : a;
    }, 0);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const value = txs.reduce((a, t) => {
        const dd = t.deal_date ? new Date(t.deal_date) : null;
        return dd && dd.getFullYear() === y && dd.getMonth() === m ? a + (Number(t.deal_value) || 0) : a;
      }, 0);
      months.push({ label: monthNames[m], value });
    }

    const stageCounts = stages.map((st) => ({
      label: st.label, hex: st.hex,
      count: leads.filter((c) => c.stage_key === st.key).length,
    }));

    return {
      total: leads.length,
      active: leads.filter((c) => activeKeys.includes(c.stage_key)).length,
      deals: leads.filter((c) => won.includes(c.stage_key)).length,
      followup: leads.filter((c) => c.next_action && c.next_action.trim()).length,
      contact: leads.filter((c) => c.email || c.phone).length,
      visitsToday: leads.filter((c) => c.visit_date === todayISO()).length,
      revYear, revMonth, months, stageCounts,
    };
  }, [leads, stages, dealTransactions]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-xs text-slate-400 mt-1 capitalize">{new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <GoodMorningCard settings={settings} onGo={onGo} onOpenLead={onOpenLead} leads={leads} />

      <div className="grid grid-cols-2 gap-3">
        <RevenueCard label="Revenue This Year" value={s.revYear} dark />
        <RevenueCard label="Revenue This Month" value={s.revMonth} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RevenueTrendChart months={s.months} />
        <PipelineFunnel stages={stages} counts={s.stageCounts} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={CalendarCheck} label="Today's Visits" value={s.visitsToday} accent="orange" />
        <StatCard icon={Users} label="Total Leads" value={s.total} />
        <StatCard icon={TrendingUp} label="Active Leads" value={s.active} />
        <StatCard icon={CheckCircle2} label="Deals" value={s.deals} accent="emerald" />
        <StatCard icon={AlertCircle} label="Needs Follow-up" value={s.followup} accent="orange" />
        <StatCard icon={Mail} label="Has Contact" value={`${s.contact}/${s.total}`} />
      </div>
      <button onClick={() => onGo("leads")} className="w-full text-sm text-orange-700 font-medium bg-orange-50 hover:bg-orange-100 transition-colors rounded-2xl py-3 text-center">View all leads →</button>
    </div>
  );
}
