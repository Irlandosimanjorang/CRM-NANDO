import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from "lucide-react";
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
const ZOOMS = [0.7, 0.85, 1, 1.25, 1.5, 1.8];
const DAYS_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const timeWib = (ts) => { const d = new Date(new Date(ts).getTime() + 7 * 3600000); return `${pad(d.getUTCHours())}.${pad(d.getUTCMinutes())} WIB`; };

const COLS = [
  ["NO", "w-10 text-right"], ["TANGGAL", "whitespace-nowrap"], ["NAMA", "min-w-[170px]"], ["INSTANSI", ""], ["NOMOR TELP", "whitespace-nowrap"],
  ["ALAMAT", ""], ["NO SPH / INVOICE", "whitespace-nowrap"], ["NILAI", "text-right whitespace-nowrap"], ["KETERANGAN", "min-w-[190px]"], ["SUMBER", ""],
];

export default function RekapLaporan({ leads = [], stages = [], dealTransactions = [], ym, orgName = "", target = 0, personal = false, members = [] }) {
  const [year, month] = ym.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const from = `${ym}-01`, to = `${ym}-${pad(daysInMonth)}`;
  const [changes, setChanges] = useState([]);
  const [zoomIdx, setZoomIdx] = useState(2); // 100%
  const [full, setFull] = useState(false); // timeline tampil layar penuh
  const [tip, setTip] = useState(null); // popup detail sel timeline
  const zoom = ZOOMS[zoomIdx];
  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { setTip(null); setFull(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  const nameOf = (uid) => members.find((m) => m.user_id === uid)?.display_name || "";

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
    // events: lead -> tanggal -> daftar kejadian { key (tahap tujuan), from, by, at, created, estimated }.
    const put = (id, iso, key, extra = {}) => {
      if (ymOf(iso) !== ym || !key) return;
      const day = Number(iso.slice(8, 10));
      const byDay = events.get(id) || events.set(id, new Map()).get(id);
      const list = byDay.get(day) || [];
      list.push({ key, ...extra });
      byDay.set(day, list);
    };
    const changed = new Map();
    for (const c of [...changes].sort((a, b) => String(a.changed_at).localeCompare(String(b.changed_at)))) { put(c.lead_id, wibDate(c.changed_at), c.to_stage, { from: c.from_stage, by: c.changed_by, at: c.changed_at }); changed.set(c.lead_id, true); }
    for (const l of live) {
      if (ymOf(l.created_at) === ym && !(events.get(l.id)?.has(Number(wibDate(l.created_at).slice(8, 10))))) put(l.id, wibDate(l.created_at), firstKey, { created: true, by: l.user_id, at: l.created_at });
      if (!changed.get(l.id) && l.stage_key !== firstKey) {
        const when = wonKeys.has(l.stage_key) && l.deal_date ? l.deal_date : wibDate(l.updated_at);
        put(l.id, when, l.stage_key, { estimated: true });
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
      { key: "so", title: "Deal bulan ini yang sudah proses SO / pengiriman", note: `Deal pada ${MONTHS[month - 1]} yang sudah lanjut`, rows: sorted(deals.filter((x) => ["proses_so", "pengiriman"].includes(x.lead.stage_key)).map((x) => row(x.lead, x.value, x.date))) },
      { key: "nodeal", title: "No deal", note: `Diubah pada ${MONTHS[month - 1]}`, rows: sorted(lost.map((l) => row(l))) },
    ];
    const prior = [
      { key: "jalan", title: "Project yang berjalan dari bulan sebelumnya", note: "Sudah proses SO atau dalam pengiriman", rows: sorted(byStage("proses_so", "pengiriman").filter(earlier).map((l) => row(l, num(l.deal_value), l.deal_date || wibDate(l.created_at)))) },
      { key: "belumso", title: "Project yang belum proses SO dari bulan sebelumnya", note: "Proyek deal dan deal kontrak yang belum masuk Proses SO", rows: sorted(byStage("proyek_deal", "deal_kontrak").filter(earlier).map((l) => row(l, num(l.deal_value), l.deal_date || wibDate(l.created_at)))) },
    ];

    const sum = (rows) => rows.reduce((t, r) => t + r.value, 0);
    const sphAll = sum(sections[0].rows);
    return { master, events, sections, prior, sphAll, hotAll: sum(sections[1].rows), dealAll: sum(deals), dealCount: deals.length, sphStageCount: sph.length, hotCount: hot.length, lostCount: lost.length, lostAll: sum(sections.find((x) => x.key === "nodeal").rows), pending: sph.reduce((t, l) => t + num(l.deal_value), 0), masukCount: live.filter((l) => ymOf(wibDate(l.created_at)) === ym).length };
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
    ["Hot progress", d.hotCount, d.hotAll, d.sphAll ? (d.hotAll / d.sphAll) * 100 : 0],
    ["Deal", d.dealCount, d.dealAll, d.sphAll ? (d.dealAll / d.sphAll) * 100 : 0],
    ["No deal", d.lostCount, d.lostAll, d.sphAll ? (d.lostAll / d.sphAll) * 100 : 0],
    ["Data yang belum diproses dari SPH dan hot progress (deal dan no deal)", d.sphStageCount, d.pending, d.sphAll ? (d.pending / d.sphAll) * 100 : 0],
    ...(personal ? [] : [["Key personal indicator / target omzet", null, target, target ? 100 : null]]),
    ["Omzet tercapai di bulan ini", null, d.dealAll, !personal && target ? (d.dealAll / target) * 100 : null],
  ];

  const download = async () => {
    const XLSX = await import("xlsx");
    const label = (key) => stageMeta[key]?.label || key;
    const aoa = [[`REPORT ${(orgName || "SALES").toUpperCase()} ${MONTHS[month - 1].toUpperCase()} ${year}`], ["REPORT DATA RETAIL & PROJECT"], []];
    aoa.push([...COLS.map((c) => c[0]), ...Array.from({ length: daysInMonth }, (_, i) => `${i + 1}${dayLetter(i + 1)}`)]);
    masterRows.forEach((r, i) => aoa.push([...cells(r, i), ...Array.from({ length: daysInMonth }, (_, k) => { const evs = d.events.get(r.lead.id)?.get(k + 1); return evs ? label(evs[evs.length - 1].key) : ""; })]));
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

  // Kalender bulanan untuk tampilan layar penuh: tiap tanggal berisi kotak berwarna, satu per lead yang bergerak hari itu.
  const calCells = useMemo(() => {
    const lead = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const total = Math.ceil((lead + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const dt = new Date(year, month - 1, 1 - lead + i);
      return { iso: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, day: dt.getDate(), inMonth: dt.getMonth() === month - 1, weekend: dt.getDay() === 0 || dt.getDay() === 6 };
    });
  }, [year, month, daysInMonth]);
  const calItems = useMemo(() => {
    const m = new Map();
    for (const l of d.master) {
      const byDay = d.events.get(l.id);
      if (!byDay) continue;
      for (const [day, evs] of byDay) (m.get(day) || m.set(day, []).get(day)).push({ lead: l, evs });
    }
    return m;
  }, [d]);

  // Blok timeline: dipakai di halaman biasa (dalam Panel) dan di layar penuh (menutupi seluruh layar).
  const timeline = (isFull) => {
    if (isFull) {
      // Layar penuh: hanya kolom tanggal, melebar sampai semua tanggal terlihat tanpa menggeser. Nama lead
      // muncul di popup saat kursor diarahkan ke kotak berwarna.
      const showTip = (e, lead, day, evs) => { const b = e.currentTarget.getBoundingClientRect(); setTip({ x: b.left + b.width / 2, top: b.top, bottom: b.bottom, lead, day, evs }); };
      // Pop-up berada di area konten: sidebar kiri tetap terlihat (tidak ditutup), latar redup di sisi kanan sidebar.
      const side = typeof document !== "undefined" ? document.querySelector("aside.nexto-sidebar") : null;
      const sb = side ? side.getBoundingClientRect() : null;
      const sideLeft = sb && sb.width > 0 && sb.left < 80 ? Math.round(sb.right) + 12 : 0;
      const overlay = (
        <div className="fixed inset-y-0 right-0 z-[80] flex items-center justify-center bg-slate-900/40 p-3 sm:p-5" style={{ left: sideLeft }} onMouseDown={(e) => { if (e.target === e.currentTarget) { setTip(null); setFull(false); } }}>
        <div className="flex h-full max-h-[880px] w-full max-w-[1200px] flex-col overflow-hidden rounded-panel bg-white shadow-float">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div>
              <div className="font-display text-[17px] font-bold tracking-[-0.02em] text-ink">{MONTHS[month - 1].toUpperCase()} {year}{orgName ? ` · ${orgName}` : ""}</div>
              <div className="text-[11px] text-slate-500">{masterRows.length} lead. Arahkan kursor ke kotak berwarna untuk melihat nama lead dan rinciannya.</div>
            </div>
            <button type="button" onClick={() => { setTip(null); setFull(false); }} aria-label="Tutup layar penuh" title="Tutup (Esc)" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><Minimize2 size={18} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-slate-100 px-5 py-2.5 text-[11.5px] text-slate-600">
            <span className="font-semibold text-slate-700">Warna tahap</span>
            {stages.map((st) => <span key={st.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: st.hex }} />{st.label}</span>)}
          </div>
          {masterRows.length === 0 ? (
            <div className="p-6"><EmptyState>Belum ada lead pada bulan ini.</EmptyState></div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
              <div className="grid grid-cols-7 border-b border-slate-200">
                {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((w, i) => <div key={w} className={cn("py-1.5 text-center text-[11px] font-semibold", i >= 5 ? "text-slate-400" : "text-slate-500")}>{w}</div>)}
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-7 overflow-hidden border-l border-slate-100" style={{ gridTemplateRows: `repeat(${calCells.length / 7}, minmax(0, 1fr))` }}>
                {calCells.map((c) => {
                  const items = c.inMonth ? calItems.get(c.day) || [] : [];
                  return (
                    <div key={c.iso} className={cn("min-h-0 overflow-hidden border-b border-r border-slate-100 p-1.5", !c.inMonth && "bg-slate-50/70", c.inMonth && c.weekend && "bg-slate-50/40")}>
                      <div className={cn("text-[11px] font-semibold tabular-nums", c.inMonth ? "text-ink" : "text-slate-300")}>{c.day}</div>
                      {items.length > 0 && (
                        <div className="mt-1 flex flex-wrap content-start gap-1">
                          {items.map((it, i) => (
                            <span
                              key={i}
                              role="img"
                              aria-label={`${it.lead.name}: ${stageMeta[it.evs[it.evs.length - 1].key]?.label || ""}`}
                              onMouseEnter={(e) => showTip(e, it.lead, c.day, it.evs)}
                              onMouseLeave={() => setTip(null)}
                              onClick={(e) => (tip && tip.lead.id === it.lead.id && tip.day === c.day ? setTip(null) : showTip(e, it.lead, c.day, it.evs))}
                              className="h-4 w-4 cursor-pointer rounded-[4px]"
                              style={{ background: stageMeta[it.evs[it.evs.length - 1].key]?.hex }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        </div>
      );
      return typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
    }
    const Wrap = isFull ? "div" : Panel;
    return (
      <Wrap className={isFull ? "fixed inset-0 z-[80] flex flex-col bg-white" : "overflow-hidden"}>
        {isFull && (
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
            <div>
              <div className="font-display text-[15px] font-bold tracking-[-0.02em] text-ink">Timeline {MONTHS[month - 1]} {year}{orgName ? ` · ${orgName}` : ""}</div>
              <div className="text-[11px] text-slate-500">{masterRows.length} lead. Arahkan kursor ke kotak berwarna untuk melihat rinciannya.</div>
            </div>
            <button type="button" onClick={() => setFull(false)} aria-label="Tutup layar penuh" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><X size={18} /></button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3 text-[11.5px] text-slate-600">
          <span className="font-semibold text-slate-700">Warna tahap</span>
          {stages.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.hex }} />{s.label}</span>)}
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-0.5 text-slate-600" role="group" aria-label="Zoom timeline">
            <button type="button" onClick={() => setZoomIdx((z) => Math.max(0, z - 1))} disabled={zoomIdx === 0} aria-label="Perkecil" className="rounded-full p-1 hover:bg-slate-100 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><ZoomOut size={14} /></button>
            <button type="button" onClick={() => setZoomIdx(2)} title="Kembali ke 100%" className="min-w-[40px] text-center text-[11px] font-semibold tabular-nums hover:text-ink">{Math.round(zoom * 100)}%</button>
            <button type="button" onClick={() => setZoomIdx((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoomIdx === ZOOMS.length - 1} aria-label="Perbesar" className="rounded-full p-1 hover:bg-slate-100 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"><ZoomIn size={14} /></button>
            <span className="mx-0.5 h-4 w-px bg-slate-200" aria-hidden="true" />
            <button type="button" onClick={() => { setTip(null); setFull((f) => !f); }} aria-label={isFull ? "Tutup layar penuh" : "Layar penuh"} title={isFull ? "Tutup layar penuh (Esc)" : "Buka layar penuh"} className="rounded-full p-1 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">{isFull ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
          </span>
        </div>
        {masterRows.length === 0 ? (
          <div className="border-t border-slate-100 px-5 py-5"><EmptyState>Belum ada lead pada bulan ini. Data masuk dan perpindahan tahap tim muncul di sini otomatis.</EmptyState></div>
        ) : (
          <div className={isFull ? "flex-1 overflow-auto border-t border-slate-100" : "overflow-x-auto border-t border-slate-100"}>
            <table className="border-collapse text-left">
              <thead>
                <tr className="bg-slate-50/60">
                  <th colSpan={COLS.length} className={cn(th, "sticky left-0 z-10 bg-slate-50")}>{masterRows.length} lead</th>
                  <th colSpan={daysInMonth} className="border-l border-slate-200 bg-slate-100/70 px-2 py-1.5 text-left text-[12px] font-bold tracking-[0.04em] text-ink">{MONTHS[month - 1].toUpperCase()} {year}</th>
                </tr>
                <tr className="bg-slate-50/60">
                  <th colSpan={COLS.length} className={cn(th, "sticky left-0 z-10 bg-slate-50")} />
                  {weeks.map(([a, b], i) => <th key={i} colSpan={b - a + 1} className="border-l border-slate-200 px-1 py-2 text-center text-[10.5px] font-semibold text-slate-500">Minggu ke-{i + 1} ({a}–{b} {MONTHS[month - 1].slice(0, 3)})</th>)}
                </tr>
                <tr className="border-y border-slate-100 bg-slate-50/60">
                  {COLS.map(([c, cls], k) => <th key={c} className={cn(th, cls.includes("text-right") && "!text-right", k === 0 && "sticky left-0 z-10 bg-slate-50", k === 2 && "sticky left-10 z-10 bg-slate-50")}>{c}</th>)}
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i} style={{ width: Math.round(26 * zoom), minWidth: Math.round(26 * zoom), fontSize: Math.max(9, Math.round(10 * zoom)) }} className={cn("px-0 py-1 text-center font-semibold text-slate-500", [0, 7, 14, 21].includes(i) && "border-l border-slate-200")}>
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
                      const evs = d.events.get(r.lead.id)?.get(k + 1);
                      const meta = evs ? stageMeta[evs[evs.length - 1].key] : null;
                      const show = (e) => { const b = e.currentTarget.getBoundingClientRect(); setTip({ x: b.left + b.width / 2, top: b.top, bottom: b.bottom, lead: r.lead, day: k + 1, evs }); };
                      return (
                        <td key={k} onMouseEnter={evs ? show : undefined} onMouseLeave={() => setTip(null)} onClick={evs ? (e) => (tip && tip.lead.id === r.lead.id && tip.day === k + 1 ? setTip(null) : show(e)) : undefined} className={cn("p-0.5", evs && "cursor-pointer", [0, 7, 14, 21].includes(k) && "border-l border-slate-200")}>
                          <div className="rounded-[4px]" style={{ width: Math.round(20 * zoom), height: Math.round(24 * zoom), ...(meta ? { background: meta.hex } : {}) }} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Wrap>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[15px] font-bold tracking-[-0.02em] text-ink">Report data retail dan project</h2>
          <p className="mt-0.5 text-[11.5px] text-slate-500">Urutan seperti laporan Excel: tabel induk dengan timeline harian, daftar per tahap, proyek bulan lalu, lalu ringkasan bobot.</p>
        </div>
        <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><Download size={14} /> Unduh Excel</button>
      </div>

      {timeline(full)}

      {d.sections.map((s) => <Table key={s.key} s={s} />)}
      {d.prior.map((s) => <Table key={s.key} s={s} />)}

      {tip && typeof document !== "undefined" && (() => {
        const up = tip.top > 190;
        const left = Math.min(Math.max(tip.x, 150), (typeof window !== "undefined" ? window.innerWidth : 1200) - 150);
        const date = new Date(year, month - 1, tip.day);
        return createPortal(
          <div role="tooltip" className="pointer-events-none fixed z-[90] w-[272px] rounded-inner border border-slate-200 bg-white p-3 shadow-float" style={{ left, top: up ? tip.top - 8 : tip.bottom + 8, transform: up ? "translate(-50%, -100%)" : "translate(-50%, 0)" }}>
            <div className="truncate text-[12.5px] font-bold text-ink">{tip.lead.name}</div>
            <div className="text-[11px] text-slate-500">{DAYS_LONG[date.getDay()]}, {tip.day} {MONTHS[month - 1]} {year}</div>
            <ul className="mt-2 space-y-1.5">
              {tip.evs.map((e, i) => {
                const to = stageMeta[e.key];
                const from = e.from ? stageMeta[e.from] : null;
                const who = e.by ? nameOf(e.by) : "";
                return (
                  <li key={i} className="text-[12px]">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: to?.hex }} />{e.created ? "Lead dibuat" : to?.label || e.key}</div>
                    <div className="ml-4 text-[11px] text-slate-500">
                      {e.estimated ? "Perkiraan, belum ada riwayat pindah tahap" : e.created ? `Tahap awal: ${to?.label || e.key}` : `${from?.label || "-"} → ${to?.label || e.key}`}
                      {(who || e.at) && <div>{[who && `oleh ${who}`, e.at && timeWib(e.at)].filter(Boolean).join(" · ")}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
              {num(tip.lead.deal_value) > 0 && <span>Nilai <b className="text-slate-700">{fmtRp(num(tip.lead.deal_value))}</b></span>}
              {String(tip.lead.custom_field_1 || "").trim() && <span>SPH <b className="text-slate-700">{String(tip.lead.custom_field_1).trim()}</b></span>}
              {tip.lead.company_type && <span>{tip.lead.company_type}</span>}
            </div>
          </div>,
          document.body
        );
      })()}

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
