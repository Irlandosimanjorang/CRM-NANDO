import { useEffect, useState } from "react";
import { Activity, MapPin, NotebookPen, ArrowRightLeft, UserPlus, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
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
};

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

function fmtWhen(iso) {
  const d = new Date(iso);
  const sameDay = new Date(d.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10) === new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
  return sameDay
    ? d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export default function Team({ leads, stages, dealTransactions, onOpenLead, canManage }) {
  const [range, setRange] = useState("week");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = () => {
    const { from, to } = rangeFor(range);
    setLoading(true);
    setErr("");
    db.getTeamActivity(from, to)
      .then(setData)
      .catch((e) => setErr(e.message || "Gagal memuat rekap aktivitas"))
      .finally(() => setLoading(false));
  };
  useEffect(load, [range]);

  const members = data?.members || [];
  const nameOf = Object.fromEntries(members.map((m) => [m.user_id, m.name]));
  const inactive = members.filter((m) => m.role === "sales_rep" && (m.last_activity_at == null || daysSince(m.last_activity_at) >= INACTIVE_DAYS));
  const totals = members.reduce((t, m) => ({
    visits: t.visits + m.visits, notes: t.notes + m.notes, new_leads: t.new_leads + m.new_leads, stage_moves: t.stage_moves + m.stage_moves, deals: t.deals + m.deals,
  }), { visits: 0, notes: 0, new_leads: 0, stage_moves: 0, deals: 0 });

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
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Tim</h1>
          <p className="text-[12.5px] text-slate-500">Rekap aktivitas tiap sales dan performa tim - khusus owner/manager.</p>
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
                {members.length > 1 && (
                  <tr className="bg-slate-50/70">
                    <td className="py-2.5 pr-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total tim</td>
                    {COLS.map((c) => <td key={c.key} className="px-2 py-2.5 text-right font-bold tabular-nums text-slate-700">{totals[c.key]}</td>)}
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
            <p className="mt-3 text-[10.5px] text-slate-400">"Pindah tahap" & "Deal" dihitung dari perubahan tahap lead yang tercatat mulai 30 Sep 2026.</p>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <div className="mb-4 text-sm font-bold text-slate-800">Aktivitas Terbaru</div>
        {(data?.feed || []).length === 0 ? (
          loading ? (
            <div className="py-6 text-center text-[12px] text-slate-400">Memuat…</div>
          ) : (
            <div>
              <p className="text-[12px] text-slate-500">
                Belum ada aktivitas di rentang ini. Nanti di sini muncul otomatis setiap anggota tim check-in GPS, nulis catatan/notulen, nambah lead, atau mindahin tahap lead - kayak contoh di bawah.
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
          )
        ) : (
          <ul className="space-y-3">
            {data.feed.map((e, i) => {
              const k = KIND[e.kind] || KIND.note;
              const I = k.icon;
              return (
                <li key={i} className="flex gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${k.color}`}><I size={14} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] text-slate-700">
                      <b className="text-slate-900">{nameOf[e.user_id] || "Anggota"}</b> {k.verb} <b className="text-slate-900">{e.lead_name || "-"}</b>
                      {e.kind === "stage" && e.detail && <span className="text-slate-500"> ({e.detail})</span>}
                    </div>
                    {e.kind === "note" && e.detail && <div className="mt-0.5 line-clamp-2 text-[11.5px] text-slate-500">{e.detail}</div>}
                    <div className="mt-0.5 text-[10.5px] text-slate-400">{fmtWhen(e.at)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <TeamLeaderboard leads={leads} stages={stages} dealTransactions={dealTransactions} onOpenLead={onOpenLead} canManage={canManage} />
    </div>
  );
}
