import { useEffect, useState } from "react";
import * as db from "../lib/db";

// Kartu "Bagikan ke organisasi terhubung" di tab Team, khusus owner.
// Saat diaktifkan, manager organisasi tujuan bisa membaca seluruh pekerjaan tim ini (read-only).
// Default mati. Hanya owner org ini yang bisa mengubah (dibatasi juga oleh RLS tabel share_grants).
export default function ShareGrantCard() {
  const [targets, setTargets] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");

  const load = () => {
    setErr("");
    db.getShareGrantTargets().then(setTargets).catch((e) => { setTargets([]); setErr(e.message || "Gagal memuat izin berbagi"); });
  };
  useEffect(load, []);

  const toggle = async (t) => {
    const next = !t.enabled;
    if (next && !window.confirm(`Izinkan ${t.grantee_name} melihat seluruh pekerjaan tim ini? Data pribadi tim akan ikut terlihat (read-only).`)) return;
    setBusy(t.grantee_org_id); setErr("");
    try {
      await db.setShareGrant(t.grantee_org_id, next);
      setTargets((cur) => cur.map((x) => (x.grantee_org_id === t.grantee_org_id ? { ...x, enabled: next } : x)));
    } catch (e) {
      setErr(e.message || "Gagal mengubah izin");
    } finally { setBusy(null); }
  };

  if (targets === null || targets.length === 0) return null;

  return (
    <section className="rounded-panel border border-slate-200/80 bg-white p-5">
      <h2 className="text-[15px] font-bold tracking-[-0.02em] text-ink">Bagikan ke organisasi terhubung</h2>
      <p className="mt-0.5 text-[11.5px] text-slate-500">Manager organisasi tujuan bisa melihat seluruh pekerjaan tim ini secara read-only. Mati secara default.</p>
      <div className="mt-3 divide-y divide-slate-100">
        {targets.map((t) => (
          <div key={t.grantee_org_id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-ink">{t.grantee_name}</div>
              <div className="text-[11px] text-slate-500">{t.enabled ? "Aktif: manager bisa melihat tim ini" : "Mati"}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={t.enabled}
              disabled={busy === t.grantee_org_id}
              onClick={() => toggle(t)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${t.enabled ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${t.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
      </div>
      {err && <p className="mt-2 text-[12px] text-rose-600">{err}</p>}
    </section>
  );
}
