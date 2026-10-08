import { useMemo } from "react";
import { Download } from "lucide-react";
import { fmtRp } from "../lib/helpers";
import { Panel, PanelHeader, EmptyState } from "../ui";

// Rekap per tahap dengan kolom yang sama seperti laporan Excel BSB (REPORT ASIFA):
// NO, TANGGAL, NAMA, INSTANSI (tipe pelanggan), NOMOR TELP, ALAMAT, NO SPH/INVOICE, NILAI, KETERANGAN, SUMBER.
// Bagian: Data masuk, SPH terlayang / info harga, Hot progress, Proyek deal, Deal kontrak, Proyek berjalan, No deal.
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const SOURCES = ["Meta", "Instagram", "TikTok", "Google", "Customer datang", "Database", "Bu Tiara", "Migi", "Lainnya"];
const ymOf = (iso) => String(iso || "").slice(0, 7);
const num = (v) => Number(v) || 0;
const fmtDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1].slice(0, 3)} ${m[1]}` : "-";
};
const sourceOf = (l) => Object.entries(l).find(([k, v]) => /^custom_field_\d+$/.test(k) && SOURCES.includes(v))?.[1] || "";
// Nomor SPH = isian bebas pertama yang berisi "SPH" atau pola nomor dokumen (custom_field_1 pada template BSB).
const sphOf = (l) => String(l.custom_field_1 || "").trim();

const COLS = [
  ["NO", "w-10 text-right"], ["TANGGAL", "whitespace-nowrap"], ["NAMA", "min-w-[160px]"], ["INSTANSI", ""], ["NOMOR TELP", "whitespace-nowrap"],
  ["ALAMAT", ""], ["NO SPH / INVOICE", "whitespace-nowrap"], ["NILAI", "text-right whitespace-nowrap"], ["KETERANGAN", "min-w-[180px]"], ["SUMBER", ""],
];

export default function RekapLaporan({ leads = [], stages = [], dealTransactions = [], ym, orgName = "" }) {
  const [year, month] = ym.split("-").map(Number);

  const sections = useMemo(() => {
    const live = leads.filter((l) => !l.deleted_at);
    const byId = new Map(live.map((l) => [l.id, l]));
    const stageIs = (l, ...keys) => keys.includes(l.stage_key);
    const lostKeys = new Set(stages.filter((s) => s.type === "lost").map((s) => s.key));
    const wonKeys = new Set(stages.filter((s) => s.type === "won").map((s) => s.key));

    // Lead yang deal pada bulan ini: transaksi di tab Deal bila ada, selain itu tanggal deal di lead.
    const txIds = new Set(dealTransactions.map((t) => t.lead_id));
    const dealLeads = new Map();
    for (const t of dealTransactions) if (ymOf(t.deal_date) === ym && byId.get(t.lead_id)) dealLeads.set(t.lead_id, { lead: byId.get(t.lead_id), value: num(t.deal_value), date: t.deal_date });
    for (const l of live) if (wonKeys.has(l.stage_key) && !txIds.has(l.id) && ymOf(l.deal_date) === ym) dealLeads.set(l.id, { lead: l, value: num(l.deal_value), date: l.deal_date });
    const deals = [...dealLeads.values()];

    const row = (l, value = num(l.deal_value), date = l.created_at) => ({ lead: l, value, date });
    return [
      { key: "masuk", title: "Data masuk", note: `Dibuat pada ${MONTHS[month - 1]} ${year}`, rows: live.filter((l) => ymOf(l.created_at) === ym).map((l) => row(l)), money: false },
      { key: "sph", title: "SPH terlayang / info harga", note: "SPH yang belum diproses, hot progress, dan deal bulan ini", rows: [...live.filter((l) => stageIs(l, "sph_terlayang", "hot_progress")).map((l) => row(l)), ...deals.map((d) => row(d.lead, d.value))] },
      { key: "hot", title: "Hot progress", note: "Calon yang serius, menunggu gambar atau survei", rows: live.filter((l) => stageIs(l, "hot_progress")).map((l) => row(l)) },
      { key: "deal", title: "Proyek deal", note: `Deal pada ${MONTHS[month - 1]}`, rows: deals.filter((d) => d.lead.stage_key === "proyek_deal").map((d) => row(d.lead, d.value, d.date)) },
      { key: "kontrak", title: "Deal kontrak", note: `Deal kontrak pada ${MONTHS[month - 1]}`, rows: deals.filter((d) => d.lead.stage_key === "deal_kontrak").map((d) => row(d.lead, d.value, d.date)) },
      { key: "jalan", title: "Proyek berjalan", note: "Proses SO dan pengiriman", rows: live.filter((l) => stageIs(l, "proses_so", "pengiriman")).map((l) => row(l, num(l.deal_value), l.deal_date || l.created_at)) },
      { key: "nodeal", title: "No deal", note: `Diubah pada ${MONTHS[month - 1]}`, rows: live.filter((l) => lostKeys.has(l.stage_key) && ymOf(l.updated_at) === ym).map((l) => row(l)) },
    ].map((s) => ({ ...s, rows: s.rows.sort((a, b) => String(a.date).localeCompare(String(b.date))) }));
  }, [leads, stages, dealTransactions, ym, month, year]);

  const cells = (r, i) => [
    i + 1, fmtDay(r.date), r.lead.name, r.lead.company_type || "", r.lead.phone || "", r.lead.city || "", sphOf(r.lead),
    r.value > 0 ? r.value : "", [r.lead.next_action, r.lead.key_person && r.lead.key_person !== r.lead.name ? `PIC ${r.lead.key_person}` : ""].filter(Boolean).join(" · "), sourceOf(r.lead),
  ];

  const download = async () => {
    const XLSX = await import("xlsx");
    const aoa = [[`REPORT ${orgName || "SALES"} ${MONTHS[month - 1].toUpperCase()} ${year}`], []];
    for (const s of sections) {
      aoa.push([s.title.toUpperCase()], COLS.map((c) => c[0]));
      s.rows.forEach((r, i) => aoa.push(cells(r, i)));
      if (s.money !== false) aoa.push(["", "", "", "", "", "", "TOTAL", s.rows.reduce((t, r) => t + r.value, 0)]);
      aoa.push([]);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, { wch: 13 }, { wch: 30 }, { wch: 13 }, { wch: 16 }, { wch: 20 }, { wch: 28 }, { wch: 15 }, { wch: 40 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[month - 1]} ${year}`);
    XLSX.writeFile(wb, `Laporan-${(orgName || "sales").replace(/[^A-Za-z0-9]+/g, "-")}-${ym}.xlsx`);
  };

  const th = "px-3 py-2.5 text-left text-[10.5px] font-semibold tracking-[0.04em] text-slate-500";
  const td = "px-3 py-2.5 text-[12.5px] text-slate-800 align-top";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[12px] text-slate-500">Daftar lead per tahap dengan kolom yang sama seperti laporan Excel: nama, instansi, telepon, alamat, nomor SPH, nilai, keterangan, dan sumber.</p>
        <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><Download size={14} /> Unduh Excel</button>
      </div>

      {sections.map((s) => {
        const total = s.rows.reduce((t, r) => t + r.value, 0);
        return (
          <Panel key={s.key} className="overflow-hidden">
            <div className="px-5 pb-2 pt-4">
              <PanelHeader title={`${s.title} (${s.rows.length})`} meta={s.note} right={s.money === false ? null : <div className="text-[12px] font-semibold tabular-nums text-ink">Total {fmtRp(total)}</div>} />
            </div>
            {s.rows.length === 0 ? (
              <div className="px-5 pb-5"><EmptyState>Belum ada data di bagian ini untuk bulan ini.</EmptyState></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse">
                  <thead>
                    <tr className="border-y border-slate-100 bg-slate-50/60">{COLS.map(([c, cls]) => <th key={c} className={`${th} ${cls.includes("text-right") ? "!text-right" : ""}`}>{c}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {s.rows.map((r, i) => {
                      const c = cells(r, i);
                      return (
                        <tr key={`${r.lead.id}-${i}`}>
                          {c.map((v, k) => (
                            <td key={k} className={`${td} ${COLS[k][1]} ${k === 2 ? "font-semibold text-ink" : ""} ${k === 7 ? "tabular-nums" : ""}`}>
                              {k === 7 ? (v === "" ? "-" : fmtRp(v)) : (v === "" ? <span className="text-slate-300">-</span> : v)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
