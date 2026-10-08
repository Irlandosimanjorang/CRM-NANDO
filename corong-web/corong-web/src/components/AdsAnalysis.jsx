import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Upload, Trash2 } from "lucide-react";
import * as db from "../lib/db";
import { fmtRp } from "../lib/helpers";
import { getCustomFieldSlots } from "../lib/industryTemplates";
import { normalizePlatform } from "../lib/adsImport";
import AdsImportModal from "./AdsImportModal";

// Analisis iklan di tab Laporan (9 Okt 2026): biaya iklan hasil impor (Meta/TikTok/Google) disandingkan
// dengan lead di Nexto per sumber. Lead dihitung dari yang DIBUAT pada bulan terpilih, platform dibaca
// dari isian "Sumber lead" di lead. Deal = lead tersebut yang sudah masuk tahap menang.
const COLORS = { Meta: "#2563eb", Instagram: "#db2777", TikTok: "#0f172a", Google: "#16a34a", "Tidak diisi": "#94a3b8" };
const EXTRA = ["#f97316", "#a855f7", "#0d9488", "#eab308", "#64748b", "#ef4444"];
const num = (v) => Number(v) || 0;
const int = (v) => num(v).toLocaleString("id-ID");
const safeDiv = (a, b) => (b > 0 ? a / b : null);
const rpOrDash = (v) => (v === null ? "-" : fmtRp(Math.round(v)));

