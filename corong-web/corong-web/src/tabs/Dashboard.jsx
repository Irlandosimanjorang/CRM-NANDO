import { useMemo, useState, useEffect } from "react";
import { Users, TrendingUp, CheckCircle2, AlertCircle, Mail, CalendarCheck, Eye, EyeOff, Wallet } from "lucide-react";
import { todayISO, fmtRp } from "../lib/helpers";

function StatCard({ icon: I, label, value, accent, small }) {
  const ac = accent === "amber" ? "text-amber-600" : accent === "emerald" ? "text-emerald-600" : "text-slate-800";
  const bub = accent === "amber" ? "bg-amber-100 text-amber-600" : accent === "emerald" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500";
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3.5">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2"><span className={`w-7 h-7 rounded-xl flex items-center justify-center ${bub}`}><I size={15} /></span> {label}</div>
      <div className={`font-mono font-bold ${small ? "text-base" : "text-2xl"} ${ac}`}>{value}</div>
    </div>
  );
}

const REVENUE_KEY = "corong_show_revenue";

export default function Dashboard({ leads, stages, onGo }) {
  const [showRevenue, setShowRevenue] = useState(() => {
    const saved = localStorage.getItem(REVENUE_KEY);
    return saved === null ? true : saved === "1";
  });
  useEffect(() => { localStorage.setItem(REVENUE_KEY, showRevenue ? "1" : "0"); }, [showRevenue]);

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
    return {
      total: leads.length,
      active: leads.filter((c) => activeKeys.includes(c.stage_key)).length,
      deals: dealLeads.length,
      followup: leads.filter((c) => c.next_action && c.next_action.trim()).length,
      contact: leads.filter((c) => c.email || c.phone).length,
      visitsToday: leads.filter((c) => c.visit_date === todayISO()).length,
      revYear, revMonth,
    };
  }, [leads, stages]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-amber-600 font-semibold mb-0.5">Corong · Sales Funnel</div>
          <h1 className="text-2xl font-bold tracking-tight">Halo, mari gerakin pipeline hari ini</h1>
          <p className="text-xs text-slate-400 mt-0.5 capitalize">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <button onClick={() => setShowRevenue((v) => !v)} className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-xl px-3 py-2 bg-white hover:bg-slate-50 text-slate-600">
          {showRevenue ? <EyeOff size={13} /> : <Eye size={13} />} {showRevenue ? "Sembunyikan revenue" : "Tampilkan revenue"}
        </button>
      </div>

      {showRevenue && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900 rounded-2xl shadow-sm p-4 text-white">
            <div className="flex items-center gap-2 text-xs text-slate-300 mb-2"><span className="w-7 h-7 rounded-xl flex items-center justify-center bg-amber-500/20 text-amber-400"><Wallet size={15} /></span> Revenue Tahun Ini</div>
            <div className="font-mono font-bold text-xl">{fmtRp(s.revYear)}</div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-2"><span className="w-7 h-7 rounded-xl flex items-center justify-center bg-amber-100 text-amber-600"><Wallet size={15} /></span> Revenue Bulan Ini</div>
            <div className="font-mono font-bold text-xl text-slate-800">{fmtRp(s.revMonth)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={CalendarCheck} label="Visit Hari Ini" value={s.visitsToday} accent="amber" />
        <StatCard icon={Users} label="Total Leads" value={s.total} />
        <StatCard icon={TrendingUp} label="Leads Aktif" value={s.active} />
        <StatCard icon={CheckCircle2} label="Deal" value={s.deals} accent="emerald" />
        <StatCard icon={AlertCircle} label="Perlu Follow-up" value={s.followup} accent="amber" />
        <StatCard icon={Mail} label="Ada Kontak" value={`${s.contact}/${s.total}`} />
      </div>
      <button onClick={() => onGo("leads")} className="text-sm text-amber-700 hover:underline">Lihat semua leads →</button>
    </div>
  );
}
