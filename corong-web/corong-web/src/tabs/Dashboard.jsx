import { useMemo } from "react";
import { Users, TrendingUp, CheckCircle2, AlertCircle, Mail, CalendarCheck } from "lucide-react";
import { todayISO } from "../lib/helpers";

function StatCard({ icon: I, label, value, accent }) {
  const ac = accent === "amber" ? "text-amber-600" : accent === "emerald" ? "text-emerald-600" : "text-slate-800";
  const bub = accent === "amber" ? "bg-amber-100 text-amber-600" : accent === "emerald" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500";
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3.5">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2"><span className={`w-7 h-7 rounded-xl flex items-center justify-center ${bub}`}><I size={15} /></span> {label}</div>
      <div className={`font-mono font-bold text-2xl ${ac}`}>{value}</div>
    </div>
  );
}

export default function Dashboard({ leads, stages, onGo }) {
  const s = useMemo(() => {
    const won = stages.filter((x) => x.type === "won").map((x) => x.key);
    const lost = stages.filter((x) => x.type === "lost").map((x) => x.key);
    const activeKeys = stages.filter((x, i) => x.type === "normal" && i !== 0).map((x) => x.key);
    return {
      total: leads.length,
      active: leads.filter((c) => activeKeys.includes(c.stage_key)).length,
      deals: leads.filter((c) => won.includes(c.stage_key)).length,
      followup: leads.filter((c) => c.next_action && c.next_action.trim()).length,
      contact: leads.filter((c) => c.email || c.phone).length,
      visitsToday: leads.filter((c) => c.visit_date === todayISO()).length,
    };
  }, [leads, stages]);

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[11px] uppercase tracking-widest text-amber-600 font-semibold mb-0.5">Corong · Sales Funnel</div>
        <h1 className="text-2xl font-bold tracking-tight">Halo, mari gerakin pipeline hari ini</h1>
        <p className="text-xs text-slate-400 mt-0.5 capitalize">{new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
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
