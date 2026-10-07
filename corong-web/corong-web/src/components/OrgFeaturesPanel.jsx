import { useEffect, useMemo, useState } from "react";
import * as db from "../lib/db";
import { ORG_FEATURES } from "../lib/orgFeatures";
import { field } from "./EnterpriseInvoicePanel";

// Saklar fitur per organisasi (8 Okt 2026, permintaan Nando) - khusus admin
// platform, di Command Center (kartu FITUR KLIEN). Satu baris per organisasi,
// satu kotak centang per fitur. Perubahan langsung tersimpan ke
// organizations.features lewat fungsi admin-org-features. Fitur yang tidak
// dicentang mati untuk organisasi itu; organisasi lain tidak terpengaruh.

const PLAN_LABEL = { enterprise: "Enterprise", standard: "Standard", premium: "Professional" };

export default function OrgFeaturesPanel() {
  const [orgs, setOrgs] = useState(null);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(null); // "orgId:key"

  const load = () => {
    setErr("");
    db.adminOrgFeatures("list").then((r) => setOrgs(r.orgs || [])).catch((e) => { setOrgs([]); setErr(e.message); });
  };
  useEffect(load, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (orgs || []).filter((o) => !s || `${o.name || ""} ${o.owner_email || ""}`.toLowerCase().includes(s));
  }, [orgs, q]);

  const toggle = async (org, key, enabled) => {
    const id = `${org.id}:${key}`;
    setSaving(id);
    try {
      const r = await db.adminOrgFeatures("set", { org_id: org.id, key, enabled });
      setOrgs((list) => (list || []).map((o) => (o.id === org.id ? { ...o, features: r.features } : o)));
    } catch (e) {
      alert("Gagal mengubah saklar: " + e.message);
    } finally {
      setSaving(null);
    }
  };

  const onCount = (key) => (orgs || []).filter((o) => o.features?.[key] === true).length;

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-slate-400">
        Nyalakan fitur khusus hanya untuk klien tertentu. Fitur yang tidak dicentang tetap mati untuk organisasi itu, dan organisasi lain tidak terpengaruh. Perubahan langsung tersimpan.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {ORG_FEATURES.map((f) => (
          <div key={f.key} className="rounded-lg border border-slate-700 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-slate-100">{f.label}</span>
              {!f.ready && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-300">Segera</span>}
            </div>
            <p className="mt-0.5 text-[11.5px] text-slate-400">{f.hint}</p>
            <p className="mt-1 text-[11.5px] text-slate-500">Menyala di {onCount(f.key)} organisasi{!f.ready ? ". Belum ada efeknya sampai fiturnya dibangun." : "."}</p>
          </div>
        ))}
      </div>

      <div>
        <input className={field} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama organisasi atau email owner" aria-label="Cari organisasi" />
      </div>

      <div className="rounded-xl border border-slate-700">
        {orgs === null ? (
          <p className="px-4 py-4 text-[12px] text-slate-500">Memuat organisasi…</p>
        ) : err ? (
          <p className="px-4 py-4 text-[12px] text-rose-300">Gagal memuat: {err}</p>
        ) : shown.length === 0 ? (
          <p className="px-4 py-4 text-[12px] text-slate-500">Tidak ada organisasi yang cocok.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto overscroll-contain">
            <table className="w-full min-w-[640px] text-[12.5px]">
              <thead className="sticky top-0 bg-[#0b0f17] text-left text-[11px] text-slate-400">
                <tr>
                  <th className="px-4 py-2 font-semibold">Organisasi</th>
                  <th className="px-2 py-2 font-semibold">Paket</th>
                  {ORG_FEATURES.map((f) => <th key={f.key} className="px-2 py-2 text-center font-semibold">{f.label}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {shown.map((o) => (
                  <tr key={o.id}>
                    <td className="max-w-[260px] px-4 py-2">
                      <div className="truncate text-slate-200">{o.name || "Tanpa nama"}</div>
                      <div className="truncate text-[11px] text-slate-500" title={o.owner_email || ""}>{o.owner_email || "-"}</div>
                    </td>
                    <td className="px-2 py-2 text-slate-400">{PLAN_LABEL[o.plan] || "Gratis"}</td>
                    {ORG_FEATURES.map((f) => {
                      const id = `${o.id}:${f.key}`;
                      return (
                        <td key={f.key} className="px-2 py-2 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-emerald-400"
                            checked={o.features?.[f.key] === true}
                            disabled={saving === id}
                            onChange={(e) => toggle(o, f.key, e.target.checked)}
                            aria-label={`${f.label} untuk ${o.name || "organisasi"} (${o.owner_email || ""})`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
