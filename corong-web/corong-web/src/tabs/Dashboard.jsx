import { useMemo, useState } from "react";
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

function RevenueCard({ label, value, dark }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className={dark ? "bg-slate-900 rounded-2xl shadow-sm p-4 text-white" : "bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4"}>
      <div className={`flex items-center justify-between text-xs mb-2 ${dark ? "text-slate-300" : "text-slate-400"}`}>
        <div className="flex items-center gap-2">
          <span className={`w-7 h-7 rounded-xl flex items-center justify-center ${dark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600"}`}><Wallet size={15} /></span>
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
      <div>
        <div className="text-[11px] uppercase tracking-widest text-amber-600 font-semibold mb-0.5">Nexto · Sales Funnel</div>
        <h1 className="text-2xl font-bold tracking-tight">Halo, mari gerakin pipeline hari ini</h1>
        <p className="text-xs text-slate-400 mt-0.5 capitalize">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <RevenueCard label="Revenue Tahun Ini" value={s.revYear} dark />
        <RevenueCard label="Revenue Bulan Ini" value={s.revMonth} />
      </div>

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
