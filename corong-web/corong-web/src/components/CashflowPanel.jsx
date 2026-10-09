import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, Plus, Trash2 } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import * as db from "../lib/db";
import { rp, isoDay, fmtShort } from "./EnterpriseInvoicePanel";

// Panel ARUS KAS di Command Center (9 Okt 2026, permintaan Nando): hitungan
// uang masuk vs jatah token Anthropic per kontrak tanpa hitung manual.
// Saldo Anthropic = patokan dari Console + top-up - biaya AI tercatat (ai_usage);
// kredit prabayar Anthropic tidak bisa dibaca lewat API.
const REFRESH_MS = 45000;
const usd = (n) => {
  const v = Number(n) || 0;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: Math.abs(v) > 0 && Math.abs(v) < 1 ? 4 : 2 })}`;
};
const inp = "rounded-lg border border-white/[0.1] bg-white/[0.03] px-2 py-1.5 text-[11.5px] text-slate-100 font-mono placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none";
const lab = "block text-[9.5px] font-mono uppercase tracking-wide text-slate-500 mb-1";
const uid = () => (globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()));

function Tile({ label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-3 py-2.5 min-w-0">
      <div className="text-[9px] font-mono uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-[17px] font-bold font-mono mt-0.5 truncate" style={{ color: accent || "#e2e8f0" }}>{value}</div>
      {sub && <div className="text-[10px] font-mono text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

const barColor = (p) => (p >= 85 ? "#f43f5e" : p >= 60 ? "#f59e0b" : "#34d399");

export default function CashflowPanel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null); // salinan pengaturan yang sedang diedit
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const edit = (patch) => { setForm((f) => ({ ...f, ...patch })); setDirty(true); };
  const save = async () => {
    setSaving(true);
    try {
      const r = await db.adminCashflow("save", { settings: form });
      setForm(r.settings); setDirty(false);
      await load(true);
    } catch (e) { alert("Gagal menyimpan: " + e.message); }
    finally { setSaving(false); }
  };

  if (err && !data) return <div className="text-[11px] text-rose-300 font-mono">{err}</div>;
  if (!data || !form) return <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono"><Loader2 className="w-3.5 h-3.5 animate-spin" /> memuat arus kas...</div>;

  const { summary: s, anthropic: a, contracts, daily } = data;
  const kurs = Number(form.kurs) || 17700;
  const balLow = a.balance_usd !== null && (a.runway_days !== null ? a.runway_days <= 14 : a.balance_usd < 10);
  const balAccent = a.balance_usd === null ? "#94a3b8" : a.balance_usd <= 0 ? "#f43f5e" : balLow ? "#f59e0b" : "#34d399";
  const profitAccent = s.profit_month_idr >= 0 ? "#34d399" : "#f43f5e";
  const paidContracts = contracts.filter((c) => c.status === "paid");
  const unpaid = contracts.filter((c) => c.status === "unpaid");

  return (
    <div className="grid gap-4 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-slate-500 font-mono">Diperbarui otomatis tiap 45 detik · kurs Rp{kurs.toLocaleString("id-ID")}/USD</div>
        <button onClick={() => load()} className="inline-flex items-center gap-1 text-[10.5px] font-mono px-2.5 py-1 rounded-lg border border-white/[0.08] text-slate-400 hover:text-slate-200">
          <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Muat ulang
        </button>
      </div>

      {/* Saldo Anthropic live */}
      <div className="rounded-xl border p-3 grid gap-3" style={{ borderColor: `${balAccent}55`, background: `${balAccent}0d` }}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <div className="text-[9.5px] font-mono uppercase tracking-wide text-slate-400">Saldo token Anthropic (perkiraan live)</div>
            <div className="text-[26px] font-bold font-mono leading-tight" style={{ color: balAccent }}>{a.balance_usd === null ? "Belum diatur" : usd(a.balance_usd)}</div>
            {a.balance_usd !== null && <div className="text-[10.5px] font-mono text-slate-400">≈ {rp(a.balance_usd * kurs)}</div>}
          </div>
          <div className="text-right text-[10.5px] font-mono text-slate-400 leading-relaxed">
            <div>Pemakaian rata-rata 7 hari: <span className="text-slate-200">{usd(a.burn_usd_per_day)}/hari</span></div>
            <div>Perkiraan cukup: <span style={{ color: balAccent }} className="font-bold">{a.runway_days === null ? "-" : `${a.runway_days} hari`}</span></div>
            {balLow && <div className="text-amber-300">Segera top up Anthropic.</div>}
          </div>
        </div>
        {daily.length >= 2 && (
          <div className="h-14 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 2, right: 4, left: 4, bottom: 0 }}>
                <Tooltip contentStyle={{ background: "#0c1018", border: "1px solid rgba(255,255,255,.1)", fontSize: 11 }} formatter={(v) => [usd(v), "Biaya AI"]} labelFormatter={(l) => l} />
                <Area type="monotone" dataKey="usd" stroke={balAccent} fill={balAccent} fillOpacity={0.15} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
          Anthropic tidak membuka saldo kredit lewat API, jadi dihitung: saldo patokan {form.anthropic.checkpoint_date ? `(${fmtShort(form.anthropic.checkpoint_date)})` : "(belum diisi)"} + top-up sesudahnya {usd(a.topups_since_usd)} - biaya AI tercatat sejak itu {usd(a.spent_since_usd)}.
          Hanya pemakaian lewat Nexto yang tercatat; cocokkan dengan Console Anthropic sesekali lalu perbarui patokan.
        </div>
      </div>

      {/* Ringkasan uang */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="MRR kontrak aktif" value={rp(s.mrr)} sub={`nilai kontrak ${rp(s.active_contract_value)}`} accent="#34d399" />
        <Tile label="Kas masuk bulan ini" value={rp(s.cash_in_month)} sub="invoice Lunas bulan ini" />
        <Tile label="Piutang" value={rp(s.receivable)} sub={s.overdue_count ? `${s.overdue_count} lewat jatuh tempo` : `${unpaid.length} invoice belum dibayar`} accent={s.overdue_count ? "#f59e0b" : undefined} />
        <Tile label="Laba perkiraan bulan ini" value={rp(s.profit_month_idr)} sub="MRR - HPP - beban" accent={profitAccent} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Tile label="Biaya AI bulan ini" value={usd(s.ai_month_usd)} sub={rp(s.ai_month_idr)} accent="#f472b6" />
        <Tile label="Biaya tetap / bulan" value={rp(s.fixed_costs_idr)} sub={`${form.costs.length} pos`} />
        <Tile label="Jatah token" value={`${form.token_pct}% kontrak`} sub="dari nilai tiap invoice" />
        <Tile label="Kontrak aktif" value={contracts.filter((c) => c.active).length} sub={`${paidContracts.length} Lunas total`} />
      </div>

      {/* Laba rugi bulanan (akrual) */}
      <div className="rounded-xl border border-white/[0.06] p-3 grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[11px] font-bold text-slate-200">Laba rugi bulan ini (akrual)</div>
          <div className="text-[9.5px] font-mono text-slate-500">pendapatan diakui rata per hari selama kontrak</div>
        </div>
        {(() => {
          const p = data.pnl;
          const mp = (v) => (v === null || v === undefined ? "-" : `${v}%`);
          const rows = [
            { l: "Pendapatan (MRR)", v: rp(p.revenue), c: "#e2e8f0" },
            { l: "HPP: biaya AI Anthropic", v: `- ${rp(p.cogs_ai)}`, c: "#f9a8d4", sub: `${mp(p.ai_pct_of_revenue)} dari pendapatan` },
            { l: "HPP: infrastruktur (Supabase, dll)", v: `- ${rp(p.cogs_fixed)}`, c: "#f9a8d4" },
            { l: "Laba kotor", v: rp(p.gross_profit), c: p.gross_profit >= 0 ? "#34d399" : "#f43f5e", bold: true, sub: `margin kotor ${mp(p.gross_margin_pct)}` },
            { l: "Beban operasional lain", v: `- ${rp(p.opex)}`, c: "#cbd5e1" },
            { l: "Laba bersih", v: rp(p.net_profit), c: p.net_profit >= 0 ? "#34d399" : "#f43f5e", bold: true, sub: `margin bersih ${mp(p.net_margin_pct)}` },
          ];
          return (
            <>
              {rows.map((r) => (
                <div key={r.l} className={`flex items-baseline justify-between gap-3 font-mono ${r.bold ? "border-t border-white/[0.08] pt-1.5" : ""}`}>
                  <span className={`text-[11px] ${r.bold ? "font-bold text-slate-100" : "text-slate-400"}`}>{r.l}{r.sub && <span className="text-[9.5px] text-slate-500 ml-2">{r.sub}</span>}</span>
                  <span className={`text-[12px] tabular-nums ${r.bold ? "font-bold" : ""}`} style={{ color: r.c }}>{r.v}</span>
                </div>
              ))}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div className="rounded-lg bg-white/[0.02] px-2.5 py-2 text-[10.5px] font-mono text-slate-400">
                  Titik impas: MRR minimal <span className="text-slate-100 font-bold">{p.breakeven_mrr === null ? "-" : rp(p.breakeven_mrr)}</span> untuk menutup beban tetap
                  {p.breakeven_mrr !== null && <span className={p.revenue >= p.breakeven_mrr ? " text-emerald-300" : " text-amber-300"}> ({p.revenue >= p.breakeven_mrr ? "sudah lewat" : `kurang ${rp(p.breakeven_mrr - p.revenue)}`})</span>}
                </div>
                <div className="rounded-lg bg-white/[0.02] px-2.5 py-2 text-[10.5px] font-mono text-slate-400">
                  Pendapatan diterima di muka (belum diakui): <span className="text-slate-100 font-bold">{rp(p.deferred_revenue)}</span>. Ini kewajiban melayani klien, jangan dihitung sebagai laba.
                </div>
              </div>
            </>
          );
        })()}
        <div className="text-[10px] text-slate-500 font-mono leading-relaxed">
          HPP = seluruh biaya AI bulan ini (termasuk pengguna gratis dan Chat Bantuan) + biaya tetap berjenis HPP seperti Supabase. Pajak, gaji, dan iklan belum masuk kecuali Anda tambahkan sebagai Beban.
        </div>
      </div>

      {/* Per kontrak */}
      <div className="min-w-0 overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="text-[9.5px] uppercase tracking-wide text-slate-500 font-mono">
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
            {contracts.length === 0 && <tr><td colSpan={7}className="py-4 text-center text-[11px] text-slate-500 font-mono">Belum ada invoice.</td></tr>}
            {contracts.map((c) => (
              <tr key={c.id} className="border-t border-white/[0.05]">
                <td className="py-2 pl-3 pr-2 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-200 truncate max-w-[220px]">{c.company}</div>
                  <div className="text-[9.5px] font-mono text-slate-500">
                    {c.number} · {c.seats} user · {c.months} bln ·{" "}
                    <span className={c.status === "paid" ? (c.active ? "text-emerald-400" : "text-slate-400") : "text-amber-400"}>
                      {c.status === "paid" ? (c.active ? "Aktif" : "Selesai") : (c.due_date < data.today ? "Lewat jatuh tempo" : "Belum dibayar")}
                    </span>
                  </div>
                </td>
                <td className="py-2 pr-2 text-[10.5px] font-mono tabular-nums text-right text-slate-200">{rp(c.total)}</td>
                <td className="py-2 pr-2 text-[10.5px] font-mono tabular-nums text-right text-slate-300">{rp(c.monthly)}</td>
                <td className="py-2 pr-2 text-[10.5px] font-mono tabular-nums text-right text-slate-300">{rp(c.quota_idr)}<div className="text-[9px] text-slate-500">{usd(c.quota_idr / kurs)}</div></td>
                <td className="py-2 pr-2 text-[10.5px] font-mono tabular-nums text-right text-pink-200">
                  {c.ai_usd === null ? <span className="text-slate-600">-</span> : <>{usd(c.ai_usd)}<div className="text-[9px] text-slate-500">{rp(c.ai_idr)}</div></>}
                </td>
                <td className="py-2 pr-2 text-[10.5px] font-mono tabular-nums text-right">
                  {c.margin_pct === null ? <span className="text-slate-600">-</span> : <span style={{ color: c.margin_pct >= 50 ? "#34d399" : c.margin_pct >= 20 ? "#f59e0b" : "#f43f5e" }}>{c.margin_pct}%</span>}
                  {c.status === "paid" && <div className="text-[9px] text-slate-500">diakui {rp(c.recognized_idr)}</div>}
                </td>
                <td className="py-2 pr-3 w-[120px]">
                  {c.quota_used_pct === null ? (
                    <span className="text-[9.5px] font-mono text-slate-600">{c.status === "paid" ? "belum diaktifkan" : "-"}</span>
                  ) : (
                    <div>
                      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(100, c.quota_used_pct)}%`, background: barColor(c.quota_used_pct) }} /></div>
                      <div className="text-[9.5px] font-mono mt-0.5" style={{ color: barColor(c.quota_used_pct) }}>{c.quota_used_pct}% jatah</div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-slate-500 font-mono leading-relaxed -mt-2">
        Biaya AI per kontrak dihitung dari pemakaian semua anggota organisasi sejak tanggal mulai kontrak, dan hanya tersedia bila paket sudah diaktifkan dari invoice.
      </div>

      {/* Pengaturan */}
      <div className="rounded-xl border border-white/[0.06] p-3 grid gap-4">
        <div className="text-[11px] font-bold text-slate-200">Pengaturan arus kas</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><label className={lab}>Kurs (Rp/USD)</label><input type="number" className={`${inp} w-full`} value={form.kurs} onChange={(e) => edit({ kurs: e.target.value })} /></div>
          <div><label className={lab}>Jatah token (% kontrak)</label><input type="number" min="1" max="100" className={`${inp} w-full`} value={form.token_pct} onChange={(e) => edit({ token_pct: e.target.value })} /></div>
          <div><label className={lab}>Tanggal saldo patokan</label><input type="date" className={`${inp} w-full`} value={form.anthropic.checkpoint_date || ""} onChange={(e) => edit({ anthropic: { ...form.anthropic, checkpoint_date: e.target.value || null } })} /></div>
          <div><label className={lab}>Saldo patokan (USD)</label><input type="number" step="0.01" className={`${inp} w-full`} value={form.anthropic.balance_usd} onChange={(e) => edit({ anthropic: { ...form.anthropic, balance_usd: e.target.value } })} /></div>
        </div>
        <div className="text-[10px] text-slate-500 font-mono -mt-2">Saldo patokan = angka kredit di Console Anthropic pada awal hari tanggal tersebut. Pemakaian dihitung sejak tanggal itu.</div>

        <div className="grid gap-2">
          <div className="text-[10.5px] font-semibold text-slate-300">Top-up Anthropic</div>
          {form.topups.length === 0 && <div className="text-[10.5px] text-slate-600 font-mono">Belum ada top-up tercatat.</div>}
          {[...form.topups].sort((x, y) => y.date.localeCompare(x.date)).map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-400 w-[92px] shrink-0">{fmtShort(t.date)}</span>
              <span className="text-emerald-300 w-[80px] shrink-0">+{usd(t.amount_usd)}</span>
              <span className="text-slate-500 truncate flex-1">{t.note}</span>
              <button onClick={() => edit({ topups: form.topups.filter((x) => x.id !== t.id) })} className="text-slate-500 hover:text-rose-300" aria-label="Hapus top-up"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className={inp} value={newTop.date} onChange={(e) => setNewTop({ ...newTop, date: e.target.value })} />
            <input type="number" step="0.01" placeholder="USD" className={`${inp} w-24`} value={newTop.amount_usd} onChange={(e) => setNewTop({ ...newTop, amount_usd: e.target.value })} />
            <input placeholder="Catatan (opsional)" className={`${inp} flex-1 min-w-[120px]`} value={newTop.note} onChange={(e) => setNewTop({ ...newTop, note: e.target.value })} />
            <button
              onClick={() => { if (!newTop.date || !(Number(newTop.amount_usd) > 0)) return; edit({ topups: [...form.topups, { id: uid(), date: newTop.date, amount_usd: Number(newTop.amount_usd), note: newTop.note }] }); setNewTop({ ...newTop, amount_usd: "", note: "" }); }}
              className="inline-flex items-center gap-1 text-[10.5px] font-mono px-2.5 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
            ><Plus className="w-3 h-3" /> Tambah</button>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-[10.5px] font-semibold text-slate-300">Biaya tetap bulanan</div>
          {form.costs.length === 0 && <div className="text-[10.5px] text-slate-600 font-mono">Belum ada. Isi Supabase ($25), Vercel, Cekat, domain, dan lainnya.</div>}
          {form.costs.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-300 truncate flex-1">{c.name}</span>
              <span className="text-[9.5px] text-slate-500">{c.kind === "hpp" ? "HPP" : "Beban"}</span>
              <span className="text-slate-200">{c.currency === "USD" ? `${usd(c.amount)} ≈ ${rp(c.amount * kurs)}` : rp(c.amount)}</span>
              <button onClick={() => edit({ costs: form.costs.filter((x) => x.id !== c.id) })} className="text-slate-500 hover:text-rose-300" aria-label="Hapus biaya"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <input placeholder="Nama (mis. Supabase)" className={`${inp} flex-1 min-w-[140px]`} value={newCost.name} onChange={(e) => setNewCost({ ...newCost, name: e.target.value })} />
            <select className={inp} value={newCost.currency} onChange={(e) => setNewCost({ ...newCost, currency: e.target.value })}><option value="USD">USD</option><option value="IDR">Rp</option></select>
            <input type="number" placeholder="per bulan" className={`${inp} w-28`} value={newCost.amount} onChange={(e) => setNewCost({ ...newCost, amount: e.target.value })} />
            <select className={inp} value={newCost.kind} onChange={(e) => setNewCost({ ...newCost, kind: e.target.value })}><option value="hpp">HPP</option><option value="opex">Beban</option></select>
            <button
              onClick={() => { if (!newCost.name.trim() || newCost.amount === "" || !(Number(newCost.amount) >= 0)) return; edit({ costs: [...form.costs, { id: uid(), name: newCost.name.trim(), currency: newCost.currency, amount: Number(newCost.amount), kind: newCost.kind }] }); setNewCost({ ...newCost, name: "", amount: "" }); }}
              className="inline-flex items-center gap-1 text-[10.5px] font-mono px-2.5 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
            ><Plus className="w-3 h-3" /> Tambah</button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={!dirty || saving} className="inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/15 text-emerald-100 disabled:opacity-40">
            {saving && <Loader2 className="w-3 h-3 animate-spin" />} Simpan pengaturan
          </button>
          {dirty && <span className="text-[10.5px] text-amber-300 font-mono">Ada perubahan belum disimpan.</span>}
        </div>
      </div>
    </div>
  );
}
