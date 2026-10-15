import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import * as db from "../lib/db";

// Rencana tim marketing (16 Okt 2026): kalender satu bulan tempat tim mencatat rencana kegiatan per tanggal.
// Marketing mengisi rencananya sendiri; owner dan manager melihat dan mengisi untuk semua anggota.
const KINDS = ["Telepon", "Kirim SPH", "Kunjungan", "Meeting", "Presentasi", "Lainnya"];
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const pad = (n) => String(n).padStart(2, "0");
const nameOf = (m) => m?.display_name || m?.name || `Anggota ${String(m?.user_id || "").slice(0, 8)}`;

export default function RencanaBulanan({ ym, members = [], canManage = false }) {
  const [items, setItems] = useState([]);
  const [myUid, setMyUid] = useState(null);
  const [selected, setSelected] = useState(null); // tanggal ISO
  const [filterUser, setFilterUser] = useState("all");
  const [form, setForm] = useState({ title: "", kind: KINDS[0], targetValue: "", userId: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [y, m] = ym.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const from = `${y}-${pad(m)}-01`;
  const to = `${y}-${pad(m)}-${pad(daysInMonth)}`;

  const load = () => {
    setErr("");
    db.listRencana(from, to).then(setItems).catch((e) => setErr(e.message || "Gagal memuat rencana"));
  };
  useEffect(load, [from, to]);
  useEffect(() => { db.getCurrentUserId().then(setMyUid).catch(() => setMyUid(null)); }, []);
  useEffect(() => { setSelected(null); }, [ym]);

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

  // Sel kalender: dimulai Senin, seperti kalender di tab Report.
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${pad(m)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const total = visible.length;
  const doneCount = visible.filter((x) => x.done).length;
  const selectedItems = selected ? (byDay.get(selected) || []) : [];
  const canAddFor = (uid) => canManage || uid === myUid;

  const openDay = (iso) => {
    setSelected(iso);
    setErr("");
    setForm((f) => ({ ...f, userId: canManage ? (filterUser !== "all" ? filterUser : (myUid || members[0]?.user_id || "")) : myUid || "" }));
  };

  const addItem = async () => {
    const title = form.title.trim();
    const uid = form.userId || myUid;
    if (!title) { setErr("Isi nama kegiatan terlebih dahulu."); return; }
    if (!uid) { setErr("Pilih anggota terlebih dahulu."); return; }
    if (!canAddFor(uid)) { setErr("Anda hanya bisa mengisi rencana sendiri."); return; }
    setBusy(true); setErr("");
    try {
      await db.addRencana({ userId: uid, planDate: selected, title, kind: form.kind, targetValue: form.targetValue });
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

  const field = "w-full rounded-inner border border-slate-200 bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-4 focus:ring-brand/10";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-[15px] font-bold tracking-[-0.02em] text-ink">Rencana {MONTHS[m - 1]} {y}</div>
          <div className="text-[11.5px] text-slate-500">{total} rencana, {doneCount} selesai. Klik tanggal untuk menambah atau mengecek rencana.</div>
        </div>
        {canManage && (
          <select className="rounded-inner border border-slate-200 bg-white px-3 py-1.5 text-[12px]" value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
            <option value="all">Semua anggota</option>
            {members.map((x) => <option key={x.user_id} value={x.user_id}>{nameOf(x)}</option>)}
          </select>
        )}
      </div>

      {err && <p className="rounded-inner bg-rose-50 px-3 py-2 text-[12px] text-rose-700">{err}</p>}

      <div className="overflow-hidden rounded-panel border border-slate-200/80 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/60">
          {DAYS.map((w, i) => <div key={w} className={`py-1.5 text-center text-[11px] font-semibold ${i >= 5 ? "text-slate-400" : "text-slate-500"}`}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((iso, idx) => {
            if (!iso) return <div key={`e${idx}`} className="min-h-[92px] border-b border-r border-slate-100 bg-slate-50/50" />;
            const list = byDay.get(iso) || [];
            const isSel = selected === iso;
            const dow = (idx % 7);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => openDay(iso)}
                className={`min-h-[92px] border-b border-r border-slate-100 p-1.5 text-left align-top hover:bg-slate-50 ${isSel ? "bg-brand/5 ring-2 ring-inset ring-brand/30" : ""} ${dow >= 5 ? "bg-slate-50/40" : ""}`}
              >
                <div className="text-[11px] font-semibold tabular-nums text-ink">{Number(iso.slice(8, 10))}</div>
                <div className="mt-1 space-y-0.5">
                  {list.slice(0, 3).map((x) => (
                    <div key={x.id} className={`truncate rounded px-1 py-0.5 text-[10.5px] ${x.done ? "bg-emerald-50 text-emerald-700 line-through" : "bg-slate-100 text-slate-700"}`}>
                      {x.title}
                    </div>
                  ))}
                  {list.length > 3 && <div className="text-[10px] text-slate-500">+{list.length - 3} lagi</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="rounded-panel border border-slate-200/80 bg-white p-5">
          <h3 className="mb-3 text-[14px] font-semibold text-ink">
            Rencana tanggal {Number(selected.slice(8, 10))} {MONTHS[m - 1]}
          </h3>
          {selectedItems.length === 0 && <p className="mb-3 text-[12.5px] text-slate-500">Belum ada rencana di tanggal ini.</p>}
          <ul className="mb-4 divide-y divide-slate-100">
            {selectedItems.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2.5 text-[12.5px]">
                <button type="button" onClick={() => toggle(x)} aria-label={x.done ? "Tandai belum selesai" : "Tandai selesai"} className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${x.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"}`}>
                  {x.done && <Check size={12} />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className={`font-semibold ${x.done ? "text-slate-400 line-through" : "text-ink"}`}>{x.title}</div>
                  <div className="text-[11.5px] text-slate-500">
                    {x.kind}{Number(x.target_value) > 0 ? ` · target ${Number(x.target_value).toLocaleString("id-ID")}` : ""}
                    {canManage ? ` · ${nameOf(memberById[x.user_id])}` : ""}
                  </div>
                </div>
                {(canManage || x.user_id === myUid) && (
                  <button type="button" onClick={() => remove(x)} aria-label="Hapus rencana" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 size={14} /></button>
                )}
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <label className="text-[11px] font-medium text-slate-500 md:col-span-2">Kegiatan
              <input className={`${field} mt-1`} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Mis. Follow up PT Karya Sentosa" />
            </label>
            <label className="text-[11px] font-medium text-slate-500">Jenis
              <select className={`${field} mt-1`} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-medium text-slate-500">Target (opsional)
              <input type="number" min="0" className={`${field} mt-1`} value={form.targetValue} onChange={(e) => setForm((f) => ({ ...f, targetValue: e.target.value }))} placeholder="0" />
            </label>
            <div className="flex items-end">
              <button type="button" onClick={addItem} disabled={busy} className="inline-flex w-full items-center justify-center gap-1.5 rounded-inner bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 disabled:opacity-60"><Plus size={13} /> {busy ? "Menyimpan…" : "Tambah"}</button>
            </div>
          </div>
          {canManage && (
            <label className="mt-3 block text-[11px] font-medium text-slate-500">Untuk anggota
              <select className={`${field} mt-1 md:w-1/3`} value={form.userId} onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}>
                {members.map((x) => <option key={x.user_id} value={x.user_id}>{nameOf(x)}</option>)}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
