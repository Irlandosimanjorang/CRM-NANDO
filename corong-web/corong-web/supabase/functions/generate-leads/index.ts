// Supabase Edge Function: generate-leads
//
// === ADMIN BYPASS (18 Sep 2026, permintaan Nando) ===
// Akun admin platform (ADMIN_EMAIL) sekarang skip kuota bulanan org sama
// sekali - khusus buat 1 akun ini doang (bukan naikin limit global buat
// semua org Professional), biar Nando bisa testing/pakai bebas tanpa kena
// kuota. Org lain (termasuk org lain yang Nando bukan member-nya) tetep
// kena kuota normal.
//
// === MODEL/TOOL UPGRADE (29 Sep 2026, permintaan Nando: "gimana cara
// tingkatin kemampuan generate leads") ===
// Model dinaikin dari claude-sonnet-4-6 ke claude-sonnet-5-5 (Sonnet
// terbaru per rilis, HARGA SAMA $2/$10 per MTok - jadi ini upgrade kualitas
// TANPA nambah biaya token). Tool web_search juga dinaikin dari versi lama
// (20250305, basic search) ke 20260318 - ini yang punya "dynamic filtering"
// (Claude nyaring hasil search lewat code execution SEBELUM masuk context,
// bukan nelen mentah-mentah semua snippet), efeknya hasil pencarian lebih
// relevan DAN token usage lebih hemat di request yang search-berat kayak
// ini (belasan-puluhan query per run). response_inclusion: "excluded"
// dipasang biar blok server_tool_use/hasil search yang udah "dimakan" sama
// code execution gak ikut di-echo balik ke response (hemat output token,
// gak ngaruh ke hasil akhir karena yang kepake cuma teks JSON final-nya).
//
// === KUOTA PER PENGGUNA (6 Okt 2026, permintaan Nando: "4x per orang") ===
// Kuota 4x/bulan sekarang dihitung per pengguna, bukan per organisasi -
// reserve_lead_gen_slot menerima p_user_id (lead_gen_runs.user_id). Periode
// kuota berlaku 1 bulan sejak pemakaian pertama (tabel quota_periods),
// bukan lagi reset tiap tanggal 1.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const cors = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 10 (dulu 14) - tiap lead sekarang dilengkapi kontaknya otomatis & itu
// biaya per lead, jadi dibatesin (29 Sep 2026, permintaan Nando).
const MAX_LEADS = 10;
// Pencarian ulang kalau hasil baru < 8 (dulu < 6) dan waktu masih cukup.
const RETRY_MIN_THRESHOLD = 8;
// AI diminta lebih banyak calon dari yang disimpan, supaya setelah duplikat
// dibuang masih bisa terisi 10 (6 Okt 2026: AI kasih 9, 2 duplikat -> 7).
const CANDIDATE_TARGET = 14;
const FIRST_PASS_MAX_SEARCH = 12;
const RETRY_PASS_MAX_SEARCH = 6;
// 300 (dulu 40, dan dulu cuma dipakai di pencarian ulang): 6 Okt 2026 org
// dengan ±430 lead PVC cuma dapet 1 lead baru - AI nemuin ulang pabrik yang
// udah ada (Pralon, Maspion, dst) karena pencarian pertama gak dikasih tau
// daftarnya, lalu 9 dari 10 kebuang sebagai duplikat. Sekarang daftar ini
// dikirim sejak pencarian pertama (±6 token per nama, murah).
const MAX_EXCLUDE_NAMES_IN_PROMPT = 300;
const QUOTA_MAX_RUNS = 4;
const HANDLER_HARD_LIMIT_MS = 150 * 1000;
const RESPONSE_MARGIN_MS = 10 * 1000;
const RETRY_TIME_BUDGET_MS = 90 * 1000;
const MAX_PAUSE_CONTINUATIONS = 3;

// Kuota berlaku 1 bulan sejak pemakaian pertama (6 Okt 2026) - tanggal
// terisi kembali diambil dari quota_usage.
async function quotaResetAt(admin, userId, feature) {
  try {
    const { data } = await admin.rpc("quota_usage", { p_user_id: userId, p_feature: feature });
    return data?.reset_at ? new Date(data.reset_at) : null;
  } catch (_) {
    return null;
  }
}
const fmtTanggal = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });

