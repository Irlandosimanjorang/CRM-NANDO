import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import * as db from "../lib/db";
import TeamLeaderboard from "./TeamLeaderboard";

// Tombol "Tim <nama org>" di tab Team untuk org yang diberi izin berbagi data (sister company).
// Klik tombol membuka halaman sendiri (SharedOrgPage) di dalam tab Team, bukan pop-up.
const fmtRp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");

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

// Halaman tim organisasi lain (read-only). Tampil menggantikan isi tab Team, dengan tombol kembali.
export function SharedOrgPage({ org, onBack }) {
  const [snap, setSnap] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    db.getSharedOrgSnapshot(org.grantor_org_id)
      .then((d) => { if (alive) setSnap(d); })
      .catch((e) => { if (alive) setErr(e.message || "Gagal memuat data tim"); });
    return () => { alive = false; };
  }, [org.grantor_org_id]);

  const data = useMemo(() => {
    if (!snap) return null;
    const stages = snap.stages || [];
    const wonKeys = stages.filter((s) => s.type === "won").map((s) => s.key);
    const leads = (snap.leads || []).filter((l) => !l.deleted_at);
    const won = leads.filter((l) => wonKeys.includes(l.stage_key));
    // Satu aturan deal di semua tab: omzet = nilai lead yang sudah menang.
    const revenue = won.reduce((n, l) => n + (Number(l.deal_value) || 0), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const adSpend = (snap.ad_expenses || []).filter((e) => String(e.day || "").startsWith(thisMonth)).reduce((n, e) => n + (Number(e.amount) || 0), 0);
    const members = (snap.members || []).map((m) => ({ user_id: m.user_id, role: m.role, display_name: m.name }));
    return { stages, leads, won, revenue, adSpend, members, checkins: snap.visit_checkins || [] };
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
        <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">read-only</span>
      </div>

      {err && <p className="rounded-inner bg-rose-50 p-3 text-[12.5px] text-rose-700">{err}</p>}
      {!err && !data && <p className="py-10 text-center text-[12.5px] text-slate-500">Memuat data tim…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              [data.leads.length, "Lead aktif"],
              [data.won.length, "Deal menang"],
              [fmtRp(data.revenue), "Omzet (nilai deal menang)"],
              [fmtRp(data.adSpend), "Iklan bulan ini"],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="font-display text-[20px] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">{v}</div>
                <div className="mt-1.5 text-[11px] text-slate-500">{l}</div>
              </div>
            ))}
          </div>

          <TeamLeaderboard
            leads={data.leads}
            stages={data.stages}
            onOpenLead={() => {}}
            canManage={false}
            externalMembers={data.members}
            externalCheckins={data.checkins}
          />
        </>
      )}
    </div>
  );
}