export default function AdsAnalysis({ leads = [], stages = [], org, ym, canImport, onChanged }) {
  const [year, month] = ym.split("-").map(Number);
  const from = `${ym}-01`;
  const to = `${ym}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  const [ads, setAds] = useState([]);
  const [loadErr, setLoadErr] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [tick, setTick] = useState(0);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    db.listAdSpend(from, to).then((r) => { if (alive) { setAds(r); setLoadErr(""); } }).catch((e) => { if (alive) { setAds([]); setLoadErr(String(e?.message || e)); } });
    return () => { alive = false; };
  }, [from, to, tick]);

  const a = useMemo(() => {
    const slot = getCustomFieldSlots(org?.industry, org?.custom_field_labels).find((s) => /sumber/i.test(s.label));
    const sourceOf = (l) => normalizePlatform((slot ? l[slot.key] : "") || l.source || "") || "Tidak diisi";
    const wonKeys = new Set(stages.filter((s) => s.type === "won").map((s) => s.key));
    const cohort = leads.filter((l) => !l.deleted_at && String(l.created_at || "").slice(0, 7) === ym);

    const by = new Map();
    const row = (p) => { if (!by.has(p)) by.set(p, { platform: p, spend: 0, impressions: 0, clicks: 0, reported: 0, leads: 0, deals: 0, value: 0 }); return by.get(p); };
    for (const r of ads) { const x = row(normalizePlatform(r.platform) || "Lainnya"); x.spend += num(r.spend); x.impressions += num(r.impressions); x.clicks += num(r.clicks); x.reported += num(r.results); }
    for (const l of cohort) {
      const x = row(sourceOf(l));
      x.leads += 1;
      if (wonKeys.has(l.stage_key)) { x.deals += 1; x.value += num(l.deal_value); }
    }
    const rows = [...by.values()].sort((p, q) => q.spend - p.spend || q.leads - p.leads);
    const adRows = rows.filter((r) => r.spend > 0);
    const tot = adRows.reduce((t, r) => ({ spend: t.spend + r.spend, leads: t.leads + r.leads, deals: t.deals + r.deals, value: t.value + r.value, clicks: t.clicks + r.clicks, impressions: t.impressions + r.impressions }), { spend: 0, leads: 0, deals: 0, value: 0, clicks: 0, impressions: 0 });

    const camp = new Map();
    for (const r of ads) {
      const k = `${normalizePlatform(r.platform)}|${r.campaign}`;
      const c = camp.get(k) || { platform: normalizePlatform(r.platform), campaign: r.campaign || "(tanpa nama)", spend: 0, clicks: 0, reported: 0 };
      c.spend += num(r.spend); c.clicks += num(r.clicks); c.reported += num(r.results);
      camp.set(k, c);
    }
    const campaigns = [...camp.values()].sort((p, q) => q.spend - p.spend).slice(0, 8);

    const insights = [];
    const withLeads = adRows.filter((r) => r.leads > 0);
    if (withLeads.length > 1) {
      const best = [...withLeads].sort((p, q) => p.spend / p.leads - q.spend / q.leads)[0];
      insights.push(`Biaya per lead paling murah: ${best.platform} (${fmtRp(Math.round(best.spend / best.leads))}).`);
    }
    const withDeals = adRows.filter((r) => r.deals > 0 && r.spend > 0);
    if (withDeals.length) {
      const best = [...withDeals].sort((p, q) => q.value / q.spend - p.value / p.spend)[0];
      insights.push(`Omzet terbesar per rupiah iklan: ${best.platform} (${(best.value / best.spend).toFixed(1)}x dari biaya).`);
    }
    for (const r of adRows.filter((x) => x.leads === 0)) insights.push(`${r.platform}: biaya ${fmtRp(Math.round(r.spend))} tetapi belum ada lead dengan sumber ini di Nexto. Pastikan sales mengisi "Sumber lead".`);
    return { slot, rows, adRows, tot, campaigns, insights, cohortCount: cohort.length, noSource: cohort.filter((l) => sourceOf(l) === "Tidak diisi").length };
  }, [ads, leads, stages, org, ym]);

  const colorOf = (p, i) => COLORS[p] || EXTRA[i % EXTRA.length];
  const leadPie = a.rows.filter((r) => r.leads > 0).map((r) => ({ name: r.platform, value: r.leads }));
  const spendPie = a.adRows.map((r) => ({ name: r.platform, value: Math.round(r.spend) }));
  const hasAds = ads.length > 0;

  const wipe = async () => {
    if (!window.confirm(`Hapus semua data iklan bulan ini (${from} sampai ${to})? Data lead tidak ikut terhapus.`)) return;
    try { await db.deleteAdSpendRange(from, to); setTick((t) => t + 1); } catch (e) { alert(String(e?.message || e)); }
  };

  const th = "px-3 py-2 text-right text-[11px] font-semibold text-slate-500 whitespace-nowrap";
  const td = "px-3 py-2 text-right text-[12.5px] tabular-nums text-slate-800 whitespace-nowrap";

  const PieBlock = ({ title, data, money }) => (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="text-[12px] font-semibold text-slate-700">{title}</div>
      {data.length === 0 ? <div className="py-10 text-center text-[12px] text-slate-400">Belum ada data</div> : (
        <div className="mt-1 flex flex-col items-center gap-2 sm:flex-row">
          <div className="h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={34} outerRadius={64} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {data.map((d, i) => <Cell key={d.name} fill={colorOf(d.name, i)} />)}
                </Pie>
                <Tooltip formatter={(v) => (money ? fmtRp(v) : `${v} lead`)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-1 text-[12px]">
            {data.map((d, i) => {
              const total = data.reduce((s, x) => s + x.value, 0);
              return (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-slate-700"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(d.name, i) }} />{d.name}</span>
                  <span className="tabular-nums text-slate-600">{money ? fmtRp(d.value) : d.value} <span className="text-slate-400">({Math.round((d.value / total) * 100)}%)</span></span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <section className="rounded-panel border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold tracking-tight text-slate-900">Iklan dan sumber lead</h2>
          <p className="mt-1 text-[12px] text-slate-500">Biaya iklan dari file Meta, TikTok, atau Google, dibandingkan dengan lead dan deal di Nexto per sumber. Lead dihitung dari yang dibuat pada bulan ini.</p>
        </div>
        {canImport && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowImport(true)} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white hover:bg-slate-800"><Upload size={14} /> Impor data iklan</button>
            {hasAds && <button type="button" onClick={wipe} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-[12px] text-slate-600 hover:bg-slate-50" title="Hapus data iklan bulan ini"><Trash2 size={14} /></button>}
          </div>
        )}
      </div>

      {notice && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800">{notice}</p>}
      {loadErr && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">Data iklan tidak dapat dimuat: {loadErr}</p>}
      {!a.slot && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">Pipeline organisasi ini belum punya isian "Sumber lead", jadi platform lead dibaca dari kolom sumber bawaan.</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Biaya iklan", fmtRp(Math.round(a.tot.spend)), null],
          ["Lead dari iklan", int(a.tot.leads), `Biaya per lead ${rpOrDash(safeDiv(a.tot.spend, a.tot.leads))}`],
          ["Deal dari iklan", int(a.tot.deals), `Biaya per deal ${rpOrDash(safeDiv(a.tot.spend, a.tot.deals))}`],
          ["Omzet dari iklan", fmtRp(Math.round(a.tot.value)), a.tot.spend > 0 ? `ROAS ${a.tot.value > 0 ? (a.tot.value / a.tot.spend).toFixed(1) : "0"}x` : null],
        ].map(([k, v, sub]) => (
          <div key={k} className="rounded-lg border border-slate-200 p-3">
            <div className="text-[11px] font-semibold text-slate-500">{k}</div>
            <div className="mt-1 text-[17px] font-bold tabular-nums text-slate-900">{v}</div>
            {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
          </div>
        ))}
      </div>

      {!hasAds && <p className="mt-3 text-[12px] text-slate-500">Belum ada data iklan untuk bulan ini{canImport ? ". Klik Impor data iklan untuk mengunggah file dari Ads Manager." : ". Owner atau manager dapat mengimpornya."}</p>}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <PieBlock title="Lead per sumber" data={leadPie} />
        <PieBlock title="Biaya iklan per platform" data={spendPie} money />
      </div>
      {a.noSource > 0 && <p className="mt-2 text-[11px] text-amber-700">{a.noSource} dari {a.cohortCount} lead bulan ini belum diisi "Sumber lead", jadi tidak masuk hitungan platform.</p>}

      {a.adRows.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] border-collapse">
            <thead className="bg-slate-50">
              <tr><th className={`${th} !text-left`}>Platform</th><th className={th}>Biaya</th><th className={th}>Klik</th><th className={th}>Lead</th><th className={th}>Biaya/lead</th><th className={th}>Deal</th><th className={th}>Biaya/deal</th><th className={th}>Omzet</th><th className={th}>ROAS</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {a.adRows.map((r, i) => (
                <tr key={r.platform}>
                  <td className="px-3 py-2 text-[12.5px] font-medium text-slate-800"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: colorOf(r.platform, i) }} />{r.platform}</td>
                  <td className={td}>{fmtRp(Math.round(r.spend))}</td><td className={td}>{int(r.clicks)}</td><td className={td}>{r.leads}</td>
                  <td className={td}>{rpOrDash(safeDiv(r.spend, r.leads))}</td><td className={td}>{r.deals}</td><td className={td}>{rpOrDash(safeDiv(r.spend, r.deals))}</td>
                  <td className={td}>{fmtRp(Math.round(r.value))}</td><td className={td}>{r.value > 0 ? `${(r.value / r.spend).toFixed(1)}x` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {a.insights.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-slate-50 p-3 text-[12px] text-slate-700">
          {a.insights.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}

      {a.campaigns.length > 0 && (
        <div className="mt-4">
          <div className="mb-1 text-[12px] font-semibold text-slate-700">Kampanye dengan biaya terbesar</div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[560px] border-collapse">
              <thead className="bg-slate-50"><tr><th className={`${th} !text-left`}>Kampanye</th><th className={`${th} !text-left`}>Platform</th><th className={th}>Biaya</th><th className={th}>Klik</th><th className={th}>Biaya/klik</th><th className={th}>Hasil (dari file)</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {a.campaigns.map((c, i) => (
                  <tr key={i}>
                    <td className="max-w-[240px] truncate px-3 py-2 text-[12.5px] text-slate-800" title={c.campaign}>{c.campaign}</td>
                    <td className="px-3 py-2 text-[12.5px] text-slate-600">{c.platform}</td>
                    <td className={td}>{fmtRp(Math.round(c.spend))}</td><td className={td}>{int(c.clicks)}</td>
                    <td className={td}>{rpOrDash(safeDiv(c.spend, c.clicks))}</td><td className={td}>{int(c.reported)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showImport && (
        <AdsImportModal ym={ym} leads={leads} stages={stages} org={org} onClose={() => setShowImport(false)} onDone={(r) => {
          setShowImport(false); setTick((t) => t + 1);
          if (r?.kind === "lead") { setNotice(`${r.count} lead dari iklan sudah dibuat di tab Leads (tahap pertama).`); onChanged?.(); }
          else setNotice(`${r?.count || 0} baris biaya iklan diimpor.`);
        }} />
      )}
    </section>
  );
}
