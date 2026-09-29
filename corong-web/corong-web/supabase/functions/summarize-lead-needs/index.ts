// Supabase Edge Function: summarize-lead-needs
// Dipanggil ON-DEMAND dari LeadModal (tombol "Ringkasan Kebutuhan (AI)").
// Baca SEMUA catatan progress (notulen) satu lead spesifik, lalu minta AI
// nyimpulin: klien butuh produk/layanan apa, kenapa, ada sinyal budget/urgency
// gak - bukan cuma "langkah selanjutnya" doang kayak draft-followup/advisor,
// tapi kesimpulan kebutuhan yang bisa langsung dipake buat approach sales.
//
// Pola rate-limit/tier-gate/caching diambil dari draft-followup (edge
// function lain di project ini) biar konsisten.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Kuota 15x/BULAN per user (30 Sep 2026, permintaan Nando; sebelumnya 30x/bulan,
// awalnya 10x/hari).
const MONTHLY_LIMIT = 15;

function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  return new Date(Date.UTC(wibNow.getUTCFullYear(), wibNow.getUTCMonth(), 1, 0, 0, 0) - WIB_OFFSET_MS);
}

async function checkRateLimitPerUserMonthly(admin, userId, functionName, maxCalls) {
  const windowStart = wibMonthStartUTC().toISOString();
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: windowStart, p_max_calls: maxCalls });
  if (error) { console.error("[summarize-lead-needs] reserve_edge_function_call gagal:", error); return false; }
  return !!data;
}

