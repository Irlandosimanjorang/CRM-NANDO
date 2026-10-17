import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, Trash2, X } from "lucide-react";
import * as db from "../lib/db";

// Rencana tim marketing (16 Okt 2026): kalender satu bulan tempat tim mencatat rencana kegiatan per tanggal.
// Marketing mengisi rencananya sendiri; owner dan manager melihat dan mengisi untuk semua anggota.
const KINDS = ["Telepon", "Kirim SPH", "Kunjungan", "Meeting", "Presentasi", "Lainnya"];
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const pad = (n) => String(n).padStart(2, "0");
const nameOf = (m) => m?.display_name || m?.name || `Anggota ${String(m?.user_id || "").slice(0, 8)}`;
const todayIso = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

const field = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-ink placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/5";

export default function RencanaBulanan({ ym, members = [], canManage = false }) {
  const [items, setItems] = useState([]);
  const [myUid, setMyUid] = useState(null);
  const [selected, setSelected] = useState(null); // tanggal ISO yang sedang dibuka di pop-up
  const [filterUser, setFilterUser] = useState("all");
  const [form, setForm] = useState({ title: "", kind: KINDS[0], targetValue: "", userId: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [y, m] = ym.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${y}-${pad(m)}-01`;
  const to = `${y}-${pad(m)}-${pad(daysInMonth)}`;
  const today = todayIso();

  const load = () => {
    setErr("");
    db.listRencana(from, to).then(setItems).catch((e) => setErr(e.message || "Gagal memuat rencana"));
  };
  useEffect(load, [from, to]);
  // Rencana yang ditambah tim marketing (realtime) langsung muncul di kalender manager.
  useEffect(() => {
    const onData = () => load();
    window.addEventListener("nexto-data-changed", onData);
    return () => window.removeEventListener("nexto-data-changed", onData);
  }, [from, to]);
  useEffect(() => { db.getCurrentUserId().then(setMyUid).catch(() => setMyUid(null)); }, []);
  useEffect(() => { setSelected(null); }, [ym]);

  // Tutup pop-up dengan Esc.
  useEffect(() => {
    if (!selected) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const memberById = useMemo(() => Object.fromEntries(members.map((x) => [x.user_id, x])), [members]);
  const visible = useMemo(() => items.filter((x) => filterUser === "all" || x.user_id === filterUser), [items, filterUser]);
  const byDay = useMemo(() => {
    const map = new Map();
    for (const x of visible) {
      const list = map.get(x.plan_date) || [];
      list.push(x);
      map.set(x.plan_date, list);
    }
    return map;
  }, [visible]);

  // Kalender mulai Senin, seperti kalender di tab Report.
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const total = visible.length;
  const doneCount = visible.filter((x) => x.done).length;
  const selectedItems = selected ? (byDay.get(selected) || []) : [];
  // Rencana hanya ditulis pemiliknya (marketing). Owner dan manager hanya melihat rencana seluruh tim.
  const canAddFor = (uid) => !!uid && uid === myUid;

  const openDay = (iso) => {
    setSelected(iso);
    setErr("");
    setForm({ title: "", kind: KINDS[0], targetValue: "" });
  };

  const addItem = async () => {
    const title = form.title.trim();
    if (!title) { setErr("Isi nama kegiatan terlebih dahulu."); return; }
    if (!myUid) { setErr("Sesi tidak ditemukan. Silakan muat ulang halaman."); return; }
    setBusy(true); setErr("");
    try {
      await db.addRencana({ userId: myUid, planDate: selected, title, kind: form.kind, targetValue: form.targetValue });
      setForm((f) => ({ ...f, title: "", targetValue: "" }));
      load();
    } catch (e) {
      setErr(e.message || "Gagal menyimpan rencana");
    } finally { setBusy(false); }
  };

  const toggle = async (x) => {
    try { await db.setRencanaDone(x.id, !x.done); load(); } catch (e) { setErr(e.message || "Gagal mengubah status"); }
  };
  const remove = async (x) => {
    if (!window.confirm("Hapus rencana ini?")) return;
    try { await db.deleteRencana(x.id); load(); } catch (e) { setErr(e.message || "Gagal menghapus"); }
  };

  const popup = selected ? (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
    >
      <div role="dialog" aria-modal="true" aria-label="Rencana tanggal" className="flex max-h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-[11.5px] text-slate-500">{selected === today ? "Hari ini" : DAYS[(new Date(selected + "T00:00:00Z").getUTCDay() + 6) % 7]}</div>
            <div className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">{Number(selected.slice(8, 10))} {MONTHS[m - 1]} {y}</div>
          </div>
          <button type="button" onClick={() => setSelected(null)} aria-label="Tutup" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          {selectedItems.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-slate-500">Belum ada rencana di tanggal ini.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {selectedItems.map((x) => (
                <li key={x.id} className="flex items-start gap-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(x)}
                    disabled={!canAddFor(x.user_id)}
                    aria-label={x.done ? "Tandai belum selesai" : "Tandai selesai"}
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors disabled:cursor-default ${x.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white hover:border-slate-400"}`}
                  >
                    {x.done && <Check size={12} strokeWidth={3} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[13px] font-semibold ${x.done ? "text-slate-400 line-through" : "text-ink"}`}>{x.title}</div>
                    <div className="mt-0.5 text-[11.5px] text-slate-500">
                      {x.kind}{Number(x.target_value) > 0 ? ` · target ${Number(x.target_value).toLocaleString("id-ID")}` : ""}
                      {canManage ? ` · ${nameOf(memberById[x.user_id])}` : ""}
                    </div>
                  </div>
                  {canAddFor(x.user_id) && (
                    <button type="button" onClick={() => remove(x)} aria-label="Hapus rencana" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {canManage ? (
          <div className="flex justify-end border-t border-slate-100 px-5 py-3">
            <button type="button" onClick={() => setSelected(null)} className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100">Tutup</button>
          </div>
        ) : (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="text-[12px] font-semibold text-ink">Tambah rencana saya</div>
          {err && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p>}
          <div className="mt-2 grid grid-cols-2 gap-2.5">
            <label className="col-span-2 text-[11px] font-medium text-slate-500">Kegiatan
              <input autoFocus className={field} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Mis. Follow up PT Karya Sentosa" />
            </label>
            <label className="text-[11px] font-medium text-slate-500">Jenis
              <select className={field} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Target (opsional)
              <input type="number" min="0" className={field} value={form.targetValue} onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))} placeholder="0" />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setSelected(null)} className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100">Tutup</button>
            <button type="button" onClick={addItem} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"><Plus size={13} /> {busy ? "Menyimpan…" : "Simpan rencana"}</button>
          </div>
        </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">Rencana {MONTHS[m - 1]} {y}</div>
          <div className="mt-0.5 text-[12px] text-slate-500">
            {total} rencana, {doneCount} sudah selesai. {canManage ? "Tim marketing mengisi rencananya sendiri." : "Klik tanggal untuk melihat atau menambah rencana."}
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            {filterUser !== "all" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11.5px] font-semibold text-white">
                {nameOf(memberById[filterUser])} · {items.filter((x) => x.user_id === filterUser).length} rencana
                <button type="button" onClick={() => setFilterUser("all")} aria-label="Hapus filter anggota" className="rounded-full p-0.5 hover:bg-white/20"><X size={12} /></button>
              </span>
            )}
            <label className="flex items-center gap-2 text-[12px] text-slate-500">
              Anggota
              <select className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] text-ink focus:border-slate-400 focus:outline-none" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
                <option value="all">Semua anggota ({items.length})</option>
                {members.map((x) => <option key={x.user_id} value={x.user_id}>{nameOf(x)} ({items.filter((r) => r.user_id === x.user_id).length})</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {err && !selected && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DAYS.map((w, i) => (
            <div key={w} className={`py-2 text-center text-[11px] font-semibold ${i >= 5 ? "text-slate-400" : "text-slate-500"}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((iso, idx) => {
            const col = idx % 7;
            if (!iso) return <div key={`e${idx}`} className="min-h-[104px] border-b border-r border-slate-100 bg-slate-50/50" />;
            const list = byDay.get(iso) || [];
            const isToday = iso === today;
            const doneHere = list.filter((x) => x.done).length;
            return (
              <button
                key={iso}
                type="button"
                onClick={() => openDay(iso)}
                className={`group flex min-h-[104px] flex-col border-b border-r border-slate-100 p-2 text-left transition-colors hover:bg-slate-50 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900 ${col >= 5 ? "bg-slate-50/50" : "bg-white"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] font-semibold tabular-nums ${isToday ? "bg-slate-900 text-white" : "text-ink"}`}>{Number(iso.slice(8, 10))}</span>
                  {list.length > 0 && <span className="text-[10.5px] tabular-nums text-slate-500">{doneHere}/{list.length}</span>}
                </div>
                <div className="mt-1.5 flex flex-col gap-1">
                  {list.slice(0, 2).map((x) => (
                    <span
                      key={x.id}
                      className={`block truncate rounded-md border-l-2 px-1.5 py-0.5 text-[11px] ${x.done ? "border-emerald-500 bg-emerald-50 text-emerald-700 line-through" : "border-slate-400 bg-slate-100 text-slate-700"}`}
                    >
                      {canManage ? <b className="font-semibold">{nameOf(memberById[x.user_id]).split(" ")[0]}</b> : null}{canManage ? " · " : ""}{x.title}
                    </span>
                  ))}
                  {list.length > 2 && <span className="px-1 text-[10.5px] font-medium text-slate-500">+{list.length - 2} lagi</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {popup && typeof document !== "undefined" ? createPortal(popup, document.body) : popup}
    </div>
  );
}
