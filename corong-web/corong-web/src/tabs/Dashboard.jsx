import React, { useMemo, useEffect, useState } from "react";
import {
  Users, MessageCircle, MapPin, Trophy, ArrowRight,
  CheckCircle2, Clock3, Target, ChevronDown,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { NextoRobotHead } from "../Auth";
import * as db from "../lib/db";

const cn = (...v) => v.filter(Boolean).join(" ");

function sameDay(value) {
  if (!value) return false;
  const d = new Date(`${value}T00:00:00`);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function Card({ children, className = "" }) {
  // Radius disamain 28px (28 Sep 2026 - sebelumnya 20px, beda sendiri dari
  // semua kartu di tab lain yang pakai rounded-[28px]) biar konsisten satu
  // bahasa visual di seluruh app.
  return <section className={cn("rounded-[28px] border border-slate-200/80 bg-white shadow-[0_14px_40px_-30px_rgba(15,23,42,.32)]", className)}>{children}</section>;
}

function SectionTitle({ title, action, onClick }) {
  // BUG FIX (audit 16 Sep 2026): di kolom sempit (misal kartu "Distribusi
  // Pipeline" di grid 3 kolom), judul DAN tombol aksi sama-sama kepotong
  // jadi 2 baris terus numpuk tumpang tindih. Sekarang tombol aksi dipaksa
  // 1 baris (whitespace-nowrap + shrink-0) dan barisnya boleh wrap - kalau
  // beneran sempit, tombol jatuh ke baris baru di bawah judul, bukan
  // numpuk berantakan.
  return (
    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <h2 className="text-[15px] font-extrabold tracking-[-0.02em] text-slate-900">{title}</h2>
      {action && <button onClick={onClick} className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-orange-600 hover:text-orange-800 flex items-center gap-1">{action}<ArrowRight size={13}/></button>}
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

  // Dipake bareng buat donut "Distribusi Pipeline" & progress bar "Pipeline
  // Stages" - satu sumber warna biar dua-duanya nyambung visualnya.
  const DONUT_COLORS = ["#f97316", "#6d5dfc", "#3b82f6", "#10b981"];

  const todayTasks = useMemo(() => {
    const items = leads.filter(l => l.next_action || sameDay(l.visit_date)).slice(0, 4);
    return items.map((l, i) => ({
      lead: l,
      time: l.visit_date ? "Hari ini" : i === 0 ? "Prioritas" : "Follow-up",
      title: l.visit_date ? `Visit - ${l.name}` : String(l.next_action || "Follow-up lead"),
      sub: l.city || l.key_person || "Lead aktif",
    }));
  }, [leads]);

  // BUG FIX (audit 16 Sep 2026): sebelumnya gak nyaring tanggal - kunjungan
  // yang udah LEWAT bisa ikut nongol di sini dan kelabelin "Terjadwal" di
  // kartu Upcoming Tasks, padahal harusnya cuma yang hari ini/ke depan.
  const upcoming = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return leads
      .filter(l => l.visit_date && l.visit_date >= todayStr)
      .sort((a, b) => String(a.visit_date).localeCompare(String(b.visit_date)))
      .slice(0, 3);
  }, [leads]);

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

  // BUG FIX (16 Sep 2026, ketauan pas audit): db.getTodayAdvisorRun() itu
  // fungsi yang MEMANG dibikin buat kartu "Next best action" ini (lihat
  // komentarnya di db.js), tapi gak pernah dipanggil di mana pun - kartu ini
  // sebelumnya cuma nebak lead pertama yang punya next_action (bukan
  // rekomendasi AI beneran), makanya bisa beda sama email/tab Advisor yang
  // sama-sama baca advisor_runs. Sekarang beneran narik data yang sama.
  const [advisorRun, setAdvisorRun] = useState(null);
  const [recsOpen, setRecsOpen] = useState(false);
  useEffect(() => {
    db.getTodayAdvisorRun().then(setAdvisorRun).catch(() => setAdvisorRun(null));
  }, []);

  // 5 rekomendasi hari ini (nama perusahaan + aksi) dari advisor_runs -
  // fallback ke tebakan lama kalau belum ada run hari ini (misal weekend).
  const aiRecs = useMemo(() => {
    const recs = advisorRun?.recs;
    if (Array.isArray(recs) && recs.length > 0) {
      return recs.slice(0, 5).map((r) => ({ name: leads.find(l => l.id === r.id)?.name || "Lead", action: r.action }));
    }
    const fallback = leads.find(l => !stats.wonKeys.includes(l.stage_key) && l.next_action) || leads.find(l => !stats.wonKeys.includes(l.stage_key));
    return fallback ? [{ name: fallback.name, action: fallback.next_action || "Follow up lead ini" }] : [];
  }, [advisorRun, leads, stats.wonKeys]);

  const pipelineCounts = pipeline.map(s => leads.filter(l => l.stage_key === s.key).length);
  const maxPipeline = Math.max(1, ...pipelineCounts);

  // Donut diganti dari "Distribusi Pipeline" jadi "Prioritas Lead" (16 Sep
  // 2026, permintaan Nando) - sebelumnya donut ini nunjukin PERSIS data yang
  // sama kayak "Pipeline Stages" di sebelahnya (dobel, buang tempat). Info
  // prioritas lead aktif ini beda & lebih actionable (langsung keliatan
  // berapa yang high priority butuh perhatian duluan).
  const PRIORITY_COLORS = { high: "#e11d48", medium: "#d97706", low: "#64748b" };
  const priorityData = useMemo(() => {
    const active = leads.filter(l => !stats.wonKeys.includes(l.stage_key));
    const order = [["high", "High"], ["medium", "Medium"], ["low", "Low"]];
    return order
      .map(([key, label]) => ({ key, name: label, value: active.filter(l => (l.priority || "").toLowerCase() === key).length, color: PRIORITY_COLORS[key] }))
      .filter(d => d.value > 0);
  }, [leads, stats.wonKeys]);

  // "Key Accounts" - lead prioritas tinggi yang belum menang, dilabelin
  // "Aktif" kalau ada next_action/visit hari ini, selain itu "Lead".
  const keyAccounts = useMemo(() => {
    const open = leads.filter(l => !stats.wonKeys.includes(l.stage_key));
    const sorted = [...open].sort((a, b) => (b.priority === "high" ? 1 : 0) - (a.priority === "high" ? 1 : 0));
    return sorted.slice(0, 4).map(l => ({ lead: l, active: !!(l.next_action || sameDay(l.visit_date)) }));
  }, [leads, stats.wonKeys]);

  // Gabungan tugas hari ini + kunjungan mendatang jadi satu list "Upcoming
  // Tasks", dedup by lead id biar lead yang sama gak nongol dobel.
  const taskList = useMemo(() => {
    const seen = new Set();
    const combined = [];
    todayTasks.forEach(t => {
      if (seen.has(t.lead.id)) return;
      seen.add(t.lead.id);
      combined.push({ id: t.lead.id, lead: t.lead, title: t.title, meta: `${t.time} · ${t.sub}` });
    });
    upcoming.forEach(l => {
      if (seen.has(l.id)) return;
      seen.add(l.id);
      combined.push({ id: l.id, lead: l, title: `Visit — ${l.name}`, meta: `Terjadwal · ${l.visit_date}` });
    });
    return combined.slice(0, 6);
  }, [todayTasks, upcoming]);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div>
        <h1 className="text-[30px] md:text-[34px] leading-tight font-black tracking-[-0.045em] text-slate-950">Good morning, {displayName}</h1>
        <p className="mt-1 text-[13px] text-slate-500">Fokus pada follow-up yang paling berpeluang menghasilkan deal.</p>
      </div>

      {/* Rekomendasi AI (Next best action) - dipindah ke paling atas (16 Sep
          2026, permintaan Nando) biar langsung keliatan begitu buka
          Dashboard, gak ketutup di paling bawah. !bg-slate-950 pakai
          modifier "!" (important) - tanpa itu, class bg-white bawaan dari
          Card() bentrok sama bg-slate-950 di sini dan yang menang urutannya
          ditentuin Tailwind pas generate CSS (bukan urutan di className),
          jadi kartunya kemarin keliatan putih padahal harusnya gelap. */}
      <Card className="!bg-slate-950 overflow-hidden text-white !border-slate-800">
        <div className="p-5 bg-[radial-gradient(circle_at_85%_10%,rgba(109,93,252,.42),transparent_35%)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <NextoRobotHead size={44} />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">NEXTO AI</div>
                <h2 className="mt-1 text-[16px] font-black tracking-tight">Rekomendasi Hari Ini</h2>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">{aiRecs.length > 1 ? `${aiRecs.length} lead paling potensial buat difollow-up hari ini.` : "Tambahkan lead baru agar AI bisa menemukan prioritas."}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => onGo?.("advisor")} className="rounded-xl bg-white text-slate-950 py-2.5 px-4 text-[11px] font-bold hover:bg-slate-100 flex items-center justify-center gap-2">Buka AI Advisor <ArrowRight size={14} /></button>
              {aiRecs.length > 0 && (
                <button
                  onClick={() => setRecsOpen((v) => !v)}
                  aria-expanded={recsOpen}
                  title={recsOpen ? "Sembunyikan daftar" : "Tampilkan daftar"}
                  className="h-9 w-9 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
                >
                  <ChevronDown size={16} className={`transition-transform duration-200 ${recsOpen ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </div>

          {/* Dropdown (16 Sep 2026, permintaan Nando) - list rekomendasi
              bisa ditutup/dibuka pakai tombol chevron di atas. */}
          {aiRecs.length > 0 && recsOpen && (
            <div className="mt-4 pt-4 border-t border-white/10 grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {aiRecs.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px] leading-5 min-w-0">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                  <div className="min-w-0"><span className="font-semibold text-white">{r.name}</span><span className="text-slate-400"> — {r.action}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi icon={Users} value={stats.total} label="Total Leads" trend="↑ aktif" iconClass="bg-orange-50 text-orange-600" />
        <Kpi icon={MessageCircle} value={stats.followups} label="Follow-up" trend="hari ini" iconClass="bg-violet-50 text-violet-600" />
        <Kpi icon={MapPin} value={stats.visits} label="Kunjungan Hari Ini" trend="agenda" iconClass="bg-emerald-50 text-emerald-600" />
        <Kpi icon={Trophy} value={stats.won} label="Deal Won" trend={`${stats.winRate}% win rate`} iconClass="bg-amber-50 text-amber-600" />
      </div>

      {/* Layout 3 kolom niru struktur referensi "Cortex" (Analytics / CRM
          Sidebar / Upcoming Tasks) - datanya Nexto asli, warnanya ngikutin
          brand Nexto (oranye utama, violet cuma buat penanda AI). */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr_1fr] gap-4">
        {/* Kolom 1: Analytics - area chart tren + donut distribusi pipeline */}
        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle title="Tren Leads & Deal" />
            <div className="h-40 -mx-2">
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

          <Card className="p-5">
            <SectionTitle title="Prioritas Lead" action="Lihat" onClick={() => onGo?.("leads")} />
            {priorityData.length > 0 ? (
              <div className="flex items-center gap-4">
                <div className="h-28 w-28 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={priorityData} dataKey="value" nameKey="name" innerRadius={34} outerRadius={54} paddingAngle={3} strokeWidth={0}>
                        {priorityData.map((d) => <Cell key={d.key} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  {priorityData.map((d) => (
                    <div key={d.key} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="flex items-center gap-1.5 text-slate-600 truncate"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />{d.name}</span>
                      <span className="font-bold text-slate-800 shrink-0">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-[11px] text-slate-400">Belum ada lead dengan prioritas diisi.</div>
            )}
          </Card>
        </div>

        {/* Kolom 2: "CRM Sidebar" - key accounts + pipeline stages */}
        <div className="space-y-4">
          <Card className="p-5">
            <SectionTitle title="Key Accounts" action="Lihat Semua" onClick={() => onGo?.("leads")} />
            <div className="space-y-1">
              {keyAccounts.length ? keyAccounts.map(({ lead: l, active }) => (
                <button key={l.id} onClick={() => onOpenLead?.(l)} className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-slate-50">
                  <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[11px] font-bold shrink-0">{(l.name || "?").slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold text-slate-800">{l.name}</div>
                    <div className="truncate text-[9px] text-slate-400">{l.key_person || l.city || "—"}</div>
                  </div>
                  <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0", active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")}>{active ? "Aktif" : "Lead"}</span>
                </button>
              )) : <div className="py-6 text-center text-[11px] text-slate-400">Belum ada lead.</div>}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle title="Pipeline Stages" />
            <div className="space-y-3">
              {pipeline.map((s, i) => (
                <div key={s.key}>
                  <div className="flex items-center justify-between text-[10.5px] mb-1"><span className="font-semibold text-slate-600">{s.label}</span><span className="text-slate-400">{pipelineCounts[i] || 0}</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(6, ((pipelineCounts[i] || 0) / maxPipeline) * 100)}%`, background: DONUT_COLORS[i % DONUT_COLORS.length] }} /></div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Kolom 3: Upcoming Tasks */}
        <Card className="p-5">
          <SectionTitle title="Upcoming Tasks" action="Lihat Semua" onClick={() => onGo?.("visitfollowup")} />
          <div className="space-y-1">
            {taskList.length ? taskList.map((item, i) => (
              <button key={item.id} onClick={() => onOpenLead?.(item.lead)} className="w-full flex items-start gap-2.5 rounded-xl px-2 py-2.5 text-left hover:bg-slate-50">
                <div className={cn("h-5 w-5 mt-0.5 rounded-md border flex items-center justify-center shrink-0", i === 0 ? "bg-orange-600 border-orange-600 text-white" : "border-slate-300 text-transparent")}><CheckCircle2 size={12} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-slate-800">{item.title}</div>
                  <div className="truncate text-[9px] text-slate-400 flex items-center gap-1 mt-0.5"><Clock3 size={9} />{item.meta}</div>
                </div>
              </button>
            )) : <div className="py-8 text-center text-[11px] text-slate-400">Belum ada tugas.</div>}
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
