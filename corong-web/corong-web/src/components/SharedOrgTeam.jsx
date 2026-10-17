import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import * as db from "../lib/db";
import TeamLeaderboard from "./TeamLeaderboard";

// Tombol "Tim <nama org>" di tab Team untuk org yang diberi izin berbagi data (sister company).
// Tampilannya read-only: pakai komponen yang sama dengan tab Team, tapi datanya dari org pemberi.
const fmtRp = (n) => "Rp" + Math.round(Number(n) || 0).toLocaleString("id-ID");

export default function SharedOrgTeam() {
  const [grants, setGrants] = useState([]);
  const [openOrg, setOpenOrg] = useState(null);

  useEffect(() => {
    db.getIncomingShareGrants().then(setGrants).catch(() => setGrants([]));
  }, []);

  if (grants.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {grants.map((g) => (
          <button
            key={g.grantor_org_id}
            type="button"
            onClick={() => setOpenOrg(g)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-slate-800"
          >
            Tim {g.grantor_name}
            <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">read-only</span>
          </button>
        ))}
      </div>
      {openOrg && <SharedOrgModal org={openOrg} onClose={() => setOpenOrg(null)} />}
    </>
  );
}

function SharedOrgModal({ org, onClose }) {
  const [snap, setSnap] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    db.getSharedOrgSnapshot(org.grantor_org_id)
      .then((d) => alive && setSnap(d))
      .catch((e) => alive && setErr(e.message || "Gagal memuat data tim"));
    return () => { alive = false; };
  }, [org.grantor_org_id]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const data = useMemo(() => {
    if (!snap) return null;
    const stages = snap.stages || [];
    const wonKeys = stages.filter((s) => s.type === "won").map((s) => s.key);
    const leads = (snap.leads || []).filter((l) => !l.deleted_at);
    const won = leads.filter((l) => wonKeys.includes(l.stage_key));
    const deals = snap.deal_transactions || [];
    const projectDeal = !!snap.org?.project_deal;
    const revenue = projectDeal
      ? won.reduce((n, l) => n + (Number(l.deal_value) || 0), 0)
      : deals.reduce((n, t) => n + (Number(t.deal_value) || 0), 0);
    const thisMonth = new Date().toISOString().slice(0, 7);
    const adSpend = (snap.ad_expenses || []).filter((e) => String(e.day || "").startsWith(thisMonth)).reduce((n, e) => n + (Number(e.amount) || 0), 0);
    const members = (snap.members || []).map((m) => ({ user_id: m.user_id, role: m.role, display_name: m.name }));
    return { stages, leads, won, revenue, adSpend, members, projectDeal, deals, checkins: snap.visit_checkins || [] };
  }, [snap]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onClick={onClose}>
      <div className="w-full max-w-5xl rounded-panel bg-slate-50 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold tracking-[-0.02em] text-ink">Tim {org.grantor_name}</h2>
            <p className="mt-0.5 text-[11.5px] text-slate-500">Tampilan read-only. Data dibagikan oleh pemilik organisasi.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"><X size={18} /></button>
        </div>

        {err && <p className="rounded-inner bg-rose-50 p-3 text-[12.5px] text-rose-700">{err}</p>}
        {!err && !data && <p className="py-10 text-center text-[12.5px] text-slate-500">Memuat data tim…</p>}

        {data && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [data.leads.length, "Lead aktif"],
                [data.won.length, "Lead menang"],
                [fmtRp(data.revenue), data.projectDeal ? "Omzet (nilai proyek menang)" : "Omzet (transaksi deal)"],
                [fmtRp(data.adSpend), "Iklan bulan ini"],
              ].map(([v, l]) => (
                <div key={l} className="rounded-panel border border-slate-200/80 bg-white p-4">
                  <div className="font-display text-[20px] font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">{v}</div>
                  <div className="mt-1.5 text-[11px] text-slate-500">{l}</div>
                </div>
              ))}
            </div>

            <TeamLeaderboard
              leads={data.leads}
              stages={data.stages}
              dealTransactions={data.deals}
              onOpenLead={() => {}}
              canManage={false}
              projectDeal={data.projectDeal}
              externalMembers={data.members}
              externalCheckins={data.checkins}
            />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
