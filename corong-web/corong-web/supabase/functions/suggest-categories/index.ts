// Supabase Edge Function: suggest-categories
// Kasih saran kategori buat lead yang masih "Lainnya", berdasarkan produk/background.
// Fitur "Rapihin Data" di tab Pengaturan. Standard ke atas, 4x/bulan per user
// (kalender WIB), reservasi atomic lewat reserve_edge_function_call.
//
// === AUDIT ISTILAH INDUSTRI (30 Sep 2026) ===
// Sebelumnya daftar kategori & prompt ditulis mati PVC ("Pipa & Fitting",
// "Kabel Listrik", "CRM sales industri PVC") buat SEMUA org - Corporate
// Consultant/dealer/dst bakal disaranin kategori pipa & kabel. Sekarang pakai
// daftar kategori resmi per industri (salinan src/lib/industryTemplates.js -
// kalau kategori di sana berubah, samain di sini). Kuota dikembalikan kalau
// AI gagal. Pesan ke user pakai bahasa baku.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Kuota bulanan berlaku 1 bulan sejak pemakaian pertama (6 Okt 2026, tabel
// quota_periods) - bukan lagi reset tiap tanggal 1. reserve_edge_function_call
// menghitung periodenya sendiri; helper ini untuk menampilkan tanggal terisi
// kembali di pesan kuota habis.
async function quotaRefillText(admin, userId, feature) {
  try {
    const { data } = await admin.rpc("quota_usage", { p_user_id: userId, p_feature: feature });
    if (data?.reset_at) return `Kuota terisi kembali pada ${new Date(data.reset_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}.`;
  } catch (_) { /* pesan tanpa tanggal */ }
  return "Kuota terisi kembali 1 bulan setelah pemakaian pertama.";
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INDUSTRY_CATEGORIES = {
  pvc_chemical: { label: "PVC / kimia (manufaktur)", categories: ["Resin & Compound", "Pipa & Fitting", "Kabel Listrik", "Flooring / Sheet / Film", "Roofing / Ceiling / Profil", "Kulit Sintetis & Vinyl", "Selang Fleksibel", "Packaging & Botol", "Produk Konstruksi", "Lainnya"] },
  automotive: { label: "dealer kendaraan", categories: ["Mobil Baru", "Mobil Bekas", "Motor Baru", "Motor Bekas", "Spare Part", "Aksesoris", "Lainnya"] },
  property: { label: "properti / real estate", categories: ["Rumah Tapak", "Apartemen", "Ruko / Rukan", "Tanah Kavling", "Gudang / Pabrik", "Lainnya"] },
  b2b_general: { label: "B2B / distributor umum", categories: ["Bahan Baku", "Barang Jadi", "Jasa", "Peralatan", "Lainnya"] },
  insurance: { label: "asuransi / financial services", categories: ["Asuransi Jiwa", "Asuransi Kesehatan", "Asuransi Umum", "Asuransi Pendidikan", "Investasi", "Lainnya"] },
  retail_fmcg: { label: "retail / FMCG", categories: ["Makanan & Minuman", "Perawatan Diri", "Rumah Tangga", "Elektronik Ringan", "Lainnya"] },
  corporate_consultant: { label: "corporate consultant (jasa berbasis project) - kategori = SEKTOR INDUSTRI perusahaan klien, bukan jenis jasa konsultannya", categories: ["Manufaktur", "Perbankan & Keuangan", "Retail & FMCG", "Teknologi & Telekomunikasi", "Kesehatan & Farmasi", "Energi & Pertambangan", "Properti & Konstruksi", "Logistik & Transportasi", "Pendidikan", "Hospitality & F&B", "Lainnya"] },
};
const MAX_CALLS_PER_MONTH = 4;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS);
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let admin = null;
  let reservationId = null;
  const releaseQuota = async () => {
    if (!admin || !reservationId) return;
    try { await admin.rpc("release_edge_function_call", { p_id: reservationId }); } catch (_) { /* best effort */ }
    reservationId = null;
  };
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const anonClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;
    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: memberRow } = await admin.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
    const { data: orgRow } = memberRow ? await admin.from("organizations").select("plan, industry").eq("id", memberRow.org_id).maybeSingle() : { data: null };
    const { data: settingsRow } = await admin.from("settings").select("plan").eq("user_id", userId).maybeSingle();
    const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const isEnterprise = orgRow?.plan === "enterprise";
    const myPlanLevel = isEnterprise ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
    if (myPlanLevel < 1) {
      return json({ error: "Rapihin Data tersedia untuk paket Standard ke atas. Silakan upgrade melalui tab Pengaturan." }, 403);
    }
    const ind = INDUSTRY_CATEGORIES[orgRow?.industry] || INDUSTRY_CATEGORIES.b2b_general;
    const CATEGORIES = ind.categories;

    const monthStart = wibMonthStartUTC().toISOString();
    const { data: reserved, error: rlErr } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: "suggest-categories", p_window_start: monthStart, p_max_calls: MAX_CALLS_PER_MONTH });
    if (rlErr) {
      console.error("[suggest-categories] reserve_edge_function_call gagal:", rlErr);
      return json({ error: "Gagal memeriksa kuota. Silakan coba lagi sebentar." }, 500);
    }
    if (!reserved) {
      return json({ error: `Kuota Rapihin Data (${MAX_CALLS_PER_MONTH}x per bulan) sudah terpakai. ${await quotaRefillText(admin, userId, "suggest-categories")}` }, 429);
    }
    reservationId = reserved;

    const { data: leads } = await admin
      .from("leads")
      .select("id, name, product, background")
      .eq("user_id", userId)
      .eq("category", "Lainnya");

    // Nama lead ikut dipakai (1 Okt 2026): di Corporate Consultant kategori =
    // sektor klien, dan sektornya sering cuma kelihatan dari nama perusahaan
    // (misal "PT Bank ...").
    const candidates = (leads || []).filter((l) => (l.product && l.product.trim()) || (l.background && l.background.trim()) || (l.name && l.name.trim())).slice(0, 40);
    if (candidates.length === 0) {
      await releaseQuota(); // gak ada yang dianalisis, jangan potong kuota
      return json({ suggestions: [] });
    }

    const prompt = `Kamu klasifikasi kategori lead untuk CRM sales di bisnis ${ind.label}. Kategori yang tersedia: ${CATEGORIES.filter((c) => c !== "Lainnya").join(" | ")}.
Untuk tiap lead di bawah, tentukan kategori paling cocok berdasarkan nama, produk, dan background. Kalau memang tidak jelas/tidak cocok satupun, biarkan "Lainnya". Nama kategori WAJIB persis sama dengan daftar di atas.
Balas HANYA JSON array, tanpa markdown: [{"id":"...","suggested":"nama kategori atau 'Lainnya'"}]
Data lead:
${JSON.stringify(candidates.map((c) => ({ id: c.id, name: c.name || "", product: c.product || "", background: (c.background || "").slice(0, 200) })))}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 2500, thinking: { type: "between_tools" }, output_config: { effort: "low" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const dat = await resp.json();
    let t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    t = t.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = t.indexOf("["), e = t.lastIndexOf("]");
    const parsed = a !== -1 && e !== -1 ? JSON.parse(t.slice(a, e + 1)) : [];

    const nameMap = Object.fromEntries((leads || []).map((l) => [l.id, l.name]));
    const suggestions = parsed
      .filter((s) => s.suggested && s.suggested !== "Lainnya" && CATEGORIES.includes(s.suggested))
      .map((s) => ({ id: s.id, name: nameMap[s.id] || "", suggested: s.suggested }));

    return json({ suggestions });
  } catch (e) {
    await releaseQuota();
    return json({ error: "Gagal membuat saran kategori. Kuota Anda tidak terpakai, silakan coba lagi. (" + String(e) + ")" }, 500);
  }
});
