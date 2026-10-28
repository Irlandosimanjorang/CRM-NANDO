import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Printer, Info, Loader2 } from "lucide-react";
import { downloadReportPpt } from "../lib/reportPpt";
import { downloadReportXlsx } from "../lib/reportXlsx";
import * as db from "../lib/db";
import { fmtRp } from "../lib/helpers";
import { getCustomFieldSlots } from "../lib/industryTemplates";
import { normalizePlatform } from "../lib/adsImport";
import { Panel, PanelHeader, Pill, Meter, EmptyState } from "../ui";
import AdsAnalysis from "./AdsAnalysis";
import RekapLaporan from "./RekapLaporan";
import ProyekDashboard from "./ProyekDashboard";
import RencanaBulanan from "./RencanaBulanan";
import SheetsAnnouncement from "./SheetsAnnouncement";

// Tab Laporan (9 Okt 2026, saklar monthly_report; untuk owner dan manager). Dua tampilan:
//  - Penjualan: target omzet, kalender bulanan ala Google Calendar (deal dan data masuk per tanggal),
//    agenda hari terpilih, dan corong SPH -> hot progress -> deal.
//  - Iklan dan sumber lead: biaya iklan hasil impor disandingkan dengan lead per platform.
// Pipeline = kondisi lead SEKARANG; deal, omzet, dan kalender = tanggal deal pada bulan terpilih;
// data masuk = lead yang dibuat pada bulan itu. Warna mengikuti docs/DESIGN.md: deal = emerald,
// lead baru = brand.
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const DAYS_LONG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const SOURCES = ["Meta", "Instagram", "TikTok", "Google", "Tokopedia", "Shopee", "Customer datang", "Database", "Lainnya"];
const cn = (...v) => v.filter(Boolean).join(" ");
// Transaksi deal dari server -> baris deal berbentuk lead (nilai & tanggal = transaksi itu).
const dealRowsFromEntries = (entries, leads) => {
  const byId = new Map(leads.map((l) => [l.id, l]));
  return entries.map((e) => {
    const lead = byId.get(e.lead_id);
    return lead ? { ...lead, id: e.lead_id, deal_value: e.deal_value, deal_date: e.deal_date, assigned_to: e.pic } : null;
  }).filter(Boolean);
};
// Omzet per tipe payment (24 Okt 2026): dihitung dari deal yang sudah difilter sesuai lingkup laporan.
const paymentRowsOf = (deals) => {
  const map = new Map();
  for (const d of deals) {
    const key = d.payment_type || "Belum diisi";
    const cur = map.get(key) || { tipe: key, deals: 0, omzet: 0 };
    cur.deals += 1;
    cur.omzet += Number(d.deal_value) || 0;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.omzet - a.omzet);
};
const PaymentBreakdownCard = ({ rows, periodLabel }) => (
  <Panel className="p-5">
    <PanelHeader title="Omzet per tipe payment" meta={`Deal ${periodLabel}, dikelompokkan per tipe payment.`} />
    <ul className="mt-2 divide-y divide-slate-100">
      {rows.map((p) => (
        <li key={p.tipe} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
          <span className="min-w-0 truncate text-slate-800">{p.tipe}</span>
          <span className="shrink-0 tabular-nums text-slate-500">{p.deals} deal · <b className="font-semibold text-slate-800">{fmtRp(Number(p.omzet) || 0)}</b></span>
        </li>
      ))}
    </ul>
  </Panel>
);
const pad = (n) => String(n).padStart(2, "0");
const ymOf = (iso) => String(iso || "").slice(0, 7);
const num = (v) => Number(v) || 0;
const pct = (v, base) => (base > 0 ? `${((v / base) * 100).toFixed(1).replace(/\.0$/, "")}%` : "0%");
// 52000000 -> "52 jt", 1250000000 -> "1,25 M", 14500 -> "14,5 rb"
function short(n) {
  const v = num(n);
  const f = (x) => String(Math.round(x * 100) / 100).replace(".", ",");
  if (v >= 1e9) return `${f(v / 1e9)} M`;
  if (v >= 1e6) return `${f(v / 1e6)} jt`;
  if (v >= 1e3) return `${f(v / 1e3)} rb`;
  return String(v);
}
const truncate = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
// Status target: bulan berjalan memakai forecast dari laju harian (baru dari hari ke-5); bulan lewat memakai hasil akhir.
// Batas: forecast >= 100% target = Aman, 80-99% = Warning, di bawah 80% = berpotensi tidak mencapai target.
const TONES = { good: "bg-emerald-50 text-emerald-700 ring-emerald-200", warn: "bg-amber-50 text-amber-800 ring-amber-200", bad: "bg-rose-50 text-rose-700 ring-rose-200", none: "bg-slate-100 text-slate-600 ring-slate-200" };
function targetStatus({ actual, target, isNow, isPast, elapsed, daysInMonth }) {
  const forecast = isNow && elapsed >= 5 && actual > 0 ? Math.round((actual / elapsed) * daysInMonth) : isPast ? actual : 0;
  if (!(target > 0)) return { forecast, tone: "none", label: "Target belum diisi" };
  if (actual >= target) return { forecast, tone: "good", label: isPast ? "Tercapai" : "Target tercapai" };
  if (isPast) return { forecast, tone: "bad", label: "Tidak tercapai" };
  if (!isNow) return { forecast, tone: "none", label: "Belum berjalan" };
  if (!forecast) return { forecast, tone: "none", label: "Belum cukup data" };
  const ratio = forecast / target;
  if (ratio >= 1) return { forecast, tone: "good", label: "Aman" };
  if (ratio >= 0.8) return { forecast, tone: "warn", label: "Warning" };
  return { forecast, tone: "bad", label: "Berpotensi tidak mencapai target" };
}
const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

// Penjelasan singkat untuk kartu target: muncul saat ikon (i) diklik.
const TARGET_INFO = {
  "Forecast": "Perkiraan omzet sampai akhir bulan, dihitung dari laju omzet sampai hari ini. Mulai dihitung dari hari ke-5.",
  "Gap ke target": "Omzet sekarang dikurangi target bulan ini. Minus berarti masih kurang.",
  "Bulan lalu": "Total omzet bulan sebelumnya pada lingkup yang sama.",
};
function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button type="button" aria-label="Penjelasan" aria-expanded={open} onClick={() => setOpen((v) => !v)} onBlur={() => setOpen(false)} className={`ml-1 rounded-full text-slate-400 hover:text-slate-200 ${focus}`}>
        <Info size={12} />
      </button>
      {open && <span role="tooltip" className="absolute left-0 top-full z-20 mt-1.5 w-56 rounded-lg bg-white p-2.5 text-[11px] font-normal leading-relaxed text-slate-700 shadow-lg ring-1 ring-slate-200">{text}</span>}
    </span>
  );
}

