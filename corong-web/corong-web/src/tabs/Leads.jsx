import { useMemo, useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  Pencil,
  Mail,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Sparkles,
  Phone,
  MessageCircle,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Building2,
  Users,
  Activity,
  Flame,
  Trophy,
  UserX,
  Lock,
  Link as LinkIcon,
  Loader2,
  X,
} from "lucide-react";

import * as db from "../lib/db";

import {
  stageMeta,
  waLink,
  telLink,
  daysSince,
  fmtRp,
  todayISO,
  nameSimilarity,
  groupKey,
} from "../lib/helpers";

import LeadModal from "../components/LeadModal";
import DuplicateModal from "../components/DuplicateModal";
import DeleteAllLeadsModal from "../components/DeleteAllLeadsModal";
import { detectHeaderRow, smartMapping, suggestExtras, normalizePhone, parseMoney, parseDate, normalizePriority, matchStage, matchMember } from "../lib/importSmart";
import ImportSummaryModal from "../components/ImportSummaryModal";
import ManualColumnMapModal from "../components/ManualColumnMapModal";
import AiDraftPopup from "../components/AiDraftPopup";
import { useAiOff } from "../lib/aiOff";
import ProgressPopup from "../components/ProgressPopup";
import { saveOpenModal, clearOpenModal, getOpenModal } from "../lib/uiPersist";

