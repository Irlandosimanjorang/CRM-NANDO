import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Trophy, Eye, EyeOff, ChevronDown, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import * as db from "../lib/db";
import { stageMeta, chipStyle, typeBadge, fmtRp, fmtDate } from "../lib/helpers";
import { getFieldLabel, getQuantityUnits } from "../lib/industryTemplates";

// Tahap proyek BSB (org project_deal): omzet dihitung sejak Proyek Deal sampai Proyek Selesai.
const PROJECT_KEYS = ["proyek_deal", "proyek_berjalan", "proyek_selesai"];

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

export default function Deal({ leads, stages, dealTransactions, industry, onEdit, onChanged, projectDeal = false }) {
  const quantityLabel = getFieldLabel(industry, "quantity", "Quantity");
  const units = getQuantityUnits(industry);
  const [qtyRevealed, setQtyRevealed] = useState(false);
  const [rpRevealed, setRpRevealed] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  // Filter daftar deal: nama lead dan rentang tanggal transaksi (berlaku untuk semua bulan).
  const [fNama, setFNama] = useState("");
  const [fDari, setFDari] = useState("");
  const [fTipe, setFTipe] = useState("");
  const [fSampai, setFSampai] = useState("");
  const [subTab, setSubTab] = useState("deal"); // khusus org project_deal: "deal" (Proyek Deal) atau "selesai" (Proyek Selesai)
  const leadsById = useMemo(() => Object.fromEntries(leads.map((l) => [l.id, l])), [leads]);
  const labelTahap = useMemo(() => Object.fromEntries((stages || []).map((s) => [s.key, s.label])), [stages]);

  // Transaksi deal adalah catatan permanen: tetap tampil walau lead sudah dibuka lagi (repeat order).
  // Yang ditampilkan: lead yang sekarang menang, dan lead yang punya transaksi deal.
  // Total nilai = jumlah transaksi (ditambah deal_value lead menang yang belum punya transaksi).
  // Org project_deal (BSB): omzet dari tahap Proyek Deal. Setiap lead proyek jadi satu transaksi (tanggal proyek deal).
  const txSource = useMemo(() => (projectDeal
    ? (leads || []).filter((l) => !l.deleted_at && PROJECT_KEYS.includes(l.stage_key) && l.deal_date).map((l) => ({ id: l.id, lead_id: l.id, lead_name: l.name, deal_date: l.deal_date, deal_value: l.deal_value, tonnage: l.tonnage, tonnage_unit: l.tonnage_unit, product_type: l.product, auto: true }))
    : (dealTransactions || [])), [projectDeal, leads, dealTransactions]);
  const txLeadIds = useMemo(() => new Set(txSource.map((t) => t.lead_id)), [txSource]);
  const wonIds = useMemo(() => {
    if (projectDeal) return new Set(txSource.map((t) => t.lead_id));
    const wonKeys = new Set((stages || []).filter((s) => s.type === "won").map((s) => s.key));
    return new Set((leads || []).filter((l) => !l.deleted_at && (wonKeys.has(l.stage_key) || txLeadIds.has(l.id))).map((l) => l.id));
  }, [projectDeal, txSource, leads, stages, txLeadIds]);
  const deals = useMemo(() => {
    const namaCari = fNama.trim().toLowerCase();
    return txSource.filter((t) => {
      if (!wonIds.has(t.lead_id)) return false;
      if (fTipe && (leadsById[t.lead_id]?.payment_type || "") !== fTipe) return false;
      if (namaCari && !String(leadsById[t.lead_id]?.name || t.lead_name || "").toLowerCase().includes(namaCari)) return false;
      if (fDari && String(t.deal_date || "") < fDari) return false;
      if (fSampai && String(t.deal_date || "") > fSampai) return false;
      return true;
    });
  }, [txSource, wonIds, leadsById, fNama, fDari, fSampai, fTipe]);
  const totalValue = useMemo(() => {
    const txSum = deals.reduce((a, t) => a + (Number(t.deal_value) || 0), 0);
    // Lead tanpa transaksi ikut dihitung hanya kalau filter tanggal tidak aktif dan namanya cocok dengan filter.
    const namaCari = fNama.trim().toLowerCase();
    const tanpaTx = fDari || fSampai ? 0 : (leads || [])
      .filter((l) => wonIds.has(l.id) && !txLeadIds.has(l.id) && (!namaCari || String(l.name || "").toLowerCase().includes(namaCari)))
      .reduce((a, l) => a + (Number(l.deal_value) || 0), 0);
    return txSum + tanpaTx;
  }, [leads, deals, wonIds, txLeadIds, fNama, fDari, fSampai]);
  const totals = qtyTotals(deals, units);

  // 1 baris per lead menang. Nilai baris = deal_value lead (satu aturan deal di semua tab).
  // Transaksi di bawahnya (repeat order) hanya rincian, tidak dijumlah lagi.
  const groups = useMemo(() => {
    const txByLead = {};
    for (const t of deals) (txByLead[t.lead_id] ||= []).push(t);
    const dateOf = (g) => String(g.lead?.deal_date || g.txs[0]?.deal_date || "");
    const namaCari = fNama.trim().toLowerCase();
    const dateActive = !!(fDari || fSampai);
    return [...wonIds]
      .filter((leadId) => {
        if (namaCari && !String(leadsById[leadId]?.name || "").toLowerCase().includes(namaCari)) return false;
        // Filter tanggal: lead tanpa transaksi di rentang itu tidak ditampilkan.
        if (dateActive && !txByLead[leadId]?.length) return false;
        return true;
      })
      .map((leadId) => ({
        leadId,
        lead: leadsById[leadId],
        txs: (txByLead[leadId] || []).slice().sort((a, b) => String(b.deal_date || "").localeCompare(String(a.deal_date || ""))),
      }))
      .sort((a, b) => dateOf(b).localeCompare(dateOf(a)));
  }, [deals, wonIds, leadsById, fNama, fDari, fSampai]);

  // Setiap transaksi dihitung di bulan tanggal transaksinya (repeat order ikut di bulannya sendiri).
  // Lead tanpa transaksi (deal lama) dihitung sekali di bulan deal_date-nya dengan deal_value lead.
  const entriesOf = (g) => {
    const fallback = String(g.lead?.deal_date || "").slice(0, 7);
    if (g.txs.length === 0) return [{ ym: fallback || "Tanpa tanggal", value: Number(g.lead?.deal_value) || 0, tx: null }];
    return g.txs.map((t) => ({ ym: String(t.deal_date || g.lead?.deal_date || "").slice(0, 7) || "Tanpa tanggal", value: Number(t.deal_value) || 0, tx: t }));
  };
  // Dikelompokkan per bulan (terbaru di atas): tiap lead muncul di bulan yang punya transaksinya, dengan nilai bulan itu saja.
  const monthGroups = useMemo(() => {
    const map = new Map();
    for (const g of groups) {
      const perBulan = new Map();
      for (const e of entriesOf(g)) {
        if (!perBulan.has(e.ym)) perBulan.set(e.ym, { nilai: 0, txs: [] });
        const b = perBulan.get(e.ym);
        b.nilai += e.value;
        if (e.tx) b.txs.push(e.tx);
      }
      for (const [ym, b] of perBulan) {
        if (!map.has(ym)) map.set(ym, []);
        map.get(ym).push({ ...g, nilaiBulan: b.nilai, txs: b.txs.length ? b.txs : g.txs });
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "Tanpa tanggal" ? 1 : b === "Tanpa tanggal" ? -1 : b.localeCompare(a)))
      .map(([ym, items]) => {
        const nilai = items.map((g) => g.nilaiBulan);
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
    for (const g of groups) for (const e of entriesOf(g)) if (e.ym in map) map[e.ym] += e.value;
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

  const chartData = enamBulan.map((ym, i) => ({ ym, label: labelBulanSingkat(ym), omzet: omzetPerBulan[i] }));
  const mask = "••••••";
  const bagikan = (rp) => (rp ? (rpRevealed ? fmtRp(rp) : mask) : "—");

  const renderRow = (g, maxBulan) => {
    const lead = g.lead;
    const sm = lead ? stageMeta(stages, lead.stage_key) : null;
    const latest = g.txs[0];
    // Lead dengan lebih dari satu transaksi selalu menampilkan semua rincian tanggalnya.
    const isOpen = g.txs.length > 1 || expanded.has(g.leadId);
    // Saat filter tanggal aktif, kartu hanya menghitung dan menampilkan transaksi di rentang itu.
    const dateFilterAktif = !!(fDari || fSampai);
    const nilai = dateFilterAktif ? g.txs.reduce((a, t) => a + (Number(t.deal_value) || 0), 0) : (g.nilaiBulan ?? (Number(lead?.deal_value) || 0));
    const tanggal = dateFilterAktif && latest ? latest.deal_date : (lead?.deal_date || latest?.deal_date);
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
            {lead?.payment_type && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-medium text-amber-800">{lead.payment_type}</span>}
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
                        {t.sph_number && <span>SPH {t.sph_number}</span>}
                        {t.invoice_number && <span>Faktur {t.invoice_number}</span>}
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

  const selesaiList = projectDeal
    ? (leads || []).filter((l) => !l.deleted_at && l.stage_key === "proyek_selesai").sort((a, b) => String(b.deal_date || "").localeCompare(String(a.deal_date || "")))
    : [];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600" aria-hidden="true">
            <Trophy size={18} />
          </span>
          <div>
            <h1 className="font-display text-[26px] font-bold leading-none tracking-[-0.03em] text-ink">{projectDeal ? "Pencapaian" : "Deal"}</h1>
            <p className="mt-2 max-w-md text-[13px] leading-relaxed text-slate-500">
              {projectDeal
                ? "Omzet dihitung dari tahap Proyek Deal. Proyek yang sudah berjalan atau selesai tetap dihitung di bulan proyek deal-nya."
                : "Lead yang sudah menang. Deal muncul otomatis saat lead pindah ke tahap menang."}
            </p>
          </div>
        </div>
        {projectDeal && (
          <div className="flex gap-1.5">
            {[["deal", "Proyek Deal"], ["selesai", "Proyek Selesai"]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setSubTab(k)} aria-pressed={subTab === k} className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${subTab === k ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{label}</button>
            ))}
          </div>
        )}
      </header>

      {!(projectDeal && subTab === "selesai") && (
        <div className="mt-5 flex flex-wrap items-end gap-3 text-[12px]">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-slate-500">
            Nama lead
            <input value={fNama} onChange={(e) => setFNama(e.target.value)} placeholder="Cari nama lead" className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500" />
          </label>
          <label className="flex flex-col gap-1 text-slate-500">
            Dari tanggal
            <input type="date" value={fDari} onChange={(e) => setFDari(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] text-slate-800" />
          </label>
          <label className="flex flex-col gap-1 text-slate-500">
            Sampai tanggal
            <input type="date" value={fSampai} onChange={(e) => setFSampai(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] text-slate-800" />
          </label>
          <label className="flex flex-col gap-1 text-slate-500">
            Tipe payment
            <select value={fTipe} onChange={(e) => setFTipe(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] text-slate-800">
              <option value="">Semua</option>
              {["Transfer", "Tunai", "Termin", "Giro", "Kartu kredit", "Lainnya"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          {(fNama || fDari || fSampai || fTipe) && (
            <button type="button" onClick={() => { setFNama(""); setFDari(""); setFSampai(""); setFTipe(""); }} className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-orange-700 hover:bg-orange-50">Reset filter</button>
          )}
        </div>
      )}

      {projectDeal && subTab === "selesai" ? (
        selesaiList.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center">
            <p className="font-display text-[17px] font-semibold text-ink">Belum ada proyek selesai</p>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
            {selesaiList.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <button type="button" onClick={() => onEdit(l)} className="text-left text-[15px] font-semibold text-ink hover:text-orange-700">{l.name}</button>
                <span className="text-[12.5px] text-slate-500">Proyek deal {l.deal_date ? fmtDate(l.deal_date) : "-"} · <b className="font-semibold text-slate-700">{fmtRp(Number(l.deal_value) || 0)}</b></span>
              </li>
            ))}
          </ul>
        )
      ) : groups.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center">
          <p className="font-display text-[17px] font-semibold text-ink">Belum ada deal</p>
          <p className="mt-1.5 text-[13px] text-slate-500">Deal muncul saat lead pindah ke tahap menang. Lead yang kamu input sendiri juga tercatat di sini.</p>
        </div>
      ) : (
        <>
          <section className="relative mt-6 overflow-hidden rounded-2xl bg-[#0f172a] p-5 text-white shadow-lg shadow-slate-900/10 sm:p-6">
            <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" aria-hidden="true" />
            <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setBulanPilih(shiftBulan(bulanPilih === "all" ? bulanIni : bulanPilih, -1))} disabled={bulanPilih === "all"} aria-label="Bulan sebelumnya" className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-30">
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[10rem] text-center font-display text-[15px] font-semibold text-white">{bulanPilih === "all" ? "Semua bulan" : namaBulan(bulanPilih)}</span>
                <button type="button" onClick={() => setBulanPilih(shiftBulan(bulanPilih, 1))} disabled={bulanPilih === "all" || bulanPilih >= bulanIni} aria-label="Bulan berikutnya" className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 disabled:opacity-30">
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="inline-flex rounded-full bg-white/5 p-1 text-[12px] font-medium">
                <button type="button" onClick={() => setBulanPilih(bulanIni)} aria-pressed={bulanPilih === bulanIni} className={`rounded-full px-3 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${bulanPilih === bulanIni ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}>Bulan ini</button>
                <button type="button" onClick={() => setBulanPilih("all")} aria-pressed={bulanPilih === "all"} className={`rounded-full px-3 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500 ${bulanPilih === "all" ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"}`}>Semua</button>
              </div>
            </div>
            <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
              <div>
                <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400">
                  {bulanPilih === "all" ? "Total nilai deal" : `Omzet ${namaBulan(bulanPilih)}`}
                  <button type="button" onClick={() => setRpRevealed((v) => !v)} aria-label={rpRevealed ? "Sembunyikan nilai" : "Tampilkan nilai"} className="rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">
                    {rpRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <div className="mt-1.5 font-display text-[30px] font-bold leading-none tracking-[-0.04em] tabular-nums text-white">{rpRevealed ? fmtRp(totalBulan) : mask}</div>
                <p className="mt-2.5 text-[13px] text-slate-400">{jumlahBulan} deal menang</p>
                {bulanPilih !== "all" && (
                  <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-4">
                    <div>
                      <dt className="text-[11.5px] font-medium text-slate-400">Dibanding bulan lalu</dt>
                      <dd className={`mt-1 font-display text-[17px] font-bold tabular-nums ${selisihPersen === null ? "text-slate-500" : selisihPersen >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {selisihPersen === null ? "—" : `${selisihPersen >= 0 ? "+" : ""}${selisihPersen}%`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11.5px] font-medium text-slate-400">Capaian target</dt>
                      <dd className="mt-1 font-display text-[17px] font-bold tabular-nums text-white">
                        {targetBulan > 0 ? `${Math.round((totalBulan / targetBulan) * 100)}%` : "—"}
                      </dd>
                      <dd className="mt-0.5 text-[11px] text-slate-500">{targetBulan > 0 ? `dari ${rpRevealed ? fmtRp(targetBulan) : mask}` : "Target belum diisi di tab Team"}</dd>
                    </div>
                  </dl>
                )}
              </div>

              <div className="min-w-0 flex-1 basis-72">
                <div className="flex items-center justify-between text-[11.5px] text-slate-400">
                  <span>Omzet 6 bulan terakhir</span>
                  <span className="hidden sm:inline">Klik batang untuk memilih bulan</span>
                </div>
                <div className="relative mt-2 h-32 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
                      barCategoryGap="38%"
                      onClick={(e) => { const ym = e?.activePayload?.[0]?.payload?.ym; if (ym) setBulanPilih(ym); }}
                    >
                      <CartesianGrid vertical={false} stroke="#1e293b" />
                      <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10.5, fill: "#64748b" }} axisLine={false} tickLine={false} width={24} allowDecimals={false} hide={!rpRevealed} tickFormatter={(v) => (v >= 1e6 ? `${Math.round(v / 1e6)}jt` : v)} />
                      <Tooltip
                        cursor={{ fill: "rgba(148,163,184,0.08)" }}
                        formatter={(v) => (rpRevealed ? fmtRp(v) : "••••••")}
                        labelFormatter={(label, payload) => (payload?.[0]?.payload?.ym ? namaBulan(payload[0].payload.ym) : label)}
                        contentStyle={{ borderRadius: 12, border: "1px solid #1e293b", background: "#0f172a", fontSize: 12 }}
                        labelStyle={{ fontWeight: 700, color: "#ffffff" }}
                        itemStyle={{ color: "#fdba74" }}
                      />
                      <Bar dataKey="omzet" name="Omzet" radius={[4, 4, 0, 0]} maxBarSize={20} cursor="pointer">
                        {chartData.map((d) => (
                          <Cell key={d.ym} fill={d.ym === bulanPilih ? "#f97316" : "#334155"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {units && (
                <div className="min-w-[10rem]">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-slate-400">
                    Total {quantityLabel}
                    <button type="button" onClick={() => setQtyRevealed((v) => !v)} aria-label={qtyRevealed ? "Sembunyikan jumlah" : "Tampilkan jumlah"} className="rounded-full p-1 text-slate-500 hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-500">
                      {qtyRevealed ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <div className="mt-2 font-display text-[22px] font-bold leading-tight tracking-[-0.02em] tabular-nums text-white">
                    {qtyRevealed
                      ? (totals.length ? totals.map((t) => <span key={t.unit} className="mr-3 inline-block">{t.n.toLocaleString("id-ID")} <span className="text-[13px] font-medium text-slate-400">{unitLabel(units, t.unit)}</span></span>) : "0")
                      : mask}
                  </div>
                </div>
              )}
            </div>

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
