// Supabase Edge Function: lead-from-url
// User paste link website/Instagram/Google Maps calon customer di tab Leads,
// AI baca isi halamannya terus extract jadi draft lead baru - user tetep
// review/edit dulu sebelum disimpen (BUKAN langsung nulis ke DB dari sini).
//
// Kuota flat 15x/bulan WIB buat semua plan berbayar (Standard+). Kuota
// dikembalikan kalau link gak bisa dibaca / proses gagal.
//
// === AUDIT (30 Sep 2026) ===
// Fix releaseSlot: `.catch()` langsung di hasil rpc() (builder PostgREST gak
// punya .catch) bikin pengembalian kuota error sendiri - link yang gagal
// dibaca malah jadi 500 dan kuota tetep kepotong. Pesan ke user bahasa baku.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const cors = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTHLY_MAX = 15;
const MAX_CONTINUATIONS = 3;

function wibMonthStartUTC(d = new Date()) {
  const wibNow = new Date(d.getTime() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS);
}

async function reserveMonthlySlot(admin, userId, functionName, maxCalls) {
  const windowStart = wibMonthStartUTC().toISOString();
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: windowStart, p_max_calls: maxCalls });
  if (error) { console.error("[lead-from-url] reserve_edge_function_call gagal:", error); return null; }
  return data;
}
async function releaseSlot(admin, reservationId) {
  if (!reservationId) return;
  try {
    const { error } = await admin.rpc("release_edge_function_call", { p_id: reservationId });
    if (error) console.error("[lead-from-url] gagal release slot:", error);
  } catch (e) {
    console.error("[lead-from-url] gagal release slot:", e);
  }
}

function parseObj(t) {
  let x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = x.indexOf("{"); if (a !== -1) x = x.slice(a);
  const end = x.lastIndexOf("}");
  if (end !== -1) { try { return JSON.parse(x.slice(0, end + 1)); } catch (_) {} }
  return null;
}

async function extractLeadFromUrl(url) {
  const prompt = `Buka link ini pake tool web_fetch kamu, baca isinya (website resmi, profil Instagram bisnis, atau listing Google Maps), terus extract jadi draft lead sales buat CRM Indonesia:

${url}

Ambil info ini KALAU BENERAN ADA di halamannya (JANGAN NGARANG apa pun yang gak ketemu):
- name: nama usaha/perusahaan (WAJIB, kalau gak jelas nama usahanya, gak usah lanjut)
- key_person: nama pemilik/PIC kalau disebut (sering gak ada - kosongin aja)
- key_person_title: jabatannya kalau ada
- phone: nomor telepon/WA publik yang tercantum. PENTING: salin PERSIS digit-digitnya, JANGAN disingkat/dibulatkan/dipotong. Kalau ada LEBIH DARI SATU nomor di halaman itu (misal WA sales + telepon kantor + cabang lain), masukin SEMUANYA, dipisah koma (contoh: "0812-3456-7890, 021-5551234") - jangan cuma ambil satu.
- email: email publik yang tercantum. PENTING: salin PERSIS termasuk domainnya lengkap (jangan kepotong sebelum @ atau sebelum .com/.co.id/dst). Kalau ada LEBIH DARI SATU email (misal sales@ dan info@), masukin SEMUANYA dipisah koma.
- website: url resmi mereka (bisa beda dari url yang di-fetch, misal ini profil IG tapi linknya nunjuk ke website)
- city: kota/alamat singkat
- category: jenis usaha/industri
- product: produk/jasa utama yang mereka tawarin
- source_note: 1 kalimat singkat sumbernya (misal "Profil Instagram bisnis")

Kalau halamannya gak bisa diakses / gak ada info usaha yang jelas di situ (misal linknya rusak, private, atau kepake buat hal lain), balikin {"error": "<alasan singkat dalam bahasa Indonesia baku>"} aja.

Balas HANYA JSON, tanpa markdown, salah satu dari dua format ini:
{"name":"...","key_person":"","key_person_title":"","phone":"","email":"","website":"","city":"","category":"","product":"","source_note":"..."}
ATAU
{"error":"..."}`;

  const messages = [{ role: "user", content: prompt }];
  let dat = null;
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 1500,
        thinking: { type: "between_tools" },
        output_config: { effort: "medium" },
        messages,
        tools: [{ type: "web_fetch_20260318", name: "web_fetch", max_uses: 2, max_content_tokens: 5000, response_inclusion: "excluded" }],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Claude API ${resp.status}: ${t.slice(0, 200)}`);
    }
    dat = await resp.json();
    console.log("[lead-from-url] USAGE", JSON.stringify(dat.usage));
    if (dat.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: dat.content });
  }
  const textOut = (dat?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return parseObj(textOut);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  let admin = null;
  let reservationId = null;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Belum login" }), { status: 401, headers: cors });

    const [{ data: gateMemberRow }, { data: gateSettingsRow }] = await Promise.all([
      supabase.from("organization_members").select("org_id").eq("user_id", userData.user.id).limit(1).maybeSingle(),
      supabase.from("settings").select("plan").eq("user_id", userData.user.id).maybeSingle(),
    ]);
    const gateOrgResult = gateMemberRow ? await supabase.from("organizations").select("plan").eq("id", gateMemberRow.org_id).maybeSingle() : { data: null };
    const GATE_PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const gateIsEnterprise = gateOrgResult.data?.plan === "enterprise";
    const gateMyPlanLevel = gateIsEnterprise ? 2 : (GATE_PLAN_LEVEL[gateSettingsRow?.plan] ?? 0);
    if (gateMyPlanLevel < 1) {
      return new Response(JSON.stringify({ error: "Generate Lead dari Link tersedia untuk paket Standard ke atas. Silakan upgrade melalui tab Pengaturan." }), { status: 403, headers: cors });
    }

    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const url = (body.url || "").trim();
    if (!/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: "Link tidak valid - harus diawali http:// atau https://" }), { status: 400, headers: cors });
    }

    reservationId = await reserveMonthlySlot(admin, userData.user.id, "lead-from-url", MONTHLY_MAX);
    if (!reservationId) {
      return new Response(JSON.stringify({ error: `Kuota Generate Lead dari Link (${MONTHLY_MAX}x/bulan) sudah terpakai. Silakan coba lagi bulan depan, atau tambah lead secara manual.` }), { status: 429, headers: cors });
    }

    const extracted = await extractLeadFromUrl(url);
    if (!extracted || extracted.error || !extracted.name) {
      await releaseSlot(admin, reservationId); reservationId = null;
      return new Response(JSON.stringify({ error: (extracted?.error ? extracted.error + " " : "Tidak ditemukan info usaha yang jelas dari link tersebut. ") + "Kuota Anda tidak terpakai." }), { status: 422, headers: cors });
    }

    // Sampe sini SUKSES - reservasi slot TETEP kepake (gak di-release).
    return new Response(JSON.stringify({
      name: extracted.name || "",
      key_person: extracted.key_person || "",
      key_person_title: extracted.key_person_title || "",
      phone: extracted.phone || "",
      email: extracted.email || "",
      website: extracted.website || url,
      city: extracted.city || "",
      category: extracted.category || "",
      product: extracted.product || "",
      source_note: extracted.source_note || "",
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    if (admin && reservationId) await releaseSlot(admin, reservationId);
    console.log("[lead-from-url] FATAL:", String(e));
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
