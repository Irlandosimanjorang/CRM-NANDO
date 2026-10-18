import { useMemo, useState, useEffect } from "react";
import { Trophy, Eye, EyeOff, ChevronDown, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import * as db from "../lib/db";
import { stageMeta, chipStyle, typeBadge, fmtRp, fmtDate } from "../lib/helpers";
import { getFieldLabel, getQuantityUnits } from "../lib/industryTemplates";

// Label satuan dari daftar satuan industri; fallback ke kode mentah.
const unitLabel = (units, v) => ((units || []).find((u) => u.v === v)?.label || v || "").toLowerCase();

// Total jumlah per satuan (30 Sep 2026, audit istilah per industri -
// sebelumnya selalu dikonversi ke "ton" di semua industri). Kg digabung ke
// ton kalau industrinya pakai dua-duanya (PVC/kimia).
function qtyTotals(deals, units) {
  const byUnit = {};
  const hasTonKg = units?.some((u) => u.v === "ton") && units?.some((u) => u.v === "kg");
  for (const d of deals) {
    let n = Number(d.tonnage) || 0;
    if (!n) continue;
    let u = d.tonnage_unit || units?.[0]?.v || "";
    if (hasTonKg && u === "kg") { n = n / 1000; u = "ton"; }
    byUnit[u] = (byUnit[u] || 0) + n;
  }
  return Object.entries(byUnit).map(([u, n]) => ({ unit: u, n }));
}

// Bulan dalam format YYYY-MM -> "Oktober 2026".
const namaBulan = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
const labelBulanSingkat = (ym) => new Date(`${ym}-01T00:00:00`).toLocaleDateString("id-ID", { month: "short" });

// Grafik garis kecil omzet 6 bulan. Satu-satunya elemen yang menonjol: titik bulan ini.
function Sparkline({ values }) {
  const w = 156, h = 46, pad = 5;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Omzet 6 bulan terakhir" className="overflow-visible">
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="#e2e8f0" strokeWidth="1" />
      <path d={d} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3.5" fill="#f97316" />
    </svg>
  );
}

