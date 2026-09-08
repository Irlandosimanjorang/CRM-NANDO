import { useMemo, useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
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
  normUrl,
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

const val = (row, keys) => {
  const lk = Object.keys(row);

  for (const k of keys) {
    const hit = lk.find((h) =>
      h.toLowerCase().includes(k.toLowerCase())
    );

    if (
      hit &&
      row[hit] != null &&
      String(row[hit]).trim()
    ) {
      return String(row[hit]).trim();
    }
  }

  return "";
};

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

function findNameValue(row) {
  const lk = Object.keys(row);

  for (const k of NAME_STRONG_KEYS) {
    const hit = lk.find((h) => h.toLowerCase().includes(k.toLowerCase()));
    if (hit && row[hit] != null && String(row[hit]).trim()) return String(row[hit]).trim();
  }

  for (const k of NAME_WEAK_KEYS) {
    const hit = lk.find((h) => {
      const hl = h.toLowerCase();
      if (!hl.includes(k.toLowerCase())) return false;
      return !NAME_QUALIFIER_BLACKLIST.some((bad) => hl.includes(bad));
    });
    if (hit && row[hit] != null && String(row[hit]).trim()) return String(row[hit]).trim();
  }

  return "";
}


function mapRow(
  row,
  category,
  firstStageKey
) {
  const name = findNameValue(row);

  if (!name) return null;

  return {
    name,
    category,
    stage_key: firstStageKey,

    company_type: (() => {
      const t = val(row, [
        "公司类型",
        "company type",
      ]).toLowerCase();

      if (
        t.includes("man") &&
        t.includes("trad")
      ) {
        return "Both";
      }

      if (t.includes("man")) {
        return "Manufacturer";
      }

      if (t.includes("trad")) {
        return "Trader";
      }

      return "";
    })(),

    email: val(row, [
      "邮箱",
      "email",
    ]),

    phone: val(row, [
      "电话",
      "phone",
      "telepon",
      "wa",
      "hp",
    ]),

    key_person: val(row, [
      "联系人",
      "key person",
      "contact",
      "pic",
      "nama kontak",
    ]),

    product: val(row, [
      "产品",
      "product",
      "produk",
    ]),

    city: val(row, [
      "城市",
      "city",
      "kota",
    ]),

    province: val(row, [
      "省",
      "province",
      "provinsi",
    ]),

    website: val(row, [
      "网站",
      "website",
      "web",
    ]),

    background: val(row, [
      "公司背景",
      "background",
      "海关",
    ]),

    // Kolom catatan/keterangan bebas di Excel (kalau ada) - BUKAN kolom lead
    // (leads gak punya kolom "notes"), ditulis terpisah sebagai progress note
    // begitu lead-nya berhasil dibikin (lihat importFile di bawah).
    notes: val(row, [
      "备注",
      "catatan",
      "keterangan",
      "notes",
      "note",
      "remark",
      "riwayat",
      "progress",
    ]),

    source: "import",
  };
}

// Sama kayak mapRow, tapi dari MAPPING kolom (index) -> field, bukan dari
// nama header. Dipake buat 2 sumber: hasil pemetaan AI (smart-import-map-ts)
// DAN pemetaan MANUAL yang user pilih sendiri lewat ManualColumnMapModal
// (fallback kalau baik rule-based maupun AI gagal baca kolom nama-nya).
function extractRowsFromMapping(dataRows, mapping, firstStage) {
  const get = (row, idx) => (idx === null || idx === undefined || idx === "") ? "" : String(row[idx] ?? "").trim();
  const out = [];
  for (const row of dataRows) {
    const name = get(row, mapping.name);
    if (!name || /^(xxx|yyyy-mm-dd|mr\/ms xxx)$/i.test(name.trim())) continue;
    out.push({
      name,
      category: "Lainnya",
      stage_key: firstStage,
      company_type: get(row, mapping.company_type),
      email: get(row, mapping.email),
      phone: get(row, mapping.phone),
      key_person: get(row, mapping.key_person),
      key_person_title: get(row, mapping.key_person_title),
      product: get(row, mapping.product),
      city: get(row, mapping.city),
      province: get(row, mapping.province),
      website: get(row, mapping.website),
      background: get(row, mapping.background),
      notes: get(row, mapping.notes),
      source: "import",
    });
  }
  return out;
}


/* =========================================================
   HUD CORNER BRACKETS
========================================================= */

function CornerBrackets({
  color = "#0891b2",
}) {
  const armStyle = {
    position: "absolute",
    width: 14,
    height: 14,
    borderColor: color,
  };

  return (
    <>
      <div
        style={{
          ...armStyle,
          top: -1,
          left: -1,
          borderTop: "2px solid",
          borderLeft: "2px solid",
          borderTopLeftRadius: 10,
        }}
      />

      <div
        style={{
          ...armStyle,
          top: -1,
          right: -1,
          borderTop: "2px solid",
          borderRight: "2px solid",
          borderTopRightRadius: 10,
        }}
      />

      <div
        style={{
          ...armStyle,
          bottom: -1,
          left: -1,
          borderBottom: "2px solid",
          borderLeft: "2px solid",
          borderBottomLeftRadius: 10,
        }}
      />

      <div
        style={{
          ...armStyle,
          bottom: -1,
          right: -1,
          borderBottom: "2px solid",
          borderRight: "2px solid",
          borderBottomRightRadius: 10,
        }}
      />
    </>
  );
}


/* =========================================================
   STAGE CHIP
========================================================= */

function StageChip({
  hex,
  label,
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">

      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: hex,
          boxShadow: `0 0 4px ${hex}`,
        }}
      />

      {label}

    </span>
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
  myLevel,
  onChanged,
}) {

  const [q, setQ] =
    useState("");

  const [fCat, setFCat] =
    useState("");

  const [fType, setFType] =
    useState("");

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

    const total =
      leads.length;

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
      leads.filter(
        (lead) =>
          activeStageKeys.includes(
            lead.stage_key
          )
      ).length;

    const hot =
      leads.filter(
        (lead) =>
          String(
            lead.priority || ""
          ).toLowerCase() ===
          "hot"
      ).length;

    const won =
      leads.filter(
        (lead) =>
          wonStageKeys.includes(
            lead.stage_key
          )
      ).length;

    const noContact =
      leads.filter(
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
    const knownNames = leads.map((l) => l.name);
    const seenThisImport = new Set();

    const toInsert = []; // { lead, notes }
    const duplicates = []; // { name, matchedName, score }

    for (const m of leadRows) {
      const name = (m.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();

      const existingExact = existingByKey.get(key);
      if (existingExact || seenThisImport.has(key)) {
        duplicates.push({ name, matchedName: existingExact || name, score: 1 });
        continue;
      }

      const fuzzyMatchName = knownNames.find((n) => nameSimilarity(n, name) >= IMPORT_DUP_THRESHOLD);
      if (fuzzyMatchName) {
        duplicates.push({ name, matchedName: fuzzyMatchName, score: nameSimilarity(fuzzyMatchName, name) });
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

  const importFile = async (file) => {
    if (!file) return;
    setBusy(true);

    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const firstStage = stages[0]?.key;

      const allLeadRows = [];
      let usedAiFallback = false;
      // Sheet PERTAMA yang gagal ke-baca rule-based MAUPUN AI - disimpen
      // (bukan langsung dibuang) buat ditawarin ke user lewat
      // ManualColumnMapModal, TAPI CUMA kalau gak ada satupun sheet lain yang
      // berhasil (kalau ada sheet lain yang berhasil, cukup laporin di
      // ringkasan seperti biasa - gak perlu ganggu user buat tiap sheet).
      let unmappedSheet = null;

      for (const sn of wb.SheetNames) {
        const headerRows = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: "" });
        const nonEmptyRows = headerRows.filter((r) => Object.values(r).some((v) => String(v).trim()));

        let sheetOut = [];
        for (const r of headerRows) {
          const m = mapRow(r, "Lainnya", firstStage);
          if (m) sheetOut.push(m);
        }

        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" });
        const nonEmptyAoa = aoa.filter((r) => r.some((v) => String(v).trim()));

        // Fallback AI kalau rule-based cuma berhasil baca <50% baris - AI
        // baca sample mentah & tentuin sendiri kolom keberapa isinya apa
        // (lihat smart-import-map-ts, sekarang industry-aware).
        if (nonEmptyRows.length > 0 && sheetOut.length < nonEmptyRows.length * 0.5 && nonEmptyAoa.length > 0) {
          try {
            const sample = nonEmptyAoa.slice(0, 8);
            const { data_start_row, mapping } = await db.smartImportMap(sample);

            if (mapping && mapping.name !== null && mapping.name !== undefined) {
              const startAt = Math.min(Math.max(data_start_row || 0, 0), nonEmptyAoa.length);
              const aiOut = extractRowsFromMapping(nonEmptyAoa.slice(startAt), mapping, firstStage);
              if (aiOut.length > sheetOut.length) {
                sheetOut = aiOut;
                usedAiFallback = true;
              }
            }
          } catch (aiErr) {
            console.error("Smart import AI gagal:", aiErr);
          }
        }

        if (sheetOut.length > 0) {
          allLeadRows.push(...sheetOut);
        } else if (!unmappedSheet && nonEmptyAoa.length > 0) {
          unmappedSheet = { sheetName: sn, rawRows: nonEmptyAoa, firstStage };
        }
      }

      if (allLeadRows.length > 0) {
        await finalizeImport(allLeadRows, usedAiFallback);
        return;
      }

      // Baik rule-based maupun AI gagal total buat SEMUA sheet - dulu
      // langsung nyerah (alert "Ga ada baris kebaca"). Sekarang dilempar ke
      // ManualColumnMapModal biar user sendiri yang petain kolomnya, bukan
      // maksa nebak-nebak otomatis mulu.
      if (unmappedSheet) {
        setManualMapRequest(unmappedSheet);
        return;
      }

      alert("File-nya kosong, ga ada data sama sekali yang kebaca.");
    } catch (e) {
      alert("Gagal import: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleManualMapConfirm = async (mapping, dataStartRow) => {
    if (!manualMapRequest) return;
    const { rawRows, firstStage } = manualMapRequest;
    setManualMapRequest(null);
    setBusy(true);
    try {
      const dataRows = rawRows.slice(Math.max(0, dataStartRow));
      const leadRows = extractRowsFromMapping(dataRows, mapping, firstStage);
      await finalizeImport(leadRows, false);
    } catch (e) {
      alert("Gagal import: " + e.message);
    } finally {
      setBusy(false);
    }
  };


  /* =========================================================
     EXPORT
  ========================================================= */

  const exportCSV =
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


  /* =========================================================
     DELETE
  ========================================================= */

  const del =
    async (id) => {

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
              exportCSV
            }
            className="text-xs flex items-center gap-1.5 border border-slate-300 rounded-lg px-2.5 py-1 bg-white hover:bg-slate-50"
          >

            <Download
              size={12}
            />

            Export

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
        {pageItems.map((c) => {
          const sm = stageMeta(stages, c.stage_key);
          const wa = waLink(c.phone);
          const web = normUrl(c.website);

          const stageIndex = Math.max(
            0,
            stages.findIndex((s) => s.key === c.stage_key)
          );
          const stageNumber =
            stages.length > 0 ? stageIndex + 1 : 1;
          const progressPercent =
            stages.length > 1
              ? Math.min(
                  100,
                  Math.max(
                    0,
                    (stageIndex / (stages.length - 1)) * 100
                  )
                )
              : 0;

          const lastProgress = c.progressLog?.[0];
          const lastContact =
            lastProgress?.created_at ||
            lastProgress?.date ||
            lastProgress?.updated_at ||
            "—";
          const lastContactBy =
            lastProgress?.author_name ||
            lastProgress?.sales_owner ||
            c.sales_owner ||
            "Admin";

          return (
            <div
              key={c.id}
              onClick={() => setEdit(c)}
              className="relative rounded-[24px] cursor-pointer hover:-translate-y-0.5 transition-all duration-200"
              style={{
                boxShadow: "0 8px 24px -14px rgba(15,23,42,0.28)",
              }}
            >
              <CornerBrackets color="#0f172a" />

              <div
                className="rounded-[24px] overflow-hidden bg-white h-full"
                style={{
                  border: "1px solid rgba(15,23,42,0.10)",
                }}
              >
                {/* orange top accent */}
                <div
                  style={{
                    height: 4,
                    background:
                      "linear-gradient(90deg, #f97316, #fb923c)",
                  }}
                />

                <div className="p-4 sm:p-5">
                  {/* HEADER */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.16em] px-2 py-1 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          OPEN
                        </span>
                      </div>

                      <div className="font-bold text-slate-950 text-[17px] leading-[1.2] tracking-tight">
                        {c.name}
                      </div>

                      <div className="text-[11px] text-slate-400 mt-1.5 truncate">
                        {c.category || "Lainnya"}
                        <span className="mx-1.5">•</span>
                        {c.city || c.province || "—"}
                      </div>
                    </div>

                    {c.verified ? (
                      <ShieldCheck
                        size={19}
                        className="text-emerald-500 shrink-0"
                      />
                    ) : (
                      <ShieldAlert
                        size={19}
                        className="text-slate-300 shrink-0"
                      />
                    )}
                  </div>

                  {/* PIPELINE */}
                  <div className="mt-4 rounded-[22px] bg-slate-50/80 border border-slate-100 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <StageChip
                        hex={sm.hex}
                        label={sm.label}
                      />

                      <span className="text-[9px] font-mono font-semibold tracking-wider text-slate-400 uppercase">
                        Stage {stageNumber}/{Math.max(stages.length, 1)}
                      </span>
                    </div>

                    <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progressPercent}%`,
                          background:
                            "linear-gradient(90deg, #f97316, #fb923c)",
                        }}
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                        Pipeline
                      </span>
                      <span className="text-[9px] font-mono font-bold text-slate-500">
                        {Math.round(progressPercent)}%
                      </span>
                    </div>
                  </div>

                  {/* PRODUCT / PHONE */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {c.phone ? (
                      <div className="rounded-[18px] bg-slate-50 border border-slate-100 px-3 py-3 min-w-0">
                        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                          Phone
                        </div>
                        <div className="text-[12px] text-slate-700 mt-1 truncate">
                          {c.phone}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[18px] bg-slate-50 border border-slate-100 px-3 py-3 min-w-0">
                        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                          Key Person
                        </div>
                        <div className="text-[12px] text-slate-700 mt-1 truncate">
                          {c.key_person || "—"}
                        </div>
                      </div>
                    )}

                    <div className="rounded-[18px] bg-slate-50 border border-slate-100 px-3 py-3 min-w-0">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                        {productLabel || "Produk Dominan"}
                      </div>
                      <div className="text-[12px] text-slate-700 mt-1 truncate">
                        {c.product || "—"}
                      </div>
                    </div>
                  </div>

                  {/* EMAIL */}
                  {c.email && (
                    <div className="mt-2.5 flex items-center gap-2 text-[11px] text-slate-500 truncate px-1">
                      <Mail
                        size={14}
                        className="text-slate-400 shrink-0"
                      />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}

                  {/* LAST CONTACT / NEXT ACTION */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-[18px] border border-slate-100 bg-white px-3 py-3 min-w-0">
                      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-slate-400">
                        <span className="text-[11px]">◷</span>
                        Last Contact
                      </div>

                      <div className="text-[12px] font-medium text-slate-700 mt-1.5 truncate">
                        {lastContact === "—"
                          ? "—"
                          : new Date(lastContact).toLocaleDateString(
                              "id-ID",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                      </div>

                      {lastContact !== "—" && (
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                          oleh {lastContactBy}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[18px] border border-orange-100 bg-orange-50/60 px-3 py-3 min-w-0">
                      <div className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-orange-500">
                        ↗ Next Action
                      </div>

                      <div className="text-[12px] font-medium text-orange-700 mt-1.5 line-clamp-2">
                        {c.next_action || "Belum ditentukan"}
                      </div>
                    </div>
                  </div>

                  {/* FOOTER ACTIONS */}
                  <div
                    className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {c.phone && (
                      wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                          title={c.phone}
                        >
                          <Phone size={13} />
                        </a>
                      ) : (
                        <span
                          className="p-1.5 text-slate-300"
                          title={c.phone}
                        >
                          <Phone size={13} />
                        </span>
                      )
                    )}

                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                        title={c.email}
                      >
                        <Mail size={13} />
                      </a>
                    )}

                    <button
                      onClick={(e) =>
                        openDraftPopup(c, e.currentTarget.getBoundingClientRect())
                      }
                      className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50"
                      title="Draft follow-up (AI)"
                    >
                      <Sparkles size={13} />
                    </button>

                    <div className="ml-auto flex items-center gap-0.5">
                      <button
                        onClick={() => setEdit(c)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Edit lead"
                      >
                        <Pencil size={13} />
                      </button>

                      <button
                        onClick={() => del(c.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Hapus lead"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* PROGRESS UPDATE */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProgressPopup({
                        lead: c,
                        autoFocus: true,
                      });
                      saveOpenModal("progress", { leadId: c.id });
                    }}
                    className="mt-2.5 w-full flex items-center gap-2 text-left text-[11px] font-mono text-slate-500 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 hover:border-cyan-400 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                    title="Update progress harian"
                  >
                    <ClipboardList
                      size={13}
                      className="shrink-0 text-slate-400"
                    />

                    <span className="truncate">
                      {c.progressLog?.[0]
                        ? c.progressLog[0].text
                        : "> update progress hari ini…"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}

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
          myLevel={
            myLevel
          }
          onClose={() =>
            setEdit(null)
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
