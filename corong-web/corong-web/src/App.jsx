import React, { useMemo } from "react";
import {
  Search,
  Bell,
  CalendarDays,
  ChevronRight,
  Plus,
  Sparkles,
  Trophy,
  Users,
  CalendarCheck,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Clock3,
  MapPin,
  MessageCircle,
  Phone,
  Building2,
  Target,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  MoreHorizontal,
  Zap,
  BarChart3,
} from "lucide-react";

function money(value) {
  const n = Number(value || 0);
  if (!n) return "Rp0";
  if (n >= 1000000000) return `Rp${(n / 1000000000).toFixed(1)}M`;
  if (n >= 1000000) return `Rp${(n / 1000000).toFixed(1)}jt`;
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join("")
    .toUpperCase() || "N";
}

function sameDay(value) {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return (
    !Number.isNaN(d.getTime()) &&
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function daysSince(value) {
  if (!value) return 999;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 999;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function getStageLabel(stageKey, stages) {
  return stages?.find((s) => s.key === stageKey)?.label || stageKey || "Prospek";
}

function getStageColor(stageKey, stages) {
  return stages?.find((s) => s.key === stageKey)?.hex || "#94a3b8";
}

function ActionButton({ icon: Icon, children, primary, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        primary
          ? "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#2563eb] px-4 py-3 text-sm font-bold text-white shadow-[0_12px_24px_-14px_rgba(37,99,235,.8)] transition hover:bg-[#1d4ed8]"
          : "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      }
    >
      <Icon size={17} strokeWidth={2.2} />
      {children}
    </button>
  );
}

function MetricCard({ icon: Icon, value, label, note, tone = "blue", trend }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-rose-50 text-rose-500",
    violet: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };

  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-28px_rgba(15,23,42,.45)]">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}>
          <Icon size={19} />
        </div>
        {note && <span className="text-[11px] font-bold text-emerald-600">{note}</span>}
      </div>
      <div className="mt-5 text-[29px] font-black tracking-tight text-[#0b1020]">{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-400">{label}</div>
      {trend && (
        <div className={`mt-3 inline-flex items-center gap-1 text-[11px] font-bold ${trend > 0 ? "text-emerald-600" : "text-rose-500"}`}>
          {trend > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(trend)}% vs periode lalu
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_16px_45px_-34px_rgba(15,23,42,.4)] ${className}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-black tracking-tight text-[#0b1020]">{title}</h2>
          {subtitle && <p className="mt-1 text-xs font-medium text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
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
  const stats = useMemo(() => {
    const wonKeys = stages.filter((s) => s.type === "won").map((s) => s.key);
    const lostKeys = stages.filter((s) => s.type === "lost").map((s) => s.key);
    const activeKeys = stages.filter((s) => s.type === "normal").map((s) => s.key);

    const won = leads.filter((l) => wonKeys.includes(l.stage_key)).length;
    const lost = leads.filter((l) => lostKeys.includes(l.stage_key)).length;
    const active = leads.filter((l) => activeKeys.includes(l.stage_key)).length;
    const followups = leads.filter((l) => l.next_action && String(l.next_action).trim()).length;
    const visits = leads.filter((l) => sameDay(l.visit_date)).length;
    const deals = dealTransactions.length;

    return {
      total: leads.length,
      active: active || Math.max(0, leads.length - won - lost),
      followups,
      visits,
      deals,
      won,
      lost,
      winRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0,
      wonKeys,
      activeKeys,
    };
  }, [leads, stages, dealTransactions]);

  const displayName =
    settings?.community_display_name ||
    settings?.name ||
    settings?.full_name ||
    "Nando";

  const activeLeads = useMemo(() => {
    const activeKeys = stats.activeKeys.length
      ? stats.activeKeys
      : stages.filter((s) => s.type !== "won" && s.type !== "lost").map((s) => s.key);

    return leads
      .filter((l) => !activeKeys.length || activeKeys.includes(l.stage_key))
      .sort((a, b) => daysSince(b.updated_at || b.created_at) - daysSince(a.updated_at || a.created_at))
      .slice(0, 5);
  }, [leads, stages, stats.activeKeys]);

  const todayAgenda = useMemo(() => {
    const items = leads
      .filter((l) => sameDay(l.visit_date) || l.next_action)
      .sort((a, b) => {
        const av = sameDay(a.visit_date) ? 0 : 1;
        const bv = sameDay(b.visit_date) ? 0 : 1;
        return av - bv;
      })
      .slice(0, 4);

    return items;
  }, [leads]);

  const pipeline = useMemo(() => {
    const normalStages = stages.filter((s) => s.type === "normal").slice(0, 4);
    if (normalStages.length) {
      return normalStages.map((stage) => ({
        ...stage,
        items: leads.filter((l) => l.stage_key === stage.key).slice(0, 3),
        count: leads.filter((l) => l.stage_key === stage.key).length,
      }));
    }

    return [
      { key: "prospek", label: "Prospek", items: leads.slice(0, 3), count: leads.length, hex: "#94a3b8" },
      { key: "qualified", label: "Qualified", items: [], count: 0, hex: "#60a5fa" },
      { key: "negosiasi", label: "Negosiasi", items: [], count: 0, hex: "#a78bfa" },
      { key: "closing", label: "Closing", items: [], count: 0, hex: "#34d399" },
    ];
  }, [leads, stages]);

  const highPriority = useMemo(() => {
    return [...leads]
      .sort((a, b) => {
        const scoreA = Number(a.ai_score ?? a.score ?? 0);
        const scoreB = Number(b.ai_score ?? b.score ?? 0);
        return scoreB - scoreA;
      })
      .slice(0, 3);
  }, [leads]);

  const openLead = (lead) => {
    if (onOpenLead) onOpenLead(lead);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <style>{`
        .nexto-dashboard-grid {
          background-image:
            linear-gradient(rgba(148,163,184,.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,.035) 1px, transparent 1px);
          background-size: 32px 32px;
        }
        .nexto-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
        .nexto-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
      `}</style>

      <div className="nexto-dashboard-grid min-h-screen">
        {/* Top workspace bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1480px] items-center gap-4 px-6 py-3">
            <button
              type="button"
              onClick={() => onGo?.("dashboard")}
              className="hidden shrink-0 items-center gap-2 lg:flex"
              title="Nexto Dashboard"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b1020] text-white">
                <Zap size={18} fill="currentColor" />
              </div>
              <span className="text-lg font-black tracking-tight">NEXT<span className="text-orange-500">O</span></span>
            </button>

            <div className="relative min-w-0 flex-1 lg:max-w-[430px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-16 text-sm font-medium outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-50"
                placeholder="Search leads, company, or notes..."
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-400">Ctrl K</kbd>
            </div>

            <div className="hidden items-center gap-2 md:flex">
              <span className="text-[11px] font-black uppercase tracking-[.22em] text-orange-500">Sales Workspace</span>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-bold text-slate-700">Dashboard</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-500 shadow-sm sm:flex">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.1)]" />
                Data tersinkron
              </div>
              <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-500 shadow-sm md:flex">
                <CalendarDays size={15} />
                {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
              </div>
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-900">
                <Bell size={18} />
              </button>
              <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#0b1020] text-xs font-black text-white sm:flex">
                {initials(displayName)}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1480px] px-6 pb-12 pt-7">
          {/* Hero + quick actions */}
          <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-3xl">☀️</span>
                <span className="text-xs font-black uppercase tracking-[.22em] text-blue-600">Tuesday • Sales command center</span>
              </div>
              <h1 className="text-4xl font-black tracking-[-.04em] text-[#0b1020] sm:text-5xl">
                Good morning, {displayName}.
              </h1>
              <p className="mt-2 text-base font-medium text-slate-400">Let's close more deals today.</p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <ActionButton icon={Plus} primary onClick={() => onGo?.("leads")}>Add Lead</ActionButton>
              <ActionButton icon={CalendarCheck} onClick={() => onGo?.("visitfollowup")}>Log Meeting</ActionButton>
              <ActionButton icon={Sparkles} onClick={() => onGo?.("generateleads")}>Generate Leads (AI)</ActionButton>
              <ActionButton icon={Trophy} onClick={() => onGo?.("deal")}>Create Deal</ActionButton>
            </div>
          </div>

          {/* AI copilot + agenda */}
          <div className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.8fr)]">
            <div className="relative overflow-hidden rounded-[28px] bg-[#10182f] p-6 text-white shadow-[0_24px_60px_-35px_rgba(15,23,42,.8)]">
              <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />
              <div className="absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

              <div className="relative flex gap-5">
                <div className="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 sm:flex">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e8edf5] text-[#5b4ce8] shadow-inner">
                    <Sparkles size={22} fill="currentColor" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black uppercase tracking-[.22em] text-blue-300">Nexto AI</div>
                  <h2 className="mt-1 text-2xl font-black tracking-tight">Sales copilot kamu hari ini.</h2>
                  <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-300">
                    {highPriority[0]
                      ? `${highPriority[0].company_name || highPriority[0].company || "Lead aktif"} adalah lead yang layak kamu prioritaskan berdasarkan aktivitas CRM.`
                      : "Belum ada lead prioritas. Tambahkan lead baru supaya Nexto bisa mulai membaca pola penjualanmu."}
                  </p>

                  <button
                    type="button"
                    onClick={() => onGo?.("advisor")}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-[#10182f] transition hover:bg-slate-100"
                  >
                    Lihat Rekomendasi <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>
            </div>

            <SectionCard
              title="Agenda Hari Ini"
              action={
                <button type="button" onClick={() => onGo?.("visitfollowup")} className="text-xs font-black text-blue-600 hover:text-blue-700">
                  Lihat Semua
                </button>
              }
            >
              {todayAgenda.length ? (
                <div className="space-y-4">
                  {todayAgenda.map((lead, i) => (
                    <button
                      type="button"
                      key={lead.id || i}
                      onClick={() => openLead(lead)}
                      className="group flex w-full gap-3 text-left"
                    >
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500 shadow-[0_0_0_5px_rgba(59,130,246,.1)]" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-black text-blue-600">
                          {sameDay(lead.visit_date) ? "Visit hari ini" : "Follow-up"}
                        </div>
                        <div className="truncate text-sm font-black text-slate-800 group-hover:text-blue-600">
                          {lead.company_name || lead.company || lead.name || "Lead"}
                        </div>
                        <div className="mt-0.5 truncate text-xs font-medium text-slate-400">
                          {lead.next_action || "Buka detail lead untuk melihat next action."}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[150px] flex-col items-center justify-center text-center">
                  <CalendarCheck className="text-slate-300" size={28} />
                  <p className="mt-3 text-sm font-bold text-slate-500">Agenda masih kosong.</p>
                  <p className="mt-1 text-xs text-slate-400">Tambahkan follow-up atau visit.</p>
                </div>
              )}
            </SectionCard>
          </div>

          {/* KPI */}
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-5">
            <MetricCard icon={Users} value={stats.total} label="Total Leads" note={`${stats.active} aktif`} tone="blue" trend={12} />
            <MetricCard icon={Bell} value={stats.followups} label="Follow-up Hari Ini" note={stats.followups ? "Perlu action" : "Clear"} tone="red" />
            <MetricCard icon={CalendarCheck} value={stats.visits} label="Visit Hari Ini" note={stats.visits ? "Terjadwal" : "Kosong"} tone="violet" trend={8} />
            <MetricCard icon={Trophy} value={stats.deals} label="Deal / Won" note={`${stats.won} won`} tone="green" trend={25} />
            <MetricCard icon={Target} value={`${stats.winRate}%`} label="Win Rate" note={stats.winRate >= 30 ? "Healthy" : "Improve"} tone="amber" trend={stats.winRate ? 6 : undefined} />
          </div>

          {/* Pipeline */}
          <div className="mb-6">
            <SectionCard
              title="Sales Pipeline"
              subtitle="Gambaran cepat posisi lead kamu sekarang."
              action={
                <button type="button" onClick={() => onGo?.("leads")} className="inline-flex items-center gap-1 text-xs font-black text-blue-600">
                  Buka Leads <ChevronRight size={14} />
                </button>
              }
            >
              <div className="nexto-scroll grid min-w-[900px] grid-cols-4 gap-3 overflow-x-auto">
                {pipeline.map((stage) => (
                  <div key={stage.key} className="rounded-2xl bg-slate-50 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.hex || "#94a3b8" }} />
                        <span className="text-xs font-black text-slate-700">{stage.label}</span>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-400">{stage.count}</span>
                    </div>

                    <div className="space-y-2.5">
                      {stage.items.length ? stage.items.map((lead) => (
                        <button
                          type="button"
                          key={lead.id}
                          onClick={() => openLead(lead)}
                          className="w-full rounded-xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="truncate text-xs font-black text-slate-800">
                            {lead.company_name || lead.company || lead.name || "Lead"}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="truncate text-[10px] font-medium text-slate-400">{lead.contact_name || lead.pic || "No PIC"}</span>
                            <span className="text-[10px] font-black text-slate-500">{money(lead.value || lead.deal_value || 0)}</span>
                          </div>
                        </button>
                      )) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-5 text-center text-[10px] font-bold text-slate-300">
                          Belum ada lead
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          {/* Activity + visit focus */}
          <div className="mb-6 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <SectionCard
              title="Aktivitas Penjualan"
              subtitle="Aktivitas terbaru dari pipeline kamu."
              action={<BarChart3 size={18} className="text-slate-300" />}
            >
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Users, label: "Leads", value: stats.total, delta: "+12%" },
                  { icon: CalendarCheck, label: "Visit", value: stats.visits, delta: "+8%" },
                  { icon: Trophy, label: "Deals", value: stats.deals, delta: "+25%" },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between">
                      <item.icon size={17} className="text-blue-500" />
                      <span className="text-[10px] font-black text-emerald-600">{item.delta}</span>
                    </div>
                    <div className="mt-4 text-2xl font-black text-[#0b1020]">{item.value}</div>
                    <div className="mt-1 text-xs font-bold text-slate-400">{item.label} minggu ini</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex h-32 items-end gap-2 rounded-2xl bg-slate-50 p-4">
                {[34, 52, 43, 67, 49, 78, 63, 88, 72, 92, 78, 100].map((height, i) => (
                  <div key={i} className="flex h-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-lg bg-blue-500/80 transition hover:bg-blue-600"
                      style={{ height: `${height}%` }}
                      title={`Hari ${i + 1}`}
                    />
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="Visit Focus"
              subtitle="Customer yang perlu kamu sentuh berikutnya."
              action={<MapPin size={18} className="text-slate-300" />}
            >
              {activeLeads.slice(0, 3).map((lead, i) => (
                <button
                  type="button"
                  key={lead.id || i}
                  onClick={() => openLead(lead)}
                  className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-left transition hover:bg-white hover:shadow-sm"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-blue-600 shadow-sm">
                    {initials(lead.company_name || lead.company || lead.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-black text-slate-800">{lead.company_name || lead.company || lead.name || "Lead"}</div>
                    <div className="mt-1 truncate text-[10px] font-medium text-slate-400">
                      {lead.location || lead.address || "Lokasi belum diisi"}
                    </div>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-slate-300" />
                </button>
              ))}
              {!activeLeads.length && (
                <div className="flex min-h-[170px] items-center justify-center text-center text-xs font-bold text-slate-400">
                  Belum ada lead aktif untuk difokuskan.
                </div>
              )}
              <button
                type="button"
                onClick={() => onGo?.("visitfollowup")}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                Kelola Visit & Follow-up <ArrowUpRight size={14} />
              </button>
            </SectionCard>
          </div>

          {/* AI insights */}
          <SectionCard
            title="AI Insights"
            subtitle="Nexto membaca pola sederhana dari data CRM yang sudah kamu simpan."
            action={<Sparkles size={18} className="text-violet-500" />}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => highPriority[0] && openLead(highPriority[0])}
                className="group rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 size={18} />
                  <span className="text-xs font-black">High Chance to Win</span>
                </div>
                <div className="mt-3 truncate text-sm font-black text-slate-800">
                  {highPriority[0]?.company_name || highPriority[0]?.company || "Belum ada kandidat"}
                </div>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                  Prioritaskan lead dengan aktivitas terbaru dan next action yang jelas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onGo?.("visitfollowup")}
                className="group rounded-2xl border border-rose-100 bg-rose-50/60 p-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 text-rose-600">
                  <AlertTriangle size={18} />
                  <span className="text-xs font-black">At Risk</span>
                </div>
                <div className="mt-3 text-sm font-black text-slate-800">
                  {stats.followups} follow-up perlu perhatian
                </div>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                  Jangan biarkan lead aktif lewat tanpa kontak berikutnya.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onGo?.("generateleads")}
                className="group rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-left transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2 text-violet-600">
                  <Lightbulb size={18} />
                  <span className="text-xs font-black">New Opportunity</span>
                </div>
                <div className="mt-3 text-sm font-black text-slate-800">
                  Generate lead baru dengan AI
                </div>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                  Tambah target baru supaya pipeline tidak kosong di bagian depan.
                </p>
              </button>
            </div>
          </SectionCard>

          {/* Bottom shortcut */}
          <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                <Zap size={19} />
              </div>
              <div>
                <div className="text-sm font-black text-slate-800">Kerjakan next best action.</div>
                <div className="mt-1 text-xs font-medium text-slate-400">Nexto siap membawa kamu langsung ke tempat yang perlu dikerjakan.</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => onGo?.("leads")} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800">Open Leads</button>
              <button type="button" onClick={() => onGo?.("advisor")} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-50">Open AI Advisor</button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
