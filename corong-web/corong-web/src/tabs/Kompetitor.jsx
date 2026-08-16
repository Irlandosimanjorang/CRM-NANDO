import { useState } from "react";
import { Swords, Plus } from "lucide-react";
import CompetitorModal from "../components/CompetitorModal";

export default function Kompetitor({ competitors, onChanged }) {
  const [edit, setEdit] = useState(null);
  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Kompetitor</h1>
        <button onClick={() => setEdit({ name: "", background: "", product: "", notes: "", usages: [] })} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm px-3 py-2 rounded-xl font-medium shadow-sm shadow-amber-600/20"><Plus size={15} /> Kompetitor</button>
      </div>
      {competitors.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><Swords size={32} className="mx-auto text-slate-300 mb-3" />Belum ada data. Catat company/trading: produk, dan tiap company pemakai + harganya.</div>
      ) : (
        <div className="space-y-3">
          {competitors.map((k) => (
            <div key={k.id} className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between mb-1 cursor-pointer" onClick={() => setEdit(k)}>
                <span className="font-semibold flex items-center gap-2"><Swords size={15} className="text-rose-400" />{k.name}<span className="text-[10px] text-slate-400 font-normal">· {k.usages.length} company</span></span>
              </div>
              {k.product && <p className="text-xs text-slate-500 mb-2">{k.product}</p>}
              {k.usages.length > 0 && (
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide"><tr><th className="text-left px-2 py-1.5 font-medium">Company</th><th className="text-left px-2 py-1.5 font-medium">Produk dipakai</th><th className="text-left px-2 py-1.5 font-medium">Harga</th><th className="text-left px-2 py-1.5 font-medium">Jumlah</th></tr></thead>
                    <tbody>{k.usages.map((u) => (<tr key={u.id} className="border-t border-slate-100"><td className="px-2 py-1.5">{u.company}</td><td className="px-2 py-1.5">{u.product}</td><td className="px-2 py-1.5">{u.price}</td><td className="px-2 py-1.5">{u.quantity}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {edit && <CompetitorModal comp={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onChanged(); }} />}
    </div>
  );
}
