import React, { useMemo, useEffect, useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { NextoRobotHead } from "../Auth";
import * as db from "../lib/db";
import CompanyPerformanceCard from "../components/CompanyPerformanceCard";
import { Panel, PanelHeader, Stat, StatRow, Pill, Meter, EmptyState } from "../ui";
import { todayISO } from "../lib/helpers";

const cn = (...v) => v.filter(Boolean).join(" ");

function sameDay(value) {
  if (!value) return false;
  const d = new Date(`${value}T00:00:00`);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export default function Dashboard({
  leads = [],
  stages = [],
  dealTransactions = [],
  settings = {},
  onGo,
  onOpenLead,
  isEnterprise = false,
  canManage = false,
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

  // BUG FIX (audit 16 Sep 2026): time/title sebelumnya ngecek `l.visit_date`
  // ADA-GAKNYA doang, bukan `sameDay(l.visit_date)` - padahal lead bisa
  // masuk list ini murni gara-gara punya next_action, dengan visit_date yang
  // tanggalnya jauh ke depan (atau udah lewat). Akibatnya lead kayak gitu
  // kelabelin "Hari ini · Visit - [nama]" padahal gak ada kunjungan hari
  // ini sama sekali - nyasarin prioritas kerja user.
  const todayTasks = useMemo(() => {
    const items = leads.filter(l => l.next_action || sameDay(l.visit_date)).slice(0, 4);
    return items.map((l, i) => {
      const visitToday = sameDay(l.visit_date);
      return {
        lead: l,
        time: visitToday ? "Hari ini" : i === 0 ? "Prioritas" : "Follow-up",
        title: visitToday ? `Visit - ${l.name}` : String(l.next_action || "Follow-up lead"),
        sub: l.city || l.key_person || "Lead aktif",
      };
    });
  }, [leads]);

  // BUG FIX (audit 16 Sep 2026): sebelumnya gak nyaring tanggal - kunjungan
  // yang udah LEWAT bisa ikut nongol di sini dan kelabelin "Terjadwal" di
  // kartu Upcoming Tasks, padahal harusnya cuma yang hari ini/ke depan.
  // BUG FIX (audit 16 Sep 2026): "hari ini" sebelumnya dihitung pakai
  // `new Date().toISOString()` (UTC) - buat user WIB (UTC+7), jam 00:00-06:59
  // lokal itu masih "kemarin" di UTC, jadi kunjungan yang udah lewat bisa
  // balik nongol di sini. Diganti ke todayISO() (helpers.js) yang emang
  // udah bener pakai tanggal LOKAL.
  const upcoming = useMemo(() => {
    const todayStr = todayISO();
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

  // Skor Kualitas Memori - fetch TERPISAH dari advisorRun (16 Sep 2026,
  // permintaan Nando: mesin AI sendiri, cron sendiri, gak nebeng jadwal AI
  // Advisor - lihat edge function memory-health-check).
  const [memoryHealth, setMemoryHealth] = useState(null);
  useEffect(() => {
    db.getMemoryHealth().then(setMemoryHealth).catch(() => setMemoryHealth(null));
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

  // Donut "Kedalaman Riwayat Lead" (16 Sep 2026, ganti lagi dari "Minat Lead
  // AI") - customer_state.interest cuma keisi buat lead yang udah dianalisis
  // AI (Professional+), jadi Standard gak pernah liat apa-apa di kartu ini.
  // Diganti ke jumlah progress notes per lead (0 / 1-2 / 3+) - data yang
  // SELALU ada apapun plan-nya (progressLog udah include di getLeads()),
  // dan langsung nunjukin lead mana yang histori-nya masih tipis (AI-nya
  // "belum kenal baik" lead itu - Draft Follow-up/Poin Diskusi/dst mikir
  // dari histori catatan ini).
  const PRIORITY_COLORS = { rich: "#10b981", some: "#d97706", empty: "#94a3b8" };
  const priorityData = useMemo(() => {
    const active = leads.filter(l => !stats.wonKeys.includes(l.stage_key));
    const bucket = (l) => {
      const n = (l.progressLog || l.progress_notes || []).length;
      if (n >= 3) return "rich";
      if (n >= 1) return "some";
      return "empty";
    };
    const order = [["rich", "3+ catatan"], ["some", "1-2 catatan"], ["empty", "Belum ada catatan"]];
    return order
      .map(([key, label]) => ({ key, name: label, value: active.filter(l => bucket(l) === key).length, color: PRIORITY_COLORS[key] }))
      .filter(d => d.value > 0);
  }, [leads, stats.wonKeys]);

  // "Kualitas Memori Nexto" - REVISI FINAL (16 Sep 2026): skornya beneran
  // dinilai AI (bukan rumus), DAN dijalanin sebagai mesin sendiri (edge
  // function + cron memory-health-check TERPISAH dari daily-digest) - baca
  // dari memoryHealth (state di atas), BUKAN dari advisorRun lagi.
  const memoryScore = memoryHealth?.score;
  const memoryLabel = memoryHealth?.label;

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
      combined.push({ id: t.lead.id, lead: t.lead, title: t.title, tag: t.time, sub: t.sub });
    });
    upcoming.forEach(l => {
      if (seen.has(l.id)) return;
      seen.add(l.id);
      combined.push({ id: l.id, lead: l, title: `Visit - ${l.name}`, tag: "Terjadwal", sub: new Date(`${l.visit_date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }) });
    });
    return combined.slice(0, 6);
  }, [todayTasks, upcoming]);

  // Greeting ngikutin jam beneran (16 Sep 2026, permintaan Nando -
  // sebelumnya hardcode "Good morning" terus walau udah siang/malam), pola
  // sama kayak buildGreetingText() di daily-digest.ts (email). Plus tanggal
  // kecil di bawah heading kayak versi sebelumnya.
  const hourNow = new Date().getHours();
  const greeting = hourNow < 11 ? "Good morning" : hourNow < 18 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const nextVisit = upcoming[0];
  const depthTotal = priorityData.reduce((s, d) => s + d.value, 0);
  const TASK_TONE = { "Hari ini": "brand", Prioritas: "warn", Terjadwal: "neutral", "Follow-up": "neutral" };

  return (
    <div className="space-y-5">
      {/* Kepala halaman */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] md:text-[32px] leading-tight font-bold tracking-[-0.045em] text-ink">{greeting}, {displayName}</h1>
          <p className="mt-1 text-[13px] text-slate-500">{todayLabel} · Fokus pada follow-up yang paling berpeluang menghasilkan deal.</p>
        </div>
        {/* Label tulisan tangan (18 Sep 2026, permintaan Nando). Tanda seru
            ganda dihapus (30 Sep 2026, aturan desain docs/DESIGN.md). */}
        <div
          className="hidden lg:block shrink-0 mt-1 -rotate-3 select-none pointer-events-none text-[26px] leading-none text-blue-600/80"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          Always know what's next.
        </div>
      </div>

      {/* Performa Perusahaan - khusus sales_rep Enterprise (30 Sep 2026,
          permintaan calon klien "Sales bisa lihat dashboard perusahaan
          secara umum"). Ditaruh paling atas biar keliatan tiap buka app. */}
      {isEnterprise && !canManage && <CompanyPerformanceCard />}

      {/* NEX AI - satu-satunya permukaan gelap di Dashboard (titik fokus).
          Ungu = warna khusus AI. */}
      <section className="overflow-hidden rounded-panel border border-slate-800 bg-slate-950 text-white">
        <div className="p-5 bg-[radial-gradient(circle_at_88%_0%,rgba(109,93,252,.38),transparent_40%)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <NextoRobotHead size={44} />
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[.18em] text-violet-300">NEX AI</div>
                <h2 className="mt-1 text-[16px] font-bold tracking-tight">Rekomendasi hari ini</h2>
                <p className="mt-1 text-[12px] leading-5 text-slate-400">{aiRecs.length > 1 ? `${aiRecs.length} lead paling potensial untuk di-follow-up hari ini.` : "Tambahkan lead baru agar AI dapat menemukan prioritas."}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => onGo?.("advisor")} className="rounded-inner bg-white text-slate-950 py-2.5 px-4 text-[12px] font-bold hover:bg-slate-100 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Buka NEX AI Advisor <ArrowRight size={14} /></button>
              {aiRecs.length > 0 && (
                <button
                  onClick={() => setRecsOpen((v) => !v)}
                  aria-expanded={recsOpen}
                  aria-label={recsOpen ? "Sembunyikan daftar" : "Tampilkan daftar"}
                  className="h-10 w-10 rounded-inner bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors"
                >
                  <ChevronDown size={16} className={`transition-transform duration-200 ${recsOpen ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </div>

          {aiRecs.length > 0 && recsOpen && (
            <ol className="mt-4 pt-4 border-t border-white/10 grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {aiRecs.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[12px] leading-5 min-w-0">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-400/20 text-[9.5px] font-bold text-violet-200 tabular-nums">{i + 1}</span>
                  <div className="min-w-0"><span className="font-semibold text-white">{r.name}</span><span className="text-slate-400"> - {r.action}</span></div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      {/* Angka utama - satu panel dengan garis pemisah, bukan 4 kartu. */}
      <StatRow>
        <Stat value={stats.total} label="Total lead" hint={`${stats.won} menang, ${stats.lost} kalah`} />
        <Stat value={stats.followups} label="Perlu follow-up" hint="Lead dengan langkah berikutnya" tone={stats.followups ? "brand" : "ink"} />
        <Stat value={stats.visits} label="Kunjungan hari ini" hint={nextVisit ? `Berikutnya: ${nextVisit.name}` : "Belum ada jadwal kunjungan"} />
        <Stat value={stats.won} label="Deal menang" hint={`Win rate ${stats.winRate}%`} tone={stats.won ? "good" : "ink"} />
      </StatRow>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-5">
        {/* Kolom kiri: tren + kedalaman riwayat */}
        <div className="space-y-5 min-w-0">
          <Panel className="p-5">
            <PanelHeader title="Tren lead & deal" meta="6 bulan terakhir"
              right={(
                <div className="flex items-center gap-4 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" />Lead baru</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Deal menang</span>
                </div>
              )} />
            <div className="mt-4 h-44 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="nextoLeadsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="nextoDealsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#eef2f7" />
                  <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10.5, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} width={24} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} labelStyle={{ fontWeight: 700, color: "#0f172a" }} />
                  <Area type="monotone" dataKey="leads" name="Lead baru" stroke="#f97316" strokeWidth={2} fill="url(#nextoLeadsGrad)" />
                  <Area type="monotone" dataKey="deals" name="Deal menang" stroke="#10b981" strokeWidth={2} fill="url(#nextoDealsGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel className="p-5">
            <PanelHeader title="Kedalaman riwayat lead" meta="Makin banyak catatan, makin tepat saran AI untuk lead tersebut" action="Lihat lead" onAction={() => onGo?.("leads")} />
            {depthTotal > 0 ? (
              <div className="mt-4">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  {priorityData.map((d) => <div key={d.key} style={{ width: `${(d.value / depthTotal) * 100}%`, background: d.color }} />)}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {priorityData.map((d) => (
                    <div key={d.key} className="flex items-baseline gap-2">
                      <span className="h-2 w-2 shrink-0 translate-y-[-1px] rounded-full" style={{ background: d.color }} />
                      <span className="font-display text-[18px] font-bold tabular-nums text-ink">{d.value}</span>
                      <span className="truncate text-[11.5px] text-slate-500">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4"><EmptyState>Belum ada catatan progress. Tambahkan catatan setelah menghubungi lead agar AI mengenal riwayatnya.</EmptyState></div>
            )}

            {/* Skor Kualitas Memori - dinilai AI (edge function
                memory-health-check), ditampilkan apa adanya. */}
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <div>
                <div className="text-[12px] font-semibold text-slate-700">Skor kualitas memori</div>
                <div className="text-[11px] text-slate-400">Dinilai AI dari kelengkapan data lead</div>
              </div>
              {typeof memoryScore === "number" ? (
                <span className="flex items-baseline gap-1.5">
                  <span className={cn(
                    "font-display text-[22px] font-bold leading-none tabular-nums",
                    memoryScore >= 70 ? "text-emerald-600" : memoryScore >= 40 ? "text-amber-600" : "text-rose-600"
                  )}>{memoryScore}%</span>
                  {memoryLabel && <span className="text-[11px] font-semibold text-slate-400">{memoryLabel}</span>}
                </span>
              ) : (
                <Pill>Belum dinilai</Pill>
              )}
            </div>
          </Panel>
        </div>

        {/* Kolom kanan: yang bisa langsung dikerjakan */}
        <div className="space-y-5 min-w-0">
          <Panel className="p-5">
            <PanelHeader title="Tugas terdekat" action="Lihat semua" onAction={() => onGo?.("visitfollowup")} />
            {taskList.length ? (
              <ul className="mt-3 -mx-2 divide-y divide-slate-100">
                {taskList.map((item) => (
                  <li key={item.id}>
                    <button onClick={() => onOpenLead?.(item.lead)} className="w-full rounded-inner px-2 py-2.5 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 text-[12.5px] font-semibold leading-snug text-slate-800 line-clamp-2">{item.title}</div>
                        <Pill tone={TASK_TONE[item.tag] || "neutral"}>{item.tag}</Pill>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-slate-400">{item.sub}</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3"><EmptyState action="Buka Visit & Follow-up" onAction={() => onGo?.("visitfollowup")}>Belum ada tugas. Isi langkah berikutnya atau jadwal kunjungan di lead agar muncul di sini.</EmptyState></div>
            )}
          </Panel>

          <Panel className="p-5">
            <PanelHeader title="Lead prioritas" action="Lihat semua" onAction={() => onGo?.("leads")} />
            {keyAccounts.length ? (
              <ul className="mt-3 -mx-2">
                {keyAccounts.map(({ lead: l, active }) => (
                  <li key={l.id}>
                    <button onClick={() => onOpenLead?.(l)} className="w-full flex items-center gap-3 rounded-inner px-2 py-2 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                      <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0">{(l.name || "?").slice(0, 2).toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold text-slate-800">{l.name}</div>
                        <div className="truncate text-[11px] text-slate-400">{l.key_person || l.city || "-"}</div>
                      </div>
                      <Pill tone={active ? "good" : "neutral"}>{active ? "Aktif" : "Lead"}</Pill>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3"><EmptyState action="Tambah lead" onAction={() => onGo?.("leads")}>Belum ada lead.</EmptyState></div>
            )}

            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="text-[12px] font-semibold text-slate-700">Tahap pipeline</div>
              <div className="mt-3 space-y-2.5">
                {pipeline.map((s, i) => (
                  <div key={s.key}>
                    <div className="mb-1 flex items-center justify-between text-[11.5px]"><span className="text-slate-600">{s.label}</span><span className="font-semibold tabular-nums text-slate-800">{pipelineCounts[i] || 0}</span></div>
                    <Meter value={pipelineCounts[i] || 0} max={maxPipeline} tone={s.type === "won" ? "good" : "brand"} />
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>

      {/* (30 Sep 2026) Performa Team ada di tab "Team" (owner/manager
          Enterprise) - Dashboard cukup nampilin pintasan ke sana. */}
      {isEnterprise && canManage && (
        <Panel as="button" onClick={() => onGo?.("team")} className="w-full px-5 py-4 flex items-center gap-3 text-left hover:border-brand-line transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-bold text-ink">Rekap aktivitas & performa team</div>
            <div className="text-[11.5px] text-slate-500">Kunjungan, notulen, target, dan kontrak setiap sales ada di tab Team.</div>
          </div>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-strong">Buka tab Team <ArrowRight size={13} /></span>
        </Panel>
      )}

      <p className="pb-2 text-center text-[11.5px] text-slate-400">"Discipline in follow-up creates freedom in revenue." - Nexto</p>
    </div>
  );
}
