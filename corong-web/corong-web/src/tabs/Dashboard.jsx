import React, { useMemo } from "react";
import {
  Users, MessageCircle, MapPin, Trophy, ArrowRight, Plus,
  CalendarDays, CheckCircle2, Clock3, Sparkles, Target,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { NextoRobotHead } from "../Auth";

const cn = (...v) => v.filter(Boolean).join(" ");

function sameDay(value) {
  if (!value) return false;
  const d = new Date(`${value}T00:00:00`);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function formatValue(value) {
  const n = Number(value || 0);
  if (!n) return "—";
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(0)} jt`;
  return `Rp ${n.toLocaleString("id-ID")}`;
}

function Card({ children, className = "" }) {
  // Radius disamain 28px (28 Sep 2026 - sebelumnya 20px, beda sendiri dari
  // semua kartu di tab lain yang pakai rounded-[28px]) biar konsisten satu
  // bahasa visual di seluruh app.
  return <section className={cn("rounded-[28px] border border-slate-200/80 bg-white shadow-[0_14px_40px_-30px_rgba(15,23,42,.32)]", className)}>{children}</section>;
}

function SectionTitle({ title, action, onClick }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-900">{title}</h2>
      {action && <button onClick={onClick} className="text-[11px] font-semibold text-orange-600 hover:text-orange-800 flex items-center gap-1">{action}<ArrowRight size={13}/></button>}
    </div>
  );
}

function Kpi({ icon: Icon, value, label, trend, iconClass }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", iconClass)}><Icon size={19} strokeWidth={2}/></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-end justify-between gap-2">
            <div className="text-[24px] leading-none font-black tracking-[-0.04em] text-slate-900">{value}</div>
            {trend && <span className="text-[10px] font-bold text-emerald-500">{trend}</span>}
          </div>
          <div className="mt-1 text-[10px] font-medium text-slate-500">{label}</div>
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard({
  leads = [],
  stages = [],
  dealTransactions = [],
  settings = {},
  onGo,
  onOpenLead,
}) {
  const displayName = settings?.community_display_name || settings?.name || settings?.full_name || "Nando";

  const stats = useMemo(() => {
    const wonKeys = stages.filter(s => s.type === "won").map(s => s.key);
    const lostKeys = stages.filter(s => s.type === "lost").map(s => s.key);
    const won = leads.filter(l => wonKeys.includes(l.stage_key));
    const lost = leads.filter(l => lostKeys.includes(l.stage_key));
    const followups = leads.filter(l => l.next_action && String(l.next_action).trim());
    const visits = leads.filter(l => sameDay(l.visit_date));
    return {
      total: leads.length,
      won: won.length,
      lost: lost.length,
      followups: followups.length,
      visits: visits.length,
      deals: dealTransactions.length,
      winRate: won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0,
      wonKeys,
    };
  }, [leads, stages, dealTransactions]);

  const pipeline = useMemo(() => {
    const usable = stages.filter(s => s.type !== "lost").slice(0, 4);
    return usable.length ? usable : [{ key: "prospek", label: "Prospek", type: "normal" }];
  }, [stages]);

  const colors = [
    { bg: "bg-blue-50", text: "text-blue-700", bar: "bg-blue-500" },
    { bg: "bg-violet-50", text: "text-violet-700", bar: "bg-violet-500" },
    { bg: "bg-orange-50", text: "text-orange-700", bar: "bg-orange-500" },
    { bg: "bg-emerald-50", text: "text-emerald-700", bar: "bg-emerald-500" },
  ];

  const todayTasks = useMemo(() => {
    const items = leads.filter(l => l.next_action || sameDay(l.visit_date)).slice(0, 4);
    return items.map((l, i) => ({
      lead: l,
      time: l.visit_date ? "Hari ini" : i === 0 ? "Prioritas" : "Follow-up",
      title: l.visit_date ? `Visit - ${l.name}` : String(l.next_action || "Follow-up lead"),
      sub: l.city || l.key_person || "Lead aktif",
    }));
  }, [leads]);

  const upcoming = useMemo(() => leads.filter(l => l.visit_date).sort((a,b) => String(a.visit_date).localeCompare(String(b.visit_date))).slice(0,3), [leads]);

  // Tren 6 bulan terakhir: leads baru (dari created_at) vs deal menang (dari
  // deal_date/created_at dealTransactions) - dipakai buat area chart, biar
  // Dashboard punya grafik tren beneran (recharts, bukan bar CSS statis).
  const trend = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("id-ID", { month: "short" }), leads: 0, deals: 0 });
    }
    const idxByKey = Object.fromEntries(months.map((m, i) => [m.key, i]));
    leads.forEach((l) => {
      if (!l.created_at) return;
      const d = new Date(l.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in idxByKey) months[idxByKey[key]].leads += 1;
    });
    dealTransactions.forEach((dt) => {
      const raw = dt.deal_date || dt.created_at;
      if (!raw) return;
      const d = new Date(raw);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in idxByKey) months[idxByKey[key]].deals += 1;
    });
    return months;
  }, [leads, dealTransactions]);

  const aiLead = useMemo(() => {
    return leads.find(l => !stats.wonKeys.includes(l.stage_key) && l.next_action) || leads.find(l => !stats.wonKeys.includes(l.stage_key));
  }, [leads, stats.wonKeys]);

  const pipelineCounts = pipeline.map(s => leads.filter(l => l.stage_key === s.key).length);
  const maxPipeline = Math.max(1, ...pipelineCounts);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">Sales Workspace</div>
          <h1 className="mt-1 text-[30px] md:text-[34px] leading-tight font-black tracking-[-0.045em] text-slate-950">Good morning, {displayName}</h1>
          <p className="mt-1 text-[13px] text-slate-500">Fokus pada follow-up yang paling berpeluang menghasilkan deal.</p>
        </div>
        <button onClick={() => onGo?.("leads")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-[12px] font-bold text-white shadow-[0_12px_25px_-12px_rgba(15,23,42,.7)] hover:bg-slate-800">
          <Plus size={16}/> Tambah Lead
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={Users} value={stats.total} label="Total Leads" trend="↑ aktif" iconClass="bg-orange-50 text-orange-600" />
        <Kpi icon={MessageCircle} value={stats.followups} label="Follow-up" trend="hari ini" iconClass="bg-violet-50 text-violet-600" />
        <Kpi icon={MapPin} value={stats.visits} label="Kunjungan Hari Ini" trend="agenda" iconClass="bg-emerald-50 text-emerald-600" />
        <Kpi icon={Trophy} value={stats.won} label="Deal Won" trend={`${stats.winRate}% win rate`} iconClass="bg-amber-50 text-amber-600" />
      </div>

      {/* Tren 6 bulan - area chart recharts (bukan bar CSS statis) */}
      <Card className="p-5">
        <SectionTitle title="Tren 6 Bulan Terakhir" />
        <div className="h-48 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="nextoLeadsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="nextoDealsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6d5dfc" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6d5dfc" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 11 }} labelStyle={{ fontWeight: 700, color: "#0f172a" }} />
              <Area type="monotone" dataKey="leads" name="Leads Baru" stroke="#f97316" strokeWidth={2} fill="url(#nextoLeadsGrad)" />
              <Area type="monotone" dataKey="deals" name="Deal Menang" stroke="#6d5dfc" strokeWidth={2} fill="url(#nextoDealsGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-1">
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500"><span className="h-2 w-2 rounded-full bg-orange-500" />Leads Baru</span>
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500"><span className="h-2 w-2 rounded-full bg-violet-500" />Deal Menang</span>
        </div>
      </Card>

      {/* Main */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)] gap-4">
        <Card className="p-5">
          <SectionTitle title="Sales Pipeline" action="Lihat Pipeline" onClick={() => onGo?.("leads")} />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {pipeline.map((stage, i) => {
              const c = colors[i % colors.length];
              const count = pipelineCounts[i] || 0;
              const stageLeads = leads.filter(l => l.stage_key === stage.key).slice(0,3);
              return (
                <div key={stage.key} className={cn("rounded-2xl border border-slate-200/70 overflow-hidden", c.bg)}>
                  <div className="px-3.5 pt-3 pb-2">
                    <div className={cn("text-[11px] font-bold", c.text)}>{stage.label}</div>
                    <div className="mt-1 flex items-end justify-between"><span className="text-[25px] leading-none font-black text-slate-900">{count}</span><span className="text-[9px] text-slate-400">lead</span></div>
                    <div className="mt-3 h-1.5 rounded-full bg-white/80 overflow-hidden"><div className={cn("h-full rounded-full", c.bar)} style={{width:`${Math.max(8,(count/maxPipeline)*100)}%`}}/></div>
                  </div>
                  <div className="border-t border-white/70 bg-white/55">
                    {stageLeads.length ? stageLeads.map(l => (
                      <button key={l.id} onClick={() => onOpenLead?.(l)} className="w-full text-left px-3.5 py-2 border-b border-slate-200/40 last:border-0 hover:bg-white/70">
                        <div className="truncate text-[10px] font-semibold text-slate-700">{l.name}</div>
                        <div className="truncate text-[9px] text-slate-400">{formatValue(l.value || l.deal_value)}</div>
                      </button>
                    )) : <div className="px-3.5 py-3 text-[9px] text-slate-400">Belum ada lead</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="overflow-hidden bg-slate-950 text-white border-slate-800">
          <div className="p-5 bg-[radial-gradient(circle_at_85%_10%,rgba(109,93,252,.42),transparent_35%)]">
            <div className="flex items-start justify-between gap-3">
              <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">NEXTO AI</div><h2 className="mt-2 text-[21px] font-black tracking-tight">Your Sales Copilot</h2><p className="mt-1 text-[11px] leading-5 text-slate-400">Insight singkat untuk membantu kamu menentukan langkah berikutnya.</p></div>
              <NextoRobotHead size={52}/>
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[.06] p-3.5">
              <div className="flex items-center gap-2 text-violet-300"><Sparkles size={14}/><span className="text-[10px] font-bold">Next best action</span></div>
              <p className="mt-2 text-[12px] leading-5 text-slate-200">{aiLead ? `Prioritaskan follow-up ${aiLead.name}.` : "Tambahkan lead baru agar AI bisa menemukan prioritas."}</p>
            </div>
            <button onClick={() => onGo?.("advisor")} className="mt-3 w-full rounded-xl bg-white text-slate-950 py-2.5 text-[11px] font-bold hover:bg-slate-100 flex items-center justify-center gap-2">Buka AI Advisor <ArrowRight size={14}/></button>
          </div>
        </Card>
      </div>

      {/* Productivity */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_.85fr_.85fr] gap-4">
        <Card className="p-5">
          <SectionTitle title="Tugas Hari Ini" action="Lihat Semua" onClick={() => onGo?.("visitfollowup")} />
          <div className="space-y-1">
            {todayTasks.length ? todayTasks.map((item, i) => (
              <button key={item.lead.id} onClick={() => onOpenLead?.(item.lead)} className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50">
                <div className={cn("h-5 w-5 rounded-md border flex items-center justify-center shrink-0", i === 0 ? "bg-orange-600 border-orange-600 text-white" : "border-slate-300 text-transparent")}><CheckCircle2 size={13}/></div>
                <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold text-slate-800">{item.title}</div><div className="truncate text-[9px] text-slate-400 flex items-center gap-1"><Clock3 size={10}/>{item.time} · {item.sub}</div></div>
              </button>
            )) : <div className="py-8 text-center text-[11px] text-slate-400">Belum ada tugas.</div>}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Win Rate" />
          <div className="flex items-center gap-5 py-2">
            <div className="relative h-28 w-28 shrink-0 rounded-full" style={{background:`conic-gradient(#10b981 ${stats.winRate}%, #e2e8f0 0)`}}>
              <div className="absolute inset-[9px] rounded-full bg-white flex items-center justify-center"><span className="text-[24px] font-black text-slate-900">{stats.winRate}%</span></div>
            </div>
            <div><div className="text-[12px] font-bold text-slate-800">Conversion sehat</div><p className="mt-1 text-[10px] leading-4 text-slate-400">Berdasarkan lead yang sudah berstatus Won/Lost.</p></div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Kunjungan Mendatang" action="Lihat Semua" onClick={() => onGo?.("visitfollowup")} />
          <div className="space-y-1">
            {upcoming.length ? upcoming.map(l => (
              <button key={l.id} onClick={() => onOpenLead?.(l)} className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50">
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600"><CalendarDays size={15}/></div>
                <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold text-slate-800">{l.name}</div><div className="truncate text-[9px] text-slate-400 flex items-center gap-1"><MapPin size={10}/>{l.city || "Lokasi belum diisi"}</div></div>
                <span className="text-[9px] font-bold text-orange-600">{l.visit_date}</span>
              </button>
            )) : <div className="py-8 text-center text-[11px] text-slate-400">Belum ada kunjungan.</div>}
          </div>
        </Card>
      </div>

      <div className="rounded-2xl border border-slate-200/70 bg-gradient-to-r from-slate-50 to-orange-50/50 px-5 py-4 flex items-center gap-3">
        <Target size={18} className="text-orange-500 shrink-0"/>
        <p className="text-[11px] font-medium text-slate-500">“Discipline in follow-up creates freedom in revenue.”</p>
        <span className="ml-auto text-[10px] font-bold text-slate-400">— NEXTO</span>
      </div>
    </div>
  );
}
