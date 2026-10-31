import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import { fmtRp, reasonCategoriesFor, todayISO } from "../lib/helpers";
import { MEMO_FIELDS, memoComplete } from "../lib/proyekMemo";

// Papan kanban tahap lead. Kartu diseret dengan pointer (mouse atau sentuh): kartu ikut kursor, kolom tujuan menyala,
// dan kolom yang panjang atau papan yang lebar digulir otomatis saat kursor dekat tepinya. Kartu langsung pindah di layar,
// lalu disimpan di belakang layar. Kalau gagal, kartu kembali ke tempat semula. Pindah ke Menang atau Kalah membuka pop-up
// alasan (dan nilai deal untuk Menang). Di HP, pakai menu tahap di kartu.
const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
const daysAgo = (d) => {
  if (!d) return null;
  const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return Number.isNaN(n) ? null : n;
};
const START_DISTANCE = 6; // piksel sebelum tekanan dianggap geser, bukan klik
const UNKNOWN_KEY = "__unknown"; // kolom untuk lead dengan tahap yang tidak ada di pipeline
const EDGE = 110; // jarak dari tepi yang memicu gulir otomatis
const MAX_SPEED = 26; // piksel per frame saat kursor tepat di tepi

// Gaya bilah geser papan Kanban: track abu-abu (slate-300, lebih jelas) 6px dan thumb oranye Nexto (orange-600) 18px.
const NX_RANGE_CSS = `
.nx-kanban-range{-webkit-appearance:none;appearance:none;width:100%;height:18px;background:transparent;cursor:pointer}
.nx-kanban-range:focus-visible{outline:2px solid #ea580c;outline-offset:2px;border-radius:999px}
.nx-kanban-range::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:#cbd5e1}
.nx-kanban-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;margin-top:-6px;border-radius:50%;background:#ea580c;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(15,23,42,.25)}
.nx-kanban-range::-moz-range-track{height:6px;border-radius:999px;background:#cbd5e1}
.nx-kanban-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#ea580c;border:2px solid #ffffff;box-shadow:0 1px 4px rgba(15,23,42,.25)}
`;

