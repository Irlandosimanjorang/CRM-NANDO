import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Check } from "lucide-react";
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
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

export default function MonthlyReport({ leads = [], stages = [], dealTransactions = [], org, canEditTarget = false, canImport = false, canManage = false, onChanged, onOpenLead }) {
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [ym, setYm] = useState(todayIso.slice(0, 7));
  const [viewRaw, setView] = useState("penjualan");
  // Anggota biasa: laporan lead miliknya saja, tanpa tab Iklan dan target tim.
  const personal = !canManage;
  const view = personal && viewRaw === "iklan" ? "penjualan" : viewRaw;
  const [selected, setSelected] = useState(todayIso);
  const [editing, setEditing] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

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

  const target = num(org?.monthly_target);
  const reached = target > 0 ? Math.min(100, (r.dealValue / target) * 100) : 0;
  const saveTarget = async () => {
    setSaving(true); setErr("");
    try {
      await db.setMonthlyTarget(Number(String(targetInput).replace(/\D/g, "")) || 0);
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-bold tracking-[-0.03em] text-ink">{personal ? "Laporan saya" : "Laporan"}</h1>
          <p className="mt-0.5 text-[12px] text-slate-500">{view === "penjualan" ? (personal ? "Penjualan dari lead milik Anda dan kalender deal." : "Penjualan tim, target omzet, dan kalender deal.") : view === "rekap" ? "Daftar lead per tahap seperti laporan Excel." : "Biaya iklan dan lead per platform."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex rounded-full bg-slate-100 p-0.5 text-[12px] font-semibold" role="tablist" aria-label="Jenis laporan">
            {[["penjualan", "Penjualan"], ["rekap", "Rekap per tahap"], ...(personal ? [] : [["iklan", "Iklan dan sumber lead"]])].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cn("rounded-full px-3.5 py-1.5", focus, view === k ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink")}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setYm(todayIso.slice(0, 7))} className={cn("rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50", focus)}>Hari ini</button>
            <button type="button" onClick={() => go(-1)} aria-label="Bulan sebelumnya" className={cn("rounded-full p-1.5 text-slate-600 hover:bg-slate-100", focus)}><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => go(1)} aria-label="Bulan berikutnya" className={cn("rounded-full p-1.5 text-slate-600 hover:bg-slate-100", focus)}><ChevronRight size={18} /></button>
            <div className="min-w-[116px] font-display text-[15px] font-bold tracking-[-0.02em] text-ink">{MONTHS[month - 1]} {year}</div>
          </div>
        </div>
      </div>

      {view === "rekap" ? (
        <RekapLaporan leads={leads} stages={stages} dealTransactions={dealTransactions} ym={ym} orgName={org?.name || ""} target={personal ? 0 : num(org?.monthly_target)} personal={personal} />
      ) : view === "iklan" ? (
        <AdsAnalysis leads={leads} stages={stages} org={org} ym={ym} canImport={canImport} onChanged={onChanged} />
      ) : (
        <>
          <Panel className="p-5">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-slate-600">{personal ? "Omzet Anda bulan ini" : "Omzet bulan ini"}</div>
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
                    <div className="text-[12px] text-slate-500">Target {target ? fmtRp(target) : "belum diisi"}{target > 0 && <span className="ml-1.5 font-semibold text-ink">{pct(r.dealValue, target)}</span>}</div>
                    {canEditTarget && (
                      <button type="button" onClick={() => { setTargetInput(String(target || "")); setEditing(true); }} className={cn("mt-1 inline-flex items-center gap-1 rounded-full text-[12px] font-semibold text-brand-strong hover:text-orange-800", focus)}><Pencil size={12} /> {target ? "Ubah target" : "Isi target"}</button>
                    )}
                  </>
                )}
                {err && <div className="mt-1 text-[11px] text-rose-600">{err}</div>}
              </div>
              )}
            </div>
            {!personal && <Meter value={reached} max={100} tone="good" className="mt-4 h-2" />}
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
        </>
      )}
    </div>
  );
}