const UNIVERSAL_INSTRUCTIONS = `Kamu riset lead sales B2B/B2C buat bisnis di Indonesia. Cari ${CANDIDATE_TARGET} perusahaan/calon customer yang berpotensi jadi lead (usahakan penuh ${CANDIDATE_TARGET} - sebagian bisa saja sudah ada di database user dan akan disaring), pake web search kamu buat nyari dari:
- Hasil Google Maps yang publik (nama bisnis, alamat, telepon, website)
- Halaman LinkedIn company page & profil personal yang ke-index Google (JANGAN buka linkedin.com langsung, cukup baca cuplikan/snippet hasil pencarian publiknya - sama kayak orang manual search di Google)
- Instagram/TikTok bisnis yang websitenya nyantumin link itu (dari website resmi mereka, bukan buka platform sosmednya langsung)
- Direktori/publikasi resmi instansi pemerintah terkait (Kemenperin, OJK, dst tergantung industri)

CARI KEY PERSON VIA LINKEDIN: buat nemuin nama PIC yang relevan, pake query khusus kayak site:linkedin.com/in "[nama perusahaan]" [jabatan target] - ini bakal nampilin cuplikan publik profil LinkedIn orang yang kerja di perusahaan itu tanpa perlu buka halamannya. Prioritasin 1-2 dari jatah search buat ini per beberapa perusahaan sekaligus (misal gabung 2-3 nama perusahaan dalam 1 query kalau memungkinkan). Kalau gak ketemu di snippet, kosongin key_person - JANGAN NGARANG.

CARI SINYAL "LAGI AKTIF BERKEMBANG": selain profil dasar perusahaan, coba juga cari tanda-tanda mereka lagi berkembang/butuh sesuatu SEKARANG - misal lowongan kerja baru yang dibuka, berita buka cabang/pabrik baru, ekspansi, atau proyek baru yang diumumkan. Ini berlaku buat SEMUA jenis bisnis (dealer buka cabang baru, developer luncurin proyek baru, agen asuransi buka kantor cabang, distributor nambah armada/gudang, dst - bukan cuma manufaktur). Kalau nemu, catet di field growth_signal. Kalau gak nemu, kosongin aja - JANGAN KARANG.

MANFAATIN HALAMAN "DIREKTORI/LISTING" BUAT EFISIENSI: kalau kamu nemu 1 halaman yang nge-listing BANYAK perusahaan sekaligus (misal daftar tenant di 1 kawasan industri, direktori anggota asosiasi, daftar peserta pameran, listing member Kemenperin), itu SUMBER BAGUS - ambil beberapa kandidat dari situ sekaligus, jangan cuma ambil 1 terus search lagi dari nol buat yang lain. Ini jauh lebih efisien dibanding search satu-satu per perusahaan.

KALAU CALON PEMBELI ASLINYA INDIVIDU/PERORANGAN (bukan perusahaan) - misal produk yang dijual itu mobil pribadi, polis asuransi individu, rumah tinggal pribadi, dst: JANGAN cari data pribadi orang per orang (gak etis, gak akurat, dan gak ada sumber publik yang valid buat itu). Sebagai gantinya, cari ORGANISASI/BISNIS yang jadi GERBANG ke banyak calon individu sekaligus, misal: komunitas/klub/asosiasi yang relevan (komunitas mobil, asosiasi profesi), HRD perusahaan (buat program asuransi/benefit grup karyawan), agen/broker yang punya banyak listing calon buyer, developer/dealer/kantor cabang yang bisa diajak kerja sama channel partnership. Dalam kasus ini, "name" diisi nama organisasi/bisnis perantara itu, dan "key_person" diisi PIC di organisasi itu (misal Ketua Komunitas, HRD Manager, Kepala Cabang) - BUKAN nama konsumen individu.

Buat TIAP calon lead, cari (kalau ada, JANGAN karang):
- name: nama perusahaan/organisasi perantara/calon customer (isi nama organisasi PERANTARA kalau targetnya individu, liat instruksi di atas)
- key_person: nama PIC/pemilik/direktur/jabatan target (SERING gak ketemu di sumber publik - kosongin aja kalau emang gak nemu, JANGAN NGARANG NAMA ORANG)
- key_person_title: jabatannya
- website: url resmi - HANYA isi kalau domain resminya muncul di hasil search yang kamu lihat, JANGAN isi dari ingatan/tebakan
- phone: nomor kontak bisnis PIC kalau dipublikasikan publik, kalau gak ada telepon kantor/perusahaan yang tercantum publik - JANGAN nebak
- email: email bisnis PIC kalau tertulis publik, kalau gak ada email resmi perusahaan (HR/karir/umum) yang TERTULIS PERSIS di sumber - JANGAN PERNAH nebak pola email kayak nama@domain
(Kontak yang belum ketemu di tahap ini bakal dilengkapi otomatis di tahap berikutnya dengan buka website resmi tiap perusahaan - jadi fokus utama kamu di sini: perusahaan yang TEPAT + website resminya.)
- city: kota / alamat singkat
- category: jenis industri/usaha
- product: produk/kebutuhan spesifik yang relevan buat lead ini
- source_note: dari mana kamu nemuin info ini (1 kalimat singkat, misal "Google Maps + website resmi")
- growth_signal: 1 kalimat singkat kalau nemu tanda ekspansi/berkembang (lihat instruksi di atas), kosongin kalau gak nemu

SKOR DIPECAH JADI 3 - biar user tau PERSISNYA kenapa suatu lead dapet skor segitu, bukan cuma 1 angka mentah:
- score_industry_match: 1-100, seberapa match industri/jenis usaha lead ini sama target (liat konteks industri di bawah)
- score_contact_quality: 1-100, seberapa lengkap & bisa diandalkan kontaknya (100 = ada semua: telp+email+PIC+website resmi, terverifikasi dari sumber kredibel; makin dikit/makin gak yakin makin rendah)
- score_buying_signal: 1-100, seberapa besar kemungkinan mereka BUTUH BELI produk yang ditawarin SEKARANG (bukan cuma cocok industri doang - pertimbangin skala usaha & growth_signal kalau ada, itu nambah skor ini)
- score: angka 1-100 keseluruhan, cerminan gabungan 3 skor di atas (boleh dirata-ratain atau judgment holistic kalau ada salah satu yang jauh lebih penting)

Balas HANYA JSON array, tanpa markdown, format persis:
[{"name":"...","key_person":"","key_person_title":"","website":"","phone":"","email":"","city":"","category":"","product":"","source_note":"...","growth_signal":"","score_industry_match":0,"score_contact_quality":0,"score_buying_signal":0,"score":0}]

Kalau kamu gak yakin/gak nemu info valid, mending kasih list lebih pendek daripada karang-karang data. Urutkan hasil dari score TERTINGGI ke terendah.`;

