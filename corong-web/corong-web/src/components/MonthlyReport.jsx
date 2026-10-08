import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Check, Printer } from "lucide-react";
import * as db from "../lib/db";
import { fmtRp } from "../lib/helpers";
import { Panel, PanelHeader, StatRow, Stat, Pill, Meter, EmptyState } from "../ui";
import AdsAnalysis from "./AdsAnalysis";
import RekapLaporan from "./RekapLaporan";

// Tab Laporan (9 Okt 2026, saklar monthly_report; untuk owner dan manager). Dua tampilan:
//  - Penjualan: target omzet, kalender bulanan ala Google Calendar (deal dan data masuk per tanggal),
//    agenda hari terpilih, dan corong SPH -> hot progress -> deal.
//  - Iklan dan sumber lead: biaya iklan hasil impor disandingkan dengan lead per platform.
// Pipeline = kondisi lead SEKARANG; deal, omzet, dan kalender = tanggal deal pada bulan terpilih;
// data masuk = lead yang dibuat pada bulan itu. Warna mengikuti docs/DESIGN.md: deal = emerald,
// lead baru = brand.
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const SOURCES = ["Meta", "Instagram", "TikTok", "Google", "Customer datang", "Database", "Bu Tiara", "Migi", "Lainnya"];
const cn = (...v) => v.filter(Boolean).join(" ");
const pad = (n) => String(n).padStart(2, "0");
const ymOf = (iso) => String(iso || "").slice(0, 7);
const num = (v) => Number(v) || 0;
const pct = (v, base) => (base > 0 ? `${((v / base) * 100).toFixed(1).replace(/\.0$/, "")}%` : "0%");
// 52000000 -> "52 jt", 1250000000 -> "1,25 M", 14500 -> "14,5 rb"
function short(n) {
  const v = num(n);
  const f = (x) => String(Math.round(x * 100) / 100).replace(".", ",");
  if (v >= 1e9) return `${f(v / 1e9)} M`;
  if (v >= 1e6) return `${f(v / 1e6)} jt`;
  if (v >= 1e3) return `${f(v / 1e3)} rb`;
  return String(v);
}
const truncate = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
// Status target: bulan berjalan memakai forecast dari laju harian (baru dari hari ke-5); bulan lewat memakai hasil akhir.
// Batas: forecast >= 100% target = Aman, 80-99% = Warning, di bawah 80% = berpotensi tidak mencapai target.
const TONES = { good: "bg-emerald-50 text-emerald-700 ring-emerald-200", warn: "bg-amber-50 text-amber-800 ring-amber-200", bad: "bg-rose-50 text-rose-700 ring-rose-200", none: "bg-slate-100 text-slate-600 ring-slate-200" };
function targetStatus({ actual, target, isNow, isPast, elapsed, daysInMonth }) {
  const forecast = isNow && elapsed >= 5 && actual > 0 ? Math.round((actual / elapsed) * daysInMonth) : isPast ? actual : 0;
  if (!(target > 0)) return { forecast, tone: "none", label: "Target belum diisi" };
  if (actual >= target) return { forecast, tone: "good", label: isPast ? "Tercapai" : "Target tercapai" };
  if (isPast) return { forecast, tone: "bad", label: "Tidak tercapai" };
  if (!isNow) return { forecast, tone: "none", label: "Belum berjalan" };
  if (!forecast) return { forecast, tone: "none", label: "Belum cukup data" };
  const ratio = forecast / target;
  if (ratio >= 1) return { forecast, tone: "good", label: "Aman" };
  if (ratio >= 0.8) return { forecast, tone: "warn", label: "Warning" };
  return { forecast, tone: "bad", label: "Berpotensi tidak mencapai target" };
}
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export default function MonthlyReport({ leads: allLeads = [], stages = [], dealTransactions: allTx = [], members = [], org, canEditTarget = false, canImport = false, canManage = false, onChanged, onOpenLead }) {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [ym, setYm] = useState(todayIso.slice(0, 7));
  const [viewRaw, setView] = useState("penjualan");
  // Anggota biasa: laporan lead miliknya saja, tanpa tab Iklan dan target tim.
  const personal = !canManage;
  const view = personal && viewRaw === "iklan" ? "penjualan" : viewRaw;
  const [selected, setSelected] = useState(todayIso);
  const [memberId, setMemberId] = useState("all");
  const [editing, setEditing] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // Marketing = anggota selain owner (owner ikut bila punya lead). Owner dan manager bisa memilih satu marketing
  // untuk melihat laporannya sendiri, seperti "REPORT ASIFA" di Excel BSB; pilihan "Semua tim" untuk gabungan.
  const marketers = useMemo(() => {
    const seen = new Set(); const out = [];
    const nameOf = (id) => members.find((m) => m.user_id === id)?.display_name || "Anggota";
    for (const m of members) if (m.role !== "owner") { seen.add(m.user_id); out.push({ id: m.user_id, name: nameOf(m.user_id) }); }
    for (const l of allLeads) { const u = l.assigned_to || l.user_id; if (u && !seen.has(u)) { seen.add(u); out.push({ id: u, name: nameOf(u) }); } }
    return out;
  }, [members, allLeads]);
  const scopeId = personal ? "all" : marketers.some((m) => m.id === memberId) ? memberId : "all";
  const scopeName = marketers.find((m) => m.id === scopeId)?.name || "";
  const leads = useMemo(() => (scopeId === "all" ? allLeads : allLeads.filter((l) => (l.assigned_to || l.user_id) === scopeId)), [allLeads, scopeId]);
  const dealTransactions = useMemo(() => (scopeId === "all" ? allTx : allTx.filter((t) => t.user_id === scopeId)), [allTx, scopeId]);

  const [year, month] = ym.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const go = (d) => {
    const t = new Date(year, month - 1 + d, 1);
    setYm(`${t.getFullYear()}-${pad(t.getMonth() + 1)}`);
  };

  const r = useMemo(() => {
    const keyOf = (type) => new Set(stages.filter((s) => s.type === type).map((s) => s.key));
    const wonKeys = keyOf("won"), lostKeys = keyOf("lost");
    const hasBsbFlow = stages.some((s) => s.key === "sph_terlayang") && stages.some((s) => s.key === "hot_progress");
    const val = (l) => num(l.deal_value);
    const live = leads.filter((l) => !l.deleted_at);
    const byId = new Map(live.map((l) => [l.id, l]));
    const sph = live.filter((l) => l.stage_key === "sph_terlayang");
    const hot = live.filter((l) => l.stage_key === "hot_progress");
    const lost = live.filter((l) => lostKeys.has(l.stage_key) && ymOf(l.updated_at) === ym);
    const running = live.filter((l) => ["deal_kontrak", "proses_so", "pengiriman"].includes(l.stage_key));
    const masuk = live.filter((l) => ymOf(l.created_at) === ym);

    // Deal dalam bulan: transaksi di tab Deal bila ada, selain itu lead bertahap menang dengan tanggal deal.
    const txLeadIds = new Set(dealTransactions.map((t) => t.lead_id));
    const dealRows = [
      ...dealTransactions.filter((t) => ymOf(t.deal_date) === ym).map((t) => ({ date: t.deal_date, value: num(t.deal_value), name: t.lead_name, lead: byId.get(t.lead_id) })),
      ...live.filter((l) => wonKeys.has(l.stage_key) && !txLeadIds.has(l.id) && ymOf(l.deal_date) === ym).map((l) => ({ date: l.deal_date, value: val(l), name: l.name, lead: l })),
    ];
    const dealValue = dealRows.reduce((s, d) => s + d.value, 0);
    const sphValue = sph.reduce((s, l) => s + val(l), 0);
    const hotValue = hot.reduce((s, l) => s + val(l), 0);
    const lostValue = lost.reduce((s, l) => s + val(l), 0);
    const sphAll = sphValue + hotValue + dealValue;

    const dealsByDay = {}, masukByDay = {};
    for (const d of dealRows) (dealsByDay[String(d.date).slice(0, 10)] ||= []).push(d);
    for (const l of masuk) (masukByDay[String(l.created_at).slice(0, 10)] ||= []).push(l);

    return {
      hasBsbFlow, masuk, dealRows, sphCount: sph.length, sphValue, hotCount: hot.length, hotValue, dealValue,
      lostCount: lost.length, lostValue, sphAll, running, runningValue: running.reduce((s, l) => s + val(l), 0),
      dealsByDay, masukByDay,
    };
  }, [leads, stages, dealTransactions, ym]);

  // Omzet bulan sebelumnya pada lingkup yang sama, untuk pembanding di kartu omzet.
  const prevDeal = useMemo(() => {
    const t = new Date(year, month - 2, 1);
    const pym = `${t.getFullYear()}-${pad(t.getMonth() + 1)}`;
    const wonKeys = new Set(stages.filter((x) => x.type === "won").map((x) => x.key));
    const txLeadIds = new Set(dealTransactions.map((x) => x.lead_id));
    const live = leads.filter((l) => !l.deleted_at);
    const a = dealTransactions.filter((x) => ymOf(x.deal_date) === pym).reduce((n, x) => n + num(x.deal_value), 0);
    const b = live.filter((l) => wonKeys.has(l.stage_key) && !txLeadIds.has(l.id) && ymOf(l.deal_date) === pym).reduce((n, l) => n + num(l.deal_value), 0);
    return a + b;
  }, [leads, stages, dealTransactions, year, month]);

  // Perbandingan antar marketing (selalu dari seluruh data, tidak ikut pilihan marketing di atas).
  const team = useMemo(() => {
    const wonKeys = new Set(stages.filter((x) => x.type === "won").map((x) => x.key));
    const txLeadIds = new Set(allTx.map((t) => t.lead_id));
    return marketers.map((m) => {
      const ls = allLeads.filter((l) => !l.deleted_at && (l.assigned_to || l.user_id) === m.id);
      const txs = allTx.filter((t) => t.user_id === m.id && ymOf(t.deal_date) === ym);
      const viaLead = ls.filter((l) => wonKeys.has(l.stage_key) && !txLeadIds.has(l.id) && ymOf(l.deal_date) === ym);
      const hot = ls.filter((l) => l.stage_key === "hot_progress");
      const sph = ls.filter((l) => l.stage_key === "sph_terlayang");
      const sumV = (arr, f) => arr.reduce((t, x) => t + num(f(x)), 0);
      return {
        ...m,
        masuk: ls.filter((l) => ymOf(l.created_at) === ym).length,
        sph: sph.length, hot: hot.length, hotValue: sumV(hot, (l) => l.deal_value),
        deals: txs.length + viaLead.length,
        omzet: sumV(txs, (t) => t.deal_value) + sumV(viaLead, (l) => l.deal_value),
      };
    }).sort((a, b) => b.omzet - a.omzet);
  }, [marketers, allLeads, allTx, stages, ym]);

  // Saat pertama dibuka (atau pindah bulan) pilih hari terbaru yang punya aktivitas, bukan hari kosong.
  const [autoFor, setAutoFor] = useState("");
  useEffect(() => {
    if (autoFor === ym) return;
    const days = Object.keys({ ...r.dealsByDay, ...r.masukByDay }).filter((d) => ymOf(d) === ym && d <= (todayIso.startsWith(ym) ? todayIso : "9999")).sort();
    if (days.length === 0 && leads.length === 0) return; // data belum dimuat
    setAutoFor(ym);
    if (days.length) setSelected(days[days.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym, r]);

  // Tanggal terpilih selalu ada di bulan yang tampil (hari ini kalau bulan ini, selain itu hari pertama berisi aktivitas).
  useEffect(() => {
    if (autoFor !== ym || ymOf(selected) === ym) return;
    setSelected(todayIso.startsWith(ym) ? todayIso : `${ym}-01`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym, autoFor]);

  // Target dibaca dari sistem target tab Team (sales_targets per marketing per bulan) supaya satu sumber.
  // Target tim = jumlah target para marketing. Diubah per marketing (di sini saat satu marketing dipilih, atau di tab Team).
  const [targets, setTargets] = useState({});
  const [tTick, setTTick] = useState(0);
  useEffect(() => {
    if (personal) { setTargets({}); return undefined; }
    let alive = true;
    db.getTeamTargets(`${ym}-01`).then((rows) => { if (alive) setTargets(Object.fromEntries((rows || []).map((x) => [x.user_id, num(x.target)]))); }).catch(() => { if (alive) setTargets({}); });
    return () => { alive = false; };
  }, [ym, personal, tTick]);
  const targetOf = (uid) => num(targets[uid]);
  const target = personal ? 0 : scopeId === "all" ? marketers.reduce((s, m) => s + targetOf(m.id), 0) : targetOf(scopeId);
  const reached = target > 0 ? Math.min(100, (r.dealValue / target) * 100) : 0;
  const saveTarget = async () => {
    setSaving(true); setErr("");
    try {
      const amount = Number(String(targetInput).replace(/\D/g, "")) || 0;
      if (scopeId === "all") throw new Error("Pilih satu marketing untuk mengubah targetnya.");
      await db.setSalesTarget(scopeId, `${ym}-01`, amount);
      setTTick((x) => x + 1);
      setEditing(false);
      onChanged?.();
    } catch (e) { setErr(String(e?.message || e)); }
    setSaving(false);
  };

  // Sel kalender: minggu mulai Senin, selalu kelipatan 7.
  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const lead = (first.getDay() + 6) % 7;
    const total = Math.ceil((lead + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(year, month - 1, 1 - lead + i);
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { iso, day: d.getDate(), inMonth: d.getMonth() === month - 1, weekend: d.getDay() === 0 || d.getDay() === 6 };
    });
  }, [year, month, daysInMonth]);

  const selDeals = r.dealsByDay[selected] || [];
  const selMasuk = r.masukByDay[selected] || [];
  const selDate = new Date(`${selected}T00:00:00`);
  const sourceOf = (l) => Object.entries(l).find(([k, v]) => /^custom_field_\d+$/.test(k) && SOURCES.includes(v))?.[1] || "";
  const pick = (c) => { setSelected(c.iso); if (!c.inMonth) setYm(c.iso.slice(0, 7)); };

  // Cetak ke PDF lewat dialog cetak peramban: ringkasan omzet, pipeline, deal bulan ini, dan perbandingan marketing.
  const printReport = () => {
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const who = personal ? "Report saya" : scopeId === "all" ? "Semua tim" : scopeName;
    const deals = [...r.dealRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const rows = (arr) => arr.map((c) => `<tr>${c.map((x, i) => `<td class="${i ? "r" : ""}">${esc(x)}</td>`).join("")}</tr>`).join("");
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Report ${esc(who)} ${MONTHS[month - 1]} ${year}</title>
<style>*{box-sizing:border-box}body{font:12px/1.5 system-ui,Segoe UI,sans-serif;color:#0f172a;margin:28px}h1{font-size:20px;margin:0}h2{font-size:13px;margin:22px 0 6px}.m{color:#64748b}
.k{display:flex;gap:10px;margin-top:14px}.k div{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:10px}.k b{display:block;font-size:17px}table{width:100%;border-collapse:collapse}th,td{padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:left}th{font-size:11px;color:#64748b}.r{text-align:right;font-variant-numeric:tabular-nums}
@media print{body{margin:14mm}}</style></head><body>
<h1>Report penjualan ${esc(who)}</h1><div class="m">${esc(org?.name || "")} · ${MONTHS[month - 1]} ${year}</div>
<div class="k"><div><span class="m">Omzet</span><b>${esc(fmtRp(r.dealValue))}</b>${target > 0 ? `<span class="m">${pct(r.dealValue, target)} dari target ${esc(fmtRp(target))}</span>` : ""}</div>
<div><span class="m">Data masuk</span><b>${r.masuk.length}</b></div><div><span class="m">SPH belum diproses</span><b>${r.sphCount}</b><span class="m">${esc(fmtRp(r.sphValue))}</span></div>
<div><span class="m">Hot progress</span><b>${r.hotCount}</b><span class="m">${esc(fmtRp(r.hotValue))}</span></div><div><span class="m">Deal</span><b>${deals.length}</b></div></div>
<h2>Deal bulan ini</h2>${deals.length ? `<table><thead><tr><th>Tanggal</th><th>Nama</th><th class="r">Nilai</th></tr></thead><tbody>${rows(deals.map((d) => [String(d.date).slice(0, 10), d.name, fmtRp(d.value)]))}</tbody></table>` : '<div class="m">Belum ada deal pada bulan ini.</div>'}
${!personal && scopeId === "all" && team.length ? `<h2>Hasil per marketing</h2><table><thead><tr><th>Marketing</th><th class="r">Lead masuk</th><th class="r">SPH</th><th class="r">Hot</th><th class="r">Deal</th><th class="r">Omzet</th><th class="r">Capaian target</th></tr></thead><tbody>${rows(team.map((m) => [m.name, m.masuk, m.sph, m.hot, m.deals, fmtRp(m.omzet), targetOf(m.id) > 0 ? pct(m.omzet, targetOf(m.id)) : "-"]))}</tbody></table>` : ""}
<div class="m" style="margin-top:18px">Dicetak ${new Date().toLocaleString("id-ID")} dari Nexto.</div></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Pop-up diblokir peramban. Izinkan pop-up untuk situs ini lalu coba lagi."); return; }
    w.document.open(); w.document.write(html); w.document.close();
    w.focus(); setTimeout(() => w.print(), 300);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.03em] text-ink">{personal ? "Report saya" : "Report"}</h1>
          <p className="mt-0.5 text-[12px] text-slate-500">{view === "penjualan" ? (personal ? "Penjualan dari lead milik Anda dan kalender deal." : "Penjualan tim, target omzet, dan kalender deal.") : view === "rekap" ? "Daftar lead per tahap seperti laporan Excel." : "Biaya iklan dan lead per platform."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex rounded-full bg-slate-100 p-0.5 text-[12px] font-semibold" role="tablist" aria-label="Jenis laporan">
            {[["penjualan", "Penjualan"], ["rekap", "Rekap per tahap"], ...(personal ? [] : [["iklan", "Iklan dan sumber lead"]])].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cn("rounded-full px-3.5 py-1.5", focus, view === k ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink")}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            {view === "penjualan" && <button type="button" onClick={printReport} className={cn("mr-1 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50", focus)}><Printer size={13} /> Cetak / PDF</button>}
            <button type="button" onClick={() => setYm(todayIso.slice(0, 7))} className={cn("rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50", focus)}>Hari ini</button>
            <button type="button" onClick={() => go(-1)} aria-label="Bulan sebelumnya" className={cn("rounded-full p-1.5 text-slate-600 hover:bg-slate-100", focus)}><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => go(1)} aria-label="Bulan berikutnya" className={cn("rounded-full p-1.5 text-slate-600 hover:bg-slate-100", focus)}><ChevronRight size={18} /></button>
            <div className="min-w-[116px] font-display text-[15px] font-bold tracking-[-0.02em] text-ink">{MONTHS[month - 1]} {year}</div>
          </div>
        </div>
      </div>

      {!personal && view !== "iklan" && marketers.length > 0 && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Pilih marketing">
          {[{ id: "all", name: "Semua tim" }, ...marketers].map((m) => (
            <button key={m.id} role="tab" aria-selected={scopeId === m.id} onClick={() => setMemberId(m.id)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold", focus, scopeId === m.id ? "border-ink bg-ink text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>{m.name}</button>
          ))}
        </div>
      )}

      {view === "rekap" ? (
        <RekapLaporan leads={leads} stages={stages} dealTransactions={dealTransactions} ym={ym} orgName={scopeId === "all" ? (org?.name || "") : scopeName} target={target} personal={personal} members={members} />
      ) : view === "iklan" ? (
        <AdsAnalysis leads={allLeads} stages={stages} dealTransactions={allTx} org={org} ym={ym} canImport={canImport} onChanged={onChanged} />
      ) : (
        <>
          <Panel className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-slate-600">{personal ? "Omzet Anda bulan ini" : scopeId === "all" ? "Omzet bulan ini" : `Omzet ${scopeName} bulan ini`}</div>
                <div className="mt-1.5 font-display text-[34px] font-bold leading-none tracking-[-0.04em] tabular-nums text-emerald-600">{fmtRp(r.dealValue)}</div>
              </div>
              {!personal && (
              <div className="sm:text-right">
                {editing ? (
                  <div className="flex items-center gap-2">
                    <input inputMode="numeric" autoFocus value={targetInput} onChange={(e) => setTargetInput(e.target.value.replace(/[^\d]/g, ""))} placeholder="500000000" aria-label="Target omzet bulanan" className="w-40 rounded-inner border border-slate-300 px-3 py-1.5 text-[13px] tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand" />
                    <button type="button" disabled={saving} onClick={saveTarget} className={cn("inline-flex items-center gap-1 rounded-full bg-ink px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60", focus)}><Check size={13} /> Simpan target</button>
                  </div>
                ) : (
                  <>
                    <div className="text-[12px] text-slate-500">{scopeId === "all" ? "Target tim" : `Target ${scopeName}`} {target ? fmtRp(target) : "belum diisi"}{target > 0 && <span className="ml-1.5 font-semibold text-ink">{pct(r.dealValue, target)}</span>}</div>
                    {scopeId === "all" && marketers.length > 0 && <div className="text-[11px] text-slate-400">Jumlah target {marketers.length} marketing, diatur per orang di tab Team</div>}
                    {canEditTarget && scopeId !== "all" && (
                      <button type="button" onClick={() => { setTargetInput(String(target || "")); setEditing(true); }} className={cn("mt-1 inline-flex items-center gap-1 rounded-full text-[12px] font-semibold text-brand-strong hover:text-orange-800", focus)}><Pencil size={12} /> {target ? "Ubah target" : "Isi target"}</button>
                    )}
                  </>
                )}
                {err && <div className="mt-1 text-[11px] text-rose-600">{err}</div>}
              </div>
              )}
            </div>
            {!personal && <Meter value={reached} max={100} tone="good" className="mt-4 h-2" />}
            {(() => {
              const isNow = ym === todayIso.slice(0, 7);
              const isPast = ym < todayIso.slice(0, 7);
              const left = isNow ? daysInMonth - now.getDate() : 0;
              const gap = r.dealValue - target;
              const delta = prevDeal > 0 ? ((r.dealValue - prevDeal) / prevDeal) * 100 : null;
              const st = targetStatus({ actual: r.dealValue, target, isNow, isPast, elapsed: now.getDate(), daysInMonth });
              const need = !personal && target > 0 && gap < 0 ? (isNow && left > 0 ? `Sisa ${left} hari. Butuh ${fmtRp(Math.ceil(-gap / left))} per hari untuk mencapai target.` : isNow ? "Hari terakhir bulan ini." : "") : "";
              return (
                <>
                  {!personal && target > 0 && (
                    <div className="mt-4 rounded-inner border border-slate-100 bg-slate-50/60 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-slate-600">Target vs actual</span>
                        <span className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1", TONES[st.tone])}>{st.label}</span>
                      </div>
                      <dl className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
                        {[
                          ["Target", fmtRp(target), ""],
                          ["Actual", fmtRp(r.dealValue), "text-emerald-700"],
                          ["Achievement", pct(r.dealValue, target), ""],
                          ["Forecast", st.forecast > 0 && !isPast ? fmtRp(st.forecast) : "-", ""],
                          ["Gap ke target", gap >= 0 ? `+${fmtRp(gap)}` : `-${fmtRp(-gap)}`, gap >= 0 ? "text-emerald-700" : "text-rose-600"],
                        ].map(([k, v, c]) => (
                          <div key={k}><dt className="text-[11px] text-slate-500">{k}</dt><dd className={cn("mt-0.5 text-[14px] font-bold tabular-nums tracking-[-0.02em] text-ink", c)}>{v}</dd></div>
                        ))}
                      </dl>
                      {st.forecast > 0 && isNow && <p className="mt-2 text-[11px] text-slate-400">Forecast dari laju {now.getDate()} hari pertama bila bertahan sampai akhir bulan. Aman: forecast mencapai target, Warning: 80-99%, di bawah 80%: berpotensi tidak tercapai.</p>}
                    </div>
                  )}
                  {(need || delta !== null || prevDeal > 0) && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px] text-slate-500">
                      <span>{need}</span>
                      <span className="inline-flex items-center gap-1.5">
                        Bulan lalu <span className="font-semibold tabular-nums text-slate-700">{fmtRp(prevDeal)}</span>
                        {delta !== null && <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums", delta >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>{delta >= 0 ? "+" : ""}{delta.toFixed(0)}%</span>}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
          </Panel>

          <StatRow>
            <Stat value={r.masuk.length} label="Data masuk" hint={`Dibuat pada ${MONTHS[month - 1]}`} tone="brand" />
            <Stat value={r.sphCount} label="SPH belum diproses" hint={fmtRp(r.sphValue)} />
            <Stat value={r.hotCount} label="Hot progress" hint={fmtRp(r.hotValue)} tone="warn" />
            <Stat value={r.dealRows.length} label="Deal bulan ini" hint={fmtRp(r.dealValue)} tone="good" />
          </StatRow>

          {!r.hasBsbFlow && (
            <p className="rounded-inner bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">Pipeline organisasi ini belum memakai tahap SPH Terlayang dan Hot Progress, jadi angka SPH dan hot progress akan kosong.</p>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Panel className="overflow-hidden">
              <div className="grid grid-cols-7 border-b border-slate-200/80">
                {WEEKDAYS.map((w, i) => (
                  <div key={w} className={cn("px-2 py-1.5 text-center text-[11px] font-semibold", i >= 5 ? "text-slate-400" : "text-slate-500")}>{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 [&>*]:border-b [&>*]:border-r [&>*]:border-slate-100 [&>*:nth-child(7n)]:border-r-0">
                {cells.map((c) => {
                  const deals = r.dealsByDay[c.iso] || [];
                  const masuk = r.masukByDay[c.iso] || [];
                  const isToday = c.iso === todayIso, isSel = c.iso === selected;
                  const chips = [
                    ...deals.slice(0, 1).map((d, i) => ({ k: `d${i}`, tone: "deal", text: `${truncate(d.name, 14)} · ${short(d.value)}` })),
                    ...(masuk.length ? [{ k: "m", tone: "masuk", text: `${masuk.length} data masuk` }] : []),
                  ];
                  const hidden = deals.length - Math.min(1, deals.length);
                  return (
                    <div
                      key={c.iso}
                      role="button"
                      tabIndex={0}
                      aria-label={`${c.day} ${MONTHS[Number(c.iso.slice(5, 7)) - 1]}: ${deals.length} deal, ${masuk.length} data masuk`}
                      aria-pressed={isSel}
                      onClick={() => pick(c)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c); } }}
                      className={cn("min-h-[48px] cursor-pointer p-1 text-left outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand sm:min-h-[72px]", c.weekend && "bg-slate-50/60", isSel ? "bg-brand-soft/60" : "hover:bg-slate-50")}
                    >
                      <div className="flex justify-center sm:justify-start">
                        <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums", isToday ? "bg-brand-strong text-white" : c.inMonth ? "text-ink" : "text-slate-300")}>{c.day}</span>
                      </div>
                      {c.inMonth && (
                        <>
                          <div className="mt-0.5 hidden space-y-px sm:block">
                            {chips.map((ch) => (
                              <div key={ch.k} className={cn("truncate rounded-[4px] px-1.5 text-[10px] font-semibold leading-[15px]", ch.tone === "deal" ? "bg-emerald-600 text-white" : "bg-brand-soft text-brand-strong")}>{ch.text}</div>
                            ))}
                            {hidden > 0 && <div className="px-1.5 text-[10px] font-medium leading-3 text-slate-500">+{hidden} deal lagi</div>}
                          </div>
                          <div className="mt-1 flex justify-center gap-0.5 sm:hidden">
                            {deals.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                            {masuk.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-200/80 px-4 py-2.5 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-600" /> Deal (nama dan nilai)</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand" /> Data masuk</span>
                <span>Klik tanggal untuk melihat rinciannya.</span>
              </div>
            </Panel>

            <div className="space-y-4">
              <Panel className="p-5">
                <PanelHeader title={`${DAYS_LONG[selDate.getDay()]}, ${selDate.getDate()} ${MONTHS[selDate.getMonth()]}`} meta={`${selDeals.length} deal, ${selMasuk.length} data masuk`} />
                {selDeals.length === 0 && selMasuk.length === 0 ? (
                  <div className="mt-3"><EmptyState>Tidak ada aktivitas pada tanggal ini. Deal dan data masuk tim muncul di sini otomatis.</EmptyState></div>
                ) : (
                  <div className="mt-3 divide-y divide-slate-100">
                    {selDeals.map((d, i) => (
                      <button key={`d${i}`} type="button" disabled={!d.lead} onClick={() => d.lead && onOpenLead?.(d.lead)} className={cn("flex w-full items-center justify-between gap-3 py-2.5 text-left disabled:cursor-default", focus)}>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-ink">{d.name}</span>
                          <span className="block text-[11px] text-slate-500">{d.lead?.company_type || "Deal"}</span>
                        </span>
                        <Pill tone="good" className="shrink-0 tabular-nums">{short(d.value)}</Pill>
                      </button>
                    ))}
                    {selMasuk.map((l) => (
                      <button key={l.id} type="button" onClick={() => onOpenLead?.(l)} className={cn("flex w-full items-center justify-between gap-3 py-2.5 text-left", focus)}>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold text-ink">{l.name}</span>
                          <span className="block text-[11px] text-slate-500">{[l.company_type, l.city].filter(Boolean).join(" · ") || "Data masuk"}</span>
                        </span>
                        {sourceOf(l) && <Pill tone="brand" className="shrink-0">{sourceOf(l)}</Pill>}
                      </button>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>

          {!personal && scopeId === "all" && team.length > 0 && (
            <Panel className="overflow-hidden">
              <div className="px-5 pb-1 pt-4"><PanelHeader title="Hasil per marketing" meta={`Pipeline dan omzet ${MONTHS[month - 1]}. Target, forecast, dan aktivitas tiap orang ada di tab Team. Klik nama untuk membuka report-nya.`} /></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                      <th className="px-5 py-2.5 text-left">Marketing</th><th className="px-3 py-2.5 text-right">Lead masuk</th><th className="px-3 py-2.5 text-right">SPH belum diproses</th><th className="px-3 py-2.5 text-right">Hot progress</th><th className="px-3 py-2.5 text-right">Deal</th><th className="px-3 py-2.5 text-right">Omzet</th><th className="px-3 py-2.5 text-right">Capaian target</th><th className="px-3 py-2.5 text-left">Status</th><th className="w-[200px] px-5 py-2.5 text-left">Kontribusi omzet tim</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {team.map((m) => {
                      const totalOmzet = team.reduce((t, x) => t + x.omzet, 0);
                      return (
                        <tr key={m.id}>
                          <td className="px-5 py-2.5"><button type="button" onClick={() => setMemberId(m.id)} className={cn("text-[12.5px] font-semibold text-ink hover:text-brand-strong", focus)}>{m.name}</button></td>
                          <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums">{m.masuk}</td>
                          <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums">{m.sph}</td>
                          <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums">{m.hot}{m.hot > 0 && <span className="ml-1 text-slate-400">({short(m.hotValue)})</span>}</td>
                          <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums">{m.deals}</td>
                          <td className="px-3 py-2.5 text-right text-[12.5px] font-semibold tabular-nums text-emerald-700">{fmtRp(m.omzet)}</td>
                          <td className="px-3 py-2.5 text-right text-[12.5px] tabular-nums">{targetOf(m.id) > 0 ? <span className={m.omzet >= targetOf(m.id) ? "font-semibold text-emerald-700" : "text-slate-700"}>{pct(m.omzet, targetOf(m.id))}</span> : <span className="text-slate-400">-</span>}</td>
                          <td className="px-3 py-2.5">{(() => { const st = targetStatus({ actual: m.omzet, target: targetOf(m.id), isNow: ym === todayIso.slice(0, 7), isPast: ym < todayIso.slice(0, 7), elapsed: now.getDate(), daysInMonth }); return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", TONES[st.tone])}>{st.label === "Berpotensi tidak mencapai target" ? "Berisiko" : st.label}</span>; })()}</td>
                          <td className="px-5 py-2.5">
                            {totalOmzet > 0 ? (
                              <div className="flex items-center gap-2">
                                <Meter value={(m.omzet / totalOmzet) * 100} max={100} tone="good" className="h-1.5 flex-1" />
                                <span className="w-12 text-right text-[12px] tabular-nums text-slate-600">{pct(m.omzet, totalOmzet)}</span>
                              </div>
                            ) : <span className="text-[12px] text-slate-400">-</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