const INDUSTRY_CONTEXT = {
  pvc_chemical: "distribusi/manufaktur PVC dan bahan kimia industri",
  automotive: "dealer kendaraan (mobil/motor)",
  property: "agen/developer properti",
  b2b_general: "distributor/trading B2B umum",
  insurance: "agen asuransi/financial services",
  retail_fmcg: "distribusi retail/FMCG",
  corporate_consultant: "konsultan/kontraktor jasa berbasis project buat perusahaan (SPK/kontrak kerja)",
};
const industryContext = (key) => INDUSTRY_CONTEXT[key] || INDUSTRY_CONTEXT.pvc_chemical;

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { lead_id } = await req.json();
    if (!lead_id) return new Response(JSON.stringify({ error: "lead_id wajib diisi" }), { status: 400, headers: cors });

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    // ---- TIER GATE - khusus Enterprise (30 Sep 2026, permintaan Nando;
    // sebelumnya Professional ke atas).
    const { data: memberRow } = await supabase.from("organization_members").select("org_id").eq("user_id", userData.user.id).limit(1).maybeSingle();
    const { data: orgRow } = memberRow ? await supabase.from("organizations").select("plan, industry").eq("id", memberRow.org_id).maybeSingle() : { data: null };
    const isEnterprise = orgRow?.plan === "enterprise";
    if (!isEnterprise) {
      return new Response(JSON.stringify({ error: "Ringkasan Kebutuhan (AI) itu fitur khusus paket Enterprise. Upgrade dulu di tab Pengaturan Nexto ya." }), { status: 403, headers: cors });
    }

    // RLS otomatis nge-filter, cuma bisa akses lead punya org sendiri (dan
    // buat sales_rep, cuma lead yang di-assign ke dia - leads_select_access).
    const { data: lead, error: leadErr } = await supabase.from("leads").select("*, progress_notes(id, note_date, text)").eq("id", lead_id).single();
    if (leadErr || !lead) return new Response(JSON.stringify({ error: "Lead gak ketemu" }), { status: 404, headers: cors });

    const notes = (lead.progress_notes || []).slice().sort((a, b) => (a.note_date < b.note_date ? -1 : 1));
    if (notes.length === 0) {
      return new Response(JSON.stringify({ error: "Belum ada catatan progress/notulen buat lead ini. Tambahin dulu catatan kunjungan/meeting-nya biar AI bisa nyimpulin kebutuhannya." }), { status: 400, headers: cors });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rateLimitOk = await checkRateLimitPerUserMonthly(admin, userData.user.id, "summarize-lead-needs", MONTHLY_LIMIT);
    if (!rateLimitOk) {
      return new Response(JSON.stringify({ error: `Kuota Ringkasan Kebutuhan (AI) (${MONTHLY_LIMIT}x/bulan) udah kepake. Coba lagi bulan depan.` }), { status: 429, headers: cors });
    }

    // Batesin ke 20 catatan terbaru biar prompt gak kegedean - kalau lead-nya
    // udah punya histori super panjang, yang lawas dianggap kurang relevan
    // dibanding progress terbaru.
    const notesForPrompt = notes.slice(-20).map((n) => `[${n.note_date}] ${(n.text || "").slice(0, 500)}`).join("\n");

    // Katalog produk/layanan org (30 Sep 2026) - kalau diisi, AI juga
    // rekomendasiin produk dari katalog ini yang cocok sama kebutuhan lead.
    const { data: catalog } = memberRow
      ? await supabase.from("org_product_catalog").select("company_profile, products").eq("org_id", memberRow.org_id).maybeSingle()
      : { data: null };
    const catalogProducts = (Array.isArray(catalog?.products) ? catalog.products : []).filter((p) => p?.name).slice(0, 20);
    const hasCatalog = catalogProducts.length > 0;
    const catalogText = hasCatalog
      ? `\nProfil perusahaan KITA (penjual): ${catalog.company_profile || "-"}\nKatalog produk/layanan KITA:\n${catalogProducts.map((p, i) => `${i + 1}. ${p.name}${p.description ? ` - ${p.description}` : ""}${p.fit_for ? ` | Cocok untuk: ${p.fit_for}` : ""}${p.price ? ` | Harga: ${p.price}` : ""}`).join("\n")}\n`
      : "";

    const prompt = `Kamu asisten sales yang bantu nyimpulin catatan progress/notulen meeting ke sebuah lead di bisnis ${industryContext(orgRow?.industry)}.
${catalogText}
Data lead: nama "${lead.name}", produk/scope yang ditawarin "${lead.product || "belum ada info"}", kategori "${lead.category || "-"}".

Berikut SELURUH catatan progress/notulen yang tercatat buat lead ini (urut dari lama ke baru):
${notesForPrompt}

Baca semua catatan di atas, lalu simpulkan:
1. Kebutuhan konkret apa aja yang keliatan dari klien ini (produk/layanan/scope spesifik yang dia butuhin) - bukan cuma "butuh produk kita" doang, tapi detail spesifik yang kesebut/tersirat di catatan (misal: "butuh sistem CRM buat 5 sales", bukan cuma "butuh software").
2. Kenapa dia butuh itu (alasan/masalah bisnis yang melatarbelakangi, kalau kesebut).
3. Ada sinyal soal budget/anggaran gak (disebut nominal/range, atau "gak ada budget khusus", atau emang gak ada info sama sekali).
4. Seberapa urgent (ada tenggat waktu/target tertentu yang kesebut, atau nggak).${hasCatalog ? `
5. Produk/layanan dari KATALOG KITA di atas yang paling cocok buat kebutuhan klien ini (maks 3, urut dari paling cocok), masing-masing dengan alasan singkat yang nyambungin ke kebutuhan spesifik di catatan. Nama produk WAJIB persis sama kayak di katalog - JANGAN rekomendasiin produk yang gak ada di katalog. Kalau gak ada yang cocok, kosongin array-nya.` : ""}

ATURAN PENTING: JANGAN mengarang detail yang gak ada atau gak tersirat jelas di catatan. Kalau suatu poin gak ada informasinya sama sekali, bilang terus terang "gak ada info di catatan" - jangan ditebak-tebak atau dihalusin biar keliatan lengkap.

Balas HANYA dengan JSON object, tanpa markdown, persis format ini:
{"summary":"ringkasan kebutuhan klien dalam 2-4 kalimat, bahasa natural","needs":["poin kebutuhan spesifik 1","poin kebutuhan spesifik 2"],"budget_signal":"deskripsi singkat sinyal budget, atau 'Gak ada info di catatan'","urgency":"Tinggi/Sedang/Rendah/Gak jelas - beserta alasan singkat"${hasCatalog ? `,"product_recommendations":[{"product":"nama persis dari katalog","reason":"alasan singkat 1 kalimat"}]` : ""}}
Tulis dalam Bahasa Indonesia yang natural.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 1200, thinking: { type: "between_tools" }, output_config: { effort: "medium" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) return new Response(JSON.stringify({ error: "AI gagal bikin ringkasan" }), { status: 500, headers: cors });
    const dat = await resp.json();
    const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    let obj = {};
    let x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = x.indexOf("{"); const e = x.lastIndexOf("}");
    if (a !== -1 && e !== -1) { try { obj = JSON.parse(x.slice(a, e + 1)); } catch (_) {} }

    if (!obj.summary) return new Response(JSON.stringify({ error: "AI gagal bikin ringkasan, coba lagi" }), { status: 500, headers: cors });

    const cleanText = (s) => (s || "").replace(/�/g, "").replace(/ {2,}/g, " ");
    obj.summary = cleanText(obj.summary);
    obj.needs = Array.isArray(obj.needs) ? obj.needs.map(cleanText).filter(Boolean) : [];
    obj.budget_signal = cleanText(obj.budget_signal || "Gak ada info di catatan");
    obj.urgency = cleanText(obj.urgency || "Gak jelas");
    // Buang rekomendasi yang namanya gak ada di katalog (jaga-jaga AI ngarang).
    const catalogNames = new Map(catalogProducts.map((p) => [p.name.trim().toLowerCase(), p.name]));
    obj.product_recommendations = (Array.isArray(obj.product_recommendations) ? obj.product_recommendations : [])
      .map((r) => ({ product: catalogNames.get(String(r?.product || "").trim().toLowerCase()), reason: cleanText(r?.reason) }))
      .filter((r) => r.product)
      .slice(0, 3);

    if (memberRow) {
      await supabase.from("lead_needs_summaries").upsert(
        {
          lead_id, org_id: memberRow.org_id,
          summary: obj.summary, needs: obj.needs, budget_signal: obj.budget_signal, urgency: obj.urgency,
          product_recommendations: obj.product_recommendations,
          based_on_notes_count: notes.length, generated_by: userData.user.id,
          created_at: new Date().toISOString(),
        },
        { onConflict: "lead_id" }
      );
    }

    return new Response(JSON.stringify({ ...obj, has_catalog: hasCatalog, based_on_notes_count: notes.length }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
