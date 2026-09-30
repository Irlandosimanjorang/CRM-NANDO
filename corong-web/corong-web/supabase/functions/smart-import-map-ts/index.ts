// Supabase Edge Function: smart-import-map
// Bantu import Excel/CSV yang formatnya ga standar (header aneh, atau ga ada
// header sama sekali). AI baca BEBERAPA BARIS CONTOH doang, tentuin kolom
// keberapa isinya apa (nama lead, kontak, key person, dll). Hasil pemetaan
// itu dipake client buat proses SEMUA baris - jadi cuma 1x panggilan AI per
// import, bukan per baris (hemat & cepat walau filenya ribuan baris).
//
// Kuota: Free 1x seumur hidup, Standard+ 8x/bulan WIB, admin platform
// (ADMIN_EMAIL) bebas kuota.
//
// === AUDIT ISTILAH INDUSTRI (30 Sep 2026) ===
// corporate_consultant sebelumnya gak ada di INDUSTRY_CONTEXT (jatuh ke
// konteks PVC) - ditambahin. Fallback org tanpa industri jadi B2B umum.
// Pesan error ke user pakai bahasa baku.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const EPOCH_START_ISO = new Date(0).toISOString();

function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS);
}

function parseObj(t) {
  let x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = x.indexOf("{"); if (a !== -1) x = x.slice(a);
  const end = x.lastIndexOf("}");
  if (end !== -1) { try { return JSON.parse(x.slice(0, end + 1)); } catch (_) {} }
  return null;
}

async function checkRateLimitPerUserMonthly(admin, userId, functionName, maxCalls) {
  const windowStart = wibMonthStartUTC().toISOString();
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: windowStart, p_max_calls: maxCalls });
  if (error) { console.error("[smart-import-map] reserve_edge_function_call gagal:", error); return false; }
  return !!data;
}

async function checkRateLimitAllTime(admin, userId, functionName, maxCalls) {
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: EPOCH_START_ISO, p_max_calls: maxCalls });
  if (error) { console.error("[smart-import-map] reserve_edge_function_call (all-time) gagal:", error); return false; }
  return !!data;
}