const INDUSTRY_TERMS = {
  pvc_chemical: {
    label: "PVC / Kimia (Manufaktur)",
    defaultKeyword: "distributor bahan kimia PVC resin compound Indonesia",
    context: `Industri ini: PVC, kimia, dan plastik. Istilah teknis yang relevan buat ngenalin & nyari calon lead: uPVC, PVC rigid/fleksibel, ekstrusi, ekstruder, injection molding, resin, kompon (compound), plasticizer/ftalat, kalsium karbonat (filler), pipa & fitting, kabel listrik (isolasi PVC), flooring/sheet/film, roofing/ceiling/plafon, foam board/celuka, kulit sintetis & vinyl, selang fleksibel, packaging & botol PVC, SNI (Standar Nasional Indonesia), TKDN (Tingkat Komponen Dalam Negeri), tonase, trader vs manufacturer. Jabatan target lazimnya: Purchasing Manager, Procurement, Direktur Produksi, Owner. Lokasi: pabrik manufaktur biasanya ngumpul di kawasan industri (Cikarang, MM2100, Jababeka, Karawang, Kawasan Industri Sidoarjo/Rungkut, Kawasan Industri Medan, dst) - kalau gak dikasih provinsi spesifik, coba fokus ke kawasan-kawasan ini dulu biar hit rate lebih tinggi ketimbang nyari acak per kota.`,
  },
  automotive: {
    label: "Automotive / Dealer",
    defaultKeyword: "dealer atau bengkel kendaraan Indonesia",
    context: `Industri ini: dealer/bengkel kendaraan (mobil/motor). Istilah teknis yang relevan: dealer resmi, APM (Agen Pemegang Merek), showroom, unit ready stock/indent, test drive, trade-in, leasing/pembiayaan, DP (down payment), tenor cicilan, STNK, BPKB, sparepart OEM vs aftermarket, bengkel resmi, fleet sales, karoseri. CATATAN PENTING: pembeli kendaraan ASLINYA sering individu/perorangan, bukan perusahaan - kalau produk yang dijual user mengarah ke pembeli individu (misal jual mobil retail, bukan armada), CARI GERBANG ke banyak individu sekaligus: komunitas/klub otomotif, koperasi karyawan perusahaan (buat program pembelian kolektif), leasing/multifinance partner, bengkel/showroom lain buat kerja sama channel. Kalau produknya ke arah B2B (fleet/armada, sparepart grosir), baru cari langsung ke perusahaan (Purchasing Manager, Fleet Manager). Lokasi: dealer/showroom/komunitas biasanya ngumpul di jalan protokol/arteri utama kota atau kawasan otomotif (misal Sunter & Kelapa Gading di Jakarta, Soekarno-Hatta di Bandung) - coba fokus ke situ dulu.`,
  },
  property: {
    label: "Property / Real Estate",
    defaultKeyword: "agen properti atau developer Indonesia",
    context: `Industri ini: agen properti/developer/broker. Istilah teknis yang relevan: developer, agen properti/broker, KPR (Kredit Pemilikan Rumah), sertifikat SHM/HGB, PPJB (Perjanjian Pengikatan Jual Beli), listing, booking fee, cluster/perumahan, apartemen/ruko/rukan, akad kredit, notaris/PPAT. CATATAN PENTING: pembeli properti residensial ASLINYA individu/perorangan (keluarga cari rumah), bukan perusahaan - kalau produk yang dijual user ke arah residensial (rumah/apartemen tinggal), CARI GERBANG ke banyak calon pembeli sekaligus: koperasi karyawan perusahaan (buat program KPR kolektif), bank/multifinance partner KPR, agen properti lain buat co-listing, developer lain buat cross-selling. Kalau produknya ke arah komersial (ruko/gudang/kavling industri), baru cari langsung ke perusahaan (Owner, Direktur Ekspansi). Lokasi: developer/agen properti/koperasi biasanya terkonsentrasi di kawasan pengembangan baru (BSD, Alam Sutera, Meikarta, dst) atau CBD kota besar - coba fokus ke situ dulu.`,
  },
  b2b_general: {
    label: "B2B / Distributor Umum",
    defaultKeyword: "distributor atau trading company Indonesia",
    context: `Industri ini: distributor/trading/manufaktur non-kimia. Istilah teknis yang relevan: distributor, trading company, agen tunggal, PO (Purchase Order), quotation/penawaran harga, sample/trial produk, reorder, bahan baku vs barang jadi, supplier, procurement, term of payment (TOP). Jabatan target lazimnya: Purchasing Manager, Procurement, Owner. Lokasi: sesuaikan sama produknya - kalau produk fisik/berat coba fokus ke kawasan pergudangan/industri, kalau jasa/produk ringan coba fokus ke sentra bisnis/perkantoran kota besar.`,
  },
  insurance: {
    label: "Asuransi / Financial Services",
    defaultKeyword: "agen asuransi atau financial services Indonesia",
    context: `Industri ini: asuransi/financial services. Istilah teknis yang relevan: agen asuransi, polis, premi, underwriting, klaim, OJK (Otoritas Jasa Keuangan), unit link, proteksi jiwa/kesehatan, ahli waris/beneficiary, rider, masa pertanggungan, nasabah korporat vs individu. CATATAN PENTING: nasabah asuransi individu (jiwa/kesehatan pribadi) itu perorangan - JANGAN cari data pribadi orang. Cara paling efektif buat volume: cari perusahaan yang butuh EMPLOYEE BENEFIT/asuransi kesehatan karyawan (target: HR Manager/HRD, ini pintu masuk ke BANYAK calon nasabah individu sekaligus lewat 1 perusahaan), atau komunitas/asosiasi profesi (buat program grup). Kalau user emang spesifik jual ke UMKM/owner individu, cari Owner UMKM lewat direktori bisnis, bukan konsumen individu acak. Lokasi: agen/kantor asuransi & kantor korporat biasanya terkonsentrasi di CBD/gedung perkantoran kota besar (Sudirman, Thamrin, dst) - coba fokus ke situ dulu.`,
  },
  retail_fmcg: {
    label: "Retail / FMCG",
    defaultKeyword: "distributor retail FMCG atau toko Indonesia",
    context: `Industri ini: distribusi retail/FMCG. Istilah teknis yang relevan: distributor FMCG, outlet/toko kelontong, minimarket/supermarket, area distribusi, sales force/salesman canvasing, repeat order, karton/dus, sell-in vs sell-out, principal (brand pemilik produk), retail modern vs tradisional. Jabatan target lazimnya: Owner Toko, Purchasing/Buyer, Store Manager. Lokasi: distributor FMCG biasanya terkonsentrasi di kawasan pergudangan distribusi & sentra perdagangan (Glodok, Mangga Dua, pasar grosir, dst) - coba fokus ke situ dulu.`,
  },
  corporate_consultant: {
    label: "Corporate Consultant",
    defaultKeyword: "perusahaan yang butuh konsultan bisnis Indonesia",
    context: `Industri ini: konsultan/kontraktor jasa berbasis project buat perusahaan (strategi/manajemen/hukum/pajak/HR/keuangan/IT), SPK/kontrak kerja. Istilah teknis yang relevan: SPK (Surat Perintah Kerja), scope of work, quotation, termin pembayaran, invoice, kickoff, deliverable, RFP (Request for Proposal), decision maker. Jabatan target lazimnya: Direktur, CEO, CFO, atau Head of Legal/HR. Lokasi: kantor korporat biasanya terkonsentrasi di CBD/gedung perkantoran kota besar (Sudirman, Thamrin, dst) - coba fokus ke situ dulu.`,
  },
};
const DEFAULT_INDUSTRY = "pvc_chemical";
function getIndustryTerms(key) {
  return INDUSTRY_TERMS[key] || INDUSTRY_TERMS[DEFAULT_INDUSTRY];
}

