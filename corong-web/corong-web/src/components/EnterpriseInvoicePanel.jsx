import { useEffect, useMemo, useRef, useState } from "react";
import { MAYAR_PAYMENT_LINK } from "../lib/plans";
import * as db from "../lib/db";

// Invoice langganan Nexto (2 Okt 2026, permintaan Nando) - khusus admin
// platform, di Command Center (kartu INVOICE). Ketik nama perusahaan klien:
// kalau cocok dengan klien berbayar di Nexto, paket, owner & jumlah anggota
// terisi otomatis. Tanpa PPN (keputusan Nando).
//
// Invoice DISIMPAN (tabel admin_invoices lewat edge function admin-invoices)
// supaya nomornya berurutan per tahun (INV/NXT/2026/10/0001, 0002, ...) dan
// statusnya bisa dilacak (Belum dibayar / Lunas / Dibatalkan). Invoice yang
// sudah tersimpan tidak bisa diubah - buat invoice baru untuk koreksi.
// PDF dibuat lewat dialog cetak browser ("Simpan sebagai PDF").

const EARLY_BIRD_DEADLINE = new Date("2026-10-15T23:59:59+07:00"); // sama dengan Auth.jsx
const PROFILE_KEY = "nexto-invoice-seller";

// Harga per pengguna/bulan mengikuti PRICING_EARLY_BIRD / PRICING_NORMAL di
// Auth.jsx - kalau harga di sana berubah, samakan di sini.
const PLANS = {
  standard: { label: "Standard", item: "Langganan Nexto Standard", unit: "pengguna", early: 59000, normal: 89000, minSeats: 1 },
  professional: { label: "Professional", item: "Langganan Nexto Professional", unit: "pengguna", early: 229000, normal: 249000, minSeats: 1 },
  enterprise: { label: "Enterprise", item: "Langganan Nexto Enterprise", unit: "anggota tim", early: 249000, normal: 279000, minSeats: 4 },
  custom: { label: "Custom", item: "", unit: "pengguna", early: 0, normal: 0, minSeats: 1 },
};
const priceOf = (plan) => (new Date() < EARLY_BIRD_DEADLINE ? PLANS[plan].early : PLANS[plan].normal);
const DEFAULT_LINKS = { standard: MAYAR_PAYMENT_LINK, professional: MAYAR_PAYMENT_LINK, enterprise: MAYAR_PAYMENT_LINK, custom: MAYAR_PAYMENT_LINK };

const STATUS = {
  unpaid: { label: "Belum dibayar", color: "#b45309" },
  paid: { label: "Lunas", color: "#15803d" },
  void: { label: "Dibatalkan", color: "#64748b" },
};

const rp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const isoDay = (d) => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);
const addDays = (iso, n) => isoDay(new Date(new Date(iso + "T00:00:00+07:00").getTime() + n * 86400000));
const addMonths = (iso, n) => {
  const t = new Date(iso + "T00:00:00+07:00");
  t.setMonth(t.getMonth() + n); t.setDate(t.getDate() - 1);
  return isoDay(t);
};
const fmtDate = (iso) => new Date(iso + "T00:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const fmtShort = (iso) => new Date(iso + "T00:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" });
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Terbilang rupiah - lazim di invoice B2B Indonesia.
const SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
function terbilangInt(n) {
  n = Math.floor(n);
  if (n < 12) return SATUAN[n];
  if (n < 20) return `${terbilangInt(n - 10)} belas`;
  if (n < 100) return `${terbilangInt(Math.floor(n / 10))} puluh ${terbilangInt(n % 10)}`.trim();
  if (n < 200) return `seratus ${terbilangInt(n - 100)}`.trim();
  if (n < 1000) return `${terbilangInt(Math.floor(n / 100))} ratus ${terbilangInt(n % 100)}`.trim();
  if (n < 2000) return `seribu ${terbilangInt(n - 1000)}`.trim();
  if (n < 1e6) return `${terbilangInt(Math.floor(n / 1000))} ribu ${terbilangInt(n % 1000)}`.trim();
  if (n < 1e9) return `${terbilangInt(Math.floor(n / 1e6))} juta ${terbilangInt(n % 1e6)}`.trim();
  if (n < 1e12) return `${terbilangInt(Math.floor(n / 1e9))} miliar ${terbilangInt(n % 1e9)}`.trim();
  return `${terbilangInt(Math.floor(n / 1e12))} triliun ${terbilangInt(n % 1e12)}`.trim();
}
export function terbilang(n) {
  const v = Math.round(Number(n) || 0);
  if (v === 0) return "Nol rupiah";
  const t = terbilangInt(v).replace(/\s+/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1) + " rupiah";
}

function loadProfile() {
  const base = { name: "Nexto", address: "", email: "", phone: "", bank: "", account: "", holder: "", signName: "", signTitle: "", links: DEFAULT_LINKS };
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return { ...base, ...saved, links: { ...DEFAULT_LINKS, ...(saved.links || {}) } };
  } catch (_) {
    return base;
  }
}