export default function Deal({ leads, stages, dealTransactions, industry, onEdit, onChanged, projectDeal = false }) {
  const quantityLabel = getFieldLabel(industry, "quantity", "Quantity");
  const units = getQuantityUnits(industry);
  const [qtyRevealed, setQtyRevealed] = useState(false);
  const [rpRevealed, setRpRevealed] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const leadsById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);
  const labelTahap = useMemo(() => Object.fromEntries((stages || []).map((s) => [s.key, s.label])), [stages]);

  // Satu aturan deal di semua tab: hanya transaksi milik lead yang sekarang di tahap menang yang ditampilkan.
  // Total nilai = jumlah deal_value lead menang (sama dengan Report dan Komisi).
  const wonIds = useMemo(() => {
    const wonKeys = new Set((stages || []).filter((s) => s.type === "won").map((s) => s.key));
    return new Set((leads || []).filter((l) => !l.deleted_at && wonKeys.has(l.stage_key)).map((l) => l.id));
  }, [leads, stages]);
  const deals = useMemo(() => (dealTransactions || []).filter((t) => wonIds.has(t.lead_id)), [dealTransactions, wonIds]);
  const totalValue = useMemo(() => (leads || []).filter((l) => wonIds.has(l.id)).reduce((a, l) => a + (Number(l.deal_value) || 0), 0), [leads, wonIds]);
  const totals = qtyTotals(deals, units);

  // 1 baris per lead menang. Nilai baris = deal_value lead (satu aturan deal di semua tab).
  // Transaksi di bawahnya (repeat order) hanya rincian, tidak dijumlah lagi.
  const groups = useMemo(() => {
    const txByLead = {};
    for (const t of deals) (txByLead[t.lead_id] ||= []).push(t);
    const dateOf = (g) => String(g.lead?.deal_date || g.txs[0]?.deal_date || "");
    return [...wonIds]
      .map((leadId) => ({
        leadId,
        lead: leadsById[leadId],
        txs: (txByLead[leadId] || []).slice().sort((a, b) => String(b.deal_date || "").localeCompare(String(a.deal_date || ""))),
      }))
      .sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  }, [deals, wonIds, leadsById]);

  // Dikelompokkan per bulan deal (terbaru di atas), dengan subtotal dan nilai terbesar tiap bulan.
  const bulanKey = (g) => String(g.lead?.deal_date || g.txs[0]?.deal_date || "").slice(0, 7);
  const monthGroups = useMemo(() => {
    const map = new Map();
    for (const g of groups) {
      const ym = bulanKey(g) || "Tanpa tanggal";
      if (!map.has(ym)) map.set(ym, []);
      map.get(ym).push(g);
    }
    return [...map.entries()].map(([ym, items]) => {
      const nilai = items.map((g) => Number(g.lead?.deal_value) || 0);
      return { ym, items, total: nilai.reduce((a, b) => a + b, 0), max: Math.max(0, ...nilai) };
    });
  }, [groups]);

  // Enam bulan terakhir (WIB) untuk grafik omzet di ringkasan.
  const bulanIni = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" }).slice(0, 7);
  const enamBulan = useMemo(() => {
    const [y, m] = bulanIni.split("-").map(Number);
    return Array.from({ length: 6 }, (_, i) => new Date(Date.UTC(y, m - 1 - (5 - i), 1)).toISOString().slice(0, 7));
  }, [bulanIni]);
  const omzetPerBulan = useMemo(() => {
    const map = Object.fromEntries(enamBulan.map((k) => [k, 0]));
    for (const g of groups) {
      const k = bulanKey(g);
      if (k in map) map[k] += Number(g.lead?.deal_value) || 0;
    }
    return enamBulan.map((k) => map[k]);
  }, [groups, enamBulan]);

  // Tracking per bulan: pilih satu bulan (atau "all" untuk semua). Default bulan berjalan.
  const [bulanPilih, setBulanPilih] = useState(bulanIni);
  const shiftBulan = (ym, d) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + d, 1)).toISOString().slice(0, 7); };
  const grupBulan = bulanPilih === "all" ? null : monthGroups.find((g) => g.ym === bulanPilih) || null;
  const totalBulan = bulanPilih === "all" ? totalValue : (grupBulan?.total || 0);
  const jumlahBulan = bulanPilih === "all" ? groups.length : (grupBulan?.items.length || 0);
  const totalBulanLalu = bulanPilih === "all" ? 0 : (monthGroups.find((g) => g.ym === shiftBulan(bulanPilih, -1))?.total || 0);
  const selisihPersen = totalBulanLalu > 0 ? Math.round(((totalBulan - totalBulanLalu) / totalBulanLalu) * 100) : null;
  // Target tim bulan terpilih dari tab Team (sales_targets). Kosong kalau belum diisi atau tidak punya akses.
  const [targetBulan, setTargetBulan] = useState(0);
  useEffect(() => {
    if (bulanPilih === "all") { setTargetBulan(0); return undefined; }
    let alive = true;
    db.getTeamTargets(`${bulanPilih}-01`)
      .then((rows) => { if (alive) setTargetBulan((rows || []).reduce((s, x) => s + (Number(x.target) || 0), 0)); })
      .catch(() => { if (alive) setTargetBulan(0); });
    return () => { alive = false; };
  }, [bulanPilih]);

  // Jejak tahap per lead, dari riwayat perpindahan tahap. Dimuat ulang saat data tim berubah.
  const [riwayat, setRiwayat] = useState({});
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const onData = () => setTick((n) => n + 1);
    window.addEventListener("nexto-data-changed", onData);
    return () => window.removeEventListener("nexto-data-changed", onData);
  }, []);
  useEffect(() => {
    let alive = true;
    db.getStageHistory()
      .then((rows) => {
        if (!alive) return;
        const map = {};
        for (const r of rows) (map[r.lead_id] ||= []).push(r);
        setRiwayat(map);
      })
      .catch(() => { if (alive) setRiwayat({}); });
    return () => { alive = false; };
  }, [tick]);

  // Langkah jejak tahap: tahap berurutan, tanpa pengulangan tahap yang sama berturut-turut.
  const jejakOf = (leadId) => {
    const steps = [];
    for (const r of riwayat[leadId] || []) {
      if (!r.to_stage) continue;
      if (steps.length && steps[steps.length - 1].to === r.to_stage) continue;
      steps.push({ to: r.to_stage, at: r.changed_at });
    }
    return steps;
  };

  const toggleExpand = (leadId) => setExpanded((prev) => { const n = new Set(prev); n.has(leadId) ? n.delete(leadId) : n.add(leadId); return n; });

  // BUG FIX (11 Sep 2026, ketauan pas audit) - klik ganda cepet di tombol
  // hapus sebelumnya bisa nembak 2x db.deleteDealTransaction buat id yang
  // sama sebelum list sempet re-render. Digurad pake Set id yang lagi diproses.
  const [deletingTxIds, setDeletingTxIds] = useState(() => new Set());
  const delTx = async (id) => {
    if (deletingTxIds.has(id)) return;
    if (!window.confirm("Hapus transaksi ini?")) return;
    setDeletingTxIds((prev) => new Set(prev).add(id));
    try { await db.deleteDealTransaction(id); onChanged(); }
    catch (e) { alert("Gagal hapus: " + e.message); }
    finally { setDeletingTxIds((prev) => { const n = new Set(prev); n.delete(id); return n; }); }
  };

  const mask = "••••••";
  const bagikan = (rp) => (rp ? (rpRevealed ? fmtRp(rp) : mask) : "—");

  const renderRow = (g, maxBulan) => {
    const lead = g.lead;
    const sm = lead ? stageMeta(stages, lead.stage_key) : null;
    const latest = g.txs[0];
    const isOpen = expanded.has(g.leadId);
    const nilai = Number(lead?.deal_value) || 0;
    const tanggal = lead?.deal_date || latest?.deal_date;
    const jejak = jejakOf(g.leadId);
    const punyaRincian = g.txs.length > 1;
    const bisaBuka = punyaRincian || jejak.length > 0;
    const durasi = jejak.length > 1 ? Math.round((Date.parse(jejak[jejak.length - 1].at) - Date.parse(jejak[0].at)) / 86400000) : null;
    return (
      <li key={g.leadId} className="py-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-6 gap-y-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => lead && onEdit(lead)}
              className="block max-w-full truncate rounded text-left text-[15px] font-semibold tracking-[-0.01em] text-ink hover:text-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
            >
              {lead?.name || latest?.lead_name || "—"}
            </button>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-500">
              {lead?.city && <span>{lead.city}</span>}
              {lead?.sales_owner && <span>{lead.sales_owner}</span>}
              {tanggal && <span className="tabular-nums">{fmtDate(tanggal)}</span>}
              {projectDeal && lead?.sph_number && <span>SPH {lead.sph_number}</span>}
              {projectDeal && Number(lead?.discount_pct) > 0 && <span>Diskon {Number(lead.discount_pct)}%</span>}
            </div>
          </div>

          <div className="hidden min-w-0 flex-wrap items-center gap-2 md:flex">
            {sm && <span className="rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium" style={chipStyle(sm.hex)}>{sm.label}</span>}
            {(latest?.product_type || latest?.chemical) && (
              <span className="truncate rounded-full bg-slate-100 px-2.5 py-0.5 text-[11.5px] font-medium text-slate-700">{latest.product_type || latest.chemical}</span>
            )}
            {typeBadge(lead?.company_type) && <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">{typeBadge(lead.company_type)}</span>}
          </div>

          <div className="text-right">
            <div className="font-display text-[18px] font-bold leading-none tracking-[-0.02em] tabular-nums text-ink">{bagikan(nilai)}</div>
            <div className="ml-auto mt-2 h-1 w-20 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              <div className="h-full rounded-full bg-orange-400" style={{ width: `${maxBulan > 0 ? (nilai / maxBulan) * 100 : 0}%` }} />
            </div>
            {bisaBuka && (
              <button
                type="button"
                onClick={() => toggleExpand(g.leadId)}
                aria-expanded={isOpen}
                className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500"
              >
                {punyaRincian ? `${g.txs.length} transaksi` : "Jejak tahap"}
                {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            )}
          </div>
        </div>

        {isOpen && bisaBuka && (
          <div className="mt-4 border-l-2 border-orange-200 pl-4">
            {jejak.length > 0 && (
              <div className="mb-4">
                <p className="text-[11.5px] font-medium text-slate-500">
                  Jejak tahap{durasi !== null ? `, ${durasi} hari dari awal sampai sekarang` : ""}
                </p>
                <ol className="mt-3 flex flex-wrap items-start gap-x-5 gap-y-3">
                  {jejak.map((s, i) => {
                    const terakhir = i === jejak.length - 1;
                    return (
                      <li key={`${s.to}-${i}`} className="min-w-[6rem]">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${terakhir ? "bg-orange-500" : "bg-slate-300"}`} aria-hidden="true" />
                          <span className={`text-[12px] ${terakhir ? "font-semibold text-ink" : "text-slate-600"}`}>{labelTahap[s.to] || s.to}</span>
                        </div>
                        <div className="ml-4 text-[11px] tabular-nums text-slate-400">{fmtDate(String(s.at).slice(0, 10))}</div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {punyaRincian && (
              <>
                <p className="text-[11.5px] text-slate-400">Rincian transaksi. Nilai ini tidak dijumlahkan lagi ke total.</p>
                <ul className="mt-2 divide-y divide-slate-100">
                  {g.txs.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-4 py-2 text-[12.5px]">
                      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-slate-600">
                        <span className="tabular-nums">{t.deal_date ? fmtDate(t.deal_date) : "—"}</span>
                        {t.product_type && <span>{t.product_type}</span>}
                        {units && t.tonnage && <span className="font-mono">{qtyRevealed ? `${Number(t.tonnage).toLocaleString("id-ID")} ${unitLabel(units, t.tonnage_unit)}` : mask}</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-3 font-semibold tabular-nums text-slate-800">
                        {t.deal_value ? (rpRevealed ? fmtRp(t.deal_value) : mask) : "—"}
                        <button
                          type="button"
                          onClick={() => delTx(t.id)}
                          disabled={deletingTxIds.has(t.id)}
                          aria-label="Hapus transaksi"
                          className="rounded p-1 text-slate-300 hover:text-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600" aria-hidden="true">
            <Trophy size={18} />
          </span>
          <div>
            <h1 className="font-display text-[26px] font-bold leading-none tracking-[-0.03em] text-ink">Deal</h1>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">Lead yang sudah menang. Deal muncul otomatis saat lead pindah ke tahap menang.</p>
          </div>
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center">
          <p className="font-display text-[17px] font-semibold text-ink">Belum ada deal</p>
          <p className="mt-1.5 text-[13px] text-slate-500">Pindahkan lead ke tahap menang, maka deal-nya tercatat di sini.</p>
        </div>
      ) : (
        <>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setBulanPilih(shiftBulan(bulanPilih === "all" ? bulanIni : bulanPilih, -1))} disabled={bulanPilih === "all"} aria-label="Bulan sebelumnya" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-30">
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[11rem] text-center font-display text-[17px] font-semibold text-ink">{bulanPilih === "all" ? "Semua bulan" : namaBulan(bulanPilih)}</span>
              <button type="button" onClick={() => setBulanPilih(shiftBulan(bulanPilih, 1))} disabled={bulanPilih === "all" || bulanPilih >= bulanIni} aria-label="Bulan berikutnya" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-30">
                <ChevronRight size={16} />
              </button>
            </div>
            <div className="inline-flex rounded-full bg-slate-100 p-1 text-[12.5px] font-medium">
              <button type="button" onClick={() => setBulanPilih(bulanIni)} aria-pressed={bulanPilih === bulanIni} className={`rounded-full px-3.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${bulanPilih === bulanIni ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}>Bulan ini</button>
              <button type="button" onClick={() => setBulanPilih("all")} aria-pressed={bulanPilih === "all"} className={`rounded-full px-3.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${bulanPilih === "all" ? "bg-white text-ink shadow-sm" : "text-slate-500"}`}>Semua</button>
            </div>
          </div>

          {bulanPilih !== "all" && (
            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-slate-200 py-4 sm:grid-cols-4">
              <div>
                <dt className="text-[11.5px] font-medium text-slate-500">Omzet bulan ini</dt>
                <dd className="mt-1 font-display text-[18px] font-bold tabular-nums text-ink">{bagikan(totalBulan)}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium text-slate-500">Jumlah deal</dt>
                <dd className="mt-1 font-display text-[18px] font-bold tabular-nums text-ink">{jumlahBulan}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium text-slate-500">Dibanding bulan lalu</dt>
                <dd className={`mt-1 font-display text-[18px] font-bold tabular-nums ${selisihPersen === null ? "text-slate-400" : selisihPersen >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                  {selisihPersen === null ? "—" : `${selisihPersen >= 0 ? "+" : ""}${selisihPersen}%`}
                </dd>
              </div>
              <div>
                <dt className="text-[11.5px] font-medium text-slate-500">Capaian target</dt>
                <dd className="mt-1 font-display text-[18px] font-bold tabular-nums text-ink">
                  {targetBulan > 0 ? `${Math.round((totalBulan / targetBulan) * 100)}%` : "—"}
                </dd>
                <dd className="text-[11px] text-slate-400">{targetBulan > 0 ? `dari ${rpRevealed ? fmtRp(targetBulan) : mask}` : "Target belum diisi di tab Team"}</dd>
              </div>
            </dl>
          )}

          <section className="mt-7 flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
            <div>
              <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                {bulanPilih === "all" ? "Total nilai deal" : `Omzet ${namaBulan(bulanPilih)}`}
                <button type="button" onClick={() => setRpRevealed((v) => !v)} aria-label={rpRevealed ? "Sembunyikan nilai" : "Tampilkan nilai"} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">
                  {rpRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <div className="mt-2 font-display text-[44px] font-bold leading-none tracking-[-0.045em] tabular-nums text-ink">{rpRevealed ? fmtRp(totalBulan) : mask}</div>
              <p className="mt-2.5 text-[13px] text-slate-500">{jumlahBulan} deal menang</p>
            </div>

            <div className="flex flex-col items-start gap-1.5">
              <Sparkline values={omzetPerBulan} />
              <div className="flex w-[156px] justify-between text-[10.5px] text-slate-400">
                <span>{labelBulanSingkat(enamBulan[0])}</span>
                <span>{labelBulanSingkat(enamBulan[5])}</span>
              </div>
            </div>

            {units && (
              <div className="min-w-[10rem]">
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                  Total {quantityLabel}
                  <button type="button" onClick={() => setQtyRevealed((v) => !v)} aria-label={qtyRevealed ? "Sembunyikan jumlah" : "Tampilkan jumlah"} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">
                    {qtyRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <div className="mt-2 font-display text-[22px] font-bold leading-tight tracking-[-0.02em] tabular-nums text-slate-800">
                  {qtyRevealed
                    ? (totals.length ? totals.map((t) => <span key={t.unit} className="mr-3 inline-block">{t.n.toLocaleString("id-ID")} <span className="text-[13px] font-medium text-slate-400">{unitLabel(units, t.unit)}</span></span>) : "0")
                    : mask}
                </div>
              </div>
            )}
          </section>

          {monthGroups.filter((g) => bulanPilih === "all" || g.ym === bulanPilih).map(({ ym, items, total, max }) => (
            <section key={ym} className="mt-9">
              {bulanPilih === "all" && (
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2 className="font-display text-[15px] font-semibold text-ink">{ym === "Tanpa tanggal" ? ym : namaBulan(ym)}</h2>
                  <p className="text-[12.5px] tabular-nums text-slate-500">
                    {items.length} deal
                    <span className="ml-3 font-semibold text-slate-700">{bagikan(total)}</span>
                  </p>
                </div>
              )}
              <ul className={`${bulanPilih === "all" ? "mt-3" : "mt-6"} divide-y divide-slate-200 border-y border-slate-200`}>
                {items.map((g) => renderRow(g, max))}
              </ul>
            </section>
          ))}
          {bulanPilih !== "all" && !grupBulan && (
            <div className="mt-9 rounded-2xl border border-dashed border-slate-300 px-6 py-10 text-center">
              <p className="font-display text-[16px] font-semibold text-ink">Belum ada deal di {namaBulan(bulanPilih)}</p>
              <p className="mt-1.5 text-[13px] text-slate-500">Pilih bulan lain di atas, atau pilih Semua untuk melihat seluruh deal.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
