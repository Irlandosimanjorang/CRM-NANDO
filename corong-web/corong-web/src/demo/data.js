// Data contoh untuk demo publik (nexto.site/demo). Semua nama, angka, dan catatan fiktif.
// Dipakai oleh src/demo/main.jsx lewat window.__D; getter di mockdb (dibuat scripts/demo/gen-demo-mockdb.cjs) membacanya.
import { getIndustryTemplate } from "../lib/industryTemplates";

const DAY = 86400000;
const dayISO = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
const tsISO = (n, hour = 9) => { const d = new Date(Date.now() + n * DAY); d.setHours(hour, 0, 0, 0); return d.toISOString(); };

const MEMBERS_RAW = [
  { user_id: "u1", role: "owner", name: "Rina Kusuma" },
  { user_id: "u2", role: "sales_rep", name: "Budi Santoso" },
  { user_id: "u3", role: "sales_rep", name: "Sari Wulandari" },
  { user_id: "u4", role: "sales_rep", name: "Andi Pratama" },
  { user_id: "u5", role: "sales_rep", name: "Dewi Lestari" },
];

const MEMBERS = MEMBERS_RAW.map((m) => ({ ...m, display_name: m.name }));

// [nama, kategori, kota, kontak, jabatan, produk, tahap, prioritas, nilai (juta), assigned, umur lead (hari), terakhir dihubungi (hari lalu), langkah berikutnya, catatan[]]
const ROWS = [
  ["Sinar Abadi Distribusi", "Barang Jadi", "Tangerang", "Hendra Wijaya", "Purchasing Manager", "Kertas HVS 80 gsm", "negosiasi", "high", 180, "u2", 38, 1, "Kirim penawaran final dan jadwal pengiriman", ["Minta harga final untuk 400 rim per bulan.", "Meeting kedua: setuju spesifikasi, tinggal harga."]],
  ["Maju Bersama Sejahtera", "Barang Jadi", "Surabaya", "Lina Hartono", "Owner", "Map dan folder arsip", "quotation", "high", 95, "u3", 26, 2, "Follow up quotation yang dikirim Senin", ["Quotation dikirim, menunggu persetujuan istri owner.", "Tanya tenor pembayaran 30 hari."]],
  ["Karya Plastindo", "Bahan Baku", "Bekasi", "Agus Salim", "Direktur Operasional", "Kemasan plastik food grade", "negosiasi", "high", 240, "u2", 51, 4, "Jawab pertanyaan termin pembayaran", ["Menanyakan termin pembayaran, belum dijawab.", "Sample lolos uji internal."]],
  ["Mitra Logistik Nusantara", "Jasa", "Jakarta", "Dina Maharani", "HR Director", "Paket perlengkapan kantor tahunan", "sample", "medium", 120, "u2", 19, 3, "Kirim revisi daftar item", ["HRD butuh paket untuk 40 supervisor sebelum Q1.", "Minta revisi daftar item."]],
  ["Bank Sejahtera Makmur", "Jasa", "Jakarta", "Rudi Hartanto", "General Affairs Head", "Perlengkapan cabang", "quotation", "high", 310, "u3", 30, 2, "Kirim draft kontrak harga", ["Pengadaan cabang baru kuartal depan.", "Quotation 12 cabang dikirim."]],
  ["Arta Graha Konstruksi", "Peralatan", "Surabaya", "Ahmad Fauzi", "CFO", "Alat tulis proyek", "prospek", "medium", 60, "u4", 6, 5, "Jadwalkan kunjungan perkenalan", ["Dapat kontak dari pameran.", "Tertarik katalog proyek."]],
  ["Elang Duta Asia", "Barang Jadi", "Semarang", "Yuni Astuti", "Procurement", "Kertas thermal", "po", "high", 150, "u3", 70, 14, "", ["PO diterima, pengiriman minggu depan.", "Negosiasi selesai di harga Rp38.000 per roll."]],
  ["Berkah Retail Grup", "Barang Jadi", "Bandung", "Tono Setiawan", "Buyer", "Label dan stiker", "po", "medium", 85, "u2", 62, 12, "", ["Repeat order bulan ini.", "Pelanggan puas dengan ketepatan kirim."]],
  ["Cahaya Pangan Utama", "Bahan Baku", "Sidoarjo", "Maria Gunawan", "Manager Pabrik", "Karton packaging", "po", "high", 210, "u4", 80, 21, "", ["Kontrak setahun disepakati.", "Termin 45 hari."]],
  ["Graha Medika Prima", "Jasa", "Jakarta", "dr. Lestari", "Direktur", "Perlengkapan klinik", "lost", "medium", 70, "u5", 55, 30, "", ["Memilih vendor lain karena harga.", "Dihubungi ulang bulan depan."]],
  ["Toko Sumber Rejeki", "Barang Jadi", "Bekasi", "Pak Slamet", "Pemilik", "Alat tulis grosir", "sample", "low", 25, "u5", 14, 6, "Tindak lanjuti sample", ["Sample diterima, dicoba satu minggu."]],
  ["Dharma Teknik Mandiri", "Peralatan", "Cikarang", "Eko Prasetyo", "Plant Manager", "Perlengkapan pabrik", "negosiasi", "high", 175, "u4", 33, 1, "Kirim komparasi harga dengan kompetitor", ["Membandingkan dengan Distributor Kompetitor Makmur.", "Minta diskon volume."]],
  ["Samudra Foods Indonesia", "Bahan Baku", "Jakarta", "Wulan Sari", "Purchasing", "Packaging makanan", "quotation", "medium", 130, "u3", 22, 3, "Follow up quotation", ["Quotation dikirim Jumat."]],
  ["Karya Mandiri Teknik", "Peralatan", "Tangerang", "Joko Susilo", "Owner", "Alat kerja bengkel", "prospek", "low", 40, "u5", 4, 4, "Telepon perkenalan", ["Lead dari website."]],
  ["Nusa Print Solutions", "Jasa", "Yogyakarta", "Ayu Permata", "Owner", "Kertas cetak", "sample", "medium", 55, "u4", 17, 7, "Kirim sample kedua", ["Minta sample gramasi berbeda."]],
  ["Pelangi Edukasi", "Jasa", "Malang", "Bambang Heru", "Kepala Yayasan", "Perlengkapan sekolah", "quotation", "medium", 90, "u2", 28, 5, "Follow up persetujuan yayasan", ["Menunggu rapat yayasan Kamis."]],
  ["Tiga Roda Otomotif", "Peralatan", "Bekasi", "Hasan Basri", "Purchasing", "Perlengkapan workshop", "prospek", "low", 35, "u5", 3, 3, "Kirim katalog", ["Perkenalan via WhatsApp."]],
  ["Kencana Garmen", "Bahan Baku", "Bandung", "Siti Rahma", "Purchasing", "Hang tag dan label", "negosiasi", "medium", 110, "u3", 41, 2, "Revisi harga label", ["Minta harga lebih rendah untuk 50 ribu pcs."]],
  ["Harapan Jaya Farma", "Barang Jadi", "Jakarta", "Ferry Gunawan", "Supply Chain Manager", "Kardus obat", "lost", "high", 200, "u4", 60, 25, "", ["Kalah karena kompetitor memberi termin 60 hari.", "Dicatat sebagai pelajaran termin."]],
  ["Mega Properti Utama", "Jasa", "Jakarta", "Linda Wijaya", "Kepala Umum", "Perlengkapan kantor pemasaran", "quotation", "medium", 75, "u2", 20, 6, "Follow up quotation", ["Quotation untuk 3 proyek."]],
  ["Surya Agro Lestari", "Bahan Baku", "Lampung", "Teguh Wibowo", "Manager", "Karung dan kemasan", "sample", "medium", 100, "u5", 24, 8, "Jadwalkan uji coba kemasan", ["Sample 500 pcs dikirim."]],
  ["Anugerah Bakery", "Barang Jadi", "Depok", "Rina Agustina", "Owner", "Box kue dan kertas roti", "po", "low", 30, "u5", 90, 18, "", ["Order rutin tiap bulan."]],
  ["Delta Elektronik", "Peralatan", "Batam", "Michael Tan", "Procurement", "Pelindung dan kemasan antistatis", "quotation", "high", 260, "u4", 36, 2, "Kirim sertifikat spesifikasi", ["Minta sertifikat ESD."]],
  ["Bumi Raya Lestari", "Bahan Baku", "Medan", "Zulkifli", "Direktur", "Karton ekspor", "prospek", "medium", 150, "u3", 8, 8, "Hubungi ulang, belum direspons", ["Telepon pertama tidak diangkat."]],
  ["Sentosa Print", "Jasa", "Semarang", "Eka Putri", "Owner", "Kertas art paper", "lost", "low", 45, "u2", 48, 22, "", ["Kebutuhan ditunda sampai tahun depan."]],
];