// Hitung semua angka dari data invoice (dipakai draf & invoice tersimpan).
function computeTotals(d) {
  const subtotal = (Number(d.seats) || 0) * (Number(d.pricePerSeat) || 0) * (Number(d.months) || 0);
  const raw = d.discountType === "percent" ? subtotal * (Number(d.discountValue) || 0) / 100 : Number(d.discountValue) || 0;
  const discount = Math.min(Math.max(0, Math.round(raw)), subtotal);
  return { subtotal, discount, total: subtotal - discount };
}

/** d = data invoice (draf atau tersimpan), meta = { number, status, paidAt } */
export function buildInvoiceHtml(d, meta = {}) {
  const seller = d.seller || {};
  const { subtotal, discount, total } = computeTotals(d);
  const sellerLines = [seller.address, seller.email, seller.phone, "nexto.site"].filter(Boolean);
  const bank = seller.bank && seller.account
    ? `<div class="row"><span>Transfer bank</span><span>${esc(seller.bank)} ${esc(seller.account)}${seller.holder ? `, a.n. ${esc(seller.holder)}` : ""}</span></div>`
    : "";
  const logo = `${window.location.origin}/nexto-logo.png`;
  const number = meta.number || "Draf";
  const st = meta.status ? STATUS[meta.status] : null;
  const discountLabel = d.discountLabel?.trim() || "Diskon";
  // Gaya invoice akuntansi: label huruf biasa, garis tipis, total ditandai
  // garis tebal, oranye Nexto hanya untuk angka total.
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(number)} - ${esc(d.company)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  html { overscroll-behavior: contain; }
  body { margin: 0; font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif; color: #1c2230; font-size: 12.5px; line-height: 1.6; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc { max-width: 760px; margin: 0 auto; padding: 36px 36px 28px; }
  .head { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: start; }
  .logo { display: inline-block; background: #1c2230; padding: 8px 12px; border-radius: 4px; }
  .logo img { height: 20px; width: auto; display: block; }
  .from { margin-top: 12px; color: #5b6475; }
  .from b { display: block; color: #1c2230; font-size: 13.5px; }
  .title { text-align: right; }
  .title h1 { margin: 0; font-size: 30px; font-weight: 700; letter-spacing: -0.02em; }
  .title .no { margin-top: 2px; color: #5b6475; font-variant-numeric: tabular-nums; }
  .title .st { margin-top: 6px; font-weight: 700; }
  .facts { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 20px; margin: 30px 0 26px; padding: 16px 0; border-top: 1px solid #d9dde4; border-bottom: 1px solid #d9dde4; }
  .k { color: #5b6475; font-size: 11.5px; font-weight: 600; margin-bottom: 3px; }
  .v { font-weight: 600; }
  .v small { display: block; font-weight: 400; color: #5b6475; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: #5b6475; font-size: 11.5px; font-weight: 600; padding: 0 0 8px; border-bottom: 1px solid #1c2230; }
  td { padding: 14px 0; border-bottom: 1px solid #e6e9ee; vertical-align: top; }
  td.d { padding-right: 16px; }
  td small { display: block; color: #5b6475; font-size: 12px; }
  .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-left: 16px; }
  .sum { margin: 18px 0 0 auto; width: 320px; }
  .sum .row { display: flex; justify-content: space-between; gap: 16px; padding: 5px 0; color: #5b6475; font-variant-numeric: tabular-nums; }
  .sum .grand { margin-top: 6px; padding-top: 10px; border-top: 2px solid #1c2230; color: #1c2230; font-size: 16px; font-weight: 700; }
  .sum .grand span:last-child { color: #c2410c; }
  .words { margin-top: 10px; text-align: right; color: #5b6475; font-style: italic; }
  .pay { margin-top: 32px; }
  h2 { margin: 0 0 8px; font-size: 13px; }
  .pay .row { display: grid; grid-template-columns: 130px 1fr; gap: 12px; padding: 4px 0; }
  .pay .row span:first-child { color: #5b6475; }
  .pay a { color: #1c2230; word-break: break-all; }
  .pay p { margin: 8px 0 0; color: #5b6475; }
  .bottom { display: grid; grid-template-columns: 1fr 220px; gap: 32px; margin-top: 28px; align-items: end; }
  .sign { text-align: center; }
  .sign .space { height: 72px; }
  .sign .name { font-weight: 700; border-top: 1px solid #1c2230; padding-top: 6px; }
  .sign .role { color: #5b6475; }
  .foot { margin-top: 36px; padding-top: 12px; border-top: 1px solid #e6e9ee; color: #8a92a1; font-size: 11px; display: flex; justify-content: space-between; }
  @media print { .doc { padding: 0; } }
</style></head><body><div class="doc">
  <div class="head">
    <div>
      <div class="logo"><img src="${logo}" alt="Nexto"></div>
      <div class="from"><b>${esc(seller.name || "Nexto")}</b>${sellerLines.map((l) => `${esc(l)}<br>`).join("")}</div>
    </div>
    <div class="title">
      <h1>Invoice</h1>
      <div class="no">${esc(number)}</div>
      ${st ? `<div class="st" style="color:${st.color}">${st.label}${meta.status === "paid" && meta.paidAt ? `, ${fmtShort(meta.paidAt.slice(0, 10))}` : ""}</div>` : ""}
    </div>
  </div>
  <div class="facts">
    <div><div class="k">Ditagihkan kepada</div><div class="v">${esc(d.company || "Nama perusahaan")}${d.contact ? `<small>${esc(d.contact)}</small>` : ""}${d.address ? `<small>${esc(d.address).replace(/\n/g, "<br>")}</small>` : ""}${d.email ? `<small>${esc(d.email)}</small>` : ""}</div></div>
    <div><div class="k">Tanggal invoice</div><div class="v">${fmtDate(d.date)}</div><div class="k" style="margin-top:10px">Jatuh tempo</div><div class="v">${fmtDate(d.due)}</div>${d.po ? `<div class="k" style="margin-top:10px">Nomor PO</div><div class="v">${esc(d.po)}</div>` : ""}</div>
    <div><div class="k">Periode langganan</div><div class="v">${fmtDate(d.start)}<small>sampai ${fmtDate(d.end)}</small></div></div>
  </div>
  <table>
    <thead><tr><th>Deskripsi</th><th class="r">Jumlah</th><th class="r">Harga satuan</th><th class="r">Subtotal</th></tr></thead>
    <tbody><tr>
      <td class="d"><b>${esc(d.item)}</b><small>${d.seats} ${esc(d.unit)}, ${d.months} bulan</small></td>
      <td class="r">${d.seats * d.months}</td>
      <td class="r">${rp(d.pricePerSeat)}<small>per ${esc(d.unit)}/bulan</small></td>
      <td class="r">${rp(subtotal)}</td>
    </tr></tbody>
  </table>
  <div class="sum">
    <div class="row"><span>Subtotal</span><span>${rp(subtotal)}</span></div>
    ${discount > 0 ? `<div class="row"><span>${esc(discountLabel)}${d.discountType === "percent" ? ` (${Number(d.discountValue)}%)` : ""}</span><span>-${rp(discount)}</span></div>` : ""}
    <div class="row grand"><span>Total tagihan</span><span>${rp(total)}</span></div>
  </div>
  <div class="words">Terbilang: ${terbilang(total)}</div>
  <div class="bottom">
    <div class="pay">
      <h2>Cara pembayaran</h2>
      ${d.payLink ? `<div class="row"><span>Pembayaran online</span><a href="${esc(d.payLink)}">${esc(d.payLink)}</a></div>` : ""}
      ${bank}
      <p>Cantumkan nomor ${esc(number)} pada berita pembayaran.</p>
      ${d.note ? `<h2 style="margin-top:18px">Catatan</h2><div>${esc(d.note).replace(/\n/g, "<br>")}</div>` : ""}
    </div>
    <div class="sign">
      <div>Hormat kami,</div>
      <div class="space"></div>
      <div class="name">${esc(seller.signName || seller.name || "Nexto")}</div>
      ${seller.signTitle ? `<div class="role">${esc(seller.signTitle)}</div>` : ""}
    </div>
  </div>
  <div class="foot"><span>Terima kasih telah menggunakan Nexto.</span><span>${esc(number)}</span></div>
</div></body></html>`;
}

// Cetak dokumen lewat iframe sementara (dialog cetak -> "Simpan sebagai PDF").
function printHtml(html) {
  // Tes otomatis (scripts/smoke) memasang window.__nextoPrintHook supaya
  // dialog cetak - yang menahan halaman - tidak terbuka saat pengujian.
  if (typeof window.__nextoPrintHook === "function") { window.__nextoPrintHook(html); return; }
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  f.srcdoc = html;
  f.onload = () => {
    const w = f.contentWindow;
    const done = () => setTimeout(() => f.remove(), 500);
    w.addEventListener("afterprint", done, { once: true });
    const imgs = [...w.document.images].filter((i) => !i.complete);
    Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))).then(() => { w.focus(); w.print(); });
    setTimeout(() => f.isConnected && f.remove(), 60000);
  };
  document.body.appendChild(f);
}

const field = "w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none disabled:opacity-60";
const lbl = "mb-1 block text-[11px] font-semibold text-slate-400";

export default function EnterpriseInvoicePanel({ users = [] }) {
  // Klien berbayar dari direktori user, per organisasi (paket, owner, jumlah anggota).
  const orgs = useMemo(() => {
    const map = new Map();
    for (const u of users || []) {
      if (!u.org_name || !PLANS[u.plan]) continue;
      const o = map.get(u.org_name) || { name: u.org_name, plan: u.plan, members: 0, owner: null };
      o.members += 1;
      if (u.plan === "enterprise") o.plan = "enterprise";
      if (u.role === "owner") o.owner = u;
      map.set(u.org_name, o);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const today = isoDay(new Date());
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [po, setPo] = useState("");
  const [plan, setPlan] = useState("enterprise");
  const [customItem, setCustomItem] = useState("");
  const [seats, setSeats] = useState(PLANS.enterprise.minSeats);
  const [months, setMonths] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState(priceOf("enterprise"));
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(today);
  const [dueDays, setDueDays] = useState(7);
  const [note, setNote] = useState("");
  const [seller, setSeller] = useState(loadProfile);
  const [showSeller, setShowSeller] = useState(false);
  const [viewing, setViewing] = useState(null); // invoice tersimpan yang sedang dilihat
  const [history, setHistory] = useState(null);
  const [historyErr, setHistoryErr] = useState("");
  const [busy, setBusy] = useState(false);
  const frameRef = useRef(null);

  const loadHistory = () => {
    setHistoryErr("");
    db.adminInvoices("list").then((r) => setHistory(r.invoices || [])).catch((e) => { setHistory([]); setHistoryErr(e.message); });
  };
  useEffect(loadHistory, []);

  const matched = orgs.find((o) => o.name.toLowerCase() === company.trim().toLowerCase()) || null;

  // Ganti paket -> harga & jumlah minimum ikut paket (tetap bisa diubah manual).
  const choosePlan = (next, members = 0) => {
    setPlan(next);
    if (next !== "custom") setPricePerSeat(priceOf(next));
    setSeats((cur) => {
      if (members) return Math.max(PLANS[next].minSeats, members);
      if (next === "custom") return Math.max(1, Number(cur) || 1);
      return PLANS[next].minSeats;
    });
  };

  useEffect(() => {
    if (!matched || viewing) return;
    setContact(matched.owner?.display_name || "");
    setEmail(matched.owner?.email || "");
    choosePlan(matched.plan, matched.members);
  }, [matched?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(seller)); } catch (_) {}
  }, [seller]);

  const payLink = (seller.links || DEFAULT_LINKS)[plan] || "";
  const setPayLink = (v) => setSeller((s) => ({ ...s, links: { ...(s.links || DEFAULT_LINKS), [plan]: v } }));

  // Data draf saat ini (juga yang disimpan ke database saat "Simpan").
  const draft = {
    company: company.trim(), contact: contact.trim(), email: email.trim(), address: address.trim(), po: po.trim(),
    plan, item: plan === "custom" ? (customItem.trim() || "Layanan Nexto") : PLANS[plan].item, unit: PLANS[plan].unit,
    seats: Math.max(1, Number(seats) || 1), months: Number(months) || 1, pricePerSeat: Number(pricePerSeat) || 0,
    discountLabel: discountLabel.trim(), discountType, discountValue: Number(discountValue) || 0,
    date, due: addDays(date, Number(dueDays) || 0), start, end: addMonths(start, Number(months) || 1),
    note: note.trim(), payLink: payLink.trim(),
    seller: { name: seller.name, address: seller.address, email: seller.email, phone: seller.phone, bank: seller.bank, account: seller.account, holder: seller.holder, signName: seller.signName, signTitle: seller.signTitle },
  };
  const shown = viewing ? viewing.data : draft;
  const html = viewing
    ? buildInvoiceHtml(viewing.data, { number: viewing.number, status: viewing.status, paidAt: viewing.paid_at })
    : buildInvoiceHtml(draft);
  const { total } = computeTotals(shown);

  // Pratinjau dimuat SEKALI, perubahan berikutnya hanya mengganti isi <body>
  // (tidak berkedip). Pratinjau punya scroll sendiri - overscroll-behavior
  // di dokumen invoice mencegah scroll merembet ke kartu/halaman.
  const [initialHtml] = useState(html);
  const syncFrame = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const next = new DOMParser().parseFromString(html, "text/html");
    if (doc.body.innerHTML !== next.body.innerHTML) doc.body.innerHTML = next.body.innerHTML;
    if (doc.title !== next.title) doc.title = next.title;
  };
  useEffect(syncFrame, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAndPrint = async () => {
    if (!company.trim()) { alert("Isi nama perusahaan terlebih dahulu."); return; }
    if (!window.confirm(`Simpan invoice untuk ${company.trim()} sebesar ${rp(total)}? Nomor invoice dibuat berurutan dan invoice tidak dapat diubah setelah disimpan.`)) return;
    setBusy(true);
    try {
      const { invoice } = await db.adminInvoices("create", { invoice: { company: draft.company, invoice_date: draft.date, due_date: draft.due, total, data: draft } });
      setViewing(invoice);
      setHistory((h) => [invoice, ...(h || []).filter((x) => x.id !== invoice.id)]);
      printHtml(buildInvoiceHtml(invoice.data, { number: invoice.number, status: invoice.status }));
    } catch (e) {
      alert("Gagal menyimpan invoice: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (inv, status) => {
    if (status === "void" && !window.confirm(`Batalkan invoice ${inv.number}? Nomornya tetap tercatat (tidak dipakai ulang).`)) return;
    try {
      const { invoice } = await db.adminInvoices("set_status", { id: inv.id, status });
      setHistory((h) => (h || []).map((x) => (x.id === inv.id ? { ...x, ...invoice } : x)));
      if (viewing?.id === inv.id) setViewing((v) => ({ ...v, ...invoice }));
    } catch (e) {
      alert("Gagal mengubah status: " + e.message);
    }
  };

  const newInvoice = () => { setViewing(null); setCompany(""); setContact(""); setEmail(""); setAddress(""); setPo(""); setNote(""); setDiscountValue(""); setDiscountLabel(""); setDate(today); setStart(today); };

  const unpaid = (history || []).filter((x) => x.status === "unpaid");
  const overdue = unpaid.filter((x) => x.due_date < today);
  const unpaidTotal = unpaid.reduce((s, x) => s + Number(x.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="space-y-3">
          {viewing && (
            <div className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2.5 text-[12px] text-violet-100">
              Menampilkan invoice tersimpan <b>{viewing.number}</b>. Invoice tersimpan tidak dapat diubah.
              <button type="button" onClick={newInvoice} className="ml-2 font-semibold underline underline-offset-2">Buat invoice baru</button>
            </div>
          )}
          <fieldset disabled={!!viewing} className="space-y-3">
            <div>
              <label className={lbl} htmlFor="inv-company">Nama perusahaan</label>
              <input id="inv-company" list="inv-orgs" className={field} value={viewing ? viewing.company : company} onChange={(e) => setCompany(e.target.value)} placeholder="Ketik nama perusahaan klien" autoComplete="off" />
              <datalist id="inv-orgs">{orgs.map((o) => <option key={o.name} value={o.name} />)}</datalist>
              {!viewing && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {matched ? `Klien ${PLANS[matched.plan].label} ditemukan: ${matched.members} anggota terdaftar, paket & data owner terisi otomatis.` : orgs.length ? `${orgs.length} klien berbayar tersedia di daftar saran.` : "Belum ada klien berbayar - isi data secara manual."}
                </p>
              )}
            </div>
            {!viewing && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={lbl}>Nama PIC</label><input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nama penanggung jawab" /></div>
                  <div><label className={lbl}>Email</label><input className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@perusahaan.com" /></div>
                </div>
                <div><label className={lbl}>Alamat perusahaan</label><textarea rows={2} className={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. ..., Kota, Kode pos" /></div>
                <div><label className={lbl}>Nomor PO klien (opsional)</label><input className={field} value={po} onChange={(e) => setPo(e.target.value)} placeholder="Misal: PO/2026/0153" /></div>
                <div>
                  <label className={lbl} htmlFor="inv-plan">Paket</label>
                  <select id="inv-plan" className={field} value={plan} onChange={(e) => choosePlan(e.target.value)}>
                    {Object.entries(PLANS).map(([k, p]) => (
                      <option key={k} value={k}>{k === "custom" ? "Custom (isi sendiri)" : `${p.label} - ${rp(priceOf(k))}/${p.unit}/bulan${p.minSeats > 1 ? `, min. ${p.minSeats}` : ""}`}</option>
                    ))}
                  </select>
                </div>
                {plan === "custom" && (
                  <div><label className={lbl}>Deskripsi layanan</label><input className={field} value={customItem} onChange={(e) => setCustomItem(e.target.value)} placeholder="Misal: Nexto Enterprise + onboarding tim" /></div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={lbl}>Jumlah {PLANS[plan].unit}</label><input type="number" min={PLANS[plan].minSeats} className={field} value={seats} onChange={(e) => setSeats(e.target.value)} /></div>
                  <div>
                    <label className={lbl}>Periode</label>
                    <select className={field} value={months} onChange={(e) => setMonths(e.target.value)}>
                      <option value={1}>1 bulan</option><option value={3}>3 bulan</option><option value={6}>6 bulan</option><option value={12}>12 bulan</option>
                    </select>
                  </div>
                  <div><label className={lbl}>Harga/{PLANS[plan].unit === "anggota tim" ? "anggota" : "pengguna"}</label><input type="number" min="0" step="1000" className={field} value={pricePerSeat} onChange={(e) => setPricePerSeat(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-[1fr_96px_110px] gap-3">
                  <div><label className={lbl}>Diskon (opsional)</label><input className={field} value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} placeholder="Misal: Diskon early bird" /></div>
                  <div>
                    <label className={lbl}>Jenis</label>
                    <select className={field} value={discountType} onChange={(e) => setDiscountType(e.target.value)}><option value="amount">Rp</option><option value="percent">%</option></select>
                  </div>
                  <div><label className={lbl}>Nilai</label><input type="number" min="0" className={field} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={lbl}>Tanggal invoice</label><input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></div>
                  <div><label className={lbl}>Mulai periode</label><input type="date" className={field} value={start} onChange={(e) => setStart(e.target.value)} /></div>
                  <div><label className={lbl}>Jatuh tempo</label>
                    <select className={field} value={dueDays} onChange={(e) => setDueDays(e.target.value)}>
                      <option value={3}>3 hari</option><option value={7}>7 hari</option><option value={14}>14 hari</option><option value={30}>30 hari</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={lbl}>Link pembayaran paket {PLANS[plan].label}</label>
                  <input className={field} value={payLink} onChange={(e) => setPayLink(e.target.value)} placeholder="https://..." />
                  <p className="mt-1 text-[11px] text-slate-500">Diingat per paket. Kosongkan jika pembayaran hanya lewat transfer bank.</p>
                </div>
                <div><label className={lbl}>Catatan (opsional)</label><textarea rows={2} className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: perpanjangan periode Oktober" /></div>

                <div className="rounded-lg border border-slate-700">
                  <button type="button" onClick={() => setShowSeller((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-semibold text-slate-300">
                    Data penagih & penanda tangan<span className="text-slate-500">{showSeller ? "Tutup" : "Ubah"}</span>
                  </button>
                  {showSeller && (
                    <div className="grid gap-2 border-t border-slate-700 p-3">
                      {[["name", "Nama usaha"], ["address", "Alamat"], ["email", "Email"], ["phone", "Telepon"], ["bank", "Bank (opsional)"], ["account", "No. rekening"], ["holder", "Atas nama"], ["signName", "Nama penanda tangan"], ["signTitle", "Jabatan penanda tangan"]].map(([k, l]) => (
                        <div key={k}><label className={lbl}>{l}</label><input className={field} value={seller[k] || ""} onChange={(e) => setSeller((s) => ({ ...s, [k]: e.target.value }))} /></div>
                      ))}
                      <p className="text-[11px] text-slate-500">Disimpan di perangkat ini. Invoice yang sudah tersimpan tetap memakai data saat dibuat.</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </fieldset>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/70 px-3 py-2.5">
            <div>
              <div className="text-[11px] text-slate-400">Total tagihan</div>
              <div className="font-mono text-[17px] font-bold text-slate-50">{rp(total)}</div>
            </div>
            {viewing ? (
              <button type="button" onClick={() => printHtml(html)} className="rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-400">Unduh PDF</button>
            ) : (
              <button type="button" disabled={busy} onClick={saveAndPrint} className="rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-400 disabled:opacity-60">{busy ? "Menyimpan…" : "Simpan & unduh PDF"}</button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">Pada jendela cetak, pilih "Simpan sebagai PDF".</p>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-700 bg-white">
          <iframe ref={frameRef} title="Pratinjau invoice" srcDoc={initialHtml} onLoad={syncFrame} className="block h-[min(72vh,760px)] w-full bg-white" />
        </div>
      </div>

      {/* Riwayat invoice */}
      <div className="rounded-xl border border-slate-700">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <div className="text-[13px] font-semibold text-slate-100">Riwayat invoice</div>
          {history && history.length > 0 && (
            <div className="text-[12px] text-slate-400">
              Belum dibayar <span className="font-mono font-semibold text-amber-300">{rp(unpaidTotal)}</span> dari {unpaid.length} invoice
              {overdue.length > 0 && <span className="text-rose-300">, {overdue.length} lewat jatuh tempo</span>}
            </div>
          )}
        </div>
        {history === null ? (
          <p className="px-4 py-4 text-[12px] text-slate-500">Memuat riwayat…</p>
        ) : historyErr ? (
          <p className="px-4 py-4 text-[12px] text-rose-300">Riwayat gagal dimuat: {historyErr}</p>
        ) : history.length === 0 ? (
          <p className="px-4 py-4 text-[12px] text-slate-500">Belum ada invoice tersimpan. Invoice pertama akan bernomor 0001.</p>
        ) : (
          <div className="max-h-[360px] overflow-auto overscroll-contain">
            <table className="w-full min-w-[720px] text-[12.5px]">
              <thead className="sticky top-0 bg-[#0b0f17] text-left text-[11px] text-slate-400">
                <tr><th className="px-4 py-2 font-semibold">Nomor</th><th className="px-2 py-2 font-semibold">Klien</th><th className="px-2 py-2 font-semibold">Tanggal</th><th className="px-2 py-2 font-semibold">Jatuh tempo</th><th className="px-2 py-2 text-right font-semibold">Total</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-4 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {history.map((x) => {
                  const late = x.status === "unpaid" && x.due_date < today;
                  return (
                    <tr key={x.id} className={viewing?.id === x.id ? "bg-violet-500/10" : ""}>
                      <td className="px-4 py-2 font-mono text-slate-200">{x.number}</td>
                      <td className="max-w-[200px] truncate px-2 py-2 text-slate-200">{x.company}</td>
                      <td className="px-2 py-2 text-slate-400">{fmtShort(x.invoice_date)}</td>
                      <td className={`px-2 py-2 ${late ? "font-semibold text-rose-300" : "text-slate-400"}`}>{fmtShort(x.due_date)}{late ? " (lewat)" : ""}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-100">{rp(x.total)}</td>
                      <td className="px-2 py-2">
                        <select value={x.status} onChange={(e) => setStatus(x, e.target.value)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[12px]" style={{ color: x.status === "paid" ? "#86efac" : x.status === "void" ? "#94a3b8" : "#fcd34d" }} aria-label={`Status ${x.number}`}>
                          <option value="unpaid">Belum dibayar</option><option value="paid">Lunas</option><option value="void">Dibatalkan</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-right"><button type="button" onClick={() => setViewing(x)} className="font-semibold text-violet-300 hover:text-violet-200">Lihat</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
