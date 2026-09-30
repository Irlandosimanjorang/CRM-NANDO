// Data CONTOH yang ditampilkan ke user yang tab-nya masih terkunci (mode
// lihat-lihat) - disesuaikan per industri (30 Sep 2026, audit istilah per
// industri: sebelumnya contohnya selalu PVC/pabrik - "Bahan Baku", "Kirim
// sample ke pabrik", "ton" - termasuk buat Corporate Consultant, dealer, dst).
// Tahap diambil dari pipeline org itu sendiri, bukan kode tahap PVC.

const DEMO = {
  pvc_chemical: {
    leads: [
      { name: "PT Sinar Abadi Plastik", category: "Pipa & Fitting", key_person: "Budi Santoso", title: "Purchasing Manager", product: "Resin PVC K67", city: "Tangerang", agenda: "Presentasi spesifikasi resin & harga", next: "Follow up hasil presentasi" },
      { name: "CV Karya Mandiri Kabel", category: "Kabel Listrik", key_person: "Sari Wulandari", title: "Direktur", product: "Kompon kabel", city: "Bekasi", agenda: "Trial sample kompon", next: "Kirim sample ke pabrik" },
      { name: "PT Maju Bersama Profil", category: "Roofing / Ceiling / Profil", key_person: "Ahmad Fauzi", title: "Owner", product: "Resin PVC + stabilizer", city: "Surabaya" },
    ],
    deals: [{ value: 45000000, qty: 5, unit: "ton", product: "Resin PVC K67" }, { value: 28000000, qty: 3, unit: "ton", product: "Kompon kabel" }],
    competitor: { name: "PT Kompetitor Polimer", background: "Pemain lama di Jabodetabek", product: "Resin PVC impor", notes: "Harga agresif, pengiriman sering telat", usage: { company: "PT ABC Pipa Nusantara", product: "Resin PVC", price: "Rp15.500/kg", quantity: "20 ton/bulan" } },
    advisor: ["Follow up hasil presentasi spesifikasi resin", "Tanyakan hasil trial sample kompon"],
  },
  automotive: {
    leads: [
      { name: "Bapak Andi Wijaya", category: "Mobil Baru", key_person: "Andi Wijaya", title: "Calon pembeli", product: "SUV 7 penumpang", city: "Tangerang", agenda: "Test drive unit SUV", next: "Kirim simulasi kredit" },
      { name: "PT Logistik Cepat", category: "Mobil Baru", key_person: "Sari Wulandari", title: "Fleet Manager", product: "Pick-up niaga (10 unit)", city: "Bekasi", agenda: "Presentasi program fleet", next: "Kirim penawaran harga fleet" },
      { name: "Ibu Rina Kusuma", category: "Motor Baru", key_person: "Rina Kusuma", title: "Calon pembeli", product: "Motor matic", city: "Surabaya" },
    ],
    deals: [{ value: 385000000, qty: 1, unit: "unit", product: "SUV 7 penumpang" }, { value: 28000000, qty: 1, unit: "unit", product: "Motor matic" }],
    competitor: { name: "Dealer Kompetitor Jaya", background: "Dealer resmi merek lain di area yang sama", product: "SUV kelas menengah", notes: "Diskon besar, antrean servis panjang", usage: { company: "PT Armada Kita", product: "Pick-up niaga", price: "Rp210 jt/unit", quantity: "8 unit" } },
    advisor: ["Tanyakan kesan test drive dan kirim simulasi kredit", "Follow up penawaran program fleet"],
  },
  property: {
    leads: [
      { name: "Bapak Andi Wijaya", category: "Rumah Tapak", key_person: "Andi Wijaya", title: "Calon pembeli", product: "Rumah 2 lantai tipe 90", city: "Tangerang", agenda: "Viewing unit contoh", next: "Kirim simulasi KPR" },
      { name: "Ibu Sari Wulandari", category: "Apartemen", key_person: "Sari Wulandari", title: "Investor", product: "Apartemen studio", city: "Jakarta Selatan", agenda: "Presentasi proyeksi sewa", next: "Kirim price list terbaru" },
      { name: "PT Maju Bersama", category: "Ruko / Rukan", key_person: "Ahmad Fauzi", title: "Direktur", product: "Ruko 3 lantai", city: "Surabaya" },
    ],
    deals: [{ value: 1450000000, product: "Rumah 2 lantai tipe 90" }, { value: 650000000, product: "Apartemen studio" }],
    competitor: { name: "Developer Kompetitor Asri", background: "Developer cluster di koridor yang sama", product: "Rumah tapak tipe 70-90", notes: "DP ringan, akses jalan lebih jauh dari tol", usage: { company: "Keluarga Hartono", product: "Rumah tipe 70", price: "Rp1,2 M", quantity: "1 unit" } },
    advisor: ["Tanyakan kesan viewing dan kirim simulasi KPR", "Kirim price list terbaru ke investor"],
  },
  b2b_general: {
    leads: [
      { name: "PT Sinar Abadi Distribusi", category: "Bahan Baku", key_person: "Budi Santoso", title: "Purchasing Manager", product: "Alat tulis kantor", city: "Tangerang", agenda: "Presentasi katalog & harga", next: "Follow up hasil presentasi" },
      { name: "CV Karya Mandiri", category: "Peralatan", key_person: "Sari Wulandari", title: "Owner", product: "Mesin pengemas", city: "Bekasi", agenda: "Demo mesin", next: "Kirim quotation" },
      { name: "PT Maju Bersama Sejahtera", category: "Barang Jadi", key_person: "Ahmad Fauzi", title: "Direktur", product: "Perlengkapan kantor", city: "Surabaya" },
    ],
    deals: [{ value: 45000000, qty: 120, unit: "karton", product: "Alat tulis kantor" }, { value: 28000000, qty: 2, unit: "pcs", product: "Mesin pengemas" }],
    competitor: { name: "PT Kompetitor Jaya", background: "Distributor lama di Jabodetabek", product: "Alat tulis kantor", notes: "Harga agresif, layanan purna jual lambat", usage: { company: "PT ABC Nusantara", product: "Kertas & ATK", price: "Rp15.000/pcs", quantity: "2.000 pcs/bulan" } },
    advisor: ["Follow up hasil presentasi katalog", "Kirim quotation setelah demo mesin"],
  },
  insurance: {
    leads: [
      { name: "Bapak Andi Wijaya", category: "Asuransi Jiwa", key_person: "Andi Wijaya", title: "Calon nasabah", product: "Asuransi jiwa berjangka", city: "Tangerang", agenda: "Konsultasi kebutuhan proteksi", next: "Kirim ilustrasi polis" },
      { name: "PT Logistik Cepat", category: "Asuransi Kesehatan", key_person: "Sari Wulandari", title: "HR Manager", product: "Asuransi kesehatan karyawan (40 orang)", city: "Bekasi", agenda: "Presentasi benefit grup", next: "Kirim proposal premi grup" },
      { name: "Ibu Rina Kusuma", category: "Asuransi Pendidikan", key_person: "Rina Kusuma", title: "Calon nasabah", product: "Asuransi pendidikan anak", city: "Surabaya" },
    ],
    deals: [{ value: 12000000, product: "Asuransi jiwa berjangka" }, { value: 96000000, product: "Asuransi kesehatan karyawan" }],
    competitor: { name: "Asuransi Kompetitor Sejahtera", background: "Perusahaan asuransi dengan jaringan agen luas", product: "Asuransi kesehatan grup", notes: "Premi murah, proses klaim lama", usage: { company: "PT ABC Nusantara", product: "Kesehatan grup", price: "Rp2,4 jt/orang/tahun", quantity: "60 karyawan" } },
    advisor: ["Kirim ilustrasi polis setelah konsultasi", "Follow up proposal premi grup ke HR"],
  },
  retail_fmcg: {
    leads: [
      { name: "Toko Sumber Rejeki", category: "Makanan & Minuman", key_person: "Pak Slamet", title: "Pemilik toko", product: "Minuman kemasan", city: "Bekasi", agenda: "Presentasi program diskon outlet", next: "Follow up order pertama" },
      { name: "Minimarket Berkah", category: "Perawatan Diri", key_person: "Sari Wulandari", title: "Store Manager", product: "Sabun & sampo", city: "Depok", agenda: "Penawaran display produk", next: "Kirim daftar harga grosir" },
      { name: "Grosir Maju Jaya", category: "Makanan & Minuman", key_person: "Ahmad Fauzi", title: "Owner", product: "Makanan ringan", city: "Surabaya" },
    ],
    deals: [{ value: 18000000, qty: 150, unit: "karton", product: "Minuman kemasan" }, { value: 9500000, qty: 80, unit: "karton", product: "Makanan ringan" }],
    competitor: { name: "Distributor Kompetitor Makmur", background: "Distributor area Bekasi-Depok", product: "Minuman kemasan", notes: "Margin toko lebih besar, pengiriman tidak rutin", usage: { company: "Toko Barokah", product: "Minuman kemasan", price: "Rp85.000/karton", quantity: "40 karton/bulan" } },
    advisor: ["Follow up order pertama outlet", "Kirim daftar harga grosir ke minimarket"],
  },
  corporate_consultant: {
    leads: [
      { name: "PT Mitra Logistik", category: "Logistik & Transportasi", key_person: "Budi Santoso", title: "HR Director", product: "Assessment 40 supervisor", city: "Jakarta", agenda: "Presentasi proposal assessment", next: "Kirim revisi proposal & timeline" },
      { name: "PT Bank Sejahtera", category: "Perbankan & Keuangan", key_person: "Sari Wulandari", title: "CEO", product: "Review strategi bisnis 2027", city: "Jakarta", agenda: "Kickoff meeting", next: "Kirim draft SPK" },
      { name: "PT Arta Graha Konstruksi", category: "Properti & Konstruksi", key_person: "Ahmad Fauzi", title: "CFO", product: "Audit & perencanaan pajak", city: "Surabaya" },
    ],
    deals: [{ value: 120000000, product: "Assessment 40 supervisor" }, { value: 85000000, product: "Audit & perencanaan pajak" }],
    competitor: { name: "Konsultan Kompetitor Prima", background: "Firma konsultan menengah di Jakarta", product: "Assessment & training SDM", notes: "Harga lebih murah, tim senior terbatas", usage: { company: "PT ABC Nusantara", product: "Assessment manajerial", price: "Rp2,5 jt/peserta", quantity: "30 peserta" } },
    advisor: ["Kirim revisi proposal assessment beserta timeline", "Kirim draft SPK setelah kickoff"],
  },
};

