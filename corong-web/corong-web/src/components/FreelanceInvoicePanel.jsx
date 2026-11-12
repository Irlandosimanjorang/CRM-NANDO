import { useEffect, useMemo, useState } from "react";
import { printHtml, terbilang } from "../lib/docKit";

// Invoice freelance PRIBADI (12 Nov 2026, permintaan Nando): terpisah dari invoice langganan Nexto.
// Tanpa logo Nexto. Identitas pengirim diisi sendiri dan disimpan di perangkat ini (localStorage).
// Invoice tidak disimpan ke database; cetak lewat dialog cetak browser -> Simpan sebagai PDF.
const PROFILE_KEY = "nexto-freelance-profile";
const COUNTER_KEY = "nexto-freelance-counter";
const EMPTY_PROFILE = { name: "", address: "", email: "", phone: "", bank: "", account: "", holder: "" };

function loadProfile() {
  try {
    return { ...EMPTY_PROFILE, ...(JSON.parse(localStorage.getItem(PROFILE_KEY) || "null") || {}) };
  } catch {
    return { ...EMPTY_PROFILE };
  }
}
function loadCounter() {
  const n = Number(localStorage.getItem(COUNTER_KEY));
  return Number.isFinite(n) && n > 0 ? n : 1;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rp = (n) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
const todayIso = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, days) => { const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-");
const invoiceNumber = (iso, n) => `INV-${iso.slice(0, 4)}${iso.slice(5, 7)}-${String(n).padStart(3, "0")}`;

function totalsOf(d) {
  const subtotal = d.items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.rate) || 0), 0);
  const tax = Math.round((subtotal * (Number(d.taxPct) || 0)) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

// Desain: bersih, satu kolom, tabel rapi, total paling jelas di kanan bawah. Tidak ada logo, warna netral.
function buildFreelanceHtml(d, p) {
  const { subtotal, tax, total } = totalsOf(d);
  const rows = d.items
    .filter((it) => String(it.desc || "").trim())
    .map((it, i) => {
      const amount = (Number(it.qty) || 0) * (Number(it.rate) || 0);
      return `<tr><td class="no">${i + 1}</td><td>${esc(it.desc)}</td><td class="r">${esc(it.qty)}</td><td class="r">${rp(it.rate)}</td><td class="r">${rp(amount)}</td></tr>`;
    })
    .join("");
  const from = [p.address, p.email, p.phone].filter(Boolean).map((l) => `<div>${esc(l)}</div>`).join("");
  const bank = [p.bank && `${esc(p.bank)}`, p.account && `${esc(p.account)}`, p.holder && `a.n. ${esc(p.holder)}`].filter(Boolean);
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(d.number)}</title>
<style>
  @page { margin: 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; font-size: 13px; line-height: 1.5; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
  h1 { margin: 0; font-size: 30px; font-weight: 600; letter-spacing: -0.02em; }
  .num { color: #666; margin-top: 4px; }
  .meta { text-align: right; color: #444; }
  .meta div + div { margin-top: 2px; }
  .parties { display: flex; justify-content: space-between; gap: 24px; margin-top: 36px; }
  .label { color: #888; font-size: 11px; margin-bottom: 4px; }
  .name { font-weight: 600; font-size: 14px; }
  .proj { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e5e5; }
  table { width: 100%; border-collapse: collapse; margin-top: 18px; }
  th, td { padding: 10px 8px; border-bottom: 1px solid #e5e5e5; text-align: left; vertical-align: top; }
  th { font-weight: 600; font-size: 12px; color: #555; border-bottom: 1px solid #1a1a1a; }
  .r { text-align: right; white-space: nowrap; }
  .no { width: 32px; color: #888; }
  .sum { margin-left: auto; width: 280px; margin-top: 16px; }
  .sum div { display: flex; justify-content: space-between; padding: 4px 0; color: #444; }
  .sum .grand { border-top: 1px solid #1a1a1a; margin-top: 6px; padding-top: 10px; color: #1a1a1a; font-size: 18px; font-weight: 700; }
  .words { color: #666; font-size: 12px; margin-top: 6px; text-align: right; }
  .pay { margin-top: 36px; display: flex; justify-content: space-between; gap: 24px; }
  .pay .box { flex: 1; }
  .notes { color: #444; white-space: pre-line; }
  .sign { margin-top: 48px; text-align: right; }
  .sign .line { display: inline-block; border-top: 1px solid #1a1a1a; padding-top: 6px; min-width: 200px; text-align: center; }
</style></head><body>
  <div class="top">
    <div><h1>Invoice</h1><div class="num">${esc(d.number)}</div></div>
    <div class="meta">
      <div>Tanggal: ${esc(fmtDate(d.date))}</div>
      <div>Jatuh tempo: ${esc(fmtDate(d.dueDate))}</div>
    </div>
  </div>
  <div class="parties">
    <div>
      <div class="label">Dari</div>
      <div class="name">${esc(p.name || "-")}</div>
      ${from}
    </div>
    <div>
      <div class="label">Kepada</div>
      <div class="name">${esc(d.client || "-")}</div>
      ${d.clientAddress ? `<div>${esc(d.clientAddress).replace(/\n/g, "<br>")}</div>` : ""}
    </div>
  </div>
  ${d.project ? `<div class="proj"><div class="label">Proyek</div><div>${esc(d.project)}</div></div>` : ""}
  <table>
    <thead><tr><th class="no">No</th><th>Deskripsi</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Jumlah</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5" style="color:#888">Belum ada item</td></tr>`}</tbody>
  </table>
  <div class="sum">
    <div><span>Subtotal</span><span>${rp(subtotal)}</span></div>
    ${d.taxPct ? `<div><span>Pajak (${esc(d.taxPct)}%)</span><span>${rp(tax)}</span></div>` : ""}
    <div class="grand"><span>Total</span><span>${rp(total)}</span></div>
  </div>
  <div class="words">${total > 0 ? esc(terbilang(total)) + " rupiah" : ""}</div>
  <div class="pay">
    <div class="box">
      <div class="label">Pembayaran ke</div>
      ${bank.length ? bank.map((b) => `<div>${b}</div>`).join("") : "<div>-</div>"}
    </div>
    <div class="box">
      <div class="label">Syarat pembayaran</div>
      <div class="notes">${esc(d.paymentTerms || "")}</div>
    </div>
  </div>
  ${d.notes ? `<div class="pay"><div class="box"><div class="label">Catatan</div><div class="notes">${esc(d.notes)}</div></div></div>` : ""}
  <div class="sign"><div class="line">${esc(p.name || "")}</div></div>
</body></html>`;
}

const field = "mt-1 w-full rounded-lg border border-white/[0.14] bg-[#0b1220] px-3 py-2 text-[12.5px] text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none";
const lbl = "block text-[11px] font-medium text-slate-400";

export default function FreelanceInvoicePanel() {
  const [profile, setProfile] = useState(loadProfile);
  const [counter, setCounter] = useState(loadCounter);
  const [client, setClient] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [project, setProject] = useState("");
  const [date, setDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState(() => addDays(todayIso(), 14));
  const [items, setItems] = useState([{ desc: "", qty: 1, rate: 0 }]);
  const [taxPct, setTaxPct] = useState(0);
  const [paymentTerms, setPaymentTerms] = useState("Pembayaran dalam 14 hari setelah invoice diterima.");
  const [notes, setNotes] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); } catch { /* penyimpanan diblokir: tetap bisa dipakai */ }
  }, [profile]);

  const number = invoiceNumber(date, counter);
  const data = useMemo(() => ({ number, client, clientAddress, project, date, dueDate, items, taxPct, paymentTerms, notes }), [number, client, clientAddress, project, date, dueDate, items, taxPct, paymentTerms, notes]);
  const html = useMemo(() => buildFreelanceHtml(data, profile), [data, profile]);
  const totals = totalsOf(data);

  const setItem = (i, patch) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i) => setItems((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr));

  const print = () => {
    printHtml(html);
    // Nomor naik setelah dicetak, supaya invoice berikutnya tidak memakai nomor yang sama.
    const next = counter + 1;
    setCounter(next);
    try { localStorage.setItem(COUNTER_KEY, String(next)); } catch { /* abaikan */ }
  };

  return (
    <div className="grid gap-4 min-w-0">
      <div className="rounded-xl border border-white/[0.14] bg-[#0e1522] p-3">
        <div className="mb-2 text-[12px] font-medium text-slate-200">Identitas Anda (pengirim)</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className={lbl}>Nama / usaha</span><input className={field} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
          <label className="block"><span className={lbl}>Email</span><input className={field} value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
          <label className="block"><span className={lbl}>Telepon</span><input className={field} value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></label>
          <label className="block"><span className={lbl}>Alamat</span><input className={field} value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></label>
          <label className="block"><span className={lbl}>Nama bank</span><input className={field} value={profile.bank} onChange={(e) => setProfile({ ...profile, bank: e.target.value })} placeholder="Mis. BCA" /></label>
          <label className="block"><span className={lbl}>Nomor rekening</span><input className={field} value={profile.account} onChange={(e) => setProfile({ ...profile, account: e.target.value })} /></label>
          <label className="block sm:col-span-2"><span className={lbl}>Atas nama</span><input className={field} value={profile.holder} onChange={(e) => setProfile({ ...profile, holder: e.target.value })} /></label>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.14] bg-[#0e1522] p-3">
        <div className="mb-2 text-[12px] font-medium text-slate-200">Invoice {number}</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block"><span className={lbl}>Kepada (nama klien)</span><input className={field} value={client} onChange={(e) => setClient(e.target.value)} /></label>
          <label className="block"><span className={lbl}>Proyek / pekerjaan</span><input className={field} value={project} onChange={(e) => setProject(e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className={lbl}>Alamat klien</span><textarea rows={2} className={field} value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} /></label>
          <label className="block"><span className={lbl}>Tanggal</span><input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="block"><span className={lbl}>Jatuh tempo</span><input type="date" className={field} value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        </div>

        <div className="mt-4 text-[12px] font-medium text-slate-200">Item</div>
        <div className="mt-2 grid gap-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_64px_120px_auto] items-end gap-2">
              <label className="block"><span className={lbl}>Deskripsi</span><input className={field} value={it.desc} onChange={(e) => setItem(i, { desc: e.target.value })} placeholder="Mis. Desain UI dashboard" /></label>
              <label className="block"><span className={lbl}>Qty</span><input type="number" min="0" className={field} value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} /></label>
              <label className="block"><span className={lbl}>Harga (Rp)</span><input type="number" min="0" className={field} value={it.rate} onChange={(e) => setItem(i, { rate: e.target.value })} /></label>
              <button type="button" onClick={() => removeItem(i)} className="mb-0.5 h-9 rounded-lg px-2 text-[12px] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200">Hapus</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setItems((arr) => [...arr, { desc: "", qty: 1, rate: 0 }])} className="mt-2 text-[12px] font-medium text-slate-300 underline underline-offset-2 hover:text-slate-100">+ Tambah item</button>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="block"><span className={lbl}>Pajak (%)</span><input type="number" min="0" className={field} value={taxPct} onChange={(e) => setTaxPct(e.target.value)} /></label>
          <div className="flex items-end justify-between rounded-lg border border-white/[0.14] px-3 py-2">
            <span className="text-[12px] text-slate-400">Total</span>
            <span className="text-[15px] font-semibold tabular-nums text-slate-100">{rp(totals.total)}</span>
          </div>
          <label className="block sm:col-span-2"><span className={lbl}>Syarat pembayaran</span><input className={field} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className={lbl}>Catatan (opsional)</span><textarea rows={2} className={field} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setShowPreview((v) => !v)} className="rounded-lg border border-white/[0.14] px-3 py-1.5 text-[12px] font-medium text-slate-200 hover:bg-white/[0.06]">{showPreview ? "Sembunyikan pratinjau" : "Lihat pratinjau"}</button>
          <button type="button" onClick={print} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-900 hover:bg-white">Cetak / Simpan PDF</button>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">Nomor invoice naik otomatis setelah dicetak. Invoice ini tidak disimpan ke database.</div>
      </div>

      {showPreview && (
        <iframe title="Pratinjau invoice" srcDoc={html} className="h-[640px] w-full rounded-xl border border-white/[0.14] bg-white" />
      )}
    </div>
  );
}
