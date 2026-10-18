import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import * as db from "../lib/db";
import TeamLeaderboard from "./TeamLeaderboard";

// Tombol "Tim <nama org>" di tab Team untuk org yang diberi izin berbagi data (sister company).
// Klik tombol membuka halaman sendiri (SharedOrgPage) di dalam tab Team, bukan pop-up.
const fmtRp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");
const fmtJt = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e9) return "Rp" + (v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M";
  if (v >= 1e6) return "Rp" + (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
  return fmtRp(v);
};
const INACTIVE_DAYS = 3; // sama dengan tab Team
const wibDate = (ts) => new Date(ts).toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
const daysSince = (ts) => Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);

export default function SharedOrgTeam({ onOpen }) {
  const [grants, setGrants] = useState([]);

  useEffect(() => {
    db.getIncomingShareGrants().then(setGrants).catch(() => setGrants([]));
  }, []);

  if (grants.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {grants.map((g) => (
        <button
          key={g.grantor_org_id}
          type="button"
          onClick={() => onOpen(g)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
        >
          Tim {g.grantor_name}
          <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">read-only</span>
        </button>
      ))}
    </div>
  );
}

// Halaman tim organisasi lain (read-only). Isinya setara tab Team: denyut, rekap aktivitas, target, dan leaderboard.
// Komisi tidak ditampilkan karena tarif komisi adalah data internal owner.
export function SharedOrgPage({ org, onBack }) {
  const [snap, setSnap] = useState(null);
  const [err, setErr] = useState("");
  const [diperbarui, setDiperbarui] = useState(null);
  const [memuat, setMemuat] = useState(false);

  // Memuat ulang data tim org pemberi. Dipanggil saat halaman dibuka, tiap 30 detik, dan lewat tombol refresh.
  const muatUlang = useCallback(() => {
    setMemuat(true);
    db.getSharedOrgSnapshot(org.grantor_org_id)
      .then((d) => { setSnap(d); setErr(""); setDiperbarui(new Date()); })
      .catch((e) => setErr(e.message || "Gagal memuat data tim"))
      .finally(() => setMemuat(false));
  }, [org.grantor_org_id]);

  useEffect(() => {
    muatUlang();
    const id = setInterval(muatUlang, 30000);
    return () => clearInterval(id);
  }, [muatUlang]);

  const view = useMemo(() => {
    if (!snap) return null;
    const bulan = wibDate(Date.now()).slice(0, 7);
    const stages = snap.stages || [];
    const wonKeys = new Set(stages.filter((s) => s.type === "won").map((s) => s.key));
    const lostKeys = new Set(stages.filter((s) => s.type === "lost").map((s) => s.key));
    const leads = (snap.leads || []).filter((l) => !l.deleted_at);
    const picOf = (l) => l.assigned_to || l.user_id;
    const won = leads.filter((l) => wonKeys.has(l.stage_key));
    const members = (snap.members || []).map((m) => ({ user_id: m.user_id, role: m.role, name: m.name }));
    const visits = snap.visit_checkins || [];
    const notes = snap.progress_notes || [];
    const stageChanges = snap.lead_stage_changes || [];
    const targets = snap.sales_targets || [];

    // Aktivitas per anggota: kunjungan, catatan, pindah tahap, lead baru (dipakai untuk "terakhir aktif" dan rekap).
    const act = (uid) => {
      const v = visits.filter((x) => x.user_id === uid);
      const n = notes.filter((x) => x.user_id === uid);
      const s = stageChanges.filter((x) => x.changed_by === uid);
      const lb = leads.filter((l) => picOf(l) === uid);
      return { v, n, s, lb };
    };
    const lastTs = (uid) => {
      const { v, n, s, lb } = act(uid);
      const all = [...v.map((x) => x.checked_in_at), ...n.map((x) => x.created_at), ...s.map((x) => x.changed_at), ...lb.map((x) => x.created_at)].filter(Boolean);
      return all.length ? all.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)) : null;
    };

    const rekap = members.map((m) => {
      const { v, n, s, lb } = act(m.user_id);
      const bulanIniWon = won.filter((l) => picOf(l) === m.user_id && String(l.deal_date || "").startsWith(bulan));
      const omzet = bulanIniWon.reduce((t, l) => t + (Number(l.deal_value) || 0), 0);
      const target = Number(targets.find((t) => t.user_id === m.user_id && String(t.month || "").startsWith(bulan))?.amount) || 0;
      return {
        ...m,
        kunjungan: v.filter((x) => wibDate(x.checked_in_at).startsWith(bulan)).length,
        diupdate: new Set(n.filter((x) => wibDate(x.created_at).startsWith(bulan)).map((x) => x.lead_id)).size,
        leadBaru: lb.filter((x) => wibDate(x.created_at).startsWith(bulan)).length,
        pindah: s.filter((x) => wibDate(x.changed_at).startsWith(bulan)).length,
        deal: bulanIniWon.length,
        omzet,
        target,
        last: lastTs(m.user_id),
      };
    });

    // Denyut: deal bulan ini, anggota aktif 7 hari, grafik aktivitas 7 hari.
    const dealBulanIni = won.filter((l) => String(l.deal_date || "").startsWith(bulan)).reduce((t, l) => t + (Number(l.deal_value) || 0), 0);
    const aktif7 = rekap.filter((r) => r.last && daysSince(r.last) < 7).length;
    const hari = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      return wibDate(d);
    });
    const hitung = (tgl) => visits.filter((x) => wibDate(x.checked_in_at) === tgl).length + notes.filter((x) => wibDate(x.created_at) === tgl).length + stageChanges.filter((x) => wibDate(x.changed_at) === tgl).length;
    const grafik = hari.map((tgl) => ({ label: new Date(`${tgl}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short" }), aktivitas: hitung(tgl) }));
    const perhatian = rekap.filter((r) => r.role === "sales_rep" && (!r.last || daysSince(r.last) >= INACTIVE_DAYS));

    const targetTotal = rekap.reduce((t, r) => t + r.target, 0);
    const omzetTotal = rekap.reduce((t, r) => t + r.omzet, 0);
    return { stages, leads, won, members, rekap, dealBulanIni, aktif7, grafik, perhatian, targetTotal, omzetTotal, bulan, checkins: visits };
  }, [snap]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-1 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
          >
            <ChevronLeft size={14} /> Team
          </button>
          <div>
            <h1 className="font-display text-[22px] font-bold tracking-[-0.03em] text-ink">Tim {org.grantor_name}</h1>
            <p className="mt-0.5 text-[12px] text-slate-500">Tampilan read-only. Data dibagikan oleh pemilik organisasi.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {diperbarui && <span className="text-[11px] tabular-nums text-slate-500">Diperbarui {diperbarui.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>}
          <button
            type="button"
            onClick={muatUlang}
            disabled={memuat}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
          >
            {memuat ? "Memuat…" : "Refresh"}
          </button>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">read-only</span>
        </div>
      </div>

      {err && <p className="rounded-inner bg-rose-50 p-3 text-[12.5px] text-rose-700">{err}</p>}
      {!err && !view && <p className="py-10 text-center text-[12.5px] text-slate-500">Memuat data tim…</p>}

      {view && (
        <>
          {/* Denyut team */}
          <section className="overflow-hidden rounded-2xl bg-[#0f172a] p-5 text-white shadow-lg shadow-slate-900/10 sm:p-6">
            <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
              <div className="min-w-0">
                <h2 className="text-[15px] font-bold tracking-[-0.02em]">Denyut team</h2>
                <p className="mt-0.5 text-[11.5px] text-slate-400">Bulan ini</p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-display text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums">{fmtJt(view.dealBulanIni)}</div>
                    <div className="mt-1.5 text-[11px] text-slate-400">Deal masuk</div>
                  </div>
                  <div>
                    <div className="font-display text-[26px] font-bold leading-none tracking-[-0.04em] tabular-nums">{view.aktif7}<span className="text-slate-500">/{view.rekap.length}</span></div>
                    <div className="mt-1.5 text-[11px] text-slate-400">Anggota aktif 7 hari</div>
                  </div>
                </div>
                <div className="mt-5 h-32 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={view.grafik} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="sharedDenyut" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis hide allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #1e293b", background: "#0f172a", fontSize: 12 }} itemStyle={{ color: "#fdba74" }} labelStyle={{ color: "#fff" }} />
                      <Area type="monotone" dataKey="aktivitas" name="Aktivitas" stroke="#f97316" strokeWidth={2} fill="url(#sharedDenyut)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 p-4">
                <p className="text-[13px] font-semibold">Perlu perhatian ({view.perhatian.length})</p>
                <div className="mt-3 space-y-2">
                  {view.perhatian.length === 0 && <p className="text-[12px] text-slate-400">Semua anggota aktif.</p>}
                  {view.perhatian.map((r) => (
                    <div key={r.user_id} className="rounded-lg bg-amber-400/10 px-3 py-2 text-[12px] text-amber-200">
                      <span className="font-semibold">{r.name}</span>{" "}
                      {r.last ? `tidak ada aktivitas ${daysSince(r.last)} hari` : "belum pernah ada aktivitas"}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Rekap aktivitas */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-bold tracking-[-0.02em] text-ink">Rekap aktivitas</h2>
            <p className="mt-0.5 text-[11.5px] text-slate-500">Bulan ini</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] text-[12.5px]">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[11px] font-semibold text-slate-500">
                    <th className="py-2 font-medium">Anggota</th>
                    <th className="py-2 text-right font-medium">Kunjungan</th>
                    <th className="py-2 text-right font-medium">Lead diupdate</th>
                    <th className="py-2 text-right font-medium">Lead baru</th>
                    <th className="py-2 text-right font-medium">Pindah tahap</th>
                    <th className="py-2 text-right font-medium">Deal</th>
                  </tr>
                </thead>
                <tbody>
                  {view.rekap.map((r) => (
                    <tr key={r.user_id} className="border-b border-slate-100">
                      <td className="py-2.5 font-semibold text-ink">{r.name}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.kunjungan}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.diupdate}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.leadBaru}</td>
                      <td className="py-2.5 text-right tabular-nums">{r.pindah}</td>
                      <td className="py-2.5 text-right font-semibold tabular-nums text-ink">{r.deal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Target & forecast */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold tracking-[-0.02em] text-ink">Target & capaian</h2>
                <p className="mt-0.5 text-[11.5px] text-slate-500">Bulan ini</p>
              </div>
              <p className="text-[12.5px] tabular-nums text-slate-600">
                <span className="font-semibold text-ink">{fmtJt(view.omzetTotal)}</span> dari {view.targetTotal > 0 ? fmtJt(view.targetTotal) : "target belum diisi"}
              </p>
            </div>
            <div className="mt-4 space-y-4">
              {view.rekap.map((r) => {
                const pct = r.target > 0 ? Math.min(100, Math.round((r.omzet / r.target) * 100)) : 0;
                return (
                  <div key={r.user_id}>
                    <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="font-semibold text-ink">{r.name}</span>
                      <span className="tabular-nums text-slate-600">
                        {fmtJt(r.omzet)}{r.target > 0 ? ` / ${fmtJt(r.target)} (${pct}%)` : " · target belum diisi"}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <TeamLeaderboard
            leads={view.leads}
            stages={view.stages}
            onOpenLead={() => {}}
            canManage={false}
            externalMembers={view.members}
            externalCheckins={view.checkins}
          />
        </>
      )}
    </div>
  );
}
