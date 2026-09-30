import { useEffect, useState } from "react";
import { Wallet, Plus, Trash2, Loader2, CheckCircle2, FileText } from "lucide-react";
import * as db from "../lib/db";

// Kontrak & termin pembayaran per lead (30 Sep 2026, Enterprise - buat
// perusahaan konsultan yang pembayarannya bertermin: DP, termin, pelunasan).
// Tiap termin kesimpen langsung ke payment_terms (bukan nunggu tombol Simpan
// lead). Status: Belum ditagih -> Ditagih (invoice terbit) -> Lunas (Cash In).
// Termin yang lewat jatuh tempo & belum lunas ditandai Telat. Notif H-3/H/telat
// dikirim cron nexto-payment-term-reminder.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const todayIso = () => new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
const fmtRp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const fmtDay = (iso) => (iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "-");

function statusOf(t) {
  if (t.paid_at) return { label: "Lunas", cls: "bg-emerald-100 text-emerald-700" };
  if (t.due_date && t.due_date < todayIso()) return { label: "Telat", cls: "bg-rose-100 text-rose-700" };
  if (t.invoiced_at) return { label: "Ditagih", cls: "bg-sky-100 text-sky-700" };
  return { label: "Belum ditagih", cls: "bg-slate-100 text-slate-600" };
}

// Bikin termin cepat dari nilai proyek: 50/50 atau 30/40/30.
const PRESETS = [
  { key: "5050", label: "DP 50% + Pelunasan 50%", parts: [["DP 50%", 0.5], ["Pelunasan 50%", 0.5]] },
  { key: "304030", label: "30% / 40% / 30%", parts: [["Termin 1 (30%)", 0.3], ["Termin 2 (40%)", 0.4], ["Termin 3 (30%)", 0.3]] },
];

export default function PaymentTermsCard({ leadId, projectValue }) {
  const [terms, setTerms] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ label: "", amount: "", due_date: "" });

  useEffect(() => {
    let alive = true;
    db.getPaymentTerms(leadId).then((t) => alive && setTerms(t)).catch((e) => alive && (setTerms([]), setErr(e.message)));
    return () => { alive = false; };
  }, [leadId]);

  const run = async (fn) => {
    setBusy(true);
    setErr("");
    try { await fn(); } catch (e) { setErr("Gagal: " + e.message); } finally { setBusy(false); }
  };

  const add = () => run(async () => {
    const amount = Number(String(form.amount).replace(/[^\d]/g, "")) || 0;
    if (!amount) throw new Error("isi nominal termin dulu");
    const row = await db.addPaymentTerm(leadId, { label: form.label.trim() || `Termin ${(terms?.length || 0) + 1}`, amount, due_date: form.due_date || null, position: terms?.length || 0 });
    setTerms((t) => [...(t || []), row]);
    setForm({ label: "", amount: "", due_date: "" });
  });

  const applyPreset = (p) => run(async () => {
    const total = Number(projectValue) || 0;
    if (!total) throw new Error("isi Nilai proyek di atas dulu (terus Simpan), baru bisa bagi termin otomatis");
    const rows = [];
    for (const [i, [label, pct]] of p.parts.entries()) {
      rows.push(await db.addPaymentTerm(leadId, { label, amount: Math.round(total * pct), due_date: null, position: (terms?.length || 0) + i }));
    }
    setTerms((t) => [...(t || []), ...rows]);
  });

  const patch = (id, values) => run(async () => {
    const row = await db.updatePaymentTerm(id, values);
    setTerms((t) => t.map((x) => (x.id === id ? row : x)));
  });

  const remove = (id) => run(async () => {
    await db.deletePaymentTerm(id);
    setTerms((t) => t.filter((x) => x.id !== id));
  });

  const total = (terms || []).reduce((s, t) => s + Number(t.amount), 0);
  const paid = (terms || []).filter((t) => t.paid_at).reduce((s, t) => s + Number(t.amount), 0);
  const inpCls = "w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg bg-white";

  return (
    <div className="border border-emerald-200 bg-emerald-50/40 rounded-2xl p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5"><Wallet size={13} /> Kontrak & Termin Pembayaran</div>
        {terms?.length > 0 && <div className="text-[11px] text-emerald-800 tabular-nums">Lunas {fmtRp(paid)} / {fmtRp(total)}</div>}
      </div>

      {terms === null ? (
        <Loader2 size={14} className="mt-2 animate-spin text-slate-400" />
      ) : (
        <>
          {terms.length === 0 && (
            <div className="mt-2">
              <p className="text-[11px] text-slate-500">Belum ada termin. Catat DP, termin, dan pelunasan biar ketauan mana yang udah ditagih & udah masuk (Cash In).</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button key={p.key} type="button" disabled={busy} onClick={() => applyPreset(p)} className="text-[11px] rounded-lg border border-emerald-300 bg-white px-2 py-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
                    Bagi otomatis: {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-2 space-y-2">
            {terms.map((t) => {
              const st = statusOf(t);
              return (
                <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-slate-800 truncate">{t.label || "Termin"}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">{fmtRp(t.amount)} · jatuh tempo {fmtDay(t.due_date)}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
                    <button type="button" disabled={busy} onClick={() => remove(t.id)} className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50" title="Hapus termin" aria-label="Hapus termin"><Trash2 size={14} /></button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <input type="date" className="text-[11px] border border-slate-300 rounded-lg px-2 py-1" value={t.due_date || ""} disabled={busy} onChange={(e) => patch(t.id, { due_date: e.target.value || null })} title="Jatuh tempo" />
                    {!t.invoiced_at && !t.paid_at && (
                      <button type="button" disabled={busy} onClick={() => patch(t.id, { invoiced_at: todayIso() })} className="text-[11px] rounded-lg border border-sky-300 px-2 py-1 text-sky-700 hover:bg-sky-50 flex items-center gap-1 disabled:opacity-50"><FileText size={11} /> Tandai ditagih</button>
                    )}
                    {!t.paid_at ? (
                      <button type="button" disabled={busy} onClick={() => patch(t.id, { paid_at: todayIso(), invoiced_at: t.invoiced_at || todayIso() })} className="text-[11px] rounded-lg bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"><CheckCircle2 size={11} /> Tandai lunas</button>
                    ) : (
                      <span className="text-[11px] text-emerald-700">Lunas {fmtDay(t.paid_at)} <button type="button" disabled={busy} onClick={() => patch(t.id, { paid_at: null })} className="ml-1 underline text-slate-400 hover:text-slate-600">batalkan</button></span>
                    )}
                    {t.invoiced_at && !t.paid_at && <span className="text-[10.5px] text-slate-400">ditagih {fmtDay(t.invoiced_at)}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto_auto] gap-1.5 items-center">
            <input className={inpCls} placeholder="Nama termin (mis. DP 50%)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <input className={inpCls} inputMode="numeric" placeholder="Nominal (Rp)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d]/g, "") ? Number(e.target.value.replace(/[^\d]/g, "")).toLocaleString("id-ID") : "" })} />
            <input type="date" className={inpCls} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} title="Jatuh tempo" />
            <button type="button" disabled={busy} onClick={add} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium px-3 py-2 flex items-center justify-center gap-1 disabled:opacity-50">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Tambah
            </button>
          </div>
          {err && <p className="mt-2 text-[11px] text-rose-600">{err}</p>}
        </>
      )}
    </div>
  );
}
