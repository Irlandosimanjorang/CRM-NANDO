import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Check } from "lucide-react";
import * as db from "../lib/db";
import AdsAnalysis from "./AdsAnalysis";
import { fmtRp } from "../lib/helpers";

// Laporan bulanan sales (9 Okt 2026, permintaan klien BSB): meniru laporan Excel mereka.
// Aktif lewat saklar organisasi "monthly_report". Pipeline = kondisi lead SEKARANG
// (SPH terlayang, hot progress); deal, omzet, dan kalender = dalam bulan yang dipilih
// (tanggal deal). Data masuk = lead yang dibuat pada bulan itu.
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ymOf = (iso) => String(iso || "").slice(0, 7);
const pct = (v, base) => (base > 0 ? `${((v / base) * 100).toFixed(2).replace(/\.00$/, "")}%` : "0%");
const num = (v) => Number(v) || 0;

export default function MonthlyReport({ leads = [], stages = [], dealTransactions = [], org, canEditTarget = false, canImport = false, onChanged }) {
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [editing, setEditing] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [year, month] = ym.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const shift = (d) => {
    const t = new Date(year, month - 1 + d, 1);
    setYm(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`);
  };

  const r = useMemo(() => {
    const keyOf = (type) => new Set(stages.filter((s) => s.type === type).map((s) => s.key));
    const wonKeys = keyOf("won"), lostKeys = keyOf("lost");
    const hasBsbFlow = stages.some((s) => s.key === "sph_terlayang") && stages.some((s) => s.key === "hot_progress");
    const val = (l) => num(l.deal_value);
    const live = leads.filter((l) => !l.deleted_at);
    const sph = live.filter((l) => l.stage_key === "sph_terlayang");
    const hot = live.filter((l) => l.stage_key === "hot_progress");
    const lost = live.filter((l) => lostKeys.has(l.stage_key) && ymOf(l.updated_at) === ym);
    const running = live.filter((l) => ["deal_kontrak", "proses_so", "pengiriman"].includes(l.stage_key));
    const masuk = live.filter((l) => ymOf(l.created_at) === ym);

    // Deal dalam bulan: transaksi di tab Deal bila ada, selain itu lead bertahap menang dengan tanggal deal.
    const txLeadIds = new Set(dealTransactions.map((t) => t.lead_id));
    const dealRows = [
      ...dealTransactions.filter((t) => ymOf(t.deal_date) === ym).map((t) => ({ date: t.deal_date, value: num(t.deal_value) })),
      ...live.filter((l) => wonKeys.has(l.stage_key) && !txLeadIds.has(l.id) && ymOf(l.deal_date) === ym).map((l) => ({ date: l.deal_date, value: val(l) })),
    ];
    const dealValue = dealRows.reduce((s, d) => s + d.value, 0);

    const sphValue = sph.reduce((s, l) => s + val(l), 0);
    const hotValue = hot.reduce((s, l) => s + val(l), 0);
    const sphAll = sphValue + hotValue + dealValue;

    const dealByDay = {}, masukByDay = {};
    for (const d of dealRows) { const day = Number(String(d.date).slice(8, 10)); if (day) dealByDay[day] = (dealByDay[day] || 0) + 1; }
    for (const l of masuk) { const day = Number(String(l.created_at).slice(8, 10)); if (day) masukByDay[day] = (masukByDay[day] || 0) + 1; }

    return {
      hasBsbFlow, masukCount: masuk.length, sphCount: sph.length, sphValue, hotCount: hot.length, hotValue, dealCount: dealRows.length, dealValue,
      lostCount: lost.length, lostValue: lost.reduce((s, l) => s + val(l), 0), sphAll,
      runningCount: running.length, runningValue: running.reduce((s, l) => s + val(l), 0), dealByDay, masukByDay,
    };
  }, [leads, stages, dealTransactions, ym]);

  const target = num(org?.monthly_target);
  const saveTarget = async () => {
    setSaving(true); setErr("");
    try {
      await db.setMonthlyTarget(Number(String(targetInput).replace(/\D/g, "")) || 0);
      setEditing(false);
      onChanged?.();
    } catch (e) { setErr(String(e?.message || e)); }
    setSaving(false);
  };

  const weeks = [[1, 7], [8, 14], [15, 21], [22, daysInMonth]];
  const th = "px-3 py-2 text-left text-[11px] font-semibold text-slate-500";
  const td = "px-3 py-2 text-[13px] text-slate-800";

  return (
    <div className="space-y-5">
    <section className="rounded-panel border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold tracking-tight text-slate-900">Laporan bulanan sales</h2>
          <p className="mt-1 text-[12px] text-slate-500">SPH dan hot progress menunjukkan kondisi sekarang. Deal, omzet, dan kalender dihitung dari tanggal deal pada bulan yang dipilih.</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Bulan sebelumnya" className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"><ChevronLeft size={16} /></button>
          <div className="min-w-[130px] text-center text-[13px] font-semibold text-slate-900">{MONTHS[month - 1]} {year}</div>
          <button type="button" onClick={() => shift(1)} aria-label="Bulan berikutnya" className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50"><ChevronRight size={16} /></button>
        </div>
      </div>

      {!r.hasBsbFlow && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">Pipeline organisasi ini belum memakai tahap SPH Terlayang dan Hot Progress, jadi angka SPH dan hot progress akan kosong.</p>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[420px] border-collapse">
          <thead className="bg-slate-50"><tr><th className={th}>Ringkasan</th><th className={`${th} text-right`}>Jumlah</th><th className={`${th} text-right`}>Nilai proyek</th><th className={`${th} text-right`}>Bobot</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            <tr><td className={td}>Data masuk bulan ini</td><td className={`${td} text-right tabular-nums`}>{r.masukCount}</td><td className={`${td} text-right`}>-</td><td className={`${td} text-right`}>-</td></tr>
            <tr><td className={td}>SPH terlayang (semua)</td><td className={`${td} text-right tabular-nums`}>{r.sphCount + r.hotCount + r.dealCount}</td><td className={`${td} text-right tabular-nums`}>{fmtRp(r.sphAll)}</td><td className={`${td} text-right tabular-nums`}>100%</td></tr>
            <tr><td className={td}>Hot progress</td><td className={`${td} text-right tabular-nums`}>{r.hotCount}</td><td className={`${td} text-right tabular-nums`}>{fmtRp(r.hotValue)}</td><td className={`${td} text-right tabular-nums`}>{pct(r.hotValue, r.sphAll)}</td></tr>
            <tr><td className={`${td} font-semibold text-blue-700`}>Deal</td><td className={`${td} text-right tabular-nums`}>{r.dealCount}</td><td className={`${td} text-right font-semibold tabular-nums text-blue-700`}>{fmtRp(r.dealValue)}</td><td className={`${td} text-right tabular-nums`}>{pct(r.dealValue, r.sphAll)}</td></tr>
            <tr><td className={td}>No deal bulan ini</td><td className={`${td} text-right tabular-nums`}>{r.lostCount}</td><td className={`${td} text-right tabular-nums`}>{fmtRp(r.lostValue)}</td><td className={`${td} text-right tabular-nums`}>{pct(r.lostValue, r.sphAll)}</td></tr>
            <tr><td className={td}>SPH belum diproses</td><td className={`${td} text-right tabular-nums`}>{r.sphCount}</td><td className={`${td} text-right tabular-nums`}>{fmtRp(r.sphValue)}</td><td className={`${td} text-right tabular-nums`}>{pct(r.sphValue, r.sphAll)}</td></tr>
            <tr><td className={td}>Proyek berjalan (kontrak, SO, pengiriman)</td><td className={`${td} text-right tabular-nums`}>{r.runningCount}</td><td className={`${td} text-right tabular-nums`}>{fmtRp(r.runningValue)}</td><td className={`${td} text-right`}>-</td></tr>
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold text-slate-500">Target omzet bulanan</div>
            {canEditTarget && !editing && (
              <button type="button" onClick={() => { setTargetInput(String(target || "")); setEditing(true); }} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800"><Pencil size={12} /> Ubah</button>
            )}
          </div>
          {editing ? (
            <div className="mt-1 flex gap-2">
              <input inputMode="numeric" autoFocus value={targetInput} onChange={(e) => setTargetInput(e.target.value.replace(/[^\d]/g, ""))} placeholder="500000000" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-[13px]" />
              <button type="button" disabled={saving} onClick={saveTarget} className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 text-[12px] font-semibold text-white disabled:opacity-60"><Check size={13} /> Simpan</button>
            </div>
          ) : (
            <div className="mt-1 text-[18px] font-bold tabular-nums text-slate-900">{target ? fmtRp(target) : "Belum diisi"}</div>
          )}
          {err && <div className="mt-1 text-[11px] text-rose-600">{err}</div>}
        </div>
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="text-[11px] font-semibold text-slate-500">Omzet tercapai bulan ini</div>
          <div className="mt-1 text-[18px] font-bold tabular-nums text-blue-700">{fmtRp(r.dealValue)}</div>
          {target > 0 && (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, (r.dealValue / target) * 100)}%` }} /></div>
              <div className="mt-1 text-[11px] text-slate-500">{pct(r.dealValue, target)} dari target</div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[12px] font-semibold text-slate-700">Kalender harian</div>
        <div className="mt-2 space-y-2">
          {weeks.map(([a, b], wi) => (
            <div key={wi} className="overflow-x-auto">
              <div className="mb-1 text-[11px] text-slate-500">Minggu ke-{wi + 1}</div>
              <div className="flex gap-1">
                {Array.from({ length: b - a + 1 }, (_, i) => a + i).map((d) => {
                  const deals = r.dealByDay[d] || 0, masuk = r.masukByDay[d] || 0;
                  return (
                    <div key={d} title={`${d} ${MONTHS[month - 1]}: ${masuk} data masuk, ${deals} deal`} className={`flex h-14 w-10 shrink-0 flex-col items-center justify-between rounded-md border py-1 ${deals ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
                      <span className="text-[11px] font-semibold tabular-nums">{d}</span>
                      <span className={`text-[10px] tabular-nums ${deals ? "text-blue-100" : "text-slate-400"}`}>{masuk ? `+${masuk}` : "·"}</span>
                      <span className="text-[10px] font-bold tabular-nums">{deals ? `${deals} deal` : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Kotak biru = ada deal pada tanggal itu. Angka +n = jumlah data masuk.</p>
      </div>
    </section>
    <AdsAnalysis leads={leads} stages={stages} org={org} ym={ym} canImport={canImport} />
    </div>
  );
}
