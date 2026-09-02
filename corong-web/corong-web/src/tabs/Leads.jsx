import { useMemo, useState, useEffect } from "react";
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
  Flame,
  Clock3,
  ArrowUpRight,
  Activity,
  UserRound,
  Target,
  AlertTriangle,
  CheckCircle2,
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
} from "../lib/helpers";

import LeadModal from "../components/LeadModal";
import DuplicateModal from "../components/DuplicateModal";
import AiDraftPopup from "../components/AiDraftPopup";
import ProgressPopup from "../components/ProgressPopup";
import {
  getFieldLabel,
  getCategories,
  isFieldHidden,
  getCustomFieldSlots,
  getCompanyTypeOptions,
} from "../lib/industryTemplates";


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


function mapRow(row, category, firstStageKey) {
  const name = val(row, [
    "公司名称",
    "company name",
    "nama perusahaan",
    "company",
    "nama",
  ]);

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

      if (t.includes("man") && t.includes("trad")) {
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

    source: "import",
  };
}


/* =========================================================
   NEXTO HUD CORNERS
========================================================= */

function CornerBrackets({ color = "#0891b2" }) {
  const armStyle = {
    position: "absolute",
    width: 14,
    height: 14,
    borderColor: color,
    pointerEvents: "none",
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

function StageChip({ hex, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{
          background: hex,
          boxShadow: `0 0 5px ${hex}`,
        }}
      />

      {label}
    </span>
  );
}


/* =========================================================
   LEAD HEALTH
========================================================= */

function getLeadHealth(lead) {
  const priority = String(lead.priority || "").toLowerCase();
  const hasNextAction = !!lead.next_action;
  const hasProgress = !!lead.progressLog?.length;
  const isWaiting =
    lead.wait_until &&
    new Date(lead.wait_until) >= new Date(todayISO());

  if (
    priority.includes("high") ||
    priority.includes("tinggi") ||
    priority.includes("urgent")
  ) {
    return {
      label: "HOT",
      icon: Flame,
      className:
        "bg-rose-50 text-rose-600 border-rose-100",
      dot: "#f43f5e",
    };
  }

  if (hasNextAction && hasProgress && !isWaiting) {
    return {
      label: "ACTIVE",
      icon: Activity,
      className:
        "bg-emerald-50 text-emerald-600 border-emerald-100",
      dot: "#10b981",
    };
  }

  if (isWaiting) {
    return {
      label: "WAITING",
      icon: Clock3,
      className:
        "bg-sky-50 text-sky-600 border-sky-100",
      dot: "#0ea5e9",
    };
  }

  return {
    label: "OPEN",
    icon: Target,
    className:
      "bg-slate-50 text-slate-500 border-slate-200",
    dot: "#94a3b8",
  };
}


/* =========================================================
   DATE HELPERS
========================================================= */

function formatDate(date) {
  if (!date) return "—";

  try {
    return new Date(date).toLocaleDateString(
      "id-ID",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "—";
  }
}


function daysSince(date) {
  if (!date) return null;

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  const diff =
    Math.floor(
      (now.getTime() - d.getTime()) /
        (1000 * 60 * 60 * 24)
    );

  return Math.max(0, diff);
}


/* =========================================================
   AI SIGNAL
========================================================= */

function getAISignal(lead) {
  const days = daysSince(lead.last_contact);
  const waiting =
    lead.wait_until &&
    new Date(lead.wait_until) >= new Date(todayISO());

  if (waiting) {
    return {
      type: "waiting",
      title: "Follow-up paused",
      text: `Menunggu sampai ${formatDate(
        lead.wait_until
      )}`,
      icon: Clock3,
    };
  }

  if (days !== null && days >= 7) {
    return {
      type: "danger",
      title: "Follow-up recommended",
      text: `Tidak ada kontak selama ${days} hari`,
      icon: AlertTriangle,
    };
  }

  if (!lead.next_action) {
    return {
      type: "warning",
      title: "Next action belum ada",
      text: "Tentukan langkah berikutnya untuk lead ini",
      icon: Target,
    };
  }

  if (lead.progressLog?.length) {
    return {
      type: "active",
      title: "Lead masih aktif",
      text: "Progress terakhir sudah tercatat",
      icon: CheckCircle2,
    };
  }

  return {
    type: "neutral",
    title: "Ready to work",
    text: "Belum ada sinyal aktivitas terbaru",
    icon: Activity,
  };
}


/* =========================================================
   PIPELINE PROGRESS
========================================================= */

function PipelineProgress({ stages, currentKey }) {
  if (!stages?.length) return null;

  const currentIndex = Math.max(
    0,
    stages.findIndex(
      (s) => s.key === currentKey
    )
  );

  const progress =
    stages.length <= 1
      ? 100
      : Math.round(
          (currentIndex /
            (stages.length - 1)) *
            100
        );

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[8px] font-mono uppercase tracking-[0.18em] text-slate-400">
          Pipeline Progress
        </span>

        <span className="text-[9px] font-mono font-bold text-slate-500">
          {progress}%
        </span>
      </div>

      <div className="relative h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${progress}%`,
            background:
              "linear-gradient(90deg,#f97316,#fb923c,#22c55e)",
          }}
        />
      </div>

      <div className="flex items-center justify-between mt-1.5 gap-1">
        {stages.map((stage, index) => {
          const active = index <= currentIndex;

          return (
            <div
              key={stage.key}
              className="flex items-center gap-1 min-w-0"
            >
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{
                  background: active
                    ? stage.hex || "#f97316"
                    : "#cbd5e1",
                  boxShadow: active
                    ? `0 0 4px ${
                        stage.hex || "#f97316"
                      }`
                    : "none",
                }}
              />

              <span
                className={`text-[7px] truncate ${
                  active
                    ? "text-slate-500"
                    : "text-slate-300"
                }`}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* =========================================================
   MAIN
========================================================= */

export default function Leads({
  leads,
  stages,
  settings,
  industry,
  onChanged,
}) {
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fType, setFType] = useState("");
  const [fHealth, setFHealth] = useState("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 60;

  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showDup, setShowDup] = useState(false);
  const [draftPopup, setDraftPopup] = useState(null);
  const [progressPopup, setProgressPopup] = useState(null);

  const titleLabel = getFieldLabel(
    industry,
    "key_person_title",
    "Jabatan"
  );

  const keyPersonLabel = getFieldLabel(
    industry,
    "key_person",
    "Key Person"
  );

  const productLabel = getFieldLabel(
    industry,
    "product",
    "Produk"
  );

  const hideKeyPerson = isFieldHidden(
    industry,
    "key_person"
  );

  const hideTitle = isFieldHidden(
    industry,
    "key_person_title"
  );

  const hideWebsite = isFieldHidden(
    industry,
    "website"
  );

  const customSlots =
    getCustomFieldSlots(industry);

  const categories =
    getCategories(industry);

  const showTypeFilter =
    !isFieldHidden(
      industry,
      "company_type"
    );

  const companyTypeOptions =
    getCompanyTypeOptions(industry).filter(
      (t) => t.v
    );


  /* =====================================================
     FILTER
  ===================================================== */

  const filtered = useMemo(() => {
    return leads.filter((c) => {
      if (
        fCat &&
        c.category !== fCat
      ) {
        return false;
      }

      if (
        fType &&
        (c.company_type || "") !== fType
      ) {
        return false;
      }

      if (fHealth) {
        const health =
          getLeadHealth(c).label;

        if (health !== fHealth) {
          return false;
        }
      }

      if (q) {
        const s = q.toLowerCase();

        const fieldHay = [
          c.name,
          c.city,
          c.province,
          c.key_person,
          c.product,
          c.sales_owner,
          c.next_action,
        ].map((x) =>
          (x || "").toLowerCase()
        );

        const progressHay =
          (c.progressLog || []).map(
            (p) =>
              (p.text || "").toLowerCase()
          );

        const allHay = [
          ...fieldHay,
          ...progressHay,
        ];

        if (
          !allHay.some((h) =>
            h.includes(s)
          )
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    leads,
    q,
    fCat,
    fType,
    fHealth,
  ]);


  useEffect(() => {
    setPage(1);
  }, [q, fCat, fType, fHealth]);


  const totalPages = Math.max(
    1,
    Math.ceil(
      filtered.length / PAGE_SIZE
    )
  );


  const pageItems = useMemo(() => {
    const start =
      (page - 1) *
      PAGE_SIZE;

    return filtered.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filtered, page]);


  /* =====================================================
     STATS
  ===================================================== */

  const stats = useMemo(() => {
    const hot = leads.filter(
      (l) =>
        getLeadHealth(l).label === "HOT"
    ).length;

    const active = leads.filter(
      (l) =>
        getLeadHealth(l).label === "ACTIVE"
    ).length;

    const waiting = leads.filter(
      (l) =>
        getLeadHealth(l).label === "WAITING"
    ).length;

    const followup = leads.filter((l) => {
      const d = daysSince(
        l.last_contact
      );

      return d !== null && d >= 7;
    }).length;

    return {
      total: leads.length,
      hot,
      active,
      waiting,
      followup,
    };
  }, [leads]);


  /* =====================================================
     NEW LEAD
  ===================================================== */

  const blank = () => ({
    name: "",
    category: categories[0],
    stage_key: stages[0]?.key,
    company_type: "",
    priority: "",
    verified: false,
  });


  /* =====================================================
     IMPORT
  ===================================================== */

  const importFile = async (file) => {
    if (!file) return;

    setBusy(true);

    try {
      const buf =
        new Uint8Array(
          await file.arrayBuffer()
        );

      const wb = XLSX.read(buf, {
        type: "array",
        cellDates: true,
      });

      const firstStage =
        stages[0]?.key;

      const existing = new Set(
        leads.map((l) =>
          l.name
            .trim()
            .toLowerCase()
        )
      );

      const out = [];

      let usedAiFallback = false;

      for (const sn of wb.SheetNames) {
        const headerRows =
          XLSX.utils.sheet_to_json(
            wb.Sheets[sn],
            {
              defval: "",
            }
          );

        const nonEmptyRows =
          headerRows.filter((r) =>
            Object.values(r).some(
              (v) =>
                String(v).trim()
            )
          );

        let sheetOut = [];

        for (const r of headerRows) {
          const m = mapRow(
            r,
            "Lainnya",
            firstStage
          );

          if (m) {
            sheetOut.push(m);
          }
        }

        if (
          nonEmptyRows.length > 0 &&
          sheetOut.length <
            nonEmptyRows.length *
              0.5
        ) {
          const aoa =
            XLSX.utils.sheet_to_json(
              wb.Sheets[sn],
              {
                header: 1,
                defval: "",
              }
            );

          const nonEmptyAoa =
            aoa.filter((r) =>
              r.some((v) =>
                String(v).trim()
              )
            );

          if (nonEmptyAoa.length > 0) {
            try {
              const sample =
                nonEmptyAoa.slice(
                  0,
                  8
                );

              const {
                data_start_row,
                mapping,
              } =
                await db.smartImportMap(
                  sample
                );

              if (
                mapping &&
                mapping.name !==
                  null &&
                mapping.name !==
                  undefined
              ) {
                const startAt =
                  Math.min(
                    Math.max(
                      data_start_row ||
                        0,
                      0
                    ),
                    nonEmptyAoa.length
                  );

                const dataRows =
                  nonEmptyAoa.slice(
                    startAt
                  );

                const aiOut = [];

                for (
                  const row of dataRows
                ) {
                  const get = (idx) =>
                    idx === null ||
                    idx === undefined
                      ? ""
                      : String(
                          row[idx] ?? ""
                        ).trim();

                  const name = get(
                    mapping.name
                  );

                  if (
                    !name ||
                    /^(xxx|yyyy-mm-dd|mr\/ms xxx)$/i.test(
                      name.trim()
                    )
                  ) {
                    continue;
                  }

                  aiOut.push({
                    name,
                    category: "Lainnya",
                    stage_key:
                      firstStage,
                    company_type:
                      get(
                        mapping.company_type
                      ),
                    email: get(
                      mapping.email
                    ),
                    phone: get(
                      mapping.phone
                    ),
                    key_person: get(
                      mapping.key_person
                    ),
                    key_person_title:
                      get(
                        mapping.key_person_title
                      ),
                    product: get(
                      mapping.product
                    ),
                    city: get(
                      mapping.city
                    ),
                    province: get(
                      mapping.province
                    ),
                    website: get(
                      mapping.website
                    ),
                    background: get(
                      mapping.background
                    ),
                    source: "import",
                  });
                }

                if (
                  aiOut.length >
                  sheetOut.length
                ) {
                  sheetOut = aiOut;
                  usedAiFallback = true;
                }
              }
            } catch (aiErr) {
              console.error(
                "Smart import AI gagal:",
                aiErr
              );
            }
          }
        }

        for (
          const m of sheetOut
        ) {
          const key = (
            m.name || ""
          )
            .trim()
            .toLowerCase();

          if (
            key &&
            !existing.has(key)
          ) {
            existing.add(key);

            out.push({
              ...m,
              name: m.name.trim(),
            });
          }
        }
      }

      if (out.length === 0) {
        alert(
          "Ga ada baris kebaca. Pastikan ada data nama perusahaan."
        );
        return;
      }

      for (
        let i = 0;
        i < out.length;
        i += 200
      ) {
        await db.bulkInsertLeads(
          out.slice(i, i + 200)
        );
      }

      alert(
        `✅ Import selesai${
          usedAiFallback
            ? " (dibantu AI baca formatnya)"
            : ""
        }. Masuk: ${out.length} lead.`
      );

      onChanged();
    } catch (e) {
      alert(
        "Gagal import: " +
          e.message
      );
    } finally {
      setBusy(false);
    }
  };


  /* =====================================================
     EXPORT
  ===================================================== */

  const exportCSV = () => {
    const rows = filtered.map(
      (c) => ({
        Nama: c.name,
        Kategori: c.category,
        Tipe: c.company_type,
        Produk: c.product,
        Tahap: stageMeta(
          stages,
          c.stage_key
        ).label,
        Email: c.email,
        Telepon_WA: c.phone,
        Key_Person: c.key_person,
        Jabatan:
          c.key_person_title,
        Kota: c.city,
        Website: c.website,
      })
    );

    const csv =
      Papa.unparse(rows);

    const blob = new Blob(
      ["\ufeff" + csv],
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
      URL.createObjectURL(blob);

    a.download =
      `nexto-leads-${todayISO()}.csv`;

    a.click();
  };


  /* =====================================================
     DELETE
  ===================================================== */

  const del = async (id) => {
    if (
      !window.confirm(
        "Hapus lead ini?"
      )
    ) {
      return;
    }

    await db.deleteLead(id);
    onChanged();
  };


  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="space-y-4">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="sticky top-14 md:top-0 z-20 bg-[#f5f7fb]/95 backdrop-blur-xl pt-1 pb-3">

        <div className="flex flex-col xl:flex-row xl:items-center gap-3">

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-orange-500 font-bold">
                Sales Intelligence
              </div>

              <span className="h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,.8)]" />

              <span className="text-[9px] font-mono text-slate-400">
                {filtered.length} ACTIVE VIEW
              </span>
            </div>

            <div className="mt-0.5 flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-extrabold tracking-[-0.04em] text-slate-950">
                Leads
              </h1>

              <span className="text-[9px] font-mono text-slate-400 border border-slate-200 bg-white rounded-full px-2 py-1">
                {leads.length} records
              </span>
            </div>
          </div>


          <button
            onClick={() =>
              setEdit(blank())
            }
            className="flex items-center justify-center gap-2 bg-slate-950 hover:bg-slate-800 text-white text-xs px-4 py-2.5 rounded-xl font-semibold shadow-[0_10px_24px_-12px_rgba(15,23,42,.7)] transition-colors"
          >
            <Plus size={14} />
            Add Lead
          </button>

        </div>


        {/* SEARCH + FILTER */}

        <div className="mt-3 flex flex-wrap gap-2">

          <div className="relative flex-1 min-w-[220px]">

            <Search
              size={14}
              className="absolute left-3 top-2.5 text-slate-400"
            />

            <input
              value={q}
              onChange={(e) =>
                setQ(e.target.value)
              }
              placeholder="Search company / PIC / city / product / progress..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
            />

          </div>


          <select
            value={fCat}
            onChange={(e) =>
              setFCat(e.target.value)
            }
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm"
          >
            <option value="">
              Semua kategori
            </option>

            {categories.map((c) => (
              <option
                key={c}
                value={c}
              >
                {c}
              </option>
            ))}
          </select>


          {showTypeFilter && (
            <select
              value={fType}
              onChange={(e) =>
                setFType(e.target.value)
              }
              className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm"
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


          <select
            value={fHealth}
            onChange={(e) =>
              setFHealth(e.target.value)
            }
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white shadow-sm"
          >
            <option value="">
              Semua status
            </option>
            <option value="HOT">
              🔥 Hot
            </option>
            <option value="ACTIVE">
              ● Active
            </option>
            <option value="WAITING">
              ◷ Waiting
            </option>
            <option value="OPEN">
              ○ Open
            </option>
          </select>

        </div>


        {/* ACTION BAR */}

        <div className="mt-2 flex flex-wrap gap-2">

          <label className="text-[10px] flex items-center gap-1.5 border border-emerald-200 text-emerald-700 rounded-lg px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 cursor-pointer font-medium">
            <FileSpreadsheet size={12} />

            {busy
              ? "Mengimpor..."
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

                e.target.value = "";
              }}
            />
          </label>


          <button
            onClick={exportCSV}
            className="text-[10px] flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-slate-50 font-medium"
          >
            <Download size={12} />
            Export
          </button>


          <button
            onClick={() =>
              setShowDup(true)
            }
            className="text-[10px] flex items-center gap-1.5 border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white hover:bg-slate-50 font-medium"
          >
            <Copy size={12} />
            Cek Duplikat
          </button>

        </div>

      </div>


      {/* =================================================
          KPI STRIP
      ================================================= */}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">

        <div className="rounded-2xl bg-white border border-slate-200/80 p-3 shadow-[0_8px_25px_-18px_rgba(15,23,42,.25)]">
          <div className="text-[8px] font-mono uppercase tracking-widest text-slate-400">
            Total Leads
          </div>

          <div className="mt-1 text-lg font-extrabold text-slate-900">
            {stats.total}
          </div>
        </div>


        <div className="rounded-2xl bg-white border border-rose-100 p-3 shadow-[0_8px_25px_-18px_rgba(244,63,94,.25)]">
          <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-widest text-rose-500">
            <Flame size={10} />
            Hot
          </div>

          <div className="mt-1 text-lg font-extrabold text-rose-600">
            {stats.hot}
          </div>
        </div>


        <div className="rounded-2xl bg-white border border-emerald-100 p-3 shadow-[0_8px_25px_-18px_rgba(16,185,129,.25)]">
          <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-widest text-emerald-500">
            <Activity size={10} />
            Active
          </div>

          <div className="mt-1 text-lg font-extrabold text-emerald-600">
            {stats.active}
          </div>
        </div>


        <div className="rounded-2xl bg-white border border-sky-100 p-3 shadow-[0_8px_25px_-18px_rgba(14,165,233,.25)]">
          <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-widest text-sky-500">
            <Clock3 size={10} />
            Waiting
          </div>

          <div className="mt-1 text-lg font-extrabold text-sky-600">
            {stats.waiting}
          </div>
        </div>


        <div className="rounded-2xl bg-white border border-amber-100 p-3 shadow-[0_8px_25px_-18px_rgba(245,158,11,.25)]">
          <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase tracking-widest text-amber-500">
            <AlertTriangle size={10} />
            Follow-up
          </div>

          <div className="mt-1 text-lg font-extrabold text-amber-600">
            {stats.followup}
          </div>
        </div>

      </div>


      {/* =================================================
          CARD GRID
      ================================================= */}

      <div
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 rounded-[28px] p-1"
      >

        {pageItems.map((c) => {

          const sm = stageMeta(
            stages,
            c.stage_key
          );

          const wa = waLink(
            c.phone
          );

          const web = normUrl(
            c.website
          );

          const health =
            getLeadHealth(c);

          const HealthIcon =
            health.icon;

          const ai =
            getAISignal(c);

          const AIIcon =
            ai.icon;

          const days =
            daysSince(
              c.last_contact
            );

          const currentStageIndex =
            Math.max(
              0,
              stages.findIndex(
                (s) =>
                  s.key ===
                  c.stage_key
              )
            );

          const progress =
            stages.length <= 1
              ? 100
              : Math.round(
                  (currentStageIndex /
                    (stages.length -
                      1)) *
                    100
                );

          return (

            <div
              key={c.id}
              onClick={() =>
                setEdit(c)
              }
              className="relative rounded-[25px] cursor-pointer group transition-all duration-200 hover:-translate-y-1"
              style={{
                boxShadow:
                  "0 12px 30px -18px rgba(15,23,42,.28)",
              }}
            >

              <CornerBrackets
                color={
                  health.label ===
                  "HOT"
                    ? "#f43f5e"
                    : "#0891b2"
                }
              />


              <div className="rounded-[25px] overflow-hidden bg-white border border-slate-200/80 group-hover:border-slate-300 transition-colors">

                {/* TOP SYSTEM BAR */}

                <div
                  className="h-[3px]"
                  style={{
                    background:
                      health.label ===
                      "HOT"
                        ? "linear-gradient(90deg,#f43f5e,#fb7185,#f97316)"
                        : "linear-gradient(90deg,#f97316,#fb923c)",
                  }}
                />


                <div className="p-4">


                  {/* COMPANY HEADER */}

                  <div className="flex items-start gap-3">

                    <div className="min-w-0 flex-1">

                      <div className="flex items-center gap-1.5 mb-1">

                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background:
                              health.dot,
                            boxShadow:
                              `0 0 7px ${health.dot}`,
                          }}
                        />

                        <span
                          className={`text-[8px] font-mono font-bold uppercase tracking-[0.16em] ${health.className} border rounded-full px-2 py-0.5`}
                        >
                          {health.label}
                        </span>

                        {isNewLead(c) && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">
                            NEW
                          </span>
                        )}

                      </div>


                      <div className="font-extrabold text-slate-950 text-[15px] leading-5 tracking-[-0.02em]">
                        <span className="break-words">
                          {c.name}
                        </span>
                      </div>


                      <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-400">

                        <span className="truncate">
                          {c.category ||
                            "—"}
                        </span>

                        {c.city && (
                          <>
                            <span className="text-slate-200">
                              •
                            </span>

                            <span className="truncate">
                              {c.city}
                            </span>
                          </>
                        )}

                      </div>

                    </div>


                    <div className="flex flex-col items-end gap-2 shrink-0">

                      {c.verified ? (
                        <ShieldCheck
                          size={15}
                          className="text-emerald-500"
                        />
                      ) : (
                        <ShieldAlert
                          size={15}
                          className="text-slate-300"
                        />
                      )}

                      {typeBadge(
                        c.company_type
                      ) && (
                        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500">
                          {typeBadge(
                            c.company_type
                          )}
                        </span>
                      )}

                    </div>

                  </div>


                  {/* PIPELINE */}

                  <div className="mt-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">

                    <div className="flex items-center justify-between">

                      <StageChip
                        hex={sm.hex}
                        label={sm.label}
                      />

                      <span className="text-[8px] font-mono text-slate-400">
                        STAGE {currentStageIndex + 1}/
                        {stages.length}
                      </span>

                    </div>


                    <div className="mt-2 h-1.5 rounded-full bg-slate-200 overflow-hidden">

                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          background:
                            "linear-gradient(90deg,#f97316,#fb923c,#22c55e)",
                        }}
                      />

                    </div>


                    <div className="mt-1 flex justify-between">

                      <span className="text-[7px] font-mono text-slate-400">
                        PIPELINE
                      </span>

                      <span className="text-[8px] font-mono font-bold text-slate-500">
                        {progress}%
                      </span>

                    </div>

                  </div>


                  {/* CONTACT */}

                  <div className="mt-3">

                    {!hideKeyPerson &&
                      c.key_person && (
                        <div className="flex items-center gap-2">

                          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <UserRound
                              size={13}
                              className="text-slate-400"
                            />
                          </div>

                          <div className="min-w-0">

                            <div className="text-[11px] font-bold text-slate-800 truncate">
                              {c.key_person}
                            </div>

                            {!hideTitle &&
                              c.key_person_title && (
                                <div className="text-[9px] text-slate-400 truncate">
                                  {
                                    c.key_person_title
                                  }
                                </div>
                              )}

                          </div>

                        </div>
                      )}

                  </div>


                  {/* DETAILS */}

                  <div className="mt-3 grid grid-cols-2 gap-2">

                    {c.phone && (
                      <div className="min-w-0 rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">

                        <div className="text-[7px] font-mono uppercase tracking-wider text-slate-400">
                          PHONE
                        </div>

                        <div className="mt-0.5 text-[9px] text-slate-600 truncate">
                          {c.phone}
                        </div>

                      </div>
                    )}


                    {c.product && (
                      <div className="min-w-0 rounded-xl bg-slate-50 border border-slate-100 px-2.5 py-2">

                        <div className="text-[7px] font-mono uppercase tracking-wider text-slate-400">
                          {productLabel}
                        </div>

                        <div className="mt-0.5 text-[9px] text-slate-600 truncate">
                          {c.product}
                        </div>

                      </div>
                    )}

                  </div>


                  {!hideWebsite &&
                    web && (
                      <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-400 truncate">

                        <Globe
                          size={11}
                          className="shrink-0"
                        />

                        <span className="truncate">
                          {prettyDomain(
                            c.website
                          )}
                        </span>

                      </div>
                    )}


                  {c.email && (
                    <div className="mt-1 flex items-center gap-1.5 text-[9px] text-slate-400 truncate">

                      <Mail
                        size={11}
                        className="shrink-0"
                      />

                      <span className="truncate">
                        {c.email}
                      </span>

                    </div>
                  )}


                  {customSlots.map(
                    (slot) =>
                      c[slot.key] ? (
                        <div
                          key={slot.key}
                          className="mt-1 text-[9px] text-slate-500 truncate"
                        >
                          <span className="text-slate-400">
                            {slot.label}:
                          </span>{" "}
                          {c[slot.key]}
                        </div>
                      ) : null
                  )}


                  {/* TIMELINE */}

                  <div className="mt-3 grid grid-cols-2 gap-2">

                    <div className="rounded-xl border border-slate-100 bg-white px-2.5 py-2">

                      <div className="flex items-center gap-1 text-[7px] font-mono uppercase tracking-wider text-slate-400">
                        <Clock3 size={9} />
                        Last Contact
                      </div>

                      <div className="mt-1 text-[9px] font-semibold text-slate-700">
                        {formatDate(
                          c.last_contact
                        )}
                      </div>

                      {days !== null && (
                        <div
                          className={`mt-0.5 text-[8px] ${
                            days >= 7
                              ? "text-rose-500"
                              : "text-slate-400"
                          }`}
                        >
                          {days === 0
                            ? "Today"
                            : `${days} days ago`}
                        </div>
                      )}

                    </div>


                    <div className="rounded-xl border border-orange-100 bg-orange-50/60 px-2.5 py-2">

                      <div className="flex items-center gap-1 text-[7px] font-mono uppercase tracking-wider text-orange-500">
                        <ArrowUpRight size={9} />
                        Next Action
                      </div>

                      <div className="mt-1 text-[9px] font-semibold text-orange-800 line-clamp-2 leading-3.5">
                        {c.next_action ||
                          "Belum ditentukan"}
                      </div>

                    </div>

                  </div>


                  {/* WAITING */}

                  {c.wait_until &&
                    new Date(
                      c.wait_until
                    ) >=
                      new Date(
                        todayISO()
                      ) && (
                      <div className="mt-2 flex items-center gap-2 text-[9px] text-sky-700 bg-sky-50 border border-sky-100 rounded-xl px-2.5 py-2">

                        <Clock3
                          size={11}
                          className="shrink-0"
                        />

                        <span>
                          Waiting until{" "}
                          <b>
                            {formatDate(
                              c.wait_until
                            )}
                          </b>
                        </span>

                      </div>
                    )}


                  {/* AI SIGNAL */}

                  <div
                    className={`mt-3 rounded-xl border px-2.5 py-2 ${
                      ai.type === "danger"
                        ? "bg-rose-50 border-rose-100"
                        : ai.type === "warning"
                        ? "bg-amber-50 border-amber-100"
                        : ai.type === "active"
                        ? "bg-emerald-50 border-emerald-100"
                        : ai.type === "waiting"
                        ? "bg-sky-50 border-sky-100"
                        : "bg-slate-50 border-slate-100"
                    }`}
                  >

                    <div className="flex items-start gap-2">

                      <AIIcon
                        size={12}
                        className={
                          ai.type ===
                          "danger"
                            ? "text-rose-500"
                            : ai.type ===
                              "warning"
                            ? "text-amber-500"
                            : ai.type ===
                              "active"
                            ? "text-emerald-500"
                            : ai.type ===
                              "waiting"
                            ? "text-sky-500"
                            : "text-slate-400"
                        }
                      />

                      <div className="min-w-0">

                        <div className="text-[8px] font-mono uppercase tracking-wider font-bold text-slate-500">
                          AI SIGNAL
                        </div>

                        <div className="mt-0.5 text-[9px] font-semibold text-slate-700">
                          {ai.title}
                        </div>

                        <div className="text-[8px] text-slate-400 leading-3 mt-0.5">
                          {ai.text}
                        </div>

                      </div>

                    </div>

                  </div>


                  {/* QUICK ACTIONS */}

                  <div
                    className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1"
                    onClick={(e) =>
                      e.stopPropagation()
                    }
                  >

                    {c.phone &&
                      (wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
                          title={c.phone}
                        >
                          <Phone size={12} />
                          WA
                        </a>
                      ) : (
                        <span className="p-1.5 text-slate-300">
                          <Phone size={12} />
                        </span>
                      ))}


                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                        title={c.email}
                      >
                        <Mail size={12} />
                        Email
                      </a>
                    )}


                    <button
                      onClick={(e) =>
                        setDraftPopup({
                          lead: c,
                          rect:
                            e.currentTarget.getBoundingClientRect(),
                        })
                      }
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-medium text-orange-600 hover:bg-orange-50 transition-colors"
                      title="Draft follow-up AI"
                    >
                      <Sparkles size={12} />
                      AI
                    </button>


                    <div className="ml-auto flex items-center gap-0.5">

                      <button
                        onClick={() =>
                          setEdit(c)
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                        title="Edit"
                      >
                        <Pencil size={12} />
                      </button>


                      <button
                        onClick={() =>
                          del(c.id)
                        }
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Delete"
                      >
                        <Trash2 size={12} />
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
                    }}
                    className="mt-2.5 w-full flex items-center gap-2 text-left text-[9px] font-mono text-slate-500 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 hover:border-cyan-400 hover:text-cyan-700 hover:bg-cyan-50 transition-colors"
                    title="Update progress harian"
                  >

                    <ClipboardList
                      size={12}
                      className="shrink-0 text-slate-400"
                    />

                    <span className="truncate">
                      {c.progressLog?.[0]
                        ? c.progressLog[0]
                            .text
                        : "> update progress hari ini..."}
                    </span>

                  </button>


                </div>

              </div>

            </div>
          );
        })}


        {/* EMPTY */}

        {filtered.length === 0 && (
          <div className="col-span-full p-10 text-center bg-white border border-dashed border-slate-200 rounded-3xl">

            <div className="mx-auto w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Search
                size={17}
                className="text-slate-400"
              />
            </div>

            <div className="mt-3 text-sm font-semibold text-slate-600">
              Tidak ada lead ditemukan
            </div>

            <div className="mt-1 text-[10px] text-slate-400">
              Coba ubah search atau filter.
            </div>

          </div>
        )}

      </div>


      {/* =================================================
          PAGINATION
      ================================================= */}

      {filtered.length > 0 &&
        totalPages > 1 && (

          <div className="flex flex-wrap items-center justify-center gap-1.5 mt-4">

            <button
              onClick={() =>
                setPage((p) =>
                  Math.max(
                    1,
                    p - 1
                  )
                )
              }
              disabled={page === 1}
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
                i <= totalPages;
                i++
              ) {
                if (
                  i === 1 ||
                  i === totalPages ||
                  (i >=
                    page -
                      window &&
                    i <=
                      page +
                        window)
                ) {
                  nums.push(i);
                } else if (
                  nums[
                    nums.length -
                      1
                  ] !== "…"
                ) {
                  nums.push("…");
                }
              }

              return nums.map(
                (n, idx) =>
                  n === "…" ? (
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
                        setPage(n)
                      }
                      className={`min-w-[34px] h-[34px] px-2 rounded-lg text-sm font-medium ${
                        n === page
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
                setPage((p) =>
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


            <span className="text-[9px] font-mono text-slate-400 ml-2">
              PAGE {page}/
              {totalPages} ·{" "}
              {filtered.length} LEADS
            </span>

          </div>
        )}


      {/* =================================================
          MODALS
      ================================================= */}

      {edit && (
        <LeadModal
          lead={edit}
          stages={stages}
          settings={settings}
          industry={industry}
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
          lead={draftPopup.lead}
          rect={draftPopup.rect}
          onClose={() =>
            setDraftPopup(null)
          }
          onSent={onChanged}
        />
      )}


      {progressPopup && (
        <ProgressPopup
          lead={progressPopup.lead}
          autoFocus={
            progressPopup.autoFocus
          }
          onClose={() =>
            setProgressPopup(null)
          }
          onChanged={onChanged}
        />
      )}


      {showDup && (
        <DuplicateModal
          leads={leads}
          onClose={() =>
            setShowDup(false)
          }
          onChanged={onChanged}
        />
      )}

    </div>
  );
}
