import { useMemo, useState } from "react";
import { Factory, Car, Building2, Boxes, ShieldCheck, ShoppingBag, Sparkles, Search, Plus, ShieldAlert } from "lucide-react";
import { INDUSTRY_TEMPLATES, getFieldLabel, isFieldHidden, getCustomFieldSlots, getCompanyTypeOptions } from "../lib/industryTemplates";

const ICONS = {
  pvc_chemical: Factory,
  automotive: Car,
  property: Building2,
  b2b_general: Boxes,
  insurance: ShieldCheck,
  retail_fmcg: ShoppingBag,
};

// Singkatan buat badge kecil di sebelah nama - niruin pola typeBadge() yang
// dipake di tabel Leads beneran (M/T/dst), tapi generik buat semua industri.
const typeAbbr = (t) => {
  if (!t) return "";
  return t
    .split(/[\s/]+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
};

// Contoh data dummy per industri - CUMA buat ditampilin di halaman demo ini,
// gak pernah kesimpen/kepake ke database beneran.
const SAMPLE_LEADS = {
  pvc_chemical: [
    { name: "PT Sinar Abadi Plastik", stage_key: "presentasi", city: "Tangerang", key_person: "Budi Santoso", key_person_title: "Purchasing Manager", product: "Resin PVC K67", category: "Resin & Compound", company_type: "Manufacturer", verified: true, custom: {} },
    { name: "CV Karya Plastindo", stage_key: "negosiasi", city: "Bekasi", key_person: "Sari Wulandari", key_person_title: "Direktur", product: "Kabel Listrik NYA", category: "Kabel Listrik", company_type: "Trader", verified: false, custom: {} },
  ],
  automotive: [
    { name: "Andi Pratama", stage_key: "test_drive", city: "Bekasi", key_person: "", key_person_title: "", product: "Avanza Tipe G", category: "Mobil Baru", company_type: "Individu", verified: true, custom: { custom_field_1: "Rp 45 juta", custom_field_2: "Rp 3,2 juta / bulan", custom_field_3: "Cash" } },
    { name: "Fleet PT Cepat Logistik", stage_key: "negosiasi", city: "Jakarta", key_person: "", key_person_title: "", product: "Pickup Diesel", category: "Mobil Baru", company_type: "Fleet", verified: true, custom: { custom_field_1: "Tanpa trade-in", custom_field_2: "Rp 8 juta / bulan", custom_field_3: "Kredit", custom_field_4: "-" } },
  ],
  property: [
    { name: "Rina Kusuma", stage_key: "viewing", city: "Bandung", key_person: "", key_person_title: "", product: "Rumah Tapak 2 Lantai", category: "Rumah Tapak", company_type: "Individu", verified: true, custom: { custom_field_1: "120 m²", custom_field_2: "KPR", custom_field_3: "1-3 bulan lagi" } },
    { name: "Investor - PT Maju Aset", stage_key: "negosiasi", city: "Surabaya", key_person: "", key_person_title: "", product: "Ruko / Rukan", category: "Ruko / Rukan", company_type: "Investor", verified: false, custom: { custom_field_1: "200 m²", custom_field_2: "Cash", custom_field_3: "Segera", custom_field_4: "SHM" } },
  ],
  b2b_general: [
    { name: "PT Distribusi Nusantara", stage_key: "quotation", city: "Semarang", key_person: "Hendra Wijaya", key_person_title: "Supply Chain Manager", product: "Kemasan Karton", category: "Barang Jadi", company_type: "Trader", verified: true, custom: { custom_field_1: "2x/bulan", custom_field_2: "Termin 30 hari" } },
  ],
  insurance: [
    { name: "Dewi Anggraini", stage_key: "proposal", city: "Jakarta", key_person: "", key_person_title: "", product: "Asuransi Jiwa", category: "Asuransi Jiwa", company_type: "Perorangan", verified: true, custom: { custom_field_1: "Rp 500 juta", custom_field_2: "10 setiap bulan", custom_field_3: "Suami" } },
    { name: "Korporat - PT Sejahtera Abadi", stage_key: "negosiasi", city: "Bandung", key_person: "", key_person_title: "", product: "Asuransi Kesehatan Grup", category: "Asuransi Kesehatan", company_type: "Korporat", verified: false, custom: { custom_field_1: "Rp 2 miliar", custom_field_2: "1 Januari", custom_field_3: "-", custom_field_4: "Grup Karyawan" } },
  ],
  retail_fmcg: [
    { name: "Toko Sumber Rejeki", stage_key: "penawaran", city: "Depok", key_person: "Pak Slamet", key_person_title: "Pemilik", product: "Minuman Kemasan", category: "Makanan & Minuman", company_type: "", verified: true, custom: { custom_field_1: "Depok Timur", custom_field_2: "Rp 3,5 juta" } },
  ],
};

export default function IndustryDemo() {
  const [industry, setIndustry] = useState("pvc_chemical");
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [toast, setToast] = useState("");

  const tpl = INDUSTRY_TEMPLATES[industry];
  const allSamples = SAMPLE_LEADS[industry] || [];
  const customSlots = getCustomFieldSlots(industry);
  const companyTypeOptions = getCompanyTypeOptions(industry).filter((t) => t.v);
  const showCompanyType = !isFieldHidden(industry, "company_type");
  const showKeyPerson = !isFieldHidden(industry, "key_person") || !isFieldHidden(industry, "key_person_title");
  const showLocation = !isFieldHidden(industry, "location");
  const showWebsite = !isFieldHidden(industry, "website");

  const samples = useMemo(() => {
    return allSamples.filter((l) => {
      if (fCat && l.category !== fCat) return false;
      if (q && !`${l.name} ${l.city} ${l.product}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [allSamples, q, fCat]);

  const pickIndustry = (key) => {
    setIndustry(key);
    setQ("");
    setFCat("");
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 relative">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-medium rounded-full px-4 py-2.5 shadow-[0_12px_30px_-10px_rgba(15,23,42,0.5)] whitespace-nowrap">
          {toast}
        </div>
      )}

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
              onClick={() => pickIndustry(t.key)}
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

      {/* Pipeline - papan Kanban beneran (kolom per tahap, kartu lead di dalemnya),
          pola visual paling dikenali dari CRM manapun (HubSpot/Pipedrive/dst) -
          jauh lebih "keliatan CRM beneran" dibanding sekadar daftar tahap. */}
      <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)]">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Pipeline — {tpl.label}</div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
          {tpl.stages.map((s) => {
            const cardsInStage = allSamples.filter((l) => l.stage_key === s.key);
            return (
              <div key={s.key} className="shrink-0 w-[168px]">
                <div className="flex items-center gap-1.5 mb-2 px-0.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.hex }} />
                  <span className="text-[10.5px] font-bold text-slate-700 truncate">{s.label}</span>
                  <span className="ml-auto text-[10px] font-semibold text-slate-400 shrink-0">{cardsInStage.length}</span>
                </div>
                <div className="space-y-1.5 rounded-2xl bg-slate-50 border border-slate-100 p-1.5 min-h-[84px]">
                  {cardsInStage.length === 0 ? (
                    <div className="text-[9px] text-slate-300 text-center py-6">Kosong</div>
                  ) : (
                    cardsInStage.map((lead, i) => (
                      <div
                        key={i}
                        onClick={() => showToast(`"${lead.name}" di tahap ${s.label} - contoh doang bro`)}
                        className="rounded-xl bg-white border border-slate-200 p-2.5 shadow-sm hover:shadow-md hover:border-orange-300 hover:-translate-y-0.5 transition-all cursor-pointer"
                      >
                        <div className="text-[10.5px] font-semibold text-slate-800 leading-snug line-clamp-2">{lead.name}</div>
                        <div className="text-[9px] text-slate-400 mt-1 truncate">{lead.product}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
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

      {/* Contoh tampilan tabel Leads - dibuat semirip mungkin sama tabel beneran:
          toolbar cari/filter yang beneran jalan (di data contoh doang), baris
          yang hover & bisa diklik (nunjukin toast, gak buka data asli). */}
      <div className="bg-white border border-slate-100 rounded-3xl shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] overflow-hidden">
        <div className="p-4 pb-0">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Contoh tampilan tabel Leads</div>
        </div>

        {/* Toolbar - persis pola toolbar Leads beneran */}
        <div className="px-4 pb-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama / kota / produk..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-500/10"
            />
          </div>
          <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="text-xs border border-slate-200 rounded-xl px-2.5 py-2 bg-white">
            <option value="">Semua kategori</option>
            {(tpl.categories || []).map((c) => <option key={c}>{c}</option>)}
          </select>
          <button
            onClick={() => showToast("Ini mode demo, bro — daftar akun buat mulai nambah lead beneran 🙂")}
            className="text-xs bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl px-3.5 py-2 flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus size={13} /> Lead
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="text-sm min-w-full">
            <thead className="text-slate-400 text-[11px] uppercase tracking-wider bg-slate-50">
              <tr className="text-left">
                <th className="py-2.5 px-4 font-medium">{getFieldLabel(industry, "name", "Perusahaan")}</th>
                <th className="py-2.5 px-4 font-medium">Kota</th>
                {showKeyPerson && !isFieldHidden(industry, "key_person") && <th className="py-2.5 px-4 font-medium">{getFieldLabel(industry, "key_person", "Key Person")}</th>}
                {showKeyPerson && !isFieldHidden(industry, "key_person_title") && <th className="py-2.5 px-4 font-medium">{getFieldLabel(industry, "key_person_title", "Jabatan")}</th>}
                <th className="py-2.5 px-4 font-medium">{getFieldLabel(industry, "product", "Produk")}</th>
                {customSlots.map((slot) => <th key={slot.key} className="py-2.5 px-4 font-medium whitespace-nowrap">{slot.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {samples.map((lead, i) => (
                <tr
                  key={i}
                  onClick={() => showToast(`Ini contoh "${lead.name}" - klik lead beneran abis daftar akun`)}
                  className="border-t border-slate-100 hover:bg-orange-50/50 transition-colors cursor-pointer group"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 flex items-center gap-1.5 flex-wrap">
                      {lead.name}
                      {showCompanyType && lead.company_type && (
                        <span className="text-[9px] font-bold px-1 rounded bg-slate-200 text-slate-600">{typeAbbr(lead.company_type)}</span>
                      )}
                      {lead.verified ? <ShieldCheck size={12} className="text-emerald-500" /> : <ShieldAlert size={12} className="text-slate-300" />}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{lead.category}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{lead.city}</td>
                  {showKeyPerson && !isFieldHidden(industry, "key_person") && <td className="px-4 py-3 text-xs text-slate-600">{lead.key_person || "—"}</td>}
                  {showKeyPerson && !isFieldHidden(industry, "key_person_title") && <td className="px-4 py-3 text-xs text-slate-600">{lead.key_person_title || "—"}</td>}
                  <td className="px-4 py-3 text-xs text-slate-600">{lead.product}</td>
                  {customSlots.map((slot) => <td key={slot.key} className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{lead.custom[slot.key] || "—"}</td>)}
                </tr>
              ))}
              {samples.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-xs text-slate-400">Gak ada contoh yang cocok - coba ganti kata kunci / kategori.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