// Ikon PowerPoint: kotak oranye dengan slide putih dan batang grafik kecil.
const PowerPointIcon = ({ size = 18, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <rect x="2" y="3" width="20" height="18" rx="3" fill="#D24726" />
    <rect x="6" y="7" width="12" height="9" rx="1" fill="#fff" />
    <rect x="8.5" y="11" width="1.8" height="3.5" fill="#D24726" />
    <rect x="11.1" y="9" width="1.8" height="5.5" fill="#D24726" />
    <rect x="13.7" y="10" width="1.8" height="4.5" fill="#D24726" />
  </svg>
);

// Ikon simpan (disket) dengan kisi spreadsheet di label, warna hijau Google Sheets.
const SheetsIcon = ({ size = 22, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path d="M3 3h14l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="#0F9D58" />
    <rect x="8" y="3" width="7" height="5" fill="#87CEAC" />
    <rect x="12.5" y="4.25" width="2" height="2.5" fill="#0F9D58" />
    <rect x="6.5" y="12" width="11" height="8" rx="1" fill="#fff" />
    <path d="M6.5 15.3h11M6.5 18.2h11M10.5 12v8" stroke="#0F9D58" strokeWidth="0.9" />
  </svg>
);

export default function MonthlyReport({ leads: allLeads = [], stages = [], dealTransactions: allTxRaw = [], members = [], org, canImport = false, canManage = false, onChanged, onOpenLead, projectDeal = false }) {
  // Omzet org project_deal (16 Okt 2026, keputusan Nando): nilai proyek lead di tahap menang, bukan transaksi deal.
  // Transaksi dikosongkan supaya perhitungan memakai fallback lead menang (deal_value & deal_date) yang sudah ada.
  const allTx = useMemo(() => (projectDeal ? [] : allTxRaw), [allTxRaw, projectDeal]);
  const now = new Date();
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [ymSel, setYm] = useState(todayIso.slice(0, 7));
  // Periode: hari ini, minggu ini (Senin-Minggu), satu bulan kalender (panah bulan), atau rentang tanggal bebas.
  const [mode, setMode] = useState("month"); // today | week | month | custom
  const [cFrom, setCFrom] = useState(`${todayIso.slice(0, 7)}-01`);
  const [cTo, setCTo] = useState(todayIso);
  const [pickOpen, setPickOpen] = useState(false);
  const [dFrom, setDFrom] = useState("");
  const [dTo, setDTo] = useState("");
  const pickRef = useRef(null);
  const [srcF, setSrcF] = useState("all");
  const [stF, setStF] = useState("all");
  const [viewRaw, setView] = useState("penjualan");
  // Ekspor laporan ke Google Sheet (25 Okt 2026): paket Enterprise, semua peran.
  const [sheetBusy, setSheetBusy] = useState(false);
  const [sheetMenu, setSheetMenu] = useState(false);
  const sheetRef = useRef(null);
  useEffect(() => {
    if (!sheetMenu) return undefined;
    const off = (e) => { if (sheetRef.current && !sheetRef.current.contains(e.target)) setSheetMenu(false); };
    const esc = (e) => { if (e.key === "Escape") setSheetMenu(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [sheetMenu]);
  // Anggota biasa: laporan lead miliknya saja, tanpa tab Iklan dan target tim.
  const personal = !canManage;
  const view = personal && viewRaw === "iklan" ? "penjualan" : viewRaw;
  const [selected, setSelected] = useState(todayIso);
  const [memberId, setMemberId] = useState("all");
  const [err, setErr] = useState("");

  // Marketing = anggota selain owner (owner ikut bila punya lead). Owner dan manager bisa memilih satu marketing
  // untuk melihat laporannya sendiri, seperti "REPORT ASIFA" di Excel BSB; pilihan "Semua tim" untuk gabungan.
  const marketers = useMemo(() => {
    const seen = new Set(); const out = [];
    const nameOf = (id) => members.find((m) => m.user_id === id)?.display_name || "Anggota";
    for (const m of members) if (m.role !== "owner") { seen.add(m.user_id); out.push({ id: m.user_id, name: nameOf(m.user_id) }); }
    for (const l of allLeads) { const u = l.assigned_to || l.user_id; if (u && !seen.has(u)) { seen.add(u); out.push({ id: u, name: nameOf(u) }); } }
    return out;
  }, [members, allLeads]);
  const scopeId = personal ? "all" : marketers.some((m) => m.id === memberId) ? memberId : "all";
  const scopeName = marketers.find((m) => m.id === scopeId)?.name || "";

  useEffect(() => {
    if (!pickOpen) return undefined;
    const off = (e) => { if (pickRef.current && !pickRef.current.contains(e.target)) setPickOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setPickOpen(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", esc); };
  }, [pickOpen]);

  // Rentang tanggal terpilih. Target dan forecast hanya berlaku untuk satu bulan penuh (mode "month").
  const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const range = useMemo(() => {
    if (mode === "today") return { from: todayIso, to: todayIso };
    if (mode === "week") {
      const d = new Date(`${todayIso}T00:00:00`);
      const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
      return { from: isoOf(mon), to: isoOf(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6)) };
    }
    if (mode === "custom") return cFrom && cTo && cFrom <= cTo ? { from: cFrom, to: cTo } : { from: cFrom || cTo, to: cFrom || cTo };
    const [y, m] = ymSel.split("-").map(Number);
    return { from: `${ymSel}-01`, to: `${ymSel}-${pad(new Date(y, m, 0).getDate())}` };
  }, [mode, ymSel, cFrom, cTo, todayIso]);
  const fullMonth = mode === "month";
  const ym = fullMonth ? ymSel : range.from.slice(0, 7);
  const inR = (d) => { const k = String(d || "").slice(0, 10); return k >= range.from && k <= range.to; };

  // Sumber lead dibaca seperti di tab Iklan: isian "Sumber lead" bila ada, selain itu kolom sumber bawaan.
  const srcSlot = useMemo(() => getCustomFieldSlots(org?.industry, org?.custom_field_labels).find((s) => /sumber/i.test(s.label)), [org]);
  const sourceOfLead = (l) => normalizePlatform((srcSlot ? l[srcSlot.key] : "") || l.source || "") || "Tidak diisi";
  const sourceOptions = useMemo(() => [...new Set(allLeads.filter((l) => !l.deleted_at).map(sourceOfLead))].sort(), [allLeads, srcSlot]);
  const passF = (l) => (srcF === "all" || sourceOfLead(l) === srcF) && (stF === "all" || l.stage_key === stF);
  const filtered = srcF !== "all" || stF !== "all";
  const fLeads = useMemo(() => (filtered ? allLeads.filter(passF) : allLeads), [allLeads, srcF, stF, srcSlot]);
  const leads = useMemo(() => (scopeId === "all" ? fLeads : fLeads.filter((l) => (l.assigned_to || l.user_id) === scopeId)), [fLeads, scopeId]);

  const [year, month] = ym.split("-").map(Number);
  const prevYm = (() => { const t = new Date(Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 2, 1); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}`; })();
  const daysInMonth = new Date(year, month, 0).getDate();
  const fmtD = (iso) => { const d = new Date(`${iso}T00:00:00`); return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
  const periodLabel = mode === "today" ? `Hari ini, ${fmtD(range.from)}` : fullMonth ? `${MONTHS[month - 1]} ${year}` : range.from === range.to ? fmtD(range.from) : `${fmtD(range.from)} - ${fmtD(range.to)}`;
  const periodWord = mode === "today" ? "hari ini" : mode === "week" ? "minggu ini" : fullMonth ? (ym === todayIso.slice(0, 7) ? "bulan ini" : `${MONTHS[month - 1]}`) : "periode ini";
  const go = (d) => {
    const t = new Date(year, month - 1 + d, 1);
    setYm(`${t.getFullYear()}-${pad(t.getMonth() + 1)}`);
  };

  // Transaksi deal dibaca dari server (rentang bulan lalu sampai akhir periode), lihat efek di bawah.
  // Per transaksi: repeat order masuk ke bulan transaksinya sendiri.
  const [entriesSrv, setEntriesSrv] = useState([]);
  // Omzet per produk dalam periode yang dipilih (per transaksi, sama dengan tab lain).
  const [productRows, setProductRows] = useState([]);
  useEffect(() => {
    let alive = true;
    db.getProductBreakdown(range.from, range.to).then((r) => { if (alive) setProductRows(r); }).catch(() => { if (alive) setProductRows([]); });
    return () => { alive = false; };
  }, [range.from, range.to, allLeads]);
  const dealsSrv = useMemo(() => dealRowsFromEntries(entriesSrv, allLeads), [entriesSrv, allLeads]);
  // Deal dari server, disaring lingkup marketing dan filter sumber/tahap seperti tabel lead.
  const dealLeads = useMemo(() => dealsSrv.filter((l) => !l.deleted_at && (scopeId === "all" || (l.assigned_to || l.user_id) === scopeId) && passF(l)), [dealsSrv, scopeId, srcF, stF, srcSlot]);

  const r = useMemo(() => {
    const keyOf = (type) => new Set(stages.filter((s) => s.type === type).map((s) => s.key));
    const lostKeys = keyOf("lost");
    const hasBsbFlow = stages.some((s) => s.key === "sph_terlayang") && stages.some((s) => s.key === "hot_progress");
    const val = (l) => num(l.deal_value);
    const live = leads.filter((l) => !l.deleted_at);
    const sph = live.filter((l) => l.stage_key === "sph_terlayang");
    const hot = live.filter((l) => l.stage_key === "hot_progress");
    const lost = live.filter((l) => lostKeys.has(l.stage_key) && inR(l.updated_at));
    const running = live.filter((l) => ["deal_kontrak", "proses_so", "pengiriman"].includes(l.stage_key));
    const masukAll = live.filter((l) => ymOf(l.created_at) === ym);
    const masuk = live.filter((l) => inR(l.created_at));

    // Satu aturan deal di semua tab: deal = lead yang sekarang di tahap menang, menurut tanggal deal lead.
    const mkRows = (test) => dealLeads.filter((l) => test(l.deal_date)).map((l) => ({ date: l.deal_date, value: val(l), name: l.name, lead: l }));
    const dealRows = mkRows(inR);
    const dealRowsMonth = mkRows((d) => ymOf(d) === ym);
    const dealValue = dealRows.reduce((s, d) => s + d.value, 0);
    const sphValue = sph.reduce((s, l) => s + val(l), 0);
    const hotValue = hot.reduce((s, l) => s + val(l), 0);
    const lostValue = lost.reduce((s, l) => s + val(l), 0);
    const sphAll = sphValue + hotValue + dealValue;

    const dealsByDay = {}, masukByDay = {};
    for (const d of dealRowsMonth) (dealsByDay[String(d.date).slice(0, 10)] ||= []).push(d);
    for (const l of masukAll) (masukByDay[String(l.created_at).slice(0, 10)] ||= []).push(l);

    return {
      hasBsbFlow, masuk, dealRows, sphCount: sph.length, sphValue, hotCount: hot.length, hotValue, dealValue,
      lostCount: lost.length, lostValue, sphAll, running, runningValue: running.reduce((s, l) => s + val(l), 0),
      dealsByDay, masukByDay,
    };
  }, [leads, stages, ym, range, dealLeads]);

  // Omzet bulan sebelumnya pada lingkup yang sama, untuk pembanding di kartu omzet.
  const prevDeal = useMemo(() => {
    if (!fullMonth) return 0;
    const t = new Date(year, month - 2, 1);
    const pym = `${t.getFullYear()}-${pad(t.getMonth() + 1)}`;
    return dealLeads.filter((l) => ymOf(l.deal_date) === pym).reduce((n, l) => n + num(l.deal_value), 0);
  }, [dealLeads, year, month, fullMonth]);

  // Aktivitas tiap marketing pada periode yang sama (RPC tab Team; hanya owner/manager Enterprise, selain itu kolom disembunyikan).
  // Aktivitas = kunjungan + lead di-update + lead baru + pindah tahap. Deal tidak dihitung sebagai aktivitas.
  const [act, setAct] = useState(null);
  // Naik setiap ada perubahan tim dari realtime, supaya angka aktivitas ikut diperbarui.
  const [dataTick, setDataTick] = useState(0);
  useEffect(() => {
    const onData = () => setDataTick((n) => n + 1);
    window.addEventListener("nexto-data-changed", onData);
    return () => window.removeEventListener("nexto-data-changed", onData);
  }, []);

  // Deal dibaca dari server (rentang bulan lalu sampai akhir periode), sumber yang sama dengan tab Team dan Rekap aktivitas.
  const dealFrom = useMemo(() => {
    const t = new Date(year, month - 2, 1);
    const pFrom = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-01`;
    return range.from < pFrom ? range.from : pFrom;
  }, [year, month, range.from]);
  useEffect(() => {
    let alive = true;
    db.getDealEntries(dealFrom, range.to).then((d) => { if (alive) setEntriesSrv(d); }).catch(() => { if (alive) setEntriesSrv([]); });
    return () => { alive = false; };
  }, [dealFrom, range.to, dataTick]);

  useEffect(() => {
    if (personal || view !== "penjualan") return undefined;
    let alive = true;
    const f = new Date(`${range.from}T00:00:00+07:00`), t = new Date(`${range.to}T23:59:59.999+07:00`);
    db.getTeamActivity(f, t).then((r) => {
      if (!alive) return;
      const m = {};
      for (const x of r?.members || []) m[x.user_id] = (Number(x.visits) || 0) + (Number(x.leads_updated) || 0) + (Number(x.new_leads) || 0) + (Number(x.stage_moves) || 0);
      setAct(m);
    }).catch(() => { if (alive) setAct(null); });
    return () => { alive = false; };
  }, [personal, view, range.from, range.to, dataTick]);

  // Perbandingan antar marketing (selalu dari seluruh data, tidak ikut pilihan marketing di atas).
  const team = useMemo(() => {
    return marketers.map((m) => {
      const ls = fLeads.filter((l) => !l.deleted_at && (l.assigned_to || l.user_id) === m.id);
      const won = dealsSrv.filter((l) => !l.deleted_at && (l.assigned_to || l.user_id) === m.id && inR(l.deal_date) && passF(l));
      const hot = ls.filter((l) => l.stage_key === "hot_progress");
      const sph = ls.filter((l) => l.stage_key === "sph_terlayang");
      const sumV = (arr, f) => arr.reduce((t, x) => t + num(f(x)), 0);
      return {
        ...m,
        masuk: ls.filter((l) => inR(l.created_at)).length,
        aktivitas: act ? (act[m.id] ?? 0) : null,
        sph: sph.length, hot: hot.length, hotValue: sumV(hot, (l) => l.deal_value),
        deals: won.length,
        omzet: sumV(won, (l) => l.deal_value),
      };
    }).sort((a, b) => b.omzet - a.omzet);
  }, [marketers, fLeads, stages, ym, range, act]);

  // Saat pertama dibuka (atau pindah bulan) pilih hari terbaru yang punya aktivitas, bukan hari kosong.
  const [autoFor, setAutoFor] = useState("");
  useEffect(() => {
    if (autoFor === ym) return;
    const days = Object.keys({ ...r.dealsByDay, ...r.masukByDay }).filter((d) => ymOf(d) === ym && d <= (todayIso.startsWith(ym) ? todayIso : "9999")).sort();
    if (days.length === 0 && leads.length === 0) return; // data belum dimuat
    setAutoFor(ym);
    if (days.length) setSelected(days[days.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym, r]);

  // Tanggal terpilih selalu ada di bulan yang tampil (hari ini kalau bulan ini, selain itu hari pertama berisi aktivitas).
  useEffect(() => {
    if (autoFor !== ym || ymOf(selected) === ym) return;
    setSelected(todayIso.startsWith(ym) ? todayIso : `${ym}-01`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ym, autoFor]);

  // Target dibaca dari sistem target tab Team (sales_targets per marketing per bulan) supaya satu sumber.
  // Target tim = jumlah target para marketing. Diubah per marketing (di sini saat satu marketing dipilih, atau di tab Team).
  const [targets, setTargets] = useState({});
  useEffect(() => {
    if (personal) { setTargets({}); return undefined; }
    let alive = true;
    db.getTeamTargets(`${ym}-01`).then((rows) => { if (alive) setTargets(Object.fromEntries((rows || []).map((x) => [x.user_id, num(x.target)]))); }).catch(() => { if (alive) setTargets({}); });
    return () => { alive = false; };
  }, [ym, personal]);
  const targetOf = (uid) => num(targets[uid]);
  const target = personal || !fullMonth ? 0 : scopeId === "all" ? marketers.reduce((s, m) => s + targetOf(m.id), 0) : targetOf(scopeId);
  const reached = target > 0 ? Math.min(100, (r.dealValue / target) * 100) : 0;

  // Sel kalender: minggu mulai Senin, selalu kelipatan 7.
  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const lead = (first.getDay() + 6) % 7;
    const total = Math.ceil((lead + daysInMonth) / 7) * 7;
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(year, month - 1, 1 - lead + i);
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return { iso, day: d.getDate(), inMonth: d.getMonth() === month - 1, weekend: d.getDay() === 0 || d.getDay() === 6 };
    });
  }, [year, month, daysInMonth]);

  const selDeals = r.dealsByDay[selected] || [];
  // Klik deal di panel kanan menampilkan detail deal saja (bukan lead modal). Hilang otomatis saat ganti hari.
  const [pilihDeal, setPilihDeal] = useState(null);
  const detailDeal = pilihDeal ? selDeals.find((d) => d.lead?.id === pilihDeal) : null;
  const selMasuk = r.masukByDay[selected] || [];
  const selDate = new Date(`${selected}T00:00:00`);
  const sourceOf = (l) => Object.entries(l).find(([k, v]) => /^custom_field_\d+$/.test(k) && SOURCES.includes(v))?.[1] || "";
  const pick = (c) => { setSelected(c.iso); if (!c.inMonth) { setMode("month"); setYm(c.iso.slice(0, 7)); } };

  // Ekspor ke Google Sheet: satu worksheet per tab laporan (Penjualan, Rencana, Rekap), isinya sama dengan layar ini.
  const buildSheetTabs = async () => {
    const who = personal ? "Report saya" : scopeId === "all" ? "Semua tim" : scopeName;
    const stageLabel = Object.fromEntries(stages.map((s) => [s.key, s.label]));
    const wibDate = (ts) => new Date(new Date(ts).getTime() + 7 * 3600000).toISOString().slice(0, 10);
    // Satu tab: baris, baris judul bagian, baris header, dan kolom angka (diberi format ribuan di Sheet).
    const sheet = (title, moneyCols = []) => {
      const s = { title, rows: [], headerRows: [], sectionRows: [], totalRows: [], moneyCols, freezeRow: 0 };
      s.push = (row) => s.rows.push(row);
      s.head = (row) => { s.headerRows.push(s.rows.length); s.rows.push(row); };
      s.section = (row) => { s.sectionRows.push(s.rows.length); s.rows.push(row); };
      s.total = (row) => { s.totalRows.push(s.rows.length); s.rows.push(row); };
      return s;
    };
    const deals = [...r.dealRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));

    const p = sheet("Penjualan", [1, 2, 3, 4, 5, 6, 7]);
    p.section([`Report penjualan ${who}`]);
    p.push([org?.name || "", periodLabel]);
    p.push([]);
    p.section(["Ringkasan"]);
    p.head(["Keterangan", "Jumlah", "Nilai"]);
    p.push(["Omzet", "", r.dealValue]);
    if (target > 0) {
      p.push(["Target", "", target]);
      p.push(["Capaian target", "", `${Math.round((r.dealValue / target) * 100)}%`]);
    }
    p.push(["Data masuk", r.masuk.length, ""]);
    p.push(["SPH belum diproses", r.sphCount, r.sphValue]);
    p.push(["Hot progress", r.hotCount, r.hotValue]);
    p.push(["Deal", deals.length, r.dealValue]);
    p.push([]);
    p.section([`Deal ${periodWord} (${deals.length})`]);
    p.head(["Tanggal", "Nama", "Nilai"]);
    for (const d of deals) p.push([String(d.date).slice(0, 10), d.name, num(d.value)]);
    p.push([]);
    p.section([`Lead masuk (${r.masuk.length})`]);
    p.head(["Tanggal masuk", "Nama", "Tahap", "Nilai"]);
    for (const l of r.masuk) p.push([wibDate(l.created_at), l.name, stageLabel[l.stage_key] || l.stage_key || "", num(l.deal_value)]);
    if (!personal && scopeId === "all" && team.length) {
      p.push([]);
      p.section(["Hasil per marketing"]);
      p.head(["Marketing", ...(act ? ["Aktivitas"] : []), "Lead masuk", "SPH", "Hot", "Deal", "Omzet", "Target"]);
      for (const m of team) p.push([m.name, ...(act ? [m.aktivitas ?? ""] : []), m.masuk, m.sph, m.hot, m.deals, m.omzet, targetOf(m.id)]);
    }

    // Rencana bulan yang sama, sesuai pilihan anggota di layar (RLS membatasi yang boleh dibaca).
    const plans = (await db.listRencana(`${ym}-01`, `${ym}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`))
      .filter((x) => scopeId === "all" || x.user_id === scopeId);
    const nameOf = (uid) => members.find((m) => m.user_id === uid)?.display_name || "";
    const rc = sheet("Rencana", [3]);
    rc.section([`Rencana ${periodLabel} (${plans.length})`]);
    rc.head(["Tanggal", "Kegiatan", "Jenis", "Target", "Status", ...(personal ? [] : ["Anggota"])]);
    for (const x of plans) rc.push([x.plan_date, x.title, x.kind, num(x.target_value), x.done ? "Selesai" : "Belum", ...(personal ? [] : [nameOf(x.user_id)])]);
    // Header tabel Rencana dikunci saat digulir dan diberi filter otomatis.
    rc.freezeRow = rc.headerRows[0];
    rc.filterRow = rc.headerRows[0];

    // Rekap: ringkasan per tahap, lalu daftar lead per tahap dengan kolom seperti laporan Excel.
    const live = leads.filter((l) => !l.deleted_at);
    const rk = sheet("Rekap", [7]);
    rk.section([`Rekap ${periodLabel}`, who]);
    rk.push([]);
    rk.section(["Ringkasan per tahap"]);
    rk.head(["Tahap", "Jumlah lead", "Nilai"]);
    for (const s of stages) {
      const ls = live.filter((l) => l.stage_key === s.key);
      rk.push([s.label, ls.length, ls.reduce((t, l) => t + num(l.deal_value), 0)]);
    }
    rk.total(["Total", live.length, live.reduce((t, l) => t + num(l.deal_value), 0)]);
    for (const s of stages) {
      const ls = live.filter((l) => l.stage_key === s.key).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      rk.push([]);
      rk.section([`${s.label} (${ls.length})`]);
      rk.head(["NO", "TANGGAL", "NAMA", "INSTANSI", "NOMOR TELP", "ALAMAT", "NO SPH / INVOICE", "NILAI", "KETERANGAN", "SUMBER"]);
      ls.forEach((l, i) => rk.push([
        i + 1, wibDate(l.created_at), l.name || "", l.company_type || "", l.phone || "", l.city || "",
        String(l.custom_field_1 || "").trim(), num(l.deal_value),
        [l.next_action, l.key_person && l.key_person !== l.name ? `PIC ${l.key_person}` : ""].filter(Boolean).join(" · "),
        sourceOfLead(l),
      ]));
    }

    return [p, rc, rk];
  };
  // Buka laporan sebagai Google Sheet baru (perlu koneksi Google sekali).
  const openInSheets = async () => {
    setSheetBusy(true);
    try {
      const tabs = await buildSheetTabs();
      const res = await db.exportLeadsToSheet(tabs);
      if (res.needs_connect) {
        const c = await db.connectGoogleSheets();
        window.location.href = c.url;
        return;
      }
      window.open(res.url, "_blank", "noopener");
    } catch (e) {
      alert("Gagal membuka Google Sheet: " + (e?.message || e));
    } finally {
      setSheetBusy(false);
    }
  };

  // Unduh langsung sebagai file Excel (tanpa tab baru atau koneksi Google).
  const downloadReport = async () => {
    setSheetBusy(true);
    try {
      const tabs = await buildSheetTabs();
      await downloadReportXlsx({ tabs, fileName: `Report-${(org?.name || "nexto").replace(/[^A-Za-z0-9]+/g, "-")}-${ym}.xlsx` });
    } catch (e) {
      alert("Gagal mengunduh: " + (e?.message || e));
    } finally {
      setSheetBusy(false);
    }
  };

  // Cetak ke PDF lewat dialog cetak peramban: ringkasan omzet, pipeline, deal bulan ini, dan perbandingan marketing.
  const printReport = () => {
    const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const who = personal ? "Report saya" : scopeId === "all" ? "Semua tim" : scopeName;
    const deals = [...r.dealRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const rows = (arr) => arr.map((c) => `<tr>${c.map((x, i) => `<td class="${i ? "r" : ""}">${esc(x)}</td>`).join("")}</tr>`).join("");
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Report ${esc(who)} ${esc(periodLabel)}</title>
<style>*{box-sizing:border-box}body{font:12px/1.5 system-ui,Segoe UI,sans-serif;color:#0f172a;margin:28px}h1{font-size:20px;margin:0}h2{font-size:13px;margin:22px 0 6px}.m{color:#64748b}
.k{display:flex;gap:10px;margin-top:14px}.k div{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:10px}.k b{display:block;font-size:17px}table{width:100%;border-collapse:collapse}th,td{padding:5px 8px;border-bottom:1px solid #e2e8f0;text-align:left}th{font-size:11px;color:#64748b}.r{text-align:right;font-variant-numeric:tabular-nums}
@media print{body{margin:14mm}}</style></head><body>
<h1>Report penjualan ${esc(who)}</h1><div class="m">${esc(org?.name || "")} · ${esc(periodLabel)}${filtered ? " · terfilter" : ""}</div>
<div class="k"><div><span class="m">Omzet</span><b>${esc(fmtRp(r.dealValue))}</b>${target > 0 ? `<span class="m">${pct(r.dealValue, target)} dari target ${esc(fmtRp(target))}</span>` : ""}</div>
<div><span class="m">Data masuk</span><b>${r.masuk.length}</b></div><div><span class="m">SPH belum diproses</span><b>${r.sphCount}</b><span class="m">${esc(fmtRp(r.sphValue))}</span></div>
<div><span class="m">Hot progress</span><b>${r.hotCount}</b><span class="m">${esc(fmtRp(r.hotValue))}</span></div><div><span class="m">Deal</span><b>${deals.length}</b></div></div>
<h2>Deal ${esc(periodWord)}</h2>${deals.length ? `<table><thead><tr><th>Tanggal</th><th>Nama</th><th class="r">Nilai</th></tr></thead><tbody>${rows(deals.map((d) => [String(d.date).slice(0, 10), d.name, fmtRp(d.value)]))}</tbody></table>` : '<div class="m">Belum ada deal pada bulan ini.</div>'}
${!personal && scopeId === "all" && team.length ? `<h2>Hasil per marketing</h2><table><thead><tr><th>Marketing</th>${act ? '<th class="r">Aktivitas</th>' : ""}<th class="r">Lead masuk</th><th class="r">SPH</th><th class="r">Hot</th><th class="r">Deal</th><th class="r">Omzet</th><th class="r">Capaian target</th></tr></thead><tbody>${rows(team.map((m) => [m.name, ...(act ? [m.aktivitas] : []), m.masuk, m.sph, m.hot, m.deals, fmtRp(m.omzet), targetOf(m.id) > 0 ? pct(m.omzet, targetOf(m.id)) : "-"]))}</tbody></table>` : ""}
<div class="m" style="margin-top:18px">Dicetak ${new Date().toLocaleString("id-ID")} dari Nexto.</div></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Pop-up diblokir peramban. Izinkan pop-up untuk situs ini lalu coba lagi."); return; }
    w.document.open(); w.document.write(html); w.document.close();
    w.focus(); setTimeout(() => w.print(), 300);
  };

  // Unduh PowerPoint (17 Okt 2026, permintaan Nando): tombol untuk akun tim marketing (tampilan pribadi), bukan manager.
  const downloadPpt = async () => {
    try {
      const deals = [...r.dealRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
      await downloadReportPpt({
        orgId: org?.id || null,
        userId: await db.getCurrentUserId(),
        orgName: org?.name || "",
        who: personal ? "Laporan pribadi" : scopeId === "all" ? "Semua tim" : scopeName,
        periodLabel,
        fmtRp,
        pct,
        filtered,
        target,
        extra: {
          prevDeal,
          lostCount: r.lostCount,
          lostValue: r.lostValue,
          runningValue: r.runningValue,
          running: r.running.map((l) => ({ name: l.name, value: num(l.deal_value), stage: stages.find((s) => s.key === l.stage_key)?.label || l.stage_key })),
        },
        summary: {
          dealValue: r.dealValue, dealCount: deals.length, masuk: r.masuk.length,
          sphCount: r.sphCount, sphValue: r.sphValue, hotCount: r.hotCount, hotValue: r.hotValue,
        },
        deals: deals.map((d) => ({ date: d.date, name: d.name, value: d.value })),
        showTeam: !personal && scopeId === "all",
        // Tampilan pribadi (marketing) tidak pernah menerima data tim lain.
        team: personal ? [] : team.map((m) => ({ name: m.name, masuk: m.masuk, sph: m.sph, hot: m.hot, deals: m.deals, omzet: m.omzet, target: targetOf(m.id) })),
      });
    } catch (e) {
      setErr(e.message || "Gagal membuat PowerPoint");
    }
  };

  return (
    <div className="report-glass space-y-4">
      <SheetsAnnouncement enterprise={org?.plan === "enterprise"} />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-display text-[22px] font-bold tracking-[-0.03em] text-ink">{personal ? "Report saya" : "Report"}</h1>
        <div className="flex rounded-full bg-slate-100 p-0.5 text-[12px] font-semibold" role="tablist" aria-label="Jenis laporan">
          {[["penjualan", "Penjualan"], ["rekap", "Rekap"], ...(personal ? [] : [["iklan", "Iklan"]]), ["rencana", "Rencana"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={cn("rounded-full px-3.5 py-1.5", focus, view === k ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink")}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
        {/* Ekspor ke Google Sheet (25 Okt 2026): paket Enterprise, semua peran. */}
        {org?.plan === "enterprise" && (
          <div ref={sheetRef} className="relative">
            <button
              type="button"
              onClick={() => setSheetMenu((o) => !o)}
              disabled={sheetBusy}
              aria-haspopup="menu"
              aria-expanded={sheetMenu}
              aria-busy={sheetBusy}
              title={sheetBusy ? "Menyiapkan file…" : "Ekspor laporan"}
              aria-label={sheetBusy ? "Menyiapkan file laporan" : "Ekspor laporan"}
              className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 transition-colors hover:bg-slate-200 active:scale-95 disabled:cursor-wait disabled:opacity-70 motion-reduce:transition-none", focus)}
            >
              {sheetBusy ? <Loader2 size={18} className="animate-spin" /> : <SheetsIcon size={18} />}
            </button>
            {sheetMenu && (
              <div role="menu" className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-float">
                <button type="button" role="menuitem" onClick={() => { setSheetMenu(false); downloadReport(); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold text-ink hover:bg-slate-50">Unduh Excel (.xlsx)</button>
                <button type="button" role="menuitem" onClick={() => { setSheetMenu(false); openInSheets(); }} className="flex w-full items-center rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold text-ink hover:bg-slate-50">Buka di Google Sheet</button>
              </div>
            )}
          </div>
        )}
        {view === "penjualan" && (
          <button
            type="button"
            onClick={downloadPpt}
            title="Unduh PPT"
            aria-label="Unduh PPT"
            className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 transition-colors hover:bg-slate-200 active:scale-95 motion-reduce:transition-none", focus)}
          >
            <PowerPointIcon size={18} />
          </button>
        )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex rounded-full bg-slate-100 p-0.5 text-[12px] font-semibold" role="group" aria-label="Periode">
          {[
            ["today", "Hari ini", mode === "today"],
            ["week", "Minggu", mode === "week"],
            ["month", "Bulan ini", fullMonth && ymSel === todayIso.slice(0, 7)],
            ["last", "Bulan lalu", fullMonth && ymSel === prevYm],
          ].map(([k, label, on]) => (
            <button key={k} type="button" aria-pressed={on} onClick={() => { if (k === "month") { setMode("month"); setYm(todayIso.slice(0, 7)); } else if (k === "last") { setMode("month"); setYm(prevYm); } else setMode(k); }} className={cn("rounded-full px-3 py-1", focus, on ? "bg-white text-ink shadow-sm" : "text-slate-500 hover:text-ink")}>{label}</button>
          ))}
        </div>
        <div className="relative flex h-8 items-center gap-0.5" ref={pickRef}>
          {fullMonth && <button type="button" onClick={() => go(-1)} aria-label="Bulan sebelumnya" className={cn("rounded-full p-1 text-slate-500 hover:bg-slate-100", focus)}><ChevronLeft size={16} /></button>}
          <button type="button" aria-haspopup="dialog" aria-expanded={pickOpen} onClick={() => { setDFrom(range.from); setDTo(range.to); setPickOpen((o) => !o); }} title="Pilih rentang tanggal" className={cn("inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold text-ink hover:bg-slate-100", focus, mode === "custom" && "bg-slate-100")}>
            {periodLabel}<ChevronDown size={14} className="text-slate-400" />
          </button>
          {fullMonth && <button type="button" onClick={() => go(1)} aria-label="Bulan berikutnya" className={cn("rounded-full p-1 text-slate-500 hover:bg-slate-100", focus)}><ChevronRight size={16} /></button>}
          {pickOpen && (
            <div role="dialog" aria-label="Pilih rentang tanggal" className="absolute left-0 top-full z-30 mt-2 w-[280px] rounded-panel border border-slate-200 bg-white p-4 shadow-float">
              <div className="text-[12px] font-semibold text-ink">Rentang tanggal</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-500">Dari
                  <input type="date" value={dFrom} max={dTo || undefined} onChange={(e) => setDFrom(e.target.value)} className="mt-1 h-9 w-full rounded-inner border border-slate-200 bg-white px-2 text-[12px] text-ink" />
                </label>
                <label className="text-[11px] text-slate-500">Sampai
                  <input type="date" value={dTo} min={dFrom || undefined} onChange={(e) => setDTo(e.target.value)} className="mt-1 h-9 w-full rounded-inner border border-slate-200 bg-white px-2 text-[12px] text-ink" />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setPickOpen(false)} className={cn("h-8 rounded-full px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-100", focus)}>Batal</button>
                <button type="button" disabled={!dFrom || !dTo || dFrom > dTo} onClick={() => { setCFrom(dFrom); setCTo(dTo); setMode("custom"); setPickOpen(false); }} className={cn("h-8 rounded-full bg-ink px-4 text-[12px] font-semibold text-white disabled:opacity-40", focus)}>Terapkan</button>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {view !== "iklan" && (
            <>
              {!personal && marketers.length > 0 && (
                <select value={scopeId} onChange={(e) => setMemberId(e.target.value)} aria-label="Marketing" className="h-8 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                  <option value="all">Semua tim</option>
                  {marketers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
              <select value={srcF} onChange={(e) => setSrcF(e.target.value)} aria-label="Filter sumber lead" className="h-8 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                <option value="all">Semua sumber</option>
                {sourceOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              <select value={stF} onChange={(e) => setStF(e.target.value)} aria-label="Filter tahap" className="h-8 rounded-full border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                <option value="all">Semua tahap</option>
                {stages.map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
              </select>
              <button type="button" onClick={() => { setSrcF("all"); setStF("all"); }} tabIndex={filtered ? 0 : -1} aria-hidden={!filtered} className={cn("h-8 rounded-full px-2 text-[12px] font-semibold text-brand-strong hover:underline", focus, !filtered && "invisible")}>Reset</button>
            </>
          )}
          {view === "penjualan" && <button type="button" onClick={printReport} title="Cetak / simpan PDF" aria-label="Cetak atau simpan PDF" className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200", focus)}><Printer size={16} /></button>}
        </div>
      </div>

      <div className="min-h-[60vh]">
      {view === "rencana" ? (
        <RencanaBulanan ym={ym} members={members} canManage={canManage} />
      ) : view === "rekap" ? (
        <RekapLaporan leads={leads} stages={stages} ym={ym} orgName={scopeId === "all" ? (org?.name || "") : scopeName} target={target} personal={personal} members={members} />
      ) : view === "iklan" ? (
        <AdsAnalysis leads={allLeads} stages={stages} dealTransactions={allTx} members={members} canManage={canManage} org={org} ym={ym} from={range.from} to={range.to} periodLabel={periodLabel} canImport={canImport} onChanged={onChanged} />
      ) : (
        <>
          <section className="overflow-hidden rounded-panel bg-ink p-6 text-white">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <div className="min-w-0">
                <div className="text-[12.5px] text-slate-400">{personal ? `Omzet Anda ${periodWord}` : scopeId === "all" ? `Omzet ${periodWord}` : `Omzet ${scopeName} ${periodWord}`}</div>
                <div className="mt-2 font-display text-[32px] font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-[52px]">{fmtRp(r.dealValue)}</div>
              </div>
              {!personal && fullMonth && (
                <div className="sm:text-right">
                  <div className="text-[12.5px] text-slate-400">{scopeId === "all" ? "Target tim" : `Target ${scopeName}`}</div>
                  <div className="mt-0.5 font-display text-[20px] font-bold tabular-nums tracking-[-0.02em]">{target ? fmtRp(target) : "Belum diisi"}</div>
                  <div className="mt-1 text-[11.5px] text-slate-500">Target diatur per marketing di tab Team</div>
                  {err && <div className="mt-1 text-[11px] text-rose-300">{err}</div>}
                </div>
              )}
            </div>
            {(() => {
              const isNow = ym === todayIso.slice(0, 7);
              const isPast = ym < todayIso.slice(0, 7);
              const left = isNow ? daysInMonth - now.getDate() : 0;
              const gap = r.dealValue - target;
              const delta = prevDeal > 0 ? ((r.dealValue - prevDeal) / prevDeal) * 100 : null;
              const st = targetStatus({ actual: r.dealValue, target, isNow, isPast, elapsed: now.getDate(), daysInMonth });
              const need = !personal && target > 0 && gap < 0 ? (isNow && left > 0 ? `Sisa ${left} hari. Butuh ${fmtRp(Math.ceil(-gap / left))} per hari untuk mencapai target.` : isNow ? "Hari terakhir bulan ini." : "") : "";
              return (
                <>
                  {!personal && fullMonth && (
                    <div className="mt-6">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                        <span className="inline-flex items-center gap-2 text-slate-400">
                          Capaian <span className="font-semibold tabular-nums text-white">{target > 0 ? pct(r.dealValue, target) : "-"}</span>
                        </span>
                        {target > 0 && <span className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1", TONES[st.tone])}>{st.label}</span>}
                      </div>
                      <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Capaian target" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(reached)}>
                        <div className="h-full rounded-full bg-emerald-400 motion-safe:transition-[width] motion-safe:duration-700" style={{ width: `${reached}%` }} />
                      </div>
                    </div>
                  )}
                  {!personal && target > 0 && (
                    <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5 sm:grid-cols-3">
                      {[
                        ["Forecast", st.forecast > 0 && !isPast ? fmtRp(st.forecast) : "-"],
                        ["Gap ke target", gap >= 0 ? `+${fmtRp(gap)}` : `-${fmtRp(-gap)}`],
                        ["Bulan lalu", fmtRp(prevDeal)],
                      ].map(([k, v]) => (
                        <div key={k}><dt className="flex items-center text-[11.5px] text-slate-400">{k}<InfoTip text={TARGET_INFO[k]} /></dt><dd className="mt-1 text-[16px] font-bold tabular-nums tracking-[-0.02em]">{v}</dd></div>
                      ))}
                    </dl>
                  )}
                  {(need || (fullMonth && delta !== null)) && (
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[12px] text-slate-400">
                      <span>{need}</span>
                      {delta !== null && <span className="tabular-nums">{delta >= 0 ? "Naik" : "Turun"} {Math.abs(delta).toFixed(0)}% dari bulan lalu</span>}
                    </div>
                  )}
                  {st.forecast > 0 && isNow && target > 0 && <p className="mt-3 text-[11px] text-slate-500">Forecast dari laju {now.getDate()} hari pertama bila bertahan sampai akhir bulan. Aman: forecast mencapai target. Warning: 80-99%. Di bawah 80%: berpotensi tidak tercapai.</p>}
                </>
              );
            })()}
          </section>

          <div className="grid gap-px overflow-hidden rounded-panel border border-slate-200 bg-slate-200 sm:grid-cols-4">
            {[
              [r.masuk.length, "Data masuk", `Dibuat ${periodWord}`, "text-brand-strong"],
              [r.sphCount, "SPH belum diproses", fmtRp(r.sphValue), "text-ink"],
              [r.hotCount, "Hot progress", fmtRp(r.hotValue), "text-ink"],
              [r.dealRows.length, `Deal ${periodWord}`, fmtRp(r.dealValue), "text-emerald-600"],
            ].map(([v, l, h, c]) => (
              <div key={l} className="bg-white p-4">
                <div className="text-[11.5px] font-medium text-slate-500">{l}</div>
                <div className={cn("mt-1 font-display text-[26px] font-bold leading-none tabular-nums tracking-[-0.03em]", c)}>{v}</div>
                <div className="mt-1.5 text-[11.5px] tabular-nums text-slate-400">{h}</div>
              </div>
            ))}
          </div>

          {!r.hasBsbFlow && (
            <p className="rounded-inner bg-amber-50 px-4 py-2.5 text-[12px] text-amber-800">Pipeline organisasi ini belum memakai tahap SPH Terlayang dan Hot Progress, jadi angka SPH dan hot progress akan kosong.</p>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <Panel className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
                <div className="font-display text-[15px] font-bold tracking-[-0.02em] text-ink">{MONTHS[month - 1]} {year}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Deal</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /> Data masuk</span>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-7 border-b border-slate-100">
                {WEEKDAYS.map((w, i) => (
                  <div key={w} className={cn("px-2 py-1.5 text-center text-[11px] font-medium", i >= 5 ? "text-slate-400" : "text-slate-500")}>{w}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-px bg-slate-100">
                {cells.map((c) => {
                  const deals = r.dealsByDay[c.iso] || [];
                  const masuk = r.masukByDay[c.iso] || [];
                  const isToday = c.iso === todayIso, isSel = c.iso === selected;
                  const hidden = deals.length - Math.min(1, deals.length);
                  return (
                    <div
                      key={c.iso}
                      role="button"
                      tabIndex={0}
                      aria-label={`${c.day} ${MONTHS[Number(c.iso.slice(5, 7)) - 1]}: ${deals.length} deal, ${masuk.length} data masuk`}
                      aria-pressed={isSel}
                      onClick={() => pick(c)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(c); } }}
                      className={cn(
                        "min-h-[48px] cursor-pointer p-1.5 text-left outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-brand sm:min-h-[84px]",
                        c.inMonth ? (c.weekend ? "bg-slate-50" : "bg-white") : "bg-slate-50/50",
                        isSel ? "ring-2 ring-inset ring-brand" : "hover:bg-brand-soft/40",
                      )}
                    >
                      <span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] font-semibold tabular-nums", isToday ? "bg-ink text-white" : c.inMonth ? "text-ink" : "text-slate-300")}>{c.day}</span>
                      {c.inMonth && (
                        <>
                          <div className="mt-1 hidden space-y-0.5 sm:block">
                            {deals.slice(0, 1).map((d, i) => (
                              <div key={`d${i}`} className="truncate rounded-[5px] bg-emerald-50 px-1.5 text-[10.5px] font-semibold leading-[18px] text-emerald-700">{truncate(d.name, 12)} · {short(d.value)}</div>
                            ))}
                            {hidden > 0 && <div className="px-1 text-[10.5px] font-medium text-emerald-700">+{hidden} deal lagi</div>}
                            {masuk.length > 0 && <div className="truncate px-1 text-[10.5px] font-medium text-brand-strong">{masuk.length} data masuk</div>}
                          </div>
                          <div className="mt-1 flex justify-center gap-0.5 sm:hidden">
                            {deals.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                            {masuk.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel className="p-5">
              <PanelHeader title={`${DAYS_LONG[selDate.getDay()]}, ${selDate.getDate()} ${MONTHS[selDate.getMonth()]}`} meta={`${selDeals.length} deal, ${selMasuk.length} data masuk`} />
              {selDeals.length === 0 && selMasuk.length === 0 ? (
                <div className="mt-3"><EmptyState>Tidak ada aktivitas pada tanggal ini. Deal dan data masuk tim muncul di sini otomatis.</EmptyState></div>
              ) : detailDeal ? (
                <div className="mt-3">
                  <button type="button" onClick={() => setPilihDeal(null)} className={cn("mb-3 inline-flex items-center gap-1 rounded-full text-[12px] font-semibold text-slate-500 hover:text-ink", focus)}><ChevronLeft size={13} /> Kembali</button>
                  <div className="text-[15px] font-bold tracking-[-0.02em] text-ink">{detailDeal.name}</div>
                  <div className="mt-0.5 font-display text-[22px] font-bold tabular-nums tracking-[-0.03em] text-emerald-700">{fmtRp(detailDeal.value)}</div>
                  <dl className="mt-4 divide-y divide-slate-100 text-[12.5px]">
                    {[
                      ["Tanggal deal", detailDeal.date ? fmtD(String(detailDeal.date).slice(0, 10)) : "-"],
                      ["Penanggung jawab", marketers.find((m) => m.id === (detailDeal.lead?.assigned_to || detailDeal.lead?.user_id))?.name || "-"],
                      ["Tahap", stages.find((s) => s.key === detailDeal.lead?.stage_key)?.label || "-"],
                      ["Jenis", detailDeal.lead?.company_type || "-"],
                      ["Kota", detailDeal.lead?.city || "-"],
                      ["Sumber", sourceOf(detailDeal.lead || {}) || "-"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3 py-2">
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="text-right font-semibold text-slate-800">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : (
                <div className="mt-3 divide-y divide-slate-100">
                  {selDeals.map((d, i) => (
                    <button key={`d${i}`} type="button" disabled={!d.lead} onClick={() => d.lead && setPilihDeal(d.lead.id)} className={cn("flex w-full items-center justify-between gap-3 py-2.5 text-left disabled:cursor-default", focus)}>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-ink">{d.name}</span>
                        <span className="block text-[11px] text-slate-500">{d.lead?.company_type || "Deal"}</span>
                      </span>
                      <Pill tone="good" className="shrink-0 tabular-nums">{short(d.value)}</Pill>
                    </button>
                  ))}
                  {selMasuk.map((l) => (
                    <button key={l.id} type="button" onClick={() => onOpenLead?.(l)} className={cn("flex w-full items-center justify-between gap-3 py-2.5 text-left", focus)}>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-ink">{l.name}</span>
                        <span className="block text-[11px] text-slate-500">{[l.company_type, l.city].filter(Boolean).join(" · ") || "Data masuk"}</span>
                      </span>
                      {sourceOf(l) && <Pill tone="brand" className="shrink-0">{sourceOf(l)}</Pill>}
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {dealLeads.length > 0 && <div className="mb-5"><PaymentBreakdownCard rows={paymentRowsOf(dealLeads)} periodLabel={periodLabel} /></div>}
          {productRows.length > 0 && (
            <Panel className="p-5">
              <PanelHeader title="Omzet per produk" meta={`Total transaksi deal ${periodLabel}, dikelompokkan per nama barang.`} />
              <ul className="mt-2 divide-y divide-slate-100">
                {productRows.map((p) => (
                  <li key={p.produk} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <span className="min-w-0 truncate text-slate-800">{p.produk}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">{p.deals} deal · <b className="font-semibold text-slate-800">{fmtRp(Number(p.omzet) || 0)}</b></span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {!personal && scopeId === "all" && team.length > 0 && (
            <Panel className="p-5">
              <PanelHeader title="Hasil per marketing" meta={`Pipeline dan omzet ${periodLabel}. Target, forecast, dan aktivitas tiap orang ada di tab Team. Klik nama untuk membuka report-nya.`} />
              <ul className="mt-2 divide-y divide-slate-100">
                {team.map((m) => {
                  const totalOmzet = team.reduce((t, x) => t + x.omzet, 0);
                  const tgt = targetOf(m.id);
                  const st = fullMonth ? targetStatus({ actual: m.omzet, target: tgt, isNow: ym === todayIso.slice(0, 7), isPast: ym < todayIso.slice(0, 7), elapsed: now.getDate(), daysInMonth }) : null;
                  const figures = [["Lead masuk", m.masuk], ["SPH", m.sph], ["Hot", m.hot], ["Deal", m.deals], ...(act ? [["Aktivitas", m.aktivitas]] : [])];
                  return (
                    <li key={m.id} className="grid gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_170px_200px] sm:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => setMemberId(m.id)} className={cn("truncate text-[14px] font-semibold text-ink hover:text-brand-strong", focus)}>{m.name}</button>
                          {st && <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1", TONES[st.tone])}>{st.label === "Berpotensi tidak mencapai target" ? "Berisiko" : st.label}</span>}
                        </div>
                        <dl className="mt-2.5 grid gap-2 text-center" style={{ gridTemplateColumns: `repeat(${figures.length}, minmax(0, 1fr))` }}>
                          {figures.map(([k, v]) => (
                            <div key={k} className="rounded-inner bg-slate-50 px-1.5 py-1.5">
                              <dt className="text-[10.5px] text-slate-500">{k}</dt>
                              <dd className="mt-0.5 text-[14px] font-semibold tabular-nums text-ink">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                      <div className="sm:text-right">
                        <div className="text-[11px] text-slate-500">Omzet</div>
                        <div className="font-display text-[18px] font-bold leading-tight tabular-nums tracking-[-0.02em] text-emerald-700">{fmtRp(m.omzet)}</div>
                        {fullMonth && tgt > 0 && <div className="mt-0.5 text-[12px] tabular-nums text-slate-600">{pct(m.omzet, tgt)} dari target</div>}
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between text-[11px] text-slate-500">
                          <span>Kontribusi tim</span>
                          <span className="font-semibold tabular-nums text-slate-700">{totalOmzet > 0 ? pct(m.omzet, totalOmzet) : "-"}</span>
                        </div>
                        <Meter value={totalOmzet > 0 ? (m.omzet / totalOmzet) * 100 : 0} max={100} tone="good" className="mt-1.5 h-1.5" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
          {org?.plan === "enterprise" && (
            <Panel className="mt-5 p-5">
              <PanelHeader title="Unduh laporan" meta="File Excel berisi tab Penjualan, Rencana, dan Rekap, sesuai layar ini." />
              <button
                type="button"
                onClick={downloadReport}
                disabled={sheetBusy}
                aria-busy={sheetBusy}
                className={cn("mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70", focus)}
              >
                {sheetBusy ? <Loader2 size={14} className="animate-spin" /> : <SheetsIcon size={16} />}
                {sheetBusy ? "Menyiapkan file…" : "Unduh laporan (Excel)"}
              </button>
            </Panel>
          )}
          {canManage && <div className="mt-5"><ProyekDashboard leads={allLeads} stages={stages} /></div>}
        </>
      )}
      </div>
    </div>
  );
}
