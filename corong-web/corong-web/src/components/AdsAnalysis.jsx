import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Upload, Trash2 } from "lucide-react";
import { Panel, PanelHeader, StatRow, Stat, EmptyState } from "../ui";
import * as db from "../lib/db";
import { fmtRp } from "../lib/helpers";
import { getCustomFieldSlots } from "../lib/industryTemplates";
import { normalizePlatform } from "../lib/adsImport";
import AdsImportModal from "./AdsImportModal";

// Analisis iklan di tab Laporan (9 Okt 2026): biaya iklan hasil impor (Meta/TikTok/Google) disandingkan
// dengan lead di Nexto per sumber. Lead dihitung dari yang DIBUAT pada bulan terpilih, platform dibaca
// dari isian "Sumber lead" di lead. Deal = lead tersebut yang sudah masuk tahap menang.
const COLORS = { Meta: "#2563eb", TikTok: "#0f172a", Google: "#16a34a", "Tidak diisi": "#94a3b8" };
const EXTRA = ["#f97316", "#a855f7", "#0d9488", "#eab308", "#64748b", "#ef4444"];
const num = (v) => Number(v) || 0;
const int = (v) => num(v).toLocaleString("id-ID");
const safeDiv = (a, b) => (b > 0 ? a / b : null);
const rpOrDash = (v) => (v === null ? "-" : fmtRp(Math.round(v)));

// Meta dan Instagram satu akun iklan (Meta Ads), jadi dibandingkan sebagai satu kelompok.
const groupOf = (p) => (p === "Instagram" ? "Meta" : p);
const ymOf = (d) => String(d || "").slice(0, 7);