function normalizeCompanyName(raw) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/\b(pt|cv|ud|tbk|persero)\b\.?/g, " ")
    .replace(/[.,\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
// Skor keseluruhan = rumus pasti (6 Okt 2026, permintaan Nando): 40% sinyal
// beli + 35% kecocokan industri + 25% kelengkapan kontak. Sebelumnya skor
// besar ditebak AI sebelum kontak dilengkapi dan tidak pernah dihitung ulang,
// jadi bisa lebih rendah dari ketiga komponennya. null = komponen AI tidak ada.
function overallScore(industry, buying, contact) {
  const n = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));
  const ind = n(industry), buy = n(buying), con = n(contact);
  if (!Number.isFinite(ind) || !Number.isFinite(buy)) return null;
  const c = Number.isFinite(con) ? con : 0;
  return Math.max(1, Math.min(100, Math.round(0.4 * buy + 0.35 * ind + 0.25 * c)));
}

// Kata umum yang sendirian bukan nama perusahaan - lead lama bernama
// "Company"/"Indonesia" gak boleh bikin semua kandidat berisi kata itu
// dianggap duplikat.
const GENERIC_NAME_WORDS = new Set(["company", "indonesia", "group", "grup", "industri", "industry", "industries", "plastik", "plastic", "international", "internasional", "jaya", "abadi", "makmur", "sejahtera", "mandiri", "utama", "persada", "perkasa", "sentosa", "sukses", "pabrik", "pvc", "upvc", "manufacturing", "trading", "corporation", "corp"]);
const isGenericName = (norm) => norm.split(" ").every((w) => GENERIC_NAME_WORDS.has(w));
// Cocok per kata utuh (bukan potongan huruf): "pralon" cocok dengan "pipa
// pralon", tapi "indo" tidak cocok dengan "indofood".
const containsWords = (hay, needle) => (" " + hay + " ").includes(" " + needle + " ");
function isDuplicateName(candidateNorm, existingNormSet) {
  if (!candidateNorm) return false;
  if (existingNormSet.has(candidateNorm)) return true;
  if (candidateNorm.length < 6 || isGenericName(candidateNorm)) return false;
  for (const ex of existingNormSet) {
    if (ex.length < 6 || isGenericName(ex)) continue;
    if (containsWords(candidateNorm, ex) || containsWords(ex, candidateNorm)) return true;
  }
  return false;
}

// Ambil array lead dari jawaban AI. Kalau jawaban terpotong di tengah
// (array tidak tertutup), objek yang sudah lengkap tetap dipakai.
function parseLeadArray(textOut) {
  const x = textOut.replace(/```json/gi, "").replace(/```/g, "").trim();
  // Awal array lead = "[" yang langsung diikuti "{" (teks pengantar bisa
  // memuat "[" lain).
  let a = x.search(/\[\s*\{/);
  if (a === -1) a = x.indexOf("[");
  if (a === -1) return [];
  const e = x.lastIndexOf("]");
  if (e > a) {
    try {
      const all = JSON.parse(x.slice(a, e + 1));
      if (Array.isArray(all)) return all;
    } catch (_) { /* lanjut ke penyelamatan per objek */ }
  }
  const out = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = a + 1; i < x.length; i++) {
    const ch = x[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") inStr = false;
      continue;
    }
    if (ch === "\"") inStr = true;
    else if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start !== -1) {
        try { out.push(JSON.parse(x.slice(start, i + 1))); } catch (_) { /* objek rusak dilewati */ }
        start = -1;
      }
    }
  }
  return out;
}