export default function LeadBoard({ leads, stages, onOpenEdit, onMove, onNewOpportunity, projectDeal = false, invoicePipeline = false, onEditFaktur }) {
  const cols = useMemo(() => [...stages].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [stages]);
  const firstNormal = cols.find((s) => s.type === "normal");
  const [drag, setDrag] = useState(null); // { lead, x, y, offX, offY, w } selama kartu diseret
  const [overKey, setOverKey] = useState(null);
  // Perubahan yang sudah tampil tapi belum tercermin dari data: id -> tahap baru.
  const [pending, setPending] = useState({});
  // Pop-up alasan menang / kalah (muncul setelah kartu dipindah).
  const [closing, setClosing] = useState(null);
  // Pop-up data proyek saat kartu digeser ke Proyek Deal (tanggal, nilai, No. SPH, total diskon wajib).
  const [proyek, setProyek] = useState(null);
  const [dealStage, setDealStage] = useState(null); // pipeline faktur (MAP): pop-up tahap Deal
  // Pop-up tanggal selesai dan catatan saat kartu digeser ke Proyek Selesai (pipeline BSB).
  const [selesai, setSelesai] = useState(null);
  // Saran nama barang: produk yang sudah pernah dipakai di organisasi ini (tanpa duplikat beda huruf besar-kecil).
  const productOptions = useMemo(() => {
    const seen = new Map();
    for (const l of leads || []) {
      const p = String(l.product || "").trim();
      if (p && !seen.has(p.toLowerCase())) seen.set(p.toLowerCase(), p);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, "id"));
  }, [leads]);
  const [fakturEdit, setFakturEdit] = useState(null); // pipeline faktur (MAP): edit data faktur dari kartu
  const press = useRef(null);
  const suppressClick = useRef(false);
  const boardRef = useRef(null);
  // Bilah geser di atas papan: slider sendiri (selalu terlihat, tidak tergantung scrollbar browser).
  const [overflowPx, setOverflowPx] = useState(0);
  const [scrollPos, setScrollPos] = useState(0);
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return undefined;
    const measure = () => setOverflowPx(Math.max(0, board.scrollWidth - board.clientWidth));
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) { ro.observe(board); Array.from(board.children).forEach((c) => ro.observe(c)); }
    window.addEventListener("resize", measure);
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [leads, stages]);

  // Buang perubahan yang sudah tercermin di data (berarti penyimpanan selesai dan daftar sudah diperbarui).
  useEffect(() => {
    setPending((p) => {
      const next = { ...p };
      let changed = false;
      for (const l of leads) {
        if (next[l.id] && next[l.id] === l.stage_key) { delete next[l.id]; changed = true; }
      }
      return changed ? next : p;
    });
  }, [leads]);

  const stageOf = (l) => pending[l.id] || l.stage_key;

  // Pindah tahap: kartu terangkat (pop-up) di kolom asal, lalu meluncur ke kolom tujuan. Posisi awal dicatat sebelum
  // perubahan, lalu dianimasikan setelah kolom baru dirender (FLIP).
  const flipRef = useRef(null);
  const flipMove = (lead, fn, fromRect = null) => {
    const r0 = fromRect || document.querySelector(`[data-lead-id="${lead.id}"]`)?.getBoundingClientRect();
    if (r0) flipRef.current = { id: lead.id, r0 };
    fn();
  };
  useLayoutEffect(() => {
    const f = flipRef.current;
    if (!f) return;
    flipRef.current = null;
    const el = document.querySelector(`[data-lead-id="${f.id}"]`);
    if (!el || typeof el.animate !== "function") return;
    const r1 = el.getBoundingClientRect();
    const dx = f.r0.left - r1.left;
    const dy = f.r0.top - r1.top;
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1)`, boxShadow: "0 1px 2px rgba(15,23,42,0.04)", offset: 0 },
        { transform: `translate(${dx}px, ${dy - 22}px) scale(1.07)`, boxShadow: "0 26px 44px -14px rgba(15,23,42,0.42)", offset: 0.38 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - 10}px) scale(1.03)`, boxShadow: "0 16px 30px -14px rgba(15,23,42,0.28)", offset: 0.72 },
        { transform: "translate(0px, 0px) scale(1)", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", offset: 1 },
      ],
      { duration: 620, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
    );
    // Kolom tujuan menyala sebentar saat kartu mendarat, supaya tujuan perpindahan langsung terlihat.
    const col = el.closest("[data-stage]");
    if (col && typeof col.animate === "function") {
      col.animate(
        [
          { boxShadow: "inset 0 0 0 0 rgba(249,115,22,0)" },
          { boxShadow: "inset 0 0 0 2px rgba(249,115,22,0.55)", offset: 0.25 },
          { boxShadow: "inset 0 0 0 0 rgba(249,115,22,0)" },
        ],
        { duration: 700, delay: 560, easing: "ease-out" }
      );
    }
  });

  const moveTo = (lead, key, fromRect = null) => {
    if (!lead || key === UNKNOWN_KEY || stageOf(lead) === key) return;
    const target = cols.find((s) => s.key === key);
    if (target?.type === "won" || target?.type === "lost") {
      setPending((p) => ({ ...p, [lead.id]: key }));
      setClosing({ lead, key, result: target.type });
      return;
    }
    // Pipeline faktur (MAP): pindah ke tahap Deal minta tanggal dan barang.
    if (key === "proses_so" && invoicePipeline) {
      setPending((p) => ({ ...p, [lead.id]: key }));
      setDealStage({ lead, key });
      return;
    }
    // Pop-up data proyek muncul di pipeline yang punya tahap Proyek Berjalan (pipeline BSB), tidak hanya di org project_deal.
    if (key === "proyek_deal" && cols.some((c) => c.key === "proyek_berjalan")) {
      setPending((p) => ({ ...p, [lead.id]: key }));
      setProyek({ lead, key });
      return;
    }
    // Pop-up tanggal selesai dan catatan saat kartu digeser ke Proyek Selesai (pipeline BSB).
    if (key === "proyek_selesai" && cols.some((c) => c.key === "proyek_berjalan")) {
      setPending((p) => ({ ...p, [lead.id]: key }));
      setSelesai({ lead, key });
      return;
    }
    flipMove(lead, () => setPending((p) => ({ ...p, [lead.id]: key })), fromRect);
    Promise.resolve(onMove(lead, key)).catch((e) => {
      setPending((p) => { const n = { ...p }; delete n[lead.id]; return n; });
      alert("Gagal pindah tahap: " + (e?.message || e));
    });
  };

  const cancelClose = () => {
    if (closing) setPending((p) => { const n = { ...p }; delete n[closing.lead.id]; return n; });
    setClosing(null);
  };

  const cancelProyek = () => {
    if (proyek) setPending((p) => { const n = { ...p }; delete n[proyek.lead.id]; return n; });
    setProyek(null);
  };

  const cancelSelesai = () => {
    if (selesai) setPending((p) => { const n = { ...p }; delete n[selesai.lead.id]; return n; });
    setSelesai(null);
  };

  const saveSelesai = (values) => {
    const { lead, key } = selesai;
    setSelesai(null);
    Promise.resolve(onMove(lead, key, { selesai: values })).catch((e) => {
      setPending((p) => { const n = { ...p }; delete n[lead.id]; return n; });
      alert("Gagal menyimpan: " + (e?.message || e));
    });
  };

  const cancelDealStage = () => {
    if (dealStage) setPending((p) => { const n = { ...p }; delete n[dealStage.lead.id]; return n; });
    setDealStage(null);
  };

  const saveDealStage = (values) => {
    const { lead, key } = dealStage;
    setDealStage(null);
    Promise.resolve(onMove(lead, key, { dealStage: values })).catch((e) => {
      setPending((p) => { const n = { ...p }; delete n[lead.id]; return n; });
      alert("Gagal menyimpan: " + (e?.message || e));
    });
  };

  const saveProyek = (values) => {
    const { lead, key } = proyek;
    setProyek(null);
    Promise.resolve(onMove(lead, key, { projectDeal: values })).catch((e) => {
      setPending((p) => { const n = { ...p }; delete n[lead.id]; return n; });
      alert("Gagal menyimpan: " + (e?.message || e));
    });
  };

  const saveClose = (category, note, deal, wonDate) => {
    const { lead, key, result } = closing;
    setClosing(null);
    Promise.resolve(onMove(lead, key, { result, reason_category: category, note, deal, wonDate })).catch((e) => {
      setPending((p) => { const n = { ...p }; delete n[lead.id]; return n; });
      alert("Gagal menyimpan: " + (e?.message || e));
    });
  };

  // ---- Seret dengan pointer ----
  const stageAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const col = el?.closest?.("[data-stage]");
    return col ? col.dataset.stage : null;
  };

  // Gulir kolom di bawah kursor saat kursor dekat tepi atas atau bawah, dan papan saat dekat tepi kiri atau kanan.
  // Kecepatan gulir naik sedikit demi sedikit saat kursor makin dekat tepi (0 jika masih jauh dari tepi).
  const edgeSpeed = (dist) => (dist >= EDGE ? 0 : Math.ceil(((EDGE - dist) / EDGE) * MAX_SPEED));
  const autoScroll = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const list = el?.closest?.("[data-list]");
    if (list) {
      const r = list.getBoundingClientRect();
      list.scrollTop -= edgeSpeed(y - r.top);
      list.scrollTop += edgeSpeed(r.bottom - y);
    }
    const board = boardRef.current;
    if (board) {
      const r = board.getBoundingClientRect();
      board.scrollLeft -= edgeSpeed(x - r.left);
      board.scrollLeft += edgeSpeed(r.right - x);
    }
  };

  const onCardPointerDown = (e, lead) => {
    if (e.button !== 0 || e.target.closest("select")) return;
    suppressClick.current = false;
    const rect = e.currentTarget.getBoundingClientRect();
    // Posisi kursor terakhir dan loop gulir per frame: papan tetap bergulir walau kursor diam di tepi.
    let pos = null;
    let raf = 0;
    const tick = () => {
      if (pos) {
        autoScroll(pos.x, pos.y);
        setOverKey(stageAt(pos.x, pos.y));
      }
      raf = requestAnimationFrame(tick);
    };
    const onMove = (ev) => {
      const p = press.current;
      if (!p) return;
      if (!p.active) {
        if (Math.hypot(ev.clientX - p.sx, ev.clientY - p.sy) < START_DISTANCE) return;
        p.active = true;
        document.body.style.userSelect = "none";
        setDrag({ lead: p.lead, x: ev.clientX, y: ev.clientY, offX: p.offX, offY: p.offY, w: p.w });
        raf = requestAnimationFrame(tick);
      }
      pos = { x: ev.clientX, y: ev.clientY };
      setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d));
      setOverKey(stageAt(ev.clientX, ev.clientY));
    };
    const onUp = (ev) => {
      const p = press.current;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      cancelAnimationFrame(raf);
      press.current = null;
      if (!p || !p.active) return;
      document.body.style.userSelect = "";
      suppressClick.current = true;
      setDrag(null);
      setOverKey(null);
      const key = stageAt(ev.clientX, ev.clientY);
      if (key) moveTo(p.lead, key, { left: ev.clientX - p.offX, top: ev.clientY - p.offY });
    };
    press.current = { lead, sx: e.clientX, sy: e.clientY, offX: e.clientX - rect.left, offY: e.clientY - rect.top, w: rect.width, active: false };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // Hapus pendengar kalau papan ditutup di tengah geseran.
  useEffect(() => () => { document.body.style.userSelect = ""; }, []);

  // Lead yang tahapnya sudah tidak ada di pipeline (mis. tahap lama dari impor) tetap ditampilkan di kolom khusus,
  // supaya tidak hilang dari Kanban. Lead itu bisa diseret ke tahap yang benar.
  const knownKeys = new Set(cols.map((s) => s.key));
  const orphans = leads.filter((l) => !knownKeys.has(stageOf(l)));
  const boardCols = orphans.length ? [...cols, { key: UNKNOWN_KEY, label: "Tahap tidak dikenal", hex: "#94a3b8", type: "normal", unknown: true }] : cols;
  const board = boardCols.map((s) => ({ stage: s, items: s.unknown ? orphans : leads.filter((l) => stageOf(l) === s.key) }));
  const accent = (s) => s.hex || "#94a3b8";

  return (
    <div className="mt-1">
      {overflowPx > 0 && (() => {
        // Rentang tahap yang sedang terlihat (perkiraan dari lebar tiap kolom).
        const total = (stages || []).length || 1;
        const viewW = boardRef.current?.clientWidth || 0;
        const colW = (overflowPx + viewW) / total;
        const first = Math.min(total, Math.floor(scrollPos / colW) + 1);
        const last = Math.min(total, Math.ceil((scrollPos + viewW) / colW));
        const step = (dir) => boardRef.current?.scrollBy({ left: dir * viewW * 0.6, behavior: "smooth" });
        const navBtn = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50 disabled:cursor-default disabled:opacity-40";
        return (
          <>
            <style>{NX_RANGE_CSS}</style>
            <div className="mb-2 flex items-center gap-2">
              <button type="button" onClick={() => step(-1)} disabled={scrollPos <= 0} className={navBtn} aria-label="Geser ke kiri"><ChevronLeft size={14} /></button>
              <input
                type="range"
                className="nx-kanban-range min-w-0 flex-1"
                min={0}
                max={overflowPx}
                value={Math.min(scrollPos, overflowPx)}
                onChange={(e) => { const v = Number(e.target.value); setScrollPos(v); if (boardRef.current) boardRef.current.scrollLeft = v; }}
                aria-label="Geser papan ke kiri atau kanan"
              />
              <button type="button" onClick={() => step(1)} disabled={scrollPos >= overflowPx - 1} className={navBtn} aria-label="Geser ke kanan"><ChevronRight size={14} /></button>
              <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold tabular-nums text-slate-500">Tahap {first}–{last} dari {total}</span>
            </div>
          </>
        );
      })()}
    <div ref={boardRef} onScroll={(e) => setScrollPos(e.currentTarget.scrollLeft)} className="overflow-x-auto pb-4">
      {closing && <CloseDialog closing={closing} onCancel={cancelClose} onSave={saveClose} projectDeal={projectDeal} invoicePipeline={invoicePipeline} productOptions={productOptions} />}
      {dealStage && <DealStageDialog lead={dealStage.lead} onCancel={cancelDealStage} onSave={saveDealStage} productOptions={productOptions} />}
      {fakturEdit && (
        <FakturEditDialog
          lead={fakturEdit}
          onCancel={() => setFakturEdit(null)}
          onSave={(values) => { const lead = fakturEdit; setFakturEdit(null); Promise.resolve(onEditFaktur?.(lead, values)).catch((e) => alert("Gagal menyimpan faktur: " + (e?.message || e))); }}
        />
      )}
      {proyek && <ProyekDealDialog lead={proyek.lead} onCancel={cancelProyek} onSave={saveProyek} />}
      {selesai && <SelesaiDialog lead={selesai.lead} onCancel={cancelSelesai} onSave={saveSelesai} />}

      {/* Kartu yang diseret dirender di body: posisi "fixed" harus mengacu ke layar, bukan ke wrapper yang punya transform. */}
      {drag && createPortal(
        <div
          className="pointer-events-none fixed left-0 top-0 z-[60] rounded-xl border border-slate-300 bg-white p-3 shadow-[0_18px_40px_-12px_rgba(15,23,42,0.35)]"
          style={{ transform: `translate(${drag.x - drag.offX}px, ${drag.y - drag.offY}px)`, width: drag.w }}
        >
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">{initials(drag.lead.name)}</div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold text-slate-900">{drag.lead.name}</div>
              <div className="truncate text-[11px] text-slate-500">{drag.lead.deal_value ? fmtRp(drag.lead.deal_value) : "Nilai belum diisi"}</div>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex min-w-max items-stretch gap-4" style={{ height: "calc(100vh - 15rem)", minHeight: "420px" }}>
        {board.map(({ stage: s, items }) => {
          const total = items.reduce((n, l) => n + (Number(l.deal_value) || 0), 0);
          const hi = drag && overKey === s.key;
          return (
            <section
              key={s.key}
              data-stage={s.key}
              className={`flex h-full w-[264px] shrink-0 flex-col rounded-2xl border bg-white transition-all duration-150 ${hi ? "border-orange-400 bg-orange-50/50 ring-4 ring-orange-100" : "border-slate-200/80"}`}
            >
              <header className="px-3.5 pt-3">
                <div className="h-1 w-full rounded-full" style={{ backgroundColor: accent(s) }} />
                <div className="flex items-center justify-between pb-2 pt-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent(s) }} />
                    <span className="truncate text-[13px] font-semibold text-slate-800">{s.label}</span>
                    <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold tabular-nums text-slate-500">{items.length}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">{fmtRp(total)}</span>
                </div>
              </header>

              <div data-list={s.key} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-3">
                {items.map((l) => {
                  const days = daysAgo(l.last_contact);
                  const cold = days === null || days > 7;
                  const moving = pending[l.id];
                  const isDragging = drag?.lead?.id === l.id;
                  return (
                    <article
                      key={l.id}
                      data-lead-id={l.id}
                      onPointerDown={(e) => onCardPointerDown(e, l)}
                      className={`group relative cursor-grab touch-pan-y select-none rounded-xl border border-slate-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[box-shadow,border-color,opacity] duration-150 hover:border-slate-300 hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,0.18)] active:cursor-grabbing ${cold ? "border-l-[3px] border-l-rose-400" : ""} ${isDragging ? "opacity-30" : ""} ${moving ? "ring-2 ring-orange-200" : ""}`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-[11px] font-bold text-white">{initials(l.name)}</div>
                        <button
                          type="button"
                          onClick={() => { if (!suppressClick.current) onOpenEdit(l); }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-[13px] font-semibold leading-tight text-slate-900">{l.name}</div>
                          <div className="mt-0.5 truncate text-[11.5px] text-slate-500">{[l.city, l.product].filter(Boolean).join(" · ") || "Belum ada detail"}</div>
                        </button>
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className={`text-[15px] font-semibold tabular-nums leading-none ${l.deal_value ? "text-slate-900" : "text-slate-400"}`}>
                          {l.deal_value ? fmtRp(l.deal_value) : "Nilai belum diisi"}
                        </span>
                        <span className={`shrink-0 text-[10.5px] font-medium ${cold ? "text-rose-600" : "text-slate-500"}`}>
                          {days === null ? "belum dihubungi" : days === 0 ? "hari ini" : `${days} hari lalu`}
                        </span>
                      </div>
                      {l.visit_date && (
                        <div className="mt-1.5 text-[11px] text-slate-500">Visit {new Date(l.visit_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</div>
                      )}

                      {invoicePipeline && s.type === "won" && (
                        <div className="mt-2.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[11.5px] text-slate-600">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{l.invoice_number ? `Faktur ${l.invoice_number}` : "Belum ada no. faktur"}</span>
                            <div className="shrink-0 text-right">
                              <div className="font-semibold tabular-nums text-slate-800">{fmtRp(Number(l.deal_value) || 0)}</div>
                              {l.payment_type ? (
                                <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-[10.5px] font-medium text-slate-700">{l.payment_type}</span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { if (!suppressClick.current) setFakturEdit(l); }}
                                  className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-medium text-amber-700 hover:bg-amber-100"
                                >
                                  + Tipe payment
                                </button>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { if (!suppressClick.current) setFakturEdit(l); }}
                            className="mt-1.5 text-[11.5px] font-semibold text-orange-700 hover:text-orange-800"
                          >
                            Edit faktur
                          </button>
                        </div>
                      )}

                      {s.type === "won" && firstNormal && (
                        <button
                          type="button"
                          onClick={() => { if (!suppressClick.current) onNewOpportunity(l, firstNormal.key); }}
                          className="mt-2.5 flex w-full items-center justify-center rounded-lg border border-orange-200 bg-orange-50/60 px-2 py-1.5 text-[11.5px] font-semibold text-orange-700 transition hover:bg-orange-100"
                        >
                          Peluang baru (repeat order)
                        </button>
                      )}

                      <select
                        aria-label="Pindah tahap"
                        value={stageOf(l)}
                        onChange={(e) => moveTo(l, e.target.value)}
                        className="mt-2.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11.5px] text-slate-600 md:hidden"
                      >
                        {cols.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                      </select>

                      {/* Status proyek di kartu (17 Okt 2026, BSB): pilih Berjalan langsung memindahkan lead ke Proyek Berjalan. */}
                      {stageOf(l) === "proyek_deal" && cols.some((c) => c.key === "proyek_berjalan") && (
                        <select
                          aria-label="Status proyek"
                          value="belum"
                          onPointerDown={(e) => e.stopPropagation()}
                          onChange={(e) => { if (e.target.value === "berjalan") moveTo(l, "proyek_berjalan"); }}
                          className="mt-2.5 w-full rounded-lg border border-blue-200 bg-blue-50/60 px-2 py-1.5 text-[11.5px] font-medium text-blue-800"
                        >
                          <option value="belum">Belum berjalan</option>
                          <option value="berjalan">Berjalan</option>
                        </select>
                      )}
                    </article>
                  );
                })}

                {items.length === 0 && (
                  <div className={`grid flex-1 place-items-center rounded-xl border border-dashed py-8 text-[11.5px] ${hi ? "border-orange-300 text-orange-600" : "border-slate-200 text-slate-400"}`}>
                    {drag ? "Lepas kartu di sini" : "Belum ada lead"}
                  </div>
                )}
                {hi && items.length > 0 && (
                  <div className="grid place-items-center rounded-xl border border-dashed border-orange-300 py-4 text-[11.5px] font-medium text-orange-600">Lepas di sini</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
      </div>
    </div>
  );
}

// Pop-up data proyek untuk tahap Proyek Deal (15 Okt 2026): tanggal, nilai proyek, No. SPH wajib; total diskon opsional.
// Nilai proyek bruto; diskon dicatat terpisah.
function ProyekDealDialog({ lead, onCancel, onSave }) {
  const [date, setDate] = useState(lead.deal_date || todayISO());
  const [value, setValue] = useState(lead.deal_value ? String(lead.deal_value) : "");
  const [sph, setSph] = useState(lead.sph_number || "");
  const [discount, setDiscount] = useState(lead.discount_pct ? String(lead.discount_pct) : "");
  const dealValue = Number(value.replace(/\D/g, "")) || 0;
  // Diskon dalam persen (17 Okt 2026, BSB); nominal Rp dihitung dari nilai proyek.
  const discountPct = Math.min(100, Math.max(0, Number(discount.replace(/[^\d.]/g, "")) || 0));
  const discountValue = Math.round(dealValue * discountPct / 100);
  // Status proyek (17 Okt 2026, BSB): kalau "Berjalan", lead langsung pindah ke tahap Proyek Berjalan.
  const [berjalan, setBerjalan] = useState(lead.stage_key === "proyek_berjalan");
  // Detil proyek (31 Okt 2026, BSB): langkah 1 data proyek dan detil, langkah 2 memo di halaman berikutnya.
  const [detail, setDetail] = useState(lead.detail_proyek || "");
  const [memo, setMemo] = useState(() => Object.fromEntries(MEMO_FIELDS.map((f) => [f.key, lead.memo?.[f.key] || ""])));
  const [step, setStep] = useState(1);
  const dataReady = !!date && dealValue > 0 && sph.trim().length > 0 && detail.trim().length > 0;
  const memoReady = memoComplete(memo);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const field = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none";
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">Proyek Deal</span>
        <h3 className="mt-2 text-[15px] font-semibold text-slate-900">{step === 1 ? "Data proyek" : "Memo"}</h3>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">{lead.name}</p>
        {step === 1 ? (
          <>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[11px] font-medium text-slate-500">Tanggal deal *</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-slate-500">Nilai proyek *{dealValue ? " · " + fmtRp(dealValue) : ""}</span>
                <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} placeholder="0" className={field + " tabular-nums"} />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-slate-500">No. SPH *</span>
                <input value={sph} onChange={(e) => setSph(e.target.value)} placeholder="Mis. I/10/2026/UPVC/101" className={field} />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-slate-500">Total diskon (%){discountValue ? " · " + fmtRp(discountValue) : ""}</span>
                <input inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" className={field + " tabular-nums"} />
              </label>
            </div>
            <label className="mt-3 block">
              <span className="text-[11px] font-medium text-slate-500">Status proyek</span>
              <select value={berjalan ? "berjalan" : "belum"} onChange={(e) => setBerjalan(e.target.value === "berjalan")} className={field}>
                <option value="belum">Belum berjalan</option>
                <option value="berjalan">Berjalan (pindah ke Proyek Berjalan)</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-[11px] font-medium text-slate-500">Detil proyek *</span>
              <textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={3} placeholder="Ruang lingkup dan detail pekerjaan" className={field + " resize-none"} />
            </label>
          </>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {MEMO_FIELDS.map((f) => (
              <div key={f.key} className={f.wide ? "col-span-2" : ""}>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-500">{f.label}{f.required ? " *" : ""}</span>
                  <input value={memo[f.key]} onChange={(e) => setMemo((m) => ({ ...m, [f.key]: e.target.value }))} placeholder={f.placeholder} className={field} />
                </label>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          {step === 1 ? (
            <>
              <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100">Batal</button>
              <button type="button" disabled={!dataReady} onClick={() => setStep(2)} className="rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">Lanjut ke memo</button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setStep(1)} className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100">Kembali</button>
              <button
                type="button"
                disabled={!memoReady}
                onClick={() => onSave({ date, value: dealValue, sph_number: sph.trim(), discount_pct: discountPct, discount_total: discountValue, berjalan, detail_proyek: detail.trim(), memo: Object.fromEntries(MEMO_FIELDS.map((f) => [f.key, memo[f.key].trim()])) })}
                className="rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
              >
                Simpan
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Pop-up kecil: alasan menang / kalah, plus nilai dan tanggal deal untuk menang, dan catatan opsional.
// Org project_deal (BSB, 17 Okt 2026): nilai dan tanggal proyek sudah diisi di tahap Proyek Deal,
// jadi di sini cukup alasan dan catatan. Record deal dibuat otomatis dari lead ini.
// Edit data faktur dari kartu (pipeline faktur, MAP): tanggal, no. faktur, dan nominal.
// Pilihan tipe payment untuk pipeline faktur (dipakai di dialog faktur dan kartu).
const PAYMENT_TYPES = ["Transfer", "Tunai", "Termin", "Giro", "Kartu kredit", "Lainnya"];

function FakturEditDialog({ lead, onCancel, onSave }) {
  const [date, setDate] = useState(lead.deal_date ? String(lead.deal_date).slice(0, 10) : todayISO());
  const [invoice, setInvoice] = useState(lead.invoice_number || "");
  const [value, setValue] = useState(lead.deal_value ? String(lead.deal_value) : "");
  const [paymentType, setPaymentType] = useState(lead.payment_type || "");
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const nominal = Number(value.replace(/\D/g, "")) || 0;
  const ready = !!date && nominal > 0;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-[15px] font-semibold text-slate-900">Edit faktur</h3>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">{lead.name}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="col-span-2 block">
            <span className="text-[11px] font-medium text-slate-500">No. faktur</span>
            <input value={invoice} onChange={(e) => setInvoice(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-slate-500">Tanggal faktur</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-slate-500">Nominal{nominal ? " · " + fmtRp(nominal) : ""}</span>
            <input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))} placeholder="0" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] tabular-nums focus:border-slate-400 focus:outline-none" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-slate-500">Tipe payment</span>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none">
              <option value="">Belum dipilih</option>
              {PAYMENT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100">Batal</button>
          <button type="button" disabled={!ready} onClick={() => onSave({ date, invoice_number: invoice.trim(), value: nominal, payment_type: paymentType })} className="rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">Simpan</button>
        </div>
      </div>
    </div>
  );
}

// Pop-up tahap Deal (pipeline faktur, MAP): tanggal dan barang.
function DealStageDialog({ lead, onCancel, onSave, productOptions = [] }) {
  const [date, setDate] = useState(lead.deal_stage_date || todayISO());
  const [product, setProduct] = useState(lead.product || "");
  const listId = "nx-product-options-deal";
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const ready = !!date && !!product.trim();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-[15px] font-semibold text-slate-900">Tahap Deal</h3>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">{lead.name}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-medium text-slate-500">Tanggal</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-slate-500">Barang</span>
            <input value={product} onChange={(e) => setProduct(e.target.value)} list={listId} placeholder="Pilih atau ketik barang" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none" />
            <datalist id={listId}>{productOptions.map((p) => <option key={p} value={p} />)}</datalist>
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100">Batal</button>
          <button type="button" disabled={!ready} onClick={() => onSave({ date, product: product.trim() })} className="rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">Simpan</button>
        </div>
      </div>
    </div>
  );
}

// Pop-up Proyek Selesai (pipeline BSB): tanggal selesai wajib, catatan opsional.
function SelesaiDialog({ lead, onCancel, onSave }) {
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  const ready = !!date;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <span className="inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">Proyek Selesai</span>
        <h3 className="mt-2 text-[15px] font-semibold text-slate-900">Proyek selesai</h3>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">{lead.name}</p>
        <label className="mt-4 block">
          <span className="text-[11px] font-medium text-slate-500">Tanggal selesai *</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none" />
        </label>
        <label className="mt-3 block">
          <span className="text-[11px] font-medium text-slate-500">Catatan</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Opsional" className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100">Batal</button>
          <button type="button" disabled={!ready} onClick={() => onSave({ date, note: note.trim() })} className="rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">Simpan</button>
        </div>
      </div>
    </div>
  );
}

function CloseDialog({ closing, onCancel, onSave, projectDeal = false, invoicePipeline = false, productOptions = [] }) {
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");
  const won = closing.result === "won";
  const [value, setValue] = useState(closing.lead.deal_value ? String(closing.lead.deal_value) : "");
  const [date, setDate] = useState(todayISO());
  const [invoice, setInvoice] = useState(closing.lead.invoice_number || "");
  const [product, setProduct] = useState(closing.lead.product || "");
  const dealValue = Number(value.replace(/\D/g, "")) || 0;
  const lockedProject = won && projectDeal;
  const ready = !!category && (!won || dealValue > 0);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${won ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {won ? "Menang" : "Kalah"}
        </span>
        <h3 className="mt-2 text-[15px] font-semibold text-slate-900">Kenapa {won ? "menang" : "kalah"}?</h3>
        <p className="mt-0.5 truncate text-[12px] text-slate-500">{closing.lead.name}</p>
        <div className="mt-4 grid grid-cols-2 gap-1.5">
          {reasonCategoriesFor(closing.result).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`rounded-lg border px-2.5 py-2 text-left text-[12px] transition ${category === c ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
            >
              {c}
            </button>
          ))}
        </div>
        {lockedProject && (
          <>
            <p className={`mt-3 rounded-lg px-3 py-2 text-[11.5px] ${dealValue > 0 ? "bg-slate-50 text-slate-600" : "bg-rose-50 text-rose-700"}`}>
              {dealValue > 0
                ? <>Nilai proyek <b>{fmtRp(dealValue)}</b> akan dicatat ke tab Deal dengan tanggal selesai di bawah.</>
                : "Nilai proyek belum diisi. Isi dulu di tahap Proyek Deal."}
            </p>
            <label className="mt-3 block">
              <span className="text-[11px] font-medium text-slate-500">Tanggal selesai</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none"
              />
            </label>
          </>
        )}
        {won && !projectDeal && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            {invoicePipeline && (
              <>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-500">No. faktur</span>
                  <input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Nomor faktur" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-slate-500">Barang</span>
                  <input value={product} onChange={(e) => setProduct(e.target.value)} list="nx-product-options-close" placeholder="Pilih atau ketik barang" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none" />
                  <datalist id="nx-product-options-close">{productOptions.map((p) => <option key={p} value={p} />)}</datalist>
                </label>
              </>
            )}
            <label className="block">
              <span className="text-[11px] font-medium text-slate-500">{invoicePipeline ? "Nominal faktur" : "Nilai deal"}{dealValue ? " · " + fmtRp(dealValue) : ""}</span>
              <input
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] tabular-nums focus:border-slate-400 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-slate-500">{invoicePipeline ? "Tanggal faktur" : "Tanggal deal"}</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none"
              />
            </label>
          </div>
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Catatan singkat (opsional)"
          className="mt-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[12.5px] focus:border-slate-400 focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100">Batal</button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => onSave(category, note.trim(), won && !projectDeal ? { value: dealValue, date, ...(invoicePipeline ? { invoice_number: invoice.trim(), product: product.trim() } : {}) } : null, lockedProject ? date : null)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}
