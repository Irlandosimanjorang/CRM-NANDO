import { useMemo } from "react";
import { Trophy, Building2, TrendingUp } from "lucide-react";
import { stageMeta, chipStyle, typeBadge, fmtRp, fmtDate } from "../lib/helpers";

export default function Deal({ leads, stages, onEdit }) {
  const wonKeys = stages.filter((s) => s.type === "won").map((s) => s.key);
  const deals = useMemo(() => leads.filter((c) => wonKeys.includes(c.stage_key)), [leads, stages]);
  const totalValue = deals.reduce((a, c) => a + (Number(c.deal_value) || 0), 0);
  const totalTon = deals.reduce((a, c) => a + (Number(c.tonnage) || 0), 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3"><Trophy size={20} className="text-emerald-500" /><h1 className="text-2xl font-bold tracking-tight">Deal</h1><span className="text-sm text-slate-400">({deals.length})</span></div>
      {deals.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><Trophy size={32} className="mx-auto text-slate-300 mb-3" />Belum ada deal. Lead yang tahapnya bertipe "Deal (menang)" bakal muncul di sini otomatis.</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3"><div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Trophy size={13} /> Total Deal</div><div className="font-mono font-bold text-2xl text-emerald-600">{deals.length}</div></div>
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3"><div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><Building2 size={13} /> Total Tonase</div><div className="font-mono font-bold text-2xl text-slate-800">{totalTon.toLocaleString("id-ID")} <span className="text-sm font-normal text-slate-400">ton</span></div></div>
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3"><div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><TrendingUp size={13} /> Total Nilai</div><div className="font-mono font-bold text-base text-slate-800">{fmtRp(totalValue)}</div></div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-400 text-[11px] uppercase tracking-wider"><tr>
                <th className="text-left px-3 py-2 font-medium">Perusahaan</th><th className="text-left px-3 py-2 font-medium">Kota</th><th className="text-left px-3 py-2 font-medium">Tahap</th><th className="text-left px-3 py-2 font-medium">Sales</th><th className="text-left px-3 py-2 font-medium">Tanggal</th><th className="text-left px-3 py-2 font-medium">Chemical</th><th className="text-left px-3 py-2 font-medium">Ton</th><th className="text-left px-3 py-2 font-medium">Nilai</th>
              </tr></thead>
              <tbody>
                {deals.map((c) => { const sm = stageMeta(stages, c.stage_key); return (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-amber-50/40 cursor-pointer" onClick={() => onEdit(c)}>
                    <td className="px-3 py-2"><div className="font-medium flex items-center gap-1.5">{c.name}{typeBadge(c.company_type) && <span className="text-[9px] font-bold px-1 rounded bg-slate-200 text-slate-600">{typeBadge(c.company_type)}</span>}</div></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.city || "—"}</td>
                    <td className="px-3 py-2"><span className="text-[11px] border rounded-full px-2 py-0.5" style={chipStyle(sm.hex)}>{sm.label}</span></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.sales_owner || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.deal_date ? fmtDate(c.deal_date) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.chemical || "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-700">{c.tonnage ? `${Number(c.tonnage).toLocaleString("id-ID")} ton` : "—"}</td>
                    <td className="px-3 py-2 text-xs font-mono text-slate-700">{c.deal_value ? fmtRp(c.deal_value) : "—"}</td>
                  </tr> ); })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
