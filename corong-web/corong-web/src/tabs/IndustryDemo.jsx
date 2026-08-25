import { useState } from "react";
import { Factory, Car, Building2, Boxes, ShieldCheck, ShoppingBag, Sparkles } from "lucide-react";
import { INDUSTRY_TEMPLATES, getFieldLabel, isFieldHidden, getCustomFieldSlots, getCompanyTypeOptions } from "../lib/industryTemplates";

const ICONS = {
  pvc_chemical: Factory,
  automotive: Car,
  property: Building2,
  b2b_general: Boxes,
  insurance: ShieldCheck,
  retail_fmcg: ShoppingBag,
};

// Contoh data dummy per industri - CUMA buat ditampilin di halaman demo ini,
// gak pernah kesimpen/kepake ke database beneran.
const SAMPLE_LEADS = {
  pvc_chemical: [
    { name: "PT Sinar Abadi Plastik", city: "Tangerang", key_person: "Budi Santoso", key_person_title: "Purchasing Manager", product: "Resin PVC K67", custom: {} },
    { name: "CV Karya Plastindo", city: "Bekasi", key_person: "Sari Wulandari", key_person_title: "Direktur", product: "Kabel Listrik NYA", custom: {} },
  ],
  automotive: [
    { name: "Andi Pratama", city: "Bekasi", key_person: "", key_person_title: "", product: "Avanza Tipe G", custom: { custom_field_1: "Rp 45 juta", custom_field_2: "Rp 3,2 juta / bulan", custom_field_3: "Cash" } },
    { name: "Fleet PT Cepat Logistik", city: "Jakarta", key_person: "", key_person_title: "", product: "Pickup Diesel", custom: { custom_field_1: "Tanpa trade-in", custom_field_2: "Rp 8 juta / bulan", custom_field_3: "Kredit", custom_field_4: "-" } },
  ],
  property: [
    { name: "Rina Kusuma", city: "Bandung", key_person: "", key_person_title: "", product: "Rumah Tapak 2 Lantai", custom: { custom_field_1: "120 m²", custom_field_2: "KPR", custom_field_3: "1-3 bulan lagi" } },
    { name: "Investor - PT Maju Aset", city: "Surabaya", key_person: "", key_person_title: "", product: "Ruko / Rukan", custom: { custom_field_1: "200 m²", custom_field_2: "Cash", custom_field_3: "Segera", custom_field_4: "SHM" } },
  ],
  b2b_general: [
    { name: "PT Distribusi Nusantara", city: "Semarang", key_person: "Hendra Wijaya", key_person_title: "Supply Chain Manager", product: "Kemasan Karton", custom: { custom_field_1: "2x/bulan", custom_field_2: "Termin 30 hari" } },
  ],
  insurance: [
    { name: "Dewi Anggraini", city: "Jakarta", key_person: "", key_person_title: "", product: "Asuransi Jiwa", custom: { custom_field_1: "Rp 500 juta", custom_field_2: "10 setiap bulan", custom_field_3: "Suami" } },
    { name: "Korporat - PT Sejahtera Abadi", city: "Bandung", key_person: "", key_person_title: "", product: "Asuransi Kesehatan Grup", custom: { custom_field_1: "Rp 2 miliar", custom_field_2: "1 Januari", custom_field_3: "-", custom_field_4: "Grup Karyawan" } },
  ],
  retail_fmcg: [
    { name: "Toko Sumber Rejeki", city: "Depok", key_person: "Pak Slamet", key_person_title: "Pemilik", product: "Minuman Kemasan", custom: { custom_field_1: "Depok Timur", custom_field_2: "Rp 3,5 juta" } },
  ],
};

function StageChip({ stage }) {
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full border shrink-0"
      style={{ color: stage.hex, borderColor: `${stage.hex}55`, background: `${stage.hex}14` }}
    >
      {stage.label}
    </span>
  );
}

