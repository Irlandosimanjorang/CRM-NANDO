// Tab "Dokumen": Quotation & Invoice untuk client (7 Okt 2026, permintaan
// Nando). Professional dan Enterprise. Alur: Quotation -> diterima -> jadikan
// Invoice -> catat pembayaran. Dokumen yang sudah terbit dikunci; tampilan
// (logo, tanda tangan, rekening, syarat) diatur di "Pengaturan dokumen".
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Plus, Search, Settings2, Wallet, Receipt, Loader2 } from "lucide-react";
import * as db from "../lib/db";
import { Panel, PanelHeader, Stat, StatRow, Meter, EmptyState, Pill } from "../ui";
import {
  KIND_META, rp, effectiveStatus, outstanding, daysOverdue, agingBuckets, newDraft, fmtDateShort, todayWIB, DEFAULT_SETTINGS, addDaysISO,
} from "../lib/documents";
import DocEditor from "../components/documents/DocEditor";
import BrandSettings from "../components/documents/BrandSettings";
import { StatusPill, btnPrimary, btnGhost, field, errText } from "../components/documents/shared";

const STATUS_FILTERS = {
  quotation: [["all", "Semua"], ["draft", "Draf"], ["issued", "Terbit"], ["accepted", "Diterima"], ["rejected", "Ditolak"], ["expired", "Kedaluwarsa"]],
  invoice: [["all", "Semua"], ["draft", "Draf"], ["unpaid", "Belum dibayar"], ["partial", "Dibayar sebagian"], ["overdue", "Terlambat"], ["paid", "Lunas"], ["void", "Dibatalkan"]],
};
const PREFILL_KEY = "nexto-doc-prefill";

// Data contoh untuk pratinjau pengguna di bawah paket (tidak pernah disimpan).
function demoDocs() {
  const t = todayWIB();
  const mk = (i, kind, status, total, dueOff, paid = 0) => ({
    id: `demo-${i}`, kind, status, number: `${kind === "invoice" ? "INV" : "QT"}/2026/10/000${i}`, customer: { name: ["PT Maju Bersama", "CV Sinar Abadi", "PT Karya Nusantara"][i % 3] },
    issue_date: t, due_date: addDaysISO(t, dueOff), total, amount_paid: paid, items: [], email_log: [],
  });
  return [mk(1, "quotation", "issued", 45000000, 10), mk(2, "quotation", "accepted", 18500000, 5), mk(1, "invoice", "unpaid", 45000000, 7), mk(2, "invoice", "partial", 18500000, -4, 8000000), mk(3, "invoice", "paid", 9750000, -20, 9750000)];
}

