import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, RefreshCw, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import * as db from "../lib/db";
import { isoDay, fmtShort } from "./EnterpriseInvoicePanel";

// Kartu CASH FLOW di Command Center (9 Okt 2026, permintaan Nando): laporan keuangan bulanan
// (laba rugi, arus kas metode langsung, posisi keuangan ringkas, rekonsiliasi saldo prabayar Anthropic)
// dan bar status saldo token yang diperbarui live. Perhitungan semuanya di server (admin-cashflow);
// panel ini hanya menampilkan. Semua total adalah penjumlahan baris yang tampil (tanpa selisih pembulatan).
const REFRESH_MS = 60000;
const LIVE_MS = 10000;
const usd = (n, d) => {
  const v = Number(n) || 0;
  const dec = d ?? (Math.abs(v) > 0 && Math.abs(v) < 1 ? 4 : 2);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: dec })}`;
};
const idr = (n) => `Rp${Math.round(Math.abs(Number(n) || 0)).toLocaleString("id-ID")}`;
// Format akuntansi: nilai negatif dalam tanda kurung.
const acc = (n) => (Number(n) < 0 ? `(${idr(n)})` : idr(n));
const mp = (v) => (v === null || v === undefined ? "-" : `${v}%`);
const BLOCK = "rounded-xl border border-white/[0.14] bg-[#111826]";
const inp = "rounded-lg border border-white/[0.2] bg-[#0a0f18] px-2.5 py-2 text-[12px] text-slate-100 font-mono placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none";
const lab = "block text-[10px] font-mono uppercase tracking-wide text-slate-300 mb-1";
const btnAdd = "inline-flex items-center justify-center gap-1 text-[11px] font-mono font-bold px-3 py-2 rounded-lg border border-emerald-400/60 bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35 disabled:opacity-40";
const DARK = { colorScheme: "dark" }; // kalender dan dropdown bawaan browser ikut gelap
const uid = () => (globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()));
const barColor = (p) => (p >= 85 ? "#fb7185" : p >= 60 ? "#fbbf24" : "#34d399");
const ym2label = (ym) => new Date(`${ym}-15T12:00:00+07:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const monthsBack = (fromYm, n) => {
  const [y, m] = fromYm.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - i, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; });
};
const ago = (iso, now) => {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} dtk lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} mnt lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
};

