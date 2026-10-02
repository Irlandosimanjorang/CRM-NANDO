import { useEffect, useMemo, useRef, useState } from "react";
import { MAYAR_PAYMENT_LINK } from "../lib/plans";

// Invoice langganan Nexto (2 Okt 2026, permintaan Nando) - khusus
// admin platform, ditaruh di Command Center. Ketik nama perusahaan klien:
// kalau cocok dengan organisasi Enterprise di Nexto, owner & jumlah anggota
// terisi otomatis. Harga per orang mengikuti harga yang berlaku (early bird
// sampai 15 Okt 2026). Tanpa PPN (keputusan Nando). Invoice dibuat sebagai
// dokumen cetak -> "Simpan sebagai PDF" dari dialog cetak browser.

const EARLY_BIRD_DEADLINE = new Date("2026-10-15T23:59:59+07:00"); // sama dengan Auth.jsx
const PROFILE_KEY = "nexto-invoice-seller";

// Paket yang bisa dipilih (2 Okt 2026). Harga per pengguna/bulan mengikuti
// PRICING_EARLY_BIRD / PRICING_NORMAL di Auth.jsx - kalau harga di sana
// berubah, samakan di sini. "custom" = isi deskripsi & harga sendiri.
const PLANS = {
  standard: { label: "Standard", item: "Langganan Nexto Standard", unit: "pengguna", early: 59000, normal: 89000, minSeats: 1 },
  professional: { label: "Professional", item: "Langganan Nexto Professional", unit: "pengguna", early: 229000, normal: 249000, minSeats: 1 },
  enterprise: { label: "Enterprise", item: "Langganan Nexto Enterprise", unit: "anggota tim", early: 249000, normal: 279000, minSeats: 4 },
  custom: { label: "Custom", item: "", unit: "pengguna", early: 0, normal: 0, minSeats: 1 },
};
const priceOf = (plan) => (new Date() < EARLY_BIRD_DEADLINE ? PLANS[plan].early : PLANS[plan].normal);
const DEFAULT_LINKS = { standard: MAYAR_PAYMENT_LINK, professional: MAYAR_PAYMENT_LINK, enterprise: MAYAR_PAYMENT_LINK, custom: MAYAR_PAYMENT_LINK };

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
  const base = { name: "Nexto", address: "", email: "", phone: "", bank: "", account: "", holder: "", links: DEFAULT_LINKS };
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");
    return { ...base, ...saved, links: { ...DEFAULT_LINKS, ...(saved.links || {}) } };
  } catch (_) {
    return base;
  }
}