export default function Documents({ leads = [], canManage, isEnterprise, onNotify = () => {}, dummy = false }) {
  const [tab, setTab] = useState("invoice");
  const [docs, setDocs] = useState(dummy ? demoDocs() : []);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [hasSettings, setHasSettings] = useState(false);
  const [loading, setLoading] = useState(!dummy);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState(null);
  const [opening, setOpening] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoadError("");
    try {
      const [list, s] = await Promise.all([db.listDocuments(), db.getDocSettings()]);
      setDocs(list);
      if (s) { setSettings({ ...DEFAULT_SETTINGS, ...s }); setHasSettings(true); }
    } catch (e) { setLoadError(errText(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { if (!dummy) load(); }, [dummy, load]);

  const startDraft = useCallback((kind, lead = null) => {
    if (!hasSettings && !String(settings.seller?.name || "").trim()) {
      onNotify("Lengkapi dulu pengaturan dokumen (nama perusahaan, rekening, tanda tangan) supaya tampil di dokumen.", "info");
    }
    setEditing(newDraft(kind, settings, lead));
  }, [hasSettings, settings, onNotify]);

  // Dari tombol "Buat quotation/invoice" di lead: sessionStorage membawa lead & jenis.
  useEffect(() => {
    if (dummy || loading) return;
    let raw = null;
    try { raw = sessionStorage.getItem(PREFILL_KEY); sessionStorage.removeItem(PREFILL_KEY); } catch { /* tanpa prefill */ }
    if (!raw) return;
    try {
      const { leadId, kind } = JSON.parse(raw);
      const lead = leads.find((l) => l.id === leadId) || null;
      setTab(kind === "invoice" ? "invoice" : "quotation");
      startDraft(kind === "invoice" ? "invoice" : "quotation", lead);
    } catch { /* abaikan */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, dummy]);

  const openDoc = async (id) => {
    if (dummy) return;
    setOpening(id);
    try { setEditing(await db.getDocument(id)); } catch (e) { onNotify(errText(e), "error"); } finally { setOpening(""); }
  };
  const onChanged = (row) => {
    if (row._deleted) { setDocs((p) => p.filter((x) => x.id !== row.id)); return; }
    setDocs((p) => (p.some((x) => x.id === row.id) ? p.map((x) => (x.id === row.id ? { ...x, ...row } : x)) : [row, ...p]));
  };
  const duplicate = (src) => {
    const copy = newDraft(src.kind, settings, null);
    setEditing({ ...copy, lead_id: src.lead_id || null, customer: { ...src.customer }, items: (src.items || []).map((i) => ({ ...i })), discount_type: src.discount_type, discount_value: src.discount_value, tax_on: src.tax_on, tax_rate: src.tax_rate, tax_label: src.tax_label, notes: src.notes, terms: src.terms });
  };

  const kind = tab === "settings" ? null : tab;
  const today = todayWIB();
  const ofKind = useMemo(() => docs.filter((d) => d.kind === kind), [docs, kind]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ofKind.filter((d) => {
      if (statusFilter !== "all") {
        const st = d.number || d.status !== "draft" ? effectiveStatus(d, today) : "draft";
        if (st !== statusFilter) return false;
      }
      if (!q) return true;
      return (d.number || "").toLowerCase().includes(q) || (d.customer?.name || "").toLowerCase().includes(q);
    });
  }, [ofKind, query, statusFilter, today]);

  const invoices = useMemo(() => docs.filter((d) => d.kind === "invoice" && d.issued_at !== null), [docs]);
  const aging = useMemo(() => agingBuckets(invoices, today), [invoices, today]);
  const outstandingTotal = invoices.reduce((s, d) => s + outstanding(d), 0);
  const overdueDocs = invoices.filter((d) => daysOverdue(d, today) > 0);
  const monthStart = today.slice(0, 7);
  const paidThisMonth = invoices.filter((d) => d.status === "paid" && (d.paid_at || "").slice(0, 7) === monthStart).reduce((s, d) => s + Number(d.total), 0);
  const quotes = docs.filter((d) => d.kind === "quotation" && d.issued_at !== null);
  const awaiting = quotes.filter((d) => effectiveStatus(d, today) === "issued");
  const accepted = quotes.filter((d) => d.status === "accepted");

  if (loading) return <div className="flex items-center justify-center gap-2 py-24 text-[13px] text-slate-500"><Loader2 size={16} className="animate-spin" /> Memuat dokumen…</div>;
  if (loadError) return (
    <Panel className="mx-auto mt-10 max-w-md p-6 text-center">
      <p className="text-[14px] font-semibold text-slate-900">Dokumen tidak dapat dimuat</p>
      <p className="mt-1 text-[12.5px] text-slate-600">{loadError}</p>
      <button type="button" onClick={() => { setLoading(true); load(); }} className={btnGhost + " mt-4"}>Coba lagi</button>
    </Panel>
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.03em] text-ink">Dokumen</h1>
          <p className="mt-0.5 text-[12.5px] text-slate-500">Buat quotation dan invoice dengan tampilan perusahaan Anda, kirim ke customer, dan pantau pembayarannya.</p>
        </div>
        {kind && <button type="button" className={btnPrimary} onClick={() => startDraft(kind)}><Plus size={15} /> {kind === "quotation" ? "Quotation baru" : "Invoice baru"}</button>}
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2" role="tablist">
        {[["invoice", "Invoice", Receipt], ["quotation", "Quotation", FileText], ["settings", "Pengaturan dokumen", Settings2]].map(([k, label, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setStatusFilter("all"); setQuery(""); }}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold ${tab === k ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            <Icon size={14} /> {label}
            {k !== "settings" && <span className={`rounded-full px-1.5 text-[10.5px] ${tab === k ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{docs.filter((d) => d.kind === k).length}</span>}
          </button>
        ))}
      </div>

      {tab === "settings" ? (
        <BrandSettings key={settings.updated_at || "new"} settings={hasSettings ? settings : null} canManage={canManage} isEnterprise={isEnterprise} onNotify={onNotify} onSaved={(s) => { setSettings({ ...DEFAULT_SETTINGS, ...s }); setHasSettings(true); }} />
      ) : (
        <>
          {!hasSettings && !dummy && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-inner border border-orange-200 bg-brand-soft px-4 py-3 text-[12.5px] text-orange-900">
              <span>Dokumen Anda belum punya identitas perusahaan, rekening, dan tanda tangan. Atur sekali, dipakai di semua dokumen.</span>
              <button type="button" onClick={() => setTab("settings")} className="font-semibold underline">Buka pengaturan dokumen</button>
            </div>
          )}

          {kind === "invoice" ? (
            <>
              <StatRow>
                <Stat value={rp(outstandingTotal)} label="Piutang berjalan" hint={`${invoices.filter((d) => outstanding(d) > 0).length} invoice belum lunas`} tone={outstandingTotal > 0 ? "brand" : "muted"} />
                <Stat value={rp(overdueDocs.reduce((s, d) => s + outstanding(d), 0))} label="Terlambat" hint={`${overdueDocs.length} invoice lewat jatuh tempo`} tone={overdueDocs.length ? "bad" : "muted"} />
                <Stat value={rp(paidThisMonth)} label="Lunas bulan ini" tone="good" />
                <Stat value={invoices.length} label="Invoice terbit" />
              </StatRow>
              {aging.total > 0 && (
                <Panel className="p-5">
                  <PanelHeader title="Umur piutang" meta="Sisa tagihan menurut keterlambatan dari tanggal jatuh tempo." />
                  <div className="mt-4 grid gap-3 sm:grid-cols-5">
                    {[["current", "Belum jatuh tempo", "good"], ["d1_30", "Terlambat 1-30 hari", "warn"], ["d31_60", "31-60 hari", "warn"], ["d61_90", "61-90 hari", "bad"], ["d90", "Lebih dari 90 hari", "bad"]].map(([k, label, tone]) => (
                      <div key={k}>
                        <div className="text-[11.5px] text-slate-500">{label}</div>
                        <div className="mt-0.5 text-[15px] font-bold tabular-nums text-ink">{rp(aging.amounts[k])}</div>
                        <Meter value={aging.amounts[k]} max={aging.total} tone={tone} className="mt-1.5 h-1.5" />
                        <div className="mt-1 text-[11px] text-slate-400">{aging.counts[k]} invoice</div>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </>
          ) : (
            <StatRow>
              <Stat value={rp(awaiting.reduce((s, d) => s + Number(d.total), 0))} label="Menunggu respons" hint={`${awaiting.length} quotation aktif`} tone={awaiting.length ? "brand" : "muted"} />
              <Stat value={rp(accepted.reduce((s, d) => s + Number(d.total), 0))} label="Diterima" hint={`${accepted.length} quotation`} tone="good" />
              <Stat value={quotes.filter((d) => ["expired", "rejected"].includes(effectiveStatus(d, today))).length} label="Ditolak / kedaluwarsa" />
              <Stat value={quotes.length} label="Quotation terbit" />
            </StatRow>
          )}

          <Panel className="p-0">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
              <div className="relative min-w-[180px] flex-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                <input className={field + " !pl-8"} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nomor atau nama customer" aria-label="Cari dokumen" />
              </div>
              <select className={field + " !w-auto"} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter status">
                {STATUS_FILTERS[kind].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            {shown.length === 0 ? (
              <div className="p-5"><EmptyState action={ofKind.length === 0 ? `Buat ${KIND_META[kind].label.toLowerCase()} pertama` : undefined} onAction={() => startDraft(kind)}>
                {ofKind.length === 0 ? `Belum ada ${KIND_META[kind].label.toLowerCase()}. Buat dari awal, atau dari tombol di halaman lead.` : "Tidak ada dokumen yang cocok dengan filter."}
              </EmptyState></div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {shown.map((d) => {
                  const late = daysOverdue(d, today);
                  const out = outstanding(d);
                  return (
                    <li key={d.id}>
                      <button type="button" onClick={() => openDoc(d.id)} disabled={opening === d.id} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto]">
                        <div className="min-w-0">
                          <div className="truncate text-[13.5px] font-semibold text-slate-900">{d.customer?.name || "Tanpa nama"}</div>
                          <div className="truncate text-[11.5px] text-slate-500">{d.number || "Draf"}{d.issue_date ? ` · ${fmtDateShort(d.issue_date)}` : ""}</div>
                        </div>
                        <div className="hidden min-w-0 text-[12px] text-slate-500 sm:block">
                          <div>{KIND_META[d.kind].dateLabel} {fmtDateShort(d.due_date)}</div>
                          {late > 0 ? <div className="font-semibold text-rose-700">Terlambat {late} hari</div> : d.kind === "invoice" && d.status === "partial" ? <div>Sisa {rp(out)}</div> : null}
                        </div>
                        <div className="text-right"><div className="text-[13.5px] font-bold tabular-nums text-ink">{rp(d.total)}</div></div>
                        <div className="col-span-2 flex items-center gap-2 sm:col-span-1 sm:justify-end">{opening === d.id ? <Loader2 size={14} className="animate-spin text-slate-400" /> : <StatusPill doc={d} />}
                          {(d.email_log || []).length > 0 && <Pill tone="neutral">Terkirim</Pill>}</div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
          {kind === "invoice" && ofKind.length > 0 && <p className="text-[11.5px] text-slate-500"><Wallet size={11} className="mr-1 inline" /> Piutang dan status Terlambat dihitung dari tanggal jatuh tempo (zona waktu WIB).</p>}
        </>
      )}

      {editing && (
        <DocEditor
          key={editing.id || "new"} doc={editing} settings={settings} leads={leads} isEnterprise={isEnterprise} docs={docs}
          onClose={() => setEditing(null)} onChanged={onChanged}
          onOpenDoc={(id) => { setEditing(null); setTimeout(() => openDoc(id), 0); }}
          onDuplicate={duplicate} onNotify={onNotify}
        />
      )}
    </div>
  );
}