function Tile({ label, value, sub, accent }) {
  return (
    <div className={`${BLOCK} px-3 py-2.5 min-w-0`}>
      <div className="text-[10px] font-mono uppercase tracking-wide text-slate-300">{label}</div>
      <div className="text-[18px] font-bold font-mono mt-0.5 truncate" style={{ color: accent || "#f8fafc" }}>{value}</div>
      {sub && <div className="text-[10.5px] font-mono text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function Section({ title, hint, children }) {
  return (
    <section className="grid gap-2 min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-100">{title}</h3>
        {hint && <span className="text-[10.5px] font-mono text-slate-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

// Tabel laporan: baris { l, v, indent, bold, top, sub, c, head, usd }. v = angka (null = tidak tersedia).
function Statement({ rows, foot }) {
  return (
    <div className={`${BLOCK} p-3`}>
      <div className="grid">
        {rows.map((r, i) => (
          <div key={i} className={`flex items-baseline justify-between gap-3 font-mono py-1 ${r.top ? "border-t border-white/[0.25] mt-1 pt-1.5" : ""} ${r.head ? "pt-2" : ""}`}>
            <span className={r.head ? "font-bold uppercase tracking-wide text-slate-300 text-[10.5px]" : `text-[12px] ${r.bold ? "font-bold text-white" : "text-slate-200"}`} style={{ paddingLeft: (r.indent || 0) * 14 }}>
              {r.l}{r.sub && <span className="text-[10.5px] font-normal text-slate-400 ml-2">{r.sub}</span>}
            </span>
            {!r.head && (
              <span className={`text-[13px] tabular-nums shrink-0 ${r.bold ? "font-bold" : ""}`} style={{ color: r.c || (r.bold ? "#ffffff" : "#e2e8f0") }}>
                {r.v === null || r.v === undefined ? "-" : (r.usd ? usd(r.v) : acc(r.v))}
              </span>
            )}
          </div>
        ))}
      </div>
      {foot && <div className="text-[10.5px] text-slate-400 font-mono leading-relaxed mt-2 pt-2 border-t border-white/[0.12]">{foot}</div>}
    </div>
  );
}

// Bar status saldo token Anthropic, diperbarui tiap 10 detik (dihentikan saat tab tidak terlihat).
export function LiveBalance({ kurs, onNeedSetup, compact, children, reloadKey, setupWhere = "pada isian di bawah" }) {
  const [b, setB] = useState(null);
  const [detail, setDetail] = useState(!compact);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(Date.now());
  const [fresh, setFresh] = useState(new Set());
  const seen = useRef(new Set());
  const first = useRef(true);
  const lastOk = useRef(Date.now());

  const pull = useCallback(async () => {
    if (typeof document !== "undefined" && document.hidden) return;
    try {
      const r = await db.adminCashflow("balance");
      setB(r); setErr(""); lastOk.current = Date.now();
      const keys = (r.recent || []).map((e) => `${e.at}|${e.feature}|${e.cost_usd}`);
      if (first.current) { keys.forEach((k) => seen.current.add(k)); first.current = false; }
      else {
        const added = keys.filter((k) => !seen.current.has(k));
        if (added.length) { added.forEach((k) => seen.current.add(k)); setFresh(new Set(added)); setTimeout(() => setFresh(new Set()), 4000); }
      }
    } catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => {
    pull();
    const t = setInterval(pull, LIVE_MS);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, [pull, reloadKey]);

  if (!b) return <div className={`${BLOCK} p-4 text-[12px] font-mono text-slate-300 flex items-center gap-2`}>{err ? err : <><Loader2 className="w-3.5 h-3.5 animate-spin" /> memuat saldo token...</>}</div>;

  const stale = now - lastOk.current > LIVE_MS * 3;
  const pctLeft = b.has_checkpoint ? b.pct_remaining : null;
  const accent = pctLeft === null ? "#cbd5e1" : b.remaining_usd <= 0 ? "#fb7185" : pctLeft < 15 ? "#fb7185" : pctLeft < 40 ? "#fbbf24" : "#34d399";
  return (
    <div className="rounded-xl border-2 p-4 grid gap-3 bg-[#111826]" style={{ borderColor: accent }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {!stale && <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: accent }} />}
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: stale ? "#64748b" : accent }} />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-100">Saldo token Anthropic</span>
          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border" style={{ color: stale ? "#94a3b8" : accent, borderColor: stale ? "#475569" : accent }}>{stale ? "TERHENTI" : "LIVE"}</span>
        </div>
        <span className="text-[10.5px] font-mono text-slate-400">diperbarui {Math.max(0, Math.round((now - lastOk.current) / 1000))} dtk lalu · tiap {LIVE_MS / 1000} dtk</span>
      </div>
      {children}

      {!b.has_checkpoint ? (
        <div className="text-[12px] font-mono text-slate-200 leading-relaxed">
          Saldo belum dapat dihitung karena saldo patokan belum diisi. Buka Console Anthropic, lihat kredit Anda, lalu isi tanggal dan saldonya {setupWhere}.
          {onNeedSetup && <div className="mt-2"><button onClick={onNeedSetup} className={btnAdd}>Isi saldo patokan</button></div>}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="text-[30px] font-bold font-mono leading-none" style={{ color: accent }}>{usd(b.remaining_usd)}</div>
              <div className="text-[11.5px] font-mono text-slate-300 mt-1">≈ {idr(b.remaining_usd * kurs)} · sisa {pctLeft}% dari {usd(b.funded_usd)}</div>
            </div>
            <div className="text-right text-[11.5px] font-mono text-slate-300 leading-relaxed">
              <div>Perkiraan habis: <span className="font-bold" style={{ color: accent }}>{b.empty_date ? `${fmtShort(b.empty_date)} (${b.runway_days} hari lagi)` : "-"}</span></div>
              {(b.remaining_usd <= 0 || pctLeft < 15) && <div className="text-rose-300 font-bold">Segera top up Anthropic.</div>}
            </div>
          </div>

          <div>
            <div className="relative h-5 rounded-full bg-[#0a0f18] border border-white/[0.25] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(100, Math.max(0, pctLeft))}%`, background: `linear-gradient(90deg, ${accent}aa, ${accent})` }} />
              {[25, 50, 75].map((m) => <span key={m} className="absolute top-0 bottom-0 w-px bg-white/25" style={{ left: `${m}%` }} />)}
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
              <span>0</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
            </div>
          </div>
          <div className="text-[11px] font-mono text-slate-300">
            Terpakai <span className="text-white font-bold">{usd(b.consumed_usd)}</span> dari {usd(b.funded_usd)} (saldo patokan {usd(b.opening_usd)} pada {fmtShort(b.checkpoint_date)} + top-up {usd(b.topups_usd)})
          </div>
        </>
      )}

      {compact && (
        <button onClick={() => setDetail((v) => !v)} className="justify-self-start text-[11px] font-mono font-bold text-slate-200 border border-white/[0.25] rounded-lg px-2.5 py-1 hover:bg-[#182033]">
          {detail ? "Sembunyikan detail" : "Lihat detail pemakaian"}
        </button>
      )}
      {detail && <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="Pakai hari ini" value={usd(b.spent_today_usd)} sub={idr(b.spent_today_usd * kurs)} accent="#f9a8d4" />
        <Tile label="Pakai 1 jam terakhir" value={usd(b.spent_last_hour_usd)} sub={idr(b.spent_last_hour_usd * kurs)} />
        <Tile label="Rata-rata 7 hari" value={`${usd(b.burn_usd_per_day)}/hari`} sub={idr(b.burn_usd_per_day * kurs) + "/hari"} />
        <Tile label="Pemakaian terakhir" value={b.last_usage_at ? ago(b.last_usage_at, now) : "-"} sub={b.recent?.[0]?.feature || "belum ada"} />
      </div>}

      {detail && b.recent?.length > 0 && (
        <div className="rounded-lg bg-[#0a0f18] border border-white/[0.12] p-2 grid gap-0.5">
          <div className="text-[10px] font-mono uppercase tracking-wide text-slate-400 px-1">Pemakaian terbaru</div>
          {b.recent.map((e, i) => {
            const key = `${e.at}|${e.feature}|${e.cost_usd}`;
            return (
              <div key={i} className={`flex items-center justify-between gap-3 text-[11.5px] font-mono px-1.5 py-0.5 rounded transition-colors duration-1000 ${fresh.has(key) ? "bg-emerald-500/25" : ""}`}>
                <span className="text-slate-300 w-[84px] shrink-0">{ago(e.at, now)}</span>
                <span className="text-white truncate flex-1">{e.feature}</span>
                <span className="text-pink-200 tabular-nums">{usd(e.cost_usd, 6)}</span>
              </div>
            );
          })}
        </div>
      )}
      {detail && <div className="text-[10.5px] text-slate-400 font-mono leading-relaxed">
        Anthropic tidak membuka saldo kredit lewat API, jadi saldo dihitung dari saldo patokan + top-up - biaya AI yang tercatat di Nexto. Pemakaian di luar Nexto tidak terhitung; cocokkan dengan Console Anthropic sesekali.
      </div>}
    </div>
  );
}

export default function CashflowPanel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState(null); // null = bulan berjalan
  const [form, setForm] = useState(null); // salinan pengaturan yang sedang diedit
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { ok, text }
  const settingsRef = useRef(null);
  const [newTop, setNewTop] = useState({ date: isoDay(new Date()), amount_usd: "", amount_idr: "", note: "" });
  const [newCost, setNewCost] = useState({ name: "", amount: "", currency: "USD", kind: "hpp" });

  const load = useCallback(async (silent, per) => {
    if (!silent) setLoading(true);
    try {
      const r = await db.adminCashflow("get", per ? { period: per } : {});
      setData(r); setErr("");
      setForm((cur) => cur || r.settings);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    load(false, period);
    const t = setInterval(() => load(true, period), REFRESH_MS);
    return () => clearInterval(t);
  }, [load, period]);

  // Simpan seluruh pengaturan ke server lalu muat ulang hitungan.
  const persist = async (next, okText) => {
    setSaving(true); setNotice(null);
    try {
      const r = await db.adminCashflow("save", { settings: next });
      setForm(r.settings); setDirty(false);
      await load(true, period);
      setNotice({ ok: true, text: okText || "Tersimpan." });
    } catch (e) { setNotice({ ok: false, text: "Gagal menyimpan: " + e.message }); }
    finally { setSaving(false); }
  };
  const edit = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); setNotice(null); };

  const addTopup = (e) => {
    e.preventDefault();
    const amount = Number(newTop.amount_usd);
    if (!newTop.date) return setNotice({ ok: false, text: "Pilih tanggal top-up." });
    if (!(amount > 0)) return setNotice({ ok: false, text: "Isi jumlah top-up dalam USD (lebih dari 0)." });
    const paid = newTop.amount_idr === "" ? null : Number(newTop.amount_idr);
    persist({ ...form, topups: [...form.topups, { id: uid(), date: newTop.date, amount_usd: amount, amount_idr: paid > 0 ? paid : null, note: newTop.note.trim() }] }, "Top-up ditambahkan.");
    setNewTop({ ...newTop, amount_usd: "", amount_idr: "", note: "" });
  };
  const addCost = (e) => {
    e.preventDefault();
    const amount = Number(newCost.amount);
    if (!newCost.name.trim()) return setNotice({ ok: false, text: "Isi nama biaya, misalnya Supabase." });
    if (newCost.amount === "" || !(amount >= 0)) return setNotice({ ok: false, text: "Isi jumlah biaya per bulan." });
    persist({ ...form, costs: [...form.costs, { id: uid(), name: newCost.name.trim(), currency: newCost.currency, amount, kind: newCost.kind }] }, "Biaya tetap ditambahkan.");
    setNewCost({ ...newCost, name: "", amount: "" });
  };

  const goSettings = () => settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (err && !data) return <div className="text-[12px] text-rose-300 font-mono">{err}</div>;
  if (!data || !form) return <div className="flex items-center gap-2 text-[12px] text-slate-300 font-mono"><Loader2 className="w-3.5 h-3.5 animate-spin" /> memuat cash flow...</div>;

  const { summary: s, income: inc, cashflow: cf, position: pos, prepaid: pre, contracts, period: per } = data;
  const kurs = Number(data.kurs) || 17700;
  const ki = data.kurs_info || {};
  const kursNote = ki.mode === "auto"
    ? (ki.fallback ? "kurs otomatis gagal diambil, memakai kurs manual" : `otomatis dari ${ki.source}${ki.stale ? " (data lama)" : ""}`)
    : "kurs manual";
  const months = monthsBack(per.current_ym, 24);
  const idx = months.indexOf(per.ym);
  const profitAccent = inc.net_profit >= 0 ? "#34d399" : "#fb7185";

  const incomeRows = [
    { head: true, l: "Pendapatan" },
    { l: "Pendapatan invoice", v: inc.revenue.invoice, indent: 1 },
    { l: "Pendapatan langganan Mayar", v: inc.revenue.mayar, indent: 1 },
    ...(inc.revenue.estimate ? [{ l: "Pendapatan langganan (perkiraan)", v: inc.revenue.estimate, indent: 1, c: "#fcd34d" }] : []),
    { l: "Total pendapatan", v: inc.revenue.total, bold: true, top: true },
    { head: true, l: "Harga pokok pendapatan (HPP)" },
    { l: "Token Anthropic (pemakaian)", v: -inc.cogs.ai, indent: 1, sub: `${mp(inc.ai_pct_of_revenue)} dari pendapatan` },
    { l: "Infrastruktur (Supabase, dll)", v: -inc.cogs.infra, indent: 1 },
    { l: "Total HPP", v: -inc.cogs.total, top: true },
    { l: "Laba kotor", v: inc.gross_profit, bold: true, top: true, sub: `margin ${mp(inc.gross_margin_pct)}`, c: inc.gross_profit >= 0 ? "#34d399" : "#fb7185" },
    { head: true, l: "Beban operasional" },
    { l: "Beban operasional lain", v: -inc.opex, indent: 1 },
    { l: "Laba bersih sebelum pajak", v: inc.net_profit, bold: true, top: true, sub: `margin ${mp(inc.net_margin_pct)}`, c: profitAccent },
  ];
  const cashRows = [
    { head: true, l: "Arus kas dari aktivitas operasi" },
    { l: "Penerimaan dari pelanggan: invoice", v: cf.receipts.invoice, indent: 1 },
    { l: "Penerimaan dari pelanggan: Mayar", v: cf.receipts.mayar, indent: 1 },
    { l: "Total penerimaan", v: cf.receipts.total, top: true },
    { l: "Pembelian token Anthropic (top-up)", v: -cf.payments.anthropic, indent: 1 },
    { l: "Pembayaran infrastruktur", v: -cf.payments.infra, indent: 1 },
    { l: "Pembayaran beban operasional lain", v: -cf.payments.opex, indent: 1 },
    { l: "Total pengeluaran", v: -cf.payments.total, top: true },
    { l: "Kas bersih dari aktivitas operasi", v: cf.net_operating, bold: true, top: true, c: cf.net_operating >= 0 ? "#34d399" : "#fb7185" },
    { head: true, l: "Aktivitas investasi dan pendanaan" },
    { l: "Arus kas investasi", v: cf.investing, indent: 1 },
    { l: "Arus kas pendanaan", v: cf.financing, indent: 1 },
    { l: "Kenaikan (penurunan) kas bersih", v: cf.net_change, bold: true, top: true, c: cf.net_change >= 0 ? "#34d399" : "#fb7185" },
    { l: "Saldo kas awal periode", v: cf.opening_cash },
    { l: "Saldo kas akhir periode", v: cf.closing_cash, bold: true, top: true },
  ];
  const posRows = [
    { head: true, l: "Aset" },
    { l: "Kas", v: pos.assets.cash, indent: 1 },
    { l: "Piutang usaha (invoice belum dibayar)", v: pos.assets.receivables, indent: 1 },
    { l: "Token Anthropic prabayar", v: pos.assets.prepaid_ai, indent: 1 },
    { l: "Total aset", v: pos.assets.total, bold: true, top: true },
    { head: true, l: "Liabilitas" },
    { l: "Pendapatan diterima di muka", v: pos.liabilities.unearned, indent: 1 },
    { l: "Total liabilitas", v: pos.liabilities.total, bold: true, top: true },
    { l: "Aset bersih (aset - liabilitas)", v: pos.net_assets, bold: true, top: true, c: pos.net_assets >= 0 ? "#34d399" : "#fb7185" },
  ];
  const prepaidRows = pre.available ? [
    { head: true, l: "Rupiah (biaya rata-rata tertimbang)" },
    { l: "Saldo awal", v: pre.idr.opening, indent: 1 },
    { l: "Pembelian (top-up)", v: pre.idr.topup, indent: 1 },
    { l: "Dipakai (masuk HPP)", v: -pre.idr.consumed, indent: 1 },
    { l: "Saldo akhir", v: pre.idr.closing, bold: true, top: true },
    { head: true, l: "Dolar AS" },
    { l: "Saldo awal", v: pre.usd.opening, indent: 1, usd: true },
    { l: "Pembelian (top-up)", v: pre.usd.topup, indent: 1, usd: true },
    { l: "Dipakai", v: -pre.usd.consumed, indent: 1, usd: true },
    { l: "Saldo akhir", v: pre.usd.closing, bold: true, top: true, usd: true },
  ] : null;

  return (
    <div className="grid gap-5 min-w-0">
      <LiveBalance kurs={kurs} onNeedSetup={goSettings} setupWhere="di bagian Pengaturan (paling bawah kartu ini)" />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button disabled={idx >= months.length - 1} onClick={() => setPeriod(months[idx + 1])} className="p-1.5 rounded-lg border border-white/[0.2] bg-[#111826] text-slate-200 disabled:opacity-30" aria-label="Bulan sebelumnya"><ChevronLeft className="w-4 h-4" /></button>
          <select style={DARK} className={`${inp} min-w-[170px] font-bold`} value={per.ym} onChange={(e) => setPeriod(e.target.value === per.current_ym ? null : e.target.value)}>
            {months.map((m) => <option key={m} value={m}>{ym2label(m)}</option>)}
          </select>
          <button disabled={idx <= 0} onClick={() => setPeriod(months[idx - 1] === per.current_ym ? null : months[idx - 1])} className="p-1.5 rounded-lg border border-white/[0.2] bg-[#111826] text-slate-200 disabled:opacity-30" aria-label="Bulan berikutnya"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[10.5px] text-slate-300 font-mono">{per.is_current ? `s.d. ${fmtShort(per.as_of)}` : `periode ${fmtShort(per.start)} - ${fmtShort(per.as_of)}`} · kurs Rp{kurs.toLocaleString("id-ID")} ({kursNote}{ki.historical ? ", kurs harian historis" : ""})</span>
          <button onClick={() => load(false, period)} className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1.5 rounded-lg border border-white/[0.2] bg-[#111826] text-slate-200 hover:bg-[#182033]">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Muat ulang
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="MRR saat ini" value={idr(s.mrr)} sub={`nilai kontrak aktif ${idr(s.active_contract_value)}`} accent="#34d399" />
        <Tile label="Penerimaan kas periode" value={idr(cf.receipts.total)} sub="invoice + Mayar" />
        <Tile label="Piutang" value={idr(s.receivables)} sub={s.overdue_count ? `${s.overdue_count} lewat jatuh tempo` : "tidak ada yang lewat tempo"} accent={s.overdue_count ? "#fbbf24" : undefined} />
        <Tile label="Laba bersih periode" value={acc(inc.net_profit)} sub={`margin ${mp(inc.net_margin_pct)}`} accent={profitAccent} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Laporan laba rugi" hint={ym2label(per.ym)}>
          <Statement rows={incomeRows} foot="Pendapatan diakui bertahap per hari selama periode layanan (PSAK 72), bukan saat uang masuk. HPP token = pemakaian dinilai dengan biaya rata-rata tertimbang saldo prabayar. Pajak, gaji, dan penyusutan tidak dihitung kecuali ditambahkan sebagai Beban." />
        </Section>
        <Section title="Laporan arus kas" hint="metode langsung">
          <Statement rows={cashRows} foot={cf.opening_cash === null ? "Saldo kas awal belum diatur: isi bulan dan saldo kas awal di Pengaturan agar saldo kas tampil. Biaya tetap diasumsikan dibayar pada bulan yang sama." : "Biaya tetap diasumsikan dibayar pada bulan yang sama. Kas dihitung dari saldo awal yang Anda isi ditambah arus kas operasi tiap bulan."} />
        </Section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Posisi keuangan ringkas" hint={`per ${fmtShort(per.as_of)}`}>
          <Statement rows={posRows} foot={pos.complete ? "Piutang adalah invoice yang sudah terbit dan belum dibayar. Pendapatan diterima di muka adalah uang yang sudah masuk untuk layanan yang belum berjalan." : "Belum lengkap: saldo kas awal atau saldo patokan Anthropic belum diisi, sehingga bagian itu tampil kosong dan total aset belum mencerminkan seluruh aset."} />
        </Section>
        <Section title="Rekonsiliasi saldo token Anthropic" hint="aset prabayar">
          {prepaidRows
            ? <Statement rows={prepaidRows} foot={`Pemakaian dinilai dengan biaya rata-rata saldo; top-up memakai Rupiah yang dibayar bila diisi, jika tidak memakai kurs tanggal top-up.${pre.pre_checkpoint_idr ? ` Pemakaian sebelum tanggal patokan ${idr(pre.pre_checkpoint_idr)} dinilai dengan kurs harian.` : ""}`} />
            : <div className={`${BLOCK} p-3 text-[12px] font-mono text-slate-300 leading-relaxed`}>Tidak tersedia untuk periode ini karena saldo patokan belum diisi atau tanggalnya setelah periode ini. HPP token periode ini dihitung dengan kurs harian ({idr(inc.cogs.ai)}).</div>}
        </Section>
      </div>

      <Section title="Pendapatan: invoice dan langganan" hint="semua sumber dalam satu daftar, kondisi saat ini">
        <div className={`min-w-0 overflow-x-auto ${BLOCK}`}>
          <table className="w-full text-left border-collapse min-w-[820px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-300 font-mono bg-[#182033]">
                <th className="py-2 pl-3 pr-2 font-medium">Pelanggan</th>
                <th className="py-2 pr-2 font-medium text-right">Nilai</th>
                <th className="py-2 pr-2 font-medium text-right">Per bulan</th>
                <th className="py-2 pr-2 font-medium text-right">Jatah token</th>
                <th className="py-2 pr-2 font-medium text-right">Biaya AI</th>
                <th className="py-2 pr-2 font-medium text-right">Margin kotor</th>
                <th className="py-2 pr-3 font-medium">Terpakai</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-[12px] text-slate-400 font-mono">Belum ada invoice atau langganan.</td></tr>}
              {contracts.map((c) => (
                <tr key={c.id} className="border-t border-white/[0.12]">
                  <td className="py-2 pl-3 pr-2 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-semibold text-white truncate max-w-[200px]">{c.company}</span>
                      <span title={c.note || ""} className={`shrink-0 text-[9.5px] font-bold px-1.5 py-0.5 rounded border ${c.kind === "invoice" ? "border-violet-300/60 text-violet-200" : c.kind === "mayar" ? "border-sky-300/60 text-sky-200" : "border-amber-300/60 text-amber-200"}`}>{c.kind === "invoice" ? "Invoice" : c.kind === "mayar" ? "Mayar" : "Perkiraan"}</span>
                    </div>
                    {c.sub && <div className="text-[10.5px] font-mono text-slate-400 truncate max-w-[260px]">{c.sub}</div>}
                    <div className="text-[10.5px] font-mono text-slate-400">
                      {c.kind === "invoice" ? c.number : (c.plan === "professional" ? "Professional" : c.plan === "enterprise" ? "Enterprise" : "Standard")} · {c.seats} user · {c.months} bln ·{" "}
                      <span className={c.status === "paid" ? (c.active ? "text-emerald-300" : "text-slate-300") : "text-amber-300"}>
                        {c.status === "paid" ? (c.active ? "Aktif" : "Selesai") : (c.due_date && c.due_date < data.today ? "Lewat jatuh tempo" : "Belum dibayar")}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right text-white">{idr(c.total)}</td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right text-slate-200">{idr(c.monthly)}</td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right text-slate-200">{idr(c.quota_idr)}</td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right text-pink-200">
                    {c.ai_idr === null ? <span className="text-slate-500">-</span> : <>{idr(c.ai_idr)}<div className="text-[10px] text-slate-400">{usd(c.ai_usd)}</div></>}
                  </td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right">
                    {c.margin_pct === null ? <span className="text-slate-500">-</span> : <span className="font-bold" style={{ color: c.margin_pct >= 50 ? "#34d399" : c.margin_pct >= 20 ? "#fbbf24" : "#fb7185" }}>{c.margin_pct}%</span>}
                    {c.status === "paid" && <div className="text-[10px] text-slate-400">diakui {idr(c.recognized_idr)}</div>}
                  </td>
                  <td className="py-2 pr-3 w-[130px]">
                    {c.quota_used_pct === null ? (
                      <span className="text-[10.5px] font-mono text-slate-500">{c.status === "paid" ? "belum diaktifkan" : "-"}</span>
                    ) : (
                      <div>
                        <div className="h-2 rounded-full bg-[#0a0f18] border border-white/[0.15] overflow-hidden"><div className="h-full" style={{ width: `${Math.min(100, c.quota_used_pct)}%`, background: barColor(c.quota_used_pct) }} /></div>
                        <div className="text-[10.5px] font-mono mt-0.5 font-bold" style={{ color: barColor(c.quota_used_pct) }}>{c.quota_used_pct}% jatah</div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] text-slate-400 font-mono leading-relaxed">
          Biaya AI per pelanggan dihitung dari pemakaian sejak tanggal mulai, dalam Rupiah memakai kurs harian (angka pembanding; HPP laporan memakai biaya rata-rata saldo). Pembayaran Mayar dicatat otomatis (tanggal dan nominal pasti) dan ikut penerimaan kas. Baris Perkiraan adalah akun berbayar lama tanpa catatan pembayaran dan tidak ikut penerimaan kas.
          {s.manual_grants > 0 && ` Ada ${s.manual_grants} akun berbayar tanpa masa aktif (pemberian manual), tidak dihitung.`}
        </div>
      </Section>

      <div ref={settingsRef} />
      <Section title="Pengaturan" hint="top-up dan biaya tetap langsung tersimpan saat ditambah atau dihapus">
        <div className={`${BLOCK} p-3 grid gap-5`}>
          <div className="grid gap-2">
            <div className="text-[11.5px] font-bold text-slate-100">Parameter</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className={lab}>Kurs (Rp/USD)</label>
                <input type="number" disabled={form.kurs_auto !== false} className={`${inp} w-full disabled:opacity-60`} value={form.kurs_auto !== false ? kurs : form.kurs} onChange={(e) => edit({ kurs: e.target.value })} />
                <label className="mt-1.5 flex items-center gap-1.5 text-[11px] font-mono text-slate-200 cursor-pointer">
                  <input type="checkbox" checked={form.kurs_auto !== false} onChange={(e) => edit({ kurs_auto: e.target.checked, ...(e.target.checked ? {} : { kurs }) })} /> Otomatis (kurs harian)
                </label>
              </div>
              <div><label className={lab}>Jatah token (% kontrak)</label><input type="number" min="1" max="100" className={`${inp} w-full`} value={form.token_pct} onChange={(e) => edit({ token_pct: e.target.value })} /></div>
              <div><label className={lab}>Harga perkiraan Standard (Rp/bln)</label><input type="number" className={`${inp} w-full`} value={form.sub_price?.standard ?? ""} onChange={(e) => edit({ sub_price: { ...form.sub_price, standard: e.target.value } })} /></div>
              <div><label className={lab}>Harga perkiraan Professional (Rp/bln)</label><input type="number" className={`${inp} w-full`} value={form.sub_price?.professional ?? ""} onChange={(e) => edit({ sub_price: { ...form.sub_price, professional: e.target.value } })} /></div>
              <div><label className={lab}>Tanggal saldo patokan Anthropic</label><input type="date" style={DARK} className={`${inp} w-full`} value={form.anthropic.checkpoint_date || ""} onChange={(e) => edit({ anthropic: { ...form.anthropic, checkpoint_date: e.target.value || null } })} /></div>
              <div><label className={lab}>Saldo patokan Anthropic (USD)</label><input type="number" step="0.01" className={`${inp} w-full`} value={form.anthropic.balance_usd} onChange={(e) => edit({ anthropic: { ...form.anthropic, balance_usd: e.target.value } })} /></div>
              <div><label className={lab}>Saldo kas awal: bulan</label><input type="month" style={DARK} className={`${inp} w-full`} value={form.cash_opening?.month || ""} onChange={(e) => edit({ cash_opening: { ...(form.cash_opening || {}), month: e.target.value || null } })} /></div>
              <div><label className={lab}>Saldo kas awal (Rp)</label><input type="number" className={`${inp} w-full`} value={form.cash_opening?.amount_idr ?? 0} onChange={(e) => edit({ cash_opening: { ...(form.cash_opening || {}), amount_idr: e.target.value } })} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => persist(form, "Parameter disimpan.")} disabled={!dirty || saving} className={btnAdd}>
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} Simpan parameter
              </button>
              {dirty && <span className="text-[11px] text-amber-300 font-mono">Ada perubahan belum disimpan.</span>}
            </div>
            <div className="text-[10.5px] text-slate-400 font-mono leading-relaxed">
              Saldo patokan = kredit di Console Anthropic pada awal hari tanggal tersebut. Saldo kas awal = saldo rekening bisnis pada awal bulan yang dipilih; laporan kas dihitung dari situ.
            </div>
          </div>

          <div className="grid gap-2 border-t border-white/[0.15] pt-4">
            <div className="text-[11.5px] font-bold text-slate-100">Top-up Anthropic</div>
            {form.topups.length === 0 && <div className="text-[11.5px] text-slate-400 font-mono">Belum ada top-up tercatat.</div>}
            {[...form.topups].sort((x, y) => y.date.localeCompare(x.date)).map((t) => (
              <div key={t.id} className="flex items-center gap-3 text-[12px] font-mono rounded-lg bg-[#0a0f18] border border-white/[0.12] px-3 py-1.5">
                <span className="text-slate-200 w-[110px] shrink-0">{fmtShort(t.date)}</span>
                <span className="text-emerald-300 font-bold w-[90px] shrink-0">+{usd(t.amount_usd)}</span>
                <span className="text-slate-100 w-[130px] shrink-0">{t.amount_idr ? idr(t.amount_idr) : <span className="text-slate-400">kurs tanggal</span>}</span>
                <span className="text-slate-300 truncate flex-1">{t.note}</span>
                <button disabled={saving} onClick={() => persist({ ...form, topups: form.topups.filter((x) => x.id !== t.id) }, "Top-up dihapus.")} className="text-slate-300 hover:text-rose-300" aria-label="Hapus top-up"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <form onSubmit={addTopup} className="grid grid-cols-2 sm:grid-cols-[150px_110px_150px_1fr_auto] gap-2 items-end">
              <div><label className={lab}>Tanggal</label><input type="date" style={DARK} className={`${inp} w-full`} value={newTop.date} onChange={(e) => setNewTop({ ...newTop, date: e.target.value })} /></div>
              <div><label className={lab}>Jumlah (USD)</label><input type="number" step="0.01" min="0" placeholder="50" className={`${inp} w-full`} value={newTop.amount_usd} onChange={(e) => setNewTop({ ...newTop, amount_usd: e.target.value })} /></div>
              <div><label className={lab}>Dibayar (Rp, opsional)</label><input type="number" min="0" placeholder="mis. 897500" className={`${inp} w-full`} value={newTop.amount_idr} onChange={(e) => setNewTop({ ...newTop, amount_idr: e.target.value })} /></div>
              <div className="col-span-2 sm:col-span-1"><label className={lab}>Catatan</label><input placeholder="opsional" className={`${inp} w-full`} value={newTop.note} onChange={(e) => setNewTop({ ...newTop, note: e.target.value })} /></div>
              <button type="submit" disabled={saving} className={`${btnAdd} col-span-2 sm:col-span-1`}><Plus className="w-3.5 h-3.5" /> Tambah top-up</button>
            </form>
            <div className="text-[10.5px] text-slate-400 font-mono">Isi Rupiah yang benar-benar terdebit (termasuk biaya kartu dan pajak) agar kas keluar dan nilai aset prabayar tepat. Bila kosong, dipakai kurs pada tanggal top-up.</div>
          </div>

          <div className="grid gap-2 border-t border-white/[0.15] pt-4">
            <div className="text-[11.5px] font-bold text-slate-100">Biaya tetap bulanan</div>
            {form.costs.length === 0 && <div className="text-[11.5px] text-slate-400 font-mono">Belum ada. Isi Supabase ($25), Vercel, Cekat, domain, dan lainnya.</div>}
            {form.costs.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-[12px] font-mono rounded-lg bg-[#0a0f18] border border-white/[0.12] px-3 py-1.5">
                <span className="text-white font-semibold truncate flex-1">{c.name}</span>
                <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded border border-white/[0.25] text-slate-200">{c.kind === "hpp" ? "HPP" : "Beban"}</span>
                <span className="text-slate-100">{c.currency === "USD" ? `${usd(c.amount)} ≈ ${idr(c.amount * kurs)}` : idr(c.amount)}</span>
                <button disabled={saving} onClick={() => persist({ ...form, costs: form.costs.filter((x) => x.id !== c.id) }, "Biaya dihapus.")} className="text-slate-300 hover:text-rose-300" aria-label="Hapus biaya"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <form onSubmit={addCost} className="grid grid-cols-2 sm:grid-cols-[1fr_90px_110px_100px_auto] gap-2 items-end">
              <div className="col-span-2 sm:col-span-1"><label className={lab}>Nama</label><input placeholder="Supabase" className={`${inp} w-full`} value={newCost.name} onChange={(e) => setNewCost({ ...newCost, name: e.target.value })} /></div>
              <div><label className={lab}>Mata uang</label><select style={DARK} className={`${inp} w-full`} value={newCost.currency} onChange={(e) => setNewCost({ ...newCost, currency: e.target.value })}><option value="USD">USD</option><option value="IDR">Rp</option></select></div>
              <div><label className={lab}>Per bulan</label><input type="number" min="0" step="0.01" placeholder="25" className={`${inp} w-full`} value={newCost.amount} onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })} /></div>
              <div><label className={lab}>Jenis</label><select style={DARK} className={`${inp} w-full`} value={newCost.kind} onChange={(e) => setNewCost({ ...newCost, kind: e.target.value })}><option value="hpp">HPP</option><option value="opex">Beban</option></select></div>
              <button type="submit" disabled={saving} className={`${btnAdd} col-span-2 sm:col-span-1`}><Plus className="w-3.5 h-3.5" /> Tambah biaya</button>
            </form>
          </div>
        </div>
      </Section>

      {notice && (
        <div className={`sticky bottom-2 z-20 rounded-lg border px-3 py-2.5 text-[12px] font-mono font-bold shadow-xl ${notice.ok ? "border-emerald-400 bg-emerald-950 text-emerald-100" : "border-rose-400 bg-rose-950 text-rose-100"}`}>{notice.text}</div>
      )}
    </div>
  );
}