export default function IndustryDemo() {
  const [industry, setIndustry] = useState("pvc_chemical");
  const tpl = INDUSTRY_TEMPLATES[industry];
  const samples = SAMPLE_LEADS[industry] || [];
  const customSlots = getCustomFieldSlots(industry);
  const companyTypeOptions = getCompanyTypeOptions(industry).filter((t) => t.v);
  const showCompanyType = !isFieldHidden(industry, "company_type");
  const showKeyPerson = !isFieldHidden(industry, "key_person") || !isFieldHidden(industry, "key_person_title");
  const showLocation = !isFieldHidden(industry, "location");
  const showWebsite = !isFieldHidden(industry, "website");

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-orange-600 text-xs font-semibold uppercase tracking-wide"><Sparkles size={14} /> Demo Industri</div>
        <h1 className="text-xl font-bold text-slate-900 mt-1">Lihat isi tiap industri sebelum pitching</h1>
        <p className="text-sm text-slate-500 mt-1">Preview doang - klik industri buat lihat pipeline, field, dan contoh lead. Gak nyentuh data asli sama sekali.</p>
      </div>

      {/* Selector industri */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {Object.values(INDUSTRY_TEMPLATES).map((t) => {
          const Icon = ICONS[t.key] || Boxes;
          const active = industry === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setIndustry(t.key)}
              className={`text-left p-3 rounded-2xl border transition-all ${
                active ? "border-orange-500 bg-orange-50 ring-4 ring-orange-500/10" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2 ${active ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                <Icon size={16} />
              </div>
              <div className="text-xs font-semibold text-slate-800 leading-tight">{t.label}</div>
            </button>
          );
        })}
      </div>

      {/* Pipeline */}
      <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pipeline — {tpl.label}</div>
        <div className="flex flex-wrap items-center gap-2">
          {tpl.stages.map((s, i) => (
            <div key={s.key} className="flex items-center gap-2">
              <StageChip stage={s} />
              {i < tpl.stages.length - 1 && <span className="text-slate-300">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Field yang dipakai */}
      <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Field di form Tambah/Edit Lead</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <FieldPill label={getFieldLabel(industry, "name", "Perusahaan")} always />
          <FieldPill label="Kategori" always />
          {showCompanyType && <FieldPill label={getFieldLabel(industry, "company_type", "Tipe perusahaan")} />}
          <FieldPill label={getFieldLabel(industry, "product", "Produk")} always />
          {showKeyPerson && !isFieldHidden(industry, "key_person") && <FieldPill label={getFieldLabel(industry, "key_person", "Key person")} />}
          {showKeyPerson && !isFieldHidden(industry, "key_person_title") && <FieldPill label={getFieldLabel(industry, "key_person_title", "Jabatan")} />}
          <FieldPill label="Kota" always />
          {showLocation && <FieldPill label="Titik lokasi GPS" />}
          {showWebsite && <FieldPill label="Website" />}
          {customSlots.map((slot) => <FieldPill key={slot.key} label={slot.label} custom />)}
        </div>
        {companyTypeOptions.length > 0 && showCompanyType && (
          <div className="mt-3 text-xs text-slate-400">
            Pilihan "{getFieldLabel(industry, "company_type", "Tipe perusahaan")}": {companyTypeOptions.map((t) => t.label).join(" / ")}
          </div>
        )}
      </div>

      {/* Contoh tampilan lead */}
      <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] overflow-x-auto">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contoh tampilan di tabel Leads (data contoh)</div>
        <table className="text-sm min-w-full">
          <thead className="text-slate-400 text-[11px] uppercase tracking-wider">
            <tr className="text-left">
              <th className="py-2 pr-4 font-medium">{getFieldLabel(industry, "name", "Perusahaan")}</th>
              <th className="py-2 pr-4 font-medium">Kota</th>
              {showKeyPerson && !isFieldHidden(industry, "key_person") && <th className="py-2 pr-4 font-medium">{getFieldLabel(industry, "key_person", "Key Person")}</th>}
              {showKeyPerson && !isFieldHidden(industry, "key_person_title") && <th className="py-2 pr-4 font-medium">{getFieldLabel(industry, "key_person_title", "Jabatan")}</th>}
              <th className="py-2 pr-4 font-medium">{getFieldLabel(industry, "product", "Produk")}</th>
              {customSlots.map((slot) => <th key={slot.key} className="py-2 pr-4 font-medium">{slot.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {samples.map((lead, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="py-2.5 pr-4 font-medium text-slate-800">{lead.name}</td>
                <td className="py-2.5 pr-4 text-slate-600">{lead.city}</td>
                {showKeyPerson && !isFieldHidden(industry, "key_person") && <td className="py-2.5 pr-4 text-slate-600">{lead.key_person || "—"}</td>}
                {showKeyPerson && !isFieldHidden(industry, "key_person_title") && <td className="py-2.5 pr-4 text-slate-600">{lead.key_person_title || "—"}</td>}
                <td className="py-2.5 pr-4 text-slate-600">{lead.product}</td>
                {customSlots.map((slot) => <td key={slot.key} className="py-2.5 pr-4 text-slate-600">{lead.custom[slot.key] || "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-center">Semua data di halaman ini contoh doang. Buat industri betulan, pilih pas onboarding akun baru atau lewat Pengaturan.</p>
    </div>
  );
}

function FieldPill({ label, always, custom }) {
  return (
    <div className={`text-xs rounded-xl px-3 py-2 border ${custom ? "border-orange-200 bg-orange-50 text-orange-700" : always ? "border-slate-200 bg-slate-50 text-slate-500" : "border-slate-200 bg-white text-slate-700"}`}>
      {label}
    </div>
  );
}
