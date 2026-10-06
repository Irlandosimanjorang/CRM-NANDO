// Logika Quotation & Invoice client (7 Okt 2026, permintaan Nando). Murni
// fungsi tanpa efek samping, dipakai tab Dokumen, halaman publik /dokumen,
// dan uji otomatis. Perhitungan total HARUS identik dengan fungsi SQL
// docs_compute_totals (supabase/migrations/20261007_documents.sql) - server
// tetap menjadi sumber kebenaran saat menyimpan.
import { terbilang } from "./docKit";

export const KIND_META = {
  quotation: { label: "Quotation", title: "Quotation", dateLabel: "Berlaku sampai", defaultPrefix: "QT" },
  invoice: { label: "Invoice", title: "Invoice", dateLabel: "Jatuh tempo", defaultPrefix: "INV" },
};

// tone mengikuti komponen Pill (src/ui).
export const STATUS_META = {
  draft: { label: "Draf", tone: "neutral" },
  issued: { label: "Terbit", tone: "brand" },
  accepted: { label: "Diterima", tone: "good" },
  rejected: { label: "Ditolak", tone: "bad" },
  expired: { label: "Kedaluwarsa", tone: "warn" },
  unpaid: { label: "Belum dibayar", tone: "warn" },
  partial: { label: "Dibayar sebagian", tone: "brand" },
  paid: { label: "Lunas", tone: "good" },
  overdue: { label: "Terlambat", tone: "bad" },
  void: { label: "Dibatalkan", tone: "neutral" },
};

