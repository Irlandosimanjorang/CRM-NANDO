import { useEffect, useMemo, useRef, useState } from "react";
import * as db from "../lib/db";
import {
  PLANS, priceOf, rp, isoDay, addDays, addMonths, fmtShort, fmtStamp, PROFILE_BASE, loadProfile,
  computeTotals, buildInvoiceHtml, downloadInvoicePdf, field, lbl,
} from "./EnterpriseInvoicePanel";

// Quotation (penawaran harga) langganan Nexto (8 Okt 2026, permintaan Nando) -
// khusus admin platform, di Command Center (kartu QUOTATION). Bentuk dan isinya
// mengikuti kartu Invoice (nama perusahaan -> paket/owner/jumlah anggota terisi
// otomatis, tanpa PPN, data penagih dan tanda tangan memakai profil yang sama),
// tetapi nomornya QUO/NXT/tahun/bulan/urutan, ada masa berlaku (bukan jatuh
// tempo), dan tidak ada cara pembayaran. Quotation yang disetujui dijadikan
// invoice dengan satu klik ("Jadikan invoice"): isinya disalin ke invoice baru
// (tanggal hari ini, periode mulai paling cepat hari ini) dan quotation
// ditandai Disetujui + terkait nomor invoice itu. Quotation tersimpan tidak
// dapat diubah - buat quotation baru untuk revisi (tombol Duplikat).

const STATUS = {
  open: { label: "Menunggu persetujuan", color: "#b45309" },
  accepted: { label: "Disetujui", color: "#15803d" },
  rejected: { label: "Ditolak", color: "#64748b" },
  void: { label: "Dibatalkan", color: "#64748b" },
};
const call = (action, payload) => db.adminInvoices(action, { kind: "quotation", ...payload });

