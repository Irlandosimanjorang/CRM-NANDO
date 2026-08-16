import { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import * as db from "../lib/db";
import { prioMeta, chipStyle } from "../lib/helpers";

export default function Followup({ leads, onEdit, onChanged }) {
  const todo = useMemo(() => leads.filter((c) => c.next_action && c.next_action.trim()), [leads]);
  const done = async (id) => { await db.upsertLead({ ...leads.find((l) => l.id === id), next_action: "" }); onChanged(); };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-1">Follow-up</h1>
        <p className="text-sm text-slate-500">Semua lead yang punya "Next action". Klik nama buat buka, ✓ buat tandai selesai.</p>
      </div>
      {todo.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada next action. Buka lead → isi kolom "Next action".</p>
      ) : (
        <div className="space-y-2">
          {todo.map((c) => { const pm = prioMeta(c.priority); return (
            <div key={c.id} className="bg-white border border-slate-200/80 border-l-4 border-l-rose-400 rounded-2xl shadow-sm p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(c)}>
                <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-sm">{c.name}</span>{pm && <span className="text-[10px] border rounded-full px-1.5 py-0.5" style={chipStyle(pm.hex)}>{pm.label}</span>}</div>
                <div className="text-xs text-amber-700 mt-0.5">→ {c.next_action}</div>
              </div>
              <button onClick={() => done(c.id)} title="Tandai selesai" className="text-slate-300 hover:text-emerald-500 p-1"><CheckCircle2 size={16} /></button>
            </div> ); })}
        </div>
      )}
    </div>
  );
}