// Konteks singkat per industri - duplikat ringan dari src/lib/industryTemplates.js.
// Nyebut eksplisit apakah leads biasanya PERUSAHAAN atau PERORANGAN.
const INDUSTRY_CONTEXT = {
  pvc_chemical: "distribusi/manufaktur PVC dan bahan kimia industri (B2B - leads-nya PERUSAHAAN/institusi)",
  automotive: "dealer kendaraan (mobil/motor) - leads-nya biasanya PERORANGAN (calon pembeli unit), kadang perusahaan (fleet/corporate)",
  property: "agen/developer properti - leads-nya biasanya PERORANGAN (calon pembeli rumah/unit)",
  b2b_general: "distributor/trading B2B umum - leads-nya PERUSAHAAN",
  insurance: "agen asuransi/financial services - leads-nya biasanya PERORANGAN (calon nasabah/tertanggung)",
  retail_fmcg: "distribusi retail/FMCG - leads-nya outlet/toko (semi-B2B), kadang perorangan",
  corporate_consultant: "konsultan/kontraktor jasa berbasis project - leads-nya PERUSAHAAN/instansi klien (kolom produk biasanya berisi scope jasa/project)",
};
function industryContext(key) { return INDUSTRY_CONTEXT[key] || INDUSTRY_CONTEXT.b2b_general; }

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "https://nexto.site",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
    const isAdmin = !!ADMIN_EMAIL && userData.user.email === ADMIN_EMAIL;

    const { data: gateMemberRow } = await supabase.from("organization_members").select("org_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
    const gateOrgResult = gateMemberRow ? await supabase.from("organizations").select("plan, industry").eq("id", gateMemberRow.org_id).maybeSingle() : { data: null };
    const { data: gateSettingsRow } = await supabase.from("settings").select("plan").eq("user_id", userData.user.id).maybeSingle();
    const GATE_PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const gateIsEnterprise = gateOrgResult.data?.plan === "enterprise";
    const gateMyPlanLevel = gateIsEnterprise ? 2 : (GATE_PLAN_LEVEL[gateSettingsRow?.plan] ?? 0);
    const industryKey = gateOrgResult.data?.industry || "b2b_general";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    if (!isAdmin) {
      if (gateMyPlanLevel < 1) {
        const rateLimitOk = await checkRateLimitAllTime(admin, userData.user.id, "smart-import-map-ts", 1);
        if (!rateLimitOk) {
          return new Response(JSON.stringify({ error: "Smart Import AI di paket Free hanya dapat dipakai 1x, dan jatah tersebut sudah terpakai. Upgrade ke Standard untuk memakainya lagi (8x/bulan), atau petakan kolom secara manual." }), { status: 429, headers: cors });
        }
      } else {
        const rateLimitOk = await checkRateLimitPerUserMonthly(admin, userData.user.id, "smart-import-map-ts", 8);
        if (!rateLimitOk) {
          return new Response(JSON.stringify({ error: "Kuota Smart Import AI (8x/bulan) sudah terpakai. Silakan coba lagi bulan depan, atau petakan kolom secara manual." }), { status: 429, headers: cors });
        }
      }
    }

    const { sampleRows } = await req.json();
    if (!Array.isArray(sampleRows) || sampleRows.length === 0) {
      return new Response(JSON.stringify({ error: "sampleRows kosong" }), { status: 400, headers: cors });
    }

    const prompt = `Kamu ahli data cleaning. Di bawah ini contoh beberapa baris pertama dari file Excel/CSV berisi data leads/customer buat CRM di bisnis ${industryContext(industryKey)}. PENTING: field "name" (lead) di sini BISA NAMA PERUSAHAAN/INSTANSI ATAU NAMA ORANG PERORANGAN, tergantung konteks industri di atas - JANGAN asumsi selalu harus ada kata "company"/"perusahaan" di headernya, header bisa aja cuma "Name"/"Customer"/"Nasabah"/"Nama" polos. Formatnya bisa macam-macam dan SERING BERLAPIS:
- Kadang ada baris JUDUL BESAR duluan (cuma 1 kolom keisi, contoh: "Sales Daily Visit Report Tracker")
- Baru setelah itu baris HEADER kolom asli (contoh: "Date, Salesperson, Company Name, Website, ..." atau "Nama, No HP, Kota, ...")
- Kadang setelah header ada baris CONTOH/TEMPLATE/PLACEHOLDER yang BUKAN data asli (contoh isinya: "yyyy-mm-dd", "PT XXX", "Mr/Ms XXX", "Name") - ini instruksi cara isi, bukan data beneran, HARUS dilewatin
- Baru setelah semua itu, DATA ASLI dimulai
Kadang juga simpel: header langsung di baris 1, data langsung di baris 2. Kamu harus jeli baca tiap baris contoh dan bedain mana judul/instruksi/placeholder vs data asli.

PALING PENTING - JEBAKAN yang sering salah: JANGAN pilih kolom yang MENJELASKAN ATRIBUT/DATA TENTANG lead itu (misal daftar produk yang mereka beli, tipe, kategori, ID, status) sebagai "name", WALAUPUN headernya kebetulan mengandung kata "customer"/"client"/"nama". Contoh nyata yang PERNAH SALAH: header "Customer Products" isinya daftar produk yang dibeli customer - ITU BUKAN NAMA, jangan pernah pilih ini. Field "name" HARUS kolom yang isinya IDENTITAS lead itu sendiri (nama perusahaan atau nama orang), BUKAN kolom yang mendeskripsikan sesuatu MILIK/TENTANG mereka. Kalau ada kolom berjudul persis "Company"/"Customer"/"Client"/"Perusahaan"/"Nama" (polos, tanpa kata tambahan setelahnya seperti "Products"/"Type"/"ID"/"Status"), itu HAMPIR PASTI kolom "name" yang benar - prioritaskan itu di atas kolom lain yang cuma "kebetulan mirip".

Data mentah (tiap baris = array isi kolomnya, index baris & kolom dari 0):
${JSON.stringify(sampleRows)}

Tugas kamu:
1. Tentuin index kolom (0-based) buat tiap field berikut, KALAU ada datanya. Kalau field itu ga ketemu di data sama sekali, isi null. Field "name" WAJIB ketemu (nama lead - perusahaan ATAU orang perorangan, sesuai konteks industri di atas dan aturan JEBAKAN di atas), kalau ga ketemu berarti data ini bukan data leads.
2. Tentuin di INDEX BARIS keberapa (0-based, dari data mentah di atas) DATA ASLI PERTAMA dimulai - setelah ngelewatin baris judul, header, dan/atau baris contoh/placeholder kalau ada.

Field yang dicari: name (nama lead - perusahaan/institusi ATAU orang perorangan, LIHAT ATURAN JEBAKAN DI ATAS), category, company_type, email, phone (nomor telepon/WA), key_person (nama kontak/PIC - beda dari "name" kalau leads-nya perusahaan; kosongkan/null kalau leads-nya udah perorangan sama kayak "name"), key_person_title (jabatan), product (produk/jasa yang dibeli/diminati - INI tempat yang bener buat kolom kayak "Customer Products", bukan di "name"), city, province, website, background, notes (catatan/keterangan/riwayat kontak/hasil follow-up terakhir - kolom bebas kalau ada, BEDA dari "background" yang lebih ke profil/latar belakang perusahaan).

Balas HANYA JSON, tanpa markdown, tanpa penjelasan tambahan, persis format ini:
{"mapping": {"name": 4, "category": null, "company_type": null, "email": null, "phone": null, "key_person": 8, "key_person_title": 9, "product": 10, "city": 6, "province": null, "website": 5, "background": 14, "notes": null}, "data_start_row": 3}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 600, thinking: { type: "between_tools" }, output_config: { effort: "medium" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) return new Response(JSON.stringify({ error: "AI gagal memproses file ini. Silakan coba lagi atau petakan kolom secara manual." }), { status: 502, headers: cors });
    const dat = await resp.json();
    const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    const result = parseObj(t);
    if (!result || !result.mapping || result.mapping.name === undefined || result.mapping.name === null) {
      return new Response(JSON.stringify({ error: "Kolom nama lead tidak dapat dikenali dari data ini. Silakan petakan kolom secara manual." }), { status: 422, headers: cors });
    }
    if (typeof result.data_start_row !== "number" || result.data_start_row < 0) result.data_start_row = 0;

    return new Response(JSON.stringify(result), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
