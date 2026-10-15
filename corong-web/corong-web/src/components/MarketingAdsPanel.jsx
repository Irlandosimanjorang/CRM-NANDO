import { useEffect, useMemo, useState } from "react";
import * as db from "../lib/db";
import { fmtRp } from "../lib/helpers";

// Pengeluaran iklan per marketing (15 Okt 2026). Marketing mengisi pengeluarannya sendiri; owner & manager
// melihat semua, mengatur budget, dan melihat hasilnya: lead iklan, deal, dan omzet dari lead yang ditugaskan
// ke marketing itu dan sumbernya sama dengan platform iklan yang dibiayai.
const PLATFORMS = ["Meta", "TikTok", "Google", "Instagram", "Messenger", "Lainnya"];
const todayIso = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const inRange = (iso, from, to) => !!iso && String(iso).slice(0, 10) >= from && String(iso).slice(0, 10) <= to;
const nameOf = (m) => m?.display_name || m?.name || `Anggota ${String(m?.user_id || "").slice(0, 8)}`;

export default function MarketingAdsPanel({ leads = [], dealTransactions = [], members = [], from, to, ym, canManage, myUid: myUidProp = null, onChanged }) {
  const [myUidState, setMyUidState] = useState(myUidProp);
  const myUid = myUidProp || myUidState;
  useEffect(() => { if (!myUidProp) db.getCurrentUserId().then(setMyUidState).catch(() => setMyUidState(null)); }, [myUidProp]);
  const [expenses, setExpenses] = useState([]);
  const [budgets, setBudgets] = useState({});
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Form pengeluaran
  const [fUser, setFUser] = useState("");
  const [fDay, setFDay] = useState(todayIso());
  const [fPlatform, setFPlatform] = useState("Meta");
  const [fCampaign, setFCampaign] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fNote, setFNote] = useState("");

  const load = () => {
    setErr("");
    Promise.all([db.listAdExpenses(from, to), db.listAdBudgets(ym)])
      .then(([ex, bud]) => {
        setExpenses(ex);
        setBudgets(Object.fromEntries(bud.map((b) => [b.user_id, Number(b.amount) || 0])));
      })
      .catch((e) => setErr(e.message || "Gagal memuat pengeluaran iklan"));
  };
  useEffect(load, [from, to, ym]);

  useEffect(() => { if (!fUser) setFUser(myUid || members[0]?.user_id || ""); }, [myUid, members, fUser]);

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.user_id, m])), [members]);

  // Hasil per marketing
  const rows = useMemo(() => {
    const ids = new Set([...members.map((m) => m.user_id), ...expenses.map((e) => e.user_id), ...Object.keys(budgets)]);
    const periodLeads = leads.filter((l) => !l.deleted_at && inRange(l.created_at, from, to));
    return [...ids].filter((u) => canManage || u === myUid).map((u) => {
      const ex = expenses.filter((e) => e.user_id === u);
      const spent = ex.reduce((n, e) => n + (Number(e.amount) || 0), 0);
      const platforms = new Set(ex.map((e) => String(e.platform || "").trim().toLowerCase()).filter(Boolean));
      const adLeads = periodLeads.filter((l) => (l.assigned_to || l.user_id) === u && platforms.has(String(l.source || "").trim().toLowerCase()));
      const adLeadIds = new Set(adLeads.map((l) => l.id));
      const deals = dealTransactions.filter((t) => adLeadIds.has(t.lead_id) && inRange(t.deal_date, from, to));
      const omzet = deals.reduce((n, t) => n + (Number(t.deal_value) || 0), 0);
      const budget = budgets[u] || 0;
      return {
        user: u, name: nameOf(memberById[u]), budget, spent, sisa: budget - spent,
        leads: adLeads.length, perLead: adLeads.length ? spent / adLeads.length : null,
        deals: deals.length, perDeal: deals.length ? spent / deals.length : null, omzet,
      };
    }).sort((a, b) => b.spent - a.spent);
  }, [members, expenses, budgets, leads, dealTransactions, from, to, canManage, myUid, memberById]);

  const addExpense = async () => {
    const amount = Number(fAmount);
    if (!fUser || !fDay || !fPlatform || !(amount > 0)) { setErr("Isi marketing, tanggal, platform, dan jumlah lebih dari 0."); return; }
    if (!canManage && fUser !== myUid) { setErr("Marketing hanya bisa mengisi pengeluarannya sendiri."); return; }
    setBusy(true); setErr("");
    try {
      await db.addAdExpense({ userId: fUser, day: fDay, platform: fPlatform, campaign: fCampaign, amount, note: fNote });
      setFAmount(""); setFCampaign(""); setFNote("");
      load();
      onChanged?.();
    } catch (e) {
      setErr(e.message || "Gagal menyimpan pengeluaran");
    } finally { setBusy(false); }
  };

  const removeExpense = async (id) => {
    if (!window.confirm("Hapus pengeluaran iklan ini?")) return;
    try { await db.deleteAdExpense(id); load(); onChanged?.(); } catch (e) { setErr(e.message || "Gagal menghapus"); }
  };

  const saveBudget = async (userId, value) => {
    try { await db.setAdBudget({ userId, period: ym, amount: Number(value) || 0 }); load(); }
    catch (e) { setErr(e.message || "Gagal menyimpan budget"); }
  };

  const field = "w-full rounded-inner border border-slate-200 bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-4 focus:ring-brand/10";
  const canPickUser = canManage;
  const visibleExpenses = expenses.filter((e) => canManage || e.user_id === myUid);

  return (
    <div className="space-y-5">
      <div className="rounded-panel border border-slate-200/80 bg-white p-5">
        <div className="mb-3">
          <h3 className="text-[14px] font-semibold text-ink">Pengeluaran iklan per marketing</h3>
          <p className="text-[12px] text-slate-500">{canManage ? "Owner dan manager melihat semua marketing." : "Anda hanya melihat pengeluaran dan hasil Anda sendiri."}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <label className="text-[11px] font-medium text-slate-500 md:col-span-1">Marketing
            <select className={`${field} mt-1`} value={fUser} onChange={(e) => setFUser(e.target.value)} disabled={!canPickUser}>
              {(canPickUser ? members : members.filter((m) => m.user_id === myUid)).map((m) => <option key={m.user_id} value={m.user_id}>{nameOf(m)}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">Tanggal
            <input type="date" className={`${field} mt-1`} value={fDay} onChange={(e) => setFDay(e.target.value)} />
          </label>
          <label className="text-[11px] font-medium text-slate-500">Platform
            <select className={`${field} mt-1`} value={fPlatform} onChange={(e) => setFPlatform(e.target.value)}>
              {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-500">Kampanye (opsional)
            <input className={`${field} mt-1`} value={fCampaign} onChange={(e) => setFCampaign(e.target.value)} placeholder="Nama kampanye" />
          </label>
          <label className="text-[11px] font-medium text-slate-500">Jumlah (Rp)
            <input type="number" min="0" className={`${field} mt-1`} value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="0" />
          </label>
          <div className="flex items-end">
            <button type="button" onClick={addExpense} disabled={busy} className="w-full rounded-inner bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{busy ? "Menyimpan…" : "Tambah pengeluaran"}</button>
          </div>
        </div>
        {err && <p className="mt-3 rounded-inner bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p>}
      </div>

      <div className="overflow-hidden rounded-panel border border-slate-200/80 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Marketing</th>
                <th className="px-4 py-2.5 text-right">Budget</th>
                <th className="px-4 py-2.5 text-right">Pengeluaran</th>
                <th className="px-4 py-2.5 text-right">Sisa</th>
                <th className="px-4 py-2.5 text-right">Lead iklan</th>
                <th className="px-4 py-2.5 text-right">Biaya/lead</th>
                <th className="px-4 py-2.5 text-right">Deal</th>
                <th className="px-4 py-2.5 text-right">Biaya/deal</th>
                <th className="px-4 py-2.5 text-right">Omzet</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} className="px-4 py-6 text-center text-slate-500">Belum ada pengeluaran iklan di periode ini.</td></tr>}
              {rows.map((r) => (
                <tr key={r.user} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-semibold text-ink">{r.name}</td>
                  <td className="px-4 py-2.5 text-right">
                    {(canManage || r.user === myUid) ? (
                      <input type="number" min="0" defaultValue={r.budget || ""} onBlur={(e) => { if ((Number(e.target.value) || 0) !== r.budget) saveBudget(r.user, e.target.value); }} className="w-32 rounded-inner border border-slate-200 px-2 py-1 text-right text-[12px]" placeholder="0" />
                    ) : fmtRp(r.budget)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtRp(r.spent)}</td>
                  <td className={`px-4 py-2.5 text-right tabular-nums ${r.sisa < 0 ? "text-rose-600" : "text-slate-700"}`}>{fmtRp(r.sisa)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.leads}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.perLead == null ? "–" : fmtRp(Math.round(r.perLead))}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.deals}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.perDeal == null ? "–" : fmtRp(Math.round(r.perDeal))}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{fmtRp(r.omzet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-panel border border-slate-200/80 bg-white p-5">
        <h3 className="mb-3 text-[14px] font-semibold text-ink">Riwayat pengeluaran periode ini</h3>
        {visibleExpenses.length === 0 && <p className="text-[12.5px] text-slate-500">Belum ada pengeluaran.</p>}
        <ul className="divide-y divide-slate-100">
          {visibleExpenses.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-[12.5px]">
              <div className="min-w-0">
                <div className="font-semibold text-ink">{fmtRp(e.amount)} · {e.platform}{e.campaign ? ` · ${e.campaign}` : ""}</div>
                <div className="text-[11.5px] text-slate-500">{nameOf(memberById[e.user_id])} · {e.day}{e.note ? ` · ${e.note}` : ""}</div>
              </div>
              {(canManage || e.user_id === myUid) && (
                <button type="button" onClick={() => removeExpense(e.id)} className="shrink-0 rounded-lg border border-rose-200 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50">Hapus</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
