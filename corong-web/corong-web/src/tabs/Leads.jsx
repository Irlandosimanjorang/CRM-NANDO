import { useMemo, useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import {
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  Pencil,
  Mail,
  Globe,
  ShieldCheck,
  ShieldAlert,
  Copy,
  MapPin,
  Sparkles,
  Phone,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  Users,
  Activity,
  Flame,
  Trophy,
  UserX,
} from "lucide-react";

import * as db from "../lib/db";

import {
  stageMeta,
  chipStyle,
  prioMeta,
  typeBadge,
  waLink,
  daysSince,
  fmtRp,
  prettyDomain,
  isNewLead,
  todayISO,
  nameSimilarity,
} from "../lib/helpers";

import LeadModal from "../components/LeadModal";
import DuplicateModal from "../components/DuplicateModal";
import ImportSummaryModal from "../components/ImportSummaryModal";
import ManualColumnMapModal from "../components/ManualColumnMapModal";
import AiDraftPopup from "../components/AiDraftPopup";
import ProgressPopup from "../components/ProgressPopup";
import { saveOpenModal, clearOpenModal, getOpenModal } from "../lib/uiPersist";

import {
  getFieldLabel,
  getCategories,
  isFieldHidden,
  getCustomFieldSlots,
  getCompanyTypeOptions,
} from "../lib/industryTemplates";

// === BUG FIX (5 Sep 2026, diperluas 6 Sep 2026) ===
// Popup draft AI (AiDraftPopup) di-"ingat" lewat localStorage (modul
// lib/uiPersist.js, dipake bareng sama modal lain kayak LeadModal) - kalau
// browser/tab HP di-reload total (bukan cuma pindah menu doang) SAAT popup ini
// lagi kebuka, dia otomatis kebuka LAGI pas Nexto dibuka ulang, gak perlu klik
// tombol Sparkles-nya manual lagi. "source" dipake buat bedain restore punya
// tab Leads vs tab Dashboard (biar gak dobel kebuka di dua tempat sekaligus -
// semua tab selalu ke-mount bareng), "channel" (whatsapp/email) DIIKUTIN
// juga - sebelumnya kalau di-restore, orangnya harus klik WhatsApp/Email lagi
// biar draft-nya keliatan (padahal draft-nya sendiri udah kesimpen di server,
// tinggal ditampilin doang).
function saveOpenDraftPopup(leadId, channel) { saveOpenModal("draft", { source: "leads", leadId, channel }); }
function clearOpenDraftPopup() { clearOpenModal("draft"); }
function getOpenDraftPopup() {
  const data = getOpenModal("draft");
  return data?.source === "leads" ? data : null;
}


/* =========================================================
   IMPORT MAPPING
========================================================= */

// Kata kunci kolom nama - dipisah "kuat" (spesifik, aman dicocokin biasa) vs
// "lemah" (kata tunggal umum kayak "customer"/"nama"). BUG DITEMUKAN (8 Sep
// 2026): kata kunci lemah "customer" nyantol ke header "Customer Products"
// (daftar PRODUK yang dibeli customer, BUKAN nama customer-nya!) di sebuah
// Excel laporan visit sales - hasilnya lead ke-import dengan "nama" = "PVC
// pipe" dst, bukan nama company aslinya. Sekarang header yang JUGA
// mengandung kata "kualifikasi atribut" (product/type/id/status/dst) ditolak
// KHUSUS buat kata kunci lemah - header "Company"/"Nama Perusahaan" polos
// tetep aman karena dicek duluan lewat NAME_STRONG_KEYS.
const NAME_STRONG_KEYS = [
  "公司名称", "company name", "customer name", "client name", "full name",
  "nama perusahaan", "nama customer", "nama klien", "nama nasabah", "nama pembeli",
  "company", "perusahaan",
];
const NAME_WEAK_KEYS = ["customer", "client", "klien", "nasabah", "pembeli", "nama", "name"];
const NAME_QUALIFIER_BLACKLIST = [
  "product", "produk", "type", "tipe", "category", "kategori", "id", "status",
  "date", "tanggal", "note", "catatan", "keterangan", "email", "phone",
  "telepon", "hp", "wa", "website", "web", "city", "kota", "province",
  "provinsi", "price", "harga", "qty", "quantity", "jumlah", "total",
  "supplier", "usage", "line", "position", "jabatan",
];

// BUG DITEMUKAN (8 Sep 2026): matching pake .includes() polos bikin "product"
// nyantol ke header "Production Lines" (substring "product" ada di dalam
// "production"!) - kolom itu ke-tebak jadi "Produk" padahal harusnya gak
// ke-tebak sama sekali (biar user bisa pilih "+ Custom..."). Sekarang match
// pake batas kata (karakter sebelum/sesudahnya HARUS bukan huruf/angka),
// biar "product" gak lagi nyantol ke "production". Kata kunci CJK (Chinese)
// dikecualiin dari aturan batas kata ini (gak ada spasi antar kata di CJK,
// jadi tetep pake substring biasa).
function headerMatchesKey(header, key) {
  const h = String(header ?? "").toLowerCase();
  const k = key.toLowerCase();
  if (!/^[a-z0-9 ]+$/.test(k)) return h.includes(k);
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return re.test(h);
}

function findColIndex(headers, keys) {
  for (const k of keys) {
    const idx = headers.findIndex((h) => headerMatchesKey(h, k));
    if (idx !== -1) return idx;
  }
  return null;
}

function guessNameColIndex(headers) {
  for (const k of NAME_STRONG_KEYS) {
    const idx = headers.findIndex((h) => headerMatchesKey(h, k));
    if (idx !== -1) return idx;
  }
  for (const k of NAME_WEAK_KEYS) {
    const idx = headers.findIndex((h) => {
      if (!headerMatchesKey(h, k)) return false;
      return !NAME_QUALIFIER_BLACKLIST.some((bad) => headerMatchesKey(h, bad));
    });
    if (idx !== -1) return idx;
  }
  return null;
}

const FIELD_KEY_MAP = {
  email: ["邮箱", "email"],
  phone: ["电话", "phone", "telepon", "wa", "hp"],
  key_person: ["联系人", "key person", "contact", "pic", "nama kontak"],
  key_person_title: ["jabatan", "job title", "position", "title"],
  product: ["产品", "product", "produk"],
  city: ["城市", "city", "kota"],
  province: ["省", "province", "provinsi"],
  website: ["网站", "website", "web"],
  background: ["公司背景", "background", "海关"],
  notes: ["备注", "catatan", "keterangan", "notes", "note", "remark", "riwayat", "progress"],
};

// Nebak petaan kolom -> field langsung dari baris header (row pertama
// sheet) - dipake buat PRE-FILL ImportColumnMapModal (lihat importFile).
// Ini CUMA tebakan awal - user SELALU harus review & konfirmasi dulu
// sebelum data beneran masuk (dulu sistemnya auto-import diam-diam kalau
// tebakan ini "keliatan yakin", sekarang gak ada lagi jalur silent kayak
// gitu - meleset di sini paling-paling cuma bikin user perlu benerin
// dropdown, bukan bikin data salah masuk).
function guessMappingFromHeaders(headers) {
  const mapping = {};
  const nameIdx = guessNameColIndex(headers);
  if (nameIdx !== null) mapping.name = nameIdx;
  for (const [field, keys] of Object.entries(FIELD_KEY_MAP)) {
    const idx = findColIndex(headers, keys);
    if (idx !== null && idx !== mapping.name) mapping[field] = idx;
  }
  return mapping;
}

// Dari MAPPING kolom (index) -> field, bangun objek lead per baris data.
// Dipake buat SEMUA sumber mapping: tebakan header, hasil AI
// (smart-import-map-ts), MAUPUN pemetaan yang user tentuin/betulin sendiri
// lewat ImportColumnMapModal - generic, jalan buat field custom_field_1..5
// juga (bukan cuma field bawaan) karena cuma nurutin key apa aja yang ada
// di `mapping`, gak hardcode daftar field.
function extractRowsFromMapping(dataRows, mapping, firstStage) {
  const get = (row, idx) => (idx === null || idx === undefined || idx === "") ? "" : String(row[idx] ?? "").trim();
  const out = [];
  for (const row of dataRows) {
    const name = get(row, mapping.name);
    if (!name || /^(xxx|yyyy-mm-dd|mr\/ms xxx)$/i.test(name.trim())) continue;
    const obj = { name, category: "Lainnya", stage_key: firstStage, source: "import" };
    for (const [field, idx] of Object.entries(mapping)) {
      if (field === "name") continue;
      obj[field] = get(row, idx);
    }
    out.push(obj);
  }
  return out;
}


/* =========================================================
   LEAD CARD
========================================================= */

// Warna avatar konsisten per lead (hash nama) - bukan acak tiap render,
// biar lead yang sama selalu keliatan sama tiap kali list di-reload.
const AVATAR_PALETTE = ["#0ea5e9", "#a855f7", "#22c55e", "#f59e0b", "#6366f1", "#ec4899"];
function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
function initials(name) {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function LeadCard({ c, stages, productLabel, onEdit, onDelete, onDraft, onProgress, canManage, members, onReassign }) {
  // Progress bar mulai dari 0% terus animasi jalan ke posisi asli begitu
  // kartu ini muncul di layar - kesan "hidup", bukan langsung nongol jadi.
  const [barReady, setBarReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setBarReady(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  const sm = stageMeta(stages, c.stage_key);
  const wa = waLink(c.phone);

  const stageIndex = Math.max(0, stages.findIndex((s) => s.key === c.stage_key));
  const stageNumber = stages.length > 0 ? stageIndex + 1 : 1;
  const progressPercent = stages.length > 1 ? Math.min(100, Math.max(0, (stageIndex / (stages.length - 1)) * 100)) : 0;

  const lastProgress = c.progressLog?.[0];
  const lastContact = lastProgress?.created_at || lastProgress?.date || lastProgress?.updated_at || null;
  const daysSinceContact = daysSince(lastContact);

  // Outline kartu ikut warna urgensi kontak - kartu overdue kelihatan
  // beda dari jauh (border merah), gak perlu buka satu-satu buat tau
  // mana yang perlu diprioritasin duluan.
  const urgency =
    daysSinceContact === null
      ? { stripe: "#cbd5e1", text: "#94a3b8", note: "Belum pernah dihubungi" }
      : daysSinceContact <= 3
      ? { stripe: "#10b981", text: "#059669", note: `Dihubungi ${daysSinceContact} hari lalu` }
      : daysSinceContact <= 7
      ? { stripe: "#f59e0b", text: "#b45309", note: `${daysSinceContact} hari sejak kontak terakhir` }
      : { stripe: "#e11d48", text: "#be123c", note: `${daysSinceContact} hari - perlu ditindaklanjuti` };

  return (
    <div
      onClick={() => onEdit(c)}
      className="rounded-2xl bg-white cursor-pointer overflow-hidden transition-all hover:shadow-[0_10px_30px_-16px_rgba(15,23,42,0.3)]"
      style={{ border: `1.5px solid ${urgency.stripe}` }}
    >
      <div className="p-4 sm:p-5">
        {/* HEADER */}
        <div className="flex items-start gap-3">
          <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-white font-extrabold text-[13px] shrink-0" style={{ background: avatarColor(c.name) }}>
            {initials(c.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className="font-bold text-slate-900 text-[17px] leading-snug tracking-tight truncate">{c.name}</div>
              {c.priority === "high" && <Flame size={14} className="text-orange-500 shrink-0" fill="currentColor" />}
            </div>
            <div className="text-[12.5px] text-slate-400 mt-0.5 truncate">{[c.category, c.city || c.province].filter(Boolean).join(", ") || "Belum ada kategori"}</div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {c.verified ? <ShieldCheck size={18} className="text-emerald-500" /> : <ShieldAlert size={18} className="text-slate-300" />}
            {c.deal_value > 0 && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                {fmtRp(c.deal_value)}
              </span>
            )}
          </div>
        </div>

        {/* TAHAP PIPELINE */}
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${sm.hex}17`, color: sm.hex }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sm.hex }} />
              {sm.label}
            </span>
            <span className="text-[11px] text-slate-400 shrink-0">Tahap {stageNumber} dari {Math.max(stages.length, 1)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${barReady ? progressPercent : 0}%`, background: sm.hex }} />
          </div>
        </div>

        {/* KONTAK / PRODUK */}
        <div className="mt-4 flex items-stretch gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-400">{c.phone ? "Telepon" : "Key person"}</div>
            <div className="text-[13px] text-slate-700 mt-0.5 truncate">{c.phone || c.key_person || "—"}</div>
          </div>
          <div className="w-px bg-slate-100" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-400">{productLabel || "Produk"}</div>
            <div className="text-[13px] text-slate-700 mt-0.5 truncate">{c.product || "—"}</div>
          </div>
        </div>

        {c.email && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-400 truncate">
            <Mail size={12} className="shrink-0" />
            <span className="truncate">{c.email}</span>
          </div>
        )}

        {/* NEXT ACTION - satu momen yang paling ditonjolkan di kartu ini */}
        <div className="mt-4 pl-3 border-l-2 border-orange-400">
          <div className="text-[13px] font-medium text-slate-800 line-clamp-2">{c.next_action || "Belum ada rencana tindak lanjut"}</div>
          <div className="text-[11px] mt-1 font-medium" style={{ color: urgency.text }}>{urgency.note}</div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {c.phone && (
            wa ? (
              <a href={wa} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50" title={c.phone}>
                <Phone size={13} />
              </a>
            ) : (
              <span className="p-1.5 text-slate-300" title={c.phone}>
                <Phone size={13} />
              </span>
            )
          )}

          {c.email && (
            <a href={`mailto:${c.email}`} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50" title={c.email}>
              <Mail size={13} />
            </a>
          )}

          <button onClick={(e) => onDraft(c, e.currentTarget.getBoundingClientRect())} className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50" title="Draft follow-up (AI)">
            <Sparkles size={13} />
          </button>

          {/* Reassign - owner ATAU manager yang liat ini, biar bisa mindahin
              lead punya sales_rep A ke sales_rep B kapan aja (misal si A
              resign, atau kerjaannya mau diratain ulang). */}
          {canManage && members.length > 1 && (
            <select
              value={c.assigned_to || ""}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onReassign(c.id, e.target.value)}
              className="text-[11px] border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-slate-500 max-w-[110px]"
              title="Pindahkan lead ke anggota tim lain"
            >
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name || `Anggota ${m.user_id.slice(0, 8)}`}
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => onEdit(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Edit lead">
              <Pencil size={13} />
            </button>
            <button onClick={() => onDelete(c.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" title="Hapus lead">
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* PROGRESS UPDATE */}
        <button
          onClick={(e) => { e.stopPropagation(); onProgress(c); }}
          className="mt-2.5 w-full flex items-center gap-2 text-left text-[12px] text-slate-500 border-2 border-l-[3px] border-slate-200 border-l-orange-400 bg-slate-50 rounded-xl px-3 py-2 hover:border-orange-300 hover:border-l-orange-500 hover:text-orange-700 hover:bg-orange-50/60 transition-colors"
          title="Update progress harian"
        >
          <ClipboardList size={13} className="shrink-0 text-slate-400" />
          <span className="truncate">{c.progressLog?.[0] ? c.progressLog[0].text : "Update progress hari ini…"}</span>
        </button>
      </div>
    </div>
  );
}


/* =========================================================
   COMPACT KPI CARD
========================================================= */

function MiniKpi({
  icon: Icon,
  label,
  value,
  active,
  onClick,
  iconClass = "text-slate-500",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        shrink-0
        min-w-[76px]
        sm:min-w-0
        flex-1
        h-[32px]
        px-2
        rounded-md
        border
        text-left
        transition-all
        duration-150
        ${
          active
            ? "bg-slate-900 border-slate-900 text-white shadow-sm"
            : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
        }
      `}
    >
      <div className="flex items-center gap-1.5 h-full">
        <Icon
          size={11}
          className={active ? "text-white" : iconClass}
        />

        <div className="min-w-0 flex items-center gap-1">
          <span
            className={`
              text-[7px]
              uppercase
              tracking-wider
              font-semibold
              truncate
              ${active ? "text-slate-400" : "text-slate-400"}
            `}
          >
            {label}
          </span>

          <span
            className={`
              text-xs
              leading-none
              font-bold
              ${active ? "text-white" : "text-slate-900"}
            `}
          >
            {value}
          </span>
        </div>
      </div>
    </button>
  );
}
/* =========================================================
   LEADS
========================================================= */

export default function Leads({
  leads,
  stages,
  settings,
  industry,
  customFieldLabels,
  myLevel,
  onChanged,
  canManage,
  isEnterprise,
}) {

  const [q, setQ] =
    useState("");

  const [fCat, setFCat] =
    useState("");

  const [fType, setFType] =
    useState("");

  // Daftar anggota tim (buat filter "leads siapa" & reassign) - owner ATAU
  // manager yang butuh ini, karena RLS leads_role_access ngasih owner/manager
  // dua-duanya akses liat & ubah lead SEMUA orang di orgnya (sales_rep cuma
  // lead-nya sendiri). BUG FIX: sebelumnya di-gate ke isOwner doang, bikin
  // manager gak keliatan fitur ini padahal RLS-nya udah ngasih akses.
  const [members, setMembers] = useState([]);
  const [fAssignee, setFAssignee] = useState("");
  const [myUid, setMyUid] = useState(null);
  useEffect(() => {
    if (!canManage) return;
    db.getOrgMembers().then(setMembers).catch(() => setMembers([]));
    db.getCurrentUserId().then(setMyUid).catch(() => setMyUid(null));
  }, [canManage]);

  // Approval-gate export (Enterprise) - sales_rep butuh persetujuan
  // owner/manager dulu sebelum bisa export data. Status request TERBARU
  // milik dia sendiri ditarik dari DB biar tombol Export tau harus:
  // (a) minta approval baru, (b) bilang "masih nunggu", atau (c) beneran
  // ngizinin export sekali pas udah di-approve.
  const [exportApproval, setExportApproval] = useState(null);
  const refreshExportApproval = () => {
    if (isEnterprise && !canManage) {
      db.getMyLatestApproval("export_leads").then(setExportApproval).catch(() => setExportApproval(null));
    }
  };
  useEffect(refreshExportApproval, [isEnterprise, canManage]);

  const [page, setPage] =
    useState(1);

  const PAGE_SIZE = 60;

  const [edit, setEdit] =
    useState(null);

  // BUG FIX (6 Sep 2026): LeadModal yang dibuka dari SINI (klik kartu lead di
  // tab Leads) itu instance LOKAL-nya sendiri, terpisah dari LeadModal global
  // di App.jsx (yang dipakai Dashboard/Deal/Visit/Advisor) - jadi butuh
  // restore sendiri juga, kind BEDA ("leadinline") biar gak bentrok dobel
  // modal kalau kebetulan dua-duanya kesimpen.
  // `restoredRef` jaga-jaga race condition: effect "simpan" di bawah ini
  // jalan JUGA pas mount pertama (edit masih null) - tanpa guard ini dia
  // bakal langsung clearOpenModal() dan ngewipe catetan localStorage SEBELUM
  // effect restore (yang nunggu `leads` selesai load) sempet baca sama sekali.
  const restoredLeadInlineRef = useRef(false);
  useEffect(() => {
    if (edit?.id) saveOpenModal("leadinline", { leadId: edit.id });
    else if (restoredLeadInlineRef.current) clearOpenModal("leadinline");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit?.id]);
  useEffect(() => {
    if (!leads || leads.length === 0) return;
    restoredLeadInlineRef.current = true;
    if (edit) return;
    const saved = getOpenModal("leadinline");
    if (saved?.leadId) {
      const lead = leads.find((l) => l.id === saved.leadId);
      if (lead) setEdit(lead);
      else clearOpenModal("leadinline");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length > 0]);

  const [busy, setBusy] =
    useState(false);

  const [showDup, setShowDup] =
    useState(false);

  // Ringkasan hasil import terakhir - ditampilin di ImportSummaryModal
  // (gantiin alert polos "Import selesai: X lead" yang sebelumnya gak
  // ngasih tau detail apa aja yang masuk atau yang dilewatin karena duplikat).
  const [importSummary, setImportSummary] =
    useState(null);

  // Kalau rule-based MAUPUN AI gagal nemuin kolom nama sama sekali - dulu
  // langsung nyerah (alert "Ga ada baris kebaca"). Sekarang dilempar ke sini,
  // biar user sendiri yang milih kolom mana isinya apa lewat
  // ManualColumnMapModal, bukan main tebak-tebakan mulu.
  const [manualMapRequest, setManualMapRequest] =
    useState(null);

  const [draftPopup, setDraftPopup] =
    useState(null);

  const [progressPopup, setProgressPopup] =
    useState(null);

  // ---- RESTORE popup yang lagi kebuka pas terakhir kali app ke-reload total
  // (lihat komentar BUG FIX di atas file). Nunggu `leads` beneran udah
  // ke-load dulu (gak nyari di array kosong) sebelum nyoba restore. Cek modal
  // generik SEKALI - isinya bisa draft popup, cek duplikat, ATAU progress
  // popup (satu-satunya yang realistis kebuka barengan). ----
  useEffect(() => {
    if (!leads || leads.length === 0) return;
    const draftSaved = getOpenDraftPopup();
    if (draftSaved) {
      const lead = leads.find((l) => l.id === draftSaved.leadId);
      if (lead) { setDraftPopup({ lead, rect: null, channel: draftSaved.channel || undefined }); return; }
      clearOpenDraftPopup(); // lead-nya udah gak ada (misal kehapus), buang aja catetannya
    }
    const progressSaved = getOpenModal("progress");
    if (progressSaved?.leadId) {
      const lead = leads.find((l) => l.id === progressSaved.leadId);
      if (lead) { setProgressPopup({ lead, autoFocus: true }); return; }
      clearOpenModal("progress");
    }
    if (getOpenModal("dupcheck")) setShowDup(true);
    // Import selesai -> onChanged() (= reload() di App.jsx) langsung nyalain
    // loading spinner App-level, yang UNMOUNT total komponen Leads ini (ganti
    // ke <Splash/>) sebelum sempet render popup ringkasannya - state lokal
    // `importSummary` abis di-set langsung ikut ke-wipe. Makanya ringkasannya
    // ikut disimpen ke localStorage (pola yang sama kayak draft/progress/
    // dupcheck di atas) dan di-restore di sini begitu Leads remount.
    const importSaved = getOpenModal("importSummary");
    if (importSaved) setImportSummary(importSaved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads.length > 0]);

  const openDraftPopup = (lead, rect) => {
    setDraftPopup({ lead, rect });
    saveOpenDraftPopup(lead.id, undefined);
  };
  const closeDraftPopup = () => {
    setDraftPopup(null);
    clearOpenDraftPopup();
  };


  /* =========================================================
     LABEL / INDUSTRY
  ========================================================= */

  const titleLabel =
    getFieldLabel(
      industry,
      "key_person_title",
      "Jabatan"
    );

  const keyPersonLabel =
    getFieldLabel(
      industry,
      "key_person",
      "Key Person"
    );

  const productLabel =
    getFieldLabel(
      industry,
      "product",
      "Produk"
    );

  const hideKeyPerson =
    isFieldHidden(
      industry,
      "key_person"
    );

  const hideTitle =
    isFieldHidden(
      industry,
      "key_person_title"
    );

  const hideWebsite =
    isFieldHidden(
      industry,
      "website"
    );

  const customSlots =
    getCustomFieldSlots(
      industry
    );

  const categories =
    getCategories(
      industry
    );

  const showTypeFilter =
    !isFieldHidden(
      industry,
      "company_type"
    );

  const companyTypeOptions =
    getCompanyTypeOptions(
      industry
    ).filter(
      (t) => t.v
    );


  /* =========================================================
     KPI
  ========================================================= */

  const kpi = useMemo(() => {

    // KPI ngikutin filter "sales rep" (fAssignee) juga - biar owner yang
    // lagi liatin lead punya satu rep tertentu keliatan angka Active/Hot/
    // Won/No Contact YANG BENERAN buat rep itu, bukan angka gabungan
    // seluruh tim yang nyesatin.
    const kpiBase =
      fAssignee
        ? leads.filter(
            (l) =>
              l.assigned_to ===
              fAssignee
          )
        : leads;

    const total =
      kpiBase.length;

    const activeStageKeys =
      stages
        .filter(
          (s, i) =>
            s.type === "normal" &&
            i !== 0
        )
        .map(
          (s) => s.key
        );

    const wonStageKeys =
      stages
        .filter(
          (s) =>
            s.type === "won"
        )
        .map(
          (s) => s.key
        );

    const active =
      kpiBase.filter(
        (lead) =>
          activeStageKeys.includes(
            lead.stage_key
          )
      ).length;

    const hot =
      kpiBase.filter(
        (lead) =>
          String(
            lead.priority || ""
          ).toLowerCase() ===
          "hot"
      ).length;

    const won =
      kpiBase.filter(
        (lead) =>
          wonStageKeys.includes(
            lead.stage_key
          )
      ).length;

    const noContact =
      kpiBase.filter(
        (lead) =>
          !lead.phone &&
          !lead.email
      ).length;

    return {
      total,
      active,
      hot,
      won,
      noContact,
    };

  }, [
    leads,
    stages,
    fAssignee,
  ]);


  /* =========================================================
     FILTER
  ========================================================= */

  const filtered =
    useMemo(
      () =>
        leads.filter((c) => {

          if (
            fCat &&
            c.category !==
              fCat
          ) {
            return false;
          }

          if (
            fType &&
            (c.company_type ||
              "") !==
              fType
          ) {
            return false;
          }

          if (
            fAssignee &&
            c.assigned_to !==
              fAssignee
          ) {
            return false;
          }

          if (q) {

            const s =
              q.toLowerCase();

            const fieldHay = [
              c.name,
              c.city,
              c.province,
              c.key_person,
              c.product,
              c.sales_owner,
            ].map(
              (x) =>
                (
                  x || ""
                ).toLowerCase()
            );

            const progressHay =
              (
                c.progressLog ||
                []
              ).map(
                (p) =>
                  (
                    p.text ||
                    ""
                  ).toLowerCase()
              );

            const allHay = [
              ...fieldHay,
              ...progressHay,
            ];

            if (
              !allHay.some(
                (h) =>
                  h.includes(s)
              )
            ) {
              return false;
            }

          }

          return true;

        }),
      [
        leads,
        q,
        fCat,
        fType,
        fAssignee,
      ]
    );


  /* =========================================================
     PAGE RESET
  ========================================================= */

  useEffect(() => {

    setPage(1);

  }, [
    q,
    fCat,
    fType,
    fAssignee,
  ]);


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
          PAGE_SIZE
      )
    );


  const pageItems =
    useMemo(() => {

      const start =
        (page - 1) *
        PAGE_SIZE;

      return filtered.slice(
        start,
        start + PAGE_SIZE
      );

    }, [
      filtered,
      page,
    ]);


  const blank = () => ({
    name: "",
    category:
      categories[0],
    stage_key:
      stages[0]?.key,
    company_type: "",
    priority: "",
    verified: false,
  });


  /* =========================================================
     KPI FILTER
  ========================================================= */

  const clearFilters = () => {
    setQ("");
    setFCat("");
    setFType("");
  };


  const filterActive = () => {

    clearFilters();

    const activeStageKeys =
      stages
        .filter(
          (s, i) =>
            s.type === "normal" &&
            i !== 0
        )
        .map(
          (s) => s.key
        );

    const firstActive =
      activeStageKeys[0];

    if (firstActive) {

      const stage =
        stages.find(
          (s) =>
            s.key ===
            firstActive
        );

      if (stage) {
        setQ("");
      }

    }

  };


  const filterHot = () => {

    clearFilters();

    setQ("");

  };


  /* =========================================================
     IMPORT
  ========================================================= */

  // Threshold sama persis kayak DuplicateModal ("Cek Duplikat" manual) - biar
  // konsisten: dua nama yang dianggap "mirip banget" di satu tempat juga
  // dianggap gitu di tempat lain.
  const IMPORT_DUP_THRESHOLD = 0.72;

  // Tahap AKHIR import, dipake baik dari jalur otomatis (rule-based/AI)
  // MAUPUN dari ManualColumnMapModal - dedup (exact + fuzzy) terhadap lead
  // yang udah ada, insert, tulis catatan sebagai progress note, lalu
  // tampilin ImportSummaryModal.
  const finalizeImport = async (leadRows, usedAiFallback) => {
    // Dulu dedup import cuma cek EXACT match nama (trim+lowercase) - lead
    // yang namanya udah ada tapi ditulis agak beda ("PT ABC" vs "PT ABC
    // Indonesia") lolos dan bikin data dobel. Sekarang dicek dua lapis:
    // exact match (persis kayak sebelumnya) DAN fuzzy match pake fungsi
    // yang sama dipakai "Cek Duplikat". `knownNames` mulai dari nama lead
    // yang udah ada, lalu BERTAMBAH tiap kali satu baris diterima - biar
    // baris-baris baru DALAM satu file import yang sama-sama mirip juga
    // ketangkep, bukan cuma yang mirip sama lead lama.
    const existingByKey = new Map(leads.map((l) => [l.name.trim().toLowerCase(), l.name]));
    // Snapshot nama-nama yang UDAH ADA di database SEBELUM import ini mulai -
    // dipake buat bedain "duplikat sama data lama di CRM" vs "duplikat sama
    // baris LAIN di file yang lagi diimport sekarang" (dua kasus beda yang
    // sebelumnya digeneralisir jadi 1 pesan "udah ada di CRM" - bikin bingung
    // akun BARU yang CRM-nya masih kosong tapi tetep ada baris "dilewati").
    const originalLeadNames = new Set(leads.map((l) => l.name));
    const knownNames = leads.map((l) => l.name);
    const seenThisImport = new Set();

    const toInsert = []; // { lead, notes }
    const duplicates = []; // { name, matchedName, score, source: "existing" | "this_import" }

    for (const m of leadRows) {
      const name = (m.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();

      const existingExact = existingByKey.get(key);
      if (existingExact || seenThisImport.has(key)) {
        duplicates.push({ name, matchedName: existingExact || name, score: 1, source: existingExact ? "existing" : "this_import" });
        continue;
      }

      const fuzzyMatchName = knownNames.find((n) => nameSimilarity(n, name) >= IMPORT_DUP_THRESHOLD);
      if (fuzzyMatchName) {
        duplicates.push({ name, matchedName: fuzzyMatchName, score: nameSimilarity(fuzzyMatchName, name), source: originalLeadNames.has(fuzzyMatchName) ? "existing" : "this_import" });
        continue;
      }

      seenThisImport.add(key);
      knownNames.push(name);
      const { notes, ...leadPayload } = m;
      toInsert.push({ lead: { ...leadPayload, name }, notes });
    }

    if (toInsert.length === 0 && duplicates.length === 0) {
      alert("Ga ada baris kebaca. Pastikan ada data nama perusahaan/lead.");
      return;
    }

    const insertedPairs = []; // { id, name, notes }
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const inserted = await db.bulkInsertLeads(chunk.map((c) => c.lead));
      const notesByName = new Map(chunk.map((c) => [c.lead.name.toLowerCase(), c.notes]));
      for (const row of inserted) {
        insertedPairs.push({ id: row.id, name: row.name, notes: notesByName.get(row.name.toLowerCase()) || "" });
      }
    }

    // Kolom catatan/keterangan dari Excel (kalau ada, lihat mapRow &
    // smart-import-map-ts) BUKAN kolom lead - ditulis di sini sebagai
    // progress note di lead yang baru dibikin. Dikirim 20 sekaligus biar
    // gak nge-spam request tapi tetep cepet buat import ratusan baris.
    const withNotes = insertedPairs.filter((p) => p.notes && p.notes.trim());
    for (let i = 0; i < withNotes.length; i += 20) {
      const chunk = withNotes.slice(i, i + 20);
      await Promise.all(
        chunk.map((p) =>
          db.addProgress(p.id, p.notes.trim()).catch((e) => console.error("Gagal simpan note import buat", p.name, e))
        )
      );
    }

    const summary = {
      imported: insertedPairs.map((p) => ({ name: p.name, hasNote: !!(p.notes && p.notes.trim()) })),
      duplicates,
      usedAiFallback,
    };
    // Disimpen ke localStorage SEBELUM onChanged() dipanggil - onChanged()
    // (reload()) unmount komponen ini sesaat lagi, jadi kalau urutannya
    // kebalik, popup ringkasan gak akan pernah sempet muncul sama sekali.
    saveOpenModal("importSummary", summary);
    setImportSummary(summary);

    onChanged();
  };

  // Import SEKARANG SELALU lewat layar konfirmasi petaan kolom (dulu auto-
  // import diam-diam kalau "keliatan yakin", user baru ketauan ada yang
  // salah SETELAH data kelanjur masuk - lihat percakapan soal "Customer
  // Products" ke-anggep nama lead). Rule-based/AI di importFile cuma buat
  // PRE-FILL tebakan, ManualColumnMapModal yang nentuin apa yang beneran
  // diimport, lewat handleManualMapConfirm.
  const importFile = async (file) => {
    if (!file) return;
    setBusy(true);

    try {
      // xlsx dimuat DINAMIS di sini (bukan static import di atas) - library
      // ini lumayan berat (~500KB+), padahal cuma kepake pas user beneran
      // klik import. Nunda loadingnya sampai titik ini bikin bundle awal
      // Nexto lebih ringan buat SEMUA user, termasuk yang gak pernah import.
      const XLSX = await import("xlsx");
      const buf = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const firstStage = stages[0]?.key;

      // Ambil sheet PERTAMA yang punya data - kalau file punya beberapa
      // sheet (umumnya cuma "Sheet2" kosong bawaan Excel), yang lain
      // diabaikan. Sheet lain bisa diimport terpisah kalau memang perlu.
      let sheetName = null;
      let rawRows = [];
      for (const sn of wb.SheetNames) {
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
        const nonEmpty = aoa.filter((r) => r.some((v) => String(v).trim()));
        if (nonEmpty.length > 0) { sheetName = sn; rawRows = nonEmpty; break; }
      }

      if (rawRows.length === 0) {
        alert("File-nya kosong, ga ada data sama sekali yang kebaca.");
        return;
      }

      // Tebak petaan dari baris header (row pertama) dulu - GRATIS, gak
      // perlu manggil AI. Kalau gagal nemuin kolom nama (misal ada baris
      // judul di atas header asli), baru minta AI baca sample & tentuin
      // sendiri kolom + baris data mulai dari mana.
      let guessedMapping = guessMappingFromHeaders(rawRows[0]);
      let guessedDataStartRow = 1;
      let usedAiGuess = false;

      if (guessedMapping.name === undefined || guessedMapping.name === null) {
        try {
          const sample = rawRows.slice(0, 8);
          const { data_start_row, mapping } = await db.smartImportMap(sample);
          if (mapping && mapping.name !== null && mapping.name !== undefined) {
            guessedMapping = mapping;
            guessedDataStartRow = Math.min(Math.max(data_start_row || 0, 0), rawRows.length);
            usedAiGuess = true;
          } else {
            guessedMapping = {};
            guessedDataStartRow = 0;
          }
        } catch (aiErr) {
          console.error("Smart import AI gagal nebak:", aiErr);
          // Sebelumnya diem-diem aja jatuh ke pemetaan manual tanpa bilang
          // apa-apa - user gak pernah tau KENAPA (misal jatah Smart Import
          // udah abis). Sekarang dikasih tau alasannya lewat notif, baru
          // lanjut ke pemetaan manual biar proses import-nya tetep jalan.
          alert(aiErr.message || "Smart Import AI gagal diproses, silakan petain kolom manual.");
          guessedMapping = {};
          guessedDataStartRow = 0;
        }
      }

      setManualMapRequest({
        sheetName,
        rawRows,
        firstStage,
        initialMapping: guessedMapping,
        initialDataStartRow: guessedDataStartRow,
        usedAiGuess,
        // Slot custom_field_1..5 yang UDAH ada namanya (dari template industri
        // atau import sebelumnya) - ditawarin sebagai pilihan langsung di
        // dropdown, biar import berikutnya dengan kolom yang sama gak perlu
        // bikin ulang custom field baru.
        existingCustomSlots: getCustomFieldSlots(industry, customFieldLabels),
      });
    } catch (e) {
      alert("Gagal baca file: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleManualMapConfirm = async (mapping, dataStartRow, customEntries) => {
    if (!manualMapRequest) return;
    const { rawRows, firstStage, usedAiGuess } = manualMapRequest;

    // ---- RESOLVE "+ Custom..." ke slot custom_field_1..5 ----
    // Label yang PERSIS sama (case-insensitive) dengan slot yang udah ada
    // dipakai ulang slotnya (biar import berulang kali dengan kolom yang
    // sama nyambung ke field yang sama, gak numpuk field baru tiap import).
    // Label baru dikasih slot kosong pertama yang ketemu. Cuma ada 5 slot -
    // kalau abis, import DIBATALIN (bukan diem-diem buang datanya) biar user
    // sadar & bisa pilih mau reuse slot lain atau lewatin kolom itu.
    const currentLabels = { ...(customFieldLabels || {}) };
    const usedSlotKeys = new Set(Object.keys(currentLabels).filter((k) => currentLabels[k]));
    const newLabelAssignments = {};
    const finalMapping = { ...mapping };
    const overflow = [];

    for (const entry of customEntries || []) {
      const label = (entry.label || "").trim();
      if (!label) continue;

      const existingSlotKey = Object.entries(currentLabels).find(
        ([, v]) => String(v || "").trim().toLowerCase() === label.toLowerCase()
      )?.[0];

      if (existingSlotKey) {
        finalMapping[existingSlotKey] = entry.colIndex;
        continue;
      }

      const freeSlotKey = ["custom_field_1", "custom_field_2", "custom_field_3", "custom_field_4", "custom_field_5"]
        .find((k) => !usedSlotKeys.has(k));

      if (!freeSlotKey) {
        overflow.push(label);
        continue;
      }

      usedSlotKeys.add(freeSlotKey);
      currentLabels[freeSlotKey] = label;
      newLabelAssignments[freeSlotKey] = label;
      finalMapping[freeSlotKey] = entry.colIndex;
    }

    if (overflow.length > 0) {
      alert(
        `Maks 5 kolom custom per organisasi, slotnya udah penuh semua. Kolom ini gak kebagian slot: ${overflow.join(", ")}.\n\nCoba pakai nama yang SAMA PERSIS dengan salah satu custom field yang udah ada, atau abaikan kolom itu dulu.`
      );
      return;
    }

    setManualMapRequest(null);
    setBusy(true);
    try {
      if (Object.keys(newLabelAssignments).length > 0) {
        await db.mergeCustomFieldLabels(newLabelAssignments);
      }
      const dataRows = rawRows.slice(Math.max(0, dataStartRow));
      const leadRows = extractRowsFromMapping(dataRows, finalMapping, firstStage);
      await finalizeImport(leadRows, usedAiGuess);
    } catch (e) {
      alert("Gagal import: " + e.message);
    } finally {
      setBusy(false);
    }
  };


  /* =========================================================
     EXPORT
  ========================================================= */

  const doExportCSV =
    () => {

      const rows =
        filtered.map(
          (c) => ({

            Nama:
              c.name,

            Kategori:
              c.category,

            Tipe:
              c.company_type,

            Produk:
              c.product,

            Tahap:
              stageMeta(
                stages,
                c.stage_key
              ).label,

            Email:
              c.email,

            Telepon_WA:
              c.phone,

            Key_Person:
              c.key_person,

            Jabatan:
              c.key_person_title,

            Kota:
              c.city,

            Website:
              c.website,

          })
        );


      const csv =
        Papa.unparse(
          rows
        );


      const blob =
        new Blob(
          [
            "\ufeff" +
              csv,
          ],
          {
            type:
              "text/csv;charset=utf-8;",
          }
        );


      const a =
        document.createElement(
          "a"
        );

      a.href =
        URL.createObjectURL(
          blob
        );

      a.download =
        `nexto-leads-${todayISO()}.csv`;

      a.click();

    };

  // Approval-gate (Enterprise) - sales_rep gak bisa langsung klik-export,
  // harus minta approve owner/manager dulu. Approval cuma berlaku SEKALI
  // pake (langsung ditandain "used" abis kepake), biar tiap mau export lagi
  // harus minta izin lagi, bukan approval sekali buat selamanya.
  const handleExportClick = async () => {
    if (!isEnterprise || canManage) { doExportCSV(); return; }

    if (exportApproval?.status === "approved") {
      doExportCSV();
      try { await db.markApprovalUsed(exportApproval.id); } catch (_) {}
      refreshExportApproval();
      return;
    }
    if (exportApproval?.status === "pending") {
      alert("Permintaan export kamu masih nunggu di-approve owner/manager.");
      return;
    }
    if (!window.confirm("Export butuh persetujuan owner/manager. Kirim permintaan sekarang?")) return;
    try {
      const row = await db.requestApproval("export_leads");
      setExportApproval(row);
      alert("Permintaan export dikirim. Nunggu di-approve owner/manager dulu.");
    } catch (e) { alert("Gagal kirim permintaan: " + e.message); }
  };


  /* =========================================================
     DELETE
  ========================================================= */

  // Approval-gate (Enterprise) - sales_rep gak bisa langsung hapus lead,
  // harus minta approve owner/manager dulu. Owner/manager sendiri (canManage)
  // tetep bisa hapus langsung kayak biasa - gak ada gunanya minta izin ke
  // diri sendiri.
  const del =
    async (id) => {

      if (isEnterprise && !canManage) {
        const lead = leads.find((l) => l.id === id);
        if (!window.confirm(`Kirim permintaan hapus lead "${lead?.name || "ini"}" ke owner/manager?`)) return;
        try {
          await db.requestApproval("delete_lead", { lead_id: id, lead_name: lead?.name || "" });
          alert("Permintaan hapus dikirim. Nunggu di-approve owner/manager dulu.");
        } catch (e) { alert("Gagal kirim permintaan: " + e.message); }
        return;
      }

      if (
        !window.confirm(
          "Hapus lead ini?"
        )
      ) {
        return;
      }

      await db.deleteLead(
        id
      );

      onChanged();

    };


  /* =========================================================
     UI
  ========================================================= */

  return (
    <div>

      {/* =====================================================
          COMPACT KPI ROW
      ===================================================== */}

      <div className="flex gap-1 overflow-x-auto pb-0.5 mb-1 scrollbar-thin">

        <MiniKpi
          icon={Users}
          label="Total Leads"
          value={kpi.total}
          active={
            !q &&
            !fCat &&
            !fType
          }
          onClick={
            clearFilters
          }
          iconClass="text-slate-500"
        />

        <MiniKpi
          icon={Activity}
          label="Active"
          value={kpi.active}
          iconClass="text-blue-500"
          onClick={
            filterActive
          }
        />

        <MiniKpi
          icon={Flame}
          label="Hot"
          value={kpi.hot}
          iconClass="text-orange-500"
          onClick={
            filterHot
          }
        />

        <MiniKpi
          icon={Trophy}
          label="Won"
          value={kpi.won}
          iconClass="text-emerald-500"
          onClick={() => {
            clearFilters();
          }}
        />

        <MiniKpi
          icon={UserX}
          label="No Contact"
          value={kpi.noContact}
          iconClass="text-rose-500"
          onClick={() => {
            clearFilters();
          }}
        />

      </div>


      {/* =====================================================
          HEADER / SEARCH
      ===================================================== */}

      <div className="sticky top-14 md:top-0 z-20 bg-slate-50 pt-0.5 pb-2">

        <div className="flex flex-wrap gap-2 items-center mb-2">

          <div className="relative flex-1 min-w-40">

            <Search
              size={14}
              className="absolute left-2.5 top-2 text-slate-400"
            />

            <input
              value={q}
              onChange={(e) =>
                setQ(
                  e.target.value
                )
              }
              placeholder="Cari nama / kota / PIC / produk / progress…"
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
            />

          </div>


          <select
            value={fCat}
            onChange={(e) =>
              setFCat(
                e.target.value
              )
            }
            className="text-sm border border-slate-300 rounded-xl px-2 py-1.5 bg-white"
          >

            <option value="">
              Semua kategori
            </option>

            {categories.map(
              (c) => (
                <option
                  key={c}
                >
                  {c}
                </option>
              )
            )}

          </select>


          {showTypeFilter && (

            <select
              value={fType}
              onChange={(e) =>
                setFType(
                  e.target.value
                )
              }
              className="text-sm border border-slate-300 rounded-xl px-2 py-1.5 bg-white"
            >

              <option value="">
                Semua tipe
              </option>

              {companyTypeOptions.map(
                (t) => (

                  <option
                    key={t.v}
                    value={t.v}
                  >
                    {t.label}
                  </option>

                )
              )}

            </select>

          )}


          {canManage && members.length > 1 && (

            <select
              value={fAssignee}
              onChange={(e) =>
                setFAssignee(
                  e.target.value
                )
              }
              className="text-sm border border-slate-300 rounded-xl px-2 py-1.5 bg-white"
            >

              <option value="">
                Semua sales rep
              </option>

              {members.map(
                (m) => (
                  <option
                    key={m.user_id}
                    value={m.user_id}
                  >
                    {m.display_name || `Anggota ${m.user_id.slice(0, 8)}`}
                  </option>
                )
              )}

            </select>

          )}


          <button
            onClick={() =>
              setEdit(
                blank()
              )
            }
            className="flex items-center gap-1 bg-orange-600 hover:bg-orange-700 text-white text-xs px-2.5 py-1 rounded-lg font-medium shadow-sm shadow-orange-600/20"
          >

            <Plus size={12} />

            Lead

          </button>

        </div>


        <div className="flex flex-wrap gap-2">

          <label className="text-xs flex items-center gap-1.5 border border-emerald-300 text-emerald-700 rounded-lg px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 cursor-pointer">

            <FileSpreadsheet
              size={12}
            />

            {busy
              ? "Mengimpor…"
              : "Import Excel / CSV"}

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              disabled={busy}
              onChange={(e) => {

                importFile(
                  e.target.files[0]
                );

                e.target.value =
                  "";

              }}
            />

          </label>


          <button
            onClick={
              handleExportClick
            }
            title={
              isEnterprise && !canManage && exportApproval?.status === "pending"
                ? "Nunggu approval owner/manager"
                : undefined
            }
            className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-lg px-2.5 py-1 bg-white hover:bg-slate-50"
          >

            <Download
              size={12}
            />

            {isEnterprise && !canManage && exportApproval?.status === "pending"
              ? "Export (nunggu approval)"
              : "Export"}

          </button>


          <button
            onClick={() => {
              setShowDup(true);
              saveOpenModal("dupcheck", {});
            }}
            className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-lg px-2.5 py-1 bg-white hover:bg-slate-50"
          >

            <Copy
              size={12}
            />

            Cek Duplikat

          </button>


          <span className="text-xs text-slate-400 self-center ml-auto">

            {filtered.length}
            {" / "}
            {leads.length}

          </span>

        </div>

      </div>


      {/* =====================================================
          LEAD CARDS
      ===================================================== */}

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 rounded-[28px] p-3 sm:p-4"
        style={{
          background: "#fafbfc",
          backgroundImage:
            "radial-gradient(rgba(15,23,42,0.045) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        {pageItems.map((c) => (
          <LeadCard
            key={c.id}
            c={c}
            stages={stages}
            productLabel={productLabel}
            onEdit={setEdit}
            onDelete={del}
            onDraft={openDraftPopup}
            onProgress={(lead) => { setProgressPopup({ lead, autoFocus: true }); saveOpenModal("progress", { leadId: lead.id }); }}
            canManage={canManage}
            members={members}
            onReassign={async (leadId, uid) => { await db.updateLeadAssignee(leadId, uid); onChanged(); }}
          />
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full p-8 text-center text-sm text-slate-400 bg-white border border-dashed border-slate-200 rounded-3xl">
            Belum ada lead yang cocok.
            Import Excel atau tambah manual.
          </div>
        )}
      </div>

      {/* =====================================================
          PAGINATION
      ===================================================== */}

      {filtered.length >
        0 &&
        totalPages > 1 && (

        <div className="flex items-center justify-center gap-1.5 mt-4">

          <button
            onClick={() =>
              setPage(
                (p) =>
                  Math.max(
                    1,
                    p - 1
                  )
              )
            }
            disabled={
              page === 1
            }
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >

            <ChevronLeft
              size={15}
            />

          </button>


          {(() => {

            const nums = [];
            const window = 1;

            for (
              let i = 1;
              i <=
              totalPages;
              i++
            ) {

              if (
                i === 1 ||
                i ===
                  totalPages ||
                (
                  i >=
                    page -
                      window &&
                  i <=
                    page +
                      window
                )
              ) {

                nums.push(
                  i
                );

              } else if (
                nums[
                  nums.length -
                    1
                ] !== "…"
              ) {

                nums.push(
                  "…"
                );

              }

            }


            return nums.map(
              (
                n,
                idx
              ) =>

                n ===
                "…" ? (

                  <span
                    key={`dots-${idx}`}
                    className="px-1.5 text-slate-400 text-sm"
                  >
                    …
                  </span>

                ) : (

                  <button
                    key={n}
                    onClick={() =>
                      setPage(
                        n
                      )
                    }
                    className={`min-w-[34px] h-[34px] px-2 rounded-lg text-sm font-medium ${
                      n ===
                      page
                        ? "bg-orange-600 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </button>

                )

            );

          })()}


          <button
            onClick={() =>
              setPage(
                (p) =>
                  Math.min(
                    totalPages,
                    p + 1
                  )
              )
            }
            disabled={
              page ===
              totalPages
            }
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >

            <ChevronRight
              size={15}
            />

          </button>


          <span className="text-xs text-slate-400 ml-2">

            Halaman{" "}
            {page}/
            {
              totalPages
            }{" "}
            ·{" "}
            {
              filtered.length
            }{" "}
            lead

          </span>

        </div>

      )}


      {/* =====================================================
          MODALS
      ===================================================== */}

      {edit && (

        <LeadModal
          lead={edit}
          stages={stages}
          settings={
            settings
          }
          industry={
            industry
          }
          customFieldLabels={
            customFieldLabels
          }
          myLevel={
            myLevel
          }
          onClose={() =>
            setEdit(null)
          }
          members={
            members
          }
          myUid={
            myUid
          }
          canManage={
            canManage
          }
          isEnterprise={
            isEnterprise
          }
          onSaved={() => {

            setEdit(null);

            onChanged();

          }}
        />

      )}


      {draftPopup && (

        <AiDraftPopup
          lead={
            draftPopup.lead
          }
          rect={
            draftPopup.rect
          }
          initialChannel={draftPopup.channel}
          onChannelChange={(ch) => saveOpenDraftPopup(draftPopup.lead.id, ch)}
          onClose={closeDraftPopup}
          onSent={
            onChanged
          }
        />

      )}


      {progressPopup && (

        <ProgressPopup
          lead={
            progressPopup.lead
          }
          autoFocus={
            progressPopup.autoFocus
          }
          onClose={() => {
            setProgressPopup(null);
            clearOpenModal("progress");
          }}
          onChanged={
            onChanged
          }
        />

      )}


      {showDup && (

        <DuplicateModal
          leads={
            leads
          }
          onClose={() => {
            setShowDup(false);
            clearOpenModal("dupcheck");
          }}
          onChanged={
            onChanged
          }
        />

      )}

      {importSummary && (
        <ImportSummaryModal
          summary={importSummary}
          onClose={() => {
            setImportSummary(null);
            clearOpenModal("importSummary");
          }}
        />
      )}

      {manualMapRequest && (
        <ManualColumnMapModal
          request={manualMapRequest}
          onConfirm={handleManualMapConfirm}
          onCancel={() => setManualMapRequest(null)}
        />
      )}

    </div>
  );
}
