import { useMemo, useState } from "react";
import { CalendarCheck, CalendarClock, Plus, Search, Save, X, CheckCircle2 } from "lucide-react";
import * as db from "../lib/db";
import { typeBadge, prioMeta, chipStyle, fmtDate, todayISO } from "../lib/helpers";

const inp = "w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10";

function AddVisitModal({ leads, onClose, onSaved }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [meet, setMeet] = useState("");
  const [agenda, setAgenda] = useState("");
  const [busy, setBusy] = useState(false);
  const matches = q.trim() ? leads.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const pick = (c) => { setSel(c); setQ(""); setMeet(c.visit_meet || c.key_person || ""); setAgenda(c.visit_agenda || ""); if (c.visit_date) setDate(c.visit_date); };
  const save = async () => {
    if (!sel) { alert("Pilih company dulu."); return; }
    setBusy(true);
    try { await db.upsertLead({ ...sel, visit_date: date, visit_meet: meet, visit_agenda: agenda }); onSaved(); }
    catch (e) { alert("Gagal simpan: " + e.message); setBusy(false); }
  };
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4"><h2 className="font-bold text-lg flex items-center gap-2"><CalendarCheck size={18} className="text-orange-500" /> Tambah Visit</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={20} /></button></div>
        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-slate-500">Company *</span>
            {sel ? (
              <div className="mt-1 flex items-center justify-between border border-orange-300 bg-orange-50 rounded-xl px-3 py-2"><span className="text-sm font-medium">{sel.name}</span><button onClick={() => setSel(null)} className="text-xs text-slate-500 hover:text-rose-500">ganti</button></div>
            ) : (
              <div className="relative">
                <Search size={15} className="absolute left-2.5 top-3.5 text-slate-400" />
                <input autoFocus className="w-full mt-1 pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari company dari leads…" />
                {matches.length > 0 && <div className="mt-1 border border-slate-200 rounded-xl bg-white shadow-sm max-h-52 overflow-y-auto">{matches.map((c) => <div key={c.id} onClick={() => pick(c)} className="px-3 py-2 text-sm hover:bg-orange-50 cursor-pointer border-b border-slate-50 last:border-0"><div className="font-medium">{c.name}</div><div className="text-[11px] text-slate-400">{[c.city, c.category].filter(Boolean).join(" · ")}</div></div>)}</div>}
                {q.trim() && matches.length === 0 && <p className="text-xs text-slate-400 mt-1">Company ga ketemu. Tambahin di tab Leads dulu.</p>}
              </div>
            )}
          </div>
          <div className={sel ? "" : "opacity-40 pointer-events-none"}>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="text-xs font-medium text-slate-500">Tanggal visit</span><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label className="block"><span className="text-xs font-medium text-slate-500">Ketemu siapa</span><input className={inp} value={meet} onChange={(e) => setMeet(e.target.value)} placeholder="mis. Bu Rina (purchasing)" /></label>
            </div>
            <label className="block mt-3"><span className="text-xs font-medium text-slate-500">Agenda</span><textarea className={inp} rows={2} value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="mau bahas apa" /></label>
          </div>
        </div>
        <div className="flex gap-2 mt-5"><button onClick={save} disabled={busy} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm shadow-orange-600/20"><Save size={15} /> Simpan visit</button><button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50">Batal</button></div>
      </div>
    </div>
  );
}

