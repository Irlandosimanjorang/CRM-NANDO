import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import * as db from "../lib/db";
import { fmtRp } from "../lib/helpers";
import { Panel, PanelHeader, EmptyState } from "../ui";

// Rekap seperti laporan Excel BSB (REPORT ASIFA), urutan sama dengan PDF:
//  1. Legenda warna tahap.
//  2. Tabel induk: lead bulan ini dengan kolom NO sampai SUMBER, lalu kolom tanggal 1-31 per minggu
//     yang diwarnai pada tanggal tiap lead berpindah tahap (dari riwayat lead_stage_changes).
//  3. Daftar per tahap dengan total: SPH terlayang, Hot progress, Proyek deal, Deal kontrak, No deal.
//  4. Dari bulan sebelumnya: proyek berjalan dan proyek yang belum proses SO.
//  5. Ringkasan bobot dan target omzet di paling bawah.
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAY_LETTER = ["M", "S", "S", "R", "K", "J", "S"]; // Minggu, Senin, Selasa, Rabu, Kamis, Jumat, Sabtu
const SOURCES = ["Meta", "Instagram", "TikTok", "Google", "Customer datang", "Database", "Bu Tiara", "Migi", "Lainnya"];
const pad = (n) => String(n).padStart(2, "0");
const ymOf = (iso) => String(iso || "").slice(0, 7);
const num = (v) => Number(v) || 0;
const fmtDay = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1].slice(0, 3)} ${m[1]}` : "-";
};
const sourceOf = (l) => Object.entries(l).find(([k, v]) => /^custom_field_\d+$/.test(k) && SOURCES.includes(v))?.[1] || "";
const wibDate = (ts) => new Date(new Date(ts).getTime() + 7 * 3600000).toISOString().slice(0, 10);
const pctOf = (v, base) => (base > 0 ? `${((v / base) * 100).toFixed(2).replace(/\.?0+$/, "")}%` : "0%");
const cn = (...v) => v.filter(Boolean).join(" ");

const COLS = [
  ["NO", "w-10 text-right"], ["TANGGAL", "whitespace-nowrap"], ["NAMA", "min-w-[170px]"], ["INSTANSI", ""], ["NOMOR TELP", "whitespace-nowrap"],
  ["ALAMAT", ""], ["NO SPH / INVOICE", "whitespace-nowrap"], ["NILAI", "text-right whitespace-nowrap"], ["KETERANGAN", "min-w-[190px]"], ["SUMBER", ""],
];

export default function RekapLaporan({ leads = [], stages = [], dealTransactions = [], ym, orgName = "", target = 0, personal = false }) {
  const [year, month] = ym.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const from = `${ym}-01`, to = `${ym}-${pad(daysInMonth)}`;
  const [changes, setChanges] = useState([]);

  useEffect(() => {
    let alive = true;
    db.listStageChanges(from, to).then((r) => { if (alive) setChanges(r); }).catch(() => { if (alive) setChanges([]); });
    return () => { alive = false; };
  }, [from, to]);

  const stageMeta = useMemo(() => Object.fromEntries(stages.map((s) => [s.key, s])), [stages]);
  const firstKey = stages[0]?.key;

  const d = useMemo(() => {
    const live = leads.filter((l) => !l.deleted_at);
    const byId = new Map(live.map((l) => [l.id, l]));
    const wonKeys = new Set(stages.filter((s) => s.type === "won").map((s) => s.key));
    const lostKeys = new Set(stages.filter((s) => s.type === "lost").map((s) => s.key));
    const startOfMonth = from;

    // Deal bulan ini: transaksi di tab Deal bila ada, selain itu tanggal deal di lead.
    const txIds = new Set(dealTransactions.map((t) => t.lead_id));
    const dealMap = new Map();
    for (const t of dealTransactions) if (ymOf(t.deal_date) === ym && byId.get(t.lead_id)) dealMap.set(t.lead_id, { lead: byId.get(t.lead_id), value: num(t.deal_value), date: t.deal_date });
    for (const l of live) if (wonKeys.has(l.stage_key) && !txIds.has(l.id) && ymOf(l.deal_date) === ym) dealMap.set(l.id, { lead: l, value: num(l.deal_value), date: l.deal_date });
    const deals = [...dealMap.values()];

    // Timeline: tanggal -> tahap, per lead. Riwayat pindah tahap lebih diutamakan daripada perkiraan.
    const events = new Map();
    const put = (id, iso, key) => { if (ymOf(iso) !== ym || !key) return; const day = Number(iso.slice(8, 10)); (events.get(id) || events.set(id, new Map()).get(id)).set(day, key); };
    const changed = new Map();
    for (const c of [...changes].sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)))) { put(c.lead_id, wibDate(c.changed_at), c.to_stage); changed.set(c.lead_id, true); }
    for (const l of live) {
      if (ymOf(l.created_at) === ym && !(events.get(l.id)?.has(Number(wibDate(l.created_at).slice(8, 10))))) put(l.id, wibDate(l.created_at), firstKey);
      if (!changed.get(l.id) && l.stage_key !== firstKey) {
        const when = wonKeys.has(l.stage_key) && l.deal_date ? l.deal_date : wibDate(l.updated_at);
        put(l.id, when, l.stage_key);
      }
    }

    const master = live.filter((l) => ymOf(wibDate(l.created_at)) === ym || events.has(l.id)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const row = (l, value = num(l.deal_value), date = wibDate(l.created_at)) => ({ lead: l, value, date });
    const earlier = (l) => String(l.deal_date || wibDate(l.created_at)) < startOfMonth;
    const byStage = (...keys) => live.filter((l) => keys.includes(l.stage_key));
    const sorted = (rows) => rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const sph = byStage("sph_terlayang"), hot = byStage("hot_progress");
    const lost = live.filter((l) => lostKeys.has(l.stage_key) && ymOf(l.updated_at) === ym);
    const sections = [
      { key: "sph", title: "SPH terlayang / info harga", note: "SPH belum diproses, hot progress, dan deal bulan ini", rows: sorted([...sph, ...hot].map((l) => row(l)).concat(deals.map((x) => row(x.lead, x.value, x.date)))) },
      { key: "hot", title: "Hot progress", note: "Calon yang serius, menunggu gambar atau survei", rows: sorted(hot.map((l) => row(l))) },
      { key: "deal", title: "Proyek deal", note: `Deal pada ${MONTHS[month - 1]}`, rows: sorted(deals.filter((x) => x.lead.stage_key === "proyek_deal").map((x) => row(x.lead, x.value, x.date))) },
      { key: "kontrak", title: "Deal kontrak", note: `Deal kontrak pada ${MONTHS[month - 1]}`, rows: sorted(deals.filter((x) => x.lead.stage_key === "deal_kontrak").map((x) => row(x.lead, x.value, x.date))) },
      { key: "nodeal", title: "No deal", note: `Diubah pada ${MONTHS[month - 1]}`, rows: sorted(lost.map((l) => row(l))) },
    ];
    const prior = [
      { key: "jalan", title: "Project yang berjalan dari bulan sebelumnya", note: "Sudah proses SO atau dalam pengiriman", rows: sorted(byStage("proses_so", "pengiriman").filter(earlier).map((l) => row(l, num(l.deal_value), l.deal_date || wibDate(l.created_at)))) },
      { key: "belumso", title: "Project yang belum proses SO dari bulan sebelumnya", note: "Proyek deal dan deal kontrak yang belum masuk Proses SO", rows: sorted(byStage("proyek_deal", "deal_kontrak").filter(earlier).map((l) => row(l, num(l.deal_value), l.deal_date || wibDate(l.created_at)))) },
    ];

    const sum = (rows) => rows.reduce((t, r) => t + r.value, 0);
    const sphAll = sum(sections[0].rows);
    return { master, events, sections, prior, sphAll, hotAll: sum(sections[1].rows), dealAll: sum(deals), lostAll: sum(sections[4].rows), pending: sph.reduce((t, l) => t + num(l.deal_value), 0), masukCount: live.filter((l) => ymOf(wibDate(l.created_at)) === ym).length };
  }, [leads, stages, dealTransactions, changes, ym, from, firstKey, month]);

  const cells = (r, i) => [
    i + 1, fmtDay(r.date), r.lead.name, r.lead.company_type || "", r.lead.phone || "", r.lead.city || "", String(r.lead.custom_field_1 || "").trim(),
    r.value > 0 ? r.value : "", [r.lead.next_action, r.lead.key_person && r.lead.key_person !== r.lead.name ? `PIC ${r.lead.key_person}` : ""].filter(Boolean).join(" · "), sourceOf(r.lead),
  ];
  const masterRows = d.master.map((l) => ({ lead: l, value: num(l.deal_value), date: wibDate(l.created_at) }));
  const weeks = [[1, 7], [8, 14], [15, 21], [22, daysInMonth]];
  const dayLetter = (day) => DAY_LETTER[new Date(year, month - 1, day).getDay()];
  const summary = [
    ["Data masuk bulan ini", d.masukCount, null, null],
    ["SPH terlayang (semua)", d.sections[0].rows.length, d.sphAll, 100],
    ["Hot progress", d.sections[1].rows.length, d.hotAll, d.sphAll ? (d.hotAll / d.sphAll) * 100 : 0],
    ["Deal", d.sections[2].rows.length + d.sections[3].rows.length, d.dealAll, d.sphAll ? (d.dealAll / d.sphAll) * 100 : 0],
    ["No deal", d.sections[4].rows.length, d.lostAll, d.sphAll ? (d.lostAll / d.sphAll) * 100 : 0],
    ["Data yang belum diproses dari SPH dan hot progress (deal dan no deal)", d.sections[0].rows.length - d.sections[1].rows.length - d.sections[2].rows.length - d.sections[3].rows.length, d.pending, d.sphAll ? (d.pending / d.sphAll) * 100 : 0],
    ...(personal ? [] : [["Key personal indicator / target omzet", null, target, target ? 100 : null]]),
    ["Omzet tercapai di bulan ini", null, d.dealAll, !personal && target ? (d.dealAll / target) * 100 : null],
  ];

  const download = async () => {
    const XLSX = await import("xlsx");
    const label = (key) => stageMeta[key]?.label || key;
    const aoa = [[`REPORT ${(orgName || "SALES").toUpperCase()} ${MONTHS[month - 1].toUpperCase()} ${year}`], ["REPORT DATA RETAIL & PROJECT"], []];
    aoa.push([...COLS.map((c) => c[0]), ...Array.from({ length: daysInMonth }, (_, i) => `${i + 1}${dayLetter(i + 1)}`)]);
    masterRows.forEach((r, i) => aoa.push([...cells(r, i), ...Array.from({ length: daysInMonth }, (_, k) => { const key = d.events.get(r.lead.id)?.get(k + 1); return key ? label(key) : ""; })]));
    aoa.push([]);
    for (const s of [...d.sections, ...d.prior]) {
      aoa.push([s.title.toUpperCase()], COLS.map((c) => c[0]));
      s.rows.forEach((r, i) => aoa.push(cells(r, i)));
      aoa.push(["", "", "", "", "", "", "TOTAL", s.rows.reduce((t, r) => t + r.value, 0)], []);
    }
    aoa.push(["", "", "", "", "", "", "NILAI PROJECT", "", "BOBOT"]);
    for (const [name, count, value, w] of summary) aoa.push([name, "", "", "", "", "", "", value ?? "", w === null ? "" : `${w.toFixed(2)}%`, count ?? ""]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 5 }, { wch: 13 }, { wch: 30 }, { wch: 13 }, { wch: 16 }, { wch: 20 }, { wch: 28 }, { wch: 15 }, { wch: 40 }, { wch: 16 }, ...Array.from({ length: daysInMonth }, () => ({ wch: 13 }))];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[month - 1]} ${year}`);
    XLSX.writeFile(wb, `Report-${(orgName || "sales").replace(/[^A-Za-z0-9]+/g, "-")}-${ym}.xlsx`);
  };

  const th = "px-3 py-2.5 text-left text-[10.5px] font-semibold tracking-[0.04em] text-slate-500";
  const td = "px-3 py-2.5 text-[12.5px] text-slate-800 align-top";
  const Cell = ({ v, k }) => (k === 7 ? (v === "" ? <span className="text-slate-300">-</span> : fmtRp(v)) : (v === "" ? <span className="text-slate-300">-</span> : v));

  const Table = ({ s }) => (
    <Panel className="overflow-hidden">
      <div className="px-5 pb-2 pt-4">
        <PanelHeader title={`${s.title} (${s.rows.length})`} meta={s.note} right={<div className="text-[12px] font-semibold tabular-nums text-ink">Total {fmtRp(s.rows.reduce((t, r) => t + r.value, 0))}</div>} />
      </div>
      {s.rows.length === 0 ? (
        <div className="px-5 pb-5"><EmptyState>Belum ada data di bagian ini.</EmptyState></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead><tr className="border-y border-slate-100 bg-slate-50/60">{COLS.map(([c, cls]) => <th key={c} className={cn(th, cls.includes("text-right") && "!text-right")}>{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {s.rows.map((r, i) => (
                <tr key={`${r.lead.id}-${i}`}>
                  {cells(r, i).map((v, k) => <td key={k} className={cn(td, COLS[k][1], k === 2 && "font-semibold text-ink", k === 7 && "tabular-nums")}><Cell v={v} k={k} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[15px] font-bold tracking-[-0.02em] text-ink">Report data retail dan project</h2>
          <p className="mt-0.5 text-[11.5px] text-slate-500">Urutan seperti laporan Excel: tabel induk dengan timeline harian, daftar per tahap, proyek bulan lalu, lalu ringkasan bobot.</p>
        </div>
        <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><Download size={14} /> Unduh Excel</button>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 text-[11.5px] text-slate-600">
          <span className="font-semibold text-slate-700">Warna tahap</span>
          {stages.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.hex }} />{s.label}</span>)}
        </div>
        {masterRows.length === 0 ? (
          <div className="border-t border-slate-100 px-5 py-5"><EmptyState>Belum ada lead pada bulan ini. Data masuk dan perpindahan tahap tim muncul di sini otomatis.</EmptyState></div>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/60">
                  <th colSpan={COLS.length} className={cn(th, "sticky left-0 z-10 bg-slate-50")}>{MONTHS[month - 1].toUpperCase()} {year} · {masterRows.length} lead</th>
                  {weeks.map(([a, b], i) => <th key={i} colSpan={b - a + 1} className="border-l border-slate-200 px-1 py-2 text-center text-[10.5px] font-semibold text-slate-500">Minggu ke-{i + 1}</th>)}
                </tr>
                <tr className="border-y border-slate-100 bg-slate-50/60">
                  {COLS.map(([c, cls], k) => <th key={c} className={cn(th, cls.includes("text-right") && "!text-right", k === 0 && "sticky left-0 z-10 bg-slate-50", k === 2 && "sticky left-10 z-10 bg-slate-50")}>{c}</th>)}
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i} className={cn("w-[26px] min-w-[26px] px-0 py-1 text-center text-[10px] font-semibold text-slate-500", [0, 7, 14, 21].includes(i) && "border-l border-slate-200")}>
                      <div>{i + 1}</div><div className="font-normal text-slate-400">{dayLetter(i + 1)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {masterRows.map((r, i) => (
                  <tr key={r.lead.id}>
                    {cells(r, i).map((v, k) => (
                      <td key={k} className={cn(td, COLS[k][1], k === 2 && "font-semibold text-ink", k === 7 && "tabular-nums", k === 0 && "sticky left-0 z-[1] bg-white", k === 2 && "sticky left-10 z-[1] bg-white")}><Cell v={v} k={k} /></td>
                    ))}
                    {Array.from({ length: daysInMonth }, (_, k) => {
                      const key = d.events.get(r.lead.id)?.get(k + 1);
                      const meta = key ? stageMeta[key] : null;
                      return (
                        <td key={k} title={meta ? `${k + 1} ${MONTHS[month - 1]}: ${meta.label}` : undefined} className={cn("p-0.5", [0, 7, 14, 21].includes(k) && "border-l border-slate-200")}>
                          <div className="h-6 w-5 rounded-[4px]" style={meta ? { background: meta.hex } : undefined} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {d.sections.map((s) => <Table key={s.key} s={s} />)}
      {d.prior.map((s) => <Table key={s.key} s={s} />)}

      <Panel className="overflow-hidden">
        <div className="px-5 pb-1 pt-4"><PanelHeader title="Ringkasan nilai project dan bobot" meta="Bobot terhadap seluruh nilai SPH, seperti di bagian bawah laporan Excel" /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead><tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500"><th className="px-5 py-2.5 text-left">Keterangan</th><th className="px-4 py-2.5 text-right">Jumlah</th><th className="px-4 py-2.5 text-right">Nilai project</th><th className="px-5 py-2.5 text-right">Bobot</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {summary.map(([name, count, value, w]) => (
                <tr key={name} className={name.startsWith("Omzet") ? "bg-emerald-50/50" : undefined}>
                  <td className={cn("px-5 py-2.5 text-[12.5px]", name.startsWith("Omzet") ? "font-bold text-emerald-700" : "font-medium text-ink")}>{name}</td>
                  <td className="px-4 py-2.5 text-right text-[12.5px] tabular-nums text-slate-800">{count ?? "-"}</td>
                  <td className="px-4 py-2.5 text-right text-[12.5px] tabular-nums text-slate-800">{value === null ? "-" : fmtRp(value)}</td>
                  <td className="px-5 py-2.5 text-right text-[12.5px] tabular-nums text-slate-600">{w === null ? "-" : pctOf(w, 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
