import { useState } from "react";
import { fmtRp, fmtDate } from "../lib/helpers";

// Papan kanban tahap lead (13 Okt 2026, permintaan Nando). Kartu digeser ke kolom lain untuk pindah tahap,
// atau dipilih lewat menu "Pindah tahap" (untuk HP). Pindah ke Menang / Kalah membuka form lead, supaya alasan
// dan deal tetap dicatat seperti biasa. Lead yang sudah Menang bisa dibuka lagi sebagai peluang baru (repeat order).
export default function LeadBoard({ leads, stages, onOpenEdit, onMove, onNewOpportunity }) {
  const cols = [...stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const firstNormal = cols.find((s) => s.type === "normal");
  const [dragId, setDragId] = useState(null);
  const [overKey, setOverKey] = useState(null);

  const moveTo = (lead, key) => {
    if (!lead || lead.stage_key === key) return;
    const target = cols.find((s) => s.key === key);
    if (target?.type === "won" || target?.type === "lost") onOpenEdit({ ...lead, _dropStage: key });
    else onMove(lead, key);
  };

  const onDropCol = (key) => {
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null);
    setOverKey(null);
    moveTo(lead, key);
  };

  return (
    <div className="mt-1 overflow-x-auto pb-3">
      <div className="flex min-w-max gap-3">
        {cols.map((s) => {
          const items = leads.filter((l) => l.stage_key === s.key);
          const total = items.reduce((n, l) => n + (Number(l.deal_value) || 0), 0);
          const hi = overKey === s.key;
          return (
            <div
              key={s.key}
              onDragOver={(e) => { e.preventDefault(); setOverKey(s.key); }}
              onDragLeave={() => setOverKey((k) => (k === s.key ? null : k))}
              onDrop={(e) => { e.preventDefault(); onDropCol(s.key); }}
              className={`w-[250px] shrink-0 rounded-panel border p-2 ${hi ? "border-orange-400 bg-orange-50/60" : "border-slate-200 bg-slate-50"}`}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <span className="text-[12.5px] font-semibold text-slate-700">{s.label}</span>
                <span className="text-[11px] tabular-nums text-slate-500">
                  {items.length}{total ? ` · ${fmtRp(total)}` : ""}
                </span>
              </div>
              <div className="flex min-h-[80px] flex-col gap-2">
                {items.map((l) => (
                  <div
                    key={l.id}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => { setDragId(null); setOverKey(null); }}
                    className="rounded-inner border border-slate-200 bg-white p-2.5 shadow-sm cursor-grab active:cursor-grabbing"
                  >
                    <button type="button" onClick={() => onOpenEdit(l)} className="block w-full text-left">
                      <div className="truncate text-[12.5px] font-semibold text-slate-800">{l.name}</div>
                      <div className="truncate text-[11px] text-slate-500">{[l.city, l.product].filter(Boolean).join(" · ") || "-"}</div>
                    </button>
                    <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
                      <span className="tabular-nums text-slate-700">{l.deal_value ? fmtRp(l.deal_value) : "Nilai belum diisi"}</span>
                      <span className="text-slate-400">{l.last_contact ? fmtDate(l.last_contact) : "belum dihubungi"}</span>
                    </div>
                    {s.type === "won" && firstNormal && (
                      <button
                        type="button"
                        onClick={() => onNewOpportunity(l, firstNormal.key)}
                        className="mt-2 w-full rounded-md border border-orange-300 px-2 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-50"
                      >
                        Peluang baru (repeat order)
                      </button>
                    )}
                    <select
                      aria-label="Pindah tahap"
                      value={l.stage_key}
                      onChange={(e) => moveTo(l, e.target.value)}
                      className="mt-2 w-full rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600"
                    >
                      {cols.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
