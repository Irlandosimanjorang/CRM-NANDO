import { useMemo, useState } from "react";
import { Trophy, Eye, EyeOff, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
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


  const mask = "••••••";
  const bagikan = (rp) => (rp ? (rpRevealed ? fmtRp(rp) : mask) : "—");

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600" aria-hidden="true">
            <Trophy size={18} />
          </span>
          <div>
            <h1 className="font-display text-[26px] font-bold leading-none tracking-[-0.03em] text-ink">Deal</h1>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">Lead yang sudah menang. Deal muncul otomatis saat lead pindah ke tahap menang.</p>
          </div>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center">
          <p className="font-display text-[17px] font-semibold text-ink">Belum ada deal</p>
          <p className="mt-1.5 text-[13px] text-slate-500">Pindahkan lead ke tahap menang, maka deal-nya tercatat di sini.</p>
        </div>
      ) : (
        <>
          <section className="mt-7 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                Total nilai deal
                <button type="button" onClick={() => setRpRevealed((v) => !v)} aria-label={rpRevealed ? "Sembunyikan nilai" : "Tampilkan nilai"} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">
                  {rpRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <div className="mt-2 font-display text-[44px] font-bold leading-none tracking-[-0.045em] tabular-nums text-ink">{rpRevealed ? fmtRp(totalValue) : mask}</div>
              <p className="mt-2.5 text-[13px] text-slate-500">{groups.length} deal menang</p>
            </div>

            {units && (
              <div className="min-w-[10rem]">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                  Total {quantityLabel}
                  <button type="button" onClick={() => setQtyRevealed((v) => !v)} aria-label={qtyRevealed ? "Sembunyikan jumlah" : "Tampilkan jumlah"} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">
                    {qtyRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <div className="mt-2 font-display text-[22px] font-bold leading-tight tracking-[-0.02em] tabular-nums text-slate-800">
                  {qtyRevealed
                    ? (totals.length ? totals.map((t) => <span key={t.unit} className="mr-3 inline-block">{t.n.toLocaleString("id-ID")} <span className="text-[13px] font-medium text-slate-400">{unitLabel(units, t.unit)}</span></span>) : "0")
                    : mask}
                </div>
              </div>
            )}
          </section>

          <ul className="mt-8 divide-y divide-slate-200 border-y border-slate-200">
            {groups.map((g) => {
              const lead = g.lead;
              const sm = lead ? stageMeta(stages, lead.stage_key) : null;
              const latest = g.txs[0];
              const isOpen = expanded.has(g.leadId);
              const nilai = Number(lead?.deal_value) || 0;
              const tanggal = lead?.deal_date || latest?.deal_date;
              const punyaRincian = g.txs.length > 1;
              return (
                <li key={g.leadId} className="py-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => lead && onEdit(lead)}
                        className="block max-w-full truncate rounded text-left text-[15px] font-semibold tracking-[-0.01em] text-ink hover:text-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
                      >
                        {lead?.name || latest?.lead_name || "—"}
                      </button>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
                        {lead?.city && <span>{lead.city}</span>}
                        {lead?.sales_owner && <span>{lead.sales_owner}</span>}
                        {tanggal && <span className="tabular-nums">{fmtDate(tanggal)}</span>}
                        {projectDeal && lead?.sph_number && <span>SPH {lead.sph_number}</span>}
                        {projectDeal && Number(lead?.discount_pct) > 0 && <span>Diskon {Number(lead.discount_pct)}%</span>}
                      </div>
                    </div>

                    <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex">
                      {sm && <span className="rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium" style={chipStyle(sm.hex)}>{sm.label}</span>}
                      {(latest?.product_type || latest?.chemical) && (
                        <span className="truncate rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-medium text-slate-700">{latest.product_type || latest.chemical}</span>
                      )}
                      {typeBadge(lead?.company_type) && <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{typeBadge(lead.company_type)}</span>}
                    </div>

                    <div className="text-right">
                      <div className="font-display text-[18px] font-bold leading-none tracking-[-0.02em] tabular-nums text-ink">{bagikan(nilai)}</div>
                      {punyaRincian && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(g.leadId)}
                          aria-expanded={isOpen}
                          className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
                        >
                          {g.txs.length} transaksi
                          {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {isOpen && punyaRincian && (
                    <div className="mt-4 border-l-2 border-orange-200 pl-4">
                      <p className="text-[11.5px] text-slate-400">Rincian transaksi. Nilai ini tidak dijumlahkan lagi ke total.</p>
                      <ul className="mt-2 divide-y divide-slate-100">
                        {g.txs.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-4 py-2 text-[12.5px]">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
                              <span className="tabular-nums">{t.deal_date ? fmtDate(t.deal_date) : "—"}</span>
                              {t.product_type && <span>{t.product_type}</span>}
                              {units && t.tonnage && <span className="font-mono">{qtyRevealed ? `${Number(t.tonnage).toLocaleString("id-ID")} ${unitLabel(units, t.tonnage_unit)}` : mask}</span>}
                            </div>
                            <div className="flex shrink-0 items-center gap-3 font-semibold tabular-nums text-slate-800">
                              {t.deal_value ? (rpRevealed ? fmtRp(t.deal_value) : mask) : "—"}
                              <button
                                type="button"
                                onClick={() => delTx(t.id)}
                                disabled={deletingTxIds.has(t.id)}
                                aria-label="Hapus transaksi"
                                className="rounded p-1 text-slate-300 hover:text-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-40"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