const iso = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);

export function getIndustryDemo(industryKey, stages = []) {
  const d = DEMO[industryKey] || DEMO.b2b_general;
  const normal = stages.filter((s) => s.type === "normal");
  const won = stages.find((s) => s.type === "won");
  const stageFor = [normal[Math.min(1, normal.length - 1)]?.key, normal[normal.length - 1]?.key, won?.key || normal[0]?.key];

  const leads = d.leads.map((l, i) => ({
    id: `dummy-${i + 1}`, name: l.name, category: l.category, stage_key: stageFor[i] || "", city: l.city,
    key_person: l.key_person, key_person_title: l.title, product: l.product,
    phone: `0812xxxxxx0${i + 1}`, email: "",
    visit_date: i === 0 ? iso(0) : i === 1 ? iso(1) : null,
    visit_meet: l.agenda ? l.key_person : null, visit_agenda: l.agenda || null,
    next_action: l.next || null, latitude: null, longitude: null, source: "manual",
  }));
  const deals = d.deals.map((x, i) => ({
    id: `dd-${i + 1}`, lead_id: `dummy-${i === 0 ? 3 : 2}`, lead_name: leads[i === 0 ? 2 : 1].name,
    deal_date: iso(-15 - i * 5), deal_value: x.value, tonnage: x.qty || 0, tonnage_unit: x.unit || "", chemical: x.product,
  }));
  const competitors = [{
    id: "dc-1", name: d.competitor.name, background: d.competitor.background, product: d.competitor.product, notes: d.competitor.notes,
    usages: [{ id: "u1", ...d.competitor.usage }],
  }];
  const advisorRecs = [
    { id: "dummy-1", urgency: "high", assessment: `Lead ini sudah 5 hari tidak dihubungi, padahal agendanya "${d.leads[0].agenda}".`, action: d.advisor[0], steps: ["Hubungi PIC", "Tanyakan tanggapan atas penawaran"], talking_point: `${d.leads[0].key_person}, bagaimana pertimbangan Anda soal penawaran kemarin?` },
    { id: "dummy-2", urgency: "medium", assessment: `Sudah di tahap lanjut, namun belum ada kabar setelah "${d.leads[1].agenda}".`, action: d.advisor[1], steps: ["Tanyakan kapan keputusan diambil"], talking_point: "Apakah ada hal yang masih perlu kami jelaskan?" },
  ];
  return { leads, deals, competitors, advisorRecs };
}