function SendDialog({ quotation, onClose, onChange }) {
  const log = quotation.email_log || [];
  const lastTo = [...log].reverse().find((e) => e.type === "quotation")?.to;
  const [to, setTo] = useState(lastTo || quotation.data?.email || "");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const validTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());

  const send = async () => {
    setSending(true); setErr("");
    try {
      const r = await call("send", { id: quotation.id, to: to.trim(), note: note.trim() });
      onChange({ id: quotation.id, email_log: r.invoice.email_log });
      onClose();
    } catch (e) { setErr(e.message); setSending(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !sending) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="qsend-title" className="w-full max-w-[480px] rounded-xl border border-slate-700 bg-[#0f1420] shadow-2xl">
        <div className="border-b border-slate-800 px-5 py-4">
          <h3 id="qsend-title" className="text-[15px] font-semibold text-slate-100">Kirim quotation</h3>
          <p className="mt-0.5 text-[12px] text-slate-400"><span className="font-mono">{quotation.number}</span>, {quotation.company}, {rp(quotation.total)}</p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <p className="rounded-lg bg-slate-900/70 px-3 py-2 text-[12px] text-slate-300">Email berisi ringkasan penawaran, masa berlaku, dan tombol unduh PDF. PDF juga terlampir.</p>
          <div>
            <label className={lbl} htmlFor="qsend-to">Kirim ke email</label>
            <input id="qsend-to" type="email" className={field} value={to} onChange={(e) => setTo(e.target.value)} placeholder="nama@perusahaan.co.id" disabled={sending} />
            <p className="mt-1 text-[11.5px] text-slate-400">Balasan klien masuk ke email penagih, dan Anda menerima salinannya.</p>
          </div>
          <div>
            <label className={lbl} htmlFor="qsend-note">Pesan tambahan (opsional)</label>
            <textarea id="qsend-note" rows={2} className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: Senang bisa berdiskusi kemarin." disabled={sending} />
          </div>
          {log.length > 0 && (
            <div>
              <div className={lbl}>Riwayat email</div>
              <ul className="space-y-1 text-[12px] text-slate-400">
                {[...log].reverse().map((e, i) => <li key={i}>Quotation dikirim ke {e.to}, {fmtStamp(e.at)}</li>)}
              </ul>
            </div>
          )}
          {err && <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-200">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
          <button type="button" onClick={onClose} disabled={sending} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">Tutup</button>
          <button type="button" onClick={send} disabled={sending || !validTo || quotation.status === "void"} className="rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50">{sending ? "Mengirim…" : "Kirim"}</button>
        </div>
      </div>
    </div>
  );
}

export default function QuotationPanel({ users = [] }) {
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
  const [plan, setPlan] = useState("enterprise");
  const [customItem, setCustomItem] = useState("");
  const [freeSeats, setFreeSeats] = useState(0);
  const [seats, setSeats] = useState(PLANS.enterprise.minSeats);
  const [months, setMonths] = useState(1);
  const [pricePerSeat, setPricePerSeat] = useState(priceOf("enterprise"));
  const [discountLabel, setDiscountLabel] = useState("");
  const [discountType, setDiscountType] = useState("amount");
  const [discountValue, setDiscountValue] = useState("");
  const [date, setDate] = useState(today);
  const [start, setStart] = useState(today);
  const [validDays, setValidDays] = useState(14);
  const [note, setNote] = useState("");
  const [seller, setSeller] = useState(loadProfile);
  const [viewing, setViewing] = useState(null);
  const [history, setHistory] = useState(null);
  const [historyErr, setHistoryErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendingQ, setSendingQ] = useState(null);
  const frameRef = useRef(null);
  const topRef = useRef(null);
  const skipAutofill = useRef(false);

  const loadHistory = () => {
    setHistoryErr("");
    call("list").then((r) => setHistory(r.invoices || [])).catch((e) => { setHistory([]); setHistoryErr(e.message); });
  };
  useEffect(loadHistory, []);

  // Data penagih, tanda tangan, dan stempel: profil yang sama dengan kartu Invoice (diubah di sana).
  useEffect(() => {
    let cancelled = false;
    db.adminInvoices("get_profile").then(({ profile }) => { if (!cancelled && profile) setSeller({ ...PROFILE_BASE, ...profile }); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const matched = orgs.find((o) => o.name.toLowerCase() === company.trim().toLowerCase()) || null;
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
    if (skipAutofill.current) { skipAutofill.current = false; return; }
    if (!matched || viewing) return;
    setContact(matched.owner?.display_name || "");
    setEmail(matched.owner?.email || "");
    choosePlan(matched.plan, matched.members);
  }, [matched?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const activatePlan = "enterprise";
  const draft = {
    company: company.trim(), contact: contact.trim(), email: email.trim(), address: address.trim(),
    plan, item: plan === "custom" ? (customItem.trim() || "Layanan Nexto") : PLANS[plan].item, unit: PLANS[plan].unit,
    ...(plan === "custom" ? { activatePlan } : {}),
    seats: Math.max(1, Number(seats) || 1), freeSeats: (plan === "enterprise" || (plan === "custom" && activatePlan === "enterprise")) ? Math.min(5, Math.max(0, Math.floor(Number(freeSeats) || 0))) : 0, months: Number(months) || 1, pricePerSeat: Number(pricePerSeat) || 0,
    discountLabel: discountLabel.trim(), discountType, discountValue: Number(discountValue) || 0,
    date, due: addDays(date, Number(validDays) || 0), start, end: addMonths(start, Number(months) || 1),
    note: note.trim(),
    seller: { name: seller.name, address: seller.address, email: seller.email, phone: seller.phone, bank: seller.bank, account: seller.account, holder: seller.holder, signName: seller.signName, signTitle: seller.signTitle, signImage: seller.signImage, stampImage: seller.stampImage },
  };
  const shown = viewing ? viewing.data : draft;
  const html = viewing
    ? buildInvoiceHtml(viewing.data, { kind: "quotation", number: viewing.number, status: viewing.status })
    : buildInvoiceHtml(draft, { kind: "quotation" });
  const { total } = computeTotals(shown);

  const [initialHtml] = useState(html);
  const syncFrame = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    const next = new DOMParser().parseFromString(html, "text/html");
    if (doc.body.innerHTML !== next.body.innerHTML) doc.body.innerHTML = next.body.innerHTML;
    if (doc.title !== next.title) doc.title = next.title;
  };
  useEffect(syncFrame, [html]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveAndDownload = async () => {
    if (!company.trim()) { alert("Isi nama perusahaan terlebih dahulu."); return; }
    if (!window.confirm(`Simpan quotation untuk ${company.trim()} sebesar ${rp(total)}? Nomor dibuat berurutan dan quotation tidak dapat diubah setelah disimpan.`)) return;
    setBusy(true);
    try {
      const { invoice } = await call("create", { invoice: { company: draft.company, invoice_date: draft.date, due_date: draft.due, total, data: draft } });
      setViewing(invoice);
      setHistory((h) => [invoice, ...(h || []).filter((x) => x.id !== invoice.id)]);
      await downloadInvoicePdf(invoice, "quotation").catch((e) => alert("Quotation tersimpan, tetapi PDF gagal diunduh: " + e.message));
    } catch (e) {
      alert("Gagal menyimpan quotation: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const patchRow = (patch) => {
    setHistory((h) => (h || []).map((x) => (x.id === patch.id ? { ...x, ...patch } : x)));
    setViewing((v) => (v && v.id === patch.id ? { ...v, ...patch } : v));
    setSendingQ((v) => (v && v.id === patch.id ? { ...v, ...patch } : v));
  };

  const setStatus = async (q, status) => {
    if (status === "void" && !window.confirm(`Batalkan quotation ${q.number}? Nomornya tetap tercatat (tidak dipakai ulang).`)) return;
    try {
      const { invoice } = await call("set_status", { id: q.id, status });
      patchRow(invoice);
    } catch (e) { alert("Gagal mengubah status: " + e.message); }
  };

  // Quotation -> invoice. Isi disalin; tanggal invoice hari ini, jatuh tempo 7 hari,
  // periode mulai paling cepat hari ini. Invoice dibuat dulu, baru quotation ditandai.
  const convert = async (q) => {
    const d = q.data || {};
    if (!window.confirm(`Jadikan ${q.number} sebagai invoice untuk ${q.company} sebesar ${rp(q.total)}? Invoice baru langsung tersimpan (jatuh tempo 7 hari) dan tidak dapat diubah.`)) return;
    const begin = d.start && d.start > today ? d.start : today;
    const invData = {
      ...d, date: today, due: addDays(today, 7), start: begin, end: addMonths(begin, Number(d.months) || 1),
      note: [`Berdasarkan penawaran ${q.number}.`, d.note].filter(Boolean).join(" "),
      fromQuotation: q.number,
    };
    const invTotal = computeTotals(invData).total;
    setBusy(true);
    let created = null;
    try {
      const r = await db.adminInvoices("create", { invoice: { company: q.company, invoice_date: today, due_date: invData.due, total: invTotal, data: invData } });
      created = r.invoice;
      const m = await call("mark_converted", { id: q.id, invoice_number: created.number });
      patchRow(m.invoice);
      alert(`Invoice ${created.number} dibuat. Buka kartu Invoice untuk mengirimnya ke klien.`);
    } catch (e) {
      alert(created
        ? `Invoice ${created.number} sudah dibuat, tetapi quotation belum ditandai: ${e.message}. Ubah status quotation menjadi Disetujui secara manual dan jangan konversi ulang.`
        : "Gagal membuat invoice: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const duplicate = (q) => {
    const d = q.data || {};
    skipAutofill.current = (d.company || "") !== company;
    setViewing(null);
    setCompany(d.company || ""); setContact(d.contact || ""); setEmail(d.email || ""); setAddress(d.address || "");
    const pl = PLANS[d.plan] ? d.plan : "custom";
    setPlan(pl); setCustomItem(pl === "custom" ? (d.item || "") : "");
    setSeats(d.seats || PLANS[pl].minSeats); setFreeSeats(d.freeSeats || 0); setMonths(d.months || 1); setPricePerSeat(d.pricePerSeat ?? priceOf(pl === "custom" ? "enterprise" : pl));
    setDiscountLabel(d.discountLabel || ""); setDiscountType(d.discountType || "amount"); setDiscountValue(d.discountValue ? String(d.discountValue) : "");
    setNote(d.note || ""); setDate(today); setStart(today);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const newQuotation = () => { setViewing(null); setCompany(""); setContact(""); setEmail(""); setAddress(""); setNote(""); setDiscountValue(""); setDiscountLabel(""); setDate(today); setStart(today); };

  const open = (history || []).filter((x) => x.status === "open" && x.due_date >= today);
  const openTotal = open.reduce((s, x) => s + Number(x.total || 0), 0);

  return (
    <div className="space-y-6">
      <div ref={topRef} className="grid scroll-mt-4 gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 lg:h-[min(72vh,760px)]">
          {viewing && (
            <div className="rounded-lg border border-violet-400/40 bg-violet-500/10 px-3 py-2.5 text-[12px] text-violet-100">
              Menampilkan quotation tersimpan <b>{viewing.number}</b>. Quotation tersimpan tidak dapat diubah.
              <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                <button type="button" onClick={() => duplicate(viewing)} className="font-semibold underline underline-offset-2">Duplikat untuk direvisi</button>
                <button type="button" onClick={newQuotation} className="font-semibold underline underline-offset-2">Buat quotation baru</button>
              </span>
            </div>
          )}
          <div className="space-y-3 lg:-mr-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-2">
            <fieldset disabled={!!viewing} className="space-y-3">
              <div>
                <label className={lbl} htmlFor="quo-company">Nama perusahaan</label>
                <input id="quo-company" list="quo-orgs" className={field} value={viewing ? viewing.company : company} onChange={(e) => setCompany(e.target.value)} placeholder="Ketik nama perusahaan calon klien" autoComplete="off" />
                <datalist id="quo-orgs">{orgs.map((o) => <option key={o.name} value={o.name} />)}</datalist>
                {!viewing && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {matched ? `Klien ${PLANS[matched.plan].label} ditemukan: ${matched.members} anggota terdaftar, paket & data owner terisi otomatis.` : "Untuk calon klien baru, isi data di bawah secara manual."}
                  </p>
                )}
              </div>
              {!viewing && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={lbl}>Nama PIC</label><input className={field} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Nama penanggung jawab" /></div>
                    <div><label className={lbl}>Email PIC</label><input type="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@perusahaan.com" /></div>
                  </div>
                  <div><label className={lbl}>Alamat perusahaan</label><textarea rows={2} className={field} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Jl. ..., Kota, Kode pos" /></div>
                  <div>
                    <label className={lbl} htmlFor="quo-plan">Paket</label>
                    <select id="quo-plan" className={field} value={plan} onChange={(e) => choosePlan(e.target.value)}>
                      {Object.entries(PLANS).map(([k, p]) => (
                        <option key={k} value={k}>{k === "custom" ? "Custom (isi sendiri)" : `${p.label} - ${rp(priceOf(k))}/${p.unit}/bulan${p.minSeats > 1 ? `, min. ${p.minSeats}` : ""}`}</option>
                      ))}
                    </select>
                  </div>
                  {plan === "custom" && (
                    <div><label className={lbl}>Deskripsi layanan</label><input className={field} value={customItem} onChange={(e) => setCustomItem(e.target.value)} placeholder="Misal: Nexto Enterprise + onboarding tim" /></div>
                  )}
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={lbl}>Jumlah {draft.unit}</label><input type="number" min={PLANS[plan].minSeats} className={field} value={seats} onChange={(e) => setSeats(e.target.value)} /></div>
                    <div>
                      <label className={lbl}>Periode</label>
                      <select className={field} value={months} onChange={(e) => setMonths(e.target.value)}>
                        <option value={1}>1 bulan</option><option value={3}>3 bulan</option><option value={6}>6 bulan</option><option value={12}>12 bulan</option>
                      </select>
                    </div>
                    <div><label className={lbl}>Harga/{PLANS[plan].unit === "anggota tim" ? "anggota" : "pengguna"}</label><input type="number" min="0" step="1000" className={field} value={pricePerSeat} onChange={(e) => setPricePerSeat(e.target.value)} /></div>
                  </div>
                  {(plan === "enterprise" || (plan === "custom" && activatePlan === "enterprise")) && (
                    <div>
                      <label className={lbl}>Kursi gratis (owner/manager)</label>
                      <input type="number" min="0" max="5" className={field} value={freeSeats} onChange={(e) => setFreeSeats(e.target.value)} />
                      <p className="mt-1 text-[11.5px] text-slate-400">Tidak ditagih, tetapi menambah batas anggota. Isi 1 bila owner hanya memantau lewat dashboard dan seluruh tim sudah dihitung di Jumlah.</p>
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_96px_110px] gap-3">
                    <div><label className={lbl}>Diskon (opsional)</label><input className={field} value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} placeholder="Misal: Diskon early bird" /></div>
                    <div>
                      <label className={lbl}>Jenis</label>
                      <select className={field} value={discountType} onChange={(e) => setDiscountType(e.target.value)}><option value="amount">Rp</option><option value="percent">%</option></select>
                    </div>
                    <div><label className={lbl}>Nilai</label><input type="number" min="0" className={field} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="0" /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className={lbl}>Tanggal penawaran</label><input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} /></div>
                    <div><label className={lbl}>Mulai periode</label><input type="date" className={field} value={start} onChange={(e) => setStart(e.target.value)} /></div>
                    <div>
                      <label className={lbl}>Berlaku</label>
                      <select className={field} value={validDays} onChange={(e) => setValidDays(e.target.value)}>
                        <option value={7}>7 hari</option><option value={14}>14 hari</option><option value={30}>30 hari</option><option value={60}>60 hari</option>
                      </select>
                    </div>
                  </div>
                  <div><label className={lbl}>Catatan (opsional)</label><textarea rows={2} className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Misal: termasuk onboarding tim 1 sesi" /></div>
                  <p className="text-[11px] text-slate-400">Data penagih, tanda tangan, dan stempel mengikuti pengaturan di kartu Invoice.</p>
                </>
              )}
            </fieldset>
          </div>

          <div className="shrink-0 space-y-1.5">
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/70 px-3 py-2.5">
              <div>
                <div className="text-[11px] text-slate-400">Total penawaran</div>
                <div className="font-mono text-[17px] font-bold text-slate-50">{rp(total)}</div>
              </div>
              {viewing ? (
                <button type="button" onClick={() => downloadInvoicePdf(viewing, "quotation").catch((e) => alert("PDF gagal diunduh: " + e.message))} className="rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-400">Unduh PDF</button>
              ) : (
                <button type="button" disabled={busy} onClick={saveAndDownload} className="rounded-lg bg-violet-500 px-4 py-2 text-[13px] font-semibold text-white hover:bg-violet-400 disabled:opacity-60">{busy ? "Menyimpan…" : "Simpan & unduh PDF"}</button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">Berkas PDF langsung terunduh.</p>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-700 bg-white">
          <iframe ref={frameRef} title="Pratinjau quotation" srcDoc={initialHtml} onLoad={syncFrame} className="block h-[min(72vh,760px)] w-full bg-white" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-700">
        <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-700 px-4 py-3">
          <div className="text-[13px] font-semibold text-slate-100">Riwayat quotation</div>
          {history && history.length > 0 && (
            <div className="text-[12px] text-slate-400">Menunggu persetujuan <span className="font-mono font-semibold text-amber-300">{rp(openTotal)}</span> dari {open.length} quotation</div>
          )}
        </div>
        {history === null ? (
          <p className="px-4 py-4 text-[12px] text-slate-400">Memuat riwayat…</p>
        ) : historyErr ? (
          <p className="px-4 py-4 text-[12px] text-rose-300">Riwayat gagal dimuat: {historyErr}</p>
        ) : history.length === 0 ? (
          <p className="px-4 py-4 text-[12px] text-slate-400">Belum ada quotation tersimpan. Quotation pertama akan bernomor 0001.</p>
        ) : (
          <div className="max-h-[360px] overflow-auto overscroll-contain">
            <table className="w-full min-w-[920px] text-[12.5px]">
              <thead className="sticky top-0 bg-[#0b0f17] text-left text-[11px] text-slate-400">
                <tr><th className="px-4 py-2 font-semibold">Nomor</th><th className="px-2 py-2 font-semibold">Klien</th><th className="px-2 py-2 font-semibold">Tanggal</th><th className="px-2 py-2 font-semibold">Berlaku sampai</th><th className="px-2 py-2 text-right font-semibold">Total</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-2 py-2 font-semibold">Invoice</th><th className="px-4 py-2 text-right font-semibold">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {history.map((x) => {
                  const expired = x.status === "open" && x.due_date < today;
                  const sent = [...(x.email_log || [])].reverse().find((e) => e.type === "quotation");
                  return (
                    <tr key={x.id} className={viewing?.id === x.id ? "bg-violet-500/10" : ""}>
                      <td className="px-4 py-2 font-mono text-slate-200">{x.number}</td>
                      <td className="max-w-[200px] px-2 py-2 text-slate-200">
                        <div className="truncate">{x.company}</div>
                        {sent && <div className="truncate text-[11px] text-slate-400" title={sent.to}>Dikirim ke {sent.to}</div>}
                      </td>
                      <td className="px-2 py-2 text-slate-400">{fmtShort(x.invoice_date)}</td>
                      <td className={`px-2 py-2 ${expired ? "font-semibold text-rose-300" : "text-slate-400"}`}>{fmtShort(x.due_date)}{expired ? " (lewat)" : ""}</td>
                      <td className="px-2 py-2 text-right font-mono text-slate-100">{rp(x.total)}</td>
                      <td className="px-2 py-2">
                        <select value={x.status} disabled={!!x.data?.converted} title={x.data?.converted ? "Sudah dijadikan invoice" : undefined} onChange={(e) => setStatus(x, e.target.value)} className="rounded-md border border-slate-600 bg-slate-900 px-1.5 py-1 text-[12px] font-semibold disabled:opacity-70" style={{ color: STATUS[x.status]?.color }}>
                          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        {x.data?.converted ? (
                          <span className="font-mono text-[12px] text-emerald-300" title={`Dikonversi ${fmtStamp(x.data.converted.at)}`}>{x.data.converted.invoice_number}</span>
                        ) : x.status !== "void" && x.status !== "rejected" ? (
                          <button type="button" disabled={busy} onClick={() => convert(x)} className="rounded-md border border-violet-400/50 px-2 py-1 text-[12px] font-semibold text-violet-200 hover:bg-violet-500/15 disabled:opacity-50">Jadikan invoice</button>
                        ) : <span className="text-[12px] text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {x.public_token && <button type="button" onClick={() => downloadInvoicePdf(x, "quotation").catch((e) => alert("PDF gagal diunduh: " + e.message))} className="mr-3 font-semibold text-emerald-300 hover:text-emerald-200">Unduh</button>}
                        {x.status !== "void" && x.public_token && <button type="button" onClick={() => setSendingQ(x)} className="mr-3 font-semibold text-violet-300 hover:text-violet-200">Kirim</button>}
                        <button type="button" onClick={() => duplicate(x)} className="mr-3 font-semibold text-slate-400 hover:text-slate-200" title="Salin isi quotation ini ke form baru">Duplikat</button>
                        {viewing?.id === x.id
                          ? <button type="button" onClick={newQuotation} className="font-semibold text-slate-300 hover:text-white">Tutup</button>
                          : <button type="button" onClick={() => { setViewing(x); topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="font-semibold text-violet-300 hover:text-violet-200">Lihat</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {sendingQ && <SendDialog quotation={sendingQ} onClose={() => setSendingQ(null)} onChange={patchRow} />}
    </div>
  );
}