const NOTE_DAYS = [1, 3, 6, 10, 15];

function buildLeads(stages) {
  const first = stages.find((s) => s.type === "normal")?.key;
  return ROWS.map((r, i) => {
    const [name, category, city, key_person, title, product, stage, priority, juta, assigned, age, lastContact, next, notes] = r;
    const stage_key = stages.some((s) => s.key === stage) ? stage : first;
    const won = stages.find((s) => s.key === stage_key)?.type === "won";
    const lost = stages.find((s) => s.key === stage_key)?.type === "lost";
    const id = "demo-l" + (i + 1);
    const progress = notes.map((text, k) => ({ id: `${id}-n${k}`, note_date: dayISO(-NOTE_DAYS[k] - (lastContact > 7 ? lastContact : 0)), text }));
    return {
      id, org_id: "demo-org", user_id: assigned, assigned_to: assigned, name: name.toUpperCase(), category, stage_key, city, province: "", company_type: "PT",
      key_person, key_person_title: title, product, phone: `0812${String(30000000 + i * 7919).slice(0, 8)}`, email: "", website: "", background: "",
      priority, next_action: next, wait_until: null, visit_date: i % 7 === 0 ? dayISO(1) : i % 11 === 3 ? dayISO(0) : null, visit_meet: i % 7 === 0 ? key_person : "", visit_agenda: i % 7 === 0 ? "Presentasi katalog dan penawaran" : "", visit_mode: "offline",
      deal_value: juta * 1000000, deal_date: won ? dayISO(-Math.min(lastContact, Math.max(new Date().getDate() - 1, 0))) : null, tonnage: 0, tonnage_unit: "pcs", last_contact: dayISO(-lastContact), verified: false, source: i % 4 === 0 ? "Instagram" : i % 4 === 1 ? "Referral" : i % 4 === 2 ? "Website" : "Pameran",
      parent_company: "", group_holding: "", created_at: tsISO(-age), updated_at: tsISO(-lastContact), deleted_at: null, latitude: null, longitude: null,
      outcome: won ? { result: "won", reason_category: i % 2 ? "Harga bersaing" : "Respons cepat", reason: "", recorded_at: tsISO(-lastContact) } : lost ? { result: "lost", reason_category: i % 2 ? "Harga" : "Timing", reason: "", recorded_at: tsISO(-lastContact) } : null,
      customer_state: null, progress_notes: progress, progressLog: progress.map((p) => ({ id: p.id, date: p.note_date, text: p.text })).sort((a, b) => (a.date < b.date ? 1 : -1)),
    };
  });
}

