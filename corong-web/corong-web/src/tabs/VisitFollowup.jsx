import { useMemo, useState, useEffect, useRef } from "react";
import { CalendarCheck, CalendarClock, Plus, Search, Save, X, CheckCircle2, Table2, Calendar, ChevronLeft, ChevronRight, MapPin, Navigation, History } from "lucide-react";
import * as db from "../lib/db";
import { typeBadge, prioMeta, chipStyle, fmtDate, todayISO } from "../lib/helpers";

// Rumus Haversine - itung jarak lurus antara 2 titik GPS (dalam meter)
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CHECKIN_RADIUS_M = 100;

function TodayVisitsCard({ leads, onChanged }) {
  const todayVisits = useMemo(() => leads.filter((c) => c.visit_date === todayISO()), [leads]);
  const [myPos, setMyPos] = useState(null);
  const [geoError, setGeoError] = useState(false);
  const [checkingIn, setCheckingIn] = useState(null);
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (todayVisits.length === 0 || !navigator.geolocation) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => { setMyPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGeoError(false); },
      () => setGeoError(true),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, [todayVisits.length]);

  const doCheckIn = async (lead, distance) => {
    setCheckingIn(lead.id);
    try {
      await db.checkIn({ lead_id: lead.id, lead_name: lead.name, latitude: myPos.lat, longitude: myPos.lng, distance_meters: distance });
      alert(`✅ Check-in "${lead.name}" berhasil dicatat.`);
      onChanged();
    } catch (e) { alert("Gagal check-in: " + e.message); }
    finally { setCheckingIn(null); }
  };

  if (todayVisits.length === 0) return null;

  return (
    <div className="bg-white border border-orange-200 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4 mb-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-3">
        <span className="w-7 h-7 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center"><Navigation size={14} /></span>
        Kunjungan Hari Ini
      </div>
      {geoError && <p className="text-xs text-rose-500 mb-2">Gagal akses GPS. Pastikan izin lokasi diaktifkan buat browser/app ini.</p>}
      <div className="space-y-2">
        {todayVisits.map((c) => {
          const hasCoords = c.latitude != null && c.longitude != null;
          let distance = null;
          if (hasCoords && myPos) distance = Math.round(haversineMeters(myPos.lat, myPos.lng, c.latitude, c.longitude));
          const canCheckIn = hasCoords && distance !== null && distance <= CHECKIN_RADIUS_M;
          return (
            <div key={c.id} className="flex items-center justify-between gap-3 border border-slate-100 rounded-2xl p-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{c.name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {!hasCoords ? "Belum ada titik lokasi tersimpan" : distance === null ? "Nyari posisi kamu…" : canCheckIn ? "Kamu udah di lokasi ✓" : `${distance >= 1000 ? (distance / 1000).toFixed(1) + " km" : distance + " m"} lagi`}
                </div>
              </div>
              <button
                onClick={() => doCheckIn(c, distance)}
                disabled={!canCheckIn || checkingIn === c.id}
                className={`shrink-0 text-xs font-medium px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors ${canCheckIn ? "bg-orange-600 hover:bg-orange-700 text-white" : "bg-slate-100 text-slate-400"}`}
              >
                <MapPin size={13} /> {checkingIn === c.id ? "Menyimpan…" : "Saya Sudah Sampai"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CheckinHistory() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [items, setItems] = useState(null);

  useEffect(() => {
    db.getCheckins(month).then(setItems).catch(() => setItems([]));
  }, [month]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white" />
      </div>
      {items === null ? (
        <div className="text-sm text-slate-400 py-8 text-center">Memuat…</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><History size={32} className="mx-auto text-slate-300 mb-3" />Belum ada check-in di bulan ini.</div>
      ) : (
        <div className="space-y-2">
          {items.map((ci) => (
            <div key={ci.id} className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{ci.lead_name}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{new Date(ci.checked_in_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <a href={`https://maps.google.com/?q=${ci.latitude},${ci.longitude}`} target="_blank" rel="noreferrer" className="shrink-0 text-xs text-orange-600 hover:underline flex items-center gap-1"><MapPin size={12} /> Lihat peta</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inp = "w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10";
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function dateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

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

function MonthCalendar({ leads, onEdit, month, setMonth }) {
  const year = month.getFullYear();
  const monthIdx = month.getMonth();
  const today = todayISO();

  const visitsByDate = useMemo(() => {
    const map = {};
    leads.forEach((c) => { if (c.visit_date) { (map[c.visit_date] ||= []).push(c); } });
    return map;
  }, [leads]);

  const firstWeekday = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = month.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const prevMonth = () => setMonth(new Date(year, monthIdx - 1, 1));
  const nextMonth = () => setMonth(new Date(year, monthIdx + 1, 1));
  const goToday = () => setMonth(new Date());

  return (
    <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-slate-700 capitalize w-36 text-center">{monthLabel}</span>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><ChevronRight size={16} /></button>
        </div>
        <button onClick={goToday} className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 text-slate-600">Hari ini</button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d) => <div key={d} className="text-center text-[10px] font-semibold text-slate-400 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="min-h-[74px] rounded-lg" />;
          const ds = dateStr(year, monthIdx, d);
          const isToday = ds === today;
          const dayVisits = visitsByDate[ds] || [];
          return (
            <div key={i} className={`min-h-[74px] rounded-lg border p-1 ${isToday ? "border-orange-400 bg-orange-50/50" : "border-slate-100"}`}>
              <div className={`text-[10px] font-medium mb-1 ${isToday ? "text-orange-600" : "text-slate-400"}`}>{d}</div>
              <div className="space-y-0.5">
                {dayVisits.slice(0, 2).map((c) => (
                  <button key={c.id} onClick={() => onEdit(c)} className="w-full text-left text-[9px] leading-tight bg-orange-100 text-orange-700 rounded px-1 py-0.5 truncate hover:bg-orange-200">
                    {c.name}
                  </button>
                ))}
                {dayVisits.length > 2 && <div className="text-[9px] text-slate-400 px-1">+{dayVisits.length - 2} lagi</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VisitView({ leads, onEdit, onChanged }) {
  const [add, setAdd] = useState(false);
  const [view, setView] = useState("table");
  const [month, setMonth] = useState(new Date());
  const visits = useMemo(() => leads.filter((c) => c.visit_date).sort((a, b) => (a.visit_date < b.visit_date ? -1 : 1)), [leads]);
  const upcoming = visits.filter((c) => c.visit_date >= todayISO());

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex bg-slate-100 rounded-xl p-1">
          <button onClick={() => setView("table")} className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${view === "table" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}><Table2 size={13} /> Tabel</button>
          <button onClick={() => setView("calendar")} className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 ${view === "calendar" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"}`}><Calendar size={13} /> Kalender</button>
        </div>
        <button onClick={() => setAdd(true)} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-2 rounded-xl font-medium shadow-sm shadow-orange-600/20"><Plus size={15} /> Tambah visit</button>
      </div>

      <TodayVisitsCard leads={leads} onChanged={onChanged} />

      {visits.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center text-sm text-slate-400"><CalendarCheck size={32} className="mx-auto text-slate-300 mb-3" />Belum ada visit. Klik "Tambah visit" atau isi "Visit date" di lead mana aja.</div>
      ) : view === "calendar" ? (
        <MonthCalendar leads={leads} onEdit={onEdit} month={month} setMonth={setMonth} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-3"><div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><CalendarCheck size={13} /> Akan datang</div><div className="font-mono font-bold text-2xl text-orange-600">{upcoming.length}</div></div>
            <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-3"><div className="text-xs text-slate-400 mb-1 flex items-center gap-1"><CalendarCheck size={13} /> Total terjadwal</div><div className="font-mono font-bold text-2xl text-slate-800">{visits.length}</div></div>
          </div>
          <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] overflow-x-auto">
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
      <div className="flex gap-2 mb-4 border-b border-slate-200 overflow-x-auto">
        <button onClick={() => setTab("visit")} className={`text-sm px-4 py-2.5 border-b-2 -mb-px flex items-center gap-1.5 shrink-0 ${tab === "visit" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          <CalendarCheck size={15} /> Visit <span className="text-xs text-slate-400">({visitCount})</span>
        </button>
        <button onClick={() => setTab("followup")} className={`text-sm px-4 py-2.5 border-b-2 -mb-px flex items-center gap-1.5 shrink-0 ${tab === "followup" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          <CalendarClock size={15} /> Follow-up <span className="text-xs text-slate-400">({followupCount})</span>
        </button>
        <button onClick={() => setTab("checkin")} className={`text-sm px-4 py-2.5 border-b-2 -mb-px flex items-center gap-1.5 shrink-0 ${tab === "checkin" ? "border-orange-600 text-orange-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
          <History size={15} /> Riwayat Check-in
        </button>
      </div>

      {tab === "visit" && <VisitView leads={leads} onEdit={onEdit} onChanged={onChanged} />}
      {tab === "followup" && <FollowupView leads={leads} onEdit={onEdit} onChanged={onChanged} />}
      {tab === "checkin" && <CheckinHistory />}
    </div>
  );
}
