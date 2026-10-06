// Editor & penampil Quotation / Invoice. Draf bisa diedit penuh; dokumen yang
// sudah terbit hanya bisa dilihat dan dijalankan aksinya (kirim, cetak, catat
// pembayaran, ubah status, jadikan invoice) - isinya dikunci di database.
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Plus, Trash2, Printer, Send, Link2, Copy, CheckCircle2, XCircle, FileText, Search, X, Wallet, Ban, BookOpen } from "lucide-react";
import * as db from "../../lib/db";
import { Panel, PanelHeader, Pill, EmptyState } from "../../ui";
import { printHtml } from "../../lib/docKit";
import {
  KIND_META, rp, computeDocTotals, lineTotal, brandingOf, buildDocumentHtml, validateForIssue, cleanItems, emptyItem,
  customerFromLead, itemFromProduct, outstanding, daysOverdue, addDaysISO, todayWIB, fmtDateShort, effectiveStatus,
} from "../../lib/documents";
import { field, lbl, btnPrimary, btnGhost, btnDanger, StatusPill, Spinner, Modal, DocPreview, errText, digits, fmtInt } from "./shared";

const fmtStamp = (iso) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

// ------------------------------------------------------------ dialog bayar --
function PaymentDialog({ doc, onClose, onDone, onNotify }) {
  const remaining = Math.max(0, Number(doc.total) - Number(doc.amount_paid || 0));
  const [amount, setAmount] = useState(String(remaining));
  const [paidOn, setPaidOn] = useState(todayWIB());
  const [method, setMethod] = useState("Transfer bank");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const n = Number(digits(amount));
    if (!n) { onNotify("Isi jumlah pembayaran.", "error"); return; }
    if (n > remaining) { onNotify(`Jumlah melebihi sisa tagihan (${rp(remaining)}).`, "error"); return; }
    setBusy(true);
    try { const updated = await db.recordDocumentPayment(doc.id, { amount: n, paidOn, method, note }); onDone(updated); onNotify(n >= remaining ? "Pembayaran dicatat. Invoice lunas." : "Pembayaran dicatat.", "success"); }
    catch (e) { onNotify(errText(e), "error"); setBusy(false); }
  };
  return (
    <Modal title="Catat pembayaran" onClose={onClose} footer={<>
      <button type="button" className={btnGhost} onClick={onClose}>Batal</button>
      <button type="button" className={btnPrimary} onClick={submit} disabled={busy}>{busy && <Spinner />} Simpan pembayaran</button>
    </>}>
      <div className="grid gap-3">
        <div className="rounded-inner bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">Sisa tagihan <b className="text-slate-900">{rp(remaining)}</b> dari total {rp(doc.total)}</div>
        <label><span className={lbl}>Jumlah dibayar (Rp)</span>
          <div className="flex gap-2"><input className={field} inputMode="numeric" value={fmtInt(digits(amount))} onChange={(e) => setAmount(digits(e.target.value))} />
            <button type="button" className={btnGhost + " shrink-0"} onClick={() => setAmount(String(remaining))}>Lunasi</button></div></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className={lbl}>Tanggal bayar</span><input type="date" max={todayWIB()} className={field} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></label>
          <label><span className={lbl}>Metode</span><input className={field} maxLength={60} value={method} onChange={(e) => setMethod(e.target.value)} /></label>
        </div>
        <label><span className={lbl}>Catatan (opsional)</span><input className={field} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mis. DP 50%, nomor bukti transfer" /></label>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------- dialog kirim --
function SendDialog({ doc, onClose, onDone, onNotify }) {
  const last = [...(doc.email_log || [])].reverse().find((e) => e.type === "invoice" || e.type === "quotation");
  const [to, setTo] = useState(last?.to || doc.customer?.email || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) { onNotify("Alamat email tujuan tidak valid.", "error"); return; }
    setBusy(true);
    try { await db.sendDocumentEmail(doc.id, { to: to.trim(), message }); onDone(); onNotify(`${KIND_META[doc.kind].label} dikirim ke ${to.trim()}.`, "success"); }
    catch (e) { onNotify(errText(e), "error"); setBusy(false); }
  };
  return (
    <Modal title={`Kirim ${KIND_META[doc.kind].label.toLowerCase()} lewat email`} onClose={onClose} footer={<>
      <button type="button" className={btnGhost} onClick={onClose}>Batal</button>
      <button type="button" className={btnPrimary} onClick={submit} disabled={busy}>{busy ? <Spinner /> : <Send size={14} />} Kirim email</button>
    </>}>
      <div className="grid gap-3">
        <label><span className={lbl}>Email tujuan</span><input type="email" className={field} value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@perusahaan.co.id" autoFocus /></label>
        <label><span className={lbl}>Pesan pengantar (opsional)</span><textarea className={field} rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Terima kasih atas kesempatan yang diberikan." /></label>
        <p className="text-[11.5px] text-slate-500">Customer menerima ringkasan dan tombol untuk membuka dokumen lengkap. Balasan mereka masuk ke email penerbit{doc.snapshot?.seller?.email ? ` (${doc.snapshot.seller.email})` : ""}.</p>
        {(doc.email_log || []).length > 0 && (
          <div className="rounded-inner border border-slate-200 px-3 py-2 text-[11.5px] text-slate-600">
            <div className="mb-1 font-semibold text-slate-700">Pernah dikirim</div>
            {[...doc.email_log].reverse().slice(0, 5).map((e, i) => <div key={i}>{fmtStamp(e.at)} ke {e.to}{e.type.startsWith("due") || e.type.startsWith("overdue") ? " (pengingat otomatis)" : ""}</div>)}
          </div>
        )}
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------- item rows --
function ItemsEditor({ items, onChange, catalog }) {
  const [catOpen, setCatOpen] = useState(false);
  const setItem = (i, patch) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i) => onChange(items.length > 1 ? items.filter((_, idx) => idx !== i) : [emptyItem()]);
  return (
    <div className="grid gap-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-inner border border-slate-200 p-3">
          <div className="flex items-start gap-2">
            <label className="min-w-0 flex-1"><span className={lbl}>Item {i + 1}</span>
              <input className={field} maxLength={160} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Nama produk atau layanan" /></label>
            <button type="button" onClick={() => remove(i)} aria-label={`Hapus item ${i + 1}`} className="mt-6 rounded-full p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={15} /></button>
          </div>
          <label className="mt-2 block"><span className={lbl}>Deskripsi (opsional)</span>
            <textarea className={field} rows={2} maxLength={500} value={it.desc} onChange={(e) => setItem(i, { desc: e.target.value })} /></label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
            <label className="sm:col-span-1"><span className={lbl}>Kode</span><input className={field} maxLength={40} value={it.code} onChange={(e) => setItem(i, { code: e.target.value })} /></label>
            <label><span className={lbl}>Jumlah</span><input type="number" min="0" step="any" className={field} value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value === "" ? "" : Number(e.target.value) })} /></label>
            <label><span className={lbl}>Satuan</span><input className={field} maxLength={20} value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} placeholder="pcs" /></label>
            <label className="col-span-2 sm:col-span-2"><span className={lbl}>Harga satuan (Rp)</span><input className={field} inputMode="numeric" value={fmtInt(it.price || "")} onChange={(e) => setItem(i, { price: Number(digits(e.target.value)) || 0 })} /></label>
            <label><span className={lbl}>Diskon (%)</span><input type="number" min="0" max="100" step="any" className={field} value={it.discount_pct} onChange={(e) => setItem(i, { discount_pct: e.target.value === "" ? "" : Math.min(100, Math.max(0, Number(e.target.value))) })} /></label>
          </div>
          <div className="mt-2 text-right text-[12px] text-slate-500">Jumlah baris <b className="text-slate-900 tabular-nums">{rp(lineTotal(it))}</b></div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onChange([...items, emptyItem()])} className={btnGhost}><Plus size={14} /> Tambah item</button>
        {catalog.length > 0 && <button type="button" onClick={() => setCatOpen(true)} className={btnGhost}><BookOpen size={14} /> Dari katalog produk</button>}
      </div>
      {catOpen && (
        <Modal title="Pilih dari katalog produk" onClose={() => setCatOpen(false)}>
          <div className="grid max-h-[60vh] gap-2 overflow-y-auto">
            {catalog.map((p, i) => (
              <button key={i} type="button" onClick={() => { const added = itemFromProduct(p); const onlyEmpty = items.length === 1 && !items[0].name.trim(); onChange(onlyEmpty ? [added] : [...items, added]); setCatOpen(false); }}
                className="rounded-inner border border-slate-200 px-3 py-2 text-left hover:border-orange-300 hover:bg-orange-50/40">
                <div className="text-[13px] font-semibold text-slate-900">{p.name}</div>
                {p.description && <div className="text-[11.5px] text-slate-500">{p.description}</div>}
                {p.price && <div className="text-[11.5px] text-slate-500">Harga di katalog: {p.price}</div>}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ editor --
export default function DocEditor({ doc: initial, settings, leads, isEnterprise, docs, onClose, onChanged, onOpenDoc, onDuplicate, onNotify }) {
  const [d, setD] = useState(initial);
  const [dirty, setDirty] = useState(!initial.id);
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState(null);
  const [payments, setPayments] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [mobileView, setMobileView] = useState("form");
  const [leadQuery, setLeadQuery] = useState("");
  const [leadOpen, setLeadOpen] = useState(false);

  const isDraft = !d.issued_at;
  const meta = KIND_META[d.kind];
  const branding = useMemo(() => brandingOf(d, settings), [d, settings]);
  const totals = useMemo(() => computeDocTotals(d), [d]);
  const html = useMemo(() => buildDocumentHtml(d, branding), [d, branding]);
  const sourceDoc = d.source_quotation_id ? (docs || []).find((x) => x.id === d.source_quotation_id) : null;
  const convertedDoc = d.converted_invoice_id ? (docs || []).find((x) => x.id === d.converted_invoice_id) : null;
  const leadName = d.lead_id ? (leads || []).find((l) => l.id === d.lead_id)?.name : "";

  const patch = useCallback((p) => { setD((prev) => ({ ...prev, ...p })); setDirty(true); }, []);
  const patchCustomer = (p) => patch({ customer: { ...d.customer, ...p } });

  useEffect(() => { if (isEnterprise && isDraft) db.getProductCatalog().then((c) => setCatalog((c.products || []).filter((p) => p?.name))).catch(() => {}); }, [isEnterprise, isDraft]);
  useEffect(() => {
    if (d.id && d.kind === "invoice" && d.issued_at) db.listDocumentPayments(d.id).then(setPayments).catch(() => setPayments([]));
    else setPayments([]);
  }, [d.id, d.kind, d.issued_at, d.amount_paid]);

  const requestClose = () => { if (dirty && isDraft && !window.confirm("Perubahan pada draf ini belum disimpan. Tutup tanpa menyimpan?")) return; onClose(); };
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !dialog) requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const apply = (row) => { setD(row); setDirty(false); onChanged(row); };
  const run = async (key, fn, okMsg) => {
    setBusy(key);
    try { const r = await fn(); if (okMsg) onNotify(okMsg, "success"); return r; }
    catch (e) { onNotify(errText(e), "error"); return null; }
    finally { setBusy(""); }
  };

  const saveDraft = async () => {
    const row = await run("save", () => db.saveDocumentDraft({ ...d, items: cleanItems(d.items) }), "Draf disimpan.");
    if (row) { apply(row); return row; }
    return null;
  };
  const issue = async () => {
    const err = validateForIssue(d);
    if (err) { onNotify(err, "error"); return; }
    if (!window.confirm(`Terbitkan ${meta.label.toLowerCase()} ini? Setelah terbit, nomor dan isinya tidak bisa diubah.`)) return;
    const saved = await saveDraft();
    if (!saved) return;
    const row = await run("issue", () => db.issueDocument(saved.id));
    if (row) { apply(row); onNotify(`${meta.label} ${row.number} diterbitkan.`, "success"); }
  };
  const removeDraft = async () => {
    if (!window.confirm("Hapus draf ini? Tindakan ini tidak bisa dibatalkan.")) return;
    if (!d.id) { onClose(); return; }
    const ok = await run("del", () => db.deleteDocumentDraft(d.id).then(() => true), "Draf dihapus.");
    if (ok) { onChanged({ ...d, _deleted: true }); onClose(); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(db.PUBLIC_DOC_BASE + d.public_token); onNotify("Tautan disalin. Customer bisa membukanya tanpa login.", "success"); }
    catch { window.prompt("Salin tautan ini:", db.PUBLIC_DOC_BASE + d.public_token); }
  };
  const setQuoteStatus = async (status) => { const row = await run("status", () => db.setQuotationStatus(d.id, status), status === "accepted" ? "Quotation ditandai diterima." : status === "rejected" ? "Quotation ditandai ditolak." : "Status dikembalikan ke Terbit."); if (row) apply(row); };
  const convert = async () => {
    if (!window.confirm("Buat invoice dari quotation ini? Item dan harga akan disalin ke draf invoice baru yang bisa Anda periksa dulu.")) return;
    const newId = await run("convert", () => db.convertQuotationToInvoice(d.id), "Draf invoice dibuat dari quotation.");
    if (newId) { const fresh = await db.getDocument(d.id).catch(() => null); if (fresh) apply(fresh); onOpenDoc(newId); }
  };
  const voidIt = async () => {
    if (!window.confirm("Batalkan invoice ini? Invoice yang dibatalkan tidak bisa diaktifkan lagi.")) return;
    const row = await run("void", () => db.voidDocument(d.id), "Invoice dibatalkan.");
    if (row) apply(row);
  };
  const delPayment = async (p) => {
    if (!window.confirm(`Hapus catatan pembayaran ${rp(p.amount)} tanggal ${fmtDateShort(p.paid_on)}?`)) return;
    const row = await run("delpay", () => db.deleteDocumentPayment(p.id), "Catatan pembayaran dihapus.");
    if (row) apply(row);
  };
  const toggleReminders = async () => {
    const next = !d.reminders_enabled;
    const ok = await run("rem", () => db.setDocumentReminders(d.id, next).then(() => true));
    if (ok) apply({ ...d, reminders_enabled: next });
  };
  const refreshAfterSend = async () => { const row = await db.getDocument(d.id).catch(() => null); if (row) apply(row); setDialog(null); };

  const status = effectiveStatus(d);
  const out = outstanding(d);
  const late = daysOverdue(d);
  const leadMatches = useMemo(() => {
    const q = leadQuery.trim().toLowerCase();
    if (!q) return (leads || []).slice(0, 6);
    return (leads || []).filter((l) => (l.name || "").toLowerCase().includes(q)).slice(0, 6);
  }, [leads, leadQuery]);

  const formPane = isDraft ? (
    <div className="grid gap-4">
      <Panel className="p-5">
        <PanelHeader title="Customer" meta="Ketik nama lead untuk mengisi data otomatis, atau isi manual." />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="relative sm:col-span-2">
            <span className={lbl}>Nama customer / perusahaan *</span>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <input className={field + " !pl-8"} maxLength={160} value={d.customer.name}
                onChange={(e) => { patchCustomer({ name: e.target.value }); setLeadQuery(e.target.value); setLeadOpen(true); }}
                onFocus={() => setLeadOpen(true)} onBlur={() => setTimeout(() => setLeadOpen(false), 150)} placeholder="Cari lead atau ketik nama baru" />
            </div>
            {leadOpen && leadMatches.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-float">
                {leadMatches.map((l) => (
                  <button key={l.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { patch({ lead_id: l.id, customer: { ...customerFromLead(l), npwp: d.customer.npwp || "" } }); setLeadOpen(false); }}
                    className="block w-full px-3 py-2 text-left text-[13px] hover:bg-orange-50">
                    <span className="font-medium text-slate-900">{l.name}</span>{l.key_person && <span className="ml-2 text-[11.5px] text-slate-500">{l.key_person}</span>}
                  </button>
                ))}
              </div>
            )}
            {d.lead_id && <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-slate-500"><Pill tone="brand">Terhubung ke lead {leadName || ""}</Pill><button type="button" className="underline" onClick={() => patch({ lead_id: null })}>Lepas</button></div>}
          </div>
          <label><span className={lbl}>Nama kontak (U.p.)</span><input className={field} maxLength={120} value={d.customer.contact} onChange={(e) => patchCustomer({ contact: e.target.value })} /></label>
          <label><span className={lbl}>Email</span><input type="email" className={field} maxLength={120} value={d.customer.email} onChange={(e) => patchCustomer({ email: e.target.value })} /></label>
          <label><span className={lbl}>Telepon</span><input className={field} maxLength={40} value={d.customer.phone} onChange={(e) => patchCustomer({ phone: e.target.value })} /></label>
          <label><span className={lbl}>NPWP (opsional)</span><input className={field} maxLength={30} value={d.customer.npwp} onChange={(e) => patchCustomer({ npwp: e.target.value })} /></label>
          <label className="sm:col-span-2"><span className={lbl}>Alamat</span><textarea className={field} rows={2} maxLength={300} value={d.customer.address} onChange={(e) => patchCustomer({ address: e.target.value })} /></label>
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader title="Tanggal" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label><span className={lbl}>Tanggal {meta.label.toLowerCase()}</span><input type="date" className={field} value={d.issue_date} onChange={(e) => patch({ issue_date: e.target.value })} /></label>
          <div>
            <label><span className={lbl}>{meta.dateLabel}</span><input type="date" className={field} value={d.due_date || ""} onChange={(e) => patch({ due_date: e.target.value })} /></label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {[7, 14, 30, 45].map((n) => <button key={n} type="button" onClick={() => patch({ due_date: addDaysISO(d.issue_date, n) })} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-200">+{n} hari</button>)}
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader title="Item" meta="Harga satuan dan diskon baris dihitung otomatis." />
        <div className="mt-4"><ItemsEditor items={d.items} onChange={(items) => patch({ items })} catalog={catalog} /></div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader title="Diskon dan pajak" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <span className={lbl}>Diskon seluruh dokumen</span>
            <div className="flex gap-2">
              <select className={field + " !w-24 shrink-0"} value={d.discount_type} onChange={(e) => patch({ discount_type: e.target.value, discount_value: 0 })} aria-label="Jenis diskon"><option value="amount">Rp</option><option value="percent">%</option></select>
              {d.discount_type === "percent"
                ? <input type="number" min="0" max="100" step="any" className={field} value={d.discount_value} onChange={(e) => patch({ discount_value: e.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(e.target.value))) })} />
                : <input className={field} inputMode="numeric" value={fmtInt(d.discount_value || "")} onChange={(e) => patch({ discount_value: Number(digits(e.target.value)) || 0 })} />}
            </div>
          </div>
          <div className="rounded-inner border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-[13px] font-semibold text-slate-800"><input type="checkbox" checked={!!d.tax_on} onChange={(e) => patch({ tax_on: e.target.checked })} className="h-4 w-4 accent-orange-600" /> Kenakan pajak</label>
            {d.tax_on && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label><span className={lbl}>Nama</span><input className={field} maxLength={20} value={d.tax_label} onChange={(e) => patch({ tax_label: e.target.value })} /></label>
                <label><span className={lbl}>Tarif (%)</span><input type="number" min="0" max="100" step="0.1" className={field} value={d.tax_rate} onChange={(e) => patch({ tax_rate: e.target.value === "" ? 0 : Math.min(100, Math.max(0, Number(e.target.value))) })} /></label>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel className="p-5">
        <PanelHeader title="Catatan dan ketentuan" />
        <div className="mt-4 grid gap-3">
          <label><span className={lbl}>Catatan untuk customer (opsional)</span><textarea className={field} rows={2} maxLength={2000} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} /></label>
          <label><span className={lbl}>Syarat dan ketentuan</span><textarea className={field} rows={4} maxLength={4000} value={d.terms} onChange={(e) => patch({ terms: e.target.value })} /></label>
        </div>
      </Panel>
    </div>
  ) : (
    <div className="grid gap-4">
      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><div className="text-[12px] text-slate-500">{meta.label}</div><div className="text-[18px] font-bold tracking-[-0.02em] text-ink">{d.number}</div></div>
          <StatusPill doc={d} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
          <div><dt className="text-[11.5px] text-slate-500">Customer</dt><dd className="font-semibold text-slate-900">{d.customer.name}</dd></div>
          <div><dt className="text-[11.5px] text-slate-500">Total</dt><dd className="font-semibold text-slate-900 tabular-nums">{rp(d.total)}</dd></div>
          <div><dt className="text-[11.5px] text-slate-500">Tanggal</dt><dd>{fmtDateShort(d.issue_date)}</dd></div>
          <div><dt className="text-[11.5px] text-slate-500">{meta.dateLabel}</dt><dd className={late > 0 ? "font-semibold text-rose-700" : ""}>{fmtDateShort(d.due_date)}{late > 0 ? ` (terlambat ${late} hari)` : ""}</dd></div>
          {d.kind === "invoice" && <><div><dt className="text-[11.5px] text-slate-500">Sudah dibayar</dt><dd className="tabular-nums">{rp(d.amount_paid)}</dd></div>
            <div><dt className="text-[11.5px] text-slate-500">Sisa tagihan</dt><dd className="font-semibold tabular-nums">{rp(out)}</dd></div></>}
          {leadName && <div className="col-span-2"><dt className="text-[11.5px] text-slate-500">Lead</dt><dd>{leadName}</dd></div>}
          {sourceDoc && <div className="col-span-2"><dt className="text-[11.5px] text-slate-500">Berasal dari quotation</dt><dd><button type="button" className="font-semibold text-brand-strong hover:underline" onClick={() => onOpenDoc(sourceDoc.id)}>{sourceDoc.number}</button></dd></div>}
          {convertedDoc && <div className="col-span-2"><dt className="text-[11.5px] text-slate-500">Sudah dijadikan invoice</dt><dd><button type="button" className="font-semibold text-brand-strong hover:underline" onClick={() => onOpenDoc(convertedDoc.id)}>{convertedDoc.number || "Draf invoice"}</button></dd></div>}
        </dl>
      </Panel>

      <Panel className="p-5">
        <PanelHeader title="Aksi" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={btnPrimary} onClick={() => printHtml(html)}><Printer size={14} /> Cetak / simpan PDF</button>
          {status !== "void" && <button type="button" className={btnGhost} onClick={() => setDialog("send")}><Send size={14} /> Kirim email</button>}
          <button type="button" className={btnGhost} onClick={copyLink}><Link2 size={14} /> Salin tautan</button>
          <button type="button" className={btnGhost} onClick={() => onDuplicate(d)}><Copy size={14} /> Duplikat</button>
        </div>
        {d.kind === "quotation" && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {!d.converted_invoice_id && d.status !== "rejected" && <button type="button" className={btnPrimary} onClick={convert} disabled={busy === "convert"}>{busy === "convert" ? <Spinner /> : <FileText size={14} />} Jadikan invoice</button>}
            {d.status === "issued" && <button type="button" className={btnGhost} onClick={() => setQuoteStatus("accepted")} disabled={!!busy}><CheckCircle2 size={14} /> Tandai diterima</button>}
            {d.status === "issued" && <button type="button" className={btnGhost} onClick={() => setQuoteStatus("rejected")} disabled={!!busy}><XCircle size={14} /> Tandai ditolak</button>}
            {(d.status === "accepted" || d.status === "rejected") && !d.converted_invoice_id && <button type="button" className={btnGhost} onClick={() => setQuoteStatus("issued")} disabled={!!busy}>Kembalikan ke Terbit</button>}
          </div>
        )}
        {d.kind === "invoice" && (d.status === "unpaid" || d.status === "partial") && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <button type="button" className={btnPrimary} onClick={() => setDialog("pay")}><Wallet size={14} /> Catat pembayaran</button>
            {Number(d.amount_paid) === 0 && <button type="button" className={btnDanger} onClick={voidIt} disabled={busy === "void"}><Ban size={14} /> Batalkan invoice</button>}
            <label className="ml-auto flex items-center gap-2 text-[12px] text-slate-600"><input type="checkbox" checked={!!d.reminders_enabled} onChange={toggleReminders} className="h-4 w-4 accent-orange-600" /> Pengingat otomatis ke customer</label>
          </div>
        )}
      </Panel>

      {d.kind === "invoice" && (
        <Panel className="p-5">
          <PanelHeader title="Riwayat pembayaran" />
          {payments.length === 0 ? <div className="mt-3"><EmptyState>Belum ada pembayaran tercatat.</EmptyState></div> : (
            <ul className="mt-3 divide-y divide-slate-100">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <div className="min-w-0"><div className="font-semibold tabular-nums text-slate-900">{rp(p.amount)}</div><div className="truncate text-[11.5px] text-slate-500">{fmtDateShort(p.paid_on)}{p.method ? ` · ${p.method}` : ""}{p.note ? ` · ${p.note}` : ""}</div></div>
                  {status !== "void" && <button type="button" onClick={() => delPayment(p)} aria-label="Hapus catatan pembayaran" className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {(d.email_log || []).length > 0 && (
        <Panel className="p-5">
          <PanelHeader title="Riwayat pengiriman" />
          <ul className="mt-3 grid gap-1.5 text-[12.5px] text-slate-600">
            {[...d.email_log].reverse().map((e, i) => <li key={i}>{fmtStamp(e.at)} · ke {e.to}{e.type.startsWith("due") || e.type.startsWith("overdue") ? " · pengingat otomatis" : ""}</li>)}
          </ul>
        </Panel>
      )}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[1000] overflow-y-auto bg-slate-100">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <button type="button" onClick={requestClose} className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[13px] font-semibold text-slate-600 hover:bg-slate-100"><ArrowLeft size={16} /> Kembali</button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold tracking-[-0.02em] text-ink">{isDraft ? (d.id ? "Edit draf" : "Draf baru") : d.number} · {meta.label}</div>
          </div>
          <StatusPill doc={d} />
          {isDraft && (
            <div className="flex flex-wrap items-center gap-2">
              {d.id && <button type="button" onClick={removeDraft} className={btnDanger + " !px-3 !py-1.5"} aria-label="Hapus draf"><Trash2 size={14} /></button>}
              <button type="button" onClick={saveDraft} disabled={!!busy || !dirty} className={btnGhost + " !py-1.5"}>{busy === "save" && <Spinner />} Simpan draf</button>
              <button type="button" onClick={issue} disabled={!!busy} className={btnPrimary + " !py-1.5"}>{busy === "issue" && <Spinner />} Terbitkan</button>
            </div>
          )}
        </div>
        <div className="mx-auto flex max-w-[1280px] gap-1 px-4 pb-2 lg:hidden">
          {[["form", isDraft ? "Isi dokumen" : "Ringkasan"], ["preview", "Pratinjau"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMobileView(k)} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${mobileView === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1280px] gap-4 px-4 py-4 pb-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div className={mobileView === "form" ? "" : "hidden lg:block"}>
          {formPane}
          {isDraft && (
            <Panel className="mt-4 p-5">
              <div className="grid gap-1.5 text-[13px]">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="tabular-nums">{rp(totals.subtotal)}</span></div>
                {totals.discount > 0 && <div className="flex justify-between text-slate-600"><span>Diskon</span><span className="tabular-nums">-{rp(totals.discount)}</span></div>}
                {d.tax_on && <div className="flex justify-between text-slate-600"><span>{d.tax_label || "Pajak"} ({Number(d.tax_rate) || 0}%)</span><span className="tabular-nums">{rp(totals.tax)}</span></div>}
                <div className="mt-1 flex justify-between border-t border-slate-200 pt-2 text-[16px] font-bold text-ink"><span>Total</span><span className="tabular-nums">{rp(totals.total)}</span></div>
              </div>
            </Panel>
          )}
        </div>
        <div className={`${mobileView === "preview" ? "" : "hidden lg:block"} lg:sticky lg:top-[72px] lg:self-start`}>
          <Panel className="overflow-hidden"><DocPreview html={html} /></Panel>
          {isDraft && <p className="mt-2 text-center text-[11.5px] text-slate-500">Pratinjau memakai pengaturan merek saat ini. Nomor diberikan saat dokumen diterbitkan.</p>}
        </div>
      </div>

      {dialog === "pay" && <PaymentDialog doc={d} onClose={() => setDialog(null)} onNotify={onNotify} onDone={(row) => { apply(row); setDialog(null); }} />}
      {dialog === "send" && <SendDialog doc={d} onClose={() => setDialog(null)} onNotify={onNotify} onDone={refreshAfterSend} />}
    </div>,
    document.body
  );
}
