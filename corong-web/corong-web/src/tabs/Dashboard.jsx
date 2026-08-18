import { useMemo, useState } from "react";
import { Users, TrendingUp, CheckCircle2, AlertCircle, Mail, CalendarCheck, Eye, EyeOff, Wallet, BarChart3, Filter as FunnelIcon } from "lucide-react";
import { todayISO, fmtRp } from "../lib/helpers";

function StatCard({ icon: I, label, value, accent, small }) {
  const ac = accent === "orange" ? "text-orange-600" : accent === "emerald" ? "text-emerald-600" : "text-slate-800";
  const bub = accent === "orange" ? "bg-orange-100 text-orange-600" : accent === "emerald" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500";
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3.5">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2"><span className={`w-7 h-7 rounded-xl flex items-center justify-center ${bub}`}><I size={15} /></span> {label}</div>
      <div className={`font-mono font-bold ${small ? "text-base" : "text-2xl"} ${ac}`}>{value}</div>
    </div>
  );
}

function RevenueCard({ label, value, dark }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className={dark ? "bg-slate-900 rounded-2xl shadow-sm p-4 text-white" : "bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4"}>
      <div className={`flex items-center justify-between text-xs mb-2 ${dark ? "text-slate-300" : "text-slate-400"}`}>
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${dark ? "bg-orange-600/20 text-orange-400" : "bg-orange-100 text-orange-600"}`}><Wallet size={15} /></span>
          {label}
        </div>
        <button onClick={() => setRevealed((v) => !v)} className={dark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-700"} title={revealed ? "Sembunyikan" : "Tampilkan"}>
          {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      <div className={`font-mono font-bold text-xl ${dark ? "" : "text-slate-800"}`}>
        {revealed ? fmtRp(value) : "Rp ••••••••"}
      </div>
    </div>
  );
}

function RevenueTrendChart({ months }) {
  const max = Math.max(...months.map((m) => m.value), 1);
  const w = 100 / months.length;
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4"><BarChart3 size={16} className="text-orange-500" /> Tren Revenue 6 Bulan Terakhir</div>
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
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4"><FunnelIcon size={16} className="text-orange-500" /> Funnel Pipeline</div>
      <div className="space-y-2.5">
        {counts.map((c, i) => (
          <div key={i}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-600 font-medium">{c.label}</span>
              <span className="text-slate-400 font-mono">{c.count}</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${(c.count / max) * 100}%`, backgroundColor: c.hex }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard({ leads, stages, onGo }) {
  const s = useMemo(() => {
    const won = stages.filter((x) => x.type === "won").map((x) => x.key);
    const activeKeys = stages.filter((x, i) => x.type === "normal" && i !== 0).map((x) => x.key);
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const dealLeads = leads.filter((c) => won.includes(c.stage_key));
    const revYear = dealLeads.reduce((a, c) => {
      const d = c.deal_date ? new Date(c.deal_date) : null;
      return d && d.getFullYear() === curYear ? a + (Number(c.deal_value) || 0) : a;
    }, 0);
    const revMonth = dealLeads.reduce((a, c) => {
      const d = c.deal_date ? new Date(c.deal_date) : null;
      return d && d.getFullYear() === curYear && d.getMonth() === curMonth ? a + (Number(c.deal_value) || 0) : a;
    }, 0);

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(curYear, curMonth - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const value = dealLeads.reduce((a, c) => {
        const dd = c.deal_date ? new Date(c.deal_date) : null;
        return dd && dd.getFullYear() === y && dd.getMonth() === m ? a + (Number(c.deal_value) || 0) : a;
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
      deals: dealLeads.length,
      followup: leads.filter((c) => c.next_action && c.next_action.trim()).length,
      contact: leads.filter((c) => c.email || c.phone).length,
      visitsToday: leads.filter((c) => c.visit_date === todayISO()).length,
      revYear, revMonth, months, stageCounts,
    };
  }, [leads, stages]);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-orange-600 font-semibold mb-0.5">Nexto · Sales Funnel</div>
        <p className="text-xs text-slate-400 mt-0.5 capitalize">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <RevenueCard label="Revenue Tahun Ini" value={s.revYear} dark />
        <RevenueCard label="Revenue Bulan Ini" value={s.revMonth} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <RevenueTrendChart months={s.months} />
        <PipelineFunnel stages={stages} counts={s.stageCounts} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={CalendarCheck} label="Visit Hari Ini" value={s.visitsToday} accent="orange" />
        <StatCard icon={Users} label="Total Leads" value={s.total} />
        <StatCard icon={TrendingUp} label="Leads Aktif" value={s.active} />
        <StatCard icon={CheckCircle2} label="Deal" value={s.deals} accent="emerald" />
        <StatCard icon={AlertCircle} label="Perlu Follow-up" value={s.followup} accent="orange" />
        <StatCard icon={Mail} label="Ada Kontak" value={`${s.contact}/${s.total}`} />
      </div>
      <button onClick={() => onGo("leads")} className="text-sm text-orange-700 hover:underline">Lihat semua leads →</button>
    </div>
  );
}