export function buildInvoiceHtml(inv, seller) {
  const total = inv.seats * inv.pricePerSeat * inv.months;
  const sellerLines = [seller.address, seller.email, seller.phone, "nexto.site"].filter(Boolean);
  const bank = seller.bank && seller.account
    ? `<div class="row"><span>Transfer bank</span><span>${esc(seller.bank)} ${esc(seller.account)}${seller.holder ? `, a.n. ${esc(seller.holder)}` : ""}</span></div>`
    : "";
  const logo = `${window.location.origin}/nexto-logo.png`;
  // Gaya invoice akuntansi (2 Okt 2026): label huruf biasa, garis tipis,
  // total ditandai garis tebal (bukan kotak gelap), oranye Nexto hanya
  // untuk angka total. Logo putih tetap di atas blok gelap kecil.
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(inv.number)} - ${esc(inv.company)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
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
  .facts { display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 20px; margin: 34px 0 26px; padding: 16px 0; border-top: 1px solid #d9dde4; border-bottom: 1px solid #d9dde4; }
  .k { color: #5b6475; font-size: 11.5px; font-weight: 600; margin-bottom: 3px; }
  .v { font-weight: 600; }
  .v small { display: block; font-weight: 400; color: #5b6475; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; color: #5b6475; font-size: 11.5px; font-weight: 600; padding: 0 0 8px; border-bottom: 1px solid #1c2230; }
  td { padding: 14px 0; border-bottom: 1px solid #e6e9ee; vertical-align: top; }
  td.d { padding-right: 16px; }
  td.d small { display: block; color: #5b6475; font-size: 12px; }
  .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; padding-left: 16px; }
  .sum { margin: 18px 0 0 auto; width: 300px; }
  .sum .row { display: flex; justify-content: space-between; padding: 5px 0; color: #5b6475; font-variant-numeric: tabular-nums; }
  .sum .grand { margin-top: 6px; padding-top: 10px; border-top: 2px solid #1c2230; color: #1c2230; font-size: 16px; font-weight: 700; }
  .sum .grand span:last-child { color: #c2410c; }
  .pay { margin-top: 36px; }
  .pay h2 { margin: 0 0 8px; font-size: 13px; }
  .pay .row { display: grid; grid-template-columns: 130px 1fr; gap: 12px; padding: 4px 0; }
  .pay .row span:first-child { color: #5b6475; }
  .pay a { color: #1c2230; word-break: break-all; }
  .pay p { margin: 8px 0 0; color: #5b6475; }
  .note { margin-top: 24px; }
  .note h2 { margin: 0 0 4px; font-size: 13px; }
  .foot { margin-top: 44px; padding-top: 12px; border-top: 1px solid #e6e9ee; color: #8a92a1; font-size: 11px; display: flex; justify-content: space-between; }
  @media print { .doc { padding: 0; } }
</style></head><body><div class="doc">
  <div class="head">
    <div>
      <div class="logo"><img src="${logo}" alt="Nexto"></div>
      <div class="from"><b>${esc(seller.name || "Nexto")}</b>${sellerLines.map((l) => `${esc(l)}<br>`).join("")}</div>
    </div>
    <div class="title"><h1>Invoice</h1><div class="no">${esc(inv.number)}</div></div>
  </div>
  <div class="facts">
    <div><div class="k">Ditagihkan kepada</div><div class="v">${esc(inv.company)}${inv.contact ? `<small>${esc(inv.contact)}</small>` : ""}${inv.email ? `<small>${esc(inv.email)}</small>` : ""}</div></div>
    <div><div class="k">Tanggal invoice</div><div class="v">${fmtDate(inv.date)}</div><div class="k" style="margin-top:10px">Jatuh tempo</div><div class="v">${fmtDate(inv.due)}</div></div>
    <div><div class="k">Periode langganan</div><div class="v">${fmtDate(inv.start)}<small>sampai ${fmtDate(inv.end)}</small></div></div>
  </div>
  <table>
    <thead><tr><th>Deskripsi</th><th class="r">Jumlah</th><th class="r">Harga satuan</th><th class="r">Subtotal</th></tr></thead>
    <tbody><tr>
      <td class="d"><b>${esc(inv.item)}</b><small>${inv.seats} ${esc(inv.unit)}, ${inv.months} bulan</small></td>
      <td class="r">${inv.seats * inv.months}</td>
      <td class="r">${rp(inv.pricePerSeat)}<small style="display:block;color:#5b6475;font-size:12px">per ${esc(inv.unit)}/bulan</small></td>
      <td class="r">${rp(total)}</td>
    </tr></tbody>
  </table>
  <div class="sum">
    <div class="row"><span>Subtotal</span><span>${rp(total)}</span></div>
    <div class="row grand"><span>Total tagihan</span><span>${rp(total)}</span></div>
  </div>
  <div class="pay">
    <h2>Cara pembayaran</h2>
    ${inv.payLink ? `<div class="row"><span>Pembayaran online</span><a href="${esc(inv.payLink)}">${esc(inv.payLink)}</a></div>` : ""}
    ${bank}
    <p>Cantumkan nomor ${esc(inv.number)} pada berita pembayaran.</p>
  </div>
  ${inv.note ? `<div class="note"><h2>Catatan</h2><div>${esc(inv.note).replace(/\n/g, "<br>")}</div></div>` : ""}
  <div class="foot"><span>Terima kasih telah menggunakan Nexto.</span><span>${esc(inv.number)}</span></div>
</div></body></html>`;
}

const field = "w-full rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-[13px] text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none";
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
  const [plan, setPlan] = useState("enterprise");
  const [customItem, setCustomItem] = useState("");
  const [seats, setSeats] = useState(PLANS.enterprise.minSeats);
  const [months, setMonths] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState(priceOf("enterprise"));
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(today);
  const [dueDays, setDueDays] = useState(7);
  const [note, setNote] = useState("");
  const [seller, setSeller] = useState(loadProfile);
  const [showSeller, setShowSeller] = useState(false);
  const frameRef = useRef(null);

  // Nama perusahaan cocok dengan organisasi Enterprise -> isi otomatis.
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
    if (!matched) return;
    setContact(matched.owner?.display_name || "");
    setEmail(matched.owner?.email || "");
    choosePlan(matched.plan, matched.members);
  }, [matched?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try { localStorage.setItem(PROFILE_KEY, JSON.stringify(seller)); } catch (_) {}
  }, [seller]);

  // Nomor dikunci saat form dibuka / tanggal diganti, bukan dihitung ulang tiap ketikan.
  const invNumber = useMemo(() => invoiceNumber(date), [date]);
  const payLink = (seller.links || DEFAULT_LINKS)[plan] || "";
  const setPayLink = (v) => setSeller((s) => ({ ...s, links: { ...(s.links || DEFAULT_LINKS), [plan]: v } }));

  const inv = {
    plan,
    item: plan === "custom" ? (customItem.trim() || "Layanan Nexto") : PLANS[plan].item,
    unit: PLANS[plan].unit,
    payLink: payLink.trim(),
    number: invNumber,
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

  // Pratinjau dimuat SEKALI (srcDoc awal), perubahan berikutnya hanya
  // mengganti isi <body> di tempat - dulu srcDoc berganti tiap ketikan/
  // pilihan sehingga lembar invoice berkedip & scroll-nya balik ke atas.
  const [initialHtml] = useState(html);
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const next = new DOMParser().parseFromString(html, "text/html");
    if (doc.body.innerHTML !== next.body.innerHTML) doc.body.innerHTML = next.body.innerHTML;
    if (doc.title !== next.title) doc.title = next.title;
  }, [html]);

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
            {matched ? `Klien ${PLANS[matched.plan].label} ditemukan: ${matched.members} anggota terdaftar, paket & data owner terisi otomatis.` : orgs.length ? `${orgs.length} klien berbayar tersedia di daftar saran.` : "Belum ada klien berbayar - isi data secara manual."}
          </p>
        </div>
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
        <div>
          <label className={lbl}>Link pembayaran paket {PLANS[plan].label}</label>
          <input className={field} value={payLink} onChange={(e) => setPayLink(e.target.value)} placeholder="https://..." />
          <p className="mt-1 text-[11px] text-slate-500">Diingat per paket. Kosongkan jika pembayaran hanya lewat transfer bank.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Nama PIC</label><input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nama penanggung jawab" /></div>
          <div><label className={lbl}>Email</label><input className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@perusahaan.com" /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={lbl}>Jumlah {PLANS[plan].unit}</label><input type="number" min={PLANS[plan].minSeats} className={field} value={seats} onChange={(e) => setSeats(e.target.value)} /></div>
          <div>
            <label className={lbl}>Periode</label>
            <select className={field} value={months} onChange={(e) => setMonths(e.target.value)}>
              <option value={1}>1 bulan</option>
              <option value={3}>3 bulan</option>
              <option value={6}>6 bulan</option>
              <option value={12}>12 bulan</option>
            </select>
          </div>
          <div><label className={lbl}>Harga/{PLANS[plan].unit === "anggota tim" ? "anggota" : "pengguna"}</label><input type="number" min="0" step="1000" className={field} value={pricePerSeat} onChange={(e) => setPricePerSeat(e.target.value)} /></div>
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
        <iframe ref={frameRef} title="Pratinjau invoice" srcDoc={initialHtml} onLoad={(e) => { const doc = e.currentTarget.contentDocument; const next = new DOMParser().parseFromString(html, "text/html"); if (doc?.body) doc.body.innerHTML = next.body.innerHTML; }} className="h-[720px] w-full bg-white" />
      </div>
    </div>
  );
}