export function buildDemo() {
  const tpl = getIndustryTemplate("b2b_general");
  const stages = tpl.stages.map((s, i) => ({ ...s, id: "demo-s" + i, org_id: "demo-org", position: i }));
  const leads = buildLeads(stages);
  const wonKeys = new Set(stages.filter((s) => s.type === "won").map((s) => s.key));
  const deals = leads.filter((l) => wonKeys.has(l.stage_key)).map((l, i) => ({
    id: "demo-d" + (i + 1), lead_id: l.id, lead_name: l.name, deal_date: l.deal_date, deal_value: l.deal_value, tonnage: 0, tonnage_unit: "pcs", chemical: l.product, assigned_to: l.assigned_to,
  }));
  const competitors = [
    { id: "demo-c1", name: "Distributor Kompetitor Makmur", background: "Distributor alat tulis dan kemasan area Jabodetabek", product: "Kertas dan kemasan", notes: "Harga lebih rendah, tetapi pengiriman sering terlambat.", usages: [{ id: "cu1", company: "Dharma Teknik Mandiri", product: "Kemasan karton", price: "Rp14.500 per dus", notes: "Mempertimbangkan pindah vendor." }] },
    { id: "demo-c2", name: "Prima Office Supply", background: "Penyedia perlengkapan kantor korporat", product: "Alat tulis kantor", notes: "Termin pembayaran 60 hari.", usages: [{ id: "cu2", company: "Harapan Jaya Farma", product: "Kardus obat", price: "Rp9.800 per pcs", notes: "Menang karena termin lebih panjang." }] },
  ];
  const mine = (uid) => leads.filter((l) => l.assigned_to === uid);
  const activeKeys = new Set(stages.filter((s) => s.type === "normal").map((s) => s.key));
  const members = MEMBERS.map((m, i) => {
    const own = mine(m.user_id);
    const dealN = own.filter((l) => wonKeys.has(l.stage_key)).length;
    const base = [[3, 9, 4, 5, 2], [6, 11, 4, 5, 2], [4, 9, 2, 3, 2], [2, 6, 3, 2, 1], [0, 0, 0, 0, 0]][i];
    return {
      ...m, visits: base[0], notes: base[1], notes_thin: i === 3 ? 2 : 0, leads_updated: base[1] + 2, new_leads: base[2], stage_moves: base[3], deals: dealN,
      deal_value: own.filter((l) => wonKeys.has(l.stage_key)).reduce((s, l) => s + l.deal_value, 0), last_activity_at: i === 4 ? tsISO(-5) : i === 3 ? tsISO(-1) : tsISO(0, 8 + i),
    };
  });
  const feed = [
    { id: "f1", user_id: "u2", kind: "visit", lead_name: "SINAR ABADI DISTRIBUSI", detail: "", created_at: tsISO(0, 10) },
    { id: "f2", user_id: "u3", kind: "stage", lead_name: "BANK SEJAHTERA MAKMUR", detail: "Sample / Trial → Quotation", created_at: tsISO(0, 9) },
    { id: "f3", user_id: "u2", kind: "note", lead_name: "MITRA LOGISTIK NUSANTARA", detail: "HRD butuh paket untuk 40 supervisor sebelum Q1, minta revisi daftar item.", created_at: tsISO(-1, 16) },
    { id: "f4", user_id: "u4", kind: "lead", lead_name: "DELTA ELEKTRONIK", detail: "", created_at: tsISO(-1, 11) },
    { id: "f5", user_id: "u3", kind: "stage", lead_name: "ELANG DUTA ASIA", detail: "Negosiasi → PO Diterima", created_at: tsISO(-2, 14) },
  ];
  const recs = [
    { id: "demo-l3", name: "KARYA PLASTINDO", urgency: "high", action_type: "WhatsApp", assessment: "Menanyakan termin pembayaran minggu lalu dan belum dijawab. Sample sudah lolos uji, sehingga ini sinyal beli yang kuat.", action: "Jawab pertanyaan termin pembayaran hari ini dan tawarkan termin 30 hari.", steps: ["Hubungi Pak Agus Salim", "Konfirmasi volume bulanan", "Kirim draf kesepakatan"], contact_role: "", talking_point: "Pak Agus, kami sudah siapkan opsi termin 30 hari sesuai pertanyaan kemarin.", customer_state: { interest: "high", intent: "high", risk: "low", objection: "termin pembayaran", decision_maker_known: true, expected_decision_date: null, state_reason: "Sample lolos, tinggal termin." } },
    { id: "demo-l1", name: "SINAR ABADI DISTRIBUSI", urgency: "high", action_type: "Kirim Penawaran", assessment: "Sudah di tahap negosiasi dan spesifikasi disetujui. Menunggu harga final untuk 400 rim per bulan.", action: "Kirim penawaran final beserta jadwal pengiriman.", steps: ["Hitung harga volume 400 rim", "Sertakan jadwal pengiriman", "Minta konfirmasi tanggal PO"], contact_role: "", talking_point: "Pak Hendra, penawaran final sudah kami siapkan sesuai spesifikasi yang disepakati.", customer_state: { interest: "high", intent: "high", risk: "low", objection: "", decision_maker_known: true, expected_decision_date: null, state_reason: "Tinggal harga final." } },
    { id: "demo-l12", name: "DHARMA TEKNIK MANDIRI", urgency: "medium", action_type: "Follow-up", assessment: "Sedang membandingkan dengan Distributor Kompetitor Makmur dan meminta diskon volume.", action: "Kirim perbandingan harga dan keunggulan ketepatan kirim.", steps: ["Susun perbandingan harga", "Tekankan rekam jejak pengiriman"], contact_role: "", talking_point: "Pak Eko, kami siapkan perbandingan agar keputusan Bapak lebih mudah.", customer_state: { interest: "medium", intent: "medium", risk: "medium", objection: "harga kompetitor lebih rendah", decision_maker_known: true, expected_decision_date: null, state_reason: "Membandingkan vendor." } },
    { id: "demo-l22", name: "DELTA ELEKTRONIK", urgency: "medium", action_type: "Kirim Penawaran", assessment: "Meminta sertifikat ESD sebelum melanjutkan quotation bernilai besar.", action: "Kirim sertifikat spesifikasi ESD hari ini.", steps: ["Ambil sertifikat dari tim produk", "Kirim bersama quotation"], contact_role: "", talking_point: "Pak Michael, sertifikat ESD yang Bapak minta sudah kami lampirkan.", customer_state: { interest: "high", intent: "medium", risk: "low", objection: "", decision_maker_known: false, expected_decision_date: null, state_reason: "Butuh sertifikat." } },
    { id: "demo-l2", name: "MAJU BERSAMA SEJAHTERA", urgency: "low", action_type: "Follow-up", assessment: "Quotation dikirim Senin dan menunggu persetujuan owner.", action: "Follow up quotation dengan pesan singkat.", steps: ["Tanyakan apakah ada revisi"], contact_role: "", talking_point: "Bu Lina, apakah ada yang perlu kami sesuaikan dari quotation kemarin?", customer_state: { interest: "medium", intent: "medium", risk: "low", objection: "", decision_maker_known: true, expected_decision_date: null, state_reason: "Menunggu persetujuan." } },
  ];
  const active = leads.filter((l) => activeKeys.has(l.stage_key));
  const advisorRun = {
    id: "demo-run", user_id: "u1", run_date: dayISO(0), ran_at: new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }), audio_url: null, recs,
    stats: { total_active: active.length, overdue_followup: 4, never_contacted: 0, waiting_count: 1, win_rate: 58, total_closed_sample: 12, top_category: "Barang Jadi", top_loss_reason: "Harga", top_win_reason: "Respons cepat" },
  };
  const targetOf = { u2: 150000000, u3: 150000000, u4: 120000000, u5: 80000000 };
  const monthStart = new Date(); monthStart.setDate(1);
  const monthPrefix = monthStart.toISOString().slice(0, 7);
  const targets = MEMBERS.filter((m) => m.role === "sales_rep").map((m) => {
    const own = leads.filter((l) => l.assigned_to === m.user_id);
    const achieved = own.filter((l) => wonKeys.has(l.stage_key) && (l.deal_date || "").startsWith(monthPrefix)).reduce((s, l) => s + l.deal_value, 0);
    const open = own.filter((l) => activeKeys.has(l.stage_key));
    const pipeline = open.reduce((s, l) => s + l.deal_value, 0);
    const forecast = open.filter((l) => l.stage_key === "negosiasi" || l.stage_key === "quotation").reduce((s, l) => s + Math.round(l.deal_value * 0.4), 0);
    return { user_id: m.user_id, target: targetOf[m.user_id] || 0, achieved, forecast, pipeline, open_without_value: 0 };
  });
  const activityDays = Array.from({ length: 7 }, (_, i) => ({ day: dayISO(i - 6), count: [9, 14, 11, 17, 12, 6, 13][i] }));
  const org = { id: "demo-org", name: "PT Contoh Distribusi", owner_user_id: "u1", plan: "enterprise", member_limit: 5, industry: "b2b_general", custom_field_labels: {}, features: { owner_monitor: false } };
  const stageChanges = leads.flatMap((l, i) => (i % 3 === 0 ? [{ lead_id: l.id, from_stage: "prospek", to_stage: l.stage_key, changed_at: tsISO(-((i % 6) + 1)) }] : []));
  return {
    org, settings: { plan: null, community_display_name: "Rina Kusuma", onboarding_level_seen: 2 }, role: "owner", members: MEMBERS, leads, stages, deals, competitors,
    teamActivity: { members, feed }, feed, advisorRun, targets, stageChanges, activityDays,
    catalog: { company_profile: "Distributor perlengkapan kantor dan kemasan untuk perusahaan di Jabodetabek dan Jawa Timur.", products: [{ name: "Kertas HVS 80 gsm", description: "Kertas cetak standar kantor", fit_for: "Perusahaan dengan kebutuhan cetak rutin", price: "Rp52.000 per rim" }, { name: "Kemasan karton custom", description: "Karton ekspor dan food grade", fit_for: "Pabrik makanan dan ekspor", price: "Sesuai volume" }] },
  };
}
