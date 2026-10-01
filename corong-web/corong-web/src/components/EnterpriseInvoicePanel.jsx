import { useEffect, useMemo, useRef, useState } from "react";
import { MAYAR_PAYMENT_LINK } from "../lib/plans";

// Invoice langganan Nexto Enterprise (2 Okt 2026, permintaan Nando) - khusus
// admin platform, ditaruh di Command Center. Ketik nama perusahaan klien:
// kalau cocok dengan organisasi Enterprise di Nexto, owner & jumlah anggota
// terisi otomatis. Harga per orang mengikuti harga yang berlaku (early bird
// sampai 15 Okt 2026). Tanpa PPN (keputusan Nando). Invoice dibuat sebagai
// dokumen cetak -> "Simpan sebagai PDF" dari dialog cetak browser.

const EARLY_BIRD_DEADLINE = new Date("2026-10-15T23:59:59+07:00"); // sama dengan Auth.jsx
const PRICE_PER_SEAT = () => (new Date() < EARLY_BIRD_DEADLINE ? 249000 : 279000);
const DEFAULT_SEATS = 4; // paket Enterprise standar = 4 anggota
const PROFILE_KEY = "nexto-invoice-seller";

const rp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const isoDay = (d) => new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10);
const addDays = (iso, n) => isoDay(new Date(new Date(iso + "T00:00:00+07:00").getTime() + n * 86400000));
const addMonths = (iso, n) => {
  const d = new Date(iso + "T00:00:00+07:00");
  const t = new Date(d); t.setMonth(t.getMonth() + n); t.setDate(t.getDate() - 1);
  return isoDay(t);
};
const fmtDate = (iso) => new Date(iso + "T00:00:00+07:00").toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function invoiceNumber(dateIso) {
  const now = new Date(Date.now() + 7 * 3600000);
  const [y, m, d] = dateIso.split("-");
  return `INV/NXT/${y}/${m}/${d}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}`;
}

function loadProfile() {
  try {
    return { name: "Nexto", address: "", email: "", phone: "", bank: "", account: "", holder: "", ...JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}") };
  } catch (_) {
    return { name: "Nexto", address: "", email: "", phone: "", bank: "", account: "", holder: "" };
  }
}