export const rp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const todayWIB = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
export const addDaysISO = (iso, n) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
export const diffDays = (a, b) => Math.round((new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / 86400000);
export const fmtDateID = (iso) => (iso ? new Date(`${iso}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");
export const fmtDateShort = (iso) => (iso ? new Date(`${iso}T00:00:00+07:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-");

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

// Total satu baris item. Perkalian lebih dulu lalu dibagi 100 supaya
// pembulatan setengah sama dengan numeric di Postgres.
export function lineTotal(it) {
  const d = clamp(num(it.discount_pct), 0, 100);
  return Math.round((num(it.qty) * num(it.price) * (100 - d)) / 100);
}

export function computeDocTotals(doc) {
  const subtotal = (doc.items || []).reduce((s, it) => s + lineTotal(it), 0);
  const dv = Math.max(0, num(doc.discount_value));
  let discount = doc.discount_type === "percent" ? Math.round((subtotal * clamp(dv, 0, 100)) / 100) : Math.min(dv, subtotal);
  discount = Math.min(discount, subtotal);
  const tax = doc.tax_on ? Math.round(((subtotal - discount) * clamp(num(doc.tax_rate), 0, 100)) / 100) : 0;
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

// Status yang ditampilkan: tambahan "Terlambat" (invoice lewat jatuh tempo)
// dan "Kedaluwarsa" (quotation lewat masa berlaku) dihitung dari tanggal.
export function effectiveStatus(doc, today = todayWIB()) {
  if (doc.kind === "invoice" && (doc.status === "unpaid" || doc.status === "partial") && doc.due_date && doc.due_date < today) return "overdue";
  if (doc.kind === "quotation" && doc.status === "issued" && doc.due_date && doc.due_date < today) return "expired";
  return doc.status;
}

export const outstanding = (doc) =>
  doc.kind === "invoice" && (doc.status === "unpaid" || doc.status === "partial") ? Math.max(0, num(doc.total) - num(doc.amount_paid)) : 0;

export const daysOverdue = (doc, today = todayWIB()) => (outstanding(doc) > 0 && doc.due_date && doc.due_date < today ? diffDays(today, doc.due_date) : 0);

// Umur piutang: sisa tagihan dikelompokkan menurut keterlambatan.
export function agingBuckets(invoices, today = todayWIB()) {
  const b = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 };
  const n = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90: 0 };
  for (const inv of invoices) {
    const out = outstanding(inv);
    if (out <= 0) continue;
    const late = daysOverdue(inv, today);
    const k = late === 0 ? "current" : late <= 30 ? "d1_30" : late <= 60 ? "d31_60" : late <= 90 ? "d61_90" : "d90";
    b[k] += out; n[k] += 1;
  }
  return { amounts: b, counts: n, total: Object.values(b).reduce((a, c) => a + c, 0) };
}

export const emptyItem = () => ({ code: "", name: "", desc: "", qty: 1, unit: "", price: 0, discount_pct: 0 });
export const emptyCustomer = () => ({ name: "", contact: "", email: "", phone: "", address: "", npwp: "" });

export function customerFromLead(lead) {
  if (!lead) return emptyCustomer();
  return { ...emptyCustomer(), name: lead.name || "", contact: lead.key_person || "", email: lead.email || "", phone: lead.phone || "", address: lead.city || "" };
}

export const DEFAULT_SETTINGS = {
  seller: {},
  accent: "#c2410c",
  quotation_prefix: "QT",
  invoice_prefix: "INV",
  quotation_terms: "",
  invoice_terms: "",
  footer_text: "",
  tax_label: "PPN",
  default_tax_rate: 11,
  default_tax_on: false,
  default_validity_days: 14,
  default_due_days: 14,
};

export function newDraft(kind, settings, lead = null) {
  const s = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  const today = todayWIB();
  return {
    kind, status: "draft", number: null,
    lead_id: lead?.id || null,
    customer: customerFromLead(lead),
    issue_date: today,
    due_date: addDaysISO(today, kind === "quotation" ? s.default_validity_days : s.default_due_days),
    items: [emptyItem()],
    discount_type: "amount", discount_value: 0,
    tax_on: !!s.default_tax_on, tax_rate: num(s.default_tax_rate), tax_label: s.tax_label || "PPN",
    notes: "", terms: kind === "quotation" ? s.quotation_terms : s.invoice_terms,
    amount_paid: 0,
  };
}

// Item dari katalog produk Enterprise (org_product_catalog.products).
export function itemFromProduct(p) {
  // Harga di katalog berupa teks bebas (mis. "Rp 1.500.000"); ambil angkanya saja.
  const price = parseInt(String(p?.price ?? "").replace(/[^d]/g, ""), 10) || 0;
  return { ...emptyItem(), name: p?.name || "", desc: p?.description ? String(p.description) : "", price };
}

// Validasi sebelum terbit - pesan untuk pengguna.
export function validateForIssue(doc) {
  if (!String(doc.customer?.name || "").trim()) return "Nama customer wajib diisi.";
  const items = (doc.items || []).filter((it) => String(it.name || "").trim());
  if (items.length === 0) return "Tambahkan minimal satu item dengan nama.";
  if ((doc.items || []).some((it) => String(it.name || "").trim() === "" && (num(it.price) > 0 || num(it.qty) !== 1))) return "Ada baris item yang belum diberi nama.";
  if ((doc.items || []).some((it) => num(it.qty) <= 0)) return "Jumlah item harus lebih dari nol.";
  if (!doc.due_date) return `Isi tanggal ${doc.kind === "quotation" ? "berlaku sampai" : "jatuh tempo"}.`;
  if (doc.due_date < doc.issue_date) return `Tanggal ${doc.kind === "quotation" ? "berlaku sampai" : "jatuh tempo"} tidak boleh sebelum tanggal dokumen.`;
  if (doc.kind === "invoice" && computeDocTotals(doc).total <= 0) return "Total invoice harus lebih dari nol.";
  return "";
}

// Hapus baris item kosong sebelum disimpan.
export const cleanItems = (items) => (items || []).filter((it) => String(it.name || "").trim() !== "");

// ---------------------------------------------------------------- HTML --
// Pembuat dokumen cetak/PDF. branding = { seller, accent, footer } diambil
// dari snapshot dokumen yang sudah terbit, atau pengaturan saat masih draf.
export function brandingOf(doc, settings) {
  if (doc.snapshot) return { seller: doc.snapshot.seller || {}, accent: doc.snapshot.accent || "#c2410c", footer: doc.snapshot.footer || "" };
  const s = settings || DEFAULT_SETTINGS;
  return { seller: s.seller || {}, accent: s.accent || "#c2410c", footer: s.footer_text || "" };
}

const nl2br = (s) => esc(s).replace(/\n/g, "<br>");
const safeColor = (c) => (/^#[0-9a-fA-F]{6}$/.test(c || "") ? c : "#c2410c");
const safeImg = (u) => (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u || "") ? u : "");
const fmtQty = (q) => String(Math.round(num(q) * 1000) / 1000).replace(".", ",");

export function buildDocumentHtml(doc, branding = brandingOf(doc, null)) {
  const seller = branding.seller || {};
  const accent = safeColor(branding.accent);
  const meta = KIND_META[doc.kind] || KIND_META.invoice;
  const t = computeDocTotals(doc);
  const status = effectiveStatus(doc);
  const st = doc.number ? STATUS_META[status] : null;
  const isInvoice = doc.kind === "invoice";
  const paid = num(doc.amount_paid);
  const logo = safeImg(seller.logoImage);
  const sign = safeImg(seller.signImage);
  const stamp = safeImg(seller.stampImage);
  const cust = doc.customer || {};
  const number = doc.number || "Draf";
  const sellerLines = [seller.address, [seller.email, seller.phone].filter(Boolean).join("  |  "), seller.npwp ? `NPWP ${seller.npwp}` : ""].filter(Boolean);
  const taxLabel = doc.tax_label || "PPN";
  const bank = isInvoice && seller.account
    ? [seller.bank && ["Bank", seller.bank], ["No. rekening", seller.account], seller.holder && ["Atas nama", seller.holder]]
        .filter(Boolean).map(([k, v]) => `<div class="row"><span>${k}</span><span${k === "No. rekening" ? ' class="acc"' : ""}>${esc(v)}</span></div>`).join("")
    : "";
  const items = cleanItems(doc.items);
  const rows = items.map((it, i) => {
    const d = clamp(num(it.discount_pct), 0, 100);
    return `<tr>
      <td class="no">${i + 1}</td>
      <td class="d"><b>${esc(it.name)}</b>${it.code ? `<small>Kode: ${esc(it.code)}</small>` : ""}${it.desc ? `<small>${nl2br(it.desc)}</small>` : ""}</td>
      <td class="r">${fmtQty(it.qty)}${it.unit ? ` ${esc(it.unit)}` : ""}</td>
      <td class="r">${rp(it.price)}</td>
      <td class="r">${d > 0 ? `${d}%` : "-"}</td>
      <td class="r">${rp(lineTotal(it))}</td>
    </tr>`;
  }).join("");
  const showRemaining = isInvoice && doc.number && (doc.status === "partial" || paid > 0);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(String(number).replaceAll("/", "-"))} ${esc(cust.name || "")}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html { overscroll-behavior: contain; }
  body { margin: 0; font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif; color: #1c2230; font-size: 12.5px; line-height: 1.6; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc { max-width: 760px; margin: 0 auto; padding: 36px 36px 28px; }
  .head { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: start; }
  .brand img { max-height: 54px; max-width: 220px; display: block; }
  .brand .wm { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
  .from { margin-top: 10px; color: #5b6475; }
  .from b { display: block; color: #1c2230; font-size: 13.5px; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; color: ${accent}; }
  .title .no { margin-top: 2px; color: #5b6475; font-variant-numeric: tabular-nums; }
  .title .st { margin-top: 6px; font-weight: 700; }
  .facts { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 20px; margin: 28px 0 24px; padding: 16px 0; border-top: 1px solid #d9dde4; border-bottom: 1px solid #d9dde4; }
  .k { color: #5b6475; font-size: 11.5px; font-weight: 600; margin-bottom: 3px; }
  .v { font-weight: 600; }
  .v small { display: block; font-weight: 400; color: #5b6475; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: #5b6475; font-size: 11.5px; font-weight: 600; padding: 0 0 8px; border-bottom: 1px solid #1c2230; }
  td { padding: 11px 0; border-bottom: 1px solid #e6e9ee; vertical-align: top; }
  td.no { width: 26px; color: #8a92a1; }
  td.d { padding-right: 14px; }
  td small { display: block; color: #5b6475; font-size: 11.5px; font-weight: 400; }
  .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-left: 12px; }
  .sum { margin: 16px 0 0 auto; width: 330px; }
  .sum .row { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; color: #5b6475; font-variant-numeric: tabular-nums; }
  .sum .grand { margin-top: 6px; padding-top: 10px; border-top: 2px solid #1c2230; color: #1c2230; font-size: 16px; font-weight: 700; }
  .sum .grand span:last-child { color: ${accent}; }
  .sum .due { color: #1c2230; font-weight: 700; }
  .words { margin-top: 10px; text-align: right; color: #5b6475; font-style: italic; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 26px; }
  h2 { margin: 0 0 6px; font-size: 13px; }
  .pay .row { display: grid; grid-template-columns: 110px 1fr; gap: 10px; padding: 3px 0; }
  .pay .acc { font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
  .pay .row span:first-child { color: #5b6475; }
  .muted { color: #5b6475; }
  .bottom { display: flex; justify-content: flex-end; margin-top: 26px; }
  .sign { text-align: center; width: 220px; }
  .sign .space { position: relative; height: 84px; display: flex; align-items: flex-end; justify-content: center; }
  .sign .space .ttd { max-height: 76px; max-width: 200px; position: relative; z-index: 2; }
  .sign .space .cap { position: absolute; left: 6px; top: -6px; height: 92px; max-width: 120px; opacity: 0.9; z-index: 1; }
  .sign .name { font-weight: 700; border-top: 1px solid #1c2230; padding-top: 6px; }
  .sign .role { color: #5b6475; }
  .foot { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e6e9ee; color: #8a92a1; font-size: 11px; display: flex; justify-content: space-between; gap: 16px; }
  @media print { .doc { max-width: none; padding: 16mm 18mm; } }
  @media (max-width: 560px) { .head, .info { grid-template-columns: 1fr; } .title { text-align: left; } .facts { grid-template-columns: 1fr; } .sum { width: 100%; } }
</style></head><body><div class="doc">
  <div class="head">
    <div>
      <div class="brand">${logo ? `<img src="${logo}" alt="${esc(seller.name || "")}">` : `<div class="wm">${esc(seller.name || "Nama perusahaan")}</div>`}</div>
      <div class="from">${logo ? `<b>${esc(seller.name || "")}</b>` : ""}${sellerLines.map((l) => `${esc(l)}<br>`).join("")}</div>
    </div>
    <div class="title">
      <h1>${meta.title}</h1>
      <div class="no">${esc(number)}</div>
      ${st ? `<div class="st" style="color:${status === "paid" || status === "accepted" ? "#15803d" : status === "overdue" || status === "rejected" ? "#b91c1c" : status === "void" || status === "expired" ? "#64748b" : accent}">${st.label}</div>` : ""}
    </div>
  </div>
  <div class="facts">
    <div><div class="k">${isInvoice ? "Ditagihkan kepada" : "Ditujukan kepada"}</div><div class="v">${esc(cust.name || "Nama customer")}${cust.contact ? `<small>U.p. ${esc(cust.contact)}</small>` : ""}${cust.address ? `<small>${nl2br(cust.address)}</small>` : ""}${cust.email ? `<small>${esc(cust.email)}</small>` : ""}${cust.phone ? `<small>${esc(cust.phone)}</small>` : ""}${cust.npwp ? `<small>NPWP ${esc(cust.npwp)}</small>` : ""}</div></div>
    <div><div class="k">Tanggal ${isInvoice ? "invoice" : "quotation"}</div><div class="v">${fmtDateID(doc.issue_date)}</div></div>
    <div><div class="k">${meta.dateLabel}</div><div class="v">${fmtDateID(doc.due_date)}</div></div>
  </div>
  <table>
    <thead><tr><th class="no">No</th><th>Deskripsi</th><th class="r">Jumlah</th><th class="r">Harga satuan</th><th class="r">Diskon</th><th class="r">Subtotal</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="6" class="muted" style="text-align:center;padding:22px 0">Belum ada item.</td></tr>`}</tbody>
  </table>
  <div class="sum">
    <div class="row"><span>Subtotal</span><span>${rp(t.subtotal)}</span></div>
    ${t.discount > 0 ? `<div class="row"><span>Diskon${doc.discount_type === "percent" ? ` (${num(doc.discount_value)}%)` : ""}</span><span>-${rp(t.discount)}</span></div>` : ""}
    ${doc.tax_on ? `<div class="row"><span>${esc(taxLabel)} (${num(doc.tax_rate)}%)</span><span>${rp(t.tax)}</span></div>` : ""}
    <div class="row grand"><span>Total</span><span>${rp(t.total)}</span></div>
    ${showRemaining ? `<div class="row"><span>Sudah dibayar</span><span>-${rp(paid)}</span></div><div class="row due"><span>Sisa tagihan</span><span>${rp(Math.max(0, t.total - paid))}</span></div>` : ""}
  </div>
  <div class="words">Terbilang: ${terbilang(t.total)}</div>
  <div class="info">
    <div class="pay">
      ${bank ? `<h2>Cara pembayaran</h2>${bank}<p class="muted" style="margin:6px 0 0">${doc.number ? `Cantumkan nomor ${esc(number)} pada berita pembayaran.` : "Cantumkan nomor invoice pada berita pembayaran."}</p>` : ""}
      ${doc.notes ? `<h2 style="margin-top:${bank ? 16 : 0}px">Catatan</h2><div>${nl2br(doc.notes)}</div>` : ""}
    </div>
    <div>${doc.terms ? `<h2>Syarat dan ketentuan</h2><div class="muted">${nl2br(doc.terms)}</div>` : ""}</div>
  </div>
  <div class="bottom"><div class="sign">
    <div>Hormat kami,</div>
    <div class="space">${stamp ? `<img class="cap" src="${stamp}" alt="">` : ""}${sign ? `<img class="ttd" src="${sign}" alt="Tanda tangan">` : ""}</div>
    <div class="name">${esc(seller.signName || seller.name || "")}</div>
    ${seller.signTitle ? `<div class="role">${esc(seller.signTitle)}</div>` : ""}
  </div></div>
  <div class="foot"><span>${esc(branding.footer || "")}</span><span>${esc(number)}</span></div>
</div></body></html>`;
}
