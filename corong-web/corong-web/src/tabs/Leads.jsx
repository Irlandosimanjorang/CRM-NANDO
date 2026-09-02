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


function mapRow(
  row,
  category,
  firstStageKey
) {
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

    source: "import",
  };
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

  const [busy, setBusy] =
    useState(false);

  const [showDup, setShowDup] =
    useState(false);

  const [draftPopup, setDraftPopup] =
    useState(null);

  const [progressPopup, setProgressPopup] =
    useState(null);


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

  const importFile =
    async (file) => {

      if (!file) return;

      setBusy(true);

      try {

        const buf =
          new Uint8Array(
            await file.arrayBuffer()
          );

        const wb =
          XLSX.read(
            buf,
            {
              type: "array",
              cellDates: true,
            }
          );

        const firstStage =
          stages[0]?.key;

        const existing =
          new Set(
            leads.map(
              (l) =>
                l.name
                  .trim()
                  .toLowerCase()
            )
          );

        const out = [];

        let usedAiFallback =
          false;


        for (
          const sn of
          wb.SheetNames
        ) {

          const headerRows =
            XLSX.utils.sheet_to_json(
              wb.Sheets[sn],
              {
                defval: "",
              }
            );

          const nonEmptyRows =
            headerRows.filter(
              (r) =>
                Object.values(
                  r
                ).some(
                  (v) =>
                    String(
                      v
                    ).trim()
                )
            );

          let sheetOut = [];


          for (
            const r of
            headerRows
          ) {

            const m =
              mapRow(
                r,
                "Lainnya",
                firstStage
              );

            if (m) {
              sheetOut.push(m);
            }

          }


          if (
            nonEmptyRows.length >
              0 &&
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
              aoa.filter(
                (r) =>
                  r.some(
                    (v) =>
                      String(
                        v
                      ).trim()
                  )
              );


            if (
              nonEmptyAoa.length >
              0
            ) {

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
                  (
                    mapping.name !==
                      null &&
                    mapping.name !==
                      undefined
                  )
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

                  const aiOut =
                    [];


                  for (
                    const row of
                    dataRows
                  ) {

                    const get =
                      (idx) =>
                        (
                          idx ===
                            null ||
                          idx ===
                            undefined
                        )
                          ? ""
                          : String(
                              row[
                                idx
                              ] ??
                                ""
                            ).trim();


                    const name =
                      get(
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
                      category:
                        "Lainnya",
                      stage_key:
                        firstStage,

                      company_type:
                        get(
                          mapping.company_type
                        ),

                      email:
                        get(
                          mapping.email
                        ),

                      phone:
                        get(
                          mapping.phone
                        ),

                      key_person:
                        get(
                          mapping.key_person
                        ),

                      key_person_title:
                        get(
                          mapping.key_person_title
                        ),

                      product:
                        get(
                          mapping.product
                        ),

                      city:
                        get(
                          mapping.city
                        ),

                      province:
                        get(
                          mapping.province
                        ),

                      website:
                        get(
                          mapping.website
                        ),

                      background:
                        get(
                          mapping.background
                        ),

                      source:
                        "import",
                    });

                  }


                  if (
                    aiOut.length >
                    sheetOut.length
                  ) {

                    sheetOut =
                      aiOut;

                    usedAiFallback =
                      true;

                  }

                }

              } catch (
                aiErr
              ) {

                console.error(
                  "Smart import AI gagal:",
                  aiErr
                );

              }

            }

          }


          for (
            const m of
            sheetOut
          ) {

            const key =
              (
                m.name ||
                ""
              )
                .trim()
                .toLowerCase();


            if (
              key &&
              !existing.has(
                key
              )
            ) {

              existing.add(
                key
              );

              out.push({
                ...m,
                name:
                  m.name.trim(),
              });

            }

          }

        }


        if (
          out.length ===
          0
        ) {

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
            out.slice(
              i,
              i + 200
            )
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
            onClick={() =>
              setShowDup(
                true
              )
            }
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
                        setDraftPopup({
                          lead: c,
                          rect:
                            e.currentTarget.getBoundingClientRect(),
                        })
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
          onClose={() =>
            setDraftPopup(
              null
            )
          }
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
          onClose={() =>
            setProgressPopup(
              null
            )
          }
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
          onClose={() =>
            setShowDup(
              false
            )
          }
          onChanged={
            onChanged
          }
        />

      )}

    </div>
  );
}
