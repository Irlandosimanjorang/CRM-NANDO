import { useEffect, useState } from "react";
import { Activity, MapPin, NotebookPen, ArrowRightLeft, UserPlus, AlertTriangle, Loader2, RefreshCw, Trash2, RotateCcw, PencilLine, CalendarPlus, CalendarX, Trophy, Sparkles, Mail } from "lucide-react";
import * as db from "../lib/db";
import TeamLeaderboard from "../components/TeamLeaderboard";

// Tab "Tim" (30 Sep 2026, permintaan Nando dari calon klien Enterprise yang
// minta "preview dashboard rekap aktivitas manager"). Khusus owner/manager
// org Enterprise. Isinya: rekap aktivitas per sales (kunjungan, notulen,
// lead baru, pindah tahap, deal) + tanda sales yang lagi gak aktif + timeline
// aktivitas terbaru, lalu Performa Tim (leaderboard) yang dipindah ke sini
// dari Dashboard. Semua dari data yang udah ada - gak manggil AI.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const INACTIVE_DAYS = 3;

// Batas rentang dihitung pake kalender WIB (Senin 00:00 / tanggal 1 00:00).
function rangeFor(key) {
  const now = new Date();
  const wib = new Date(now.getTime() + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear(), m = wib.getUTCMonth(), d = wib.getUTCDate();
  let start;
  if (key === "today") start = Date.UTC(y, m, d);
  else if (key === "month") start = Date.UTC(y, m, 1);
  else start = Date.UTC(y, m, d - ((wib.getUTCDay() + 6) % 7));
  return { from: new Date(start - WIB_OFFSET_MS), to: new Date(now.getTime() + 60000) };
}

const RANGES = [
  { key: "today", label: "Hari ini" },
  { key: "week", label: "Minggu ini" },
  { key: "month", label: "Bulan ini" },
];

const KIND = {
  visit: { icon: MapPin, color: "text-sky-600 bg-sky-50", verb: "check-in di" },
  note: { icon: NotebookPen, color: "text-violet-600 bg-violet-50", verb: "nulis catatan di" },
  stage: { icon: ArrowRightLeft, color: "text-amber-600 bg-amber-50", verb: "mindahin tahap" },
  lead: { icon: UserPlus, color: "text-emerald-600 bg-emerald-50", verb: "nambah lead" },
  lead_deleted: { icon: Trash2, color: "text-rose-600 bg-rose-50", verb: "menghapus lead" },
  lead_restored: { icon: RotateCcw, color: "text-teal-600 bg-teal-50", verb: "memulihkan lead" },
  lead_edited: { icon: PencilLine, color: "text-slate-600 bg-slate-100", verb: "mengubah data" },
  visit_scheduled: { icon: CalendarPlus, color: "text-sky-600 bg-sky-50", verb: "menjadwalkan visit ke" },
  visit_cancelled: { icon: CalendarX, color: "text-orange-600 bg-orange-50", verb: "membatalkan visit ke" },
  deal: { icon: Trophy, color: "text-emerald-700 bg-emerald-50", verb: "input deal" },
  email: { icon: Mail, color: "text-blue-600 bg-blue-50", verb: "kirim email ke" },
  ai_draft: { icon: Sparkles, color: "text-fuchsia-600 bg-fuchsia-50", verb: "bikin draft AI buat" },
  needs_summary: { icon: Sparkles, color: "text-fuchsia-600 bg-fuchsia-50", verb: "bikin Ringkasan Kebutuhan" },
};
// Detail yang ditampilin nempel di kalimat (dalam kurung) vs di baris kedua.
const INLINE_DETAIL = new Set(["stage", "visit_scheduled", "deal", "ai_draft", "lead_deleted"]);

// Contoh yang ditampilin (transparan + label "Contoh") kalau timeline kosong,
// biar manager langsung ngerti isinya nanti apa. Gak pernah disimpen ke DB.
const EMPTY_EXAMPLES = [
  { kind: "visit", who: "Budi", lead: "PT Mitra Logistik", when: "10:15" },
  { kind: "stage", who: "Sari", lead: "PT Bank Sejahtera", detail: "Hot Lead → Booking", when: "09:40" },
  { kind: "note", who: "Budi", lead: "PT Mitra Logistik", detail: "HRD butuh assessment 40 supervisor sebelum Q1, minta proposal minggu ini.", when: "Kemarin, 16:20" },
  { kind: "lead", who: "Andi", lead: "PT Arta Graha Konstruksi", when: "Kemarin, 11:05" },
];

const ROLE_LABEL ={ owner: "Owner", manager: "Manager", sales_rep: "Sales" };

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export default function Team({ leads, stages, dealTransactions, onOpenLead, canManage }) {
  const [range, setRange] = useState("week");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = () => {
    const { from, to } = rangeFor(range);
    setLoading(true);
    setErr("");
    setReloadKey((k) => k + 1);
    db.getTeamActivity(from, to)
      .then(setData)
      .catch((e) => setErr(e.message || "Gagal memuat rekap aktivitas"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [range]);

  const members = data?.members || [];
  const nameOf = Object.fromEntries(members.map((m) => [m.user_id, m.name]));
  const inactive = members.filter((m) => m.role === "sales_rep" && (m.last_activity_at == null || daysSince(m.last_activity_at) >= INACTIVE_DAYS));

  const COLS = [
    { key: "visits", label: "Kunjungan" },
    { key: "notes", label: "Notulen" },
    { key: "new_leads", label: "Lead baru" },
    { key: "stage_moves", label: "Pindah tahap" },
    { key: "deals", label: "Deal" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Team</h1>
          <p className="text-[12.5px] text-slate-500">Rekap aktivitas tiap sales dan performa team - khusus owner/manager.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)} className={`rounded-[10px] px-3 py-1.5 text-[12px] font-medium transition-colors ${range === r.key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-800 disabled:opacity-50" title="Muat ulang" aria-label="Muat ulang">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {err && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{err}</div>}

      {inactive.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="text-[12.5px] text-amber-900">
            <b>Perlu dicek:</b>{" "}
            {inactive.map((m, i) => (
              <span key={m.user_id}>
                {i > 0 && ", "}
                {m.name} ({m.last_activity_at ? `gak ada aktivitas ${daysSince(m.last_activity_at)} hari` : "belum pernah ada aktivitas"})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-50 text-orange-500"><Activity size={17} /></div>
          <div>
            <div className="text-sm font-bold text-slate-800">Rekap Aktivitas</div>
            <div className="text-[10.5px] text-slate-400">{RANGES.find((r) => r.key === range)?.label} · dihitung per orang yang ngerjain</div>
          </div>
        </div>

        {loading && !data ? (
          <div className="py-10 text-center"><Loader2 size={18} className="mx-auto animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-[12.5px]">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Anggota</th>
                  {COLS.map((c) => <th key={c.key} className="px-2 py-2 text-right font-semibold">{c.label}</th>)}
                  <th className="py-2 pl-3 text-right font-semibold">Aktivitas terakhir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.map((m) => {
                  const idle = daysSince(m.last_activity_at);
                  const warn = m.role === "sales_rep" && (idle == null || idle >= INACTIVE_DAYS);
                  return (
                    <tr key={m.user_id}>
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-800">{m.name}</div>
                        <div className="text-[10.5px] text-slate-400">{ROLE_LABEL[m.role] || m.role}</div>
                      </td>
                      {COLS.map((c) => (
                        <td key={c.key} className={`px-2 py-3 text-right tabular-nums ${m[c.key] > 0 ? "font-semibold text-slate-800" : "text-slate-300"}`}>{m[c.key]}</td>
                      ))}
                      <td className={`py-3 pl-3 text-right text-[11.5px] ${warn ? "font-semibold text-amber-600" : "text-slate-500"}`}>
                        {m.last_activity_at ? (idle === 0 ? "Hari ini" : `${idle} hari lalu`) : "Belum ada"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-3 text-[10.5px] text-slate-400">"Pindah tahap" & "Deal" dihitung dari perubahan tahap lead yang tercatat mulai 30 Sep 2026.</p>
          </div>
        )}
      </div>

      <TargetsCard members={members} reloadKey={reloadKey} />

      <PaymentsCard nameOf={nameOf} reloadKey={reloadKey} onOpenLead={(id) => { const l = (leads || []).find((x) => x.id === id); if (l) onOpenLead?.(l); }} />

      <ActivityTimeline nameOf={nameOf} reloadKey={reloadKey} />

      <TeamLeaderboard leads={leads} stages={stages} dealTransactions={dealTransactions} onOpenLead={onOpenLead} canManage={canManage} />
    </div>
  );
}

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
function dayBounds(isoDay) {
  const [y, m, d] = isoDay.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d) - WIB_OFFSET_MS);
  return { from, to: new Date(from.getTime() + 86400000) };
}

// Timeline 7 hari (30 Sep 2026, permintaan Nando): strip 7 tanggal terakhir
// (kalender WIB) + jumlah aktivitas tiap hari, klik tanggal -> daftar semua
// aktivitas tim di hari itu.
function ActivityTimeline({ nameOf, reloadKey }) {
  const [days, setDays] = useState([]);
  const [selected, setSelected] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.getTeamActivityDays(7)
      .then((d) => { setDays(d); setSelected((cur) => (cur && d.some((x) => x.day === cur) ? cur : d[d.length - 1]?.day || null)); })
      .catch(() => { setDays([]); setLoading(false); });
  }, [reloadKey]);

  useEffect(() => {
    if (!selected) return;
    const { from, to } = dayBounds(selected);
    setLoading(true);
    db.getTeamFeed(from, to, 200).then(setFeed).catch(() => setFeed([])).finally(() => setLoading(false));
  }, [selected, reloadKey]);

  const todayIso = new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
  const sel = days.find((d) => d.day === selected);
  const selLabel = selected ? new Date(selected + "T00:00:00Z").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }) : "";
  const showExamples = !loading && feed.length === 0 && days.every((d) => d.count === 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-bold text-slate-800">Aktivitas 7 Hari Terakhir</div>
        <div className="text-[10.5px] text-slate-400">Klik tanggal buat liat aktivitas di hari itu</div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const dt = new Date(d.day + "T00:00:00Z");
          const active = d.day === selected;
          return (
            <button
              key={d.day}
              onClick={() => setSelected(d.day)}
              className={`flex flex-col items-center rounded-2xl border px-1 py-2 transition-colors ${active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-orange-300"}`}
            >
              <span className={`text-[10px] font-medium ${active ? "text-slate-300" : "text-slate-400"}`}>{d.day === todayIso ? "Hari ini" : HARI[dt.getUTCDay()]}</span>
              <span className="text-[15px] font-bold leading-tight">{dt.getUTCDate()}</span>
              <span className={`mt-1 min-w-[22px] rounded-full px-1.5 text-[10px] font-semibold tabular-nums ${d.count > 0 ? (active ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700") : (active ? "bg-white/15 text-slate-300" : "bg-slate-100 text-slate-400")}`}>{d.count}</span>
            </button>
          );
        })}
      </div>

      <div className="mb-3 mt-5 text-[12px] font-semibold text-slate-600">
        {selLabel}{sel ? ` · ${sel.count} aktivitas` : ""}
      </div>

      {loading ? (
        <div className="py-6 text-center"><Loader2 size={16} className="mx-auto animate-spin text-slate-400" /></div>
      ) : feed.length === 0 ? (
        showExamples ? (
          <div>
            <p className="text-[12px] text-slate-500">
              Belum ada aktivitas. Nanti di sini muncul otomatis setiap anggota team check-in GPS, nulis catatan, nambah/edit/hapus lead, jadwalin visit, mindahin tahap, input deal, atau kirim email - kayak contoh di bawah.
            </p>
            <ul className="mt-4 space-y-3 opacity-50" aria-label="Contoh tampilan">
              {EMPTY_EXAMPLES.map((e, i) => {
                const k = KIND[e.kind];
                const I = k.icon;
                return (
                  <li key={i} className="flex gap-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${k.color}`}><I size={14} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] text-slate-700">
                        <span className="mr-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-500">Contoh</span>
                        <b className="text-slate-900">{e.who}</b> {k.verb} <b className="text-slate-900">{e.lead}</b>
                        {e.detail && e.kind === "stage" && <span className="text-slate-500"> ({e.detail})</span>}
                      </div>
                      {e.kind === "note" && <div className="mt-0.5 text-[11.5px] text-slate-500">{e.detail}</div>}
                      <div className="mt-0.5 text-[10.5px] text-slate-400">{e.when}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="py-6 text-center text-[12px] text-slate-400">Gak ada aktivitas di tanggal ini.</div>
        )
      ) : (
        <ul className="space-y-3">
          {feed.map((e, i) => {
            const k = KIND[e.kind] || KIND.note;
            const I = k.icon;
            return (
              <li key={i} className="flex gap-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${k.color}`}><I size={14} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] text-slate-700">
                    <b className="text-slate-900">{nameOf[e.user_id] || "Anggota"}</b> {k.verb} <b className="text-slate-900">{e.lead_name || "-"}</b>
                    {INLINE_DETAIL.has(e.kind) && e.detail && <span className="text-slate-500"> ({e.detail})</span>}
                  </div>
                  {!INLINE_DETAIL.has(e.kind) && e.detail && <div className="mt-0.5 line-clamp-2 text-[11.5px] text-slate-500">{e.detail}</div>}
                  <div className="mt-0.5 text-[10.5px] text-slate-400">{new Date(e.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const fmtRp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const fmtJt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e9) return "Rp" + (v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (v >= 1e6) return "Rp" + (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
  return fmtRp(v);
};
function monthStartIso(offset = 0) {
  const wib = new Date(Date.now() + WIB_OFFSET_MS);
  const d = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth() + offset, 1));
  return d.toISOString().slice(0, 10);
}

// Target bulanan per sales + pencapaian (deal masuk bulan itu) + forecast
// (nilai proyek lead aktif x peluang tahap). Target diatur owner/manager.
function TargetsCard({ members, reloadKey }) {
  const [month, setMonth] = useState(monthStartIso(0));
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => db.getTeamTargets(month).then(setRows).catch(() => setRows([]));
  useEffect(() => { setRows(null); load(); }, [month, reloadKey]);

  const save = async (uid) => {
    setBusy(true);
    try {
      await db.setSalesTarget(uid, month, Number(input.replace(/[^\d]/g, "")) || 0);
      setEditing(null);
      await load();
    } catch (e) { alert("Gagal simpan target: " + e.message); } finally { setBusy(false); }
  };

  const byId = Object.fromEntries((rows || []).map((r) => [r.user_id, r]));
  const monthLabel = new Date(month + "T00:00:00Z").toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  const noValue = (rows || []).reduce((s, r) => s + (r.open_without_value || 0), 0);

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-slate-800">Target & Forecast</div>
          <div className="text-[10.5px] text-slate-400">Pencapaian = nilai deal yang masuk bulan ini · Forecast = nilai proyek lead aktif × peluang tahapnya</div>
        </div>
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
          {[[0, "Bulan ini"], [1, "Bulan depan"]].map(([o, l]) => (
            <button key={o} onClick={() => setMonth(monthStartIso(o))} className={`rounded-[10px] px-3 py-1.5 text-[12px] font-medium ${month === monthStartIso(o) ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-800"}`}>{l}</button>
          ))}
        </div>
      </div>
      {rows === null ? (
        <div className="py-6 text-center"><Loader2 size={16} className="mx-auto animate-spin text-slate-400" /></div>
      ) : (
        <div className="space-y-4">
          {members.map((m) => {
            const r = byId[m.user_id] || { target: 0, achieved: 0, forecast: 0, pipeline: 0 };
            const pct = r.target > 0 ? Math.min(100, Math.round((r.achieved / r.target) * 100)) : 0;
            const projected = r.target > 0 ? Math.min(100, Math.round(((r.achieved + r.forecast) / r.target) * 100)) : 0;
            return (
              <div key={m.user_id}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[13px] font-semibold text-slate-800">{m.name} <span className="text-[10.5px] font-normal text-slate-400">{ROLE_LABEL[m.role] || m.role}</span></div>
                  {editing === m.user_id ? (
                    <div className="flex items-center gap-1.5">
                      <input autoFocus inputMode="numeric" className="w-36 rounded-lg border border-slate-300 px-2 py-1 text-[12px]" placeholder="Target (Rp)" value={input}
                        onChange={(e) => setInput(e.target.value.replace(/[^\d]/g, "") ? Number(e.target.value.replace(/[^\d]/g, "")).toLocaleString("id-ID") : "")}
                        onKeyDown={(e) => { if (e.key === "Enter") save(m.user_id); if (e.key === "Escape") setEditing(null); }} />
                      <button disabled={busy} onClick={() => save(m.user_id)} className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white disabled:opacity-50">Simpan</button>
                      <button onClick={() => setEditing(null)} className="text-[11px] text-slate-400">Batal</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditing(m.user_id); setInput(r.target ? Number(r.target).toLocaleString("id-ID") : ""); }} className="text-[12px] tabular-nums text-slate-600 hover:text-orange-600">
                      <b className="text-slate-900">{fmtJt(r.achieved)}</b> / {r.target > 0 ? fmtJt(r.target) : <span className="underline decoration-dotted">set target</span>}
                    </button>
                  )}
                </div>
                <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100" title={`Tercapai ${pct}% · dengan forecast ${projected}%`}>
                  <div className="absolute inset-y-0 left-0 rounded-full bg-orange-200" style={{ width: `${projected}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-[10.5px] text-slate-400 tabular-nums">
                  {r.target > 0 && <span>{pct}% tercapai</span>}
                  <span>Forecast {fmtJt(r.forecast)}</span>
                  <span>Pipeline aktif {fmtJt(r.pipeline)}</span>
                </div>
              </div>
            );
          })}
          <p className="text-[10.5px] text-slate-400">
            Target {monthLabel}. Klik angka target buat ubah.{noValue > 0 && ` ${noValue} lead aktif belum punya nilai proyek - isi di detail lead biar forecast-nya akurat.`}
          </p>
        </div>
      )}
    </div>
  );
}

// Ringkasan kontrak & pembayaran semua lead + termin yang jatuh tempo 14
// hari ke depan / udah telat.
function PaymentsCard({ nameOf, reloadKey, onOpenLead }) {
  const [p, setP] = useState(null);
  useEffect(() => { db.getTeamPayments().then(setP).catch(() => setP(null)); }, [reloadKey]);
  if (!p) return null;
  const outstanding = Math.max(0, p.invoiced - p.paid);
  const tiles = [
    { label: "Nilai kontrak (Booking)", value: p.contract, cls: "text-slate-900" },
    { label: "Sudah ditagih (Revenue)", value: p.invoiced, cls: "text-sky-700" },
    { label: "Sudah dibayar (Cash In)", value: p.paid, cls: "text-emerald-700" },
    { label: "Piutang telat", value: p.overdue_total, cls: p.overdue_total > 0 ? "text-rose-600" : "text-slate-400" },
  ];
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <div className="text-sm font-bold text-slate-800">Kontrak & Pembayaran</div>
        <div className="text-[10.5px] text-slate-400">Dari termin yang dicatat di tiap lead · tagihan yang belum dibayar: {fmtJt(outstanding)}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl bg-slate-50 px-3.5 py-3">
            <div className={`text-[15px] font-bold tabular-nums ${t.cls}`}>{fmtJt(t.value)}</div>
            <div className="mt-0.5 text-[10.5px] text-slate-500">{t.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-5 text-[12px] font-semibold text-slate-600">Jatuh tempo 14 hari ke depan & yang telat</div>
      {p.items.length === 0 ? (
        <p className="mt-2 text-[12px] text-slate-400">{p.contract > 0 ? "Gak ada termin yang jatuh tempo dalam 14 hari." : "Belum ada termin. Catat di detail lead (bagian Kontrak & Termin Pembayaran)."}</p>
      ) : (
        <ul className="mt-2 divide-y divide-slate-100">
          {p.items.map((it) => {
            const late = it.days_left < 0;
            return (
              <li key={it.id}>
                <button onClick={() => onOpenLead(it.lead_id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-slate-50/60">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-semibold text-slate-800">{it.lead_name}</div>
                    <div className="text-[11px] text-slate-500">{it.label || "Termin"} · {nameOf[it.user_id] || "-"}{it.invoiced_at ? " · sudah ditagih" : " · belum ditagih"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12.5px] font-bold tabular-nums text-slate-800">{fmtRp(it.amount)}</div>
                    <div className={`text-[10.5px] font-semibold ${late ? "text-rose-600" : it.days_left <= 3 ? "text-amber-600" : "text-slate-400"}`}>
                      {late ? `Telat ${-it.days_left} hari` : it.days_left === 0 ? "Hari ini" : `${it.days_left} hari lagi`}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
