import { useEffect, useMemo, useState } from "react";
import { fmtRp, fmtDate, reasonCategoriesFor } from "../lib/helpers";

// Papan kanban tahap lead (13 Okt 2026). Geser kartu ke kolom lain: kartu langsung pindah di layar (tanpa menunggu),
// lalu disimpan di belakang layar. Kalau gagal, kartu kembali ke tempat semula dan muncul pesan. Pindah ke Menang
// atau Kalah membuka form lead supaya alasan dan deal tetap dicatat. Di HP, pakai menu tahap di kartu.
const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const daysAgo = (d) => {
  if (!d) return null;
  const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return Number.isNaN(n) ? null : n;
};

export default function LeadBoard({ leads, stages, onOpenEdit, onMove, onNewOpportunity }) {
  const cols = useMemo(() => [...stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [stages]);
  const firstNormal = cols.find((s) => s.type === "normal");
  const [dragId, setDragId] = useState(null);
  const [overKey, setOverKey] = useState(null);
  // Perubahan yang sudah tampil tapi belum tercermin dari data: id -> tahap baru.
  const [pending, setPending] = useState({});
  // Pop-up alasan menang / kalah (muncul setelah kartu dipindah).
  const [closing, setClosing] = useState(null);

  // Buang perubahan yang sudah tercermin di data (berarti penyimpanan selesai dan daftar sudah diperbarui).
  useEffect(() => {
    setPending((p) => {
      const next = { ...p };
      let changed = false;
      for (const l of leads) {
        if (next[l.id] && next[l.id] === l.stage_key) { delete next[l.id]; changed = true; }
      }
      return changed ? next : p;
    });
  }, [leads]);

  const stageOf = (l) => pending[l.id] || l.stage_key;

  const moveTo = (lead, key) => {
    if (!lead || stageOf(lead) === key) return;
    const target = cols.find((s) => s.key === key);
    if (target?.type === "won" || target?.type === "lost") {
      setPending((p) => ({ ...p, [lead.id]: key }));
      setClosing({ lead, key, result: target.type });
      return;
    }
    setPending((p) => ({ ...p, [lead.id]: key }));
    Promise.resolve(onMove(lead, key)).catch((e) => {
      setPending((p) => { const n = { ...p }; delete n[lead.id]; return n; });
      alert("Gagal pindah tahap: " + (e?.message || e));
    });
  };

  const cancelClose = () => {
    if (closing) setPending((p) => { const n = { ...p }; delete n[closing.lead.id]; return n; });
    setClosing(null);
  };

  const saveClose = (category, note) => {
    const { lead, key, result } = closing;
    setClosing(null);
    Promise.resolve(onMove(lead, key, { result, reason_category: category, note })).catch((e) => {
      setPending((p) => { const n = { ...p }; delete n[lead.id]; return n; });
      alert("Gagal menyimpan: " + (e?.message || e));
    });
  };

  const onDropCol = (key) => {
    const lead = leads.find((l) => l.id === dragId);
    setDragId(null);
    setOverKey(null);
    moveTo(lead, key);
  };

  const board = cols.map((s) => ({ stage: s, items: leads.filter((l) => stageOf(l) === s.key) }));
  const accent = (s) => s.hex || "#94a3b8";

  return (
    <div className="mt-1 overflow-x-auto pb-4">
      {closing && <CloseDialog closing={closing} onCancel={cancelClose} onSave={saveClose} />}
      <div className="flex min-w-max items-start gap-4">
        {board.map(({ stage: s, items }) => {
          const total = items.reduce((n, l) => n + (Number(l.deal_value) || 0), 0);
          const hi = overKey === s.key && dragId;
          return (
            <section
              key={s.key}
              onDragOver={(e) => { e.preventDefault(); if (overKey !== s.key) setOverKey(s.key); }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOverKey((k) => (k === s.key ? null : k)); }}
              onDrop={(e) => { e.preventDefault(); onDropCol(s.key); }}
              className={`flex w-[264px] shrink-0 flex-col rounded-2xl border bg-white transition-all duration-150 ${hi ? "border-orange-400 ring-4 ring-orange-100" : "border-slate-200/80"}`}
            >
              <header className="px-3.5 pt-3">
                <div className="h-1 w-full rounded-full" style={{ backgroundColor: accent(s) }} />
                <div className="flex items-center justify-between pb-2 pt-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent(s) }} />
                    <span className="truncate text-[13px] font-semibold text-slate-800">{s.label}</span>
                    <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums text-slate-500">{items.length}</span>
                  </div>
                  {total > 0 && <span className="shrink-0 text-[11px] font-medium tabular-nums text-slate-500">{fmtRp(total)}</span>}
                </div>
              </header>

              <div className="flex min-h-[120px] flex-1 flex-col gap-2.5 px-2.5 pb-2.5">
                {items.map((l) => {
                  const days = daysAgo(l.last_contact);
                  const cold = days === null || days > 7;
                  const moving = pending[l.id];
                  return (
                    <article
                      key={l.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragId(l.id); }}
                      onDragEnd={() => { setDragId(null); setOverKey(null); }}
                      className={`group relative cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-150 hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,0.18)] active:cursor-grabbing ${dragId === l.id ? "opacity-40" : ""} ${moving ? "ring-2 ring-orange-200" : ""}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">{initials(l.name)}</div>
                        <button type="button" onClick={() => onOpenEdit(l)} className="min-w-0 flex-1 text-left">
                          <div className="truncate text-[13px] font-semibold leading-tight text-slate-900">{l.name}</div>
                          <div className="mt-0.5 truncate text-[11.5px] text-slate-500">{[l.city, l.product].filter(Boolean).join(" · ") || "Belum ada detail"}</div>
                        </button>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className={`text-[12.5px] font-semibold tabular-nums ${l.deal_value ? "text-slate-900" : "text-slate-400"}`}>
                          {l.deal_value ? fmtRp(l.deal_value) : "Nilai belum diisi"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-medium ${cold ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                          {days === null ? "belum dihubungi" : days === 0 ? "hari ini" : `${days} hari lalu`}
                        </span>
                      </div>

                      {s.type === "won" && firstNormal && (
                        <button
                          type="button"
                          onClick={() => onNewOpportunity(l, firstNormal.key)}
                          className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg border border-orange-200 bg-orange-50/60 px-2 py-1.5 text-[11.5px] font-semibold text-orange-700 transition hover:bg-orange-100"
                        >
                          Peluang baru (repeat order)
                        </button>
                      )}

                      <select
                        aria-label="Pindah tahap"
                        value={stageOf(l)}
                        onChange={(e) => moveTo(l, e.target.value)}
                        className="mt-2.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11.5px] text-slate-600 md:hidden"
                      >
                        {cols.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>
                    </article>
                  );
                })}

                {items.length === 0 && (
                  <div className={`grid flex-1 place-items-center rounded-xl border border-dashed py-8 text-[11.5px] ${hi ? "border-orange-300 text-orange-600" : "border-slate-200 text-slate-400"}`}>
                    {dragId ? "Lepas kartu di sini" : "Belum ada lead"}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Pop-up kecil: alasan menang / kalah, plus catatan opsional yang masuk ke progres lead.
function CloseDialog({ closing, onCancel, onSave }) {
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const won = closing.result === "won";
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${won ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {won ? "Menang" : "Kalah"}
        </span>
        <h3 className="mt-2 text-[15px] font-semibold text-slate-900">Kenapa {won ? "menang" : "kalah"}?</h3>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">{closing.lead.name}</p>
        <div className="mt-4 grid grid-cols-2 gap-1.5">
          {reasonCategoriesFor(closing.result).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-lg border px-2.5 py-2 text-left text-[12px] transition ${category === c ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Catatan singkat (opsional)"
          className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100">Batal</button>
          <button
            type="button"
            disabled={!category}
            onClick={() => onSave(category, note.trim())}
            className="rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
