import { useMemo, useState, Fragment } from "react";
import { Trophy, Building2, TrendingUp, Eye, EyeOff, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import * as db from "../lib/db";
import { stageMeta, chipStyle, typeBadge, fmtRp, fmtDate } from "../lib/helpers";
import { getFieldLabel, getQuantityUnits } from "../lib/industryTemplates";

// Label satuan dari daftar satuan industri; fallback ke kode mentah.
const unitLabel = (units, v) => ((units || []).find((u) => u.v === v)?.label || v || "").toLowerCase();

// Total jumlah per satuan (30 Sep 2026, audit istilah per industri -
// sebelumnya selalu dikonversi ke "ton" di semua industri). Kg digabung ke
// ton kalau industrinya pakai dua-duanya (PVC/kimia).
function qtyTotals(deals, units) {
  const byUnit = {};
  const hasTonKg = units?.some((u) => u.v === "ton") && units?.some((u) => u.v === "kg");
  for (const d of deals) {
    let n = Number(d.tonnage) || 0;
    if (!n) continue;
    let u = d.tonnage_unit || units?.[0]?.v || "";
    if (hasTonKg && u === "kg") { n = n / 1000; u = "ton"; }
    byUnit[u] = (byUnit[u] || 0) + n;
  }
  return Object.entries(byUnit).map(([u, n]) => ({ unit: u, n }));
}

export default function Deal({ leads, stages, dealTransactions, industry, onEdit, onChanged, projectDeal = false }) {
  const productLabel = getFieldLabel(industry, "product", "Produk");
  const quantityLabel = getFieldLabel(industry, "quantity", "Quantity");
  const units = getQuantityUnits(industry);
  const [qtyRevealed, setQtyRevealed] = useState(false);
  const [rpRevealed, setRpRevealed] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const leadsById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);

  // Satu aturan deal di semua tab: hanya transaksi milik lead yang sekarang di tahap menang yang ditampilkan.
  // Total nilai = jumlah deal_value lead menang (sama dengan Report dan Komisi).
  const wonIds = useMemo(() => {
    const wonKeys = new Set((stages || []).filter((s) => s.type === "won").map((s) => s.key));
    return new Set((leads || []).filter((l) => !l.deleted_at && wonKeys.has(l.stage_key)).map((l) => l.id));
  }, [leads, stages]);
  const deals = useMemo(() => (dealTransactions || []).filter((t) => wonIds.has(t.lead_id)), [dealTransactions, wonIds]);
  const totalValue = useMemo(() => (leads || []).filter((l) => wonIds.has(l.id)).reduce((a, l) => a + (Number(l.deal_value) || 0), 0), [leads, wonIds]);
  const totals = qtyTotals(deals, units);

  // 1 baris per lead menang. Nilai baris = deal_value lead (satu aturan deal di semua tab).
  // Transaksi di bawahnya (repeat order) hanya rincian, tidak dijumlah lagi. Dibuka lewat ikon panah.
  const groups = useMemo(() => {
    const txByLead = {};
    for (const t of deals) (txByLead[t.lead_id] ||= []).push(t);
    const dateOf = (g) => String(g.lead?.deal_date || g.txs[0]?.deal_date || "");
    return [...wonIds]
      .map((leadId) => ({
        leadId,
        lead: leadsById[leadId],
        txs: (txByLead[leadId] || []).slice().sort((a, b) => String(b.deal_date || "").localeCompare(String(a.deal_date || ""))),
      }))
      .sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  }, [deals, wonIds, leadsById]);

  const toggleExpand = (leadId) => setExpanded((prev) => { const n = new Set(prev); n.has(leadId) ? n.delete(leadId) : n.add(leadId); return n; });

  // BUG FIX (11 Sep 2026, ketauan pas audit) - klik ganda cepet di tombol
  // hapus sebelumnya bisa nembak 2x db.deleteDealTransaction buat id yang
  // sama sebelum list sempet re-render, bikin panggilan kedua gagal (row
  // udah gak ada) & muncul alert "Gagal hapus" yang gak perlu. Digurad
  // pake Set id yang lagi diproses.
  const [deletingTxIds, setDeletingTxIds] = useState(() => new Set());
  const delTx = async (id) => {
    if (deletingTxIds.has(id)) return;
    if (!window.confirm("Hapus transaksi ini?")) return;
    setDeletingTxIds((prev) => new Set(prev).add(id));
    try { await db.deleteDealTransaction(id); onChanged(); }
    catch (e) { alert("Gagal hapus: " + e.message); }
    finally { setDeletingTxIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Trophy size={20} /></span>
          <div>
            <h1 className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-slate-900">Deal</h1>
            <p className="text-[12.5px] text-slate-500">Lead yang sudah menang. Nilai deal mengikuti nilai lead, transaksi tambahan ada di rincian.</p>
          </div>
          <span className="ml-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-semibold text-slate-600 tabular-nums">{groups.length}</span>
        </div>
        {/* Org project_deal (BSB): deal tercatat otomatis saat lead pindah ke Proyek Selesai, tidak diinput manual di sini. */}
      </div>
      {groups.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><Trophy size={32} className="mx-auto text-slate-300 mb-3" />Belum ada deal. Deal muncul otomatis saat lead dipindah ke tahap menang.</div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm mb-5">
            <div className={`grid gap-y-4 ${units ? "grid-cols-3" : "grid-cols-2"} divide-x divide-slate-100`}>
              <div className="px-3 first:pl-1">
                <div className="text-xs text-slate-400 flex items-center gap-1.5"><Trophy size={13} /> Total Deal</div>
                <div className="font-bold text-2xl text-emerald-600 mt-1.5 tabular-nums">{groups.length}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{deals.length} transaksi</div>
              </div>

              {units && <div className="px-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5"><Building2 size={13} /> Total {quantityLabel}</div>
                  <button onClick={() => setQtyRevealed((v) => !v)} className="text-slate-400 hover:text-slate-700" title={qtyRevealed ? "Sembunyikan" : "Tampilkan"}>
                    {qtyRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="font-bold text-2xl text-slate-800 mt-1.5 tabular-nums">
                  {qtyRevealed
                    ? (totals.length ? totals.map((t, i) => <span key={t.unit}>{i > 0 && <span className="text-slate-300"> · </span>}{t.n.toLocaleString("id-ID")} <span className="text-sm font-normal text-slate-400">{unitLabel(units, t.unit)}</span></span>) : "0")
                    : "••••••"}
                </div>
              </div>}

              <div className="px-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5"><TrendingUp size={13} /> Total Rp</div>
                  <button onClick={() => setRpRevealed((v) => !v)} className="text-slate-400 hover:text-slate-700" title={rpRevealed ? "Sembunyikan" : "Tampilkan"}>
                    {rpRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <div className="font-bold text-lg text-slate-800 mt-1.5 tabular-nums">{rpRevealed ? fmtRp(totalValue) : "••••••"}</div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><tr>
                <th className="px-3 py-2 font-medium" style={{ width: "28px" }}></th>
                <th className="text-left px-3 py-2 font-medium">{getFieldLabel(industry, "name_short", "Lead")}</th><th className="hidden sm:table-cell text-left px-3 py-2 font-medium">Kota</th><th className="text-left px-3 py-2 font-medium">Tahap</th><th className="hidden sm:table-cell text-left px-3 py-2 font-medium">Sales</th><th className="hidden md:table-cell text-left px-3 py-2 font-medium">Tanggal terakhir</th><th className="hidden md:table-cell text-left px-3 py-2 font-medium">{productLabel}</th>{units && <th className="hidden sm:table-cell text-left px-3 py-2 font-medium"><span className="inline-flex items-center gap-1">{quantityLabel}<button onClick={(e) => { e.stopPropagation(); setQtyRevealed((v) => !v); }} className="text-slate-400 hover:text-slate-700 normal-case" title={qtyRevealed ? "Sembunyikan" : "Tampilkan"}>{qtyRevealed ? <EyeOff size={12} /> : <Eye size={12} />}</button></span></th>}{projectDeal && <th className="hidden md:table-cell text-left px-3 py-2 font-medium">No. SPH</th>}{projectDeal && <th className="hidden md:table-cell text-left px-3 py-2 font-medium">Diskon (%)</th>}<th className="text-left px-3 py-2 font-medium">Total Rp</th>{projectDeal && <th className="hidden md:table-cell text-left px-3 py-2 font-medium">Total diskon</th>}
              </tr></thead>
              <tbody>
                {groups.map((g) => {
                  const lead = g.lead;
                  const sm = lead ? stageMeta(stages, lead.stage_key) : null;
                  const latest = g.txs[0];
                  const isOpen = expanded.has(g.leadId);
                  const groupTotalRp = Number(lead?.deal_value) || 0;
                  const tanggal = lead?.deal_date || latest?.deal_date;
                  return (
                  <Fragment key={g.leadId}>
                    <tr className="border-t border-slate-100 hover:bg-orange-50/40 cursor-pointer" onClick={() => lead && onEdit(lead)}>
                      <td className="px-3 py-2" onClick={(e) => { e.stopPropagation(); if (g.txs.length > 1) toggleExpand(g.leadId); }}>
                        {g.txs.length > 1 && (isOpen ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium flex items-center gap-1.5">
                          {lead?.name || latest?.lead_name || "—"}
                          {lead && typeBadge(lead.company_type) && <span className="text-[10px] font-bold px-1 rounded bg-slate-200 text-slate-600">{typeBadge(lead.company_type)}</span>}
                          {g.txs.length > 1 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700" title="Jumlah transaksi (repeat order)">{g.txs.length} transaksi</span>}
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-3 py-2 text-xs text-slate-600">{lead?.city || "—"}</td>
                      <td className="px-3 py-2">{sm ? <span className="text-[11px] border rounded-full px-2 py-0.5" style={chipStyle(sm.hex)}>{sm.label}</span> : <span className="text-slate-300 text-xs">—</span>}</td>
                      <td className="hidden sm:table-cell px-3 py-2 text-xs text-slate-600">{lead?.sales_owner || "—"}</td>
                      <td className="hidden md:table-cell px-3 py-2 text-xs text-slate-600">{tanggal ? fmtDate(tanggal) : "—"}</td>
                      <td className="hidden md:table-cell px-3 py-2 text-xs text-slate-600">{latest?.product_type && <span className="mr-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{latest.product_type}</span>}{latest?.chemical || (latest?.product_type ? "" : "—")}</td>
                      {units && <td className="hidden sm:table-cell px-3 py-2 text-xs font-mono text-slate-700">{latest?.tonnage ? (qtyRevealed ? `${Number(latest.tonnage).toLocaleString("id-ID")} ${unitLabel(units, latest.tonnage_unit)}` : "••••••") : "—"}</td>}
                      {projectDeal && <td className="hidden md:table-cell px-3 py-2 text-xs text-slate-700">{lead?.sph_number || "—"}</td>}
                      {projectDeal && <td className="hidden md:table-cell px-3 py-2 text-xs text-slate-700 tabular-nums">{Number(lead?.discount_pct) > 0 ? `${Number(lead.discount_pct)}%` : "—"}</td>}
                      <td className="px-3 py-2 text-xs font-mono text-emerald-700 font-semibold">{groupTotalRp ? (rpRevealed ? fmtRp(groupTotalRp) : "••••••") : "—"}</td>
                      {projectDeal && <td className="hidden md:table-cell px-3 py-2 text-xs font-mono text-slate-700 tabular-nums">{Number(lead?.discount_total) > 0 ? (rpRevealed ? fmtRp(lead.discount_total) : "••••••") : "—"}</td>}
                    </tr>
                    {isOpen && g.txs.map((t) => (
                      <tr key={t.id} className="border-t border-slate-50 bg-slate-50/50 text-xs">
                        <td></td>
                        <td className="px-3 py-1.5 pl-8 text-slate-400" colSpan={1}>↳ rincian transaksi</td>
                        <td className="hidden sm:table-cell px-3 py-1.5"></td>
                        <td className="px-3 py-1.5"></td>
                        <td className="hidden sm:table-cell px-3 py-1.5"></td>
                        <td className="hidden md:table-cell px-3 py-1.5 text-slate-600">{t.deal_date ? fmtDate(t.deal_date) : "—"}</td>
                        <td className="hidden md:table-cell px-3 py-1.5 text-slate-600">{t.product_type && <span className="mr-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">{t.product_type}</span>}{t.chemical || (t.product_type ? "" : "—")}</td>
                        {units && <td className="hidden sm:table-cell px-3 py-1.5 font-mono text-slate-600">{t.tonnage ? (qtyRevealed ? `${Number(t.tonnage).toLocaleString("id-ID")} ${unitLabel(units, t.tonnage_unit)}` : "••••••") : "—"}</td>}
                        {projectDeal && <td className="hidden md:table-cell px-3 py-1.5"></td>}
                        {projectDeal && <td className="hidden md:table-cell px-3 py-1.5"></td>}
                        <td className="px-3 py-1.5 font-mono text-emerald-700 font-semibold">
                          <div className="flex items-center justify-between gap-2">
                            {t.deal_value ? (rpRevealed ? fmtRp(t.deal_value) : "••••••") : "—"}
                            <button onClick={(e) => { e.stopPropagation(); delTx(t.id); }} disabled={deletingTxIds.has(t.id)} className="text-slate-300 hover:text-rose-500 disabled:opacity-40"><Trash2 size={12} /></button>
                          </div>
                        </td>
                        {projectDeal && <td className="hidden md:table-cell px-3 py-1.5"></td>}
                      </tr>
                    ))}
                  </Fragment>
                  ); })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