export function buildInvoiceHtml(inv, seller) {
  const total = inv.seats * inv.pricePerSeat * inv.months;
  const sellerLines = [seller.address, [seller.email, seller.phone].filter(Boolean).join(" · "), "nexto.site"].filter(Boolean);
  const bank = seller.bank && seller.account
    ? `<p><strong>Transfer bank:</strong> ${esc(seller.bank)} ${esc(seller.account)}${seller.holder ? ` a.n. ${esc(seller.holder)}` : ""}</p>`
    : "";
  const logo = `${window.location.origin}/nexto-logo.png`;
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(inv.number)} - ${esc(inv.company)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif; color: #0f172a; font-size: 12.5px; line-height: 1.55; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .doc { max-width: 760px; margin: 0 auto; padding: 32px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 20px; border-bottom: 2px solid #0f172a; }
  /* Logo Nexto berwarna putih - ditaruh di atas latar gelap supaya terbaca di kertas putih. */
  .brand { display: inline-flex; align-items: center; background: #0f172a; border-radius: 8px; padding: 9px 14px; margin-bottom: 10px; }
  .brand img { height: 22px; width: auto; display: block; }
  .seller { font-weight: 700; font-size: 14px; }
  .muted { color: #64748b; }
  h1 { margin: 0; font-size: 26px; letter-spacing: 0.08em; text-align: right; }
  .meta { margin-top: 6px; text-align: right; }
  .meta div { white-space: nowrap; }
  .parties { display: flex; justify-content: space-between; gap: 24px; margin: 22px 0; }
  .label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; color: #64748b; margin-bottom: 4px; }
  .strong { font-weight: 700; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 10.5px; letter-spacing: 0.06em; color: #64748b; border-bottom: 1px solid #cbd5e1; padding: 8px 6px; }
  td { padding: 12px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .total { display: flex; justify-content: flex-end; margin-top: 14px; }
  .total div { min-width: 260px; display: flex; justify-content: space-between; padding: 12px 14px; background: #0f172a; color: #fff; border-radius: 10px; font-size: 15px; font-weight: 800; }
  .pay { margin-top: 26px; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 10px; }
  .pay p { margin: 4px 0; }
  .pay a { color: #c2410c; word-break: break-all; }
  .note { margin-top: 18px; }
  .foot { margin-top: 36px; text-align: center; color: #94a3b8; font-size: 11px; }
  @media print { .doc { padding: 0; } }
</style></head><body><div class="doc">
  <div class="top">
    <div>
      <div class="brand"><img src="${logo}" alt="Nexto"></div>
      <div class="seller">${esc(seller.name || "Nexto")}</div>
      ${sellerLines.map((l) => `<div class="muted">${esc(l)}</div>`).join("")}
    </div>
    <div>
      <h1>INVOICE</h1>
      <div class="meta">
        <div><span class="muted">Nomor</span> <strong>${esc(inv.number)}</strong></div>
        <div><span class="muted">Tanggal</span> ${fmtDate(inv.date)}</div>
        <div><span class="muted">Jatuh tempo</span> <strong>${fmtDate(inv.due)}</strong></div>
      </div>
    </div>
  </div>
  <div class="parties">
    <div>
      <div class="label">DITAGIHKAN KEPADA</div>
      <div class="strong">${esc(inv.company)}</div>
      ${inv.contact ? `<div>${esc(inv.contact)}</div>` : ""}
      ${inv.email ? `<div class="muted">${esc(inv.email)}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div class="label">PERIODE LANGGANAN</div>
      <div>${fmtDate(inv.start)} – ${fmtDate(inv.end)}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>DESKRIPSI</th><th class="num">JUMLAH</th><th class="num">HARGA</th><th class="num">SUBTOTAL</th></tr></thead>
    <tbody><tr>
      <td><strong>Langganan Nexto Enterprise</strong><div class="muted">${inv.seats} anggota tim · ${inv.months} bulan · AI Sales CRM</div></td>
      <td class="num">${inv.seats} × ${inv.months} bln</td>
      <td class="num">${rp(inv.pricePerSeat)}<div class="muted">per anggota/bulan</div></td>
      <td class="num">${rp(total)}</td>
    </tr></tbody>
  </table>
  <div class="total"><div><span>Total</span><span>${rp(total)}</span></div></div>
  <div class="pay">
    <div class="label">CARA PEMBAYARAN</div>
    <p><strong>Pembayaran online:</strong> <a href="${MAYAR_PAYMENT_LINK}">${MAYAR_PAYMENT_LINK}</a></p>
    ${bank}
    <p class="muted">Cantumkan nomor invoice ${esc(inv.number)} pada berita pembayaran.</p>
  </div>
  ${inv.note ? `<div class="note"><div class="label">CATATAN</div><div>${esc(inv.note).replace(/\n/g, "<br>")}</div></div>` : ""}
  <div class="foot">Terima kasih telah menggunakan Nexto.</div>
</div></body></html>`;
}

const field = "w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none";
const lbl = "mb-1 block text-[11px] font-semibold text-slate-400";

export default function EnterpriseInvoicePanel({ users = [] }) {
  // Organisasi Enterprise dari direktori user (owner + jumlah anggota).
  const orgs = useMemo(() => {
    const map = new Map();
    for (const u of users || []) {
      if (u.plan !== "enterprise" || !u.org_name) continue;
      const o = map.get(u.org_name) || { name: u.org_name, members: 0, owner: null };
      o.members += 1;
      if (u.role === "owner") o.owner = u;
      map.set(u.org_name, o);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const today = isoDay(new Date());
  const [company, setCompany] = useState("");
  const [contact, setContact] = useState("");
  const [email, setEmail] = useState("");
  const [seats, setSeats] = useState(DEFAULT_SEATS);
  const [months, setMonths] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState(PRICE_PER_SEAT());
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(today);
  const [dueDays, setDueDays] = useState(7);
  const [note, setNote] = useState("");
  const [seller, setSeller] = useState(loadProfile);
  const [showSeller, setShowSeller] = useState(false);
  const frameRef = useRef(null);

  // Nama perusahaan cocok dengan organisasi Enterprise -> isi otomatis.
  const matched = orgs.find((o) => o.name.toLowerCase() === company.trim().toLowerCase()) || null;
  useEffect(() => {
    if (!matched) return;
    setContact(matched.owner?.display_name || "");
    setEmail(matched.owner?.email || "");
    setSeats(Math.max(DEFAULT_SEATS, matched.members));
  }, [matched?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(seller)); } catch (_) {}
  }, [seller]);

  const inv = {
    number: invoiceNumber(date),
    company: company.trim() || "Nama perusahaan",
    contact: contact.trim(),
    email: email.trim(),
    seats: Math.max(1, Number(seats) || 1),
    months: Number(months) || 1,
    pricePerSeat: Number(pricePerSeat) || 0,
    date,
    due: addDays(date, Number(dueDays) || 0),
    start,
    end: addMonths(start, Number(months) || 1),
    note: note.trim(),
  };
  const total = inv.seats * inv.pricePerSeat * inv.months;
  const html = buildInvoiceHtml(inv, seller);

  const printInvoice = () => {
    if (!company.trim()) { alert("Isi nama perusahaan terlebih dahulu."); return; }
    const w = frameRef.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div>
          <label className={lbl} htmlFor="inv-company">Nama perusahaan</label>
          <input id="inv-company" list="inv-orgs" className={field} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ketik nama perusahaan klien" autoComplete="off" />
          <datalist id="inv-orgs">{orgs.map((o) => <option key={o.name} value={o.name} />)}</datalist>
          <p className="mt-1 text-[11px] text-slate-500">
            {matched ? `Klien Enterprise ditemukan: ${matched.members} anggota terdaftar, data owner terisi otomatis.` : orgs.length ? `${orgs.length} organisasi Enterprise tersedia di daftar saran.` : "Belum ada organisasi Enterprise - isi data secara manual."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Nama PIC</label><input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nama penanggung jawab" /></div>
          <div><label className={lbl}>Email</label><input className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@perusahaan.com" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lbl}>Anggota</label><input type="number" min="1" className={field} value={seats} onChange={(e) => setSeats(e.target.value)} /></div>
          <div>
            <label className={lbl}>Periode</label>
            <select className={field} value={months} onChange={(e) => setMonths(e.target.value)}>
              <option value={1}>1 bulan</option>
              <option value={3}>3 bulan</option>
              <option value={6}>6 bulan</option>
              <option value={12}>12 bulan</option>
            </select>
          </div>
          <div><label className={lbl}>Harga/anggota</label><input type="number" min="0" step="1000" className={field} value={pricePerSeat} onChange={(e) => setPricePerSeat(e.target.value)} /></div>
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
        <div><label className={lbl}>Catatan (opsional)</label><textarea rows={2} className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: perpanjangan periode Oktober" /></div>

        <div className="rounded-lg border border-slate-700">
          <button type="button" onClick={() => setShowSeller((v) => !v)} className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-semibold text-slate-300">
            Data penagih (disimpan di perangkat ini)<span className="text-slate-500">{showSeller ? "Tutup" : "Ubah"}</span>
          </button>
          {showSeller && (
            <div className="grid gap-2 border-t border-slate-700 p-3">
              {[["name", "Nama usaha"], ["address", "Alamat"], ["email", "Email"], ["phone", "Telepon"], ["bank", "Bank (opsional)"], ["account", "No. rekening"], ["holder", "Atas nama"]].map(([k, l]) => (
                <div key={k}><label className={lbl}>{l}</label><input className={field} value={seller[k] || ""} onChange={(e) => setSeller((s) => ({ ...s, [k]: e.target.value }))} /></div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/70 px-3 py-2.5">
          <div>
            <div className="text-[11px] text-slate-400">Total tagihan</div>
            <div className="font-mono text-[17px] font-bold text-slate-50">{rp(total)}</div>
          </div>
          <button type="button" onClick={printInvoice} className="rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-400">Unduh PDF</button>
        </div>
        <p className="text-[11px] text-slate-500">Pada jendela cetak, pilih "Simpan sebagai PDF".</p>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-slate-700 bg-white">
        <iframe ref={frameRef} title="Pratinjau invoice" srcDoc={html} className="h-[720px] w-full bg-white" />
      </div>
    </div>
  );
}