export default function AdsAnalysis({ leads = [], stages = [], dealTransactions = [], org, ym, canImport, onChanged }) {
  // "cohort": lead yang masuk bulan ini beserta deal-nya kapan pun. "deal": deal yang tutup bulan ini dari lead kapan pun masuknya.
  const [basis, setBasis] = useState("cohort");
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
    const live = leads.filter((l) => !l.deleted_at);
    const isCohort = (l) => ymOf(l.created_at) === ym;
    const cohort = live.filter(isCohort);
    // Omzet dari nilai transaksi deal (termasuk repeat order). Lead menang tanpa transaksi memakai nilai deal di lead.
    const txByLead = new Map();
    for (const t of dealTransactions) { if (!t.lead_id) continue; const arr = txByLead.get(t.lead_id) || []; arr.push(t); txByLead.set(t.lead_id, arr); }
    const dealInfo = (l) => {
      const txs = txByLead.get(l.id) || [];
      const won = wonKeys.has(l.stage_key);
      if (basis === "deal") {
        const m = txs.filter((t) => ymOf(t.deal_date) === ym);
        if (m.length) return { deal: true, value: m.reduce((t, x) => t + num(x.deal_value), 0) };
        if (won && !txs.length && ymOf(l.deal_date) === ym) return { deal: true, value: num(l.deal_value) };
        return { deal: false, value: 0 };
      }
      if (!isCohort(l)) return { deal: false, value: 0 };
      if (txs.length) return { deal: true, value: txs.reduce((t, x) => t + num(x.deal_value), 0) };
      return won ? { deal: true, value: num(l.deal_value) } : { deal: false, value: 0 };
    };

    const by = new Map();
    const row = (p) => { if (!by.has(p)) by.set(p, { platform: p, spend: 0, impressions: 0, clicks: 0, reported: 0, leads: 0, deals: 0, value: 0 }); return by.get(p); };
    for (const r of ads) { const x = row(groupOf(normalizePlatform(r.platform) || "Lainnya")); x.spend += num(r.spend); x.impressions += num(r.impressions); x.clicks += num(r.clicks); x.reported += num(r.results); }
    for (const l of live) {
      const x = row(groupOf(sourceOf(l)));
      if (isCohort(l)) x.leads += 1;
      const d = dealInfo(l);
      if (d.deal) { x.deals += 1; x.value += d.value; }
    }
    const rows = [...by.values()].sort((p, q) => q.spend - p.spend || q.leads - p.leads);
    const adRows = rows.filter((r) => r.spend > 0);
    const tot = adRows.reduce((t, r) => ({ spend: t.spend + r.spend, leads: t.leads + r.leads, deals: t.deals + r.deals, value: t.value + r.value, clicks: t.clicks + r.clicks, impressions: t.impressions + r.impressions }), { spend: 0, leads: 0, deals: 0, value: 0, clicks: 0, impressions: 0 });

    // Lead per kampanye: dari kolom "kampanye iklan" di lead (terisi otomatis dari chat Cekat atau impor lead iklan),
    // dicocokkan dengan nama kampanye di data biaya (huruf besar kecil dan tanda baca diabaikan).
    const normC = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const leadCamp = new Map();
    for (const l of live) {
      const k = normC(l.ad_campaign);
      if (!k) continue;
      const c = leadCamp.get(k) || { leads: 0, deals: 0, value: 0 };
      if (isCohort(l)) c.leads += 1;
      const d = dealInfo(l);
      if (d.deal) { c.deals += 1; c.value += d.value; }
      leadCamp.set(k, c);
    }
    const camp = new Map();
    for (const r of ads) {
      const k = `${normalizePlatform(r.platform)}|${r.campaign}`;
      const c = camp.get(k) || { platform: normalizePlatform(r.platform), campaign: r.campaign || "(tanpa nama)", key: normC(r.campaign), spend: 0, clicks: 0, reported: 0 };
      c.spend += num(r.spend); c.clicks += num(r.clicks); c.reported += num(r.results);
      camp.set(k, c);
    }
    const matchedKeys = new Set();
    for (const c of camp.values()) {
      const m = c.key ? leadCamp.get(c.key) : null;
      if (m) matchedKeys.add(c.key);
      c.leadCount = m?.leads || 0; c.deals = m?.deals || 0; c.value = m?.value || 0;
    }
    const campaigns = [...camp.values()].sort((p, q) => q.spend - p.spend).slice(0, 8);
    const unmatchedLeads = [...leadCamp.entries()].filter(([k]) => !matchedKeys.has(k)).reduce((t, [, v]) => t + v.leads, 0);

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
    return { slot, rows, adRows, tot, campaigns, unmatchedLeads, insights, cohortCount: cohort.length, noSource: cohort.filter((l) => sourceOf(l) === "Tidak diisi").length };
  }, [ads, leads, stages, dealTransactions, org, ym, basis]);

  const colorOf = (p, i) => COLORS[p] || EXTRA[i % EXTRA.length];
  const leadPie = a.rows.filter((r) => r.leads > 0).map((r) => ({ name: r.platform, value: r.leads }));
  const spendPie = a.adRows.map((r) => ({ name: r.platform, value: Math.round(r.spend) }));
  const hasAds = ads.length > 0;

  const wipe = async () => {
    if (!window.confirm(`Hapus semua data iklan bulan ini (${from} sampai ${to})? Data lead tidak ikut terhapus.`)) return;
    try { await db.deleteAdSpendRange(from, to); setTick((t) => t + 1); } catch (e) { alert(String(e?.message || e)); }
  };

  const th = "px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500 whitespace-nowrap";
  const td = "px-4 py-2.5 text-right text-[12.5px] tabular-nums text-slate-800 whitespace-nowrap";
  const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

  const PieBlock = ({ title, data, money }) => (
    <div className="p-5">
      <h3 className="text-[13px] font-bold tracking-[-0.01em] text-ink">{title}</h3>
      {data.length === 0 ? <div className="py-10 text-center text-[12px] text-slate-400">Belum ada data</div> : (
        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
          <div className="h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={36} outerRadius={66} paddingAngle={2} stroke="none" isAnimationActive={false}>
                  {data.map((d, i) => <Cell key={d.name} fill={colorOf(d.name, i)} />)}
                </Pie>
                <Tooltip formatter={(v) => (money ? fmtRp(v) : `${v} lead`)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="w-full space-y-1.5 text-[12px]">
            {data.map((d, i) => {
              const total = data.reduce((s, x) => s + x.value, 0);
              return (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: colorOf(d.name, i) }} />{d.name}</span>
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl space-y-2">
          <p className="text-[12px] text-slate-500">Biaya iklan dari file Meta (termasuk Instagram), TikTok, atau Google dibandingkan dengan lead dan deal di Nexto per sumber. Omzet dihitung dari nilai transaksi deal.</p>
          <div role="group" aria-label="Cara menghitung deal" className="inline-flex rounded-full border border-slate-200 bg-white p-0.5 text-[12px] font-semibold">
            {[["cohort", "Lead masuk bulan ini"], ["deal", "Deal tutup bulan ini"]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setBasis(k)} aria-pressed={basis === k} className={`rounded-full px-3 py-1.5 ${basis === k ? "bg-ink text-white" : "text-slate-600 hover:text-ink"} ${focus}`}>{label}</button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">{basis === "cohort" ? "Lead, deal, dan omzet dari lead yang masuk bulan ini. Deal yang belum tertutup belum terhitung." : "Lead tetap yang masuk bulan ini. Deal dan omzet dari semua lead yang deal-nya tutup bulan ini, kapan pun lead itu masuk. Cocok untuk melihat uang yang benar-benar masuk bulan ini terhadap biaya iklan bulan ini."}</p>
        </div>
        {canImport && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowImport(true)} className={`inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 ${focus}`}><Upload size={14} /> Impor data iklan</button>
            {hasAds && <button type="button" onClick={wipe} className={`rounded-full border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-rose-600 ${focus}`} title="Hapus data iklan bulan ini" aria-label="Hapus data iklan bulan ini"><Trash2 size={14} /></button>}
          </div>
        )}
      </div>

      {notice && <p className="rounded-inner bg-emerald-50 px-4 py-2.5 text-[12px] text-emerald-800">{notice}</p>}
      {loadErr && <p className="rounded-inner bg-rose-50 px-4 py-2.5 text-[12px] text-rose-700">Data iklan tidak dapat dimuat: {loadErr}</p>}
      {!a.slot && <p className="rounded-inner bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">Pipeline organisasi ini belum punya isian "Sumber lead", jadi platform lead dibaca dari kolom sumber bawaan.</p>}

      <StatRow>
        <Stat value={fmtRp(Math.round(a.tot.spend))} label="Biaya iklan" tone="ink" className="[&>div:first-child]:text-[20px] sm:[&>div:first-child]:text-[22px]" />
        <Stat value={int(a.tot.leads)} label="Lead dari iklan" hint={`Biaya per lead ${rpOrDash(safeDiv(a.tot.spend, a.tot.leads))}`} tone="brand" />
        <Stat value={int(a.tot.deals)} label="Deal dari iklan" hint={`Biaya per deal ${rpOrDash(safeDiv(a.tot.spend, a.tot.deals))}`} tone="good" />
        <Stat value={fmtRp(Math.round(a.tot.value))} label="Omzet dari iklan" hint={a.tot.spend > 0 ? `ROAS ${a.tot.value > 0 ? (a.tot.value / a.tot.spend).toFixed(1) : "0"}x` : undefined} tone="good" className="[&>div:first-child]:text-[20px] sm:[&>div:first-child]:text-[22px]" />
      </StatRow>

      {!hasAds && (
        <EmptyState>Belum ada data iklan untuk bulan ini. {canImport ? "Klik Impor data iklan untuk mengunggah file dari Ads Manager." : "Owner atau manager dapat mengimpornya."}</EmptyState>
      )}

      <Panel className="grid md:grid-cols-2 md:divide-x md:divide-slate-100">
        <PieBlock title="Lead per sumber" data={leadPie} />
        <PieBlock title="Biaya iklan per platform" data={spendPie} money />
      </Panel>
      {a.noSource > 0 && <p className="-mt-2 px-1 text-[11px] text-amber-700">{a.noSource} dari {a.cohortCount} lead bulan ini belum diisi "Sumber lead", jadi tidak masuk hitungan platform.</p>}

      {a.adRows.length > 0 && (
        <Panel className="overflow-hidden">
          <div className="px-5 pb-1 pt-4"><PanelHeader title="Per platform" meta="Biaya iklan dibandingkan lead, deal, dan omzet dari sumber yang sama" /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-slate-100"><th className={`${th} !text-left`}>Platform</th><th className={th}>Biaya</th><th className={th}>Klik</th><th className={th}>Lead</th><th className={th}>Biaya/lead</th><th className={th}>Deal</th><th className={th}>Biaya/deal</th><th className={th}>Omzet</th><th className={th}>ROAS</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {a.adRows.map((r, i) => (
                  <tr key={r.platform}>
                    <td className="px-4 py-2.5 text-[12.5px] font-semibold text-ink"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: colorOf(r.platform, i) }} />{r.platform}</td>
                    <td className={td}>{fmtRp(Math.round(r.spend))}</td><td className={td}>{int(r.clicks)}</td><td className={td}>{r.leads}</td>
                    <td className={td}>{rpOrDash(safeDiv(r.spend, r.leads))}</td><td className={td}>{r.deals}</td><td className={td}>{rpOrDash(safeDiv(r.spend, r.deals))}</td>
                    <td className={td}>{fmtRp(Math.round(r.value))}</td><td className={td}>{r.value > 0 ? `${(r.value / r.spend).toFixed(1)}x` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {a.insights.length > 0 && (
            <ul className="space-y-1 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-[12px] text-slate-700">
              {a.insights.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </Panel>
      )}

      {a.campaigns.length > 0 && (
        <Panel className="overflow-hidden">
          <div className="px-5 pb-1 pt-4"><PanelHeader title="Kampanye dengan biaya terbesar" meta="Biaya dan klik dari file iklan. Lead, deal, omzet, dan ROAS dari lead yang kampanye iklannya sama dengan nama kampanye di file." /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead><tr className="border-b border-slate-100"><th className={`${th} !text-left`}>Kampanye</th><th className={`${th} !text-left`}>Platform</th><th className={th}>Biaya</th><th className={th}>Klik</th><th className={th}>Biaya/klik</th><th className={th}>Hasil (file)</th><th className={th}>Lead</th><th className={th}>Deal</th><th className={th}>Omzet</th><th className={th}>ROAS</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {a.campaigns.map((c, i) => (
                  <tr key={i}>
                    <td className="max-w-[240px] truncate px-4 py-2.5 text-[12.5px] font-medium text-ink" title={c.campaign}>{c.campaign}</td>
                    <td className="px-4 py-2.5 text-[12.5px] text-slate-600">{c.platform}</td>
                    <td className={td}>{fmtRp(Math.round(c.spend))}</td><td className={td}>{int(c.clicks)}</td>
                    <td className={td}>{rpOrDash(safeDiv(c.spend, c.clicks))}</td><td className={td}>{int(c.reported)}</td>
                    <td className={td}>{c.leadCount || "-"}</td><td className={td}>{c.leadCount || c.deals ? c.deals : "-"}</td>
                    <td className={td}>{c.value > 0 ? fmtRp(Math.round(c.value)) : "-"}</td>
                    <td className={`${td} font-semibold`}>{c.value > 0 && c.spend > 0 ? `${(c.value / c.spend).toFixed(1)}x` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {a.unmatchedLeads > 0 && <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-amber-700">{a.unmatchedLeads} lead bulan ini punya kampanye iklan yang namanya belum cocok dengan data biaya mana pun. Samakan nama kampanye di file biaya dengan yang tercatat di lead agar ROAS per kampanye terhitung.</p>}
        </Panel>
      )}

      {showImport && (
        <AdsImportModal ym={ym} leads={leads} stages={stages} org={org} onClose={() => setShowImport(false)} onDone={(r) => {
          setShowImport(false); setTick((t) => t + 1);
          if (r?.kind === "lead") { setNotice(`${r.count} lead dari iklan sudah dibuat di tab Leads (tahap pertama).`); onChanged?.(); }
          else setNotice(`${r?.count || 0} baris biaya iklan diimpor.`);
        }} />
      )}
    </div>
  );
}