function VisitView({ leads, onEdit, onChanged }) {
  const [add, setAdd] = useState(false);
  const visits = useMemo(() => leads.filter((c) => c.visit_date).sort((a, b) => (a.visit_date < b.visit_date ? -1 : 1)), [leads]);
  const upcoming = visits.filter((c) => c.visit_date >= todayISO());

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button onClick={() => setAdd(true)} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-2 rounded-xl font-medium shadow-sm shadow-orange-600/20"><Plus size={15} /> Tambah visit</button>
      </div>
      {visits.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><CalendarCheck size={32} className="mx-auto text-slate-300 mb-3" />Belum ada visit. Klik "Tambah visit" atau isi "Visit date" di lead mana aja.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3"><div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><CalendarCheck size={13} /> Akan datang</div><div className="font-mono font-bold text-2xl text-orange-600">{upcoming.length}</div></div>
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-3"><div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><CalendarCheck size={13} /> Total terjadwal</div><div className="font-mono font-bold text-2xl text-slate-800">{visits.length}</div></div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/80 text-slate-400 text-[11px] uppercase tracking-wider"><tr>
                <th className="text-left px-3 py-2 font-medium">Perusahaan</th><th className="text-left px-3 py-2 font-medium">Lokasi</th><th className="text-left px-3 py-2 font-medium">Produk</th><th className="text-left px-3 py-2 font-medium">Tanggal visit</th><th className="text-left px-3 py-2 font-medium">Ketemu</th><th className="text-left px-3 py-2 font-medium">Agenda</th>
              </tr></thead>
              <tbody>
                {visits.map((c) => { const past = c.visit_date < todayISO(); const today = c.visit_date === todayISO(); const meet = c.visit_meet || c.key_person; return (
                  <tr key={c.id} className={`border-t border-slate-100 hover:bg-orange-50/40 cursor-pointer ${past ? "opacity-50" : ""}`} onClick={() => onEdit(c)}>
                    <td className="px-3 py-2"><div className="font-medium flex items-center gap-1.5">{c.name}{typeBadge(c.company_type) && <span className="text-[9px] font-bold px-1 rounded bg-slate-200 text-slate-600">{typeBadge(c.company_type)}</span>}</div></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{[c.city, c.province].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{c.product || "—"}</td>
                    <td className="px-3 py-2 text-xs"><span className={today ? "text-orange-600 font-medium" : "text-slate-600"}>{fmtDate(c.visit_date)}{today && " · hari ini"}</span></td>
                    <td className="px-3 py-2 text-xs text-slate-600">{meet || "—"}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 max-w-56">{c.visit_agenda ? <div className="line-clamp-2">{c.visit_agenda}</div> : <span className="text-slate-300">—</span>}</td>
                  </tr> ); })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {add && <AddVisitModal leads={leads} onClose={() => setAdd(false)} onSaved={() => { setAdd(false); onChanged(); }} />}
    </div>
  );
}

function FollowupView({ leads, onEdit, onChanged }) {
  const todo = useMemo(() => leads.filter((c) => c.next_action && c.next_action.trim()), [leads]);
  const done = async (id) => { await db.upsertLead({ ...leads.find((l) => l.id === id), next_action: "" }); onChanged(); };

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Semua lead yang punya "Next action". Klik nama buat buka, ✓ buat tandai selesai.</p>
      {todo.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><CalendarClock size={32} className="mx-auto text-slate-300 mb-3" />Belum ada next action. Buka lead → isi kolom "Next action".</div>
      ) : (
        <div className="space-y-2">
          {todo.map((c) => { const pm = prioMeta(c.priority); return (
            <div key={c.id} className="bg-white border border-slate-200/80 border-l-4 border-l-rose-400 rounded-2xl shadow-sm p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(c)}>
                <div className="flex items-center gap-2 flex-wrap"><span className="font-medium text-sm">{c.name}</span>{pm && <span className="text-[10px] border rounded-full px-1.5 py-0.5" style={chipStyle(pm.hex)}>{pm.label}</span>}</div>
                <div className="text-xs text-orange-700 mt-0.5">→ {c.next_action}</div>
              </div>
              <button onClick={() => done(c.id)} title="Tandai selesai" className="text-slate-300 hover:text-emerald-500 p-1"><CheckCircle2 size={16} /></button>
            </div> ); })}
        </div>
      )}
    </div>
  );
}

export default function VisitFollowup({ leads, onEdit, onChanged }) {
  const [tab, setTab] = useState("visit");
  const visitCount = leads.filter((c) => c.visit_date).length;
  const followupCount = leads.filter((c) => c.next_action && c.next_action.trim()).length;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-3">Visit & Follow-up</h1>
      <div className="flex gap-2 mb-4 border-b border-slate-200">
        <button onClick={() => setTab("visit")} className={`text-sm px-4 py-2.5 border-b-2 -mb-px flex items-center gap-1.5 ${tab === "visit" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          <CalendarCheck size={15} /> Visit <span className="text-xs text-slate-400">({visitCount})</span>
        </button>
        <button onClick={() => setTab("followup")} className={`text-sm px-4 py-2.5 border-b-2 -mb-px flex items-center gap-1.5 ${tab === "followup" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          <CalendarClock size={15} /> Follow-up <span className="text-xs text-slate-400">({followupCount})</span>
        </button>
      </div>

      {tab === "visit" ? <VisitView leads={leads} onEdit={onEdit} onChanged={onChanged} /> : <FollowupView leads={leads} onEdit={onEdit} onChanged={onChanged} />}
    </div>
  );
}
