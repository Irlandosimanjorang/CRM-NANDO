import { useMemo, useState } from "react";
import { X, Search, Building2 } from "lucide-react";
import * as db from "../lib/db";

// Atur grup pusat dan cabang langsung dari tab Leads (13 Okt 2026), tanpa lewat mapping import.
// Pilih beberapa lead, isi Pusat (perusahaan induk), lalu terapkan sekaligus. Kolom yang dikosongkan tidak
// menghapus nilai lama, kecuali lewat tombol "Lepas grup". Holding / Group tidak diubah dari dialog ini.
const CHUNK = 8; // jumlah penyimpanan paralel per kelompok, supaya tidak membebani server
const SHOW_LIMIT = 300;

export default function GroupAssignDialog({ leads, onClose, onDone }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [pusat, setPusat] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState("");

  const live = useMemo(() => leads.filter((l) => !l.deleted_at), [leads]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? live.filter((l) => [l.name, l.city, l.parent_company].some((x) => String(x || "").toLowerCase().includes(s)))
      : live;
    return list.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))).slice(0, SHOW_LIMIT);
  }, [live, q]);

  const toggle = (id) => setPicked((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectShown = () => setPicked((cur) => { const n = new Set(cur); shown.forEach((l) => n.add(l.id)); return n; });
  const clearPicked = () => setPicked(new Set());

  const apply = async (clear) => {
    const targets = live.filter((l) => picked.has(l.id));
    if (!targets.length) return;
    const p = pusat.trim();
    if (!clear && !p) { setErr("Isi Pusat dulu, atau pakai Lepas grup."); return; }
    const verb = clear ? "lepas dari grupnya" : "diatur ke grup ini";
    if (!window.confirm(`${targets.length} lead akan ${verb}. Lanjutkan?`)) return;
    setBusy(true); setErr(""); setProgress(0);
    let done = 0;
    try {
      for (let i = 0; i < targets.length; i += CHUNK) {
        const chunk = targets.slice(i, i + CHUNK);
        await Promise.all(chunk.map((l) => db.upsertLead({
          ...l,
          parent_company: clear ? "" : p,
        })));
        done += chunk.length;
        setProgress(done);
      }
      onDone(targets.length, clear);
    } catch (e) {
      setErr(`Gagal menyimpan. ${done} dari ${targets.length} lead sudah tersimpan. ${e?.message || e}`);
      setBusy(false);
    }
  };

  const field = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="grp-title" className="flex max-h-[90vh] w-full max-w-[640px] flex-col rounded-panel bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="grp-title" className="flex items-center gap-2 text-lg font-bold"><Building2 size={18} className="text-slate-700" /> Atur grup pusat & cabang</h2>
            <p className="mt-1 text-sm text-slate-500">Pilih lead yang satu perusahaan, lalu isi Pusat (perusahaan induk). Holding untuk tingkat di atas pusat.</p>
          </div>
          <button onClick={onClose} disabled={busy} className="text-slate-400 hover:text-slate-700" aria-label="Tutup"><X size={18} /></button>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-slate-500">Pusat (perusahaan induk)</span>
          <input className={`${field} mt-1`} value={pusat} onChange={(e) => setPusat(e.target.value)} placeholder="Misal: PT Sinar Abadi Plastik" disabled={busy} />
        </label>

        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${field} pl-8`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, kota, atau pusat" disabled={busy} />
          </div>
          <button type="button" onClick={selectShown} disabled={busy || !shown.length} className="whitespace-nowrap rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50">Pilih yang tampil</button>
          <button type="button" onClick={clearPicked} disabled={busy || !picked.size} className="whitespace-nowrap rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium hover:bg-slate-50 disabled:opacity-50">Kosongkan</button>
        </div>

        <div className="mt-3 min-h-[180px] flex-1 overflow-y-auto rounded-xl border border-slate-200">
          {shown.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Tidak ada lead yang cocok.</p>}
          <ul className="divide-y divide-slate-100">
            {shown.map((l) => (
              <li key={l.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                  <input type="checkbox" className="h-4 w-4 accent-slate-900" checked={picked.has(l.id)} onChange={() => toggle(l.id)} disabled={busy} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-slate-900">{l.name}</div>
                    <div className="truncate text-[11.5px] text-slate-500">
                      {[l.city, l.parent_company && `Pusat: ${l.parent_company}`].filter(Boolean).join(" · ") || "Belum ada pusat"}
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </div>

        {err && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{err}</p>}
        {busy && <p className="mt-3 text-[12.5px] text-slate-500">Menyimpan… {progress} dari {picked.size}</p>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] text-slate-500">{picked.size} lead dipilih</span>
          <div className="flex gap-2">
            <button onClick={() => apply(true)} disabled={busy || !picked.size} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">Lepas grup</button>
            <button onClick={() => apply(false)} disabled={busy || !picked.size} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Terapkan ke {picked.size} lead</button>
          </div>
        </div>
      </div>
    </div>
  );
}