// BUG FIX (17 Sep 2026, permintaan Nando: lindungin semua fitur dari
// tab-discard) - `manualMapRequest` nyimpen SELURUH spreadsheet yang baru
// di-parse (rawRows) + hasil tebakan AI/rule-based - kalau tab-nya di-discard
// pas user lagi ngecek/betulin petaan kolom, sebelumnya harus upload ULANG
// file-nya dari awal (parsing + tebakan AI ke-ulang semua). rawRows di sini
// murni data (array of array nilai sel), bukan File/Blob, jadi AMAN
// diserialisasi ke JSON apa adanya - beda dari kasus recording audio yang
// bufernya beneran gak bisa "dibekuin". Key SENDIRI (bukan numpang uiPersist
// yang cuma 1 slot) karena Leads.jsx udah pakai itu buat modal lain
// (leadinline/importSummary/dupcheck/progress).
const MANUAL_MAP_KEY = "nexto_manual_map_request";
const MANUAL_MAP_MAX_AGE = 24 * 60 * 60 * 1000; // 24 jam
function loadManualMapRequest() {
  try {
    const raw = localStorage.getItem(MANUAL_MAP_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (Date.now() - d.savedAt > MANUAL_MAP_MAX_AGE) { localStorage.removeItem(MANUAL_MAP_KEY); return null; }
    return d.request || null;
  } catch { return null; }
}

import {
  getFieldLabel,
  getCategories,
  isFieldHidden,
  getCustomFieldSlots,
  CUSTOM_FIELD_KEYS,
  MAX_CUSTOM_FIELDS,
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
  // Kolom orang yang dihubungi (8 Okt 2026): "Nama PIC" sebelumnya terbaca sebagai nama lead.
  "pic", "contact", "kontak", "person", "penanggung", "narahubung", "cp",
  "level", "peran", "tingkat",
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
  const h = String(header ?? "").toLowerCase().replace(/\./g, "").replace(/e-mail/g, "email");
  const k = key.toLowerCase();
  if (!/^[a-z0-9 ]+$/.test(k)) return h.includes(k);
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return re.test(h);
}

function findColIndex(headers, keys, used) {
  for (const k of keys) {
    const idx = headers.findIndex((h, i) => !(used && used.has(i)) && headerMatchesKey(h, k));
    if (idx !== -1) return idx;
  }
  return null;
}

// Header kolom induk/grup ("Induk Perusahaan", "Parent Company") memuat kata
// "perusahaan"/"company" - harus dikecualikan dari tebakan kolom NAMA, kalau
// tidak kolom ini bisa terpilih sebagai nama lead.
const HOLDING_HEADER_KEYS = ["holding company", "holding", "business group", "grup usaha", "group usaha", "induk usaha", "holding group"];
// Kolom peran baris (Holding / Perusahaan / Anak) - hirarki disusun dari urutan baris.
const LEVEL_HEADER_KEYS = ["level", "peran", "tingkat", "hirarki", "hierarki", "entity type", "tipe entitas", "jenis entitas"];
const PARENT_HEADER_KEYS = ["induk perusahaan", "perusahaan induk", "grup perusahaan", "group company", "parent company", "parent", "induk", "head office", "kantor pusat"];

function guessNameColIndex(rawHeaders) {
  const headers = rawHeaders.map((h) => ([...PARENT_HEADER_KEYS, ...HOLDING_HEADER_KEYS].some((k) => headerMatchesKey(h, k)) ? "" : h));
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
  phone: ["电话", "phone", "telepon", "telp", "wa", "whatsapp", "hp", "handphone", "mobile"],
  key_person: ["联系人", "nama pic", "pic", "person in charge", "penanggung jawab", "narahubung", "contact person", "contact name", "key person", "nama kontak", "kontak person", "cp", "contact"],
  key_person_title: ["jabatan", "job title", "position", "title"],
  product: ["产品", "product", "produk"],
  city: ["城市", "city", "kota"],
  province: ["省", "province", "provinsi"],
  entity_level: LEVEL_HEADER_KEYS,
  group_holding: HOLDING_HEADER_KEYS,
  parent_company: PARENT_HEADER_KEYS,
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
export function guessMappingFromHeaders(headers) {
  const mapping = {};
  const nameIdx = guessNameColIndex(headers);
  if (nameIdx !== null) mapping.name = nameIdx;
  // Satu kolom hanya untuk satu field (mis. "Contact Phone" tidak direbut field kontak).
  const used = new Set(nameIdx !== null ? [nameIdx] : []);
  for (const [field, keys] of Object.entries(FIELD_KEY_MAP)) {
    const idx = findColIndex(headers, keys, used);
    if (idx !== null) { mapping[field] = idx; used.add(idx); }
  }
  return mapping;
}

// Dari MAPPING kolom (index) -> field, bangun objek lead per baris data.
// Dipake buat SEMUA sumber mapping: tebakan header, hasil AI
// (smart-import-map-ts), MAUPUN pemetaan yang user tentuin/betulin sendiri
// lewat ImportColumnMapModal - generic, jalan buat field custom_field_1..10
// juga (bukan cuma field bawaan) karena cuma nurutin key apa aja yang ada
// di `mapping`, gak hardcode daftar field.
// Saran grup untuk baris import tanpa kolom induk: nama yang memuat kata
// cabang ("... Cabang Bandung", "... Branch Surabaya", "... Kantor ...")
// dipotong di kata itu, sisanya jadi nama induk. Cuma disarankan kalau
// minimal 2 baris punya induk yang sama; user yang memutuskan (confirm).
const BRANCH_WORD_RE = /\s*[-–,(]?\s*\b(cabang|cab\.?|branch|kantor|unit|outlet|depo|plant|site)\b.*$/i;
function suggestParentGroups(rows) {
  const groups = new Map(); // groupKey -> { label, rows[] }
  for (const r of rows) {
    if (r.parent_company) continue;
    const base = String(r.name || "").replace(BRANCH_WORD_RE, "").trim();
    if (!base || base === String(r.name || "").trim()) continue;
    if (base.replace(/\b(pt|cv|ud|pd|tbk)\b\.?/gi, "").trim().length < 3) continue; // mis. "PT Unit Usaha" -> "PT"
    const k = groupKey(base);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, { label: base, rows: [] });
    groups.get(k).rows.push(r);
  }
  return [...groups.values()].filter((g) => g.rows.length >= 2);
}

// Kolom peran baris (8 Okt 2026): tiap baris daftar adalah satu perusahaan; kolom ini menandai
// apakah ia Holding, Perusahaan, atau Anak. Hirarki disusun dari URUTAN baris: baris Holding
// membuka holding baru, baris Perusahaan membuka perusahaan baru di bawah holding itu, baris
// Anak menjadi anak perusahaan terakhir. Kolom holding/induk yang diisi eksplisit tidak ditimpa.
export function normalizeLevel(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return "";
  if (/mandiri|berdiri sendiri|standalone/.test(t)) return "mandiri";
  if (/holding|group|grup/.test(t) && !/anak|cabang/.test(t)) return "holding";
  if (/anak|cabang|subsid|branch|outlet/.test(t)) return "anak";
  if (/perusahaan|company|induk|parent|\bpt\b/.test(t)) return "perusahaan";
  return "";
}
// follow = true (mode tandai per baris): baris TANPA tanda yang berada di bawah sebuah
// perusahaan/holding otomatis menjadi anaknya; peran "Mandiri" memutus konteks itu.
function deriveHierarchy(rows, follow = false) {
  let holding = "";
  let company = "";
  for (const r of rows) {
    let lv = normalizeLevel(r.entity_level);
    delete r.entity_level;
    if (lv === "mandiri") { holding = ""; company = ""; continue; }
    if (!lv && follow && (holding || company)) lv = "anak";
    if (lv === "holding") { holding = r.name; company = ""; r._groupRow = true; continue; }
    if (lv === "perusahaan") { company = r.name; r._groupRow = true; if (holding && !r.group_holding) r.group_holding = holding; continue; }
    if (lv === "anak") {
      if (holding && !r.group_holding) r.group_holding = holding;
      if (company && !r.parent_company) r.parent_company = company;
    }
  }
  return rows;
}

// opts.levels: { <indeks baris data>: "holding" | "perusahaan" | "anak" | "mandiri" } dari penanda
// per baris di layar import (menang atas kolom peran); opts.follow: lihat deriveHierarchy.
export function extractRowsFromMapping(dataRows, mapping, firstStage, opts = {}) {
  const get = (row, idx) => (idx === null || idx === undefined || idx === "") ? "" : String(row[idx] ?? "").trim();
  const out = [];
  for (let ri = 0; ri < dataRows.length; ri++) {
    const row = dataRows[ri];
    const name = get(row, mapping.name);
    if (!name || /^(xxx|yyyy-mm-dd|mr\/ms xxx)$/i.test(name.trim())) continue;
    // Baris total/subtotal di akhir laporan bukan lead.
    if (/^(total|subtotal|sub total|jumlah|grand total)\b/i.test(name.trim())) continue;
    const obj = { name, category: "Lainnya", stage_key: firstStage, source: "import" };
    const noteBits = [];
    for (const [field, idx] of Object.entries(mapping)) {
      if (field === "name") continue;
      const raw = get(row, idx);
      const cell = row[idx];
      switch (field) {
        case "deal_value": { const n = parseMoney(cell); if (n !== null) obj.deal_value = n; else if (raw) noteBits.push(`Nilai: ${raw}`); break; }
        case "deal_date": case "last_contact": { const d = parseDate(cell); if (d) obj[field] = d; break; }
        case "created_at": { const d = parseDate(cell); if (d) obj.created_at = `${d}T09:00:00+07:00`; break; }
        case "priority": { const p = normalizePriority(raw); if (p) obj.priority = p; break; }
        case "stage_key": { const k = matchStage(raw, opts.stages); if (k) obj.stage_key = k; else if (raw) noteBits.push(`Status: ${raw}`); break; }
        case "assigned_name": { const uid = matchMember(raw, opts.members); if (uid) obj.assigned_to = uid; else if (raw) noteBits.push(`Sales: ${raw}`); break; }
        case "address": if (raw) noteBits.push(`Alamat: ${raw}`); break;
        case "phone": obj.phone = normalizePhone(cell); break;
        case "category": case "source": case "company_type": if (raw) obj[field] = raw; break;
        default: obj[field] = raw;
      }
    }
    // Kolom lain yang tidak dipetakan dititipkan ke catatan supaya tidak ada data yang hilang.
    for (const nc of opts.noteCols || []) {
      const v = get(row, nc.index);
      if (v) noteBits.push(`${nc.label}: ${v}`);
    }
    if (noteBits.length) obj.notes = [obj.notes, ...noteBits].filter(Boolean).join(" | ");
    if (opts.levels && opts.levels[ri]) obj.entity_level = opts.levels[ri];
    out.push(obj);
  }
  return deriveHierarchy(out, !!opts.follow);
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

// "Hot" (BUG FIX 30 Sep 2026): sebelumnya dihitung dari priority === "hot",
// padahal app nyimpen priority "high/medium/low" dan gak ada form yang
// ngisinya - semua lead priority-nya kosong, jadi chip "Hot" selalu 0 dan
// ikon api gak pernah muncul. Sekarang: lead di tahap yang namanya ada
// "hot" (mis. "Hot Lead"); kalau pipeline gak punya tahap itu, tahap normal
// terakhir sebelum deal (paling dekat closing). Priority high/hot lama
// tetep dihitung.
function hotStageKeys(stages) {
  const named = stages.filter((s) => s.type === "normal" && /hot/i.test(`${s.label} ${s.key}`)).map((s) => s.key);
  if (named.length) return named;
  const normal = stages.filter((s) => s.type === "normal");
  return normal.length > 1 ? [normal[normal.length - 1].key] : [];
}
function isHotLead(lead, hotKeys) {
  const p = String(lead.priority || "").toLowerCase();
  return p === "hot" || p === "high" || hotKeys.includes(lead.stage_key);
}

/* =========================================================
   BAGAN HOLDING / PERUSAHAAN / ANAK PERUSAHAAN (8 Okt 2026)
   Pohon dari atas ke bawah: Holding > Perusahaan > Anak perusahaan.
   node = { lead|null, label, role: "holding"|"perusahaan"|"anak", children[] }.
   Tiap node adalah KARTU lead asli versi kecil (semua tombolnya tetap ada);
   lead null = nama grup yang belum punya lead sendiri (kotak putus-putus).
   Lencana peran menempel di tepi atas kartu.
========================================================= */
const ORG_ROLE = {
  holding: { label: "Holding", tag: "bg-slate-800 text-white" },
  perusahaan: { label: "Perusahaan", tag: "bg-orange-500 text-white" },
  anak: { label: "Anak perusahaan", tag: "bg-slate-200 text-slate-700" },
};

function OrgNode({ node, renderLead, upper }) {
  const role = ORG_ROLE[node.role];
  const c = node.lead;
  const name = upper ? String(node.label || "").toUpperCase() : node.label;
  return (
    <div className="relative w-[272px] pt-3">
      <span className={`absolute left-4 top-0.5 z-10 rounded px-1.5 py-0.5 text-[10px] font-semibold shadow-sm ${role.tag}`}>{role.label}</span>
      {c ? (
        <div className={node.role === "holding" ? "rounded-panel ring-2 ring-slate-700" : ""}>{renderLead(c)}</div>
      ) : (
        <div className="rounded-panel border border-dashed border-slate-300 bg-white px-4 pb-4 pt-5 text-[13px] font-semibold text-slate-700">
          {name}
          <div className="mt-1 text-[11px] font-normal text-slate-400">Belum ada lead dengan nama ini</div>
        </div>
      )}
    </div>
  );
}

function OrgBranch({ node, renderLead, upper }) {
  const kids = node.children || [];
  return (
    <div className="flex flex-col items-center">
      <OrgNode node={node} renderLead={renderLead} upper={upper} />
      {kids.length > 0 && (
        <>
          <div className="h-5 w-px bg-slate-300" />
          <div className="flex items-start">
            {kids.map((ch, i) => (
              <div key={(ch.lead?.id || ch.label) + ":" + i} className="relative flex flex-col items-center px-2 pt-5">
                <span className="absolute left-1/2 top-0 h-5 w-px bg-slate-300" />
                {kids.length > 1 && (
                  <span className={`absolute top-0 h-px bg-slate-300 ${i === 0 ? "left-1/2 right-0" : i === kids.length - 1 ? "left-0 right-1/2" : "left-0 right-0"}`} />
                )}
                <OrgBranch node={ch} renderLead={renderLead} upper={upper} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LeadCard({ c, stages, productLabel, onEdit, onDelete, onDraft, onProgress, canManage, members, onReassign, uppercaseNames, compact }) {
  const aiOff = useAiOff();
  // Progress bar mulai dari 0% terus animasi jalan ke posisi asli begitu
  // kartu ini muncul di layar - kesan "hidup", bukan langsung nongol jadi.
  const [barReady, setBarReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setBarReady(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  const sm = stageMeta(stages, c.stage_key);
  const wa = waLink(c.phone);
  const tel = telLink(c.phone);

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
      className="rounded-panel border border-slate-200/80 bg-white cursor-pointer overflow-hidden transition-colors hover:border-slate-300"
    >
      <div className={compact ? "p-3" : "p-4 sm:p-5"}>
        {/* HEADER */}
        <div className="flex items-start gap-3">
          <div className={`${compact ? "w-[30px] h-[30px] text-[11px]" : "w-[38px] h-[38px] text-[13px]"} rounded-inner flex items-center justify-center text-white font-bold shrink-0`} style={{ background: avatarColor(c.name) }}>
            {initials(c.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <div className={`font-display font-bold text-ink ${compact ? "text-[13px]" : "text-[15px]"} leading-snug tracking-[-0.02em] truncate`}>{uppercaseNames ? String(c.name || "").toUpperCase() : c.name}</div>
              {isHotLead(c, hotStageKeys(stages)) && <Flame size={14} className="text-orange-500 shrink-0" fill="currentColor" aria-label="Hot" />}
            </div>
            <div className={`${compact ? "text-[11px]" : "text-[12.5px]"} text-slate-500 mt-0.5 truncate`}>{[c.category, c.city || c.province].filter(Boolean).join(", ") || "Belum ada kategori"}</div>
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
        <div className={compact ? "mt-2" : "mt-4"}>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: `${sm.hex}17`, color: sm.hex }}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sm.hex }} />
              {sm.label}
            </span>
            {!compact && <span className="text-[11px] text-slate-500 shrink-0">Tahap {stageNumber} dari {Math.max(stages.length, 1)}</span>}
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${barReady ? progressPercent : 0}%`, background: sm.hex }} />
          </div>
        </div>

        {/* KONTAK / PRODUK */}
        <div className={`${compact ? "mt-2" : "mt-4"} flex items-stretch gap-4`}>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-500">{c.phone ? "Telepon" : "Key person"}</div>
            <div className="text-[13px] text-slate-700 mt-0.5 truncate">{c.phone || c.key_person || "-"}</div>
          </div>
          <div className="w-px bg-slate-100" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-slate-500">{productLabel || "Produk"}</div>
            <div className="text-[13px] text-slate-700 mt-0.5 truncate">{c.product || "-"}</div>
          </div>
        </div>

        {c.email && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-slate-500 truncate">
            <Mail size={12} className="shrink-0" />
            <span className="truncate">{c.email}</span>
          </div>
        )}

        {/* NEXT ACTION - hal yang paling penting di kartu ini. Urgensi kontak
            ditandai titik + teks berwarna (bukan garis aksen di tepi kartu). */}
        <div className={`${compact ? "mt-2 py-2" : "mt-4 py-2.5"} rounded-inner bg-slate-50 px-3`}>
          <div className="text-[11px] font-semibold text-slate-500">Langkah berikutnya</div>
          <div className={`mt-0.5 text-[13px] font-medium line-clamp-2 ${c.next_action ? "text-slate-800" : "text-slate-500"}`}>{c.next_action || "Belum ada rencana tindak lanjut"}</div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium" style={{ color: urgency.text }}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: urgency.stripe }} />
            {urgency.note}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className={`${compact ? "mt-2 pt-1.5 [&_a]:!p-1.5 [&_button]:!p-1.5" : "mt-4 pt-3"} border-t border-slate-100 flex items-center gap-1`} onClick={(e) => e.stopPropagation()}>
          {/* Telepon & WhatsApp dipisah (1 Okt 2026). Dulu ikon telepon diam-diam
              membuka WhatsApp, termasuk ke nomor kantor yang gak punya WA.
              Badge WA cuma muncul kalau ada nomor HP. */}
          {tel && (
            <a href={tel} className="p-2 rounded-lg text-slate-600 hover:bg-slate-100" title={`Telepon ${c.phone}`} aria-label="Telepon">
              <Phone size={15} />
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100" title={`WhatsApp +${wa.replace("https://wa.me/", "")}`} aria-label="Chat WhatsApp">
              <MessageCircle size={13} /> WA
            </a>
          )}

          {c.email && (
            <a href={`mailto:${c.email}`} className="p-2 rounded-lg text-blue-600 hover:bg-blue-50" title={c.email} aria-label="Kirim email">
              <Mail size={15} />
            </a>
          )}

          {!aiOff && (
          <button onClick={(e) => onDraft(c, e.currentTarget.getBoundingClientRect())} className="p-2 rounded-lg text-ai hover:bg-ai-soft" title="Draft follow-up (AI)" aria-label="Draft follow-up (AI)">
            <Sparkles size={15} />
          </button>
          )}

          {/* Reassign - owner ATAU manager yang liat ini, biar bisa mindahin
              lead punya sales_rep A ke sales_rep B kapan aja (misal si A
              resign, atau kerjaannya mau diratain ulang). */}
          {canManage && members.length > 1 && (
            <select
              value={c.assigned_to || ""}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onReassign(c.id, e.target.value)}
              className="text-[11px] border border-slate-200 rounded-lg px-1.5 py-1 bg-white text-slate-500 max-w-[110px]"
              title="Pindahkan lead ke anggota team lain"
            >
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name || `Anggota ${m.user_id.slice(0, 8)}`}
                </option>
              ))}
            </select>
          )}

          <div className="ml-auto flex items-center gap-0.5">
            <button onClick={() => onEdit(c)} className="p-2 rounded-lg text-slate-500 hover:text-ink hover:bg-slate-100" title="Edit lead" aria-label="Edit lead">
              <Pencil size={15} />
            </button>
            <button onClick={() => onDelete(c.id)} className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50" title="Hapus lead" aria-label="Hapus lead">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        {/* PROGRESS UPDATE */}
        <button
          onClick={(e) => { e.stopPropagation(); onProgress(c); }}
          className={`${compact ? "mt-1.5 !py-1.5" : "mt-2.5"} w-full flex items-center gap-2 text-left text-[12px] text-slate-500 border border-dashed border-slate-300 bg-white rounded-inner px-3 py-2 hover:border-brand-line hover:bg-brand-soft hover:text-brand-strong transition-colors`}
          title="Update progress harian"
        >
          <ClipboardList size={13} className="shrink-0 text-slate-500" />
          <span className="truncate">{c.progressLog?.[0] ? c.progressLog[0].text : "Update progress hari ini…"}</span>
        </button>
      </div>
    </div>
  );
}


/* =========================================================
   COMPACT KPI CARD
========================================================= */

// Chip filter cepat (30 Sep 2026, aturan desain docs/DESIGN.md) - sebelumnya
// tombol 32px dengan label 7px huruf besar yang hampir gak kebaca.
function MiniKpi({ icon: Icon, label, value, active, onClick, iconClass = "text-slate-500" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${active ? "border-ink bg-ink text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-ink"}`}
    >
      <Icon size={13} className={active ? "text-white/80" : iconClass} />
      {label}
      <span className={`tabular-nums ${active ? "text-white/70" : "text-slate-500"}`}>{value}</span>
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
  uppercaseNames = true, // nama lead tampil HURUF BESAR (perilaku umum)
}) {

  const [q, setQ] =
    useState("");

  const [fCat, setFCat] =
    useState("");

  const [fType, setFType] =
    useState("");

  // BUG FIX (11 Sep 2026, ketauan pas audit) - tombol KPI "Active"/"Hot"/
  // "Won"/"No Contact" sebelumnya cuma manggil clearFilters() doang, gak
  // pernah beneran nge-filter apa-apa (dead code sisa refactor lama).
  // Sekarang beneran nge-filter lewat state fKpi ini.
  const [fKpi, setFKpi] = useState("");
  const [showDeleteAll, setShowDeleteAll] = useState(false);

  // Tampilan grup (7 Okt 2026): lead dengan nama grup/induk yang sama
  // dilipat jadi satu baris induk yang bisa dibuka. Pilihan disimpan per
  // browser; gagal baca/tulis storage tidak mengganggu.
  const [groupView, setGroupView] = useState(() => {
    try { return localStorage.getItem("nexto_leads_group_view") === "1"; } catch { return false; }
  });
  const toggleGroupView = () => {
    setGroupView((v) => {
      const nv = !v;
      try { localStorage.setItem("nexto_leads_group_view", nv ? "1" : "0"); } catch { /* abaikan */ }
      return nv;
    });
    setPage(1);
  };
  const [openGroups, setOpenGroups] = useState(() => new Set());
  const toggleGroupOpen = (k) => setOpenGroups((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k); else next.add(k);
    return next;
  });

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

  // GENERATE LEAD DARI LINK (25 Sep 2026, permintaan Nando) - paste link
  // website/Instagram/Google Maps calon customer, AI baca isinya & extract
  // jadi draft lead. Hasil CUMA buka LeadModal ke-prefill (lewat setEdit),
  // belum nulis ke DB - user tetep review/edit dulu kayak alur "Lead" biasa.
  const aiOff = useAiOff();
  const [showLinkGen, setShowLinkGen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkErr, setLinkErr] = useState("");

  const generateLeadFromLink = async () => {
    if (!linkUrl.trim()) return;
    setLinkBusy(true);
    setLinkErr("");
    try {
      const result = await db.leadFromUrl(linkUrl.trim());
      setEdit({ ...blank(), ...result });
      setShowLinkGen(false);
      setLinkUrl("");
    } catch (e) {
      setLinkErr(e.message || "Gagal generate lead dari link.");
    } finally {
      setLinkBusy(false);
    }
  };

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
    useState(() => loadManualMapRequest());

  // Auto-simpen/hapus draft petaan kolom tiap kali statenya berubah - lihat
  // komentar MANUAL_MAP_KEY di atas.
  useEffect(() => {
    try {
      if (manualMapRequest) localStorage.setItem(MANUAL_MAP_KEY, JSON.stringify({ request: manualMapRequest, savedAt: Date.now() }));
      else localStorage.removeItem(MANUAL_MAP_KEY);
    } catch (_) {}
  }, [manualMapRequest]);

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

  const productLabel =
    getFieldLabel(
      industry,
      "product",
      "Produk"
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

    const hotKeys = hotStageKeys(stages);
    const hot =
      kpiBase.filter(
        (lead) => isHotLead(lead, hotKeys)
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

  const kpiActiveStageKeys = useMemo(
    () => stages.filter((s, i) => s.type === "normal" && i !== 0).map((s) => s.key),
    [stages]
  );
  const kpiWonStageKeys = useMemo(
    () => stages.filter((s) => s.type === "won").map((s) => s.key),
    [stages]
  );
  const kpiHotStageKeys = useMemo(() => hotStageKeys(stages), [stages]);

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

          if (fKpi === "active" && !kpiActiveStageKeys.includes(c.stage_key)) {
            return false;
          }
          if (fKpi === "hot" && !isHotLead(c, kpiHotStageKeys)) {
            return false;
          }
          if (fKpi === "won" && !kpiWonStageKeys.includes(c.stage_key)) {
            return false;
          }
          if (fKpi === "noContact" && (c.phone || c.email)) {
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
              c.parent_company,
              c.group_holding,
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
        fKpi,
        kpiActiveStageKeys,
        kpiWonStageKeys,
        kpiHotStageKeys,
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
    fKpi,
  ]);


  // "Unit" tampilan: satu lead biasa, atau satu grup (>= 2 lead berinduk
  // sama). Halaman dihitung per unit supaya grup tidak terpotong pagination.
  // Tiga tingkat (8 Okt 2026): Holding/Group > Perusahaan induk > lead (anak perusahaan).
  // Holding/grup hanya dilipat kalau >= 2 lead; induk hanya kalau >= 2 lead di dalamnya.
  const units = useMemo(() => {
    if (!groupView) return filtered.map((c) => ({ type: "lead", lead: c }));
    // Satu tingkat: lead dikelompokkan menurut perusahaan induk (>= 2 lead jadi grup).
    const groupByParent = (list, scope) => {
      // Lead yang namanya sama dengan nama sebuah perusahaan induk ikut jadi anggota grup itu.
      const parentKeys = new Set(list.filter((c) => c.parent_company).map((c) => groupKey(c.parent_company)));
      const parentOf = (c) => (c.parent_company ? groupKey(c.parent_company) : (parentKeys.has(groupKey(c.name)) ? groupKey(c.name) : ""));
      const byKey = new Map();
      for (const c of list) {
        const k = parentOf(c);
        if (!k) continue;
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push(c);
      }
      const out = [];
      const emitted = new Set();
      for (const c of list) {
        const k = parentOf(c);
        const members = k ? byKey.get(k) : null;
        if (!members || members.length < 2) { out.push({ type: "lead", lead: c }); continue; }
        if (emitted.has(k)) continue;
        emitted.add(k);
        out.push({ type: "group", key: scope + "p:" + k, label: members.find((m) => m.parent_company)?.parent_company || members[0].name, members });
      }
      return out;
    };
    // Lead yang NAMANYA sama dengan nama sebuah holding ikut menjadi anggota holding itu
    // (baris holding dari Excel adalah lead juga).
    const holdingKeys = new Set(filtered.filter((c) => c.group_holding).map((c) => groupKey(c.group_holding)));
    const holdingOf = (c) => (c.group_holding ? groupKey(c.group_holding) : (holdingKeys.has(groupKey(c.name)) ? groupKey(c.name) : ""));
    const byHolding = new Map();
    for (const c of filtered) {
      const k = holdingOf(c);
      if (!k) continue;
      if (!byHolding.has(k)) byHolding.set(k, []);
      byHolding.get(k).push(c);
    }
    const out = [];
    const emittedH = new Set();
    const noHolding = [];
    const order = []; // urutan kemunculan: "H:<kunci>" atau indeks lead tanpa holding
    for (const c of filtered) {
      const hk = holdingOf(c);
      const hm = hk ? byHolding.get(hk) : null;
      if (hm && hm.length >= 2) {
        if (!emittedH.has(hk)) { emittedH.add(hk); order.push({ h: hk }); }
      } else {
        noHolding.push(c);
        order.push({ lead: c });
      }
    }
    const looseUnits = groupByParent(noHolding, "");
    const looseByFirstLead = new Map(); // lead pertama sebuah unit -> unit-nya
    for (const u of looseUnits) looseByFirstLead.set(u.type === "lead" ? u.lead.id : u.members[0].id, u);
    const emittedLoose = new Set();
    for (const o of order) {
      if (o.h) {
        const members = byHolding.get(o.h);
        const children = groupByParent(members, "h:" + o.h + "/");
        out.push({ type: "holding", key: "h:" + o.h, label: members.find((m) => m.group_holding)?.group_holding || members[0].name, members, children });
      } else {
        const u = looseByFirstLead.get(o.lead.id);
        if (u && !emittedLoose.has(u)) { emittedLoose.add(u); out.push(u); }
      }
    }
    // Grup dan holding di atas, lead yang tidak berkelompok di bawahnya (dengan judul sendiri).
    return [...out.filter((u) => u.type !== "lead"), ...out.filter((u) => u.type === "lead")];
  }, [filtered, groupView]);

  const holdingOptions = useMemo(
    () => [...new Set(leads.map((l) => (l.group_holding || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [leads]
  );

  const parentOptions = useMemo(
    () => [...new Set(leads.map((l) => (l.parent_company || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [leads]
  );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        units.length /
          PAGE_SIZE
      )
    );

  // BUG FIX (audit 16 Sep 2026): sebelumnya page cuma di-reset pas filter
  // ganti - kalau lead-nya sendiri yang berkurang (dihapus/dipindah stage)
  // sementara lagi di halaman terakhir, page bisa nyangkut lebih besar dari
  // totalPages yang baru, jadi kelihatan halaman kosong padahal masih ada
  // lead di halaman sebelumnya.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pageItems =
    useMemo(() => {

      const start =
        (page - 1) *
        PAGE_SIZE;

      return units.slice(
        start,
        start + PAGE_SIZE
      );

    }, [
      units,
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
    setFKpi("");
  };

  // Toggle: klik KPI yang lagi aktif lagi -> balik ke "Total Leads" (gak
  // ada filter). Klik KPI lain -> ganti ke situ, sambil bersihin filter
  // lain (search/kategori/tipe) biar hasilnya gak nyampur.
  const toggleKpiFilter = (kind) => {
    setQ("");
    setFCat("");
    setFType("");
    setFKpi((prev) => (prev === kind ? "" : kind));
  };
  const filterActive = () => toggleKpiFilter("active");
  const filterHot = () => toggleKpiFilter("hot");
  const filterWon = () => toggleKpiFilter("won");
  const filterNoContact = () => toggleKpiFilter("noContact");


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

    // Grup/induk perusahaan: baris dari grup yang sama wajar bernama mirip
    // ("Maju Jaya Cabang Bandung" vs "... Surabaya"), jadi dikecualikan dari
    // pengecekan nama mirip di bawah. Nama yang PERSIS sama tetap ditolak.
    // Kalau file tidak punya kolom induk, tawarkan pengelompokan otomatis dari
    // kata "cabang/branch/kantor/..." di nama (user yang memutuskan).
    if (!leadRows.some((r) => r.parent_company)) {
      const suggested = suggestParentGroups(leadRows);
      if (suggested.length > 0) {
        const total = suggested.reduce((n, g) => n + g.rows.length, 0);
        const preview = suggested.slice(0, 5).map((g) => `${g.label} (${g.rows.length} cabang)`).join(", ");
        if (confirm(`Terdeteksi ${total} lead yang tampak sebagai cabang dari ${suggested.length} perusahaan: ${preview}${suggested.length > 5 ? ", ..." : ""}.

Kelompokkan sebagai grup perusahaan? (OK = kelompokkan, Batal = impor tanpa grup)`)) {
          for (const g of suggested) for (const r of g.rows) r.parent_company = g.label;
        }
      }
    }
    const keysOfRow = (r) => [r.parent_company, r.group_holding, r._groupRow ? r.name : ""].filter(Boolean).map(groupKey);
    const parentOf = new Map(leads.map((l) => [l.name, keysOfRow(l)]));

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

      const myKeys = keysOfRow(m);
      const fuzzyMatchName = knownNames.find((n) => nameSimilarity(n, name) >= IMPORT_DUP_THRESHOLD && !(myKeys.length && (parentOf.get(n) || []).some((k) => myKeys.includes(k))));
      if (fuzzyMatchName) {
        duplicates.push({ name, matchedName: fuzzyMatchName, score: nameSimilarity(fuzzyMatchName, name), source: originalLeadNames.has(fuzzyMatchName) ? "existing" : "this_import" });
        continue;
      }

      seenThisImport.add(key);
      knownNames.push(name);
      parentOf.set(name, myKeys);
      const notes = m.notes;
      const leadPayload = { ...m };
      delete leadPayload.notes;
      delete leadPayload._groupRow; // penanda internal, bukan kolom database
      toInsert.push({ lead: { ...leadPayload, name }, notes });
    }

    if (toInsert.length === 0 && duplicates.length === 0) {
      alert("Tidak ada baris yang terbaca. Pastikan ada data nama perusahaan/lead.");
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
          db.addProgress(p.id, p.notes.trim()).catch((e) => console.error("Gagal menyimpan catatan import untuk", p.name, e))
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
  // Bahan pembaca pintar (9 Okt 2026): workbook disimpan di memori supaya sheet lain bisa dipilih tanpa unggah ulang.
  const wbRef = useRef(null);

  // Analisis satu sheet: cari baris judul sebenarnya, tebak kolom dari judul DAN isi data (lib/importSmart),
  // lalu usulkan kolom sisa jadi field custom atau catatan. Hanya tebakan awal; pengguna tetap meninjau.
  const analyzeSheet = (XLSX, wb, sheetName) => {
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
    const rawRows = aoa.filter((r) => r.some((v) => String(v).trim()));
    if (rawRows.length === 0) return null;
    const headerRow = detectHeaderRow(rawRows);
    const headers = rawRows[headerRow] || [];
    const dataRows = rawRows.slice(headerRow + 1);
    const ctx = { stages: stages.map((st) => ({ key: st.key, label: st.label, type: st.type })), members };
    const sm = smartMapping(headers, dataRows, guessMappingFromHeaders(headers), ctx);
    const labelled = getCustomFieldSlots(industry, customFieldLabels).filter((sl) => String(sl.label || "").trim()).length;
    const ex = suggestExtras(headers, sm.mapping, sm.profiles, Math.min(Math.max(0, CUSTOM_FIELD_KEYS.length - labelled), 4));
    const initialCustom = Object.fromEntries(ex.custom.map((c) => [c.colIndex, c.label]));
    return {
      sheetName, rawRows, headerRow,
      initialMapping: sm.mapping,
      initialDataStartRow: headerRow + 1,
      initialReasons: sm.reasons,
      initialCustom,
      noteCols: ex.notes.map((c) => ({ index: c.colIndex, label: c.label })),
      mappedCount: Object.keys(sm.mapping).length,
      dataCount: dataRows.length,
    };
  };

  const openSheet = async (name) => {
    if (!wbRef.current) return;
    const { XLSX, wb } = wbRef.current;
    const a = analyzeSheet(XLSX, wb, name);
    if (!a) { alert("Sheet itu kosong."); return; }
    setManualMapRequest((prev) => ({ ...(prev || {}), ...a, usedAiGuess: false, sheetNames: prev?.sheetNames }));
  };

  // CSV dari Excel Indonesia sering memakai titik koma sebagai pemisah; tab dan | juga lazim.
  const detectCsvDelimiter = (text) => {
    const head = text.split(/\r?\n/).slice(0, 8).join("\n");
    const counts = { ";": (head.match(/;/g) || []).length, ",": (head.match(/,/g) || []).length, "\t": (head.match(/\t/g) || []).length, "|": (head.match(/\|/g) || []).length };
    return Object.entries(counts).sort((x, y) => y[1] - x[1])[0][0];
  };

  const importFile = async (file) => {
    if (!file) return;
    setBusy(true);

    try {
      // xlsx dimuat DINAMIS (library berat, hanya dipakai saat import).
      const XLSX = await import("xlsx");
      let wb;
      if (/\.(csv|txt|tsv)$/i.test(file.name)) {
        let text = await file.text();
        if (text.includes("\uFFFD")) { try { text = new TextDecoder("windows-1252").decode(await file.arrayBuffer()); } catch { /* biarkan */ } }
        wb = XLSX.read(text.replace(/^\uFEFF/, ""), { type: "string", cellDates: true, FS: detectCsvDelimiter(text) });
      } else {
        wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: "array", cellDates: true });
      }
      wbRef.current = { XLSX, wb };
      const firstStage = stages[0]?.key;

      // Analisis semua sheet; pilih yang paling meyakinkan (kolom terpetakan terbanyak, lalu baris terbanyak).
      const analyses = wb.SheetNames.map((n) => analyzeSheet(XLSX, wb, n)).filter((a) => a && a.dataCount >= 1);
      if (analyses.length === 0) {
        alert("File kosong, tidak ada data yang terbaca sama sekali.");
        return;
      }
      analyses.sort((p, q) => (q.mappedCount * 10 + Math.min(q.dataCount, 500) / 50) - (p.mappedCount * 10 + Math.min(p.dataCount, 500) / 50));
      const chosen = analyses[0];
      let { rawRows, initialMapping: guessedMapping, initialDataStartRow: guessedDataStartRow } = chosen;
      let usedAiGuess = false;
      let initialReasons = chosen.initialReasons;
      let initialCustom = chosen.initialCustom;
      let noteCols = chosen.noteCols;

      // Kalau kolom nama tetap tidak ketemu, minta AI membaca sampel (kuota Smart Import) seperti sebelumnya.
      if (!aiOff && (guessedMapping.name === undefined || guessedMapping.name === null)) {
        try {
          const sample = rawRows.slice(0, 8);
          const { data_start_row, mapping } = await db.smartImportMap(sample);
          if (mapping && mapping.name !== null && mapping.name !== undefined) {
            guessedMapping = mapping;
            guessedDataStartRow = Math.min(Math.max(data_start_row || 0, 0), rawRows.length);
            usedAiGuess = true;
            initialReasons = {}; initialCustom = {}; noteCols = [];
          } else {
            guessedMapping = {};
            guessedDataStartRow = 0;
          }
        } catch (aiErr) {
          console.error("Smart import AI gagal menebak:", aiErr);
          alert(aiErr.message || "Smart Import AI gagal diproses, silakan petakan kolom secara manual.");
          guessedMapping = {};
          guessedDataStartRow = 0;
        }
      }

      setManualMapRequest({
        sheetName: chosen.sheetName,
        rawRows,
        firstStage,
        initialMapping: guessedMapping,
        initialDataStartRow: guessedDataStartRow,
        usedAiGuess,
        initialReasons,
        initialCustom,
        noteCols,
        sheetNames: analyses.map((a) => a.sheetName),
        // Slot custom_field_1..10 yang sudah bernama ditawarkan sebagai pilihan langsung di dropdown.
        existingCustomSlots: getCustomFieldSlots(industry, customFieldLabels),
      });
    } catch (e) {
      alert("Gagal baca file: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleManualMapConfirm = async (mapping, dataStartRow, customEntries, hierarchy, noteExtraCols = []) => {
    if (!manualMapRequest) return;
    const { rawRows, firstStage, usedAiGuess } = manualMapRequest;

    // ---- RESOLVE "+ Custom..." ke slot custom_field_1..10 ----
    // Label yang PERSIS sama (case-insensitive) dengan slot yang udah ada
    // dipakai ulang slotnya (biar import berulang kali dengan kolom yang
    // sama nyambung ke field yang sama, gak numpuk field baru tiap import).
    // Label baru dikasih slot kosong pertama yang ketemu. Cuma ada 10 slot -
    // kalau abis, import DIBATALIN (bukan diem-diem buang datanya) biar user
    // sadar & bisa pilih mau reuse slot lain atau lewatin kolom itu.
    // Label bawaan template industri IKUT dihitung (1 Okt 2026). Dulu cuma
    // label buatan org yang dihitung, jadi kolom Excel baru bisa nimpa slot
    // template (misal "No. SPK / Kontrak" di Corporate Consultant ketimpa
    // "Consumption") dan field bawaan industri itu hilang dari form lead.
    const currentLabels = Object.fromEntries(getCustomFieldSlots(industry, customFieldLabels).map((s) => [s.key, s.label]));
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

      const freeSlotKey = CUSTOM_FIELD_KEYS.find((k) => !usedSlotKeys.has(k));

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
        `Maks ${MAX_CUSTOM_FIELDS} kolom custom per organisasi dan semua slot sudah terpakai. Kolom ini tidak mendapat slot: ${overflow.join(", ")}. Gunakan nama yang SAMA PERSIS dengan salah satu custom field yang sudah ada, atau lewati kolom tersebut.`
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
      const leadRows = extractRowsFromMapping(dataRows, finalMapping, firstStage, { ...(hierarchy || {}), stages, members, noteCols: noteExtraCols });
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

  // EXPORT (15 Sep 2026, permintaan Nando) - file Excel (.xlsx) beneran,
  // bukan CSV, biar kebuka langsung rapi di Excel/Sheets dengan lebar kolom
  // yang enak dibaca. Kolomnya disamain urutannya sama informasi yang
  // keliatan di kartu lead (LeadCard) dari atas ke bawah: nama+prioritas ->
  // kategori/kota -> tahap pipeline -> nilai deal -> kontak (telepon/key
  // person/jabatan/email) -> produk -> next action -> kapan terakhir
  // dikontak -> sisanya (tipe, provinsi, website). XLSX dimuat DINAMIS
  // (bukan static import) - sama pola kayak dipake buat import Excel, biar
  // gak nambah ukuran bundle awal buat orang yang gak pernah export.
  const doExportExcel = async () => {
    const rows = filtered.map((c) => ({
      Nama: c.name,
      Prioritas: c.priority === "high" ? "Tinggi" : c.priority === "medium" ? "Sedang" : c.priority === "low" ? "Rendah" : "",
      Kategori: c.category,
      Kota: c.city,
      Provinsi: c.province,
      Tahap: stageMeta(stages, c.stage_key).label,
      Nilai_Deal: c.deal_value || "",
      Telepon_WA: c.phone,
      Key_Person: c.key_person,
      Jabatan: c.key_person_title,
      Email: c.email,
      Produk: c.product,
      Next_Action: c.next_action,
      Terakhir_Dikontak: c.last_contact || "",
      Tipe: c.company_type,
      Website: c.website,
      Holding_Group: c.group_holding || "",
      Perusahaan_Induk: c.parent_company || "",
    }));

    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    // Lebar kolom manual - biar isi kayak nama perusahaan/website gak
    // kepotong pas pertama dibuka, gak perlu user resize satu-satu.
    ws["!cols"] = [
      { wch: 28 }, { wch: 10 }, { wch: 16 }, { wch: 14 }, { wch: 14 },
      { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 18 },
      { wch: 22 }, { wch: 20 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 24 }, { wch: 24 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `nexto-leads-${todayISO()}.xlsx`);
  };

  // Approval-gate (Enterprise) - sales_rep gak bisa langsung klik-export,
  // harus minta approve owner/manager dulu. Approval cuma berlaku SEKALI
  // pake (langsung ditandain "used" abis kepake), biar tiap mau export lagi
  // harus minta izin lagi, bukan approval sekali buat selamanya.
  const handleExportClick = async () => {
    if (!isEnterprise || canManage) { await doExportExcel(); return; }

    if (exportApproval?.status === "approved") {
      await doExportExcel();
      try { await db.markApprovalUsed(exportApproval.id); } catch (_) {}
      refreshExportApproval();
      return;
    }
    if (exportApproval?.status === "pending") {
      alert("Permintaan export Anda masih menunggu persetujuan owner/manager.");
      return;
    }
    if (!window.confirm("Export butuh persetujuan owner/manager. Kirim permintaan sekarang?")) return;
    try {
      const row = await db.requestApproval("export_leads");
      setExportApproval(row);
      alert("Permintaan export dikirim. Menunggu persetujuan owner/manager.");
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
          alert("Permintaan hapus dikirim. Menunggu persetujuan owner/manager.");
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

      <div className="mb-3 flex flex-wrap gap-2">

        <MiniKpi
          icon={Users}
          label="Semua"
          value={kpi.total}
          active={
            !q &&
            !fCat &&
            !fType &&
            !fKpi
          }
          onClick={
            clearFilters
          }
          iconClass="text-slate-500"
        />

        <MiniKpi
          icon={Activity}
          label="Aktif"
          value={kpi.active}
          iconClass="text-blue-500"
          active={fKpi === "active"}
          onClick={
            filterActive
          }
        />

        <MiniKpi
          icon={Flame}
          label="Hot"
          value={kpi.hot}
          iconClass="text-orange-500"
          active={fKpi === "hot"}
          onClick={
            filterHot
          }
        />

        <MiniKpi
          icon={Trophy}
          label="Menang"
          value={kpi.won}
          iconClass="text-emerald-500"
          active={fKpi === "won"}
          onClick={filterWon}
        />

        <MiniKpi
          icon={UserX}
          label="Tanpa kontak"
          value={kpi.noContact}
          iconClass="text-rose-500"
          active={fKpi === "noContact"}
          onClick={filterNoContact}
        />

      </div>


      {/* =====================================================
          HEADER / SEARCH
      ===================================================== */}

      <div className="md:sticky md:top-0 z-20 bg-slate-50 pt-0.5 pb-3">

        <div className="flex flex-wrap gap-2 items-center mb-2">

          <div className="relative flex-1 min-w-40">

            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />

            <input
              value={q}
              onChange={(e) =>
                setQ(
                  e.target.value
                )
              }
              placeholder="Cari nama / kota / PIC / produk / progress…"
              aria-label="Cari lead"
              className="w-full pl-9 pr-3 py-2 text-[13px] border border-slate-200 rounded-inner bg-white focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10"
            />

          </div>


          <select
            value={fCat}
            onChange={(e) =>
              setFCat(
                e.target.value
              )
            }
            className="text-[13px] border border-slate-200 rounded-inner px-2.5 py-2 bg-white text-slate-700"
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
              className="text-[13px] border border-slate-200 rounded-inner px-2.5 py-2 bg-white text-slate-700"
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
              className="text-[13px] border border-slate-200 rounded-inner px-2.5 py-2 bg-white text-slate-700"
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
            className="flex items-center gap-1.5 bg-brand-strong hover:bg-orange-700 text-white text-[13px] px-3.5 py-2 rounded-inner font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >

            <Plus size={14} />

            Tambah lead

          </button>

        </div>


        <div className="flex flex-wrap gap-2">

          <label className="text-[12px] font-medium flex items-center gap-1.5 border border-slate-200 text-slate-600 rounded-inner px-3 py-1.5 bg-white hover:bg-slate-50 hover:text-ink cursor-pointer">

            <FileSpreadsheet
              size={13}
              className="text-emerald-600"
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
                ? "Menunggu persetujuan owner/manager"
                : undefined
            }
            className="text-[12px] font-medium flex items-center gap-1.5 border border-slate-200 text-slate-600 rounded-inner px-3 py-1.5 bg-white hover:bg-slate-50 hover:text-ink"
          >

            <Download
              size={12}
            />

            {isEnterprise && !canManage && exportApproval?.status === "pending"
              ? "Export (menunggu persetujuan)"
              : "Export"}

          </button>


          <button
            onClick={() => {
              // GATE (audit 16 Sep 2026): "Deteksi Duplikat" diiklanin fitur
              // Standard di landing page, tapi sebelumnya gak ada pengecekan
              // plan SAMA SEKALI di sini - user Free bisa pake bebas. Beda
              // dari Smart Import (yang emang udah sengaja dikasih coba 1x
              // gratis di backend), fitur ini murni perhitungan di
              // browser (gak manggil AI/backend apapun), jadi gate-nya
              // cukup di sini doang.
              if (myLevel < 1) {
                alert("Deteksi Duplikat tersedia untuk paket Standard ke atas. Silakan upgrade di tab Pengaturan.");
                return;
              }
              setShowDup(true);
              saveOpenModal("dupcheck", {});
            }}
            className="text-[12px] font-medium flex items-center gap-1.5 border border-slate-200 text-slate-600 rounded-inner px-3 py-1.5 bg-white hover:bg-slate-50 hover:text-ink"
          >

            {myLevel < 1 ? <Lock size={12} /> : <Copy size={12} />}

            Cek duplikat

          </button>

          {!aiOff && (
          <button
            onClick={() => {
              if (myLevel < 1) {
                alert("Generate Lead dari Link tersedia untuk paket Standard ke atas. Silakan upgrade di tab Pengaturan.");
                return;
              }
              setLinkErr("");
              setShowLinkGen(true);
            }}
            className="text-[12px] font-medium flex items-center gap-1.5 border border-slate-200 text-slate-600 rounded-inner px-3 py-1.5 bg-white hover:bg-slate-50 hover:text-ink"
          >
            {myLevel < 1 ? <Lock size={12} /> : <LinkIcon size={12} />}
            Generate dari link
          </button>
          )}


          <button
            onClick={toggleGroupView}
            aria-pressed={groupView}
            title="Lipat cabang dari perusahaan yang sama menjadi satu baris"
            className={`text-[12px] font-medium flex items-center gap-1.5 border rounded-inner px-3 py-1.5 ${groupView ? "border-brand-strong text-brand-strong bg-orange-50" : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50 hover:text-ink"}`}
          >
            <Building2 size={12} />
            Kelompokkan per grup
          </button>

          {canManage && leads.length > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleteAll(true)}
              className="text-[12px] font-medium flex items-center gap-1.5 border border-rose-200 text-rose-600 rounded-inner px-3 py-1.5 bg-white hover:bg-rose-50"
            >
              <Trash2 size={12} />
              Hapus semua lead
            </button>
          )}

          <span className="text-[12px] text-slate-500 self-center ml-auto tabular-nums">

            {filtered.length}
            {" dari "}
            {leads.length}
            {" lead"}

          </span>

        </div>

      </div>


      {/* =====================================================
          LEAD CARDS
      ===================================================== */}

      <div
        className="mt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {groupView && filtered.length > 0 && !units.some((u) => u.type === "group" || u.type === "holding") && (
          <div className="col-span-full rounded-inner border border-orange-200 bg-orange-50 px-4 py-3 text-[12.5px] text-slate-700">
            Belum ada lead yang dikelompokkan. Isi <b>Holding / Group</b> dan/atau <b>Perusahaan induk</b> di form lead (klik ikon pensil), atau gunakan kolomnya saat import Excel. Lead dengan nama yang sama (minimal 2) akan dilipat jadi satu baris, bertingkat: Holding &gt; Perusahaan &gt; Anak perusahaan.
          </div>
        )}

        {(() => {
          const GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";
          const renderCard = (c, compact = false) => (
            <LeadCard
              key={c.id}
              compact={compact}
              uppercaseNames={uppercaseNames}
              c={c}
              stages={stages}
              productLabel={productLabel}
              onEdit={setEdit}
              onDelete={del}
              onDraft={openDraftPopup}
              onProgress={(lead) => { setProgressPopup({ lead, autoFocus: true }); saveOpenModal("progress", { leadId: lead.id }); }}
              canManage={canManage}
              members={members}
              onReassign={async (leadId, uid) => {
                try { await db.updateLeadAssignee(leadId, uid); onChanged(); }
                catch (e) { alert("Gagal reassign: " + e.message); }
              }}
            />
          );
          const isSelf = (lead, label) => groupKey(lead.name) === groupKey(label);
          const header = (g, kind, subtitle) => {
            const open = openGroups.has(g.key) || !!q;
            const totalDeal = g.members.reduce((n, m) => n + (Number(m.deal_value) || 0), 0);
            const wonCount = g.members.filter((m) => kpiWonStageKeys.includes(m.stage_key)).length;
            const isHolding = kind === "holding";
            return {
              open,
              node: (
                <button
                  key={"g-" + g.key}
                  type="button"
                  onClick={() => toggleGroupOpen(g.key)}
                  aria-expanded={open}
                  className={`flex w-full items-center gap-3 rounded-panel border px-4 py-3 text-left hover:bg-slate-50 ${isHolding ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"}`}
                >
                  <span className={`w-9 h-9 rounded-inner flex items-center justify-center shrink-0 ${isHolding ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500"}`}><Building2 size={17} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-ink truncate">{g.label}</span>
                    <span className="block text-[12px] text-slate-500 tabular-nums">
                      {subtitle}
                      {wonCount > 0 ? ` · ${wonCount} deal` : ""}
                      {totalDeal > 0 ? ` · total ${fmtRp(totalDeal)}` : ""}
                    </span>
                  </span>
                  {open ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
                </button>
              ),
            };
          };
          // Bagan (pohon) untuk satu grup: node tiap baris berlencana peran di tepi atasnya.
          const chartOf = (u) => {
            const anakLeaf = (lead) => ({ lead, label: lead.name, role: "anak", children: [] });
            const companyNode = (g) => ({
              lead: g.members.find((m) => isSelf(m, g.label)) || null,
              label: g.label,
              role: "perusahaan",
              children: g.members.filter((m) => !isSelf(m, g.label)).map(anakLeaf),
            });
            if (u.type === "group") return companyNode(u);
            const kids = u.children
              .map((ch) => (ch.type === "group" ? companyNode(ch) : (isSelf(ch.lead, u.label) ? null : { lead: ch.lead, label: ch.lead.name, role: "perusahaan", children: [] })))
              .filter(Boolean);
            return { lead: u.members.find((m) => isSelf(m, u.label)) || null, label: u.label, role: "holding", children: kids };
          };
          const chartBlock = (u) => {
            const isHolding = u.type === "holding";
            let subtitle;
            if (isHolding) {
              const perusahaan = u.children.filter((ch) => !(ch.type === "lead" && isSelf(ch.lead, u.label))).length;
              subtitle = `${perusahaan} perusahaan · ${u.members.length} lead`;
            } else {
              subtitle = `${u.members.filter((m) => !isSelf(m, u.label)).length} anak perusahaan`;
            }
            const h = header(u, isHolding ? "holding" : "parent", subtitle);
            return (
              <div key={"b-" + u.key} className="col-span-full space-y-3">
                {h.node}
                {h.open && (
                  <div className="overflow-x-auto rounded-panel border border-slate-200 bg-white px-4 py-6">
                    <div className="mx-auto w-fit min-w-max">
                      <OrgBranch node={chartOf(u)} renderLead={(lead) => renderCard(lead, true)} upper={uppercaseNames} />
                    </div>
                  </div>
                )}
              </div>
            );
          };
          const hasGroups = units.some((x) => x.type !== "lead");
          let dividerShown = false;
          return pageItems.flatMap((u) => {
            if (u.type === "group" || u.type === "holding") return [chartBlock(u)];
            if (groupView && hasGroups && !dividerShown) {
              dividerShown = true;
              return [
                <div key="no-group" className="col-span-full pt-2 text-[12px] font-semibold text-slate-500">Lead tanpa grup</div>,
                renderCard(u.lead),
              ];
            }
            return [renderCard(u.lead)];
          });
        })()}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-panel border border-dashed border-slate-200 bg-white p-8 text-center">
            <p className="text-[13px] text-slate-500">{leads.length ? "Tidak ada lead yang cocok dengan filter ini." : "Belum ada lead. Tambahkan manual atau import dari Excel/CSV."}</p>
            {leads.length ? (
              <button onClick={clearFilters} className="mt-2 text-[12.5px] font-semibold text-brand-strong hover:text-orange-800">Hapus filter</button>
            ) : (
              <button onClick={() => setEdit(blank())} className="mt-2 text-[12.5px] font-semibold text-brand-strong hover:text-orange-800">Tambah lead</button>
            )}
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
                    className="px-1.5 text-slate-500 text-sm"
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


          <span className="text-xs text-slate-500 ml-2">

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
          uppercaseNames={uppercaseNames}
          parentOptions={parentOptions}
          holdingOptions={holdingOptions}
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
          myLevel={myLevel}
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


      {showDeleteAll && (
        <DeleteAllLeadsModal
          count={leads.length}
          onClose={() => setShowDeleteAll(false)}
          onDone={(n) => {
            setShowDeleteAll(false);
            onChanged?.();
            alert(`${n} lead dipindahkan ke Recycle Bin. Anda dapat memulihkannya dari Pengaturan, bagian Recycle Bin.`);
          }}
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

      {showLinkGen && (
        <div
          className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 pt-24 z-50"
          onClick={() => { if (!linkBusy) setShowLinkGen(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base flex items-center gap-2"><LinkIcon size={16} className="text-orange-500" /> Generate Lead dari Link</h3>
              {!linkBusy && (
                <button onClick={() => setShowLinkGen(false)} className="text-slate-500 hover:text-slate-700" aria-label="Tutup"><X size={18} /></button>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3">Tempel link website, profil Instagram bisnis, atau listing Google Maps calon customer - AI membaca isinya & menyiapkan draft lead untuk Anda tinjau.</p>
            <input
              autoFocus
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              placeholder="https://instagram.com/nama_usaha"
              value={linkUrl}
              disabled={linkBusy}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !linkBusy) generateLeadFromLink(); }}
            />
            {linkErr && <p className="text-xs text-rose-600 mt-2">{linkErr}</p>}
            <button
              onClick={generateLeadFromLink}
              disabled={linkBusy || !linkUrl.trim()}
              className="w-full mt-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5"
            >
              {linkBusy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              {linkBusy ? "Membaca halaman…" : "Generate Lead"}
            </button>
          </div>
        </div>
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
          key={manualMapRequest.sheetName}
          onPickSheet={wbRef.current ? openSheet : null}
          request={manualMapRequest}
          onConfirm={handleManualMapConfirm}
          onCancel={() => setManualMapRequest(null)}
        />
      )}

    </div>
  );
}
