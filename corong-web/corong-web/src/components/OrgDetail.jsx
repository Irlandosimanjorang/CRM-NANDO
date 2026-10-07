import { useEffect, useState } from "react";
import * as db from "../lib/db";
import { ORG_FEATURES, ORG_TEMPLATES } from "../lib/orgFeatures";
import { INDUSTRY_TEMPLATES, getCustomFieldSlots } from "../lib/industryTemplates";
import { rp, fmtShort, field, lbl } from "./EnterpriseInvoicePanel";

// Halaman satu klien di Command Center (8 Okt 2026, permintaan Nando): paket,
// anggota, jumlah lead, pipeline, field, saklar fitur, invoice, dan quotation
// dalam satu tempat, plus tombol "Terapkan template klien". Dibuka dari nama
// organisasi di kartu FITUR KLIEN.

const PLAN_LABEL = { enterprise: "Enterprise", standard: "Standard", premium: "Professional" };
const STAGE_TYPE = { won: "Menang", lost: "Kalah", normal: "" };
const INV_STATUS = { unpaid: "Belum dibayar", paid: "Lunas", void: "Dibatalkan" };
const QUO_STATUS = { open: "Menunggu persetujuan", accepted: "Disetujui", rejected: "Ditolak", void: "Dibatalkan" };
const fmtExp = (iso) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }) : "Tanpa batas waktu");

