import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, Plus, Trash2 } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import * as db from "../lib/db";
import { rp, isoDay, fmtShort } from "./EnterpriseInvoicePanel";

// Panel ARUS KAS di Command Center (9 Okt 2026, permintaan Nando): hitungan
// uang masuk vs jatah token Anthropic per kontrak tanpa hitung manual.
// Saldo Anthropic = patokan dari Console + top-up - biaya AI tercatat (ai_usage);
// kredit prabayar Anthropic tidak bisa dibaca lewat API.
// Tampilan (9 Okt 2026): latar solid, teks kontras tinggi, kalender mode gelap;
// tambah/hapus top-up dan biaya tetap langsung tersimpan.
const REFRESH_MS = 45000;
const usd = (n) => {
  const v = Number(n) || 0;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: Math.abs(v) > 0 && Math.abs(v) < 1 ? 4 : 2 })}`;
};
const BLOCK = "rounded-xl border border-white/[0.14] bg-[#111826]";
const inp = "rounded-lg border border-white/[0.2] bg-[#0a0f18] px-2.5 py-2 text-[12px] text-slate-100 font-mono placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none";
const lab = "block text-[10px] font-mono uppercase tracking-wide text-slate-300 mb-1";
const btnAdd = "inline-flex items-center justify-center gap-1 text-[11px] font-mono font-bold px-3 py-2 rounded-lg border border-emerald-400/60 bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35 disabled:opacity-40";
const DARK = { colorScheme: "dark" }; // kalender dan dropdown bawaan browser ikut gelap
const uid = () => (globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()));
const barColor = (p) => (p >= 85 ? "#fb7185" : p >= 60 ? "#fbbf24" : "#34d399");

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
    <section className="grid gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h3 className="text-[12px] font-bold uppercase tracking-wider text-slate-100">{title}</h3>
        {hint && <span className="text-[10.5px] font-mono text-slate-400">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export default function CashflowPanel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null); // salinan pengaturan yang sedang diedit
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { ok, text }
  const [newTop, setNewTop] = useState({ date: isoDay(new Date()), amount_usd: "", note: "" });
  const [newCost, setNewCost] = useState({ name: "", amount: "", currency: "USD", kind: "hpp" });

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true);
    try {
      const r = await db.adminCashflow("get");
      setData(r); setErr("");
      setForm((cur) => cur || r.settings);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Simpan seluruh pengaturan ke server lalu muat ulang hitungan.
  const persist = async (next, okText) => {
    setSaving(true); setNotice(null);
    try {
      const r = await db.adminCashflow("save", { settings: next });
      setForm(r.settings); setDirty(false);
      await load(true);
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
    persist({ ...form, topups: [...form.topups, { id: uid(), date: newTop.date, amount_usd: amount, note: newTop.note.trim() }] }, "Top-up ditambahkan.");
    setNewTop({ ...newTop, amount_usd: "", note: "" });
  };
  const addCost = (e) => {
    e.preventDefault();
    const amount = Number(newCost.amount);
    if (!newCost.name.trim()) return setNotice({ ok: false, text: "Isi nama biaya, misalnya Supabase." });
    if (newCost.amount === "" || !(amount >= 0)) return setNotice({ ok: false, text: "Isi jumlah biaya per bulan." });
    persist({ ...form, costs: [...form.costs, { id: uid(), name: newCost.name.trim(), currency: newCost.currency, amount, kind: newCost.kind }] }, "Biaya tetap ditambahkan.");
    setNewCost({ ...newCost, name: "", amount: "" });
  };

  if (err && !data) return <div className="text-[12px] text-rose-300 font-mono">{err}</div>;
  if (!data || !form) return <div className="flex items-center gap-2 text-[12px] text-slate-300 font-mono"><Loader2 className="w-3.5 h-3.5 animate-spin" /> memuat arus kas...</div>;

  const { summary: s, anthropic: a, contracts, daily } = data;
  const individuals = data.individuals || [];
  const kurs = Number(form.kurs) || 17700;
  const balLow = a.balance_usd !== null && (a.runway_days !== null ? a.runway_days <= 14 : a.balance_usd < 10);
  const balAccent = a.balance_usd === null ? "#cbd5e1" : a.balance_usd <= 0 ? "#fb7185" : balLow ? "#fbbf24" : "#34d399";
  const profitAccent = s.profit_month_idr >= 0 ? "#34d399" : "#fb7185";
  const unpaid = contracts.filter((c) => c.status === "unpaid");
  const p = data.pnl;
  const mp = (v) => (v === null || v === undefined ? "-" : `${v}%`);
  const pnlRows = [
    { l: "Pendapatan (MRR)", v: rp(p.revenue), c: "#f8fafc" },
    { l: "HPP: biaya AI Anthropic", v: `- ${rp(p.cogs_ai)}`, c: "#f9a8d4", sub: `${mp(p.ai_pct_of_revenue)} dari pendapatan` },
    { l: "HPP: infrastruktur (Supabase, dll)", v: `- ${rp(p.cogs_fixed)}`, c: "#f9a8d4" },
    { l: "Laba kotor", v: rp(p.gross_profit), c: p.gross_profit >= 0 ? "#34d399" : "#fb7185", bold: true, sub: `margin kotor ${mp(p.gross_margin_pct)}` },
    { l: "Beban operasional lain", v: `- ${rp(p.opex)}`, c: "#e2e8f0" },
    { l: "Laba bersih", v: rp(p.net_profit), c: p.net_profit >= 0 ? "#34d399" : "#fb7185", bold: true, sub: `margin bersih ${mp(p.net_margin_pct)}` },
  ];

  return (
    <div className="grid gap-5 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] text-slate-300 font-mono">Diperbarui otomatis tiap 45 detik · kurs Rp{kurs.toLocaleString("id-ID")}/USD</div>
        <button onClick={() => load()} className="inline-flex items-center gap-1 text-[11px] font-mono px-2.5 py-1.5 rounded-lg border border-white/[0.2] bg-[#111826] text-slate-200 hover:bg-[#182033]">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Muat ulang
        </button>
      </div>


      <Section title="Saldo token Anthropic" hint="perkiraan live">
        <div className="rounded-xl border p-3 grid gap-3 bg-[#111826]" style={{ borderColor: balAccent }}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[28px] font-bold font-mono leading-tight" style={{ color: balAccent }}>{a.balance_usd === null ? "Belum diatur" : usd(a.balance_usd)}</div>
              {a.balance_usd !== null && <div className="text-[11.5px] font-mono text-slate-300">≈ {rp(a.balance_usd * kurs)}</div>}
            </div>
            <div className="text-right text-[11.5px] font-mono text-slate-300 leading-relaxed">
              <div>Pemakaian rata-rata 7 hari: <span className="text-white font-bold">{usd(a.burn_usd_per_day)}/hari</span></div>
              <div>Perkiraan cukup: <span style={{ color: balAccent }} className="font-bold">{a.runway_days === null ? "-" : `${a.runway_days} hari`}</span></div>
              {balLow && <div className="text-amber-300 font-bold">Segera top up Anthropic.</div>}
            </div>
          </div>
          {daily.length >= 2 && (
            <div className="h-14 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={daily} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
                  <Tooltip contentStyle={{ background: "#0a0f18", border: "1px solid rgba(255,255,255,.25)", fontSize: 11 }} formatter={(v) => [usd(v), "Biaya AI"]} />
                  <Area type="monotone" dataKey="usd" stroke={balAccent} fill={balAccent} fillOpacity={0.25} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="text-[11px] text-slate-400 font-mono leading-relaxed">
            Anthropic tidak membuka saldo kredit lewat API, jadi dihitung: saldo patokan {form.anthropic.checkpoint_date ? `(${fmtShort(form.anthropic.checkpoint_date)})` : "(belum diisi)"} + top-up sesudahnya {usd(a.topups_since_usd)} - biaya AI tercatat sejak itu {usd(a.spent_since_usd)}.
            Hanya pemakaian lewat Nexto yang tercatat. Cocokkan dengan Console Anthropic sesekali dan perbarui patokan.
          </div>
        </div>
      </Section>

      <Section title="Ringkasan bulan ini">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Tile label="MRR kontrak aktif" value={rp(s.mrr)} sub={`nilai kontrak ${rp(s.active_contract_value)}`} accent="#34d399" />
          <Tile label="Kas masuk" value={rp(s.cash_in_month)} sub="invoice Lunas bulan ini" />
          <Tile label="Piutang" value={rp(s.receivable)} sub={s.overdue_count ? `${s.overdue_count} lewat jatuh tempo` : `${unpaid.length} invoice belum dibayar`} accent={s.overdue_count ? "#fbbf24" : undefined} />
          <Tile label="Laba bersih" value={rp(s.profit_month_idr)} sub="MRR - HPP - beban" accent={profitAccent} />
          <Tile label="Biaya AI" value={usd(s.ai_month_usd)} sub={rp(s.ai_month_idr)} accent="#f9a8d4" />
          <Tile label="Biaya tetap" value={rp(s.fixed_costs_idr)} sub={`${form.costs.length} pos per bulan`} />
          <Tile label="Jatah token" value={`${form.token_pct}%`} sub="dari nilai tiap invoice" />
          <Tile label="Kontrak aktif" value={contracts.filter((c) => c.active).length} sub={`${contracts.filter((c) => c.status === "paid").length} Lunas total`} />
          <Tile label="MRR langganan individu" value={rp(s.sub_mrr)} sub={`${s.sub_count} akun Standard/Professional`} accent="#34d399" />
        </div>
      </Section>

      <Section title="Laba rugi" hint="akrual: pendapatan diakui rata per hari selama kontrak">
        <div className={`${BLOCK} p-3 grid gap-2`}>
          {pnlRows.map((r) => (
            <div key={r.l} className={`flex items-baseline justify-between gap-3 font-mono ${r.bold ? "border-t border-white/[0.2] pt-2" : ""}`}>
              <span className={`text-[12px] ${r.bold ? "font-bold text-white" : "text-slate-300"}`}>{r.l}{r.sub && <span className="text-[10.5px] text-slate-400 ml-2">{r.sub}</span>}</span>
              <span className={`text-[13px] tabular-nums ${r.bold ? "font-bold" : ""}`} style={{ color: r.c }}>{r.v}</span>
            </div>
          ))}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="rounded-lg bg-[#0a0f18] border border-white/[0.12] px-3 py-2 text-[11.5px] font-mono text-slate-300">
              Titik impas: MRR minimal <span className="text-white font-bold">{p.breakeven_mrr === null ? "-" : rp(p.breakeven_mrr)}</span>
              {p.breakeven_mrr !== null && <span className={p.revenue >= p.breakeven_mrr ? " text-emerald-300" : " text-amber-300"}> ({p.revenue >= p.breakeven_mrr ? "sudah lewat" : `kurang ${rp(p.breakeven_mrr - p.revenue)}`})</span>}
            </div>
            <div className="rounded-lg bg-[#0a0f18] border border-white/[0.12] px-3 py-2 text-[11.5px] font-mono text-slate-300">
              Diterima di muka (belum diakui): <span className="text-white font-bold">{rp(p.deferred_revenue)}</span>. Ini kewajiban melayani klien, bukan laba.
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-mono leading-relaxed">
            HPP = seluruh biaya AI bulan ini (termasuk pengguna gratis dan Chat Bantuan) + biaya tetap berjenis HPP seperti Supabase. Pajak, gaji, dan iklan masuk bila ditambahkan sebagai Beban.
          </div>
        </div>
      </Section>

      <Section title="Kontrak" hint="biaya AI dihitung sejak tanggal mulai kontrak">
        <div className={`min-w-0 overflow-x-auto ${BLOCK}`}>
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-300 font-mono bg-[#182033]">
                <th className="py-2 pl-3 pr-2 font-medium">Kontrak</th>
                <th className="py-2 pr-2 font-medium text-right">Nilai</th>
                <th className="py-2 pr-2 font-medium text-right">Per bulan</th>
                <th className="py-2 pr-2 font-medium text-right">Jatah token</th>
                <th className="py-2 pr-2 font-medium text-right">Biaya AI</th>
                <th className="py-2 pr-2 font-medium text-right">Margin kotor</th>
                <th className="py-2 pr-3 font-medium">Terpakai</th>
              </tr>
            </thead>
            <tbody>
              {contracts.length === 0 && <tr><td colSpan={7} className="py-4 text-center text-[12px] text-slate-400 font-mono">Belum ada invoice.</td></tr>}
              {contracts.map((c) => (
                <tr key={c.id} className="border-t border-white/[0.12]">
                  <td className="py-2 pl-3 pr-2 min-w-0">
                    <div className="text-[12px] font-semibold text-white truncate max-w-[220px]">{c.company}</div>
                    <div className="text-[10.5px] font-mono text-slate-400">
                      {c.number} · {c.seats} user · {c.months} bln ·{" "}
                      <span className={c.status === "paid" ? (c.active ? "text-emerald-300" : "text-slate-300") : "text-amber-300"}>
                        {c.status === "paid" ? (c.active ? "Aktif" : "Selesai") : (c.due_date < data.today ? "Lewat jatuh tempo" : "Belum dibayar")}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right text-white">{rp(c.total)}</td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right text-slate-200">{rp(c.monthly)}</td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right text-slate-200">{rp(c.quota_idr)}<div className="text-[10px] text-slate-400">{usd(c.quota_idr / kurs)}</div></td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right text-pink-200">
                    {c.ai_usd === null ? <span className="text-slate-500">-</span> : <>{usd(c.ai_usd)}<div className="text-[10px] text-slate-400">{rp(c.ai_idr)}</div></>}
                  </td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right">
                    {c.margin_pct === null ? <span className="text-slate-500">-</span> : <span className="font-bold" style={{ color: c.margin_pct >= 50 ? "#34d399" : c.margin_pct >= 20 ? "#fbbf24" : "#fb7185" }}>{c.margin_pct}%</span>}
                    {c.status === "paid" && <div className="text-[10px] text-slate-400">diakui {rp(c.recognized_idr)}</div>}
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
      </Section>

      <Section title="Langganan individu (Standard dan Professional)" hint="perkiraan: pembayaran Mayar tidak tersimpan di database">
        <div className={`min-w-0 overflow-x-auto ${BLOCK}`}>
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-slate-300 font-mono bg-[#182033]">
                <th className="py-2 pl-3 pr-2 font-medium">Akun</th>
                <th className="py-2 pr-2 font-medium">Paket</th>
                <th className="py-2 pr-2 font-medium text-right">Harga / bulan</th>
                <th className="py-2 pr-2 font-medium">Aktif sampai</th>
                <th className="py-2 pr-2 font-medium text-right">Biaya AI bulan ini</th>
                <th className="py-2 pr-3 font-medium text-right">Margin kotor</th>
              </tr>
            </thead>
            <tbody>
              {individuals.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-[12px] text-slate-400 font-mono">Belum ada akun Standard atau Professional individu.</td></tr>}
              {individuals.map((i) => (
                <tr key={i.user_id} className="border-t border-white/[0.12]">
                  <td className="py-2 pl-3 pr-2"><div className="text-[12px] font-semibold text-white truncate max-w-[220px]">{i.name || i.email || i.user_id.slice(0, 8)}</div>{i.name && i.email && <div className="text-[10.5px] font-mono text-slate-400 truncate max-w-[220px]">{i.email}</div>}</td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono text-slate-200">{i.plan === "professional" ? "Professional" : "Standard"}</td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right text-white">{rp(i.price)}</td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono">{i.expires_at ? <span className={i.counted ? "text-emerald-300" : "text-rose-300"}>{fmtShort(isoDay(new Date(i.expires_at)))}{i.counted ? "" : " (berakhir)"}</span> : <span className="text-amber-300">tanpa masa aktif, tidak dihitung</span>}</td>
                  <td className="py-2 pr-2 text-[11.5px] font-mono tabular-nums text-right text-pink-200">{usd(i.ai_month_usd)}</td>
                  <td className="py-2 pr-3 text-[11.5px] font-mono tabular-nums text-right">{i.margin_pct === null ? <span className="text-slate-500">-</span> : <span className="font-bold" style={{ color: i.margin_pct >= 50 ? "#34d399" : i.margin_pct >= 20 ? "#fbbf24" : "#fb7185" }}>{i.margin_pct}%</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] text-slate-400 font-mono leading-relaxed">
          Dihitung sebagai MRR bila masa aktif belum berakhir, memakai harga per bulan di Pengaturan. Akun yang paketnya dibuat lewat invoice tidak dihitung dua kali. Kas masuk dari Mayar tidak muncul di "Kas masuk" karena tanggal dan nominalnya tidak tercatat.
        </div>
      </Section>

      <Section title="Pengaturan" hint="top-up dan biaya tetap langsung tersimpan saat ditambah atau dihapus">
        <div className={`${BLOCK} p-3 grid gap-5`}>
          <div className="grid gap-2">
            <div className="text-[11.5px] font-bold text-slate-100">Parameter</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div><label className={lab}>Kurs (Rp/USD)</label><input type="number" className={`${inp} w-full`} value={form.kurs} onChange={(e) => edit({ kurs: e.target.value })} /></div>
              <div><label className={lab}>Jatah token (% kontrak)</label><input type="number" min="1" max="100" className={`${inp} w-full`} value={form.token_pct} onChange={(e) => edit({ token_pct: e.target.value })} /></div>
              <div><label className={lab}>Tanggal saldo patokan</label><input type="date" style={DARK} className={`${inp} w-full`} value={form.anthropic.checkpoint_date || ""} onChange={(e) => edit({ anthropic: { ...form.anthropic, checkpoint_date: e.target.value || null } })} /></div>
              <div><label className={lab}>Harga Standard (Rp/bln)</label><input type="number" className={`${inp} w-full`} value={form.sub_price?.standard ?? ""} onChange={(e) => edit({ sub_price: { ...form.sub_price, standard: e.target.value } })} /></div>
              <div><label className={lab}>Harga Professional (Rp/bln)</label><input type="number" className={`${inp} w-full`} value={form.sub_price?.professional ?? ""} onChange={(e) => edit({ sub_price: { ...form.sub_price, professional: e.target.value } })} /></div>
              <div><label className={lab}>Saldo patokan (USD)</label><input type="number" step="0.01" className={`${inp} w-full`} value={form.anthropic.balance_usd} onChange={(e) => edit({ anthropic: { ...form.anthropic, balance_usd: e.target.value } })} /></div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => persist(form, "Parameter disimpan.")} disabled={!dirty || saving} className={btnAdd}>
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} Simpan parameter
              </button>
              {dirty && <span className="text-[11px] text-amber-300 font-mono">Ada perubahan belum disimpan.</span>}
              <span className="text-[10.5px] text-slate-400 font-mono">Saldo patokan = kredit di Console Anthropic pada awal hari tanggal tersebut.</span>
            </div>
          </div>

          <div className="grid gap-2 border-t border-white/[0.15] pt-4">
            <div className="text-[11.5px] font-bold text-slate-100">Top-up Anthropic</div>
            {form.topups.length === 0 && <div className="text-[11.5px] text-slate-400 font-mono">Belum ada top-up tercatat.</div>}
            {[...form.topups].sort((x, y) => y.date.localeCompare(x.date)).map((t) => (
              <div key={t.id} className="flex items-center gap-3 text-[12px] font-mono rounded-lg bg-[#0a0f18] border border-white/[0.12] px-3 py-1.5">
                <span className="text-slate-200 w-[110px] shrink-0">{fmtShort(t.date)}</span>
                <span className="text-emerald-300 font-bold w-[90px] shrink-0">+{usd(t.amount_usd)}</span>
                <span className="text-slate-300 truncate flex-1">{t.note}</span>
                <button disabled={saving} onClick={() => persist({ ...form, topups: form.topups.filter((x) => x.id !== t.id) }, "Top-up dihapus.")} className="text-slate-300 hover:text-rose-300" aria-label="Hapus top-up"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <form onSubmit={addTopup} className="grid grid-cols-2 sm:grid-cols-[150px_110px_1fr_auto] gap-2 items-end">
              <div><label className={lab}>Tanggal</label><input type="date" style={DARK} className={`${inp} w-full`} value={newTop.date} onChange={(e) => setNewTop({ ...newTop, date: e.target.value })} /></div>
              <div><label className={lab}>Jumlah (USD)</label><input type="number" step="0.01" min="0" placeholder="50" className={`${inp} w-full`} value={newTop.amount_usd} onChange={(e) => setNewTop({ ...newTop, amount_usd: e.target.value })} /></div>
              <div className="col-span-2 sm:col-span-1"><label className={lab}>Catatan</label><input placeholder="opsional" className={`${inp} w-full`} value={newTop.note} onChange={(e) => setNewTop({ ...newTop, note: e.target.value })} /></div>
              <button type="submit" disabled={saving} className={`${btnAdd} col-span-2 sm:col-span-1`}><Plus className="w-3.5 h-3.5" /> Tambah top-up</button>
            </form>
          </div>

          <div className="grid gap-2 border-t border-white/[0.15] pt-4">
            <div className="text-[11.5px] font-bold text-slate-100">Biaya tetap bulanan</div>
            {form.costs.length === 0 && <div className="text-[11.5px] text-slate-400 font-mono">Belum ada. Isi Supabase ($25), Vercel, Cekat, domain, dan lainnya.</div>}
            {form.costs.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-[12px] font-mono rounded-lg bg-[#0a0f18] border border-white/[0.12] px-3 py-1.5">
                <span className="text-white font-semibold truncate flex-1">{c.name}</span>
                <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded border border-white/[0.25] text-slate-200">{c.kind === "hpp" ? "HPP" : "Beban"}</span>
                <span className="text-slate-100">{c.currency === "USD" ? `${usd(c.amount)} ≈ ${rp(c.amount * kurs)}` : rp(c.amount)}</span>
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