async function callAiForLeads({ industryTerms, keyword, province, targetRole, productSold, sellerCatalog, companyScale, targetType, wonExamples, lostExamples, orgMemoryProfile, excludeNames, maxSearchUses, passLabel, signal }) {
  let userRequest = `Kata kunci pencarian: "${keyword}"${province ? ` di ${province}, Indonesia (bisa nama provinsi atau kota spesifik - kalau ini nama kota, FOKUSIN ke kota itu aja, jangan diperluas ke provinsi sekitarnya)` : ` - CARI DI SELURUH INDONESIA (gak dikasih batasan provinsi/kota spesifik, jadi jangan sempitin sendiri ke 1 daerah aja, coba variasiin kota/wilayah biar hasilnya nyebar).`}.`;
  userRequest += ` Kalau kata kunci di atas NYEBUT NAMA PERUSAHAAN SPESIFIK (misal "seperti Halodoc, Gojek"), perusahaan yang disebut itu JUGA WAJIB dimasukin sebagai lead (kecuali ada di daftar "udah ada di database" di bawah) - itu target, bukan cuma contoh. Sisanya diisi perusahaan lain yang profilnya mirip.`;
  if (productSold) {
    userRequest += ` User ini jualan/nawarin: "${productSold}". JANGAN cari sesama penjual/kompetitor produk itu - cari perusahaan/calon customer yang KEMUNGKINAN BUTUH BELI produk itu buat operasional/produksi mereka. Contoh logika: kalau user jual resin PVC, carilah pabrik yang MEMPRODUKSI barang berbahan PVC (pipa, kabel, dll) sebagai calon pembeli, bukan sesama penjual resin.`;
  }
  if (sellerCatalog) {
    userRequest += ` KATALOG RESMI PERUSAHAAN USER (penjual): ${sellerCatalog} Pake ini buat nentuin calon pembeli yang tepat - utamain perusahaan yang cocok sama kolom "cocok untuk" di katalog. JANGAN cari sesama penjual produk-produk ini.${productSold ? " Kalau user nyebut produk spesifik di atas, fokus ke produk itu." : ""}`;
  }
  if (targetType === "individual") {
    userRequest += ` TARGET PEMBELI EKSPLISIT DARI USER: INDIVIDU/PERORANGAN (bukan perusahaan). WAJIB ikutin instruksi "kalau calon pembeli aslinya individu" di atas - JANGAN cari data pribadi orang satu-satu, WAJIB cari ORGANISASI PERANTARA (HRD perusahaan, komunitas/asosiasi, agen/broker, koperasi, dst) yang punya akses ke banyak calon individu sekaligus. Ini instruksi EKSPLISIT dari user, bukan tebakan kamu - jangan malah cari perusahaan sebagai calon pembeli langsung.`;
  } else if (targetType === "company") {
    userRequest += ` TARGET PEMBELI EKSPLISIT DARI USER: PERUSAHAAN/ORGANISASI LANGSUNG (bukan individu/perorangan). Cari perusahaan yang BENERAN butuh beli produk ini buat operasional/produksi/penggunaan mereka sendiri - JANGAN dialihkan ke organisasi perantara buat individu walau produknya keliatan biasa dijual ke individu, user udah eksplisit bilang targetnya perusahaan.`;
  }
  if (targetRole) {
    userRequest += ` Jabatan/peran yang PALING diprioritasin buat dicari sebagai key_person: "${targetRole}" - fokusin query LinkedIn ke jabatan ini.`;
  } else {
    userRequest += ` Kalau gak dikasih jabatan spesifik, cari jabatan yang lazim buat industri ini (liat konteks industri di atas).`;
  }
  if (companyScale) {
    userRequest += ` TARGET SKALA PERUSAHAAN: "${companyScale}". Prioritasin lead yang skalanya kira-kira segitu (liat dari jumlah cabang, ukuran fasilitas, atau info lain yang ke-indikasi) - jangan terlalu jauh dari skala ini.`;
  }
  if (orgMemoryProfile) {
    userRequest += ` IDEAL CUSTOMER PROFILE ORG INI (disintesis dari SELURUH histori deal yang udah closed, bukan cuma contoh di bawah): ${orgMemoryProfile} Pake ini buat ngarahin pencarian & naikin score_buying_signal buat lead yang cocok sama profil ini.`;
  }
  if (wonExamples && wonExamples.length > 0) {
    const examplesText = wonExamples.map((w) => `"${w.name}"${w.category ? ` (${w.category}${w.product ? ` - ${w.product}` : ""})` : ""}`).join("; ");
    userRequest += ` CONTOH KONKRET - ini perusahaan yang UDAH PERNAH closing/deal beneran sama user, jadiin acuan buat nyari yang PROFILNYA MIRIP (skala usaha, jenis produk yang mereka butuhin, dst): ${examplesText}. Lead baru yang mirip profil sama contoh-contoh ini harusnya dapet score_buying_signal lebih tinggi.`;
  }
  if (lostExamples && lostExamples.length > 0) {
    const lostText = lostExamples.map((w) => {
      const alasan = w.outcome?.reason_category || w.outcome?.reason || "";
      return `"${w.name}"${w.category ? ` (${w.category})` : ""}${alasan ? ` - gagal closing karena: ${alasan}` : ""}`;
    }).join("; ");
    userRequest += ` CONTOH YANG PERNAH GAGAL CLOSING - hindari nyari profil yang mirip banget sama ini kalau memungkinkan, atau kalau tetep disaranin, kasih score_buying_signal yang lebih hati-hati: ${lostText}.`;
  }
  userRequest += ` Kamu dikasih jatah MAKS ${maxSearchUses} kali web search buat pencarian ini - gabungin beberapa target jadi 1 query yang efisien, JANGAN search terpisah 1x per perusahaan atau 1x per platform.`;
  if (excludeNames && excludeNames.length > 0) {
    const list = excludeNames.slice(0, MAX_EXCLUDE_NAMES_IN_PROMPT).join(", ");
    userRequest += ` PENTING: perusahaan-perusahaan ini UDAH ketemu/udah ada di database, JANGAN disaranin lagi: ${list}. Cari yang BENER-BENER beda dari daftar itu - coba perluas ke sub-kategori lain atau area/kota terdekat yang masih relevan.`;
  }

  const callStartedAt = Date.now();
  // Server tool web_search bisa berhenti di tengah dengan stop_reason
  // "pause_turn" (turn search yang panjang) - kalau gak dilanjutin, JSON
  // final-nya gak pernah keluar dan hasilnya 0 lead tanpa error jelas.
  const messages = [{ role: "user", content: userRequest }];
  let dat = null;
  for (let attempt = 0; attempt <= MAX_PAUSE_CONTINUATIONS; attempt++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        // 16000 (dulu 4500): Sonnet 5.5 memakai sebagian jatah output untuk
        // berpikir & menyaring hasil pencarian - 6 Okt 2026 jawaban terpotong
        // (stop_reason max_tokens) sebelum daftar JSON selesai -> 0 lead.
        max_tokens: 16000,
        system: [
          { type: "text", text: UNIVERSAL_INSTRUCTIONS, cache_control: { type: "ephemeral" } },
          { type: "text", text: `Konteks industri (${industryTerms.label}): ${industryTerms.context}`, cache_control: { type: "ephemeral" } },
        ],
        messages,
        tools: [{ type: "web_search_20260318", name: "web_search", max_uses: maxSearchUses, response_inclusion: "excluded" }],
      }),
      signal,
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`AI gagal: ${resp.status} ${errText.slice(0, 200)}`);
    }
    dat = await resp.json();
    console.log(`[generate-leads] ${passLabel} call#${attempt + 1} stop_reason=${dat.stop_reason} USAGE:`, JSON.stringify(dat.usage));
    if (dat.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: dat.content });
  }
  console.log(`[generate-leads] ${passLabel} selesai dalam ${Date.now() - callStartedAt}ms`);
  const textOut = (dat?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  if (dat?.stop_reason === "max_tokens") console.log(`[generate-leads] ${passLabel} jawaban terpotong (max_tokens), ambil lead yang sudah lengkap`);
  return parseLeadArray(textOut).filter((l) => l && l.name);
}