export default function OrgDetail({ orgId, onBack, onFeaturesChanged }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState("");
  const [tplKey, setTplKey] = useState(ORG_TEMPLATES[0]?.key || "");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setErr("");
    db.adminOrgFeatures("detail", { org_id: orgId }).then(setD).catch((e) => setErr(e.message));
  };
  useEffect(load, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return (<div className="space-y-3"><button type="button" onClick={onBack} className="text-[12.5px] font-semibold text-emerald-300">Kembali ke daftar</button><p className="text-[12.5px] text-rose-300">Gagal memuat: {err}</p></div>);
  if (!d) return <p className="text-[12.5px] text-slate-500">Memuat data klien…</p>;

  const o = d.org;
  const tpl = ORG_TEMPLATES.find((t) => t.key === tplKey);
  const industryLabel = INDUSTRY_TEMPLATES[o.industry]?.label || o.industry || "-";
  const slots = getCustomFieldSlots(o.industry, o.custom_field_labels);
  const hasLeads = d.leads_total > 0;

  const toggle = async (key, enabled) => {
    setBusy(true);
    try {
      const r = await db.adminOrgFeatures("set", { org_id: o.id, key, enabled });
      setD((x) => ({ ...x, org: { ...x.org, features: r.features } }));
      onFeaturesChanged?.(o.id, r.features);
    } catch (e) { alert("Gagal mengubah saklar: " + e.message); }
    finally { setBusy(false); }
  };

  const applyTemplate = async () => {
    if (!tpl) return;
    const ind = INDUSTRY_TEMPLATES[tpl.industry];
    const msg = [
      `Terapkan template "${tpl.label}" ke ${o.name || "organisasi"} (${o.owner_email || "tanpa email"})?`,
      "",
      `Saklar fitur: ${tpl.features.map((k) => ORG_FEATURES.find((f) => f.key === k)?.label || k).join(", ") || "tidak ada"}`,
      hasLeads
        ? `Organisasi ini sudah punya ${d.leads_total} lead, jadi pipeline, industri, dan field TIDAK diubah. Hanya saklar fitur yang diterapkan.`
        : `Pipeline diganti dengan ${ind.stages.length} tahap (${ind.stages.map((s) => s.label).join(", ")}), industri menjadi "${ind.label}", dan field mengikuti template.`,
      "",
      "Organisasi lain tidak terpengaruh.",
    ].join("\n");
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const r = await db.adminOrgFeatures("apply_template", {
        org_id: o.id,
        template: { industry: tpl.industry, features: tpl.features, stages: ind.stages.map(({ key, label, hex, type }) => ({ key, label, hex, type })) },
      });
      onFeaturesChanged?.(o.id, r.features);
      load();
      alert(r.pipeline_applied ? "Template diterapkan: pipeline, industri, field, dan saklar fitur." : "Saklar fitur diterapkan. Pipeline dan field tidak diubah karena organisasi sudah punya lead.");
    } catch (e) { alert("Gagal menerapkan template: " + e.message); }
    finally { setBusy(false); }
  };

  const Section = ({ title, children }) => (
    <section className="rounded-xl border border-slate-700">
      <h4 className="border-b border-slate-700 px-4 py-2.5 text-[13px] font-semibold text-slate-100">{title}</h4>
      <div className="px-4 py-3">{children}</div>
    </section>
  );

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-[12.5px] font-semibold text-emerald-300 hover:text-emerald-200">Kembali ke daftar klien</button>

      <div>
        <h3 className="text-[16px] font-semibold text-slate-50">{o.name || "Tanpa nama"}</h3>
        <p className="text-[12.5px] text-slate-400">{o.owner_email || "-"}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Paket", PLAN_LABEL[o.plan] || "Gratis", o.plan ? `Aktif sampai ${fmtExp(o.plan_expires_at)}` : ""],
          ["Anggota", `${d.members} dari ${o.member_limit || 1}`, ""],
          ["Lead", `${d.leads}`, d.leads_total > d.leads ? `${d.leads_total - d.leads} sudah dihapus` : ""],
          ["Industri", industryLabel, ""],
        ].map(([k, v, note]) => (
          <div key={k} className="rounded-lg border border-slate-700 px-3 py-2.5">
            <div className={lbl}>{k}</div>
            <div className="text-[14px] font-semibold text-slate-100">{v}</div>
            {note && <div className="text-[11.5px] text-slate-500">{note}</div>}
          </div>
        ))}
      </div>

      <Section title="Template klien">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className={lbl} htmlFor="org-tpl">Template</label>
            <select id="org-tpl" className={field} value={tplKey} onChange={(e) => setTplKey(e.target.value)} disabled={busy}>
              {ORG_TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={applyTemplate} disabled={busy || !tpl} className="rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">Terapkan template</button>
        </div>
        <p className="mt-2 text-[12px] text-slate-400">{tpl?.hint}</p>
        <p className="mt-1 text-[12px] text-slate-500">
          {hasLeads
            ? `Organisasi ini sudah punya ${d.leads_total} lead: hanya saklar fitur yang diterapkan, pipeline dan field tidak diubah.`
            : "Organisasi ini belum punya lead: pipeline, industri, dan field akan diganti sesuai template."}
        </p>
      </Section>

      <Section title="Saklar fitur">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {ORG_FEATURES.map((f) => (
            <label key={f.key} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-200">
              <input type="checkbox" className="h-4 w-4 accent-emerald-400" checked={o.features?.[f.key] === true} disabled={busy} onChange={(e) => toggle(f.key, e.target.checked)} />
              {f.label}{!f.ready && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-300">Segera</span>}
            </label>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`Pipeline (${d.stages.length} tahap)`}>
          {d.stages.length === 0 ? <p className="text-[12.5px] text-slate-500">Belum ada tahap.</p> : (
            <ol className="flex flex-wrap gap-2">
              {d.stages.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2 py-1 text-[12px] text-slate-200">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.hex }} aria-hidden="true" />
                  {s.label}{STAGE_TYPE[s.type] && <span className="text-slate-500">({STAGE_TYPE[s.type]})</span>}
                </li>
              ))}
            </ol>
          )}
        </Section>
        <Section title={`Field kustom (${slots.length})`}>
          {slots.length === 0 ? <p className="text-[12.5px] text-slate-500">Belum ada field kustom.</p> : (
            <ul className="space-y-1 text-[12.5px] text-slate-200">
              {slots.map((s) => <li key={s.key}>{s.label}{s.options && <span className="text-slate-500">: {s.options.join(", ")}</span>}</li>)}
            </ul>
          )}
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[["Invoice", d.invoices, INV_STATUS], ["Quotation", d.quotations, QUO_STATUS]].map(([title, rows, map]) => (
          <Section key={title} title={`${title} (${rows.length})`}>
            {rows.length === 0 ? <p className="text-[12.5px] text-slate-500">Belum ada.</p> : (
              <ul className="divide-y divide-slate-800 text-[12.5px]">
                {rows.map((r) => (
                  <li key={r.number} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="min-w-0"><span className="font-mono text-slate-200">{r.number}</span><span className="block text-[11px] text-slate-500">{fmtShort(r.date)}, {map[r.status] || r.status}</span></span>
                    <span className="font-mono text-slate-100">{rp(r.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ))}
      </div>
    </div>
  );
}
