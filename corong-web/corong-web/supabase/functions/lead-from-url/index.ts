// Supabase Edge Function: lead-from-url
// User paste link website/Instagram/Google Maps calon customer di tab Leads,
// AI baca isi halamannya terus extract jadi draft lead baru - user tetep
// review/edit dulu sebelum disimpen (BUKAN langsung nulis ke DB dari sini).
//
// Kuota flat 10x/bulan (6 Okt 2026, dulu 15x) buat semua plan berbayar (Standard+). Kuota
// dikembalikan kalau link gak bisa dibaca / proses gagal.
//
// === AUDIT (30 Sep 2026) ===
// Fix releaseSlot: `.catch()` langsung di hasil rpc() (builder PostgREST gak
// punya .catch) bikin pengembalian kuota error sendiri - link yang gagal
// dibaca malah jadi 500 dan kuota tetep kepotong. Pesan ke user bahasa baku.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { AsyncLocalStorage } from "node:async_hooks";

// === PENCATAT PEMAKAIAN AI (6 Okt 2026, permintaan Nando) ===
// Setiap panggilan ke Anthropic/OpenAI dari function ini dicatat ke tabel
// ai_usage (token, pencarian web, durasi audio, biaya USD) atas nama pengguna
// yang memicunya - dipakai Command Center untuk pemakaian & biaya per akun.
// Pengguna diambil dari JWT request; jalur cron/internal memanggil aiSetUser().
// Harga per 1 juta token: [input, output, tulis cache, baca cache].
const AI_FEATURE = "lead-from-url";
const AI_CTX = new AsyncLocalStorage();
const AI_PRICE = { sonnet: [2, 10, 2.5, 0.2], haiku: [1, 5, 1.25, 0.1] };
function aiSetUser(userId, orgId = null) {
  const s = AI_CTX.getStore();
  if (s) { s.userId = userId || null; if (orgId) s.orgId = orgId; }
}
function aiJwtUser(req) {
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role === "authenticated" ? payload.sub : null;
  } catch (_) {
    return null;
  }
}
const AI_RAW_FETCH = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const resp = await AI_RAW_FETCH(input, init);
  try {
    const url = typeof input === "string" ? input : (input?.url || String(input));
    if (resp.ok && (url.startsWith("https://api.anthropic.com/") || url.startsWith("https://api.openai.com/"))) {
      await aiLogUsage(url, init, resp.clone());
    }
  } catch (e) {
    console.log("[ai-usage] gagal mencatat:", String(e));
  }
  return resp;
};
async function aiLogUsage(url, init, resp) {
  const ctx = AI_CTX.getStore() || {};
  const row = {
    feature: AI_FEATURE,
    user_id: ctx.userId !== undefined ? ctx.userId : (ctx.req ? aiJwtUser(ctx.req) : null),
    org_id: ctx.orgId || null,
    provider: url.includes("anthropic") ? "anthropic" : "openai",
  };
  if (row.provider === "anthropic") {
    const d = await resp.json();
    const u = d.usage || {};
    let model = d.model || "";
    if (!model) { try { model = JSON.parse(init?.body || "{}").model || ""; } catch (_) { /* tanpa model */ } }
    const p = model.includes("haiku") ? AI_PRICE.haiku : AI_PRICE.sonnet;
    Object.assign(row, {
      model,
      input_tokens: u.input_tokens || 0,
      output_tokens: u.output_tokens || 0,
      cache_write_tokens: u.cache_creation_input_tokens || 0,
      cache_read_tokens: u.cache_read_input_tokens || 0,
      web_searches: u.server_tool_use?.web_search_requests || 0,
      web_fetches: u.server_tool_use?.web_fetch_requests || 0,
    });
    row.cost_usd = (row.input_tokens * p[0] + row.output_tokens * p[1] + row.cache_write_tokens * p[2] + row.cache_read_tokens * p[3]) / 1e6 + row.web_searches * 0.01;
  } else if (url.includes("/audio/transcriptions")) {
    const d = await resp.json();
    row.model = "whisper-1";
    row.audio_seconds = Math.round(d.duration || 0);
    row.cost_usd = ((d.duration || 0) / 60) * 0.006;
  } else if (url.includes("/audio/speech")) {
    let body = {};
    try { body = JSON.parse(init?.body || "{}"); } catch (_) { /* body bukan JSON */ }
    row.model = body.model || "tts-1";
    row.tts_chars = String(body.input || "").length;
    row.cost_usd = (row.tts_chars * 15) / 1e6;
  } else if (url.includes("/embeddings")) {
    const d = await resp.json();
    row.model = d.model || "text-embedding-3-small";
    row.input_tokens = d.usage?.total_tokens || 0;
    row.cost_usd = (row.input_tokens * 0.02) / 1e6;
  } else {
    return;
  }
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ins = await AI_RAW_FETCH(`${Deno.env.get("SUPABASE_URL")}/rest/v1/ai_usage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!ins.ok) console.log("[ai-usage] simpan gagal:", ins.status, (await ins.text()).slice(0, 200));
}

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

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const cors = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const MONTHLY_MAX = 10;
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

Deno.serve((req) => AI_CTX.run({ req }, async () => {
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
      return new Response(JSON.stringify({ error: `Kuota Generate Lead dari Link (${MONTHLY_MAX}x per bulan) sudah terpakai. ${await quotaRefillText(admin, userData.user.id, "lead-from-url")} Anda juga dapat menambah lead secara manual.` }), { status: 429, headers: cors });
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
}));