async function runGeneration({ jobId, orgId, userId, industryTerms, keyword, province, targetRole, productSold, sellerCatalog, companyScale, targetType }) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const startedAt = Date.now();

  const failJob = async (message) => {
    await admin.from("lead_gen_jobs").update({ status: "failed", error_message: message, updated_at: new Date().toISOString() }).eq("id", jobId);
  };

  try {
    const runId = crypto.randomUUID();
    const runStartedAt = new Date().toISOString();

    const [{ data: existingLeads }, { data: existingGen }] = await Promise.all([
      admin.from("leads").select("name").eq("org_id", orgId).order("created_at", { ascending: false }),
      admin.from("generated_leads").select("name").eq("org_id", orgId).order("created_at", { ascending: false }),
    ]);
    const existingRawNames = [...(existingLeads || []), ...(existingGen || [])].map((r) => r.name).filter(Boolean);
    const existingNormSet = new Set(existingRawNames.map(normalizeCompanyName).filter(Boolean));

    let wonExamples = [];
    try {
      const { data: wonStages } = await admin.from("stages").select("key").eq("org_id", orgId).eq("type", "won");
      const wonKeys = (wonStages || []).map((s) => s.key);
      if (wonKeys.length > 0) {
        const { data: wonLeads } = await admin
          .from("leads")
          .select("name, category, product")
          .eq("org_id", orgId)
          .in("stage_key", wonKeys)
          .order("created_at", { ascending: false })
          .limit(5);
        wonExamples = wonLeads || [];
      }
    } catch (_) {
      wonExamples = [];
    }

    let lostExamples = [];
    try {
      const { data: lostStages } = await admin.from("stages").select("key").eq("org_id", orgId).eq("type", "lost");
      const lostKeys = (lostStages || []).map((s) => s.key);
      if (lostKeys.length > 0) {
        const { data: lostLeads } = await admin
          .from("leads")
          .select("name, category, outcome")
          .eq("org_id", orgId)
          .in("stage_key", lostKeys)
          .order("created_at", { ascending: false })
          .limit(5);
        lostExamples = lostLeads || [];
      }
    } catch (_) {
      lostExamples = [];
    }

    let orgMemoryProfile = "";
    try {
      const { data: orgMem } = await admin.from("org_memory").select("ideal_customer_profile").eq("org_id", orgId).maybeSingle();
      orgMemoryProfile = orgMem?.ideal_customer_profile || "";
    } catch (_) {
      orgMemoryProfile = "";
    }

    const pass1Raw = await callAiForLeads({ industryTerms, keyword, province, targetRole, productSold, sellerCatalog, companyScale, targetType, wonExamples, lostExamples, orgMemoryProfile, excludeNames: [...new Set(existingRawNames)], maxSearchUses: FIRST_PASS_MAX_SEARCH, passLabel: "pass1" });
    const rank = (l) => overallScore(l.score_industry_match, l.score_buying_signal, l.score_contact_quality) ?? (Number(l.score) || 0);
    const byScore = (a, b) => rank(b) - rank(a);
    let survivors = pass1Raw.filter((l) => !isDuplicateName(normalizeCompanyName(l.name), existingNormSet)).sort(byScore).slice(0, MAX_LEADS);
    let dedupedCount = pass1Raw.length - survivors.length;
    console.log(`[generate-leads] pass1: ${pass1Raw.length} hasil AI, ${dedupedCount} dilewati (sudah ada), ${survivors.length} baru`);
    let retried = false;

    const elapsedAfterPass1 = Date.now() - startedAt;
    const remainingSafeBudget = HANDLER_HARD_LIMIT_MS - elapsedAfterPass1 - RESPONSE_MARGIN_MS;
    if (survivors.length < RETRY_MIN_THRESHOLD && survivors.length < MAX_LEADS && elapsedAfterPass1 < RETRY_TIME_BUDGET_MS && remainingSafeBudget > 20000) {
      retried = true;
      const survivorNormSet = new Set(survivors.map((l) => normalizeCompanyName(l.name)));
      const excludeForRetry = [...existingRawNames, ...survivors.map((l) => l.name)];
      const abortController = new AbortController();
      const abortTimer = setTimeout(() => abortController.abort(), remainingSafeBudget);
      try {
        const pass2Raw = await callAiForLeads({ industryTerms, keyword, province, targetRole, productSold, sellerCatalog, companyScale, targetType, wonExamples, lostExamples, orgMemoryProfile, excludeNames: excludeForRetry, maxSearchUses: RETRY_PASS_MAX_SEARCH, passLabel: "pass2(retry)", signal: abortController.signal });
        for (const l of pass2Raw) {
          if (survivors.length >= MAX_LEADS) break;
          const norm = normalizeCompanyName(l.name);
          if (isDuplicateName(norm, existingNormSet) || isDuplicateName(norm, survivorNormSet)) {
            dedupedCount++;
            continue;
          }
          survivors.push(l);
          survivorNormSet.add(norm);
        }
        survivors.sort(byScore);
      } catch (e) {
        console.log(`[generate-leads] pass2 dibatalkan/gagal (${String(e)}), pakai hasil pass1 aja (${survivors.length} lead)`);
      } finally {
        clearTimeout(abortTimer);
      }
    } else if (survivors.length < RETRY_MIN_THRESHOLD && survivors.length < MAX_LEADS) {
      console.log(`[generate-leads] skip retry pass - pass 1 udah makan ${elapsedAfterPass1}ms / sisa budget aman ${remainingSafeBudget}ms, gak nyisa cukup buat pass 2`);
    }

    const leads = survivors;

    if (leads.length === 0) {
      const msg = dedupedCount > 0
        ? `Semua ${dedupedCount} hasil sudah ada di daftar lead Anda${retried ? " (pencarian ulang juga sudah dicoba)" : ""}. Silakan coba kata kunci atau kota lain untuk mendapatkan hasil baru.`
        : "Tidak ditemukan lead yang sesuai. Silakan coba kata kunci lain.";
      await failJob(msg);
      return;
    }

    const rows = leads.map((l) => ({
      org_id: orgId, created_by: userId,
      run_id: runId, run_started_at: runStartedAt,
      name: l.name, key_person: l.key_person || "", key_person_title: l.key_person_title || "",
      website: l.website || "", phone: l.phone || "", email: l.email || "", city: l.city || "",
      category: l.category || "", product: l.product || "", source_note: l.source_note || "",
      growth_signal: l.growth_signal || "",
      score_industry_match: Number.isFinite(l.score_industry_match) ? Math.max(1, Math.min(100, Math.round(l.score_industry_match))) : null,
      score_contact_quality: Number.isFinite(l.score_contact_quality) ? Math.max(1, Math.min(100, Math.round(l.score_contact_quality))) : null,
      score_buying_signal: Number.isFinite(l.score_buying_signal) ? Math.max(1, Math.min(100, Math.round(l.score_buying_signal))) : null,
      score: overallScore(l.score_industry_match, l.score_buying_signal, l.score_contact_quality) ?? (Number.isFinite(l.score) ? Math.max(1, Math.min(100, Math.round(l.score))) : 50),
      enrich_status: "pending",
      enrich_started_at: new Date().toISOString(),
    }));
    const { data: inserted, error: insErr } = await admin.from("generated_leads").insert(rows).select("id");
    if (insErr) {
      await failJob(insErr.message);
      return;
    }

    // Lengkapi kontak tiap lead OTOMATIS & PARALEL - lewat pg_net biar tiap
    // lead jalan di invocation enrich-generated-lead sendiri (batas waktu
    // masing-masing), gak numpuk di sisa waktu function ini. Frontend nunggu
    // semua enrich_status beres baru bilang "selesai".
    const ids = (inserted || []).map((r) => r.id);
    const { error: dispatchErr } = await admin.rpc("dispatch_lead_enrichment", { p_ids: ids, p_secret: CRON_SECRET });
    if (dispatchErr) {
      console.log("[generate-leads] dispatch enrichment gagal:", dispatchErr.message);
      await admin.from("generated_leads").update({ enrich_status: "failed" }).in("id", ids);
    }

    await admin.from("lead_gen_jobs").update({ status: "done", run_id: runId, result_count: rows.length, updated_at: new Date().toISOString() }).eq("id", jobId);

    console.log(`[generate-leads] total selesai dalam ${Date.now() - startedAt}ms, ${rows.length} lead, retried=${retried}`);
  } catch (e) {
    console.log(`[generate-leads] FATAL (background) setelah ${Date.now() - startedAt}ms:`, String(e));
    try { await failJob(String(e).slice(0, 500)); } catch (_) { /* jangan sampe cleanup gagal nge-crash */ }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Belum login" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;
    const isAdmin = !!ADMIN_EMAIL && userData.user.email === ADMIN_EMAIL;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: memberRow } = await admin.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
    if (!memberRow) return new Response(JSON.stringify({ error: "Organisasi tidak ditemukan" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    const orgId = memberRow.org_id;

    const { data: orgRow } = await admin.from("organizations").select("industry, plan").eq("id", orgId).maybeSingle();
    const industryKey = orgRow?.industry || DEFAULT_INDUSTRY;
    const industryTerms = getIndustryTerms(industryKey);

    const { data: settingsRow } = await admin.from("settings").select("plan").eq("user_id", userId).maybeSingle();
    const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const myPlanLevel = orgRow?.plan === "enterprise" ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
    if (!isAdmin && myPlanLevel < 2) {
      return new Response(JSON.stringify({ error: "Generate Leads AI tersedia untuk paket Professional ke atas. Silakan upgrade melalui tab Pengaturan." }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // ---- KUOTA BULANAN PER PENGGUNA - admin platform (ADMIN_EMAIL) skip sama
    // sekali, pengguna lain kena kuota normal 4x/bulan per orang.
    let reservedRunId = null;
    if (!isAdmin) {
      const { data: reserved, error: reserveErr } = await admin.rpc("reserve_lead_gen_slot", { p_org_id: orgId, p_max: QUOTA_MAX_RUNS, p_user_id: userId });
      if (reserveErr) {
        return new Response(JSON.stringify({ error: "Gagal cek kuota: " + reserveErr.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
      }
      if (!reserved) {
        const nextAt = await quotaResetAt(admin, userId, "generate-leads");
        return new Response(JSON.stringify({ error: `Kuota Generate Leads Anda (${QUOTA_MAX_RUNS}x per bulan) sudah terpakai. Kuota terisi kembali pada ${nextAt ? fmtTanggal(nextAt) : "1 bulan setelah pemakaian pertama"}.`, next_available_at: nextAt ? nextAt.toISOString() : null }), { status: 429, headers: { ...cors, "Content-Type": "application/json" } });
      }
      reservedRunId = reserved;
    }

    const body = await req.json().catch(() => ({}));
    const keyword = (body.keyword || "").trim() || industryTerms.defaultKeyword;
    const province = (body.province || "").trim();
    const targetRole = (body.targetRole || "").trim();
    const productSold = (body.productSold || "").trim();
    const companyScale = (body.companyScale || "").trim();
    const targetType = ["company", "individual"].includes(body.targetType) ? body.targetType : "";

    const { data: jobRow, error: jobErr } = await admin.from("lead_gen_jobs").insert({
      org_id: orgId, created_by: userId, status: "running",
      params: { keyword, province, targetRole, productSold, companyScale, targetType },
    }).select("id").single();
    if (jobErr || !jobRow) {
      if (reservedRunId) await admin.rpc("release_lead_gen_slot", { p_run_id: reservedRunId });
      return new Response(JSON.stringify({ error: "Gagal mulai proses generate: " + (jobErr?.message || "unknown") }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const jobId = jobRow.id;

    // Katalog produk (30 Sep 2026, Enterprise) - biar AI tau persis produk
    // yang dijual org ini & siapa calon pembelinya.
    let sellerCatalog = "";
    if (orgRow?.plan === "enterprise") {
      const { data: catalog } = await admin.from("org_product_catalog").select("company_profile, products").eq("org_id", orgId).maybeSingle();
      const products = (Array.isArray(catalog?.products) ? catalog.products : []).filter((p) => p?.name).slice(0, 8);
      if (products.length) {
        sellerCatalog = `${catalog.company_profile ? `Profil: ${catalog.company_profile}. ` : ""}Produk: ${products.map((p) => `${p.name}${p.fit_for ? ` (cocok untuk: ${p.fit_for})` : ""}`).join("; ")}.`;
      }
    }

    await runGeneration({ jobId, orgId, userId, industryTerms, keyword, province, targetRole, productSold, sellerCatalog, companyScale, targetType });

    const { data: finalJob } = await admin.from("lead_gen_jobs").select("status, result_count, error_message, run_id").eq("id", jobId).maybeSingle();
    if (finalJob?.status === "failed") {
      if (reservedRunId) await admin.rpc("release_lead_gen_slot", { p_run_id: reservedRunId });
      return new Response(JSON.stringify({ error: finalJob.error_message || "Gagal generate lead." }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ ok: true, count: finalJob?.result_count ?? 0, job_id: jobId, run_id: finalJob?.run_id || null }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.log(`[generate-leads] FATAL (sinkron):`, String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
